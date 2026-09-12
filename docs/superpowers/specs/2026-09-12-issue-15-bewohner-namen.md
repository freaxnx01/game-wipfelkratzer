# Spec — Bewohner-Namen von Wohnungs-Bezeichnung trennen (Issue #15)

Repo: `game-wipfelkratzer`. Base: `main` (v0.3.0).
Buildless vanilla: `index.html` + `js/game.js` + `js/models.js`. three.js r184 via
importmap. No build step, no test framework.

## Problem

`TENANTS[].name` (`js/game.js:19-31`) is overloaded with two different jobs:

- an **apartment label** for two entries — `'Kindergarten und Partyraum'`
  (index 0), `'Ferienwohnung für Hausmäuse'` (index 3)
- a **resident name** for the other nine — `'Lisa Feldmaus'`,
  `'Familie Feldhamster'`, etc.

Four call sites all read the same field for different purposes:

1. **Speech bubble** (`tenantTalk`, `js/game.js:825-829`) builds
   `<b>${t.name}</b><br>${status}`, so an apartment-label entry produces
   «**Kindergarten und Partyraum** ist glücklich und zufrieden!» — a sentence
   whose subject is a room, not a resident. This is the reported bug
   (screenshot in the issue).
2. **Move-in / tip toasts** (`spawnTenant`, `js/game.js:626`; `btn-tip` handler,
   `js/game.js:844`) — same problem: "Kindergarten und Partyraum —
   eingezogen!" instead of naming who moved in.
3. **Residents list** (`renderResidents`, `js/game.js:657-664`, opened via the
   sign, `btn-sign` → `js/game.js:696`) and **edit-mode title**
   (`enterEdit`, `js/game.js:548`) want the apartment-facing label — for the
   two special-purpose apartments that *is* "Kindergarten und Partyraum" /
   "Ferienwohnung für Hausmäuse"; for the other nine, the resident's own
   name already reads fine as the "who lives here" label (a private
   apartment's nameplate is the resident's name — no separate label needed).
4. **Animal gallery** (`renderAnimals`, `js/game.js:697-707`, opened via
   `btn-animals`) pairs the critter thumbnail with `t.name` and is a
   "who's who" catalog — resident-name register, like the speech bubble.

## Goals

- Every place that speaks *as* or *about* a specific resident (speech bubble,
  move-in toast, tip toast, animal gallery) uses a resident name that reads
  naturally as the subject of "... ist glücklich und zufrieden!" / "... ist
  eingezogen!" / "... wünscht sich ...".
- Every place that labels *an apartment as a space* (residents list, edit-mode
  title) shows an apartment label where one exists, falling back to the
  resident name where the apartment has no separate identity (the normal
  case — nine of eleven).
- No new data duplication beyond what's needed: only the two apartments that
  are genuinely spaces-not-people (kindergarten, holiday flat) get a distinct
  label field; the other nine keep a single field doing both jobs, which is
  correct, not a shortcut.
- Invented resident names for the two affected entries sound at home next to
  the existing `wtext` register and the book's cast (*Willi baut*, Pixi).

## Non-goals

- Rewriting or renumbering the `TENANTS` array beyond the two entries this
  issue is about.
- Changing `wish`, `roofWish`, `animals`, or floor assignment.
- Touching any other tenant-consuming feature (wishes list `renderWishes`,
  `js/game.js:648-656`, already reads `t.wtext`, not `t.name` — untouched).
- A general i18n/content-data refactor. This is a two-field, two-entry fix.

## Design

Add an optional field, **`unit`**, to `TENANTS[]` entries that name a space
rather than a person. Only indices 0 and 3 get it. All eleven entries keep
`name` as a resident-facing name.

```js
{ name: 'Die Kindergarten-Mäuse', unit: 'Kindergarten und Partyraum',
  animals: ['maus', 'maus'], wish: 'klavier',
  wtext: 'Die Kindergarten-Mäuse wünschen sich ein Klavier.' },
...
{ name: 'Die Feriengäste', unit: 'Ferienwohnung für Hausmäuse',
  animals: ['maus'], wish: 'etagenbett',
  wtext: 'Die Feriengäste hätten gern ein Etagenbett.' },
```

Both new `name` values are lifted directly from the existing `wtext` for that
entry (`'Die Kindergarten-Mäuse wünschen sich...'`,
`'Die Feriengäste hätten gern...'`) — same register, zero invention risk,
and `wtext` already reads correctly as "resident speaking."

**Call sites, by which field they read:**

| Site | Field | Change |
|---|---|---|
| `tenantTalk` bubble, `js/game.js:829` | `t.name` | none (already correct field, was showing the wrong *value* for 2 entries — fixed by the data change) |
| Move-in toast, `js/game.js:626` | `t.name` | none |
| Tip toast, `js/game.js:844` | `t.name` | none |
| Animal gallery, `js/game.js:702` | `t.name` | none |
| Residents list, `js/game.js:662` | `t.name` | → `t.unit \|\| t.name` |
| Edit-mode title, `js/game.js:548` | `t.name` | → `t.unit \|\| t.name` |

So the fix is: two data edits (add `unit`, rename `name` for indices 0 and 3)
plus two one-line call-site edits (`t.name` → `t.unit || t.name`) at the two
places that want the apartment-facing label. The other four call sites need
no code change — they were already reading the right field; only the data
was wrong for two of eleven entries.

## Acceptance Criteria

- Speech bubble for the kindergarten apartment reads "Die Kindergarten-Mäuse
  ist/sind ..." register-consistent with `wtext`, never "Kindergarten und
  Partyraum ist ...".
- Same for the holiday-flat apartment ("Die Feriengäste ...").
- Move-in toast and tip toast for both entries use the new resident names,
  not the old apartment-label strings.
- Residents list (opened via the sign) still shows "Kindergarten und
  Partyraum" and "Ferienwohnung für Hausmäuse" at their respective floors —
  unchanged from the player's point of view.
- Edit-mode title bar still shows "Kindergarten und Partyraum" /
  "Ferienwohnung für Hausmäuse" when editing those floors — unchanged.
- All nine other entries are pixel-for-pixel unchanged in every UI surface
  (no `unit` field added, no visible text changes).
- A `wipfelkratzer-v1` save from v0.3.0 (no schema change involved, but
  confirm) still loads without error.
- Zero uncaught page errors through a full playthrough touching all four
  consumer surfaces (bubble, toasts, residents list, animal gallery) for at
  least the two changed entries.

## Assumptions

- **A1** [high] Implemented as a new optional `unit` field on `TENANTS[]`,
  present only on the two space-labeled entries (indices 0, 3), with `t.unit
  || t.name` at the two apartment-facing call sites.
  Rejected: renaming `name`→`name`+`label` on all eleven entries. `wtext` at
  `js/game.js:22,26-29` shows the other nine entries' names already read
  correctly as resident names in every context, so giving them a second
  field would be pure duplication with no behavioural difference.

- **A2** [med] Chose `'Die Kindergarten-Mäuse'` and `'Die Feriengäste'` as
  the new resident-facing names, lifted verbatim from the existing `wtext`
  wording rather than inventing new proper names.
  Rejected: inventing named individuals (e.g. "Mia und Momo Kindergarten-Maus")
  in *Willi baut* style. The owner may prefer named characters for these two
  slots to match the rest of the cast — flagging as `[med]` since `wtext` at
  `js/game.js:20,23` ("Die Kindergarten-Mäuse wünschen sich...", "Die
  Feriengäste hätten gern...") already establishes a collective-not-named
  voice for exactly these two, so reusing it is the lower-risk, most
  internally-consistent choice, but it is a place where a human author might
  reasonably choose differently.

- **A3** [high] `js/game.js:548` (edit-mode title) and `js/game.js:662`
  (residents list) are the only two call sites changed to `t.unit ||
  t.name`; the other four (`js/game.js:626, 702, 829, 844`) are left
  reading `t.name` unchanged.
  Rejected: routing all six call sites through a single new helper function.
  Not needed for two one-line changes, and a helper would hide which
  call sites are semantically "space" vs "person" reads — the distinction
  is the whole point of this issue.

## Consequences

- The `unit` field is new surface area on the `TENANTS` schema; any future
  tenant that is itself a space (not a person/family) should follow the same
  pattern (`name` = resident voice, `unit` = space label) rather than
  reintroducing the overload this issue fixes.
- `docs/design-handoff.md`'s design reference does not model `TENANTS` data
  shape explicitly, so no update needed there.
