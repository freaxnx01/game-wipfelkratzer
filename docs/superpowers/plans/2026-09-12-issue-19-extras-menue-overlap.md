# Plan — Extras-Menü hat dieselbe Überlappung wie die Auswahlleiste (Issue #19)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0). Buildless vanilla:
`index.html` + `js/game.js`. three.js r184 via importmap. No build step, no
test framework.

Spec: `docs/superpowers/specs/2026-09-12-issue-19-extras-menue-overlap.md`

## Global constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`).
- **Buildless.** No new dependencies, no build step, no npm, no bundler, no
  test runner.
- **Picture-book look is final-intent** — not touched by this change.
- **`localStorage` backward compatible** — not touched by this change.
- **Touch is first-class.** The fix restores `#extras-menu` reachability on
  narrow/tablet-portrait viewports where `#toolbar` wraps to two rows.
- **Verification is headless Playwright** against a local
  `python3 -m http.server`. Zero uncaught page errors is part of every pass.

## Verification harness

Throwaway scripts go under
`.superpowers/sdd/2026-09-12-issue-19-extras-menue-overlap/` (git-ignored).

- Serve with `python3 -m http.server <port>`, port range **8961–8965**
  (avoid ports other concurrent agents in this session are using).
- Launch chromium with
  `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
- **Every `page.click` needs `timeout=20000` or more.**
- A `favicon.png` 404 is expected; assert on `pageerror` only.
- Reaching a state where `#extras-menu` can be opened needs no edit mode:
  `#btn-extras` lives in the always-visible main `#toolbar`
  (`index.html:157`), so `page.click('#btn-extras')` works straight from the
  intro/start screen once the game has started (`#btn-start`, then
  `#btn-build` once to have a real game state, or just click `#btn-extras`
  directly if it's reachable pre-build — confirm during the run).
- To force `#toolbar` onto two rows (the condition that reproduces the bug),
  use a narrow viewport — 375×700 or similar — where the seven `#toolbar`
  buttons don't fit one row (`flex-wrap: wrap` at `index.html:48`).
- Stop the server by port when done:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs kill` — never
  `pkill -f` with a pattern that could match the invoking command line.

---

## Task 1 — Fix `#extras-menu`'s bottom offset

**Problem.** `#extras-menu` (`index.html:81`) still has a hardcoded
`bottom: 76px`, which was only ever correct while `#toolbar` was a single
row. `#selbar` (`index.html:71`) already solved the identical problem with
`bottom: calc(var(--toolbar-h, 60px) + 16px)`, fed by the existing
`ResizeObserver` on `#toolbar` (`js/game.js:443-448`) that publishes
`--toolbar-h` on `document.documentElement.style`.

**Change.** In `index.html:81`, replace:

```css
#extras-menu { position: fixed; bottom: 76px; left: 50%; transform: translateX(-50%); z-index: 7; display: none; flex-direction: column; gap: 8px; padding: 12px; width: 260px; }
```

with:

```css
#extras-menu { position: fixed; bottom: calc(var(--toolbar-h, 60px) + 16px); left: 50%; transform: translateX(-50%); z-index: 7; display: none; flex-direction: column; gap: 8px; padding: 12px; width: 260px; }
```

Only the `bottom` value changes. No JS changes — `--toolbar-h` is already
published and CSS custom properties inherit, so `#extras-menu` picks it up
with no further wiring.

**verify:** Headless script loads the page at a single-row-toolbar viewport
(e.g. 1280×800), opens `#extras-menu` (`page.click('#btn-extras')`), and
confirms `getComputedStyle(document.documentElement)
.getPropertyValue('--toolbar-h')` matches `#toolbar`'s own
`offsetHeight`, and that `#extras-menu`'s computed `bottom` equals
`toolbarHeight + 16` (within 1px). Zero `pageerror` events.

---

## Task 2 — Reachability + disjoint-bbox regression at narrow width

**Problem.** Task 1's CSS change needs proof it actually fixes the
reported bug (two-row toolbar overlap) and doesn't regress the normal case.

**Change.** No further code changes expected. Write and run one Playwright
script:

- At a viewport narrow enough for `#toolbar` to wrap to two rows (e.g.
  375×700 — confirm empirically that seven buttons wrap at this width;
  adjust if not), open `#extras-menu` and assert its
  `getBoundingClientRect()` does not intersect `#toolbar`'s
  `getBoundingClientRect()` (disjoint bounding boxes — same assertion shape
  used for #7's `#selbar` fix).
- Every `#extras-menu` button (`#btn-bridge`, `#btn-garden`, `#btn-sign`,
  `#btn-animals`, `#btn-gallery`, `#btn-reset`; skip `#btn-party` if it
  carries the `hidden` class) is reachable via
  `document.elementFromPoint` on its own rect centre resolving to itself or
  a descendant.
- Repeat the same two checks at a normal single-row width (e.g. 1280×800) to
  confirm no regression — `#extras-menu` still sits directly above
  `#toolbar` with the same ~16px gap as before, not floating awkwardly high.
- If Task 1's fix needs adjustment to pass this pass, fix it here rather
  than opening a new task — this is the acceptance gate.
- Zero `pageerror` events across the whole script.

**verify:** The script itself is the verification — it must complete with
all assertions passing and zero `pageerror` events at both viewport sizes.
