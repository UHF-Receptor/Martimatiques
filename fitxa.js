// =====================================================================
//  Lector de fitxes LaTeX (format main.tex) → HTML amb caselles de resposta
//  Cada \sol{...} es converteix en una casella. La solució NO va a l'HTML.
// =====================================================================

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function grup(s, i, obre = '{', tanca = '}') {
  // s[i] === obre → [contingut, índex final] (tolerant: si no tanca, fins a final de línia)
  let prof = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === obre) prof++;
    else if (s[j] === tanca) { prof--; if (prof === 0) return [s.slice(i + 1, j), j + 1, true]; }
  }
  let fi = s.indexOf('\n', i);
  if (fi < 0) fi = s.length;
  return [s.slice(i + 1, fi), fi, false];
}

function treuComentaris(tex) {
  return tex.split('\n').map(l => {
    for (let k = 0; k < l.length; k++) {
      if (l[k] === '\\') { k++; continue; }
      if (l[k] === '%') return l.slice(0, k);
    }
    return l;
  }).join('\n');
}

// Macros simples del preàmbul (\newcommand{\nom}[n]{cos}) per a KaTeX
function llegeixMacros(preambul) {
  const macros = {};
  const re = /\\(?:re)?newcommand\s*\{?\s*(\\[a-zA-Z]+)\s*\}?\s*(\[\d\])?\s*\{/g;
  let m;
  while ((m = re.exec(preambul))) {
    const [cos, fi, tancat] = grup(preambul, m.index + m[0].length - 1);
    re.lastIndex = fi;
    if (!tancat || ['\\sol', '\\punt'].includes(m[1])) continue;
    if (/\\(it|bf|font|input|hfill|vskip)/.test(cos)) continue;
    macros[m[1]] = cos;
  }
  return macros;
}

export const MACROS_BASE = {
  '\\euro': '\\text{€}', '\\EUR': '\\text{€}', '\\wideparen': '\\overgroup',
  '\\sen': '\\operatorname{sin}', '\\tg': '\\operatorname{tg}', '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}',
};

/**
 * @param {string} tex  el document complet (o només el cos)
 * @returns {{titol:string, html:string, preguntes:Array, macros:object, avisos:string[]}}
 */
export function llegeixFitxa(tex) {
  const avisos = [];
  let src = String(tex).replace(/\r\n?/g, '\n');
  let preambul = '';
  const ib = src.indexOf('\\begin{document}');
  if (ib >= 0) {
    preambul = src.slice(0, ib);
    src = src.slice(ib + '\\begin{document}'.length);
    const ie = src.indexOf('\\end{document}');
    if (ie >= 0) src = src.slice(0, ie);
  }
  const macros = llegeixMacros(treuComentaris(preambul));
  src = treuComentaris(src);

  // Capçalera del centre ({\capsal ...}) i línies \font
  src = src.replace(/\\font\\\w+\s*=\s*\w+/g, '');
  let k;
  while ((k = src.indexOf('{\\capsal')) >= 0) src = src.slice(0, k) + src.slice(grup(src, k)[1]);
  src = src.replace(/\\(maketitle|tableofcontents|newpage|clearpage|pagebreak|noindent|centering|raggedright|small|footnotesize|large|Large|normalsize|bigskip|medskip|smallskip|hrule|par\b)/g, m => (m === '\\par' ? '\n\n' : ' '));

  // 1) Solucions → marcadors
  const preguntes = [];
  const sols = [];
  src = src.replace(/(\\hfill\s*)?\\sol\s*\{/g, '\u0000SOL{');
  let out = '';
  for (let i = 0; i < src.length;) {
    if (src.startsWith('\u0000SOL{', i)) {
      const [cont, fi, tancat] = grup(src, i + 4);
      if (!tancat) avisos.push('Una solució no té la clau } de tancament: "' + cont.trim().slice(0, 40) + '"');
      sols.push(cont.trim());
      out += '\u0001S' + (sols.length - 1) + '\u0001';
      i = fi;
    } else out += src[i++];
  }
  src = out;

  // 2) Fórmules → marcadors (perquè el text no les toqui)
  const formules = [];
  const desa = (latex, display) => { formules.push({ latex, display }); return '\u0001M' + (formules.length - 1) + '\u0001'; };
  src = src.replace(/\\begin\{(align|align\*|equation|equation\*|eqnarray|eqnarray\*|gather|gather\*)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, c) => desa(env.startsWith('equation') ? c : '\\begin{aligned}' + c.replace(/&=/g, '&=') + '\\end{aligned}', true));
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, c) => desa(c, true));
  src = src.replace(/\\\[([\s\S]+?)\\\]/g, (_, c) => desa(c, true));
  src = src.replace(/\\\(([\s\S]+?)\\\)/g, (_, c) => desa(c, false));
  src = src.replace(/(^|[^\\])\$((?:\\.|[^$\\])+?)\$/g, (_, pre, c) => pre + desa(c, false));
  src = src.replace(/(^|[^\\])\$((?:\\.|[^$\\])+?)\$/g, (_, pre, c) => pre + desa(c, false));
  if (/(^|[^\\])\$/.test(src)) avisos.push('Hi ha un símbol $ sense parella');

  // 3) Figures TikZ i taules
  const figures = [];
  src = src.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, m => { figures.push(m); return '\u0001T' + (figures.length - 1) + '\u0001'; });
  src = src.replace(/\\begin\{tabular\}\s*\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/g, (_, spec, cos) => taula(cos));

  // 4) Recorregut d'estructura (seccions, llistes, ítems)
  const pila = [];         // {tipus:'ol'|'ul', n, format, etiqueta, liObert}
  let html = '';
  let seccio = 0, nSeccions = (src.match(/\\section\*?\s*\{/g) || []).length;
  let titol = '';
  const solsVistes = new Map();   // etiqueta d'ítem → quantes solucions

  const reEstructura = /\\begin\{(enumerate|itemize|center|multicols|minipage|flushleft|flushright|quote|figure|table)\}(\[[^\]]*\])?(\{[^}]*\})?(\{[^}]*\})?|\\end\{(enumerate|itemize|center|multicols|minipage|flushleft|flushright|quote|figure|table)\}|\\item\s*(\[[^\]]*\])?|\\(sub)?section\*?\s*\{/g;
  let darrer = 0, m;
  const etiquetaActual = () => {
    const parts = pila.filter(p => p.tipus === 'ol').map(p => p.etiqueta.replace(/[^0-9a-zA-Z]/g, ''));
    let e = parts.join('');
    if (nSeccions > 1 && seccio > 0) e = seccio + '·' + e;
    return e || 'P';
  };
  const text = t => transformaText(t, sols, preguntes, etiquetaActual, solsVistes);

  while ((m = reEstructura.exec(src))) {
    html += text(src.slice(darrer, m.index));
    darrer = reEstructura.lastIndex;
    const tot = m[0];
    if (tot.startsWith('\\begin')) {
      const env = m[1];
      if (env === 'enumerate' || env === 'itemize') {
        const opc = m[2] || '';
        const nivell = pila.filter(p => p.tipus === 'ol').length;
        let format = ['\\arabic*.', '\\alph*)', '\\roman*.', '\\Alph*.'][nivell] || '\\arabic*.';
        const lm = /label\s*=\s*([^,\]]+)/.exec(opc);
        if (lm) format = lm[1].trim().replace(/^\{|\}$/g, '');
        pila.push({ tipus: env === 'enumerate' ? 'ol' : 'ul', n: 0, format, etiqueta: '', liObert: false });
        html += env === 'enumerate' ? '<ol class="llista">' : '<ul class="punts">';
      } else if (env === 'multicols') {
        const ncol = parseInt((m[3] || '{2}').replace(/\D/g, '')) || 2;
        html += `<div class="columnes" style="--cols:${ncol}">`;
        pila.push({ tipus: 'div' });
      } else {
        html += `<div class="env-${env}">`;
        pila.push({ tipus: 'div' });
      }
    } else if (tot.startsWith('\\end')) {
      // tanca fins a trobar l'entorn corresponent (tolerant amb errors)
      const env = m[5];
      const tipus = env === 'enumerate' ? 'ol' : env === 'itemize' ? 'ul' : 'div';
      if (!pila.some(p => p.tipus === tipus)) { avisos.push('Sobra un \\end{' + env + '}'); continue; }
      while (pila.length) {
        const p = pila.pop();
        html += tancaNivell(p);
        if (p.tipus === tipus) break;
      }
    } else if (tot.startsWith('\\item')) {
      const p = [...pila].reverse().find(x => x.tipus === 'ol' || x.tipus === 'ul');
      if (!p) { avisos.push('Hi ha un \\item fora d\'una llista'); continue; }
      if (p.liObert) html += '</li>';
      p.n++;
      p.liObert = true;
      if (p.tipus === 'ol') {
        p.etiqueta = m[6] ? m[6].slice(1, -1) : formatEtiqueta(p.format, p.n);
        html += `<li><span class="etiq">${esc(m[6] ? m[6].slice(1, -1) : formatEtiqueta(p.format, p.n))}</span> `;
      } else html += '<li>';
    } else {
      // \section{...} o \subsection{...}
      const [cont, fi] = grup(src, reEstructura.lastIndex - 1);
      darrer = fi;
      reEstructura.lastIndex = fi;
      const sub = !!m[7];
      if (!sub) { seccio++; if (!titol) titol = text(cont).replace(/<[^>]+>/g, '').trim(); }
      html += sub ? `<h3>${text(cont)}</h3>` : `<h2><span class="num-seccio">${seccio}</span> ${text(cont)}</h2>`;
    }
  }
  html += text(src.slice(darrer));
  if (pila.length) {
    if (pila.some(p => p.tipus !== 'div')) avisos.push('Falta tancar alguna llista (\\end{enumerate}); s\'ha tancat automàticament');
    while (pila.length) html += tancaNivell(pila.pop());
  }

  // 5) Restaura fórmules i figures
  html = html.replace(/\u0001M(\d+)\u0001/g, (_, n) => {
    const f = formules[+n];
    return f.display ? `<div class="md">${esc(f.latex)}</div>` : `<span class="m">${esc(f.latex)}</span>`;
  });
  html = html.replace(/\u0001T(\d+)\u0001/g, (_, n) => `<div class="tikz" data-tikz="${esc(figures[+n])}"></div>`);
  html = html.replace(/<p>\s*<\/p>/g, '');

  if (!preguntes.length) avisos.push('No s\'ha trobat cap \\sol{...}: la fitxa no tindrà caselles de resposta');
  return { titol, html, preguntes, macros, avisos };
}

function tancaNivell(p) {
  if (p.tipus === 'div') return '</div>';
  return (p.liObert ? '</li>' : '') + (p.tipus === 'ol' ? '</ol>' : '</ul>');
}

function romà(n) {
  const t = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let r = '';
  for (const [v, s] of t) while (n >= v) { r += s; n -= v; }
  return r;
}
function formatEtiqueta(format, n) {
  return format
    .replace(/\\arabic\*/g, String(n))
    .replace(/\\alph\*/g, String.fromCharCode(96 + n))
    .replace(/\\Alph\*/g, String.fromCharCode(64 + n))
    .replace(/\\roman\*/g, romà(n))
    .replace(/\\Roman\*/g, romà(n).toUpperCase())
    .replace(/[{}]/g, '');
}

function taula(cos) {
  const files = cos.split(/\\\\/).map(f => f.replace(/\\(hline|cline\{[^}]*\}|toprule|midrule|bottomrule)/g, '').trim()).filter(f => f);
  return '\u0002TAULA' + files.map(f => {
    const cel = f.split(/(?<!\\)&/).map(c => {
      const mc = /\\multicolumn\{(\d+)\}\{[^}]*\}\{([\s\S]*)\}/.exec(c);
      if (mc) return `\u0002TD colspan="${mc[1]}"\u0002${mc[2]}\u0002/TD\u0002`;
      const mr = /\\multirow\{\d+\}\{[^}]*\}\{([\s\S]*)\}/.exec(c);
      return `\u0002TD\u0002${mr ? mr[1] : c}\u0002/TD\u0002`;
    }).join('');
    return `\u0002TR\u0002${cel}\u0002/TR\u0002`;
  }).join('') + '\u0002/TAULA\u0002';
}

// Text normal (fora de fórmules): format bàsic i caselles de resposta
function transformaText(t, sols, preguntes, etiquetaActual, solsVistes) {
  if (!t) return '';
  let s = esc(t);
  // grups {\it ...} {\bf ...}
  for (let guard = 0; guard < 50; guard++) {
    const mm = /\{\\(it|bf|em|sl|sc|tt)\s/.exec(s);
    if (!mm) break;
    const [c, fi] = grup(s, mm.index);
    const tag = mm[1] === 'bf' ? 'b' : mm[1] === 'tt' ? 'code' : 'i';
    s = s.slice(0, mm.index) + `<${tag}>` + c.slice(mm[0].length - 1) + `</${tag}>` + s.slice(fi);
  }
  const ordres = { textbf: 'b', textit: 'i', emph: 'i', underline: 'u', texttt: 'code', textsc: 'span', textsf: 'span', textrm: 'span', mbox: 'span', text: 'span' };
  for (let guard = 0; guard < 200; guard++) {
    const mm = /\\(textbf|textit|emph|underline|texttt|textsc|textsf|textrm|mbox|text)\s*\{/.exec(s);
    if (!mm) break;
    const [c, fi] = grup(s, mm.index + mm[0].length - 1);
    s = s.slice(0, mm.index) + `<${ordres[mm[1]]}>` + c + `</${ordres[mm[1]]}>` + s.slice(fi);
  }
  // \punt{2}
  s = s.replace(/\\punt\s*\{([^}]*)\}/g, '<span class="puntuacio">($1 punts)</span>');
  // imatges
  s = s.replace(/\\includegraphics\s*(\[[^\]]*\])?\s*\{([^}]*)\}/g, (_, opc, ruta) => {
    let src = ruta.trim();
    if (!/^https?:\/\//.test(src)) { src = 'img/' + src.split('/').pop(); if (!/\.\w{3,4}$/.test(src)) src += '.png'; }
    const w = /width\s*=\s*([\d.]+)\\(textwidth|linewidth)/.exec(opc || '');
    return `<img class="figura" src="${src}" alt="figura"${w ? ` style="width:${Math.round(parseFloat(w[1]) * 100)}%"` : ''}>`;
  });
  s = s
    .replace(/\\hfill/g, '<span class="hfill"></span>')
    .replace(/\\\\(\s*\[[^\]]*\])?/g, '<br>')
    .replace(/\\newline/g, '<br>')
    .replace(/\\(vskip|vspace\*?|hspace\*?|kern)\s*(\{[^}]*\}|[-\d.]+\s*\w+)/g, ' ')
    .replace(/\\(euro|EUR)\b\s*(\{\})?/g, '€')
    .replace(/\\%/g, '%').replace(/\\&amp;/g, '&amp;').replace(/\\#/g, '#').replace(/\\_/g, '_').replace(/\\\$/g, '$')
    .replace(/---/g, '—').replace(/--/g, '–').replace(/``/g, '“').replace(/''/g, '”')
    .replace(/~/g, '&nbsp;')
    .replace(/\\(quad|qquad)\b/g, '&emsp;')
    .replace(/\\[,;: ]/g, ' ')
    .replace(/\\input\s*\{[^}]*\}/g, '')
    .replace(/\n\s*\n+/g, '<p></p>');
  // ordres desconegudes: treu el nom i deixa el contingut
  s = s.replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, '').replace(/[{}]/g, '');
  // taules
  s = s.replace(/\u0002TAULA/g, '<table class="taula">').replace(/\u0002\/TAULA\u0002/g, '</table>')
       .replace(/\u0002TR\u0002/g, '<tr>').replace(/\u0002\/TR\u0002/g, '</tr>')
       .replace(/\u0002TD( colspan=&quot;(\d+)&quot;| colspan="(\d+)")?\u0002/g, (_, a, n1, n2) => (n1 || n2) ? `<td colspan="${n1 || n2}">` : '<td>')
       .replace(/\u0002\/TD\u0002/g, '</td>');
  // caselles de resposta
  s = s.replace(/\u0001S(\d+)\u0001/g, (_, n) => {
    const base = etiquetaActual();
    const vistes = (solsVistes.get(base) || 0) + 1;
    solsVistes.set(base, vistes);
    const etiqueta = vistes > 1 ? `${base}.${vistes}` : base;
    if (vistes === 2) {
      const primera = preguntes.find(p => p.etiqueta === base);
      if (primera) primera.etiqueta = base + '.1';
    }
    const id = 'q' + (preguntes.length + 1);
    preguntes.push({ id, etiqueta, sol: sols[+n] });
    return `<span class="resposta" data-q="${id}"></span>`;
  });
  return s;
}
