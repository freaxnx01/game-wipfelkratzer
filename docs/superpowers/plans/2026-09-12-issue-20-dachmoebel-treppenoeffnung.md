# Plan: Dach-Möbel lassen sich in die Treppenöffnung stellen (#20)

Spec: `docs/superpowers/specs/2026-09-12-issue-20-dachmoebel-treppenoeffnung.md`

## Task 1 — Gap-Ausschlusszone in `clampEntry` einbauen

In `js/game.js`, im `k === 'roof'`-Zweig von `clampEntry` (`js/game.js:415-426`),
nach der bestehenden `limX`/`limZ`-Klemmung und vor `m.position.set(...)`:

1. Neue Konstante `ROOF_GAP_X0 = ROOF_W / 2 - 0.9` neben den übrigen
   `ROOF_*`-Konstanten (nahe `js/game.js:172-175`, wo `ROOF_TRACK`,
   `ROOF_PAD_Z0`, `inRoofGap` stehen).
2. Nach der Berechnung von `en.x`/`en.z` (Zeilen 423-424), zusätzlich für
   `k === 'roof'`:
   ```js
   if (en.x + hx > ROOF_GAP_X0 && inRoofGap(en.z + hz)) {
     en.z = Math.min(en.z, (ROOF_PAD_Z0 - 0.3) - hz);
   }
   ```
   (`ROOF_PAD_Z0 - 0.3` ist der exakte Ausdruck aus `inRoofGap`, `js/game.js:175`
   — keine neue Z-Konstante einführen, um die Öffnung nicht doppelt zu
   definieren.)
3. `hx`/`hz` existieren in `clampEntry` bereits (Zeile 422) — keine neue
   Bounding-Box-Berechnung nötig.

verify: `grep -n "ROOF_GAP_X0" js/game.js` zeigt Definition + Verwendung;
manuelles Playwright-Skript (siehe Task 3) bestätigt, dass ein Pool nicht mehr
in die Öffnung gezogen werden kann.

## Task 2 — Alt-Spielstände beim Laden nachziehen

In `js/game.js`, im Lade-Block (`js/game.js:1040-1043`):

```js
Object.keys(state.rooms).forEach(k => {
  const key = k === 'roof' ? 'roof' : parseInt(k, 10);
  roomOf(key).forEach(e => {
    const m = placeItemMesh(key, e);
    if (key === 'roof') clampEntry('roof', m, e);
  });
});
```

Kein zusätzliches `try/catch` nötig — dieser Codepfad läuft nur nach
erfolgreichem Parsen von `wipfelkratzer-v1` (Zeile 36) und `clampEntry` wirft
nicht. `save()` muss hier **nicht** erzwungen werden: die nachgezogene Position
wird beim nächsten ohnehin stattfindenden `save()` (z. B. nächste Interaktion)
persistiert; bis dahin ist die In-Memory-Position schon korrekt gerendert.

verify: Test-Fixture mit einem Dach-Eintrag bei `x: 3.1, z: 2.0` (in der
Gap-Zone) in `localStorage['wipfelkratzer-v1']` vor dem Laden setzen; nach dem
Laden `window.wipfelkratzer.state.rooms.roof[0]` prüfen — `z` muss `<= 0.8`
sein (`1.1 - hz`, für typische Möbel-Halbtiefe ~0.3); keine console errors.

## Task 3 — Headless-Playwright-Verifikation

Neues (oder erweitertes bestehendes) Playwright-Skript unter dem Muster der
übrigen Headless-Checks in diesem Repo (Port 8966-8970,
`args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`,
`page.click`-Timeout ≥ 20000ms):

1. Normale Spielsitzung: alle Etagen bauen (`state.floors = MAXF` via
   `window.wipfelkratzer` oder UI), Dach-Terrasse öffnen, Pool/Liegestuhl aus
   dem Katalog wählen, per Pfeiltasten/Drag so weit wie möglich Richtung
   Öffnung schieben — Endposition darf die Gap-Zone (`x > ROOF_GAP_X0 &&
   z > ROOF_PAD_Z0 - 0.3`, ausgewertet aus `window.wipfelkratzer.state`) nicht
   erreichen.
2. Alt-Spielstand-Fixture (siehe Task 2) laden, prüfen dass das Möbelstück
   ausserhalb der Gap-Zone landet und die Szene rendert.
3. `page.on('pageerror', ...)` und `page.on('console', msg => msg.type() ===
   'error' ...)` müssen über alle drei Szenarien leer bleiben.
4. Server sauber per Port stoppen (`ss -lptn 'sport = :<port>' | grep -oP
   'pid=\K[0-9]+' | xargs kill`), nicht `pkill -f`.

verify: Playwright-Lauf beendet mit exit code 0, keine `pageerror`/console-error
Einträge, Konsolen-Assertion für alle drei Szenarien grün.

## Task 4 (optional, nicht AC-relevant) — Totes `bounds` entfernen

`js/game.js:402` (`const bounds = k => ...`) ist unbenutzt (siehe Spec A2).
Kann in einem separaten, minimalen Commit entfernt werden, um künftige
Verwirrung (wie in diesem Issue) zu vermeiden. Nicht Teil der
Akzeptanzkriterien — nur wenn der Owner das ausdrücklich mit aufnehmen will.

verify: `grep -rn "bounds" js/*.js` liefert nach Entfernung keinen Treffer mehr;
Spiel lädt weiterhin fehlerfrei (gleicher Playwright-Lauf wie Task 3).
