# Spec — Die Navileiste verdeckt «Foto» und «Musik aus»

Issue: freaxnx01/game-wipfelkratzer#32
Datum: 2026-09-14

## Ziel

Auf schmalen Fenstern bricht `#toolbar` auf mehrere Zeilen um; die unterste
Zeile landet unter der fest positionierten Navileiste `#game-nav`, die mit
`z-index: 2147483647` über allem liegt. Die betroffenen Knöpfe sind sichtbar,
aber nicht anklickbar.

Der Fix reserviert für die Navileiste einen Streifen am unteren Rand, den die
gesamte Bodenoberfläche des Spiels (Werkzeugleiste und alles, was über ihr
hängt) freihält. Die Navileiste selbst wird **nicht** angefasst.

## Bestehendes Verhalten (Beleg)

- `#toolbar` sitzt fest bei `bottom: 10px`, mittig, `flex-wrap: wrap`,
  `max-width: 96vw`, `z-index: 5` (`index.html:48`). Es umbricht also je nach
  Fensterbreite auf zwei, drei oder vier Zeilen.
- `#game-nav` sitzt fest bei `right: 10px; bottom: 8px` mit
  `z-index: 2147483647` und ist als Inline-Style direkt im Markup notiert
  (`index.html:253`). Der Block stammt wortgleich aus der
  ai-instructions-Vorlage (`CLAUDE.md:400`) und steht so in jedem
  `game-*`-Repo.
- Drei Elemente rechnen bereits mit der **gemessenen** Leistenhöhe statt mit
  einem festen Abstand:
  - `#selbar`: `bottom: calc(var(--toolbar-h, 60px) + 16px)` (`index.html:71`)
  - `#extras-menu`: dieselbe Formel (`index.html:81`)
  - `#catalog`: `calc(var(--toolbar-h, 60px) + 16px + var(--selbar-h, 0px) + 10px)`
    (`index.html:54`), identisch bei `#toast-stack` (`index.html:126`)
- Gespeist werden die beiden Variablen von zwei `ResizeObserver`-IIFEs:
  `--toolbar-h` aus `tb.offsetHeight` (`js/game.js:475-477`) und `--selbar-h`
  aus `sb.offsetHeight` (`js/game.js:480-482`).
- Die `16px` in diesen Formeln sind `10px` Bodenabstand der Werkzeugleiste plus
  `6px` Luft (`index.html:48` gegen `index.html:71`).
- `#wishes` wechselt unter 640px Breite auf `top: auto; bottom: 130px`
  (`index.html:146`) — ein fester Wert, der die Leistenhöhe nicht kennt.
- Die Knöpfe hängen direkt an den Elementen (`$('btn-photo').onclick`,
  `js/game.js:1169`; `js/game.js:957`; `js/game.js:1042`), nicht an einem
  delegierten Listener auf `#toolbar`.
- Es gibt keine Unit-Test-Suite; geprüft wird headless mit Playwright gegen
  einen selbst gestarteten lokalen Server, **im Vordergrund**
  (`CLAUDE.md:550-561`, `CLAUDE.md:763`).
- `CHANGELOG.md` hat derzeit **keinen** `## [Unreleased]`-Abschnitt; der oberste
  Eintrag ist `## [0.5.0] - 2026-09-13` (`CHANGELOG.md:7`).

### Eigene Messung (Playwright, `main` @ 81ee2bd, Intro weggeklickt)

`document.elementFromPoint` auf den Knopfmittelpunkten, plus Geometrie:

| Viewport | `#game-nav` (x/y/w/h) | `#toolbar` (x/y/w/h) | verdeckt |
| --- | --- | --- | --- |
| 600×900 | 115/855/475/37 | 150/726/300/164 | `btn-photo` → `<a>` in `#game-nav`, `btn-music` → `#game-nav` |
| 480×800 | 0/744/470/48 | 120/568/240/222 | `btn-music` → `<a>` in `#game-nav` |
| 820×1180 | 335/1135/475/37 | 205/1006/410/164 | `btn-music` → `#game-nav` |
| 1280×800 | 795/755/475/37 | 320/684/640/106 | keiner |

Zwei Dinge fallen dabei auf, die im Issue noch nicht stehen:

1. **Die Navileiste ist 475px breit** — auf 600px Fensterbreite belegt sie
   79% der Breite (x 115…590), auf 480px läuft sie links aus dem Bild heraus
   (x 0…470, Inhalt beginnt bei −84). Seitlich ausweichen kann die
   Werkzeugleiste dort nicht.
2. **Ihre Höhe ist nicht konstant**: 37px, wenn sie in eine Zeile passt, 48px,
   sobald sie gestaucht wird. Ein fester Reservewert wäre also falsch.

## Entscheid: das Spiel weicht aus, nicht die Vorlage

Die Werkzeugleiste (und mit ihr alles, was an `--toolbar-h` hängt) rückt um
genau den Streifen nach oben, den `#game-nav` am unteren Rand belegt. Gemessen
wird dieser Streifen zur Laufzeit als dritte Variable `--nav-h`, im selben Stil
wie `--toolbar-h` und `--selbar-h`.

Getragen wird die Reservierung von **einer** neuen CSS-Deklaration:
`#toolbar { padding-bottom: var(--nav-h, 0px) }`. Weil `--toolbar-h` aus
`offsetHeight` kommt (`js/game.js:476`) und `offsetHeight` das Innenabstands-Feld
mitzählt, wachsen `#selbar`, `#extras-menu`, `#catalog` und `#toast-stack`
automatisch mit — **keine der drei bestehenden `calc()`-Formeln wird angefasst**.
Der Fix fügt sich in die vorhandene Kette ein, statt sie ein viertes Mal
abzuschreiben.

Eine Fussangel gehört dazu: ein `ResizeObserver` beobachtet per Voreinstellung
die *Content-Box* und feuert **nicht**, wenn sich nur der Innenabstand ändert.
Ohne Gegenmassnahme bliebe `--toolbar-h` auf dem alten Wert stehen und das
Extras-Menü würde die Werkzeugleiste um `--nav-h − 6px` überlappen (gemessen:
39px bei 600×900). Der bestehende Beobachter bekommt deshalb
`{ box: 'border-box' }` — die Box, um die es sachlich ohnehin immer ging.

## Assumptions

- **A1** [high] **Die Navileiste bleibt unverändert; das Spiel macht Platz.**
  Verworfen: `#game-nav` verschieben, verkleinern oder einklappen. Der Block
  steht wortgleich als Inline-Style im Markup (`index.html:253`) und kommt aus
  der ai-instructions-Vorlage (`CLAUDE.md:400`) — jede Änderung dort ist eine
  Änderung an der gemeinsamen Chrome **aller** `game-*`-Repos, muss upstream
  gepflegt und in jedes Repo nachsynchronisiert werden, und würde hier beim
  nächsten Sync ohnehin überschrieben. Der Ausweichweg dagegen liegt komplett
  in spieleigenem Code (`#toolbar` in `index.html:48`, Messung in `js/game.js`)
  und ist damit sync-fest **per Konstruktion**: der Vorlagenblock wird nicht
  berührt.
- **A2** [high] **Reserviert wird senkrecht, nicht waagrecht.** Verworfen: die
  Werkzeugleiste rechts unten schmaler machen oder aus der Mitte rücken, damit
  sie neben der Navileiste Platz findet. Die Navileiste ist 475px breit und
  belegt bei 600px Fensterbreite 79% davon (eigene Messung oben); bei 480px
  ragt sie über den linken Rand hinaus. Seitlich ist schlicht kein Platz.
- **A3** [med] **Die Reservierung gilt unbedingt, nicht nur bei tatsächlicher
  Überlappung.** Auch auf 1280×800, wo heute nichts verdeckt ist, rückt die
  Werkzeugleiste um 45px nach oben. Verworfen: die Überlappung je Layout in JS
  ausrechnen und `--nav-h` nur dann setzen. Das bräuchte zusätzlich einen
  `resize`-Pfad für den Fall, dass sich weder Leiste noch Navileiste ändern,
  wohl aber deren Abstand (die mittig sitzende Werkzeugleiste wandert beim
  Verschmälern nach links, ohne ihre Breite zu ändern) — mehr bewegliche Teile
  und ein schwer prüfbarer Grenzbereich für 45px Bildhöhe. Der unbedingte Weg
  ist ein reines CSS-`calc()` über einer gemessenen Zahl.
- **A4** [high] **`--nav-h` misst den belegten Streifen, nicht die Höhe.**
  Gesetzt wird `innerHeight − navRect.top`, also Höhe **plus** Bodenabstand in
  einer Zahl. Verworfen: `nav.offsetHeight + 8` — die `8px` wären der zweite
  fest abgeschriebene Wert aus dem Vorlagen-Inline-Style (`index.html:253`) und
  liefen der Vorlage beim nächsten Sync hinterher. Verworfen ebenso ein fester
  Reservewert: die gemessene Höhe schwankt zwischen 37px und 48px.
- **A5** [high] **Fehlt `#game-nav`, ist `--nav-h` nicht gesetzt und der
  Fallback `0px` greift** — das Layout ist dann Zeichen für Zeichen das heutige.
  Das hält den Fix für Repos ohne Navileiste und für lokale Kopien harmlos.
- **A6** [med] **Der reservierte Streifen wird klickdurchlässig.** `#toolbar`
  bekommt `pointer-events: none`, die Knöpfe `pointer-events: auto`. Ohne das
  würde der neue Innenabstand (und schon heute die Lücken zwischen den Knöpfen)
  Tipps auf die 3D-Szene abfangen. Ungefährlich, weil die Handler direkt an den
  Knöpfen hängen (`js/game.js:1169`, `js/game.js:957`, `js/game.js:1042`) und
  nicht an einem delegierten Listener auf `#toolbar`.
- **A7** [med] **`#wishes` wird unter 640px an dieselbe Kette gehängt**:
  `bottom: calc(var(--toolbar-h, 60px) + 16px)` statt `bottom: 130px`
  (`index.html:146`). Die feste Zahl überlappt die Werkzeugleiste schon heute
  (600×900: Wunschunterkante bei y=770, Leistenoberkante bei y=726), und die
  Reservierung verschlimmert das um weitere 45px. Es ist derselbe Einzeiler wie
  bei `#selbar` — kein neues Muster. Verworfen: unangetastet lassen und separat
  als Issue führen; der Fix würde dann sehenden Auges eine zweite Überlappung
  vergrössern.
- **A8** [high] **Keine Versionsanhebung, kein `chore(release)`.** `version.js`
  bleibt unverändert; der Changelog-Eintrag kommt unter einen neu angelegten
  `## [Unreleased]`-Abschnitt über `## [0.5.0]` (`CHANGELOG.md:7`), als
  deutscher Fliesstext mit `(#32)` am Ende, im Stil der bestehenden Einträge.
- **A9** [med] **Der `ResizeObserver` für `--toolbar-h` wird auf
  `{ box: 'border-box' }` umgestellt** (`js/game.js:477`). Das ist eine
  Änderung an bestehendem Code, aber die notwendige: die Voreinstellung
  `content-box` feuert bei einer reinen Innenabstandsänderung nicht, und
  `--toolbar-h` bliebe stehen (gemessen: Extras-Menü überlappt die
  Werkzeugleiste dann um 39px statt 6px Luft zu lassen). `offsetHeight` hat
  immer schon die Border-Box gemeint.
- **A10** [low] **Der Intro-Dialog wird im Prüfskript mit `force=True`
  weggeklickt.** `page.click("#btn-start")` läuft ohne das in einen Timeout —
  der Knopf ist sicht- und treffbar, gilt Playwright wegen einer laufenden
  Animation aber nicht als „stabil". Verworfen: auf `wait_for_timeout` und
  gutes Zureden zu hoffen.

## Consequences

- Die Werkzeugleiste rückt auf **jedem** Fenster um den Navileisten-Streifen
  nach oben (gemessen 45px, gestaucht 56px), auch dort, wo heute nichts
  überlappt. Die Bodenoberfläche des Spiels verliert entsprechend Bildhöhe. Das
  hat niemand entschieden, es ist der Preis von A3.
- Alles, was an `--toolbar-h` hängt, wandert mit: `#selbar`, `#extras-menu`,
  `#catalog` (dessen Unterkante) und `#toast-stack`. Der 6px-Abstand zwischen
  Extras-Menü und Leistenoberkante bleibt exakt erhalten (nachgemessen bei
  600×900, 480×800, 820×1180, 1280×800).
- Dieselbe Überlappung trifft **jedes** `game-*`-Repo mit unten sitzender
  Bedienoberfläche. Dieser Fix behebt sie nur hier. Das Muster — den von
  `#game-nav` belegten Streifen messen und in der eigenen Bodenoberfläche
  reservieren — gehört als **Hinweis** in den browser-game-Overlay von
  `ai-instructions` (nicht als Vorlagenänderung an `#game-nav` selbst). Das ist
  ein eigenes Issue in `ai-instructions` und **nicht Teil dieses Plans**.
- Auf sehr schmalen Fenstern (≤480px) ragt `#game-nav` über den linken
  Bildrand hinaus (gemessen: x=−84 bei 360px Breite). Das ist ein Mangel der
  Vorlage, wird hier weder behoben noch verschlimmert, und ist als Beobachtung
  festgehalten, nicht als Aufgabe.
- Das Repo bekommt mit `tools/` sein erstes Verzeichnis für Prüfskripte. Der
  Ordner ist nicht in `.gitignore` und wird mitversioniert.

## Acceptance Criteria

- [ ] Bei 600×900, 480×800, 820×1180, 1280×800 und 360×640 trifft
      `document.elementFromPoint` auf dem Mittelpunkt **jedes** Knopfes in
      `#toolbar` genau diesen Knopf — insbesondere `btn-photo` und `btn-music`.
- [ ] Kein Knopfrechteck in `#toolbar` schneidet das Rechteck von `#game-nav`.
- [ ] `--nav-h` entspricht auf jedem Viewport `innerHeight − navRect.top` und
      ist grösser als 0, solange `#game-nav` im Dokument steht.
- [ ] Ohne `#game-nav` im Dokument ist die Geometrie von `#toolbar`,
      `#selbar`, `#extras-menu`, `#catalog` und `#toast-stack` identisch mit
      der vor der Änderung.
- [ ] Zwischen der Unterkante von `#extras-menu` und der Oberkante der obersten
      Knopfzeile liegen weiterhin genau 6px — auf allen geprüften Viewports.
- [ ] `#selbar`, `#extras-menu`, `#catalog` und `#toast-stack` behalten ihre
      `calc()`-Formeln unverändert (Nachweis: `git diff` berührt
      `index.html:54`, `71`, `81`, `126` nicht).
- [ ] Unter 640px Breite überlappt `#wishes` die Werkzeugleiste nicht mehr.
- [ ] Ein Tipp in den reservierten Streifen unterhalb der Knöpfe erreicht die
      3D-Szene, nicht `#toolbar`.
- [ ] Die Konsole bleibt beim Laden und während der Prüfung fehlerfrei.
- [ ] `version.js` ist unverändert; `CHANGELOG.md` hat einen neuen
      `## [Unreleased]`-Abschnitt mit einem `### Fixed`-Eintrag zu `(#32)`.
