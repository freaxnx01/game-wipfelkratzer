# Plan — Wand-Objekte erst nach Wandwahl platzieren (Issue #11)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0). Buildless vanilla:
`index.html` + `js/game.js` + `js/models.js`. three.js r184 via importmap. No
build step, no test framework.

Spec: `docs/superpowers/specs/2026-09-12-issue-11-wandobjekte-wandwahl.md`

## Global Constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`).
- **Buildless.** No new dependencies, no build step, no npm, no test runner.
  ES modules only.
- **Picture-book look is final-intent**: `MeshLambertMaterial` only, chunky
  low-poly primitives, warm desaturated palette. This issue changes only
  position/rotation of existing meshes, not materials/geometry.
- **Persistence backward compatible.** `localStorage` keys `wipfelkratzer-v1`
  and `wipfelkratzer-fotos` must keep loading. Existing saves have wall
  objects positioned against the back wall with no `wall` field — they must
  render identically until the implementer's own changes touch them.
- **Touch is first-class.** The player is a 10-year-old, often on a tablet.
- **Verification is headless Playwright** against a local
  `python3 -m http.server`. Zero uncaught page errors is part of every pass.

## Verification harness

Throwaway scripts go under
`.superpowers/sdd/2026-09-12-issue-11-wandobjekte-wandwahl/` (git-ignored).

- Serve with `python3 -m http.server <port>`, port in **8991–8995** (reserved
  for this issue's session — pick the first free one). Stop it by port when
  done: `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs kill` —
  never `pkill -f` with a pattern that could match the invoking command.
- Launch chromium with
  `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
- **Every `page.click` needs `timeout=20000` or more** — this game measures
  up to ~7s to register a click under software rendering.
- A `favicon.png` 404 is expected; assert on `pageerror` only.
- Reaching edit mode: click `#btn-start`, `#btn-build`, wait ~1.5s, then
  `page.mouse.click(640, 470)` (or the viewport-scaled equivalent) to select a
  floor and enter edit mode; `#catalog` opens automatically. `#btn-done`
  exits edit mode.
- Seeding `localStorage['wipfelkratzer-v1']` before load is much faster than
  building/decorating through the UI, and is required anyway to exercise the
  backward-compatibility checks (an old-shape entry with no `wall` field).
- The debug hook `window.wipfelkratzer` (`js/game.js:1048`) exposes
  `state`, `floorGroups`, `WALL_KEYS`, and a live `wallTarget` getter — use it
  to read/assert wall selection and entry state directly instead of only
  inferring from pixels.
- Selecting a wall: either click the new «Wand»-tab picker buttons, or
  `page.mouse.click` on a screen point that raycasts onto the target wall
  panel while in edit mode (back/left/right are visible while editing;
  `front` is not — use the picker button for `front`, never a 3D tap, per
  `js/game.js:529`).
- To read a wall item's live world transform for assertions, walk
  `floorGroups[k].children` (via `page.evaluate`) filtering on
  `userData.pick.entry.id` matching a `WALL_ITEMS` id, or simply read
  `state.rooms[k]` entries directly (`id`, `wall`, `x`, `y`, `z`, `rot`).

---

## Task 1 — Add a per-wall placement helper (geometry + rotation table)

**Problem.** `wallZ(k)` (`js/game.js:366`) only describes the back wall.
`clampEntry()` (`js/game.js:415-418`) and `addItem()`
(`js/game.js:585-589`) both hard-code it, and `clampEntry()` additionally
forces `rot = 0` for every wall item regardless of which wall it's on.

**Change.** In `js/game.js`, near the existing `wallZ` definition
(`js/game.js:366`), add a small table/helper that, given `(k, wallKey)`,
returns:
- the fixed-axis world coordinate (`z` for `back`/`front`, `x` for
  `left`/`right`), derived symmetrically from the existing panel geometry
  (`js/game.js:261-272`) — reuse the same constants that already position
  `back`'s panel (do not invent new numbers that could visibly shift the
  back wall's existing look);
- the facing rotation (`back=0`, `front=Math.PI`, `left=Math.PI/2`,
  `right=-Math.PI/2`);
- which axis (`x` or `z`) is the "along the wall" free axis, and its clamp
  half-range (mirroring the existing `hw = W(k)/2 - 0.55` bound, but using
  `D(k)` instead of `W(k)` for `left`/`right`).

No call sites are changed yet — this task only adds the helper, so it must
not alter any currently-rendered position (a quick manual check: `back`'s
computed plane/rotation must equal today's `wallZ(k)`/`rot=0` exactly).

**verify:** Headless script `page.evaluate`s the new helper (exposed
temporarily via `window.wipfelkratzer` or imported in an isolated ESM test
harness page) for `k=3` (arbitrary mid-tower floor) across all four
`WALL_KEYS`, and asserts: `back`'s fixed coordinate equals the existing
`wallZ(3)` value bit-for-bit; `front`'s fixed coordinate is the mirror
(`-back` value, since the room is symmetric about its centre); `left`/
`right` are symmetric about `0`; all four rotations match the table above.
Zero `pageerror` events.

---

## Task 2 — Route `clampEntry()` and `addItem()` through the helper, add `entry.wall`

**Problem.** `clampEntry()` (`js/game.js:415-418`) hard-codes `en.z =
wallZ(k); en.rot = 0`. `addItem()` (`js/game.js:585-589`) hard-codes
`entry.z = wallZ(k)` and computes its "spread out along the wall" `taken`/
`best` search purely in world-`x`, ignoring any other wall.

**Change.**
- `clampEntry()`: for `WALL_ITEMS` entries, read `en.wall || 'back'`, look up
  the Task 1 helper's plane/rotation/along-axis for that wall, clamp
  `en.x` (the "along" value, reused as-is per spec's A4 — for `left`/`right`
  this now means "offset along `z`") to the helper's half-range, set the
  fixed-axis world coordinate and `en.rot` from the helper, and set
  `m.position`/`m.rotation.y` accordingly (mapping `en.x`'s along-value onto
  whichever world axis is free for that wall).
- `addItem()`: for `WALL_ITEMS`, set `entry.wall = wallTarget === 'alle' ?
  'back' : wallTarget` before computing the initial position; use the Task 1
  helper (not hard-coded `wallZ`) for the initial fixed-axis coordinate; and
  filter the `taken`/`best`-spot search (`js/game.js:586-588`) to only
  consider existing entries on the **same** wall
  (`(e.wall || 'back') === entry.wall`).
- Do not touch `moveWallItem()` (`js/game.js:920-926`) or the keyboard
  handler (`js/game.js:932-939`) — both already operate on `en.x` and defer
  to `clampEntry()`, which now does the right thing per-wall.

**verify:** Headless script, per wall (`back`, `left`, `right`, `front`):
seed a fresh floor (or use a built one), `setWallTarget`/select that wall via
the picker (front via the Task 3 UI, others via 3D tap or picker), click a
`WALL_ITEMS` catalog entry (e.g. `uhr`), then read the resulting
`state.rooms[k]` entry back via `window.wipfelkratzer` and assert:
`entry.wall` equals the chosen wall; the mesh's world position lies on that
wall's fixed-axis plane (matching Task 1's helper for that `k`/wall); the
mesh's `rotation.y` equals that wall's facing rotation. Also place two items
on two different walls and assert neither's `taken`/spacing search was
influenced by the other (distinct `x` offsets are not forced apart across
walls). Zero `pageerror` events.

---

## Task 3 — Wall-picker row in the «Wand» catalog tab + selection toast

**Problem.** `renderCatalog()` (`js/game.js:480-516`) only shows the
wall-picker row (`js/game.js:489-503`) for `catTab === 'farbe'`. There is no
in-UI way to choose `front` for a wall object (it's invisible to 3D-tap while
its own floor is being edited, `js/game.js:529`), and no feedback when a
wall-tap sets `wallTarget` while the «Wand» tab is open (the `pointerup`
handler's `else` branch, `js/game.js:876`, does it silently).

**Change.**
- In `renderCatalog()`, add a branch for `catTab === 'wand'` that renders the
  same picker row as the `farbe` branch (`js/game.js:496-501`) but with only
  `WALL_KEYS.map(...)` (no `'alle'` entry), highlighting `wallTarget === 'alle'
  ? 'back' : wallTarget`, wired to the same `setWallTarget(key)`. Reuse the
  existing hint paragraph wording ("Welche Wand? Du kannst sie auch direkt
  antippen.") above it, matching `js/game.js:493-494`.
- In the `pointerup` handler (`js/game.js:871-877`), extend the tab check so
  that `catTab === 'wand'` also shows a short toast confirming the wall,
  e.g. `` toast(`Wand «${WALL_LABELS[wallKey]}» ausgewählt — jetzt ein
  Objekt antippen.`) `` (mirrors the existing `farbe`-tab toast text/shape at
  `js/game.js:875`) — the plain `else` branch keeps its silent behaviour for
  every other tab.
- Add a one-line toast when `front` becomes the active wall while `catTab
  === 'wand'` (from either the picker or a tap — though a tap can't reach
  `front` while editing that floor, the picker can), e.g. `` toast('Diese
  Wand siehst du erst richtig, wenn du fertig bist.') `` — addresses the
  spec's A6 floating-object consequence without changing the underlying
  visibility rule.

**verify:** Headless script opens the «Wand» tab in edit mode and asserts:
the picker row renders exactly 4 buttons (no "Alle Wände"); clicking each
button updates `window.wipfelkratzer.wallTarget` to match; the clicked
button carries the `.on` class and the other three don't; a 3D tap on a
visible wall while «Wand» is open produces a toast (`#toast` gets `.show`
with non-empty `textContent`) and updates `wallTarget`; selecting `front` via
the picker shows the floating-object hint toast. Zero `pageerror` events.

---

## Task 4 — End-to-end acceptance pass + backward-compat + screenshot evidence

**Problem.** Tasks 1–3 implement the mechanism; this task proves the spec's
full acceptance criteria together, including the backward-compatibility
guarantee that no earlier task individually exercises against a
pre-existing (old-shape) save.

**Change.** No further code changes expected unless this pass surfaces a
gap (fix here rather than opening a new task, matching the sibling
issue-16 plan's convention). Write and run one end-to-end Playwright script:

- Seed `localStorage['wipfelkratzer-v1']` with an old-shape save containing
  a `WALL_ITEMS` entry with **no** `wall` field (e.g. `{ id: 'uhr', cell: 0,
  x: 0.3, y: 1.2, z: -2.44, rot: 0 }` against some floor's back wall) plus at
  least one non-wall entry, and floors already built. Load the page and
  confirm the clock renders at its saved position/rotation, pixel-identical
  in spirit to pre-change behaviour (no jump), before any interaction.
- Enter edit mode on that floor, select the old-shape clock, nudge it with
  `moveWallItem` (a wall-pad arrow), and confirm it now carries `wall:
  'back'` in `state.rooms[k]` and stays on the back-wall plane.
- For a fresh item, place one `WALL_ITEMS` catalog entry on each of the four
  walls (`back`, `left`, `right`, `front`) in one floor, using the «Wand» tab
  picker from Task 3, and for each confirm: correct wall recorded, correct
  world plane, correct facing rotation, and (for `front`) that it's visible
  during edit despite the invisible front wall (per A6 — this is expected,
  not a bug) and reads correctly once `#btn-done` is clicked and the front
  wall reappears.
- Save (`save()` fires already via existing `addItem`/`moveWallItem` calls),
  reload the page fresh, and confirm all four freshly-placed items and the
  migrated old clock still render at their expected positions.
- Confirm `#btn-rot`/`#btn-move` stay hidden and `#wallpad` stays visible for
  a selected wall item on every one of the four walls (`js/game.js:572-575`
  unchanged).
- Capture one screenshot per wall (four total) showing the placed object
  correctly oriented against that wall, saved under the throwaway harness
  directory.
- Confirm zero `pageerror` events across the entire script.

**verify:** The script itself is the verification — it must complete with
all assertions passing, zero `pageerror` events, and all four screenshots
must exist and, on visual inspection, show each object flush against and
facing into the room from its intended wall.
