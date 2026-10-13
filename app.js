// =====================================================================
//  Quadern de Martimàtiques — aplicació (professor i alumnes)
// =====================================================================
import * as C from './config.js';
import { llegeixFitxa, MACROS_BASE } from './fitxa.js';
import { analitzaSolucio, corregeix } from './correccio.js';
import { FITXA_EXEMPLE } from './exemple.js';

let B;                 // backend (Firebase o mode de prova)
let usuari = null;
let estat = { pestanya: null };
const arrel = document.getElementById('app');

// ---------------------------------------------------------------------
//  Utilitats
// ---------------------------------------------------------------------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const ara = () => new Date();
const fmtData = d => d ? new Date(d).toLocaleString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const aInput = d => { const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fmtNota = n => (n == null ? '—' : (Math.round(n * 100) / 100).toLocaleString('ca-ES', { maximumFractionDigits: 2 }));
const classeNota = n => (n == null ? '' : n >= 5 ? 'aprovat' : 'suspes');
const aleatori = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };

function avis(msg, tipus = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipus;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('fora'), 3200);
  setTimeout(() => t.remove(), 3800);
}
async function accio(boto, fn) {
  const txt = boto?.textContent;
  if (boto) { boto.disabled = true; boto.textContent = 'Un moment…'; }
  try { return await fn(); }
  catch (e) { console.error(e); avis(e.message || 'Hi ha hagut un error', 'error'); }
  finally { if (boto) { boto.disabled = false; boto.textContent = txt; } }
}

function descarregaCSV(nom, files) {
  const csv = '\ufeff' + files.map(f => f.map(c => {
    const v = typeof c === 'number' ? String(c).replace('.', ',') : String(c ?? '');
    return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const PARAULES = ['lluna', 'sol', 'mar', 'riu', 'bosc', 'pedra', 'vent', 'foc', 'neu', 'gat', 'drac', 'tigre', 'ona', 'estel', 'roure', 'cim', 'vall', 'poma', 'pera', 'llop', 'oca', 'teula', 'nuvol', 'cargol', 'mussol', 'gira', 'pinya', 'llum', 'cel', 'illa'];
const novaContrasenya = () => PARAULES[aleatori(PARAULES.length)] + '-' + String(10 + aleatori(90));
function nomUsuari(pseudonim, existents) {
  let base = pseudonim.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'alumne';
  let u = base, k = 2;
  while (existents.has(u) || u === C.USUARI_PROFESSOR) u = base + k++;
  existents.add(u);
  return u;
}

// ---------------------------------------------------------------------
//  Fórmules (KaTeX), figures (TikZ) i editor de fórmules (MathLive)
// ---------------------------------------------------------------------
function pintaMates(el, macros = {}) {
  if (!window.katex) return;
  const m = { ...MACROS_BASE, ...macros };
  $$('.m, .md', el).forEach(x => {
    if (x.dataset.r) return;
    x.dataset.r = 1;
    try { katex.render(x.textContent, x, { displayMode: x.classList.contains('md'), throwOnError: false, macros: m }); }
    catch { /* deixa el text */ }
  });
  $$('.tikz', el).forEach(div => {
    if (div.dataset.r) return;
    div.dataset.r = 1;
    const ifr = document.createElement('iframe');
    ifr.className = 'tikz-marc';
    ifr.title = 'Figura';
    ifr.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\/script><style>body{margin:0;display:flex;justify-content:center}</style></head><body><script type="text/tikz">${div.dataset.tikz.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`;
    div.appendChild(ifr);
    let intents = 0;
    const t = setInterval(() => {
      try {
        const svg = ifr.contentDocument?.querySelector('svg');
        if (svg) { ifr.style.height = (svg.getBoundingClientRect().height + 16) + 'px'; clearInterval(t); }
      } catch { clearInterval(t); }
      if (++intents > 60) clearInterval(t);
    }, 500);
  });
}

// Mostra una solució (pot tenir text i $...$) amb KaTeX
function htmlSolucio(latex) {
  const s = String(latex);
  if (!s.includes('$')) {
    if (!s.includes('\\') && /[a-zàèéíòóúç]{3,}/i.test(s)) return esc(s);   // només text (p. ex. «6 hores»)
    return `<span class="m">${esc(s)}</span>`;
  }
  return s.split(/(?<!\\)\$/).map((t, k) => (k % 2 ? `<span class="m">${esc(t)}</span>` : esc(t))).join('');
}

let mathLiveOk = null;
function esperaMathLive() {
  if (mathLiveOk !== null) return Promise.resolve(mathLiveOk);
  return Promise.race([
    customElements.whenDefined('math-field').then(() => true),
    new Promise(r => setTimeout(() => r(false), 8000)),
  ]).then(ok => {
    mathLiveOk = ok;
    if (ok) configuraMathLive();
    return ok;
  });
}
function configuraMathLive() {
  try {
    const MF = window.MathfieldElement;
    if (MF) { MF.decimalSeparator = ','; MF.keypressSound = null; MF.plonkSound = null; }
    window.mathVirtualKeyboard.layouts = [{
      label: 'Mates', tooltip: 'Teclat de matemàtiques',
      rows: [
        ['7', '8', '9', '\\div', { latex: '\\frac{#@}{#?}' }, { latex: '#@^{#?}' }, { latex: '\\sqrt{#0}' }, { latex: '\\sqrt[#?]{#0}' }],
        ['4', '5', '6', '\\times', { latex: '\\log_{#?}\\left(#?\\right)', label: 'log<sub>b</sub>' }, { latex: '\\log\\left(#?\\right)', label: 'log' }, { latex: '\\ln\\left(#?\\right)', label: 'ln' }, '\\pi'],
        ['1', '2', '3', '-', '(', ')', '\\pm', 'x'],
        ['0', { latex: '{,}', label: ',' }, '=', '+', { latex: ';', label: ';' }, '[left]', '[right]', '[backspace]'],
      ],
    }, 'alphabetic'];
  } catch (e) { console.warn('Teclat MathLive:', e); }
}

/**
 * Munta una fitxa interactiva dins de `cont`.
 * fitxa: {html, preguntes:[{id,etiqueta,an}], macros, salt, estricte}
 * op: { respostes, comptes, maxComprovacions (-1 il·limitat, 0 cap), nomesLectura,
 *       correccio, solucions, onCanvi(respostes), onComprova(qid, res), veureSolucio(qid) → Promise<latex> }
 */
async function muntaFitxa(cont, fitxa, op = {}) {
  cont.innerHTML = `<article class="full fitxa">${fitxa.html}</article>`;
  pintaMates(cont, fitxa.macros);
  const ml = await esperaMathLive();
  const respostes = { ...(op.respostes || {}) };
  const comptes = { ...(op.comptes || {}) };
  const perId = Object.fromEntries(fitxa.preguntes.map(p => [p.id, p]));

  for (const lloc of $$('.resposta', cont)) {
    const p = perId[lloc.dataset.q];
    if (!p) continue;
    lloc.innerHTML = `<span class="casella">
        <span class="camp"></span>
        <span class="estat" aria-live="polite"></span>
      </span>
      ${p.an && p.an.items && p.an.items.length > 1 ? `<span class="pista">Hi ha ${p.an.items.length} solucions: separa-les amb ;</span>` : ''}
      <span class="sol-mostrada"></span>`;
    const campEl = $('.camp', lloc);
    let camp;
    if (ml) {
      camp = document.createElement('math-field');
      camp.setAttribute('math-virtual-keyboard-policy', 'auto');
      camp.setAttribute('aria-label', 'Resposta ' + p.etiqueta);
      campEl.appendChild(camp);
      if (respostes[p.id]) camp.value = respostes[p.id];
      if (op.nomesLectura) camp.readOnly = true;
    } else {
      camp = document.createElement('input');
      camp.className = 'camp-text';
      camp.placeholder = 'p. ex. 1/64, sqrt(2), log(8)';
      camp.value = respostes[p.id] || '';
      camp.readOnly = !!op.nomesLectura;
      campEl.appendChild(camp);
    }
    const estatEl = $('.estat', lloc);
    const mostraEstat = (res) => {
      if (!res) { estatEl.innerHTML = ''; return; }
      estatEl.className = 'estat ' + (res.correcte ? 'bé' : 'malament');
      estatEl.innerHTML = res.correcte ? '✓ Correcte' : '✗ ' + esc(res.missatge || 'Incorrecte');
    };
    if (op.correccio && p.id in op.correccio) mostraEstat({ correcte: op.correccio[p.id] });

    camp.addEventListener('input', () => {
      respostes[p.id] = camp.value;
      if (!op.nomesLectura) mostraEstat(null);
      op.onCanvi?.(respostes, comptes);
    });

    const max = op.maxComprovacions ?? 0;
    if (!op.nomesLectura && max !== 0) {
      const b = document.createElement('button');
      b.className = 'boto petit comprova';
      const etiqueta = () => {
        const queden = max < 0 ? null : max - (comptes[p.id] || 0);
        b.textContent = queden === null ? 'Comprova' : queden > 0 ? `Comprova (${queden})` : 'Sense intents';
        b.disabled = queden !== null && queden <= 0;
      };
      etiqueta();
      b.addEventListener('click', () => {
        const res = corregeix(camp.value, p.an, fitxa.salt, fitxa.estricte);
        if (res.buida || res.valida === false) { mostraEstat(res); return; }  // no gasta intent
        comptes[p.id] = (comptes[p.id] || 0) + 1;
        etiqueta();
        mostraEstat(res);
        op.onComprova?.(p.id, res, respostes, comptes);
        if (op.veureSolucio && !res.correcte && !$('.veure-sol', lloc)) {
          const vs = document.createElement('button');
          vs.className = 'boto petit fantasma veure-sol';
          vs.textContent = 'Veure la solució';
          vs.onclick = async () => {
            const sol = await op.veureSolucio(p.id);
            if (sol != null) { $('.sol-mostrada', lloc).innerHTML = 'Solució: ' + htmlSolucio(sol); pintaMates(lloc, fitxa.macros); vs.remove(); }
          };
          $('.casella', lloc).appendChild(vs);
        }
      });
      $('.casella', lloc).insertBefore(b, estatEl);
    }
    if (op.solucions && op.solucions[p.id] != null) {
      $('.sol-mostrada', lloc).innerHTML = (op.etiquetaSolucio ?? 'Solució: ') + htmlSolucio(op.solucions[p.id]);
    }
  }
  pintaMates(cont, fitxa.macros);
  return { respostes, comptes };
}

function calculaNota(fitxa, respostes, analisis = null) {
  const correccio = {};
  let bones = 0;
  for (const p of fitxa.preguntes) {
    const an = analisis ? analisis[p.id] : p.an;
    const r = an ? corregeix(respostes?.[p.id], an, fitxa.salt, fitxa.estricte) : { correcte: false };
    correccio[p.id] = !!r.correcte;
    if (r.correcte) bones++;
  }
  const total = fitxa.preguntes.length;
  return { correccio, bones, total, nota: total ? Math.round(1000 * bones / total) / 100 : 0 };
}

// ---------------------------------------------------------------------
//  Inici i estructura
// ---------------------------------------------------------------------
async function inicia() {
  document.title = C.NOM_WEB;
  try {
    B = C.firebaseConfig ? await import('./backend-firebase.js') : await import('./backend-local.js');
    B.init();
  } catch (e) {
    arrel.innerHTML = `<div class="caixa-login"><h1>${esc(C.NOM_WEB)}</h1><p class="error">No s'ha pogut connectar amb el servidor. Revisa la configuració de Firebase a js/config.js.</p><pre>${esc(e.message)}</pre></div>`;
    return;
  }
  if (B.modeProva && B.esBuit()) await sembra();
  B.onUsuari(u => {
    usuari = u;
    estat = { pestanya: u ? 'entregues' : null };
    pinta();
  });
}

async function sembra() {
  const f = preparaFitxa(FITXA_EXEMPLE, '', true, true);
  const fid = await B.desaFitxa(f.pub, f.priv);
  await B.crearAlumne({ usuari: 'alumne1', nom: 'Drac Blau', grup: '4t F', contrasenya: 'alumne1' });
  await B.crearAlumne({ usuari: 'alumne2', nom: 'Gat Groc', grup: '4t F', contrasenya: 'alumne2' });
  const limit = new Date(); limit.setDate(limit.getDate() + 7); limit.setHours(23, 59, 0, 0);
  await B.desaEntrega({ titol: 'Potències, radicals i logaritmes', fitxaId: fid, grups: [], obertura: new Date(Date.now() - 60000), limit,
    comprovacions: 2, mostrarNota: true, mostrarSolucions: true }, null, f.priv.sols);
}

function pinta() {
  if (!usuari) return pintaLogin();
  const pestanyes = usuari.rol === 'professor'
    ? [['entregues', 'Entregues'], ['fitxes', 'Fitxes'], ['alumnes', 'Alumnes'], ['notes', 'Notes']]
    : [['entregues', 'Les meves entregues'], ['practicar', 'Practicar']];
  arrel.innerHTML = `
    ${B.modeProva ? `<div class="banda-prova">Mode de prova: les dades només es guarden en aquest navegador. <button class="enllac" id="reinicia">Reinicia les dades</button></div>` : ''}
    <header class="barra">
      <div class="marca"><span class="logo">∑</span> ${esc(C.NOM_WEB)}</div>
      <nav class="pestanyes">${pestanyes.map(([k, t]) => `<button data-p="${k}" class="${estat.pestanya === k ? 'actiu' : ''}">${t}</button>`).join('')}</nav>
      <div class="qui">${esc(usuari.nom || usuari.usuari)}${usuari.grup ? ` · ${esc(usuari.grup)}` : ''} <button class="boto petit fantasma" id="surt">Surt</button></div>
    </header>
    <main id="vista" class="vista"></main>`;
  $$('.pestanyes button').forEach(b => b.onclick = () => { estat = { pestanya: b.dataset.p }; pinta(); });
  $('#surt').onclick = () => B.surt();
  $('#reinicia')?.addEventListener('click', () => { if (confirm('S\'esborraran totes les dades de prova. Continuar?')) B.esborraTot(); });
  const v = $('#vista');
  const vistes = usuari.rol === 'professor'
    ? { entregues: vistaEntreguesProf, fitxes: vistaFitxes, alumnes: vistaAlumnes, notes: vistaNotes }
    : { entregues: vistaEntreguesAlumne, practicar: vistaPracticar };
  (vistes[estat.pestanya] || Object.values(vistes)[0])(v).catch(e => { console.error(e); v.innerHTML = `<p class="error">${esc(e.message)}</p>`; });
}

function pintaLogin() {
  arrel.innerHTML = `
    <div class="pantalla-login">
      <form class="caixa-login" autocomplete="on">
        <div class="logo gran">∑</div>
        <h1>${esc(C.NOM_WEB)}</h1>
        <label>Usuari <input name="usuari" autocomplete="username" autocapitalize="none" required></label>
        <label>Contrasenya <input name="pass" type="password" autocomplete="current-password" required></label>
        <button class="boto" type="submit">Entra</button>
        <p class="error" id="err" role="alert"></p>
        ${B.modeProva ? `<p class="nota-prova">Mode de prova<br>Professor: <b>${esc(C.USUARI_PROFESSOR)}</b> / <b>professor</b><br>Alumne: <b>alumne1</b> / <b>alumne1</b></p>` : ''}
      </form>
    </div>`;
  const f = $('form', arrel);
  f.onsubmit = async ev => {
    ev.preventDefault();
    $('#err').textContent = '';
    const b = $('button', f);
    b.disabled = true;
    try { await B.entra(f.usuari.value, f.pass.value); }
    catch (e) { $('#err').textContent = e.message; }
    finally { b.disabled = false; }
  };
}

// ---------------------------------------------------------------------
//  Preparar una fitxa (LaTeX → dades públiques + solucions privades)
// ---------------------------------------------------------------------
function preparaFitxa(latex, titol, estricte, practica, salt) {
  const f = llegeixFitxa(latex);
  salt = salt || Math.random().toString(36).slice(2, 12);
  const errors = [];
  const preguntes = f.preguntes.map(p => {
    try {
      const a = analitzaSolucio(p.sol, salt);
      return { ...p, an: a.pub, info: a.info.text };
    } catch (e) {
      errors.push(`Exercici ${p.etiqueta}: la solució «${p.sol}» no s'entén (${e.message})`);
      return { ...p, an: null, info: null, error: e.message };
    }
  });
  const pub = {
    titol: (titol || f.titol || 'Fitxa sense títol').trim(),
    html: f.html, macros: f.macros, salt, estricte: !!estricte, practica: !!practica,
    preguntes: preguntes.map(p => ({ id: p.id, etiqueta: p.etiqueta, an: p.an })),
  };
  const priv = { latex, sols: Object.fromEntries(preguntes.map(p => [p.id, p.sol])), publica: !!practica };
  return { pub, priv, preguntes, avisos: f.avisos, errors };
}

// =====================================================================
//  PROFESSOR — Fitxes
// =====================================================================
async function vistaFitxes(v) {
  v.innerHTML = '<p class="carregant">Carregant…</p>';
  const fitxes = (await B.llistaFitxes()).sort((a, b) => a.titol.localeCompare(b.titol, 'ca'));
  v.innerHTML = `
    <div class="cap-vista"><h1>Fitxes</h1><button class="boto" id="nova">+ Nova fitxa</button></div>
    ${fitxes.length ? '' : '<p class="buit">Encara no hi ha cap fitxa. Crea\'n una enganxant el codi LaTeX.</p>'}
    <div class="graella">
      ${fitxes.map(f => `
        <div class="targeta">
          <h3>${esc(f.titol)}</h3>
          <p class="meta">${f.preguntes.length} preguntes
            ${f.practica ? '<span class="xip">Pràctica</span>' : ''}
            ${f.estricte ? '<span class="xip">Cal simplificar</span>' : ''}</p>
          <div class="accions">
            <button class="boto petit" data-edita="${f.id}">Edita</button>
            <button class="boto petit fantasma" data-entrega="${f.id}">Nova entrega</button>
            <button class="boto petit perill" data-esborra="${f.id}">Esborra</button>
          </div>
        </div>`).join('')}
    </div>`;
  $('#nova').onclick = () => editorFitxa(v, null);
  $$('[data-edita]', v).forEach(b => b.onclick = () => editorFitxa(v, b.dataset.edita));
  $$('[data-entrega]', v).forEach(b => b.onclick = () => { estat = { pestanya: 'entregues' }; pinta(); setTimeout(() => formulariEntrega($('#vista'), null, b.dataset.entrega), 0); });
  $$('[data-esborra]', v).forEach(b => b.onclick = async () => {
    const usada = (await B.llistaEntregues()).filter(e => e.fitxaId === b.dataset.esborra);
    if (usada.length && !confirm(`Aquesta fitxa s'usa a ${usada.length} entrega(es). Si l'esborres, aquestes entregues deixaran de funcionar. Continuar?`)) return;
    if (!usada.length && !confirm('Esborrar la fitxa?')) return;
    await accio(b, () => B.esborraFitxa(b.dataset.esborra));
    vistaFitxes(v);
  });
}

async function editorFitxa(v, fitxaId) {
  let fitxa = null, priv = null;
  if (fitxaId) { fitxa = await B.getFitxa(fitxaId); priv = await B.getSolucions(fitxaId); }
  v.innerHTML = `
    <div class="cap-vista"><h1>${fitxaId ? 'Edita la fitxa' : 'Nova fitxa'}</h1><button class="boto fantasma" id="torna">← Torna</button></div>
    <div class="editor">
      <div class="col-codi">
        <label>Títol <input id="titol" value="${esc(fitxa?.titol || '')}" placeholder="Si el deixes buit, s'agafa el de \\section{…}"></label>
        <div class="fila-opcions">
          <label class="check"><input type="checkbox" id="estricte" ${fitxa ? (fitxa.estricte ? 'checked' : '') : 'checked'}> Cal simplificar (no s'accepta copiar l'enunciat ni fraccions o arrels sense simplificar)</label>
          <label class="check"><input type="checkbox" id="practica" ${fitxa?.practica ? 'checked' : ''}> Disponible a «Practicar» (els alumnes la poden fer i veure'n les solucions)</label>
        </div>
        <div class="fila-codi">
          <span>Codi LaTeX (format main.tex)</span>
          <label class="boto petit fantasma fitxer">Carrega .tex<input type="file" id="fitxer" accept=".tex,.txt" hidden></label>
        </div>
        <textarea id="codi" spellcheck="false" placeholder="Enganxa aquí el document .tex. Cada exercici ha d'acabar amb \\hfill \\sol{…}">${esc(priv?.latex || '')}</textarea>
        <div class="accions">
          <button class="boto fantasma" id="analitza">Previsualitza</button>
          <button class="boto" id="desa">Desa la fitxa</button>
        </div>
        <details class="ajuda"><summary>Com s'escriuen les solucions?</summary>${AJUDA_SOLUCIONS}</details>
      </div>
      <div class="col-vista" id="previ"><p class="buit">Prem «Previsualitza» per veure com quedarà i comprovar que s'entenen totes les solucions.</p></div>
    </div>`;
  pintaMates($('.ajuda', v));
  $('#torna').onclick = () => vistaFitxes(v);
  $('#fitxer').onchange = async ev => {
    const file = ev.target.files[0];
    if (file) { $('#codi').value = await file.text(); previsualitza(); }
  };
  const llegeix = () => preparaFitxa($('#codi').value, $('#titol').value, $('#estricte').checked, $('#practica').checked, fitxa?.salt);
  async function previsualitza() {
    const r = llegeix();
    const previ = $('#previ');
    const avisos = [...r.errors.map(e => ['error', e]), ...r.avisos.map(a => ['avis', a])];
    previ.innerHTML = `
      ${avisos.length ? `<ul class="avisos">${avisos.map(([t, a]) => `<li class="${t}">${esc(a)}</li>`).join('')}</ul>` : `<p class="tot-be">✓ S'entenen totes les solucions (${r.preguntes.length})</p>`}
      <details class="taula-sol" ${r.errors.length ? 'open' : ''}><summary>Solucions detectades</summary>
        <table class="taula"><thead><tr><th>Ex.</th><th>Solució</th><th>S'entén com</th></tr></thead><tbody>
        ${r.preguntes.map(p => `<tr class="${p.error ? 'fila-error' : ''}"><td>${esc(p.etiqueta)}</td><td>${htmlSolucio(p.sol)}</td><td>${p.error ? '⚠ ' + esc(p.error) : esc(p.info)}</td></tr>`).join('')}
        </tbody></table></details>
      <h2 class="titol-previ">${esc(r.pub.titol)}</h2>
      <p class="meta">Prova-la com si fossis un alumne:</p>
      <div id="previ-fitxa"></div>`;
    pintaMates(previ, r.pub.macros);
    await muntaFitxa($('#previ-fitxa'), { ...r.pub, preguntes: r.pub.preguntes.filter(p => p.an) }, {
      maxComprovacions: -1, solucions: r.priv.sols, etiquetaSolucio: 'Solució (només la veus tu): ',
    });
    return r;
  }
  $('#analitza').onclick = () => previsualitza();
  $('#desa').onclick = ev => accio(ev.target, async () => {
    const r = await previsualitza();
    if (!r.preguntes.length) throw new Error('La fitxa no té cap \\sol{…}');
    if (r.errors.length) throw new Error('Corregeix primer les solucions marcades en vermell');
    if (fitxaId) {
      const entregues = (await B.llistaEntregues()).filter(e => e.fitxaId === fitxaId);
      if (entregues.length && fitxa.preguntes.length !== r.pub.preguntes.length &&
        !confirm(`Aquesta fitxa ja s'usa a ${entregues.length} entrega(es) i ara té un nombre diferent d'exercicis. Les respostes ja fetes podrien quedar desquadrades. Desar igualment?`)) return;
      const ids = entregues.filter(e => e.mostrarSolucions);
      await B.desaFitxa(r.pub, r.priv, fitxaId);
      for (const e of ids) { const { id, ...dades } = e; await B.desaEntrega(dades, id, r.priv.sols); }
    } else fitxaId = await B.desaFitxa(r.pub, r.priv);
    delete cacheAnalisi[fitxaId];
    fitxa = { ...r.pub, id: fitxaId };
    avis('Fitxa desada');
  });
}

const AJUDA_SOLUCIONS = `
<ul>
  <li>Fraccions: <code>\\dfrac{1}{64}</code> o <code>\\frac{1}{64}</code> (són iguals). L'alumne pot respondre 1/64, 2<sup>-6</sup> o 0,015625.</li>
  <li>Arrels: <code>\\sqrt{2}</code> (quadrada) i <code>\\sqrt[3]{8}</code> (n-èssima).</li>
  <li>Logaritmes: <code>\\log_2 8</code>, <code>\\log_{3}\\dfrac{1}{9}</code>, <code>\\log 100</code> (base 10), <code>\\ln e</code>.</li>
  <li>Text: només compta el número. <code>\\sol{6 hores}</code>, <code>\\sol{$12$ cm$^2$}</code> o <code>\\sol{$15$ €}</code> → l'alumne escriu 6, 12 o 15.</li>
  <li>Decimals amb coma: <code>2,5</code> o <code>2{,}5</code>. Si la solució és un decimal arrodonit (p. ex. <code>12{,}57</code>), s'accepta qualsevol resposta que arrodoneixi igual.</li>
  <li>Diverses solucions: <code>\\sol{$x_1=2,\\ x_2=-3$}</code>, <code>\\sol{$x=\\pm 7$}</code> o separades amb <code>;</code>. L'ordre no importa.</li>
  <li>Punts: <code>\\sol{$(2,3)$}</code> (coma dins de parèntesis = coordenades). Decimals dins d'un punt: <code>(2{,}5, 3)</code>.</li>
  <li>Sense solució: <code>\\sol{No té solució}</code> o <code>\\sol{$\\emptyset$}</code>.</li>
  <li>Graus: <code>\\sol{$60^\\circ$}</code>. Les funcions <code>\\sin</code>, <code>\\cos</code>, <code>\\tan</code> treballen en graus.</li>
</ul>`;

// =====================================================================
//  PROFESSOR — Entregues
// =====================================================================
function estatEntrega(e) {
  const t = ara();
  if (t < e.obertura) return ['programada', 'Programada'];
  if (t > e.limit) return ['tancada', 'Tancada'];
  return ['oberta', 'Oberta'];
}

async function vistaEntreguesProf(v) {
  v.innerHTML = '<p class="carregant">Carregant…</p>';
  const [entregues, fitxes] = await Promise.all([B.llistaEntregues(), B.llistaFitxes()]);
  const nomFitxa = Object.fromEntries(fitxes.map(f => [f.id, f.titol]));
  entregues.sort((a, b) => b.limit - a.limit);
  v.innerHTML = `
    <div class="cap-vista"><h1>Entregues</h1><button class="boto" id="nova" ${fitxes.length ? '' : 'disabled title="Primer crea una fitxa"'}>+ Programa una entrega</button></div>
    ${entregues.length ? `
    <table class="taula ampla"><thead><tr><th>Entrega</th><th>Grups</th><th>S'obre</th><th>Termini</th><th>Estat</th><th></th></tr></thead><tbody>
      ${entregues.map(e => { const [c, t] = estatEntrega(e); return `<tr>
        <td><b>${esc(e.titol)}</b><div class="meta">${esc(nomFitxa[e.fitxaId] || '⚠ fitxa esborrada')}</div></td>
        <td>${e.grups?.length ? e.grups.map(esc).join(', ') : 'Tots'}</td>
        <td>${fmtData(e.obertura)}</td><td>${fmtData(e.limit)}</td>
        <td><span class="xip ${c}">${t}</span></td>
        <td class="accions"><button class="boto petit" data-notes="${e.id}">Notes</button><button class="boto petit fantasma" data-edita="${e.id}">Edita</button><button class="boto petit perill" data-esborra="${e.id}">Esborra</button></td>
      </tr>`; }).join('')}
    </tbody></table>` : `<p class="buit">${fitxes.length ? 'Encara no has programat cap entrega.' : 'Primer crea una fitxa a la pestanya «Fitxes».'}</p>`}`;
  $('#nova').onclick = () => formulariEntrega(v, null);
  $$('[data-edita]', v).forEach(b => b.onclick = () => formulariEntrega(v, entregues.find(e => e.id === b.dataset.edita)));
  $$('[data-notes]', v).forEach(b => b.onclick = () => detallNotes(v, entregues.find(e => e.id === b.dataset.notes)));
  $$('[data-esborra]', v).forEach(b => b.onclick = async () => {
    if (!confirm('S\'esborrarà l\'entrega i totes les respostes dels alumnes. Continuar?')) return;
    await accio(b, () => B.esborraEntrega(b.dataset.esborra));
    vistaEntreguesProf(v);
  });
}

async function formulariEntrega(v, e, fitxaPreseleccionada) {
  const [fitxes, alumnes] = await Promise.all([B.llistaFitxes(), B.llistaAlumnes()]);
  const grups = [...new Set(alumnes.map(a => a.grup).filter(Boolean))].sort();
  const limit = new Date(); limit.setDate(limit.getDate() + 7); limit.setHours(23, 59, 0, 0);
  const d = e || { titol: '', fitxaId: fitxaPreseleccionada || fitxes[0]?.id, grups: [], obertura: ara(), limit, comprovacions: 2, mostrarNota: true, mostrarSolucions: true };
  v.innerHTML = `
    <div class="cap-vista"><h1>${e ? 'Edita l\'entrega' : 'Programa una entrega'}</h1><button class="boto fantasma" id="torna">← Torna</button></div>
    <form class="formulari" id="f">
      <label>Fitxa <select name="fitxa" required>${fitxes.map(f => `<option value="${f.id}" ${f.id === d.fitxaId ? 'selected' : ''}>${esc(f.titol)}</option>`).join('')}</select></label>
      <label>Títol de l'entrega <input name="titol" value="${esc(d.titol)}" placeholder="Si el deixes buit, s'usa el de la fitxa"></label>
      <fieldset><legend>Per a quins grups?</legend>
        <label class="check"><input type="checkbox" name="tots" ${!d.grups?.length ? 'checked' : ''}> Tots els alumnes</label>
        ${grups.map(g => `<label class="check"><input type="checkbox" name="grup" value="${esc(g)}" ${d.grups?.includes(g) ? 'checked' : ''}> ${esc(g)}</label>`).join('')}
      </fieldset>
      <div class="dues-col">
        <label>S'obre <input type="datetime-local" name="obertura" value="${aInput(d.obertura)}" required></label>
        <label>Termini <input type="datetime-local" name="limit" value="${aInput(d.limit)}" required></label>
      </div>
      <label>Quantes vegades pot comprovar cada resposta abans d'entregar?
        <select name="comprovacions">
          ${[[0, 'Cap (no sabrà si està bé fins que entregui)'], [1, '1 vegada'], [2, '2 vegades'], [3, '3 vegades'], [-1, 'Sense límit']].map(([n, t]) => `<option value="${n}" ${n === d.comprovacions ? 'selected' : ''}>${t}</option>`).join('')}
        </select></label>
      <label class="check"><input type="checkbox" name="mostrarNota" ${d.mostrarNota ? 'checked' : ''}> Mostrar la nota a l'alumne quan entregui</label>
      <label class="check"><input type="checkbox" name="mostrarSolucions" ${d.mostrarSolucions ? 'checked' : ''}> Mostrar les solucions quan s'acabi el termini</label>
      <div class="accions"><button class="boto" type="submit">Desa l'entrega</button></div>
    </form>`;
  const f = $('#f');
  f.tots.onchange = () => { if (f.tots.checked) $$('[name=grup]', f).forEach(x => x.checked = false); };
  $$('[name=grup]', f).forEach(x => x.onchange = () => { if (x.checked) f.tots.checked = false; });
  $('#torna').onclick = () => vistaEntreguesProf(v);
  f.onsubmit = ev => {
    ev.preventDefault();
    accio($('button[type=submit]', f), async () => {
      const obertura = new Date(f.obertura.value), lim = new Date(f.limit.value);
      if (lim <= obertura) throw new Error('El termini ha de ser posterior a l\'obertura');
      const fitxa = fitxes.find(x => x.id === f.fitxa.value);
      const dades = {
        titol: f.titol.value.trim() || fitxa.titol, fitxaId: fitxa.id,
        grups: f.tots.checked ? [] : $$('[name=grup]:checked', f).map(x => x.value),
        obertura, limit: lim, comprovacions: +f.comprovacions.value,
        mostrarNota: f.mostrarNota.checked, mostrarSolucions: f.mostrarSolucions.checked,
      };
      let sols = null;
      if (dades.mostrarSolucions) sols = (await B.getSolucions(fitxa.id))?.sols || null;
      await B.desaEntrega(dades, e?.id, sols);
      avis('Entrega desada');
      vistaEntreguesProf(v);
    });
  };
}

// =====================================================================
//  PROFESSOR — Notes
// =====================================================================
const cacheAnalisi = {};
async function analisiFitxa(fitxaId) {
  if (cacheAnalisi[fitxaId]) return cacheAnalisi[fitxaId];
  const fitxa = await B.getFitxa(fitxaId);
  if (!fitxa) return null;
  const priv = await B.getSolucions(fitxaId);
  const analisis = {};
  for (const p of fitxa.preguntes) {
    try { analisis[p.id] = analitzaSolucio(priv.sols[p.id], fitxa.salt).pub; } catch { analisis[p.id] = null; }
  }
  return (cacheAnalisi[fitxaId] = { fitxa, analisis, sols: priv.sols });
}
const perAlumne = e => a => !e.grups?.length || e.grups.includes(a.grup);
const ordenaAlumnes = l => l.sort((a, b) => (a.grup || '').localeCompare(b.grup || '', 'ca') || (a.nom || '').localeCompare(b.nom || '', 'ca'));

async function notesEntrega(e, alumnes) {
  const an = await analisiFitxa(e.fitxaId);
  const respostes = await B.llistaRespostes(e.id);
  const perUid = Object.fromEntries(respostes.map(r => [r.uid, r]));
  const files = ordenaAlumnes(alumnes.filter(perAlumne(e))).map(a => {
    const r = perUid[a.uid];
    const calc = an && r ? calculaNota(an.fitxa, r.respostes || {}, an.analisis) : null;
    const estatA = r?.enviada ? 'Entregada' : r && Object.values(r.respostes || {}).some(x => x) ? (ara() > e.limit ? 'No enviada (desada)' : 'En curs') : 'Sense fer';
    return { alumne: a, resposta: r, estat: estatA, ...(calc || {}), nota: calc ? calc.nota : null };
  });
  return { an, files };
}

async function vistaNotes(v) {
  v.innerHTML = '<p class="carregant">Calculant les notes…</p>';
  const [entregues, alumnes] = await Promise.all([B.llistaEntregues(), B.llistaAlumnes()]);
  entregues.sort((a, b) => a.limit - b.limit);
  const grups = [...new Set(alumnes.map(a => a.grup).filter(Boolean))].sort();
  const grup = estat.grupNotes ?? grups[0] ?? '';
  const llista = ordenaAlumnes(alumnes.filter(a => !grup || a.grup === grup));
  const ents = entregues.filter(e => !e.grups?.length || e.grups.includes(grup) || !grup);
  const notes = {};
  for (const e of ents) {
    const { files } = await notesEntrega(e, llista);
    for (const f of files) notes[f.alumne.uid + '|' + e.id] = f;
  }
  v.innerHTML = `
    <div class="cap-vista"><h1>Notes</h1>
      <div class="accions">
        ${grups.length ? `<select id="grup">${grups.map(g => `<option ${g === grup ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>` : ''}
        <button class="boto fantasma" id="csv">Descarrega CSV</button>
      </div></div>
    ${!ents.length || !llista.length ? '<p class="buit">Encara no hi ha notes per mostrar.</p>' : `
    <div class="desplacable"><table class="taula ampla notes"><thead><tr><th>Alumne</th>
      ${ents.map(e => `<th><button class="enllac" data-e="${e.id}">${esc(e.titol)}</button><div class="meta">${fmtData(e.limit)}</div></th>`).join('')}
      <th>Mitjana</th></tr></thead><tbody>
      ${llista.map(a => {
        const ns = ents.map(e => notes[a.uid + '|' + e.id]);
        const vals = ns.filter(n => n && n.nota != null && (n.estat === 'Entregada' || ara() > ents[ns.indexOf(n)].limit)).map(n => n.nota);
        const mitjana = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
        return `<tr><td>${esc(a.nom)} <span class="meta">${esc(a.usuari)}</span></td>
          ${ns.map(n => `<td class="nota ${n?.estat === 'Entregada' ? classeNota(n.nota) : 'pendent'}" title="${esc(n?.estat || '')}">${n?.nota != null ? fmtNota(n.nota) : '—'}${n && n.estat !== 'Entregada' && n.nota != null ? '*' : ''}</td>`).join('')}
          <td class="nota ${classeNota(mitjana)}"><b>${fmtNota(mitjana)}</b></td></tr>`;
      }).join('')}
    </tbody></table></div>
    <p class="meta">* Nota calculada amb les respostes desades, però l'alumne no l'ha entregada. Clica el títol d'una entrega per veure-la exercici per exercici.</p>`}`;
  $('#grup')?.addEventListener('change', ev => { estat.grupNotes = ev.target.value; vistaNotes(v); });
  $$('[data-e]', v).forEach(b => b.onclick = () => detallNotes(v, ents.find(e => e.id === b.dataset.e)));
  $('#csv').onclick = () => descarregaCSV(`notes_${grup || 'tots'}.csv`, [
    ['Alumne', 'Usuari', 'Grup', ...ents.map(e => e.titol)],
    ...llista.map(a => [a.nom, a.usuari, a.grup, ...ents.map(e => { const n = notes[a.uid + '|' + e.id]; return n?.nota ?? ''; })]),
  ]);
}

async function detallNotes(v, e) {
  v.innerHTML = '<p class="carregant">Calculant…</p>';
  const alumnes = await B.llistaAlumnes();
  const { an, files } = await notesEntrega(e, alumnes);
  if (!an) { v.innerHTML = '<p class="error">La fitxa d\'aquesta entrega s\'ha esborrat.</p>'; return; }
  const pr = an.fitxa.preguntes;
  const entregades = files.filter(f => f.estat === 'Entregada');
  const mitjana = entregades.length ? entregades.reduce((s, f) => s + f.nota, 0) / entregades.length : null;
  v.innerHTML = `
    <div class="cap-vista"><h1>${esc(e.titol)}</h1>
      <div class="accions"><button class="boto fantasma" id="csv">Descarrega CSV</button><button class="boto fantasma" id="torna">← Torna</button></div></div>
    <p class="meta">Termini: ${fmtData(e.limit)} · Entregades: ${entregades.length}/${files.length} · Mitjana: ${fmtNota(mitjana)}</p>
    <div class="desplacable"><table class="taula ampla notes"><thead><tr><th>Alumne</th><th>Estat</th>${pr.map(p => `<th title="${esc(an.sols[p.id])}">${esc(p.etiqueta)}</th>`).join('')}<th>Nota</th><th></th></tr></thead><tbody>
      ${files.map(f => `<tr>
        <td>${esc(f.alumne.nom)}<div class="meta">${esc(f.alumne.usuari)}</div></td>
        <td>${esc(f.estat)}${f.resposta?.dataEnviament ? `<div class="meta">${fmtData(f.resposta.dataEnviament)}</div>` : ''}</td>
        ${pr.map(p => {
          const resp = f.resposta?.respostes?.[p.id];
          if (!resp) return '<td class="cel buida">·</td>';
          return `<td class="cel ${f.correccio?.[p.id] ? 'bé' : 'malament'}" title="${esc(resp)}">${f.correccio?.[p.id] ? '✓' : '✗'}</td>`;
        }).join('')}
        <td class="nota ${f.estat === 'Entregada' ? classeNota(f.nota) : 'pendent'}"><b>${fmtNota(f.nota)}</b></td>
        <td>${f.resposta?.enviada ? `<button class="boto petit fantasma" data-reobre="${f.alumne.uid}" title="Permet que l'alumne la torni a editar">Reobre</button>` : ''}
            ${f.resposta ? `<button class="boto petit fantasma" data-veure="${f.alumne.uid}">Veure</button>` : ''}</td>
      </tr>`).join('')}
    </tbody></table></div>
    <p class="meta">Passa el ratolí per sobre d'una casella per veure què ha respost l'alumne (o per sobre del número d'exercici per veure'n la solució).</p>
    <div id="resp-alumne"></div>`;
  $('#torna').onclick = () => (estat.pestanya === 'notes' ? vistaNotes(v) : vistaEntreguesProf(v));
  $('#csv').onclick = () => descarregaCSV(`${e.titol}.csv`, [
    ['Alumne', 'Usuari', 'Grup', 'Estat', ...pr.map(p => p.etiqueta), 'Nota'],
    ...files.map(f => [f.alumne.nom, f.alumne.usuari, f.alumne.grup, f.estat, ...pr.map(p => (f.correccio ? (f.correccio[p.id] ? 1 : 0) : '')), f.nota ?? '']),
  ]);
  $$('[data-reobre]', v).forEach(b => b.onclick = async () => {
    if (!confirm('L\'alumne podrà tornar a modificar i entregar aquesta fitxa (si el termini no s\'ha acabat). Continuar?')) return;
    await accio(b, () => B.reobre(e.id, b.dataset.reobre));
    detallNotes(v, e);
  });
  $$('[data-veure]', v).forEach(b => b.onclick = async () => {
    const f = files.find(x => x.alumne.uid === b.dataset.veure);
    const cont = $('#resp-alumne');
    cont.innerHTML = `<h2>Respostes de ${esc(f.alumne.nom)} — nota ${fmtNota(f.nota)}</h2><div id="ra"></div>`;
    await muntaFitxa($('#ra'), an.fitxa, { respostes: f.resposta.respostes || {}, nomesLectura: true, correccio: f.correccio, solucions: an.sols });
    cont.scrollIntoView({ behavior: 'smooth' });
  });
}

// =====================================================================
//  PROFESSOR — Alumnes
// =====================================================================
async function vistaAlumnes(v) {
  v.innerHTML = '<p class="carregant">Carregant…</p>';
  const alumnes = ordenaAlumnes(await B.llistaAlumnes());
  const grups = [...new Set(alumnes.map(a => a.grup).filter(Boolean))].sort();
  const filtre = estat.grupAlumnes || '';
  const visibles = alumnes.filter(a => !filtre || a.grup === filtre);
  v.innerHTML = `
    <div class="cap-vista"><h1>Alumnes</h1>
      <div class="accions">
        <select id="filtre"><option value="">Tots els grups</option>${grups.map(g => `<option ${g === filtre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
        <button class="boto fantasma" id="imprimeix" ${visibles.length ? '' : 'disabled'}>Imprimeix targetes</button>
        <button class="boto fantasma" id="csv" ${visibles.length ? '' : 'disabled'}>CSV</button>
      </div></div>
    <div class="dues-col alinea-dalt">
      <form class="formulari" id="un">
        <h2>Afegeix un alumne</h2>
        <label>Nom o pseudònim <input name="nom" required placeholder="p. ex. Drac Blau"></label>
        <label>Grup <input name="grup" list="grups" required placeholder="p. ex. 4t F"></label>
        <datalist id="grups">${grups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>
        <div class="dues-col">
          <label>Usuari <input name="usuari" required pattern="[a-z0-9._-]{3,30}" title="Minúscules, números, punt o guió (mínim 3)"></label>
          <label>Contrasenya <input name="pass" required minlength="6" value="${novaContrasenya()}"></label>
        </div>
        <button class="boto" type="submit">Crea l'alumne</button>
      </form>
      <form class="formulari" id="molts">
        <h2>Afegeix-ne molts de cop</h2>
        <label>Un alumne per línia: <i>pseudònim ; grup</i>
          <textarea name="llista" rows="7" placeholder="Drac Blau ; 4t F&#10;Gat Groc ; 4t F&#10;Llop Verd ; 3r A"></textarea></label>
        <p class="meta">L'usuari i la contrasenya es generen automàticament.</p>
        <button class="boto" type="submit">Crea'ls tots</button>
        <p id="progres" class="meta"></p>
      </form>
    </div>
    <h2>Llista (${visibles.length})</h2>
    ${visibles.length ? `<table class="taula ampla"><thead><tr><th>Nom</th><th>Grup</th><th>Usuari</th><th>Contrasenya</th><th></th></tr></thead><tbody>
      ${visibles.map(a => `<tr>
        <td>${esc(a.nom)}</td><td>${esc(a.grup)}</td><td><code>${esc(a.usuari)}</code></td>
        <td><code class="oculta" title="Clica per veure-la">${esc(a.contrasenya || '')}</code></td>
        <td class="accions"><button class="boto petit fantasma" data-edita="${a.uid}">Edita</button><button class="boto petit fantasma" data-pass="${a.uid}">Nova contrasenya</button><button class="boto petit perill" data-esborra="${a.uid}">Esborra</button></td>
      </tr>`).join('')}
    </tbody></table>` : '<p class="buit">Encara no hi ha alumnes.</p>'}
    <div id="impressio"></div>`;

  const existents = new Set(alumnes.map(a => a.usuari));
  const un = $('#un');
  un.nom.oninput = () => { if (!un.usuari.dataset.tocat) un.usuari.value = nomUsuari(un.nom.value, new Set(existents)); };
  un.usuari.oninput = () => { un.usuari.dataset.tocat = 1; };
  un.onsubmit = ev => {
    ev.preventDefault();
    accio($('button', un), async () => {
      await B.crearAlumne({ usuari: un.usuari.value, nom: un.nom.value.trim(), grup: un.grup.value.trim(), contrasenya: un.pass.value });
      avis('Alumne creat: ' + un.usuari.value + ' / ' + un.pass.value);
      vistaAlumnes(v);
    });
  };
  const molts = $('#molts');
  molts.onsubmit = ev => {
    ev.preventDefault();
    accio($('button', molts), async () => {
      const linies = molts.llista.value.split('\n').map(l => l.trim()).filter(Boolean);
      if (!linies.length) throw new Error('La llista és buida');
      let fets = 0;
      const errors = [];
      for (const l of linies) {
        const [nom, grup = ''] = l.split(/[;\t]/).map(x => x.trim());
        try {
          await B.crearAlumne({ usuari: nomUsuari(nom, existents), nom, grup, contrasenya: novaContrasenya() });
          fets++;
          $('#progres').textContent = `Creats ${fets} de ${linies.length}…`;
        } catch (e) { errors.push(nom + ': ' + e.message); }
      }
      avis(`S'han creat ${fets} alumnes` + (errors.length ? ` (${errors.length} errors)` : ''), errors.length ? 'error' : 'ok');
      if (errors.length) alert(errors.join('\n'));
      vistaAlumnes(v);
    });
  };
  $('#filtre').onchange = ev => { estat.grupAlumnes = ev.target.value; vistaAlumnes(v); };
  $$('code.oculta', v).forEach(c => c.onclick = () => c.classList.toggle('oculta'));
  $$('[data-pass]', v).forEach(b => b.onclick = async () => {
    const a = alumnes.find(x => x.uid === b.dataset.pass);
    const nova = prompt(`Nova contrasenya per a ${a.nom} (mínim 6 caràcters):`, novaContrasenya());
    if (!nova) return;
    if (nova.length < 6) return avis('Mínim 6 caràcters', 'error');
    await accio(b, () => B.canviaContrasenya(a.uid, nova));
    avis('Contrasenya canviada');
    vistaAlumnes(v);
  });
  $$('[data-edita]', v).forEach(b => b.onclick = async () => {
    const a = alumnes.find(x => x.uid === b.dataset.edita);
    const nom = prompt('Nom o pseudònim:', a.nom); if (nom == null) return;
    const grup = prompt('Grup:', a.grup); if (grup == null) return;
    await accio(b, () => B.editaAlumne(a.uid, { nom: nom.trim(), grup: grup.trim() }));
    vistaAlumnes(v);
  });
  $$('[data-esborra]', v).forEach(b => b.onclick = async () => {
    const a = alumnes.find(x => x.uid === b.dataset.esborra);
    if (!confirm(`Esborrar ${a.nom} (${a.usuari})? Ja no podrà entrar.`)) return;
    await accio(b, () => B.esborraAlumne(a.uid));
    vistaAlumnes(v);
  });
  $('#csv').onclick = () => descarregaCSV('alumnes.csv', [['Nom', 'Grup', 'Usuari', 'Contrasenya'], ...visibles.map(a => [a.nom, a.grup, a.usuari, a.contrasenya])]);
  $('#imprimeix').onclick = () => {
    const url = location.origin + location.pathname;
    $('#impressio').innerHTML = `<div class="targetes-imp">${visibles.map(a => `
      <div class="targeta-imp"><div class="ti-cap">${esc(C.NOM_WEB)}</div>
        <div><b>${esc(a.nom)}</b> · ${esc(a.grup)}</div>
        <div>Usuari: <code>${esc(a.usuari)}</code></div>
        <div>Contrasenya: <code>${esc(a.contrasenya)}</code></div>
        <div class="ti-url">${esc(url)}</div></div>`).join('')}</div>`;
    document.body.classList.add('imprimint');
    setTimeout(() => { window.print(); document.body.classList.remove('imprimint'); }, 50);
  };
}

// =====================================================================
//  ALUMNE — Entregues
// =====================================================================
async function vistaEntreguesAlumne(v) {
  v.innerHTML = '<p class="carregant">Carregant…</p>';
  const totes = await B.llistaEntregues();
  const meves = totes.filter(e => (!e.grups?.length || e.grups.includes(usuari.grup)) && e.obertura <= ara());
  const resp = Object.fromEntries(await Promise.all(meves.map(async e => [e.id, await B.getResposta(e.id, usuari.uid).catch(() => null)])));
  const pendents = meves.filter(e => !resp[e.id]?.enviada && e.limit > ara()).sort((a, b) => a.limit - b.limit);
  const altres = meves.filter(e => !pendents.includes(e)).sort((a, b) => b.limit - a.limit);
  const targeta = e => {
    const r = resp[e.id];
    let est;
    if (r?.enviada) est = `<span class="xip oberta">Entregada</span>${e.mostrarNota && r.notaProvisional != null ? ` <span class="nota-gran ${classeNota(r.notaProvisional)}">${fmtNota(r.notaProvisional)}</span>` : ''}`;
    else if (e.limit < ara()) est = '<span class="xip tancada">Termini acabat</span>';
    else {
      const hores = (e.limit - ara()) / 3600000;
      est = `<span class="xip ${hores < 24 ? 'urgent' : 'programada'}">Queden ${hores < 24 ? Math.max(1, Math.round(hores)) + ' h' : Math.round(hores / 24) + ' dies'}</span>`;
    }
    return `<button class="targeta clicable" data-e="${e.id}"><h3>${esc(e.titol)}</h3><p class="meta">Termini: ${fmtData(e.limit)}</p><p>${est}</p></button>`;
  };
  v.innerHTML = `
    <h1>Les meves entregues</h1>
    <h2>Per fer</h2>
    ${pendents.length ? `<div class="graella">${pendents.map(targeta).join('')}</div>` : '<p class="buit">No tens cap entrega pendent. 🎉</p>'}
    ${altres.length ? `<h2>Fetes o tancades</h2><div class="graella">${altres.map(targeta).join('')}</div>` : ''}`;
  $$('[data-e]', v).forEach(b => b.onclick = () => obreEntrega(v, meves.find(e => e.id === b.dataset.e)));
}

async function obreEntrega(v, e) {
  v.innerHTML = '<p class="carregant">Carregant…</p>';
  const fitxa = await B.getFitxa(e.fitxaId);
  if (!fitxa) { v.innerHTML = '<p class="error">Aquesta fitxa ja no existeix. Parla amb el professor.</p>'; return; }
  let r = (await B.getResposta(e.id, usuari.uid)) || { respostes: {}, comprovacions: {} };
  const tancada = ara() > e.limit;
  const enviada = !!r.enviada;
  const nomesLectura = enviada || tancada;
  const solucions = tancada && e.mostrarSolucions ? await B.getSolucionsEntrega(e.id) : null;
  const correccio = enviada && e.mostrarNota ? r.correccio : null;

  v.innerHTML = `
    <div class="cap-vista"><h1>${esc(e.titol)}</h1><button class="boto fantasma" id="torna">← Torna</button></div>
    <div class="info-entrega">
      <span>Termini: <b>${fmtData(e.limit)}</b></span>
      ${enviada ? `<span>Entregada${r.dataEnviament ? ' el ' + fmtData(r.dataEnviament) : ''}</span>` : tancada ? '<span class="error">El termini s\'ha acabat</span>' : '<span id="desat" class="meta">Les respostes es desen automàticament</span>'}
      ${enviada && e.mostrarNota && r.notaProvisional != null ? `<span class="nota-gran ${classeNota(r.notaProvisional)}">Nota: ${fmtNota(r.notaProvisional)}</span>` : ''}
    </div>
    ${!nomesLectura ? `<div class="consell">Escriu cada resposta a la casella. Pots fer servir el teclat de la pantalla per a fraccions, arrels i logaritmes. Si la resposta té text (p. ex. «4 pomes»), escriu només el número.
      ${e.comprovacions > 0 ? `<br>Pots comprovar cada resposta <b>${e.comprovacions}</b> ${e.comprovacions === 1 ? 'vegada' : 'vegades'}.` : e.comprovacions < 0 ? '<br>Pots comprovar les respostes tantes vegades com vulguis.' : '<br>No sabràs si les respostes són correctes fins que entreguis.'}</div>` : ''}
    <div id="fitxa"></div>
    ${!nomesLectura ? '<div class="peu-entrega"><button class="boto gran" id="entrega">Entrega la fitxa</button></div>' : ''}`;
  $('#torna').onclick = () => vistaEntreguesAlumne(v);

  let temps = null, pendent = null;
  const desa = async (dades) => {
    try { await B.desaResposta(e.id, usuari.uid, dades); $('#desat') && ($('#desat').textContent = '✓ Desat ' + new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })); }
    catch (err) { $('#desat') && ($('#desat').textContent = '⚠ ' + err.message); }
  };
  const estatF = await muntaFitxa($('#fitxa'), fitxa, {
    respostes: r.respostes, comptes: r.comprovacions, nomesLectura,
    maxComprovacions: nomesLectura ? 0 : e.comprovacions,
    correccio, solucions,
    onCanvi: (respostes, comptes) => {
      pendent = { respostes, comprovacions: comptes };
      $('#desat') && ($('#desat').textContent = 'Desant…');
      clearTimeout(temps);
      temps = setTimeout(() => { desa(pendent); pendent = null; }, 1200);
    },
    onComprova: (qid, res, respostes, comptes) => { clearTimeout(temps); pendent = null; desa({ respostes, comprovacions: comptes }); },
  });
  $('#entrega')?.addEventListener('click', ev => {
    const respostes = estatF.respostes;
    const buides = fitxa.preguntes.filter(p => !respostes[p.id]?.trim()).length;
    if (!confirm((buides ? `Tens ${buides} preguntes sense respondre.\n` : '') + 'Un cop entregada, ja no la podràs modificar. Entregar ara?')) return;
    accio(ev.target, async () => {
      clearTimeout(temps);
      const { nota, correccio: corr } = calculaNota(fitxa, respostes);
      await B.desaResposta(e.id, usuari.uid, { respostes, comprovacions: estatF.comptes, enviada: true, notaProvisional: nota, correccio: corr });
      avis('Fitxa entregada!');
      obreEntrega(v, e);
    });
  });
  window.onbeforeunload = () => (pendent ? true : undefined);
}

// =====================================================================
//  ALUMNE — Practicar
// =====================================================================
async function vistaPracticar(v) {
  v.innerHTML = '<p class="carregant">Carregant…</p>';
  const fitxes = (await B.llistaFitxes({ nomesPractica: true })).sort((a, b) => a.titol.localeCompare(b.titol, 'ca'));
  v.innerHTML = `
    <h1>Practicar</h1>
    <p class="meta">Aquestes fitxes no compten per a la nota. Pots comprovar les respostes tantes vegades com vulguis.</p>
    ${fitxes.length ? `<div class="graella">${fitxes.map(f => `<button class="targeta clicable" data-f="${f.id}"><h3>${esc(f.titol)}</h3><p class="meta">${f.preguntes.length} preguntes</p></button>`).join('')}</div>` : '<p class="buit">Encara no hi ha fitxes per practicar.</p>'}`;
  $$('[data-f]', v).forEach(b => b.onclick = () => obrePractica(v, fitxes.find(f => f.id === b.dataset.f)));
}

async function obrePractica(v, fitxa) {
  const clau = `practica-${usuari.uid}-${fitxa.id}`;
  let guardat = {};
  try { guardat = JSON.parse(localStorage.getItem(clau)) || {}; } catch { /* res */ }
  v.innerHTML = `
    <div class="cap-vista"><h1>${esc(fitxa.titol)}</h1>
      <div class="accions"><button class="boto fantasma" id="buida">Esborra les respostes</button><button class="boto fantasma" id="torna">← Torna</button></div></div>
    <p class="meta" id="marcador"></p>
    <div id="fitxa"></div>`;
  $('#torna').onclick = () => vistaPracticar(v);
  $('#buida').onclick = () => { localStorage.removeItem(clau); obrePractica(v, fitxa); };
  let sols = null;
  const encerts = new Set(guardat.encerts || []);
  const marcador = () => { $('#marcador').textContent = `Encertades: ${encerts.size} de ${fitxa.preguntes.length}`; };
  marcador();
  await muntaFitxa($('#fitxa'), fitxa, {
    respostes: guardat.respostes || {}, maxComprovacions: -1,
    correccio: Object.fromEntries([...encerts].map(q => [q, true])),
    onCanvi: respostes => { try { localStorage.setItem(clau, JSON.stringify({ respostes, encerts: [...encerts] })); } catch { /* res */ } },
    onComprova: (qid, res, respostes) => {
      res.correcte ? encerts.add(qid) : encerts.delete(qid);
      marcador();
      try { localStorage.setItem(clau, JSON.stringify({ respostes, encerts: [...encerts] })); } catch { /* res */ }
    },
    veureSolucio: async qid => {
      if (!sols) sols = (await B.getSolucions(fitxa.id).catch(() => null))?.sols || {};
      return sols[qid] ?? null;
    },
  });
}

inicia();
