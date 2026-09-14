# Spec — Terrassenhäuschen mit grünem Schilfdach (Issue #49)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:508-516`).

Quelle: Feedback-Triage 12.09.2026, Eintrag 25 — Block C. Vorlage ist dieselbe
Buchseite wie beim Pool (#12):
`docs/ai-notes/feedback/assets/2026-09-12-test-mit-tochter/entry-04-buchseite-dachterrasse.png`.

Der Entwurf des Modells stammt aus einem eigenen Design-Durchgang mit **Fable**
— so hatte die Triage es für diesen rein visuell getriebenen Eintrag
entschieden. Alle Masse unten sind an einem lauffähigen three.js-Aufbau
nachgemessen (`Box3.setFromObject`), nicht geschätzt.

## Problem

Die Dachterrasse kennt heute vier Objekte: `pool`, `liegestuhl`,
`sonnenschirm`, `lampion` (`js/models.js:265-266`). Auf der Buchseite steht
daneben, deutlich prominenter, ein **kleines Häuschen mit grossem grünem
Schilfdach**: ockerfarbene Putzwände, ein weit überstehendes Satteldach aus
grünen Halmbündeln, vorne eine rundbogige Türöffnung ohne Tür, seitlich ein
kleines rundbogiges Fenster, und ein Frosch, der aus der Tür lugt.

Drei Dinge machen das nicht trivial:

1. **Es ist gross.** Der Pool misst rund 1.49 × 0.96 (`POOL_OUTLINE`
   `js/models.js:26`, plus Randversatz und Leiter, `js/models.js:214-223`), der
   Liegestuhl rund 0.51 × 0.72 (`js/models.js:225-239`). Ein Häuschen ist ein
   Vielfaches davon — und die Terrasse misst nur `ROOF_W × ROOF_D` = 6.6 × 4.8
   (`js/game.js:12`).
2. **`clampEntry` hält die Treppenöffnung frei.** Seit #20 gibt es für
   `k === 'roof'` eine Sonderregel (`js/game.js:443-445`): ein Objekt, dessen
   Bounding-Box in den +x-Streifen jenseits von `ROOF_GAP_X0` ragt, wird in z
   aus dem Ankunftspodest der Aussentreppe herausgeschoben. Je grösser das
   Objekt, desto öfter greift das.
3. **Das Schilfdach ist die eigentliche Aufgabe.** «Grün, strohig» muss im Stil
   «nur `MeshLambertMaterial`, klobige Primitive» entstehen — ohne Textur, ohne
   Alphamaske, ohne tausend einzelne Halme.

## Passt es überhaupt auf die Terrasse? — nachgerechnet

Die Bounding-Box des Entwurfs ist **2.40 (x) × 2.002 (y) × 2.05 (z)**, also
`hx = 1.20`, `hz = 1.025`. Eingesetzt in `clampEntry` (`js/game.js:436-446`)
mit den echten Konstanten aus `js/game.js:12, 176, 174-175`:

```
limX = ROOF_W/2 - 0.1 = 3.2          limZ = ROOF_D/2 - 0.1 = 2.3
en.x ∈ [-(limX - hx), limX - hx]  =  [-2.00,  2.00]
en.z ∈ [-(limZ - hz), limZ - hz]  =  [-1.275, 1.275]

Treppenregel (js/game.js:443-445):
  ROOF_GAP_X0 = ROOF_W/2 - 0.9 = 2.4
  greift, sobald en.x + hx > 2.4,  also ab en.x > 1.20
  dann: en.z ≤ (ROOF_PAD_Z0 - 0.3) - hz = (1.4 - 0.3) - 1.025 = 0.075
```

Das Ergebnis ist **kein Grenzfall, sondern komfortabel**:

- Für `en.x ∈ [-2.00, 1.20]` — also auf 3.2 der 4.0 Einheiten breiten
  Stellfläche — ist der volle z-Bereich frei.
- Nur im rechten Streifen (`en.x > 1.20`, 0.8 Einheiten breit) wird das
  Häuschen in die hintere Hälfte gedrückt. Es bleibt dort platzierbar, es rutscht
  nur von der Treppe weg.
- Die Grundfläche beträgt 2.40 × 2.05 = 4.92 von 31.68 Quadrateinheiten, also
  **rund 16 % der Terrasse**. Das ist etwa das 3.4-fache des Pools — spürbar,
  aber Pool und Häuschen passen nebeneinander, wenn der Pool in die andere
  Hälfte rückt.

Auch die automatische Erstplatzierung stimmt: `freeCell` liefert in einer
leeren Terrasse Zelle 0, `cellPos('roof', 0)` (`js/game.js:358-362`, mit
`dims('roof') = {w: 5.9, d: 3.9}`, `colsOf('roof') = 6`) ergibt
`x = -2.458, z = -0.975`; `clampEntry` zieht `x` auf −2.00. Das Häuschen landet
in der hinteren linken Ecke, weit weg vom Treppendurchgang, und verdeckt weder
Fahne (`js/game.js:316-317`) noch Aufgang.

## Kann man hinein? — nein, und das ist eine Entscheidung, keine Lücke

**Das Häuschen ist ein reines Objekt.** Man kann hineinschauen, aber nicht
hineingehen. Drei Gründe, alle aus dem bestehenden Code:

- **Die Kamera kann gar nicht hinein.** `controls.enablePan = false` und
  `controls.minDistance = 4` (`js/game.js:63-64`): der Blickpunkt lässt sich
  nicht frei verschieben, und die Kamera kommt dem Ziel nie näher als vier
  Einheiten. Der Innenraum ist 1.62 × 1.22 gross.
- **Es gibt im ganzen Spiel kein Betreten.** Auch die Wohnungen sieht man von
  aussen — `state.cutaway` blendet Wände aus (`js/game.js:890-891`), man geht
  nicht hinein. Ein begehbares Objekt hätte kein Vorbild und keinen Rahmen.
- **Begehbarkeit ist #44.** Die First-Person-Idee ist ein eigener Issue; dort
  gehört die Frage hin, und dort würde dieses Häuschen dann automatisch zum
  ersten Ziel.

Was es stattdessen gibt: Tür und Fenster sind **echte Öffnungen** (Löcher in
der extrudierten Wandkontur, kein aufgemaltes Rechteck), und dahinter steht ein
dunkler Innenblock, sodass man wirklich in einen Raum schaut statt durch das
Haus hindurch in den Himmel. Ein Frosch lugt aus der Tür, wie auf der Buchseite.

## Goals

- Ein neues Katalog-Objekt `terrassenhaus` («Häuschen») im Tab «Dach», das sich
  wie jedes andere Dachobjekt aufstellen, verschieben, drehen und löschen lässt.
- Das Dach liest als **grünes Schilfdach**: strohig gerippt, mehrfarbig grün,
  mit weit überstehenden Traufen und ausgefransten Kanten.
- Der Bilderbuch-Look bleibt: nur `MeshLambertMaterial`, klobige Primitive,
  keine Textur, keine Transparenz, keine Shader.
- Das Objekt bleibt trotz seiner Grösse auf der ganzen Terrasse sinnvoll
  platzierbar und blockiert den Treppenaufgang nie.
- Tür und Fenster sind echte Rundbögen, keine aufgemalten Flächen.

## Non-goals

- **Nicht begehbar.** Keine Kamerafahrt hinein, keine Innenausstattung, keine
  Kollision, kein eigener «Raum» im Spielstand (siehe oben; #44).
- Kein zweites Dachobjekt, keine Varianten (Farbe, Grösse, Dachform).
- **Kein neuer Bewohnerwunsch.** `TENANTS` (`js/game.js:19-31`) bleibt
  unverändert; der einzige Dachwunsch ist weiterhin der Pool
  (`js/game.js:30`).
- Keine Änderung an `clampEntry` oder an der Treppenregel aus #20
  (`js/game.js:443-445`) — das Häuschen fügt sich ein, die Regel bleibt.
- Keine Änderung an `MAT` ausser einer einzigen neuen lokalen Wandfarbe; keine
  bestehende `MAT`-Instanz wird mutiert.
- Keine Einfärbbarkeit im Sinne von #34 — das Häuschen kommt nicht in
  `TINTABLE`.
- Keine Interaktion: kein Antippen mit Sprechblase, kein Bewohner, der einzieht,
  keine Animation.

## Design

### 1. Das Modell

Ein neuer `FURN`-Eintrag `terrassenhaus()` hinter `lampion()`
(`js/models.js:244-248`), plus drei Helfer und eine Materialkonstante hinter
den Pool-Helfern (`js/models.js:23-66`), weil der Frosch in der Tür
`poolFrogHead()` und `POOL_FROG` wiederverwendet (`js/models.js:27, 54-57`).

```js
/* ---------- Terrassenhaus-Helfer: Schilfdach-Häuschen nach der Buchseite ---------- */
const HAUS_WALL = L(0xdf9d4f);
/* Rundbogen-Öffnung als Pfad (Mittelpunkt cx, Unterkante cy, Breite w, Höhe h). */
function hausArch(cx, cy, w, h) {
  const r = w / 2, p = new THREE.Path();
  p.moveTo(cx - r, cy); p.lineTo(cx - r, cy + h - r); p.absarc(cx, cy + h - r, r, Math.PI, 0, true); p.lineTo(cx + r, cy); p.closePath();
  return p;
}
/* Wandscheibe: Kontur in der xy-Ebene, Dicke t nach +z; optional mit Bogenloch. */
function hausWall(g, pts, t, arch) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); if (arch) shape.holes.push(arch);
  return mesh(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }), HAUS_WALL, 0, 0, 0, g);
}
/* Eine Dachhälfte: dunkle Grundplatte, darauf Halmbündel als liegende Zylinder, die am First
   bündig beginnen und an der Traufe unterschiedlich weit herausstehen (ausgefranst). */
function hausRoofHalf(g, s, angle, len) {
  const half = G(); g.add(half); half.position.set(0, 1.34, s * 0.41); half.rotation.set(s * angle, s > 0 ? 0 : Math.PI, 0);
  box(half, 2.4, 0.08, len, MAT.leafD, 0, 0, 0);
  for (let i = 0; i < 17; i++) { const l = len - 0.02 + ((i * 7 + (s > 0 ? 0 : 3)) % 5) * 0.02;
    const b = cyl(half, 0.075, 0.075, l, i % 2 ? MAT.leaf : MAT.green2, -1.12 + i * 0.14, 0.115, (l - len) / 2, 8); b.rotation.x = Math.PI / 2; }
}
```

```js
  terrassenhaus() { const g = G();
    /* Wandkörper 1.8 × 1.4; Traufwände vorn/hinten bis unter die Dachplatte (1.0), Giebelwände als Fünfeck.
       Der dunkle Innenblock macht Tür und Fenster zu echten Öffnungen ohne Scheiben. */
    box(g, 1.62, 1.0, 1.22, MAT.dark, 0, 0.5, 0);
    hausWall(g, [[-0.9, 0], [0.9, 0], [0.9, 1.0], [-0.9, 1.0]], 0.12, hausArch(0, 0, 0.44, 0.62)).position.z = 0.58;
    box(g, 1.8, 1.0, 0.12, HAUS_WALL, 0, 0.5, -0.64);
    const gable = [[-0.7, 0], [0.7, 0], [0.7, 1.0], [0, 1.72], [-0.7, 1.0]];
    [[1, hausArch(-0.1, 0.32, 0.28, 0.42)], [-1, null]].forEach(([s, arch]) => { const w = hausWall(g, gable, 0.12, arch); w.position.x = s * 0.9 - (s > 0 ? 0.12 : 0); w.rotation.y = Math.PI / 2; });
    box(g, 0.6, 0.05, 0.22, MAT.woodL, 0, 0.025, 0.78);
    /* Satteldach: First entlang x, Traufen vorn und hinten weit über die Tür hinaus. */
    const angle = Math.atan2(1.08, 1.0);
    [1, -1].forEach(s => hausRoofHalf(g, s, angle, 1.28));
    cyl(g, 0.17, 0.17, 2.4, MAT.leafD, 0, 1.84, 0, 10).rotation.z = Math.PI / 2;
    /* Ein Frosch lugt aus der Türöffnung. */
    const f = G(); g.add(f); f.position.set(0.1, 0.04, 0.6); f.rotation.y = -0.35;
    sph(f, 0.075, POOL_FROG, 0, 0.02, -0.06, 1.1, 0.75, 1.1); poolFrogHead(f);
    return g; },
```

Nachgemessene Eckwerte: **51 Meshes**, Bounding-Box 2.40 × 2.002 × 2.05,
Firstoberkante 2.01, Dachunterkante an der Vorderwand 0.995 (kein Spalt unter
dem Dach), Giebelspitze 1.72 unter der Dachunterkante 1.75. Zum Vergleich: der
Pool hat rund 60 Meshes (Extrusionen, Wellen, zwei Frösche, Leiter,
`js/models.js:214-223`), das Häuschen ist also kein Ausreisser.

### 2. Das Schilfdach

Pro Dachhälfte eine dunkle **Grundplatte** (`MAT.leafD`) und darauf **17
liegende Zylinder** (r 0.075, 8 Segmente, Abstand 0.14, also leicht
überlappend) als Halmbündel, im Wechsel `MAT.green2` (hell) und `MAT.leaf`
(mittel). Das ergibt die gerippte, gestreifte Strohoptik, die den Hang
hinunterläuft, ohne dass irgendwo ein einzelner Halm modelliert wäre. Die
Bündel beginnen am First bündig und stehen an der Traufe um 0 bis 0.08
unterschiedlich weit heraus — deterministisch über `(i * 7 + Versatz) % 5`, mit
Versatz 3 für die hintere Hälfte, damit die beiden Traufen nicht identisch
fransen. Ein dicker Firstzylinder (r 0.17, `MAT.leafD`) deckt die Stossstelle.

Neigung 47° (`Math.atan2(1.08, 1.0)`) — steil genug für die Hüttenwirkung der
Buchseite, und die 8-Segment-Zylinder bleiben genauso klobig wie Pool-Leiter,
Sonnenschirmstange oder Baumstämme (`js/models.js:220-222, 241`,
`js/models.js:376`).

Die drei Grüntöne kommen **alle aus der bestehenden Palette**: `MAT.green2`,
`MAT.leaf`, `MAT.leafD` (`js/models.js:6, 11`) — genau die Töne, die schon die
Baumkronen und das Blattwerk tragen. Es kommt nur **eine** neue Farbe hinzu,
das Ocker der Wände (`HAUS_WALL = L(0xdf9d4f)`), und die ist eine eigene
Instanz, keine Mutation eines geteilten `MAT`-Eintrags (Regel aus #34,
`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`, A1).

### 3. Die Rundbögen

**Extrude-Shape mit Loch** (`THREE.Shape` + `shape.holes.push(new THREE.Path)`),
dasselbe Werkzeug, das `poolSlab()` für die Nierenform benutzt
(`js/models.js:40-44`). Der Bogen besteht aus zwei Geraden und einem `absarc`
(Halbkreis oben), die Extrusionstiefe ist die Wandstärke 0.12.

Verworfene Alternative «Box plus Zylinderbogen»: ohne Transparenz lässt sich
ein Loch nicht subtrahieren; man müsste die Wand aus fünf Teilstücken um die
Öffnung herum zusammensetzen und hätte trotzdem keinen Rundbogen, sondern eine
Treppe. Mit dem Loch entsteht die Laibung (Innenkante der Öffnung) von selbst.

Die Giebelwände sind dasselbe Prinzip mit fünfeckiger Kontur, um 90° gedreht;
die +x-Wand trägt das Fensterloch (0.28 × 0.42 ab y 0.32).

Bewusste Abweichung von der ursprünglichen Skizze: die Traufwände sind **1.0**
hoch statt 0.85. Bei 47° Neigung und dem Dachüberstand liegt die Dachunterkante
an der Wandaussenfläche bei 0.995 — mit 0.85 klaffte ein Spalt unter dem Dach.
Die Türöffnung (0.62) wirkt in der 1.0-Wand weiterhin klein und gedrungen; eine
Maus (rund 0.4 hoch, `SPECIES.maus.s = 0.4`, `js/models.js:334`) geht bequem
durch, Willi (rund 1.0, `js/models.js:395-410`) müsste sich ducken.

### 4. Anbindung ans Spiel — bewusst minimal

Genau zwei Zeilen ausserhalb des Modells:

```js
{ id: 'terrassenhaus', name: 'Häuschen', cat: 'dach' },   // js/models.js:265
```

Damit ist alles andere automatisch erledigt, weil der bestehende Code
generisch über `CATALOG` läuft:

- **Thumbnail:** `makeThumbs()` rendert jeden `CATALOG`-Eintrag
  (`js/game.js:544`); es braucht kein eigenes Bild.
- **Tab:** `renderCatalog()` zeigt im Dachmodus genau die `cat: 'dach'`-Einträge
  (`js/game.js:534`).
- **Platzierung, Verschieben, Drehen, Löschen:** `addItem`/`placeItemMesh`/
  `clampEntry` (`js/game.js:680-722, 447-470, 427-446`) kennen keine
  Objektliste, sondern nur die id.
- **Spielstand:** ein Eintrag in `state.rooms.roof`, wie jedes andere
  Dachobjekt — keine Migration, kein neues Feld.
- **Laden:** der Startpfad ruft für `roof` ohnehin `clampEntry` nach
  (`js/game.js:1180-1181`), ein alter Stand mit einem falsch liegenden Häuschen
  wird also von selbst zurechtgerückt.

## Assumptions

- **A1** [high] Das Häuschen ist ein reines Objekt und **nicht begehbar**;
  hineinschauen ja, hineingehen nein. Verworfen: eine Kamerafahrt in den
  Innenraum — `controls.enablePan = false` und `controls.minDistance = 4`
  (`js/game.js:63-64`) schliessen das bei einem Innenraum von 1.62 × 1.22
  aus, und das Spiel kennt bis heute kein Betreten (auch Wohnungen werden über
  `state.cutaway` von aussen gezeigt, `js/game.js:890-891`). Das gehört in
  #44.
- **A2** [high] Tür und Fenster sind echte Löcher in extrudierten
  Wandkonturen, mit einem dunklen Innenblock (`MAT.dark`) dahinter. Verworfen:
  aufgemalte dunkle Rechtecke auf einer geschlossenen Wand — der Rundbogen ist
  das Erkennungsmerkmal der Buchseite, und ohne Innenblock sähe man durch die
  rückseitige Wand hindurch (Lambert-Material rendert nur die Vorderseite) in
  den Himmel.
- **A3** [high] Das Schilfdach entsteht aus 2 × 17 liegenden Zylindern auf
  zwei Grundplatten. Verworfen: (a) eine Textur oder Normalmap — verboten, das
  Spiel benutzt Texturen ausschliesslich für Tapeten und Böden
  (`js/models.js:296-307`) und der Look schreibt `MeshLambertMaterial` ohne Map
  vor; (b) hunderte einzelne Halme — bei einem Objekt, das mehrfach in der
  Szene stehen kann, wäre das ein Vielfaches des Polygonbudgets des ganzen
  Turms.
- **A4** [med] Die Gesamtausdehnung ist 2.40 × 2.05, also rund 16 % der
  Terrassenfläche. Verworfen: (a) grösser, näher an der Buchproportion (dort
  nimmt das Häuschen fast die halbe Terrassenbreite ein) — dann bliebe neben
  dem Pool (1.49 × 0.96) kaum noch Platz für Liegestuhl und Schirm; (b)
  deutlich kleiner — dann ist es kein Häuschen mehr, sondern eine Hundehütte,
  und die Türöffnung wäre für eine Maus (0.4 hoch, `js/models.js:334`) zu
  niedrig.
- **A5** [med] `clampEntry` und die Treppenregel aus #20 bleiben
  **unverändert** (`js/game.js:443-445`); das Häuschen ordnet sich ihnen unter.
  Verworfen: eine Ausnahme für grosse Objekte — die Regel hält den einzigen
  Zugang zur Terrasse frei, und ein Häuschen quer im Durchgang wäre genau der
  Fall, für den sie geschrieben wurde.
- **A6** [med] Die Wandfarbe ist eine **neue eigene** Instanz
  `HAUS_WALL = L(0xdf9d4f)`, kein wiederverwendeter `MAT`-Ton. Verworfen:
  `MAT.orange` (`0xe08a3c`) nehmen — zu grell und zu rot für Putz, und der Ton
  ist an Sofakissen und Lampe vergeben (`js/models.js:88, 107`), was eine
  spätere Änderung mit dem Möbel-Look verkoppeln würde.
- **A7** [med] Das Dach benutzt `MAT.leaf`, `MAT.leafD` und `MAT.green2`
  unverändert weiter. Verworfen: eigene Dachgrüns anlegen — die Baumkronen
  liefern genau den «Blattgrün»-Eindruck, den das Schilfdach auf der Buchseite
  hat, und drei zusätzliche Materialien für dieselben Töne wären reine
  Verdopplung. **Nebenwirkung, bewusst in Kauf genommen:** sollte #50
  (Jahreszeiten) später `MAT.leaf`/`MAT.leafD` doch einmal umfärben, färbte sich
  das Dach mit. Die Spec zu #50 schliesst das ausdrücklich aus (sie färbt ein
  Register eigener Baummaterialien, nicht `MAT`) — diese Annahme hält also nur,
  solange diese Regel gilt.
- **A8** [med] Kein Bewohnerwunsch. Verworfen: einen zweiten `roofWish` neben
  dem Pool anlegen (`js/game.js:30`) — der Wunsch-Mechanismus vergibt
  Haselnüsse und würde die Wirtschaft des Spiels verändern; das war nicht
  bestellt.
- **A9** [low] Der Name im Katalog ist **«Häuschen»**, nicht
  «Terrassenhäuschen». Verworfen: der lange Name — die Katalogkacheln sind rund
  90 px breit mit 12.5 px Schrift (`index.html:60-63`), lange Namen brechen
  hässlich um.
- **A10** [low] Der Frosch in der Tür ist Teil des Modells, nicht ein
  separates Tier. Verworfen: ein echtes `makeAnimal('frosch')` hineinsetzen —
  das Tier-System hängt an Bewohnern und Stockwerken (`js/game.js:19-31`,
  `spawnTenant`), und der Frosch soll hier Deko sein, genau wie die beiden
  Frösche im Pool (`js/models.js:220`).
- **A11** [low] Die Türseite zeigt nach **+z**, wie bei den übrigen Modellen
  die Vorderseite. Gedreht wird das Häuschen über den bestehenden
  «Drehen»-Knopf in 90°-Schritten (`js/game.js:1082-1084`), nicht über eine
  Sonderbehandlung.

## Consequences

- **Die Terrasse wird enger.** Mit Häuschen, Pool, Liegestuhl und Schirm ist die
  Terrasse voll; das ist der Preis des Objekts und entspricht der Buchseite.
  Ein Kind, das zuerst überall Lampions verteilt, findet danach womöglich
  keinen Platz mehr fürs Häuschen — es gibt keine Warnung, das Objekt rutscht
  nur an den Rand.
- **Im rechten Terrassenstreifen springt das Häuschen beim Verschieben.** Sobald
  `en.x > 1.20`, zieht die Treppenregel es in die hintere Hälfte. Das ist
  korrekt, wirkt beim Ziehen mit dem Finger aber wie ein Widerstand — dieselbe
  Wahrnehmung, die es beim Pool schon gibt, nur häufiger.
- **51 zusätzliche Meshes pro platziertem Häuschen.** Es gibt keine Obergrenze,
  wie oft ein Dachobjekt gesetzt werden darf; zehn Häuschen sind rund 510
  Meshes. Das ist tragbar, aber die bisher teuerste Einzelplatzierung.
- **Das Häuschen überragt die Dach-Trefferbox.** `rhit` reicht von y 0 bis 1.4
  (`js/game.js:319-320`), das Häuschen bis 2.18 über dem Terrassenbelag. Es
  wird trotzdem korrekt getroffen, weil Möbel über `itemMeshes` gepickt werden;
  ein Tipp auf den First trifft aber nicht mehr «die Terrasse», sondern das
  Häuschen — was gewollt ist.
- **Party-Tänzer können im Häuschen stehen.** `dancers` werden ohne Rücksicht
  auf Möbel an `roofG` gehängt (`js/game.js:855-866`). Sichtbar nur, wenn das
  Häuschen zufällig auf einem Tanzplatz steht.
- **Eine neue Materialinstanz** im ganzen Spiel (`HAUS_WALL`). Alle übrigen
  Flächen greifen auf bestehende `MAT`-Einträge und auf `POOL_FROG` zurück.
- **Das Häuschen hängt am Pool-Frosch.** `terrassenhaus()` benutzt
  `poolFrogHead()` und `POOL_FROG` (`js/models.js:27, 54-57`); wer diese Helfer
  später umbaut, verändert auch das Häuschen. Das ist als Kommentar im Code zu
  vermerken.
- **#44 bekommt ein erstes Ziel.** Sobald es eine First-Person-Ansicht gibt, ist
  dieses Häuschen der offensichtliche Ort zum Hineingehen — Innenraum,
  Türöffnung und Fenster sind schon da.

## Acceptance Criteria

- [ ] Im Einrichten-Modus der Dachterrasse zeigt der Tab «Dach» fünf Einträge;
      der neue heisst «Häuschen» und hat ein automatisch gerendertes Thumbnail.
- [ ] Ein Tipp darauf stellt das Häuschen auf die Terrasse; es steht mit der
      Unterkante auf dem Belag (kein Schweben, kein Einsinken).
- [ ] Die Bounding-Box des platzierten Modells misst 2.40 × 2.05 in x/z und
      reicht in y nicht über 2.01.
- [ ] Auf einer leeren Terrasse landet das Häuschen bei `x = -2.00`,
      `z = -0.975` — in der hinteren linken Ecke, nicht im Treppendurchgang.
- [ ] Das Häuschen lässt sich mit den Pfeiltasten über die ganze Terrasse
      schieben; `en.x` bleibt dabei in `[-2.00, 2.00]` und `en.z` in
      `[-1.275, 1.275]`.
- [ ] Wird das Häuschen nach rechts an den Rand geschoben (`en.x > 1.20`),
      rutscht `en.z` auf höchstens 0.075 — der Treppenaufgang und das
      Ankunftspodest bleiben frei begehbar und sichtbar.
- [ ] Das Häuschen lässt sich in 90°-Schritten drehen; nach dem Drehen sitzt es
      weiterhin vollständig auf der Terrasse.
- [ ] Pool und Häuschen lassen sich gleichzeitig auf der Terrasse aufstellen,
      ohne dass eines von beiden aus der Terrasse geschoben wird.
- [ ] Das Dach liest als Schilfdach: erkennbar gerippte Halmbündel in zwei
      Grüntönen, ausgefranste Traufkante, sichtbarer Firstbalken.
- [ ] Durch die Türöffnung sieht man einen dunklen Innenraum, **nicht** den
      Himmel; dasselbe gilt für das Fenster in der rechten Giebelwand.
- [ ] Ein Frosch ist in der Türöffnung zu sehen.
- [ ] Alle Materialien des Häuschens sind `MeshLambertMaterial`; es gibt genau
      **eine** neue Materialinstanz (`HAUS_WALL`), und die Farbwerte von
      `MAT.leaf`, `MAT.leafD`, `MAT.green2`, `MAT.dark` und `MAT.woodL` sind
      unverändert.
- [ ] Nach dem Platzieren, Neuladen der Seite und erneutem Öffnen der
      Dachterrasse steht das Häuschen unverändert an derselben Stelle in
      derselben Drehung.
- [ ] «Weg damit» entfernt das Häuschen restlos aus Szene und Spielstand.
- [ ] `TENANTS` ist unverändert; es erscheint kein neuer Wunsch in der
      Wunschliste.
- [ ] `version.js` ist unverändert bei `0.5.0`; der Changelog-Eintrag steht
      unter `## [Unreleased]`.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
