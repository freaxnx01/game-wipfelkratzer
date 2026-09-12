# Plan — Kamera rahmt im Hochformat die Möbel aus dem Bild (Issue #17)

Repo: `game-wipfelkratzer`. Branch: `fix/issue-17-kamera-hochformat`. Base:
`main` (v0.3.0). Buildless vanilla: `index.html` + `js/game.js` + `js/models.js`.
three.js r184 via importmap. No build step, no test framework.

Spec: `docs/superpowers/specs/2026-09-12-issue-17-kamera-hochformat.md`.

## Global Constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`).
- **Buildless.** No new dependencies, no build step, no npm, no test runner.
  ES modules only.
- **Picture-book look is final-intent.** `MeshLambertMaterial` only, chunky
  low-poly primitives, warm desaturated palette — untouched by this fix
  (camera math only, no material/geometry changes).
- **Persistence backward compatible.** `localStorage` keys `wipfelkratzer-v1`
  and `wipfelkratzer-fotos` must keep loading; this change touches no saved
  shape, but verify a v0.3.0 save still loads without error.
- **Touch is first-class.** The fix directly targets tablet-portrait
  usability; verify real 3D taps (not forced DOM state) work post-fix.
- **Verification is headless Playwright** against a local
  `python3 -m http.server` on a port in 8971–8975, chromium with
  `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`. Every
  `page.click`/interaction needs `timeout=20000` or more. Zero uncaught
  `pageerror` events is part of every pass. Stop the server by port when
  done, never `pkill -f` with a pattern matching the launching shell.

## Verification harness

Throwaway scripts go under
`.superpowers/sdd/2026-09-12-issue-17-kamera-hochformat/` (git-ignored).

- Seed `localStorage['wipfelkratzer-v1']` before load with all 10 floors
  built (and the roof unlocked) so every floor's edit mode and the roof are
  reachable without ten "Stockwerk bauen" clicks per viewport in the matrix.
- Viewport matrix to test: `820×1180` (the issue's own measurement),
  `400×900` (extreme narrow), `1280×800` and `1920×1080` (landscape
  regression check), `1024×1024` (square, boundary case).
- Grid-cell visibility check: for a given floor `k` in edit mode, replicate
  `cellPos(k, cell)` (`js/game.js:359-360`) for every cell `0..colsOf(k)*2-1`
  inside `page.evaluate`, convert each to a world position via the floor's
  group transform, `project()` against the live camera (mirroring the
  screen-space math at `js/game.js:1083-1084`), and assert
  `0 <= screenX <= innerWidth` and `0 <= screenY <= innerHeight` for all of
  them.
- Real-tap check: pick one known cell's world→screen position (from the
  above) and issue an actual `page.mouse.click(x, y)` (or `page.click` on the
  canvas coordinates) — not a forced `#selbar.on` class toggle — then assert
  `#selbar` gains `.on` and the correct item is `selected`, closing the gap
  `js/game.js:532-554`'s own comment / issue #7's verification left open.
- Landscape regression check: compare a screenshot of a floor in edit mode
  at `1280×800` against the same view on `main` (pre-change) — allowed to
  differ only within a small pixel-diff tolerance, not a full re-frame.
- Resize-while-editing check: enter edit mode at one aspect, then use
  `page.setViewportSize(...)` to switch to another aspect (simulating
  rotation) without exiting edit mode, and re-run the grid-cell visibility
  check immediately after.

---

## Task 1 — Add the `fitDistance` helper

**Change**, near `enterEdit` (`js/game.js:532`, immediately above it):

```js
function fitDistance(halfWidth, halfHeight) {
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distH = halfWidth / Math.tan(hFov / 2);
  const distV = halfHeight / Math.tan(vFov / 2);
  return Math.max(distH, distV);
}
```

No call sites changed yet — this task only introduces the helper so Tasks 2–3
are pure call-site swaps.

**verify:** `grep -n "function fitDistance" js/game.js` shows one match above
`enterEdit`; `node --check js/game.js` (or a browser console `import` smoke
load) confirms no syntax error introduced.

---

## Task 2 — Apply `fitDistance` to the floor branch of `enterEdit`

**Change**, `js/game.js:540-548` (floor branch): replace the fixed distance
term in the `moveCam(...)` call —

```js
// before
D(k) / 2 + W(k) * 0.62 + 2.6
// after (shape; tune the pad constants against Task 5's sweep)
D(k) / 2 + fitDistance(dims(k).w / 2 + <horizontalPad>, H(k) / 2 + <verticalPad>) + <buffer>
```

— using `dims(k)` (`js/game.js:357`) for the grid's usable half-width so wall
items near the edge stay covered, and `H(k)` for the room's vertical extent.
Everything else in the floor branch (`x`, target `y = cy`, eye height
`cy + 0.5`, visibility toggling, `applyFronts()`, HUD/title text) is
unchanged.

**verify:** Playwright grid-cell visibility check (harness above) passes for
every floor `0..10` at `820×1180` and `400×900`; landscape regression check
passes at `1280×800`/`1920×1080` (screenshot diff within tolerance vs.
pre-change `main`).

---

## Task 3 — Apply `fitDistance` to the roof branch of `enterEdit`

**Change**, `js/game.js:536-539` (roof branch): replace the fixed
`ROOF_D / 2 + 5.5` / `y + 3.2` terms with the same `fitDistance` pattern using
`ROOF_W / 2` and a height budget covering the tallest terrace decoration,
keeping the roof's own target/eye-height logic (`y`, `y + 3.2` role)
otherwise intact.

**verify:** Playwright grid-cell visibility check extended to the roof's own
cell layout (`dims('roof')`, `js/game.js:357`) passes at `820×1180` and
`400×900`; landscape screenshot spot-check at `1280×800` shows no unexpected
zoom jump versus pre-change `main`.

---

## Task 4 — Reframe instantly on resize while already editing

**Change**, `js/game.js:1091` (the `resize` listener): after updating
`camera.aspect`/`updateProjectionMatrix()`/`renderer.setSize(...)`, add a
branch — if `edit` is truthy, recompute the same camera position/target the
active branch of `enterEdit` would compute for `edit.k`, and apply it
directly to `camera.position`/`controls.target` (no tween, since this is a
"snap to correct" not an entry animation).

**verify:** Playwright resize-while-editing check (harness above): enter edit
mode on a floor at `1280×800`, then `page.setViewportSize` to `820×1180`
without calling `exitEdit`/`enterEdit` again, and confirm the grid-cell
visibility check passes immediately after the resize event, with zero
`pageerror`.

---

## Task 5 — Full verification sweep + tuning pass

Run one Playwright script covering the full viewport matrix and all checks
from the harness section above, in one pass:

- Grid-cell visibility (every floor + roof) at `820×1180`, `400×900`,
  `1024×1024`.
- Real-tap selection check at `820×1180` (closing the #7-verification gap).
- Landscape regression screenshots at `1280×800`, `1920×1080` vs. `main`.
- Resize-while-editing check (per Task 4).
- Save-compatibility smoke check: seed a `wipfelkratzer-v1` value in the
  v0.3.0 shape, load, confirm no `pageerror` and normal rendering (no schema
  touched by this change, but confirm per the global constraints).
- Zero `pageerror` events through the entire run.

Use this sweep to finalize the pad/buffer constants left open by Tasks 2–3
(A2 in the spec) — tighten or loosen only these constants, not the
`fitDistance` formula shape, if a cell clips or landscape framing visibly
jumps.

**verify:** the Playwright script exits 0 and prints every assertion above as
passed; landscape screenshots are visually equivalent to `main`'s pre-change
framing (saved under the throwaway harness directory for review).

---

## Out of scope

Reworking the `#catalog` panel's width/layout on narrow screens (A5 in the
spec); any change to `OrbitControls` limits or the outside-edit "look around"
camera; grid layout, geometry, or material changes; a general-purpose
fit-to-arbitrary-object camera utility beyond the two `enterEdit` call sites.
Discoveries go in `TODO.md` or a new issue, not into this branch.
