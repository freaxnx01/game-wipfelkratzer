# Plan: Liegestuhl-Modell überarbeiten (Issue #13)

Spec: `docs/superpowers/specs/2026-09-12-issue-13-liegestuhl.md`

Implementation is expected to run on **Fable** (design/visual-modelling task,
per issue label `area:design`) — this plan gives the target look and the
verification bar, not exact code; the modelling technique (which primitives,
how the frame is built) is the implementer's call within the spec's
constraints.

This is one self-contained visual change (`js/models.js:180-184` only) — a
single task, no subagent dispatch needed.

## Task 1 — Rebuild `FURN.liegestuhl()`

Replace the current implementation in `js/models.js` (function starts at
line 180) with a model that:

- Builds a two-plane seat: near-horizontal seat + steeper-angled backrest,
  joined at a bend (reuse the existing 5-slat red/white striped look for the
  fabric, per spec A4 — just split it across the two planes instead of one
  flat tilted board).
- Builds a support (raked legs, a diagonal cross-brace, or a side-frame
  silhouette — implementer's choice) whose top point(s), in world space,
  coincide with the seat-front and backrest-top edges. Compute the frame
  first (or compute its top points) and place the seat/back ends there —
  don't independently rotate a flat plank and place straight vertical legs
  the way the current code does (that's the exact bug per spec A1).
- Uses only `MeshLambertMaterial` via the existing `MAT` palette
  (`js/models.js:4-12`), boxes/cylinders via the `box`/`cyl`/`sph` helpers
  (`js/models.js:18-20`) — no imported meshes, no new colors.
- Stays close to today's footprint (~0.5w × 0.7d × 0.45h, spec A6) so it
  doesn't dwarf `pool`/`sonnenschirm` on the same roof deck.
- Keeps the function name `liegestuhl` and its `CATALOG`/`CATS` wiring
  untouched (`js/models.js:213`) — no data-shape change, no migration
  (spec A5).

verify: `grep -n "liegestuhl" js/models.js` still shows exactly one
`liegestuhl()` builder under `FURN`, using only `MAT.*` materials and
`box`/`cyl`/`sph` calls (no `THREE.` calls added directly, no new import).

## Task 2 — Headless visual + error check

Serve the repo root over HTTP (port range 8946–8950), open `index.html` in
headless Chromium (`args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`),
seed `localStorage['wipfelkratzer-v1']` with a roof entry
`{ floors: 3, rooms: { roof: [{ id: 'liegestuhl', cell: 0, x: 0, z: 0, y: 0,
rot: 0 }] }, nuts: 999, ... }` (matches existing save shape,
`js/game.js:31,583-598` — this also doubles as the backward-compatibility
check from spec A5, since it's exactly what an old save with a placed
liegestuhl looks like), reload, dismiss the `#btn-start` intro dialog,
reposition `window.wipfelkratzer.camera`/`controls` to frame the roof deck,
and screenshot from 2-3 angles.

verify: `page.on('pageerror', ...)` collected zero entries across the whole
run; screenshots show the seat/backrest resting on its legs/frame with no
visible gap (the defect this issue is about); no other on-roof item
(`pool`/`sonnenschirm`/`lampion`) or the deck itself changed visually.

## Task 3 — Regression pass on the rest of the roof + existing saves

Re-run the Task 2 script with a roof state that also includes `pool`,
`sonnenschirm`, and `lampion` alongside `liegestuhl`, and separately with a
`floors: 10` state to make sure nothing about `liegestuhl`'s new size clips
the roof railing or overlaps neighbors at typical placement.

verify: zero uncaught page errors; liegestuhl mesh doesn't visually clip
through the roof railing or overlap other placed roof items at their default
`cellPos` slots (`js/game.js:357-360`).
