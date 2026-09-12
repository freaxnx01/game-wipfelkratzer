# Plan — Wand-Tipp scrollt den Katalog zurück nach oben (Issue #18)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0). Buildless vanilla:
`index.html` + `js/game.js` + `js/models.js`. three.js r184 via importmap. No
build step, no test framework.

Spec: `docs/superpowers/specs/2026-09-12-issue-18-wandtipp-katalog-scroll.md`

## Global Constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`).
- **Buildless.** No new dependencies, no build step, no npm, no test runner.
- **Picture-book look is final-intent.** This issue touches no
  materials/geometry, only one call-site in an event handler.
- **`localStorage` backward compatible.** Not touched by this fix; no schema
  change.
- **Touch is first-class.** The regression itself only shows up on touch/tap
  scroll interactions with the catalog panel.
- **Verification is headless Playwright** against a local
  `python3 -m http.server`, zero uncaught page errors.

## Verification harness

Reuse the pattern established for the #11 wall-selection work
(`docs/superpowers/plans/2026-09-12-issue-11-wandobjekte-wandwahl.md`),
whose harness already exercises wall-tap and tab switching — the regression
test for this issue is a small addition alongside that same style of script,
not a new harness.

- Serve with `python3 -m http.server <port>`, port in **8956–8960** (pick the
  first free one in range). Stop by port when done:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs kill` — never
  `pkill -f` with a pattern that could match the invoking command.
- Chromium: `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
- **Every `page.click`/`page.mouse.click` needs `timeout=20000` or more.**
- A `favicon.png` 404 is expected; assert on `pageerror` only.
- Reaching edit mode: click `#btn-start`, `#btn-build`, wait ~1.5s, then tap
  a floor to enter edit mode; `#catalog` opens automatically.
- The debug hook `window.wipfelkratzer` (`js/game.js:~1048`) exposes `state`,
  `floorGroups`, `WALL_KEYS`, and a live `wallTarget` getter — use it to
  assert the wall selection directly instead of only inferring from pixels.
- Selecting a wall while on a non-«Tapete» tab: with the catalog open on
  «Möbel» (`catTab === 'mobel'`, the default), tap a screen point that
  raycasts onto a visible wall panel (`back`/`left`/`right`; `front` is not
  tappable in 3D, per `js/game.js:529` — irrelevant here since the test only
  needs one wall).
- Reading/forcing scroll position: `page.evaluate(() => document.querySelector('#catalog-items').scrollTop)`
  after `page.evaluate(el => el.scrollTop = N, ...)` or by scrolling the
  element directly; compare before/after the wall-tap.

Throwaway script goes under
`.superpowers/sdd/2026-09-12-issue-18-wandtipp-katalog-scroll/` (git-ignored).

---

## Task 1 — Stop the catalog re-render on a non-«Tapete» wall-tap

**Problem.** `js/game.js:876`, the `else` branch of the wall-tap handler in
`pointerup`, calls `setWallTarget(wallKey)`
(`function setWallTarget(key) { wallTarget = key; highlightWalls(); renderCatalog(); }`,
`js/game.js:393`). `renderCatalog()` (`js/game.js:480-506`) unconditionally
rebuilds `#catalog-items`, resetting its scroll position — even though, per
the spec's analysis, neither `highlightWalls()` nor `renderCatalog()` has
any visible effect from this branch (confirmed: `highlightWalls`'s `lit`
flag is always `false` when `catTab !== 'farbe'`; `renderCatalog`'s only use
of `wallTarget` is gated behind `catTab === 'farbe'`, which this branch is
guaranteed not to be).

**Change.** In `js/game.js:876`, replace:

```js
} else { setWallTarget(wallKey); }
```

with:

```js
} else { wallTarget = wallKey; }
```

Leave the `if (catTab === 'farbe')` branch (`js/game.js:872-875`)
untouched.

**verify:** Read the modified line back and confirm it assigns `wallTarget`
directly with no call to `setWallTarget`, `highlightWalls`, or
`renderCatalog`, and that the `if` branch above it is byte-identical to
before the change.

---

## Task 2 — Headless regression test: wall-tap no longer resets catalog scroll

**Change.** Add a throwaway Playwright script (per the harness above) that:

1. Serves the repo, opens the page, seeds `localStorage` (or clicks through
   `#btn-start` → `#btn-build`) to reach edit mode on a floor with the
   catalog open and `catTab === 'mobel'` (the default).
2. Scrolls `#catalog-items` down by some amount `N > 0` (e.g. via
   `element.scrollTop = 200` if the «Möbel» list is tall enough, else
   temporarily add enough seeded furniture/decor to `state.rooms[k]` before
   load so the list overflows — whichever is simpler given the actual
   catalog item count).
3. Taps a screen point that raycasts onto a visible wall panel (`back`,
   `left`, or `right`) while the catalog is still open on «Möbel».
4. Asserts:
   - `#catalog-items`'s `scrollTop` is unchanged (equal to the value set in
     step 2, not reset to `0`).
   - `window.wipfelkratzer.wallTarget` (or equivalent debug accessor) now
     equals the tapped wall's key — the selection still updates even though
     the catalog didn't re-render.
   - No `pageerror` events fired during the whole sequence.
5. As a non-regression check for the untouched branch, also tap a wall while
   `catTab === 'farbe'` and assert the existing behaviour still holds: the
   catalog opens/stays open, the toast text `Wand «…» ausgewählt — jetzt eine
   Tapete antippen.` appears, and the wall picker's `on` button matches the
   tapped wall.

**verify:** Run the script against the unpatched code first to confirm it
reproduces the bug (scroll resets to `0`), then against the Task 1 change to
confirm it passes — both runs with zero `pageerror` events.
