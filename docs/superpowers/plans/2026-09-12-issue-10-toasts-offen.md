# Plan: Toasts bleiben offen und sind schliessbar

Issue: `freaxnx01/game-wipfelkratzer#10`
Spec: `docs/superpowers/specs/2026-09-12-issue-10-toasts-offen.md`

Buildless, ES modules only, three.js r184 via importmap — no new
dependencies, no build step. All work is in `index.html` (markup + inline
`<style>`) and `js/game.js`.

## 1. Replace `#toast` markup with a stack container

In `index.html`, replace `<div id="toast" class="panel"></div>`
(`index.html:227`) with `<div id="toast-stack"></div>` plus a hidden
`<button id="toast-clear-all" class="hidden">Alle schliessen</button>`.
verify: `grep -n 'id="toast' index.html` shows `toast-stack` and
`toast-clear-all`, no bare `id="toast"` left.

## 2. Replace `#toast` CSS with stack + item + close-button rules

In `index.html` `<style>`, replace the `#toast`/`#toast.show` block
(`index.html:123-125`) with `#toast-stack`, `.toast-item`, `.toast-close`,
`#toast-clear-all`, and a `@keyframes toast-in` per the spec's Styling
section (bottom offset via `var(--toolbar-h, 60px)`, `max-height` +
`overflow-y: auto`, `.toast-close`/`#toast-clear-all` both
`min-width/min-height: 44px`).
verify: open the game in a browser at ≤360px width, confirm visually the
stack sits above `#toolbar` with no overlap; `grep -n toolbar-h index.html`
shows both `#selbar` and `#toast-stack` referencing the same variable.

## 3. Replace the `toast()` implementation with a queue + renderer

In `js/game.js`, replace `const toastEl = $('toast'); let toastT = 0;
function toast(msg) { ... }` (`js/game.js:449-450`) with:
- module state `let toasts = []; let toastSeq = 0;` and a
  `TOAST_MAX_VISIBLE = 5` constant,
- `toast(msg)` — pushes `{id: ++toastSeq, msg}`, drops the oldest entry
  past `TOAST_MAX_VISIBLE`, calls `renderToasts()`,
- `dismissToast(id)` — filters `toasts`, calls `renderToasts()`,
- `dismissAllToasts()` — clears `toasts`, calls `renderToasts()`,
- `renderToasts()` — rebuilds `#toast-stack` children from `toasts`
  (newest last, matching `column-reverse` layout), wiring each
  `.toast-close` and the toast body itself to `dismissToast(id)`, and
  toggling `#toast-clear-all`'s `.hidden` class based on
  `toasts.length >= 2`, wired once to call `dismissAllToasts()`.
No other call site changes — `toast(msg)`'s signature and every one of the
17 existing call sites (`js/game.js:400,582,626,643,681,682,687,690,692,
695,728,755,757,843,844,845,846,875,902,908,1001,1011`) stay untouched.
verify: `grep -n 'toastT\|clearTimeout(toastT)' js/game.js` returns
nothing; `grep -n 'function toast(' js/game.js` still shows a single
one-argument `toast(msg)`.

## 4. Manual/headless smoke pass

Serve the repo root headlessly on a port in 8986–8990 and drive it with
Playwright (or the repo's existing manual-playtest gate per `SKILL.md`):
- trigger at least two `toast()` calls back-to-back (e.g. build a floor,
  then open the tip button) and confirm both remain visible and stacked,
- tap one toast's × and confirm only it closes,
- tap a second toast's body (not its ×) and confirm it also closes,
- push toasts past `TOAST_MAX_VISIBLE` and confirm the stack scrolls
  instead of covering the toolbar, and the oldest is silently dropped,
- with ≥2 toasts open, confirm "Alle schliessen" appears and clears the
  queue,
- reload with a pre-existing `wipfelkratzer-v1`/`wipfelkratzer-fotos`
  value in `localStorage` and confirm it still loads.
verify: zero uncaught page errors in the Playwright run's console log;
all bullets above observed passing. Stop the server by port only
(`ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs kill`),
never `pkill -f`.

## 5. Version bump + changelog

Per this repo's browser-game conventions (`CLAUDE.md` / `.ai/stacks/
browser-game.md`), bump `version.js`'s `VERSION`/`window.GAME_GAME_VERSION`
pair and add a `CHANGELOG.md` entry under `fix(ui)` for this change once
step 4 is green.
verify: `version.js` matches the new git tag that will be cut for this
fix; `CHANGELOG.md`'s new entry references issue #10.
