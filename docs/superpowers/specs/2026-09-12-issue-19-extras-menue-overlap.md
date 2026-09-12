# Spec — Extras-Menü hat dieselbe Überlappung wie die Auswahlleiste (Issue #19)

Repo: `game-wipfelkratzer`. Base: `main`, v0.3.0. Buildless vanilla:
`index.html` + `js/game.js`. three.js r184 via importmap. No build step, no
test framework.

## Problem

`#7` moved `#selbar` from a hardcoded `bottom: 76px` to a live
`calc(var(--toolbar-h, 60px) + 16px)`, fed by a `ResizeObserver` on
`#toolbar` that publishes `--toolbar-h` (`js/game.js:443-448`). `#extras-menu`
(`index.html:81`) was not migrated and still reads `bottom: 76px`. When
`#toolbar` wraps to two rows (narrow viewports), `#extras-menu` sits at the
same fixed height as before and overlaps the now-taller toolbar — the exact
class of bug #7 fixed for `#selbar`, one tap away (`#btn-extras` is a
`#toolbar` button).

Notably, `76px` is not an arbitrary old constant: it is exactly
`60px + 16px`, i.e. the same numbers `#selbar`'s formula already uses with
its `--toolbar-h, 60px` fallback. This confirms the two elements were meant
to track the same thing and only one got updated.

## Fix

In `index.html:81`, replace `#extras-menu`'s `bottom: 76px` with the same
formula `#selbar` already uses (`index.html:71`):

```css
bottom: calc(var(--toolbar-h, 60px) + 16px);
```

No JS changes: `--toolbar-h` is already published on
`document.documentElement.style` by the existing observer
(`js/game.js:443-448`), and CSS custom properties are inherited, so
`#extras-menu` picks it up for free. No new `ResizeObserver`, no new CSS
variable.

## Other hardcoded-`bottom` elements checked

Grepped every `bottom:` declaration in `index.html` to see if more elements
share this bug class (an element whose bottom offset should track
`#toolbar`'s live height but doesn't):

- `#toolbar` (`index.html:48`, `bottom: 10px`) — legitimately fixed. It is
  the anchor everything else measures from; it has nothing above it to clear.

- `#selbar` (`index.html:71`) — already fixed by #7 (`calc(var(--toolbar-h,
  60px) + 16px)`). Not in scope here.

- `#extras-menu` (`index.html:81`, `bottom: 76px`) — **the fix in this
  issue.**

- `#catalog` (`index.html:54`, `bottom: 0`) — a different bug, already
  planned separately. `#catalog` is a full-height side drawer, not a
  bottom-anchored panel; issue #16's plan gives it its own `--selbar-h`
  variable and a `calc()` over both `--toolbar-h` and `--selbar-h`. Not
  touched here — see "Relationship to #16" below.

- `#toast` (`index.html:124`, `bottom: 84px`) — **A1**: checked, left as-is.
  It is centred like `#toolbar`/`#extras-menu` and could in principle sit
  under a two-row toolbar too, but `#toast` has `pointer-events: none`
  (`index.html:124`) and auto-hides after 2.8s (`js/game.js:450`). A visual
  overlap here is cosmetic, not a reachability bug — nothing becomes
  unclickable, unlike `#extras-menu` whose buttons are real interactive
  targets. Out of scope.

- `#wishes` at the `max-width: 640px` breakpoint (`index.html:140`,
  `top: auto; bottom: 130px`) — **A2**: checked, left as-is. `#wishes` is
  right-anchored (`right: 10px`, not `left: 50%`), so it isn't stacked
  directly on the same centred column as `#toolbar`/`#selbar`/`#extras-menu`;
  no reported or reproduced overlap. Folding it in here would mean
  speculatively redesigning an unrelated widget's positioning without a
  concrete bug to verify against. Out of scope.

- `#game-nav` (`index.html:247`, inline `bottom:8px; right:10px`) — a
  site-chrome nav bar unrelated to the game's own UI stack (different
  concept entirely, always pinned to the corner). Legitimately fixed.

**Net finding: one other candidate worth naming (`#toast`), one more
speculative one (`#wishes`), both rejected — see A1/A2. Only `#extras-menu`
gets fixed.**

## Relationship to issue #16

#16 (catalog covers toolbar/selbar at narrow widths) touches the same
bottom-stack area and adds a second observed variable, `--selbar-h`. The two
issues are independent in code (different files/lines: #19 is a one-line CSS
edit to `#extras-menu`; #16 adds a new observer plus a `#catalog` formula)
and **do not need to be done together** — but **#19 should land first, or at
worst in the same PR**, because:

- #19 is strictly smaller and carries no risk of touching #16's work.
- #16's own plan (A4 in its enrichment) explicitly declined to fix
  `#extras-menu` "to not widen scope," deferring it to exactly this issue —
  so #19 is the natural predecessor, not a follow-up.
- Landing #19 first keeps #16's diff focused on `#catalog`/`--selbar-h`
  only, with no unrelated `#extras-menu` line mixed in.

If both are picked up by parallel agents in the same run, whichever merges
second should rebase past the other's one-line change — there is no
overlapping code to conflict on.

## Global constraints

- **German UI, Swiss spelling** (`ss`, never `ß`) — unaffected, no user-facing
  text changes.
- **Buildless.** No new dependencies, no build step, no bundler, no test
  runner. Plain CSS edit.
- **Picture-book look is final-intent** — not touched; this is a layout-only
  CSS fix, no visual/material change to the 3D scene.
- **`localStorage` backward compatible** — not touched; no persisted shape
  involved.
- **Touch is first-class** — the whole point of this fix is that
  `#btn-extras`/the extras menu stays fully usable (not overlapped) on
  narrow/tablet-portrait viewports where `#toolbar` wraps to two rows.
- **Verification is headless Playwright**, zero uncaught `pageerror`s,
  disjoint-bounding-box assertions at several viewport sizes (same style as
  used for #7).

## Assumptions

- **A1** [med] `#toast` (`index.html:124`) is left untouched despite sharing
  a hardcoded, centred `bottom` value in the same UI band.
  Rejected: applying the same `calc(var(--toolbar-h, 60px) + 16px)` formula
  to it too. `#toast` has `pointer-events: none` and auto-dismisses after
  2.8s (`js/game.js:450`), so an overlap is purely cosmetic, never a
  reachability bug — it is not the same bug class the issue describes.

- **A2** [low] `#wishes`'s narrow-viewport `bottom: 130px`
  (`index.html:140`) is left untouched.
  Rejected: redesigning it to track `--toolbar-h` too. It's right-anchored,
  not centred over `#toolbar`, and there is no reported or reproduced overlap
  to verify a fix against — would be a speculative change outside this
  issue's evidence.

- **A3** [high] The fix is a pure CSS one-line change; no new `ResizeObserver`
  and no new CSS custom property are introduced.
  Rejected: giving `#extras-menu` its own observer/variable. `--toolbar-h`
  already exists and is already inherited by every descendant of
  `document.documentElement`; `#extras-menu` just needs to read it, exactly
  as `#selbar` already does with the identical formula.

- **A4** [med] `#extras-menu`'s formula does not additionally account for
  `#selbar` being open at the same time (no stacking on `--selbar-h`).
  Rejected: making `#extras-menu` clear `#selbar` too when both happen to be
  open simultaneously (possible: `#toolbar`, and therefore `#btn-extras`,
  stays reachable while an item is selected). The issue's own text asks
  specifically for "dieselbe `calc(...)`-Formel" as `#selbar` — i.e. parity
  with `#toolbar`, not a new three-way stacking rule. That broader
  "multiple bottom-stack panels overlapping each other" concern is exactly
  what #16 is already opening up (its own `--selbar-h` mechanism); folding a
  third variable in here would duplicate #16's work ahead of it landing.

## Consequences

None beyond the one-line CSS change: `#extras-menu` now shares the exact
positioning logic `#selbar` already uses, so any future change to
`#toolbar`'s height (more buttons, wider labels, more wrapping) keeps both
panels correctly clear of it with no further code changes.
