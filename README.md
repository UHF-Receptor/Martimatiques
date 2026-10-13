# Quadern de Martimàtiques

Plataforma web perquè els alumnes practiquin matemàtiques (àlgebra, aritmètica i geometria) amb fitxes escrites en LaTeX, en el mateix format que `main.tex`.

- El professor enganxa (o carrega) el `.tex`. Cada `\sol{...}` es converteix en una casella de resposta.
- Els alumnes responen amb un editor de fórmules (fraccions, arrels, logaritmes…) i poden comprovar les respostes.
- El professor programa **entregues** (data d'obertura i termini, grups) i obté les **notes** (sobre 10), exportables a CSV.
- El professor crea els usuaris i contrasenyes dels alumnes (d'un en un o tots de cop) i pot imprimir-los en targetes.

---

## 1. Provar-la (sense configurar res)

Mentre `js/config.js` tingui `firebaseConfig = null`, la web funciona en **mode de prova**: les dades es guarden només al navegador.

```bash
cd quadern
python3 -m http.server 8000
```

Obre http://localhost:8000 · Professor: `professor` / `professor` · Alumne: `alumne1` / `alumne1`.

> Cal obrir-la amb un servidor (o des de GitHub Pages). Fent doble clic a `index.html` no funciona.

## 2. Publicar-la a GitHub Pages

1. Crea un repositori nou a GitHub (per exemple `quadern-mates`) i puja-hi **tot el contingut d'aquesta carpeta** (amb `index.html` a l'arrel).
2. Al repositori: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`** → Save.
3. Al cap d'un minut la web serà a `https://EL-TEU-USUARI.github.io/quadern-mates/`.

Fins aquí la web ja es veu, però en mode de prova (cada navegador té les seves dades). Per tenir alumnes i notes de veritat, fes el pas 3.

## 3. Connectar-la a Firebase (gratuït, sense targeta)

GitHub Pages només serveix pàgines; els usuaris, les respostes i les notes es guarden a Firebase.

1. Ves a https://console.firebase.google.com → **Afegeix un projecte** (pots desactivar Google Analytics).
2. **Authentication → Comença → Sign-in method → Correu electrònic/contrasenya → Activa**.
3. **Authentication → Users → Afegeix un usuari**:
   correu `professor@quadern-mates.app`, i la contrasenya que vulguis (serà la teva).
4. **Authentication → Settings → Dominis autoritzats → Afegeix** `EL-TEU-USUARI.github.io`.
5. **Firestore Database → Crea una base de dades** (ubicació `eur3` o `europe-west`, mode de producció).
6. **Firestore → Regles**: esborra el que hi ha, enganxa el contingut de `firestore.rules` i **Publica**.
7. **Configuració del projecte (engranatge) → Les teves apps → icona `</>` (Web)** → registra l'app i copia l'objecte `firebaseConfig`.
8. Enganxa'l a `js/config.js` (substitueix `null`) i puja el canvi a GitHub.

Ja està: entra amb `professor` i la contrasenya del pas 3.

> Si vols un altre nom d'usuari de professor, canvia `USUARI_PROFESSOR` a `js/config.js` **i** el correu de `firestore.rules`, i crea l'usuari amb aquest correu.

## 4. Com s'escriuen les fitxes

Igual que `main.tex`. La capçalera del centre (`{\capsal ...}`) s'ignora. Cada exercici acaba amb `\hfill \sol{...}`.

| Solució al .tex | L'alumne pot respondre |
|---|---|
| `\sol{$\dfrac{1}{64}$}` (o `\frac`) | 1/64, 2⁻⁶, 0,015625 |
| `\sol{$5\sqrt{2}$}` | 5√2 |
| `\sol{$\sqrt[3]{2}$}` | ∛2 |
| `\sol{$5$}` (d'un `\log_2 32`) | 5 |
| `\sol{6 hores}`, `\sol{$12$ cm$^2$}`, `\sol{$15$ €}` | 6, 12, 15 (només compta el número) |
| `\sol{$12{,}57$}` | 12,57 · 4π (arrodoneix igual) |
| `\sol{$x_1=2,\ x_2=-3$}` o `\sol{$x=\pm 7$}` | 2;-3 · 7;-7 (en qualsevol ordre) |
| `\sol{$(2,3)$}` | (2;3) |
| `\sol{No té solució}` | ∅ o «no té solució» |

- **Decimals**: amb coma (`2,5` o `2{,}5`). Dins de parèntesis la coma separa coordenades: per a decimals escriu `(2{,}5, 3)`.
- **Logaritmes**: `\log_2 8`, `\log_{3}\dfrac{1}{9}`, `\log 100` (base 10), `\ln e`.
- **Trigonometria**: `\sin`, `\cos`, `\tan` en graus.
- **Mode «Cal simplificar»** (per defecte): el valor ha de ser correcte i a més estar simplificat. No s'accepta copiar l'enunciat, fraccions reduïbles (2/4), arrels sense extreure factors (√8) ni arrels al denominador si la solució no en té. L'alumne veu el motiu.
- **Imatges**: `\includegraphics{figura.png}` busca el fitxer a la carpeta `img/` del repositori (o posa una adreça https).
- **TikZ**: es dibuixa amb TikZJax (experimental; figures senzilles).

Prem **Previsualitza** abans de desar: surt una taula amb com s'ha entès cada solució i avisos d'errors al LaTeX (claus sense tancar, `\end{enumerate}` que falta…). No es pot desar una fitxa amb solucions que no s'entenen.

## 5. Funcionament

- **Fitxes**: marca «Disponible a Practicar» perquè els alumnes la facin lliurement (sense nota i amb opció de veure la solució).
- **Entregues**: tria fitxa, grups, obertura i termini; quantes vegades pot comprovar cada resposta (cap, 1, 2, 3 o sense límit); si l'alumne veu la nota en entregar i si veu les solucions quan acaba el termini. Les respostes es desen soles mentre l'alumne treballa.
- **Notes**: taula per grup amb totes les entregues i la mitjana, i detall exercici per exercici (✓/✗, què ha respost, botó «Reobre»). La nota la recalcula sempre la web del professor amb les solucions reals.
- **Alumnes**: pseudònim i grup; l'usuari i la contrasenya es generen sols. Botons per imprimir targetes i descarregar CSV.

## 6. Seguretat (què cal saber)

- Les solucions no s'envien als alumnes: reben només una «empremta» xifrada que permet comprovar si la resposta és correcta. Un alumne amb molts coneixements podria provar respostes per força bruta, però no pot llegir les solucions ni canviar la seva nota (el professor la recalcula).
- Les regles de Firestore impedeixen que un alumne vegi les respostes d'un altre, modifiqui una entrega ja enviada o entregui fora de termini.
- Fes servir pseudònims, no noms reals.

## 7. Fitxers

```
index.html            pàgina principal
css/estil.css         aspecte
js/config.js          ← configuració (Firebase)
js/app.js             interfície professor/alumne
js/fitxa.js           lector de LaTeX → HTML
js/correccio.js       motor de correcció (fraccions, arrels, logaritmes, text…)
js/backend-*.js       Firebase o mode de prova
firestore.rules       regles de seguretat
proves/               proves automàtiques (node proves/correccio.test.mjs)
```
