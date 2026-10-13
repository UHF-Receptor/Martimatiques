// Proves del motor de correcció:  node proves/correccio.test.mjs
import { analitzaSolucio, corregeix } from '../js/correccio.js';

let ok = 0, ko = 0;
function prova(sol, resposta, esperat, estricte = false, nota = '') {
  let r;
  try {
    const { pub } = analitzaSolucio(sol, 'sal');
    r = corregeix(resposta, pub, 'sal', estricte);
  } catch (e) { r = { correcte: 'ERROR: ' + e.message }; }
  const bé = r.correcte === esperat;
  bé ? ok++ : ko++;
  if (!bé) console.log(`✗ sol=${sol}  resp=${resposta}  esperat=${esperat}  obtingut=${JSON.stringify(r)} ${nota}`);
}

// --- Solucions del main.tex (tal com les ha escrit el professor) ---
const mainTex = [
  ['$\\dfrac{1}{64}$', '\\frac{1}{64}'], ['$3^6$', '729'], ['$1$', '1'], ['$2^{18}$', '2^{18}'],
  ['$3^3$', '27'], ['$2^{10}$', '1024'], ['$\\dfrac{1}{9}$', '\\frac19'], ['$2^4$', '16'],
  ['$5^{-4}$', '\\frac{1}{5^4}'], ['$2^7$', '128'], ['$\\dfrac{15625}{4}$', '3906{,}25'],
  ['$\\dfrac{a^5}{b^5}$', '\\frac{a^5}{b^5}'], ['$\\dfrac{1}{32}$', '2^{-5}'],
];
for (const [s, r] of mainTex) prova(s, r, true);

// --- dfrac = frac ---
prova('\\dfrac{3}{4}', '\\frac{3}{4}', true);
prova('\\frac{3}{4}', '\\dfrac{3}{4}', true);
prova('\\tfrac{3}{4}', '0{,}75', true);
prova('\\dfrac{3}{4}', '\\frac{4}{3}', false);
prova('\\dfrac{a^5}{b^5}', '\\left(\\frac{a}{b}\\right)^5', true);
prova('\\dfrac{a^5}{b^5}', 'a^5b^{-5}', true);
prova('\\dfrac{a^5}{b^5}', '\\frac{b^5}{a^5}', false);

// --- Arrels quadrades i n-èssimes ---
prova('\\sqrt{2}', '\\sqrt{2}', true);
prova('2\\sqrt{2}', '\\sqrt{8}', true);
prova('2\\sqrt{2}', '\\sqrt{8}', false, true, '(estricte: cal extreure factors)');
prova('2\\sqrt{2}', '2\\sqrt2', true, true);
prova('\\sqrt[3]{8}', '2', true);
prova('2', '\\sqrt[3]{8}', false, true, '(estricte)');
prova('\\sqrt[3]{-27}', '-3', true);
prova('\\sqrt[4]{16}', '2', true);
prova('3\\sqrt[3]{2}', '\\sqrt[3]{54}', true);
prova('3\\sqrt[3]{2}', '\\sqrt[3]{54}', false, true);
prova('\\sqrt[5]{x^2}', 'x^{\\frac{2}{5}}', true);
prova('\\dfrac{\\sqrt{2}}{2}', '\\frac{1}{\\sqrt{2}}', true);
prova('\\dfrac{\\sqrt{2}}{2}', '\\frac{1}{\\sqrt{2}}', false, true, '(racionalitzar)');
prova('\\sqrt{3}', '\\sqrt{2}', false);
prova('\\sqrt{12}', '2\\sqrt3', true);
prova('5\\sqrt{3}', '\\sqrt{12}+\\sqrt{27}', true);
prova('5\\sqrt{3}', '\\sqrt{12}+\\sqrt{27}', false, true);

// --- Logaritmes ---
prova('3', '\\log_{2}8', true);
prova('3', '\\log_2 8', true);
prova('3', '\\log_{2}\\left(8\\right)', true);
prova('2', '\\log 100', true);
prova('\\log_2 8', '3', true);
prova('\\log_{3} 81', '4', true);
prova('-2', '\\log_{3}\\frac{1}{9}', true);
prova('\\dfrac{1}{2}', '\\log_{4}2', true);
prova('1', '\\ln e', true);
prova('2', '\\ln e^2', true);
prova('3', '\\log_{2}8', false, true, '(estricte: no val copiar el logaritme)');
prova('\\log_2 5', '\\log_2 5', true, true);
prova('\\log_2 5', '\\frac{\\ln 5}{\\ln 2}', true);
prova('\\log 2 + \\log 5', '1', true);
prova('3', '\\log_{2}9', false);

// --- Part escrita: només compta el número ---
prova('4 pomes', '4', true);
prova('$4$ pomes', '4', true);
prova('\\text{4 pomes}', '4', true, false, '(text dins \\text)');
prova('$12\\text{ cm}^2$', '12', true);
prova('$12$ cm$^2$', '12', true);
prova('$15$ €', '15', true);
prova('15\\euro', '15', true);
prova('$25\\%$', '25', true);
prova('$60^\\circ$', '60', true);
prova('$3$ anys', '3', true);
prova('$x = 7$ alumnes', '7', true);
prova('4', '4 pomes', true, false, '(l\'alumne afegeix text)');
prova('18 l\'any', '18', true);
prova('$3{,}5$ km', '3{,}5', true);
prova('$90$ km/h', '90', true);

// --- Decimals, comes i multiplicacions ---
prova('2,5', '2{,}5', true);
prova('2{,}5', '\\frac{5}{2}', true);
prova('12{,}57', '4\\pi', true, false, '(arrodoniment a 2 decimals)');
prova('12{,}57', '12{,}566', true);
prova('12{,}57', '12{,}6', false);
prova('15\\,625', '15625', true);
prova('2ab', '2\\cdot a\\cdot b', true);
prova('2ab', 'ab', false);
prova('6x^2', '2x\\cdot 3x', true);
prova('x^2-1', '(x+1)(x-1)', true);
prova('12:4', '3', true);

// --- Diverses solucions i coordenades ---
prova('x_1 = 2, \\; x_2 = 3', '3;2', true);
prova('x_1 = 2,\\ x_2 = -3', 'x=2; x=-3', true);
prova('x=\\pm 3', '3;-3', true);
prova('x=\\pm 3', '3', false);
prova('$(2,3)$', '(2;3)', true);
prova('$(2,3)$', '\\left(2,3\\right)', true);
prova('$(2,3)$', '(3;2)', false);
prova('(2{,}5, -1)', '(2{,}5;-1)', true);
prova('\\emptyset', 'no té solució', true);
prova('No té solució', '\\varnothing', true);
prova('No té solució', '3', false);

// --- Mode estricte ---
prova('3^6', '3^2\\cdot 3^4', true, false);
prova('3^6', '3^2\\cdot 3^4', false, true);
prova('\\dfrac{1}{2}', '\\frac{2}{4}', false, true);
prova('\\dfrac{1}{2}', '0{,}5', true, true);
prova('\\dfrac{1}{64}', '2^{-6}', true, true);
prova('2^7', '\\frac{(2^3\\cdot2^{-5})^{-2}}{2^{-3}}', false, true, '(copiar l\'enunciat)');

prova('$6\\sqrt{2}$ m', '6\\sqrt2', true);
prova('$x_1=2$ i $x_2=3$', '3;2', true);
prova('$12$ cm$^2$', '12', true);

// --- Respostes mal escrites ---
prova('2', '\\frac{1}{', false);
prova('2', '', false);
prova('2', '\\placeholder{}', false);

console.log(`\n${ok} correctes, ${ko} errors`);
process.exit(ko ? 1 : 0);
