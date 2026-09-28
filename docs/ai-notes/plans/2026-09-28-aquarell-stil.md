# Plan — Zweiter Grafikstil «Aquarell-Bilderbuch» (Issue #90, Scheibe 1)

Spec: [`docs/ai-notes/specs/2026-09-28-aquarell-stil-design.md`](../specs/2026-09-28-aquarell-stil-design.md)

## Ziel

Ein Toolbar-Knopf schaltet mitten im Spiel zwischen dem bestehenden
Bilderbuch-Look und einem Aquarell-Look. Der Wechsel ist **eine Uniform** —
kein Rebuild, keine neuen Materialinstanzen, keine sichtbare Verzögerung. Der
Aquarell-Look besteht aus drei Effekten: Randpigment, Papierkorn (Screen
Space), Tuschekontur mit Passerversatz.

## Globale Randbedingungen

- **Buildless.** Vanilla ES-Module, three.js 0.184 über Importmap
  (`index.html:13`). Kein npm, kein Bundler, kein `package.json`, kein
  `node_modules`. Nichts wird zur Laufzeit nachgeladen — die Papiertextur wird
  auf einem `<canvas>` gemalt.
- **Kein Test-Runner.** Die Abnahme ist ein Playwright-Lauf **im Vordergrund**.
  Niemals `run_in_background` — ein Hintergrundlauf meldet sich nie zurück
  (`CLAUDE.md`, «Tooling & Testing»).
- **Branch und Push zuerst.** Branch anlegen, committen und pushen **bevor**
  die Prüfläufe starten, damit ein abgebrochener Lauf die Arbeit nicht
  mitnimmt.
- **`MeshLambertMaterial` bleibt.** `material.type` darf sich nirgends ändern.
  `tools/verify_katalog.py:103` (Auswertung Zeile 145) prüft das hart für
  jedes Möbel, und Zeile 104 verbietet zusätzlich jede `material.map` am Möbel.
- **Bestehender Look bleibt pixelgleich**, wenn `aquarell = 0`. Jede Änderung,
  die auch bei `0` sichtbar ist, ist ein Fehler — das ist das schärfste
  Kriterium dieses Issues.
- **Kein Jitter in dieser Scheibe** (Spec E5). Wer ihn einbaut, verletzt den
  Punkt darüber.
- **Konturen nur auf Struktur**, nie unter `makeFurniture` (Spec E7).
- Deutsche Kommentare und UI-Texte, echte Umlaute, `Du`/`Dein` gross.
- Conventional Commits.

## Dateien

| Datei | Was passiert |
|---|---|
| `js/stil.js` | **neu** — `STYLE`-Uniforms, `makePaper()`, GLSL-Hilfen, `patchLambert()`, `hullMaterial()`, `addHull()`, `setStil()` |
| `js/models.js` | `L()` ruft `patchLambert()`; Schild-Brett (`:968`) über `L()` |
| `js/game.js` | vier Umgeher über `L()`; Konturen auf Struktur; `fensterAuf`/`fensterZu`; `applyNight`-Farbpaar; Resize-Uniform; Knopf-Verdrahtung; Debug-Hook |
| `index.html` | Knopf `btn-stil` in der Toolbar |
| `docs/design-handoff.md` | Regel «`MeshLambertMaterial` only» um den zweiten Stil ergänzen |
| `CHANGELOG.md` | Eintrag unter `[Unreleased]`, in Spielersprache |
| `tools/verify_stil.py` | **neu** — Playwright-Prüflauf für dieses Feature |

## Schnittstellen

```js
// js/stil.js
export const STYLE = {
  aquarell: { value: 0 },          // 0 = Bilderbuch, 1 = Aquarell
  res:      { value: new THREE.Vector2(1, 1) },
  paper:    { value: /* THREE.CanvasTexture */ },
  offset:   { value: new THREE.Vector2(0, 0) },  // Passerversatz, NDC
};
export function patchLambert(mat);        // hängt onBeforeCompile + cache key an
export function hullMaterial();           // die EINE geteilte Kontur-Instanz
export function addHull(mesh);            // Kontur-Kind an ein Struktur-Mesh
export function syncStyleRes(w, h);       // bei Resize: res + offset nachziehen
export function ladeStil();               // localStorage -> 0|1
export function speichereStil(v);         // 0|1 -> localStorage
```

`window.wipfelkratzer` (`js/game.js:3562`) bekommt zusätzlich:
`STYLE`, `setStil`, `stilAktiv()`, `hullOf(mesh)`.

---

## T1 — Vorarbeit: die fünf Umgeher über `L()` führen

**Dateien:** `js/game.js`, `js/models.js`

Rein mechanisch, ohne sichtbare Wirkung. Muss zuerst passieren, sonst bleiben
Boden, Bach, Fenster und Schild im Aquarell-Stil ungepatcht stehen.

**Prüfschritt zuerst (rot):** In der Browser-Konsole zählen, wie viele
Lambert-Instanzen der Szene **nicht** durch `L()` gelaufen sind. Dazu setzt
`L()` vorübergehend `mat.userData.viaL = true`; die Probe zählt
`scene.traverse` alle Lambert-Materialien ohne dieses Flag. Erwartung vor T1:
mindestens 5. Nach T1: 0.

Schritte:

1. `js/models.js:1` — `L` wird bereits exportiert? Nein: `L` ist modul-lokal.
   `export` davorsetzen, damit `game.js` es benutzen kann. Import in
   `js/game.js:5` ergänzen.
2. `js/game.js:214` — `new THREE.MeshLambertMaterial({ color: 0x8fbb6e })`
   → `L(0x8fbb6e)`.
3. `js/game.js:232-234` — `riverSandMat`/`riverWaterMat`/`riverFoamMat`
   → `L(0xc9b083)`, `L(0x5aa7c7)`, `L(0x7fc4dd)`. Die Kommentare darüber
   (eigene Instanzen wegen #50) bleiben stehen und stimmen weiterhin.
4. `js/game.js:302` — `matWin` → `L(0x6b4526)`.
5. `js/models.js:968` — `new THREE.MeshLambertMaterial({ map: tex })`
   → `L(0xffffff, { map: tex })`. **Farbe prüfen:** ohne `color` setzt three
   implizit weiss; `L` erzwingt eine Farbe, also muss hier `0xffffff` stehen,
   sonst kippt das Schild farblich.

**verify:** `python3 tools/verify_katalog.py` grün; Probe aus dem Prüfschritt
liefert 0; Screenshot vor/nach T1 ist identisch.

---

## T2 — `js/stil.js`: Papiertextur und Uniforms

**Dateien:** `js/stil.js` (neu)

**Prüfschritt zuerst:** Eine Probe, die `makePaper()` aufruft und behauptet:
`tex.image.width === 512`, `tex.wrapS === THREE.RepeatWrapping`, und die
Pixelwerte des Canvas liegen im Band 200…255 (also kein schwarzes Bild, kein
weisses).

```js
import * as THREE from 'three';

/* Der Aquarell-Stil ist eine einzige Uniform (#90). Alles, was ihn
   ausmacht, liest sie — die gepatchten Lambert-Materialien ebenso wie
   die Konturen. Umschalten heisst deshalb: eine Zahl setzen. Kein
   Rebuild, keine neue Materialinstanz, kein Nachladen. */
export const STYLE = {
  aquarell: { value: 0 },
  res: { value: new THREE.Vector2(1, 1) },
  paper: { value: null },
  offset: { value: new THREE.Vector2(0, 0) },
};

/* Papier wird gemalt, nicht geladen — das Spiel ist buildless und holt
   zur Laufzeit nichts nach. 512² reicht, weil die Textur im Screen
   Space gekachelt wird und niemand die Kachel als Muster liest. */
export function makePaper() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 232 + Math.random() * 23;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  /* Fasern: kurze Striche, hell und dunkel gemischt — das ist der
     Unterschied zwischen «Rauschen» und «Papier». */
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const a = Math.random() * Math.PI, len = 3 + Math.random() * 14;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.035)'; ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 14 + Math.random() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
STYLE.paper.value = makePaper();

/* Aus dem Prototyp unverändert übernommen, damit das Ergebnis mit ihm
   vergleichbar bleibt. */
export const GLSL_NOISE = /* glsl */`
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
             mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}`;

/* Der Passerversatz ist in Pixeln gedacht und muss deshalb bei jedem
   Resize neu in NDC umgerechnet werden. */
export function syncStyleRes(w, h) {
  STYLE.res.value.set(w, h);
  STYLE.offset.value.set((2.2 / w) * 2, (-1.6 / h) * 2);
}

const STIL_KEY = 'wipfelkratzer-stil';
/* Der Stil ist eine Vorliebe des Kindes, kein Teil eines Turms — er liegt
   deshalb ausserhalb der Stand-Schlüssel (js/staende.js:22-23) und wird
   nie in state geschrieben, das save() serialisiert. */
export function ladeStil() {
  try { return localStorage.getItem(STIL_KEY) === 'aquarell' ? 1 : 0; } catch (e) { return 0; }
}
export function speichereStil(v) {
  try { localStorage.setItem(STIL_KEY, v ? 'aquarell' : 'bilderbuch'); } catch (e) {}
}
```

**verify:** Probe aus dem Prüfschritt grün; `js/stil.js` importiert sauber
(keine Konsolenfehler beim Laden).

---

## T3 — Kontur-Material und `addHull()`

**Dateien:** `js/stil.js`

**Prüfschritt zuerst:** Probe behauptet: zweimal `hullMaterial()` aufgerufen
liefert **dieselbe** Instanz (`===`); `addHull(m)` hängt genau ein Kind an,
dessen `geometry === m.geometry` und dessen `visible === false` bei
`aquarell = 0`.

```js
/* Inverted Hull: dasselbe Mesh noch einmal, nach aussen gestülpt und von
   innen betrachtet. Der Versatz passiert im Vertex-Shader, nicht in der
   Geometrie — das Kind teilt deshalb die Geometrie seines Elters. Genau
   das löst den Fenstertausch aus #102: wer dort geometry umhängt, hängt
   die Kontur mit um (eine Zeile), statt sie neu zu bauen. */
let hullMat = null;
export function hullMaterial() {
  if (hullMat) return hullMat;
  hullMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uWidth: { value: 1.25 }, uOffset: STYLE.offset, uInk: { value: new THREE.Color(0x6e4426) } },
    vertexShader: GLSL_NOISE + /* glsl */`
      uniform float uWidth; uniform vec2 uOffset;
      void main(){
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        /* Die Tiefenskalierung (-mv.z) hält die Strichbreite auf dem
           Bildschirm konstant — sonst wird die Kontur beim Zoomen fett. */
        float wob = 0.55 + 0.9 * vnoise(position * 3.3);
        mv.xyz += n * uWidth * wob * (-mv.z) * 0.0032;
        vec4 p = projectionMatrix * mv;
        p.xy += uOffset * p.w;     /* Passerversatz */
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uInk;
      void main(){ gl_FragColor = vec4(uInk, 1.0); }`,
  });
  return hullMat;
}

/* Nur auf Struktur aufrufen, nie unter makeFurniture(): verify_katalog.py
   verwirft dort jedes Material, das kein MeshLambertMaterial ist
   (tools/verify_katalog.py:103). */
export function addHull(mesh) {
  const h = new THREE.Mesh(mesh.geometry, hullMaterial());
  h.name = 'kontur'; h.castShadow = false; h.receiveShadow = false;
  h.visible = !!STYLE.aquarell.value; h.userData.kontur = true;
  mesh.add(h);
  return h;
}
export function hullOf(mesh) { return mesh.children.find(c => c.userData && c.userData.kontur) || null; }
```

**verify:** Probe grün.

---

## T4 — `patchLambert()`: Randpigment und Papier in Lambert einhängen

**Dateien:** `js/stil.js`, `js/models.js`

### T4.0 — Chunk-Namen gegen three 0.184 prüfen (eigener Schritt, nicht überspringen)

Ein `replace()`, dessen Suchstring nicht vorkommt, ist ein **stiller**
Nulleffekt: der Shader kompiliert, sieht aber aus wie vorher. Also erst
nachsehen, dann patchen:

```js
// in der Browser-Konsole, bei geladenem Spiel
THREE.ShaderLib.lambert.fragmentShader.includes('#include <opaque_fragment>')
THREE.ShaderChunk.opaque_fragment
```

Ist `opaque_fragment` in 0.184 anders benannt, wird der tatsächlich
vorhandene, unmittelbar nach der Lichtrechnung stehende Chunk genommen —
Bedingung: Tonemapping, Farbraum und Nebel kommen **danach**. Der gewählte
Name wird im Code kommentiert.

Zusätzlich absichern: nach dem `replace()` prüfen, dass sich der String
**verändert** hat, und sonst laut werden statt still weiterzumachen.

### T4.1 — Patch schreiben

**Prüfschritt zuerst:** Probe behauptet:
- `MAT.plaster.type === 'MeshLambertMaterial'` nach dem Patch;
- `MAT.plaster.userData.stilPatch === true`;
- `MAT.plaster.customProgramCacheKey()` liefert für `aquarell = 0` und `1`
  **verschiedene** Werte;
- `matCount()` vor und nach einem Umschalten identisch.

```js
export function patchLambert(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAquarell = STYLE.aquarell;
    shader.uniforms.uRes = STYLE.res;
    shader.uniforms.uPaper = STYLE.paper;

    const marke = '#include <opaque_fragment>';   /* T4.0: gegen three 0.184 geprüft */
    const patch = marke + /* glsl */`
      if (uAquarell > 0.5) {
        vec3 col = gl_FragColor.rgb;
        vec3 nn = normalize(vNormal);
        /* Randpigment: an der Silhouette sammelt sich Farbe. Unabhängig
           vom Licht — deshalb abs(), das Vorzeichen von vViewPosition
           spielt keine Rolle. */
        float rim = 1.0 - abs(dot(nn, normalize(vViewPosition)));
        col = mix(col, col * 0.56, pow(rim, 2.4) * 1.0);
        /* Papierkorn im Screen Space. In UV gerechnet läse es sich als
           Material statt als Papier — der Bogen liegt VOR der Szene. */
        vec2 puv = gl_FragCoord.xy / uRes * 1.7;
        vec3 paper = texture2D(uPaper, puv).rgb;
        col = mix(col, col * paper, 0.85);
        gl_FragColor.rgb = col;
      }`;
    if (!shader.fragmentShader.includes(marke)) {
      console.error('Stil-Patch: Shader-Chunk', marke, 'nicht gefunden — Aquarell-Stil bleibt wirkungslos');
      return;
    }
    shader.fragmentShader =
      'uniform float uAquarell;\nuniform vec2 uRes;\nuniform sampler2D uPaper;\n'
      + shader.fragmentShader.replace(marke, patch);
  };
  /* Ohne eigenen Cache-Key teilen sich beide Stile ein Programm und der
     erste kompilierte gewinnt. Mit ihm kompiliert three genau zweimal,
     einmal pro Stil — danach ist Umschalten ein Programmwechsel, kein
     Kompilat. */
  mat.customProgramCacheKey = () => 'stil' + STYLE.aquarell.value;
  mat.userData.stilPatch = true;
  return mat;
}
```

`js/models.js:3` wird zu:

```js
import { patchLambert } from './stil.js';
const L = (c, o = {}) => patchLambert(new THREE.MeshLambertMaterial({ color: c, ...o }));
```

**Achtung Zirkelbezug:** `js/stil.js` darf `js/models.js` **nicht**
importieren. Es importiert nur `three`.

**verify:** Probe grün; `python3 tools/verify_katalog.py` grün (das ist der
kritische Lauf — `material.type` muss unverändert sein); Umschalten hin und
zurück ohne Konsolenfehler; bei `aquarell = 0` Screenshot identisch zu vor T4.

---

## T5 — Konturen auf die Struktur hängen

**Dateien:** `js/game.js`

**Prüfschritt zuerst:** Probe behauptet: bei einem Turm mit 3 Stockwerken hat
jedes Struktur-Mesh (Stockwerkskörper, Wandkern, Wandpanel, Dach, Stämme)
genau ein Kind mit `userData.kontur`, und **kein** Mesh unterhalb eines
Möbel-Gruppenknotens hat eines.

1. `addHull()` dort aufrufen, wo Struktur entsteht: `makeFloor` (Wandkern,
   Panels, Boden, Decke, `js/game.js:514-526`), das Dach, die Baumstämme, die
   Plattform. **Nicht** in `placeItemMesh` und nicht in `makeFurniture`.
2. Trefferflächen (`js/game.js:548`, `576`, `603`) überspringen — sie sind
   unsichtbar, eine Kontur darum wäre eine schwebende Box.
3. Beim Stilwechsel alle Konturen umschalten: `scene.traverse(o => { if
   (o.userData && o.userData.kontur) o.visible = !!STYLE.aquarell.value; })`.

**verify:** Probe grün; Draw-Call-Zahl (`renderer.info.render.calls`) bei
`aquarell = 1` grösser, bei `0` identisch zum Stand vor T5.

---

## T6 — Fenstertausch aus #102 mitziehen

**Dateien:** `js/game.js:374-384`

**Prüfschritt zuerst:** Probe: Stockwerk betreten (`fensterAuf(k)`), dann
behaupten `hullOf(s.kern).geometry === s.geo.kernOffen` und
`hullOf(s.panel).geometry === s.geo.panelOffen`; nach `fensterZu(k)` wieder
`kernZu`/`panelZu`.

`fensterAuf` (`js/game.js:374-378`) und `fensterZu` (`js/game.js:380-384`)
bekommen je zwei Zeilen — direkt neben der bestehenden Zuweisung, damit sie
nicht auseinanderlaufen:

```js
  s.kern.geometry = s.geo.kernOffen;
  s.panel.geometry = s.geo.panelOffen;
  /* Die Kontur teilt die Geometrie ihres Elters (#90) — beim Fenstertausch
     muss sie deshalb mitwandern, sonst steht eine Kontur ohne Loch vor der
     gelochten Wand. */
  const hk = hullOf(s.kern); if (hk) hk.geometry = s.geo.kernOffen;
  const hp = hullOf(s.panel); if (hp) hp.geometry = s.geo.panelOffen;
```

Analog in `fensterZu` mit `kernZu`/`panelZu`.

**verify:** Probe grün; im Besuchsmodus mit Aquarell zeigt der Screenshot
Konturen **um** die Fensterlöcher, nicht quer darüber.

---

## T7 — Hintergrundfarbe und Resize

**Dateien:** `js/game.js:197-201`, `:2477-2478`, `:3756`

**Prüfschritt zuerst:** Probe: bei `aquarell = 1` ist
`scene.background.getHexString() === 'fdf4e0'`; nach `setNight(true)` und
`setNight(false)` und zurück auf `aquarell = 0` ist
`scene.background.getHexString()` wieder der Ausgangswert `cfe3c2`.

1. Zweites Farbpaar neben `SKY`: `SKY_AQ = { d: 0xfdf4e0, n: <abgedunkelte
   Creme> }`.
2. `applyNight` (`js/game.js:2478`) wählt das Paar nach
   `STYLE.aquarell.value`, statt `SKY` fest zu benutzen. Ein Kommentar dazu,
   warum die Farbe nicht direkt gesetzt wird (der Nacht-Tween überschriebe
   sie, Spec E10).
3. Beim Stilwechsel `applyNight(nightK)` einmal nachrufen.
4. Resize-Handler (`js/game.js:3756`) ruft zusätzlich
   `syncStyleRes(innerWidth, innerHeight)`; einmal beim Start ebenfalls.

**verify:** Probe grün; Fenster verkleinern und vergrössern lässt Korn und
Passerversatz stabil (kein wanderndes Muster).

---

## T8 — Knopf, Persistenz, Debug-Hook

**Dateien:** `index.html:344-345`, `js/game.js`

**Prüfschritt zuerst:** Playwright: Knopf klicken → Uniform 1, Beschriftung
«Bilderbuch»; nochmal klicken → 0, «Aquarell»; `page.reload()` nach einem
Klick → Uniform steht wieder auf 1; exportierter Spielstand enthält kein
`stil`.

1. `index.html`, direkt nach `btn-season`:
   `<button id="btn-stil">Aquarell</button>`.
2. `js/game.js`:

```js
/* Der Stilwechsel ist absichtlich klein: eine Uniform, die Sichtbarkeit
   der Konturen, die Himmelsfarbe. Kein Rebuild — ein Turm mit zehn
   Stockwerken, laufenden Tweens und offenem Besuchsmodus überlebt keinen
   (#90). */
function setStil(aquarell) {
  STYLE.aquarell.value = aquarell ? 1 : 0;
  scene.traverse(o => { if (o.userData && o.userData.kontur) o.visible = !!STYLE.aquarell.value; });
  applyNight(nightK);
  speichereStil(STYLE.aquarell.value);
  $('btn-stil').textContent = STYLE.aquarell.value ? 'Bilderbuch' : 'Aquarell';
}
$('btn-stil').onclick = () => setStil(!STYLE.aquarell.value);
setStil(ladeStil());
```

3. `window.wipfelkratzer` (`js/game.js:3562`) um `STYLE`, `setStil`,
   `hullOf` erweitern.

**verify:** Playwright-Probe grün.

---

## T9 — `tools/verify_stil.py`

**Dateien:** `tools/verify_stil.py` (neu)

Nach dem Muster von `tools/verify_katalog.py`: `http.server` starten,
Playwright Chromium, Konsolenfehler sammeln, `check()`-Helfer. Prüft die
maschinellen Akzeptanzkriterien der Spec:

1. Uniform kippt beim Klick, Beschriftung folgt.
2. `matCount()` vor/nach identisch.
3. Kein Möbel-Mesh mit `type !== 'MeshLambertMaterial'` oder mit `map`.
4. Keine Console-Errors beim Hin- und Herschalten.
5. `scene.background`/`fog.color`/`MAT`-Hex nach Rückschalten identisch.
6. Reload behält den Stil; Spielstand enthält kein `stil`.
7. Frame-Zeit: 60 Frames in beiden Stilen messen, Aquarell ≤ 1.4 ×
   Bilderbuch. **Im selben Lauf gegen den eigenen Vorher-Wert**, nicht gegen
   eine absolute fps-Zahl — ein Headless-Renderer zeichnet unter 1 fps.
8. Besuchsmodus: Kontur-Geometrie folgt `fensterAuf`/`fensterZu`.

**verify:** `python3 tools/verify_stil.py` grün, **im Vordergrund** gestartet,
mit grosszügigem Timeout. `python3 tools/verify_katalog.py` ebenfalls grün.

---

## T10 — Doku

**Dateien:** `docs/design-handoff.md:15`, `CHANGELOG.md`

1. `docs/design-handoff.md:15` — die Zeile «`MeshLambertMaterial` only (no PBR,
   no metalness/roughness) — flat, illustrative shading» um einen Zusatz
   ergänzen: es gibt seit #90 einen **zweiten**, zur Laufzeit wählbaren Stil;
   er bleibt `MeshLambertMaterial` und patcht nur den Fragment-Shader, die
   Regel gilt unverändert. Ohne diesen Zusatz revertiert die nächste
   Agent-Session die Arbeit als Regelverstoss.
2. `CHANGELOG.md` unter `[Unreleased]` → `### Added`, in Spielersprache:
   «Neuer Knopf **Aquarell**: Der ganze Wald sieht auf Knopfdruck aus wie
   gemalt — mit Tuschelinien, Papierkorn und dunklen Rändern. Nochmal drücken,
   und alles ist wieder wie vorher.» Die Datei **niemals** mit `git cliff -o`
   neu erzeugen (`CLAUDE.md`, «Changelog»).
3. Vier Folge-Issues anlegen: Wash, Geometrie-Jitter, gemalter Hintergrund,
   Konturen auf Möbeln.

**verify:** `CHANGELOG.md` enthält den Eintrag; frühere Releases unverändert.

---

## Abnahme

1. Branch committen und **pushen**, erst danach prüfen.
2. `python3 tools/verify_katalog.py` — grün, Vordergrund.
3. `python3 tools/verify_stil.py` — grün, Vordergrund.
4. **Screenshot-Paar** an den PR: derselbe Turm in beiden Stilen, gleiche
   Kamera, plus je eines aus dem Besuchsmodus.
5. **Menschliche Sichtprüfung ist geschuldet und ersetzt keine Probe.** Kein
   Prüflauf kann sagen, ob es wie ein Bilderbuch aussieht. Er sagt nur: die
   Uniform kippt, der Materialtyp bleibt, nichts kracht, die Bildrate hält.
   Über `uWidth`, `uEdge`, `uGrain` und über das Mergen entscheidet der Mensch
   am Bild.

Wenn Du unterwegs auf Blocker stösst, löse sie und schreibe die Lösung in
diesen Plan bzw. in `CLAUDE.md` zurück, damit der nächste Lauf sie nicht neu
herleiten muss.
