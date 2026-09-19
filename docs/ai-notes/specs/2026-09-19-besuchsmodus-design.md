# Spec — Besuchsmodus: den Turm von innen ansehen (Issue #44)

Repo: `game-wipfelkratzer`. Base: `main`, v0.9.0 (`version.js:3`). Buildless
Vanilla, three.js r184 über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #44, Feedback-Triage 12.09.2026, Eintrag 16 — Block C.

## Problem

Der Wunsch lautet: «den Turm aus der Ich-Perspektive begehen — durchs Umland
laufen, die Treppen hochsteigen, in die Wohnungen und auf die Dachterrasse.»

Das Issue benennt selbst, warum das teuer ist:

- **Kollision und Schwerkraft** sind die eigentliche Arbeit, nicht die Kamera.
- **Die Treppen sind Geometrie, keine Wege** (`roofStairG`, `roofGapG`, die
  Podeste über `padX0`/`padX1`, `js/game.js:296-297, 479-493`). Sie sehen
  begehbar aus, tragen aber niemanden.
- **Auf dem Tablet gibt es kein WASD** — ein Steuerkreuz wäre eine eigene
  Entwurfsfrage.
- **Übelkeit** ist bei einem Kind ein ernsthafter Einwand.

## Die Umdeutung

Der teure Teil kauft genau eine Sache: **freies Laufen**. Die Frage ist, ob ein
Kind auf einem Tablet das braucht — oder ob es *drinnen stehen und sich umsehen*
will.

Dafür ist fast alles schon da. `enterEdit(k)` (`js/game.js:1115-1136`) macht
bereits: Kamera merken (`camSave`), über `moveCam` an einen **berechneten**
Standpunkt fahren (`editCamFor`, seit #17 blickfeldbasiert), Sichtbarkeit
anpassen, und `exitEdit` stellt alles zurück. Was fehlt, ist die Augenhöhe
**im** Raum statt der Aussenansicht davor.

Dieser Entwurf liefert deshalb einen **Besuchsmodus**: Standpunkte statt
Laufen. Kein Kollisionssystem, keine Schwerkraft, kein Steuerkreuz, keine
Treppen-als-Wege.

## Entscheidungen

Vom Besitzer am 19.09.2026 entschieden:

- **E1 — Standpunkte statt Laufen.** Man steht an einem Ort in Augenhöhe und
  sieht sich frei um; weiter geht es über Knöpfe. Verworfen: freies Laufen mit
  Daumen-Steuerkreuz (braucht Kollision, Schwerkraft, begehbare Treppen — und
  birgt genau das Übelkeitsrisiko, das das Issue nennt) und ein
  Wegwerf-Versuch vorab.

- **E2 — Nur Orte, für die es schon einen Standpunkt gibt:** Wohnungen,
  Dachterrasse, Spielplatz — also genau die drei Fälle von `editCamFor`
  (`js/game.js:1097-1113`). Verworfen: zusätzlich Treppenpodeste, Brücke,
  Biberburg und Bach — jeder davon bräuchte einen von Hand gesetzten und
  geprüften Standpunkt, und das Umland ist gross.

- **E3 — Wechsel über Knöpfe, nicht über Trefferflächen.** Eine schmale
  Leiste: «hoch», «runter», «Dach», «Draussen», «Schluss». Verworfen: Tür,
  Treppe und Dachluke antippen — jedes Ziel bräuchte eine Trefferfläche, und
  eine Tür hinter einem Schrank wäre eine Sackgasse.

## Entwurf

### Der Zustand

Ein dritter Kamerazustand neben «frei» und «einrichten»: `besuch` hält
`{ k }` — das Stockwerk, `'roof'` oder `'garten'`. Er schliesst sich mit
`edit` gegenseitig aus: aus dem Einrichten heraus ist kein Besuch möglich und
umgekehrt.

### Der Standpunkt

`besuchCamFor(k)` liefert `{ eye, tgt }`, analog zu `editCamFor`, aber im Raum:

- **Wohnung `k`:** Auge auf `floorY(k) + AUGE` (`AUGE = 1.5`), an der Rückwand
  (`z = -dims(k).d / 2 + 0.5`), Blick auf die Raummitte in derselben Höhe.
- **Dachterrasse:** Auge auf `topY() + AUGE` am Südrand
  (`z = ROOF_D / 2 - 0.6`), Blick zur Mitte.
- **Spielplatz:** Auge auf `AUGE` über `GARDEN_POS`, um `GARDEN_D / 2 - 0.6`
  nach Süden versetzt, Blick auf die Mitte der Lichtung.

`floorY`, `topY`, `dims`, `ROOF_D`, `GARDEN_POS` und `GARDEN_D` existieren
alle (`js/game.js:14-16, 511, 438`).

### Die Kameragrenzen — der Stolperstein

`OrbitControls` läuft weiter; gedreht wird um das Ziel in der Raummitte, was
sich von innen wie Umsehen anfühlt. **Aber die heutigen Grenzen verhindern das
zunächst:**

```js
controls.minDistance = 4; controls.maxDistance = 44 * HSCALE;
controls.maxPolarAngle = 1.52; controls.minPolarAngle = 0.12;   // js/game.js:164
```

Im Raum beträgt der Abstand zwischen Auge und Raummitte rund **1.5 m** —
deutlich unter `minDistance = 4`. `OrbitControls` würde die Kamera beim ersten
`update()` nach aussen schieben, mitten durch die Wand. Der Besuchsmodus muss
die Grenzen deshalb setzen und beim Verlassen **auf exakt die alten Werte**
zurückstellen:

- `minDistance` auf `0.4`, `maxDistance` auf den Raumdurchmesser,
- `minPolarAngle` auf `0.35` und `maxPolarAngle` auf `2.4`, damit man nach oben
  und unten schauen kann statt nur waagrecht,
- `enableZoom = false` — sonst verlässt man den Raum durch Herauszoomen.

Die alten Werte werden beim Betreten gesichert, nicht neu hingeschrieben: ein
zweiter Ort, der dieselben Zahlen führt, wäre genau die Art Dopplung, die
später auseinanderläuft.

### Die Leiste

```
  +--------------------------------+
  |     (Blick frei drehbar)       |
  |  Wohnung 3 — bei Familie Dachs |
  +--------------------------------+
  | [^ hoch] [v runter] [Dach] [X] |
  +--------------------------------+
```

- **hoch / runter** wechseln ein Stockwerk. An den Enden werden sie
  **gesperrt, nicht versteckt** — ein Knopf, der verschwindet, verwirrt mehr
  als einer, der grau ist.
- **Dach** und **Draussen** springen zur Dachterrasse bzw. auf den Spielplatz.
  «Draussen» ist nur da, wenn `state.garden` gesetzt ist.
- **Schluss** beendet den Besuch und stellt die vorherige Kamera her.
- Die Kopfzeile nennt Stockwerk und Bewohner über `flLabel(k)` (`js/game.js:39`)
  und `tenantOf(k)`, im selben Muster wie `#edit-title` (`js/game.js:1134`).

### Sichtbarkeit

Von innen gilt das Gegenteil von aussen:

- **Die Vorderwand muss stehen.** `applyFronts()` (`js/game.js:1086-1088`)
  blendet sie aus, sobald `state.cutaway` gesetzt ist. Im Besuch wird
  `state.cutaway` ignoriert — sonst sieht man in einen offenen Setzkasten
  statt in ein Zimmer. `state.cutaway` selbst wird **nicht** verändert, damit
  die Aussenansicht danach unverändert ist.
- **Die Decke bleibt ausgeblendet.** Sie ist die Lichtquelle des Raums; mit
  Decke wird es dunkel und trüb. Das ist eine bewusste Unehrlichkeit zugunsten
  des Bilderbuch-Looks — dieselbe, die `enterEdit` bereits trifft
  (`js/game.js:1131`).
- **Höhere Stockwerke bleiben sichtbar.** `enterEdit` blendet sie aus
  (`js/game.js:1128`), damit man von oben hineinsieht. Im Besuch wäre das
  falsch: beim Blick aus dem Fenster fehlte der halbe Turm.

## Was dieser Entwurf *nicht* liefert

Der Issue-Titel verspricht «Umland, Treppen, Wohnungen und Dachterrasse
begehen». **Begangen wird hier nichts.** Es gibt keine Bewegung innerhalb
eines Raums, keine Treppen als Wege und kein Umland. Der Titel von #44 gehört
deshalb auf das geändert, was tatsächlich entsteht — ein Issue, dessen Titel
mehr verspricht als sein Plan, führt jeden späteren Leser in die Irre.

Freies Laufen bleibt als Idee offen. Sollte der Besuchsmodus zeigen, dass das
Kind wirklich laufen will, ist er kein Hindernis dafür: Standpunkte und freies
Laufen teilen sich die Kamera, nicht die Steuerung.

## Akzeptanzkriterien

- [ ] Ein Knopf in der Werkzeugleiste startet den Besuch im aktuell
      sichtbaren Turm, beginnend bei der untersten gebauten Wohnung.
- [ ] Im Besuch steht die Kamera **im** Raum: `camera.position.y` liegt bei
      `floorY(k) + 1.5 ± 0.05`, und der Abstand zur Raummitte ist kleiner als
      die halbe Raumtiefe.
- [ ] Die Kamera bleibt beim Drehen im Raum — sie wird nicht durch
      `minDistance` nach aussen geschoben.
- [ ] Zoomen ist im Besuch abgeschaltet.
- [ ] «hoch» und «runter» wechseln das Stockwerk; am obersten gebauten
      Stockwerk ist «hoch» gesperrt, im Erdgeschoss «runter».
- [ ] «Dach» führt auf die Dachterrasse, «Draussen» auf den Spielplatz — und
      «Draussen» fehlt, solange es keinen Spielplatz gibt.
- [ ] Die Kopfzeile nennt Stockwerk und, falls bewohnt, die Familie.
- [ ] Die Vorderwand der besuchten Wohnung ist sichtbar, **auch wenn**
      `state.cutaway` gesetzt ist; nach dem Besuch ist `state.cutaway`
      unverändert.
- [ ] Höhere Stockwerke bleiben während des Besuchs sichtbar.
- [ ] «Schluss» stellt Kameraposition, Blickziel **und alle vier
      `OrbitControls`-Grenzen** exakt auf die Werte vor dem Besuch zurück.
- [ ] Einrichten und Besuch schliessen sich gegenseitig aus.
- [ ] Der Besuch verändert den Spielstand nicht — `localStorage` ist vor und
      nach dem Besuch byte-gleich.
- [ ] Bei 400 px Breite ist jeder Knopf der Leiste mindestens 44 px hoch und
      erreichbar.
- [ ] Kein Test-Framework, kein Bundler, keine `package.json`.
- [ ] Die Konsole bleibt während des ganzen Besuchs fehlerfrei.

## Prüfung

Buildless — Playwright im Vordergrund gegen `python3 -m http.server`. Geprüft
wird über `window.wipfelkratzer` (`camera`, `controls`, `state`, `enterEdit`,
`exitEdit`, `topY`, `floorGroup`) plus die neuen Haken des Besuchsmodus. Die
Sonden sind nicht committet.

Der manuelle In-Browser-Playtest bleibt das eigentliche Gate — bei einer
Kameraänderung besonders, weil sich «wird mir davon schwindlig» nicht
automatisiert prüfen lässt. Er wird als offener Posten in der PR-Beschreibung
geführt.
