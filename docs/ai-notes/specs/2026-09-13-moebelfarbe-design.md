# Spec — Möbelfarbe auswählen (Issue #34)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:508-516`).

Quelle: Feedback-Triage 12.09.2026, Eintrag 02
(`docs/ai-notes/feedback/2026-09-12-test-mit-tochter.md:19`).

## Problem

Möbel haben feste Farben. Jedes Modell in `js/models.js` greift direkt auf die
geteilten Materialien aus `MAT` (`js/models.js:4-12`) zu, und
`makeFurniture(id)` (`js/models.js:309`) nimmt ausser der id nichts entgegen:

```js
export function makeFurniture(id) { const g = FURN[id](); g.userData.itemId = id; return g; }
```

Folge: zwei Sofas im Turm sehen zwangsläufig gleich aus — beide bauen ihren
Korpus aus `MAT.red` (`js/models.js:86-87`).

Zwei Dinge machen das nicht trivial:

1. **`MAT.red` ist ein einziges Objekt.** Es wird ausserhalb der Möbel
   weiterverwendet: Bücherrücken (`js/models.js:97, 174`), Teppichring
   (`js/models.js:102`), Uhrzeiger-Knopf (`js/models.js:201`), Fensterläden
   (`js/models.js:211`), Liegestuhl-Streifen (`js/models.js:232`),
   Sonnenschirm (`js/models.js:242`), Willis Farbeimer (`js/models.js:408`).
   `MAT.red.color.set(...)` färbt all das mit — im ganzen Turm, auf einen
   Schlag.
2. **«Die Farbe» eines Möbels ist nicht eindeutig.** Ein Sofa besteht aus
   Sitzfläche, Rückenlehne und zwei Armlehnen (alle `MAT.red`,
   `js/models.js:86-87`) plus zwei Kissen (`MAT.orange` / `MAT.cream`,
   `js/models.js:88`). Ein Bett hat Gestell (`MAT.wood`), Matratze
   (`MAT.cream`), Kopfkissen (`MAT.white`) und Decke (`MAT.red`,
   `js/models.js:69`).

Der Spielstand kennt heute pro Eintrag `id`, `x`, `z`, `y`, `rot`, `cell` und
seit #11 `wall` (`js/game.js:696-712`, `js/game.js:427-446`). Eine Farbe kommt
dazu, und alte Stände ohne sie müssen weiterhin laden.

## Goals

- Beim Einrichten lässt sich für ein ausgewähltes Möbel eine **Farbe aus einer
  festen Palette** wählen; das Möbel wird sofort sichtbar umgefärbt.
- Zwei Sofas (oder Betten, Teppiche …) im selben Turm können unterschiedlich
  aussehen.
- Die gewählte Farbe überlebt Neuladen (Teil von `state.rooms`).
- Alte Spielstände ohne Farbfeld laden unverändert und sehen **pixelgleich**
  wie heute aus.
- Der Bilderbuch-Look bleibt: nur `MeshLambertMaterial`, warme entsättigte
  Töne, **keine** neuen Farbwerte ausserhalb von `MAT`.
- Kein messbarer Speicherzuwachs pro Möbel (siehe A1).

## Non-goals

- **Kein freier Farbwähler** (`<input type="color">`, HSV-Rad, Hex-Feld) —
  bricht die Palette und damit den Look (Issue-Text; `CLAUDE.md:796-821`).
- Keine Mehrfach-Farben pro Möbel («Gestell braun, Polster blau, Kissen
  gelb»). Genau **eine** Farbe pro Möbelstück (A3).
- Keine Farbe für Tiere, Willi, Baum, Brücke, Garten oder die Wandobjekte —
  nur Katalog-Möbel, und auch dort nur die einfärbbaren (A2).
- Keine Änderung an Tapete/Boden (`WALLS`/`FLOORS`, `js/models.js:275-295`).
- Keine Änderung an Katalog-Thumbnails: die bleiben in Standardfarbe
  (`js/game.js:541`, A6).
- Kein Zufallsfarben-Würfeln beim Platzieren — ein neues Möbel erscheint in
  seiner Standardfarbe (A7).

## Design

### 1. Die Palette *ist* `MAT` — es entstehen keine neuen Materialien

Kern der Lösung: die Farbauswahl legt nicht eine neue Farbe an, sondern wählt
**eine bereits existierende `MAT`-Instanz** als Korpusmaterial aus.

```js
/* js/models.js — Palette für einfärbbare Möbel. Jeder Eintrag ist eine
   bestehende MAT-Instanz; es wird nie eine neue erzeugt und nie eine
   mutiert. */
export const FURN_COLORS = [
  { id: 'rot',    name: 'Rot',    mat: 'red' },
  { id: 'blau',   name: 'Blau',   mat: 'blue' },
  { id: 'orange', name: 'Orange', mat: 'orange' },
  { id: 'gruen',  name: 'Grün',   mat: 'green2' },
  { id: 'rosa',   name: 'Rosa',   mat: 'pink' },
  { id: 'creme',  name: 'Creme',  mat: 'cream' },
];
```

`makeFurniture(id, colorId)` schlägt `colorId` in dieser Tabelle nach und
reicht die gefundene `MAT`-Instanz als **optionalen ersten Parameter** an das
Modell weiter:

```js
export function makeFurniture(id, colorId) {
  const def = colorId ? FURN_COLORS.find(c => c.id === colorId) : null;
  const g = FURN[id](def ? MAT[def.mat] : undefined);
  g.userData.itemId = id; if (def) g.userData.color = def.id;
  return g;
}
```

Jedes einfärbbare Modell bekommt einen Default-Parameter, der exakt das
heutige Material ist — ohne Argument ändert sich **nichts**:

```js
sofa(body = MAT.red) { const g = G();
  box(g, 0.85, 0.26, 0.44, body, 0, 0.2); box(g, 0.85, 0.36, 0.12, body, 0, 0.48, -0.17);
  [-0.4, 0.4].forEach(x => box(g, 0.11, 0.4, 0.44, body, x, 0.3));
  box(g, 0.3, 0.09, 0.3, MAT.orange, -0.16, 0.37, 0.03); box(g, 0.3, 0.09, 0.3, MAT.cream, 0.16, 0.37, 0.03);
  return g; },
```

Konsequenzen dieser Wahl:

- **Kein Klon, keine Mutation.** `MAT.red` bleibt unangetastet; Bücher,
  Fensterläden und Sonnenschirm behalten ihr Rot.
- **Speicher: null zusätzliche Materialien.** Egal ob 3 oder 80 Möbel im Turm
  stehen — es gibt weiterhin genau die ~22 `MAT`-Instanzen. Zehn Stockwerke
  kosten nichts extra.
- **Batching bleibt intakt.** Alle blauen Korpusse teilen sich eine
  `MeshLambertMaterial`-Instanz, wie heute alle roten.
- **Identitätsvergleiche auf Materialien bleiben gültig** — der Code nutzt
  sie: `c.material === MAT.glow` (`js/game.js:1226`). Ein Klon-Ansatz würde
  diese Klasse von Prüfungen still brechen.

### 2. Welche Fläche wird eingefärbt? — die Korpusregel

**Regel:** Eingefärbt wird genau die Fläche eines Möbels, die heute schon
einen **bunten Stoff- oder Korpuston** trägt — also ein `MAT`-Ton, der weder
Holz (`wood`, `woodD`, `woodL`) noch Struktur/Beschlag (`grey`, `dark`,
`black`, `gold`) noch Effekt (`glow`, `fire`, `water`) noch Pflanze (`leaf`,
`leafD`) ist. Kontrast-Deko am selben Möbel (Kissen, Bücherrücken, Blüten,
Matratze, Kopfkissen) bleibt immer stehen — sie ist es, die den neuen Farbton
erst lesbar macht.

**Möbel ohne solche Fläche sind nicht einfärbbar** und bekommen gar keinen
Farbknopf (statt eines Knopfs, der sichtbar nichts tut).

Daraus ergibt sich, direkt aus den Modellen abgelesen:

| Möbel | eingefärbt wird | bleibt | Beleg |
| --- | --- | --- | --- |
| `sofa` | Sitz, Rücken, beide Armlehnen | Kissen (orange/creme) | `js/models.js:86-88` |
| `bett` | Decke | Gestell, Matratze, Kopfkissen | `js/models.js:67-69` |
| `etagenbett` | beide Decken | Gestell, Matratzen, Leiter | `js/models.js:73` |
| `teppich` | äusserer Ring | mittlerer + innerer Ring | `js/models.js:102-104` |
| `lampe` | Lampenschirm | Fuss, Stange, Leuchtkugel | `js/models.js:107-108` |
| `badewanne` | Wannenkörper | Wasser, Füsse, Armatur | `js/models.js:116-119` |
| `pflanze` | Blumentopf | Stiel und Blätter | `js/models.js:122-123` |
| `liegestuhl` | die farbigen Streifen | weisse Streifen, Gestell, Kissen | `js/models.js:232` |

Nicht einfärbbar (kein bunter Korpuston vorhanden): `tisch`, `stuhl`,
`schrank`, `schaukelstuhl`, `nusskiste` (reines Holz, `js/models.js:78-84,
90-93, 132-137, 149-155`), `regal` (Holz; die Bücher sind Deko-Kontrast,
`js/models.js:94-100`), `ofen` und `klavier` (Struktur-/Effektmaterial
`dark`/`fire`/`black`, `js/models.js:110-114, 144-148`), `hamsterrad`
(Effekt-/Holzteile, `js/models.js:138-143`), `bild` (Bildinhalt,
`js/models.js:125-131`), alle `DECO`-Kleinteile (`js/game.js:366`), alle
`WALL_ITEMS` (`js/models.js:272`), `pool` und `sonnenschirm`
(`js/models.js:214-243`, A8).

Die Liste lebt als Tabelle neben `FURN` in `js/models.js`:

```js
/* Welche Möbel haben eine einfärbbare Korpusfläche? Siehe Spec «Korpusregel». */
export const TINTABLE = new Set(['sofa', 'bett', 'etagenbett', 'teppich', 'lampe', 'badewanne', 'pflanze', 'liegestuhl']);
```

### 3. Spielstand

`state.rooms[k][i]` bekommt ein **optionales** Feld `color` mit einer
`FURN_COLORS`-id (String). Fehlt es, gilt die Standardfarbe — genau das
Verhalten von heute. Damit ist die Rückwärtskompatibilität struktureller Natur
und braucht keine Umschreibung alter Einträge.

Eine kleine Normalisierung nach dem Muster der Tapeten-Migration
(`js/game.js:379-390`, `js/game.js:1186`) räumt trotzdem auf: ein `color`,
das nicht (mehr) in `FURN_COLORS` steht, oder das an einem nicht einfärbbaren
Möbel klebt, wird beim Laden entfernt und `migrated = true` gesetzt, sodass der
bereinigte Stand einmalig zurückgeschrieben wird.

```js
/* Farbe pro Möbel. Alte Stände haben hier nichts — das ist gültig und heisst
   «Standardfarbe». Ein unbekannter oder unpassender Wert wird still entfernt. */
function normalizeColor(en) {
  if (!en.color) return;
  if (!TINTABLE.has(en.id) || !FURN_COLORS.some(c => c.id === en.color)) { delete en.color; migrated = true; }
}
```

### 4. Oberfläche

Die Auswahlleiste `#selbar` (`index.html:187-196`) bekommt einen Knopf
**«Farbe»**, der eine Swatch-Reihe `#colorpick` auf-/zuklappt. Die Reihe
orientiert sich an der bestehenden Wandwahl-Reihe `#wallpick`
(`index.html:113-116`, `js/game.js:562-577`): runde Knöpfe, `.on` markiert die
aktive Wahl, mindestens 44 px Kantenlänge für den Finger.

- Der Knopf wird pro Auswahl ein- bzw. ausgeblendet — genau wie heute
  `#btn-move` / `#btn-rot` / `#wallpad` in `select()` (`js/game.js:672-678`):
  sichtbar nur, wenn `TINTABLE.has(pick.entry.id)`.
- Erster Eintrag der Reihe ist **«Standard»** (setzt `entry.color` zurück),
  danach die sechs Palettentöne als farbige Punkte mit `aria-label`/Titel.
- Farbe wählen → `entry.color` setzen, Mesh neu bauen, Auswahl behalten,
  `sfx.pop()`, `save()`.
- `#colorpick` schliesst bei `deselect()` (`js/game.js:671`) und beim
  Verlassen des Einrichtens (`exitEdit()`, `js/game.js:657-670`).

### 5. Umfärben = Mesh neu bauen

Ein Möbel-Mesh wird beim Umfärben verworfen und über den bestehenden Pfad neu
erzeugt, statt seine Kinder-Materialien einzeln zu tauschen: `placeItemMesh()`
(`js/game.js:447-470`) ist bereits der einzige Ort, der `makeFurniture`,
Elternknoten, `itemMeshes`, `userData.pick` und `spinners` korrekt verdrahtet —
ein zweiter, halb-paralleler Pfad wäre die eigentliche Fehlerquelle.

Beim Neubau müssen alte Referenzen weg: `itemMeshes[k]` (`js/game.js:467`) und
`spinners` (`js/game.js:468`), sonst bleibt ein unsichtbares Mesh in der
Pick-Liste zurück. Der `BoxHelper` der Auswahl (`js/game.js:673`) wird auf das
neue Mesh gesetzt.

## Assumptions

- **A1** [high] Die Palette besteht ausschliesslich aus bestehenden
  `MAT`-Instanzen, die als Parameter ins Modell gereicht werden — es wird
  weder geklont noch mutiert, also entstehen **null** zusätzliche
  Materialien. Verworfen: (a) `MAT.red.color.set(hex)` — färbt jedes rote
  Teil im Turm mit, inklusive Bücherrücken, Fensterläden und Sonnenschirm
  (`js/models.js:97, 174, 211, 242`); (b) `material.clone()` pro Möbelstück —
  bis zu ~80 zusätzliche `MeshLambertMaterial` über zehn Stockwerke, zerstört
  das Material-Batching und bricht bestehende Identitätsvergleiche wie
  `c.material === MAT.glow` (`js/game.js:1226`).
- **A2** [med] Einfärbbar sind genau die acht Möbel aus der Korpustabelle
  oben; alle anderen bekommen gar keinen Farbknopf. Verworfen: jedes Möbel
  einfärbbar machen und bei Holzmöbeln das Holz umfärben — ein knallblauer
  Holzstuhl kippt den warmen Bilderbuch-Ton, den `MAT.wood`/`woodD`/`woodL`
  tragen (`js/models.js:5-6`).
- **A3** [med] Genau **eine** Farbe pro Möbelstück; beim Etagenbett bekommen
  damit **beide** Decken denselben Ton und verlieren den heutigen
  Rot/Blau-Kontrast (`js/models.js:73`) — ohne gewählte Farbe bleibt er
  erhalten. Verworfen: pro Möbel mehrere Farbslots — dafür bräuchte es eine
  Slot-Oberfläche, die ein Kind auf dem Tablet nicht mehr überblickt.
- **A4** [low] Das Feld heisst `color` und trägt eine Paletten-id (String),
  keinen Hex-Wert. Verworfen: Hex direkt speichern — damit liesse sich ein
  Spielstand von Hand auf beliebige Farben ausserhalb der Palette setzen, und
  die Palette wäre später nicht mehr änderbar, ohne alte Stände zu brechen.
- **A5** [low] Sechs Töne: Rot, Blau, Orange, Grün, Rosa, Creme (`MAT.red`,
  `blue`, `orange`, `green2`, `pink`, `cream`; `js/models.js:6-7, 11`), plus
  «Standard» als Rücksetzer. Verworfen: alle ~22 `MAT`-Töne anbieten — `dark`,
  `black`, `glow`, `water`, `fire` sind Struktur-/Effektmaterialien und sehen
  als Sofabezug falsch aus; eine Reihe aus 22 Punkten passt zudem nicht mehr
  in die Auswahlleiste.
- **A6** [low] Katalog-Thumbnails bleiben in Standardfarbe; `makeFurniture`
  wird dort ohne zweites Argument aufgerufen (`js/game.js:541`) und ändert
  sich nicht. Verworfen: Thumbnail in der gerade gewählten Farbe rendern —
  die Thumbnails werden einmalig beim Start erzeugt und gecacht.
- **A7** [low] Ein neu platziertes Möbel startet in Standardfarbe;
  `addItem()` (`js/game.js:680-712`) setzt kein `color`. Verworfen:
  zuletzt gewählte Farbe merken und automatisch anwenden — dann erscheint ein
  Möbel in einer Farbe, die das Kind für dieses Möbel nie gewählt hat.
- **A8** [low] Der `pool` bleibt aussen vor, obwohl er farbige Flächen hat
  (`POOL_TILE`, `js/models.js:27`): seine Kacheln sind eine eigene, lokal
  definierte Farbfamilie ausserhalb von `MAT` und der Pool ist ein
  Einzelstück auf dem Dach. Verworfen: Pool mitnehmen — kostet eine
  Sonderregel für ein Möbel, das es pro Turm ohnehin nur einmal gibt.
- **A9** [med] Umfärben baut das Mesh über `placeItemMesh()` neu, statt
  Materialien an den Mesh-Kindern zu tauschen. Verworfen: Kinder durchlaufen
  und jedes Material ersetzen, das gleich dem Default-Korpusmaterial ist —
  das trifft am Sofa nur zufällig richtig und am Etagenbett gar nicht
  (zwei verschiedene Default-Materialien, `js/models.js:73`).
- **A10** [low] Der Farbknopf sitzt in `#selbar` (Auswahl-bezogen), nicht als
  eigener Katalog-Tab. Verworfen: ein «Farbe»-Tab im Katalog — der Katalog
  wählt heute *was* platziert wird, `#selbar` verändert das *bereits
  ausgewählte* Möbel (`js/game.js:672-678`), und der Tab-Name «Farbe» ist
  durch die Tapete schon belegt (`js/models.js:271`).

## Consequences

- **Speicher/Performance:** unverändert. Es kommen keine Materialien, keine
  Geometrien und keine Draw-Call-Gruppen hinzu; die Anzahl `MAT`-Instanzen
  bleibt konstant, egal wie viele Möbel gefärbt sind.
- **Umfärben erzeugt kurz Garbage:** das alte Mesh samt Geometrien wird
  verworfen und neu gebaut. Bei einem Einzelmöbel ist das im Rahmen der
  bestehenden `addItem`-Kosten, fällt aber bei sehr schnellem Durchtippen der
  Palette mehrfach hintereinander an.
- **Spielstand wächst minimal:** ein zusätzliches kurzes String-Feld pro
  gefärbtem Möbel. Ungefärbte Möbel schreiben nichts.
- **Identität statt Instanz:** zwei gleichfarbige Sofas teilen sich exakt
  dieselbe Material-Instanz. Eine spätere Einzel-Animation eines Möbels
  (Blinken, Verblassen) wäre damit nicht möglich, ohne an dieser Stelle doch
  zu klonen.
- **Etagenbett verliert Kontrast:** sobald eine Farbe gewählt ist, sind obere
  und untere Decke gleich (A3). Das ist sichtbar und gewollt, aber niemand hat
  es explizit bestellt.
- **Die Palette ist erweiterbar, aber nicht schrumpfbar ohne Aufräumen:**
  wird ein Ton später entfernt, fallen betroffene Möbel dank `normalizeColor`
  auf Standard zurück — sichtbar, aber verlustfrei.
- **Auswahlleiste wird breiter:** ein weiterer Knopf in `#selbar`, plus die
  aufklappbare Reihe. Auf schmalen Hochkant-Viewports rückt die Leiste
  dadurch näher an den Katalog (`index.html:54, 71`, `--selbar-h`).

## Acceptance Criteria

- [ ] Ein ausgewähltes Sofa zeigt in `#selbar` einen Knopf «Farbe»; ein
      ausgewählter Tisch (nicht einfärbbar) zeigt ihn nicht.
- [ ] Der Knopf klappt eine Reihe mit «Standard» + sechs Farbpunkten auf;
      jeder Punkt ist mindestens 44 × 44 px gross.
- [ ] Ein Tipp auf «Blau» färbt Sitz, Rücken und beide Armlehnen des Sofas
      blau; die beiden Kissen bleiben orange und creme.
- [ ] Nach dem Umfärben bleibt dasselbe Möbel ausgewählt (Auswahlrahmen sitzt
      auf dem neuen Mesh) und lässt sich weiterhin verschieben, drehen und
      löschen.
- [ ] Zwei Sofas im selben Raum können gleichzeitig unterschiedliche Farben
      tragen.
- [ ] Ein zweites, rotes Objekt im Turm (z. B. ein Bücherstapel oder der
      Sonnenschirm auf dem Dach) bleibt beim Umfärben eines Sofas unverändert
      rot — `MAT.red` wurde nicht mutiert.
- [ ] Nach dem Umfärben, Neuladen der Seite und erneutem Öffnen des Stockwerks
      steht das Möbel unverändert in der gewählten Farbe da.
- [ ] **Ein Spielstand ohne `color`-Feld (alte Struktur) lädt fehlerfrei; jedes
      Möbel darin sieht exakt so aus wie vor der Änderung, und es erscheint
      keine Fehlermeldung in der Konsole.**
- [ ] Ein Spielstand mit einem unbekannten `color`-Wert (z. B. `"tuerkis"`)
      oder mit `color` an einem nicht einfärbbaren Möbel lädt, zeigt
      Standardfarbe und schreibt den bereinigten Stand einmalig zurück.
- [ ] «Standard» in der Farbreihe stellt die ursprüngliche Farbe wieder her
      und entfernt das `color`-Feld aus dem Spielstand.
- [ ] Jedes der acht einfärbbaren Möbel (`sofa`, `bett`, `etagenbett`,
      `teppich`, `lampe`, `badewanne`, `pflanze`, `liegestuhl`) lässt sich in
      allen sechs Tönen darstellen, ohne dass ein Holz-, Metall-, Wasser-,
      Feuer- oder Pflanzenteil mitfärbt.
- [ ] Die Katalog-Thumbnails zeigen weiterhin die Standardfarben.
- [ ] Die Anzahl `MeshLambertMaterial`-Instanzen in der Szene ist nach dem
      Einfärben von zehn Möbeln unverändert gegenüber vorher.
- [ ] Alle Materialien im Spiel bleiben `MeshLambertMaterial`; es wird kein
      Farbwert ausserhalb von `MAT` eingeführt.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
