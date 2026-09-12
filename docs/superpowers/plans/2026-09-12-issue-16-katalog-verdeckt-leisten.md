# Plan — Katalog verdeckt Werkzeugleiste und Auswahlleiste (Issue #16)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0). Buildless vanilla:
`index.html` + `js/game.js`. three.js r184 via importmap. No build step, no
test framework.

Spec: `docs/superpowers/specs/2026-09-12-issue-16-katalog-verdeckt-leisten.md`

## Global Constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`).
- **Buildless.** No new dependencies, no build step, no npm. ES modules only.
  Do not add a bundler or a test runner.
- **Picture-book look is final-intent**: `MeshLambertMaterial` only, chunky
  low-poly primitives, warm desaturated palette. This issue is CSS/JS layout
  only — no new geometry — so this constraint mainly rules out anything that
  would change rendered visuals of the 3D scene, which this fix does not
  touch.
- **Persistence backward compatible.** `localStorage` keys `wipfelkratzer-v1`
  and `wipfelkratzer-fotos` must keep loading; this fix touches no persisted
  shape at all, but any test harness that seeds state must not break that.
- **Touch is first-class.** The player is a 10-year-old, often on a tablet.
  The whole point of this fix is restoring touch/click reachability of
  toolbar and selection-bar buttons on narrow (tablet-portrait-ish) viewports.
- **Verification is headless Playwright** against a local
  `python3 -m http.server`. Zero uncaught page errors is part of every pass.

## Verification harness

Throwaway scripts go under
`.superpowers/sdd/2026-09-12-issue-16-katalog-verdeckt-leisten/` (git-ignored).

- Serve with `python3 -m http.server <port>` (pick a free port; ports
  8976–8980 are reserved by other concurrent agents in this session — avoid
  them unless confirmed free).
- Launch chromium with `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
- **Every `page.click` needs `timeout=20000` or more** — this game measures up
  to ~7s to register a click under software rendering.
- A `favicon.png` 404 is expected; assert on `pageerror` only.
- Reaching edit mode: click `#btn-start`, `#btn-build`, wait ~1.5s, then
  `page.mouse.click(640, 470)` (or the viewport-scaled equivalent) to select a
  floor and enter edit mode; `#catalog` opens automatically
  (`js/game.js:552`). `#btn-done` exits edit mode.
- Seeding `localStorage['wipfelkratzer-v1']` before load is much faster than
  clicking «Stockwerk bauen» repeatedly, and is required anyway to get an
  already-placed item to select for the `#selbar`-open checks.
- To get `#selbar` into its `.on` state: with an item already placed in the
  seeded save, click that item's mesh in edit mode (`select()`,
  `js/game.js:570`), or drive it via `page.evaluate` calling the exposed
  `window.wipfelkratzer` scene handle if a direct click hit-test proves
  fragile under swiftshader.
- Reachability check (all viewports, both catalog-only and
  catalog+selection open): for each target button id, run
  `document.elementFromPoint(cx, cy)` at the button's own
  `getBoundingClientRect()` centre and assert the returned element is the
  button itself or contained within it (`button === el || button.contains(el)`),
  not `#catalog` or `#catalog-items`.
- Stop the server by port when done:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs kill` — never
  `pkill -f` with a pattern that could match the invoking command line.

---

## Task 1 — Track `#selbar`'s live height as `--selbar-h`

**Problem.** `#catalog` (`index.html:54`) is `top: 0; bottom: 0`, a full
viewport-height drawer, so nothing today stops its bottom edge from
overlapping the horizontally-centred `#toolbar`/`#selbar` stack. The existing
`js/game.js:443-448` observer only relates `#selbar` to `#toolbar`; nothing
currently measures `#selbar`'s own height for anything else to consume.

**Change.** In `js/game.js`, immediately after the existing
`#toolbar`/`--toolbar-h` `ResizeObserver` block (`js/game.js:446-448`), add a
second, identically-shaped observer on `#selbar` that publishes
`--selbar-h` on `document.documentElement.style`:

```js
(() => { const sb = $('selbar');
  const sync = () => document.documentElement.style.setProperty('--selbar-h', sb.offsetHeight + 'px');
  new ResizeObserver(sync).observe(sb); sync(); })();
```

`ResizeObserver` reports `0` for a `display: none` element (the default
`#selbar` state per `index.html:71`, `display: none` until `.on` is added), so
this naturally yields `--selbar-h: 0px` whenever nothing is selected, with no
extra visibility branching needed — mirroring how the existing `--toolbar-h`
observer needs no branching either.

Keep this next to the existing block (same file region, same style) rather
than as a separate init function, so the two bottom-stack observers stay
visually paired for future maintainers.

**verify:** Headless script loads the page, evaluates
`getComputedStyle(document.documentElement).getPropertyValue('--selbar-h')`
before any selection exists (`0px`), then seeds a save with a placed item,
enters edit mode, selects that item, and re-reads the property — it must now
equal `` `${document.getElementById('selbar').offsetHeight}px` `` (allow the
comparison as numeric px, not string). Zero `pageerror` events throughout.

---

## Task 2 — Give `#catalog` a live bottom offset instead of `bottom: 0`

**Problem.** With `--selbar-h` now available, `#catalog` still hard-codes
`bottom: 0` (`index.html:54`), so it keeps covering the full viewport height
regardless of the bottom stack's real size.

**Change.** In `index.html`, replace `#catalog`'s `bottom: 0;` with a
`calc()` over both tracked properties, matching the fallback-constant style
`#selbar` already uses for `--toolbar-h` (`index.html:71`):

```css
#catalog { position: fixed; right: 0; top: 0;
  bottom: calc(var(--toolbar-h, 60px) + 16px + var(--selbar-h, 0px) + 10px);
  width: min(320px, 88vw); background: var(--cream);
  border-left: 4px solid var(--woodL); z-index: 8; display: none;
  flex-direction: column; }
```

The `+ 16px` term mirrors `#selbar`'s own existing gap above `#toolbar`
(`index.html:71`); the trailing `+ 10px` is breathing room between
`#selbar`'s top edge and `#catalog`'s new bottom edge, matching `#toolbar`'s
own `bottom: 10px` (`index.html:48`). No other `#catalog` property changes —
width, `right`, `top`, `z-index`, and the `.open` toggle are all untouched.

**verify:** Headless script measures, at 600×900:

- Catalog open, nothing selected: `#catalog`'s `getBoundingClientRect().bottom`
  is strictly less than `#toolbar`'s `getBoundingClientRect().top` (i.e.
  visible gap, not just non-overlap).
- Catalog open, item selected (`#selbar.on`): `#catalog`'s
  `getBoundingClientRect().bottom` is strictly less than `#selbar`'s
  `getBoundingClientRect().top`.
- Repeat both checks at 820×1180 and 1280×800 — must still hold (no
  regression at wider viewports, where the old `bottom: 0` also happened not
  to visibly matter because `#catalog` never had reason to be checked there,
  but the new formula must not misbehave either).
- `#catalog-items` still has a non-zero scrollable area
  (`scrollHeight > clientHeight` once populated) — confirms the drawer didn't
  collapse to zero usable height.
- Zero `pageerror` events.

---

## Task 3 — Full reachability regression pass + screenshot evidence

**Problem.** Tasks 1–2 fix the geometry; this task proves the actual
acceptance criteria (button reachability, not just rect math) and produces
the visual evidence the spec's acceptance criteria call for.

**Change.** No further code changes expected. Write and run one
end-to-end Playwright script covering the full acceptance criteria list:

- At 600×900, catalog open, no selection: `document.elementFromPoint` on the
  centre of every currently-visible `#toolbar` button resolves to that button
  (or a descendant), not to `#catalog`/`#catalog-items`.
- At 600×900, catalog open, item selected: same check for every visible
  `#selbar` button (`#btn-move`/`#btn-rot` or the wall-pad, plus `#btn-del`).
- Repeat both checks at 820×1180 and 1280×800.
- Click through: actually click `#btn-catalog`... `#btn-extras` (whichever is
  reachable per current edit mode) with the catalog open at 600×900, and
  confirm the expected UI response happens (e.g. `#extras-menu` gets `.open`),
  not just that `elementFromPoint` resolves correctly — a small number of real
  clicks as a sanity cross-check on top of the geometric assertions.
- Catalog tabs still switch (`#catalog-tabs button` click changes the active
  tab, `catalog-items` repopulates) — regression guard for the #8 fix.
- Capture one screenshot at 600×900 with both catalog and selection open,
  saved under the throwaway harness directory, showing visible daylight
  between `#catalog` and `#selbar`.
- Confirm zero `pageerror` events across the entire script.

If anything in Tasks 1–2 needs adjustment to pass this pass (e.g. the `10px`
breathing margin from A3 proves too tight under real font metrics), fix it
here rather than opening a new task — this is the acceptance gate.

**verify:** The script itself *is* the verification — it must complete with
all assertions passing and zero `pageerror` events, and the screenshot file
must exist and, on visual inspection, show the toolbar and (where open) the
selection bar fully clear of the catalog panel at 600×900.
