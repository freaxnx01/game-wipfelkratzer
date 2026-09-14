# Spec — Möbeldesigner / Schreinerei (Issue #43)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:490-560`).

Quelle: Feedback-Triage 12.09.2026, Eintrag 14
(`docs/ai-notes/feedback/2026-09-12-test-mit-tochter.md:31`).

## Problem

Gewünscht ist, Möbel nicht nur auszuwählen, sondern **selbst zu entwerfen**.

Heute ist jedes Möbel eine fest programmierte, parameterlose Funktion in `FURN`
(`js/models.js:65-248`); `makeFurniture(id)` (`js/models.js:309`) schlägt sie
über eine id nach:

```js
export function makeFurniture(id) { const g = FURN[id](); g.userData.itemId = id; return g; }
```

Der Spielstand speichert entsprechend nur diese id plus Lage: ein Eintrag in
`state.rooms[k]` ist `{ id, cell, x, z, y, rot }`, bei Wandobjekten zusätzlich
`wall` (`js/game.js:680-712`, `js/game.js:427-446`). Ein selbstgebautes Möbel
hat keine id mehr, sondern ist eine **Beschreibung** — damit bricht die
Annahme, auf der `placeItemMesh` (`js/game.js:447-470`), der Katalog
(`js/game.js:598-603`) und die Thumbnails (`js/game.js:528-545`) aufsetzen.

### Die eigentliche Entscheidung: wie tief geht der Bausatz?

Die Spanne reicht von «Farbe und Grösse wählen» bis «Klötze frei im Raum
stapeln». Sie entscheidet den ganzen Aufwand:

| Tiefe | Was das Kind tut | Was es kostet |
| --- | --- | --- |
| Farbe wählen | tippt einen Farbpunkt | Issue #34, bereits enrichet |
| Farbe + Grösse | zwei Regler an einem festen Modell | kleiner Ausbau von #34, kaum «entwerfen» |
| **Teile stapeln** | **setzt 1–5 Bauteile aufeinander, je Form, Breite, Farbe** | **ein Bausatz, ein Bauplan im Spielstand, eine Werkstatt-Oberfläche** |
| Klötze frei setzen | platziert Klötze in drei Achsen, dreht sie | dazu: Kollisionsprüfung, Schwerkraft/Schweben, 3D-Editor-Kamera, Undo — ein eigenes Spiel im Spiel |

Gewählt ist die dritte Stufe, und zwar **eng**: ein Möbel ist ein **senkrechter
Stapel** aus höchstens fünf Teilen, jedes Teil auf dem darunter. Kein Versatz,
keine Drehung, keine Überhänge. Damit kann per Konstruktion nichts schweben,
nichts sich durchdringen und nichts über die Decke ragen — die gesamte
Geometrieprüfung entfällt, die ein freier Editor nötig machen würde. Was bleibt,
ist trotzdem echtes Entwerfen: Form, Breite und Farbe je Etage ergeben aus
5 Formen × 3 Breiten × 6 Farben schon bei drei Teilen mehr als 700 000
Kombinationen.

### Verhältnis zu #34 (Möbelfarbe)

**#34 ist die Vorstufe, #43 der Ausbau — und zwar technisch, nicht nur
begrifflich.** #34 legt `FURN_COLORS` an: eine Palette aus sechs bestehenden
`MAT`-Instanzen, die als Parameter ins Modell gereicht wird, ohne neue
Materialien zu erzeugen (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`,
Abschnitt 1). Genau diese Palette ist die Farbwahl je Bauteil. Ohne #34 müsste
#43 sie selbst anlegen — dieselbe Liste zweimal, mit der Garantie, dass sie
auseinanderläuft.

Deshalb: **#34 wird vor #43 umgesetzt.** #43 importiert `FURN_COLORS` und legt
keine eigene Palette an. Zweitens erbt #43 auch das Muster für den Spielstand
aus #34: ein optionales Feld am Eintrag, das alte Stände schlicht nicht haben,
plus eine Normalisierung beim Laden nach dem Vorbild von `normalizeColor`
(Spec #34 Abschnitt 3) und der Tapeten-Migration (`js/game.js:379-390`).

### Abgrenzung gegen #51 (Walddorf)

Mit #51 bekommt die Schreinerei einen **Ort** im Walddorf. Dieses Issue bleibt
der **Designer selbst**: eine Werkstatt-Oberfläche, die aus dem Katalog heraus
aufgeht. Kein Ort, keine Karte, kein Weg dorthin, keine Werkbank in der Welt,
kein Material, keine Kosten, kein Willi, der mitbaut. Das gehört ins Walddorf.

## Goals

- Das Kind baut aus höchstens fünf Bauteilen ein eigenes Möbel und stellt es
  in eine Wohnung.
- Ein Bauteil hat genau drei Eigenschaften: **Form**, **Breite**, **Farbe**.
- Eigene Entwürfe werden gespeichert (höchstens sechs) und stehen im Katalog
  unter einem eigenen Tab «Schreinerei» mit Vorschaubild bereit.
- Ein platziertes Eigenbau-Möbel verhält sich wie jedes andere: verschieben,
  drehen, löschen, Spielstand, Neuladen.
- **Alte Spielstände laden unverändert**, und ein Stand mit kaputtem oder
  unbekanntem Bauplan lädt ebenfalls — der betroffene Eintrag verschwindet
  still, statt das Laden abzubrechen.
- Der Bilderbuch-Look bleibt: nur `MeshLambertMaterial`, nur `box`/`cyl`,
  Farben ausschliesslich aus `FURN_COLORS` (#34).

## Non-goals

- **Kein freier 3D-Editor.** Kein Versatz in x/z, keine Drehung einzelner
  Teile, keine Überhänge, kein Löschen aus der Mitte des Stapels ausser über
  «Teil weg» von oben (A2).
- **Keine eigene Farbpalette.** `FURN_COLORS` aus #34 ist die Farbwahl (A1).
- **Keine freie Grösseneingabe.** Drei Breitenstufen, keine Regler, keine
  Zahlenfelder (A4).
- **Kein Ort, keine Werkbank in der Welt, kein Material, keine Kosten** — das
  ist #51.
- **Kein Umbauen eines bereits platzierten Möbels.** Der Bauplan wird in der
  Werkstatt geändert; platzierte Stücke behalten ihren Stand (A6).
- Kein Texteingabefeld für Namen — die Entwürfe heissen «Eigenbau 1» bis
  «Eigenbau 6» (A8).
- Kein Teilen, kein Export, kein Import von Bauplänen.
- Eigenbau-Möbel erfüllen **keine** Bewohnerwünsche (A9) und sind **keine**
  Ablagefläche für Deko (A10).
- Keine Änderung an bestehenden `FURN`-Modellen, an `CATALOG` oder an der
  Möbelfarbe aus #34.

## Design

### 1. Der Bausatz

Fünf Formen und drei Breiten, beide als exportierte Tabellen in
`js/models.js`. Die Höhe gehört zur Form, die Tiefe wird aus der Breite
abgeleitet — so hat das Kind nur einen Grössenknopf statt zwei.

```js
/* Bausteine der Schreinerei. Ein Eigenbau-Möbel ist ein senkrechter Stapel aus
   höchstens BUILD_MAX solchen Teilen; jedes sitzt auf dem darunter. Kein
   Versatz, keine Drehung — dadurch kann nichts schweben und nichts sich
   durchdringen, und es braucht keine Kollisionsprüfung. */
export const BUILD_SHAPES = [
  { id: 'platte', name: 'Platte', h: 0.06, dz: 1.00 },
  { id: 'klotz',  name: 'Klotz',  h: 0.34, dz: 1.00 },
  { id: 'kiste',  name: 'Kiste',  h: 0.46, dz: 1.00, open: true },
  { id: 'saeule', name: 'Säule',  h: 0.50, dz: 0.45, round: true },
  { id: 'dach',   name: 'Dach',   h: 0.26, dz: 1.00, taper: true },
];
export const BUILD_WIDTHS = [
  { id: 'schmal', name: 'Schmal', w: 0.34 },
  { id: 'mittel', name: 'Mittel', w: 0.60 },
  { id: 'breit',  name: 'Breit',  w: 0.86 },
];
export const BUILD_MAX = 5;     /* Teile pro Möbel */
export const BUILD_MAX_H = 1.5; /* Gesamthöhe; darüber passt es nicht unter die Decke */
export const DESIGN_MAX = 6;    /* gespeicherte Entwürfe */
```

`BUILD_MAX_H = 1.5` liegt unter der Raumhöhe `FLOOR_H = 2.0` (`js/game.js:6`)
und unter der Ablagegrenze `ly < 1.8` in `surfaceYAt` (`js/game.js:425`).

### 2. Der Bauplan und sein Renderer

Ein Bauplan ist reines JSON und enthält keine Masse, nur ids — dieselbe
Entscheidung wie in #34 (A4 dort): ids lassen sich später umdefinieren, Masse
im Spielstand nicht.

```js
{ parts: [ { shape: 'kiste', width: 'mittel', color: 'rosa' },
           { shape: 'platte', width: 'breit',  color: 'creme' } ] }
```

`makeCustomFurniture(build)` baut daraus die Gruppe. Sie ist die einzige neue
Modellfunktion und stapelt von unten nach oben:

```js
/* Baut ein Eigenbau-Möbel aus seinem Bauplan. Unbekannte ids fallen auf den
   ersten Eintrag der jeweiligen Tabelle zurück, damit ein alter oder von Hand
   veränderter Spielstand nie einen leeren Raum erzeugt. */
export function makeCustomFurniture(build) {
  const g = G(); let y = 0;
  (normalizeBuild(build) || { parts: [] }).parts.forEach(p => {
    const sh = BUILD_SHAPES.find(s => s.id === p.shape) || BUILD_SHAPES[0];
    const wd = BUILD_WIDTHS.find(w => w.id === p.width) || BUILD_WIDTHS[1];
    const col = FURN_COLORS.find(c => c.id === p.color);
    const mat = col ? MAT[col.mat] : MAT.wood;          /* nur bestehende MAT-Instanzen */
    const w = wd.w, d = w * sh.dz;
    if (sh.round) cyl(g, w / 2, w / 2, sh.h, mat, 0, y + sh.h / 2, 0, 16);
    else if (sh.taper) mesh(new THREE.ConeGeometry(w * 0.72, sh.h, 4), mat, 0, y + sh.h / 2, 0, g).rotation.y = Math.PI / 4;
    else if (sh.open) {
      box(g, w, 0.05, d, mat, 0, y + 0.025);
      [-1, 1].forEach(s => box(g, 0.05, sh.h - 0.05, d, mat, s * (w / 2 - 0.025), y + 0.025 + (sh.h - 0.05) / 2));
      [-1, 1].forEach(s => box(g, w - 0.1, sh.h - 0.05, 0.05, mat, 0, y + 0.025 + (sh.h - 0.05) / 2, s * (d / 2 - 0.025)));
    } else box(g, w, sh.h, d, mat, 0, y + sh.h / 2);
    y += sh.h;
  });
  g.userData.itemId = 'eigenbau';
  g.userData.build = build;
  return g;
}
```

`g.userData.itemId = 'eigenbau'` hält die Zusage von `makeFurniture`
(`js/models.js:309`) aufrecht, auf die `surfaceYAt` und `freeCell` über
`m.userData.pick.entry.id` zugreifen (`js/game.js:420, 467`) — dort steht die
id aus dem Eintrag, nicht aus `userData`, aber die beiden dürfen nicht
auseinanderlaufen.

### 3. Normalisierung — ein Bauplan ist Fremdeingabe

`normalizeBuild` ist die einzige Stelle, die einen Bauplan für gültig erklärt.
Sie läuft beim Laden, beim Rendern und beim Speichern, ist reine Funktion und
gibt entweder einen bereinigten Bauplan zurück oder `null`:

```js
/* Macht aus einem beliebigen Objekt einen gültigen Bauplan oder null. Ein
   Spielstand ist Fremdeingabe: er kann von Hand verändert, aus einer älteren
   Version oder aus einer späteren Palette stammen. */
export function normalizeBuild(build) {
  const src = build && Array.isArray(build.parts) ? build.parts : null;
  if (!src) return null;
  const parts = []; let h = 0;
  for (const p of src) {
    if (parts.length >= BUILD_MAX) break;
    const sh = BUILD_SHAPES.find(s => s.id === p?.shape);
    const wd = BUILD_WIDTHS.find(w => w.id === p?.width);
    if (!sh || !wd) continue;                                  /* unbekannte Form/Breite: Teil fällt weg */
    if (h + sh.h > BUILD_MAX_H) break;                         /* über der Decke: Stapel endet hier */
    const col = FURN_COLORS.find(c => c.id === p.color);
    parts.push({ shape: sh.id, width: wd.id, color: col ? col.id : FURN_COLORS[0].id });
    h += sh.h;
  }
  return parts.length ? { parts } : null;
}
```

### 4. Spielstand

Zwei Änderungen, beide additiv:

1. **`state.designs`** — die gespeicherten Baupläne, ein Array von
   `{ name, parts }`, höchstens `DESIGN_MAX`. Der Default im
   Zustands-Literal (`js/game.js:35`) ist `[]`; ein alter Stand ohne das Feld
   bekommt es durch `Object.assign` (`js/game.js:36`) automatisch.
2. **Der Raum-Eintrag** bekommt für Eigenbauten `id: 'eigenbau'` und ein Feld
   `build` mit dem Bauplan — **als Kopie, nicht als Verweis** (A6):

```js
{ id: 'eigenbau', build: { parts: [...] }, cell: 2, x: -0.4, z: 0.6, rot: 0, y: 0.155 }
```

Beim Laden (`js/game.js:1177-1184`) wird jeder Raum durchgesehen: ein Eintrag
mit `id === 'eigenbau'`, dessen `normalizeBuild(entry.build)` `null` ergibt,
fällt aus dem Raum und setzt `migrated = true` — derselbe Mechanismus, mit dem
die Tapeten-Migration den bereinigten Stand einmalig zurückschreibt
(`js/game.js:384, 1186`). Ein Eintrag, den `normalizeBuild` kürzt, wird durch
den bereinigten Bauplan ersetzt.

`placeItemMesh` (`js/game.js:447`) bekommt genau eine Verzweigung:

```js
  const m = entry.id === 'eigenbau' ? makeCustomFurniture(entry.build) : makeFurniture(entry.id);
```

Alles Weitere — Position, `userData.pick`, `itemMeshes`, `clampEntry`,
Verschieben, Drehen, Löschen — läuft unverändert über den bestehenden Pfad, weil
es nur mit der Bounding-Box arbeitet (`js/game.js:437-446`).

### 5. Der Katalog-Tab «Schreinerei»

`CATS` (`js/models.js:271`) bekommt `['eigenbau', 'Schreinerei']`, eingereiht
nach «Möbel». Der Tab zeigt:

- eine Kachel **«Neu bauen»** (`+`), die die Werkstatt öffnet;
- je gespeichertem Entwurf eine Kachel mit Vorschaubild und Namen, die ihn
  platziert — genau wie eine Katalogkachel (`js/game.js:598-603`);
- auf jeder Entwurfskachel ein kleines **×** zum Löschen des Entwurfs (nicht
  der platzierten Möbel, A6), mit Rückfrage über `toast` (A7).

Weil `renderCatalog` die Kacheln aus `CATALOG` speist (`js/game.js:598`), ist
dieser Tab ein eigener Zweig neben den bestehenden Sonderzweigen für `farbe`,
`boden` und `wand` (`js/game.js:562-596`).

### 6. Thumbnails: der Renderer muss überleben

`makeThumbs` (`js/game.js:528-545`) erzeugt heute alle Vorschaubilder einmalig
beim Start und wirft den Renderer danach weg (`r2.dispose()`,
`js/game.js:544`). Ein Entwurf entsteht aber zur Laufzeit und braucht sein Bild
sofort — in der Werkstatt sogar nach jedem Tipp.

Deshalb wird die innere Funktion `snap` zu einem Modul-Helfer
`snapshot(obj, fx, fy, fz)` mit **faul angelegtem, dauerhaftem** Renderer;
`makeThumbs` benutzt ihn und ruft `dispose()` nicht mehr. Darauf setzt:

```js
/* Vorschaubild eines Bauplans. Gecacht über den Bauplan selbst — in der
   Werkstatt ändert sich pro Tipp genau ein Feld, und der Cache trägt die
   Vorschau der vorherigen Zustände ohne Neurendern. */
const designThumbs = new Map();
function designThumb(build) {
  const key = JSON.stringify(build);
  if (!designThumbs.has(key)) designThumbs.set(key, snapshot(makeCustomFurniture(build), 1.15, 0.85, 1.35));
  return designThumbs.get(key);
}
```

### 7. Die Werkstatt

Ein Overlay `#workshop` nach dem Muster von `#gallery` / `#residents`
(`index.html:96-98, 84-85, 224`): `position: fixed; inset: 0`, halbtransparenter
Hintergrund, eine `.panel` in der Mitte.

Aufbau von oben nach unten:

1. **Vorschau** — ein `<img>`, gefüllt aus `designThumb(build)`, aktualisiert
   nach jeder Änderung.
2. **Der Stapel** — bis zu fünf Zeilen, oberstes Teil zuoberst. Jede Zeile ist
   ein Knopf (mindestens 44 px hoch) und zeigt Form, Breite und Farbpunkt; die
   angetippte Zeile ist das **aktive Teil**.
3. **Drei Knopfreihen für das aktive Teil**: Form (5), Breite (3), Farbe (6 aus
   `FURN_COLORS`, als runde Punkte wie in #34 Abschnitt 4). Alle mindestens
   44 × 44 px.
4. **«Teil dazu»** (fügt oben eine Kopie des aktiven Teils an; gesperrt bei
   `BUILD_MAX` oder wenn die Höhe reissen würde) und **«Teil weg»** (entfernt
   das aktive Teil; gesperrt beim letzten Teil).
5. **«Fertig»** speichert den Entwurf in `state.designs` und schliesst;
   **«Abbrechen»** verwirft.

Ein neuer Entwurf startet mit einem Teil: `klotz` / `mittel` / erste Farbe der
Palette. So ist die Vorschau nie leer.

Eine Werkstatt, die bei vollem `state.designs` (`DESIGN_MAX`) geöffnet wird,
meldet über `toast` (`js/game.js:500`), dass zuerst ein Entwurf weichen muss —
sie öffnet gar nicht erst.

## Assumptions

- **A1** [high] #34 ist harte Voraussetzung und wird **vorher** umgesetzt; #43
  importiert `FURN_COLORS` und legt keine eigene Palette an. Verworfen: (a) eine
  zweite Palette in #43 — dieselbe Liste zweimal, die garantiert auseinanderläuft
  und im Spielstand zwei Bedeutungen desselben Farbnamens erzeugt; (b) freie
  Hexfarben im Bauplan — bricht den Bilderbuch-Look, den #34 ausdrücklich
  schützt (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`, Non-goals).
- **A2** [high] Ein Eigenbau ist ein **senkrechter Stapel ohne Versatz und
  ohne Drehung**. Verworfen: (a) freies Setzen in drei Achsen — verlangt
  Kollisionsprüfung, Schwebe-Erkennung, eine eigene Editor-Kamera und Undo,
  also ein zweites Spiel neben dem Einrichten; (b) Versatz nur in x — schon
  das erzeugt Überhänge, die kippen müssten oder schweben, und damit genau die
  Physikfrage, die der Stapel vermeidet.
- **A3** [med] Höchstens **fünf** Teile und höchstens 1.5 Höhe. Verworfen:
  (a) unbegrenzt stapeln — ein Turm aus zwanzig Klötzen wächst durch die Decke
  (`FLOOR_H = 2.0`, `js/game.js:6`) und sprengt die Zellengrösse
  (`js/game.js:357`); (b) drei Teile — zu wenig für ein erkennbares Möbel
  (Fuss, Korpus, Deckel wären schon die ganze Freiheit).
- **A4** [med] Ein Teil hat genau drei Eigenschaften: Form, Breite, Farbe. Die
  Tiefe folgt aus der Breite (`dz` je Form), die Höhe gehört zur Form.
  Verworfen: Höhe und Tiefe einzeln wählbar — fünf Knopfreihen statt drei, und
  ein Kind am Tablet verliert den Überblick; ausserdem lassen sich damit
  Proportionen bauen, die nicht mehr wie Möbel aussehen.
- **A5** [med] Der Bauplan speichert **ids**, keine Masse. Verworfen: Masse
  direkt speichern — dann liesse sich ein Stand von Hand auf beliebige Grössen
  setzen, und die Tabellen wären später nicht mehr änderbar, ohne alte Stände
  zu brechen (dieselbe Begründung wie #34 A4).
- **A6** [med] Der Bauplan wird beim Platzieren **kopiert**; ein späteres
  Ändern oder Löschen des Entwurfs lässt bereits platzierte Möbel unberührt.
  Verworfen: den Eintrag per Index oder Namen auf `state.designs` verweisen
  lassen — ein gelöschter Entwurf hinterlässt dann leere Stellen in
  Wohnungen, und das Umbauen eines Entwurfs verändert rückwirkend eingerichtete
  Zimmer, ohne dass das Kind im Raum steht.
- **A7** [low] Höchstens **sechs** gespeicherte Entwürfe, Löschen über ein ×
  auf der Kachel mit Rückfrage. Verworfen: unbegrenzt viele — der
  Katalog-Tab wird zur Scrollwand, und `localStorage` trägt bereits die Fotos
  (`js/game.js:1137-1138`), die dort der eigentliche Platzfresser sind.
- **A8** [low] Entwürfe heissen automatisch «Eigenbau 1» … «Eigenbau 6», ohne
  Texteingabe. Verworfen: ein Namensfeld — eine Bildschirmtastatur über dem
  3D-Bild auf dem Tablet, für eine Zeile, die nur unter der Kachel steht.
- **A9** [low] Ein Eigenbau erfüllt **keinen** Bewohnerwunsch. Verworfen: einen
  Eigenbau als Wunscherfüllung zählen, wenn er «ungefähr» wie ein Sofa
  aussieht — es gibt kein Kriterium dafür, das nicht willkürlich ist, und ein
  Stapel aus fünf Platten würde jeden Wunsch erfüllen.
- **A10** [low] Ein Eigenbau ist keine Ablagefläche: `SURFACES`
  (`js/game.js:429`) bleibt unverändert, Deko sucht sich also weiterhin
  Tisch, Regal, Schrank, Klavier oder Nusskiste. Verworfen: `eigenbau`
  aufnehmen — dann landet die Teekanne auch auf der Spitze eines Dachteils
  oder einer Säule.
- **A11** [low] Die Werkstatt ist ein Overlay im Katalog-Tab «Schreinerei»,
  kein Ort in der Welt. Verworfen: eine Werkbank im Erdgeschoss — das ist die
  Ortsfrage aus #51, und ohne Walddorf hätte sie keinen sinnvollen Platz.
- **A12** [med] `makeThumbs` behält seinen Renderer statt ihn zu verwerfen
  (`js/game.js:544`). Verworfen: für jedes Vorschaubild einen eigenen
  `WebGLRenderer` anlegen und wieder verwerfen — Browser begrenzen die Zahl
  gleichzeitiger WebGL-Kontexte hart, und die Werkstatt rendert bei jedem Tipp
  neu.

## Consequences

- **`makeFurniture` bleibt unverändert**, bekommt aber eine Schwester:
  ab jetzt gibt es zwei Wege, ein Möbel-Mesh zu erzeugen. Wer künftig etwas an
  `placeItemMesh` ändert, muss beide bedenken.
- **Der Spielstand wächst spürbar pro Eigenbau**: statt einer kurzen id steht
  ein Bauplan mit bis zu fünf Objekten im Eintrag — grob 200 Bytes gegenüber
  20. Bei zehn Eigenbauten im Turm sind das ~2 KB, neben den Fotos
  (`js/game.js:1137`) unerheblich.
- **Ein zweiter, dauerhafter WebGL-Renderer** lebt ab jetzt neben dem
  Hauptrenderer (A12) — ein Kontext mehr, dafür keine Kontext-Wechsel.
- **Der Katalog bekommt einen achten Tab.** Die Tab-Leiste bricht auf schmalen
  Viewports schon heute um (`index.html:58`); mit «Schreinerei» wird die
  zweite Zeile zur Regel statt zur Ausnahme.
- **Eigenbauten stehen ausserhalb aller Sonderlisten** (`DECO`, `WALL_ITEMS`,
  `SURFACES`, Wünsche). Sie sind immer Bodenmöbel — ein Kind kann keinen
  eigenen Wandschmuck bauen, und das wird auffallen.
- **Der Stapel ist eine sichtbare Grenze.** Ein Tisch mit vier Beinen lässt
  sich nicht bauen; ein Kind, das es versucht, landet bei Säule + Platte. Das
  ist der bewusste Preis von A2 und der erste Punkt, an dem Rückmeldung aus
  dem echten Spiel gebraucht wird, bevor mehr Freiheit dazukommt.
- **`state.designs` ist ein neues Feld im Spielstand**, das keine Migration
  braucht, aber ab jetzt mitgeschrieben wird — auch von Ständen, die nie einen
  Entwurf hatten (als leeres Array).
- **Ein bereinigter Bauplan verändert ein Möbel sichtbar**: fällt später eine
  Form aus `BUILD_SHAPES`, wird das betroffene Teil beim nächsten Laden still
  aus dem Stapel genommen und das Möbel ist niedriger. Das ist verlustbehaftet,
  aber es lädt.

## Acceptance Criteria

- [ ] Der Katalog zeigt beim Einrichten einer Wohnung einen Tab «Schreinerei»;
      auf der Dachterrasse erscheint er nicht (dort gilt nur «Dach»).
- [ ] Der Tab enthält eine Kachel «Neu bauen»; ein Tipp darauf öffnet die
      Werkstatt mit einem Teil im Stapel und einer nicht leeren Vorschau.
- [ ] In der Werkstatt ändern Form, Breite und Farbe des aktiven Teils die
      Vorschau sichtbar; jede Trefferfläche ist mindestens 44 × 44 px gross.
- [ ] «Teil dazu» fügt ein Teil hinzu, bis fünf Teile erreicht sind oder die
      Gesamthöhe 1.5 überschreiten würde; danach ist der Knopf gesperrt.
- [ ] «Teil weg» entfernt das aktive Teil; beim letzten verbleibenden Teil ist
      der Knopf gesperrt.
- [ ] «Fertig» speichert den Entwurf: er erscheint als Kachel im Tab
      «Schreinerei» mit Vorschaubild und dem Namen «Eigenbau 1».
- [ ] «Abbrechen» schliesst die Werkstatt, ohne dass ein Entwurf entsteht.
- [ ] Ein Tipp auf eine Entwurfskachel stellt das Möbel in die Wohnung; es ist
      danach ausgewählt und lässt sich verschieben, drehen und löschen.
- [ ] Zwei verschiedene Entwürfe stehen gleichzeitig in derselben Wohnung und
      sehen unterschiedlich aus.
- [ ] Nach Neuladen der Seite stehen beide Eigenbauten unverändert an
      derselben Stelle und sehen gleich aus wie vorher.
- [ ] Ein platzierter Eigenbau bleibt unverändert, nachdem sein Entwurf in der
      Werkstatt gelöscht wurde.
- [ ] Es lassen sich höchstens sechs Entwürfe speichern; beim siebten erscheint
      eine Meldung statt der Werkstatt.
- [ ] **Ein Spielstand ohne `designs` und ohne `eigenbau`-Einträge (alte
      Struktur) lädt fehlerfrei; jedes Möbel darin sieht exakt so aus wie vor
      der Änderung, und es erscheint keine Fehlermeldung in der Konsole.**
- [ ] Ein Spielstand mit einem `eigenbau`-Eintrag ohne `build`, mit
      `build: {}` oder mit unbekannten Form-ids lädt fehlerfrei: der Eintrag
      verschwindet bzw. wird gekürzt, und der bereinigte Stand wird einmalig
      zurückgeschrieben.
- [ ] Ein Bauplan mit acht Teilen lädt und zeigt höchstens fünf davon; die
      Gesamthöhe des Möbels bleibt unter 1.5.
- [ ] Alle Materialien eines Eigenbaus sind `MeshLambertMaterial`-Instanzen aus
      `MAT`; es wird keine neue erzeugt und keine mutiert.
- [ ] Die Anzahl `MeshLambertMaterial`-Instanzen in der Szene ist nach dem
      Platzieren von fünf Eigenbauten unverändert gegenüber vorher.
- [ ] Ein Eigenbau erfüllt keinen Bewohnerwunsch, und Deko legt sich nicht auf
      ihm ab.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
- [ ] `version.js` ist unverändert; es gibt keinen `chore(release)`-Commit.
