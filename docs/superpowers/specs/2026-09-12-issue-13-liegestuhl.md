# Spec: Liegestuhl-Modell überarbeiten (Issue #13)

## Problem

Issue #13 says only "Liegestuhl sieht komisch aus" — not actionable on its own.
This spec makes the defect concrete.

`FURN.liegestuhl()` (`js/models.js:180-184`):

```js
liegestuhl() { const g = G();
  const s = G(); g.add(s); s.position.y = 0.3; s.rotation.x = -0.5;
  for (let i = 0; i < 5; i++) box(s, 0.5, 0.03, 0.16, i % 2 ? MAT.white : MAT.red, 0, 0, -0.34 + i * 0.17);
  [-0.24, 0.24].forEach(x => { box(g, 0.04, 0.3, 0.04, MAT.wood, x, 0.15, 0.25); box(g, 0.04, 0.42, 0.04, MAT.wood, x, 0.21, -0.2); });
  return g; },
```

Confirmed by headless screenshot (roof deck, 3rd-person camera, item seeded via
`localStorage` — see A5): the result reads as a **candy-striped plank balanced on
four disconnected toothpick legs**, not a deck chair. Two independent defects:

1. **Seat/back plank floats disconnected from the legs.** The 5 slats form one flat
   board, tilted `-0.5 rad` (~28.6°) as a rigid group at `y = 0.3`. Rotating a flat
   plank about x through that pivot puts its back end (`z=-0.34`) at world
   `y ≈ 0.137` and its front end (`z=+0.34`) at world `y ≈ 0.463`. The front legs
   (top at `y=0.30`) and back legs (top at `y=0.42`) don't reach those heights —
   front-leg tops sit *below* the (higher) front plank edge, back-leg tops sit
   *above* the (lower) back plank edge. The plank visibly hovers past both leg
   pairs instead of resting on them. Screenshot: plank clearly floats above/past
   the four legs, which read as separate stakes stuck in the deck.
2. **No recognizable chair silhouette.** Four thin vertical dowels (no rake, no
   diagonal cross-brace, no side-frame) plus one uniformly-tilted flat plank gives
   no seat/backrest distinction and no wooden armrest/frame — the classic cues a
   child uses to read "deck chair" (bent seat-to-back profile, a wooden side
   frame the fabric hangs in, splayed/raked legs). The silhouette instead reads as
   a seesaw plank or a plank balanced on sticks.

The red/white alternating slat coloring itself is fine (recognizable
deck-chair-fabric convention, consistent with the picture-book palette) and is
kept.

## Goal

Redesign `FURN.liegestuhl()` so a child recognizes it instantly as a deck chair,
in the same picture-book style as the rest of the room (`js/models.js:1-21` for
material/primitive helpers).

## Requirements

- **Silhouette:** seat and backrest read as two distinct planes joined at a bend
  (like a chaise-longue/steamer chair), not one uniformly-tilted flat board —
  near-horizontal seat, steeper-angled backrest.
- **Legs must visually touch the seat/back.** Whatever leg/frame shape is chosen,
  its top point(s) must coincide (in world space, after any group rotation) with
  the seat-front and backrest-top edges — no floating gap, no plank ends past the
  leg tops. This is the concrete, checkable form of "recognizable chair": build
  the frame first (or compute its top points), then place the seat ends exactly
  there — don't rotate a flat plank independently of straight vertical legs again.
  A wooden side-frame silhouette (or a raked/splayed leg pair, or a diagonal
  cross-brace) reads better than plain vertical dowels and is preferred, but the
  exact technique is left to the implementer.
- **Materials:** `MeshLambertMaterial` only, via the existing `MAT` palette
  (`js/models.js:4-12`) — no new colors needed; reuse `MAT.wood`/`MAT.woodD` for
  frame, keep the existing red/white slat stripe convention for the seat fabric.
- **Primitives:** boxes/cylinders only (`box`/`cyl`/`sph` helpers,
  `js/models.js:18-20`), chunky/low-poly, consistent with neighboring `dach`
  models (`pool`, `sonnenschirm`, `lampion`, `js/models.js:173-193`).
  No imported meshes.
- **Scale:** keep roughly the current footprint (~0.5 wide, ~0.7 deep incl. any
  raked legs, ~0.45 tall) so it doesn't visually overwhelm the roof deck grid;
  `clampEntry` (`js/game.js:402-410`) derives placement bounds from the mesh's
  actual bounding box at runtime, so there's no hardcoded size to match, but a
  much larger chair would look out of scale next to `pool`/`sonnenschirm`.
- **Touch-first:** no interaction changes — this is a static decorative mesh,
  same as today; existing tap/drag placement code in `js/game.js` is untouched.

## Non-goals

- No changes to `addItem`/`placeItemMesh`/`clampEntry`/catalog wiring
  (`js/game.js`) — only the mesh geometry inside `FURN.liegestuhl()`.
- No animation, no new material colors, no new catalog entry.

## Backward compatibility

**No migration needed.** A placed `liegestuhl` is persisted in
`state.rooms[k]` as `{ id, cell, x, z, y, rot }` only (`js/game.js:583,
591-598`) — no geometry or bounding-box data is saved. `placeItemMesh`
(`js/game.js:427`) rebuilds the mesh from `FURN.liegestuhl()` fresh on every
load, so an existing save with a placed `liegestuhl` will simply render the new
model at its already-stored `x`/`z`/`y`/`rot` — no save-format change, no
migration script.

## Decisions

- **A1** [high] Root cause of "sieht komisch aus" = the tilted seat plank and the
  straight vertical legs are geometrically disconnected (plank corners land
  outside the legs' height range). Confirmed via the rotation math above and via
  a live headless screenshot of the placed item on the roof deck.
  `js/models.js:180-184`.

- **A2** [med] Redesign as a two-segment seat+backrest (bent chaise) rather than
  keeping a single flat tilted board. Rejected: fixing only the leg-height
  mismatch while keeping one uniformly-tilted plank — a constant-angle board
  still reads as a ramp/seesaw, not a chair, regardless of whether the legs
  technically touch it.

- **A3** [med] Replace the 4 disconnected straight dowel legs with a support
  shape (raked/splayed legs, a diagonal cross-brace, or a simple side-frame
  silhouette per side) whose top points are placed to exactly meet the seat/back
  ends. Rejected: keeping plain straight vertical dowels — that was half of what
  produced the "toothpick legs" read in the screenshot.

- **A4** [low] Keep the existing red/white alternating slat coloring for the
  seat fabric — it's already a working, recognizable deck-chair-fabric
  convention and doesn't need to change; only the geometry/proportions do.

- **A5** [high] No `localStorage` migration required — verified `state.rooms`
  entries only store `{id, cell, x, z, y, rot}`, not mesh geometry
  (`js/game.js:583, 591-598`); `placeItemMesh` rebuilds from `FURN.liegestuhl()`
  on every load (`js/game.js:427`).

- **A6** [med] Target footprint stays close to today's (~0.5w × 0.7d × 0.45h)
  since `clampEntry` derives placement bounds from the actual runtime bounding
  box (`js/game.js:402-410`) rather than a fixed constant — a much bigger chair
  is not blocked by code, but would look oversized next to `pool` (`js/models.js
  :173-179`) and `sonnenschirm` (`js/models.js:185-188`) on the same roof deck.

No `⛔ Blocked` items — this is a self-contained mesh rewrite behind a stable,
already-verified data schema; no one-way-door decisions were required.

## Verification

- Headless Playwright: seed `localStorage['wipfelkratzer-v1']` with a roof
  `liegestuhl` entry, load `index.html`, screenshot the roof deck from a few
  angles — zero uncaught page errors (`page.on('pageerror')`), and visually the
  seat/back rests on its legs/frame with no floating gap.
- Manual/visual check against the "10-year-old recognizes it instantly" bar —
  compare screenshot before/after.
