# Spec — Waldkarte statt Turmliste (Issue #51)

Repo: `game-wipfelkratzer`. Base: `main`, v0.9.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js` + `js/staende.js` +
`js/standdatei.js`, three.js r184 über Importmap. Kein Build-Schritt, kein
Test-Runner.

Quelle: Issue #51, Feedback-Triage 12.09.2026, Eintrag 26 (klammert 13, 14, 23).

## Problem — und warum es kleiner ist als das Issue annimmt

Das Issue verlangt «aus dem einen Turm wird eine kleine Welt»: mehrere Orte im
Wald, an jedem ein Wipfelkratzer, dazwischen eine Übersichtskarte. Es benennt
als Hauptschwierigkeit den Spielstand:

> Ein Wipfelkratzer pro Ort heisst: der Spielstand trägt nicht mehr **einen**
> Turm, sondern mehrere. `state.rooms`, `state.floors`, `state.wallpaper` sind
> heute alle auf genau einen Turm geschnitten.

**Das stimmt seit dem 17.09.2026 nicht mehr.** Drei Änderungen haben genau
diese Frage beantwortet, nachdem das Issue geschrieben wurde:

1. **#53** hat `js/staende.js` eingeführt — eine Slot-Ebene über dem
   Spielstand. Bis zu vier Türme (`MAX_STAENDE = 4`), jeder mit eigenem
   Schlüssel für Inhalt und Fotos; der Index schaut absichtlich nie in einen
   Stand hinein (`js/staende.js:1-10`).
2. **#78** hat das Sichern eines einzelnen Turms als Datei gebracht,
   **#79** das Einlesen auf einen freien Platz.
3. Der Wechsel zwischen Türmen läuft über `wähleStand(id)` plus
   `location.reload()` (`js/game.js:2373-2374`) und ist damit unabhängig von
   der Darstellung.

Was vom Issue übrig bleibt, ist deshalb **keine Weltarchitektur, sondern eine
Darstellungsfrage**: die vier Türme werden heute als Kachelraster gezeigt
(`#stand-grid`, `js/game.js:2233-2262`). Eine Waldkarte zeigt dieselben vier
Slots als Lichtungen. Die Mechanik dahinter existiert vollständig.

## Zuschnitt

Das Issue klammert vier Dinge. Dieses Vorhaben ist **nur das erste**:

| Teil | Status | Hier drin? |
|---|---|---|
| Karte statt Liste | Darstellung, Mechanik vorhanden | **ja** |
| Schreinerei als Ort | `openWorkshop()` (`js/game.js:1010`) läuft ohne Wohnung | **ja**, als Punkt auf der Karte |
| Wipfkea als Ort | Möbelserie ist in `CATALOG` (#42) | **ja**, als Schaufenster |
| Aussichtsplattform | inhaltlich neu, kein vorhandener Unterbau | **nein** — eigenes Issue, auf der Karte nur als Hinweis |

## Entscheidungen

Vom Besitzer am 18.09.2026 entschieden:

- **E1 — Die Karte ersetzt die Liste, sie ergänzt sie nicht.** `#staende`
  behält Zweck und Knöpfe; nur `#stand-grid` weicht der Karte. Verworfen:
  eine eigene Weltebene mit Wegen und Bewegung (neues Subsystem, zweite
  Szene) und eine Vogelperspektive der echten Szene (setzt voraus, alle vier
  Türme gleichzeitig zu laden — genau die Leistungsfrage, die das Issue als
  Bedenken nennt).

- **E2 — Gemalte Karte aus CSS/SVG, feste Plätze.** Kein WebGL, keine zweite
  three.js-Szene. Vier feste Lichtungen, weil `MAX_STAENDE = 4` fest ist.
  Verworfen: frei angeordnete oder verschiebbare Orte — die Slots sind
  gleichwertig, eine Anordnung trüge keine Information.

- **E3 — Die drei anderen Orte kommen schon jetzt auf die Karte**, statt auf
  spätere Issues zu warten. Damit die Karte dabei nicht zur Attrappe wird,
  gilt: **Schreinerei und Wipfkea tun dort etwas Echtes**, die
  Aussichtsplattform sagt ehrlich, dass sie noch nicht da ist.

## Entwurf

### Aufbau

`#staende` behält `<h2>`, `#stand-voll` und `#staende-actions` unverändert.
`#stand-grid` wird zu `#waldkarte`, einem Container mit Waldhintergrund
(CSS-Verlauf plus ein paar SVG-Baumkronen als `background-image`,
`data:`-URI — kein neuer Netzzugriff) und sieben absolut positionierten
Punkten.

```
+-- Der Wipfelkratzer-Wald -------------------+
|    ^^^      [Aussicht]        ^^^^          |
|  ^  +------+   ^^^^^   +------+   ^^        |
|     |[Bild]|  ~~~~~~~  | leer |             |
|     | Mein |  ~ Bach ~ | Bau- |             |
|     | Turm |  ~~~~~~~  | platz|             |
|     +------+           +------+             |
|  [Wipfkea]   ^^^^^^^^^^^   [Schreinerei]    |
|     +------+           +------+             |
|     |[Bild]|           | leer |             |
|     |Juliska|          | Bau- |             |
|     +------+           +------+             |
|              [ Turm einlesen ]   [ Zu ]     |
+---------------------------------------------+
```

### Die vier Lichtungen

Eine Lichtung ist die heutige `.standkarte` in anderem Rahmen — **dieselben
Klassennamen, dieselben Kindelemente**. Das ist der Kern der Umsetzung: die
vier Klick-Handler auf `#stand-grid` (`js/game.js:2381-2420`) hängen an
`.stand-hin`, `.stand-save`, `.stand-save-mit`, `.stand-save-ohne`,
`.stand-weg` und `.stand-name`. Bleiben diese Klassen erhalten, ändert sich an
den Handlern **nichts** ausser dem Container, an dem sie hängen.

- **Belegte Lichtung:** Vorschaubild (`e.bild`) oder Platzhalter, Name als
  `<input class="stand-name">`, `standInfo(e)` als «N Stockwerke · M Möbel»,
  dazu «Weiterbauen» / «Hier bist du», «Sichern», «Löschen» wie heute.
- **Leere Lichtung:** ein Bauplatz-Feld mit gestricheltem Rand und dem Text
  «Hier ist Platz für einen Turm». Ein Tipp löst dasselbe aus wie
  `#btn-stand-neu` heute. Bei vier Türmen gibt es keine leere Lichtung, und
  `#stand-voll` erscheint wie bisher.

### Die drei Orte

- **Schreinerei** → `openWorkshop()`. Läuft ohne Wohnung: die Funktion baut an
  `wsBuild` und legt fertige Entwürfe in `state.designs` (`js/game.js:1010-1019`).
  Ein dort gebautes Möbel steht danach im Katalog unter «Schreinerei». Das ist
  echter Nutzen, den es heute nur aus einer Wohnung heraus gibt.
- **Wipfkea** → ein **Schaufenster**: die Möbel der Serie als Vorschaubilder,
  ohne Platzieren-Knopf, mit einem Satz dazu, dass sie beim Einrichten im
  Katalog bereitstehen. Platzieren braucht eine Wohnung und ist von der Karte
  aus sinnlos.
- **Aussicht** → ein Hinweis: «Hier soll einmal eine Aussichtsplattform
  stehen.» Sie bekommt ein eigenes Issue. Ein Punkt, der ehrlich sagt, dass er
  noch leer ist, ist keine Attrappe; einer, der so tut als ob, wäre eine.

### Was unberührt bleibt

`js/staende.js`, `js/standdatei.js`, der Spielstand, der Wechsel per Reload,
«Turm einlesen», die Werkstatt selbst, der Katalog selbst, `renderCatalog()`.
Diese Änderung fasst `renderStaende()`, das Markup von `#staende` und dessen
CSS an — sonst nichts.

## Akzeptanzkriterien

- [ ] «Meine Türme» zeigt eine Waldkarte statt eines Kachelrasters; die vier
      Plätze entsprechen `staende.ladeIndex().staende` plus leeren Bauplätzen
      bis vier.
- [ ] Eine belegte Lichtung zeigt Vorschaubild, Name, Stockwerk- und Möbelzahl
      aus `standInfo(e)`.
- [ ] «Weiterbauen» wechselt zum Turm, «Hier bist du» steht auf dem aktiven.
- [ ] Umbenennen, «Sichern» (mit/ohne Fotos) und «Löschen» funktionieren
      unverändert — die bestehenden Handler bleiben in Kraft.
- [ ] Ein Tipp auf einen leeren Bauplatz legt einen Turm an, genau wie
      «Neuer Turm» heute.
- [ ] Bei vier Türmen gibt es keinen leeren Bauplatz und `#stand-voll` ist
      sichtbar.
- [ ] «Turm einlesen» und «Zu» bleiben erreichbar.
- [ ] Die Schreinerei auf der Karte öffnet die Werkstatt; ein dort gebauter
      Entwurf steht danach in `state.designs` und im Katalog.
- [ ] Wipfkea öffnet ein Schaufenster mit den Möbeln der Serie, **ohne**
      Platzieren-Knopf.
- [ ] Die Aussichtsplattform zeigt einen Hinweis und behauptet nicht, mehr zu
      sein.
- [ ] Bei 400 px Breite bleibt jeder Punkt erreichbar und jede Schaltfläche
      mindestens 44 px hoch.
- [ ] `js/staende.js` und `js/standdatei.js` sind unverändert.
- [ ] Kein Test-Framework, kein Bundler, keine `package.json`, kein neuer
      Netzzugriff (die Waldgrafik ist ein `data:`-URI oder reines CSS).
- [ ] Die Konsole bleibt beim Öffnen, Wechseln und Anlegen fehlerfrei.

## Nicht in diesem Vorhaben

- **Die Aussichtsplattform selbst** — eigenes Issue.
- **Die Nüsse bekommen eine Senke.** `state.nuts` wächst bei jedem erfüllten
  Wunsch um 3 (`js/game.js:1521`) und wird **nirgends ausgegeben** — ein
  Punktestand ohne Zweck. Wipfkea als Laden, in dem Möbel etwas kosten, wäre
  die naheliegende Antwort, ist aber eine neue Spielmechanik und gehört in ein
  eigenes Issue. Hier bleibt Wipfkea ein Schaufenster.
- **Bewegung auf der Karte**, Wege, eine begehbare Welt.

## Prüfung

Buildless — Playwright im Vordergrund gegen `python3 -m http.server`, nach dem
Muster der bestehenden Pläne. Geprüft wird gegen `window.wipfelkratzer`
(`staende`, `stand`, `state`, `renderStaende`) und das DOM der Karte. Die
Sonden sind nicht committet (`.superpowers/` ist ignoriert).

Der manuelle In-Browser-Playtest bleibt das eigentliche Gate und wird als
offener Posten in der PR-Beschreibung geführt.
