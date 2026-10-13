// =====================================================================
//  MODE DE PROVA: totes les dades al localStorage d'aquest navegador.
//  Mateixa interfície que backend-firebase.js.
// =====================================================================
import { USUARI_PROFESSOR } from './config.js';

const CLAU = 'quadern-mates-prova';
const CLAU_SESSIO = 'quadern-mates-prova-sessio';

function carrega() {
  try { return JSON.parse(localStorage.getItem(CLAU)) || null; } catch { return null; }
}
let db = carrega() || { alumnes: {}, fitxes: {}, solucions: {}, entregues: {}, solucionsEntrega: {}, respostes: {} };
const desa = () => localStorage.setItem(CLAU, JSON.stringify(db));
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const copia = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
const ambDates = e => e && ({ ...e, obertura: new Date(e.obertura), limit: new Date(e.limit) });
let usuari = null;
const oients = [];

export const modeProva = true;
export const esBuit = () => !Object.keys(db.fitxes).length && !Object.keys(db.alumnes).length;

export function init() {}

export function onUsuari(cb) {
  oients.push(cb);
  const uid = sessionStorage.getItem(CLAU_SESSIO);
  if (uid === 'professor') usuari = { uid, usuari: USUARI_PROFESSOR, rol: 'professor', nom: 'Professor/a' };
  else if (uid && db.alumnes[uid]) usuari = { uid, ...pick(db.alumnes[uid]), rol: 'alumne' };
  cb(usuari);
}
const pick = a => ({ usuari: a.usuari, nom: a.nom, grup: a.grup });
const avisa = () => oients.forEach(cb => cb(usuari));

export async function entra(nom, contrasenya) {
  nom = nom.trim().toLowerCase();
  if (nom === USUARI_PROFESSOR && contrasenya === 'professor') {
    usuari = { uid: 'professor', usuari: nom, rol: 'professor', nom: 'Professor/a' };
  } else {
    const [uid, a] = Object.entries(db.alumnes).find(([, a]) => a.usuari === nom) || [];
    if (!a || a.contrasenya !== contrasenya) throw new Error('Usuari o contrasenya incorrectes');
    usuari = { uid, ...pick(a), rol: 'alumne' };
  }
  sessionStorage.setItem(CLAU_SESSIO, usuari.uid);
  avisa();
}
export async function surt() { usuari = null; sessionStorage.removeItem(CLAU_SESSIO); avisa(); }

// ---------- Alumnes ----------
export async function crearAlumne({ usuari: u, nom, grup, contrasenya }) {
  u = u.trim().toLowerCase();
  if (u === USUARI_PROFESSOR || Object.values(db.alumnes).some(a => a.usuari === u)) throw new Error('L\'usuari «' + u + '» ja existeix');
  const uid = id();
  db.alumnes[uid] = { usuari: u, nom, grup, contrasenya };
  desa();
  return uid;
}
export async function llistaAlumnes() {
  return Object.entries(db.alumnes).map(([uid, a]) => ({ uid, ...a }));
}
export async function canviaContrasenya(uid, nova) { db.alumnes[uid].contrasenya = nova; desa(); }
export async function editaAlumne(uid, { nom, grup }) { Object.assign(db.alumnes[uid], { nom, grup }); desa(); }
export async function esborraAlumne(uid) { delete db.alumnes[uid]; desa(); }

// ---------- Fitxes ----------
export async function desaFitxa(pub, priv, fitxaId) {
  const fid = fitxaId || id();
  db.fitxes[fid] = { ...copia(pub), actualitzada: new Date().toISOString() };
  db.solucions[fid] = copia(priv);
  desa();
  return fid;
}
export async function llistaFitxes({ nomesPractica = false } = {}) {
  return Object.entries(db.fitxes).map(([id, f]) => ({ id, ...copia(f) })).filter(f => !nomesPractica || f.practica);
}
export async function getFitxa(fid) { return db.fitxes[fid] ? { id: fid, ...copia(db.fitxes[fid]) } : null; }
export async function getSolucions(fid) {
  const s = db.solucions[fid];
  if (!s) return null;
  if (usuari?.rol !== 'professor' && !s.publica) throw new Error('Sense permís');
  return copia(s);
}
export async function esborraFitxa(fid) { delete db.fitxes[fid]; delete db.solucions[fid]; desa(); }

// ---------- Entregues ----------
export async function desaEntrega(e, entregaId, solucionsPerCopiar) {
  const eid = entregaId || id();
  db.entregues[eid] = { ...copia(e), obertura: new Date(e.obertura).toISOString(), limit: new Date(e.limit).toISOString() };
  if (e.mostrarSolucions && solucionsPerCopiar) db.solucionsEntrega[eid] = { sols: copia(solucionsPerCopiar), visibleDes: db.entregues[eid].limit };
  else delete db.solucionsEntrega[eid];
  desa();
  return eid;
}
export async function llistaEntregues() {
  return Object.entries(db.entregues).map(([id, e]) => ({ id, ...ambDates(copia(e)) }));
}
export async function esborraEntrega(eid) {
  delete db.entregues[eid]; delete db.solucionsEntrega[eid];
  for (const k of Object.keys(db.respostes)) if (k.startsWith(eid + '_')) delete db.respostes[k];
  desa();
}
export async function getSolucionsEntrega(eid) {
  const s = db.solucionsEntrega[eid];
  if (!s) return null;
  if (usuari?.rol !== 'professor' && new Date() < new Date(s.visibleDes)) return null;
  return copia(s.sols);
}

// ---------- Respostes ----------
const rid = (eid, uid) => eid + '_' + uid;
export async function getResposta(eid, uid) {
  const r = db.respostes[rid(eid, uid)];
  return r ? { ...copia(r), dataEnviament: r.dataEnviament ? new Date(r.dataEnviament) : null } : null;
}
export async function desaResposta(eid, uid, dades) {
  const e = db.entregues[eid];
  const actual = db.respostes[rid(eid, uid)];
  if (usuari?.rol !== 'professor') {
    if (!e || new Date() > new Date(e.limit)) throw new Error('El termini d\'aquesta entrega ja s\'ha acabat');
    if (actual?.enviada) throw new Error('Aquesta entrega ja està enviada');
  }
  db.respostes[rid(eid, uid)] = { ...(actual || {}), ...copia(dades), uid, entregaId: eid,
    ...(dades.enviada && !actual?.enviada ? { dataEnviament: new Date().toISOString() } : {}) };
  desa();
}
export async function llistaRespostes(eid) {
  return Object.values(db.respostes).filter(r => r.entregaId === eid)
    .map(r => ({ ...copia(r), dataEnviament: r.dataEnviament ? new Date(r.dataEnviament) : null }));
}
export async function reobre(eid, uid) {
  const r = db.respostes[rid(eid, uid)];
  if (r) { r.enviada = false; delete r.dataEnviament; desa(); }
}

export function esborraTot() { localStorage.removeItem(CLAU); sessionStorage.removeItem(CLAU_SESSIO); location.reload(); }
