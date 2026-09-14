# Plan — Terrassenhäuschen mit grünem Schilfdach (Issue #49)

**Goal:** Ein neues Dach-Objekt «Häuschen» (`terrassenhaus`) im Katalog-Tab
«Dach»: ockerfarbene Putzwände, grosses grünes Schilfdach, rundbogige
Türöffnung mit einem Frosch darin, rundbogiges Fenster in der Giebelwand. Es
lässt sich wie jedes andere Dachobjekt aufstellen, verschieben, drehen und
löschen, hält dabei den Treppenaufgang frei und überlebt das Neuladen. Es ist
**nicht begehbar** — man schaut hinein, man geht nicht hinein (#44).

**Architecture:** Ein neuer `FURN`-Eintrag `terrassenhaus()` in `js/models.js`
plus drei lokale Helfer (`hausArch`, `hausWall`, `hausRoofHalf`) und eine
einzige neue Materialkonstante `HAUS_WALL`. Die Wände sind
`ExtrudeGeometry`-Scheiben mit Rundbogen-Löchern — dasselbe Werkzeug, das
`poolSlab()` für die Nierenform benutzt (`js/models.js:40-44`); dahinter steht
ein dunkler Innenblock, damit die Öffnungen als Durchblicke lesen und nicht in
den Himmel zeigen. Das Schilfdach sind zwei Grundplatten mit je 17 liegenden
Zylindern als Halmbündel in `MAT.green2`/`MAT.leaf`, plus ein Firstzylinder.
Der Frosch in der Tür benutzt `poolFrogHead()` und `POOL_FROG` wieder
(`js/models.js:27, 54-57`). Die Anbindung ans Spiel ist **eine** Katalogzeile —
Thumbnail, Tab, Platzierung, Verschieben, Drehen, Löschen und Spielstand laufen
alle generisch über `CATALOG` (`js/game.js:534, 544, 680-722, 427-470`). An
`clampEntry` und der Treppenregel aus #20 (`js/game.js:443-445`) wird **nichts**
geändert.

**Spec:** `docs/ai-notes/specs/2026-09-14-terrassenhaeuschen-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module (`CLAUDE.md:796-821`).
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  klobige Primitive, warme entsättigte Töne. **Keine Textur, keine Map, keine
  Transparenz, kein Shader** — Texturen gibt es im Spiel nur für Tapeten und
  Böden (`js/models.js:296-307`).
- **Genau eine neue Materialinstanz** (`HAUS_WALL`). Kein bestehendes
  `MAT`-Objekt wird über `.color.set()` mutiert — sie sind spielweit geteilt
  (Regel aus #34, `docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`, A1).
- **`clampEntry` bleibt unverändert** (`js/game.js:427-446`). Das Häuschen
  ordnet sich der Treppenregel unter, es bekommt keine Ausnahme.
- **Nicht begehbar.** Keine Kamerafahrt hinein, keine Änderung an
  `controls.minDistance` / `enablePan` (`js/game.js:63-64`), keine
  Innenausstattung, kein eigener Raum im Spielstand.
- **Keine Änderung an `TENANTS`** (`js/game.js:19-31`) — kein neuer Wunsch.
- **Rückwärtskompatibler Spielstand.** `localStorage`-Schlüssel
  `wipfelkratzer-v1` muss weiter laden; das Häuschen ist ein gewöhnlicher
  Eintrag in `state.rooms.roof`, es braucht keine Migration.
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: die Katalogkachel
  erbt `min-height: 44px` (`index.html:61`).
- **`version.js` wird nicht angefasst** und es gibt **keinen
  `chore(release)`-Commit.** Der Changelog-Eintrag geht unter
  `## [Unreleased]` → `### Added`, deutscher Fliesstext, Issue-Nummer in
  Klammern, im Stil der bestehenden Einträge (`CHANGELOG.md:9-15`).
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, nie `run_in_background`** (`CLAUDE.md:550-560`).
  Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- Conventional Commits, Präfix `feat(dach)` bzw. `test(dach)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-terrassenhaeuschen/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9002–9006** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
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
  Dokuments (`index.html:10-24`) und braucht keine eigene Harness-Seite.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`) liefert `state`,
  `roofG`, `scene`, `camera`, `enterEdit`, `exitEdit`, `dims`, `cellPos`.
  Die Dachterrasse ist **immer** sichtbar und editierbar (`updateRoof()`,
  `js/game.js:353-354`) — es braucht keine zehn Stockwerke, um
  `enterEdit('roof')` aufzurufen.
- **Die Treppenregel wird über den echten Ladepfad geprüft, nicht über einen
  neuen Hook:** beim Laden ruft `js/game.js:1180-1181` für jeden
  Dach-Eintrag `clampEntry('roof', m, e)` nach und schreibt das Ergebnis in
  `state.rooms.roof` zurück. Ein absichtlich falsch gesetzter Eintrag in
  `localStorage` zeigt nach dem Laden also exakt die geklemmte Position.
- `localStorage['wipfelkratzer-v1']` **vor** dem Laden zu setzen
  (`page.add_init_script`) ist deutlich schneller als der Aufbau über die
  Oberfläche.

---

### Task 1: Das Modell `terrassenhaus` in `js/models.js`

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t1_modell.py` (Wegwerf-Test)

**Interfaces:**
- `FURN.terrassenhaus(): THREE.Group` — neuer Eintrag hinter `lampion()`
  (`js/models.js:244-248`).
- Modulintern, hinter den Pool-Helfern (`js/models.js:23-66`):
  `const HAUS_WALL`, `function hausArch(cx, cy, w, h): THREE.Path`,
  `function hausWall(g, pts, t, arch): THREE.Mesh`,
  `function hausRoofHalf(g, s, angle, len): void`.
- Nichts davon wird exportiert ausser über `FURN`/`makeFurniture`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t1_modell.py`:

      ```python
      import socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9002, 9007)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const THREE = await import('three');
        const m = await import('/js/models.js');
        const out = { errors: [] };

        if (!m.CATALOG.some(c => c.id === 'terrassenhaus' && c.cat === 'dach')) {
          out.errors.push('terrassenhaus fehlt im CATALOG oder ist nicht cat:dach');
        }

        const g = m.makeFurniture('terrassenhaus');
        if (!g) { out.errors.push('makeFurniture liefert nichts'); return out; }

        // 1. Abmessungen (Spec: 2.40 x 2.002 x 2.05, Unterkante bei y = 0).
        const bb = new THREE.Box3().setFromObject(g, true);
        out.size = bb.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(3));
        out.min  = bb.min.toArray().map(v => +v.toFixed(3));
        out.max  = bb.max.toArray().map(v => +v.toFixed(3));

        // 2. Meshzahl und Materialien.
        let n = 0; const typen = new Set(), farben = new Set();
        g.traverse(o => { if (!o.isMesh) return; n++;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(mm => { typen.add(mm.type); farben.add(mm.color.getHexString());
            if (mm.map) out.errors.push('Material mit Textur-Map gefunden');
            if (mm.transparent) out.errors.push('transparentes Material gefunden'); }); });
        out.meshes = n; out.typen = [...typen]; out.farben = [...farben].sort();

        // 3. Geteilte MAT-Instanzen unverändert.
        const soll = { leaf: '77aa5c', leafD: '568b49', green2: '8fb96a', dark: '4a4038', woodL: 'd8b078' };
        for (const k in soll) if (m.MAT[k].color.getHexString() !== soll[k])
          out.errors.push('MAT.' + k + ' wurde mutiert');

        // 4. Tuer und Fenster sind echte Durchblicke: ein Strahl durch die
        //    Tueroeffnung trifft zuerst den dunklen Innenblock, kein Ocker.
        const rc = new THREE.Raycaster();
        const treffer = (from, to) => { const d = new THREE.Vector3().subVectors(to, from).normalize();
          rc.set(from, d); const hs = rc.intersectObject(g, true);
          return hs.length ? hs[0].object.material.color.getHexString() : null; };
        out.tuer   = treffer(new THREE.Vector3(0, 0.30,  3), new THREE.Vector3(0, 0.30, -3));
        out.tuerHoch = treffer(new THREE.Vector3(0, 0.55,  3), new THREE.Vector3(0, 0.55, -3));
        out.wandVorn = treffer(new THREE.Vector3(0.6, 0.55, 3), new THREE.Vector3(0.6, 0.55, -3));
        out.fenster  = treffer(new THREE.Vector3(3, 0.50, 0.10), new THREE.Vector3(-3, 0.50, 0.10));
        return out;
      }
      """

      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.0)
          errs = []
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = b.new_page()
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.goto(URL, wait_until="networkidle")
              page.wait_for_timeout(2500)
              res = page.evaluate(CHECK)
              b.close()
          print(res)
          assert res["errors"] == [], res["errors"]

          nah = lambda a, b, tol=0.02: abs(a - b) <= tol
          assert nah(res["size"][0], 2.40), res["size"]
          assert nah(res["size"][2], 2.05), res["size"]
          assert nah(res["min"][1], 0.0),   res["min"]
          assert 1.85 <= res["max"][1] <= 2.10, res["max"]

          assert 35 <= res["meshes"] <= 70, res["meshes"]
          assert res["typen"] == ["MeshLambertMaterial"], res["typen"]
          # Dachgruen, Wandocker, Innenblock, Schwelle, Frosch + Froschaugen
          assert "568b49" in res["farben"] and "8fb96a" in res["farben"] and "77aa5c" in res["farben"], res["farben"]
          assert "4a4038" in res["farben"], res["farben"]

          assert res["tuer"] == "4a4038",     ("Tuer zeigt nicht in den Innenraum:", res["tuer"])
          assert res["tuerHoch"] == "4a4038", ("Tuerbogen zeigt nicht in den Innenraum:", res["tuerHoch"])
          assert res["wandVorn"] not in (None, "4a4038"), ("Wand neben der Tuer ist durchloechert:", res["wandVorn"])
          assert res["fenster"] == "4a4038",  ("Fenster zeigt nicht in den Innenraum:", res["fenster"])
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate(); srv.wait()
      ```

- [ ] **Step 2: Helfer und Materialkonstante einfügen**, hinter den
      Pool-Helfern (`js/models.js:66`), im Wortlaut der Spec, Abschnitt 1:
      `HAUS_WALL`, `hausArch`, `hausWall`, `hausRoofHalf`. Über `HAUS_WALL`
      kommt ein Kommentar, dass es eine **eigene** Instanz ist und kein
      `MAT`-Ton wiederverwendet wird (Regel aus #34).

- [ ] **Step 3: `FURN.terrassenhaus()` einfügen**, hinter `lampion()`
      (`js/models.js:248`), im Wortlaut der Spec, Abschnitt 1. Der Kommentar am
      Kopf hält fest, dass der Frosch `poolFrogHead()`/`POOL_FROG`
      wiederverwendet (`js/models.js:27, 54-57`) — wer diese Helfer umbaut,
      verändert auch das Häuschen.

- [ ] **Step 4: Katalogzeile ergänzen.** In `CATALOG` (`js/models.js:265`),
      hinter `lampion`:
      `{ id: 'terrassenhaus', name: 'Häuschen', cat: 'dach' },`
      — der kurze Name, weil die Katalogkachel rund 90 px breit ist
      (`index.html:60-63`).

- [ ] **Step 5: `t1_modell.py` im Vordergrund laufen lassen**, bis er grün ist.
      Jede rote Zusicherung wird in `js/models.js` behoben, nie im Test
      (`CLAUDE.md:48-62`). Weichen die Masse ab, werden **die Konstanten des
      Modells** nachgezogen, nicht die Toleranzen — die Platzierungsrechnung in
      Task 3 hängt an `hx = 1.20` und `hz = 1.025`.

---

### Task 2: Katalog, Thumbnail und erste Platzierung

**Files:**
- `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t2_katalog.py` (Wegwerf-Test)
- `js/models.js` / `js/game.js` nur, falls der Test etwas aufdeckt

**Interfaces:** keine neuen. Dieser Task weist nach, dass die **eine**
Katalogzeile aus Task 1 genügt und kein Sonderweg nötig ist.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t2_katalog.py` — gleicher
      Server-/Browser-Rahmen wie `t1_modell.py`, Kern:

      ```python
      OUT = Path(__file__).parent / "screens"; OUT.mkdir(exist_ok=True)

      page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(2500)
      page.click("#btn-start", timeout=20000); page.wait_for_timeout(600)

      # 1. Dachterrasse einrichten: der Tab «Dach» hat jetzt fuenf Eintraege.
      page.evaluate("() => window.wipfelkratzer.enterEdit('roof')")
      page.wait_for_timeout(1800)
      namen = page.eval_on_selector_all("#catalog-items .item span", "els => els.map(e => e.textContent)")
      assert namen == ["Pool", "Liegestuhl", "Sonnenschirm", "Lampions", "Häuschen"], namen

      # 2. Das Thumbnail ist gerendert und nicht leer.
      src = page.eval_on_selector("#catalog-items .item:last-child img", "e => e.src")
      assert src.startswith("data:image/png;base64,"), src[:40]
      assert len(src) > 3000, len(src)

      # 3. Antippen stellt das Häuschen auf die Terrasse.
      page.click("#catalog-items .item:last-child", timeout=25000)
      page.wait_for_timeout(1500)
      eintraege = page.evaluate("() => window.wipfelkratzer.state.rooms.roof")
      assert len(eintraege) == 1 and eintraege[0]["id"] == "terrassenhaus", eintraege

      # 4. Erstplatzierung: cellPos('roof', 0) = (-2.458, -0.975), von clampEntry
      #    auf x = -2.00 gezogen. Hintere linke Ecke, nicht im Treppendurchgang.
      nah = lambda a, b, tol=0.02: abs(a - b) <= tol
      assert nah(eintraege[0]["x"], -2.00),  eintraege[0]
      assert nah(eintraege[0]["z"], -0.975), eintraege[0]

      # 5. Es steht auf dem Belag (ROOF_DECK_T = 0.18), schwebt nicht.
      höhe = page.evaluate("""() => {
        const THREE = window.wipfelkratzer.THREE;
        let y = null;
        window.wipfelkratzer.roofG.traverse(o => {
          const p = o.userData && o.userData.pick;
          if (p && p.entry.id === 'terrassenhaus') y = p.mesh.position.y; });
        return y; }""")
      assert nah(höhe, 0.18), höhe
      page.screenshot(path=str(OUT / "01-häuschen-platziert.png"))
      ```

      `window.wipfelkratzer.THREE` gibt es heute nicht; falls der
      Höhen-Auszug sie braucht, wird stattdessen direkt `p.mesh.position.y`
      gelesen (wie oben) — **kein** neuer Hook nur für den Test.

- [ ] **Step 2: Test laufen lassen und jede Abweichung im Produktivcode
      beheben.** Erwartet ist, dass nichts zu beheben ist: Thumbnail
      (`js/game.js:544`), Tab-Filter (`js/game.js:534`) und `addItem`
      (`js/game.js:680-712`) sind alle generisch über `CATALOG`. Schlägt einer
      der Punkte fehl, ist das ein echter Fund und gehört in `js/game.js`
      korrigiert — nicht durch eine Sonderbehandlung für `terrassenhaus`.

- [ ] **Step 3: `01-häuschen-platziert.png` ansehen.** Das Häuschen muss als
      Häuschen lesbar sein: grünes, gestreiftes Satteldach mit überstehenden
      Traufen, ockerfarbene Wände, dunkle Türöffnung mit Frosch. Wenn das Dach
      wie ein glatter Keil aussieht statt wie Schilf, werden Bündelzahl,
      Zylinderradius oder die Grüntöne in `hausRoofHalf` (`js/models.js`)
      nachgezogen — der Test bleibt unverändert.

---

### Task 3: Treppenregel, Verschieben, Drehen, Spielstand

**Files:**
- `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t3_platzierung.py` (Wegwerf-Test)

**Interfaces:** keine neuen. `clampEntry` (`js/game.js:427-446`) bleibt
unverändert; geprüft wird, dass das Häuschen sich ihr korrekt unterordnet.

Die Sollwerte stammen aus der Rechnung der Spec, Abschnitt «Passt es
überhaupt», mit `hx = 1.20`, `hz = 1.025`:

| Eingabe (x, z) | erwartet nach `clampEntry` | Grund |
| --- | --- | --- |
| (9, 9) | (2.00, 0.075) | x auf `limX - hx`; Treppenregel drückt z auf `(ROOF_PAD_Z0 - 0.3) - hz` |
| (−9, −9) | (−2.00, −1.275) | beide Achsen auf die Randgrenze, Treppenregel greift nicht |
| (0, 9) | (0, 1.275) | mittig: `en.x + hx = 1.2 < ROOF_GAP_X0`, also volle Tiefe |
| (1.3, 1.2) | (1.3, 0.075) | knapp im rechten Streifen, Treppenregel greift |
| (1.1, 1.2) | (1.1, 1.2) | knapp daneben, unverändert |

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t3_platzierung.py` —
      gleicher Rahmen wie Task 1, Kern:

      ```python
      import json

      FAELLE = [
          ((  9.0,  9.0), ( 2.000,  0.075)),
          (( -9.0, -9.0), (-2.000, -1.275)),
          ((  0.0,  9.0), ( 0.000,  1.275)),
          ((  1.3,  1.2), ( 1.300,  0.075)),
          ((  1.1,  1.2), ( 1.100,  1.200)),
      ]
      nah = lambda a, b, tol=0.02: abs(a - b) <= tol

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          for (ex, ez), (sx, sz) in FAELLE:
              stand = {"floors": 10, "nuts": 20,
                       "rooms": {"roof": [{"id": "terrassenhaus", "x": ex, "z": ez, "rot": 0, "cell": 0}]}}
              page = b.new_page(); page.on("pageerror", lambda e: errs.append(str(e)))
              page.add_init_script(
                  "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(stand)))
              page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(2800)
              e = page.evaluate("() => window.wipfelkratzer.state.rooms.roof[0]")
              assert nah(e["x"], sx) and nah(e["z"], sz), ((ex, ez), (e["x"], e["z"]), (sx, sz))
              page.close()

          # Der Treppenaufgang bleibt frei: die Bounding-Box des Häuschens
          # überlappt das Ankunftspodest (x > 2.4, z > 1.1) in keinem Fall.
          stand = {"floors": 10, "nuts": 20,
                   "rooms": {"roof": [{"id": "terrassenhaus", "x": 9, "z": 9, "rot": 0, "cell": 0}]}}
          page = b.new_page(); page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(stand)))
          page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(2800)
          box = page.evaluate("""() => {
            let m = null;
            window.wipfelkratzer.roofG.traverse(o => {
              const p = o.userData && o.userData.pick;
              if (p && p.entry.id === 'terrassenhaus') m = p.mesh; });
            if (!m) return null;
            const e = m.userData.pick.entry;
            m.updateMatrixWorld(true);
            const lokal = { x0: e.x - 1.20, x1: e.x + 1.20, z0: e.z - 1.025, z1: e.z + 1.025 };
            return lokal; }""")
          assert box is not None
          assert not (box["x1"] > 2.4 and box["z1"] > 1.1), box
          page.screenshot(path=str(OUT / "02-rechter-rand.png"))

          # Drehen um 90 Grad: das Häuschen bleibt vollstaendig auf der Terrasse.
          page.evaluate("() => window.wipfelkratzer.enterEdit('roof')")
          page.wait_for_timeout(1800)
          page.evaluate("""() => { const w = window.wipfelkratzer;
            let m = null; w.roofG.traverse(o => { const p = o.userData && o.userData.pick;
              if (p && p.entry.id === 'terrassenhaus') m = p.mesh; });
            m.dispatchEvent; w.selectForTest = m; }""")
          page.click("#btn-rot", timeout=25000)   # setzt Auswahl voraus: vorher antippen
          page.wait_for_timeout(1200)

          # Loeschen raeumt Szene und Spielstand.
          page.click("#btn-del", timeout=25000)
          page.wait_for_timeout(1200)
          assert page.evaluate("() => window.wipfelkratzer.state.rooms.roof.length") == 0
          uebrig = page.evaluate("""() => { let n = 0;
            window.wipfelkratzer.roofG.traverse(o => { const p = o.userData && o.userData.pick;
              if (p && p.entry.id === 'terrassenhaus') n++; }); return n; }""")
          assert uebrig == 0, uebrig
          b.close()
      ```

- [ ] **Step 2: Den Auswahl-Weg im Test sauber machen.** `#btn-rot` und
      `#btn-del` wirken nur auf ein **ausgewähltes** Möbel
      (`js/game.js:1076-1084`, `removeItem`). Auswahl entsteht über einen Tipp
      in die 3D-Szene. Da ein 3D-Tap unter SwiftShader unzuverlässig ist, wird
      stattdessen das Häuschen im selben Durchlauf frisch **über die
      Katalogkachel** gesetzt — `addItem` ruft am Ende `select(...)`
      (`js/game.js:707`), das Objekt ist danach ausgewählt und `#btn-rot` /
      `#btn-del` sind bedienbar. Der Platzhalter `w.selectForTest` aus Step 1
      entfällt damit ersatzlos.

- [ ] **Step 3: Prüfen, dass Pool und Häuschen nebeneinander passen.** Im
      selben Skript: Spielstand mit `pool` bei `x = 1.6, z = -0.6` und
      `terrassenhaus` bei `x = -1.4, z = 0.4` laden und nachweisen, dass
      `clampEntry` beide Positionen unverändert lässt und die beiden
      Bounding-Boxen sich in x/z nicht überlappen. Screenshot
      `03-pool-und-haus.png`.

- [ ] **Step 4: Neuladen prüfen.** Häuschen platzieren, `x`/`z`/`rot`
      auslesen, `page.reload()`, 2.8 s warten, dieselben drei Werte erneut
      auslesen und auf Gleichheit prüfen.

- [ ] **Step 5: `t3_platzierung.py` im Vordergrund laufen lassen**, bis er grün
      ist. Weicht ein Sollwert der Tabelle ab, wird **zuerst** nachgerechnet, ob
      sich `hx`/`hz` des Modells geändert haben — die Tabelle ist aus
      `js/game.js:436-446` abgeleitet und darf nur mit einer neuen Rechnung
      angepasst werden, nie durch Abschreiben des Istwerts.

---

### Task 4: Abnahme, Screenshots und Changelog

**Files:**
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t4_abnahme.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Abnahme-Skript schreiben.**
      `.superpowers/sdd/2026-09-14-terrassenhaeuschen/t4_abnahme.py` — prüft
      genau die Kriterien, die T1–T3 nicht abdecken:

      ```python
      # 1. TENANTS und die Wunschliste sind unverändert: es gibt genau einen
      #    Dachwunsch, und der ist weiterhin der Pool.
      dachwuensche = page.evaluate("""() => {
        const t = window.wipfelkratzer.TENANTS || null; return t; }""")
      # TENANTS steht nicht im Hook — stattdessen über die Oberflaeche prüfen:
      stand = {"floors": 10, "nuts": 0, "rooms": {str(i): [{"id": "bett", "cell": 0},
                                                           {"id": "tisch", "cell": 1},
                                                           {"id": "stuhl", "cell": 2}] for i in range(11)}}
      # -> alle Stockwerke bewohnt, alle Wuensche sichtbar
      texte = page.eval_on_selector_all("#wishes .wish", "els => els.map(e => e.textContent)")
      dach = [t for t in texte if "Dach" in t]
      assert len(dach) == 1 and "Pool" in dach[0], dach

      # 2. Zehn Häuschen sind möglich und erzeugen keine Fehler (Meshbudget).
      page.evaluate("() => window.wipfelkratzer.enterEdit('roof')")
      page.wait_for_timeout(1800)
      for _ in range(10):
          page.click("#catalog-items .item:last-child", timeout=25000)
          page.wait_for_timeout(700)
      assert page.evaluate("() => window.wipfelkratzer.state.rooms.roof.length") == 10
      assert errs == [], errs

      # 3. Alle Materialien der Szene bleiben Lambert/Basic/Points.
      typen = page.evaluate("""() => { const s = new Set();
        window.wipfelkratzer.scene.traverse(o => { if (!o.material) return;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m.type)); });
        return [...s]; }""")
      assert set(typen) <= {"MeshLambertMaterial", "MeshBasicMaterial", "PointsMaterial"}, typen

      # 4. Die Kamera ist unverändert gebunden — nichts hat enablePan oder
      #    minDistance angefasst (das Häuschen ist nicht begehbar).
      kam = page.evaluate("""() => ({ pan: window.wipfelkratzer.controls.enablePan,
                                      min: window.wipfelkratzer.controls.minDistance })""")
      assert kam["pan"] is False and kam["min"] == 4, kam
      ```

      `MeshBasicMaterial` und `PointsMaterial` sind erlaubt, weil Mond
      (`js/game.js:82`), Sterne (`js/game.js:80`) und die unsichtbaren
      Trefferboxen (`js/game.js:319`) sie schon heute benutzen. Falls
      `controls` nicht im Debug-Hook steht, wird es dort ergänzt — er führt
      `camera` und `controls` bereits (`js/game.js:1188`).

- [ ] **Step 2: Abnahme-Screenshots aufnehmen und ansehen.** Vier Bilder aus
      demselben Skript: `04-nah-tuer.png` (Kamera dicht vor der Türseite —
      Rundbogen, dunkler Innenraum, Frosch), `05-nah-dach.png` (Blick von
      schräg oben auf das Schilfdach — Halmbündel und ausgefranste Traufe
      erkennbar), `06-giebel-fenster.png` (rechte Giebelwand mit Fensterbogen),
      `07-terrasse-komplett.png` (Häuschen, Pool, Liegestuhl, Sonnenschirm und
      Lampions zusammen auf der Terrasse). Die Kamera wird dafür über
      `window.wipfelkratzer.camera` und `controls.target` gesetzt, nicht über
      Maussimulation.

- [ ] **Step 3: `t4_abnahme.py` im Vordergrund laufen lassen**, bis er grün
      ist. Jede rote Zusicherung wird im Produktivcode behoben, nicht im Test.

- [ ] **Step 4: `CHANGELOG.md` ergänzen.** Über `## [0.5.0] - 2026-09-13`
      (`CHANGELOG.md:6`) eine neue Sektion einziehen — `version.js` bleibt
      dabei unverändert bei `0.5.0`, und es gibt **keinen**
      `chore(release)`-Commit:

      ```markdown
      ## [Unreleased]

      ### Added

      - Auf der Dachterrasse lässt sich jetzt ein kleines Häuschen mit grünem
        Schilfdach aufstellen, wie auf der Buchseite mit dem Pool. Die Wände
        sind ockerfarbener Putz, das Satteldach besteht aus grünen
        Schilfbündeln mit weit überstehenden, ausgefransten Traufen, und
        vorne führt eine rundbogige Türöffnung in einen dunklen Innenraum, aus
        dem ein Frosch lugt. Das Häuschen ist gross — es lässt sich über die
        ganze Terrasse schieben, weicht dem Treppenaufgang aber automatisch
        aus, und Pool und Häuschen haben nebeneinander Platz (#49)
      ```

      Gibt es die Sektion `## [Unreleased]` bereits (etwa weil #50 zuerst
      gelandet ist), wird der Eintrag dort unter `### Added` **angehängt**, statt
      eine zweite Sektion anzulegen.

- [ ] **Step 5: Restliche Kriterien von Hand im Browser prüfen** (Playwright
      deckt sie nicht sinnvoll ab): das Häuschen liest im Bilderbuch-Ton und
      nicht wie ein Fremdkörper neben Pool und Liegestuhl; die Katalogkachel
      «Häuschen» bricht im Tablet-Hochformat nicht um; das Verschieben mit dem
      Richtungs-Kreuz fühlt sich am rechten Terrassenrand nachvollziehbar an
      (die Treppenregel zieht, sie blockiert nicht); das Dach verdeckt die
      Fahne (`js/game.js:316-317`) höchstens aus ungünstigen Winkeln.

- [ ] **Step 6: Alle vier Skripte nacheinander grün laufen lassen**
      (`t1_modell.py`, `t2_katalog.py`, `t3_platzierung.py`, `t4_abnahme.py`),
      jeweils im Vordergrund. Danach den Server über seinen Port beenden:
      `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.

- [ ] **Step 7: Commit.**
      `feat(dach): Abnahme des Terrassenhäuschens und Changelog`
