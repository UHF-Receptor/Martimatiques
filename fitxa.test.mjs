import { readFileSync } from 'fs';
import { llegeixFitxa, MACROS_BASE } from '../js/fitxa.js';
import { analitzaSolucio } from '../js/correccio.js';
import katex from '/opt/npm-tools/node_modules/katex/dist/katex.mjs';
const f = llegeixFitxa(readFileSync(process.argv[2] || 'proves/main.tex', 'utf8'));
console.log('TÍTOL:', f.titol);
console.log('AVISOS:', f.avisos);
for (const p of f.preguntes) {
  let r; try { r = analitzaSolucio(p.sol, 'x').info.text; } catch (e) { r = '⚠ ' + e.message; }
  console.log(p.id, p.etiqueta.padEnd(6), p.sol.padEnd(28), '→', r);
}
let errs = 0;
for (const m of f.html.matchAll(/<(span|div) class="(m|md)">([\s\S]*?)<\/\1>/g)) {
  const latex = m[3].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
  try { katex.renderToString(latex, { throwOnError: true, macros: { ...MACROS_BASE, ...f.macros } }); }
  catch (e) { errs++; console.log('KaTeX ✗', latex, e.message); }
}
console.log('Fórmules amb error KaTeX:', errs);
if (process.argv[3]) console.log(f.html);
