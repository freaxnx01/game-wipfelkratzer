# Plan: Dachpool zeigt sichtbares Wasser statt Deckel (Issue #12)

Spec: `docs/superpowers/specs/2026-09-12-issue-12-pool-wasser.md`

This is a **design/geometry task**, expected to run on the **Fable model**.
The tasks below describe the intended *look* precisely (shape, proportion,
colour, how the water should read); the exact modelling technique (which
primitives, how many segments, exact vertex layout for the kidney outline)
is left to the implementer's judgment within the constraints in the spec.

All changes are confined to `js/models.js` (`FURN.pool()`, roughly
`js/models.js:173-179` today). No other file should need edits.

---

## Task 1 — Rebuild the pool basin as an organic (kidney/bean) shape

Replace the current perfectly circular basin (`cyl(g, 0.68, 0.62, 0.4,
MAT.water, 0, 0.2, 0, 28)`) with an asymmetric outline: two overlapping
lobes of unequal size (e.g. a larger main body + a smaller "foot" lobe),
built either as two overlapping squashed cylinders/spheres or as a single
custom shape (a hand-authored point list through `THREE.Shape` +
`ExtrudeGeometry`, or a `LatheGeometry`/`BufferGeometry` composed from
primitive helpers already in the file — implementer's choice). Keep the
overall footprint within roughly the same bounding radius as today
(~0.6-0.75) so it doesn't require a placement/clamping change (spec A5).

Keep a visible rim/wall around the basin in `MAT.woodL` (or similar warm
wood tone) so the pool still reads as a built object, not a puddle.

**verify:** `node -e` a quick static check is not meaningful for three.js
geometry; verify visually via the headless screenshot flow in Task 5 —
confirm the outline is visibly non-circular (asymmetric silhouette) from
the default camera angle and from directly above (temporary top-down
screenshot is fine for review, doesn't need to ship).

## Task 2 — Recessed, wave-textured water surface

Remove the current flat single-colour "lid" disc (`cyl(g, 0.6, 0.6, 0.03,
L(0x7fc4dd), 0, 0.41, 0, 28)`). Replace with:
- A water fill following the new basin outline, sitting visibly **below**
  the rim's top edge (recessed, not flush) so the rim reads as a raised
  edge holding the water in.
- Base water colour close to the existing `MAT.water` (`0x5aa7c7`) or
  slightly deeper, to keep continuity with the river/water palette
  already established elsewhere in the scene (`docs/design-handoff.md:44`).
- 3-5 thin wave-line details across the surface in a lighter, still
  desaturated blue (family of the existing `0x7fc4dd`) — thin boxes,
  torus-arc segments, or slightly raised strips following the basin's
  curve, not straight across it (per spec A3).

Do not use a `CanvasTexture` for this — keep it geometric, consistent with
how every other furniture piece in `FURN` is built (spec A3).

**verify:** screenshot review (Task 5) shows a visibly blue, non-flat,
non-lid-like water surface with legible wave detail; no new canvas/texture
code introduced in `models.js` for this item.

## Task 3 — Frogs sitting in the water

Add 1-2 small, simplified frog shapes (reuse `MAT.leaf`/`MAT.leafD` or a
frog-toned colour already in the palette) positioned at/just above the
water surface, inline within `pool()` — do not call `makeAnimal('frosch')`
(spec A4: that rig is sized/built for tenant characters and is overkill
for decoration). Keep them simple: e.g. a squashed sphere body + two small
eye bumps, low poly, matching the chunky picture-book style of the rest of
the file.

**verify:** screenshot review shows 1-2 frog-like shapes visible in the
pool; visual style (flat-shaded, chunky, no fine detail) matches
neighbouring builders like `sonnenschirm()`/`lampion()`.

## Task 4 — Keep the ladder, re-anchor to the new outline

The existing ladder block (`js/models.js:176-178`) stays functionally
as-is (rails + 3 rungs, `MAT.grey`), but its anchor position
(`lad.position.set(0.62, 0, 0)`) must be re-checked against the new,
non-circular outline so it still sits flush at the rim rather than
floating off the edge or clipping into the basin. Adjust the offset only
as needed to match the new shape.

**verify:** screenshot review shows the ladder still attached at the rim,
touching the pool wall, on the new asymmetric shape.

## Task 5 — Headless verification pass

Serve the repo statically on a port in **8941-8945**, drive it with
Playwright/chromium (`args=["--use-gl=swiftshader",
"--enable-unsafe-swiftshader"]`, `page.click` timeout ≥ 20000ms), and
confirm:

1. Fresh load, no saved state: intro → "Los geht's!" → build to 10 floors
   → open roof (`enterEdit('roof')`) → open "Dach" tab → place `Pool` →
   confirm it renders, is selectable, movable (arrow keys / Verschieben),
   rotatable (Drehen), deletable — zero uncaught page errors.
2. Placing the pool fires the frog tenant's wish fulfilment (+3
   Haselnüsse toast, `sfx.splash()` — audio call is fine to just confirm
   doesn't throw, no need to assert actual sound).
3. **Backward-compatibility check**: seed `localStorage` (
   `wipfelkratzer-v1`) before load with a `state.rooms.roof` entry like
   `{ id: 'pool', x: <value inside old bounds>, z: <value>, y: 0.155,
   rot: 0 }` (or via the app's existing legacy-cell migration path) to
   simulate a pre-change save, reload the page, and confirm the pool
   still renders at that position without clipping the roof railing and
   without console errors.
4. Take one in-scene screenshot of the roof with the pool placed for
   visual sign-off against the book reference
   (`docs/ai-notes/feedback/assets/2026-09-12-test-mit-tochter/entry-04-buchseite-ausschnitt.png`).

Stop the server by port (`ss -lptn 'sport = :<port>' | grep -oP
'pid=\K[0-9]+' | xargs kill`) — never `pkill -f` matching the serving
command line, since other agents may be serving on adjacent ports
concurrently.

**verify:** Playwright run reports zero uncaught page errors across all
three flows above; screenshot manually reviewed against the book
reference for shape/colour/wave/frog fidelity.

---

## Out of scope (reminder)

- No catalog/id/schema changes — `pool` stays `pool`.
- No changes to `js/game.js` placement, clamping, wish, or persistence
  logic — this is a pure `FURN.pool()` geometry rebuild.
- The Terrassenhäuschen (roof house) idea from the same book page is a
  separate, not-yet-filed backlog item (worklog entry 25) — do not fold
  it into this task.
