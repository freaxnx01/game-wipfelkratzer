# Spec: Klick-Animationen für Objekte, Klang für Klavier und Flöte (Issue #93)

Issue: `freaxnx01/game-wipfelkratzer#93`
Plan: `docs/ai-notes/plans/2026-09-27-klick-animationen.md`
Datum: 27.09.2026

## Ziel

Ein Tipp auf ein bereits ausgewähltes Objekt lässt es sich **bewegen** — der
Schaukelstuhl wippt, der Ball hüpft, die Pflanze wiegt sich. Klavier und
Blockflöte geben dabei zusätzlich einen **Ton**. Getragen wird das von der
Registry, die #41 schon angelegt hat (`ACTIONS`, `js/game.js:775-779`): sie
bekommt einen zweiten, zustandslosen Eintragstyp und eine Handvoll
**Bewegungsbausteine**, aus denen jede Animation als Datenzeile zusammengesetzt
wird. Ein weiteres Objekt zu animieren kostet danach **eine Zeile**.

**Nicht Ziel:** neue Katalog-Objekte, neue schaltbare Zustände (Ofen, Kerze),
eine Physik-Schicht, Klangdateien im Repo, Animationen ausserhalb des
Einrichten-Modus.

## Ausgangslage im Code

- **`ACTIONS` gibt es schon** (`js/game.js:775-779`) — drei schaltbare Objekte
  mit Zustandsfeld `on` (`lampe`, `fenster`, `badewanne`), gelesen über
  `isOn` (`js/game.js:743`), ausgelöst von `toggleAction()`
  (`js/game.js:1470-1486`) am Knopf `#btn-action` (`index.html:354`).
- **Der zustandslose Fall ist dort bereits vorgesehen**, aber unbenutzt: der
  Kommentar über der Registry (`js/game.js:769-774`) beschreibt einen Eintrag
  „ohne `apply`, nur mit `label` + `sound`“ für die Instrumente aus #36 —
  `toggleAction` steigt für so einen Eintrag nach dem Ton aus
  (`js/game.js:1474`). Es fehlt genau eines: eine **Bewegung**.
- **Antippen ist im Einrichten-Modus mit Auswählen belegt**
  (`js/game.js:2055-2057`). Ausserhalb des Einrichten-Modus werden Möbel gar
  nicht geraycastet (`js/game.js:2072`, `tippZiele()`).
- **Seit #64 beginnt ein `pointerdown` auf dem ausgewählten Objekt einen Zug**
  (`js/game.js:2148`). Der Tipp-Handler davor (`js/game.js:2043-2045`) verwirft
  bereits alles, was weiter als 8 px gewandert ist oder länger als 400 ms
  gedauert hat — ein Tipp und ein Zug sind im Code also schon sauber getrennt.
- **Animationen laufen über `tween(dur, step, done)`** (`js/game.js:1103-1104`),
  abgearbeitet mit Smoothstep in der Schleife (`js/game.js:2913-2915`);
  `tweenCount()` liegt schon im Debug-Hook (`js/game.js:2817`).
- **Dauerdrehung gibt es getrennt davon** als `spinners`-Liste
  (`js/game.js:378`, `js/game.js:2946`) — das Hamsterrad dreht sich von selbst
  und braucht deshalb keinen Klick.
- **Klang ist ein Web-Audio-Baukasten**: `tone()` (`js/game.js:1947`),
  `noiseBurst()` (`js/game.js:1957`) und neun fertige Effekte in `sfx`
  (`js/game.js:1974-2003`). Alle prüfen `if (!AC) return`. Es wird **keine**
  Audiodatei geladen — auch die Hintergrundmusik ist gerechnet
  (`SONGS`, `js/game.js:1930`).
- **Modelle legen Griffe in `userData` ab** — `wheel` (`js/models.js:343`),
  `sash` (`js/models.js:500`), `water` (`js/models.js:321`), `bulb`/`shade`
  (`js/models.js:307-308`). Dasselbe Muster trägt auch hier.

## Entscheid 1 — Der Auslöser: zweiter Tipp auf das ausgewählte Objekt

Der Knopf `#btn-action` **bleibt** und bekommt für jedes neue Objekt eine
Beschriftung („Schaukeln“, „Spielen“, „Hüpfen“). Zusätzlich löst ein **Tipp auf
ein Objekt, das bereits ausgewählt ist**, dieselbe Aktion aus.

Das Issue verlangt „beim Anklicken“, und die Einwände, mit denen #41 den
zweiten Tipp verworfen hat
(`docs/ai-notes/specs/2026-09-14-interaktive-objekte-design.md`), sind heute
teils erledigt:

1. **„Er ist unsichtbar.“** Bleibt richtig — und wird dadurch entschärft, dass
   der Knopf erhalten bleibt: der erste Tipp wählt aus und **benennt** damit in
   `#selbar`, was ein weiterer Tipp tut. Der Knopf lehrt die Geste.
2. **„Er kollidiert mit dem Auswählen.“** Ein Tipp auf ein bereits
   ausgewähltes Objekt ist heute ein folgenloses Neu-Auswählen
   (`select()` ruft zuerst `deselect()`, `js/game.js:1329`). Es geht also nichts
   verloren. Der neue Zweig greift **nur**, wenn `selected.mesh` genau das
   getroffene Mesh ist — der erste Tipp auf ein anderes Möbel wählt weiterhin
   nur aus.
3. **„Er braucht eine Zeitschwelle.“** Die gibt es seit #64 im selben Handler
   (8 px / 400 ms, `js/game.js:2043`). Es kommt keine zweite Heuristik dazu,
   der Zweig hängt sich in die bestehende.
4. **„Er beantwortet #36 nicht.“** Genau darum geht es hier.

Verworfen: **Antippen ausserhalb des Einrichten-Modus.** Von aussen ist ein
Klavier in einer Wohnung wenige Pixel gross, und `tippZiele()`
(`js/game.js:2072`) müsste um alle Möbel aller Stockwerke wachsen — der
Raycast liefe dann pro Tipp über den gesamten Turm. Der Einrichten-Modus ist
ohnehin der Ort, an dem ein Kind vor der Wohnung sitzt.

## Entscheid 2 — Bewegungsbausteine statt Einzelanimationen

Kein `applySchaukelstuhl`, `applyBall`, `applyPflanze`. Stattdessen eine
kleine Sammlung **parametrierter Bausteine** in `js/game.js`, direkt vor der
Registry. Jeder Baustein ist eine Fabrik: sie liefert eine Funktion
`(mesh, q) => void`, wobei `q` von 0 nach 1 läuft (Smoothstep kommt aus
`tween`).

```js
/* Bewegungsbausteine für Klick-Animationen (#93).
   Jeder liefert eine Schrittfunktion (mesh, q) und MUSS bei q === 1 exakt die
   Ruhelage schreiben — eine Animation hinterlässt nichts. */
const ANIM = {
  /* Gedämpfte Schwingung um eine Achse: sin() * (1 - q) endet sauber auf 0. */
  wippen: (achse, winkel, schwingungen = 3) => (m, q) => {
    m.rotation[achse] = q >= 1 ? 0
      : winkel * Math.sin(q * schwingungen * 2 * Math.PI) * (1 - q);
  },
  /* Hüpfen: mehrere immer kleinere Sprünge über der Ruhehöhe. */
  huepfen: (hoehe, spruenge = 3) => (m, q) => {
    if (m.userData.ruheY === undefined) m.userData.ruheY = m.position.y;
    m.position.y = m.userData.ruheY + (q >= 1 ? 0
      : Math.abs(Math.sin(q * spruenge * Math.PI)) * hoehe * (1 - q));
  },
  /* Stauchen: kurz zusammendrücken und zurückfedern (Schlag, Anstoss). */
  stauchen: (tiefe) => (m, q) => {
    m.scale.y = q >= 1 ? 1 : 1 - tiefe * Math.sin(q * Math.PI);
  },
  /* Reihum eintauchen — für alles, was eine Liste von Teilen in userData hat. */
  reihum: (griff, tiefe) => (m, q) => {
    const teile = m.userData[griff]; if (!teile) return;
    teile.forEach((t, i) => {
      if (t.userData.ruheY === undefined) t.userData.ruheY = t.position.y;
      const p = (q * teile.length) - i;
      t.position.y = t.userData.ruheY
        - (q >= 1 || p < 0 || p > 1 ? 0 : Math.sin(p * Math.PI) * tiefe);
    });
  },
  /* Mehrere Bausteine gleichzeitig. */
  zusammen: (...teile) => (m, q) => teile.forEach(f => f(m, q)),
};
```

Warum Bausteine statt einer Animationsklasse oder einer Keyframe-Tabelle: eine
Keyframe-Tabelle bräuchte einen Interpolator, den `tween` schon ist, und eine
Klasse bräuchte einen Lebenszyklus, den die `tweens`-Liste schon führt. Die
Fabriken sind das Kleinste, was die Wiederholung entfernt.

**Eiserne Regel: eine Klick-Animation schreibt nie in den Spielstand.** Sie
verändert `mesh.rotation.x/z`, `mesh.position.y` und `mesh.scale.y` — niemals
`entry.x/y/z/rot`. `entry.y` bleibt die Wahrheit über die Ruhehöhe; die
Animation merkt sich ihre Ruhelage in `mesh.userData.ruheY` und stellt sie am
Ende wieder her. Deshalb ruft der zustandslose Pfad **kein** `save()`, und
`replaceMesh` (`js/game.js:706-714`) bleibt unberührt.

`mesh.rotation.y` gehört dem Platzieren (`en.rot`) und wird von keinem
Baustein angefasst; `wippen` läuft deshalb über `x` oder `z`.

## Entscheid 3 — Registry-Erweiterung

Ein dritter Eintragstyp kommt hinzu. Die Fallunterscheidung bleibt bei zwei
Feldern:

| Eintrag hat … | Bedeutung | Spielstand |
|---|---|---|
| `apply` | schaltbarer Zustand (`lampe`, `fenster`, `badewanne`) | `on` wird gespeichert |
| `play` | einmalige Bewegung (neu) | nichts |
| nur `sound` | nur Ton | nichts |

```js
const ACTIONS = {
  lampe:     { doOn: 'Licht an',    doOff: 'Licht aus',   apply: applyLampe,   sound: () => sfx.click() },
  fenster:   { doOn: 'Fenster auf', doOff: 'Fenster zu',  apply: applyFenster, sound: () => sfx.creak() },
  badewanne: { doOn: 'Wanne füllen',doOff: 'Wanne leeren',apply: applyWanne,   sound: on => on ? sfx.fill() : sfx.drain() },

  /* Einmalige Bewegungen (#93) — eine Zeile pro Objekt. */
  schaukelstuhl: { label: 'Schaukeln', dauer: 2.4, play: ANIM.wippen('x', 0.16, 3), griff: 'wippe', sound: () => sfx.wippe() },
  klavier:       { label: 'Spielen',   dauer: 2.0, play: ANIM.reihum('tasten', 0.022),               sound: () => sfx.klavier() },
  blockfloete:   { label: 'Spielen',   dauer: 1.6, play: ANIM.zusammen(ANIM.huepfen(0.05, 2), ANIM.wippen('z', 0.10, 2)), sound: () => sfx.floete() },
  harfe:         { label: 'Spielen',   dauer: 1.8, play: ANIM.wippen('z', 0.06, 2),                  sound: () => sfx.harfe() },
  schlagzeug:    { label: 'Spielen',   dauer: 1.2, play: ANIM.stauchen(0.10),                        sound: () => sfx.trommel() },
  ball:          { label: 'Hüpfen',    dauer: 1.4, play: ANIM.huepfen(0.45, 3),                      sound: () => sfx.hops() },
  kuscheltier:   { label: 'Hüpfen',    dauer: 1.2, play: ANIM.huepfen(0.18, 2),                      sound: () => sfx.hops() },
  pflanze:       { label: 'Wackeln',   dauer: 1.6, play: ANIM.wippen('z', 0.07, 3),                  sound: () => sfx.rascheln() },
};
```

`griff` ist der optionale Name eines Untergruppen-Griffs in
`mesh.userData`: steht er da, läuft die Bewegung auf dieser Gruppe statt auf
dem ganzen Objekt. Der Schaukelstuhl braucht ihn, weil sein Drehpunkt auf der
Kufenmitte liegt und nicht am Boden.

**Sechs der acht Einträge brauchen keine Änderung an `js/models.js`** — das
ist die Probe darauf, dass die Bausteine wirklich generisch sind. Nur
`schaukelstuhl` (Kufen-Drehpunkt) und `klavier` (Tastenliste) bekommen einen
Griff.

### Mehrfachtippen

Ein zweiter Tipp, während die Animation noch läuft, wird **ignoriert**. Ein
Neustart mitten in der Bewegung sähe aus wie ein Ruckler und könnte
`ruheY` verfälschen, wenn er auf einem ausgelenkten Zustand aufsetzt. Der Merker
sitzt am Mesh (`mesh.userData.spielt`) und wird im `done`-Rückruf von `tween`
zurückgesetzt — nicht per Zeitrechnung.

## Entscheid 4 — Klang: gerechnet, keine Dateien

Sieben neue Effekte in `sfx` (`js/game.js:1974`), gebaut aus `tone()` und
`noiseBurst()` wie die bestehenden neun. Kein `<audio>`, keine Datei unter
`assets/`, kein CDN — der Stack verbietet externe Ressourcen, und eine
gerechnete Blockflöte ist ein Dreiklang mit Vibrato statt eines 200-KB-Samples.

| Effekt | Klangbild |
|---|---|
| `klavier()` | fünf Töne einer C-Dur-Pentatonik nacheinander (`tone`, `triangle`, 0.12 s Abstand), dazu jeweils eine Oktave leiser darunter |
| `floete()` | ein weicher `sine`-Ton mit leichtem Vibrato (zweiter Oszillator auf der Frequenz), davor ein ganz kurzer Luftstoss (`noiseBurst`) |
| `harfe()` | aufsteigendes Arpeggio aus sechs Tönen, `triangle`, lange Ausklingzeit |
| `trommel()` | tiefer Sinus mit fallender Tonhöhe plus Rauschstoss — Bassdrum und Snare kurz nacheinander |
| `wippe()` | zwei sehr leise, tiefe Holzknarzer im Abstand einer Wippe (Verwandter von `creak`) |
| `hops()` | kurzer aufsteigender Ton plus Plopp, dreimal leiser werdend |
| `rascheln()` | drei kurze, hohe Rauschstösse mit abfallender Lautstärke |

Die Tonhöhen kommen aus `midi2f` (`js/game.js:1929`), damit die Melodien zur Hintergrundmusik passen.

## Datenfluss

```text
Tipp auf ausgewähltes Objekt            #btn-action
        │                                    │
        └──────────► spieleAktion(pick) ◄────┘
                            │
             ┌──────────────┴───────────────┐
        a.apply vorhanden?              a.play vorhanden?
             │                               │
     Zustand umschalten,             mesh.userData.spielt = true
     en.on setzen, save()            tween(a.dauer, q => a.play(ziel, q),
             │                              () => spielt = false)
             └──────────► a.sound(...) ◄─────┘
```

`toggleAction()` wird zu `spieleAktion(pick)` verallgemeinert und nimmt den
Pick als Argument entgegen, statt `selected` zu lesen — damit ruft der
Tipp-Handler dieselbe Funktion wie der Knopf, und es gibt keinen zweiten Pfad,
der auseinanderlaufen kann.

## Fehlerfälle

- **Objekt ohne Registry-Eintrag angetippt** → nichts passiert, der Tipp bleibt
  ein Neu-Auswählen wie heute.
- **Griff fehlt im Modell** (`userData.wippe` nicht gesetzt, weil das Modell
  älter ist) → `spieleAktion` fällt auf das ganze Mesh zurück, statt an
  `undefined.rotation` zu scheitern.
- **Kein Ton** (`AC` noch nicht erzeugt, Seite nie angetippt) → jeder
  `sfx`-Effekt steigt an seinem eigenen `if (!AC) return` aus; die Animation
  läuft trotzdem.
- **Objekt wird während der Animation weggeräumt** (`removeItem`,
  `js/game.js:1532`) → der laufende `tween` hält eine Referenz auf ein Mesh
  ohne Elternknoten; er schreibt ins Leere und läuft aus. Kein Sonderfall
  nötig, aber in der Abnahme geprüft.

## Akzeptanzkriterien

1. Ein Tipp auf ein **bereits ausgewähltes** Objekt mit Registry-Eintrag löst
   dessen Animation aus; ein Tipp auf ein anderes Objekt wählt weiterhin nur
   aus.
2. Der Knopf `#btn-action` löst für dieselben Objekte dasselbe aus und trägt
   die Beschriftung aus dem Registry-Eintrag.
3. Schaukelstuhl, Klavier, Blockflöte, Harfe, Schlagzeug, Ball, Kuscheltier und
   Pflanze sind animiert.
4. Klavier und Blockflöte geben beim Auslösen einen Ton; die Töne sind
   gerechnet, es kommt **keine** Datei und **keine** externe Adresse dazu.
5. Nach Ende jeder Animation steht das Objekt exakt wieder in seiner Ruhelage
   (`rotation.x`/`rotation.z` = 0, `position.y` = `entry.y`, `scale.y` = 1).
6. Eine Klick-Animation verändert den Spielstand nicht: `localStorage` ist vor
   und nach dem Auslösen byte-gleich.
7. Ein zweiter Tipp während einer laufenden Animation startet sie nicht neu.
8. Badewanne, Fenster und Lampe verhalten sich unverändert: Knopf schaltet,
   `on` wird gespeichert, der Zustand überlebt einen Neuladen.
9. Ziehen (#64) und Mausrad-Drehen (#64) funktionieren unverändert; ein Zug
   über mehr als 8 px löst keine Animation aus.
10. Die Konsole bleibt über den ganzen Ablauf ohne `pageerror`.

## Verifikation

Kein Test-Runner — der Stack ist buildless (`CLAUDE.md`, Abschnitt „Tooling &
Testing“). Geprüft wird mit **headless Playwright im Vordergrund**, nie
`run_in_background`. Die Sonden hängen an `window.wipfelkratzer`
(`js/game.js:2810-2828`), das dafür um `spieleAktion`, `ANIM`, `laeuftAnimation`
und `sfx` erweitert wird.

`sfx` im Debug-Hook ist der Weg, Klang überhaupt prüfbar zu machen: eine Sonde
ersetzt `w.sfx.klavier` durch einen Zähler und löst dann aus — die Registry
ruft `sfx.klavier()` über eine Eigenschaftssuche zur Laufzeit
(`sound: () => sfx.klavier()`), also greift der Ersatz. Gehört wird headless
nichts; der Zähler ist der Stellvertreter, und das gehört so in die
PR-Beschreibung.

## Folgen

- Der Katalog-Knopf `#btn-action` erscheint jetzt für **elf** statt drei
  Objekte. `#selbar` wird dadurch nicht breiter (der Knopf war schon da), aber
  er ist häufiger sichtbar — die offene Überlappung mit `#btn-catalog`
  (`TODO.md`, „Gefunden beim Aufräumen“) fällt entsprechend öfter auf.
- Ein Tipp auf das ausgewählte Objekt ist nicht mehr folgenlos. Wer ein
  animiertes Möbel mehrfach antippt, um es „fester“ auszuwählen, löst jetzt die
  Bewegung aus.
- `mesh.userData.ruheY` und `mesh.userData.spielt` sind zwei neue Felder am
  Mesh. Sie werden nicht gespeichert und verschwinden mit dem Mesh.
- Die Modelländerungen an `klavier` und `schaukelstuhl` verschieben Teile in
  Untergruppen. Die Katalog-Vorschaubilder werden aus denselben Modellen
  erzeugt (`snapshot(makeFurniture(...))`, `js/game.js:936`) und müssen
  unverändert aussehen — die Ruhelage der neuen Gruppen ist deshalb exakt die
  alte Lage.
