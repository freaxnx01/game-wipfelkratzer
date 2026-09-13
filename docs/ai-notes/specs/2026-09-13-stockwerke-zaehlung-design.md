# Spec — Stockwerke: elf Ebenen, zehn gebaute (Issue #35)

Repo: `game-wipfelkratzer`. Basis: `main`, v0.5.0 (`version.js`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Framework, keine Unit-Test-Suite.
UI ist einsprachig Deutsch (kein `i18n.js` im Repo — `ls js/` zeigt nur
`game.js` und `models.js`).

## Problem

Wer die Ebenen am fertigen Turm abzählt, kommt auf **11**; Anzeige und Knopf
sagen **10**. Das Issue hat das headless nachgemessen: `stateFloors = 10`,
`floorGroupsTotal = 11`, `visibleIdx = [0..10]`, `residentRows = ['10','9',
…,'1','E']`.

Es gibt kein überzähliges Stockwerk — es werden zwei verschiedene Dinge
gezählt:

- `MAXF = 10` (`js/game.js:6`) begrenzt die **gebauten** Stockwerke, und
  `state.floors` zählt genau diese. `buildFloor()` bricht bei
  `state.floors >= MAXF` ab (`js/game.js:804`).
- Ebene 0 ist das Erdgeschoss. Sie wird nie gebaut, sondern ist ab dem ersten
  Frame sichtbar: `g.visible = i === 0 || i <= state.floors`
  (`js/game.js:297`). Die Schleife, die die Etagengruppen erzeugt, läuft
  `for (let i = 0; i <= MAXF; i++)` (`js/game.js:246`) — also elf Gruppen.
- Ebene 0 ist optisch eine vollwertige Etage: eigene Breite/Tiefe/Höhe
  (`W`/`D`/`H`, `js/game.js:7-9`), eigene Haustür (`js/game.js:289-293`),
  eigener Laufsteg.
- `flLabel` (`js/game.js:32`) beschriftet sie mit `E`, und `TENANTS`
  (`js/game.js:19-31`) hat **11** Einträge — Index 0 sind «Die
  Kindergarten-Mäuse» mit der Einheit «Kindergarten und Partyraum». Das
  Erdgeschoss hat also eine echte Wohnung mit echten Bewohnern.
- `renderResidents()` (`js/game.js:791-800`) läuft `for (let i = MAXF; i >= 0;
  i--)` und rendert deshalb elf Zeilen: zehn nummerierte plus `E`.

Beide Zählweisen sind für sich stimmig. Die Anzeige sagt nur nirgends, welche
von beiden sie meint.

Zusätzlich ist die Zielzahl an zwei Stellen als **Literal** hinterlegt statt
an `MAXF` gebunden:

- `js/game.js:523`:
  `` `Stockwerk bauen (${state.floors + 1}/10)` `` — die `10` ist ein Literal
  im Template-String, nicht `MAXF`.
- `index.html:156`:
  `<div class="panel" id="floorinfo">Stockwerke: <span id="floors">0</span> / 10</div>`
  — die `10` steht statisch im Markup.
- `js/game.js:977`: `wishOpen(10)` — gemeint ist der Wunsch der Frösche auf
  `MAXF`, hart als `10` geschrieben.

Issue #47 (wählbare Turmhöhe, 10/20/50) fasst genau diese Stellen an. Ein
Literal dort ist eine Falle: `MAXF` liesse sich ändern, ohne dass Knopf und
HUD mitziehen.

## Entscheidung

Variante 1 des Issues (Anzeige anpassen) — der Turm bleibt, wie er ist.
Gebaut werden tatsächlich zehn Stockwerke, das Erdgeschoss bekommt man
geschenkt. Variante 2 (Erdgeschoss als Sockel) würde eine Wohnung und einen
`TENANTS`-Eintrag kosten, Variante 3 (auf 9 reduzieren) das Spielziel ändern
und einen `TENANTS`-Eintrag übrig lassen.

### Gewählte Formulierung

| Ort | Alt | Neu |
| --- | --- | --- |
| HUD (`index.html:156`) | `Stockwerke: 3 / 10` | `Erdgeschoss + 3 von 10 Stockwerken` |
| Bauknopf (`js/game.js:523`) | `Stockwerk bauen (4/10)` | unverändert im Wortlaut, `10` kommt aus `MAXF` |
| Bauknopf, fertig | `Fertig gebaut!` | unverändert |
| Bewohnerliste, Zeile `E` (`js/game.js:797`) | `E — Kindergarten und Partyraum` | `E — Kindergarten und Partyraum  ·  Erdgeschoss, war schon da` |

Begründung:

- Die HUD-Zeile ist die einzige Stelle, an der ein Kind nachzählt und mit dem
  Bild vergleicht. Sie nennt jetzt beide Zahlen, die im Bild vorkommen: das
  Erdgeschoss **und** die gebauten Stockwerke. `3 + 10` steht nicht da — das
  wäre eine Rechenaufgabe; stattdessen «Erdgeschoss + 3 von 10 Stockwerken»,
  ein Satz, der sich vorlesen lässt.
- «E + 10 Stockwerke» (Vorschlag des Issues) wurde verworfen: `E` ist eine
  Abkürzung, die man erst am Turm nachschlagen muss. Ausgeschrieben ist die
  Zeile länger, aber selbsterklärend, und `#floorinfo` ist ein eigenes Panel
  mit `font-size: 14px` (`index.html:46`), das die Zeile trägt.
- «bis 11 zählen» (die andere Hälfte von Variante 1) wurde verworfen: dann
  müssten `MAXF`, `buildFloor()` und die Wunschlogik mit einem Offset
  rechnen, das nirgends im Code steht. Die Anzeige soll sich der Mechanik
  anpassen, nicht umgekehrt.
- Der Bauknopf bleibt im Wortlaut, weil er zählt, was der Spieler **tut** —
  er baut Stockwerk 4 von 10, das Erdgeschoss hat er nie gebaut. Die `10`
  wird nur an `MAXF` gebunden, damit #47 nicht darüber stolpert.
- Die Bewohnerliste ist der Ort, an dem die elfte Zeile auftaucht und die
  Irritation entsteht («elf Zeilen, aber zehn Stockwerke»). Der Zusatz
  «Erdgeschoss, war schon da» beantwortet genau diese Frage an genau dieser
  Stelle, in der Sprache, in der das Spiel ohnehin spricht.
- Die Spalte `.fl` ist auf `width: 28px` festgenagelt (`index.html:121`) —
  das Wort «Erdgeschoss» passt dort nicht hinein. Deshalb steht der Zusatz in
  der zweiten Spalte, nicht anstelle des `E`.

## Goals

- Wer die Ebenen am Bild abzählt, findet die gezählte Zahl in der Anzeige
  wieder — entweder als «Erdgeschoss» oder als eines der zehn Stockwerke.
- Die Zielzahl steht im ausgelieferten UI nur noch an einer Stelle im Code:
  `MAXF`. Wer `MAXF` ändert, ändert HUD und Knopf mit.
- Keine Änderung an der 3D-Szene, an `TENANTS`, an `state`, am
  `localStorage`-Format oder am Spielziel.

## Non-Goals

- Issue #47 (wählbare Turmhöhe) wird **nicht** umgesetzt. Nur die Literale,
  die #47 sonst übersehen müsste, werden an `MAXF` gebunden.
- Das Erdgeschoss wird nicht zum Sockel umgebaut (Variante 2) und `MAXF`
  nicht auf 9 gesenkt (Variante 3).
- `flLabel` bleibt unverändert. Es wird an sieben Stellen benutzt
  (`js/game.js:650, 787, 797, 836`), unter anderem in der schmalen
  `.fl`-Spalte und im Edit-Titel; eine Änderung dort hätte Folgen weit über
  dieses Issue hinaus.
- Keine Übersetzung, kein `i18n.js` — das Spiel ist einsprachig Deutsch.

## Assumptions

- **A1** [high] Variante 1 des Issues wird umgesetzt: nur die Anzeige ändert
  sich, der Turm behält elf Ebenen und zehn baubare Stockwerke. Verworfen:
  Erdgeschoss als Sockel ohne Wohnung (kostet den `TENANTS[0]`-Eintrag «Die
  Kindergarten-Mäuse», `js/game.js:20`); `MAXF = 9` (ändert das Spielziel und
  lässt einen der elf `TENANTS`-Einträge unbewohnt, `js/game.js:19-31`). Der
  Issue-Text empfiehlt Variante 1 ausdrücklich.
- **A2** [med] Die HUD-Zeile lautet «Erdgeschoss + N von 10 Stockwerken» —
  ausgeschrieben, als lesbarer Satz. Verworfen: «E + 10 Stockwerke» (nutzt
  die Abkürzung aus `flLabel`, `js/game.js:32`, die ein Kind erst am Turm
  entschlüsseln muss) und «Stockwerke: N / 11» (würde gegen `MAXF = 10`,
  `js/game.js:6`, und gegen `state.floors` laufen).
- **A3** [med] Der Wortlaut des Bauknopfes bleibt «Stockwerk bauen (N/10)»
  bzw. «Fertig gebaut!»; nur die `10` wird aus `MAXF` gespeist. Verworfen:
  «Stockwerk N von 10 bauen» (doppelt die HUD-Aussage und macht den Knopf auf
  schmalen Viewports breiter — `#toolbar` bricht dort schon um,
  `index.html:48`). Beleg für den heutigen Wortlaut: `js/game.js:523`.
- **A4** [med] Die Erdgeschoss-Zeile der Bewohnerliste bekommt den Zusatz
  «Erdgeschoss, war schon da» in der zweiten Spalte. Verworfen: der Zusatz in
  der `.fl`-Spalte (dort `width: 28px`, `index.html:121`) und ein eigener
  Listenkopf «11 Ebenen» (erklärt die Zahl, ohne zu sagen, warum).
- **A5** [high] Die statische `10` im HUD-Markup (`index.html:156`) wird durch
  ein von JS gefülltes `<span id="floors-max">` ersetzt, das `updateHUD()`
  (`js/game.js:522-526`) auf `MAXF` setzt. Verworfen: die `10` im Markup
  stehen lassen (wäre die Falle, die das Issue für #47 beschreibt) und den
  ganzen `#floorinfo`-Text in JS zu erzeugen (mehr Diff als nötig).
- **A6** [low] `wishOpen(10)` (`js/game.js:977`) wird im selben Zug zu
  `wishOpen(MAXF)`. Semantisch identisch, solange `MAXF === 10`; es ist das
  dritte und letzte Literal derselben Klasse. Verworfen: unangetastet lassen
  (dann bliebe genau eine Falle für #47 stehen).
- **A7** [high] Die Verifikation läuft headless über Playwright gegen einen
  lokalen `python3 -m http.server`, **im Vordergrund**, weil das Repo keine
  Unit-Test-Suite hat und `CLAUDE.md:550-562` `run_in_background` für
  Verifikationsläufe ausdrücklich verbietet (Issue #11 ist genau daran
  gescheitert). Verworfen: `curl`-Prüfung des Markups (zeigt nur das
  statische HTML, nicht den von `updateHUD()` geschriebenen Text —
  `CLAUDE.md:525-548`).
- **A8** [med] Der Spielstand wird für die Prüfung über
  `localStorage['wipfelkratzer-v1']` vorbelegt statt zehnmal geklickt. Beleg,
  dass das trägt: `js/game.js:35-36` lädt den Stand mit
  `Object.assign(state, JSON.parse(s))`. Ein Klicklauf 0→1 bleibt zusätzlich
  drin, damit der `updateHUD()`-Pfad aus `buildFloor()` (`js/game.js:811`)
  wirklich einmal durchlaufen wird.

## Consequences

- **Positiv:** Die Anzeige beschreibt ab sofort, was sie zählt; die
  Rückmeldung «es sind 11 statt 10» hat keine Grundlage mehr, ohne dass am
  Turm etwas verändert wird.
- **Positiv für #47:** Nach dieser Änderung reicht für die wählbare Turmhöhe
  eine Änderung an `MAXF`, damit HUD und Knopf mitziehen. Vorher hätte #47
  drei Literale an drei Stellen finden müssen.
- **Kosten:** Die HUD-Zeile wird länger («Erdgeschoss + 0 von 10
  Stockwerken» statt «Stockwerke: 0 / 10»). `#floorinfo` ist ein eigenes
  Panel im `#hud`-Stapel (`index.html:155-158`), das umbrechen darf; auf sehr
  schmalen Viewports kann es zweizeilig werden. Das ist Teil der Abnahme.
- **Kosten:** Die Bewohnerliste bekommt in der `E`-Zeile eine zweite
  Textebene. Betroffen ist nur `renderResidents()` (`js/game.js:791-800`);
  die Tierkarten (`renderAnimals()`, `js/game.js:831-841`, «Stock E») bleiben
  bewusst unangetastet — dort steht die Ebene neben einem Tierbild, nicht in
  einer abzählbaren Liste.
- **Risiko, gering:** `#floors-max` ist ein neues Element-Id in
  `index.html`. Wird es vergessen, wirft `$('floors-max').textContent` beim
  ersten `updateHUD()` (`js/game.js:1192`) — das fängt die
  `pageerror`-Prüfung der Verifikation ab.
- **Kein Risiko für Spielstände:** `state` und das Speicherformat
  (`js/game.js:34-40`) werden nicht angefasst; bestehende Stände laden
  unverändert.

## Acceptance Criteria

- [ ] Bei `state.floors = 0` steht im HUD «Erdgeschoss + 0 von 10
      Stockwerken».
- [ ] Bei `state.floors = 3` steht im HUD «Erdgeschoss + 3 von 10
      Stockwerken».
- [ ] Bei `state.floors = 10` steht im HUD «Erdgeschoss + 10 von 10
      Stockwerken».
- [ ] Die `10` in der HUD-Zeile stammt zur Laufzeit aus `MAXF`: setzt man
      `MAXF` testweise auf einen anderen Wert, zeigt das HUD diesen Wert.
- [ ] Der Bauknopf zeigt bei `state.floors = 3` «Stockwerk bauen (4/10)», und
      die `10` darin stammt aus `MAXF`, nicht aus einem Literal — `grep -n
      "/10" js/game.js index.html` findet keine Trefferstelle mehr in Knopf-
      oder HUD-Text.
- [ ] Bei `state.floors = 10` zeigt der Bauknopf «Fertig gebaut!» und ist
      `disabled`.
- [ ] Ein echter Klick auf «Stockwerk bauen» von 0 auf 1 aktualisiert HUD und
      Knopf auf «Erdgeschoss + 1 von 10 Stockwerken» bzw. «Stockwerk bauen
      (2/10)».
- [ ] Die Bewohnerliste hat weiterhin elf Zeilen, und die `E`-Zeile enthält
      den Text «Erdgeschoss, war schon da».
- [ ] Die nummerierten Zeilen der Bewohnerliste (`1`–`10`) enthalten diesen
      Zusatz **nicht**.
- [ ] `js/game.js` enthält kein `wishOpen(10)` mehr.
- [ ] Beim Laden und während der gesamten Prüfung wird kein `pageerror`
      ausgelöst (ein `favicon.png`-404 ist erlaubt und wird nicht gewertet).
- [ ] Ein bestehender Spielstand aus `localStorage['wipfelkratzer-v1']` lädt
      unverändert; `state.floors` wird korrekt übernommen.
- [ ] `CHANGELOG.md` hat unter `[Unreleased]` → `Fixed` einen Eintrag zu
      diesem Issue.
