# Spec — Möbel in die Länge ziehen oder kürzen (Issue #100)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner — die
Abnahme ist ein Playwright-Lauf im Vordergrund (`CLAUDE.md`, Abschnitt
«Tooling & Testing»).

Quelle: Issue #100, abgespalten aus #92 (Feedback-Sammlung vom 27.09.2026).
Der ganze Wortlaut: «Tisch, Sofa in die Länge ziehen oder kürzen.»

## Problem

Ein Möbel hat heute genau eine Grösse: die, die sein Bauplan in
`js/models.js` festlegt. Das Sofa ist 0.85 lang (`js/models.js:231`), der Tisch
hat 0.40 Radius (`js/models.js:224`), das Bett ist 1.05 tief
(`js/models.js:211`). Verändern lässt sich am aufgestellten Möbel nur Ort
(`btn-move`, `js/game.js:2255`), Drehung (`btn-rot`, `js/game.js:2264`) und —
bei den einfärbbaren — die Farbe (`btn-color`, `js/game.js:2271`).

Wer eine lange Tafel für sechs Mäuse will oder ein Sofa, das genau zwischen
Ofen und Wand passt, kann das nicht bauen. Er kann nur ein zweites Sofa
danebenstellen.

## Was der Wunsch meint

«In die Länge ziehen» ist keine allgemeine Grössenänderung — das ist Issue #99
(«Möbel um Faktoren vergrössern, x1.5, x2»), der Nachbarwunsch aus derselben
Aufspaltung. #99 macht ein Möbel **insgesamt** grösser, #100 macht es **länger
oder kürzer**, bei gleicher Höhe und gleicher Tiefe. Zusammen ergeben sie eine
lange, flache Tafel — nacheinander angewandt, nicht gegeneinander.

Diese Spec entwirft deshalb bewusst ein Datenfeld und einen Anwendungspfad,
die #99 aufnehmen können, ohne dass eine der beiden Änderungen die andere
umschreiben muss (siehe E4).

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründung steht jeweils
dabei, damit sie widerlegbar ist.

- **E1 — Gedehnt wird waagrecht, nie in der Höhe.** Gespeichert werden zwei
  Faktoren auf den **lokalen** Achsen des Modells: `en.dehnung = { x, z }`.
  `mesh.scale.y` bleibt unberührt. Verworfen: einen dritten Faktor für die
  Höhe. Die Deckenhöhe ist fest (`FLOOR_H = 2.0`, dazu `BUILD_MAX_H = 1.5` als
  bestehende Höhengrenze in `js/models.js:87`), und ein 2× hoher Schrank
  stünde im Stockwerk darüber. Höhe ist ausserdem genau das, was #99
  mitverändert — sie gehört dorthin, nicht hierher.

- **E2 — Lokale Achsen, nicht Weltachsen.** `mesh.scale` wirkt vor
  `mesh.rotation.y` (`js/game.js:805`), das gedrehte Sofa wird also entlang
  seiner eigenen Länge gezogen, nicht entlang der Raumkante. Verworfen: die
  Dehnung in Weltkoordinaten. Ein um 45° gedrehtes Möbel würde dabei zur
  Raute verzerrt.

- **E3 — Welche Achse «Länge» ist, entscheidet das Modell, nicht der Code von
  Hand.** Die längere der beiden waagrechten Kanten der **ungedehnten** Box3
  ist die Längsachse; bei Gleichstand gewinnt x. Für das Sofa (x 0.85 > z 0.44,
  `js/models.js:231-236`) ist das x, für das Bett (x 0.8 < z 1.05,
  `js/models.js:211-216`) z, für den runden Tisch x. Verworfen: eine Tabelle
  `LAENGSACHSE = { sofa: 'x', bett: 'z', … }` im Code. Die müsste bei jedem
  neuen Katalogeintrag gepflegt werden und wäre die zweite Wahrheit neben der
  Geometrie.

- **E4 — Diese Änderung liefert nur die Längsachse als Bedienung, aber beide
  Faktoren als Datenformat.** Die Leiste bekommt «Länger» und «Kürzer», keine
  Breitensteuerung — mehr steht nicht im Wunsch. Das Feld heisst trotzdem
  `{ x, z }`, damit ein späterer Breitenwunsch (oder eine Änderung am Modell,
  die die Längsachse kippt) ohne Migration des Spielstands auskommt.
  Verworfen: ein einzelner Skalar `en.laenge`. Der wäre nur zusammen mit der
  gerade geltenden Längsachse deutbar — ändert sich das Modell, ändert sich
  stillschweigend die Bedeutung aller gespeicherten Werte.

- **E5 — Ein gemeinsamer Anwendungspunkt für alle Skalierungen:
  `applyEntryScale(mesh, entry, q = 1)`.** Er rechnet
  `groesse × dehnung × q` und setzt `mesh.scale`. `groesse` ist das Feld, das
  #99 einführen wird; fehlt es, gilt 1. `q` ist der Faktor der
  Aufpopp-Animation. Verworfen: `mesh.scale` an den fünf Stellen einzeln zu
  setzen, an denen es heute passiert. Genau daran scheitert die naive Fassung
  (siehe E6), und #99 müsste dieselben fünf Stellen ein zweites Mal anfassen.

- **E6 — Die Aufpopp-Animation muss durch denselben Punkt.**
  `js/game.js:1525-1526` setzt beim Aufstellen `m.scale.setScalar(0.01)` und
  tweent auf `1` — ein gedehntes Möbel würde damit beim Umfärben
  (`rebuildItemMesh`, `js/game.js:1542`) oder beim Einfügen eines kopierten
  Raums auf Normalmass zurückspringen. Der Tween ruft künftig
  `applyEntryScale(m, en, 0.01 + 0.99 * q)`.

- **E7 — Eine Dehnung ist ein Zug wie jeder andere und läuft über
  `applyMove`** (`js/game.js:726`). Damit gelten dieselben Regeln wie beim
  Verschieben und Drehen: `clampEntry` schiebt das gewachsene Möbel in den
  Raum zurück (es rechnet ohnehin mit `Box3.setFromObject`,
  `js/game.js:667-670`, also mit der skalierten Geometrie), und ein Tier, das
  dadurch eingeklemmt würde, weicht aus oder blockiert den Zug
  (`resolveItemMove`, `js/game.js:1628`). Wird der Zug abgelehnt, stellt
  `applyMove` den alten Eintrag wieder her und `meldeBlockade()` klopft.
  Verworfen: die Dehnung am Kollisionssystem vorbeizuführen. Ein Sofa, das
  über ein Tier wächst, ist genau der Fall, den #40 ausgeschlossen hat.

- **E8 — Grenze: das gedehnte Möbel muss in den Raum passen.** Zusätzlich zur
  Schrittgrenze (E9) wird ein Schritt abgelehnt, wenn die neue Grundfläche
  breiter/tiefer wird als der nutzbare Raum (`limX`/`limZ` aus
  `js/game.js:665-666`, verdoppelt). `clampEntry` klemmt nur die *Position* —
  ohne diese Prüfung stünde ein 2× langes Sofa mittig und ragte links und
  rechts durch die Wand. Verworfen: die Grenze aus der Schrittliste allein
  abzuleiten; die Zimmer sind unterschiedlich breit (`W(k)`, `D(k)`), eine
  feste Obergrenze passt nicht auf alle.

- **E9 — Feste Rasterschritte statt freier Faktor:
  `[0.5, 0.75, 1, 1.25, 1.5, 2]`.** «Länger» geht einen Schritt hoch, «Kürzer»
  einen runter; am Ende der Liste passiert nichts mehr (der Knopf wird
  `disabled`). Die Liste enthält 1.5 und 2 und trifft sich damit bewusst mit
  den Faktoren aus #99. Verworfen: ein Schieberegler. Die ganze Bedienung ist
  auf 44-px-Knöpfe für Kinderfinger ausgelegt (`index.html:96`), und ein
  stufenloser Wert liesse sich nicht sinnvoll runden.

- **E10 — Nicht dehnbar: Wandobjekte und Bewohner.** Der Knopf ist für
  `WALL_ITEMS` (`js/models.js:676`) und für Tiere (`pick.tenant`) versteckt —
  genau wie `btn-move`/`btn-rot` es für Wandobjekte schon tun
  (`js/game.js:1332-1333`). Wandobjekte werden über halbe Wandlängen mit
  festem Rand platziert (`wallPlacement`, `js/game.js:544-550`), die die Breite
  des Objekts nicht kennen; ein doppelt breites Poster liefe aus der Wand.
  Tiere sind keine Möbel. Alles andere — Deko, Eigenbau, Pool, Spielplatz —
  ist dehnbar; die Geometrie hängt in jedem Fall an einer Gruppe, deren
  `scale` alles Untergeordnete mitnimmt.

- **E11 — Dehnen kostet nichts.** Keine Nüsse, kein `EXTRA_PREIS`. Verworfen:
  eine Gebühr für grössere Möbel. Es ist eine Formänderung an etwas schon
  Bezahltem, und ein Kind, das sein Sofa wieder kürzt, bekäme sonst
  konsequenterweise etwas zurück.

- **E12 — Der Wert wird beim Laden bereinigt, nicht beim Schreiben
  geprüft.** `normalizeDehnung(en)` steht neben `normalizeColor`
  (`js/game.js:563`) und arbeitet nach demselben Muster: unbekannte oder
  ungültige Werte verschwinden still, `{ x: 1, z: 1 }` wird ganz entfernt,
  und der bereinigte Stand wird über das bestehende `migrated`-Flag einmalig
  zurückgeschrieben. Ein alter Spielstand ohne `dehnung` ist gültig und heisst
  «ungedehnt».

- **E13 — Die Export-/Import-Bereinigung muss das Feld kennen.**
  `bereinigeMoebel` in `js/standdatei.js:141-168` ist eine Positivliste: was
  dort nicht steht, fällt beim Sichern in eine Datei und beim Einlesen
  ersatzlos weg. Ohne diesen Schritt verlöre jede exportierte Wohnung ihre
  Dehnungen — still, und erst beim Wiedereinlesen sichtbar.

## Datenformat

Ein Möbeleintrag in `state.rooms[k]` hat heute die Form
`{ id, cell, x, y, z, rot, wall?, color?, build?, fill? }`
(`js/standdatei.js:140-141`). Neu kommt hinzu:

```js
dehnung: { x: 1.5, z: 1 }   // optional; fehlt = ungedehnt
```

Beide Werte stammen aus `STRETCH_STEPS`. Ist einer davon kein gültiger
Schritt, verschwindet das ganze Feld (E12).

## Bedienung

`#selbar` (`index.html:345-358`) bekommt einen Knopf **«Strecken»** zwischen
`btn-rot` und `btn-action`. Er schaltet — wie `btn-color` die Farbreihe
(`js/game.js:2271-2272`) — ein kleines Feld `#stretchpad` auf:

```
┌─────────────────┐
│  Kürzer  Länger │
└─────────────────┘
```

Zwei Knöpfe, beide 44 px hoch. Sie wirken auf die Längsachse des ausgewählten
Möbels (E3). Am Ende der Schrittliste oder wenn der nächste Schritt nicht in
den Raum passt (E8), ist der jeweilige Knopf `disabled` — der Zustand wird bei
jedem `select()` und nach jedem Schritt neu berechnet, damit ein Kind nicht
gegen eine stumme Wand tippt.

Jeder angenommene Schritt: `sfx.pop()`, `selHelper.update()`, `save()`.
Jeder abgelehnte: `meldeBlockade()` (Klopfen + Hinweis) — wobei die Ablehnung
aus Platzgründen gar nicht erst auslösbar ist, weil der Knopf dann schon
`disabled` ist; übrig bleibt die Ablehnung durch ein Tier im Weg.

## Abnahme (Playwright, im Vordergrund)

Es gibt kein Test-Framework; geprüft wird mit einem Skript im Stil von
`tools/verify_katalog.py`, das den statischen Server selbst startet und
komplett im Vordergrund läuft. Der Debug-Zugriff `window.wipfelkratzer`
(`js/game.js:2810`) reicht dafür; er wird um `applyEntryScale`,
`STRETCH_STEPS` und `laengsAchse` ergänzt.

Geprüft wird:

1. Ein Sofa wächst nach zwei «Länger» auf das 1.5-fache seiner Box3-Länge in
   x, bei unveränderter Höhe und Tiefe.
2. Das Bett wächst bei «Länger» in **z** (die Längsachse laut E3), nicht in x.
3. Reload: die Dehnung steht nach `location.reload()` unverändert da.
4. Umfärben eines gedehnten Sofas (`btn-color`) lässt die Dehnung stehen
   (E6-Regression).
5. Raum kopieren/einfügen überträgt die Dehnung.
6. Export → Import über `js/standdatei.js` überträgt die Dehnung (E13).
7. Am oberen Ende der Schrittliste ist «Länger» `disabled`; an einem Möbel,
   das gedehnt nicht mehr in den Raum passt, ebenso.
8. Ein gedehntes Möbel, das ein Tier einklemmen würde, wird abgelehnt und
   springt auf den vorherigen Schritt zurück.
9. Bei einem Wandobjekt und bei einem Tier ist «Strecken» versteckt.
10. Die Konsole bleibt beim ganzen Lauf leer.

## Abgrenzung

- **#99 (Möbel um Faktoren vergrössern)** wird hier nicht umgesetzt. Diese
  Spec legt nur `applyEntryScale` als gemeinsamen Anwendungspunkt und
  `en.groesse ?? 1` als erwartetes Feld an. Wer #99 zuerst implementiert,
  findet die Stelle vor; wer #100 zuerst implementiert, hinterlässt sie.
  Beide Felder sind unabhängig und multiplizieren sich.
- **Höhe** bleibt aussen vor (E1).
- **Die Modelle selbst** werden nicht angefasst. Gedehnt wird die Gruppe,
  nicht die Geometrie — ein 2× langes Sofa hat also auch 2× breite
  Armlehnen. Das ist gewollt: alles andere hiesse, jedes der über fünfzig
  Modelle parametrisierbar zu machen.
