# Plan — «Wipfkea»: eine eigene Möbelserie (Issue #42)

**Goal:** Vier neue Katalogmöbel — Regal, Tisch, Stuhl, Sofa — bilden eine an
der **Form** erkennbare Serie: überall dieselbe Brettstärke, rechte Winkel,
sichtbare helle Dübel, braune Bretter und rosa Polster. Sie verhalten sich im
Katalog, im Raum und im Spielstand wie jedes bestehende Möbel; das
Wipfkea-Sofa erfüllt den Sofa-Wunsch wie ein Sofa.

**Architecture:** Die Serie lebt vollständig in `js/models.js`. Oben, direkt
nach `MAT` (`js/models.js:4-12`), stehen die Serienkonstanten (`WK_T`,
`WK_LEG`, `WK_BOARD`, `WK_SOFT`, `WK_DOWEL`) und drei Helfer (`wkBoard`,
`wkPanel`, `wkDowel`), die auf den bestehenden Primitiv-Helfern `box`/`cyl`
(`js/models.js:17-18`) aufsetzen. Die vier Modelle sind gewöhnliche
`FURN`-Einträge (`js/models.js:65`) mit `wk_`-Präfix und bekommen — nach der
Signatur aus Spec #34 — einen optionalen Korpusparameter, dessen Default das
heutige Material ist. In `js/game.js` ändert sich genau zweierlei: `SURFACES`
(`js/game.js:429`) bekommt `wk_regal` und `wk_tisch`, und die Wunschprüfung
(`js/game.js:768, 775`) vergleicht über `wishKey(id)`, das das `wk_`-Präfix
abschneidet. Am Spielstand ändert sich **nichts** — ein Serienmöbel ist ein
normaler Eintrag mit neuer `id`.

**Spec:** `docs/ai-notes/specs/2026-09-14-wipfkea-serie-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute (`ä ö ü`), nie `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module (`CLAUDE.md:490-516`).
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  klobige Primitive aus `box`/`cyl`/`sph` (`js/models.js:14-20`), keine
  importierten Meshes, keine Texturen, keine Shader.
- **Keine neuen Farbwerte und keine neuen `MAT`-Einträge.** Die Serie benutzt
  `MAT.woodD`, `MAT.pink`, `MAT.woodL` (`js/models.js:5, 11`). Kein
  `new MeshLambertMaterial`, kein `.clone()`, **niemals** `MAT.<ton>.color.set()`
  — die `MAT`-Objekte sind turmweit geteilt (`js/game.js:1226` vergleicht auf
  Identität).
- **Keine Farbwahl-Oberfläche.** Einfärbbarkeit ist Issue #34; hier entsteht
  nur der optionale Parameter, kein Knopf, keine Palette, kein `TINTABLE`.
- **Kein Wipfkea-Laden**, keine Karte, kein Einkaufen — das ist Issue #51.
- **Bestehende Modelle bleiben Zeile für Zeile unverändert.** `sofa`, `tisch`,
  `stuhl`, `regal` (`js/models.js:78-100`) werden nicht angefasst.
- **Rückwärtskompatibler Spielstand.** `localStorage`-Schlüssel
  `wipfelkratzer-v1` muss unverändert weiterladen.
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: jede Trefferfläche
  mindestens 44 × 44 px (`index.html:62, 73`).
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, nie `run_in_background`** (`CLAUDE.md:540-568`).
  Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- **`version.js` wird nicht angefasst**, und es entsteht **kein**
  `chore(release)`-Commit. Die Version wird separat beim Release gesetzt.
- Conventional Commits, Präfix `feat(katalog)` bzw. `test(katalog)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-wipfkea-serie/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8981–8985** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
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
  Dokuments (`index.html:10-17`) und braucht keine eigene Harness-Seite.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`) liefert `state`,
  `floorGroups`, `scene`, `enterEdit`, `exitEdit`, `edit`.
- In den Einrichten-Modus kommen: `#btn-start` klicken, dann
  `window.wipfelkratzer.enterEdit(<k>)` aufrufen (schneller und stabiler als
  ein 3D-Tap); `#catalog` öffnet dabei automatisch.
- `localStorage['wipfelkratzer-v1']` **vor** dem Laden zu setzen
  (`page.add_init_script`) ist deutlich schneller als der Aufbau über die
  Oberfläche und für die Alt-Spielstand-Prüfung ohnehin nötig.

---

### Task 1: Serienkonstanten, Helfer und `wk_regal`

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-wipfkea-serie/t1_serie.py` (Wegwerf-Test)

**Interfaces:**
- Modul-privat: `WK_T`, `WK_LEG`, `WK_BOARD`, `WK_SOFT`, `WK_DOWEL`
- Modul-privat: `wkBoard(g, w, d, mat, x, y, z)`,
  `wkPanel(g, h, d, mat, x, y, z)`, `wkDowel(g, x, y, z, axis)`
- `FURN.wk_regal(body = WK_BOARD): THREE.Group`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-wipfkea-serie/t1_serie.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const out = { errors: [] };
        const known = new Map(Object.entries(m.MAT).map(([k, v]) => [v.uuid, k]));
        const g = m.makeFurniture('wk_regal');
        if (!g) { out.errors.push('wk_regal fehlt'); return out; }

        let dowels = 0, pink = 0, boards = [];
        g.traverse(o => {
          if (!o.material || !o.geometry) return;
          const name = known.get(o.material.uuid);
          if (!name) { out.errors.push('Fremdes Material in wk_regal'); return; }
          if (o.material.type !== 'MeshLambertMaterial')
            out.errors.push('Kein MeshLambertMaterial: ' + name);
          if (name === 'pink') pink++;
          const p = o.geometry.parameters;
          if (o.geometry.type === 'CylinderGeometry'
              && Math.abs(p.radiusTop - 0.02) < 1e-9 && Math.abs(p.height - 0.03) < 1e-9
              && name === 'woodL') dowels++;
          if (o.geometry.type === 'BoxGeometry' && name === 'woodD')
            boards.push(Math.min(p.width, p.height, p.depth));
        });
        out.dowels = dowels;
        out.pink = pink;
        // Jedes braune Brett/Bein hat exakt Serienmass: 0.06 (Brett) oder 0.05 (Bein).
        out.badBoards = boards.filter(t => Math.abs(t - 0.06) > 1e-9 && Math.abs(t - 0.05) > 1e-9);

        const THREE = await import('three');
        const bb = new THREE.Box3().setFromObject(g);
        out.size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
        out.minY = bb.min.y;
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
      assert res["dowels"] >= 2, f"zu wenige Dübel: {res['dowels']}"
      assert res["pink"] == 0, "wk_regal darf kein Pink tragen"
      assert res["badBoards"] == [], f"Brettstärke fällt aus der Serie: {res['badBoards']}"
      assert res["size"][0] <= 0.9 and res["size"][1] <= 1.5, res["size"]
      assert abs(res["minY"]) < 0.02, f"Regal schwebt oder steckt im Boden: {res['minY']}"
      assert errs == [], errs
      print("T1 OK")
      ```

      Server starten und laufen lassen:
      `python3 -m http.server 8981 >/dev/null 2>&1 &` (nur der Server darf in
      den Hintergrund — die Playwright-Läufe **nie**).

- [ ] **Step 2: Test läuft rot.** `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t1_serie.py`
      muss mit `AssertionError: ['wk_regal fehlt']` abbrechen — bzw. mit einem
      `TypeError` aus `FURN[id]`, falls die id gar nicht existiert. Rot gesehen
      zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: Serienkonstanten und Helfer anlegen.** In `js/models.js`
      direkt nach `const G = () => new THREE.Group();` (`js/models.js:21`):

      ```js
      /* ---------- Wipfkea: die gemeinsame Formsprache der Serie ----------
         Alles, was die Serienmöbel zusammenhält, steht hier. Eine Serie ist in
         diesem Spiel bewusst eine Form- und keine Farbfrage: die Farbwahl pro
         Möbel ist Issue #34, die Serie sind Brettstärke, rechte Winkel,
         sichtbare Dübel und Wangen statt Beine. Ein Serienmöbel greift nie
         direkt auf ein MAT zu, sondern immer über die Rollen unten. */
      const WK_T = 0.06;           /* Brettstärke, in der ganzen Serie identisch */
      const WK_LEG = 0.05;         /* Kantenmass der Vierkantbeine */
      const WK_BOARD = MAT.woodD;  /* Braun: alles Tragende */
      const WK_SOFT = MAT.pink;    /* Pink: Polster und Blenden */
      const WK_DOWEL = MAT.woodL;  /* Hell: sichtbare Dübel und Rückwand */

      /* Liegendes Brett (Boden, Tablar, Sitzfläche). */
      const wkBoard = (g, w, d, mat, x, y, z) => box(g, w, WK_T, d, mat, x, y, z);
      /* Stehende Wange (Seitenteil, Armlehne). */
      const wkPanel = (g, h, d, mat, x, y, z) => box(g, WK_T, h, d, mat, x, y, z);
      /* Sichtbarer Dübelkopf — das Erkennungszeichen der Serie.
         axis 'x' zeigt seitlich heraus, 'y' nach oben, 'z' nach vorn. */
      function wkDowel(g, x, y, z, axis = 'z') {
        const d = cyl(g, 0.02, 0.02, 0.03, WK_DOWEL, x, y, z, 8);
        if (axis === 'z') d.rotation.x = Math.PI / 2;
        else if (axis === 'x') d.rotation.z = Math.PI / 2;
        return d;
      }
      ```

- [ ] **Step 4: `wk_regal` bauen.** In `FURN` (`js/models.js:65`), hinter
      `regal` (`js/models.js:100`):

      ```js
        /* Wipfkea — Serie in Braun und Pink, siehe Spec «Wipfkea». Der
           body-Parameter folgt der Signatur aus Issue #34: ohne Argument sieht
           das Möbel genau so aus wie hier beschrieben. */
        wk_regal(body = WK_BOARD) { const g = G();
          const w = 0.8, d = 0.3, h = 1.2, inner = w - 2 * WK_T;
          [-1, 1].forEach(s => wkPanel(g, h, d, body, s * (w / 2 - WK_T / 2), h / 2, 0));
          const shelves = [0.05, 0.42, 0.79, 1.16];
          shelves.forEach(y => wkBoard(g, inner, d, body, 0, y, 0));
          box(g, inner, h, 0.02, WK_DOWEL, 0, h / 2, -d / 2 + 0.01);
          shelves.forEach(y => [-1, 1].forEach(s => wkDowel(g, s * (w / 2 + 0.005), y, d / 2 - 0.07, 'x')));
          return g; },
      ```

- [ ] **Step 5: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t1_serie.py`
      endet mit `T1 OK`. Ist `badBoards` nicht leer, stimmt eine Brettstärke
      nicht — korrigieren, nicht den Test lockern.

- [ ] **Step 6: Screenshot zur Sichtprüfung.** Im selben Skript-Ordner ein
      kurzes `shot_regal.py`, das `makeFurniture('wk_regal')` in die Szene
      hängt und `page.screenshot(path=".superpowers/sdd/2026-09-14-wipfkea-serie/regal.png")`
      schreibt. Das Bild muss ein Brettregal mit vier Tablaren, heller Rückwand
      und acht hellen Dübelköpfen an den Aussenseiten zeigen.

---

### Task 2: `wk_tisch` und `wk_stuhl`

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-wipfkea-serie/t2_tisch_stuhl.py` (Wegwerf-Test)

**Interfaces:**
- `FURN.wk_tisch(body = WK_BOARD): THREE.Group`
- `FURN.wk_stuhl(body = WK_SOFT): THREE.Group` — `body` färbt das **Kissen**,
  nicht das Gestell; das ist die bunte Fläche im Sinn der Korpusregel aus
  Spec #34.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-wipfkea-serie/t2_tisch_stuhl.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const THREE = await import('three');
        const known = new Map(Object.entries(m.MAT).map(([k, v]) => [v.uuid, k]));
        const out = { errors: [], models: {} };
        for (const id of ['wk_tisch', 'wk_stuhl']) {
          const g = m.makeFurniture(id);
          const r = { dowels: 0, pink: 0, badBoards: [], foreign: 0 };
          g.traverse(o => {
            if (!o.material || !o.geometry) return;
            const name = known.get(o.material.uuid);
            if (!name) { r.foreign++; return; }
            if (o.material.type !== 'MeshLambertMaterial') out.errors.push('Kein Lambert: ' + id);
            if (name === 'pink') r.pink++;
            const p = o.geometry.parameters;
            if (o.geometry.type === 'CylinderGeometry'
                && Math.abs(p.radiusTop - 0.02) < 1e-9 && Math.abs(p.height - 0.03) < 1e-9
                && name === 'woodL') r.dowels++;
            if (o.geometry.type === 'BoxGeometry' && name === 'woodD')
              { const t = Math.min(p.width, p.height, p.depth);
                if (Math.abs(t - 0.06) > 1e-9 && Math.abs(t - 0.05) > 1e-9) r.badBoards.push(t); }
          });
          const bb = new THREE.Box3().setFromObject(g);
          r.size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
          r.minY = bb.min.y;
          out.models[id] = r;
        }
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
      t, s = res["models"]["wk_tisch"], res["models"]["wk_stuhl"]
      for id_, r in res["models"].items():
          assert r["foreign"] == 0, f"{id_}: fremdes Material"
          assert r["badBoards"] == [], f"{id_}: {r['badBoards']}"
          assert r["dowels"] >= 2, f"{id_}: zu wenige Dübel ({r['dowels']})"
          assert r["size"][0] <= 0.9 and r["size"][1] <= 1.5, f"{id_}: {r['size']}"
          assert abs(r["minY"]) < 0.02, f"{id_} steht nicht auf dem Boden: {r['minY']}"
      assert t["pink"] == 0, "wk_tisch darf kein Pink tragen"
      assert s["pink"] >= 1, "wk_stuhl braucht ein rosa Kissen"
      assert 0.4 <= t["size"][1] <= 0.55, f"Tischhöhe unplausibel: {t['size'][1]}"
      assert 0.7 <= s["size"][1] <= 0.95, f"Stuhlhöhe unplausibel: {s['size'][1]}"
      assert errs == [], errs
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.** `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t2_tisch_stuhl.py`
      bricht ab, weil `wk_tisch` in `FURN` fehlt.

- [ ] **Step 3: `wk_tisch` bauen.** In `FURN`, direkt hinter `wk_regal`:

      ```js
        wk_tisch(body = WK_BOARD) { const g = G();
          const w = 0.7, top = 0.46, legH = top - WK_T, off = w / 2 - 0.06;
          wkBoard(g, w, w, body, 0, top - WK_T / 2);
          [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
            box(g, WK_LEG, legH, WK_LEG, body, sx * off, legH / 2, sz * off);
            wkDowel(g, sx * off, top + 0.005, sz * off, 'y'); }));
          return g; },
      ```

- [ ] **Step 4: `wk_stuhl` bauen.** Direkt hinter `wk_tisch`:

      ```js
        /* body ist hier das Kissen: die einzige bunte Fläche am Stuhl. */
        wk_stuhl(body = WK_SOFT) { const g = G();
          const w = 0.42, d = 0.42, seat = 0.38, inner = w - 2 * WK_T;
          [-1, 1].forEach(s => wkPanel(g, seat, d, WK_BOARD, s * (w / 2 - WK_T / 2), seat / 2, 0));
          wkBoard(g, inner, d, WK_BOARD, 0, seat - WK_T / 2);
          const back = box(g, w, 0.42, WK_T, WK_BOARD, 0, seat + 0.21, -d / 2 + WK_T / 2);
          back.rotation.x = -0.12;
          box(g, inner - 0.02, 0.05, d - 0.08, body, 0, seat + 0.025, 0.01);
          [-1, 1].forEach(s => [-0.14, 0.14].forEach(z =>
            wkDowel(g, s * (w / 2 + 0.005), seat - WK_T / 2, z, 'x')));
          return g; },
      ```

- [ ] **Step 5: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t2_tisch_stuhl.py`
      endet mit `T2 OK`.

- [ ] **Step 6: Screenshot zur Sichtprüfung.** `shot_regal.py` um beide
      Modelle erweitern (nebeneinander bei x = −0.9 / 0 / 0.9) und das Bild
      prüfen: gleiche Brettstärke bei allen dreien, Dübel an denselben
      Stellen, Pink nur auf dem Stuhlkissen.

---

### Task 3: `wk_sofa` und die Probe nebeneinander

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-wipfkea-serie/t3_sofa.py` (Wegwerf-Test)

**Interfaces:**
- `FURN.wk_sofa(body = WK_SOFT): THREE.Group` — `body` färbt die vier Kissen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-wipfkea-serie/t3_sofa.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const THREE = await import('three');
        const known = new Map(Object.entries(m.MAT).map(([k, v]) => [v.uuid, k]));
        const out = { errors: [] };
        const g = m.makeFurniture('wk_sofa');
        let dowels = 0, pink = 0, foreign = 0; const bad = [];
        g.traverse(o => {
          if (!o.material || !o.geometry) return;
          const name = known.get(o.material.uuid);
          if (!name) { foreign++; return; }
          if (name === 'pink') pink++;
          const p = o.geometry.parameters;
          if (o.geometry.type === 'CylinderGeometry'
              && Math.abs(p.radiusTop - 0.02) < 1e-9 && name === 'woodL') dowels++;
          if (o.geometry.type === 'BoxGeometry' && name === 'woodD') {
            const t = Math.min(p.width, p.height, p.depth);
            if (Math.abs(t - 0.06) > 1e-9 && Math.abs(t - 0.05) > 1e-9) bad.push(t); }
        });
        const bb = new THREE.Box3().setFromObject(g);
        out.sofa = { dowels, pink, foreign, bad,
          size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z], minY: bb.min.y };

        // Nebeneinander: Serienstück und klassisches Gegenstück überlappen nicht,
        // wenn sie 1.0 auseinander stehen (Rasterweite ~0.95, js/game.js:357).
        const a = m.makeFurniture('sofa'), b2 = m.makeFurniture('wk_sofa');
        a.position.x = -0.5; b2.position.x = 0.5;
        const ba = new THREE.Box3().setFromObject(a), bbx = new THREE.Box3().setFromObject(b2);
        out.overlap = ba.intersectsBox(bbx);
        out.classicSize = [ba.max.x - ba.min.x, ba.max.y - ba.min.y];
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
      s = res["sofa"]
      assert s["foreign"] == 0 and s["bad"] == [], s
      assert s["dowels"] >= 2, f"zu wenige Dübel: {s['dowels']}"
      assert s["pink"] >= 4, f"vier Kissen erwartet, {s['pink']} rosa Teile"
      assert s["size"][0] <= 0.9, f"zu breit: {s['size'][0]}"
      assert s["size"][1] <= 0.8, f"zu hoch: {s['size'][1]}"
      assert abs(s["minY"]) < 0.02, f"schwebt: {s['minY']}"
      assert res["overlap"] is False, "Serien-Sofa und klassisches Sofa überlappen im Raster"
      assert errs == [], errs
      print("T3 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Der Lauf bricht ab, weil `wk_sofa` fehlt.

- [ ] **Step 3: `wk_sofa` bauen.** In `FURN`, hinter `wk_stuhl`:

      ```js
        /* body sind die vier Kissen — Sitz und Rücken. Das Gestell bleibt braun. */
        wk_sofa(body = WK_SOFT) { const g = G();
          const w = 0.86, d = 0.48, inner = w - 2 * WK_T;
          [-1, 1].forEach(s => wkPanel(g, 0.54, d, WK_BOARD, s * (w / 2 - WK_T / 2), 0.27, 0));
          box(g, inner, 0.44, WK_T, WK_BOARD, 0, 0.32, -d / 2 + WK_T / 2);
          wkBoard(g, inner, d - WK_T, WK_BOARD, 0, 0.28, 0.03);
          [-0.185, 0.185].forEach(x => box(g, 0.34, 0.12, 0.38, body, x, 0.37, 0.03));
          [-0.185, 0.185].forEach(x => box(g, 0.34, 0.26, 0.1, body, x, 0.53, -0.13));
          [-1, 1].forEach(s => [0.1, 0.28].forEach(y =>
            wkDowel(g, s * (w / 2 + 0.005), y, 0.16, 'x')));
          return g; },
      ```

- [ ] **Step 4: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t3_sofa.py`
      endet mit `T3 OK`.

- [ ] **Step 5: Sichtprüfung «nebeneinander».** Ein Skript
      `shot_nebeneinander.py` rendert `sofa` bei x = −0.55 und `wk_sofa` bei
      x = 0.55 in dieselbe Szene und schreibt
      `.superpowers/sdd/2026-09-14-wipfkea-serie/nebeneinander.png`. Das Bild
      ist die eigentliche Abnahme dieses Tasks: beide müssen als Sofa lesbar
      sein, keines darf daneben wie ein Fehler wirken. Sitzhöhe und Breite
      liegen im Bild erkennbar auf demselben Niveau.

---

### Task 4: Katalog, Ablagefläche und Wunsch-Zuordnung

**Files:**
- `js/models.js`
- `js/game.js`
- `.superpowers/sdd/2026-09-14-wipfkea-serie/t4_katalog.py` (Wegwerf-Test)

**Interfaces:**
- `CATALOG` bekommt vier Einträge mit `cat: 'mobel'`.
- `js/game.js`: `const wishKey = id => id.startsWith('wk_') ? id.slice(3) : id;`
- `SURFACES` (`js/game.js:429`) enthält zusätzlich `'wk_regal'`, `'wk_tisch'`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-wipfkea-serie/t4_katalog.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      # Stock 5 gehört Jimmy Wiesel und Jule Wühlmaus, Wunsch 'sofa' (js/game.js:25).
      # Drei Möbel drin => tenantIn(5) ist wahr, der Wunsch ist offen.
      SAVE = {
          "floors": 10, "nuts": 0, "fulfilled": {}, "wallpaper": {}, "flooring": {},
          "rooms": {"5": [
              {"id": "tisch", "cell": 0, "x": -1.2, "z": -0.8, "rot": 0},
              {"id": "stuhl", "cell": 1, "x": 0.0, "z": -0.8, "rot": 0},
              {"id": "lampe", "cell": 2, "x": 1.2, "z": -0.8, "rot": 0}]}
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

          cat = page.evaluate("""async () => {
            const m = await import('/js/models.js');
            const ids = m.CATALOG.map(c => c.id);
            return { ids, cats: m.CATALOG.filter(c => c.id.startsWith('wk_')).map(c => c.cat),
                     names: m.CATALOG.filter(c => c.id.startsWith('wk_')).map(c => c.name) };
          }""")
          for wid in ["wk_regal", "wk_tisch", "wk_stuhl", "wk_sofa"]:
              assert wid in cat["ids"], f"{wid} fehlt im CATALOG"
          assert set(cat["cats"]) == {"mobel"}, cat["cats"]
          assert all(n.startswith("Wipfkea ") for n in cat["names"]), cat["names"]

          page.evaluate("window.wipfelkratzer.enterEdit(5)")
          page.wait_for_timeout(1500)
          before = page.evaluate("window.wipfelkratzer.state.nuts")
          page.click("#catalog-items div.item:has-text('Wipfkea Sofa')", timeout=30000)
          page.wait_for_timeout(1200)
          after = page.evaluate("window.wipfelkratzer.state.nuts")
          fulfilled = page.evaluate("!!window.wipfelkratzer.state.fulfilled[5]")

          # Deko landet auf dem Wipfkea-Tisch, nicht am Boden.
          page.evaluate("window.wipfelkratzer.exitEdit(); window.wipfelkratzer.enterEdit(4)")
          page.wait_for_timeout(1200)
          page.click("#catalog-items div.item:has-text('Wipfkea Tisch')", timeout=30000)
          page.wait_for_timeout(800)
          page.click("#catalog-tabs button:has-text('Deko')", timeout=30000)
          page.click("#catalog-items div.item:has-text('Teekanne')", timeout=30000)
          page.wait_for_timeout(800)
          kanne_y = page.evaluate(
              "window.wipfelkratzer.state.rooms['4'].find(e => e.id === 'teekanne').y")
          b.close()

      print(json.dumps({"before": before, "after": after, "fulfilled": fulfilled,
                        "kanne_y": kanne_y}, indent=2))
      assert after - before == 3, f"Wunsch nicht erfüllt: {before} -> {after}"
      assert fulfilled is True, "state.fulfilled[5] nicht gesetzt"
      assert kanne_y > 0.4, f"Teekanne steht am Boden statt auf dem Tisch: {kanne_y}"
      assert errs == [], errs
      print("T4 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Der Lauf bricht bei
      `assert "wk_regal" in cat["ids"]` ab.

- [ ] **Step 3: Katalogeinträge ergänzen.** In `CATALOG` (`js/models.js:251`),
      direkt hinter der Zeile mit `{ id: 'regal', … }` (`js/models.js:255`):

      ```js
        /* Wipfkea — die Serie steht geschlossen am Ende der Möbel, damit sie im
           Katalog als Gruppe lesbar ist. */
        { id: 'wk_regal', name: 'Wipfkea Regal', cat: 'mobel' },
        { id: 'wk_tisch', name: 'Wipfkea Tisch', cat: 'mobel' },
        { id: 'wk_stuhl', name: 'Wipfkea Stuhl', cat: 'mobel' },
        { id: 'wk_sofa',  name: 'Wipfkea Sofa',  cat: 'mobel' },
      ```

- [ ] **Step 4: Ablageflächen ergänzen.** In `js/game.js:429`:

      ```js
      const SURFACES = ['tisch', 'regal', 'schrank', 'klavier', 'nusskiste', 'wk_regal', 'wk_tisch'];
      ```

- [ ] **Step 5: Wunsch-Zuordnung über das Präfix.** In `js/game.js`, direkt
      vor `function wishOpen(i)` (`js/game.js:766`):

      ```js
      /* Ein Serienmöbel zählt bei Wünschen wie sein klassisches Gegenstück:
         'wk_sofa' erfüllt den Sofa-Wunsch. Die Wipfkea-ids sind genau dafür als
         'wk_' + klassische id gebaut (siehe Spec «Wipfkea»). Wer ein Serienstück
         ergänzt, muss diese Namensregel einhalten. */
      const wishKey = id => id.startsWith('wk_') ? id.slice(3) : id;
      ```

      und die beiden Vergleiche umstellen — `js/game.js:768`:

      ```js
        if (roomOf(where).some(e => wishKey(e.id) === t.wish)) { state.fulfilled[i] = true; return false; }
      ```

      sowie `js/game.js:775`:

      ```js
          if (where === k && t.wish === wishKey(placedId)) {
      ```

- [ ] **Step 6: Test läuft grün.** `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t4_katalog.py`
      endet mit `T4 OK`. Schlägt der Klick auf die Katalogkachel fehl, ist der
      Tab «Möbel» nicht offen — dann vor dem Klick
      `page.click("#catalog-tabs button:has-text('Möbel')", timeout=30000)`
      ergänzen, nicht den Timeout weiter erhöhen.

---

### Task 5: Alt-Spielstand, Changelog und Abnahme gegen die Acceptance Criteria

**Files:**
- `CHANGELOG.md`
- `TODO.md`
- `.superpowers/sdd/2026-09-14-wipfkea-serie/t5_abnahme.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Abnahmeskript schreiben.**
      `.superpowers/sdd/2026-09-14-wipfkea-serie/t5_abnahme.py` prüft in einem
      Durchlauf die Punkte, die die Tasks 1–4 nicht schon abgedeckt haben:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      # Ein Spielstand in der Struktur von vor der Änderung (keine wk_-ids).
      ALT = {"floors": 3, "nuts": 7, "fulfilled": {}, "wallpaper": {"1": "rosa"}, "flooring": {},
             "rooms": {"1": [{"id": "sofa", "cell": 0, "x": -1.0, "z": -0.7, "rot": 0},
                             {"id": "tisch", "cell": 1, "x": 0.3, "z": -0.7, "rot": 0}]}}
      # Ein Spielstand mit Serienmöbeln, zum Prüfen des Neuladens.
      NEU = {"floors": 3, "nuts": 7, "fulfilled": {}, "wallpaper": {}, "flooring": {},
             "rooms": {"1": [{"id": "wk_sofa", "cell": 0, "x": -1.0, "z": -0.7, "rot": 0},
                             {"id": "wk_regal", "cell": 1, "x": 0.9, "z": -0.7, "rot": 0}]}}

      def run(save):
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = b.new_page()
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.add_init_script(
                  "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(save)))
              page.goto(URL, wait_until="networkidle")
              page.click("#btn-start", timeout=30000)
              page.wait_for_timeout(1500)
              res = page.evaluate("""() => {
                const w = window.wipfelkratzer;
                const ids = (w.state.rooms['1'] || []).map(e => e.id);
                let lambert = true, count = 0;
                w.scene.traverse(o => { if (o.material) { count++;
                  if (o.material.type && o.material.type !== 'MeshLambertMaterial'
                      && o.material.type !== 'MeshBasicMaterial') lambert = false; } });
                return { ids, lambert, count, nuts: w.state.nuts };
              }""")
              b.close()
              return res, errs

      alt, alt_errs = run(ALT)
      assert alt["ids"] == ["sofa", "tisch"], alt["ids"]
      assert alt["nuts"] == 7, alt["nuts"]
      assert alt_errs == [], alt_errs

      neu, neu_errs = run(NEU)
      assert neu["ids"] == ["wk_sofa", "wk_regal"], neu["ids"]
      assert neu["lambert"] is True, "Nicht-Lambert-Material in der Szene"
      assert neu_errs == [], neu_errs
      print(json.dumps({"alt": alt, "neu": neu}, indent=2, ensure_ascii=False))
      print("T5 OK")
      ```

- [ ] **Step 2: Abnahmeskript grün fahren.**
      `python3 .superpowers/sdd/2026-09-14-wipfkea-serie/t5_abnahme.py` endet
      mit `T5 OK`.

- [ ] **Step 3: Gesamtlauf.** Alle vier Skripte nacheinander im Vordergrund:
      `for f in t1_serie t2_tisch_stuhl t3_sofa t4_katalog t5_abnahme; do
      python3 .superpowers/sdd/2026-09-14-wipfkea-serie/$f.py || exit 1; done`.
      Fünf mal `OK` oder der Task ist nicht fertig.

- [ ] **Step 4: Changelog.** In `CHANGELOG.md` über dem Abschnitt
      `## [0.5.0] - 2026-09-13` (`CHANGELOG.md:7`) einen Abschnitt
      `## [Unreleased]` mit `### Added` anlegen, falls noch keiner da ist, und
      dort im Stil der bestehenden Einträge — deutscher Fliesstext, Issue-Nummer
      in Klammern am Ende — ergänzen:

      ```markdown
      ## [Unreleased]

      ### Added

      - «Wipfkea» — eine eigene Möbelserie in Braun und Pink: Regal, Tisch,
        Stuhl und Sofa im Bausatz-Stil, alle mit derselben Brettstärke, geraden
        Kanten und sichtbaren hellen Dübeln, dazu rosa Polster auf Stuhl und
        Sofa. Die vier Stücke stehen im Katalog unter «Möbel» und lassen sich
        einrichten wie alles andere; das Wipfkea-Sofa erfüllt den Sofa-Wunsch
        genauso wie das bisherige (#42)
      ```

      **`version.js` bleibt unverändert, und es entsteht kein
      `chore(release)`-Commit** — die Version wird separat beim Release gesetzt.

- [ ] **Step 5: TODO.** In `TODO.md` unter «Erledigt» eine Zeile ergänzen:
      `- [x] «Wipfkea»-Möbelserie in Braun und Pink: Regal, Tisch, Stuhl, Sofa (#42)`.

- [ ] **Step 6: Acceptance Criteria abhaken.** Die Liste aus
      `docs/ai-notes/specs/2026-09-14-wipfkea-serie-design.md` Punkt für Punkt
      durchgehen und je Punkt notieren, welcher Skriptlauf oder welcher
      Screenshot ihn belegt. Ein Punkt ohne Beleg ist offen — insbesondere der
      Screenshot «Serien-Sofa und klassisches Sofa im selben Raum».

- [ ] **Step 7: Server beenden.**
      `ss -lptn 'sport = :8981' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
      Kein `pkill -f`.
