# Spec — Wand-Objekte erst nach Wandwahl platzieren (Issue #11)

Repo: `game-wipfelkratzer`. Base: `main`, v0.3.0. Buildless vanilla:
`index.html` + `js/game.js` + `js/models.js`. three.js r184 via importmap. No
build step, no test framework.

## Problem

Wand-Objekte (`WALL_ITEMS` — Poster, Wanduhr, Spiegel, Fenster;
`js/models.js:217`) land beim Antippen im Katalog immer an der **Rückwand**,
egal welche Wand aktuell gewählt ist:

- `addItem()` (`js/game.js:578-606`) setzt für jedes neue Wand-Objekt hart
  `entry.z = wallZ(k)` (`js/game.js:585`), wobei `wallZ = k => -D(k)/2 +
  0.125` (`js/game.js:366`) ausschliesslich die Rückwand beschreibt.
- `clampEntry()` (`js/game.js:415-418`) verstärkt das: für jedes
  `WALL_ITEMS`-Entry wird `en.z = wallZ(k)` und **`en.rot = 0`** erzwungen —
  unabhängig davon, was gespeichert war. Die Funktion geht von genau einer
  Wand aus.
- Die Wandwahl selbst existiert bereits seit v0.2.0 für Tapeten:
  `wallTarget` / `setWallTarget()` (`js/game.js:384-393`), eine Knopfreihe im
  «Tapete»-Tab (`js/game.js:496-501`) und das Antippen einer Wand in 3D via
  `pickWall()` (`js/game.js:852-857`, aufgerufen in der
  `pointerup`-Behandlung `js/game.js:871-877`). v0.3.0 hat dort zusätzlich
  geregelt, wann ein Wand-Tap den Katalog-Tab wechselt (#8) — **das bleibt
  unverändert**, dieser Mechanismus wird nur für Wand-Objekte mitbenutzt statt
  neu erfunden.
- `wallTarget` wird von `addItem()` heute komplett ignoriert: egal welche Wand
  zuletzt gewählt wurde (per Tap oder Tapete-Tab), ein neues Wand-Objekt
  erscheint immer hinten.

**Gewünscht** (Issue-Text): zuerst die Wand wählen, dann platzieren — das
Objekt erscheint auf der gewählten Wand.

## Goals

- Ein neu platziertes Wand-Objekt erscheint auf der Wand, die über
  `wallTarget` aktuell gewählt ist (per 3D-Tap oder Knopfreihe), nicht mehr
  hart an der Rückwand.
- Die Wandwahl ist im «Wand»-Katalog-Tab genauso entdeckbar wie im
  «Tapete»-Tab: eine Knopfreihe mit den vier Wänden, plus das bereits
  bestehende Antippen der Wand in 3D.
- Bereits platzierte Wand-Objekte lassen sich weiter nur entlang **ihrer
  eigenen** Wand und in der Höhe verschieben (`moveWallItem`,
  `js/game.js:920-926`) — Verhalten bleibt gleich, nur bezogen auf die
  jeweils richtige Wand statt implizit die Rückwand.
- Alle vier Wände (`back`, `left`, `right`, `front`; `WALL_KEYS`,
  `js/game.js:15`) sind als Ziel für Wand-Objekte gültig, inklusive `front`
  (siehe Design-Abschnitt zu den Konsequenzen dort).
- Bestehende Spielstände mit Wand-Objekten an der Rückwand laden unverändert
  und sehen optisch identisch aus (kein Sprung, keine Migration nötig, siehe
  Assumptions A7).

## Non-goals

- Keine Änderung an der Boden-/Deko-/Möbel-Platzierung (Zellen-Raster,
  `cellPos`/`freeCell`, `js/game.js:359-361, 437-439`) — nur `WALL_ITEMS`
  sind betroffen.
- Keine Änderung an der Sichtbarkeits-Politik der Frontwand während des
  Bearbeitens (`front.visible = !(edit && edit.k === j)`, `js/game.js:529`)
  — dieses Verhalten existiert bewusst, damit man beim Editieren in den Raum
  hineinsehen kann, und bleibt unangetastet.
- Keine neue manuelle Dreh-Funktion für Wand-Objekte — «Drehen» bleibt für
  Wand-Objekte ausgeblendet (`js/game.js:574`), die Rotation wird weiterhin
  automatisch aus der gewählten Wand abgeleitet, nur eben nicht mehr immer
  `0`.
- Keine Änderung an #8 (Tab-Wechsel beim Wand-Tap) — Issue #11 grenzt sich im
  eigenen Text explizit davon ab.
- Keine eigene Migration/Batch-Umschreibung bestehender `rooms`-Einträge beim
  Laden — Rückwärtskompatibilität läuft über einen verträglichen Default,
  nicht über einen Migrationsdurchlauf (siehe A7).
- Kein neuer Katalog-Inhalt (keine neuen `WALL_ITEMS`-IDs).

## Design

### Wandwahl wiederverwenden statt neu bauen

`wallTarget`/`setWallTarget()` (`js/game.js:384-393`) wird der einzige
Zustand, der bestimmt, auf welche Wand ein neues Wand-Objekt kommt. Das
Antippen einer Wand in 3D setzt `wallTarget` bereits heute für **jeden**
Katalog-Tab (nicht nur «Tapete»): der `else`-Zweig in der
`pointerup`-Behandlung (`js/game.js:876`) ruft `setWallTarget(wallKey)` auch
auf, wenn `catTab === 'wand'` ist. Das bleibt so; ergänzt wird nur ein Toast,
der das für Kinder sichtbar macht (siehe Task-Liste im Plan).

`'alle'` (der Default und die Tapete-Vorgabe, `js/game.js:384`) ist für ein
einzelnes Objekt bedeutungslos — ein Poster hängt nie an "allen Wänden".
Beim Platzieren eines Wand-Objekts wird `wallTarget === 'alle'` daher auf
`'back'` aufgelöst (siehe A2).

### Katalog-UI: Knopfreihe auch im «Wand»-Tab

`renderCatalog()` (`js/game.js:480-516`) zeigt die Wand-Knopfreihe aktuell
nur für `catTab === 'farbe'` (`js/game.js:489-503`, das `pick`-Div mit
`'alle'` + `WALL_KEYS`). Für `catTab === 'wand'` wird dieselbe Reihe ergänzt,
aber **ohne** die `'alle'`-Option (vier Knöpfe statt fünf), mit derselben
`b.onclick = () => setWallTarget(key)`-Verdrahtung und Hervorhebung der
aktuell gewählten Wand (`key === wallTarget`, mit `'alle'` visuell auf
`'back'` abgebildet, da `'alle'` in diesem Tab nie aktiv angezeigt wird).
Ein Hinweistext (`hint`-Absatz wie in `js/game.js:493-494`) erklärt: „Welche
Wand? Du kannst sie auch direkt antippen.“ — identischer Wortlaut wie im
Tapete-Tab, weil es exakt derselbe Mechanismus ist.

### Geometrie: eine Wand-Ebene pro `WALL_KEYS`-Eintrag statt nur `wallZ`

`wallZ(k)` (`js/game.js:366`) kennt nur die Rückwand. Die drei anderen Wände
sind in der Geometrie bereits vorhanden (`js/game.js:252-272`):

- **Rückwand-Panel**: `z = -d/2 + WALL_T - WALL_PANEL/2` (≈ `wallZ(k)`,
  `js/game.js:264`).
- **Frontwand-Panel**: Kind der `front`-Gruppe
  (`front.position.z = d/2 - 0.06`, `js/game.js:270`), Panel lokal bei
  `z = 0.06 - WALL_T + WALL_PANEL/2` (`js/game.js:272`) → Weltkoordinate
  symmetrisch zur Rückwand.
- **Links-/Rechts-Panel**: `x = ±(w/2 - WALL_T + WALL_PANEL/2)`
  (`js/game.js:265-268`), über die volle Tiefe `d`.

Ein neuer Helfer bildet `(k, wallKey)` auf die feste Achse + Rotation ab
(Konstanten analog zu `wallZ`, symmetrisch abgeleitet von `W(k)`/`D(k)`):

| Wand    | fixe Achse            | Rotation (`rot`) | freie Achse (`along`) |
|---------|------------------------|------------------|------------------------|
| `back`  | `z = -D(k)/2 + 0.125`  | `0`              | `x`, Bereich `±(W(k)/2 - 0.55)` |
| `front` | `z = D(k)/2 - 0.125`   | `π`              | `x`, Bereich `±(W(k)/2 - 0.55)` |
| `left`  | `x = -W(k)/2 + 0.125`  | `π/2`            | `z`, Bereich `±(D(k)/2 - 0.55)` |
| `right` | `x = W(k)/2 - 0.125`   | `-π/2`           | `z`, Bereich `±(D(k)/2 - 0.55)` |

(Die genauen Konstanten übernimmt der implementierende Task 1:1 aus der
bestehenden Panel-Geometrie, `js/game.js:261-272`; die Tabelle beschreibt nur
das Prinzip, nicht verbindliche Literale.)

`clampEntry()` (`js/game.js:415-418`) und `addItem()`
(`js/game.js:585-589`) werden auf diese Tabelle umgestellt, parametrisiert
über `en.wall` (neues Feld, siehe unten) statt hart die Rückwand anzunehmen.
`entry.x` bleibt semantisch „Position entlang der gewählten Wand“ — für
`back`/`front` ist das exakt die heutige Weltkoordinate `x` (keine
Änderung); für `left`/`right` wird `entry.x` neu als Offset entlang `z`
interpretiert. Das hält alte Rückwand-Speicherstände 1:1 kompatibel (A4).

`moveWallItem()` (`js/game.js:920-926`) und die Tastatursteuerung
(`js/game.js:932-939`) ändern sich **nicht** — sie addieren weiterhin auf
`en.x` (die „along“-Achse) und rufen `clampEntry()` auf, das die
Weltkoordinaten aus `en.wall` neu ableitet.

### Neues Datenfeld `entry.wall`

Jedes `WALL_ITEMS`-Entry bekommt ein `wall`-Feld (`'back'|'left'|'right'|
'front'`). Für neue Objekte setzt `addItem()` es beim Anlegen
(`wallTarget === 'alle' ? 'back' : wallTarget`). Für alte Einträge ohne
`wall` (jeder bestehende Spielstand) liest `clampEntry()` es defensiv als
`en.wall || 'back'` — genau die Wand, an der alte Objekte ohnehin schon
hingen. Es gibt **keinen** proaktiven Migrationsdurchlauf beim Laden
(`js/game.js:1042` ruft `placeItemMesh()` direkt mit den gespeicherten
Rohkoordinaten auf, ohne `clampEntry()` — alte Einträge rendern also exakt
wie bisher, bis sie zum ersten Mal bewegt/gedreht werden, siehe A7).

`addItem()`s „möglichst weit von anderen Wand-Objekten entfernt platzieren“-
Heuristik (`taken`, `js/game.js:586-588`) filtert neu zusätzlich auf
`(e.wall || 'back') === wall`, damit die Abstandsberechnung nur Objekte an
**derselben** Wand berücksichtigt (ein Poster an der linken Wand soll nicht
vor einer Wanduhr an der Rückwand ausweichen).

### Rotation aus der Wand ableiten

`clampEntry()` erzwingt aktuell `en.rot = 0` für jedes Wand-Objekt
(`js/game.js:417`). Das wird durch die pro-Wand-Rotation aus obiger Tabelle
ersetzt, damit das Objekt an `left`/`right`/`front` tatsächlich in den Raum
hinein zeigt statt weiter mit der Rückwand-Ausrichtung durch die tragende
Wand zu clippen. `btn-rot` bleibt für Wand-Objekte ausgeblendet
(`js/game.js:574`, unverändert) — die Rotation ist weiterhin nicht manuell
wählbar, nur eben korrekt statt konstant `0`.

### Konsequenz: `front` ist unsichtbar während des eigenen Edit-Modus

`front.visible = !(edit && edit.k === j)` (`js/game.js:529`) blendet die
Frontwand genau dann aus, wenn dieses Stockwerk gerade bearbeitet wird —
damit man beim Einrichten in den Raum hineinsehen kann. Wand-Objekte hängen
nicht in dieser `front`-Gruppe, sondern direkt in `floorGroups[k]`
(`placeItemMesh`, `js/game.js:427-436`), sind also von dieser
Sichtbarkeits-Regel unabhängig: ein an `front` platziertes Objekt bleibt
während des Bearbeitens sichtbar, aber **ohne sichtbare Wand dahinter** — es
wirkt schwebend, bis man den Editiermodus verlässt und die Frontwand wieder
erscheint (dann sitzt es korrekt davor).

Das ist als kosmetischer, editiermodus-lokaler Nebeneffekt akzeptiert (siehe
A6) statt behoben, weil die einzige Alternative — das Objekt stattdessen in
die `front`-Gruppe zu hängen — es beim Bearbeiten komplett unsichtbar machen
würde: schlechter für ein Kind, das gerade genau dieses Objekt platziert
oder verschiebt. Ein kurzer Toast beim Wählen von `front` im «Wand»-Tab
reduziert die Verwirrung (siehe Plan, Task 3).

## Acceptance Criteria

- Ein neues Wand-Objekt (`WALL_ITEMS`) erscheint auf der Wand, die
  `wallTarget` im Moment des Antippens im Katalog trägt — für alle vier
  Wände (`back`, `left`, `right`, `front`), nicht nur `back`.
- Ist `wallTarget === 'alle'` (Default), landet ein neues Wand-Objekt an der
  Rückwand (`back`) — unverändertes Verhalten für den unkonfigurierten Fall.
- Der «Wand»-Katalog-Tab zeigt eine Knopfreihe mit den vier Wänden (ohne
  «Alle Wände»); ein Klick setzt `wallTarget` und hebt den passenden Knopf
  hervor, identisch zur bestehenden Tapete-Knopfreihe.
- Das Antippen einer sichtbaren Wand in 3D setzt `wallTarget`, egal welcher
  Katalog-Tab offen ist (bestehendes Verhalten, unverändert getestet).
- Ein auf `left`/`right`/`front` platziertes Objekt ist korrekt zur
  Raummitte gedreht (nicht mit der Rückwand-Ausrichtung `rot = 0` verclippt)
  und bleibt beim Verschieben (`moveWallItem`) auf seiner eigenen Wand.
- Bereits gespeicherte Wand-Objekte (aus v0.3.0 oder älter, ohne `wall`-Feld)
  laden unverändert an derselben Position/Wand wie vorher — kein
  sichtbarer Sprung, kein Fehler.
- Zwei Wand-Objekte an unterschiedlichen Wänden beeinflussen sich beim
  automatischen Abstand-Finden (`addItem`s `taken`-Logik) nicht gegenseitig.
- Zero uncaught `pageerror` events über den gesamten geskripteten Durchlauf
  (Katalogwechsel, Platzieren auf allen vier Wänden, Verschieben, Speichern,
  Neuladen).

## Assumptions

- **A1** [high] Wiederverwendung von `wallTarget`/`setWallTarget()` als
  einzigem Auswahlzustand für Wand-Objekte, statt eines separaten
  `objWallTarget`. Rejected: eigener Zustand parallel zu `wallTarget`.
  `js/game.js:384-393` und der `else`-Zweig in `js/game.js:871-877` zeigen,
  dass `wallTarget` bereits heute bei jedem Wand-Tap aktualisiert wird,
  unabhängig vom aktiven Katalog-Tab.

- **A2** [high] `wallTarget === 'alle'` wird beim Platzieren eines
  Wand-Objekts auf `'back'` aufgelöst. Rejected: Platzieren blockieren, bis
  explizit eine Einzelwand gewählt ist (zu viel Reibung für ein Kind, das
  einfach auf ein Katalog-Item tippt). `js/game.js:398` zeigt, dass `'alle'`
  nur für `setLook` (Tapete auf allen vier Wänden) sinnvoll ist.

- **A3** [high] Neue Knopfreihe im «Wand»-Tab, identisch zur bestehenden
  Tapete-Knopfreihe (`js/game.js:496-501`), aber ohne die
  `'alle'`-Option — vier Knöpfe statt fünf. Rejected: nur auf 3D-Wandtaps
  verlassen (schlecht erreichbar für ein Kind, insbesondere für `front`,
  die während des Bearbeitens unsichtbar und daher gar nicht antippbar ist).

- **A4** [med] `entry.x` bleibt das Datenfeld für „Position entlang der
  gewählten Wand“ (statt eines neuen Felds), zusammen mit neuem
  `entry.wall`. Für `back`/`front` ist das weiterhin exakt die Welt-`x`; für
  `left`/`right` wird es als Offset entlang `z` interpretiert. Rejected:
  getrenntes Speichern von Welt-`x`/`z` je Wand — mehr Zustand, der
  synchron gehalten werden müsste. `js/game.js:415-418, 585-589` zeigen,
  dass `entry.x` heute schon exakt die Welt-`x` der Rückwand-Position ist.

- **A5** [med] `entry.rot` wird für Wand-Objekte wand-abhängig statt fest
  `0` (`back=0, front=π, left=π/2, right=-π/2`), weiterhin nicht manuell
  über «Drehen» wählbar (`js/game.js:574` bleibt unverändert). Rejected:
  `rot = 0` für alle Wände beibehalten — würde Objekte an `left`/`right`/
  `front` falsch ausgerichtet durch die tragende Wand zeigen lassen.
  `js/game.js:416-418` erzwingt heute `rot = 0` unabhängig vom Gespeicherten.

- **A6** [med] Wand-Objekte an `front` bleiben während des Bearbeitens
  dieses Stockwerks sichtbar, aber ohne sichtbare Frontwand dahinter
  (schwebender Look), statt sie in die `front`-Gruppe umzuhängen. Rejected:
  Parenting unter `front` (`js/game.js:270`) — das würde das Objekt exakt
  dann unsichtbar machen, wenn es gerade platziert/verschoben wird, was für
  ein Kind verwirrender wäre als der kosmetische Schwebe-Look.
  `js/game.js:529` zeigt die Sichtbarkeits-Regel; `js/game.js:427-436` zeigt,
  dass Wand-Objekte in `floorGroups[k]` hängen, nicht in `front`.

- **A7** [low] Keine proaktive Migration bestehender `rooms`-Einträge beim
  Laden; `entry.wall` wird nur lazy beim ersten `clampEntry()`-Aufruf
  (Verschieben/Drehen) mit `'back'` nachgetragen. Rejected: ein eigener
  Migrations-Pass analog zum `wallpaper`-String→Objekt-Muster
  (`js/game.js:367-374`, `migrated`-Flag). `js/game.js:1042` zeigt, dass
  `placeItemMesh()` beim Laden direkt die rohen gespeicherten Koordinaten
  nutzt, ohne `clampEntry()` — alte Einträge brauchen also keine Migration,
  um korrekt zu rendern.

## Consequences

- `entry.x`'s Bedeutung ist jetzt wand-abhängig (Welt-`x` für `back`/`front`,
  Welt-`z`-Offset für `left`/`right`). Zukünftige Änderungen an
  Wand-Objekt-Code müssen `en.wall` mitlesen, bevor sie `entry.x`
  interpretieren — ein impliziter Vertrag, der vorher (nur eine Wand)
  trivial war.
- Ein an `front` platziertes/verschobenes Objekt sieht während des eigenen
  Bearbeitungs-Modus schwebend aus (siehe Design-Abschnitt, A6). Das ist
  gewollt, aber jede künftige Änderung an der `front`-Sichtbarkeits-Regel
  (`js/game.js:529`) sollte diesen Fall neu bedenken.
- `addItem()`s Abstandsheuristik (`taken`) ist jetzt pro Wand statt global —
  vier Wände können jetzt je bis zu ihrer eigenen Breite/Tiefe voll mit
  Wand-Objekten sein, statt nur eine Rückwand.
