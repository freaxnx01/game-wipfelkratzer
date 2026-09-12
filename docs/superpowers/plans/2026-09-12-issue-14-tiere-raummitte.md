# Plan: Tiere ziehen in die Raummitte statt an die Rückwand (Issue #14)

Repo: `freaxnx01/game-wipfelkratzer` · Branch: `main` · Spec:
`docs/superpowers/specs/2026-09-12-issue-14-tiere-raummitte.md`

Buildless: reine `js/game.js`-Änderung, keine neuen Dateien, keine
Abhängigkeiten, kein Build-Schritt.

## Task 1 — `tenantSpot(k)` implementieren

In `js/game.js`, direkt vor `spawnTenant` (um `js/game.js:616`), neue
Funktion einfügen:

```js
function tenantSpot(k) {
  const { w, d } = dims(k);
  const boxes = itemMeshes[k].filter(m => {
    const id = m.userData.pick.entry.id;
    return !DECO.has(id) && !WALL_ITEMS.has(id);
  }).map(m => new THREE.Box3().setFromObject(m));
  const cols = 5, rows = 3;
  let best = { x: 0, z: 0 }, bestScore = -Infinity;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + (c + 0.5) * w / cols;
    const z = -d / 2 + (r + 0.5) * d / rows;
    let minDist = Infinity;
    boxes.forEach(bb => {
      const dx = Math.max(bb.min.x - x, 0, x - bb.max.x);
      const dz = Math.max(bb.min.z - z, 0, z - bb.max.z);
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) minDist = dist;
    });
    if (minDist > bestScore) { bestScore = minDist; best = { x, z }; }
  }
  return best;
}
```

Notes:

- Uses local (parent-space) coordinates directly (same space as
  `cellPos`/furniture `entry.x`/`entry.z`), no world-matrix conversion
  needed since `Box3.setFromObject` on meshes already parented under
  `floorGroups[k]` produces boxes in the scene's shared coordinate
  frame that matches the mesh's local `x`/`z` when the floor group's
  own transform is a pure translation — verify this assumption in Task
  2's manual check; if boxes come out in world space and `floorGroups[k]`
  has a nonzero offset, convert candidate `(x, z)` to world space with
  `parentOf(k).localToWorld(...)` before comparing, mirroring
  `surfaceYAt` (`js/game.js:403-405`).
- `boxes.length === 0` naturally yields `bestScore = Infinity` for the
  first candidate and ties for all others at `Infinity` too — the loop
  keeps the first one only if `minDist > bestScore` (strict), so with
  no boxes every candidate scores `Infinity` and the very first grid
  point (`r=0,c=0`, a corner) would "win" by first-match. Fix before
  considering this task done: special-case `boxes.length === 0` to
  return the exact geometric centre `{ x: 0, z: 0 }` (matches spec
  AC2), rather than relying on grid-iteration order.

verify: `node --check js/game.js` (syntax only, buildless — no bundler
to run). Manual: open `index.html` in the already-supported dev flow,
place 0 furniture, call `tenantSpot(0)` from the browser console once
exposed (temporarily) or via Task 4's Playwright script, confirm it
returns `{x: 0, z: 0}`.

## Task 2 — Wire `tenantSpot` into `spawnTenant`

Replace the fixed back-wall placement in `spawnTenant`
(`js/game.js:616-629`):

```js
function spawnTenant(i, silent) {
  if (tenantGroups[i]) return;
  const t = TENANTS[i]; const g = new THREE.Group();
  g.userData = { type: 'tenant', floor: i };
  const spot = tenantSpot(i);
  t.animals.forEach((sp, n) => { const a = makeAnimal(sp);
    a.position.set(spot.x + (n - (t.animals.length - 1) / 2) * 0.55, baseY(i), spot.z);
    a.rotation.y = (n - 0.5) * 0.5;
    g.add(a); critters.push({ g: a, ph: i * 2 + n, base: baseY(i) }); });
  floorGroups[i].add(g); tenantGroups[i] = g;
  if (!silent) { toast(`${t.name} — eingezogen!`); sfx.chime();
    g.scale.setScalar(0.01); tween(0.5, q => g.scale.setScalar(0.01 + 0.99 * q)); }
  renderWishes(); renderResidents(); updateHUD();
}
```

Only the `d` destructure and the two-tier `a.position.set(...)` line
change; everything else in the function (toast, tween, `critters.push`,
`renderWishes`/`renderResidents`/`updateHUD`) stays untouched.

verify: `node --check js/game.js`. Manual smoke: fresh save, place 3
items away from centre, watch the tenant spawn animation land in the
room's free centre area instead of against the back wall.

## Task 3 — Headless Playwright: empty-room + centre-blocked cases

Write a throwaway test script (not committed as a repo test file unless
the repo already has a `tests/` runner — check first) that:

1. Serves the repo root on a free port in 8951-8955.
2. Launches Chromium with
   `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
3. Loads the page, opens floor 0's edit mode, places 3 small furniture
   items in the corners (leaving the centre clear) via the same
   `page.click` calls the existing UI uses (`timeout=20000`+).
4. Reads back the tenant group's world position via
   `page.evaluate(() => ...)` (expose `tenantGroups`/`critters` or read
   from the scene graph) and asserts it's near `(0, 0)` in local floor
   coordinates.
5. Repeats with 3 furniture items placed to straddle the centre and
   asserts the tenant position's bounding sphere does not intersect any
   furniture item's `Box3`.
6. Collects `page.on('pageerror', ...)` and `page.on('console', ...)`
   for `error` type throughout; asserts zero.

verify: script run exits 0, prints "0 uncaught page errors", both
position assertions pass. Stop the server by port afterwards
(`ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs kill`),
never `pkill -f`.

## Task 4 — Headless Playwright: existing-save backward compatibility

Extend or add to the same script:

1. Seed `localStorage['wipfelkratzer-v1']` (via
   `page.addInitScript` or `page.evaluate` before navigation, or
   `context.addCookies`-equivalent `storageState`) with a fixture
   representing a floor that already has >=3 furniture entries and no
   tenant-position data (matches current save shape — tenants are
   derived, not stored, per spec's "Nicht betroffen" section).
2. Load the page fresh, confirm the tenant for that floor renders (no
   uncaught errors), and that its position is the newly computed
   free-spot position, not the old back-wall position.
3. Assert zero uncaught page errors for the whole load.

verify: script exits 0, reports 0 uncaught errors, fixture-derived
tenant renders and is positioned away from the back wall (`z !==
-d/2 + 0.28` for that floor's `dims`).

## Task 5 — Manual/visual sanity pass

Take one screenshot per case from Tasks 3-4 (empty-centre,
centre-blocked, existing-save) using the project's existing screenshot
tooling if present (check `scripts/` in this repo first; if none
exists here, a plain Playwright `page.screenshot()` is enough — no new
tooling to build). Eyeball that animals look placed sensibly (not
clipped into furniture, not floating outside the room) — this is a
picture-book game, so a purely numeric bounding-box pass is not
sufficient sign-off on its own.

verify: screenshots exist, reviewer (or self) confirms no visual
furniture-clipping in any of the three cases.

## Out of scope (per spec)

- General furniture-vs-furniture collision in `clampEntry`
  (`js/game.js:415-426`) — unchanged.
- Persisting tenant position in `state`/`localStorage` — unchanged;
  position stays derived at spawn time.
