# Spec — Wählbare Turmhöhe: 10, 20 oder 50 Stockwerke (Issue #47)

Repo: `game-wipfelkratzer`. Basis: `main`, v0.5.0 (`version.js`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein npm, kein Test-Framework. UI einsprachig
Deutsch (`ls js/` zeigt nur `game.js` und `models.js`, kein `i18n.js`).

## Problem

`MAXF = 10` (`js/game.js:6`) ist die einzige Zahl, die das Issue nennt — aber
sie ist der kleinste Teil der Arbeit. Ein Turm mit 20 oder 50 Stockwerken
scheitert heute an vier ganz verschiedenen Dingen:

1. **Die Geometrie kippt.** Jede Etage ist schmaler als die darunter:
   `W(i) = 7.6 - (i - 1) * 0.3` und `D(i) = 5.0 - (i - 1) * 0.12`
   (`js/game.js:7-8`). Diese Verjüngung ist auf genau zehn Stockwerke
   geeicht. Bei `i = 20` bleibt `W(20) = 1.9` übrig — `dims(20).w = 1.2`
   (`js/game.js:358`), also ein Raum, in den kein Bett mehr passt. Bei
   `i = 26` wird `W(i)` **null**, ab `i = 27` negativ; `D(i)` wird bei
   `i ≈ 42` null. Ein 50-stöckiger Turm mit der heutigen Formel besteht in
   der oberen Hälfte aus umgestülpten Boxen. Das ist der eigentliche
   Blocker, nicht `MAXF`.
2. **Es gibt nur elf Bewohner.** `TENANTS` (`js/game.js:19-31`) hat elf
   handgeschriebene Einträge mit Namen, Tierarten und Wunschtext, und der
   Code greift an **zwölf** Stellen direkt mit dem Etagenindex zu
   (`grep -n TENANTS js/game.js`): `js/game.js:542` (`makeThumbs`), `:649`
   (`enterEdit`), `:752` (`spawnTenant`), `:767` (`wishOpen`), `:772`
   (`checkWishes`), `:785` (`renderWishes`), `:796` (`renderResidents`),
   `:833` (`renderAnimals`), `:856` (Dachparty-Tänzer), `:960`
   (`tenantTalk`) sowie `:978` und `:979` (der Tipp-Knopf). Bei 50
   Stockwerken sind 40 Etagen `undefined`.
3. **Die Szene ist auf 24,6 Meter Turmhöhe eingerichtet.** `topY()`
   (`js/game.js:11`) ergibt bei zehn Stockwerken 24,6, bei zwanzig 44,6, bei
   fünfzig 104,6. Dagegen stehen: `controls.maxDistance = 44`
   (`js/game.js:59`), `camera` mit `far = 200` (`js/game.js:55`),
   `scene.fog` von 45 bis 110 (`js/game.js:71`), die Schattenkamera mit
   `top: 32, far: 90` (`js/game.js:64`) und die Sterne bei `y = 8..53`
   (`js/game.js:75`). Ein 50-stöckiger Turm verschwindet oben im Nebel und
   lässt sich nicht so weit wegschieben, dass man ihn ganz sieht.
4. **Leistung.** Die Etagenschleife (`js/game.js:246-300`) baut heute elf
   Gruppen **beim Start**, jede mit Boden, vier Wandkernen, vier
   Innenpanels, Decke, Fenstern, Tür, Treppenlauf, Podest, vier Stützen und
   Hitbox — rund 35 Meshes, alle mit `castShadow` und `receiveShadow`
   (`js/game.js:107`, `mesh()` setzt beides). Bei `MAXF = 50` sind das rund
   1800 Meshes, die zusätzlich jeden Frame ein zweites Mal für die
   Schattenkarte gezeichnet werden — auf einem Tablet der Unterschied
   zwischen flüssig und Diashow. Dazu rendert `makeThumbs()`
   (`js/game.js:542-545`) heute elf Tierbildchen à 160×160 beim Start, bei
   50 Stockwerken 51.

Die Zielzahl selbst steckt an **drei** Stellen als Literal statt an `MAXF`:
`js/game.js:523` (Bauknopf `(${state.floors + 1}/10)`), `index.html:156`
(`Stockwerke: … / 10`) und `js/game.js:977` (`wishOpen(10)`). Eine eigene
Suche über beide Dateien (`grep -nE "(^|[^0-9.])1[01]([^0-9.]|$)"`) findet
keine vierte; alle übrigen Treffer sind CSS-Pixel, `z-index`,
Geometrie-Segmentzahlen und `parseInt(k, 10)` (`js/game.js:1178`). Issue #35
bindet genau diese drei an `MAXF` — dieser Entwurf baut darauf auf und
arbeitet nicht dagegen (siehe A9).

## Entscheidung

Die Turmhöhe wird **einmal pro Spielstand** gewählt und in
`state.maxFloors` gespeichert; `MAXF` liest sie beim Start aus dem
Spielstand. Damit bleibt `MAXF` im ganzen Code eine Konstante — kein
Umbauen einer laufenden Szene, keine Migration mitten im Spiel.

Die vier Blocker werden so aufgelöst:

| Blocker | Lösung |
| --- | --- |
| Verjüngung | Schrittweite aus `MAXF` ableiten statt fest 0.3 / 0.12 |
| Bewohner | elf handgeschriebene behalten, Rest aus Bausteinen erzeugen |
| Szene | Kamera, Nebel, Sterne, Mond an der Turmhöhe skalieren |
| Leistung | Etagengruppen erst beim Bauen erzeugen, Schattenwurf begrenzen |

### Verjüngung

`W` und `D` verlieren ihre festen Schritte und behalten stattdessen
**Anfangs- und Endmass**:

```js
const W_TOP = 4.9, D_TOP = 3.92;                       /* heutiges W(10)/D(10) */
const W = i => i === 0 ? 8.6 : 7.6 - (i - 1) * (7.6 - W_TOP) / (MAXF - 1);
const D = i => i === 0 ? 5.6 : 5.0 - (i - 1) * (5.0 - D_TOP) / (MAXF - 1);
```

Bei `MAXF = 10` ergibt das `(7.6 - 4.9) / 9 = 0.3` und
`(5.0 - 3.92) / 9 = 0.12` — **exakt** die heutigen Werte. Der Zehner-Turm
bleibt Millimeter für Millimeter derselbe, alte Spielstände laden
unverändert. Bei `MAXF = 50` verjüngt sich der Turm um 0.055 pro Etage und
ist oben genauso breit wie heute, statt negativ zu werden.

### Bewohner

`TENANTS` bleibt als handgeschriebener Kern **wörtlich stehen**. Neu ist
eine Funktion `tenantOf(i)`, die den Zugriff kapselt:

- `i === 0` → `TENANTS[0]` (Kindergarten-Mäuse, das Erdgeschoss).
- `i === MAXF` → `TENANTS[10]` (Piet und Jan Waldfrosch, `roofWish: true`).
  Dieser Eintrag **muss** oben sitzen: `wishOpen()` schickt seinen Wunsch
  auf die Dachterrasse (`js/game.js:767`) und `btn-party` hängt an
  `tenantIn(MAXF)` (`js/game.js:525`).
- `1 <= i <= 9` → `TENANTS[i]`, unverändert.
- `10 <= i < MAXF` → erzeugt aus Bausteinen.

Erzeugt wird aus vier Töpfen, ausgewürfelt mit dem Hash `rnd(i)`, den das
Spiel schon für Etagenversatz und Bäume benutzt (`js/game.js:13`):

- **Tierart** — einer der neun Schlüssel aus `SPECIES`
  (`js/models.js:312-321`): `maus`, `haselmaus`, `hamster`, `frosch`,
  `eidechse`, `maulwurf`, `siebenschlaefer`, `wiesel`, `eichhoernchen`.
- **Nachname** — Waldnamen (`Tannenzapfen`, `Moosbart`, `Farnkraut`,
  `Beerenbusch`, …).
- **Haushaltsform** — `Familie <Name>` (Plural, 2 Tiere),
  `Oma und Opa <Name>` (Plural, 2 Tiere), `<Vorname> <Name>` (Singular,
  1 Tier), `Die Geschwister <Name>` (Plural, 2 Tiere).
- **Wunsch** — ein Katalogeintrag mit vorformulierter Akkusativform, damit
  der Satz grammatikalisch stimmt: `{ id: 'ofen', txt: 'einen warmen Ofen' }`,
  `{ id: 'sofa', txt: 'ein Sofa' }`, `{ id: 'badewanne', txt: 'eine
  Badewanne' }` usw. Der Wunschtext ist dann
  `` `${name} wünscht sich ${txt}.` `` bzw. `wünschen sich` im Plural.

`tenantOf(i)` ist rein und deterministisch: dieselbe Etage liefert bei jedem
Laden dieselbe Familie. Es wird nichts gespeichert, das Speicherformat
bleibt unangetastet.

### Höhenwahl

Der Startbildschirm (`index.html:236-244`) bekommt drei Knöpfe statt einem:
«Kleiner Turm — 10 Stockwerke», «Hoher Turm — 20 Stockwerke», «Riesenturm —
50 Stockwerke». Sie erscheinen **nur bei einem frischen Spielstand**;
existiert schon einer, steht dort wie bisher «Los geht's!» und die Höhe ist
festgelegt. Wer eine andere Höhe will, nimmt «Neu anfangen»
(`js/game.js:895-898`) — das räumt `localStorage` und lädt neu, danach fragt
der Startbildschirm wieder.

Weil `MAXF` die ganze Szene aufbaut, bevor der Startbildschirm überhaupt
weggetippt wird, schreibt die Wahl `state.maxFloors` und ruft
`location.reload()`. Der Neustart ist der Preis dafür, dass `MAXF` im Code
konstant bleibt.

## Goals

- Wer ein neues Spiel beginnt, kann zwischen 10, 20 und 50 Stockwerken
  wählen; die Wahl gilt für diesen Spielstand und übersteht Neuladen.
- Jede Etage, egal bei welcher Turmhöhe, ist gross genug zum Einrichten und
  hat eine Familie mit Namen und Wunsch.
- Ein 50-stöckiger Turm ist vollständig sichtbar (Kamera, Nebel) und läuft
  auf einem Tablet.
- Ein bestehender Spielstand mit zehn Stockwerken lädt unverändert und sieht
  exakt aus wie heute.

## Non-Goals

- **Höhe mitten im Spiel ändern.** Kein Hochsetzen eines laufenden
  Spielstands von 10 auf 50 — das bräuchte ein Nachbauen der Szene zur
  Laufzeit und ist eine eigene Aufgabe.
- **Kein Umbau von `js/models.js`.** Keine neuen Tierarten, keine neuen
  Möbel. Die Bewohner werden aus dem bestehenden Bestand kombiniert.
- **Keine freie Zahleneingabe.** Genau drei Stufen, wie im Issue verlangt.
- **Die Dachterrasse bleibt, wie sie ist.** `ROOF_W`/`ROOF_D`
  (`js/game.js:12`) hängen nicht an `MAXF`; sie sind mit 6.6 × 4.8 ohnehin
  grösser als jede Etage darunter.
- **Kein `i18n.js`, keine Übersetzung.**

## Assumptions

- **A1** [high] Die Turmhöhe wird pro Spielstand einmal gewählt und in
  `state.maxFloors` gespeichert; `MAXF` wird beim Start daraus gelesen und
  bleibt danach konstant. Verworfen: `MAXF` zur Laufzeit änderbar machen —
  die Etagengruppen entstehen in einer Schleife beim Modulstart
  (`js/game.js:246-300`), und `roofStairG` wird einmalig aus `MAXF`
  gerechnet (`js/game.js:330-331`); beides müsste zur Laufzeit neu gebaut
  werden. Beleg für das Speicherformat: `js/game.js:35` (`state`-Literal)
  und `js/game.js:36` (`Object.assign(state, JSON.parse(s))`).
- **A2** [high] Fehlt `maxFloors` im Spielstand, ist die Höhe 10. Damit
  laden alle bestehenden Stände unverändert. Beleg: der Ladepfad macht ein
  `Object.assign` auf das Default-Literal, ein fehlendes Feld bleibt also
  auf dem Default (`js/game.js:35-36`).
- **A3** [high] Die Verjüngung wird von festen Schritten auf «Anfangs- und
  Endmass, Schritt aus `MAXF`» umgestellt. Verworfen: die Schritte lassen
  und den Turm einfach höher stapeln — `W(26) = 0` und danach negativ
  (`js/game.js:7`), die Geometrie stülpt sich um. Ebenfalls verworfen: alle
  Etagen gleich breit — das nimmt dem Turm die Silhouette, die das Spiel
  ausmacht.
- **A4** [med] Die Endmasse sind `W_TOP = 4.9` und `D_TOP = 3.92`, also
  genau die heutigen `W(10)`/`D(10)`. Damit ist der Zehner-Turm
  bit-identisch zu heute. Verworfen: schmaler werden lassen (macht die
  oberen Wohnungen bei 50 Stockwerken unbrauchbar, `dims()` zieht nochmals
  0.7 bzw. 1.0 ab, `js/game.js:358`).
- **A5** [med] Die elf handgeschriebenen `TENANTS` bleiben wörtlich stehen
  und behalten die Etagen 0–9; der Frosch-Eintrag rutscht auf `MAXF`.
  Verworfen: die elf zyklisch wiederholen (ein Kind erkennt «Familie
  Siebenschläfer» beim fünften Mal und hält es für einen Fehler);
  51 Einträge von Hand schreiben (löst 50, aber nicht 20, und macht die
  Höhe wieder unparametrisch). Beleg für die Sonderstellung des letzten
  Eintrags: `roofWish: true` (`js/game.js:30`), ausgewertet in `wishOpen()`
  (`js/game.js:767`) und `checkWishes()` (`js/game.js:774`); `btn-party`
  hängt an `tenantIn(MAXF)` (`js/game.js:525`).
- **A6** [med] Die erzeugten Bewohner sind deterministisch: gewürfelt wird
  mit `rnd(i)` (`js/game.js:13`), dem Hash, mit dem das Spiel schon
  Etagenversatz (`floorPose`, `js/game.js:151`) und Baumpositionen
  (`js/game.js:105`) bestimmt. Verworfen: `Math.random()` zur Laufzeit —
  `spawnTenant()` und `renderResidents()` laufen mehrfach pro Sitzung
  (`js/game.js:762, 1184`), die Familie würde beim Neuladen wechseln.
  Ebenfalls verworfen: erzeugte Bewohner in `state` speichern (bläht den
  Spielstand um bis zu 40 Einträge, ohne etwas zu gewinnen).
- **A7** [med] Der Wunschtext wird aus Name plus einer vorformulierten
  Akkusativ-Wendung je Gegenstand gebaut («einen warmen Ofen», «ein Sofa»,
  «eine Badewanne»), und die Haushaltsform trägt ein Numerus-Flag für
  «wünscht sich» / «wünschen sich». Verworfen: ein generischer Satz mit
  blossem Gegenstandsnamen («wünscht sich Sofa») — falsches Deutsch, und
  die handgeschriebenen `wtext` (`js/game.js:20-30`) setzen den Massstab.
- **A8** [med] Die Höhe wird im Startbildschirm gewählt, und die Wahl löst
  `location.reload()` aus. Verworfen: den Szenenaufbau bis nach der Wahl
  verzögern (der ganze Modulrumpf von `js/game.js:243` bis `js/game.js:1186`
  müsste in eine Funktion wandern — ein Umbau, der mit Turmhöhe nichts zu
  tun hat). Kosten: das Kind tippt zweimal (Höhe wählen, nach dem Neuladen
  «Los geht's!»), weil `initAudio()` eine Nutzergeste braucht
  (`js/game.js:1174`).
- **A9** [high] Dieser Entwurf setzt Issue #35 **nicht** voraus, arbeitet
  ihm aber zu. Die drei Zielzahl-Literale (`js/game.js:523`,
  `index.html:156`, `js/game.js:977`) werden an `MAXF` gebunden — genau die
  Änderung, die #35 vorsieht
  (`docs/ai-notes/specs/2026-09-13-stockwerke-zaehlung-design.md`, A5/A6).
  Ist #35 schon zusammengeführt, sind diese Schritte bereits erledigt und
  entfallen; der Wortlaut der HUD-Zeile aus #35 («Erdgeschoss + N von M
  Stockwerken») wird dann **nicht** angetastet, nur die Zahl kommt aus
  `MAXF`.
- **A10** [med] Etagengruppen entstehen erst, wenn die Etage gebraucht wird
  (Erdgeschoss beim Start, jede weitere in `buildFloor()` bzw. beim Laden
  für `i <= state.floors`). Verworfen: alle 51 beim Start bauen — rund 1800
  Meshes mit Schattenwurf. Beleg, dass das gefahrlos ist: ungebaute Etagen
  sind ohnehin unsichtbar (`g.visible = i === 0 || i <= state.floors`,
  `js/game.js:297`), und `buildFloor()` schaltet genau eine davon sichtbar
  (`js/game.js:807`).
- **A11** [med] Etagen oberhalb der Schattenkamera werfen keinen Schatten
  (`castShadow = false`). Die Schattenkamera reicht bis `top: 32`
  (`js/game.js:64`); darüber liegende Geometrie wird ohnehin nicht in die
  Karte gezeichnet, der Renderer versucht es aber trotzdem. Verworfen: die
  Schattenkamera mitwachsen lassen — bei 104 Metern Turmhöhe verteilt sich
  dieselbe 1024×1024-Karte (`js/game.js:63`) auf die vierfache Fläche, der
  Bodenschatten wird sichtbar grob.
- **A12** [low] Kamera, Nebel, Sterne und Mond skalieren mit dem Faktor
  `HSCALE = max(1, TOWER_TOP / REF_TOP)`, wobei `REF_TOP` die Höhe eines
  Zehner-Turms ist. Bei `MAXF = 10` ist `HSCALE = 1`, alle Werte bleiben
  buchstäblich die heutigen (`js/game.js:55, 59, 71, 75-79`). Verworfen:
  feste Werte für jede der drei Stufen (drei Zahlenkolonnen statt einer
  Formel).
- **A13** [med] `#wishes` (`index.html:50`) zeigt höchstens fünf offene
  Wünsche plus eine Zeile «und N weitere». Heute können elf Wünsche offen
  sein und passen knapp; bei 51 läuft die Spalte über den Bildschirm hinaus
  — das Panel ist `position: fixed` ohne `overflow` (`index.html:50`).
  Verworfen: die Spalte scrollbar machen (ein scrollbares, halbtransparentes
  Overlay über der 3D-Szene ist auf einem Tablet kaum zu treffen).
- **A14** [med] Tier-Vorschaubilder werden nach der Tierkombination
  zwischengespeichert, nicht nach dem Etagenindex. `makeThumbs()` rendert
  heute ein Bild pro `TENANTS`-Eintrag (`js/game.js:542-545`); bei 51
  Etagen wären das 51 WebGL-Renderdurchgänge beim Start, obwohl es nur neun
  Tierarten gibt (`js/models.js:312-321`). Verworfen: Bilder erst beim
  Öffnen der Tierübersicht rendern (verschiebt die Wartezeit nur dorthin).
- **A15** [high] Verifikation läuft headless über Playwright gegen einen
  selbst gestarteten `python3 -m http.server`, **im Vordergrund**. Das Repo
  hat kein Unit-Test-Framework, und `CLAUDE.md` verbietet
  `run_in_background` für Verifikationsläufe ausdrücklich (Issue #11 ist
  genau daran gestorben: 59 von 80 Turns, `success`, nichts gepusht).
  Verworfen: `curl` auf `index.html` (zeigt das statische Markup, nicht den
  von `updateHUD()` geschriebenen Text).
- **A16** [med] Die Turmhöhe wird in den Prüfläufen über
  `localStorage['wipfelkratzer-v1']` vorbelegt statt fünfzigmal geklickt.
  Beleg, dass das trägt: `js/game.js:35-36`. `window.wipfelkratzer`
  (`js/game.js:1188`) wird um `MAXF` und `tenantOf` erweitert, damit die
  Prüfungen die Werte direkt lesen können — dieser Debug-Zugriff existiert
  bereits ausdrücklich für Playwright-Checks.

## Consequences

- **Positiv:** Die Turmhöhe ist ab jetzt ein Parameter, keine Konstante.
  Wer eine vierte Stufe will, ergänzt einen Knopf — der Rest folgt.
- **Positiv:** Der Zehner-Turm ist nachweislich unverändert: Verjüngung,
  Kamera, Nebel und Schatten sind so formuliert, dass sie bei `MAXF = 10`
  exakt auf die heutigen Zahlen fallen. Das ist als Abnahmekriterium
  festgehalten, nicht nur behauptet.
- **Positiv:** Die verzögerte Etagenerzeugung nützt auch dem Zehner-Turm:
  beim Start entsteht nur noch das Erdgeschoss statt elf Gruppen.
- **Kosten:** Die Höhenwahl kostet einen Seiten-Neustart und damit einen
  zweiten Tipp auf «Los geht's!». Das trifft nur den Spielanfang.
- **Kosten:** Ab Etage 10 heissen die Bewohner nach einem Schema, nicht
  nach einer Idee. Bei 50 Stockwerken kommen Tierarten und Wünsche
  zwangsläufig mehrfach vor; der Name ist es, der sie unterscheidet.
- **Kosten:** Der Wunschkasten zeigt nicht mehr alle offenen Wünsche,
  sondern fünf plus Zähler.
- **Risiko, mittel:** `TENANTS[i]` wird an zwölf Stellen direkt indiziert
  (`js/game.js:542, 649, 752, 767, 772, 785, 796, 833, 856, 960, 978,
  979`). Wird eine davon beim
  Umbau auf `tenantOf(i)` übersehen, ist die Folge `undefined.name` —
  sichtbar als `pageerror`, den jeder Prüflauf abfängt.
- **Risiko, gering:** Wird `roofWish` nicht auf `MAXF` verschoben, bleibt
  der Pool-Wunsch auf Etage 10 hängen und der Party-Knopf
  (`js/game.js:525`) erscheint nie. Eigenes Abnahmekriterium.
- **Kein Risiko für Fotos:** `wipfelkratzer-fotos` wird nicht angefasst.

## Acceptance Criteria

- [ ] Ein Spielstand **ohne** `maxFloors` (also jeder heute bestehende)
      lädt fehlerfrei, `MAXF` ist 10, und die Anzeige nennt 10 Stockwerke.
- [ ] Bei einem solchen Altstand sind `W(1..10)` und `D(1..10)` identisch
      zu den heutigen Werten (`W(10) = 4.9`, `D(10) = 3.92`), und
      `controls.maxDistance`, `camera.far` sowie `scene.fog.near/far`
      haben unverändert die Werte 44, 200, 45 und 110.
- [ ] Ein Altstand mit `floors: 10` und eingerichteten Wohnungen zeigt
      dieselben elf Bewohnernamen wie heute, in derselben Reihenfolge, und
      die Möbel stehen an denselben Stellen.
- [ ] Der Startbildschirm zeigt bei leerem `localStorage` drei
      Höhenknöpfe (10 / 20 / 50); bei vorhandenem Spielstand nur
      «Los geht's!».
- [ ] Nach Wahl von «50» steht `maxFloors: 50` im Spielstand und der
      neu geladene Turm meldet `MAXF === 50`.
- [ ] Bei `MAXF === 50` ist `W(50) === 4.9` und `D(50) === 3.92`; kein
      `W(i)` oder `D(i)` für `i` in `1..50` ist kleiner oder gleich null.
- [ ] Bei `MAXF === 50` hat jede Etage `0..50` einen Bewohner mit
      nicht-leerem `name`, einem `wish` aus dem Katalog und einem `wtext`,
      der auf `.` endet; kein `undefined` im Text.
- [ ] Bei `MAXF === 50` trägt genau Etage 50 `roofWish: true`, und bei
      `floors: 50` mit bewohnter Etage 50 ist `#btn-party` sichtbar.
- [ ] `tenantOf(i)` liefert über zwei Seitenaufrufe hinweg denselben Namen
      für dieselbe Etage.
- [ ] Bei `MAXF === 50` und `floors: 50` steht der Turm vollständig im
      Bild: `topY()` ist kleiner als `scene.fog.far`, und
      `controls.maxDistance` ist gross genug, dass die Kamera den Turm
      ganz fasst.
- [ ] Bei `floors: 0` existieren höchstens zwei Etagengruppen
      (Erdgeschoss plus Reserve), nicht `MAXF + 1`; nach zehn Klicks auf
      «Stockwerk bauen» existieren elf.
- [ ] Sind mehr als fünf Wünsche offen, zeigt `#wishes` fünf Einträge plus
      eine Zeile mit der Anzahl der übrigen.
- [ ] Jeder Prüflauf meldet null `pageerror`.
- [ ] `version.js` ist unverändert, und es gibt keinen
      `chore(release)`-Commit; der Eintrag steht unter
      `## [Unreleased]` in `CHANGELOG.md`.
