# Plan — Bewohner-Namen von Wohnungs-Bezeichnung trennen (Issue #15)

Repo: `game-wipfelkratzer`. Branch: `fix/issue-15-bewohner-namen`. Base: `main`
(v0.3.0). Buildless vanilla: `index.html` + `js/game.js` + `js/models.js`.
three.js r184 via importmap. No build step, no test framework.

Spec: `docs/superpowers/specs/2026-09-12-issue-15-bewohner-namen.md`.

## Global Constraints

- **German UI throughout.** Swiss spelling (`ss`, never `ß`).
- **Buildless.** No new dependencies, no build step, no npm, no test runner.
  ES modules only.
- **Persistence backward compatible.** `localStorage` keys `wipfelkratzer-v1`
  and `wipfelkratzer-fotos` must keep loading; this change touches no saved
  shape (`TENANTS` is static content, not persisted), but verify a v0.3.0
  save still loads without error.
- **Touch is first-class.** No interaction changes in this fix; confirm
  nothing regresses on a tablet-sized viewport.
- **Verification is headless Playwright** against a local
  `python3 -m http.server`, chromium with
  `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`. Every
  `page.click` needs `timeout=20000` or more. A `favicon.png` 404 is
  expected; assert on `pageerror` only. `window.wipfelkratzer` exposes the
  scene graph for `page.evaluate` assertions.

## Verification harness

Throwaway scripts go under
`.superpowers/sdd/2026-09-12-issue-15-bewohner-namen/` (git-ignored).

- Seeding `localStorage['wipfelkratzer-v1']` before load (10 floors built,
  all tenants moved in) is much faster than clicking «Stockwerk bauen» ten
  times, and is needed anyway to reach every tenant's speech bubble, the
  residents list, and the animal gallery in one run.
- Reaching a floor's speech bubble: click the tenant's animal mesh in edit
  mode, or `pg.mouse.click(...)` on the tenant group — cross-check with
  `tenantTalk`'s call sites (`js/game.js:867, 884`) for the exact ray-pick
  path used elsewhere in this codebase's own verification scripts
  (`.superpowers/sdd/2026-09-12-dach-treppe-und-feinschliff/` if still
  present, otherwise re-derive from `js/game.js`).
- Residents list: click `#btn-sign` (or the in-scene sign) →
  `#residents.open` → read `#resident-list` `li` text content.
- Edit-mode title: enter edit mode on a floor → read `#edit-title`
  `textContent`.
- Animal gallery: click `#btn-animals` → `#animals.open` → read
  `#animal-grid` `.acard` text content.

---

## Task 1 — Add `unit` field and rename resident names for indices 0 and 3

**Change**, `js/game.js:19-31` (`TENANTS` array):

- Index 0: `name: 'Kindergarten und Partyraum'` → `name: 'Die
  Kindergarten-Mäuse', unit: 'Kindergarten und Partyraum'`.
- Index 3: `name: 'Ferienwohnung für Hausmäuse'` → `name: 'Die
  Feriengäste', unit: 'Ferienwohnung für Hausmäuse'`.
- All other nine entries: unchanged, no `unit` field.

**verify:** `grep -n "unit:" js/game.js` shows exactly two matches, on the
kindergarten and Ferienwohnung entries. A quick `node -e` (or browser
`page.evaluate`) parse confirms `TENANTS.length === 11` and every other
entry's `name` is byte-identical to before the change (diff `TENANTS`
against `git show main:js/game.js` for indices 1,2,4-10).

---

## Task 2 — Route apartment-facing call sites through `t.unit || t.name`

**Change:**

- `js/game.js:548` (`enterEdit`, edit-mode title):
  `` `${flLabel(k)} — ${tenantIn(k) ? t.name : 'Wohnung einrichten'}` `` →
  `` `${flLabel(k)} — ${tenantIn(k) ? (t.unit || t.name) : 'Wohnung einrichten'}` ``
- `js/game.js:662` (`renderResidents`, residents list):
  `` `<b>${TENANTS[i].name}</b>` `` →
  `` `<b>${TENANTS[i].unit || TENANTS[i].name}</b>` ``

Leave every other `t.name` / `TENANTS[i].name` read untouched
(`js/game.js:626, 702, 829, 844` — move-in toast, animal gallery, speech
bubble, tip toast). These already read the resident-facing field; only the
underlying data was wrong for two entries, fixed by Task 1.

**verify:** `grep -n "\.name\b" js/game.js` still shows exactly six
tenant-name reads (the two now changed to `unit || name`, the four
untouched) — no stray seventh call site missed or extra one introduced.

---

## Task 3 — End-to-end verification pass

Run one Playwright script covering all four consumer surfaces for the two
changed entries (indices 0 and 3) plus a spot-check on two unchanged entries
(e.g. index 6 "Lisa Feldmaus", index 8 "Familie Feldhamster") to prove no
regression:

- **Speech bubble** (`tenantTalk`): for index 0, bubble text starts with
  "Die Kindergarten-Mäuse"; for index 3, "Die Feriengäste"; never
  "Kindergarten und Partyraum" / "Ferienwohnung für Hausmäuse" as the bubble
  subject.
- **Move-in toast**: seed a save with index 0/3 not yet moved in, place the
  3rd furnishing piece, assert the toast text for that spawn uses the new
  `name`, not the old apartment-label string.
- **Tip toast**: with index 0 or 3's floor open in edit mode and fewer than
  3 items placed, click `#btn-tip`, assert the toast names the resident
  (`t.name`), not the apartment.
- **Residents list**: open via `#btn-sign`, assert floor 0's row and floor
  3's row read "Kindergarten und Partyraum" / "Ferienwohnung für
  Hausmäuse" respectively — i.e. `t.unit`, unchanged from pre-fix player
  experience.
- **Edit-mode title**: enter edit mode on floor 0 (after move-in) and floor
  3, assert `#edit-title` shows the apartment label, not the resident name.
- **Animal gallery**: open via `#btn-animals`, assert the cards for indices
  0 and 3 show the new resident names ("Die Kindergarten-Mäuse", "Die
  Feriengäste"), and cards for two unchanged indices are byte-identical to
  their `TENANTS[].name`.
- **Regression spot-check**: for indices 6 and 8 (unchanged entries), all
  four surfaces show the same single `name` value as before — residents
  list and edit-title fall back to `t.name` correctly (no `unit`).
- **Save compatibility**: load a `wipfelkratzer-v1` value seeded in the
  v0.3.0 shape (no `unit`-related keys, since `TENANTS` isn't persisted) and
  confirm no `pageerror` and normal rendering.
- Zero `pageerror` events through the whole run.
- Screenshot: the speech bubble open on the kindergarten apartment's floor,
  and the residents list panel open.

**verify:** the Playwright script exits 0, prints the assertions above as
passed, and the two screenshots are saved under the throwaway harness
directory.

---

## Out of scope

Renaming or restructuring any of the other nine `TENANTS` entries; any
change to `wish`, `roofWish`, `animals`, or floor assignment; the wishes
panel (`renderWishes`, already correct — reads `wtext`); any i18n or
content-data refactor beyond this issue. Discoveries go in `TODO.md` or a
new issue, not into this branch.
