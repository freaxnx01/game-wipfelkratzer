# Design — Sprechblase länger stehen lassen und mit × schliessen (Issue #104)

**Status:** validiert (Quick-Mode, ohne Rückfragen)
**Issue:** https://github.com/freaxnx01/game-wipfelkratzer/issues/104
**Datum:** 2026-09-27

## Das Problem

Von der Aussichtsplattform aus ist ein Tipp auf ein Tier die einzige Art,
etwas über den Wald zu erfahren — genau dafür wurde das «Fernrohr» in #82
gebaut (`js/game.js:2086-2115`). Der Text steht danach **fünf Sekunden** und
verschwindet von selbst (`js/game.js:2374`). Wer noch liest, verliert den
Satz mitten im Wort; wer ihn noch einmal will, muss das Tier erneut treffen.

Dasselbe gilt für alle anderen Sprecher, denn es gibt nur **eine**
Sprechblase (`#bubble`, `index.html:463`), und alle fünf Auslöser setzen
dieselbe Ablaufzeit mit eigenen, leicht verschiedenen Werten:

| Auslöser | Funktion | Dauer heute |
|---|---|---|
| Willi Biber | `williTalk()` `js/game.js:2320-2327` | 4 s |
| Biberburg | `damTalk()` `js/game.js:2334-2340` | 5 s |
| Móki | `mokiTalk()` `js/game.js:2348-2354` | 4.5 s |
| Tier im Turm | `tenantTalk()` `js/game.js:2002-2010` | 4.5 s |
| Fernrohr (Aussicht) | `erzaehle()` `js/game.js:2370-2376` | 5 s |

Ausgeblendet wird ausschliesslich in der Renderschleife
(`js/game.js:2955-2960`): `if (t > bubbleUntil) bubbleEl.classList.remove('show')`.
Es gibt heute **keinen** Weg, eine Blase von Hand zu schliessen — und keinen
Weg, sie länger stehen zu lassen.

## Der Zuschnitt

Das Issue nennt zwei Möglichkeiten («länger stehen lassen **oder** besser
durch X schliessbar») und bevorzugt die zweite. Der Entwurf nimmt **beide**,
weil sie zusammen erst das Verhalten ergeben, das ein Kind erwartet: Zeit zum
Lesen, und ein Knopf, wenn es fertig ist.

Die Änderung sitzt an der **gemeinsamen** Sprechblase, nicht nur am
Fernrohr-Pfad. Das ist kein Ausweiten des Zuschnitts, sondern seine
natürliche Grenze: die Tiere, die man von der Plattform aus antippt, sind
Else Elster (`erzaehle`), Willi, Móki und die Biberburg — und die letzten
drei laufen bewusst **nicht** über `erzaehle`, sondern über ihre eigenen
Sprechfunktionen (`js/game.js:2094`, Kommentar: «Willi, Biberburg, Móki und
das Schild fehlen hier mit Absicht»). Eine Lösung nur in `erzaehle` würde
also genau drei der vier angetippten Tiere auslassen.

**Ausdrücklich nicht dabei:**

- Kein Blättern, kein «nochmal vorlesen», keine Verlaufsliste.
- Keine Escape-Taste, kein Schliessen durch Tippen daneben — das Spiel ist
  touch-first, der × genügt.
- Kein neues Feld im Spielstand. Die Dauer ist eine Konstante, keine
  Einstellung.
- Kein Umbau der Toast-Meldungen (`js/game.js:863-891`); die haben ihren
  eigenen × bereits und bleiben unberührt.
- `version.js` wird nicht angefasst.

## Die Lösung

### 1. Eine Stelle statt fünf: `zeigeBlase()`

Die fünf Auslöser wiederholen heute denselben Vierzeiler (Ziel setzen, Höhe
setzen, `innerHTML` setzen, `show` + `bubbleUntil`). Der × und die neue Dauer
müssten sonst fünfmal eingebaut werden. Stattdessen bekommt die Blase **eine**
Öffnungsfunktion, und die fünf Auslöser rufen sie auf:

```js
const BLASE_DAUER = 12;               /* Sekunden, für alle Sprecher gleich */

function zeigeBlase(ziel, hoehe, inhalt) {
  bubbleTarget = ziel; bubbleH = hoehe;
  bubbleEl.innerHTML = inhalt +
    '<button type="button" class="blase-zu" aria-label="Zu">×</button>';
  bubbleEl.classList.add('show');
  bubbleUntil = clock.elapsedTime + BLASE_DAUER;
}

function verbergeBlase() {
  bubbleEl.classList.remove('show');
  bubbleUntil = 0;
}
```

Die Klänge (`sfx.pop()`, `sfx.chime()`, `sfx.splash()`) bleiben bei den
Auslösern — sie gehören zum Sprecher, nicht zur Blase. `buildingUntil` und
`mokiWait` ebenso.

Der Schliessknopf hängt an einem **einzigen, delegierten** Listener auf
`bubbleEl`, einmal beim Start gesetzt — nicht an einem `onclick` pro
`innerHTML`-Neubau, der bei jedem Sprechen neu verdrahtet werden müsste:

```js
bubbleEl.addEventListener('click', e => {
  if (e.target.closest('.blase-zu')) verbergeBlase();
});
```

### 2. Der × muss Tipps fangen — die Blase darf es weiter nicht

`#bubble` ist heute `pointer-events: none` (`index.html:273`), und das ist
Absicht: die Blase schwebt über der Szene, und ein Tipp muss durch sie
hindurch auf den Wald gehen. Der × ist die einzige Ausnahme:

```css
#bubble .blase-zu { pointer-events: auto; min-width: 44px; min-height: 44px;
  padding: 0; border-radius: 50%; font-size: 20px; line-height: 1; flex-shrink: 0; }
```

Das ist bewusst dieselbe Form wie `.toast-close` (`index.html:269`) — das
Kind hat den runden × unten bei den Meldungen schon gesehen, er soll in der
Blase gleich aussehen. 44 px erfüllt die Touch-Regel aus `CLAUDE.md`.

Weil der × als drittes Flex-Kind neben Bild (52 px) und Text steht, wächst
`max-width` von 280 px auf 320 px, damit der Text nicht auf zwei Buchstaben
pro Zeile zusammenfällt.

### 3. Zwölf Sekunden statt vier bis fünf

`BLASE_DAUER = 12` ersetzt alle fünf Einzelwerte. Begründung: die längsten
Texte (`DAM_TEXTS[1]`, `FERNROHR.elster`) sind rund 110 Zeichen; ein Kind,
das gerade lesen lernt, braucht dafür deutlich mehr als fünf Sekunden. Zwölf
ist grosszügig genug zum Lesen und kurz genug, dass eine vergessene Blase
nicht dauerhaft im Bild klebt. Das automatische Ausblenden bleibt also als
Netz erhalten — der × ist der schnelle Weg, nicht der einzige.

### 4. Móki bleibt stehen, solange er redet

`mokiTalk()` setzt heute `mokiWait = Math.max(mokiWait, 4)`, damit Móki
während seiner 4.5-Sekunden-Blase nicht wegläuft (`js/game.js:2349`). Mit
zwölf Sekunden würde er nach vier Sekunden weiterflitzen und die Blase
hinter sich herziehen — sie hängt am Ziel und wird jedes Bild neu projiziert
(`js/game.js:2957`). Ein quer über den Bildschirm wandernder Text ist
schlechter lesbar als ein kurzer. Also: `mokiWait = Math.max(mokiWait, BLASE_DAUER)`.

Die anderen vier Ziele stehen still (Willi wippt nur, Biberburg, Tier im
Raum, Plattform), dort ändert sich nichts.

## Datenfluss

```
Tipp (pointerup)  →  williTalk / damTalk / mokiTalk / tenantTalk / erzaehle
                          │  Klang + eigener Text
                          └→ zeigeBlase(ziel, höhe, html)
                                 setzt bubbleTarget / bubbleH / bubbleUntil
                                 hängt <button class="blase-zu"> an

Renderschleife (tick)  →  t > bubbleUntil ?  classList.remove('show')
                                           :  Position aus bubbleTarget projizieren

Tipp auf ×  →  delegierter Listener auf #bubble  →  verbergeBlase()
```

Kein neuer Zustand ausserhalb der beiden bereits vorhandenen Variablen
`bubbleUntil` und `bubbleTarget`. Kein `localStorage`, kein Spielstandfeld.

## Fehlerfälle

- **Blase ist schon zu, × wird trotzdem getroffen** — unmöglich, der Knopf
  liegt in einem Element mit `display: none`; der Listener läuft dann nicht.
- **Neue Blase, während eine offen ist** — `zeigeBlase` überschreibt
  `innerHTML` und `bubbleUntil` komplett; der alte × verschwindet mit dem
  alten Inhalt. Das ist das heutige Verhalten.
- **Der × verdeckt die Szene** — 44 px an einer Stelle, an der vorher alles
  durchlässig war. Bewusst in Kauf genommen: er steht am rechten Rand der
  Blase, und die Blase steht über dem angetippten Objekt, nicht darauf
  (`transform: translate(-50%, -110%)`, `index.html:273`).
- **Kein Klang beim Schliessen** — Absicht. Der × ist eine Geste des Kindes,
  keine Ansage des Spiels.

## Verifikation

Buildless: kein Test-Runner, kein `package.json`. Geprüft wird headless mit
**Playwright im Vordergrund** (nie `run_in_background`), Chromium mit
`--use-gl=swiftshader --enable-unsafe-swiftshader`, gegen
`python3 -m http.server`. Die Sonden sind Wegwerf-Skripte und werden nicht
committet.

Nachweisbar sein muss:

1. Nach `w.erzaehle(...)` bzw. einem echten Tipp trägt `#bubble` die Klasse
   `show` und enthält genau einen `.blase-zu`.
2. `.blase-zu` misst mindestens 44 × 44 px (`boundingBox()`), `#bubble`
   selbst hat weiterhin `pointer-events: none`, der Knopf `auto`.
3. Ein `page.click('#bubble .blase-zu')` entfernt `show` **sofort** — nicht
   erst nach Ablauf der Zeit.
4. Ohne Klick steht die Blase nach 6 Sekunden noch (früher wäre sie weg) und
   ist nach `BLASE_DAUER` plus Reserve verschwunden. `clock.elapsedTime`
   folgt der echten Uhr — die Klammerung in `js/game.js:2912`
   (`dt = Math.min(clock.getDelta(), 0.05)`) betrifft nur den
   Animationsschritt, nicht `elapsedTime` —, aber headless zeichnet die
   Schleife unter einem Bild pro Sekunde, und ausgeblendet wird erst im
   nächsten Bild. Geprüft wird deshalb mit `wait_for_function` und
   grosszügigem Timeout, nicht mit einem knappen `sleep`.
5. Alle fünf Sprecher zeigen den ×: Willi, Biberburg, Móki, ein Tier im Turm
   (Durchblick-Modus) und ein Fernrohr-Text von der Aussichtsplattform.
6. `pageerror` bleibt leer. Erwartete Warnungen (`THREE.Clock`,
   `PCFSoftShadowMap`, `GL Driver Message`, 404 auf `favicon.png`) werden
   ignoriert.

Damit die Sonden das ohne Kamerafahrten prüfen können, kommen `zeigeBlase`,
`verbergeBlase`, `erzaehle`, `williTalk`, `damTalk`, `mokiTalk`,
`tenantTalk`, `BLASE_DAUER` und `clock` in den Debug-Hook
(`window.wipfelkratzer`, `js/game.js:2810-2841`). `clock` wird erst in
`js/game.js:2909` angelegt, also **nach** dem Hook — der Eintrag muss
deshalb ein Getter sein (`get clock() { return clock; }`), sonst läuft der
Hook in die temporale Totzone der `const`-Deklaration.

## Betroffene Dateien

- `index.html` — CSS für `#bubble .blase-zu`, `max-width` der Blase.
- `js/game.js` — `zeigeBlase`/`verbergeBlase`/`BLASE_DAUER`, die fünf
  Auslöser darauf umgestellt, delegierter Listener, Debug-Hook.
- `CHANGELOG.md` — Eintrag unter `## [Unreleased]` → `### Changed`, in der
  Sprache der Spielenden.

Nicht angefasst: `version.js`, `js/models.js`, `js/staende.js`,
`js/standdatei.js`, `js/zip.js`.

## Selbstprüfung des Specs

- **Platzhalter:** keine. Alle Zahlen (12 s, 44 px, 320 px) stehen fest.
- **Widersprüche:** `pointer-events: none` an der Blase und `auto` am Knopf
  sind kein Widerspruch, sondern die Ausnahme, die der Abschnitt benennt.
- **Zuschnitt:** eine Datei Logik, eine Datei CSS, ein Changelog-Eintrag —
  klein genug für einen Plan.
- **Mehrdeutigkeit:** «länger **oder** ×» aus dem Issue ist hier zu «beides»
  aufgelöst und begründet; «Tiere» ist als «alle vier von der Plattform aus
  antippbaren Tiere» ausgelegt und ebenfalls begründet.
