# Spec — Kollisionserkennung zwischen Objekten und Tieren (Issue #40)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js über Importmap.
Kein Build-Schritt, kein Test-Runner.

Quelle: Feedback-Triage 12.09.2026, Eintrag 09 — Block C.

**Voraussetzung: Issue #39.** Diese Arbeit setzt auf den dort eingeführten
Bausteinen auf — `state.tenantPos`, `tenantMeshes`, `pick.tenant`,
`setTenantPos()` und die in `tenantSpots(k)` aufgetrennte Platzheuristik
(`docs/ai-notes/specs/2026-09-14-tiere-verschiebbar-design.md`). Solange #39
nicht auf `main` liegt, kann nur die Möbelseite kollidieren, weil ein Tier gar
nicht bewegt werden kann.

## Problem

Möbel und Tiere wissen nichts voneinander. Ein Tier steht in einem Sofa, ein
Möbel lässt sich auf ein Tier setzen.

Was heute existiert, löst das **nicht**:

1. **`tenantSpot` ist eine Platzierungsheuristik, keine Kollisionsprüfung.**
   Sie wählt aus einem 5×3-Raster den Punkt mit dem grössten Abstand zum
   nächsten Möbel (`js/game.js:724-748`) und wird genau **einmal** aufgerufen:
   in `spawnTenant` beim Einzug (`js/game.js:754`, Ladepfad `js/game.js:1184`).
   Danach nie wieder. Sie kennt weder ein «zu nah» noch ein «überlappt» — sie
   kennt nur «am weitesten weg von allem». Steht die Wohnung voll, liefert sie
   trotzdem einen Punkt, auch wenn dieser mitten im Sofa liegt. Und sie reagiert
   auf kein einziges später hinzugefügtes oder verschobenes Möbel.
2. **`clampEntry` klemmt nur gegen Wände.** Es misst die Box3 des Meshes und
   begrenzt `en.x`/`en.z` auf die Raumgrenzen (`js/game.js:437-443`); andere
   Objekte kommen darin nicht vor. Möbel überlappen einander heute ungestraft.
3. **`surfaceYAt` ist keine Kollision, sondern das Gegenteil.** Es sucht
   bewusst die Überlappung, um Deko auf Tisch, Regal oder Schrank zu stapeln
   (`js/game.js:415-426`, `SURFACES` `js/game.js:426`, `addItem`
   `js/game.js:695-703`). Eine generelle Möbel-gegen-Möbel-Sperre würde genau
   diese Mechanik zerstören.

Die Bausteine liegen dagegen bereit: `new THREE.Box3().setFromObject(m)` liefert
in beiden bestehenden Funktionen Weltkoordinaten (`js/game.js:420`, `732`), und
`floorGroups[k]` trägt neben der Verschiebung eine kleine Zufallsrotation
(`floorPose`), weshalb Vergleiche in Weltkoordinaten stattfinden müssen — der
Kommentar bei `js/game.js:724-727` hält das bereits fest.

## Goals

- Ein Möbel lässt sich nicht so platzieren, verschieben oder drehen, dass es ein
  Tier durchdringt.
- Ein Tier lässt sich nicht in ein Möbel schieben.
- Die Regel ist **freundlich**: wo möglich weicht das Tier aus, statt das Kind
  auszubremsen.
- Wo nichts mehr geht, wird der Zug sauber abgelehnt statt ein Tier in die Wand
  gedrückt — mit einer verständlichen Rückmeldung.
- Deko auf Tisch, Regal, Schrank, Klavier und Nusskiste funktioniert
  unverändert.
- Ein Tier darf weiterhin auf einem Teppich stehen.

## Non-goals

- **Keine Möbel-gegen-Möbel-Kollision.** Sie würde `surfaceYAt`/`SURFACES` und
  damit das Abstellen von Deko brechen (`js/game.js:415-426, 695-703`) und ist
  im Issue-Text nicht verlangt (A1).
- **Keine Tier-gegen-Tier-Kollision.** Zwei Tiere einer Wohnung gehören
  zusammen und werden absichtlich mit 0.55 Versatz nebeneinander gesetzt
  (`js/game.js:756`) (A2).
- Keine Physik, kein kontinuierliches Schieben, kein Wegrutschen während einer
  Ziehbewegung. Das Spiel kennt nur diskrete Züge (Knopf, Pfeiltaste).
- Keine Kollision auf der Dachterrasse — dort gibt es keine Bewohner
  (`tenantGroups` nur für Stockwerke, `js/game.js:299`).
- Keine Kollision mit Wandobjekten; die hängen über Kopfhöhe an der Wand
  (`clampEntry`, `js/game.js:428-436`) (A4).
- Keine Änderung an `tenantSpot`s Einzugsverhalten aus #14.
- Keine Änderung an `version.js`, kein `chore(release)`-Commit.

## Design

### 1. Eine Regel, zwei Richtungen: das Bewegte gewinnt, das Tier weicht

| Zug | Verhalten |
| --- | --- |
| Möbel wird auf ein Tier gesetzt/geschoben/gedreht | Das **Tier weicht aus** auf den nächsten freien Platz |
| … und es gibt keinen freien Platz | Der **Möbelzug wird zurückgenommen**, Toast + `sfx.knock()` |
| Tier wird in ein Möbel geschoben | Der **Tierzug wird zurückgenommen**, nur `sfx.knock()`, kein Toast |

Das löst den im Issue benannten Zielkonflikt: Ausweichen ist der Normalfall
(keine Frustration beim Einrichten), die harte Sperre ist der Rückfall (kein
Tier in der Wand). Der blockierte Tierzug bekommt bewusst **keinen** Toast — die
Pfeiltaste wird gedrückt gehalten, und Toasts verschwinden nie von selbst,
sondern stapeln sich (`js/game.js` `toast`/`TOAST_MAX_VISIBLE`).

### 2. Was gilt als Hindernis

```js
/* Flache Dinge sind begehbar: ein Tier darf auf dem Teppich stehen
   (js/models.js:101-105, Höhe ~0.035). */
const SOLID_H = 0.12;

function solidBoxes(k, exclude) {
  const out = [];
  itemMeshes[k].forEach(m => {
    if (m === exclude) return;
    const id = m.userData.pick.entry.id;
    if (DECO.has(id) || WALL_ITEMS.has(id)) return;
    const bb = new THREE.Box3().setFromObject(m);
    if (bb.max.y - bb.min.y < SOLID_H) return;
    out.push(bb);
  });
  return out;
}
```

Ausgeschlossen sind damit:
- **Deko** (`DECO`, `js/game.js:366`) — steht ohnehin auf Möbeln.
- **Wandobjekte** (`WALL_ITEMS`) — hängen über Kopfhöhe.
- **Flaches** unterhalb `SOLID_H` — heute genau der Teppich; die Schwelle ist
  ein Höhenmass, keine Liste, damit spätere flache Objekte automatisch
  mitzählen.

Der Vergleich ist rein zweidimensional in x/z, weil die Wackel-Animation
`position.y` jeden Frame verändert (`js/game.js:1208`) und eine y-Überlappung
damit flackern würde:

```js
/* Berühren ist erlaubt: PAD verkleinert beide Boxen leicht, damit ein Tier
   dicht an der Sofakante stehen darf. */
const COLL_PAD = 0.04;
const overlapsXZ = (a, b) =>
  a.min.x + COLL_PAD < b.max.x - COLL_PAD && a.max.x - COLL_PAD > b.min.x + COLL_PAD &&
  a.min.z + COLL_PAD < b.max.z - COLL_PAD && a.max.z - COLL_PAD > b.min.z + COLL_PAD;
```

### 3. Die Prüfung greift an genau einer Stelle: `applyMove`

Statt fünf Aufrufstellen einzeln zu flicken (`addItem` `js/game.js:680-712`,
`#btn-move` `js/game.js:1043`, `#btn-rot` `js/game.js:1050`, Pfeiltasten und
`PageUp`/`PageDown` `js/game.js:1069-1090`) bekommt das Verschieben einen
gemeinsamen Rahmen:

```js
/* Führt eine Bewegung aus und räumt danach die Kollisionen auf.
   Rückgabe: true, wenn der Zug Bestand hat. */
function applyMove(pick, mutate) {
  const en = pick.entry;
  const snap = { x: en.x, z: en.z, y: en.y, rot: en.rot, wall: en.wall };
  mutate();
  const ok = pick.tenant ? resolveTenantMove(pick) : resolveItemMove(pick);
  if (!ok) { Object.assign(en, snap); replaceMesh(pick); sfx.knock(); }
  return ok;
}
```

`replaceMesh(pick)` setzt Mesh-Position und -Drehung aus dem
zurückgeschriebenen `entry` neu — bei einem Tier ohne `position.y`, damit die
Wackel-Animation weiterläuft.

- `resolveTenantMove(pick)`: Box3 des Tieres gegen `solidBoxes(pick.k)`. Bei
  Überlappung `false` (der Zug wird zurückgenommen), sonst `true`.
- `resolveItemMove(pick)`: für jedes Tier der Wohnung, dessen Box das Möbel
  schneidet, `nudgeTenant(...)` versuchen. Gelingt das für alle, `true`; sonst
  werden bereits ausgewichene Tiere ebenfalls zurückgesetzt und `false`
  zurückgegeben, plus Toast.

### 4. `nudgeTenant` — wohin das Tier ausweicht

Die Kandidaten kommen in dieser Reihenfolge, der erste kollisionsfreie gewinnt:

1. **Feiner Ring um den aktuellen Platz**: 8 Richtungen × Abstände 0.18, 0.36,
   0.54, 0.72. Damit bleibt das Tier möglichst nahe an seinem Platz und rutscht
   sichtbar nur ein Stück zur Seite.
2. **Das Raster aus #14**: `tenantSpots(k)` in seiner nach Freiraum sortierten
   Reihenfolge (aus #39). Damit landet das Tier im Zweifel dort, wo auch ein
   Neuzuzug landen würde.

Jeder Kandidat wird vor der Prüfung durch `clampEntry` gezogen, damit
Raumgrenzen und Dachlücke gelten (`js/game.js:437-445`) — deshalb kann das
Ausweichen ein Tier nie in eine Wand drücken: die Wand gewinnt, und ein
geklemmter Kandidat, der dann wieder im Möbel steckt, fällt in der Prüfung
durch.

Der Ortswechsel wird mit dem vorhandenen `tween` über 0.25 s animiert, damit das
Kind sieht, dass sich das Tier bewegt hat, und danach über `setTenantPos` (#39)
festgeschrieben — ein ausgewichenes Tier bleibt an seinem neuen Platz, auch nach
dem Neuladen.

### 5. Der Rückfall: kein Platz mehr

Findet `nudgeTenant` keinen freien Punkt, wird der auslösende Möbelzug
vollständig zurückgenommen und einmalig gemeldet:

```js
toast(`Hier ist kein Platz — ${TENANTS[k].name} steht im Weg!`);
```

Bei `addItem` gibt es keinen vorherigen Zustand, auf den zurückgesetzt werden
könnte: dort wird das eben erzeugte Möbel wieder entfernt (Eintrag aus
`roomOf(k)`, Mesh aus `itemMeshes[k]` und aus der Szene — derselbe Weg wie
`removeItem`, `js/game.js:713-720`), bevor `checkTenant`/`checkWishes` laufen.
Ein Möbel, das nie Bestand hatte, darf keinen Wunsch erfüllen.

### 6. Einzug und Laden

`spawnTenant` bekommt einen Nachlauf: nach dem Aufbau wird jedes Tier ohne
gespeicherte Position einmal durch `nudgeTenant` geschickt. Damit heilt der
Einzug auch die Fälle, in denen `tenantSpot` mangels Alternative einen besetzten
Punkt geliefert hat. Tiere **mit** gespeicherter Position (`state.tenantPos`,
#39) bleiben unangetastet — das Kind hat dort bewusst entschieden (A6).

## Assumptions

- **A1** [high] Möbel kollidieren **nicht** miteinander; geprüft wird
  ausschliesslich Möbel gegen Tier. Verworfen: allgemeine Objektkollision.
  Beleg: `surfaceYAt` sucht die Überlappung absichtlich, um Deko auf Möbeln
  abzustellen (`js/game.js:415-426`), und `addItem` setzt Deko gezielt auf die
  Koordinaten einer Abstellfläche (`js/game.js:695-703`). Der Issue-Titel nennt
  «Objekte und Tiere».
- **A2** [high] Tiere kollidieren **nicht** untereinander. Verworfen: auch
  Tiere gegeneinander prüfen. Beleg: `spawnTenant` setzt die Tiere einer
  Wohnung bewusst mit 0.55 Versatz nebeneinander (`js/game.js:755-757`); eine
  Sperre würde diesen Normalzustand sofort als Kollision melden.
- **A3** [med] Bei einem Möbelzug **weicht das Tier aus**, bei einem Tierzug
  wird **blockiert**. Verworfen: beidseitig harte Sperre; verworfen: beidseitig
  wegschieben. Grund: das Möbel ist das, was das Kind gerade einrichtet, und die
  harte Sperre auf der Möbelseite wäre die frustrierende Variante; umgekehrt ein
  Möbel wegzuschieben, weil ein Tier hineinläuft, würde die bewusste
  Möbelplatzierung zerstören. Beleg für die diskrete Zugnatur (kein Ziehen,
  daher gut rücknehmbar): alle Bewegungen laufen über Knöpfe und Tasten
  (`js/game.js:1043-1090`).
- **A4** [high] Wandobjekte und Deko zählen nicht als Hindernis. Verworfen:
  alle `itemMeshes` gleich behandeln. Beleg: `WALL_ITEMS` werden in `clampEntry`
  auf `y` zwischen 0.45 und `H(k) - 0.55` gehalten (`js/game.js:430-432`),
  hängen also über einem Tier; `DECO` steht laut `surfaceYAt` auf Möbeln
  (`js/game.js:419`).
- **A5** [med] «Flach» wird über eine Höhenschwelle `SOLID_H = 0.12`
  entschieden, nicht über eine Liste. Verworfen: `const WALKABLE = new Set(['teppich'])`.
  Beleg: der Teppich ist ~0.035 hoch (`js/models.js:101-105`), jedes echte Möbel
  deutlich höher; eine Schwelle nimmt künftige flache Objekte automatisch mit.
- **A6** [med] Ein Tier mit von Hand gesetzter Position (`state.tenantPos`, #39)
  wird beim Laden **nicht** automatisch nachjustiert, wohl aber, wenn danach ein
  Möbel auf es geschoben wird. Verworfen: beim Laden alles auflösen. Grund:
  sonst würde die in #39 bewusst getroffene Entscheidung des Kindes bei jedem
  Laden stillschweigend überschrieben — genau der Fehler, den #39 abstellt.
- **A7** [med] Der blockierte **Tierzug** meldet sich nur akustisch
  (`sfx.knock()`), ohne Toast. Verworfen: Toast pro blockiertem Schritt. Beleg:
  Toasts verschwinden nie von selbst und stapeln sich bis
  `TOAST_MAX_VISIBLE = 5` (`js/game.js` Toast-Block, Kommentar ab
  `js/game.js:679`); eine gedrückt gehaltene Pfeiltaste würde den Bildschirm
  zustellen.
- **A8** [low] Der Kollisionsvergleich ist rein zweidimensional (x/z) in
  Weltkoordinaten. Verworfen: volle 3D-Box3-Schnittprüfung. Beleg: die
  Wackel-Animation verändert `position.y` jeden Frame
  (`js/game.js:1208`), eine y-Bedingung würde flackern; Weltkoordinaten sind
  nötig, weil `floorGroups[k]` eine Zufallsrotation trägt (Kommentar
  `js/game.js:724-727`).
- **A9** [low] Ein ausgewichenes Tier bleibt an seinem neuen Platz und wird über
  `setTenantPos` gespeichert. Verworfen: Ausweichen nur für die Sitzung. Grund:
  sonst stünde das Tier nach dem Neuladen wieder im Möbel — der Ausgangsfehler.

## Consequences

- Der Einzug heilt sich selbst: `spawnTenant` setzt Tiere ohne gespeicherte
  Position nachträglich frei, womit auch das in #14 verbliebene Restproblem
  «voller Raum» verschwindet.
- `addItem` kann ein Möbel jetzt wieder zurücknehmen. Wunschprüfung
  (`checkWishes`) und Einzugsprüfung (`checkTenant`) müssen deshalb **nach** der
  Kollisionsauflösung laufen.
- Alle Möbelbewegungen laufen neu durch `applyMove`; jede künftige Bewegungsart
  muss diesen Rahmen benutzen, sonst umgeht sie die Prüfung.
- `state.tenantPos` kann nach einem Ausweichmanöver Einträge enthalten, obwohl
  das Kind das Tier nie selbst angefasst hat. Das ist gewollt (A9), heisst aber:
  die automatische Platzsuche aus #14 gilt für diese Wohnung ab da nicht mehr.
- Die Kollisionsprüfung kostet pro Zug eine `Box3.setFromObject`-Runde über die
  Möbel einer Wohnung — dieselbe Grössenordnung wie `surfaceYAt` heute pro
  Pfeiltastendruck (`js/game.js:415-426`).

## Acceptance Criteria

- [ ] Ein Tier lässt sich mit den Pfeiltasten **nicht** in ein Sofa schieben:
      die Position bleibt vor dem Möbel stehen, es ertönt `sfx.knock()`, und es
      erscheint **kein** Toast.
- [ ] Wird ein Möbel per «Verschieben», Pfeiltaste oder «Drehen» auf ein Tier
      geschoben, steht das Tier danach sichtbar daneben und überlappt das Möbel
      nicht mehr.
- [ ] Ein neu aus dem Katalog gesetztes Möbel, das auf einem Tier landen würde,
      lässt das Tier ausweichen.
- [ ] Ist die Wohnung so voll, dass kein freier Platz bleibt, wird der Möbelzug
      zurückgenommen (Möbel steht wieder am Ausgangsort bzw. wurde gar nicht
      erst gesetzt) und genau ein Toast mit dem Bewohnernamen erscheint.
- [ ] Ein zurückgenommenes neues Möbel erfüllt keinen Wunsch und löst keinen
      Einzug aus.
- [ ] Ein Tier darf auf einem Teppich stehen — der Teppich blockiert nicht.
- [ ] Deko lässt sich weiterhin auf Tisch, Regal, Schrank, Klavier und
      Nusskiste stellen; ihre `y` liegt über `baseY(k)`.
- [ ] Zwei Möbel dürfen sich weiterhin überlappen (keine Regression durch eine
      versehentliche Möbel-gegen-Möbel-Sperre).
- [ ] Zwei Tiere derselben Wohnung stehen nebeneinander, ohne sich gegenseitig
      wegzuschieben.
- [ ] Nach einem Ausweichmanöver und `location.reload()` steht das Tier immer
      noch am ausgewichenen Platz und nicht im Möbel.
- [ ] Ein Spielstand, dessen Tier laut `tenantPos` in einem Möbel steht, wird
      beim Laden **nicht** stillschweigend verschoben (A6).
- [ ] `version.js` ist unverändert, `CHANGELOG.md` hat einen Eintrag unter
      `## [Unreleased]` / `### Added` mit `(#40)`.
- [ ] Null `pageerror` im Playwright-Lauf.
