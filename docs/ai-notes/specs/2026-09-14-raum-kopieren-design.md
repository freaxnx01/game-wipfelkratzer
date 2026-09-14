# Spec — Einen Raum samt Einrichtung kopieren (Issue #48)

Repo: `game-wipfelkratzer`. Basis: `main`, v0.5.0 (`version.js`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein npm, kein Test-Framework. UI einsprachig
Deutsch.

## Problem

Eine Wohnung einzurichten dauert: Möbel aus dem Katalog holen, mit
«Verschieben» und «Drehen» hinstellen, Wandobjekte mit dem Wandkreuz
zurechtrücken (`js/game.js:1046-1052`), Tapete pro Wand und Boden wählen
(`setLook`, `js/game.js:406-413`). Bei zehn Stockwerken macht man das
zehnmal. Wer eine Wohnung schön findet, will sie noch einmal haben, statt
sie noch einmal zu bauen.

Die Bausteine dafür liegen schon da:

- Die Einrichtung eines Stockwerks ist eine schlichte Liste in
  `state.rooms[k]`, geholt über `roomOf(k)` (`js/game.js:43`). Jeder
  Eintrag hat `id`, `x`, `z`, `y`, `rot`, `cell` und seit Issue #11
  optional `wall`.
- `placeItemMesh(k, entry)` (`js/game.js:447-464`) baut aus einem solchen
  Eintrag das Mesh und hängt es an die richtige Etage; genau das tut auch
  der Ladepfad beim Start (`js/game.js:1177-1182`).
- `clampEntry(k, m, en)` (`js/game.js:427-446`) zieht einen Eintrag auf die
  Masse **der Zieletage** zurecht — für Wandobjekte über `wallPlacement(k,
  wall)` (`js/game.js:371-379`), für alles andere über `W(k)`/`D(k)`.

Eine Kopie ist damit im Kern: Liste duplizieren, je Eintrag
`placeItemMesh` + `clampEntry`. Was fehlt, sind die Entscheidungen
drumherum.

### Was nicht in `state.rooms` steht

Tapete und Boden liegen getrennt: `state.wallpaper[k]` ist seit Issue #11
ein Objekt mit vier Wandschlüsseln (`wallpaperOf`, `js/game.js:382-387`),
`state.flooring[k]` ist eine einzelne Belags-Id (`applyLook`,
`js/game.js:388-395`). Das Issue schreibt `state.floorLook` — der Code
heisst `state.flooring` (`js/game.js:35`, gelesen in `js/game.js:390`,
geschrieben in `js/game.js:408`). Wer «den Raum» kopiert, meint beides mit.

### Nicht alle Ebenen sind gleich

`dims(k)` (`js/game.js:358`) behandelt die Dachterrasse gesondert, und der
Unterschied geht tiefer als eine Zahl:

- Die Terrasse hat **keine Wände**. `applyLook()` steigt für `'roof'` sofort
  wieder aus (`js/game.js:389`), `setLook()` ebenfalls (`js/game.js:407`).
  Wandobjekte (`WALL_ITEMS`, `js/models.js:272`) hätten dort nichts zum
  Anhängen.
- Die Terrasse hat eine andere Aufstandshöhe: `baseY('roof')` ist
  `ROOF_DECK_T`, sonst `0.155` (`js/game.js:364`).
- Die Terrasse hat eine Treppenöffnung, um die `clampEntry` Möbel
  herumschiebt (`js/game.js:442-444`).
- `dims('roof')` ist `6.6 - 0.7` × `4.8 - 0.9`, jede normale Etage
  `W(k) - 0.7` × `D(k) - 1.0` — und `W`/`D` schrumpfen nach oben
  (`js/game.js:7-8`). Zwischen zwei **normalen** Etagen ist das unkritisch,
  weil `clampEntry` schon heute genau dafür da ist.

### Was mit dem Ziel passieren soll

Überschreiben ohne Rückfrage kann eine Stunde Arbeit mit einem Tipp
vernichten. Es gibt kein Rückgängig im Spiel; `removeItem`
(`js/game.js:713-719`) ist die einzige Löschgeste und trifft ein einzelnes
Möbel.

### Bewohner

Tiere hängen an `tenantGroups[i]` (`js/game.js:243, 299`), werden von
`spawnTenant(i)` (`js/game.js:750-763`) erzeugt und gehören zur Wohnung,
nicht zur Einrichtung — jede Etage hat ihre eigene Familie mit eigenem
Wunsch. Sie werden nicht mitkopiert. Aber: `tenantIn(k)` prüft
`roomOf(k).length >= 3` (`js/game.js:44`), und `checkTenant(k)`
(`js/game.js:764`) lässt die Familie der **Zieletage** einziehen, sobald
drei Sachen dort stehen. Eine Kopie löst das also aus — und das ist richtig
so.

## Entscheidung

Zwei Knöpfe in der Einrichtungsleiste `#editbar` (`index.html:181-185`),
eine Zwischenablage im Arbeitsspeicher, und eine Rückfrage, bevor etwas
verlorengeht.

### Bedienung

- In der Einrichtungsansicht einer **normalen** Etage steht neben «Tipp»
  und «Fertig» ein Knopf **«Raum kopieren»**. Er merkt sich die Etage und
  meldet «Wohnung E3 gemerkt — geh auf ein anderes Stockwerk und tippe auf
  «Raum einfügen».»
- Ist etwas gemerkt, zeigt `#editbar` in jeder **anderen** normalen Etage
  zusätzlich **«Raum einfügen»**. In der Quelletage selbst und auf der
  Dachterrasse erscheint er nicht.
- Die Zwischenablage lebt nur in der Sitzung. Sie wird nicht gespeichert.

### Was kopiert wird

Eine tiefe Kopie von `state.rooms[quelle]`, dazu `state.wallpaper[quelle]`
(alle vier Wände) und `state.flooring[quelle]`. Nicht kopiert werden
Bewohner, erfüllte Wünsche (`state.fulfilled`) und Fotos.

### Überschreiben oder ergänzen

- Ist die Zielwohnung **leer** (`roomOf(ziel).length === 0`), wird ohne
  Rückfrage eingefügt.
- Ist sie **nicht leer**, öffnet sich ein Dialog im Stil der bestehenden
  Overlays (`#residents`, `index.html:208-214`) mit drei Knöpfen:
  **«Alles ersetzen»**, **«Dazustellen»**, **«Abbrechen»**. Kein
  `window.confirm()` — das ist auf einem Tablet ein Systemdialog in
  fremder Schrift, und das Spiel hat für Overlays eine eigene Sprache.
- «Alles ersetzen» räumt die Zielwohnung zuerst leer (dieselbe Mechanik wie
  `removeItem`, `js/game.js:713-719`, nur für alle Einträge) und fügt dann
  ein. «Dazustellen» lässt Vorhandenes stehen.

### Anpassung an die Zieletage

Jeder eingefügte Eintrag durchläuft nach `placeItemMesh` ein
`clampEntry(ziel, mesh, entry)` — die Funktion, die es für genau diesen
Zweck schon gibt. Zusätzlich:

- `cell` wird auf den Zellbereich der Zieletage begrenzt
  (`colsOf(ziel) * 2 - 1`, `js/game.js:359, 466`), damit «Verschieben»
  weiter sinnvoll springt.
- Deko (`DECO`, `js/game.js:366`) bekommt ihr `y` über
  `surfaceYAt(ziel, x, z)` (`js/game.js:415-424`) neu, damit sie auf dem
  kopierten Tisch landet und nicht daneben in der Luft.
- Wandobjekte behalten ihr `wall` und ihr `x` entlang der Wand;
  `clampEntry` rechnet Ebene und Drehung aus der Zieletage neu
  (`js/game.js:428-436`).

Danach: `applyLook(ziel)`, `checkTenant(ziel)`, je kopierter
Gegenstand einmal `checkWishes(id, ziel)`, `renderWishes()`,
`renderResidents()`, `save()`, `updateHUD()`.

## Goals

- Eine fertig eingerichtete Wohnung lässt sich mit zwei Tipps auf ein
  anderes Stockwerk übertragen — samt Tapete und Boden.
- Nichts geht ohne Rückfrage verloren.
- Die Kopie sitzt in der Zieletage richtig, auch wenn diese schmaler ist.
- Wer eine leere Wohnung befüllt, bekommt die Bewohner der Zieletage —
  nicht die der Quelle.

## Non-Goals

- **Die Dachterrasse bleibt aussen vor.** Weder Quelle noch Ziel. Sie hat
  keine Wände, eine andere Aufstandshöhe und eine Treppenöffnung; ein
  Kopieren dorthin wäre eine eigene Aufgabe mit eigenen Regeln.
- **Kein Rückgängig.** Die Rückfrage tritt an dessen Stelle.
- **Kein Kopieren über Spielstände hinweg**, kein Export, kein
  Teilen-Knopf.
- **Keine Vorlagen-Bibliothek.** Genau ein gemerkter Raum, und der nur für
  die laufende Sitzung.
- **Bewohner, erfüllte Wünsche und Haselnüsse werden nicht kopiert.**
- **Kein Umbau von `js/models.js`.**

## Assumptions

- **A1** [high] Die Knöpfe sitzen in `#editbar`, nicht im Katalog. Das
  Issue nennt die Leiste ausdrücklich, und sie ist der Ort, an dem die
  Aktionen für die **ganze** Wohnung stehen («Tipp», «Fertig»,
  `index.html:181-185`); der Katalog trägt Aktionen für einzelne
  Gegenstände (`renderCatalog`, `js/game.js:551-602`).
- **A2** [med] Die Zwischenablage lebt nur im Arbeitsspeicher und wird
  nicht in `state` gespeichert. Verworfen: mitspeichern — das
  Speicherformat müsste eine zweite Kopie derselben Einrichtung tragen
  (`save()` serialisiert den ganzen `state`, `js/game.js:37-42`), und ein
  über Tage gemerkter Raum, dessen Quelle inzwischen umgeräumt ist, wäre
  mehr Überraschung als Hilfe.
- **A3** [high] Tapete (`state.wallpaper[k]`) und Boden
  (`state.flooring[k]`) werden **mitkopiert**. Beleg, dass beide getrennt
  liegen: `js/game.js:35` (Zustandsliteral), `js/game.js:390` (`applyLook`
  liest beide), `js/game.js:408-410` (`setLook` schreibt sie getrennt).
  Verworfen: nur die Möbel kopieren (der sichtbarste Teil einer schön
  eingerichteten Wohnung ist die Tapete) und ein zusätzlicher Schalter
  «mit Tapete» (ein dritter Knopf für eine Frage, die niemand mit «nein»
  beantwortet).
- **A4** [high] Die Dachterrasse ist als Quelle **und** als Ziel
  ausgeschlossen; die Knöpfe erscheinen dort nicht. Belege: `applyLook`
  und `setLook` steigen für `'roof'` sofort aus (`js/game.js:389, 407`),
  `baseY` liefert dort eine andere Höhe (`js/game.js:364`), `clampEntry`
  kennt eine Treppenöffnung nur dort (`js/game.js:442-444`), und
  Wandobjekte bräuchten Wände, die es dort nicht gibt
  (`wallPlacement` rechnet mit `W(k)`/`D(k)`, `js/game.js:371-378`).
  Verworfen: Kopieren mit stillem Weglassen der Wandobjekte (eine Kopie,
  die schweigend die Hälfte verliert, ist schlimmer als ein Knopf, der
  nicht da ist).
- **A5** [high] Bei nicht leerem Ziel kommt eine Rückfrage mit drei
  Möglichkeiten: ersetzen, dazustellen, abbrechen. Verworfen: immer
  ersetzen (das Issue nennt genau diesen Verlust als Gefahr); immer
  ergänzen (dann stehen zwei Betten ineinander, und man kann eine Wohnung
  nie sauber «so wie die andere» machen); `window.confirm()` (Systemdialog,
  bricht mit der Bildsprache und kennt nur zwei Antworten).
- **A6** [med] Bei leerem Ziel wird ohne Rückfrage eingefügt. Verworfen:
  immer fragen — der häufigste Fall ist «ich habe unten eine schöne
  Wohnung und will sie oben noch einmal», und dort ist nichts zu
  verlieren.
- **A7** [high] Jeder eingefügte Eintrag läuft durch
  `clampEntry(ziel, …)`. Das ist die vorhandene Funktion, die Einträge auf
  die Masse einer Etage zurechtzieht (`js/game.js:427-446`); der Ladepfad
  benutzt sie heute nur fürs Dach (`js/game.js:1181`), weil dort die
  einzige Formänderung auftreten konnte. Verworfen: ohne Clamp einfügen
  (obere Etagen sind schmaler, `W(i)` fällt pro Etage,
  `js/game.js:7` — Möbel stünden in der Wand).
- **A8** [med] `cell` wird beim Einfügen auf den Zellbereich der
  Zieletage begrenzt. Beleg, dass der Bereich etagenabhängig ist:
  `freeCell` rechnet mit `colsOf(k) * 2` (`js/game.js:466`), und `colsOf`
  hängt über `dims(k)` an `W(k)` (`js/game.js:358-359`). Ein zu grosses
  `cell` bliebe folgenlos für die Darstellung, würde aber «Verschieben»
  (`js/game.js:1041-1048`) ins Leere springen lassen.
- **A9** [med] Deko bekommt ihr `y` über `surfaceYAt(ziel, x, z)` neu.
  Beleg, dass Deko auf Möbeln sitzt: `addItem` setzt ihr `y` genauso
  (`js/game.js:709`), und `SURFACES` (`js/game.js:426`) listet die
  Möbel, auf denen sie stehen darf. Voraussetzung: die Möbel werden
  **vor** der Deko eingefügt — die Reihenfolge der Liste bleibt erhalten,
  also wird zusätzlich in zwei Durchgängen eingefügt (erst Nicht-Deko,
  dann Deko).
- **A10** [med] Nach dem Einfügen laufen `checkTenant(ziel)` und je
  kopiertem Gegenstand `checkWishes(id, ziel)`. Die Familie der Zieletage
  zieht also ein, und ein kopiertes Wunschmöbel erfüllt ihren Wunsch samt
  drei Haselnüssen — genauso, als hätte man es von Hand hingestellt.
  Doppelzahlungen sind ausgeschlossen: `state.fulfilled[i]` wird gesetzt
  und vorher geprüft (`js/game.js:773-777`). Verworfen: Wünsche nicht
  prüfen (dann bliebe ein Wunsch offen, obwohl der Gegenstand sichtbar im
  Raum steht).
- **A11** [med] Die Rückfrage ist ein eigenes Overlay `#pasteask` nach dem
  Muster von `#residents` (`index.html:208-214`, CSS `index.html:84-85,
  118`). Verworfen: sie in `#editbar` unterbringen (die Leiste bricht auf
  schmalen Viewports schon heute um, `index.html:67`).
- **A12** [low] Der gemerkte Raum wird beim Kopieren **sofort** tief
  kopiert (`JSON.parse(JSON.stringify(...))`), nicht erst beim Einfügen.
  Damit ändert ein Umräumen der Quelle nach dem Kopieren die Kopie nicht
  mehr. Verworfen: die Quelle beim Einfügen frisch lesen (überrascht, wenn
  man zwischendurch aufgeräumt hat).
- **A13** [med] Beim Ersetzen wird die Zielwohnung mit derselben Mechanik
  geleert, die `removeItem` benutzt: Eintrag aus `roomOf(k)` entfernen,
  Mesh aus `parentOf(k)` entfernen, Mesh aus `itemMeshes[k]` entfernen
  (`js/game.js:713-719`). Verworfen: `state.rooms[k] = []` setzen und die
  Meshes stehen lassen (die Möbel blieben sichtbar, bis man neu lädt).
- **A14** [high] Verifikation läuft headless über Playwright gegen einen
  selbst gestarteten `python3 -m http.server`, **im Vordergrund**. Das
  Repo hat kein Unit-Test-Framework, und `CLAUDE.md` verbietet
  `run_in_background` für Verifikationsläufe ausdrücklich (Issue #11 ist
  genau daran gestorben). Verworfen: `curl` auf `index.html` — die
  Knöpfe werden von JS verdrahtet und ihr Zustand von `enterEdit()`
  gesetzt (`js/game.js:635-656`).
- **A15** [med] Die Prüfläufe belegen `localStorage['wipfelkratzer-v1']`
  vor und benutzen `window.wipfelkratzer.enterEdit` / `.exitEdit`
  (`js/game.js:1188`), um in die Einrichtungsansicht zu kommen, statt in
  der 3D-Szene zu klicken. Dieser Debug-Zugriff existiert ausdrücklich
  für Playwright-Checks. `window.wipfelkratzer` wird um `roomOf` und
  `itemMeshes` erweitert, damit der Prüfcode Liste und Meshes
  gegeneinander halten kann.

## Consequences

- **Positiv:** Die teuerste Geste im Spiel — eine Wohnung einrichten —
  wird wiederverwendbar. Bei einem hohen Turm (Issue #47) ist das der
  Unterschied zwischen «machbar» und «mühsam».
- **Positiv:** Die Anpassung an die Zieletage kostet nichts Neues:
  `clampEntry` ist dafür gebaut und wird hier bloss endlich auch für
  normale Etagen benutzt.
- **Positiv:** Das Speicherformat bleibt unverändert. Ein Spielstand, der
  durch eine Kopie entstanden ist, ist von einem handgestellten nicht zu
  unterscheiden.
- **Kosten:** Zwei weitere Knöpfe in `#editbar`. Auf schmalen Viewports
  bricht die Leiste dadurch früher um; sie ist bereits auf `max-width:
  92vw` mit Umbruch ausgelegt (`index.html:67`).
- **Kosten:** Eine Kopie kann einen Wunsch erfüllen und drei Haselnüsse
  auszahlen, ohne dass das Kind den Gegenstand bewusst gewählt hat. Das
  ist gewollt (der Gegenstand steht ja da), verschiebt aber das
  Spieltempo bei vielen Kopien.
- **Kosten:** Wer von einer breiten unteren auf eine schmale obere Etage
  kopiert, bekommt seine Möbel enger gestellt als im Original —
  `clampEntry` schiebt sie an den Rand. Das ist die einzige ehrliche
  Antwort auf unterschiedliche Raumgrössen.
- **Risiko, gering:** Wird das Leeren beim Ersetzen unvollständig gemacht
  (Liste geleert, Meshes nicht), bleiben Geistermöbel stehen. Eigenes
  Abnahmekriterium: nach dem Ersetzen muss `itemMeshes[ziel].length`
  gleich `roomOf(ziel).length` sein.
- **Risiko, gering:** Die Zwischenablage könnte auf eine Etage zeigen, die
  es nach «Neu anfangen» nicht mehr gibt — «Neu anfangen» lädt die Seite
  neu (`js/game.js:896`), damit ist auch die Zwischenablage weg.

## Acceptance Criteria

- [ ] In der Einrichtungsansicht einer normalen Etage ist «Raum kopieren»
      sichtbar; auf der Dachterrasse nicht.
- [ ] «Raum einfügen» ist erst sichtbar, nachdem etwas kopiert wurde, und
      nie in der Quelletage selbst.
- [ ] Nach Kopieren aus einer eingerichteten Etage und Einfügen in eine
      **leere** Etage hat die Zieletage ohne Rückfrage dieselbe Anzahl
      Einträge in `state.rooms` wie die Quelle, mit denselben `id`-Werten
      in derselben Reihenfolge.
- [ ] Nach demselben Einfügen stimmen `state.wallpaper[ziel]` in allen
      vier Wandschlüsseln und `state.flooring[ziel]` mit der Quelle
      überein.
- [ ] Nach demselben Einfügen ist `itemMeshes[ziel].length` gleich
      `roomOf(ziel).length`, und jedes Mesh hängt an `floorGroups[ziel]`.
- [ ] Kein eingefügter Eintrag liegt ausserhalb der Zieletage: für jeden
      Eintrag ohne `wall` gilt `|x| < W(ziel)/2` und `|z| < D(ziel)/2`.
- [ ] Ein kopiertes Wandobjekt hängt in der Zieletage an derselben Wand
      (`entry.wall` unverändert) und liegt in der Wandebene der
      **Zieletage**, nicht der Quelle.
- [ ] Einfügen in eine **nicht leere** Etage öffnet `#pasteask` und ändert
      vorher nichts an `state.rooms[ziel]`.
- [ ] «Abbrechen» schliesst den Dialog und lässt `state.rooms[ziel]`
      unverändert.
- [ ] «Dazustellen» ergibt `roomOf(ziel).length` gleich der Summe aus
      vorher und kopierten Einträgen.
- [ ] «Alles ersetzen» ergibt `roomOf(ziel).length` gleich der Anzahl
      kopierter Einträge, und `itemMeshes[ziel].length` ist gleich gross.
- [ ] Nach dem Einfügen in eine leere, gebaute Etage mit mindestens drei
      Gegenständen ist dort die **eigene** Familie eingezogen
      (`tenantGroups[ziel]` ist gesetzt, und die Bewohnerliste nennt für
      diese Etage deren Namen, nicht den der Quelle).
- [ ] Enthält die Kopie den Wunschgegenstand der Zieletage, ist
      `state.fulfilled[ziel]` danach gesetzt und `state.nuts` um drei
      gestiegen; ein zweites Einfügen zahlt nicht noch einmal.
- [ ] Ein Neuladen nach dem Einfügen zeigt dieselbe Wohnung — der
      Spielstand trägt alles, was die Kopie gesetzt hat.
- [ ] Jeder Prüflauf meldet null `pageerror`.
- [ ] `version.js` ist unverändert, und es gibt keinen
      `chore(release)`-Commit; der Eintrag steht unter `## [Unreleased]`
      in `CHANGELOG.md`.
