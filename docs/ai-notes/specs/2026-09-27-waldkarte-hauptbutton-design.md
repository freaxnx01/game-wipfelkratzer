# Spec — Hauptbutton für die Waldkarte (Issue #106)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #106, aufgenommen über FlowHub (Telegram, 27.09.2026). Der ganze
Wortlaut: «Hauptbutton für (Wald)karte».

## Problem

Die Waldkarte gibt es bereits. Sie ist seit Issue #51 die Darstellung der
Turmübersicht: `#stand-grid` trägt die Klasse `waldkarte`
(`js/game.js:2487`), vier `.lichtung`-Plätze liegen auf einer gemalten
Waldfläche mit Bach (`index.html:170-189`), und `renderStaende` baut sie bei
jedem Öffnen neu auf.

Erreichbar ist sie aber nur über **zwei Klicks im Untermenü**: «Extras»
öffnet `#extras-menu` (`js/game.js:2246`), und dort steht als letzter von
sieben Einträgen «Meine Türme» (`index.html:324`). Die Werkzeugleiste selbst
(`index.html:305-315`) kennt die Karte nicht.

Damit steht die auffälligste Ansicht des Spiels an der unauffälligsten Stelle
der Oberfläche. Das Extras-Menü ist die Schublade für Selteneres — Brücke,
Bewohner-Schild, Tier-Übersicht, Fotogalerie. Die Waldkarte ist dagegen der
Ort, an dem man zwischen seinen Türmen wechselt, einen neuen anlegt und die
drei Orte im Wald besucht; sie gehört auf die erste Ebene.

## Was der Wunsch meint

Ein **Hauptbutton** ist ein Knopf in der Werkzeugleiste `#toolbar` — dieselbe
Ebene wie «Stockwerk bauen», «Einrichten», «Hineingehen». Ein Tipp, und die
Karte ist offen.

Die Klammer in «(Wald)karte» ist der Hinweis darauf, wie der Wunsch die
Ansicht nennt: *die Karte*, nicht «Meine Türme». Der Knopf soll also auch so
heissen.

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründungen stehen jeweils
dabei, damit sie widerlegbar sind.

- **E1 — Der Knopf wandert, er kommt nicht dazu.** Der bestehende
  `#btn-staende` wird aus `#extras-menu` (`index.html:324`) in `#toolbar`
  verschoben. Verworfen: ihn im Extras-Menü stehen lassen und einen zweiten in
  der Leiste ergänzen. Zwei Wege zur selben Ansicht sind für ein Kind kein
  Gewinn, sondern eine Dublette, und ein zweiter Knopf bräuchte eine zweite
  `id` samt zweitem Handler. Die `id` `btn-staende` bleibt, damit
  `js/game.js:2640` unverändert weiterläuft.

- **E2 — Die Aufschrift lautet «Waldkarte».** In der Werkzeugleiste stehen
  Tätigkeiten und Orte («Einrichten», «Hineingehen», «Foto»); «Waldkarte»
  passt dort besser als «Meine Türme» und ist das Wort aus dem Wunsch.
  Verworfen: «Meine Türme» beibehalten — das beschreibt den Inhalt, nicht den
  Ort, und war schon im Menü die blasseste Zeile.

- **E3 — Die Überschrift des Dialogs heisst ebenfalls «Waldkarte».**
  `index.html:440` sagt heute «Meine Türme». Knopf und das, was sich öffnet,
  sollen gleich heissen, sonst ist der Tipp eine kleine Überraschung.
  Verworfen: nur den Knopf umbenennen.

- **E4 — Der Knopf im Startdialog bleibt «Meine Türme».**
  `#btn-intro-staende` (`index.html:478`) steht im Intro, wo es noch keine
  Karte und keinen Wald gibt; dort beantwortet er die Frage «wo sind meine
  bisherigen Türme?». Verworfen: ihn mit umbenennen.

- **E5 — Der Knopf steht an dritter Stelle, zwischen «Einrichten» und
  «Extras».** Die Leiste bricht auf schmalen Geräten um
  (`index.html:59`, `flex-wrap: wrap`); frühe Knöpfe landen in der ersten
  Zeile und sind sicher erreichbar. «Stockwerk bauen» und «Einrichten» bleiben
  das Paar am Anfang, die Waldkarte eröffnet danach die zweite Gruppe, und
  «Extras» rutscht eine Position nach rechts. Verworfen: ganz ans Ende hinter
  «Musik aus» — das ist auf 400 px Breite die letzte Zeile und damit wieder
  versteckt.

- **E6 — Der Knopf bekommt **keine** Klasse `primary`.** Grün ist im Spiel die
  eine Handlung, die man als nächstes tun soll («Stockwerk bauen»,
  `index.html:306`; `button.primary` in `index.html:37`). Ein zweites Grün
  daneben schwächt beide. «Hauptbutton» heisst hier erste Ebene, nicht grüne
  Farbe. Verworfen: `class="primary"` — wäre ein Griff nach Aufmerksamkeit,
  die «Stockwerk bauen» braucht.

- **E7 — `js/game.js` wird nicht angefasst.** Der Handler
  `$('btn-staende').onclick = () => { $('extras-menu').classList.remove('open');
  oeffneStaende(); }` (`js/game.js:2640`) bleibt richtig: schliesst das
  Extras-Menü, falls es offen ist, und öffnet die Übersicht. Verworfen: das
  `remove('open')` streichen, weil der Knopf nicht mehr im Menü steht — es
  sorgt weiterhin dafür, dass das offene Menü beim Sprung auf die Karte
  zugeht.

## Zuschnitt

**Drin:**

- `#btn-staende` von `#extras-menu` nach `#toolbar` verschieben, an die dritte
  Stelle.
- Aufschrift des Knopfes → «Waldkarte».
- Überschrift `#staende h2` → «Waldkarte».
- Changelog-Eintrag unter `## [Unreleased]`.

**Draussen:**

- Die Waldkarte selbst — Lichtungen, Orte, Bach, Bauplätze bleiben, wie sie
  sind (`js/game.js:2485-2538`, `index.html:170-224`).
- `js/game.js`, `js/staende.js`, `js/standdatei.js` — unverändert.
- Ein Symbol oder Icon auf dem Knopf. Die ganze Leiste ist heute reine
  Schrift; ein einzelnes Bildchen wäre ein neuer Stil, kein Detail.
- `version.js` und ein `chore(release)`-Commit.

## Architektur

Eine reine Markup-Änderung an `index.html`: zwei verschobene bzw. geänderte
Zeilen plus eine Überschrift. Kein neues CSS — `#toolbar > button` erbt
Grösse, Farbe und Abstand von den Regeln, die schon für die anderen neun
Knöpfe gelten (`index.html:59-60`, `button` in `index.html:34-37`, sowie die
Schmalansicht `index.html:285-291`). Kein neues JavaScript, kein neuer
Netzzugriff, keine neue Abhängigkeit.

Der einzige Nebenwirkungspfad, der geprüft gehört, ist die Höhe der Leiste:
`--toolbar-h` wird aus `tb.offsetHeight` gesetzt und von einem
`ResizeObserver` auf der Border-Box nachgeführt (`js/game.js:826-828`).
Daran hängen `#selbar`, `#besuchbar`, `#extras-menu`, `#catalog`,
`#toast-stack` und `#wishes`. Ein zehnter Knopf kann auf schmalen Geräten eine
weitere Zeile erzeugen — der Beobachter fängt das ab, aber genau das ist die
Stelle, die die Verifikation belegen muss statt zu behaupten.

## Verifikation

Kein Test-Runner in diesem Stack. Das Gate ist headless Playwright **im
Vordergrund** (nie `run_in_background`), dazu der manuelle Playtest.

Geprüft wird:

1. `#toolbar` enthält `#btn-staende` mit dem Text «Waldkarte», `#extras-menu`
   enthält ihn nicht mehr.
2. Ein Klick auf den Knopf öffnet `#staende` (`.open`), und darin stehen vier
   `.lichtung`-Plätze auf einem `#stand-grid.waldkarte`.
3. Bei offenem Extras-Menü schliesst derselbe Klick das Menü.
4. Schmalansicht 400 × 800: Der Knopf ist sichtbar, seine Trefferfläche ist
   mindestens 44 px hoch, `#toolbar` scrollt nicht waagrecht, und
   `--toolbar-h` entspricht der tatsächlichen Höhe der Leiste.
5. `#btn-intro-staende` öffnet die Übersicht weiterhin.
6. Kein `pageerror` über den ganzen Lauf. Bekannte, erlaubte Warnungen:
   `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`, 404 auf
   `favicon.png`.

## Akzeptanzkriterien

- [ ] In der Werkzeugleiste steht ein Knopf «Waldkarte» an dritter Stelle,
      zwischen «Einrichten» und «Extras».
- [ ] Ein Tipp darauf öffnet die Turmübersicht mit der Waldkarte (vier
      Lichtungen, Bach, die drei Orte).
- [ ] «Meine Türme» steht nicht mehr im Extras-Menü; dort bleiben sechs
      Einträge.
- [ ] Die Überschrift des Dialogs lautet «Waldkarte».
- [ ] Der Knopf ist nicht grün — «Stockwerk bauen» bleibt der einzige
      `primary`-Knopf der Leiste.
- [ ] War das Extras-Menü offen, ist es nach dem Tipp zu.
- [ ] Der Knopf «Meine Türme» im Startdialog funktioniert unverändert.
- [ ] Bei 400 px Breite ist der Knopf erreichbar, mindestens 44 px hoch, die
      Leiste scrollt nicht waagrecht, und nichts überlappt sie.
- [ ] Die Konsole meldet über den ganzen Lauf keinen `pageerror`.
- [ ] `js/game.js`, `js/staende.js` und `js/standdatei.js` sind unverändert.
- [ ] `CHANGELOG.md` hat unter `## [Unreleased]` → `### Changed` einen
      deutschen Eintrag aus Spielersicht mit `(#106)`.

## Folgen

- Die Werkzeugleiste wächst von neun auf zehn Knöpfe. Auf schmalen Geräten
  bricht sie dadurch früher in eine zweite Zeile um; alles, was an
  `--toolbar-h` hängt, rückt entsprechend nach oben. Das ist bestehendes,
  beobachtetes Verhalten (`js/game.js:826-828`), aber die sichtbare Fläche der
  3D-Szene wird auf dem Telefon etwas kleiner.
- Das Extras-Menü verliert seinen letzten Eintrag und ist nur noch sechs
  Zeilen hoch. Es steht über der Leiste (`index.html:112`) und rückt damit
  tiefer.
- Wer «Meine Türme» im Extras-Menü gewohnt war, findet es dort nicht mehr.
  Der Name ändert sich zugleich — der Wiedererkennungswert kommt aus der
  Karte selbst, nicht aus der alten Beschriftung.
