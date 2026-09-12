# Spec: Dachpool zeigt sichtbares Wasser statt Deckel (Issue #12)

## Problem

The rooftop pool (`pool()` in `js/models.js:173-179`) reads as a covered
container, not a swimming pool with visible water. Player feedback ("Dach:
pool hat Deckel kein wasser sichtbar") and the referenced picture-book page
both point at the same gap: the book shows an organic kidney-shaped pool,
clearly blue water, wave lines on the surface, a ladder at the rim, and
frogs swimming in it. The in-game model is a perfect circle, has no wave
detail, no frog-in-water read, and its lighter-blue top disc sits flush with
(and the same shape as) the darker "wall" cylinder beneath it — which is
exactly what reads as a lid rather than a liquid surface to a 10-year-old.

Current geometry (`js/models.js:173-179`):
```js
pool() { const g = G();
  cyl(g, 0.68, 0.62, 0.4, MAT.water, 0, 0.2, 0, 28); cyl(g, 0.6, 0.6, 0.03, L(0x7fc4dd), 0, 0.41, 0, 28);
  cyl(g, 0.71, 0.71, 0.06, MAT.woodL, 0, 0.42, 0, 28);
  const lad = G(); g.add(lad); lad.position.set(0.62, 0, 0);
  [-0.09, 0.09].forEach(z => cyl(lad, 0.022, 0.022, 0.75, MAT.grey, 0.05, 0.38, z));
  for (let i = 0; i < 3; i++) box(lad, 0.03, 0.03, 0.18, MAT.grey, 0.05, 0.18 + i * 0.2, 0);
  return g; },
```
This is a round basin (radius ~0.68), tapered walls (`MAT.water`, a mid
saturation blue `0x5aa7c7`), a flat lighter-blue disc on top (`0x7fc4dd`,
0.03 thick) standing for "water", a wooden rim ring, and a ladder — already
present, already roughly matching the book's ladder. The problems are
shape (circle vs. kidney), surface treatment (flat single-colour disc vs.
visible waves), and the missing frogs-in-water read.

## Target look (from the book page)

Referenced image: `docs/ai-notes/feedback/assets/2026-09-12-test-mit-tochter/entry-04-buchseite-ausschnitt.png` (embedded in issue #12).

- **Organic kidney/bean shape**, not a circle — asymmetric, rounded lobes.
- **Visible blue water** as the dominant read: a clearly blue, slightly
  darker-than-rim fill that sits *recessed* below the pool's rim, so it
  reads as a basin holding liquid, not a solid disc capping a drum.
- **Wave lines** on the water surface — light-coloured squiggles/ripples
  breaking up the flat blue so it doesn't read as a lid.
- **A ladder** at the rim (already implemented; keep, reuse).
- **Frogs swimming in it** — decorative, non-interactive geometry inside
  the pool (the tenant frogs on floor 10 are a separate, already-placed
  tenant group; this is atmosphere, not a duplicate of them).

## Constraints (inherited, non-negotiable)

- Buildless: no new npm deps, no build step. Everything is procedural
  three.js geometry added to `js/models.js`, same pattern as neighbouring
  builders (`pool()`, `sonnenschirm()`, `lampion()`).
- Picture-book material rule: `MeshLambertMaterial` only (the shared `L()`
  helper at `js/models.js:3`), no PBR, no imported meshes. Chunky low-poly
  primitives only (boxes, spheres, cylinders — `mesh`/`box`/`cyl`/`sph`
  helpers at `js/models.js:14-21`).
- Warm, desaturated palette; no pure black (`0x000000`) or pure white
  (`0xffffff`) — existing palette already respects this (`MAT.water
  0x5aa7c7`, lighter wave tone should stay in the same family, e.g. the
  existing `0x7fc4dd`).
- `localStorage` backward compatibility (`wipfelkratzer-v1`): existing
  saves may contain `{ id: 'pool', cell/x, z, y, rot }` entries in
  `state.rooms.roof`. The rebuilt `pool()` must accept the same placement
  contract as today — same catalog id (`'pool'`), same call signature
  `makeFurniture('pool')` (`js/models.js` `FURN` map, referenced from
  `js/game.js`), and a bounding box similar enough in scale that an
  existing saved `x/z/rot` still sits within the roof deck
  (`ROOF_W = 6.6`, `ROOF_D = 4.8`, `js/game.js:12`) and doesn't clip the
  roof railing after `clampEntry()` re-runs on load. No save migration
  code is needed — this is a pure model-geometry change, not a schema
  change.
- Touch-first: unaffected by this change (placement/selection/rotation
  logic in `js/game.js` — `clampEntry`, `surfaceYAt`, arrow-key movement,
  `Drehen`/`Verschieben` buttons — is generic bounding-box code and does
  not need to change; a kidney shape still gets a valid `Box3`).
- Verification: headless Playwright, zero uncaught page errors.

## Non-goals

- The "Terrassenhäuschen" (roof house) from the same book page is a
  **separate, not-yet-filed idea** (worklog entry 25) — out of scope here.
- No new catalog item, no new tenant wish, no new SFX beyond the existing
  `sfx.splash()` already fired on pool placement (`js/game.js:644`).
- No change to `state.fulfilled`/wish-check logic (`checkWishes`,
  `js/game.js:636-646`) — the frog tenant's wish is still satisfied by
  placing catalog id `'pool'` on the roof, unchanged.
- Not reworking the ladder — it already matches the book reasonably well
  and reuse is explicitly fine per constraints.

## Decisions (Quick mode)

- **A1** [high] Rebuild `pool()` entirely within `js/models.js`'s existing
  `FURN.pool()` function — same catalog id `'pool'`, same export path.
  Rejected: a new catalog item (e.g. `'pool_v2'`) — would orphan existing
  saves that already reference `id: 'pool'` and break the frog tenant's
  wish check (`t.wish === 'pool'` in `js/game.js:641`), which matches on
  the literal id string. `js/models.js:196-215` (`CATALOG`) shows `pool`
  is the only roof-water id; nothing else depends on its shape.

- **A2** [med] Kidney/organic shape is approximated as an overlapping pair
  of squashed low-poly cylinders (or a lathed/extruded blob built from the
  existing primitive helpers) rather than a true `THREE.Shape` +
  `ExtrudeGeometry` outline. Left to the implementer (Fable) to choose the
  simplest construction that (a) stays within `mesh`/`box`/`cyl`/`sph`-style
  primitive composition or a single custom `BufferGeometry`/`ExtrudeGeometry`
  built from a hand-authored point list, and (b) reads as asymmetric/organic
  from the default camera angle (`(13, 9.2, 18)` looking at `(0, 5.0, 0)`,
  `docs/design-handoff.md:40`). Rejected: keeping the circle and only fixing
  the water-surface material — issue text and book reference explicitly
  call out the shape ("organische Nierenform") as part of the ask, not
  just the water visibility.

- **A3** [med] Water surface = a **recessed, slightly darker fill** (kept
  close to `MAT.water 0x5aa7c7`) sitting *below* the rim height, with 3-5
  thin, lighter-blue (`~0x9ccfe4` family, still desaturated, no white)
  raised or inset strips/arcs across it standing in for wave lines — built
  as slim boxes or torus-arc segments, not a texture (no new canvas
  texture system is needed for one shape; canvas patterns are reserved for
  wallpaper/flooring per `docs/design-handoff.md:236`). Rejected: a
  `CanvasTexture` for waves — technically fine (canvas patterns already
  exist for walls/floors) but heavier than needed for a static decorative
  detail, and harder for Fable to iterate on visually without a render
  loop preview.

- **A4** [med] Frogs-in-pool are 1-2 small, simplified frog-coloured blobs
  (reusing `MAT.leaf`/`MAT.leafD` or the existing `frosch` species colour
  from `SPECIES` if convenient) sitting at/just above the water surface,
  built inline in `pool()` — not a call to `makeAnimal('frosch')` (that
  builder is sized/rigged for a full tenant character with legs/animation
  hooks and would be visually oversized and overbuilt for a decorative
  pool detail). Rejected: reusing `makeAnimal('frosch')` verbatim — adds
  unnecessary polycount/weight to every pool instance and couples pool
  decoration to the tenant-animal rig.

- **A5** [high] Footprint stays roughly circle-equivalent, radius ~0.6-0.75
  (matching today's `0.68`/`0.71`), so that on load, previously-saved
  `x/z/rot` values for a placed pool still clear `clampEntry()`'s roof
  bounds (`limX = ROOF_W/2 - 0.1`, `limZ = ROOF_D/2 - 0.1`,
  `js/game.js:419-420`) without needing any coordinate migration.
  Rejected: a notably larger pool to sell the "bigger, more visible water"
  feeling — risks existing saves clipping the roof railing after reload;
  not worth a migration for a visual-only fix.

- ⛔ **Blocked (none).** No one-way-door decisions identified — this is a
  self-contained geometry rebuild of one `FURN` entry with no schema or
  API surface change.

## Acceptance criteria

1. On the roof catalog tab ("Dach"), the Pool item's rendered thumbnail
   and in-scene model show an asymmetric, organic (kidney/bean-like)
   outline — not a perfect circle.
2. The pool's water is clearly legible as **liquid**: a blue fill visibly
   recessed below the rim, with wave-line detail breaking up the surface
   (not a single flat disc).
3. 1-2 small frog shapes are visible sitting in/on the water.
4. The existing ladder remains at the rim.
5. All new geometry uses only `MeshLambertMaterial` (via the shared `L()`
   helper) — no PBR materials, no imported meshes, palette stays within
   the existing warm/desaturated blue family (no pure black/white).
6. A save file created before this change, containing a placed roof
   `pool` entry, still loads without error and the pool still renders,
   selectable/movable/deletable exactly as before (no placement-code
   changes required, but verify none regressed).
7. Placing a new pool from the catalog still fulfils the floor-10 frog
   tenant's wish (`+3 Haselnüsse`, `sfx.splash()`) exactly as before.
8. Headless Playwright pass: zero uncaught page errors across intro →
   build to 10 floors → open roof → place pool → reload with a
   pre-existing saved pool.
