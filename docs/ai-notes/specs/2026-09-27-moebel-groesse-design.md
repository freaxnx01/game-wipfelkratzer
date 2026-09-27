# Spec — Möbel um Faktoren vergrössern (Issue #99)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #99, abgespalten aus #92 (Feedback-Sammlung vom 27.09.2026).
Der ganze Wortlaut: «Möbel um Faktoren vergrössern, z.B. x1.5, x2».

## Problem

Ein Möbel hat heute genau eine Grösse — die, die `makeFurniture(id, color)`
baut (`js/models.js:715-722`). Ein Kind kann ein Möbel verschieben
(`js/game.js:2246`), drehen (`js/game.js:2264`), umfärben
(`js/game.js:2271`) und wegräumen (`js/game.js:2274`), aber nicht grösser
machen. Ein Sofa bleibt ein Sofa-für-eine-Maus, auch wenn die Wohnung im
Erdgeschoss (8.6 × 5.6, `js/game.js:128-129`) dreimal so viel Platz hätte wie
im obersten Stockwerk (4.9 × 3.92, `js/game.js:126`).

Der Wunsch ist damit kein Modell-Wunsch, sondern ein Spielwunsch: dasselbe
Möbel in mehreren Grössen aufstellen können — ein Riesen-Bett fürs Erdgeschoss,
ein winziger Tisch in der Dachkammer.

## Nachbarwunsch #100 — bewusst nicht Teil dieser Spec

Issue #100 («Tisch und Sofa in die Länge ziehen oder kürzen») kommt aus
derselben Feedback-Sammlung #92 und wird **parallel** von einer anderen Sitzung
angereichert. Der Unterschied ist wichtig:

- **#99 (hier):** *gleichmässig* grösser — alle drei Achsen mit demselben
  Faktor. Ein Stuhl wird zum Riesenstuhl und bleibt ein Stuhl.
- **#100:** *ungleichmässig* länger — nur die Längsachse. Ein Tisch wird zur
  Tafel und behält Höhe und Tiefe.

Beides sind Faktoren am selben Mesh, also darf diese Spec #100 nicht
zubetonieren. Der Zuschnitt dafür steht unter E7.

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründungen stehen jeweils
dabei, damit sie widerlegbar sind.

- **E1 — Die Grösse ist ein optionales Zahlenfeld `scale` am Möbel-Eintrag,
  Fehlen heisst «normal» (1).** Verworfen: ein eigener Katalogeintrag pro Grösse
  («Grosses Sofa»). Der Katalog ist eine flache Liste von 45 Einträgen
  (`js/models.js:638-677`); drei Grössen wären 135 Einträge und drei Modelle
  pro Möbel. Das Muster für ein optionales Feld am Eintrag gibt es schon
  zweimal: `color` (`js/game.js:563-566`) und `fill` (`js/game.js:1503`) —
  fehlend ist gültig und heisst «Standard», ein unbekannter Wert wird still
  entfernt und der bereinigte Stand einmalig zurückgeschrieben (`migrated`,
  `js/game.js:2808`).

- **E2 — Es gibt drei feste Stufen: 1×, 1,5×, 2×.** Verworfen: ein Schieberegler
  mit stufenlosen Werten. Der Wunsch nennt ausdrücklich Faktoren («z.B. x1.5,
  x2»); feste Stufen sind auf dem Handy mit dem Finger treffbar (die
  Auswahlleiste hält `min-height: 44px` ein, `index.html:96`), sie sind eine
  Positivliste für die Prüfung der Sicherungsdatei, und sie machen «zurück auf
  normal» zu einem sichtbaren Knopf statt zu einer Zielsuche. Verworfen:
  zusätzliche Verkleinerungsstufen (0,75×, 0,5×). Der Wunsch sagt
  «vergrössern»; kleiner-als-normal ist ein eigener Wunsch und würde hier
  ungefragt Umfang hinzufügen.

- **E3 — Bedient wird die Grösse wie die Farbe: ein Knopf «Grösse» in der
  Auswahlleiste öffnet eine schwebende Reihe mit den drei Stufen.** Verworfen:
  ein Knopf, der bei jedem Druck eine Stufe weiterschaltet (wie «Drehen»,
  `js/game.js:2264`). Eine Reihe zeigt, welche Stufe gerade gilt, und erlaubt
  den Sprung zurück auf 1× mit einem Druck statt mit dreien. Das Vorbild ist
  `#colorpick` (`index.html:354`, `js/game.js:1438-1450`) — dieselbe Machart,
  derselbe Platz über der Leiste, dieselbe `.on`-Markierung für die aktive
  Stufe.

- **E4 — Nur frei stehende Möbel sind skalierbar: keine Wandobjekte, keine
  Tiere.** Verworfen: alles skalierbar. Ein Wandobjekt wird nicht über seine
  Box begrenzt, sondern über feste Wandkonstanten (`wallPlacement`,
  `js/game.js:544-551`: `half = W(k)/2 - 0.55`, Wandebene bei ±0.125) — ein
  doppelt so dickes Poster stünde in der Wand. Tiere sind Bewohner, keine
  Möbel; sie tragen bewusst kein `id`-Feld (`js/game.js:1651-1653`) und haben
  keine Knöpfe für Farbe oder Wegräumen (`js/game.js:1336`). Der Knopf wird
  darum genauso versteckt wie `btn-move`/`btn-rot` bei Wandobjekten
  (`js/game.js:1332-1335`).

- **E5 — Die Grösse geht durch dieselbe Ablehnungsmaschinerie wie jede andere
  Bewegung: `applyMove` mit Rücknahme, `meldeBlockade()` bei Ablehnung.**
  Verworfen: unbegrenzt wachsen lassen. `applyMove` (`js/game.js:734-742`)
  sichert `x/z/y/rot/wall`, führt die Änderung aus, lässt `resolveItemMove`
  prüfen und stellt bei `false` den alten Stand wieder her. Das deckt den Fall
  «das gewachsene Möbel drückt ein Tier an die Wand» (`js/game.js:1628-1641`)
  ohne eine Zeile neuer Kollisionslogik ab, weil alle Boxen über
  `Box3.setFromObject` laufen (`js/game.js:678-687`) und die Skalierung des
  Gruppenknotens damit automatisch mitrechnen. `scale` muss dafür in den
  Sicherungsschnappschuss von `applyMove` aufgenommen werden.

- **E6 — Zusätzlich zur Kollision gibt es eine Deckenprüfung in den
  Stockwerken.** Verworfen: nur seitlich begrenzen. `clampEntry` begrenzt
  ausschliesslich x und z (`js/game.js:692-704`); ein doppelt so hoher Schrank
  würde durch die Decke stossen. Die lichte Höhe ist `H(k)` (`js/game.js:14`:
  2.4 im Erdgeschoss, sonst 2.0). Eine Stufe, deren Box höher als
  `H(k) - 0.1` wäre, wird abgelehnt — mit Ton und einer freundlichen Meldung
  statt eines stillen Nichts. Auf dem Dach und im Garten entfällt die Prüfung,
  dort ist Himmel.

- **E7 — `scale` bleibt ein *einzelner, gleichmässiger* Zahlwert, und die
  Skalierung wird an **einer** Stelle angewendet: `applyEntryScale(mesh,
  entry)`.** Verworfen: schon jetzt einen Vektor `{x, y, z}` speichern, um
  #100 vorzugreifen. Das wäre ungefragte Flexibilität, und #100 ist noch nicht
  entschieden — vielleicht wird daraus ein Ziehen an einer Kante und gar kein
  Faktor. Was diese Spec #100 schuldet, ist kein Datenfeld, sondern eine
  einzige Fundstelle: solange jede Skalierung durch `applyEntryScale` läuft,
  wird aus `m.scale.setScalar(s)` später ein `m.scale.set(s * laenge, s, s)`,
  und alle Aufrufer (Aufbau, Neubau nach Farbwechsel, Einfahr-Animation)
  erben es. Der Grössen-Wähler bleibt ausserdem eine eigene UI-Reihe, damit
  #100 eine eigene Bedienung bekommen kann, ohne diese umzubauen.

- **E8 — Die Sicherungsdatei kennt das Feld, und die Stufenliste wird aus
  `js/models.js` exportiert.** Verworfen: die Stufen in `js/game.js` zu
  definieren und in `js/standdatei.js` von Hand zu spiegeln. `standdatei.js`
  hält es ausdrücklich so, dass «die erlaubten Werte alle aus models.js
  kommen, damit ein neues Möbel oder eine neue Tapete nicht zusätzlich hier
  nachgetragen werden muss» (`js/standdatei.js:5-7`) — `FURN_COLORS` ist das
  laufende Beispiel (`js/standdatei.js:28`, `js/standdatei.js:166`).

## Datenmodell

Ein Möbel-Eintrag in `state.rooms[k]` sieht heute so aus
(`js/game.js:1495-1503`):

```js
{ id: 'sofa', cell: 2, x: -1.2, z: 0.4, rot: 0, y: 0.155 }   // color/fill optional
```

Neu kommt genau ein optionales Feld dazu:

```js
{ id: 'sofa', cell: 2, x: -1.2, z: 0.4, rot: 0, y: 0.155, scale: 1.5 }
```

Regeln:

- **Fehlt `scale`, gilt 1.** Alte Spielstände sind damit unverändert gültig und
  werden nicht angefasst.
- **`scale === 1` wird nicht geschrieben**, sondern gelöscht. Sonst wüchse
  jeder Stand um ein Feld pro Möbel, obwohl `localStorage` knapp ist
  (`js/staende.js:5-6`).
- **Erlaubt sind nur die Werte aus `FURN_SIZES`.** Ein fremder Wert wird beim
  Laden still entfernt (`normalizeSize`, Vorbild `normalizeColor`,
  `js/game.js:563-566`) und beim Einlesen einer Sicherungsdatei nicht
  übernommen (`bereinigeMoebel`, `js/standdatei.js:143-168`).

`FURN_SIZES` in `js/models.js`, neben `FURN_COLORS` (`js/models.js:52-60`):

```js
export const FURN_SIZES = [
  { f: 1,   name: 'Normal' },
  { f: 1.5, name: 'Gross' },
  { f: 2,   name: 'Riesig' },
];
```

## Was mitwächst, ohne dass man es anfasst

Diese Liste ist der eigentliche Grund, warum die Skalierung am Gruppenknoten
und nicht an den Einzelteilen sitzt — alles hier rechnet bereits über
`Box3.setFromObject`, das die Skalierung des Knotens berücksichtigt:

| Verhalten | Fundstelle | Wirkung |
|---|---|---|
| Begrenzung an Wand und Kante | `clampEntry`, `js/game.js:692-704` | Ein grosses Möbel hält von selbst mehr Abstand zur Wand |
| Kollision mit Tieren | `solidBoxes`/`tenantBlocked`, `js/game.js:678-692` | Ein grosses Möbel verdrängt Tiere |
| Ablagehöhe für Deko | `surfaceYAt`, `js/game.js:620-631` | Die Vase liegt auf der Platte des grossen Tisches, nicht in der Luft |
| Auswahlrahmen | `THREE.BoxHelper`, `js/game.js:1330` | Der rote Rahmen wächst mit (`selHelper.update()`) |
| Garten-Begrenzung | `js/game.js:651-670` | Rechnet ohnehin mit der echten Box statt mit halben Breiten |
| Raum kopieren | tiefe Kopie, `js/game.js:1346ff.` | Die Grösse wird mitkopiert |

Umgekehrt: **nichts an den Einzelteilen skalieren.** Die Schaltzustände greifen
in Kinder ein (`applyWanne` setzt `w.scale.y`, `js/game.js:759`;
`applyFenster` dreht den Flügel, `js/game.js:766`; `setFill` beim Pool,
`js/game.js:810`). Ein Faktor auf dem Elternknoten lässt all das unberührt.

## Bedienung

Die Auswahlleiste `#selbar` (`index.html:345-357`) bekommt einen Knopf
zwischen «Farbe» und «Weg damit»:

```text
┌──────────────────────────────────────────────────────────────┐
│               ( 1× ) ( 1,5× ) ( 2× )      ← #sizepick        │
├──────────────────────────────────────────────────────────────┤
│ Verschieben │ Drehen │ Farbe │ Grösse │      Weg damit       │
└──────────────────────────────────────────────────────────────┘
```

- `#btn-size` («Grösse») ist versteckt bei Wandobjekten und bei Tieren (E4),
  genau wie `#btn-color` bei nicht einfärbbaren Möbeln versteckt ist
  (`js/game.js:1335`).
- `#sizepick` liegt wie `#colorpick` absolut über der Leiste
  (`index.html:105-107`) und öffnet sich beim Druck auf den Knopf. Die beiden
  Reihen schliessen einander aus — eine offene Farbreihe geht zu, wenn die
  Grössenreihe aufgeht, und umgekehrt. Sonst überlagern sich zwei absolut
  positionierte Kästen am selben Platz.
- `deselect()` (`js/game.js:1327-1328`) schliesst beide Reihen.
- Die aktive Stufe trägt `class="on"`, wie der aktive Farbpunkt.

Nach einer angenommenen Stufe: Mesh neu skaliert, `selHelper.update()`,
`sfx.pop()`, `save()`. Nach einer abgelehnten Stufe: `meldeBlockade()` (Klopfen
+ Meldung), das Möbel bleibt in seiner alten Grösse, die Reihe bleibt offen und
markiert weiterhin die alte Stufe.

Meldungen (deutsch, Spielersicht, `ss` statt `ß`):

- Decke zu niedrig: «So gross passt das nicht unter die Decke.»
- Kein Platz (Tier im Weg): kommt aus `resolveItemMove` und lautet dort schon
  «Hier ist kein Platz — <Name> steht im Weg!» (`js/game.js:1637`).

## Ablauf einer Grössenänderung

```text
Druck auf 1,5×
  └─ applyMove(selected, () => {
        entry.scale = 1.5
        applyEntryScale(mesh, entry)      ← einzige Skalier-Fundstelle (E7)
        clampEntry(k, mesh, entry)        ← rückt das Möbel von der Wand weg
     })
        ├─ Deckenprüfung (nur Stockwerke)  → zu hoch?  ⇒ false
        └─ resolveItemMove                 → Tier eingeklemmt? ⇒ false
  ├─ true  → selHelper.update(); sfx.pop(); save()
  └─ false → applyMove stellt scale/x/z/y wieder her, Mesh zurückskalieren,
             meldeBlockade()
```

Wichtig: `applyMove` nimmt heute nur `{x, z, y, rot, wall}` zurück
(`js/game.js:736`). `scale` muss in den Schnappschuss, und der
Wiederherstellungspfad (`replaceMesh`, `js/game.js:708-714`) muss
`applyEntryScale` aufrufen — sonst bleibt bei einer Ablehnung der Eintrag klein
und das Mesh gross.

## Aufbau beim Laden und beim Neubau

`placeItemMesh` (`js/game.js:791-816`) ist der einzige Weg zu einem
Möbel-Mesh — auch der Farbwechsel geht darüber (`rebuildItemMesh`,
`js/game.js:1540-1549`, mit dem Kommentar «ein zweiter, halber Pfad wäre die
Fehlerquelle»). Dort kommen zwei Zeilen dazu: `normalizeSize(entry)` neben
`normalizeColor(entry)` und `applyEntryScale(m, entry)` vor dem Einhängen.

Die Einfahr-Animation in `addItem` (`js/game.js:1525-1526`) skaliert das Mesh
von 0.01 auf 1 hoch. Sie muss auf die Zielgrösse hochfahren, nicht auf 1 —
sonst schrumpft ein grosses Möbel beim Hinstellen. Ein frisch hingestelltes
Möbel hat allerdings nie eine Grösse (`addItem` legt den Eintrag ohne `scale`
an), also ist das heute ein Faktor 1; es wird trotzdem korrekt geschrieben,
damit ein späterer Aufrufer (Raum einfügen, #100) nicht darüber stolpert.

## Sicherungsdatei

`bereinigeMoebel` (`js/standdatei.js:143-168`) bekommt eine Zeile in der
Machart der Farbzeile:

```js
if (GROESSEN.has(e.scale)) eintrag.scale = e.scale;
```

mit `const GROESSEN = new Set(FURN_SIZES.map(s => s.f));` neben
`FARBEN` (`js/standdatei.js:28`). Der Wert 1 fällt dabei nicht auf — er ist
gültig und wird beim Laden von `normalizeSize` entfernt.

Die Dateiversion `DATEI_V` (`js/standdatei.js:12`) bleibt **2**. Sie zählt
nicht jede Feldergänzung, sondern Formatbrüche — der Kommentar dort nennt als
Beispiel «Tapete pro Wand» statt «Tapete als String». Ein zusätzliches
optionales Feld bricht nichts: eine neue Datei in einem alten Spiel verliert
nur die Grössen, weil `bereinigeMoebel` sie nicht kennt. Eine Erhöhung würde
dagegen dazu führen, dass ein altes Spiel die ganze Datei mit «Diese Datei
kommt aus einer neueren Version des Spiels» ablehnt
(`js/standdatei.js:77`) — deutlich schlechter.

## Umfang

**Dazu gehört:**

- `FURN_SIZES` in `js/models.js`
- `normalizeSize` + `applyEntryScale` + Anwendung in `placeItemMesh` und
  `replaceMesh` in `js/game.js`
- `scale` im Schnappschuss von `applyMove`
- Deckenprüfung für Stockwerke
- Knopf `#btn-size` + Reihe `#sizepick` in `index.html` (Markup + CSS) und ihre
  Bedienung in `js/game.js`
- Whitelisting in `js/standdatei.js`
- Eintrag in `CHANGELOG.md` unter `## [Unreleased]` → `### Added`

**Nicht dazu gehört:**

- Ungleichmässiges Strecken in die Länge (Issue #100)
- Verkleinern unter 1× (E2)
- Grössen für Wandobjekte oder Tiere (E4)
- Grösse für ganze Räume, Stockwerke oder den Turm
- Eine Grösse im Katalog vorwählen, bevor das Möbel steht
- `version.js` oder ein `chore(release)`-Commit

## Abnahmekriterien

- [ ] Ein ausgewähltes, frei stehendes Möbel zeigt in der Auswahlleiste den
      Knopf «Grösse»; ein Druck öffnet eine Reihe mit `1×`, `1,5×` und `2×`,
      und die aktuelle Stufe ist markiert.
- [ ] Ein Druck auf `1,5×` bzw. `2×` macht das Möbel sofort sichtbar grösser
      (Box3-Breite wächst um den Faktor), der rote Auswahlrahmen wächst mit,
      und ein Druck auf `1×` bringt es in einem Schritt zurück.
- [ ] Die Grösse übersteht ein Neuladen der Seite: nach `1,5×` und Reload steht
      das Möbel weiterhin in 1,5×, und `state.rooms[k]` trägt `scale: 1.5`.
- [ ] Bei `1×` steht **kein** `scale`-Feld im Eintrag, und ein Spielstand ohne
      `scale` wird beim Laden nicht umgeschrieben.
- [ ] Ein vergrössertes Möbel an der Wand wird von `clampEntry` nach innen
      gerückt und ragt nicht durch die Wand.
- [ ] Eine Stufe, die nicht mehr unter die Decke passt, wird abgelehnt: das
      Möbel bleibt in seiner alten Grösse, es klopft, und die Meldung «So gross
      passt das nicht unter die Decke.» erscheint.
- [ ] Wird durch das Wachsen ein Tier eingeklemmt, das nicht ausweichen kann,
      wird die Stufe abgelehnt und Eintrag *und* Mesh stehen wieder auf der
      alten Grösse (kein grosses Mesh mit kleinem Eintrag).
- [ ] Ein Wandobjekt (z.B. `uhr`) und ein Tier zeigen den Knopf «Grösse»
      nicht.
- [ ] Ein Deko-Objekt, das auf einen auf `2×` vergrösserten Tisch gestellt
      wird, liegt auf dessen Platte (`surfaceYAt` liefert die neue Höhe).
- [ ] Farbreihe und Grössenreihe sind nie gleichzeitig offen, und `deselect()`
      schliesst beide.
- [ ] Ein Turm mit vergrösserten Möbeln lässt sich sichern und wieder
      einlesen; die Grössen sind danach dieselben.
- [ ] Eine von Hand auf `scale: 7` verbogene Sicherungsdatei wird eingelesen,
      das Möbel steht in Normalgrösse, nichts bricht.
- [ ] Die Konsole bleibt beim Laden und über alle Schritte hinweg frei von
      `pageerror`.
- [ ] `CHANGELOG.md` hat unter `## [Unreleased]` → `### Added` einen Eintrag in
      Spielersicht mit `(#99)`.

## Risiken

- **Der Sichtprüfung entgeht ein Faktor an der falschen Stelle.** Wird die
  Skalierung versehentlich auf ein Kind statt auf die Gruppe gelegt, sieht es
  in der Szene richtig aus, aber `Box3.setFromObject` liefert trotzdem das
  Richtige — der Fehler fiele erst bei der Badewanne oder dem Pool auf.
  Gegenmittel: die Abnahme misst `mesh.scale.x` am Gruppenknoten aus dem
  Debug-Hook (`window.wipfelkratzer.itemMeshes`, `js/game.js:2824`), nicht nur
  die Box.
- **Rücknahme halb gemacht.** Der klassische Fehler ist ein abgelehnter Schritt,
  bei dem `entry.scale` zurückgesetzt wird, das Mesh aber gross bleibt. Die
  Abnahme prüft darum ausdrücklich beides.
- **Zwei offene Kästen übereinander.** `#colorpick` und `#sizepick` teilen sich
  denselben Platz über der Leiste; ohne gegenseitiges Schliessen überlagern sie
  sich. Die Abnahme prüft das.
