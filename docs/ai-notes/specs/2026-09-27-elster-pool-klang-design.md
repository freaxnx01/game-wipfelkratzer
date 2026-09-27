# Spec — Else füllt den Pool: Wasserplätschern statt komischem Geräusch (Issue #105)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #105 — «wenn elster pool füllt macht es komisches geräusch. Soll
wasser plätschern sein.»

## Problem

Elses Botengang aus #45 hat zwei Klangstellen, und beide greifen zu einem
Effekt, der für etwas anderes gebaut wurde.

**Beim Schöpfen am Bach** spielt `magpieAdvance()` `sfx.whoosh()`
(`js/game.js:2882`). `whoosh()` (`js/game.js:1980`) ist ein Rauschstoss, dessen
Tiefpass von 500 Hz **hinauf** auf 2400 Hz fährt — ein Luftzug. Es ist derselbe
Effekt, der Kameraflüge begleitet (`js/game.js:1170`, `js/game.js:1267`,
`js/game.js:1282`, `js/game.js:1918`, `js/game.js:1923`). Wenn Else ihren Eimer
ins Wasser taucht, hört man also einen Kameraschwenk.

**Beim Ausgiessen in den Pool** spielt `pourBucket()` `sfx.splash()`
(`js/game.js:2899`). `splash()` (`js/game.js:1979`) ist ein einziger
halbsekündiger Rauschstoss, dessen Tiefpass von 2800 Hz auf **260 Hz** abfällt.
Diese Abwärtsfahrt bis fast an den Bassbereich ist genau das «komische
Geräusch»: ein dumpfes *Wumms*, wie ein Sack, der zu Boden fällt. Für den
Sprung in die Wasserrutsche (`js/game.js:1817`) und für Willis Biberburg
(`js/game.js:2339`) ist ein solcher tiefer Platscher richtig — für einen Eimer,
der in ein flaches Becken kippt, nicht.

Dazu kommt: `pourBucket()` läuft dreimal pro Pool (`POOL_TRIPS = 3`,
`js/game.js:19`), und jedes Mal klingt es Ton für Ton identisch. Ein dreifach
wiederholter, immer gleicher Wumms fällt stärker auf als ein einzelner.

## Warum es kein Klangwechsel an `splash()` wird

Naheliegend wäre, `splash()` einfach besser zu stimmen. Das scheidet aus:
`splash()` hat zwei weitere Aufrufer (`js/game.js:1817` Wasserrutsche,
`js/game.js:2339` Biberburg), bei denen der tiefe Platscher passt — ein Körper,
der ins tiefe Wasser geht. Würde man ihn heller und feiner machen, ginge dort
Gewicht verloren, ohne dass jemand danach gefragt hätte. Der Pool bekommt
deshalb einen **eigenen** Effekt; `splash()` bleibt Zeichen für Zeichen, wie es
ist.

## Was ein Plätschern akustisch ausmacht

Zwei Zutaten, die heute beide fehlen:

1. **Ein Strahl.** Schmalbandiges Rauschen im Mittelhochbereich (grob
   1500 → 900 Hz), das über die Giessdauer leiser wird. Kein Abfall in den
   Bass — genau dort entsteht der Wumms.
2. **Blasen.** Kurze Sinustöne, deren Tonhöhe **aufwärts** wandert. Das ist
   der physikalische Kern eines Wassertropfens: die Luftblase schrumpft beim
   Aufsteigen und klingt dabei höher. Die bestehende `drain()`
   (`js/game.js:1996-1998`) gluckert zwar schon, aber mit *konstanten*,
   absteigenden Tönen — das klingt nach leerlaufender Wanne, nicht nach
   einlaufendem Wasser.

Beide Zutaten lassen sich mit den vorhandenen Bausteinen bauen: `noiseBurst()`
(`js/game.js:1956`) für den Strahl, `tone()` (`js/game.js:1948`) plus ein
`exponentialRampToValueAtTime` für die Blase — dasselbe Muster, das `pop()`
(`js/game.js:1975`) und `fill()` (`js/game.js:1991-1995`) schon benutzen.

## Entwurf

### Ein Helfer: `bubble()`

Neben `noiseBurst()` entsteht eine dritte Grundfunktion. Sie kapselt genau das
Muster «Sinuston mit aufwärts wandernder Tonhöhe», damit die beiden neuen
Effekte es nicht je für sich hinschreiben:

```js
/* Eine Wasserblase: kurzer Sinuston, dessen Tonhöhe aufwärts wandert. Das ist
   der hörbare Kern eines Tropfens — die aufsteigende Luftblase schrumpft und
   klingt dabei höher (#105). */
function bubble(t, f0, f1, dur = 0.09, g = 0.07) {
  const o = tone(f0, t, dur, 'sine', g);
  if (o) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
}
```

### `sfx.plaetschern()` — der Eimer kippt in den Pool

Ein Strahl plus fünf zufällig gestreute Blasen über knapp eine Sekunde:

```js
/* Eimer kippt ins Becken: ein heller Strahl und ein paar aufsteigende Blasen.
   Bewusst NICHT splash() — das ist der tiefe Platscher für Wasserrutsche und
   Biberburg (#105). */
plaetschern() {
  if (!AC) return; const t = AC.currentTime;
  noiseBurst(t, 0.85, 1500, 900, 0.10);
  for (let i = 0; i < 5; i++) {
    const f = 420 + Math.random() * 380;
    bubble(t + 0.05 + Math.random() * 0.6, f, f * 1.7);
  }
}
```

Die Zufallsstreuung ist Absicht: bei drei Fahrten pro Pool klingt jede Fahrt
etwas anders, statt dass sich derselbe Ton dreimal exakt wiederholt.

### `sfx.schoepfen()` — der Eimer taucht in den Bach

Kürzer und tiefer als das Ausgiessen — ein einzelnes *Blubb* beim Eintauchen,
kein Strahl:

```js
/* Eimer taucht in den Bach: ein kurzes Blubb mit zwei Nachblasen. */
schoepfen() {
  if (!AC) return; const t = AC.currentTime;
  noiseBurst(t, 0.3, 1800, 1100, 0.09);
  bubble(t, 300, 620, 0.14, 0.09);
  bubble(t + 0.12, 520, 780, 0.08, 0.05);
}
```

### Die beiden Aufrufstellen

| Stelle | heute | neu |
|---|---|---|
| `magpieAdvance()`, Phase `schoepfen` (`js/game.js:2882`) | `sfx.whoosh()` | `sfx.schoepfen()` |
| `pourBucket()` (`js/game.js:2899`) | `sfx.splash()` | `sfx.plaetschern()` |

Sonst ändert sich an Elses Zustandsautomat nichts: dieselben Phasen, dieselben
Dauern (`MAGPIE_DUR`, `js/game.js:242`), derselbe Auslösepunkt bei `k >= 0.5`
der Giessphase (`js/game.js:2935`).

Der Jubel bei vollem Becken (`sfx.chime(true)`, `js/game.js:2904`) bleibt, wie
er ist — das ist die Belohnung, nicht das beanstandete Geräusch.

### Debug-Hook

`window.wipfelkratzer` (`js/game.js:2810-2840`) bekommt `sfx` dazu. Ohne das
kann eine Playwright-Sonde nicht feststellen, *welcher* Effekt gelaufen ist —
hören kann sie nicht. Mit dem Hook kann sie die Effekte umhüllen und zählen.

## Nicht in diesem Zuschnitt

- `sfx.splash()`, `sfx.whoosh()`, `sfx.fill()`, `sfx.drain()` bleiben
  unverändert, samt allen anderen Aufrufern.
- Kein Dauergeräusch am Bach oder am gefüllten Pool. Es gibt heute keine
  Umgebungsklangschicht, und diese Änderung führt keine ein.
- Kein eigener Lautstärkeregler und kein Stummschalter für Effekte.
  `#btn-music` (`js/game.js:2000`) schaltet weiterhin nur die Musik.
- Keine Audiodateien. Die gesamte Klangschicht ist synthetisiert
  (`js/game.js:1926-2000`), das Repo hat kein Asset-Verzeichnis.
- Keine Änderung an Elses Wegen, Dauern oder am Spielstandfeld `fill`.

## Akzeptanzkriterien

1. Wenn Else den Eimer in den Bach taucht, ist ein kurzes Wasser-Blubb zu
   hören — nicht mehr der Kameraschwenk-Rauscher.
2. Wenn Else den Eimer in den Pool kippt, ist ein Plätschern aus Strahl und
   aufsteigenden Blasen zu hören — nicht mehr der dumpfe, tief abfallende
   Platscher.
3. Die drei Fahrten pro Pool klingen nicht identisch.
4. Wasserrutsche (`js/game.js:1817`) und Biberburg (`js/game.js:2339`) klingen
   unverändert; Kameraflüge rauschen weiterhin.
5. Der Pool füllt sich weiterhin in drei Fahrten, der Spielstand bekommt kein
   neues Feld, und «Der Pool ist voll» erscheint wie bisher.
6. Die Seite lädt ohne `pageerror`.

## Verifikation

Kein Test-Runner (Stack-Overlay: buildless). Geprüft wird headless mit
Playwright im **Vordergrund**, über den Debug-Hook:

- `#btn-start` klicken — erst dort entsteht der `AudioContext`
  (`js/game.js:2747`).
- `w.sfx.plaetschern()` und `w.sfx.schoepfen()` direkt rufen: kein
  `pageerror`.
- Einen leeren Pool aufs Dach stellen (`w.enterEdit('roof')`,
  `w.addItem('pool')`, `w.exitEdit()` — `addItem` setzt `entry.fill = 0`,
  `js/game.js:1499`), die Effekte in `w.sfx` mit Zählern umhüllen, die Zähler
  danach zurücksetzen und Elses Botengang abwarten.
- Die Phasendauern lassen sich für die Probe verkürzen: `w.MAGPIE_DUR` ist
  exportiert (`js/game.js:2827`) und wird in `tick()` bei jedem Bild frisch
  gelesen (`js/game.js:2925`). Nötig, weil ein headless Renderer unter 1 fps
  zeichnet und der volle Botengang sonst Minuten dauert.
- Auf den **Endzustand** pollen (`w.poolEntries()[0].fill >= 1`), nicht auf
  eine Zeitspanne wetten.
- Erwartet: `plaetschern >= 1`, `schoepfen >= 1`, `splash === 0`,
  `whoosh === 0`.

## Änderungsprotokoll

`CHANGELOG.md` unter `## [Unreleased]` → `### Changed`, in Spielersprache. Kein
`version.js`-Bump, kein Tag — die Version zieht erst der nächste
`chore(release)`-Commit nach.
