# Plan — Einrichten verbessern (Issues #1–#5)

Repo: `game-wipfelkratzer`. Branch: `feat/einrichten-verbessern`.
Buildless vanilla: `index.html` + `js/game.js` (858 lines) + `js/models.js` (431 lines).
No build step, no test framework, no bundler. three.js r184 via importmap.

## Context

This game came from a Claude Design handoff and is now maintained here. Five
issues from the owner, all in the "Einrichten" (furnishing) area plus the
external staircase.

## Global Constraints

- **German UI throughout.** Every user-visible string is German (Swiss spelling:
  `ss` not `ß`). Existing copy uses «…» guillemets for quoted item names.
- **Buildless.** No new dependencies, no build step, no npm. ES modules only,
  loaded from `index.html`'s importmap. Do not add a bundler or a test runner.
- **Picture-book look is final-intent** (`docs/design-handoff.md`, "Fidelity"):
  `MeshLambertMaterial` only, no PBR, no metalness/roughness, chunky low-poly
  primitives, warm desaturated palette, no pure black/white. Any new geometry
  obeys this.
- **Persistence must stay backward compatible.** State lives in `localStorage`
  under `wipfelkratzer-v1` (game) and `wipfelkratzer-fotos` (gallery). Existing
  saves must keep working — migrate old shapes on load, never throw on them.
- **Touch is a first-class input.** The target player is a 10-year-old, often on
  a tablet. Any interaction that exists only as a keyboard shortcut must also
  have an on-screen control.
- **Verification is headless Playwright** against a local
  `python3 -m http.server` — there is no unit-test suite. Every task proves its
  change with a scripted browser run that asserts on real state
  (`localStorage`, object positions read via `page.evaluate`), plus a screenshot
  where the change is visual. Zero uncaught page errors is part of every pass.

## Verification harness

Each task writes its check as a throwaway script under
`.superpowers/sdd/2026-09-11-einrichten-verbessern/` (git-ignored scratch), runs
it, and pastes the output into its report. Pattern:

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:PORT/", wait_until="networkidle"); pg.wait_for_timeout(2500)
    pg.click("#btn-start", timeout=20000)       # NOTE: 20s, not the default 5s
    ...
    assert not errs, errs
```

**Click timeouts must be ≥20 s.** Playwright's actionability check runs on the
page's rAF loop; under headless software rendering this game needs up to 7 s to
click a plainly visible button. The default 5 s fails spuriously.

Entering edit mode from a script: build a floor, then `pg.mouse.click(640, 470)`
lands on the tower. Assert `#editbar` has class `on` and read `#edit-title`.

---

## Task 1 — Fix the `wallZ` shadowing bug (issue #2 root cause)

**Problem.** `js/game.js:253` declares `const wallZ` inside `clampEntry()`,
shadowing the module-level helper `const wallZ = k => -D(k) / 2 + 0.125`
(`js/game.js:222`) across the entire function body. The wall-item branch at
line 250 calls `wallZ(k)` before that local initialiser runs, so it throws:

```
Uncaught ReferenceError: Cannot access 'wallZ' before initialization
```

Every click on Waldbild / Mondposter / Willi-Poster / Wanduhr / Spiegel /
Fenster in the «Wand» catalog tab aborts inside `addItem()` → the item is never
added, never saved, never rendered. Confirmed headless.

**Change.** Rename the two local limit constants in `clampEntry()` so they stop
shadowing module scope — `wallX` → `limX`, `wallZ` → `limZ` (or equally clear
names) — and update their three uses in the same function. Do not touch the
module-level `wallZ` helper or the wall-item branch's logic.

**Acceptance.**
- Adding each of the six `WALL_ITEMS` ids succeeds with no page error.
- After adding a poster, `localStorage['wipfelkratzer-v1'].rooms[k]` contains an
  entry with that id and a defined `x`, `y`, `z`.
- Its `z` equals `-D(k)/2 + 0.125` for that floor.
- Normal furniture placement and wall clamping still behave (add a `bett`, nudge
  it into a wall with ArrowUp × 10, assert it stops short of `D(k)/2`).

---

## Task 2 — On-screen x/y controls for wall objects (issue #2)

Depends on Task 1.

**Problem.** Once placeable, wall objects *can* be nudged with the arrow keys —
the `keydown` handler already has a `WALL_ITEMS` branch mapping Left/Right to
`en.x` and Up/Down to `en.y`. But the selection bar's buttons are dead for them:
`#btn-move` ("Verschieben") and `#btn-rot` ("Drehen") both `return` early when
`WALL_ITEMS.has(selected.entry.id)`. On a tablet there is no keyboard, so wall
objects cannot be moved at all.

**Change.** When the selected item is a wall object, the selection bar shows
controls that actually move it in the wall plane (x = along the wall,
y = height), and it keeps working for normal furniture as it does today.

Design freedom on the exact control shape, within these bounds:
- Four directions must be reachable by touch (←, →, ↑, ↓ or equivalent).
- The step matches the keyboard's `0.12`.
- Every move goes through `clampEntry()` so the existing wall limits hold, then
  updates `selHelper`, plays `sfx.pop()` (or stays silent — do not add a new
  sound), and calls `save()`.
- Rotation stays disabled for wall objects (`clampEntry` forces `rot = 0`); if
  the Drehen button is meaningless here, hide it rather than leaving it inert.
- Labels in German.

**Acceptance.**
- With a poster selected, tapping the on-screen controls changes `entry.x` /
  `entry.y` in `localStorage` and moves the mesh — asserted by reading state
  before/after via `page.evaluate`, with no keyboard events sent.
- Clamping holds: pressing one direction ~20 times parks the value at the limit
  instead of flying off the wall.
- With normal furniture selected, "Verschieben" still jumps to the next free
  cell and "Drehen" still rotates 90°.
- Screenshot showing a poster moved to a visibly different spot on the wall.

---

## Task 3 — Download photos from the gallery (issue #1)

**Problem.** `takePhoto()` (`js/game.js:781`) stores a JPEG data URL per photo in
`photos[]` and `renderGallery()` renders each with a comment textarea and a
Löschen button. There is no way to get a photo out of the browser.

**Change.** Give each photo in the gallery a download control that saves the
image as a file.

- Filename pattern: `wipfelkratzer-<YYYY-MM-DD>-<HHMM>.jpg`, derived from the
  photo's own `t` timestamp (the photos are JPEG — `toDataURL('image/jpeg', …)`
  — so the extension is `.jpg`, not `.png`).
- Two photos taken in the same minute must not collide; disambiguate.
- German label.
- The existing Löschen button and comment textarea keep working; the comment is
  not part of the downloaded file.

**Acceptance.**
- Take two photos, open the gallery, trigger the download control on each;
  Playwright's `expect_download` yields two downloads with distinct
  `suggested_filename`s matching the pattern and non-zero bytes.
- The saved bytes start with the JPEG magic number `FF D8 FF`.
- Deleting a photo still removes it from the grid and from `localStorage`.

---

## Task 4 — Per-wall wallpaper, inside only, removable (issues #4 and #5)

**Problem, in three parts.**

1. **Per floor, not per wall.** `state.wallpaper[k]` is one id for the whole
   apartment. `applyLook()` (`js/game.js:224`) pushes it into a single shared
   `g.userData.wallMat`.
2. **It leaks outside.** Each structural wall is one `BoxGeometry` with one
   material, so a texture on the back wall renders on the tower's *outer* face
   too. The owner: "Es sollen nur die Innenwände ändern, nicht aussen."
   Note also that the right-hand side wall is built with the shared global
   `MAT.plaster` (`js/game.js:150`) while the left uses `wallMat`, so today the
   right wall never takes wallpaper at all — the same fix covers this.
3. **Not removable.** `setLook()` only ever assigns an id. `applyLook()` already
   handles a falsy value correctly (`map = null`, colour back to the base), so
   the model supports removal — the UI never offers it.

**Change.**

- **Inner surfaces become their own thin panels.** Add, per floor group, an
  inner panel just inside each of the four walls (back, left, right, front),
  each with its own `MeshLambertMaterial`. The structural wall boxes keep the
  untextured plaster materials so the exterior is never affected. Offset the
  panels enough to avoid z-fighting and keep them clear of `wallZ(k)`
  (`-D(k)/2 + 0.125`), where wall objects sit.
- **State becomes per wall.** `state.wallpaper[k]` becomes an object keyed by
  wall (`back` / `left` / `right` / `front`, or your own stable keys). **Migrate
  a legacy string value on load** to "all four walls get that id" — old saves
  must not break or throw.
- **Selecting a wall.** In edit mode the player picks which wall they are
  papering, by tapping the wall in the 3D scene *and* from the «Tapete» tab —
  both must work, since the front wall is hidden in edit mode and cannot be
  tapped. Show clearly which wall is active. Keep an "alle Wände" option: it is
  the fastest path for a kid and preserves today's behaviour.
  Tapping a wall must not fight with tapping furniture — furniture wins.
- **Removal.** The «Tapete» and «Boden» tabs each get a remove entry
  («Entfernen», German) that sets the value back to none for the active target
  and restores the base look. This is issue #5 for the floor and the last part
  of #4 for the walls.
- `state.flooring[k]` stays per floor — only its removal is in scope.

**Acceptance.**
- A fresh save: paper only the back wall; `localStorage` shows the per-wall
  shape, and only that wall's material carries a map (assert via
  `page.evaluate` over the floor group's materials).
- The tower's exterior material is unchanged after papering — assert the outer
  wall meshes' materials have `map === null`.
- "Alle Wände" sets all four; «Entfernen» clears the active target back to the
  base colour with `map === null`.
- Floor covering: set one, then «Entfernen» → `state.flooring[k]` falsy and the
  floor material's `map === null`.
- **Legacy migration:** seed `localStorage` with a pre-change save whose
  `wallpaper` is `{"1": "streifen"}`, load the page, and assert no page error
  and all four walls of floor 1 show the `streifen` texture.
- Screenshot in cutaway mode showing two different wallpapers on two walls of
  one apartment, with the outside plain.

---

## Task 5 — Connect doors and the external staircase (issue #3)

**Problem.** `js/game.js:163–186` builds, for each floor `i > 0`, a door on the
front wall at `dx = ((nw - 1) / 2) * (w / (nw + 0.6))` and a staircase group
added to *that floor's* group `g`. Three things break the chain:

1. **Per-floor jitter is ignored.** Every floor carries its own random offset
   and rotation (`g.position.x = (rnd(i) - 0.5) * 0.12`,
   `g.rotation.y = (rnd(i + 20) - 0.5) * 0.05`, `js/game.js:141–142`). The
   flight for floor `i` is parented to floor `i`, but its foot has to meet floor
   `i - 1`'s landing — which carries a *different* offset and rotation. The two
   ends drift apart.
2. **The flight does not meet the landing.** The treads run from `z = -dl/2` to
   `z = +dl/2` at `sx = W(i-1)/2 + 0.5`, while the landing sits at
   `z = D(i)/2 + 0.5`. Nothing spans the gap between the top tread and the
   landing, so the flights hang in mid-air (visible in the hub screenshot).
3. **The landing does not reach the door.** The landing spans from about
   `W(i)/2 - 0.3` outward to `sx + 0.5`, but the door is at `dx`, which is
   inboard of `W(i)/2`. A player would step out of the door onto nothing.

**Change.** Rebuild the external staircase so it is one continuous, plausibly
walkable chain: *door → landing → flight → landing → door*, for every built
floor, and so it stays correct under the per-floor jitter.

- Derive every position from the **actual door position and floor height** of
  the floors involved, not from re-guessed constants. The ground floor (`i = 0`)
  has its arch at the centre front and needs a landing too, so the chain has a
  bottom.
- Parenting is your call, but the geometry must be computed in a single common
  frame so that floor `i`'s jitter and floor `i - 1`'s jitter are both accounted
  for. Attaching the staircase to `towerG` and transforming the two door
  positions into that frame is the straightforward route.
- Landings sit at their floor's threshold height, directly in front of their own
  door, wide enough to stand on, and touch both the door and the flight.
- Treads climb from the lower landing to the upper one with no vertical gap at
  either end; the handrail follows the flight's real slope.
- Keep the existing look: `MAT.woodL` treads, `MAT.woodD` rails/posts, chunky
  primitives.
- **Visibility must keep tracking the floors.** Today `g.userData.stairs` rides
  along because it is a child of the floor group. Whatever parenting you choose,
  a floor's stairs must be hidden when that floor is hidden — unbuilt floors,
  floors above the one being edited, and the roof-edit case
  (`enterEdit` / `exitEdit`, `js/game.js:345–376`) — and must appear as floors
  are built (`buildFloor`, `js/game.js:472`).

**Acceptance.**
- Build all 10 floors. For each `i` in 1..10, assert in-page that the top of
  floor `i - 1`'s flight and floor `i`'s landing meet within a small tolerance
  (compute world-space bounding boxes via `page.evaluate` and compare), and that
  each landing's bounding box overlaps its own door's x position.
- No flight has a vertical gap greater than one tread thickness at either end.
- Build 3 floors, enter edit mode on floor 2: floor 3's stairs are hidden along
  with floor 3; exit edit → visible again.
- Reload with 10 floors from `localStorage`: the chain is still connected (i.e.
  the build is deterministic, not dependent on build order).
- Screenshots: full tower from the front, and one close-up of a door/landing
  junction.

---

## Out of scope

Everything not listed above. Discoveries go in `TODO.md` or a new issue, not
into this branch.
