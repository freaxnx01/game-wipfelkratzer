# Plan — Möbelfarbe auswählen (Issue #34)

**Goal:** Beim Einrichten lässt sich für ein ausgewähltes Möbel eine Farbe aus
einer festen Palette wählen. Die Farbe landet im Spielstand, überlebt das
Neuladen, und alte Spielstände ohne Farbfeld laden unverändert weiter.

**Architecture:** Die Palette besteht ausschliesslich aus **bereits
existierenden `MAT`-Instanzen** (`js/models.js:4-12`). Jedes einfärbbare
`FURN`-Modell bekommt einen optionalen Korpusmaterial-Parameter, dessen
Default exakt das heutige Material ist; `makeFurniture(id, colorId)` schlägt
die id in `FURN_COLORS` nach und reicht die `MAT`-Instanz durch. Es wird kein
Material geklont und keines mutiert — die Materialanzahl der Szene bleibt
konstant. Der Spielstand-Eintrag bekommt ein optionales `color`-Feld;
`placeItemMesh()` (`js/game.js:447-470`) reicht es an `makeFurniture` weiter.
Die Oberfläche ist eine aufklappbare Swatch-Reihe in `#selbar`
(`index.html:187-196`), gebaut nach dem Vorbild der Wandwahl-Reihe `#wallpick`
(`js/game.js:562-577`, `index.html:113-116`). Umgefärbt wird durch Neubau des
Meshes über `placeItemMesh()`, nicht durch Materialtausch an den Kindern.

**Spec:** `docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module (`CLAUDE.md:796-821`).
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  warme entsättigte Töne. **Keine neuen Farbwerte** — jeder Palettenton ist ein
  bestehender Eintrag aus `MAT` (`js/models.js:4-12`). Kein `<input
  type="color">`, kein Hex-Feld, kein Farbrad.
- **Keine neuen Material-Instanzen.** Weder `new MeshLambertMaterial` noch
  `material.clone()` für die Einfärbung, und **niemals** `MAT.<ton>.color.set()`
  — die `MAT`-Objekte sind turmweit geteilt (`js/game.js:1226` vergleicht sogar
  auf Identität).
- **Rückwärtskompatibler Spielstand.** `localStorage`-Schlüssel
  `wipfelkratzer-v1` muss weiter laden. Einträge ohne `color` sind gültig und
  bedeuten «Standardfarbe».
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: jede Trefferfläche
  mindestens 44 × 44 px, wie die bestehenden Knöpfe (`index.html:73, 75, 115`).
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, nie `run_in_background`** (`CLAUDE.md:540-560`).
  Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- Conventional Commits, Präfix `feat(einrichten)` bzw. `test(einrichten)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-13-moebelfarbe/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8971–8975** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
  Danach gezielt über den Port beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  niemals `pkill -f` mit einem Muster, das den aufrufenden Befehl treffen kann.
- Chromium starten mit
  `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen.
- `js/models.js` lässt sich direkt aus der Seite heraus testen:
  `await import('/js/models.js')` in `page.evaluate` nutzt die Importmap des
  Dokuments (`index.html:10-17`) und braucht keine eigene Harness-Seite.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`) liefert `state`,
  `floorGroups`, `scene`, `enterEdit`, `exitEdit`, `edit`.
- In den Einrichten-Modus kommen: `#btn-start` klicken, `#btn-build` klicken,
  ~1.5 s warten, dann `window.wipfelkratzer.enterEdit(0)` aufrufen (schneller
  und stabiler als ein 3D-Tap); `#catalog` öffnet dabei automatisch.
- `localStorage['wipfelkratzer-v1']` **vor** dem Laden zu setzen
  (`page.add_init_script`) ist deutlich schneller als der Aufbau über die
  Oberfläche und für die Alt-Spielstand-Prüfungen ohnehin nötig.

---

### Task 1: Palette, Einfärb-Tabelle und parametrisierte Modelle

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-13-moebelfarbe/t1_models.py` (Wegwerf-Test)

**Interfaces:**
- `export const FURN_COLORS: Array<{ id: string, name: string, mat: string }>`
- `export const TINTABLE: Set<string>`
- `export function makeFurniture(id: string, colorId?: string): THREE.Group`
- `FURN.sofa(body = MAT.red)`, `FURN.bett(body = MAT.red)`,
  `FURN.etagenbett(body)`, `FURN.teppich(body = MAT.red)`,
  `FURN.lampe(body = MAT.orange)`, `FURN.badewanne(body = MAT.white)`,
  `FURN.pflanze(body = MAT.terra)`, `FURN.liegestuhl(body = MAT.red)` —
  alle übrigen `FURN`-Einträge bleiben parameterlos.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-13-moebelfarbe/t1_models.py`:

      ```python
      import json, sys
      from playwright.sync_api import sync_playwright

      PORT = 8971
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const out = { errors: [] };
        if (!m.FURN_COLORS) { out.errors.push('FURN_COLORS fehlt'); return out; }
        if (!m.TINTABLE) { out.errors.push('TINTABLE fehlt'); return out; }

        // 1. Palette besteht ausschliesslich aus bestehenden MAT-Instanzen.
        for (const c of m.FURN_COLORS) {
          if (!m.MAT[c.mat]) out.errors.push('Palettenton ohne MAT-Instanz: ' + c.id);
          else if (m.MAT[c.mat].type !== 'MeshLambertMaterial')
            out.errors.push('Palettenton ist kein MeshLambertMaterial: ' + c.id);
        }
        out.paletteIds = m.FURN_COLORS.map(c => c.id);
        out.tintable = [...m.TINTABLE].sort();

        // 2. Ohne Farbe ist jedes Modell materialgleich mit heute.
        const mats = g => { const s = []; g.traverse(o => { if (o.material) s.push(o.material.uuid); }); return s.join(','); };
        const before = {};
        for (const id of m.TINTABLE) before[id] = mats(m.makeFurniture(id));
        for (const id of m.TINTABLE) {
          if (mats(m.makeFurniture(id)) !== before[id]) out.errors.push('Default nicht stabil: ' + id);
          if (mats(m.makeFurniture(id, undefined)) !== before[id]) out.errors.push('undefined != Default: ' + id);
        }

        // 3. Mit Farbe: Korpusmaterial ist exakt die MAT-Instanz, nichts wird geklont.
        const blue = m.MAT.blue;
        for (const id of m.TINTABLE) {
          const g = m.makeFurniture(id, 'blau');
          let hit = 0, clones = 0;
          const known = new Set(Object.values(m.MAT).map(x => x.uuid));
          g.traverse(o => { if (!o.material) return;
            if (o.material === blue) hit++;
            if (!known.has(o.material.uuid)) clones++; });
          if (hit === 0) out.errors.push('Korpus nicht eingefaerbt: ' + id);
          if (clones > 0) out.errors.push('Fremdes/geklontes Material in: ' + id);
        }

        // 4. MAT.red wurde nicht mutiert.
        out.redHex = m.MAT.red.color.getHexString();

        // 5. Nicht einfaerbbare Modelle ignorieren das Argument.
        const tisch = mats(m.makeFurniture('tisch'));
        if (mats(m.makeFurniture('tisch', 'blau')) !== tisch) out.errors.push('tisch reagiert auf Farbe');

        // 6. Unbekannte Farb-id fällt auf Standard zurueck.
        if (mats(m.makeFurniture('sofa', 'tuerkis')) !== before['sofa'])
          out.errors.push('unbekannte Farb-id fällt nicht auf Standard zurueck');
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
      assert res.get("errors") == [], res["errors"]
      assert res["redHex"] == "c0432e", f"MAT.red mutiert: {res['redHex']}"
      assert res["paletteIds"] == ["rot", "blau", "orange", "gruen", "rosa", "creme"], res["paletteIds"]
      assert res["tintable"] == sorted(
          ["sofa", "bett", "etagenbett", "teppich", "lampe", "badewanne", "pflanze", "liegestuhl"]
      ), res["tintable"]
      assert errs == [], errs
      print("T1 OK")
      ```

      Server starten und laufen lassen:
      `python3 -m http.server 8971 >/dev/null 2>&1 &` (nur der Server darf in
      den Hintergrund — die Playwright-Läufe **nie**).

- [ ] **Step 2: Test läuft rot.** `python3 .superpowers/sdd/2026-09-13-moebelfarbe/t1_models.py`
      muss mit `AssertionError: FURN_COLORS fehlt` (bzw. dem
      `errors`-Eintrag) abbrechen. Rot gesehen zu haben ist die Voraussetzung
      für Step 3.

- [ ] **Step 3: Palette und Tabelle anlegen.** In `js/models.js` direkt nach
      `MAT` (`js/models.js:12`):

      ```js
      /* Palette für einfärbbare Möbel. Jeder Eintrag verweist auf eine bestehende
         MAT-Instanz — es wird nie eine neue erzeugt und nie eine mutiert, sonst
         färbt sich der halbe Turm mit. */
      export const FURN_COLORS = [
        { id: 'rot',    name: 'Rot',    mat: 'red' },
        { id: 'blau',   name: 'Blau',   mat: 'blue' },
        { id: 'orange', name: 'Orange', mat: 'orange' },
        { id: 'gruen',  name: 'Grün',   mat: 'green2' },
        { id: 'rosa',   name: 'Rosa',   mat: 'pink' },
        { id: 'creme',  name: 'Creme',  mat: 'cream' },
      ];
      /* Möbel mit einer einfärbbaren Korpusfläche (Stoff/Korpuston, kein Holz,
         kein Beschlag, kein Effekt). Siehe Spec «Korpusregel». */
      export const TINTABLE = new Set(['sofa', 'bett', 'etagenbett', 'teppich', 'lampe', 'badewanne', 'pflanze', 'liegestuhl']);
      export const matOfColor = colorId => {
        const def = FURN_COLORS.find(c => c.id === colorId);
        return def ? MAT[def.mat] : null;
      };
      ```

- [ ] **Step 4: Die acht Modelle parametrisieren.** Jeweils Default = heutiges
      Material, damit sich ohne Argument nichts ändert:

      ```js
      bett(body = MAT.red) { const g = G();
        box(g, 0.8, 0.22, 1.05, MAT.wood, 0, 0.16); box(g, 0.8, 0.34, 0.08, MAT.wood, 0, 0.3, -0.5);
        box(g, 0.72, 0.1, 0.95, MAT.cream, 0, 0.31); box(g, 0.5, 0.09, 0.26, MAT.white, 0, 0.38, -0.32);
        box(g, 0.74, 0.07, 0.55, body, 0, 0.35, 0.2);
        [-0.34, 0.34].forEach(x => [-0.46, 0.46].forEach(z => box(g, 0.07, 0.12, 0.07, MAT.woodD, x, 0.05, z)));
        return g; },
      etagenbett(body) { const g = G();
        [0.2, 0.85].forEach(y => { box(g, 0.8, 0.14, 1.0, MAT.wood, 0, y); box(g, 0.72, 0.08, 0.9, MAT.cream, 0, y + 0.11);
          box(g, 0.7, 0.06, 0.4, body || (y > 0.5 ? MAT.blue : MAT.red), 0, y + 0.14, 0.2); });
        [-0.37, 0.37].forEach(x => [-0.47, 0.47].forEach(z => box(g, 0.07, 1.15, 0.07, MAT.woodD, x, 0.57, z)));
        for (let i = 0; i < 4; i++) box(g, 0.26, 0.04, 0.04, MAT.woodL, 0.45, 0.18 + i * 0.22, 0.3);
        box(g, 0.04, 0.75, 0.04, MAT.woodD, 0.45 - 0.13, 0.5, 0.3); box(g, 0.04, 0.75, 0.04, MAT.woodD, 0.58, 0.5, 0.3);
        return g; },
      sofa(body = MAT.red) { const g = G();
        box(g, 0.85, 0.26, 0.44, body, 0, 0.2); box(g, 0.85, 0.36, 0.12, body, 0, 0.48, -0.17);
        [-0.4, 0.4].forEach(x => box(g, 0.11, 0.4, 0.44, body, x, 0.3));
        box(g, 0.3, 0.09, 0.3, MAT.orange, -0.16, 0.37, 0.03); box(g, 0.3, 0.09, 0.3, MAT.cream, 0.16, 0.37, 0.03);
        return g; },
      ```

      Analog, jeweils nur am Korpusteil:
      `teppich(body = MAT.red)` → der äussere Ring `m1` (`js/models.js:102`);
      `lampe(body = MAT.orange)` → der Schirm (`js/models.js:108`, die
      `MAT.glow`-Kugel bleibt);
      `badewanne(body = MAT.white)` → der Wannenkörper `t` (`js/models.js:116`,
      Wasser/Füsse/Armatur bleiben);
      `pflanze(body = MAT.terra)` → der Topf (`js/models.js:122`, Stiel und
      Blätter bleiben);
      `liegestuhl(body = MAT.red)` → in `stripes` der farbige Streifen
      (`js/models.js:232`): `(i + first) % 2 ? MAT.white : body`.

- [ ] **Step 5: `makeFurniture` erweitern** (`js/models.js:309`):

      ```js
      export function makeFurniture(id, colorId) {
        const body = TINTABLE.has(id) ? matOfColor(colorId) : null;
        const g = body ? FURN[id](body) : FURN[id]();
        g.userData.itemId = id; if (body) g.userData.color = colorId;
        return g;
      }
      ```

      Damit ignorieren nicht einfärbbare Möbel das Argument, und eine
      unbekannte Farb-id fällt still auf Standard zurück.

- [ ] **Step 6: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-13-moebelfarbe/t1_models.py` gibt
      `T1 OK` aus, `errors` ist leer, `MAT.red` ist weiterhin `c0432e`, null
      `pageerror`. Zusätzlich `index.html` einmal im Browser laden und prüfen,
      dass die Katalog-Thumbnails unverändert aussehen (`js/game.js:541` ruft
      `makeFurniture` weiterhin einargumentig auf).

- [ ] **Step 7: Commit.**
      `feat(einrichten): Farbpalette und einfärbbare Möbelmodelle`

---

### Task 2: Farbe im Spielstand — laden, weiterreichen, bereinigen

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-13-moebelfarbe/t2_state.py` (Wegwerf-Test)

**Interfaces:**
- `state.rooms[k][i].color?: string` — optionale `FURN_COLORS`-id.
- `function normalizeColor(en: object): void` — entfernt ungültige Werte und
  setzt `migrated = true` (Muster der Tapeten-Migration, `js/game.js:379-390`).
- `placeItemMesh(k, entry)` reicht `entry.color` an `makeFurniture` weiter.
- `window.wipfelkratzer` bekommt zusätzlich `FURN_COLORS`, `TINTABLE` und
  `matCount()` für die Verifikation.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-13-moebelfarbe/t2_state.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8971
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {
          "floors": 2, "nuts": 99, "bridge": False, "garden": False, "night": False,
          "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
          "rooms": {
              "0": [
                  # alter Eintrag, exakt in der Struktur von v0.5.0 — ohne color
                  {"id": "sofa", "cell": 0, "x": -1.5, "z": -0.8, "y": 2.2, "rot": 0},
                  # gueltige Farbe
                  {"id": "bett", "cell": 1, "x": 1.5, "z": -0.8, "y": 2.2, "rot": 0, "color": "blau"},
                  # unbekannte Farbe -> muss entfernt werden
                  {"id": "teppich", "cell": 2, "x": -1.5, "z": 0.8, "y": 2.2, "rot": 0, "color": "tuerkis"},
                  # Farbe an nicht einfaerbbarem Möbel -> muss entfernt werden
                  {"id": "tisch", "cell": 3, "x": 1.5, "z": 0.8, "y": 2.2, "rot": 0, "color": "rosa"},
              ]
          },
      }

      READ = """
      () => {
        const w = window.wipfelkratzer;
        const room = w.state.rooms[0];
        const saved = JSON.parse(localStorage.getItem('wipfelkratzer-v1')).rooms['0'];
        const bodyOf = id => {
          const g = w.floorGroups[0];
          let found = null;
          g.traverse(o => { const p = o.userData && o.userData.pick;
            if (p && p.entry.id === id) found = p.mesh; });
          const seen = [];
          if (found) found.traverse(o => { if (o.material) seen.push(o.material.color.getHexString()); });
          return seen;
        };
        return { room, saved, sofa: bodyOf('sofa'), bett: bodyOf('bett'), matCount: w.matCount() };
      }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE))
          )
          page.goto(URL, wait_until="networkidle")
          page.wait_for_timeout(2500)
          res = page.evaluate(READ)
          b.close()

      print(json.dumps(res, indent=2, ensure_ascii=False))
      room = {e["id"]: e for e in res["room"]}
      saved = {e["id"]: e for e in res["saved"]}
      assert "color" not in room["sofa"], "alter Eintrag darf keine Farbe bekommen"
      assert room["bett"]["color"] == "blau", room["bett"]
      assert "color" not in room["teppich"], "unbekannte Farbe nicht entfernt"
      assert "color" not in room["tisch"], "Farbe an nicht einfaerbbarem Möbel nicht entfernt"
      assert "color" not in saved["teppich"], "bereinigter Stand nicht zurueckgeschrieben"
      assert "c0432e" in res["sofa"], "Sofa nicht mehr in Standardrot"
      assert "3f6fb5" in res["bett"], "Bett nicht blau"
      assert errs == [], errs
      print("T2 OK, Materialien in der Szene:", res["matCount"])
      ```

- [ ] **Step 2: Test läuft rot** — `window.wipfelkratzer.matCount is not a
      function` bzw. `color` bleibt an `teppich`/`tisch` stehen.

- [ ] **Step 3: Import erweitern** (`js/game.js:3`): `FURN_COLORS` und
      `TINTABLE` aus `./models.js` mit aufnehmen.

- [ ] **Step 4: Normalisierung einbauen**, direkt neben `wallpaperOf()`
      (`js/game.js:379-390`), damit sie sich das bestehende `migrated`-Flag
      und dessen einmaliges `save()` (`js/game.js:1186`) teilt:

      ```js
      /* Farbe pro Möbel. Alte Stände haben hier nichts — das ist gültig und heisst
         «Standardfarbe». Ein unbekannter Wert oder eine Farbe an einem nicht
         einfärbbaren Möbel wird still entfernt (wie die Tapeten-Migration). */
      function normalizeColor(en) {
        if (!en.color) return;
        if (!TINTABLE.has(en.id) || !FURN_COLORS.some(c => c.id === en.color)) { delete en.color; migrated = true; }
      }
      ```

- [ ] **Step 5: `placeItemMesh` reicht die Farbe durch** (`js/game.js:447-470`):

      ```js
      function placeItemMesh(k, entry) {
        normalizeColor(entry);
        if (entry.x === undefined) { const p = cellPos(k, entry.cell || 0); entry.x = p.x; entry.z = p.z; entry.rot = (entry.rot || 0) * Math.PI / 2; }
        const m = makeFurniture(entry.id, entry.color);
        /* … unveränderter Rest … */
      ```

      `placeItemMesh` ist der einzige Erzeugungspfad (aufgerufen aus
      `addItem()` `js/game.js:704` und aus dem Start-Rehydrieren
      `js/game.js:1177-1181`), damit greift die Normalisierung überall.

- [ ] **Step 6: Debug-Hook erweitern** (`js/game.js:1188`) — für die
      Verifikation, dass keine Materialien dazukommen:

      ```js
      window.wipfelkratzer = { state, floorGroups, roofG, roofStairG, roofGapG, scene, camera, controls, WALL_KEYS,
        FURN_COLORS, TINTABLE,
        matCount() { const s = new Set(); scene.traverse(o => { if (o.material) s.add(o.material.uuid); }); return s.size; },
        get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; } };
      ```

- [ ] **Step 7: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-13-moebelfarbe/t2_state.py` gibt
      `T2 OK` aus, null `pageerror`. Danach `t1_models.py` erneut laufen
      lassen — beide müssen grün sein.

- [ ] **Step 8: Commit.**
      `feat(einrichten): Möbelfarbe im Spielstand speichern und bereinigen`

---

### Task 3: Farbwahl in der Auswahlleiste

**Files:**
- `index.html`
- `js/game.js`
- `.superpowers/sdd/2026-09-13-moebelfarbe/t3_ui.py` (Wegwerf-Test)

**Interfaces:**
- `#btn-color` — Knopf «Farbe» in `#selbar`, sichtbar nur für
  `TINTABLE`-Möbel (Muster `#btn-move`/`#wallpad`, `js/game.js:674-677`).
- `#colorpick` — Swatch-Reihe, `.open` klappt sie auf; Knöpfe tragen
  `data-color` (`"standard"` plus die sechs Paletten-ids) und `.on` für die
  aktive Wahl.
- `function renderColorPick(): void`, `function setItemColor(colorId: string|null): void`,
  `function rebuildItemMesh(pick): object` (neues `pick`-Objekt).

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-13-moebelfarbe/t3_ui.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8971
      URL = f"http://127.0.0.1:{PORT}/index.html"
      SAVE = {
          "floors": 1, "nuts": 99, "bridge": False, "garden": False, "night": False,
          "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
          "rooms": {"0": [
              {"id": "sofa", "cell": 0, "x": -1.5, "z": -0.8, "y": 2.2, "rot": 0},
              {"id": "tisch", "cell": 1, "x": 1.5, "z": -0.8, "y": 2.2, "rot": 0},
          ]},
      }

      SELECT = """
      (id) => {
        const w = window.wipfelkratzer;
        let pick = null;
        w.floorGroups[0].traverse(o => { const p = o.userData && o.userData.pick;
          if (p && p.entry.id === id) pick = p; });
        window.__select(pick);
        return !!pick;
      }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)"
                               % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.wait_for_timeout(1500)
          page.evaluate("() => window.wipfelkratzer.enterEdit(0)")
          page.wait_for_timeout(1200)

          assert page.evaluate(SELECT, "sofa"), "Sofa nicht gefunden"
          assert page.locator("#btn-color").is_visible(), "Farbknopf fehlt beim Sofa"
          box = page.locator("#btn-color").bounding_box()
          assert box["width"] >= 44 and box["height"] >= 44, box

          page.click("#btn-color", timeout=20000)
          swatches = page.locator("#colorpick button")
          assert swatches.count() == 7, swatches.count()
          sb = swatches.nth(1).bounding_box()
          assert sb["width"] >= 44 and sb["height"] >= 44, sb

          page.click("#colorpick button[data-color='blau']", timeout=20000)
          page.wait_for_timeout(500)
          after = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            const en = w.state.rooms[0].find(e => e.id === 'sofa');
            let mesh = null;
            w.floorGroups[0].traverse(o => { const p = o.userData && o.userData.pick;
              if (p && p.entry.id === 'sofa') mesh = p.mesh; });
            const cols = []; mesh.traverse(o => { if (o.material) cols.push(o.material.color.getHexString()); });
            return { color: en.color, cols, matCount: w.matCount(),
                     picks: w.floorGroups[0].children.filter(o => o.userData && o.userData.pick).length,
                     saved: JSON.parse(localStorage.getItem('wipfelkratzer-v1')).rooms['0'] };
          }""")
          assert after["color"] == "blau", after
          assert "3f6fb5" in after["cols"], after["cols"]
          assert "e08a3c" in after["cols"] and "fdf4e0" in after["cols"], "Kissen verloren"
          assert "c0432e" not in after["cols"], "Korpus noch rot"
          assert after["picks"] == 2, f"Mesh-Leiche im Raum: {after['picks']}"
          assert [e for e in after["saved"] if e["id"] == "sofa"][0]["color"] == "blau"

          # Standard setzt zurueck und entfernt das Feld
          page.click("#colorpick button[data-color='standard']", timeout=20000)
          page.wait_for_timeout(500)
          reset = page.evaluate("""() => {
            const en = window.wipfelkratzer.state.rooms[0].find(e => e.id === 'sofa');
            return { has: 'color' in en, matCount: window.wipfelkratzer.matCount() };
          }""")
          assert reset["has"] is False, reset

          # Nicht einfaerbbares Möbel: kein Farbknopf
          page.evaluate(SELECT, "tisch")
          assert not page.locator("#btn-color").is_visible(), "Farbknopf am Tisch sichtbar"
          assert not page.locator("#colorpick.open").count(), "Farbreihe bleibt offen"
          b.close()

      assert errs == [], errs
      print("T3 OK")
      ```

      Für den Test wird `select` einmalig als `window.__select = select;`
      neben dem bestehenden Debug-Hook (`js/game.js:1188`) exportiert — der
      Hook ist ohnehin schon Teil des Auslieferungsstands.

- [ ] **Step 2: Test läuft rot** — `#btn-color` existiert nicht.

- [ ] **Step 3: Markup und Styling.** In `index.html` innerhalb `#selbar`
      (`index.html:187-196`), vor `#btn-del`:

      ```html
      <button id="btn-color">Farbe</button>
      <div id="colorpick" aria-label="Farbe wählen"></div>
      ```

      Und im `<style>`-Block neben `#wallpick` (`index.html:113-116`):

      ```css
      #colorpick { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
        display: none; gap: 6px; padding: 8px; background: var(--cream);
        border: 3px solid var(--woodL); border-radius: 16px; box-shadow: 0 4px 14px rgba(74,58,36,.25); }
      #colorpick.open { display: flex; }
      #colorpick button { min-width: 44px; min-height: 44px; padding: 0; border-radius: 50%; font-size: 13px; }
      #colorpick button.on { outline: 3px solid var(--wood); outline-offset: 2px; }
      ```

      `#selbar` bekommt dafür `position: relative` (`index.html:71`), damit
      die Reihe über der Leiste schwebt und `--selbar-h` unverändert bleibt.

- [ ] **Step 4: Reihe rendern und verdrahten** in `js/game.js`, neben
      `select()`/`deselect()` (`js/game.js:671-678`):

      ```js
      function renderColorPick() {
        const el = $('colorpick'); el.innerHTML = '';
        if (!selected) return;
        const cur = selected.entry.color || 'standard';
        const mk = (id, label, hex) => { const b = document.createElement('button');
          b.dataset.color = id; b.title = label; b.setAttribute('aria-label', label);
          if (hex) b.style.background = hex; else b.textContent = '↺';
          if (id === cur) b.className = 'on';
          b.onclick = () => setItemColor(id === 'standard' ? null : id);
          el.appendChild(b); };
        mk('standard', 'Standardfarbe', null);
        FURN_COLORS.forEach(c => mk(c.id, c.name, '#' + MAT[c.mat].color.getHexString()));
      }
      function setItemColor(colorId) {
        if (!selected) return;
        const en = selected.entry;
        if (colorId) en.color = colorId; else delete en.color;
        select(rebuildItemMesh(selected));
        $('colorpick').classList.add('open'); renderColorPick();
        sfx.pop(); save();
      }
      ```

      `deselect()` (`js/game.js:671`) und `exitEdit()` (`js/game.js:657-670`)
      schliessen die Reihe zusätzlich:
      `$('colorpick').classList.remove('open');`

      In `select()` (`js/game.js:672-678`), analog zu `#btn-move`:

      ```js
      $('btn-color').classList.toggle('hidden', !TINTABLE.has(pick.entry.id));
      renderColorPick();
      ```

      Und der Knopf selbst, bei den übrigen `#selbar`-Handlern
      (`js/game.js:1043-1055`):

      ```js
      $('btn-color').onclick = () => { if (!selected || !TINTABLE.has(selected.entry.id)) return;
        $('colorpick').classList.toggle('open'); renderColorPick(); };
      ```

- [ ] **Step 5: Mesh-Neubau.** Neben `removeItem()` (`js/game.js:714-720`),
      damit derselbe Abbau-Pfad wie beim Löschen benutzt wird:

      ```js
      /* Umfärben heisst: Mesh wegwerfen und über placeItemMesh neu bauen. Das ist
         der einzige Pfad, der Elternknoten, itemMeshes, spinners und userData.pick
         korrekt verdrahtet — ein zweiter, halber Pfad wäre die Fehlerquelle. */
      function rebuildItemMesh(pick) {
        const { k, entry, mesh } = pick;
        parentOf(k).remove(mesh);
        const mi = itemMeshes[k].indexOf(mesh); if (mi >= 0) itemMeshes[k].splice(mi, 1);
        if (mesh.userData.wheel) { const si = spinners.indexOf(mesh.userData.wheel); if (si >= 0) spinners.splice(si, 1); }
        const m = placeItemMesh(k, entry);
        clampEntry(k, m, entry);
        return m.userData.pick;
      }
      ```

- [ ] **Step 6: Debug-Hook für den Test.** Am bestehenden Hook
      (`js/game.js:1188`) zusätzlich `window.__select = select;` setzen.

- [ ] **Step 7: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-13-moebelfarbe/t3_ui.py` gibt `T3 OK`
      aus, null `pageerror`. Danach `t1_models.py` und `t2_state.py` erneut
      laufen lassen — alle drei müssen grün sein.

- [ ] **Step 8: Commit.**
      `feat(einrichten): Farbwahl in der Auswahlleiste`

---

### Task 4: Abnahme gegen die Acceptance Criteria

**Files:**
- `.superpowers/sdd/2026-09-13-moebelfarbe/t4_abnahme.py` (Wegwerf-Test)
- `CHANGELOG.md`
- ggf. `js/game.js`, `js/models.js`, `index.html` (nur falls diese Runde eine
  Lücke aufdeckt — dann hier reparieren, nicht als neuen Task aufmachen)

**Interfaces:** keine neuen. Diese Runde prüft nur das Zusammenspiel.

- [ ] **Step 1: Abnahme-Skript schreiben.**
      `.superpowers/sdd/2026-09-13-moebelfarbe/t4_abnahme.py`:

      ```python
      import json, pathlib
      from playwright.sync_api import sync_playwright

      PORT = 8971
      URL = f"http://127.0.0.1:{PORT}/index.html"
      OUT = pathlib.Path(".superpowers/sdd/2026-09-13-moebelfarbe")
      TINT = ["sofa", "bett", "etagenbett", "teppich", "lampe", "badewanne", "pflanze", "liegestuhl"]
      COLORS = ["rot", "blau", "orange", "gruen", "rosa", "creme"]

      # Alter Spielstand, exakt in der Struktur vor dieser Änderung (kein color-Feld).
      OLD = {
          "floors": 1, "nuts": 99, "bridge": False, "garden": False, "night": False,
          "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
          "rooms": {"0": [
              {"id": "sofa", "cell": 0, "x": -1.5, "z": -0.8, "y": 2.2, "rot": 0},
              {"id": "sofa", "cell": 1, "x": 1.5, "z": -0.8, "y": 2.2, "rot": 0},
              {"id": "buecher", "cell": 2, "x": 0.0, "z": 0.9, "y": 2.2, "rot": 0},
              {"id": "uhr", "cell": 3, "x": 0.3, "y": 3.3, "rot": 0, "wall": "back"},
          ]},
      }

      def run(page):
          out = {}
          out["baseMats"] = page.evaluate("() => window.wipfelkratzer.matCount()")
          # AC: alter Stand laedt unverändert
          out["old"] = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            const cols = {}; w.floorGroups[0].traverse(o => { const p = o.userData && o.userData.pick;
              if (!p) return; const c = []; p.mesh.traverse(x => { if (x.material) c.push(x.material.color.getHexString()); });
              (cols[p.entry.id] = cols[p.entry.id] || []).push(c); });
            return { cols, entries: w.state.rooms[0] };
          }""")
          # alle acht Möbel in allen sechs Toenen: nur der Korpus darf sich aendern
          out["matrix"] = page.evaluate("""async ([tint, colors]) => {
            const m = await import('/js/models.js');
            const mats = g => { const s = []; g.traverse(o => { if (o.material) s.push(o.material.uuid); }); return s; };
            const bad = [];
            for (const id of tint) {
              const base = mats(m.makeFurniture(id));
              for (const c of colors) {
                const want = m.MAT[m.FURN_COLORS.find(x => x.id === c).mat].uuid;
                const got = mats(m.makeFurniture(id, c));
                if (got.length !== base.length) { bad.push('Teilezahl geändert: ' + id + '/' + c); continue; }
                const changed = got.filter((u, i) => u !== base[i]);
                /* Traegt das Modell den Ton schon als Standard (z.B. sofa/rot),
                   ist «nichts geändert» das korrekte Ergebnis. */
                if (!changed.length && !base.includes(want)) bad.push('nicht eingefaerbt: ' + id + '/' + c);
                if (changed.some(u => u !== want)) bad.push('fremdes Material getauscht: ' + id + '/' + c);
              }
            }
            return bad;
          }""", [TINT, COLORS])
          return out

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page(viewport={"width": 1280, "height": 800})
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)"
                               % json.dumps(json.dumps(OLD)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.wait_for_timeout(2000)
          page.evaluate("() => window.wipfelkratzer.enterEdit(0)")
          page.wait_for_timeout(1200)
          res = run(page)
          page.screenshot(path=str(OUT / "01-alter-stand.png"))

          # zwei Sofas unterschiedlich einfaerben
          for idx, col in ((0, "blau"), (1, "gruen")):
              page.evaluate("""(idx) => {
                const w = window.wipfelkratzer; const found = [];
                w.floorGroups[0].traverse(o => { const p = o.userData && o.userData.pick;
                  if (p && p.entry.id === 'sofa') found.push(p); });
                window.__select(found[idx]);
              }""", idx)
              page.click("#btn-color", timeout=20000)
              page.click(f"#colorpick button[data-color='{col}']", timeout=20000)
              page.wait_for_timeout(400)
          page.screenshot(path=str(OUT / "02-zwei-sofas.png"))

          mid = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            const sofas = w.state.rooms[0].filter(e => e.id === 'sofa').map(e => e.color);
            let books = null;
            w.floorGroups[0].traverse(o => { const p = o.userData && o.userData.pick;
              if (p && p.entry.id === 'buecher') { books = []; p.mesh.traverse(x => { if (x.material) books.push(x.material.color.getHexString()); }); } });
            return { sofas, books, matCount: w.matCount() };
          }""")
          assert mid["sofas"] == ["blau", "gruen"], mid["sofas"]
          assert "c0432e" in mid["books"], "MAT.red wurde mutiert — Bücher nicht mehr rot"
          assert mid["matCount"] == res["baseMats"], (mid["matCount"], res["baseMats"])

          # Neuladen: Farben überleben
          page.reload(wait_until="networkidle")
          page.wait_for_timeout(2500)
          after = page.evaluate("""() => window.wipfelkratzer.state.rooms[0]
            .filter(e => e.id === 'sofa').map(e => e.color)""")
          assert after == ["blau", "gruen"], after
          page.screenshot(path=str(OUT / "03-nach-reload.png"))
          b.close()

      assert res["matrix"] == [], res["matrix"]
      assert all("c0432e" in c for c in res["old"]["cols"]["sofa"]), res["old"]["cols"]["sofa"]
      assert all("color" not in e for e in res["old"]["entries"]), res["old"]["entries"]
      assert errs == [], errs
      print("T4 OK")
      ```

      Die Prüfung «`MAT.red` wurde nicht mutiert» läuft bewusst über den
      Bücherstapel im Raum (`js/models.js:174`) statt über einen neuen
      Debug-Hook: sichtbares Rot im Turm ist genau das, was das Kriterium meint.

- [ ] **Step 2: Skript laufen lassen und jede Abweichung hier reparieren.**
      Erwartet ist ein grüner Durchlauf; jede rote Zusicherung wird in
      `js/models.js` / `js/game.js` / `index.html` behoben, nicht im Test
      (`CLAUDE.md:48-62`, Punkt 4).

- [ ] **Step 3: Die drei Screenshots ansehen.** `01-alter-stand.png` zeigt
      beide Sofas in Standardrot, `02-zwei-sofas.png` ein blaues und ein grünes
      Sofa mit weiterhin orange/cremefarbenen Kissen, `03-nach-reload.png`
      dasselbe Bild nach dem Neuladen.

- [ ] **Step 4: Restliche Kriterien von Hand im Browser prüfen** (Playwright
      deckt sie nicht sinnvoll ab): Katalog-Thumbnails zeigen Standardfarben;
      der Auswahlrahmen sitzt nach dem Umfärben korrekt am Möbel; Verschieben,
      Drehen und «Weg damit» funktionieren am umgefärbten Möbel weiter; die
      Farbreihe ist am Tablet-Hochformat vollständig erreichbar und überdeckt
      `#toolbar` nicht.

- [ ] **Step 5: Alle vier Skripte nacheinander grün laufen lassen**
      (`t1_models.py`, `t2_state.py`, `t3_ui.py`, `t4_abnahme.py`), jeweils im
      Vordergrund. Danach den Server über seinen Port beenden.

- [ ] **Step 6: `CHANGELOG.md` ergänzen** — ein `Added`-Eintrag «Möbelfarbe
      beim Einrichten wählbar (Issue #34)», passend zum bestehenden Format
      (`CHANGELOG.md`, Conventional-Commits-generiert, `cliff.toml`).

- [ ] **Step 7: Commit.**
      `feat(einrichten): Abnahme der Möbelfarbe und Changelog`
