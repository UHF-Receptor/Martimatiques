// =====================================================================
//  CONFIGURACIÓ — és l'únic fitxer que has d'editar
// =====================================================================

export const NOM_WEB = 'Quadern de Martimàtiques';

// Nom d'usuari del professor (per entrar a la web).
export const USUARI_PROFESSOR = 'professor';

// Domini "inventat" que s'afegeix als noms d'usuari per crear els comptes
// (l'alumne escriu "drac" i internament és drac@quadern-mates.app).
// No cal que existeixi. Si el canvies, canvia'l també a firestore.rules.
export const DOMINI = 'quadern-mates.app';

// ---------------------------------------------------------------------
//  Firebase: enganxa aquí la configuració del teu projecte
//  (Consola de Firebase → Configuració del projecte → Les teves apps → Web).
//  Mentre sigui null, la web funciona en MODE DE PROVA: les dades només
//  es guarden en el navegador on l'obres (serveix per provar-la).
// ---------------------------------------------------------------------
export const firebaseConfig = null;
/* Exemple:
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "quadern-mates.firebaseapp.com",
  projectId: "quadern-mates",
  storageBucket: "quadern-mates.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
