# Spec — Raum einrichten: «Alles weg» und «Zufall einrichten» (Issue #97)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla-ES-Module, three.js über die Importmap (`index.html:10-27`). Kein
Build-Schritt, kein Test-Runner.

Quelle: Issue #97, abgespalten aus #91 (Feedback-Sammlung vom 27.09.2026).
Der ganze Wortlaut:

> - Raum einrichten:
>   - Alles entfernen, Wirklich sicher?
>   - Zufällige Einrichtung (mit Fenstern)

Erstellt im Schnellmodus (`/enrich --quick`): ohne Rückfragen. Jede
Entscheidung, die sonst eine Frage gewesen wäre, steht unten mit Begründung
und Beleg, damit sie widerlegbar ist.

## Problem

Wer eine Wohnung einrichtet, hat heute genau zwei Werkzeuge: einzeln
aufstellen (Katalog, `js/game.js:1489`) und einzeln wegwerfen («Weg damit»,
`index.html:356`, `js/game.js:1532-1538`). Beides ist ein Tippen pro
Gegenstand.

Daraus folgen zwei Ärgernisse, die das Feedback beim Testen mit dem Kind
benennt:

1. **Ausräumen dauert ewig.** Eine volle Wohnung hat leicht fünfzehn Sachen.
   Wer von vorn anfangen will, tippt dreissigmal (auswählen, «Weg damit»).
   Die Mechanik dafür liegt schon fertig im Code — `clearRoom(k)`
   (`js/game.js:1387-1391`) räumt Liste, Szenengraph und `itemMeshes`
   zusammen auf —, sie ist nur an keinen Knopf gehängt: aufgerufen wird sie
   ausschliesslich aus `doPaste(k, true)` (`js/game.js:1393`), also aus
   «Raum einfügen → Alles ersetzen».
2. **Eine leere Wohnung ist eine leere Seite.** Drei Sachen müssen hinein,
   damit jemand einzieht (`tenantIn`, `js/game.js:150`). Bis dahin steht das
   Kind vor einem Katalog mit über fünfzig Einträgen in zehn Reitern
   (`js/models.js:638-681`) und weiss nicht, wo es anfangen soll. Es fehlt
   der Knopf, der einmal etwas Hübsches hinstellt, das man danach umbauen
   kann.

Der Zusatz **«(mit Fenstern)»** ist dabei kein Detail, sondern der Kern des
zweiten Wunsches: `fenster` ist ein Wandobjekt (`js/models.js:676`), liegt im
Reiter «Wand» und wird deshalb beim Einrichten regelmässig übersehen. Eine
Wohnung ohne Fenster wirkt wie ein Keller — und das Fenster ist eines der
wenigen Objekte, die sich zusätzlich bedienen lassen (`applyFenster`,
`js/game.js:764-782`).

## Ausgangslage im Code (Belege)

- **Die Einrichten-Leiste** `#editbar` trägt heute Titel und vier Elemente:
  «Raum kopieren», «Raum einfügen», «Tipp», «Fertig» (`index.html:327-333`).
  Sie ist oben mittig fixiert, `max-width: 92vw` (`index.html:83-84`).
  «Raum kopieren»/«Raum einfügen» sind nur in einer gewöhnlichen Wohnung
  sichtbar, nicht auf Dach und Spielplatz (`updateRoomClipButtons`,
  `js/game.js:1349-1353`).
- **Ein Raum ist eine Liste** `state.rooms[k]`, geholt über `roomOf(k)`
  (`js/game.js:149`). Ein Eintrag hat die Form
  `{ id, cell, x, y, z, rot, wall?, color?, build?, fill? }`
  (`js/game.js:1492-1515`). Tapete (`state.wallpaper[k]`, vier Wände) und
  Boden (`state.flooring[k]`) liegen **daneben**, nicht in der Liste
  (`js/game.js:1400-1403`).
- **Leeren gibt es schon:** `clearRoom(k)` (`js/game.js:1387-1391`).
- **Mehrere Einträge auf einmal aufstellen gibt es schon:**
  `pasteEntries(k, items)` (`js/game.js:1368-1384`) stellt in zwei Durchgängen
  auf — erst Möbel, dann Deko —, klemmt `cell` auf die Masse der Zieletage,
  legt Deko über `surfaceYAt` auf die Oberfläche darunter und ruft je Eintrag
  `placeItemMesh` + `clampEntry`.
- **Freie Plätze:** `freeCell(k, from)` (`js/game.js:814-816`) sucht die erste
  unbenutzte Zelle; ein Stockwerk hat `colsOf(k) * 2` Zellen
  (`js/game.js:531`, `cellPos` `js/game.js:532`). Deko und Wandobjekte zählen
  nicht mit.
- **Wandobjekte** landen über `wallPlacement(k, wallKey)`
  (`js/game.js:543-550`) auf einer der vier Wände `WALL_KEYS`
  (`js/game.js:23`). `addItem` verteilt sie auf der gewählten Wand nach
  grösstem Abstand zu den schon hängenden (`js/game.js:1503-1511`) und setzt
  `entry.y = 1.05` für `fenster`, sonst `1.2` (`js/game.js:1501`).
- **Ein Bestätigungsdialog existiert als Muster:** `#pasteask`
  (`index.html:377-387`, CSS `index.html:246-251`) — Vollbild-Abdunklung,
  Panel, Überschrift, Text, drei gestapelte Knöpfe, Schliessen bei Klick auf
  den Hintergrund (`js/game.js:1430-1435`). Dieselbe Form nochmals als
  `#splash-ask` (`index.html:389-397`).
- **Klänge:** `sfx.pop()`, `sfx.knock()`, `sfx.chime()`, `sfx.whoosh()`
  (`js/game.js:1974-1999`). Aufstellen macht `pop`, Wegwerfen `knock`
  (`js/game.js:1527`, `js/game.js:1537`).
- **Meldungen** laufen über `toast(msg)` (`js/game.js:863`).
- **Gespeichert** wird entprellt über `save()` (`js/game.js:144`).
- **Kein `i18n.js`, kein `GG_LANG`.** Die Oberfläche ist durchgehend deutsch
  und fest verdrahtet (`index.html:304-334`, `js/game.js:1426`); im Repo
  liegen ausser `version.js` keine weiteren Wurzel-Skripte. Neue Zeichenketten
  sind deutsche Literale.
- **Der Debug-Hook** `window.wipfelkratzer` (`js/game.js:2810-2833`) exportiert
  bereits `roomOf`, `itemMeshes`, `enterEdit`, `exitEdit`, `addItem`,
  `tweenCount()` und `state` — genug, damit eine Playwright-Sonde messen kann.
- **Einrichten kostet nichts.** `addItem` zahlt nicht; `bezahle()`
  (`js/game.js:1756`) gilt nur für Extras.

## Ziele

- Eine Wohnung mit **einem** Tippen leerräumen — nach einer Rückfrage, die das
  Kind versteht.
- Eine Wohnung mit **einem** Tippen zufällig einrichten, **mit Fenstern**, und
  zwar so, dass das Ergebnis aussieht wie von Hand gestellt: nichts steckt
  ineinander, nichts hängt doppelt an derselben Stelle.
- Beides fügt sich in die bestehenden Wege ein — keine zweite Mechanik neben
  `clearRoom`/`pasteEntries`.

## Nicht-Ziele

- Kein Rückgängig-Machen («Doch nicht») nach dem Leeren. Das wäre eine
  Verlaufsverwaltung für den ganzen Spielstand, nicht ein Knopf.
- Kein Zufall für Tapete und Boden. Die bleiben, wie sie sind — sie gehören
  nicht zur Möbelliste (`js/game.js:1400-1403`).
- Kein Zufall für Dachterrasse und Spielplatz (siehe E5).
- Keine Vorlagen zur Auswahl («Kinderzimmer», «Küche»). Das ist ein eigener
  Wunsch, nicht dieser.
- Keine Änderung an Katalog, Wünschen, Bewohnern, Haselnüssen.

## Entscheidungen

- **E1 — Zwei neue Knöpfe in `#editbar`, keine neue Oberfläche.**
  `#btn-roomclear` («Alles weg», Klasse `danger`) und `#btn-roomrandom`
  («Zufall einrichten»), eingefügt **vor** «Raum kopieren»
  (`index.html:327-333`). Verworfen: ein Platz im Katalog-Kopf
  (`index.html:362-366`). Die Leiste ist der Ort, an dem schon alle
  Raum-Befehle stehen; der Katalog-Kopf trägt Titel und «Zu» und ist eine
  Liste von Gegenständen, kein Befehlsort. Die Leiste wächst damit auf sechs
  Elemente — sie hat `max-width: 92vw` und bricht um (`index.html:83`), das
  ist derselbe Umbruch, den #19 schon für die Werkzeugleiste gelöst hat.

- **E2 — Die Rückfrage ist ein eigener Dialog `#clearask` nach dem Vorbild
  von `#pasteask`, kein `window.confirm()`.** Verworfen: `confirm()`. Das
  Spiel läuft auf dem iPad; ein Systemdialog sieht fremd aus, lässt sich nicht
  mit einer kindgerechten Frage füllen und blockiert den Renderer. `#pasteask`
  beweist, dass die Form im Haus schon steht (`index.html:377-387`,
  `js/game.js:1419-1435`) — mit Abdunklung, gestapelten Knöpfen und
  Abbrechen per Klick auf den Hintergrund.

- **E3 — «Alles weg» räumt nur die Möbelliste, nicht Tapete und Boden.**
  `clearRoom(k)` (`js/game.js:1387-1391`) wird wiederverwendet (mit der
  Ergänzung aus E13).
  Verworfen: auch `state.wallpaper[k]` und `state.flooring[k]` zurücksetzen.
  Die Aufschrift sagt «Alles weg», und weg ist, was **steht** — die Wandfarbe
  ist der Raum selbst, nicht seine Einrichtung. Wer sie ändern will, hat die
  Reiter «Tapete» und «Boden» (`js/models.js:681`).

- **E4 — «Alles weg» gilt auch für Dachterrasse und Spielplatz.** Der Knopf
  ist in jedem Einrichten-Modus sichtbar (anders als «Raum kopieren»,
  `js/game.js:1349-1353`), weil `clearRoom(k)`, `roomOf(k)` und `parentOf(k)`
  für `'roof'` und `'garten'` genauso funktionieren (`js/game.js:535`). Ein
  volles Dach auszuräumen ist dieselbe Plackerei wie eine volle Wohnung.
  Verworfen: nur Wohnungen. Dafür gäbe es keinen technischen Grund, nur einen
  willkürlichen.

- **E5 — «Zufall einrichten» gilt nur für gewöhnliche Wohnungen**, also
  dieselbe Sichtbarkeitsregel wie «Raum kopieren» (`js/game.js:1349-1353`).
  Verworfen: ein Rezept auch für Dach und Spielplatz. Deren Kataloge sind
  andere Mengen (`cat: 'dach'`, `cat: 'garten'`, `js/models.js:667-675`,
  `GARDEN_ITEMS` `js/models.js:679`), es gibt dort keine Wände und damit keine
  Fenster — es wären zwei weitere Rezepte, also dreimal der Aufwand für einen
  Wunsch, der von der Wohnung spricht.

- **E6 — «Zufall einrichten» füllt nur die freien Plätze; es löscht nie.**
  Verworfen: erst leeren, dann füllen (mit einer zweiten Rückfrage). Zwei
  Dialoge hintereinander für einen Knopf sind für ein Kind zu viel, und die
  Kombination «Alles weg» → «Zufall einrichten» liefert dasselbe Ergebnis mit
  zwei klaren Schritten. So bleibt genau **eine** zerstörende Handlung im
  Spiel, und die hat genau **eine** Rückfrage. Nebeneffekt, der gewollt ist:
  in einer halb eingerichteten Wohnung ergänzt der Knopf, was fehlt.

- **E7 — Aufgestellt wird über `pasteEntries(k, items)`
  (`js/game.js:1368-1384`), nicht über eine Schleife um `addItem`.**
  Verworfen: `addItem(id)` mehrfach rufen. `addItem` wählt jedes Stück aus,
  animiert es einzeln, spielt `sfx.pop()`, prüft Wünsche und ruft `save()` —
  pro Gegenstand (`js/game.js:1517-1531`). Zwölf Gegenstände gäben zwölf
  Speichervorgänge, zwölf Klänge und einen Auswahlrahmen, der zwölfmal
  weiterspringt. `pasteEntries` ist genau der Mehrfach-Pfad, den «Raum
  einfügen» schon benutzt, samt der Reihenfolge Möbel-vor-Deko, die dafür
  sorgt, dass `surfaceYAt` die Vase auf den Tisch legt.

- **E8 — Das Rezept ist fest verdrahtete Anzahl je Kategorie, gezogen aus dem
  Katalog.** Nicht «zwölf zufällige Ids aus `CATALOG`». Verworfen: die freie
  Ziehung. Sie liefert mit hoher Wahrscheinlichkeit drei Betten und kein
  Fenster; `CATALOG` enthält ausserdem Dach- und Spielplatzobjekte
  (`js/models.js:667-675`), die in einer Wohnung nichts zu suchen haben. Das
  Rezept steht als eine Konstante neben dem Katalog-Import in `js/game.js` und
  ist damit an einer Stelle änderbar.

- **E9 — Zwei Fenster gehören zum Rezept, auf zwei verschiedenen Wänden aus
  `back`/`left`/`right`.** Die Vorderwand bleibt aussen vor: sie ist beim
  Einrichten unsichtbar (`applyFronts`, `js/game.js:1109-1117`) und trägt
  bereits Tür und Fenster der Etage (`js/game.js:410-432`) — ein
  Fenster-Objekt davor wäre weder sichtbar noch sinnvoll. Verworfen: ein
  Fenster. «(mit Fenstern)» steht im Wunsch in der Mehrzahl, und zwei Fenster
  auf zwei Wänden sind der Unterschied zwischen «Loch in der Wand» und
  «heller Raum».

- **E10 — `Math.random()` über den vorhandenen Helfer `pick(arr, r)`
  (`js/game.js:82`), kein gesäter Zufallsgenerator.** Verworfen: ein
  reproduzierbarer Generator für die Prüfung. Nichts im Spiel muss den
  gleichen Raum zweimal erzeugen, und die Playwright-Sonde prüft
  **Eigenschaften** (Anzahl, Kategorien, mindestens zwei Fenster, verschiedene
  Zellen, verschiedene Wände), nicht ein bestimmtes Ergebnis.

- **E11 — Beide Knöpfe sind unbeschriftet-inaktiv statt versteckt, wenn sie
  nichts tun können.** «Alles weg» wird ausgegraut (`disabled`), solange
  `roomOf(k).length === 0`; «Zufall einrichten», wenn kein Platz mehr frei ist
  (`freeCell(k) < 0`). Verworfen: verstecken. Ein Knopf, der verschwindet und
  wiederkommt, lässt die Leiste bei jedem Aufstellen springen — ausgegraut
  bleibt die Leiste ruhig.

- **E13 — `clearRoom` räumt künftig auch `spinners` mit auf.** Heute schiebt
  `placeItemMesh` das Rad eines Hamsterrads in die Liste `spinners`
  (`js/game.js:378`, `js/game.js:809`), und **nur** `rebuildItemMesh` nimmt es
  wieder heraus (`js/game.js:1546`). Weder `removeItem` (`js/game.js:1532`)
  noch `clearRoom` tun das — die Schleife in `tick()` (`js/game.js:2946`)
  dreht danach ein Rad weiter, das nicht mehr in der Szene hängt. Das ist ein
  vorhandener Fehler, kein neuer; «Alles weg» macht ihn aber in einem Zug
  auslösbar und häufbar, und er liegt in genau der Funktion, die dieser
  Wunsch anfasst. Deshalb wird er hier mitgenommen — die zwei Zeilen stehen
  wortgleich schon in `rebuildItemMesh`. Verworfen: `removeItem` gleich mit
  reparieren. Das ist ein anderer Pfad und gehört in ein eigenes Issue
  (siehe *Folgen*).

- **E12 — Kein neues Feld im Spielstand, keine Änderung am Dateiformat.**
  Beide Knöpfe schreiben ausschliesslich in `state.rooms[k]`, also in
  Strukturen, die Export/Import (`js/standdatei.js`) schon kennen. Damit ist
  hier **keine Einbahnstrasse**: nichts wird unwiderruflich migriert, keine
  öffentliche Schnittstelle ändert sich, es entstehen keine Kosten.

## Entwurf

### «Alles weg»

```text
[Alles weg]  →  #clearask
                ┌──────────────────────────────────┐
                │ Wirklich alles wegräumen?        │
                │                                  │
                │ In «2. Stock» stehen 14 Sachen.  │
                │ Sie sind dann weg.               │
                │                                  │
                │ [ Ja, alles weg ]      (danger)  │
                │ [ Lieber nicht ]                 │
                └──────────────────────────────────┘
```

Der Text nennt den Ort (`flLabel(k)`, bzw. «Dachterrasse»/«Spielplatz») und
die Anzahl — dieselbe Machart wie `pasteask-text` (`js/game.js:1425-1426`).
Bestätigt heisst:

```js
clearRoom(k);          // js/game.js:1387 — Liste, Szenengraph, itemMeshes
deselect();
renderWishes(); renderResidents();
sfx.knock();           // derselbe Klang wie «Weg damit»
toast('… ist leergeräumt.');
save(); updateHUD();
updateRoomButtons();
```

`clearRoom` fasst `tenantGroups[k]` nicht an — die Tiere hängen an einer
eigenen Gruppe (`spawnTenant`, `js/game.js:1642-1670`), nicht an
`itemMeshes[k]`. Die Bewohner bleiben also im Zimmer stehen; siehe *Folgen*.

### «Zufall einrichten»

Das Rezept, als Konstante neben den anderen Mengen in `js/game.js`:

| Rolle | Kandidaten (Katalog-Ids) | Anzahl |
|---|---|---|
| Schlafen | `bett`, `etagenbett` | 1 |
| Tisch | `tisch`, `wk_tisch` | 1 |
| Sitzen | `stuhl`, `wk_stuhl`, `sofa`, `wk_sofa`, `schaukelstuhl` | 1–2 |
| Verstauen | `schrank`, `regal`, `wk_regal`, `kommode` | 1 |
| Gemütlich | `teppich`, `lampe`, `ofen`, `pflanze`, `badewanne` | 1–2 |
| Spass | `hamsterrad`, `klavier`, `ball`, `kuscheltier`, `harfe`, `tischkicker` | 1 |
| Deko | `vase`, `teekanne`, `kerze`, `buecher`, `nussschale` | 1–2 |
| **Fenster** | `fenster` | **2** |
| Wandschmuck | `poster_wald`, `poster_mond`, `poster_willi`, `uhr`, `spiegel` | 1 |

Gezogen wird ohne Zurücklegen je Rolle (kein doppeltes Bett), die Anzahl bei
«1–2» per Münzwurf. Macht 9–12 Einträge.

Der Ablauf in vier Schritten:

1. **Ziehen.** Aus dem Rezept eine Id-Liste bauen. Alle Ids stehen im Katalog
   (`js/models.js:638-675`) — die Liste wird beim Bauen dagegen geprüft, damit
   ein umbenanntes Möbelstück nicht still verschwindet.
2. **Bodenobjekte platzieren.** Für jedes Nicht-Deko-, Nicht-Wandobjekt eine
   freie Zelle über `freeCell(k, from)` (`js/game.js:814`), `from` jeweils
   hinter der zuletzt vergebenen, damit sich die Möbel verteilen statt zu
   klumpen. Position aus `cellPos(k, cell)` (`js/game.js:532`). Ist keine
   Zelle mehr frei (`-1`), wird der Rest der Bodenobjekte weggelassen — kein
   Fehler, nur weniger.
3. **Wandobjekte platzieren.** Die zwei Fenster und der Wandschmuck bekommen
   je eine Wand aus `['back', 'left', 'right']`, die beiden Fenster
   verschiedene. `entry.y = 1.05` für `fenster`, sonst `1.2`; `entry.x` nach
   derselben Grösster-Abstand-Regel wie in `addItem`
   (`js/game.js:1503-1511`), die dafür in eine eigene kleine Funktion
   `wallSlotX(k, wall, taken)` gezogen wird — **derselbe** Code für beide
   Aufrufer, nicht eine zweite Kopie.
4. **Aufstellen.** Die fertige Einträgeliste geht in einem Zug an
   `pasteEntries(k, items)` (`js/game.js:1368`). Danach einmal
   `checkTenant(k)`, einmal pro neu aufgestellter Id `checkWishes(id, k)` in
   derselben Reihenfolge wie `doPaste` sie wählt (`js/game.js:1405-1415`:
   erst der eigene Wunsch, dann `checkTenant`), einmal `renderWishes()`,
   `renderResidents()`, `sfx.chime()`, ein Toast, `save()`, `updateHUD()`.

### Wo der Code hinkommt

Alles in den bestehenden Abschnitt «Raum kopieren» in `js/game.js`
(`js/game.js:1342-1436`), direkt hinter `clearRoom`/`doPaste`, weil dort
schon `clearRoom`, `pasteEntries` und das Dialog-Muster liegen. Die
Sichtbarkeits-Funktion `updateRoomClipButtons` (`js/game.js:1349`) wird zu
`updateRoomButtons` erweitert und behandelt alle vier Knöpfe; alle vier
Aufrufstellen (`js/game.js:1168`, `1189`, `1359`, und neu nach jedem
Aufstellen/Wegwerfen) rufen dieselbe Funktion.

`index.html` bekommt zwei `<button>` in `#editbar` und den Block `#clearask`
neben `#pasteask`; das CSS für `#clearask` hängt sich an die vorhandenen
`#pasteask`-Regeln an (`index.html:246-251`), indem die Selektoren um
`#clearask` erweitert werden — keine zweite Kopie derselben Regeln.

`window.wipfelkratzer` bekommt `zufallEinrichten` und `raumLeeren`, damit die
Sonde sie ohne Klickpfad auslösen kann, sowie `ZUFALL_REZEPT` zum Abgleich.

## Abnahmekriterien

1. In «Einrichten» stehen in `#editbar` zwei neue Knöpfe: «Alles weg» und
   «Zufall einrichten».
2. «Alles weg» öffnet den Dialog `#clearask`; er nennt den Ort und die Anzahl
   der Sachen und bietet «Ja, alles weg» und «Lieber nicht».
3. «Lieber nicht», ein Klick auf den Hintergrund — beides schliesst den Dialog
   und ändert **nichts**: `roomOf(k).length` ist unverändert.
4. «Ja, alles weg» leert den Raum: `roomOf(k).length === 0`,
   `itemMeshes[k].length === 0`, und nach einem Neuladen der Seite ist der
   Raum immer noch leer.
5. Tapete und Bodenbelag sind nach «Alles weg» unverändert
   (`state.wallpaper[k]`, `state.flooring[k]`).
6. Die Tiere eines eingezogenen Bewohners stehen nach «Alles weg» weiterhin im
   Zimmer (`tenantGroups[k]` existiert, `tenantMeshes[k].length > 0`).
7. «Alles weg» ist auch auf der Dachterrasse und auf dem Spielplatz vorhanden
   und leert dort ebenso.
8. «Alles weg» ist ausgegraut, solange der Raum leer ist.
9. «Zufall einrichten» ist nur in einer gewöhnlichen Wohnung sichtbar, nicht
   auf Dach und Spielplatz.
10. «Zufall einrichten» in einer leeren Wohnung stellt 9–12 Gegenstände auf;
    alle Ids stammen aus `CATALOG`.
11. Darunter sind **mindestens zwei** Einträge mit `id === 'fenster'`, und
    ihre `wall`-Werte sind **verschieden** und liegen in
    `['back', 'left', 'right']` — nie `'front'`.
12. Alle aufgestellten Bodenobjekte (weder `DECO` noch `WALL_ITEMS`) haben
    **paarweise verschiedene** `cell`-Werte.
13. Nach dem Zufall steht kein Möbelstück in einem anderen: für je zwei
    Bodenobjekte ist `overlapsXZ` falsch.
14. Läuft «Zufall einrichten» in einer Wohnung, in der schon etwas steht, so
    bleibt jeder vorhandene Eintrag unverändert erhalten (gleiche Anzahl
    plus die neuen, gleiche `cell`-Werte für die alten).
15. Nach dem Zufall ist der Bewohner eingezogen (`tenantIn(k)` ist wahr,
    `tenantGroups[k]` existiert), sofern die Etage überhaupt bewohnbar ist.
16. Der Zufall speichert genau **einmal**: nach einem Neuladen steht die
    gewürfelte Einrichtung vollständig da.
17. Zweimal «Zufall einrichten» hintereinander in derselben leeren Wohnung
    liefert (mit hoher Wahrscheinlichkeit) verschiedene Einrichtungen — der
    Knopf ist kein Festwert.
18. «Zufall einrichten» ist ausgegraut, wenn keine Zelle mehr frei ist.
19. Nach «Alles weg» in einer Wohnung mit einem Hamsterrad enthält `spinners`
    kein Rad dieser Wohnung mehr — die Liste wächst über mehrere
    Leeren-Durchgänge hinweg nicht.
20. Die Seite lädt ohne `pageerror`; kein neuer Fehler in der Konsole.

## Folgen

- **Der Bewohner «zieht aus» und doch nicht.** Nach «Alles weg» ist
  `tenantIn(k)` falsch (`js/game.js:150`, Schwelle drei Sachen), also
  verschwindet die Familie aus «Bewohner» und aus der Wunschliste — ihre Tiere
  stehen aber weiter im Zimmer, weil sie an `tenantGroups[k]` hängen. Das ist
  **kein neues Verhalten**: dasselbe passiert heute, wenn man mit «Weg damit»
  bis unter drei Sachen abräumt. Der neue Knopf macht es nur sichtbarer,
  weil man dort in einem Schritt hinkommt.
- **Ein erfüllter Wunsch bleibt erfüllt.** `state.fulfilled[i]` wird beim
  Leeren nicht zurückgesetzt (`wishOpen`, `js/game.js:1679-1684`), die drei
  Haselnüsse sind also nicht zurückzugewinnen, indem man den Wunschgegenstand
  wegräumt und neu hinstellt. Auch das gilt heute schon.
- **Der Zufall kann einen Wunsch erfüllen** und dann +3 Haselnüsse
  gutschreiben (`checkWishes`, `js/game.js:1685-1696`) — mit einer Chance, die
  vom Rezept abhängt. Gewollt: es ist derselbe Weg wie beim Aufstellen von
  Hand.
- **Die Einrichten-Leiste wird breiter.** Sechs Elemente statt vier; auf einem
  schmalen iPad im Hochformat bricht sie in eine zweite Zeile um. Sie sitzt
  oben mittig und überdeckt dort nichts Bedienbares (`index.html:83`).
- **Das Rezept veraltet mit dem Katalog.** Kommt ein neues Möbelstück dazu,
  taucht es im Zufall erst auf, wenn jemand es ins Rezept schreibt. Das ist
  der Preis für E8 und in der Konstante sichtbar dokumentiert.
- **`removeItem` bleibt undicht.** Einzelnes Wegwerfen lässt das Rad weiter in
  `spinners` stehen (E13 repariert nur `clearRoom`). Das gehört in ein eigenes
  Issue; hier wäre es Zuschnittsausweitung.
- **`pasteEntries` bekommt einen zweiten Aufrufer.** Wer es künftig ändert,
  ändert «Raum einfügen» *und* «Zufall einrichten». Das ist gewollt — genau
  deshalb wird es wiederverwendet — aber es ist ab jetzt geteilte Mechanik.
