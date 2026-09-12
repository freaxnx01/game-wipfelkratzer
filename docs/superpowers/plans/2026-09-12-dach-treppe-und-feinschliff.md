# Plan — Dachtreppe und Feinschliff (Issues #6–#9)

Repo: `game-wipfelkratzer`. Branch: `feat/dach-treppe-und-feinschliff`. Base: `a8c335f` (v0.2.0).
Buildless vanilla: `index.html` + `js/game.js` + `js/models.js`. three.js r184 via importmap.
No build step, no test framework.

## Context

v0.2.0 closed issues #1–#5. These four are its leftovers: one real player-facing
gap (the roof terrace is reachable by nothing) and three small ones that the
v0.2.0 reviews raised and deferred.

## Global Constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`), «…» guillemets for
  quoted item names.
- **Buildless.** No new dependencies, no build step, no npm. ES modules only.
  Do not add a bundler or a test runner.
- **Picture-book look is final-intent** (`docs/design-handoff.md`, "Fidelity"):
  `MeshLambertMaterial` only, chunky low-poly primitives, warm desaturated
  palette, no pure black or white. New geometry uses the staircase's existing
  vocabulary — `MAT.woodL` treads/decks, `MAT.woodD` rails and posts.
- **Persistence backward compatible.** `localStorage` keys `wipfelkratzer-v1`
  and `wipfelkratzer-fotos`. v0.2.0 saves — including per-wall
  `wallpaper` objects — must keep working and must never throw on load.
- **Touch is first-class.** The player is a 10-year-old, often on a tablet.
  Nothing may be keyboard-only, and controls must stay reachable on a narrow
  viewport.
- **Verification is headless Playwright** against a local `python3 -m http.server`.
  Every task proves its change with a scripted run asserting on real state, plus
  a screenshot where the change is visual. Zero uncaught page errors is part of
  every pass.

## Verification harness

Throwaway scripts go under
`.superpowers/sdd/2026-09-12-dach-treppe-und-feinschliff/` (git-ignored).

- Launch chromium with `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
- **Every `page.click` needs `timeout=20000` or more** — Playwright's actionability
  check runs on the page's rAF loop, and under software rendering this game has
  measured 7 s to click a plainly visible button. The default 5 s fails spuriously.
- A `favicon.png` 404 is expected; assert on `pageerror` only.
- Reaching edit mode: click `#btn-start`, `#btn-build`, wait ~1.5 s, then
  `pg.mouse.click(640, 470)`. `#btn-done` exits. Cutaway is `#btn-cutaway`.
- Seeding `localStorage['wipfelkratzer-v1']` before load is much faster than
  clicking «Stockwerk bauen» ten times.
- `window.wipfelkratzer` exposes the scene graph for `page.evaluate` assertions.

---

## Task 1 — Stair from floor 10 to the roof terrace (issue #6)

**Problem.** The roof terrace (`roofG`, `js/game.js:281–299`) is fully railed and
fully furnishable — the frog tenant's wish is the pool up there — but nothing
connects to it. v0.2.0 rebuilt the external staircase as a door→landing→flight→
landing→door chain, and floor 10 has no door above it, so the chain stops at the
top floor's landing.

**Change.** Add a final flight from floor 10's landing up onto the roof deck, and
open the roof railing where it arrives.

- Reuse the existing staircase construction — same tread width, same slope band
  (the built flights sit at 31–33°), same materials, same railing treatment. It
  must read as the continuation of the same staircase, not as a bolted-on ramp.
- The roof deck sits at `topY() + 0.02` and is `ROOF_W × ROOF_D`; `updateRoof()`
  repositions it as floors are built. The flight's head must meet the deck with
  no vertical gap, and its foot must meet floor 10's landing the same way the
  other flights do.
- **Open the railing at the arrival point.** The roof balustrade is built as two
  full-length runs of posts plus rails (`js/game.js:284–289`). Arriving at a
  closed railing looks wrong; leave a gap wide enough to walk through, with the
  rail terminated properly at both sides of the opening rather than simply
  deleted.
- **Visibility must track the roof.** The roof is hidden during floor editing
  (`enterEdit`, `js/game.js:481`) and restored by `updateRoof()`; the party mode
  (`partyG`, `js/game.js:296`, `658–671`) adds dancers and lanterns to `roofG`.
  The new flight must appear and disappear with the roof in all of those paths,
  and must only exist once floor 10 is built.

**Acceptance.**
- With 10 floors built, assert in-page that the new flight's head meets the roof
  deck and its foot meets floor 10's landing, both within one tread thickness
  (world-space bounding boxes via `page.evaluate`).
- Its slope is within the same band as the existing flights (roughly 28–36°).
- The roof railing has a walk-through opening at the arrival point: assert no
  post or rail segment spans the gap.
- With fewer than 10 floors built, the flight does not exist or is not visible.
- Enter edit mode on a floor: the flight hides with the roof; exit: it returns.
- Trigger the roof party (10 floors + top tenant): the flight is still there and
  nothing overlaps the dancers or lanterns.
- Reload from a seeded 10-floor save: geometry identical to the click-built case.
- Screenshots: the full tower from the front, and a close-up of where the flight
  meets the roof.

---

## Task 2 — Three small fixes (issues #7, #8, #9)

Batched: all three are small, independent edits in the same two files.

### 2a — Selection bar must not cover the toolbar (issue #7)

`#selbar` sits at a fixed `bottom: 76px`. v0.2.0's `#wallpad` direction pad made
it roughly 108 px tall (was ~60 px), so on narrow viewports — where `#toolbar`
wraps onto two rows — it covers the toolbar's upper row, including «Einrichten».

Fix so the two never overlap at any viewport width. Either derive `#selbar`'s
offset from the toolbar's actual rendered height rather than a fixed value, or
hide the toolbar while something is selected — your call, but it must hold when
the toolbar wraps, and it must not introduce layout jitter as the selection
changes.

**Acceptance.** At a narrow tablet-ish viewport (e.g. 820×1180 and 600×900) with
a wall object selected, assert via bounding boxes that `#selbar` and every
visible `#toolbar` button are disjoint, and that «Einrichten» is clickable.
Assert the same at 1280×800. Screenshot at the narrowest size.

### 2b — Wall tap should not hijack the catalog tab (issue #8)

`js/game.js:812` sets `catTab = 'farbe'` on every 3D wall tap, so a player
picking furniture who taps a wall to deselect is yanked into «Tapete».

**Decided behaviour, implement exactly this:** a wall tap always sets the active
wall, but changes the catalog tab **only when «Tapete» is already the open tab**.
In every other tab, the tap sets the active wall silently and leaves the catalog
where it is.

**Acceptance.** In «Möbel», tap a wall → `catTab` still `mobel`, and the active
wall changed. In «Tapete», tap a different wall → stays in «Tapete», active wall
changed, and a subsequent pattern click papers the newly tapped wall.

### 2c — Two cleanups (issue #9)

- `wallpaperOf` writes `{}` into `state.wallpaper` for every floor it is asked
  about, so a save accumulates `wallpaper: {"0":{},…,"10":{}}` for floors that
  were never decorated. Stop persisting empty entries — either don't create
  them, or drop them when saving. **Loading a save that already contains them
  must keep working.**
- `g.userData.doorX` is a dead test hook; remove it. Check nothing reads it first.

**Acceptance.** Build 3 floors, decorate one wall on one floor, reload: the saved
`wallpaper` contains only the decorated floor. A v0.2.0 save containing the empty
entries loads without error and renders correctly. `grep` shows no remaining
reference to `doorX`.

---

## Out of scope

Everything not listed above. In particular the tower's exterior colour
(`#f3e2bd`, unified in v0.2.0) stays as it is — the owner has been told and has
not asked for a change. Discoveries go in `TODO.md` or a new issue, not into this
branch.
