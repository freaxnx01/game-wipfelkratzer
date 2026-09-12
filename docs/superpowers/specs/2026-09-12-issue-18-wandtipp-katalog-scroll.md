# Spec — Wand-Tipp scrollt den Katalog zurück nach oben (Issue #18)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0). Buildless vanilla:
`index.html` + `js/game.js` + `js/models.js`. three.js r184 via importmap. No
build step, no test framework.

## Problem

`pointerup`'s wall-tap handling (`js/game.js:869-876`) branches on `catTab`:

```js
const wallKey = pickWall();
if (wallKey) { deselect();
  if (catTab === 'farbe') { setWallTarget(wallKey);
    $('catalog').classList.add('open'); sfx.pop();
    toast(`Wand «${WALL_LABELS[wallKey]}» ausgewählt — jetzt eine Tapete antippen.`);
  } else { setWallTarget(wallKey); }
  return; }
```

Both branches call `setWallTarget(wallKey)` (`js/game.js:393`):

```js
function setWallTarget(key) { wallTarget = key; highlightWalls(); renderCatalog(); }
```

`renderCatalog()` (`js/game.js:480-506`) unconditionally clears and rebuilds
`#catalog-tabs` and `#catalog-items`, regardless of which tab is active.
Rebuilding `#catalog-items` resets its scroll position to the top.

Outside the «Tapete» (`farbe`) tab, tapping a wall is a no-op from the
player's point of view — nothing visibly changes, no toast fires — but the
`else` branch's `setWallTarget` call still rebuilds the currently-open
catalog (e.g. «Möbel»), snapping its scroll back to the top. This is the
same class of regression fixed in #8: a player browsing «Möbel», tapping
near an item to deselect it (which also hits a wall panel), loses their
scroll position.

## Verifying the issue's suspected fix

The issue proposes replacing the `else` branch's `setWallTarget(wallKey)`
call with a direct `wallTarget = wallKey` assignment, on the grounds that
outside «Tapete» both `highlightWalls()` and the catalog re-render are
no-ops. Checked against the code:

- **`highlightWalls()` (`js/game.js:385-392`)** computes, per floor,
  `lit = edit && edit.k === i && catTab === 'farbe'` and only lights a wall
  panel when `lit` is true. The `else` branch is reached exactly when
  `catTab !== 'farbe'` (the `if` branch already claims the `farbe` case), so
  `lit` is `false` for every floor on every call from this branch — `on` is
  always `false`, and every panel's emissive is set to `0x000000`, which is
  already its resting state. No visible change. **Confirmed no-op.**
- **`renderCatalog()`'s dependency on `wallTarget`**: the only place
  `renderCatalog()` reads `wallTarget` is the wall-picker button list inside
  the `catTab === 'farbe'` branch (`js/game.js:495-502`, the `b.className =
  key === wallTarget ? 'on' : ''` line). That code path is skipped entirely
  when `catTab !== 'farbe'`, so a stale `wallTarget` in the DOM is not
  possible while on another tab. **Confirmed the re-render buys nothing
  useful here** — it does, however, reset scroll, which is the bug.
- **Does anything else in `setWallTarget` matter?** No — the function body
  is exactly `wallTarget = key; highlightWalls(); renderCatalog();`; nothing
  else runs.
- **Staleness after switching back to «Tapete»**: when the player later taps
  the «Tapete» tab button, its own `onclick`
  (`b.onclick = () => { catTab = id; highlightWalls(); renderCatalog(); }`,
  `js/game.js:487`) re-renders and re-highlights using the *current*
  `wallTarget` — which the direct assignment already updated. So the wall
  selection is picked up correctly the next time it becomes visible.

**Conclusion: the issue's suspected fix holds.** Assigning `wallTarget =
wallKey` directly in the `else` branch, instead of calling
`setWallTarget(wallKey)`, removes the unwanted catalog re-render (and its
scroll reset) with no loss of correctness.

## Fix

In the `else` branch of the wall-tap handler (`js/game.js:876`), replace
`setWallTarget(wallKey);` with `wallTarget = wallKey;`.

## Acceptance Criteria

- Tapping a wall while the catalog is open on a tab other than «Tapete»
  (e.g. «Möbel») no longer resets that tab's scroll position.
- Tapping a wall while the catalog is open on «Tapete» is unchanged: the
  wall is selected, highlighted, the wall picker's `on` button updates, and
  the toast fires as before.
- Switching to the «Tapete» tab after a wall-tap taken on another tab shows
  the correct wall pre-selected in the picker (no staleness).
- Zero uncaught page errors (`pageerror`) in headless verification.

## Assumptions

- **A1** [low] No behavioural change intended for the `catTab === 'farbe'`
  branch — only the `else` branch changes. `js/game.js:872-875` (the `if`
  branch) is untouched.

## Out of scope

- Any change to `setWallTarget`, `highlightWalls`, or `renderCatalog`
  themselves — the fix is a one-line call-site change in the `pointerup`
  handler.
- Any other scroll-reset regression not caused by this call site (none
  found during this investigation).
