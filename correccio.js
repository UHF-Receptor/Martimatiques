// =====================================================================
//  Motor de correcció del Quadern de Martimàtiques
//  - Converteix LaTeX (del professor o de l'editor de fórmules) en una
//    expressió, l'avalua i compara respostes per equivalència.
//  - Sense dependències externes (funciona al navegador i a Node).
// =====================================================================

// ---------- SHA-256 (síncron, per guardar "empremtes" de les solucions) ----------
export function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length;
  const n = (((l + 9) >> 6) + 1) << 6;
  const m = new Uint8Array(n);
  m.set(bytes); m[l] = 0x80;
  const bits = l * 8;
  m[n - 4] = (bits >>> 24) & 255; m[n - 3] = (bits >>> 16) & 255; m[n - 2] = (bits >>> 8) & 255; m[n - 1] = bits & 255;
  m[n - 8] = Math.floor(bits / 2 ** 32) & 255;
  const w = new Uint32Array(64);
  const r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let i = 0; i < n; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = (m[i + 4 * t] << 24) | (m[i + 4 * t + 1] << 16) | (m[i + 4 * t + 2] << 8) | m[i + 4 * t + 3];
    for (let t = 16; t < 64; t++) {
      const s0 = r(w[t - 15], 7) ^ r(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = r(w[t - 2], 17) ^ r(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = r(e, 6) ^ r(e, 11) ^ r(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = r(a, 2) ^ r(a, 13) ^ r(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

// ---------- Errors ----------
export class ErrorResposta extends Error {}
const falla = msg => { throw new ErrorResposta(msg); };

// =====================================================================
//  1. PREPROCÉS: treure text, unitats, espais; separar solucions
// =====================================================================
const UNITATS = ['km','hm','dam','dm','cm','mm','kg','hg','dag','dg','cg','mg','kl','hl','dal','dl','cl','ml','ha','min','seg','eur','euros','euro'];
const PARAULES_CURTES = ['de','la','el','en','un','es','hi','ho','al','als','les','els','del','dels','per','amb','que'];
const FUNCIONS = ['sqrt','nroot','log','ln','abs','sin','cos','tan','pi','e','inf'];
const SENSE_SOLUCIO = /\\emptyset|\\varnothing|\\nexists|∅|no\s+t[ée]\s+soluci[óo]|sense\s+soluci[óo]|cap\s+soluci[óo]|no\s+hi\s+ha\s+soluci[óo]/i;

function llegeixGrup(s, i, obre = '{', tanca = '}') {
  // s[i] ha de ser 'obre'. Retorna [contingut, índex després del tancament]
  let prof = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === obre) prof++;
    else if (s[j] === tanca) { prof--; if (prof === 0) return [s.slice(i + 1, j), j + 1]; }
  }
  falla('Falta tancar una clau o un parèntesi');
}

function treuComandaAmbGrup(s, noms, substitut = ' ') {
  // Elimina \nom{...} (i un exponent d'unitat al darrere, p. ex. \text{ cm}^2)
  const re = new RegExp('\\\\(' + noms.join('|') + ')\\s*\\{', 'g');
  let m;
  while ((m = re.exec(s))) {
    const ini = m.index;
    const [, fi0] = llegeixGrup(s, m.index + m[0].length - 1);
    let fi = fi0;
    const exp = /^\s*\^\s*(\{\s*[23]\s*\}|[23])/.exec(s.slice(fi));
    if (exp) fi += exp[0].length;
    s = s.slice(0, ini) + (substitut === null ? ' ' + s.slice(m.index + m[0].length, fi0 - 1) + ' ' + s.slice(fi0, fi) : substitut) + s.slice(fi);
    re.lastIndex = ini;
  }
  return s;
}

export function netejaLatex(entrada) {
  let s = String(entrada ?? '');
  // Si hi ha fórmules entre $...$, el que queda fora és text i no compta
  if (/(^|[^\\])\$/.test(s)) {
    const parts = s.split(/(?<!\\)\$/).filter((_, k) => k % 2 === 1)
      .map(x => x.trim())
      .filter(x => x && !/^\^\s*(\{\s*[23]\s*\}|[23]|\{?\s*\\circ\s*\}?)$/.test(x));
    s = parts.join(' ; ');
  }
  s = s.replace(/\\(displaystyle|textstyle|limits|nolimits)/g, '')
       .replace(/\$/g, ' ')
       .replace(/\\operatorname\s*\{\s*(\w+)\s*\}/g, '\\$1 ')
       .replace(/\\exponentialE/g, ' e ')
       .replace(/\\placeholder\s*(\[[^\]]*\])?\s*\{[^}]*\}/g, ' ? ');
  // text, unitats i símbols que no compten
  s = treuComandaAmbGrup(s, ['text', 'textrm', 'textit', 'textbf', 'mbox', 'mathrm', 'mathit', 'textnormal', 'mathbf'], null);
  s = s.replace(/(^|[^a-zA-Z\\])(km|hm|dam|dm|cm|mm|m)\s*\/\s*(h|s|min)(?![a-zA-Z])/g, '$1 ');
  s = s.replace(/\\euro|\\EUR|€|\\%|%|\\degree|°|º|ª|\\\$/g, ' ')
       .replace(/\^\s*\{?\s*\\circ\s*\}?/g, ' ')
       .replace(/\\(approx|simeq|thickapprox)/g, '=')
       .replace(/\{,\}/g, '.')
       .replace(/\{\.\}/g, '.')
       .replace(/(\d)\\,(?=\d)/g, '$1')            // separador de milers 15\,625
       .replace(/\\(,|;|:|!| |quad|qquad|enspace)/g, ' ')
       .replace(/~/g, ' ');
  // paraules (part escrita): només compta el número
  s = s.replace(/(^|[^\\a-zA-Z])([a-zA-ZàèéíïòóúüçÀÈÉÍÏÒÓÚÜÇ·]+(['’][a-zA-ZàèéíïòóúüçÀÈÉÍÏÒÓÚÜÇ]+)*)(\s*\^\s*(\{\s*[23]\s*\}|[23]))?/g, (tot, pre, par) => {
    const p = par.toLowerCase();
    const esParaula = /[àèéíïòóúüç·'’]/i.test(p) || UNITATS.includes(p) || PARAULES_CURTES.includes(p)
      || (p.length >= 3 && /[aeiou]/.test(p) && !FUNCIONS.includes(p));
    if (!esParaula) return tot;
    // treu també un exponent d'unitat (m^2, cm^3)
    return pre + ' ';
  });
  return s.replace(/\s+/g, ' ').trim();
}

// Separa diverses solucions (;  o coma seguida d'espai) i tuples (coma dins de parèntesis)
export function separa(s) {
  if (SENSE_SOLUCIO.test(s)) return { sense: true, items: [] };
  let out = '';
  const pila = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
      if (m) {
        if (m[0] === '\\left' || m[0] === '\\mleft') pila.push('(');
        if (m[0] === '\\right' || m[0] === '\\mright') pila.pop();
        out += m[0]; i += m[0].length - 1; continue;
      }
      out += c + (s[i + 1] ?? ''); i++; continue;
    }
    if (c === '{') pila.push('{');
    else if (c === '}') pila.pop();
    else if ((c === '(' || c === '[') && !/\\(left|mleft)\s*$/.test(s.slice(0, i))) pila.push('(');
    else if ((c === ')' || c === ']') && !/\\(right|mright)\s*$/.test(s.slice(0, i))) pila.pop();
    if (c === ',' || c === ';') {
      const decimal = c === ',' && /\d/.test(s[i - 1] ?? '') && /\d/.test(s[i + 1] ?? '');
      const dinsClaus = pila.includes('{');
      const dinsPar = pila.includes('(');
      if (decimal && (!dinsPar || dinsClaus)) { out += '.'; continue; }
      if (dinsClaus) { out += c === ',' ? '.' : c; continue; }
      out += dinsPar ? '\u0002' : '\u0001';
      continue;
    }
    out += c;
  }
  const items = out.split('\u0001').map(x => x.trim()).filter(Boolean).flatMap(expandeesPM);
  return { sense: false, items: items.map(it => {
    // costat dret de la darrera igualtat (x=2 → 2)
    const parts = it.split('=');
    let dreta = parts[parts.length - 1].trim();
    if (!dreta) falla('Hi ha un "=" sense res al darrere');
    // tupla (2, 3) → components
    let t = dreta;
    t = t.replace(/^\\m?left\s*[\(\[]/, '(').replace(/\\m?right\s*[\)\]]$/, ')');
    if (t.includes('\u0002')) {
      if (!/^[\(\[].*[\)\]]$/.test(t)) falla('Coordenades mal escrites');
      return { tupla: true, comps: t.slice(1, -1).split('\u0002').map(x => x.trim()) };
    }
    return { tupla: false, comps: [dreta] };
  }) };
}

function expandeesPM(it) {
  const m = /\\pm|±|\\mp|∓/.exec(it);
  if (!m) return [it];
  const signe = m[0] === '\\mp' || m[0] === '∓' ? ['-', '+'] : ['+', '-'];
  const a = it.slice(0, m.index), b = it.slice(m.index + m[0].length);
  return [...expandeesPM(a + signe[0] + b), ...expandeesPM(a + signe[1] + b)];
}

// =====================================================================
//  2. LaTeX → expressió de text (p. ex. \dfrac{1}{64} → ((1)/(64)))
// =====================================================================
export function latexAExpr(s) {
  let i = 0;
  const n = s.length;
  const espais = () => { while (i < n && /\s/.test(s[i])) i++; };

  function comanda() {
    const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
    if (!m) falla('Comanda incompleta');
    i += m[0].length;
    return m[1];
  }

  // Argument d'una comanda: {grup} o un sol caràcter / comanda
  function argument() {
    espais();
    if (s[i] === '{') { const [c, fi] = llegeixGrup(s, i); i = fi; return latexAExpr(c); }
    if (i >= n) falla('Falta un argument');
    if (s[i] === '\\') return atomComanda();
    if (/\d/.test(s[i])) return s[i++];
    if (/[a-zA-Z]/.test(s[i])) return ' ' + s[i++] + ' ';
    falla('Argument no vàlid');
  }

  // Argument d'una funció (log, ln, sin…): (grup), {grup} o un àtom amb exponent
  function argumentFuncio() {
    espais();
    if (s.startsWith('\\left', i) || s.startsWith('\\mleft', i) || s[i] === '(' || s[i] === '[') {
      const ini = i;
      if (s[i] === '\\') i += s.startsWith('\\left', i) ? 5 : 6;
      espais();
      const obre = s[i];
      if (obre !== '(' && obre !== '[') { i = ini; return atom(); }
      // busca el tancament equilibrat
      let prof = 0, j = i;
      for (; j < n; j++) {
        if (s[j] === '\\' && /^\\(left|mleft)/.test(s.slice(j))) continue;
        if (s[j] === '(' || s[j] === '[') prof++;
        if (s[j] === ')' || s[j] === ']') { prof--; if (prof === 0) break; }
      }
      if (j >= n) falla('Falta tancar un parèntesi');
      let interior = s.slice(i + 1, j);
      interior = interior.replace(/\\(right|mright)\s*$/, '');
      i = j + 1;
      return '(' + latexAExpr(interior) + ')';
    }
    if (s[i] === '{') { const [c, fi] = llegeixGrup(s, i); i = fi; return '(' + latexAExpr(c) + ')'; }
    let a = atom();
    espais();
    if (s[i] === '^') { i++; a = '(' + a + ')^(' + argument() + ')'; }
    return '(' + a + ')';
  }

  function atom() {
    espais();
    if (i >= n) falla('Falta un valor');
    if (/[\d.]/.test(s[i])) { const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i)); i += m[0].length; return m[0]; }
    if (/[a-zA-Z]/.test(s[i])) return ' ' + s[i++] + ' ';
    if (s[i] === '\\') return atomComanda();
    if (s[i] === '{') { const [c, fi] = llegeixGrup(s, i); i = fi; return '(' + latexAExpr(c) + ')'; }
    falla('No s\'entén "' + s[i] + '"');
  }

  function atomComanda() {
    const cmd = comanda();
    switch (cmd) {
      case 'frac': case 'dfrac': case 'tfrac': case 'cfrac': {
        const a = argument(); const b = argument();
        return '((' + a + ')/(' + b + '))';
      }
      case 'sqrt': {
        espais();
        let index = null;
        if (s[i] === '[') { const [c, fi] = llegeixGrup(s, i, '[', ']'); i = fi; index = latexAExpr(c); }
        const a = argument();
        return index === null ? 'sqrt(' + a + ')' : 'nroot(' + a + ',' + index + ')';
      }
      case 'log': case 'lg': {
        espais();
        let base = '10';
        if (cmd === 'log' && s[i] === '_') { i++; base = argument(); }
        const a = argumentFuncio();
        return 'log(' + a + ',' + base + ')';
      }
      case 'ln': return 'ln' + argumentFuncio();
      case 'sin': case 'cos': case 'tan': return cmd + argumentFuncio();
      case 'tg': return 'tan' + argumentFuncio();
      case 'sen': return 'sin' + argumentFuncio();
      case 'pi': return ' pi ';
      case 'infty': return ' inf ';
      case 'cdot': case 'times': case 'ast': return '*';
      case 'div': return '/';
      case 'left': case 'right': case 'mleft': case 'mright':
      case 'bigl': case 'bigr': case 'Bigl': case 'Bigr': case 'big': case 'Big': {
        espais();
        if (s[i] === '.') { i++; return ''; }
        if (s[i] === '|') { i++; return '|'; }
        if (s[i] === '\\') {
          const d = comanda();
          if (d === '{' || d === 'lbrace' || d === 'langle') return '(';
          if (d === '}' || d === 'rbrace' || d === 'rangle') return ')';
          if (d === 'lvert' || d === 'rvert' || d === 'vert' || d === '|') return '|';
          if (d === 'lbrack') return '(';
          if (d === 'rbrack') return ')';
          falla('Delimitador desconegut');
        }
        const c = s[i++];
        return c === '[' ? '(' : c === ']' ? ')' : c;
      }
      case '{': case 'lbrace': case 'lbrack': return '(';
      case '}': case 'rbrace': case 'rbrack': return ')';
      case 'lvert': case 'rvert': case 'vert': case '|': return '|';
      case 'neg': return '-';
      default: falla('No s\'entén \\' + cmd);
    }
  }

  let out = '';
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { out += ' '; i++; continue; }
    if (c === '\\') { out += atomComanda(); continue; }
    if (c === '{') { const [g, fi] = llegeixGrup(s, i); i = fi; out += '(' + latexAExpr(g) + ')'; continue; }
    if (c === '}') falla('Sobra una clau }');
    if (c === '^') {
      i++; espais();
      const m = /^-?\s*\d+(\.\d+)?/.exec(s.slice(i));   // 2^10, 2^-3 (escrit sense claus)
      if (m) { i += m[0].length; out += '^(' + m[0].replace(/\s/g, '') + ')'; continue; }
      if (s[i] === '-') { i++; out += '^(-' + argument() + ')'; continue; }
      out += '^(' + argument() + ')'; continue;
    }
    if (c === '_') {
      i++; espais();
      let sub;
      if (s[i] === '{') { const [g, fi] = llegeixGrup(s, i); i = fi; sub = g.replace(/\s/g, ''); }
      else sub = s[i++];
      if (!/^[a-zA-Z0-9]+$/.test(sub)) falla('Subíndex no vàlid');
      out = out.replace(/\s*$/, '') + '_' + sub + ' ';
      continue;
    }
    if (c === '[') { out += '('; i++; continue; }
    if (c === ']') { out += ')'; i++; continue; }
    if (c === ':') { out += '/'; i++; continue; }
    if (c === '·' || c === '×' || c === '⋅') { out += '*'; i++; continue; }
    if (c === '÷') { out += '/'; i++; continue; }
    if (c === '−' || c === '–') { out += '-'; i++; continue; }
    if (c === 'π') { out += ' pi '; i++; continue; }
    if (c === '√') { i++; out += 'sqrt(' + argument() + ')'; continue; }
    if (c === '?') falla('Hi ha una casella buida');
    if (/[a-zA-Z]/.test(c)) {
      // en LaTeX, lletres seguides són variables multiplicades (ab = a·b),
      // excepte noms de funció escrits a mà (sqrt, log…)
      const m = /^[a-zA-Z]+/.exec(s.slice(i))[0];
      if (FUNCIONS.includes(m) && m.length > 1) { out += ' ' + m + ' '; i += m.length; continue; }
      out += ' ' + c + ' '; i++; continue;
    }
    if (/[\d.+\-*/()!|,]/.test(c)) { out += c; i++; continue; }
    falla('No s\'entén "' + c + '"');
  }
  return out;
}

// =====================================================================
//  3. ANALITZADOR D'EXPRESSIONS → arbre
// =====================================================================
function tokens(expr) {
  const t = [];
  const re = /\s*(\d*\.\d+|\d+\.?|[a-zA-Z]+(?:_[a-zA-Z0-9]+)?|\*\*|[+\-*/^()!|,])/y;
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < expr.length) {
    if (/^\s*$/.test(expr.slice(re.lastIndex))) break;
    m = re.exec(expr);
    if (!m) falla('No s\'entén l\'expressió');
    const v = m[1];
    if (/^[\d.]/.test(v)) t.push({ k: 'num', v: parseFloat(v), txt: v });
    else if (/^[a-zA-Z]/.test(v)) {
      const [nom, sub] = v.split('_');
      if (FUNCIONS.includes(nom) && !sub) t.push({ k: FUNCIONS.indexOf(nom) >= 8 || nom === 'pi' || nom === 'e' ? 'const' : 'fn', v: nom });
      else {
        // separa lletres: ab → a b
        const lletres = nom.split('');
        lletres.forEach((l, idx) => t.push({ k: 'var', v: idx === lletres.length - 1 && sub ? l + '_' + sub : l }));
      }
    } else t.push({ k: 'op', v: v === '**' ? '^' : v });
  }
  return t;
}

export function analitzaExpr(expr) {
  const t = tokens(expr);
  let p = 0;
  let dinsAbs = 0;
  const mira = () => t[p];
  const es = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
  const agafa = (v) => { if (!es(v)) falla(v === ')' ? 'Falta tancar un parèntesi' : 'Expressió incompleta'); p++; };

  function expressio() {
    let a = terme();
    while (es('+') || es('-')) { const o = t[p++].v; a = { t: 'op', o, a, b: terme() }; }
    return a;
  }
  function comencaFactor() {
    const k = mira();
    if (!k) return false;
    if (k.k === 'num' || k.k === 'var' || k.k === 'fn' || k.k === 'const') return true;
    if (k.k === 'op' && k.v === '(') return true;
    if (k.k === 'op' && k.v === '|' && dinsAbs === 0) return true;
    return false;
  }
  function terme() {
    let a = unari();
    for (;;) {
      if (es('*') || es('/')) { const o = t[p++].v; a = { t: 'op', o, a, b: unari() }; }
      else if (comencaFactor()) a = { t: 'op', o: '*', a, b: unari(), impl: true };
      else break;
    }
    return a;
  }
  function unari() {
    if (es('-')) { p++; return { t: 'neg', a: unari() }; }
    if (es('+')) { p++; return unari(); }
    return potencia();
  }
  function potencia() {
    let a = postfix();
    if (es('^')) { p++; a = { t: 'op', o: '^', a, b: unari() }; }
    return a;
  }
  function postfix() {
    let a = primari();
    while (es('!')) { p++; a = { t: 'fn', n: 'fact', args: [a] }; }
    return a;
  }
  function primari() {
    const k = mira();
    if (!k) falla('Expressió incompleta');
    if (k.k === 'num') { p++; return { t: 'num', v: k.v, txt: k.txt }; }
    if (k.k === 'const') { p++; return { t: 'const', n: k.v }; }
    if (k.k === 'var') { p++; return { t: 'var', n: k.v }; }
    if (k.k === 'fn') {
      p++;
      if (!es('(')) falla('Falta el parèntesi de ' + k.v);
      p++;
      const args = [expressio()];
      while (es(',')) { p++; args.push(expressio()); }
      agafa(')');
      return { t: 'fn', n: k.v, args };
    }
    if (es('(')) { p++; const e = expressio(); agafa(')'); return { t: 'par', a: e }; }
    if (es('|')) { p++; dinsAbs++; const e = expressio(); dinsAbs--; agafa('|'); return { t: 'fn', n: 'abs', args: [e] }; }
    falla('No s\'entén "' + k.v + '"');
  }
  const arbre = expressio();
  if (p < t.length) falla(es(')') ? 'Sobra un parèntesi' : 'No s\'entén l\'expressió');
  return arbre;
}

// ---------- Avaluació ----------
const GRAUS = Math.PI / 180;
function factorial(x) {
  if (x < 0 || !Number.isInteger(x) || x > 170) return NaN;
  let r = 1; for (let k = 2; k <= x; k++) r *= k; return r;
}
function arrel(x, k) {
  if (!Number.isInteger(k) || k === 0) return Math.pow(x, 1 / k);
  if (x < 0) return k % 2 === 1 ? -Math.pow(-x, 1 / k) : NaN;
  const r = Math.pow(x, 1 / k);
  const rr = Math.round(r);
  return Math.abs(Math.pow(rr, k) - x) < 1e-9 * Math.max(1, Math.abs(x)) ? rr : r;
}
function potenciaReal(a, b) {
  if (a < 0 && !Number.isInteger(b)) {
    // (-8)^(1/3) = -2 si l'exponent és una fracció d'índex senar
    for (let q = 2; q <= 12; q++) {
      const pnum = Math.round(b * q);
      if (Math.abs(pnum - b * q) < 1e-9 && q % 2 === 1) return Math.pow(arrel(a, q), pnum);
    }
    return NaN;
  }
  return Math.pow(a, b);
}

export function avalua(node, entorn) {
  switch (node.t) {
    case 'num': return node.v;
    case 'const': return node.n === 'pi' ? Math.PI : node.n === 'e' ? Math.E : Infinity;
    case 'var': return entorn(node.n);
    case 'par': return avalua(node.a, entorn);
    case 'neg': return -avalua(node.a, entorn);
    case 'op': {
      const a = avalua(node.a, entorn), b = avalua(node.b, entorn);
      switch (node.o) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return potenciaReal(a, b);
      }
      break;
    }
    case 'fn': {
      const v = node.args.map(x => avalua(x, entorn));
      const req = (k) => { if (v.length !== k) falla('Nombre d\'arguments incorrecte a ' + node.n); };
      switch (node.n) {
        case 'sqrt': req(1); return v[0] < 0 ? NaN : arrel(v[0], 2);
        case 'nroot': req(2); return arrel(v[0], v[1]);
        case 'log': {
          if (v.length === 1) return Math.log10(v[0]);
          req(2);
          if (v[0] <= 0 || v[1] <= 0 || v[1] === 1) return NaN;
          const r = Math.log(v[0]) / Math.log(v[1]);
          const rr = Math.round(r);
          return Math.abs(r - rr) < 1e-12 ? rr : r;
        }
        case 'ln': req(1); return v[0] <= 0 ? NaN : Math.log(v[0]);
        case 'abs': req(1); return Math.abs(v[0]);
        case 'sin': req(1); return Math.sin(v[0] * GRAUS);
        case 'cos': req(1); return Math.cos(v[0] * GRAUS);
        case 'tan': req(1); return Math.tan(v[0] * GRAUS);
        case 'fact': return factorial(v[0]);
      }
    }
  }
  falla('Expressió no vàlida');
}

// ---------- Complexitat (per al mode estricte) ----------
function esConstantNum(n) { return n.t === 'num' || (n.t === 'par' && esConstantNum(n.a)); }
export function complexitat(n) {
  switch (n.t) {
    case 'num': case 'var': case 'const': return 0;
    case 'par': return complexitat(n.a);
    case 'neg': return (esConstantNum(n.a) ? 0 : 1) + complexitat(n.a);
    case 'op': return 1 + complexitat(n.a) + complexitat(n.b);
    case 'fn': return 1 + n.args.reduce((s, x) => s + complexitat(x), 0);
  }
  return 0;
}
const desParen = n => (n.t === 'par' ? desParen(n.a) : n);
function enter(n) {
  n = desParen(n);
  if (n.t === 'num' && Number.isInteger(n.v)) return n.v;
  if (n.t === 'neg') { const v = enter(n.a); return v === null ? null : -v; }
  return null;
}
const mcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
function teArrel(n) {
  n = desParen(n);
  if (n.t === 'fn' && (n.n === 'sqrt' || n.n === 'nroot')) return true;
  if (n.t === 'op' && n.o === '^') {
    const e = desParen(n.b);
    if (e.t === 'op' && e.o === '/') return true;
    if (e.t === 'num' && !Number.isInteger(e.v)) return true;
  }
  return ['op', 'neg', 'fn'].includes(n.t) && [n.a, n.b, ...(n.args || [])].filter(Boolean).some(teArrel);
}
function arrelAlDenominador(n) {
  n = desParen(n);
  if (n.t === 'op' && n.o === '/' && teArrel(n.b)) return true;
  if (n.t === 'op' && n.o === '^' && enter(n.b) !== null && enter(n.b) < 0 && teArrel(n.a)) return true;
  return [n.a, n.b, ...(n.args || [])].filter(Boolean).some(arrelAlDenominador);
}
function problemaSimplificacio(n) {
  n = desParen(n);
  if (n.t === 'op' && n.o === '/') {
    const a = enter(n.a), b = enter(n.b);
    if (a !== null && b !== null && b !== 0 && (mcd(a, b) > 1 || Math.abs(b) === 1)) return 'Simplifica la fracció';
  }
  if (n.t === 'fn' && (n.n === 'sqrt' || n.n === 'nroot')) {
    const x = enter(n.args[0]);
    const k = n.n === 'sqrt' ? 2 : enter(n.args[1]);
    if (x !== null && k !== null && k >= 2 && x > 1) {
      for (let f = 2; Math.pow(f, k) <= x; f++) if (x % Math.pow(f, k) === 0) return 'Simplifica l\'arrel (extreu factors)';
    }
  }
  for (const fill of [n.a, n.b, ...(n.args || [])].filter(Boolean)) {
    const r = problemaSimplificacio(fill);
    if (r) return r;
  }
  return null;
}

// ---------- Empremtes numèriques ----------
const ENTORNS = [0, 1, 2];
function valorVariable(nom, k) {
  let h = 0;
  for (const ch of nom) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const x = ((h * 0.7548776662 + k * 0.5698402910 + 0.1234) % 1);
  return Math.round((1.15 + x * 1.7) * 1e6) / 1e6;
}
function format(v, dec) {
  if (Number.isNaN(v)) return 'NaN';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  if (dec != null) {
    const f = Math.pow(10, dec);
    const r = Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f;
    return (Object.is(r, -0) ? 0 : r).toFixed(dec);
  }
  if (Math.abs(v) < 1e-10) return '0';
  return String(Number(v.toPrecision(10)));
}
function empremta(arbre, dec, sal) {
  const vals = ENTORNS.map(k => format(avalua(arbre, nom => valorVariable(nom, k)), dec));
  if (vals.some(v => v === 'NaN')) falla('El resultat no és un nombre real');
  return { h: sha256(sal + '|' + vals.join(';')).slice(0, 20), vals };
}

// =====================================================================
//  4. API PÚBLICA
// =====================================================================

// Interpreta un component (una sola expressió en LaTeX ja separada)
function interpretaComponent(latexComp) {
  const expr = latexAExpr(latexComp);
  if (!expr.trim()) falla('Resposta buida');
  const arbre = analitzaExpr(expr);
  return { expr: expr.replace(/\s+/g, ' ').trim(), arbre };
}

function bonic(expr) {
  let t = expr.replace(/\s+/g, '');
  for (let k = 0; k < 10; k++) t = t.replace(/\((-?[a-zA-Z0-9.^_]+)\)/g, '$1');
  return t.replace(/\./g, ',');
}

function decimalsLiterals(expr) {
  const m = /^\s*-?\s*\d+\.(\d+)\s*$/.exec(expr);
  return m ? m[1].length : null;
}

export function llegeixResposta(latex) {
  if (SENSE_SOLUCIO.test(String(latex))) return { sense: true, items: [] };
  const net = netejaLatex(latex);
  const sep = separa(net);
  if (sep.sense) return { sense: true, items: [] };
  if (!sep.items.length) falla('Resposta buida');
  return { sense: false, items: sep.items.map(it => ({ tupla: it.tupla, comps: it.comps.map(interpretaComponent) })) };
}

/**
 * Analitza la solució del professor.
 * Retorna { pub, info }:
 *  - pub: dades que es poden guardar a la vista de l'alumne (no revelen la solució)
 *  - info: explicació per al professor (com s'ha entès)
 */
export function analitzaSolucio(latex, sal = '') {
  const r = llegeixResposta(latex);
  if (r.sense) return { pub: { sense: true, items: [] }, info: { text: 'Sense solució', valors: [] } };
  const textos = [];
  const items = r.items.map(it => {
    const comps = it.comps.map(c => {
      const dec = decimalsLiterals(c.expr);
      const e = empremta(c.arbre, dec, sal);
      textos.push(bonic(c.expr) + (e.vals[0] !== e.vals[1] || !/[^\d.\-]/.test(bonic(c.expr)) ? '' : ' = ' + e.vals[0].replace('.', ',')));
      return { h: e.h, d: dec, c: complexitat(c.arbre), rd: arrelAlDenominador(c.arbre) };
    });
    return { t: it.tupla ? 1 : 0, c: comps };
  });
  return { pub: { sense: false, items }, info: { text: textos.join(' ; ') } };
}

function comparaComponent(compAl, compSol, sal, estricte) {
  let e;
  try { e = empremta(compAl.arbre, compSol.d, sal); }
  catch { return { ok: false }; }
  if (e.h !== compSol.h) return { ok: false };
  if (estricte) {
    const p = problemaSimplificacio(compAl.arbre);
    if (p) return { ok: false, equivalent: true, missatge: p };
    if (!compSol.rd && arrelAlDenominador(compAl.arbre)) return { ok: false, equivalent: true, missatge: 'Racionalitza (no hi pot haver arrels al denominador)' };
    if (complexitat(compAl.arbre) > compSol.c) return { ok: false, equivalent: true, missatge: 'El valor és correcte, però l\'has de simplificar més' };
  }
  return { ok: true };
}

/**
 * Corregeix una resposta de l'alumne.
 * @param {string} latexAlumne  el que ha escrit (LaTeX de l'editor o text)
 * @param {object} pub          l'anàlisi pública de la solució
 * @param {string} sal
 * @param {boolean} estricte    exigir forma simplificada
 * @returns {{correcte:boolean, valida:boolean, missatge?:string}}
 */
export function corregeix(latexAlumne, pub, sal = '', estricte = false) {
  if (!latexAlumne || !String(latexAlumne).trim()) return { correcte: false, valida: false, buida: true, missatge: 'Sense resposta' };
  let r;
  try { r = llegeixResposta(latexAlumne); }
  catch (err) { return { correcte: false, valida: false, missatge: err instanceof ErrorResposta ? err.message : 'No s\'entén la resposta' }; }
  if (pub.sense || r.sense) return { correcte: !!(pub.sense && r.sense), valida: true };
  const sol = pub.items;
  if (r.items.length !== sol.length) {
    return { correcte: false, valida: true, missatge: sol.length > 1 && r.items.length < sol.length ? 'Hi falten solucions' : (r.items.length > sol.length ? 'Hi sobren solucions' : undefined) };
  }
  // aparella cada resposta amb una solució (l'ordre no importa)
  const usades = new Set();
  let missatge;
  for (const it of r.items) {
    let trobada = false;
    for (let k = 0; k < sol.length; k++) {
      if (usades.has(k)) continue;
      const s = sol[k];
      if (!!s.t !== it.tupla || s.c.length !== it.comps.length) continue;
      const res = it.comps.map((c, idx) => comparaComponent(c, s.c[idx], sal, estricte));
      if (res.every(x => x.ok)) { usades.add(k); trobada = true; break; }
      const eq = res.find(x => x.equivalent);
      if (eq && res.every(x => x.ok || x.equivalent)) missatge = eq.missatge;
    }
    if (!trobada) return { correcte: false, valida: true, missatge };
  }
  return { correcte: true, valida: true };
}

/** Converteix una solució LaTeX en text per mostrar dins de KaTeX (treu $). */
export function solucioPerMostrar(latex) {
  return String(latex).replace(/\$/g, '').trim();
}
