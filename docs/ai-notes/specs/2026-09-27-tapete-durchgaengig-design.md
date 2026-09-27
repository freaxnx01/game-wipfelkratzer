# Spec — Tapete soll durchgängig sein (Issue #98)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #98, aus FlowHub (Telegram, 27.09.2026). Der ganze Wortlaut:
«Tapete soll durchgängig sein und nicht so unterbrochen». Dazu ein Foto aus
dem Erdgeschoss (Kindergarten und Partyraum, `js/game.js:28`): das Punktmuster
bricht an den Wandstössen und in den Ecken ab, statt durchzulaufen.

## Problem

Jede Wohnung hat vier tapezierbare Innenpanele — hinten, links, rechts, vorne
(`js/game.js:23`, gebaut in `js/game.js:404`, `js/game.js:407`,
`js/game.js:412`). Jedes Panel ist eine eigene `BoxGeometry`, deren Grossfläche
die Texturkoordinaten 0…1 trägt — unabhängig davon, wie breit die Wand in
Metern ist.

Die Tapete selbst ist ein einziges, zwischengespeichertes 128×128-Bild pro
Muster mit einer **festen** Kachelzahl (`js/models.js:709-713`):

```js
t.repeat.set(kind === 'wall' ? 5 : 4, kind === 'wall' ? 1.6 : 3);
```

Fünf Kacheln waagrecht, 1,6 Kacheln senkrecht — auf *jeder* Wand, egal wie
breit oder hoch sie ist. Damit hängt die Kachelgrösse in Metern allein an der
Wandbreite. Im Erdgeschoss (`W(0) = 8.6`, `D(0) = 5.6`, `H(0) = 2.4`;
`js/game.js:13`, `js/game.js:128-129`) ergibt das:

| Wand | Breite in Metern | Kacheln | Kachel in Metern |
|---|---|---|---|
| hinten / vorne | `8.6 − 0.24 = 8.36` | 5 | **1.672** |
| links / rechts | `5.6` | 5 | **1.120** |
| senkrecht (alle) | `2.4` | 1.6 | **1.500** |

Drei Zahlen, die nichts miteinander zu tun haben. Daraus folgen genau die drei
Brüche, die auf dem Foto zu sehen sind:

1. **Ecke.** Die Punkte auf der Rückwand sind 49 % grösser und 49 % weiter
   auseinander als die auf der Seitenwand (`1.672 / 1.120`). In der Ecke
   springt das Muster sichtbar um.
2. **Decke und Boden.** 1,6 ist keine ganze Zahl: die oberste Punktreihe wird
   mittendurch abgeschnitten. Unten hört das Muster irgendwo im Nichts auf.
3. **Stockwerk zu Stockwerk.** `W(i)` und `D(i)` verjüngen sich nach oben
   (`js/game.js:126-129`), die Kachelzahl bleibt 5 — die Punkte werden von
   Etage zu Etage kleiner, obwohl es dieselbe Tapete ist.

Waagrecht *innerhalb* einer Wand schliesst das Muster heute übrigens sauber,
weil 5 zufällig eine ganze Zahl ist. Das Problem ist nicht die Wiederholung,
sondern der **Massstabssprung an jeder Kante**.

## Was der Wunsch meint

«Durchgängig» heisst: die Tapete sieht aus wie eine Bahn, die in einem Stück um
den Raum läuft. Punkte gleich gross, gleich weit auseinander, in jeder Wand
gleich — und das Muster läuft über die Ecke weiter, statt dort neu anzufangen.

Eine mathematisch perfekte Fortsetzung über die Ecke ist mit einer gekachelten
Textur nicht zu haben (dafür müsste die Wandbreite ein exaktes Vielfaches der
Kachel sein, was sie bei frei gewählten Raummassen nie ist). Erreichbar — und
für das Auge ausreichend — ist:

- **Eine einzige Kachelgrösse in Metern** für alle Wände, alle Stockwerke,
  waagrecht wie senkrecht.
- **Ganze Kachelzahlen** auf jeder Wand, damit jede Wand an einer Kachelkante
  anfängt und aufhört. Dann treffen in der Ecke zwei Kachelkanten aufeinander,
  und die Punktreihe läuft optisch durch — statt mitten im Punkt abzureissen.

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründungen stehen dabei,
damit sie widerlegbar sind.

- **E1 — Die Kachelung wird in die Geometrie gebacken, nicht in die Textur.**
  Die `uv`-Werte jedes Wandpanels werden beim Bauen mit der Kachelzahl dieser
  Wand multipliziert; die Textur behält `repeat (1, 1)`. Verworfen: pro Wand
  eine eigene Texturkopie mit eigenem `repeat`. Die Textur ist heute bewusst
  *eine* zwischengespeicherte Instanz pro Muster (`js/models.js:704-713`), und
  das Repo zählt seine Materialien im Debug-Hook (`matCount`,
  `js/game.js:2820`) — bis zu 9 Tapeten × 4 Wände × 11 Etagen Kopien wären das
  Gegenteil davon. Die Panelgeometrien dagegen entstehen ohnehin pro Etage neu
  (`js/game.js:404-412`), kosten also nichts zusätzlich.

- **E2 — Kachelmass: `WALL_TILE = 1.2` Meter.** Verworfen: 1,0 m (die
  Rückwand im Erdgeschoss käme auf 1.045 m, die Seitenwände auf 0.933 m —
  11 % Sprung) und 1,5 m (die senkrechte Kachelzahl im Erdgeschoss wäre 1,6 →
  gerundet 2 → 1.2 m, also dasselbe Ergebnis auf Umwegen). 1,2 m liegt
  zwischen den heutigen Werten 1.12 und 1.672, hält die Punkte also ungefähr
  so gross wie gewohnt, und trifft im Erdgeschoss senkrecht exakt auf
  (`2.4 / 1.2 = 2`).

- **E3 — Kachelzahl = `Math.max(1, Math.round(Mass / WALL_TILE))`,
  waagrecht und senkrecht getrennt.** Verworfen: aufrunden (`ceil`) — das
  staucht das Muster systematisch; und Abrunden (`floor`) — bei schmalen
  Etagen könnte die Zahl auf 0 fallen. Das `max(1, …)` ist die Angel für den
  Fall, dass jemand später sehr kleine Räume baut.

- **E4 — Alle sechs Seiten des Panelquaders bekommen dieselbe
  uv-Streckung.** Verworfen: nur die zwei Grossflächen zu behandeln. Die vier
  Schmalseiten sind `WALL_PANEL = 0.02` m breit (`js/game.js:25`) und liegen
  in der Ecke hinter dem Nachbarpanel bzw. am Wandkern — bei 2 cm ist keine
  Texturverzerrung zu sehen, und die Sonderbehandlung kostet Code ohne
  Gegenwert.

- **E5 — Nur die Tapete, nicht der Bodenbelag.** Der Boden hat dasselbe
  Problem (`repeat (4, 3)` auf einer Fläche, die sich pro Etage verjüngt), und
  es ist derselbe Einzeiler. Er bleibt trotzdem draussen: das Foto und der
  Wortlaut sprechen von der Tapete, und Boden und Wand müssen nicht
  zusammenpassen. Als Fund notiert, nicht als Aufgabe.

- **E6 — Kein neuer Schalter, keine neue Einstellung.** Die durchgängige
  Tapete ist das richtige Verhalten, nicht eine Wahlmöglichkeit. Kein Eintrag
  in `js/standdatei.js`, kein Feld im Spielstand, keine Migration —
  Spielstände speichern nur *welche* Tapete auf welcher Wand klebt
  (`js/game.js:554-558`), nie deren Darstellung.

- **E7 — Die Katalogvorschau bleibt, wie sie ist.** Sie zeichnet eine einzelne
  Kachel über `lookCanvas` (`js/game.js:981`) und ist von `repeat` gar nicht
  betroffen.

## Entwurf

Zwei Eingriffe, beide klein.

**`js/models.js` — Kachelmass und Helfer.** `lookTexture` setzt für Wände
`repeat (1, 1)` statt `(5, 1.6)`; Böden bleiben unverändert (E5). Dazu ein
exportierter Helfer, der die uv-Werte einer Panelgeometrie an ihre echten
Masse anpasst:

```js
/* Eine Tapete soll wie eine Bahn um den Raum laufen: überall gleich grosse
   Kacheln und auf jeder Wand eine ganze Zahl davon, damit das Muster in der
   Ecke an einer Kachelkante weitergeht statt mitten im Punkt abzureissen.
   Die Kachelzahl steckt deshalb in den uv-Werten der Wand — nicht in der
   Textur, die sich alle Wände teilen. */
export const WALL_TILE = 1.2;
const kacheln = m => Math.max(1, Math.round(m / WALL_TILE));
export function tapeziereUV(geo, breite, hoehe) {
  const uv = geo.attributes.uv, u = kacheln(breite), v = kacheln(hoehe);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  uv.needsUpdate = true;
  return geo;
}
```

**`js/game.js` — beim Bauen anwenden.** Die drei `panel(...)`-Aufrufe in
`makeFloor` übergeben ihre Geometrie durch `tapeziereUV`, mit der Breite, die
die Wand tatsächlich hat: `w - 0.24` für hinten und vorne, `d` für links und
rechts, Höhe `h` für alle vier.

Das ergibt im Erdgeschoss:

| Wand | Breite | Kacheln | Kachel in Metern |
|---|---|---|---|
| hinten / vorne | 8.36 | 7 | 1.194 |
| links / rechts | 5.60 | 5 | 1.120 |
| senkrecht | 2.40 | 2 | 1.200 |

Ecksprung: 6,6 % statt 49 %. In der ersten Etage (`w = 7.6`, `d = 5.0`,
`h = 2.0`, bei MAXF = 10): 6 × 1.227 zu 4 × 1.250 — 1,9 %.

## Verifikation

Buildless, also kein Test-Runner. Geprüft wird headless mit Playwright im
**Vordergrund** gegen einen lokalen `python3 -m http.server`, über den
Debug-Hook `window.wipfelkratzer` (`js/game.js:2810`):

1. **Gleiche Kachelgrösse rund um den Raum.** Für Etage 0 und Etage 1 aus
   `floorGroups[i].userData.wallPanels` je Wand die uv-Spanne und die echte
   Breite auslesen und Meter-pro-Kachel rechnen. Grösster Unterschied zwischen
   zwei Wänden derselben Etage **unter 10 %** (heute: 49 %).
2. **Ganze Kacheln.** Jede uv-Spanne ist waagrecht wie senkrecht eine ganze
   Zahl (heute senkrecht 1,6).
3. **Tapezieren geht weiter.** Über `w.enterEdit(0)` eine Tapete setzen; die
   vier Wandmaterialien tragen danach dieselbe Textur, und `w.state.wallpaper`
   ist wie bisher pro Wand belegt.
4. **Keine Materialflut.** `w.matCount()` vor und nach dem Tapezieren
   unterscheidet sich nicht stärker als heute.
5. **Null `pageerror`** in allen Läufen.

Dazu ein Blick von Hand auf einen Screenshot des Erdgeschosses mit «Punkte»
auf allen vier Wänden — die Zahlen sagen, dass es rechnerisch stimmt, das Bild
sagt, ob es aussieht wie eine durchgehende Bahn.

## Nicht in diesem Zuschnitt

- Der Bodenbelag (E5) — eigener Fund, eigenes Issue.
- Die Decke bekommt keine Tapete.
- Kein Versatz (`offset`), der das Muster exakt über die Ecke fortsetzt; mit
  ganzen Kacheln ist das gegenstandslos.
- Keine neuen Tapetenmuster, keine Änderung an `WALLS`
  (`js/models.js:681-693`).
- Keine Änderung an der Aussenhaut (`MAT.plaster`) und an den Wandkernen.
