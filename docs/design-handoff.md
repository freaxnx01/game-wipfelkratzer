# Handoff: Wipfelkratzer — 3D-Bauspiel für Kinder

## Overview
A browser-based 3D building & interior-decoration game for a 10-year-old, based on the German children's book *"Willi baut"* (Pixi Büechli). The player builds a wooden tower ("Wipfelkratzer" — *treetop scratcher*) floor by floor on a platform in a forest, furnishes each apartment, and animal tenants from the book move in and voice wishes. Fulfilling a wish earns hazelnuts. At 10 floors, the roof terrace can be furnished (pool, sun loungers, lanterns) and a night-time roof party can be triggered.

Everything runs client-side, no build step, no backend. Language throughout is **German**.

## About the Design Files
The files in this bundle are a **working design reference created in HTML + three.js** — a functional prototype that demonstrates the intended look, feel, and behavior. They are **not** production code to copy verbatim.

The task is to **recreate this experience in the target codebase's environment** using its established patterns (e.g. React + react-three-fiber, Vue + TresJS, Godot, Unity, or plain three.js in a bundled TS project). If no environment exists yet, pick the most appropriate one for a small 3D web game — react-three-fiber or a plain Vite + TypeScript + three.js setup are both good fits. The geometry-construction code in `js/models.js` is the most directly reusable part and can be ported near-verbatim; the game logic in `js/game.js` is written as one imperative module and should be restructured into proper modules/stores in the target environment.

## Fidelity
**High-fidelity, functional prototype.** All colors, proportions, animations, copy, and interactions are final-intent. Recreate faithfully. The hand-drawn/picture-book look is achieved deliberately through:
- `MeshLambertMaterial` only (no PBR, no metalness/roughness) — flat, illustrative shading
- Chunky, low-poly primitives (boxes, spheres, cylinders) — never imported meshes
- Warm, desaturated palette; no pure black or pure white
- Slight per-floor random offsets and rotations so the tower looks hand-built, not CAD-perfect
- Soft `PCFSoftShadowMap` shadows, hemisphere + single directional light

Do not substitute realistic materials, PBR lighting, or photographic textures.

---

## Screens / Views

There is a single continuous 3D scene with overlaid HTML/CSS UI panels. There is no page navigation.

### 1. Intro overlay
- **Purpose**: title card + how-to; also the user gesture that unlocks WebAudio.
- **Layout**: full-viewport scrim `rgba(74,58,36,.45)`, centered panel `min(440px, 92vw)`, padding `24px 28px`, text centered.
- **Content**:
  - H1 (30px, `--wood`): "Willi baut den Wipfelkratzer"
  - P: "Hilf Willi Biber, den Wipfelkratzer zu bauen — Stock für Stock, bis ganz oben!"
  - P: "Tippe auf ein Stockwerk, um die Wohnung einzurichten. Wenn eine Wohnung schön ist, ziehen Tiere ein — und die haben Wünsche!"
  - P (14px, opacity .8): "Tipp: Möbel antippen, dann mit den Pfeiltasten schieben und mit Bild↑/Bild↓ drehen. Der Pool wartet im Katalog unter «Dach»."
  - Primary button: "Los geht's!" (20px, padding `8px 32px`) → hides overlay, calls `initAudio()`.

### 2. 3D scene (always present)
- **Camera**: `PerspectiveCamera(48°)`, start `(13, 9.2, 18)`, OrbitControls target `(0, 5.0, 0)`, damping `.09`, **pan disabled**, `minDistance 4`, `maxDistance 44`, polar clamped `0.12 … 1.52` (can't go under the ground).
- **Lighting**: `HemisphereLight(0xfff4da, 0x9dbb7a, 1.05)` + `DirectionalLight(0xffe8c0, 1.15)` at `(14, 22, 10)`, shadow map 1024², ortho frustum `l/r ±20, t 32, b -6, far 90`.
- **Sky/fog**: day `#cfe3c2`, night `#18294e`; `Fog(color, 45, 110)`.
- **Ground**: `CircleGeometry(70)` in `#8fbb6e`, laid flat.
- **River**: a hand-built ribbon mesh following `z(x) = 9 + sin(x·0.18)·2.4` across `x ∈ [-60, 60]`, drawn three times at increasing y: sand bank (width 5.6, y .02, `#c9b083`), water (3.6, y .045, `#5aa7c7`), highlight (1.5, y .06, `#7fc4dd`).
- **Forest**: 60 tall trees (height 11–24) at radius 17–43, plus 22 short trees at radius 13–25. Two exclusion rules: skip if within 4.5 of the river centerline, within 5.5 of the garden spot, **and skip if `z > 3 && |x| < 16`** — this keeps a clear viewing corridor in front of the tower. Trees beyond radius 27 have shadow casting disabled for performance.
- **Beaver lodge (dam)**: at `(-7, 0, riverZ(-7) - 1.2)`, rotated `.6`. A flattened dome plus 28 sticks placed on a golden-angle spiral (`a = i·2.399`) oriented tangentially, plus 3 thick logs. Clickable.
- **Willi (the beaver)** at `(-3.8, 0, 4.8)`, rotation `.5`, scale `1.25`. Idle bob + hammer arm animation. Clickable.
- **Sign** at `(4.8, 0, 5.6)`, rotation `.45` — a canvas-textured wooden board reading "Wipfelkratzer" / "Firma Biberzahn". Clickable → opens residents list.
- **Magpie ("Else")** circles the tower continuously carrying a small red bucket: radius `10 + floors·0.4`, angular speed `0.3 rad/s`, height `topY() + 2.6 + sin(t·0.7)·0.4`, wings flap at `sin(t·9)`.
- **Bridge** (hidden until built) at `(8.7, 0.08, riverZ(8.7))`, rotated 90°.
- **Garden/playground** (hidden until built) at `(-8, 0, 2)`, rotation `.5` — swing, slide, sandbox, raised beds, flowers.

### 3. HUD (top-left, `#hud`)
Three stacked cream panels: title "Willi baut den Wipfelkratzer" (18px), hazelnut counter (nut icon + "N Haselnüsse"), floor counter "Stockwerke: N / 10".

### 4. Toolbar (bottom-center, `#toolbar`)
Wrapping flex row, gap 10px:
| Button | Behavior |
|---|---|
| **Stockwerk bauen (n/10)** (primary green) | Builds next floor; disabled at 10 or while editing |
| **Einrichten** | Toggles the catalog; toasts a hint if no floor is focused |
| **Extras** | Toggles the extras popover |
| **Nacht / Tag** | Toggles day/night over a 1.2 s tween |
| **Wände weg / Wände hin** | Cutaway mode — hides all front walls, book-style cross-section |
| **Musik aus / Musik an** | Mutes the generative music (SFX stay on) |

### 5. Extras popover (`#extras-menu`, above the toolbar)
Vertical panel, 260px: **Brücke bauen**, **Garten & Spielplatz**, **Bewohner-Schild**, **Tier-Übersicht**, **Dachparty feiern!** (hidden until 10 floors + top tenant present), **Neu anfangen** (danger; requires a second click within 4 s, label changes to "Wirklich alles löschen?").

### 6. Edit mode
Entered by tapping a built floor or the roof.
- Camera flies to a front-on view of that floor over 0.9 s (smoothstep easing); the previous camera pose is saved and restored on exit.
- All floors **above** the edited one are hidden; the roof is hidden; that floor's **front wall and ceiling** are hidden.
- **Edit bar** (top-center): floor label + tenant name ("3 — Familie Siebenschläfer") or "Wohnung einrichten", a **Tipp** button, and a primary **Fertig** button.
- **Catalog drawer** (right, `min(320px, 88vw)`, full height): tab pills + a 3-column grid of item cards. Each card shows a **runtime-rendered thumbnail** of the actual 3D model (rendered once at startup into a 160² offscreen WebGL renderer, stored as a data URL) plus the German name.
- **Selection bar** (above the toolbar, shown when an object is selected): **Verschieben** (jump to next free grid cell), **Drehen** (90° step), **Weg damit** (delete).

### 7. Residents dialog (`#residents`)
Modal over a scrim. Lists floors 10 → E; each row is a floor badge + either the tenant name (bold), "zurzeit frei" (italic, faded), or "noch nicht gebaut".

### 8. Animal overview (`#animals`)
Modal, `min(580px, 94vw)`. Auto-fill grid of cards `minmax(150px, 1fr)`: rendered portrait of the tenant group, name, "Stock N", and either green "Eingezogen!" or "wartet noch auf die Wohnung".

### 9. Speech bubble (`#bubble`)
World-anchored HTML bubble (projected each frame from the target's world position), `border-radius: 16px 16px 16px 4px`, containing a 52px circular rendered portrait plus text. Used by Willi (6 rotating lines from the book), the beaver lodge (3 lines), and tenants (name + current wish/status). Auto-hides after 4–5 s.

### 10. Toast (`#toast`)
Bottom-center panel, fades in/out (opacity + 20px translate, .3 s), auto-hides after 2.8 s.

---

## Interactions & Behavior

### Building
`Stockwerk bauen` → `state.floors++`, the floor group becomes visible and scales `scaleY 0.01 → 1` over 0.7 s. Three hammer knocks fire at 0 / 240 / 500 ms; Willi's arm swings at `sin(t·16)` for 1.4 s. Camera lifts slightly and re-targets. At floor 10: "Der Wipfelkratzer ist fertig! Schau aufs Dach!"

### Furnishing
- Tapping a floor enters edit mode. Tapping an item selects it (red `BoxHelper`). Tapping empty space deselects.
- Adding an item: spawns at the next free grid cell, scales in over 0.35 s, and is **immediately selected**.
- **Décor items** (`vase, teekanne, kerze, buecher, nussschale`) auto-land on a surface: if a table/shelf/wardrobe/piano/nut-crate is currently *selected*, they land on it; otherwise on the first available surface. Their y is computed by `surfaceYAt()`, which world-space-tests the décor's xz against every non-décor item's bounding box and picks the highest top face below y = 1.8.
- **Keyboard** (edit mode, item selected): arrows move ±0.12 in x/z, `PageUp`/`PageDown` rotate ±15°, `Delete` removes. Décor re-computes its resting height on every move.
- **Wall clamping**: `clampEntry()` measures the item's actual bounding box and clamps its center so the item touches but never intersects the wall — re-applied after every rotation, so a bookshelf can sit flush against the wall at any angle.
- Grid: `colsOf(k) = max(3, floor(roomWidth / 0.95))` columns × 2 rows; used only for initial placement and the "Verschieben" button.

### Tenants & wishes
- A tenant moves in as soon as a floor holds **≥ 3 items**. The tenant group scales in, a chime plays, and a toast announces them.
- Each tenant has one wish (a specific catalog item). The frog tenant on floor 10 wishes for the **pool on the roof** (`roofWish: true`).
- Open wishes render as clickable cards in the top-right `#wishes` stack; clicking one flies straight to that room.
- Fulfilling a wish: +3 hazelnuts, toast "Wunsch erfüllt! +3 Haselnüsse", celebratory chime (plus a splash for the pool).

### Day / night
1.2 s tween over `nightK ∈ [0,1]`, lerping sky, fog, hemisphere colors, and light intensities (`hemi 1.05 → 0.43`, `dir 1.15 → 0.15`). Stars (260 points) and the moon fade in. Windows of **occupied** floors switch to emissive `#ffc257`.

### Party (10 floors + top tenant)
Forces night, shows 7 glowing lanterns along the roof railing, spawns one dancing animal per tenant animal on the roof (bobbing at `|sin(t·4.5 + phase)|·0.22`, spinning), switches the music to a faster "party" track, and flies the camera to the roof.

### Persistence
Full state (`floors, rooms, nuts, bridge, garden, night, cutaway, fulfilled`) is debounced-saved (300 ms) to `localStorage` under `wipfelkratzer-v1` and restored on load. Legacy entries without `x/z` coordinates are migrated from the old cell index on load.

### Audio (WebAudio, fully synthesized — no audio files)
- Master gain .55 → lowpass 5.2 kHz → destination.
- A scheduler ticks every 140 ms and schedules notes 0.5 s ahead. Two "songs": `day` (triangle wave, 0.42 s beat, pentatonic-ish melody + bass) and `party` (square wave, 0.21 s beat).
- SFX: `pop` (rising sine 320→680 Hz), `knock` (88 Hz triangle + filtered noise burst), `chime` (880/1108/1318/1760 Hz arpeggio), `splash` (noise, 2.8 kHz → 260 Hz), `whoosh` (noise, rising).

### Responsive
`< 640px`: smaller HUD title (15px), smaller buttons, wish stack moves to the bottom-left above the toolbar. Touch works via pointer events; `touch-action: none` on the canvas; a tap is a pointerup within 8px and 400ms of pointerdown.

---

## State Management

```js
state = {
  floors: 0,             // 0…10 (0 = ground floor "E", always present)
  rooms: {               // key: floor index or 'roof'
    "3": [ { id, cell, x, z, y, rot } ],
  },
  nuts: 0,
  bridge: false, garden: false, night: false, cutaway: false,
  fulfilled: { "3": true },   // floor index → wish fulfilled
}
```
Transient (not persisted): `edit` (`{k}` — current room), `selected` (picked item), `party`, `nightK`, tween queue, camera save.

Derived: `tenantIn(i) = i <= floors && rooms[i].length >= 3`; `topY() = 2.2 + 2.4 + floors·2.0`.

---

## Design Tokens

### UI colors
| Token | Value |
|---|---|
| `--wood` | `#8a5a2b` |
| `--woodL` | `#b9854e` (all panel/button borders) |
| `--cream` | `#fdf4e0` (panel background) |
| `--ink` | `#4a3a24` (text) |
| `--accent` | `#c0432e` (danger, selection helper) |
| `--green` | `#568b49` (primary buttons) |
| item card bg | `#fff9ec`, active `#ffe9bd` |
| tab pill active | `--green` on white |

### 3D palette (`MAT` in `models.js`)
`plaster #f3e2bd` · `plasterIn #f8ecd0` · `wood #b9854e` · `woodD #8a5a2b` · `woodL #d8b078` · `leaf #77aa5c` · `leafD #568b49` · `red #c0432e` · `blue #3f6fb5` · `orange #e08a3c` · `cream #fdf4e0` · `white #f6f2e8` · `grey #9a8f86` · `dark #4a4038` · `water #5aa7c7` · `black #2b2b2b` · `gold #d9973f` · `glow #ffd98a` (emissive `#ffc257`) · `fire #ff9a3c` (emissive `#ff7a20`) · `terra #b56a45` · `green2 #8fb96a` · `pink #e6a0b8` · ground `#8fbb6e` · sand `#c9b083`

### Typography
**Baloo 2** (Google Fonts, weights 500/600/700) everywhere. Sizes: H1 18px (HUD) / 30px (intro), body 15–17px, buttons 16px (14px mobile), item labels 12.5px, wish cards 14px.

### Geometry constants
`PLAT_Y 2.2` (platform height) · `E_H 2.4` (ground floor) · `FLOOR_H 2.0` · `MAXF 10` · width `W(i) = i===0 ? 8.6 : 7.6 - (i-1)·0.3` (tapers upward) · depth `D(i) = i===0 ? 5.6 : 5.0 - (i-1)·0.12` · roof `6.6 × 4.8`.

### Spacing / radii / shadows
Panels: border `3px solid var(--woodL)`, radius 16px, shadow `0 4px 14px rgba(74,58,36,.25)`. Buttons: radius 14px, min-height **48px** (44px in the selection bar — touch targets), hard shadow `0 3px 0 <border-color>` that collapses to `0 1px 0` with a 2px translate on `:active`. Gaps 6–10px throughout.

### Z-index scale
scene 0 · HUD/toolbar/wishes 5 · edit bar / selection bar / bubble 6 · extras popover 7 · catalog 8 · toast 9 · modals 10 · intro 20.

---

## Content

### Tenants (floor → name → wish)
| Floor | Name | Animals | Wish |
|---|---|---|---|
| E | Kindergarten und Partyraum | 2× Maus | Klavier |
| 1 | Hausmeister Eidechsen-Charly | Eidechse | Ofen |
| 2 | Oma und Opa Haselmaus | 2× Haselmaus | Schaukelstuhl |
| 3 | Ferienwohnung für Hausmäuse | Maus | Etagenbett |
| 4 | Familie Siebenschläfer | 2× Siebenschläfer | Bett |
| 5 | Jimmy Wiesel und Jule Wühlmaus | Wiesel + Maus | Sofa |
| 6 | Lisa Feldmaus | Maus | Blumenbild |
| 7 | Enrico Maulwurf | Maulwurf | Teppich |
| 8 | Familie Feldhamster | 2× Hamster | Hamsterrad |
| 9 | Rita und Claas Haselmaus | 2× Haselmaus | Nusskiste |
| 10 | Piet und Jan Waldfrosch | 2× Frosch | **Pool (auf dem Dach)** |

### Catalog (21 items in 5 tabs)
- **Möbel**: Bett, Etagenbett, Tisch, Stuhl, Sofa, Schrank, Bücherregal
- **Gemütlich**: Teppich, Lampe, Ofen, Badewanne, Pflanze, Blumenbild, Schaukelstuhl
- **Deko**: Blumenvase, Teekanne, Kerze, Bücherstapel, Nussschale
- **Spass**: Hamsterrad (spins continuously), Klavier, Nusskiste
- **Dach** (roof only): Pool, Liegestuhl, Sonnenschirm, Lampions

### Animal species parameters
Each species is `{ color, bellyColor, ear: round|small|none, tail: thin|bushy|curve|none, scale, chubby?, slim?, frog?, nose? }` — see `SPECIES` in `models.js`. Species: maus, haselmaus, hamster, frosch, eidechse, maulwurf, siebenschlaefer, wiesel.

---

## Assets
**None.** Everything is generated at runtime:
- All 3D models are procedural three.js primitives (`js/models.js`).
- All catalog/animal/portrait thumbnails are rendered at startup into an offscreen WebGL renderer and stored as data URLs.
- The sign texture is drawn on a `<canvas>` (redrawn once `document.fonts.ready` resolves so the webfont is applied).
- All audio is synthesized with WebAudio oscillators and generated noise buffers.

External dependencies: **three.js 0.184.0** (ESM via importmap with SRI hashes) + OrbitControls, and the **Baloo 2** Google Font. Nothing else.

> Note: the game is inspired by the children's book *"Willi baut"*. The characters and story beats come from the book; all artwork here is original procedural geometry — do **not** copy the book's illustrations into the product.

---

## Files
| File | Contents |
|---|---|
| `wipfelkratzer.html` | Document shell, importmap, all CSS, all UI markup (HUD, toolbar, catalog, modals, bubble, toast, intro) |
| `js/models.js` | Materials palette, 21 furniture builders, animal builder, Willi, trees, magpie, sign, dam, bridge, garden. Exports `MAT`, `CATALOG`, `CATS`, `makeFurniture`, `makeAnimal`, `makeWilli`, `makeTree`, `makeTallTree`, `makeMagpie`, `makeSign`, `makeDam`, `makeBridge`, `makeGarden` |
| `js/game.js` | Scene setup, tower construction, edit mode, placement & clamping, tenants & wishes, extras, day/night, party, audio engine, input, save/load, render loop |
| `TODO.md` | Outstanding feature ideas (lamp lighting at night, weather, material gathering, Pixi cameo) |

## Suggested first tasks for the next developer
1. Port `models.js` as-is (it is framework-agnostic three.js) into the target project.
2. Split `game.js` into modules: `scene/`, `tower/`, `editor/`, `tenants/`, `audio/`, `state/`.
3. Replace the ad-hoc `state` object + `localStorage` with the codebase's state solution; keep the same persisted shape so existing saves survive.
4. Then pick up `TODO.md`.
