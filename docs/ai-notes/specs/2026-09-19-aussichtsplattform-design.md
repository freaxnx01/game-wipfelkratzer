# Spec — Aussichtsplattform mit Fernrohr (Issue #82)

Repo: `game-wipfelkratzer`. Base: `main`, v0.10.0 plus #83 (`version.js:3`).
Buildless Vanilla, three.js r184 über Importmap. Kein Build-Schritt, kein
Test-Runner.

Quelle: Issue #82, abgetrennt aus #51. Ursprung: Feedback-Triage 12.09.2026,
Eintrag 23 (Aussichtsturm Sisslerfeld).

## Problem

Die Waldkarte aus #51 hat einen Punkt «Aussicht», der ehrlich sagt, dass er
noch leer ist. Dieses Vorhaben füllt ihn.

Das Issue nannte drei offene Fragen. **Eine davon hat sich erledigt:**
«Begehbar oder Bild?» hing an #44 — und der Besuchsmodus ist seit v0.10.0
drin. Er liefert genau das, was eine Plattform braucht: einen Standpunkt in
Augenhöhe, freies Umsehen, eine Leiste zum Wechseln. Eine Aussichtsplattform
ist damit **ein weiterer Standpunkt**, kein neues Subsystem.

Die schwierige Frage bleibt: *was tut man dort?* Zwei naheliegende Antworten
sind vergeben — «alle Türme sehen» macht die Waldkarte, «von oben schauen»
macht die Dachterrasse.

## Der Befund, der den Zuschnitt bestimmt

**Das Fernrohr existiert zu grossen Teilen bereits.** Der Tipp-Handler
draussen (`js/game.js:2041-2054`) lässt schon heute erzählen:

| Getippt | Was passiert | Zeile |
|---|---|---|
| Willi | `williTalk()` | `js/game.js:2046` |
| Biberburg | `damTalk()` | `js/game.js:2047` |
| Móki | `mokiTalk()` | `js/game.js:2048` |
| Bewohner-Schild | Bewohnerliste | `js/game.js:2045` |
| Bach | Splashdown-Rückfrage (#46) | `js/game.js:2049` |

Das gilt von **überall** in der Szene, also auch von einer Plattform aus — es
ist dieselbe Szene und derselbe Handler.

Drei Lücken bleiben:

1. **Der eigene Turm erzählt nichts.** Ein Tipp auf ein Stockwerk ruft
   `enterEdit` (`js/game.js:2052-2053`). Im Besuch ist das gesperrt, seit
   `enterEdit` bei laufendem Besuch aussteigt (#44) — der Tipp tut also
   schlicht nichts.
2. **Else Elster ist nicht ansprechbar.** `magpie` trägt kein
   `userData.type` und steht nicht in der Trefferliste (`js/game.js:2041`).
3. **Brücke und Spielplatz ebenso wenig** — beide sind seit #83 etwas, das
   man sich verdient hat, und sagen trotzdem nichts über sich.

Das Fernrohr ist deshalb **kein neuer Mechanismus, sondern eine andere
Antwort desselben Handlers**, solange ein Besuch läuft: draussen öffnet ein
Tipp etwas, im Besuch erzählt er davon.

## Entscheidungen

Vom Besitzer am 19.09.2026 entschieden:

- **E1 — Fernrohr statt reiner Aussicht.** Ein Standpunkt über den
  Baumkronen, und was man antippt, erzählt von sich. Verworfen: nur die
  Aussicht mit den Jahreszeiten aus #50 (ein Kind hat dort nach zwei Besuchen
  nichts mehr zu tun) und die Plattform als Belohnung fürs Vollbauen
  (verschiebt die Frage nur — auch eine Belohnung muss etwas bieten, wenn man
  oben steht).

- **E2 — Antippen statt Liste oder Fadenkreuz.** Nutzt den vorhandenen
  `pointerup`-Weg und die `bubbleTarget`-Mechanik (`js/game.js:2256`),
  die der Sprechblase nachführt. Verworfen: eine Auswahlliste («eher Menü als
  Fernrohr») und ein festes Fadenkreuz (auf dem Tablet fummelig).

## Entwurf

### Die Plattform

Neu in `js/models.js`: `makeAussicht()` — vier Stämme, eine Plattform, ein
Geländer, eine Leiter, alles aus klobigen Primitiven in `MeshLambertMaterial`
wie der übrige Wald. Sie steht am Waldrand abseits des Turms, weit genug weg,
dass man **den eigenen Turm** von dort sieht; das ist der eine Blick, den die
Dachterrasse nicht bietet.

In `js/game.js` wird sie wie Biberburg und Schild aufgestellt und bekommt
`userData.type = 'aussicht'`.

### Der Standpunkt

`besuchCamFor(k)` (`js/game.js:1180`) bekommt einen Fall `'aussicht'`: Auge
auf Plattformhöhe plus `AUGE`, Blick zur Turmmitte. Die Besuchsleiste bekommt
einen Knopf «Aussicht», gleichrangig mit «Dach» und «Draussen»; auf der
Plattform ist er gesperrt, wie es die anderen schon tun.

Der Kartenpunkt `#ort-aussicht` (#51) zeigt nicht mehr den Hinweis, sondern
schliesst die Übersicht und startet `enterBesuch('aussicht')`.

### Das Fernrohr

Im Tipp-Handler (`js/game.js:2041-2054`) wird der Zweig für `'floor'` um den
Besuchsfall ergänzt, und die Trefferliste um Elster, Brücke und Spielplatz
erweitert. Während eines Besuchs gilt:

| Getippt | Im Besuch | Draussen (unverändert) |
|---|---|---|
| Stockwerk / Dach | erzählt vom Turm und nennt die Stockwerkzahl | `enterEdit` |
| Spielplatz | erzählt vom Spielplatz | `enterEdit('garten')` |
| Brücke | erzählt von der Brücke | — (heute nicht ansprechbar) |
| Else Elster | erzählt von Else | — (heute nicht ansprechbar) |
| Willi, Biberburg, Móki, Schild, Bach | unverändert wie heute | unverändert |

Die Texte kommen aus einer kleinen Tabelle im Stil der vorhandenen
`PHRASES`/`DAM_TEXTS`/`MOKI_TEXTS` (`js/game.js:2248, 2266, 2279`) und laufen über dieselbe Sprechblase.

### Was unberührt bleibt

Das Verhalten ausserhalb des Besuchs, die Dachterrasse, die Waldkarte
(ausser dem einen Punkt), der Besuchsmodus selbst, `js/staende.js`,
`js/standdatei.js`. Keine Kosten in Nüssen — #83 hat das Thema gerade
geklärt, zwei Währungsfragen gleichzeitig wären eine zu viel. Kein
Hinaufsteigen: die Leiter ist Geometrie.

## Akzeptanzkriterien

- [ ] Die Plattform steht im Wald und ist von aussen sichtbar.
- [ ] Der Kartenpunkt «Aussicht» startet den Besuch auf der Plattform
      (`besuch.k === 'aussicht'`); der Hinweistext aus #51 erscheint nicht
      mehr.
- [ ] Im Besuch steht die Kamera auf Plattformhöhe, und der eigene Turm ist
      im Blickfeld.
- [ ] Die Besuchsleiste führt von der Plattform zu Stockwerken, Dach und
      Spielplatz und zurück; auf der Plattform ist ihr eigener Knopf
      gesperrt.
- [ ] Ein Tipp auf den eigenen Turm erzeugt im Besuch eine Sprechblase, die
      die Stockwerkzahl nennt — und startet **nicht** das Einrichten.
- [ ] Ein Tipp auf Else Elster, die Brücke und den Spielplatz erzeugt im
      Besuch je eine eigene Sprechblase.
- [ ] Ein Tipp ins Leere tut nichts.
- [ ] **Ausserhalb des Besuchs ist das Verhalten unverändert:** ein Tipp auf
      ein Stockwerk öffnet das Einrichten, auf den Bach kommt die
      Splashdown-Rückfrage.
- [ ] Brücke und Spielplatz sind nur ansprechbar, wenn sie gebaut sind.
- [ ] Der Besuch verändert den Spielstand nicht.
- [ ] Kein Test-Framework, kein Bundler, keine `package.json`.
- [ ] Die Konsole bleibt fehlerfrei.

## Prüfung

Buildless — Playwright im Vordergrund. **Kamerabewegungen warten auf Ankunft,
nicht auf Stillstand** (`tweenCount() === 0` plus Abstand zum Sollpunkt); die
Fahrt dauert unter Software-Rendering rund 25 statt 0.9 Sekunden. Getippt
wird über `page.mouse`, und die Bildschirmkoordinate eines Objekts kommt aus
der Szene (`getWorldPosition().project(camera)`), nicht aus einer geratenen
Position.

Der manuelle In-Browser-Playtest bleibt das eigentliche Gate: ob die
Plattform am gewählten Ort gut aussieht und der Blick auf den Turm etwas
hergibt, sagt keine Sonde.
