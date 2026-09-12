# Spec — Kamera rahmt im Hochformat die Möbel aus dem Bild (Issue #17)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0).
Buildless vanilla: `index.html` + `js/game.js` + `js/models.js`. three.js r184 via
importmap. No build step, no test framework.

## Problem

`enterEdit(k)` (`js/game.js:532-554`) frames the camera for the Einrichten-Modus
with a **fixed, aspect-independent distance formula**:

```js
moveCam(new THREE.Vector3(floorGroups[k].position.x, cy + 0.5, D(k) / 2 + W(k) * 0.62 + 2.6),
        new THREE.Vector3(floorGroups[k].position.x, cy, 0));
```

and the roof branch (`js/game.js:536-539`) does the same with its own fixed
constants (`ROOF_D / 2 + 5.5`, `y + 3.2`). Neither branch reads `camera.aspect`
(`js/game.js:54`, updated on resize at `js/game.js:1091`). `camera.fov` (48°) is
the *vertical* FOV in three.js — aspect only changes the *horizontal* FOV
(`hFov = 2·atan(aspect·tan(vFov/2))`). At the tested 820×1180 viewport
(`aspect ≈ 0.695`), the horizontal FOV shrinks to roughly 34° (vs. ~72–77° at
typical landscape/tablet aspects the constant was tuned for), so a room up to
`W(0) = 8.6` wide no longer fits horizontally at the old fixed distance — and
the issue's own measurement (grid cells projecting to `y ≈ 1213–1216` in a
1180-tall viewport, via the same `project()`-to-screen math used for speech
bubbles at `js/game.js:1083-1084`) confirms cells land fully outside the visible
canvas. The reporter flagged the aspect-blindness as the suspected cause without
digging further (`js/game.js:532-554` "Ursache (vermutet, nicht weiter
untersucht)"); this spec fixes that root cause directly rather than treating
only the symptom.

**Why it matters:** the game targets a child on a tablet, which is often held
upright. In that orientation, no furniture in the current floor can be tapped
in edit mode at all.

## Goals

- The Einrichten-Modus camera fits the **entire relevant scene volume**
  (grid cell area, plus wall-mounted item height) inside the visible viewport,
  for both floors and the Dachterrasse, at any aspect ratio the game runs at —
  narrow portrait through wide landscape.
- Framing degrades gracefully at extreme aspect ratios: the room may appear
  smaller/farther away on a very narrow screen, but every cell stays onscreen
  and tappable. Usability (everything reachable) is prioritized over a fixed
  apparent zoom level.
- Typical landscape/tablet aspect ratios (4:3 through 16:9) keep essentially
  the same framing players already know — no perceptible zoom regression on
  the common case.
- Rotating the device (resize) while already inside edit mode reframes
  immediately, so a mid-edit rotation doesn't strand the player with
  offscreen furniture until they exit and re-enter.

## Non-goals

- Reworking the `#catalog` side panel, which occupies up to `min(320px, 88vw)`
  of screen width while open (`index.html:54`) — on a narrow viewport this
  still leaves only a slim strip of unobstructed 3D canvas next to it. That's
  a pre-existing, separate layout concern; noted under Consequences, not
  fixed here.
- Any change to `OrbitControls` behavior, zoom/pan limits, or the "look around"
  camera used outside edit mode (`js/game.js:55-57`).
- Any change to the roof/floor geometry, grid layout (`cellPos`, `colsOf`,
  `js/game.js:357-360`), or furniture placement logic.
- A general "fit camera to arbitrary object" utility beyond what this issue's
  two call sites (floor edit, roof edit) need.
- Changing `camera.fov` (48°) itself, or introducing a second camera.

## Design

Replace the two hardcoded distance formulas with one aspect-aware "fit the
room into frame" calculation, using the camera's actual vertical FOV and
aspect ratio to derive the horizontal FOV, then picking whichever axis needs
more distance:

```js
function fitDistance(halfWidth, halfHeight) {
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distH = halfWidth / Math.tan(hFov / 2);
  const distV = halfHeight / Math.tan(vFov / 2);
  return Math.max(distH, distV);
}
```

Call sites:

- **Floor branch** (`js/game.js:540-548`): `halfWidth` from `dims(k).w / 2`
  plus a small pad for wall items sitting near the room's outer edge;
  `halfHeight` from `H(k) / 2` plus a margin so furniture near ceiling height
  isn't clipped. Camera z becomes `D(k) / 2 + fitDistance(...) + <buffer>`,
  same x/target-y logic as today (`cy + 0.5` eye height, `cy` target height).
- **Roof branch** (`js/game.js:536-539`): same helper with `ROOF_W / 2` and a
  height budget covering the terrace's tallest decoration, replacing the
  fixed `y + 3.2` / `ROOF_D / 2 + 5.5`.
- Exact margin/pad constants are tuned during implementation against a
  screenshot/assertion sweep (Task 5 in the plan) rather than fixed here —
  the formula shape is the spec; the constants are an implementation detail
  as long as every cell stays onscreen and landscape framing doesn't visibly
  jump.
- **Resize while editing:** extend the `resize` listener (`js/game.js:1091`)
  so that, when `edit` is truthy, it recomputes and applies the same target
  camera position/target instantly (no tween) after updating
  `camera.aspect`/`updateProjectionMatrix()` — mirroring what `enterEdit`
  already computes, just without the 0.9s tween used on entry.

This keeps `enterEdit`'s overall structure (visibility toggling, HUD/catalog
open, `applyFronts()`, etc.) untouched; only the two `moveCam(...)` position
expressions change to route through `fitDistance`, plus the added resize
branch.

## Acceptance Criteria

- [ ] At 820×1180 (the issue's measured viewport), every grid cell of every
      buildable floor (0 through 10) projects fully inside `[0, innerWidth] ×
      [0, innerHeight]` while that floor is in edit mode, using the same
      `project()`-to-screen math as `js/game.js:1083-1084`.
- [ ] Same holds for the Dachterrasse edit mode at 820×1180.
- [ ] Same holds at an even narrower aspect (e.g. 400×900).
- [ ] At representative landscape/tablet aspects (e.g. 1280×800, 1920×1080),
      the camera framing is visually unchanged from `main`'s current
      behavior (screenshot spot-check, no jarring zoom jump).
- [ ] Triggering a `resize` event while already in edit mode (simulating a
      device rotation) reframes the camera immediately so all cells stay
      onscreen — no need to exit and re-enter edit mode.
- [ ] A real 3D tap (raycast click, not a forced DOM class toggle) can select
      an item in every grid cell at 820×1180, closing the gap the issue
      called out (`#7`'s verification had to force `#selbar.on` via DOM).
- [ ] Zero uncaught `pageerror` events across the whole viewport matrix above.
- [ ] `wipfelkratzer-v1` / `wipfelkratzer-fotos` saves from v0.3.0 still load
      without error (no persistence shape touched by this change).
- [ ] No new dependency, build step, or test runner introduced; the fix lives
      entirely in `js/game.js`, ES modules only.

## Assumptions

- **A1** [high] Root cause fixed at its source: replace the fixed
  `D(k)/2 + W(k)*0.62 + 2.6` / `ROOF_D/2 + 5.5` distances in `enterEdit` with
  one aspect-aware "fit width and height into FOV, take the max" helper,
  rather than only patching the portrait case.
  Rejected: a portrait-only branch/special-case (e.g. `if (aspect < 1) ...`).
  `js/game.js:532-554` computes distance identically regardless of aspect
  today; a special-cased branch would leave the same aspect-blindness for
  any future aspect between "clearly landscape" and "clearly portrait" (e.g.
  a square-ish window), so the general formula is the more robust fix for
  the same amount of code.

- **A2** [med] Margin/pad constants (how much extra room beyond the bare
  grid/wall bounds to keep visible) are left as implementation-tuned values,
  verified empirically via the Playwright sweep in the plan, rather than
  specified as exact numbers here.
  Rejected: pre-computing exact constants in this spec. Doing so precisely
  requires rendering and measuring, which belongs in the implementation/
  verification step, not the spec; fixing a number now risks either
  clipping cells (too tight) or a visible landscape zoom regression (too
  loose) that only shows up once actually measured.

- **A3** [med] Included: reframing instantly on `resize` while `edit` is
  already truthy (mid-edit device rotation), extending
  `js/game.js:1091`'s existing resize listener.
  Rejected: leaving resize-while-editing unhandled (requiring exit/re-enter
  to reframe). The issue's own framing is "a child holds a tablet" — an
  in-session rotation is a realistic and cheap-to-handle case once the fit
  helper exists, since it's the same expression already computed for
  `enterEdit`, just applied without a tween.

- **A4** [med] The Dachterrasse (roof) edit camera (`js/game.js:536-539`) is
  fixed by the same helper even though the reported issue and its
  measurement are about a floor's furniture grid, not the roof.
  Rejected: leaving the roof branch as-is. It shares the identical
  aspect-blind pattern (fixed distance, no `camera.aspect` read) one function
  above the floor branch; fixing only one of the two would leave a
  near-identical bug for the terrace, discoverable the same way (#7's
  verification style) on the next portrait pass. Flagged `[med]` rather than
  `[high]` since it's not what the issue explicitly measured — the owner may
  prefer to scope this out to a separate issue if the roof turns out fine in
  practice.

- **A5** [low] The `#catalog` panel's `min(320px, 88vw)` width
  (`index.html:54`) is left untouched — it still covers most of a narrow
  portrait screen while open, leaving a slim strip of unobstructed 3D canvas
  beside it even after this fix.
  Rejected: also narrowing the catalog panel or making it collapsible on
  narrow screens. That's a distinct UI-layout concern from the camera
  framing bug this issue reports, would touch CSS/layout rather than the
  camera math, and risks scope creep into a second, unrelated fix; noted
  under Consequences instead so it isn't lost.

## Consequences

- On very narrow aspect ratios, rooms will appear smaller/farther away than
  before (this is the necessary trade-off for keeping every cell onscreen and
  tappable) — an intentional, inherited pacing change for portrait play, not
  a regression to hide.
- Even with the camera fixed, the `#catalog` panel (A5) still leaves only a
  narrow strip of tappable 3D canvas beside it on narrow screens; a future
  issue may want to revisit that panel's width or make it a bottom sheet on
  narrow viewports.
- The new `fitDistance` helper becomes the canonical way any future edit-mode
  camera framing (e.g. a new special room type) should be computed, rather
  than reintroducing a fixed-distance heuristic.
