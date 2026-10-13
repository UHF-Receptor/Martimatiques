// =====================================================================
//  Backend amb Firebase (Authentication + Firestore). Pla gratuït.
// =====================================================================
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, updatePassword, deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection,
  query, where, writeBatch, Timestamp, serverTimestamp, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, DOMINI, USUARI_PROFESSOR } from './config.js';

export const modeProva = false;
export const esBuit = () => false;

let app, auth, db;
const correu = u => u.trim().toLowerCase() + '@' + DOMINI;
const CORREU_PROFESSOR = correu(USUARI_PROFESSOR);
let usuari = null;

export function init() {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// App secundària: permet crear/modificar comptes d'alumnes sense tancar la sessió del professor
function authSecundaria() {
  const sec = getApps().find(a => a.name === 'secundaria') || initializeApp(firebaseConfig, 'secundaria');
  return getAuth(sec);
}

function traduix(err) {
  const c = err?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email')) return new Error('Usuari o contrasenya incorrectes');
  if (c.includes('email-already-in-use')) return new Error('Aquest usuari ja existeix');
  if (c.includes('weak-password')) return new Error('La contrasenya ha de tenir com a mínim 6 caràcters');
  if (c.includes('too-many-requests')) return new Error('Massa intents. Espera uns minuts i torna-ho a provar');
  if (c.includes('permission-denied')) return new Error('No tens permís per fer això (o el termini ja s\'ha acabat)');
  if (c.includes('network')) return new Error('Sense connexió a internet');
  return err instanceof Error ? err : new Error(String(err));
}
const prova = fn => async (...a) => { try { return await fn(...a); } catch (e) { throw traduix(e); } };
const aData = v => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

export function onUsuari(cb) {
  onAuthStateChanged(auth, async u => {
    if (!u) { usuari = null; return cb(null); }
    if (u.email === CORREU_PROFESSOR) { usuari = { uid: u.uid, usuari: USUARI_PROFESSOR, rol: 'professor', nom: 'Professor/a' }; return cb(usuari); }
    try {
      const s = await getDoc(doc(db, 'alumnes', u.uid));
      if (!s.exists()) { await signOut(auth); return cb(null); }
      usuari = { uid: u.uid, ...s.data(), rol: 'alumne' };
      cb(usuari);
    } catch { cb(null); }
  });
}

export const entra = prova(async (nom, contrasenya) => { await signInWithEmailAndPassword(auth, correu(nom), contrasenya); });
export const surt = prova(async () => { await signOut(auth); });

// ---------- Alumnes ----------
export const crearAlumne = prova(async ({ usuari: u, nom, grup, contrasenya }) => {
  u = u.trim().toLowerCase();
  if (u === USUARI_PROFESSOR) throw new Error('Aquest nom d\'usuari està reservat');
  const sa = authSecundaria();
  const cred = await createUserWithEmailAndPassword(sa, correu(u), contrasenya);
  const uid = cred.user.uid;
  await signOut(sa);
  const b = writeBatch(db);
  b.set(doc(db, 'alumnes', uid), { usuari: u, nom, grup });
  b.set(doc(db, 'credencials', uid), { usuari: u, contrasenya });
  await b.commit();
  return uid;
});

export const llistaAlumnes = prova(async () => {
  const [a, c] = await Promise.all([getDocs(collection(db, 'alumnes')), getDocs(collection(db, 'credencials'))]);
  const pass = Object.fromEntries(c.docs.map(d => [d.id, d.data().contrasenya]));
  return a.docs.map(d => ({ uid: d.id, ...d.data(), contrasenya: pass[d.id] || '' }));
});

async function ambCompteAlumne(uid, accio) {
  const c = await getDoc(doc(db, 'credencials', uid));
  if (!c.exists()) throw new Error('No es troba la contrasenya d\'aquest alumne');
  const sa = authSecundaria();
  const cred = await signInWithEmailAndPassword(sa, correu(c.data().usuari), c.data().contrasenya);
  try { await accio(cred.user); } finally { if (sa.currentUser) await signOut(sa); }
}

export const canviaContrasenya = prova(async (uid, nova) => {
  await ambCompteAlumne(uid, user => updatePassword(user, nova));
  await updateDoc(doc(db, 'credencials', uid), { contrasenya: nova });
});
export const editaAlumne = prova(async (uid, { nom, grup }) => { await updateDoc(doc(db, 'alumnes', uid), { nom, grup }); });
export const esborraAlumne = prova(async uid => {
  try { await ambCompteAlumne(uid, user => deleteUser(user)); } catch { /* si el compte ja no existeix, continua */ }
  const b = writeBatch(db);
  b.delete(doc(db, 'alumnes', uid));
  b.delete(doc(db, 'credencials', uid));
  await b.commit();
});

// ---------- Fitxes ----------
// pub → fitxes/{id} (la veuen els alumnes, sense solucions)
// priv → solucions/{id} (només professor; o tothom si és de pràctica)
export const desaFitxa = prova(async (pub, priv, fitxaId) => {
  const ref = fitxaId ? doc(db, 'fitxes', fitxaId) : doc(collection(db, 'fitxes'));
  const b = writeBatch(db);
  b.set(ref, { ...pub, actualitzada: serverTimestamp() });
  b.set(doc(db, 'solucions', ref.id), priv);
  await b.commit();
  return ref.id;
});
export const llistaFitxes = prova(async ({ nomesPractica = false } = {}) => {
  const q = nomesPractica ? query(collection(db, 'fitxes'), where('practica', '==', true)) : collection(db, 'fitxes');
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
});
export const getFitxa = prova(async id => { const s = await getDoc(doc(db, 'fitxes', id)); return s.exists() ? { id, ...s.data() } : null; });
export const getSolucions = prova(async id => { const s = await getDoc(doc(db, 'solucions', id)); return s.exists() ? s.data() : null; });
export const esborraFitxa = prova(async id => {
  const b = writeBatch(db);
  b.delete(doc(db, 'fitxes', id));
  b.delete(doc(db, 'solucions', id));
  await b.commit();
});

// ---------- Entregues ----------
export const desaEntrega = prova(async (e, entregaId, solucionsPerCopiar) => {
  const ref = entregaId ? doc(db, 'entregues', entregaId) : doc(collection(db, 'entregues'));
  const dades = { ...e, obertura: Timestamp.fromDate(new Date(e.obertura)), limit: Timestamp.fromDate(new Date(e.limit)) };
  const b = writeBatch(db);
  b.set(ref, dades);
  const sref = doc(db, 'solucionsEntrega', ref.id);
  if (e.mostrarSolucions && solucionsPerCopiar) b.set(sref, { sols: solucionsPerCopiar, visibleDes: dades.limit });
  else b.delete(sref);
  await b.commit();
  return ref.id;
});
export const llistaEntregues = prova(async () => {
  const s = await getDocs(collection(db, 'entregues'));
  return s.docs.map(d => ({ id: d.id, ...d.data(), obertura: aData(d.data().obertura), limit: aData(d.data().limit) }));
});
export const esborraEntrega = prova(async id => {
  const rs = await getDocs(query(collection(db, 'respostes'), where('entregaId', '==', id)));
  const b = writeBatch(db);
  rs.docs.forEach(d => b.delete(d.ref));
  b.delete(doc(db, 'entregues', id));
  b.delete(doc(db, 'solucionsEntrega', id));
  await b.commit();
});
export async function getSolucionsEntrega(id) {
  try { const s = await getDoc(doc(db, 'solucionsEntrega', id)); return s.exists() ? s.data().sols : null; }
  catch { return null; } // abans del termini, l'alumne no hi té accés
}

// ---------- Respostes ----------
const rid = (eid, uid) => eid + '_' + uid;
export const getResposta = prova(async (eid, uid) => {
  const s = await getDoc(doc(db, 'respostes', rid(eid, uid)));
  return s.exists() ? { ...s.data(), dataEnviament: aData(s.data().dataEnviament) } : null;
});
export const desaResposta = prova(async (eid, uid, dades) => {
  const extra = dades.enviada ? { dataEnviament: serverTimestamp() } : {};
  await setDoc(doc(db, 'respostes', rid(eid, uid)), { ...dades, ...extra, uid, entregaId: eid }, { merge: true });
});
export const llistaRespostes = prova(async eid => {
  const s = await getDocs(query(collection(db, 'respostes'), where('entregaId', '==', eid)));
  return s.docs.map(d => ({ ...d.data(), dataEnviament: aData(d.data().dataEnviament) }));
});
export const reobre = prova(async (eid, uid) => {
  await updateDoc(doc(db, 'respostes', rid(eid, uid)), { enviada: false, dataEnviament: deleteField() });
});

export function esborraTot() {}
