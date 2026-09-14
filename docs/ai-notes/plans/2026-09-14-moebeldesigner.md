# Plan — Möbeldesigner / Schreinerei (Issue #43)

**Goal:** Das Kind baut in einer Werkstatt aus höchstens fünf Bauteilen
(Form, Breite, Farbe) ein eigenes Möbel, speichert es als Entwurf und stellt es
wie jedes Katalogmöbel in eine Wohnung. Eigenbauten überleben das Neuladen;
alte Spielstände laden unverändert, kaputte Baupläne brechen nichts.

**Architecture:** Ein Eigenbau ist ein **senkrechter Stapel**: Teil sitzt auf
Teil, kein Versatz, keine Drehung — dadurch entfällt jede Kollisions- und
Schwebeprüfung. `js/models.js` bekommt die Bausatz-Tabellen (`BUILD_SHAPES`,
`BUILD_WIDTHS`, `BUILD_MAX`, `BUILD_MAX_H`, `DESIGN_MAX`), die reine
Prüffunktion `normalizeBuild(build)` und den Renderer
`makeCustomFurniture(build)`; die Farben kommen aus `FURN_COLORS`, das **Issue
#34 anlegt** — #34 ist harte Voraussetzung und wird vorher umgesetzt. In
`js/game.js` hält `state.designs` die gespeicherten Baupläne, ein Raum-Eintrag
mit `id: 'eigenbau'` trägt seinen Bauplan als **Kopie** im Feld `build`, und
`placeItemMesh` (`js/game.js:447`) bekommt genau eine Verzweigung. Der
Katalog erhält einen Tab «Schreinerei» (`CATS`, `js/models.js:271`) mit
Entwurfskacheln und einer Kachel «Neu bauen», die das Overlay `#workshop`
öffnet — gebaut nach dem Muster von `#gallery` (`index.html:96-98, 224`). Die
Vorschaubilder entstehen über einen aus `makeThumbs` (`js/game.js:528-545`)
herausgelösten, dauerhaften `snapshot()`-Helfer.

**Spec:** `docs/ai-notes/specs/2026-09-14-moebeldesigner-design.md`

## Global Constraints

- **Issue #34 ist Voraussetzung.** `FURN_COLORS` und `makeFurniture(id, colorId)`
  müssen auf `main` sein, bevor dieser Plan startet
  (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`, Abschnitt 1). Es
  wird **keine** zweite Palette angelegt.
- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute (`ä ö ü`), nie `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module (`CLAUDE.md:490-516`).
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  Primitive aus `box`/`cyl`/`mesh` (`js/models.js:14-20`). **Keine neuen
  Farbwerte, keine neuen Material-Instanzen**, kein `.clone()`, **niemals**
  `MAT.<ton>.color.set()` (`js/game.js:1226` vergleicht auf Identität).
- **Kein freier Editor.** Kein Versatz, keine Drehung einzelner Teile, keine
  Überhänge, keine Physik.
- **Kein Ort, keine Werkbank in der Welt** — das ist Issue #51.
- **Rückwärtskompatibler Spielstand.** `localStorage`-Schlüssel
  `wipfelkratzer-v1` muss weiterladen. Ein Stand ohne `designs` und ohne
  `eigenbau`-Einträge ist gültig und sieht exakt aus wie heute.
- **Ein Bauplan ist Fremdeingabe.** Jeder Weg ins Rendern führt durch
  `normalizeBuild`; keine Funktion vertraut den Feldern eines Bauplans.
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: jede Trefferfläche
  mindestens 44 × 44 px (`index.html:62, 73, 115`).
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, nie `run_in_background`** (`CLAUDE.md:540-568`).
  Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- **`version.js` wird nicht angefasst**, und es entsteht **kein**
  `chore(release)`-Commit. Die Version wird separat beim Release gesetzt.
- Conventional Commits, Präfix `feat(katalog)` bzw. `test(katalog)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-moebeldesigner/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8991–8995** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
  Danach gezielt über den Port beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  niemals `pkill -f` mit einem Muster, das den aufrufenden Befehl treffen kann.
- Chromium starten mit
  `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen.
- `js/models.js` lässt sich direkt aus der Seite heraus prüfen:
  `await import('/js/models.js')` in `page.evaluate` nutzt die Importmap des
  Dokuments (`index.html:10-17`).
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`) liefert `state`,
  `floorGroups`, `scene`, `enterEdit`, `exitEdit`, `edit`.
- In den Einrichten-Modus kommen: `#btn-start` klicken, dann
  `window.wipfelkratzer.enterEdit(<k>)`; `#catalog` öffnet dabei automatisch.
- `localStorage['wipfelkratzer-v1']` **vor** dem Laden zu setzen
  (`page.add_init_script`) ist der schnellste Weg zu einem präparierten Stand
  und für die Alt-Spielstand-Prüfungen ohnehin nötig.

---

### Task 1: Bausatz, `normalizeBuild` und `makeCustomFurniture`

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-moebeldesigner/t1_bausatz.py` (Wegwerf-Test)

**Interfaces:**
- `export const BUILD_SHAPES: Array<{ id, name, h, dz, open?, round?, taper? }>`
- `export const BUILD_WIDTHS: Array<{ id, name, w }>`
- `export const BUILD_MAX: number`, `BUILD_MAX_H: number`, `DESIGN_MAX: number`
- `export function normalizeBuild(build): { parts: Array<{shape,width,color}> } | null`
- `export function makeCustomFurniture(build): THREE.Group`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-moebeldesigner/t1_bausatz.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8991
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const THREE = await import('three');
        const out = { errors: [] };
        for (const n of ['BUILD_SHAPES', 'BUILD_WIDTHS', 'BUILD_MAX', 'BUILD_MAX_H',
                         'DESIGN_MAX', 'normalizeBuild', 'makeCustomFurniture'])
          if (m[n] === undefined) out.errors.push(n + ' fehlt');
        if (out.errors.length) return out;
        if (!m.FURN_COLORS) { out.errors.push('FURN_COLORS fehlt — Issue #34 ist nicht drin'); return out; }

        out.shapes = m.BUILD_SHAPES.map(s => s.id);
        out.widths = m.BUILD_WIDTHS.map(w => w.id);

        // normalizeBuild: was nicht passt, fällt weg — aber es wirft nie.
        const nb = m.normalizeBuild;
        out.nulls = [nb(undefined), nb(null), nb({}), nb({ parts: [] }),
                     nb({ parts: 'nein' }), nb({ parts: [{ shape: 'quatsch', width: 'mittel' }] })]
                    .map(r => r === null);
        const ok = nb({ parts: [{ shape: 'klotz', width: 'mittel', color: 'blau' }] });
        out.ok = ok;
        // Unbekannte Farbe fällt auf den ersten Palettenton zurück, Teil bleibt.
        out.badColor = nb({ parts: [{ shape: 'klotz', width: 'mittel', color: 'tuerkis' }] });
        // Mehr als BUILD_MAX Teile werden gekappt.
        const many = { parts: Array.from({ length: 9 },
          () => ({ shape: 'platte', width: 'schmal', color: 'rot' })) };
        out.capped = nb(many).parts.length;
        // Höhe wird gedeckelt.
        const tall = { parts: Array.from({ length: 5 },
          () => ({ shape: 'saeule', width: 'schmal', color: 'rot' })) };
        out.tallParts = nb(tall).parts.length;

        // makeCustomFurniture: nur MAT-Instanzen, nur Lambert, steht auf dem Boden.
        const known = new Map(Object.entries(m.MAT).map(([k, v]) => [v.uuid, k]));
        const g = m.makeCustomFurniture({ parts: [
          { shape: 'kiste', width: 'mittel', color: 'rosa' },
          { shape: 'platte', width: 'breit', color: 'creme' },
          { shape: 'dach', width: 'mittel', color: 'gruen' }] });
        let foreign = 0, meshes = 0;
        g.traverse(o => { if (!o.material) return; meshes++;
          if (!known.has(o.material.uuid)) foreign++;
          if (o.material.type !== 'MeshLambertMaterial') out.errors.push('kein Lambert'); });
        const bb = new THREE.Box3().setFromObject(g);
        out.custom = { foreign, meshes, minY: bb.min.y,
          size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z],
          itemId: g.userData.itemId };
        // Ein kaputter Bauplan ergibt eine leere, aber gültige Gruppe.
        out.emptyChildren = m.makeCustomFurniture({}).children.length;
        return out;
      }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          res = page.evaluate(CHECK)
          b.close()

      print(json.dumps(res, indent=2, ensure_ascii=False))
      assert res["errors"] == [], res["errors"]
      assert res["shapes"] == ["platte", "klotz", "kiste", "saeule", "dach"], res["shapes"]
      assert res["widths"] == ["schmal", "mittel", "breit"], res["widths"]
      assert all(res["nulls"]), f"normalizeBuild gibt nicht überall null: {res['nulls']}"
      assert res["ok"]["parts"] == [{"shape": "klotz", "width": "mittel", "color": "blau"}], res["ok"]
      assert res["badColor"]["parts"][0]["color"] == "rot", res["badColor"]
      assert res["capped"] == 5, f"nicht auf BUILD_MAX gekappt: {res['capped']}"
      assert res["tallParts"] == 3, f"Höhendeckel greift nicht: {res['tallParts']}"
      c = res["custom"]
      assert c["foreign"] == 0, "fremdes Material im Eigenbau"
      assert c["itemId"] == "eigenbau", c["itemId"]
      assert abs(c["minY"]) < 1e-6, f"Eigenbau schwebt: {c['minY']}"
      assert c["size"][1] <= 1.5, f"zu hoch: {c['size'][1]}"
      assert res["emptyChildren"] == 0, res["emptyChildren"]
      assert errs == [], errs
      print("T1 OK")
      ```

      Server starten und laufen lassen:
      `python3 -m http.server 8991 >/dev/null 2>&1 &` (nur der Server darf in
      den Hintergrund — die Playwright-Läufe **nie**).

- [ ] **Step 2: Test läuft rot.** `python3 .superpowers/sdd/2026-09-14-moebeldesigner/t1_bausatz.py`
      bricht mit `AssertionError: ['BUILD_SHAPES fehlt', …]` ab. Meldet er
      stattdessen `FURN_COLORS fehlt — Issue #34 ist nicht drin`, ist die
      Voraussetzung nicht erfüllt: **abbrechen**, nicht umbauen.

- [ ] **Step 3: Bausatz-Tabellen anlegen.** In `js/models.js` direkt nach
      `FURN_COLORS`/`TINTABLE` (aus #34, im Anschluss an `MAT`,
      `js/models.js:12`):

      ```js
      /* ---------- Schreinerei: der Bausatz ----------
         Ein Eigenbau-Möbel ist ein senkrechter Stapel aus höchstens BUILD_MAX
         Teilen; jedes sitzt auf dem darunter. Kein Versatz, keine Drehung —
         dadurch kann nichts schweben und nichts sich durchdringen, und es
         braucht keine einzige Kollisionsprüfung. Die Tiefe folgt aus der Breite
         (dz), die Höhe gehört zur Form: so hat das Kind einen Grössenknopf
         statt drei. Die Farben kommen aus FURN_COLORS (Issue #34) — es gibt
         hier bewusst keine zweite Palette. */
      export const BUILD_SHAPES = [
        { id: 'platte', name: 'Platte', h: 0.06, dz: 1.00 },
        { id: 'klotz',  name: 'Klotz',  h: 0.34, dz: 1.00 },
        { id: 'kiste',  name: 'Kiste',  h: 0.46, dz: 1.00, open: true },
        { id: 'saeule', name: 'Säule',  h: 0.50, dz: 0.45, round: true },
        { id: 'dach',   name: 'Dach',   h: 0.26, dz: 1.00, taper: true },
      ];
      export const BUILD_WIDTHS = [
        { id: 'schmal', name: 'Schmal', w: 0.34 },
        { id: 'mittel', name: 'Mittel', w: 0.60 },
        { id: 'breit',  name: 'Breit',  w: 0.86 },
      ];
      export const BUILD_MAX = 5;      /* Teile pro Möbel */
      export const BUILD_MAX_H = 1.5;  /* Gesamthöhe; darüber passt es nicht unter die Decke (FLOOR_H = 2.0) */
      export const DESIGN_MAX = 6;     /* gespeicherte Entwürfe */
      ```

- [ ] **Step 4: `normalizeBuild` anlegen.** Direkt darunter:

      ```js
      /* Macht aus einem beliebigen Objekt einen gültigen Bauplan oder null. Ein
         Spielstand ist Fremdeingabe: er kann von Hand verändert, aus einer
         älteren Version oder aus einer späteren Tabelle stammen. Diese Funktion
         ist die einzige Stelle, die einen Bauplan für gültig erklärt — jeder
         Weg ins Rendern führt hier durch. */
      export function normalizeBuild(build) {
        const src = build && Array.isArray(build.parts) ? build.parts : null;
        if (!src) return null;
        const parts = []; let h = 0;
        for (const p of src) {
          if (parts.length >= BUILD_MAX) break;
          const sh = p && BUILD_SHAPES.find(s => s.id === p.shape);
          const wd = p && BUILD_WIDTHS.find(w => w.id === p.width);
          if (!sh || !wd) continue;                     /* unbekannte Form/Breite: Teil fällt weg */
          if (h + sh.h > BUILD_MAX_H) break;            /* über der Decke: der Stapel endet hier */
          const col = FURN_COLORS.find(c => c.id === p.color);
          parts.push({ shape: sh.id, width: wd.id, color: col ? col.id : FURN_COLORS[0].id });
          h += sh.h;
        }
        return parts.length ? { parts } : null;
      }
      ```

- [ ] **Step 5: `makeCustomFurniture` anlegen.** In `js/models.js` direkt
      hinter `makeFurniture` (`js/models.js:309`):

      ```js
      /* Baut ein Eigenbau-Möbel aus seinem Bauplan, von unten nach oben. Die
         Materialien sind ausschliesslich bestehende MAT-Instanzen aus
         FURN_COLORS — es wird keine erzeugt und keine mutiert. */
      export function makeCustomFurniture(build) {
        const g = G(); let y = 0;
        const plan = normalizeBuild(build) || { parts: [] };
        plan.parts.forEach(p => {
          const sh = BUILD_SHAPES.find(s => s.id === p.shape);
          const wd = BUILD_WIDTHS.find(w => w.id === p.width);
          const col = FURN_COLORS.find(c => c.id === p.color);
          const mat = MAT[col.mat];
          const w = wd.w, d = w * sh.dz;
          if (sh.round) cyl(g, w / 2, w / 2, sh.h, mat, 0, y + sh.h / 2, 0, 16);
          else if (sh.taper) mesh(new THREE.ConeGeometry(w * 0.72, sh.h, 4), mat, 0, y + sh.h / 2, 0, g).rotation.y = Math.PI / 4;
          else if (sh.open) {
            box(g, w, 0.05, d, mat, 0, y + 0.025);
            [-1, 1].forEach(s => box(g, 0.05, sh.h - 0.05, d, mat, s * (w / 2 - 0.025), y + 0.025 + (sh.h - 0.05) / 2));
            [-1, 1].forEach(s => box(g, w - 0.1, sh.h - 0.05, 0.05, mat, 0, y + 0.025 + (sh.h - 0.05) / 2, s * (d / 2 - 0.025)));
          } else box(g, w, sh.h, d, mat, 0, y + sh.h / 2);
          y += sh.h;
        });
        g.userData.itemId = 'eigenbau';
        g.userData.build = plan;
        return g;
      }
      ```

- [ ] **Step 6: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-moebeldesigner/t1_bausatz.py`
      endet mit `T1 OK`. Stimmt `tallParts` nicht, prüfen: fünf Säulen à 0.50
      ergeben 2.5, der Deckel bei 1.5 lässt genau drei zu.

---

### Task 2: Spielstand — Entwürfe, Eintrag mit Bauplan, Bereinigung beim Laden

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-moebeldesigner/t2_spielstand.py` (Wegwerf-Test)

**Interfaces:**
- `state.designs: Array<{ name: string, parts: Array<{shape,width,color}> }>`
- Raum-Eintrag: `{ id: 'eigenbau', build: { parts: [...] }, cell, x, z, y, rot }`
- `addItem(id, build?)` — `build` nur für `id === 'eigenbau'`, wird **kopiert**
- `function sanitizeRoom(key): void`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-moebeldesigner/t2_spielstand.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8991
      URL = f"http://127.0.0.1:{PORT}/index.html"

      GOOD = {"parts": [{"shape": "kiste", "width": "mittel", "color": "rosa"},
                        {"shape": "platte", "width": "breit", "color": "creme"}]}
      SAVE = {
          "floors": 3, "nuts": 5, "fulfilled": {}, "wallpaper": {}, "flooring": {},
          "designs": [{"name": "Eigenbau 1", "parts": GOOD["parts"]}],
          "rooms": {"1": [
              {"id": "eigenbau", "build": GOOD, "cell": 0, "x": -1.0, "z": -0.7, "rot": 0},
              {"id": "eigenbau", "cell": 1, "x": 0.0, "z": -0.7, "rot": 0},            # kein build
              {"id": "eigenbau", "build": {}, "cell": 2, "x": 1.0, "z": -0.7, "rot": 0},
              {"id": "eigenbau", "build": {"parts": [{"shape": "nix", "width": "mittel"}]},
               "cell": 3, "x": 1.8, "z": -0.7, "rot": 0},
              {"id": "eigenbau", "build": {"parts": [{"shape": "platte", "width": "schmal", "color": "rot"}] * 9},
               "cell": 4, "x": 2.4, "z": -0.7, "rot": 0},
              {"id": "sofa", "cell": 5, "x": -2.0, "z": 0.6, "rot": 0}]}
      }

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=30000)
          page.wait_for_timeout(1500)
          res = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            const arr = w.state.rooms['1'] || [];
            const stored = JSON.parse(localStorage.getItem('wipfelkratzer-v1') || '{}');
            return { ids: arr.map(e => e.id),
                     parts: arr.filter(e => e.id === 'eigenbau').map(e => e.build.parts.length),
                     designs: (w.state.designs || []).length,
                     storedIds: ((stored.rooms || {})['1'] || []).map(e => e.id) };
          }""")
          b.close()

      print(json.dumps(res, indent=2, ensure_ascii=False))
      # Drei kaputte Einträge fallen raus, der gekappte bleibt (auf 5 Teile gekuerzt).
      assert res["ids"] == ["eigenbau", "eigenbau", "sofa"], res["ids"]
      assert res["parts"] == [2, 5], res["parts"]
      assert res["designs"] == 1, res["designs"]
      assert res["storedIds"] == ["eigenbau", "eigenbau", "sofa"], \
          f"bereinigter Stand nicht zurückgeschrieben: {res['storedIds']}"
      assert errs == [], errs
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Ohne die Bereinigung stehen noch fünf
      `eigenbau`-Einträge in `state.rooms['1']`, und das Laden wirft beim
      Eintrag ohne `build` einen `pageerror` — beides bricht den Test.

- [ ] **Step 3: Import und Zustandsfeld.** In `js/game.js:3` die neuen Exporte
      mit aufnehmen:

      ```js
      import { MAT, CATALOG, CATS, WALL_ITEMS, WALLS, FLOORS, FURN_COLORS, TINTABLE,
        BUILD_SHAPES, BUILD_WIDTHS, BUILD_MAX, BUILD_MAX_H, DESIGN_MAX, normalizeBuild,
        makeCustomFurniture, lookCanvas, lookTexture, makeFurniture, makeAnimal, makeWilli,
        makeTree, makeTallTree, makeMagpie, makeSign, makeDam, makeBridge, makeGarden } from './models.js';
      ```

      und in `js/game.js:35` das Feld ergänzen:

      ```js
      let state = { floors: 0, rooms: {}, nuts: 0, bridge: false, garden: false, night: false, cutaway: false, fulfilled: {}, wallpaper: {}, flooring: {}, designs: [] };
      ```

- [ ] **Step 4: Bereinigung anlegen.** In `js/game.js` direkt hinter
      `wallpaperOf` (`js/game.js:386`):

      ```js
      /* Eigenbauten prüfen, bevor sie gebaut werden. Ein Bauplan ist
         Fremdeingabe: von Hand verändert, aus einer älteren Version, aus einer
         entfernten Form. Ungültige Einträge verschwinden still, gekürzte werden
         ersetzt — und der bereinigte Stand wird wie bei der Tapeten-Migration
         einmalig zurückgeschrieben (js/game.js:1186). */
      function sanitizeRoom(key) {
        const arr = roomOf(key);
        for (let i = arr.length - 1; i >= 0; i--) {
          const en = arr[i]; if (en.id !== 'eigenbau') continue;
          const b = normalizeBuild(en.build);
          if (!b) { arr.splice(i, 1); migrated = true; continue; }
          if (JSON.stringify(b) !== JSON.stringify(en.build)) { en.build = b; migrated = true; }
        }
      }
      /* Gespeicherte Entwürfe durch dieselbe Prüfung schicken. */
      function sanitizeDesigns() {
        if (!Array.isArray(state.designs)) { state.designs = []; return; }
        const before = JSON.stringify(state.designs);
        state.designs = state.designs
          .map(d => { const b = normalizeBuild(d); return b ? { name: String(d.name || 'Eigenbau'), parts: b.parts } : null; })
          .filter(Boolean).slice(0, DESIGN_MAX);
        if (JSON.stringify(state.designs) !== before) migrated = true;
      }
      ```

- [ ] **Step 5: `placeItemMesh` verzweigen.** In `js/game.js:449` die Zeile
      `const m = makeFurniture(entry.id);` ersetzen durch:

      ```js
        /* Zwei Wege zu einem Möbel-Mesh: Katalog-id oder Bauplan (Schreinerei). */
        const m = entry.id === 'eigenbau' ? makeCustomFurniture(entry.build) : makeFurniture(entry.id, entry.color);
      ```

      (`entry.color` stammt aus #34 und ist hier bereits verdrahtet.)

- [ ] **Step 6: `addItem` um den Bauplan erweitern.** Signatur in
      `js/game.js:680` auf `function addItem(id, build)` ändern und direkt nach
      dem Anlegen von `entry` (`js/game.js:685`) einfügen:

      ```js
        /* Der Bauplan wird kopiert, nicht verwiesen: ein späteres Ändern oder
           Löschen des Entwurfs lässt aufgestellte Möbel unberührt. */
        if (id === 'eigenbau') entry.build = JSON.parse(JSON.stringify(normalizeBuild(build) || { parts: [] }));
      ```

- [ ] **Step 7: Beim Laden aufrufen.** In der Ladeschleife
      (`js/game.js:1177-1184`) vor dem Platzieren:

      ```js
      sanitizeDesigns();
      Object.keys(state.rooms).forEach(k => {
        const key = k === 'roof' ? 'roof' : parseInt(k, 10);
        sanitizeRoom(key);
        roomOf(key).forEach(e => {
          const m = placeItemMesh(key, e);
          if (key === 'roof') clampEntry('roof', m, e);
        });
      });
      ```

- [ ] **Step 8: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-moebeldesigner/t2_spielstand.py`
      endet mit `T2 OK`. Schlägt `storedIds` fehl, feuert `save()` erst nach
      300 ms Debounce (`js/game.js:37`) — die Wartezeit im Skript auf 1500 ms
      lassen, nicht `save()` synchron machen.

---

### Task 3: Vorschau-Renderer und der Katalog-Tab «Schreinerei»

**Files:**
- `js/models.js`
- `js/game.js`
- `index.html`
- `.superpowers/sdd/2026-09-14-moebeldesigner/t3_katalog.py` (Wegwerf-Test)

**Interfaces:**
- `CATS` enthält `['eigenbau', 'Schreinerei']`
- `js/game.js`: `function snapshot(o, fx, fy, fz): string` (Daten-URL),
  `function designThumb(build): string`, `function deleteDesign(i): void`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-moebeldesigner/t3_katalog.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8991
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {
          "floors": 3, "nuts": 5, "fulfilled": {}, "wallpaper": {}, "flooring": {}, "rooms": {},
          "designs": [
              {"name": "Eigenbau 1", "parts": [{"shape": "kiste", "width": "mittel", "color": "rosa"},
                                               {"shape": "platte", "width": "breit", "color": "creme"}]},
              {"name": "Eigenbau 2", "parts": [{"shape": "saeule", "width": "schmal", "color": "blau"},
                                               {"shape": "dach", "width": "mittel", "color": "gruen"}]}]
      }

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=30000)
          page.evaluate("window.wipfelkratzer.enterEdit(1)")
          page.wait_for_timeout(1500)

          page.click("#catalog-tabs button:has-text('Schreinerei')", timeout=30000)
          page.wait_for_timeout(500)
          tiles = page.eval_on_selector_all(
              "#catalog-items .item span", "els => els.map(e => e.textContent)")
          thumbs_ok = page.eval_on_selector_all(
              "#catalog-items .item.design img",
              "els => els.every(e => (e.getAttribute('src') || '').startsWith('data:image/'))")
          assert tiles[0] == "Neu bauen", tiles
          assert "Eigenbau 1" in tiles and "Eigenbau 2" in tiles, tiles
          assert thumbs_ok is True, "Entwurfskachel ohne Vorschaubild"

          # Auf der Dachterrasse gibt es die Schreinerei nicht.
          page.evaluate("window.wipfelkratzer.exitEdit(); window.wipfelkratzer.enterEdit('roof')")
          page.wait_for_timeout(1200)
          roof_tabs = page.eval_on_selector_all(
              "#catalog-tabs button", "els => els.map(e => e.textContent)")
          assert "Schreinerei" not in roof_tabs, roof_tabs

          # Platzieren: die Kachel stellt das Möbel in die Wohnung.
          page.evaluate("window.wipfelkratzer.exitEdit(); window.wipfelkratzer.enterEdit(1)")
          page.wait_for_timeout(1200)
          page.click("#catalog-tabs button:has-text('Schreinerei')", timeout=30000)
          page.click("#catalog-items .item.design:has-text('Eigenbau 2')", timeout=30000)
          page.wait_for_timeout(1200)
          placed = page.evaluate("""() => {
            const arr = window.wipfelkratzer.state.rooms['1'] || [];
            return arr.map(e => ({ id: e.id, parts: e.build ? e.build.parts.length : null })); }""")
          assert placed == [{"id": "eigenbau", "parts": 2}], placed

          # Entwurf löschen: zweimal auf das x, das aufgestellte Möbel bleibt.
          page.click("#catalog-items .item.design:has-text('Eigenbau 2') button.del", timeout=30000)
          page.click("#catalog-items .item.design:has-text('Eigenbau 2') button.del", timeout=30000)
          page.wait_for_timeout(800)
          after = page.evaluate("""() => ({
            designs: window.wipfelkratzer.state.designs.map(d => d.name),
            room: (window.wipfelkratzer.state.rooms['1'] || []).map(e => e.id) })""")
          b.close()

      print(json.dumps({"tiles": tiles, "after": after}, indent=2, ensure_ascii=False))
      assert after["designs"] == ["Eigenbau 1"], after["designs"]
      assert after["room"] == ["eigenbau"], after["room"]
      assert errs == [], errs
      print("T3 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Der Klick auf den Tab «Schreinerei» findet
      keinen Knopf und läuft in den Timeout.

- [ ] **Step 3: Tab in `CATS` eintragen.** `js/models.js:271`, direkt hinter
      `['mobel', 'Möbel']`:

      ```js
      export const CATS = [['mobel', 'Möbel'], ['eigenbau', 'Schreinerei'], ['gemut', 'Gemütlich'], ['deko', 'Deko'], ['wand', 'Wand'], ['spass', 'Spass'], ['farbe', 'Tapete'], ['boden', 'Boden'], ['dach', 'Dach']];
      ```

      Der bestehende Filter in `renderCatalog` (`js/game.js:534`) blendet auf
      dem Dach alles ausser `dach` aus — die Schreinerei ist damit automatisch
      nur in Wohnungen sichtbar.

- [ ] **Step 4: `snapshot` aus `makeThumbs` herauslösen.** `makeThumbs`
      (`js/game.js:528-545`) verliert seinen eigenen Renderer und die innere
      Funktion `snap`; davor entsteht:

      ```js
      /* Ein einziger, dauerhafter Vorschau-Renderer. Er wird nicht verworfen
         (früher r2.dispose()), weil die Schreinerei zur Laufzeit Bilder
         braucht — bei jedem Tipp eines. Browser begrenzen die Zahl
         gleichzeitiger WebGL-Kontexte hart, also genau einer für alle
         Vorschaubilder. */
      let thumbR = null, thumbS = null, thumbC = null;
      function snapshot(o, fx, fy, fz) {
        if (!thumbR) {
          thumbR = new THREE.WebGLRenderer({ alpha: true, antialias: true }); thumbR.setSize(160, 160);
          thumbS = new THREE.Scene();
          thumbS.add(new THREE.HemisphereLight(0xfff4da, 0xbfae90, 1.4));
          const d2 = new THREE.DirectionalLight(0xffffff, 1.6); d2.position.set(2, 4, 3); thumbS.add(d2);
          thumbC = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
        }
        thumbS.add(o);
        const bb = new THREE.Box3().setFromObject(o);
        const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
        const md = Math.max(size.x, size.y, size.z) || 1;
        thumbC.position.set(ctr.x + md * fx, ctr.y + md * fy, ctr.z + md * fz); thumbC.lookAt(ctr);
        thumbR.render(thumbS, thumbC);
        const url = thumbR.domElement.toDataURL(); thumbS.remove(o); return url;
      }
      /* Vorschaubild eines Bauplans, gecacht über den Bauplan selbst: in der
         Werkstatt ändert sich pro Tipp genau ein Feld, und der Cache trägt die
         vorherigen Zustände ohne Neurendern. */
      const designThumbs = new Map();
      function designThumb(build) {
        const key = JSON.stringify(build.parts || []);
        if (!designThumbs.has(key)) designThumbs.set(key, snapshot(makeCustomFurniture(build), 1.15, 0.85, 1.35));
        return designThumbs.get(key);
      }
      ```

      In `makeThumbs` bleiben nur noch die Aufrufe, mit `snapshot` statt `snap`
      und **ohne** `r2.dispose()`.

- [ ] **Step 5: Katalogzweig für die Schreinerei.** In `renderCatalog`, direkt
      vor dem Zweig `if (catTab === 'wand')` (`js/game.js:583`):

      ```js
        if (catTab === 'eigenbau') {
          const neu = document.createElement('div'); neu.className = 'item look';
          neu.innerHTML = `<i class="none"></i><span>Neu bauen</span>`;
          neu.onclick = openWorkshop; wrap.appendChild(neu);
          state.designs.forEach((d, i) => {
            const el = document.createElement('div'); el.className = 'item design';
            el.innerHTML = `<img src="${designThumb(d)}" alt=""><span>${d.name}</span>`
              + `<button class="del" aria-label="${d.name} löschen">×</button>`;
            el.onclick = e => { if (e.target.closest('button.del')) deleteDesign(i); else addItem('eigenbau', d); };
            wrap.appendChild(el); });
          return;
        }
      ```

- [ ] **Step 6: Entwurf löschen, mit Rückfrage.** Neben `renderCatalog`
      einfügen — zweistufig wie der Zurücksetzen-Knopf (`js/game.js:894-898`):

      ```js
      /* Löschen braucht zwei Tipps. Gelöscht wird nur der Entwurf; bereits
         aufgestellte Möbel tragen ihren eigenen Bauplan und bleiben stehen. */
      let delArmed = -1, delArmedAt = 0;
      function deleteDesign(i) {
        if (delArmed === i && Date.now() - delArmedAt < 4000) {
          state.designs.splice(i, 1); delArmed = -1; sfx.knock(); save(); renderCatalog(); return; }
        delArmed = i; delArmedAt = Date.now();
        toast(`«${state.designs[i].name}» wirklich löschen? Tippe nochmal auf das ×. Schon aufgestellte Möbel bleiben stehen.`);
      }
      ```

- [ ] **Step 7: Stil für die Entwurfskachel.** In `index.html` hinter der
      Regel `.item:active` (`index.html:65`):

      ```css
        .item.design { position: relative; }
        .item.design .del { position: absolute; top: 2px; right: 2px; min-width: 44px; min-height: 44px;
          border-radius: 50%; padding: 0; font-size: 18px; line-height: 1; }
      ```

- [ ] **Step 8: Test läuft grün, sobald Task 4 die Werkstatt liefert.** Bis
      dahin `openWorkshop` als benannte Funktion mit leerem Rumpf anlegen,
      damit `renderCatalog` nicht auf eine undefinierte Referenz zeigt — der
      Rumpf entsteht in Task 4, Step 3. `python3 .superpowers/sdd/2026-09-14-moebeldesigner/t3_katalog.py`
      muss danach mit `T3 OK` enden (der Test tippt «Neu bauen» nicht an).

---

### Task 4: Die Werkstatt

**Files:**
- `index.html`
- `js/game.js`
- `.superpowers/sdd/2026-09-14-moebeldesigner/t4_werkstatt.py` (Wegwerf-Test)

**Interfaces:**
- `#workshop` mit `#ws-preview`, `#ws-stack`, `#ws-shape`, `#ws-width`,
  `#ws-color`, `#ws-add`, `#ws-del`, `#ws-cancel`, `#ws-ok`
- `js/game.js`: `function openWorkshop(): void`, `function renderWorkshop(): void`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-moebeldesigner/t4_werkstatt.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8991
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {"floors": 3, "nuts": 5, "fulfilled": {}, "wallpaper": {}, "flooring": {},
              "rooms": {}, "designs": []}

      def small(page, sel):
          return page.eval_on_selector_all(sel, """els => els.filter(e => {
            const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length""")

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page(viewport={"width": 1000, "height": 900})
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=30000)
          page.evaluate("window.wipfelkratzer.enterEdit(1)")
          page.wait_for_timeout(1500)
          page.click("#catalog-tabs button:has-text('Schreinerei')", timeout=30000)
          page.click("#catalog-items .item:has-text('Neu bauen')", timeout=30000)
          page.wait_for_timeout(800)

          assert page.is_visible("#workshop.open"), "Werkstatt öffnet nicht"
          first = page.get_attribute("#ws-preview", "src")
          assert first and first.startswith("data:image/"), "Vorschau leer"
          assert page.eval_on_selector_all("#ws-stack button", "els => els.length") == 1
          assert small(page, "#workshop button") == 0, "Knopf kleiner als 44 px"

          # Form wechseln ändert die Vorschau.
          page.click("#ws-shape button:has-text('Kiste')", timeout=30000)
          page.wait_for_timeout(600)
          second = page.get_attribute("#ws-preview", "src")
          assert second != first, "Formwechsel ändert die Vorschau nicht"

          # Farbe und Breite wechseln ebenfalls.
          page.click("#ws-width button:has-text('Breit')", timeout=30000)
          page.wait_for_timeout(400)
          page.click("#ws-color button >> nth=3", timeout=30000)
          page.wait_for_timeout(600)
          third = page.get_attribute("#ws-preview", "src")
          assert third != second, "Breite/Farbe ändern die Vorschau nicht"

          # Teil weg ist beim letzten Teil gesperrt, Teil dazu bis fünf offen.
          assert page.is_disabled("#ws-del"), "Teil weg ist beim letzten Teil nicht gesperrt"
          for _ in range(6):
              if page.is_disabled("#ws-add"):
                  break
              page.click("#ws-add", timeout=30000)
              page.wait_for_timeout(400)
          count = page.eval_on_selector_all("#ws-stack button", "els => els.length")
          assert count <= 5, f"mehr als fünf Teile: {count}"
          assert page.is_disabled("#ws-add"), "Teil dazu bleibt offen"

          page.click("#ws-ok", timeout=30000)
          page.wait_for_timeout(1000)
          saved = page.evaluate("window.wipfelkratzer.state.designs.map(d => d.name)")
          assert saved == ["Eigenbau 1"], saved
          assert not page.is_visible("#workshop.open"), "Werkstatt bleibt offen"

          # Abbrechen legt keinen Entwurf an.
          page.click("#catalog-items .item:has-text('Neu bauen')", timeout=30000)
          page.wait_for_timeout(600)
          page.click("#ws-cancel", timeout=30000)
          page.wait_for_timeout(600)
          saved2 = page.evaluate("window.wipfelkratzer.state.designs.map(d => d.name)")
          b.close()

      print(json.dumps({"saved": saved, "saved2": saved2}, indent=2, ensure_ascii=False))
      assert saved2 == ["Eigenbau 1"], saved2
      assert errs == [], errs
      print("T4 OK")
      ```

- [ ] **Step 2: Test läuft rot.** `#workshop` existiert nicht; der Lauf bricht
      bei `assert page.is_visible("#workshop.open")` ab.

- [ ] **Step 3: Markup und Stil.** In `index.html` hinter dem Block
      `<div id="gallery">` (`index.html:224`) einfügen:

      ```html
      <div id="workshop">
        <div class="panel">
          <h2>Schreinerei</h2>
          <p class="ws-hint">Staple bis zu fünf Teile. Tippe ein Teil an, dann wähle Form, Breite und Farbe.</p>
          <img id="ws-preview" alt="Vorschau des Möbels">
          <div id="ws-stack"></div>
          <div id="ws-shape" class="ws-row"></div>
          <div id="ws-width" class="ws-row"></div>
          <div id="ws-color" class="ws-row"></div>
          <div class="ws-row">
            <button id="ws-add">Teil dazu</button>
            <button id="ws-del">Teil weg</button>
          </div>
          <div class="ws-row">
            <button id="ws-cancel">Abbrechen</button>
            <button id="ws-ok" class="primary">Fertig</button>
          </div>
        </div>
      </div>
      ```

      und im `<style>`-Block hinter den `#gallery`-Regeln (`index.html:107`):

      ```css
        #workshop { position: fixed; inset: 0; z-index: 10; display: none; align-items: center; justify-content: center; background: rgba(60,40,20,.35); }
        #workshop.open { display: flex; }
        #workshop .panel { width: min(420px, 92vw); max-height: 88vh; overflow-y: auto; padding: 16px 20px; }
        #workshop h2 { margin: 0 0 6px; color: var(--wood); }
        .ws-hint { margin: 0 0 8px; font-size: 13px; line-height: 1.3; opacity: .85; }
        #ws-preview { display: block; width: 160px; height: 160px; margin: 0 auto 10px; background: #fff9ec; border: 3px solid var(--woodL); border-radius: 12px; }
        #ws-stack { display: flex; flex-direction: column-reverse; gap: 4px; margin-bottom: 10px; }
        #ws-stack button { min-height: 44px; text-align: left; font-size: 14px; }
        #ws-stack button.on { background: var(--green); color: #fff; border-color: #3e6b36; box-shadow: none; }
        .ws-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .ws-row button { min-height: 44px; min-width: 44px; font-size: 14px; }
        .ws-row button.on { background: var(--wood); color: #fff; border-color: #5b3a1f; box-shadow: none; }
        .ws-dot { width: 44px; height: 44px; border-radius: 50%; padding: 0; }
      ```

- [ ] **Step 4: Die Werkstatt-Logik.** In `js/game.js` neben `deleteDesign`
      (Task 3, Step 6) — `openWorkshop` ersetzt dort den leeren Rumpf:

      ```js
      /* ---------- Werkstatt ----------
         Der Entwurf lebt hier als lokaler Bauplan; erst «Fertig» schreibt ihn
         in state.designs. Das aktive Teil ist der Index im Stapel, auf den die
         drei Knopfreihen wirken. */
      let wsBuild = null, wsActive = 0;
      function openWorkshop() {
        if (state.designs.length >= DESIGN_MAX) {
          toast(`Die Werkstatt ist voll — es passen ${DESIGN_MAX} Entwürfe hinein. Lösche zuerst einen (× auf der Kachel).`);
          return; }
        wsBuild = { parts: [{ shape: 'klotz', width: 'mittel', color: FURN_COLORS[0].id }] };
        wsActive = 0;
        $('workshop').classList.add('open');
        renderWorkshop();
      }
      function closeWorkshop() { $('workshop').classList.remove('open'); wsBuild = null; }
      /* Höhe des Stapels — entscheidet, ob noch ein Teil dazu darf. */
      const wsHeight = b => b.parts.reduce((h, p) => h + BUILD_SHAPES.find(s => s.id === p.shape).h, 0);
      function renderWorkshop() {
        const part = wsBuild.parts[wsActive];
        $('ws-preview').src = designThumb(wsBuild);
        const stack = $('ws-stack'); stack.innerHTML = '';
        wsBuild.parts.forEach((p, i) => {
          const sh = BUILD_SHAPES.find(s => s.id === p.shape), wd = BUILD_WIDTHS.find(w => w.id === p.width);
          const col = FURN_COLORS.find(c => c.id === p.color);
          const b = document.createElement('button');
          b.textContent = `${i + 1}. ${sh.name} · ${wd.name} · ${col.name}`;
          if (i === wsActive) b.className = 'on';
          b.onclick = () => { wsActive = i; renderWorkshop(); };
          stack.appendChild(b); });
        const row = (id, list, cur, pick, dot) => {
          const el = $(id); el.innerHTML = '';
          list.forEach(o => { const b = document.createElement('button');
            if (dot) { b.className = 'ws-dot'; b.style.background = '#' + MAT[o.mat].color.getHexString();
              b.setAttribute('aria-label', o.name); b.title = o.name; }
            else b.textContent = o.name;
            if (o.id === cur) b.className = (b.className ? b.className + ' ' : '') + 'on';
            b.onclick = () => { pick(o.id); renderWorkshop(); };
            el.appendChild(b); }); };
        row('ws-shape', BUILD_SHAPES, part.shape, id => { part.shape = id; }, false);
        row('ws-width', BUILD_WIDTHS, part.width, id => { part.width = id; }, false);
        row('ws-color', FURN_COLORS, part.color, id => { part.color = id; }, true);
        const smallest = Math.min(...BUILD_SHAPES.map(s => s.h));
        $('ws-add').disabled = wsBuild.parts.length >= BUILD_MAX || wsHeight(wsBuild) + smallest > BUILD_MAX_H;
        $('ws-del').disabled = wsBuild.parts.length <= 1;
      }
      $('ws-add').onclick = () => {
        const p = wsBuild.parts[wsActive];
        /* Ein neues Teil ist eine Kopie des aktiven — passt es nicht mehr unter
           den Höhendeckel, wird die flachste Form genommen. */
        const sh = BUILD_SHAPES.find(s => s.id === p.shape);
        const fits = wsHeight(wsBuild) + sh.h <= BUILD_MAX_H;
        const flat = BUILD_SHAPES.reduce((a, s) => s.h < a.h ? s : a);
        wsBuild.parts.push({ shape: fits ? p.shape : flat.id, width: p.width, color: p.color });
        wsActive = wsBuild.parts.length - 1; sfx.pop(); renderWorkshop();
      };
      $('ws-del').onclick = () => {
        if (wsBuild.parts.length <= 1) return;
        wsBuild.parts.splice(wsActive, 1);
        wsActive = Math.min(wsActive, wsBuild.parts.length - 1); sfx.knock(); renderWorkshop();
      };
      $('ws-cancel').onclick = closeWorkshop;
      $('ws-ok').onclick = () => {
        const b = normalizeBuild(wsBuild);
        if (!b) { closeWorkshop(); return; }
        /* Der Name zählt hoch und füllt Lücken, die das Löschen hinterlässt. */
        let n = 1; const taken = new Set(state.designs.map(d => d.name));
        while (taken.has(`Eigenbau ${n}`)) n++;
        state.designs.push({ name: `Eigenbau ${n}`, parts: b.parts });
        closeWorkshop(); sfx.chime(); save(); renderCatalog();
      };
      $('workshop').onclick = e => { if (e.target === $('workshop')) closeWorkshop(); };
      ```

- [ ] **Step 5: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-moebeldesigner/t4_werkstatt.py`
      endet mit `T4 OK`. Scheitert `small(...) == 0`, ist eine Knopfreihe zu
      eng — die 44-px-Regel gilt, der Test wird nicht gelockert.

- [ ] **Step 6: Screenshot zur Sichtprüfung.** `page.screenshot(path=
      ".superpowers/sdd/2026-09-14-moebeldesigner/werkstatt.png")` bei offener
      Werkstatt mit drei Teilen im Stapel. Das Bild muss Vorschau, Stapel und
      alle drei Knopfreihen ohne Überlappung zeigen, auch bei
      `viewport={"width": 420, "height": 820}` (Tablet hochkant).

---

### Task 5: Regression, Changelog und Abnahme gegen die Acceptance Criteria

**Files:**
- `CHANGELOG.md`
- `TODO.md`
- `.superpowers/sdd/2026-09-14-moebeldesigner/t5_abnahme.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Abnahmeskript schreiben.**
      `.superpowers/sdd/2026-09-14-moebeldesigner/t5_abnahme.py` deckt ab, was
      die Tasks 1–4 offen lassen: alter Spielstand, Neuladen, Materialzahl,
      kein Wunsch, keine Ablage.

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8991
      URL = f"http://127.0.0.1:{PORT}/index.html"

      # Struktur von vor der Änderung: kein designs-Feld, keine eigenbau-Einträge.
      ALT = {"floors": 6, "nuts": 9, "fulfilled": {}, "wallpaper": {"1": "rosa"}, "flooring": {},
             "rooms": {"5": [{"id": "tisch", "cell": 0, "x": -1.2, "z": -0.8, "rot": 0},
                             {"id": "stuhl", "cell": 1, "x": 0.0, "z": -0.8, "rot": 0},
                             {"id": "lampe", "cell": 2, "x": 1.2, "z": -0.8, "rot": 0}]}}

      D1 = [{"shape": "kiste", "width": "mittel", "color": "rosa"},
            {"shape": "platte", "width": "breit", "color": "creme"}]
      D2 = [{"shape": "saeule", "width": "schmal", "color": "blau"},
            {"shape": "dach", "width": "mittel", "color": "gruen"}]

      def boot(page, save):
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(save)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=30000)
          page.wait_for_timeout(1500)

      MATS = """() => { const s = new Set();
        window.wipfelkratzer.scene.traverse(o => { if (o.material) s.add(o.material.uuid); });
        return s.size; }"""

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

          # 1. Alter Spielstand laedt unverändert, kein Wunsch wird erfüllt.
          page = b.new_page(); errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          boot(page, ALT)
          before_mats = page.evaluate(MATS)
          alt = page.evaluate("""() => ({
            ids: (window.wipfelkratzer.state.rooms['5'] || []).map(e => e.id),
            nuts: window.wipfelkratzer.state.nuts,
            designs: window.wipfelkratzer.state.designs.length })""")
          assert alt["ids"] == ["tisch", "stuhl", "lampe"], alt
          assert alt["nuts"] == 9 and alt["designs"] == 0, alt

          # 2. Fünf Eigenbauten ändern die Materialzahl der Szene nicht.
          page.evaluate("window.wipfelkratzer.enterEdit(5)")
          page.wait_for_timeout(1200)
          page.click("#catalog-tabs button:has-text('Schreinerei')", timeout=30000)
          for _ in range(2):
              page.click("#catalog-items .item:has-text('Neu bauen')", timeout=30000)
              page.wait_for_timeout(600)
              page.click("#ws-ok", timeout=30000)
              page.wait_for_timeout(800)
          for _ in range(5):
              page.click("#catalog-items .item.design >> nth=0", timeout=30000)
              page.wait_for_timeout(700)
          after = page.evaluate("""() => ({
            mats: (() => { const s = new Set();
              window.wipfelkratzer.scene.traverse(o => { if (o.material) s.add(o.material.uuid); });
              return s.size; })(),
            eigen: (window.wipfelkratzer.state.rooms['5'] || []).filter(e => e.id === 'eigenbau').length,
            nuts: window.wipfelkratzer.state.nuts })""")
          assert after["eigen"] == 5, after
          assert after["mats"] == before_mats, f"Materialzahl gewachsen: {before_mats} -> {after['mats']}"
          assert after["nuts"] == 9, f"Eigenbau hat einen Wunsch erfüllt: {after['nuts']}"

          # 3. Deko legt sich nicht auf einem Eigenbau ab.
          page.click("#catalog-tabs button:has-text('Deko')", timeout=30000)
          page.click("#catalog-items div.item:has-text('Teekanne')", timeout=30000)
          page.wait_for_timeout(800)
          kanne = page.evaluate(
              "window.wipfelkratzer.state.rooms['5'].find(e => e.id === 'teekanne').y")
          assert kanne < 0.9, f"Teekanne landet auf einem Eigenbau: {kanne}"
          assert errs == [], errs
          page.close()

          # 4. Neuladen: zwei verschiedene Eigenbauten stehen unverändert da.
          page2 = b.new_page(); errs2 = []
          page2.on("pageerror", lambda e: errs2.append(str(e)))
          NEU = {"floors": 3, "nuts": 0, "fulfilled": {}, "wallpaper": {}, "flooring": {},
                 "designs": [{"name": "Eigenbau 1", "parts": D1}],
                 "rooms": {"1": [{"id": "eigenbau", "build": {"parts": D1}, "cell": 0,
                                  "x": -1.0, "z": -0.7, "rot": 0},
                                 {"id": "eigenbau", "build": {"parts": D2}, "cell": 1,
                                  "x": 0.8, "z": -0.7, "rot": 0}]}}
          boot(page2, NEU)
          neu = page2.evaluate("""() => (window.wipfelkratzer.state.rooms['1'] || [])
            .map(e => JSON.stringify(e.build))""")
          assert len(neu) == 2 and neu[0] != neu[1], neu
          assert errs2 == [], errs2
          b.close()

      print(json.dumps({"alt": alt, "after": after, "kanne": kanne}, indent=2, ensure_ascii=False))
      print("T5 OK")
      ```

- [ ] **Step 2: Abnahmeskript grün fahren.**
      `python3 .superpowers/sdd/2026-09-14-moebeldesigner/t5_abnahme.py` endet
      mit `T5 OK`.

- [ ] **Step 3: Gesamtlauf.** Alle fünf Skripte nacheinander im Vordergrund:
      `for f in t1_bausatz t2_spielstand t3_katalog t4_werkstatt t5_abnahme; do
      python3 .superpowers/sdd/2026-09-14-moebeldesigner/$f.py || exit 1; done`.
      Fünf mal `OK` oder der Task ist nicht fertig.

- [ ] **Step 4: Changelog.** In `CHANGELOG.md` unter `## [Unreleased]` (anlegen,
      falls noch nicht vorhanden, über `## [0.5.0] - 2026-09-13`,
      `CHANGELOG.md:7`) im Stil der bestehenden Einträge ergänzen:

      ```markdown
      ## [Unreleased]

      ### Added

      - Schreinerei: eigene Möbel bauen statt nur auswählen. In der Werkstatt
        stapelst Du bis zu fünf Teile aufeinander und wählst je Teil Form
        (Platte, Klotz, Kiste, Säule, Dach), Breite und Farbe; die Vorschau
        zeigt sofort, wie das Möbel aussieht. Fertige Entwürfe landen im
        Katalog unter «Schreinerei» und lassen sich beliebig oft aufstellen —
        gelöschte Entwürfe lassen bereits aufgestellte Möbel unberührt (#43)
      ```

      **`version.js` bleibt unverändert, und es entsteht kein
      `chore(release)`-Commit** — die Version wird separat beim Release gesetzt.

- [ ] **Step 5: TODO.** In `TODO.md` unter «Erledigt» ergänzen:
      `- [x] Schreinerei: eigene Möbel aus Bauteilen stapeln und im Katalog speichern (#43)`.

- [ ] **Step 6: Acceptance Criteria abhaken.** Die Liste aus
      `docs/ai-notes/specs/2026-09-14-moebeldesigner-design.md` Punkt für Punkt
      durchgehen und je Punkt den belegenden Skriptlauf oder Screenshot
      notieren. Offen bleibende Punkte werden benannt, nicht stillschweigend
      abgehakt — insbesondere die Sichtprüfung der Werkstatt im Hochformat.

- [ ] **Step 7: Server beenden.**
      `ss -lptn 'sport = :8991' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
      Kein `pkill -f`.
