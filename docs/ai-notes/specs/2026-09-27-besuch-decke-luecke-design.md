# Spec — Beim Hineingehen klafft eine Lücke zwischen Wand und Decke (Issue #96)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #96, abgespalten von #91.

## Problem

Wer im Besuchsmodus («Hineingehen», `index.html:312`) in eine Wohnung geht und
nach oben schaut, sieht nach draussen. Der Raum ist oben nicht geschlossen.

Das hat zwei Ursachen, die beide auf dieselbe Stelle zurückgehen: **der Raum
hat im Besuch gar keine Decke.**

### Ursache 1 — die Decke wird beim Betreten ausgeblendet

`enterBesuch` versteckt die Deckenplatte des besuchten Stockwerks, und
`wechsleBesuch` tut beim Etagenwechsel dasselbe:

```js
if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
```

`js/game.js:1264` und `js/game.js:1311`. Der Kommentar darüber
(`js/game.js:1260-1263`) nennt den Grund: „Die Decke ist die Lichtquelle des
Raums — mit ihr wird es dunkel und trüb." Ohne Decke fällt das Aussenlicht von
oben in den Raum; dafür fehlt oben der Abschluss.

Was man stattdessen über sich sieht, ist die **Bodenplatte des Stockwerks
darüber** (`js/game.js:398`, `BoxGeometry(w + 0.12, 0.14, d + 0.12)`). Die
deckt den Raum aber nicht ab, weil der Turm sich nach oben verjüngt
(`js/game.js:128-129`):

| Von Etage | Innenmass Raum | Platte darüber | offener Streifen je Seite |
|---|---|---|---|
| Erdgeschoss → 1 | 8.36 × 5.36 | 7.72 × 5.12 | **0.32 m** (X) / **0.12 m** (Z) |
| 1 → 2 (und höher) | 7.36 × 4.76 | 7.42 × 5.00 | −0.03 m (X) / −0.12 m (Z) |

Im **Erdgeschoss** — genau dort, wo der Knopf den Besuch beginnt
(`js/game.js:1319`, `enterBesuch(0)`) — steht links und rechts ein **32 cm
breiter Spalt bis zum Himmel** offen.

Bei den oberen Etagen ist der Überstand rechnerisch knapp positiv, aber jedes
Stockwerk sitzt leicht versetzt und leicht verdreht (`js/game.js:286`,
`floorPose`: x um ±0.06, ry um ±0.025 rad). Über eine Raumbreite von sieben
Metern sind das bis zu ±0.09 m seitlicher Versatz — mehr als die 0.03 m
Überdeckung. An Kanten und Ecken bleibt es also auch oben offen.

Im **obersten** Stockwerk gibt es überhaupt kein Stockwerk darüber. Dort liegt
nur der Terrassenbelag der Dachterrasse, 6.6 × 4.8 (`js/game.js:475`, `ROOF_W`
/ `ROOF_D`) — bei einem Turm mit einem Stockwerk also 0.38 m offen je Seite.

### Ursache 2 — die Deckenplatte berührt die Wände gar nicht

Auch sichtbar geschaltet würde die heutige Platte nicht dicht schliessen:

```js
g.userData.ceil = mesh(new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3), MAT.plasterIn, 0, h - 0.13, 0, g);
```

`js/game.js:409`. Die Innenfläche jeder Wand liegt bei `±(w/2 − WALL_T)` bzw.
`±(d/2 − WALL_T)` mit `WALL_T = 0.12` (`js/game.js:25`, `js/game.js:403-412`).
Die Deckenkante liegt bei `±(w/2 − 0.15)`. Dazwischen bleibt rundum ein
**3 cm breiter Schlitz** — buchstäblich die „Lücke zwischen Wand und Decke"
aus dem Issue-Titel.

### Ursache 3 — die Kamera darf höher als die Decke

`besuchPolar` (`js/game.js:1231-1235`) begrenzt das Hochschauen gegen die
**Raumhöhe**:

```js
const nachOben = Math.max(0, H(k) - AUGE - BESUCH_LUFT);
```

Die Deckenunterkante liegt aber bei `H − 0.18` (Platte bei `h − 0.13`, Dicke
0.1). Mit `BESUCH_LUFT = 0.15` darf die Kamera bis `H − 0.15` steigen — drei
Zentimeter **über** die Deckenunterkante. Solange die Decke unsichtbar ist,
fällt das nicht auf; mit sichtbarer Decke fährt die Kamera durch sie hindurch.

## Zuschnitt

**Drin:** der Besuchsmodus in einem Stockwerk (`typeof k === 'number'`,
Erdgeschoss eingeschlossen).

**Draussen bleibt draussen:** Dachterrasse, Spielplatz und Aussichtsplattform
(`js/game.js:1198-1216`) sind Aussenstandorte ohne Decke. Dort ändert sich
nichts.

**Nicht angefasst:** der Einrichten-Modus. Er blendet die Decke ebenfalls aus
(`js/game.js:1161`) und stellt sie beim Verlassen wieder her
(`js/game.js:1176`), braucht das aber für seine Kamera von schräg oben. Das
bleibt so. Ebenso unangetastet: «Wände weg» von innen (eigenes Issue) und die
Aussenansicht des Turms.

## Entwurf

### E1 — Die Decke bleibt beim Besuch stehen

Die drei Zeilen, die `ceil.visible = false` setzen, verschwinden aus
`enterBesuch` (`js/game.js:1264`) und `wechsleBesuch` (`js/game.js:1311`). Der
Kommentar darüber wird durch einen ersetzt, der die neue Begründung trägt.

`exitBesuch` (`js/game.js:1278`) stellt heute alle Decken wieder sichtbar. Die
Schleife bleibt: sie ist dann ein No-op für den Besuch, deckt aber weiterhin
den Fall ab, dass ein Besuch aus einem Zustand heraus endet, in dem etwas
anderes eine Decke versteckt hat.

Verworfen: die Platte des Stockwerks darüber verbreitern. Das ändert die
Aussenansicht des Turms (der Überstand wäre von aussen sichtbar), und beim
obersten Stockwerk gäbe es nichts zu verbreitern.

### E2 — Die Deckenplatte reicht bis an die Wände

```js
/* Bis an die Innenflächen der vier Wände (±(Mass/2 − WALL_T)) — ein
   schmalerer Deckel liesse rundum einen Schlitz offen, durch den man vom
   Besuch aus nach draussen sieht (#96). */
const CEIL_T = 0.1, CEIL_DROP = 0.13;
const deckeUnterY = k => H(k) - CEIL_DROP - CEIL_T / 2;   /* = H − 0.18 */
...
g.userData.ceil = mesh(new THREE.BoxGeometry(w - 2 * WALL_T, CEIL_T, d - 2 * WALL_T),
                       MAT.plasterIn, 0, h - CEIL_DROP, 0, g);
```

`w − 2 * WALL_T` ist `w − 0.24` — exakt die Innenfläche der Seitenwände, ohne
sie zu durchdringen. Verworfen: `w − 0.18` (bis an den tragenden Kern). Das
schnitte durch die dünnen Innenpanele (`js/game.js:404-412`), die die Tapete
tragen.

### E3 — Eine Raumlampe ersetzt das Licht, das die Decke wegnimmt

Ein einziges, wiederverwendetes `THREE.PointLight`, das beim Betreten in die
besuchte Etagengruppe gehängt und beim Verlassen wieder entfernt wird:

```js
/* Mit geschlossener Decke fällt kein Aussenlicht mehr von oben ein (#96).
   Eine Lampe pro Besuch, ohne Schattenwurf — die Szene hat sonst nur zwei
   Lichter (js/game.js:167-168), ein drittes mit Schatten wäre der teuerste
   Teil der Änderung. */
const besuchLampe = new THREE.PointLight(0xfff1d6, 1.1, 9, 1.6);
besuchLampe.castShadow = false;
```

Gesetzt wird sie von einer Funktion `setzeBesuchLampe(k)`:

- `k` ist eine Zahl → Lampe an `floorGroups[k]` hängen, Position
  `(0, H(k) − 0.5, 0)` in Etagenkoordinaten.
- alles andere (`'roof'`, `'garten'`, `'aussicht'`, `null`) → Lampe aus ihrem
  Elternteil entfernen.

`enterBesuch` und `wechsleBesuch` rufen sie mit `k`, `exitBesuch` mit `null`.
Ein einziger Ort entscheidet damit, wo die Lampe hängt — zwei Stellen, die
unabhängig voneinander an- und abhängen, liefen auseinander.

Verworfen: `MAT.plasterIn` emissiv machen. Das Material wird von allen Räumen
und allen Decken **geteilt** (`js/game.js:409` nutzt es direkt, ohne
`.clone()`), die Aufhellung schlüge also auch in der Aussenansicht und in
jedem anderen Stockwerk durch.

### E4 — Die Kamera bleibt unter der Decke

`besuchPolar` rechnet gegen die Deckenunterkante statt gegen die Raumhöhe:

```js
const nachOben = Math.max(0, deckeUnterY(k) - AUGE - BESUCH_LUFT);
```

Das ist die einzige Zeile; `BESUCH_LUFT` und die Aussenstandort-Grenzen
(`BESUCH_POLAR_FREI`) bleiben unverändert.

### E5 — Debug-Hook für die Verifikation

Damit eine Playwright-Sonde das Ergebnis prüfen kann, ohne Pixel zu raten,
kommen in `window.wipfelkratzer` (`js/game.js:2810-2830`) dazu:

- `besuchLampe` — das Lichtobjekt selbst (`.parent === null`, wenn es nicht
  hängt),
- `deckeUnterY` — die Deckenunterkante je Etage,
- `sichtFrei(k)` — eine Strahlenprobe: schickt von der Besuchs-Augenposition
  Strahlen nach oben und in die vier oberen Raumecken und liefert die Anzahl
  Strahlen, die **kein** Objekt treffen. `0` heisst: der Raum ist oben dicht.

`sichtFrei` nutzt denselben `THREE.Raycaster` wie `pickAt`
(`js/game.js:2833`) und ist damit kein neues System, sondern eine zweite
Probe an einem bestehenden.

## Akzeptanzkriterien

1. Im Besuchsmodus ist die Decke des besuchten Stockwerks sichtbar
   (`floorGroups[k].userData.ceil.visible === true`) — im Erdgeschoss und in
   jedem höheren Stockwerk.
2. `sichtFrei(k) === 0` für das Erdgeschoss, für ein mittleres und für das
   **oberste** gebaute Stockwerk: kein Strahl von Augenhöhe nach oben oder in
   eine obere Raumecke verlässt den Raum.
3. Die Deckenplatte berührt alle vier Wände: ihre Halbmasse sind
   `w/2 − WALL_T` und `d/2 − WALL_T`, ohne Überstand über die Innenpanele.
4. Beim maximalen Hochschauen bleibt die Kamera unter der Deckenunterkante:
   `camera.position.y ≤ floorY(k) + deckeUnterY(k)`.
5. Während des Besuchs eines Stockwerks hängt genau eine Raumlampe in der
   Szene (`besuchLampe.parent === floorGroups[k]`); auf Dachterrasse,
   Spielplatz und Aussichtsplattform und nach «Schluss» hängt sie nirgends
   (`besuchLampe.parent === null`).
6. Der Etagenwechsel im Besuch («hoch»/«runter») nimmt Decke und Lampe mit:
   nach dem Wechsel gelten 1, 2 und 5 für die neue Etage, und die vorherige
   Etage hat ihre Decke behalten.
7. Nach «Schluss» ist der Aussenzustand unverändert: alle Decken sichtbar,
   `state.cutaway` unverändert, die Kameragrenzen wie vor dem Besuch.
8. Der Einrichten-Modus verhält sich wie bisher: beim Betreten ist die Decke
   der bearbeiteten Etage ausgeblendet, nach dem Verlassen wieder sichtbar.
9. Die Seite lädt und der ganze Ablauf läuft ohne `pageerror` in der Konsole.

## Nicht in diesem Zuschnitt

- «Wände weg» von innen (Geschwisterpunkt aus #91, eigenes Issue).
- Laufen statt Standpunkte im Besuchsmodus.
- Eine sichtbare Lampe als Möbelstück — E3 ist reines Licht, kein Objekt im
  Katalog.
- Die Lücke zwischen Stockwerk und Stockwerk von **aussen** betrachtet; die
  Verjüngung des Turms ist gewollt.
