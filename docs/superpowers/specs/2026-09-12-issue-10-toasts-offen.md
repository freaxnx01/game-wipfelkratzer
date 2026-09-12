# Spec: Toasts bleiben offen und sind schliessbar

Issue: `freaxnx01/game-wipfelkratzer#10`

## Problem

`toast()` (`js/game.js:450`) writes into a single `#toast` element and
auto-hides it after a hardcoded 2800 ms via `clearTimeout`/`setTimeout`. With
17 call sites across build, move-in, wishes, hints, edit mode, and error
paths (`js/game.js:400,582,626,643,681,682,687,690,692,695,728,755,757,843,
844,845,846,875,902,908,1001,1011`), a message a 10-year-old is still
reading can vanish mid-sentence — confirmed in playtest
(`docs/ai-notes/feedback/2026-09-12-test-mit-tochter.md`). Because several of
these calls happen in quick succession (floor built → tenant moves in →
wish fulfilled), simply removing the timeout naively would let unread toasts
pile up and cover the game.

## Goals

- Every toast persists until the player dismisses it — no more silent
  auto-hide.
- A dismissal control exists that is comfortably tappable by a child's
  finger on a tablet.
- Toasts fired in series stack instead of clobbering each other, and stay
  usable (not screen-covering) even if the player ignores all of them.
- The toast stack does not overlap the toolbar, mirroring how `#selbar`
  already tracks `--toolbar-h` (`index.html:71`).
- No behavioural change to *when* a toast fires — only how it is shown and
  cleared. `toast(msg)` keeps its one-argument call signature so none of
  the 17 call sites need to change.

## Non-goals

- Redesigning toast *content* or wording.
- Sound/haptics changes (existing `sfx.*` calls at call sites are untouched).
- A global "tap anywhere on screen to dismiss all" gesture — rejected, see
  A3.
- Persisting toast state across reloads — toasts are ephemeral UI, not
  game state; `wipfelkratzer-v1`/`wipfelkratzer-fotos` are untouched.

## Design

### Data model

Replace the single `toastEl`/`toastT` pair (`js/game.js:449-450`) with an
in-memory queue:

```js
let toasts = []; // [{ id, msg }]
let toastSeq = 0;
function toast(msg) {
  const id = ++toastSeq;
  toasts.push({ id, msg });
  if (toasts.length > TOAST_MAX_VISIBLE) toasts.shift(); // drop oldest, see A2
  renderToasts();
}
function dismissToast(id) { toasts = toasts.filter(t => t.id !== id); renderToasts(); }
function dismissAllToasts() { toasts = []; renderToasts(); }
```

`renderToasts()` rebuilds `#toast-stack`'s children from `toasts`, newest
last (so it sits closest to the toolbar, matching current bottom-anchored
reading order).

### Markup (`index.html`)

Replace the single `<div id="toast" class="panel"></div>` (`index.html:227`)
with a stack container:

```html
<div id="toast-stack"></div>
```

Each rendered toast is built as:

```html
<div class="toast-item panel" data-id="…">
  <span class="toast-msg">…</span>
  <button class="toast-close" aria-label="Schliessen">×</button>
</div>
```

Plus one static "dismiss all" affordance shown only once ≥2 toasts are
open (see Acceptance Criteria):

```html
<button id="toast-clear-all" class="hidden">Alle schliessen</button>
```

### Styling (`index.html` `<style>`)

Replace `#toast`/`#toast.show` (`index.html:124-125`) with:

- `#toast-stack`: `position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--toolbar-h, 60px) + 16px); z-index: 9; display: flex;
  flex-direction: column-reverse; gap: 8px; max-width: 90vw; max-height:
  60vh; overflow-y: auto; align-items: center;` — same bottom-tracking
  trick `#selbar` already uses (`index.html:71`), `column-reverse` so a new
  toast appends visually just above the toolbar without reflowing the ones
  above it, and `max-height` + `overflow-y: auto` so a fully-ignored queue
  scrolls instead of covering the canvas.
- `.toast-item`: keeps the existing `.panel` look (warm desaturated,
  no pure black/white — unchanged), adds `display: flex; align-items:
  center; gap: 10px; padding: 8px 10px 8px 16px; font-size: 16px;
  font-weight: 700; animation: toast-in .3s;` (a simple fade/slide-in
  keyframe replaces the old `.show` transition).
- `.toast-close`: `min-width: 44px; min-height: 44px; border-radius: 50%;
  font-size: 20px; line-height: 1; flex-shrink: 0;` — meets the finger-size
  bar `#selbar button` already sets (`index.html:73`, `min-height: 44px`).
- `#toast-clear-all`: small pill button, `position: fixed`, anchored above
  the stack's top edge (or inline as the stack's first/topmost child in
  DOM order, given `column-reverse`), same `min-height: 44px` rule.

### Behaviour

- `toast-close` click/tap → `dismissToast(id)`.
- Tapping the `.toast-item` body itself (not just the ×) also dismisses
  that one toast — covers "oder irgendwo reinklicken" from the issue
  source quote (A3).
- `#toast-clear-all` click → `dismissAllToasts()`; button itself is hidden
  again once the queue empties (toggled from `renderToasts()`).
- A hard cap (`TOAST_MAX_VISIBLE`, see A2) silently drops the oldest queued
  toast when exceeded, so an ignored queue never grows unbounded — the
  scrollable `max-height` is the second line of defence for the toasts
  that do stay.
- No timers: `toastT`/`clearTimeout`/`setTimeout` in `toast()` are removed
  entirely.

## Acceptance Criteria

- [ ] A toast fired via `toast(msg)` stays visible indefinitely until
      dismissed — no automatic hide after any elapsed time.
- [ ] Each toast shows a close control at least 44×44 CSS px.
- [ ] Tapping a toast's close button removes only that toast; other open
      toasts remain.
- [ ] Tapping anywhere else on a toast's own panel also dismisses it.
- [ ] Firing toasts in quick succession (e.g. build a floor while a wish
      toast is open) shows both, stacked, without either being silently
      replaced.
- [ ] The toast stack never visually overlaps `#toolbar` at any viewport
      width down to 360px, using the same `--toolbar-h` tracking as
      `#selbar`.
- [ ] With more open toasts than fit `max-height`, the stack scrolls
      internally rather than growing off-screen or blocking taps on the
      toolbar/canvas below it.
- [ ] An "Alle schliessen" control appears once 2+ toasts are open and
      clears the whole queue in one tap.
- [ ] All 17 existing `toast(...)` call sites work unmodified — `toast()`'s
      signature is unchanged.
- [ ] `wipfelkratzer-v1` and `wipfelkratzer-fotos` still load unchanged
      (toast state is not persisted, so this is a no-regression check, not
      a new behaviour).
- [ ] Headless Playwright pass shows zero uncaught page errors.

## Assumptions

- **A1** [high] Implemented as a client-side in-memory array of open
  toasts (`{id, msg}`), re-rendered into a DOM stack on every
  push/dismiss, rather than persisting toast state anywhere.
  Rejected: storing toasts in `state`/`localStorage`. `js/game.js:449-450`
  shows toasts are already pure transient UI state (`toastEl`, a module
  scope var), never part of the `save()`d `state` object.

- **A2** [med] A hard visible cap (`TOAST_MAX_VISIBLE = 5`) silently drops
  the oldest un-dismissed toast when exceeded, on top of the scrollable
  container.
  Rejected: unbounded queue relying on `max-height`/`overflow-y` alone.
  The issue explicitly calls out "mehrere offene Toasts dürfen den
  Bildschirm nicht zustellen" — a scroll region alone can still be
  scrolled to fully occlude the canvas on a small tablet, so a hard cap is
  the belt to the scrollbar's suspenders.

- **A3** [med] "Oder irgendwo reinklicken" (source quote) is implemented as
  tap-anywhere-on-that-one-toast-panel, not tap-anywhere-on-the-whole-
  screen.
  Rejected: a global document-level click listener that dismisses the
  topmost/all toasts. A whole-screen listener risks swallowing or
  double-firing alongside existing canvas tap handling used for
  build/edit-mode selection (e.g. `js/game.js:843-846`), which is exactly
  the kind of surprise interaction a buildless picture-book game for a
  10-year-old should avoid. Per-toast click is unambiguous and safe.

- **A4** [med] Dismissed toasts are removed immediately (no fade-out
  animation on close), while newly-added toasts still get a short fade/
  slide-in.
  Rejected: symmetric enter/exit animation. Keeping exit instant keeps the
  close interaction feeling snappy for a child tapping repeatedly through
  a backlog, and avoids a second timer-based removal path re-introducing
  the same "message disappears before it's read" risk the issue is about.

- **A5** [low] `#toast-clear-all` is a single small pill button placed at
  the top of the visible stack (DOM-first child, so it sits furthest from
  the toolbar given `column-reverse`), shown only once ≥2 toasts are open.
  Rejected: always-visible clear-all, or a swipe-to-dismiss gesture.
  Always-visible adds visual noise when there's nothing to clear; a swipe
  gesture is unnecessary complexity for a tap-first child UI and isn't
  requested by the issue.

## Consequences

- The old `.show`/opacity-transition CSS class on `#toast` disappears;
  any future code path that still sets `.classList` on a `#toast` element
  by id will silently no-op once `#toast` is renamed to `#toast-stack` —
  worth a repo-wide grep for `'toast'` id references beyond the 17 call
  sites already inventoried above before merging.
- Toasts no longer time out, so any call site relying on "it'll go away
  in ~3s" as an implicit pacing device (there is none identified, but
  worth flagging) now depends on the player or a later `dismissAllToasts()`
  call to clear the UI.
