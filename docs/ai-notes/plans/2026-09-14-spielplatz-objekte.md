# Plan — Spielplatz-Objekte platzieren, verschieben, drehen (Issue #38)

**Goal:** Die Teile des Spielplatzes (Schaukel, Rutsche, Sandkasten, Hochbeet,
Blumen) lassen sich draussen einzeln auswählen, verschieben, drehen, löschen und
neu hinzufügen — mit derselben Leiste und denselben Tasten wie die Möbel
drinnen. Position und Drehung landen im Spielstand und überleben das Neuladen.
Kein Objekt kann im Bach, im Baum oder unter dem Turm landen. Alte Spielstände,
die nur `garden: true/false` kennen, laden weiter und sehen danach praktisch aus
wie vorher.

**Architecture:** Der Spielplatz wird **kein Sonderfall**, sondern ein vierter
«Raum» mit dem Schlüssel `'garten'` — genau so, wie die Dachterrasse heute schon
mit `'roof'` in derselben Mechanik hängt (`js/game.js:301`, `js/game.js:1178`).
Dadurch tragen `placeItemMesh()` (`js/game.js:447-470`), `select()`
(`js/game.js:672-678`), `#selbar` (`index.html:187-196`), die Tastaturbedienung
(`js/game.js:1069-1090`), `removeItem()` (`js/game.js:715-721`), `save()`
(`js/game.js:36-41`) und die Rehydrierung (`js/game.js:1177-1184`) die
Spielplatz-Objekte ohne neuen Code; dazukommen nur `'garten'`-Zweige in
`parentOf`/`baseY`/`dims`/`clampEntry`/`enterEdit`.

`makeGarden()` (`js/models.js:461-486`) wird in fünf `FURN`-Einträge zerlegt
(Geometrie unverändert übernommen) und über `CATALOG`/`CATS` mit der neuen
Kategorie `garten` registriert — damit greifen `makeFurniture()`
(`js/models.js:309`), `makeThumbs()` (`js/game.js:529-551`), `renderCatalog()`
(`js/game.js:552-601`) und `addItem()` (`js/game.js:679-714`) unverändert.

Die Gartengruppe `gartenG` bleibt bei `(-8, 0, 2)`, wird aber **entdreht**
(`rotation.y = 0` statt 0.5; die Drehung wandert in die Startpositionen der
Objekte). Damit ist die Spielfläche ein achsenparalleles Rechteck
`GARDEN_W × GARDEN_D = 5.4 × 5.0`, direkt vergleichbar mit `riverZ(x)`
(`js/game.js:86`), der baumfreien Lichtung `hypot(x + 8, z - 2) < 5.5`
(`js/game.js:106`) und der Turmplattform (`js/game.js:130`) — und
`cellPos()` (`js/game.js:360-363`), das symmetrisch um den Gruppenursprung
rechnet, funktioniert draussen genauso wie drinnen.

Der Spielstand behält `state.garden` als Boolean («gebaut?») und bekommt
additiv `state.rooms.garten` mit dem bestehenden Eintragsformat. Die Migration
läuft über das vorhandene `migrated`-Flag der Tapeten-Migration
(`js/game.js:379-390`, `js/game.js:1186`).

**Spec:** `docs/ai-notes/specs/2026-09-14-spielplatz-objekte-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute (`ä ö ü`) — auch in Kommentaren und Commit-Nachrichten.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module.
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  warme entsättigte Töne. Die fünf Spielplatz-Objekte übernehmen die Geometrie
  aus `makeGarden()` **unverändert** — kein Redesign, keine neuen Farbwerte.
- **Keine neuen Material-Instanzen pro Objekt.** Die heute inline erzeugten
  `L(0x…)`-Materialien aus `makeGarden()` werden auf Modulebene gehoben, damit
  ein zweites Hochbeet kein zweites Material anlegt. `MAT`-Instanzen werden nie
  mutiert — sie sind turmweit geteilt (`js/models.js:4-12`).
- **Rückwärtskompatibler Spielstand.** Der `localStorage`-Schlüssel
  `wipfelkratzer-v1` muss weiter laden. Ein Stand ohne `rooms.garten` ist
  gültig und bedeutet «noch nicht migriert».
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: jede Trefferfläche
  mindestens 44 × 44 px, wie die bestehenden Knöpfe (`index.html:73`). Keine
  neuen Bedienelemente, wenn die vorhandenen reichen.
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, nie `run_in_background`** (`CLAUDE.md:550-563`).
  Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:564-566`).
- **Keine Versionsanhebung.** `version.js` bleibt unverändert, kein
  `chore(release)`-Commit. Der Changelog-Eintrag geht unter `## [Unreleased]`.
- Conventional Commits, Präfix `feat(umgebung)` bzw. `test(umgebung)`,
  `docs(changelog)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-spielplatz-objekte/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8981–8985** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
  Nur der Server darf in den Hintergrund, die Playwright-Läufe **nie**. Danach
  gezielt über den Port beenden:
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
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`). Er wird in Task 2 um
  `gartenG`, `riverZ`, `GARDEN`, `placeItemMesh` und `clampEntry` erweitert.
- Spielstände **vor** dem Laden über `page.add_init_script` in
  `localStorage['wipfelkratzer-v1']` setzen — schneller als der Aufbau über die
  Oberfläche und für die Alt-Stand-Prüfungen ohnehin nötig
  (`js/game.js:35`).
- Nach `page.goto(..., wait_until="networkidle")` zusätzlich
  `page.wait_for_timeout(2500)` — Thumbnails und Szenenaufbau brauchen unter
  SwiftShader spürbar Zeit.

---

### Task 1: Fünf Spielplatz-Objekte statt eines Ensembles

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-spielplatz-objekte/t1_models.py` (Wegwerf-Test)

**Interfaces:**
- `FURN.schaukel()`, `FURN.rutsche()`, `FURN.sandkasten()`, `FURN.hochbeet()`,
  `FURN.blumen()` — je eine `THREE.Group`, Ursprung am Boden in der Mitte des
  Objekts.
- `CATALOG` bekommt fünf Einträge mit `cat: 'garten'`.
- `CATS` bekommt `['garten', 'Spielplatz']` als letzten Eintrag.
- `export const GARDEN_ITEMS = new Set(['schaukel', 'rutsche', 'sandkasten', 'hochbeet', 'blumen'])`
- `export function makeGarden()` **entfällt**.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-spielplatz-objekte/t1_models.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const out = { errors: [], sizes: {}, cats: m.CATS.map(c => c[0]) };
        if (m.makeGarden) out.errors.push('makeGarden existiert noch');
        if (!m.GARDEN_ITEMS) { out.errors.push('GARDEN_ITEMS fehlt'); return out; }
        out.items = [...m.GARDEN_ITEMS].sort();

        const THREE = await import('three');
        for (const id of m.GARDEN_ITEMS) {
          let g;
          try { g = m.makeFurniture(id); } catch (e) { out.errors.push('makeFurniture wirft: ' + id + ' ' + e.message); continue; }
          if (g.userData.itemId !== id) out.errors.push('itemId fehlt: ' + id);
          const bb = new THREE.Box3().setFromObject(g);
          const s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
          out.sizes[id] = { w: +s.x.toFixed(2), h: +s.y.toFixed(2), d: +s.z.toFixed(2),
                            cx: +c.x.toFixed(2), cz: +c.z.toFixed(2), y0: +bb.min.y.toFixed(2) };
          if (Math.abs(c.x) > 0.35 || Math.abs(c.z) > 0.35) out.errors.push('Ursprung nicht mittig: ' + id);
          if (bb.min.y < -0.05) out.errors.push('ragt unter den Boden: ' + id);

          // Zweiter Aufruf darf keine neuen Materialien anlegen.
          const matsOf = o => { const s2 = new Set(); o.traverse(x => { if (x.material) s2.add(x.material.uuid); }); return s2; };
          const a = matsOf(g), b = matsOf(m.makeFurniture(id));
          if ([...b].some(u => !a.has(u))) out.errors.push('neues Material beim zweiten Aufruf: ' + id);
        }

        // Katalogeinträge
        const cat = m.CATALOG.filter(it => it.cat === 'garten');
        out.catalog = cat.map(it => it.id);
        out.catalogNames = cat.map(it => it.name);
        for (const it of cat) if (!m.GARDEN_ITEMS.has(it.id)) out.errors.push('Katalogeintrag ohne Modell: ' + it.id);
        for (const id of m.GARDEN_ITEMS) if (!cat.some(it => it.id === id)) out.errors.push('Modell ohne Katalogeintrag: ' + id);

        // Die Spielplatz-Objekte sind weder Wand- noch Deko-Objekte.
        for (const id of m.GARDEN_ITEMS) if (m.WALL_ITEMS.has(id)) out.errors.push('fälschlich WALL_ITEM: ' + id);
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
      assert res["items"] == ["blumen", "hochbeet", "rutsche", "sandkasten", "schaukel"], res["items"]
      assert sorted(res["catalog"]) == res["items"], res["catalog"]
      assert res["catalogNames"] == ["Schaukel", "Rutsche", "Sandkasten", "Hochbeet", "Blumen"], res["catalogNames"]
      assert "garten" in res["cats"], res["cats"]
      # Grobmaße aus makeGarden(): Schaukel ~1.5 breit, Sandkasten ~1.5, Hochbeet ~2.0 breit.
      assert 1.3 <= res["sizes"]["schaukel"]["w"] <= 1.7, res["sizes"]["schaukel"]
      assert 1.3 <= res["sizes"]["sandkasten"]["w"] <= 1.7, res["sizes"]["sandkasten"]
      assert 1.8 <= res["sizes"]["hochbeet"]["w"] <= 2.2, res["sizes"]["hochbeet"]
      assert res["sizes"]["blumen"]["w"] <= 1.0, res["sizes"]["blumen"]
      assert errs == [], errs
      print("T1 OK")
      ```

      Server dazu starten und laufen lassen:
      `python3 -m http.server 8981 >/dev/null 2>&1 &` (nur der Server darf in
      den Hintergrund — die Playwright-Läufe **nie**).

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t1_models.py`
      muss mit `AssertionError: ['makeGarden existiert noch', 'GARDEN_ITEMS
      fehlt']` abbrechen. Rot gesehen zu haben ist die Voraussetzung für
      Step 3.

- [ ] **Step 3: Gartenmaterialien auf Modulebene heben.** In `js/models.js`
      direkt nach `MAT` (`js/models.js:12`) einfügen:

      ```js
      /* Farben, die bisher inline in makeGarden() erzeugt wurden. Jetzt einmal pro
         Modul statt einmal pro Objekt — sonst legt jedes zusätzliche Hochbeet ein
         weiteres Material an. */
      export const GMAT = {
        slide: L(0x7fb98a), sand: L(0xead9a8), soil: L(0x8a5f3c),
        fl: [L(0xe6604d), L(0xe6a0b8), L(0xf0c04d), L(0xffffff), L(0xb27fd4)],
      };
      ```

- [ ] **Step 4: Die fünf Modelle in `FURN` anlegen.** Geometrie wörtlich aus
      `makeGarden()` (`js/models.js:461-486`) übernommen, nur ohne die
      Gruppenverschiebung — der Ursprung jedes Objekts liegt jetzt in seiner
      eigenen Mitte am Boden. Ans Ende von `FURN` (vor der schliessenden
      Klammer) einfügen:

      ```js
      schaukel() { const g = G();
        [-0.6, 0.6].forEach(x => { const l = cyl(g, 0.05, 0.06, 1.6, MAT.wood, x, 0.75, 0); l.rotation.z = x > 0 ? -0.15 : 0.15; });
        box(g, 1.5, 0.07, 0.07, MAT.woodD, 0, 1.5, 0);
        [-0.15, 0.15].forEach(x => cyl(g, 0.012, 0.012, 1.05, MAT.woodL, x, 0.95, 0));
        box(g, 0.44, 0.05, 0.2, MAT.woodL, 0, 0.42, 0);
        return g; },
      rutsche() { const g = G();
        const ramp = box(g, 0.5, 0.07, 2, GMAT.slide, 0, 0.55, 0); ramp.rotation.x = 0.55;
        [-0.22, 0.22].forEach(x => { box(g, 0.05, 0.12, 2, MAT.leafD, x, 0.6, 0).rotation.x = 0.55; });
        [-0.18, 0.18].forEach(x => cyl(g, 0.03, 0.03, 1.1, MAT.wood, x, 0.55, -1));
        for (let i = 0; i < 3; i++) box(g, 0.34, 0.04, 0.04, MAT.woodL, 0, 0.25 + i * 0.3, -1);
        return g; },
      sandkasten() { const g = G();
        [-0.65, 0.65].forEach(z => box(g, 1.5, 0.14, 0.12, MAT.wood, 0, 0.07, z));
        [-0.7, 0.7].forEach(x => box(g, 0.12, 0.14, 1.4, MAT.wood, x, 0.07, 0));
        box(g, 1.3, 0.1, 1.2, GMAT.sand, 0, 0.06, 0);
        sph(g, 0.09, MAT.red, 0.3, 0.14, 0.2); cyl(g, 0.05, 0.07, 0.1, MAT.blue, -0.25, 0.15, -0.1);
        return g; },
      hochbeet() { const g = G();
        [-0.5, 0.5].forEach(z => { box(g, 2, 0.1, 0.7, GMAT.soil, 0, 0.05, z);
          for (let i = 0; i < 5; i++) sph(g, 0.09, MAT.leafD, -0.8 + i * 0.4, 0.14, z, 1, 0.8, 1); });
        return g; },
      /* Ein Büschel aus drei Blumen — die alte Reihe aus acht Einzelblumen war
         5.6 breit und damit breiter als die halbe Spielfläche. */
      blumen() { const g = G();
        [[-0.3, -0.1, 0], [0, 0.15, 2], [0.3, -0.05, 4]].forEach(([x, z, ci]) => {
          cyl(g, 0.012, 0.012, 0.3, MAT.leafD, x, 0.15, z);
          sph(g, 0.07, GMAT.fl[ci], x, 0.32, z, 1, 0.6, 1);
          sph(g, 0.03, MAT.gold, x, 0.36, z); });
        return g; },
      ```

- [ ] **Step 5: `makeGarden()` entfernen** (`js/models.js:461-486`) — der
      einzige Aufrufer (`js/game.js:127`) verschwindet in Task 2. Der
      Import in `js/game.js:3` wird ebenfalls dort bereinigt; bis dahin bleibt
      der Test von Step 1 die einzige Prüfung, `index.html` lädt in diesem
      Zwischenzustand mit einem Importfehler. **Step 5 und Task 2, Step 3
      gehören deshalb in denselben Arbeitsgang** — erst danach wird wieder
      geladen.

- [ ] **Step 6: Katalog und Kategorie registrieren.** In `js/models.js` ans
      Ende von `CATALOG` (`js/models.js:251-270`):

      ```js
      { id: 'schaukel', name: 'Schaukel', cat: 'garten' }, { id: 'rutsche', name: 'Rutsche', cat: 'garten' },
      { id: 'sandkasten', name: 'Sandkasten', cat: 'garten' }, { id: 'hochbeet', name: 'Hochbeet', cat: 'garten' },
      { id: 'blumen', name: 'Blumen', cat: 'garten' },
      ```

      und `CATS` (`js/models.js:271`) um `['garten', 'Spielplatz']` ergänzen,
      dazu neben `WALL_ITEMS` (`js/models.js:272`):

      ```js
      /* Alles, was draussen auf dem Spielplatz steht — nie drinnen, nie auf dem Dach. */
      export const GARDEN_ITEMS = new Set(['schaukel', 'rutsche', 'sandkasten', 'hochbeet', 'blumen']);
      ```

- [ ] **Step 7: Test läuft grün.** Nach Task 2, Step 3 (Import in `js/game.js`
      bereinigt) `python3
      .superpowers/sdd/2026-09-14-spielplatz-objekte/t1_models.py` ausführen:
      `T1 OK`, `errors` leer, null `pageerror`.

- [ ] **Step 8: Commit.**
      `feat(umgebung): Spielplatz als fünf einzelne Katalog-Objekte`

---

### Task 2: Spielfläche, Gartengruppe und Begrenzung im Freien

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-spielplatz-objekte/t2_flaeche.py` (Wegwerf-Test)

**Interfaces:**
- `const GARDEN_POS = new THREE.Vector3(-8, 0, 2)`, `const GARDEN_W = 5.4`,
  `const GARDEN_D = 5.0`
- `const gartenG: THREE.Group` — bei `GARDEN_POS`, `rotation.y = 0`,
  `visible = state.garden`, `userData.type = 'garten'`; ersetzt `const garden`
  (`js/game.js:127`).
- `dims('garten') → { w: GARDEN_W - 0.7, d: GARDEN_D - 0.9 }`,
  `parentOf('garten') → gartenG`, `baseY('garten') → 0`.
- `clampEntry('garten', m, en)` klemmt gegen das Rechteck `±GARDEN_W/2`,
  `±GARDEN_D/2` abzüglich der halben Objekt-Box3.
- `gardenEdge: THREE.Group` — vier flache Leisten, `visible = false`.
- `window.wipfelkratzer` zusätzlich: `gartenG`, `gardenEdge`, `riverZ`,
  `GARDEN: { pos, w, d }`, `placeItemMesh`, `clampEntry`, `itemMeshes`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-spielplatz-objekte/t2_flaeche.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {"floors": 3, "rooms": {}, "nuts": 5, "bridge": False, "garden": True,
              "night": False, "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {}}

      CHECK = """
      async () => {
        const THREE = await import('three');
        const w = window.wipfelkratzer;
        const out = { errors: [], probes: [] };
        if (!w.GARDEN) { out.errors.push('GARDEN fehlt'); return out; }
        out.garden = { x: w.GARDEN.pos.x, y: w.GARDEN.pos.y, z: w.GARDEN.pos.z, w: w.GARDEN.w, d: w.GARDEN.d,
                       rot: w.gartenG.rotation.y, visible: w.gartenG.visible };

        // Extremwerte: jedes Objekt weit ausserhalb ansetzen und klemmen lassen.
        const far = [[-99, -99], [99, -99], [-99, 99], [99, 99], [0, 99], [0, -99], [99, 0], [-99, 0]];
        for (const id of ['schaukel', 'rutsche', 'sandkasten', 'hochbeet', 'blumen']) {
          for (const [x, z] of far) {
            for (const rot of [0, 0.5, Math.PI / 2, 2.4]) {
              const en = { id, cell: 0, x, z, y: 0, rot };
              const m = w.placeItemMesh('garten', en);
              w.clampEntry('garten', m, en);
              m.updateWorldMatrix(true, true);
              const bb = new THREE.Box3().setFromObject(m);
              out.probes.push({ id, rot, x: +en.x.toFixed(2), z: +en.z.toFixed(2),
                minx: +bb.min.x.toFixed(2), maxx: +bb.max.x.toFixed(2),
                minz: +bb.min.z.toFixed(2), maxz: +bb.max.z.toFixed(2) });
              w.removeItem(m.userData.pick);
            }
          }
        }
        out.riverAt = {};
        for (let x = -11; x <= -5; x += 0.25) out.riverAt[x.toFixed(2)] = +w.riverZ(x).toFixed(3);
        out.edgeVisible = w.gardenEdge.visible;
        return out;
      }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.wait_for_timeout(2500)
          res = page.evaluate(CHECK)
          b.close()

      assert res.get("errors") == [], res["errors"]
      g = res["garden"]
      print(json.dumps(g, indent=2))
      assert (g["x"], g["y"], g["z"]) == (-8, 0, 2), g
      assert g["rot"] == 0, "gartenG muss entdreht sein, sonst ist das Rechteck schief"
      assert g["visible"] is True, g
      assert res["edgeVisible"] is False, "Flächenmarkierung darf ausserhalb des Einrichtens nicht zu sehen sein"

      X0, X1 = g["x"] - g["w"] / 2, g["x"] + g["w"] / 2
      Z0, Z1 = g["z"] - g["d"] / 2, g["z"] + g["d"] / 2
      river = {float(k): v for k, v in res["riverAt"].items()}

      def river_at(x):
          return min(v for k, v in river.items() if abs(k - x) <= 0.3)

      for p_ in res["probes"]:
          assert p_["minx"] >= X0 - 0.01 and p_["maxx"] <= X1 + 0.01, p_
          assert p_["minz"] >= Z0 - 0.01 and p_["maxz"] <= Z1 + 0.01, p_
          # Bach: Wasserhalbbreite 1.8 (ribbon(3.6), js/game.js:100)
          assert p_["maxz"] < river_at(p_["maxx"]) - 1.8, ("im Wasser", p_)
          # Lichtung: Bäume werden ab Radius 5.5 um (-8, 2) gesetzt (js/game.js:106)
          for cx in (p_["minx"], p_["maxx"]):
              for cz in (p_["minz"], p_["maxz"]):
                  assert ((cx + 8) ** 2 + (cz - 2) ** 2) ** 0.5 < 5.5, ("im Baum", p_)
          # Turm: Plattform reicht bis x = -4.9 (js/game.js:130)
          assert p_["maxx"] < -5.0, ("unter dem Turm", p_)

      print("Sonden:", len(res["probes"]), "Fläche x", round(X0, 2), round(X1, 2), "z", round(Z0, 2), round(Z1, 2))
      assert errs == [], errs
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot** — `AssertionError: ['GARDEN fehlt']`, weil
      der Debug-Hook den Garten noch nicht kennt.

- [ ] **Step 3: Gartengruppe entdrehen und Import bereinigen.** In
      `js/game.js:3` `makeGarden` aus dem Import streichen und stattdessen
      `GARDEN_ITEMS` importieren. `js/game.js:127` ersetzen durch:

      ```js
      /* Spielplatz. Die Gruppe steht bewusst unrotiert: die Spielfläche ist dadurch
         achsenparallel und direkt mit riverZ(), der baumfreien Lichtung (Radius 5.5
         um (-8, 2), siehe Baumschleifen oben) und dem Turmsockel vergleichbar. Die
         alte Gruppendrehung von 0.5 steckt jetzt in den Startwerten der Objekte
         (GARDEN_DEFAULT). */
      const GARDEN_POS = new THREE.Vector3(-8, 0, 2);
      const GARDEN_W = 5.4, GARDEN_D = 5.0;
      const gartenG = new THREE.Group();
      gartenG.position.copy(GARDEN_POS); gartenG.visible = state.garden;
      gartenG.userData.type = 'garten'; scene.add(gartenG);
      /* Unsichtbarer Antipp-Körper über der ganzen Fläche — dasselbe Muster wie die
         Etagen- und Dach-Hitboxen. */
      { const gh = new THREE.Mesh(new THREE.BoxGeometry(GARDEN_W, 1.6, GARDEN_D),
          new THREE.MeshBasicMaterial({ visible: false }));
        gh.position.y = 0.8; gh.userData = { type: 'garten' }; gartenG.add(gh); hitboxes.push(gh); }
      /* Holzkante, die beim Einrichten zeigt, wie weit der Spielplatz reicht. */
      const gardenEdge = new THREE.Group(); gardenEdge.visible = false; gartenG.add(gardenEdge);
      [[GARDEN_W, 0.06, 0, GARDEN_D / 2], [GARDEN_W, 0.06, 0, -GARDEN_D / 2],
       [0.06, GARDEN_D, GARDEN_W / 2, 0], [0.06, GARDEN_D, -GARDEN_W / 2, 0]]
        .forEach(([bw, bd, px, pz]) => {
          const e = mesh(new THREE.BoxGeometry(bw, 0.06, bd), MAT.woodL, px, 0.03, pz, gardenEdge);
          e.castShadow = false; });
      ```

      **Achtung Reihenfolge:** `hitboxes` wird erst bei `js/game.js:243`
      angelegt. Der Spielplatz-Block muss deshalb **hinter** diese Zeile
      wandern (direkt vor `/* Dachterrasse */`, `js/game.js:307`), und an
      `js/game.js:127` bleibt nichts stehen. `mesh()` (`js/game.js:85`) und
      `state` sind dort längst definiert.

- [ ] **Step 4: `'garten'`-Zweige in den Raum-Helfern.** In `js/game.js`:

      ```js
      const dims = k => k === 'roof' ? { w: ROOF_W - 0.7, d: ROOF_D - 0.9 }
        : k === 'garten' ? { w: GARDEN_W - 0.7, d: GARDEN_D - 0.9 }
        : { w: W(k) - 0.7, d: D(k) - 1.0 };
      function parentOf(k) { return k === 'roof' ? roofG : k === 'garten' ? gartenG : floorGroups[k]; }
      function baseY(k) { return k === 'roof' ? ROOF_DECK_T : k === 'garten' ? 0 : 0.155; }
      ```

      (`js/game.js:357-362`). `colsOf`/`cellPos` (`js/game.js:359-363`)
      brauchen nichts — sie rechnen allein aus `dims(k)`: `5.4 - 0.7 = 4.7`
      ergibt 4 Spalten × 2 Reihen = 8 Zellen.

- [ ] **Step 5: `clampEntry` um den Aussenfall erweitern**
      (`js/game.js:427-446`), direkt nach dem `WALL_ITEMS`-Block:

      ```js
      if (k === 'garten') {
        /* Draussen gibt es keine Wände. Begrenzt wird die Lichtung selbst: das
           Rechteck ist so gewählt, dass seine Ecken ausserhalb des Wassers
           (riverZ minus 1.8 Wasserhalbbreite), innerhalb der baumfreien Lichtung
           (Radius 5.5 um (-8, 2)) und neben dem Turmsockel (Plattformkante -4.9)
           liegen. Der Kiesstreifen am Ufer darf bespielt werden, das Wasser nicht. */
        const bbG = new THREE.Box3().setFromObject(m);
        const hxg = Math.min((bbG.max.x - bbG.min.x) / 2, GARDEN_W / 2);
        const hzg = Math.min((bbG.max.z - bbG.min.z) / 2, GARDEN_D / 2);
        en.x = Math.max(-(GARDEN_W / 2 - hxg), Math.min(GARDEN_W / 2 - hxg, en.x));
        en.z = Math.max(-(GARDEN_D / 2 - hzg), Math.min(GARDEN_D / 2 - hzg, en.z));
        en.y = 0;
        m.position.set(en.x, 0, en.z);
        return;
      }
      ```

      `Box3.setFromObject` liefert Weltkoordinaten; weil `gartenG` unrotiert
      ist und nur verschoben wird, sind Weltbreite und Gruppenbreite identisch
      — dieselbe Voraussetzung, unter der der bestehende Rechteck-Zweig für
      die Dachterrasse rechnet.

- [ ] **Step 6: Debug-Hook erweitern** (`js/game.js:1188`):

      ```js
      window.wipfelkratzer = { state, floorGroups, roofG, roofStairG, roofGapG, gartenG, gardenEdge, scene, camera, controls, WALL_KEYS,
        GARDEN: { pos: GARDEN_POS, w: GARDEN_W, d: GARDEN_D }, riverZ, itemMeshes, placeItemMesh, clampEntry, removeItem,
        get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; } };
      ```

- [ ] **Step 7: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t2_flaeche.py`
      gibt `T2 OK` aus; alle 160 Sonden (5 Objekte × 8 Extremlagen × 4
      Drehungen) liegen im Rechteck, ausserhalb des Wassers, in der Lichtung
      und neben dem Turm. Danach `t1_models.py` erneut laufen lassen — jetzt
      muss auch der grün sein, weil der Import bereinigt ist.

- [ ] **Step 8: Commit.**
      `feat(umgebung): Spielfläche für den Spielplatz mit Begrenzung gegen Bach, Bäume und Turm`

---

### Task 3: Spielstand — `state.rooms.garten` und Migration des Booleans

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-spielplatz-objekte/t3_stand.py` (Wegwerf-Test)

**Interfaces:**
- `const GARDEN_DEFAULT: Array<{ id, cell, x, z, y, rot }>` — die sieben
  Startobjekte in Gruppenkoordinaten.
- `function migrateGarden(): void` — legt `state.rooms.garten` an, wenn es
  fehlt, und setzt `migrated = true`.
- `state.rooms.garten` — Einträge im bestehenden Format
  (`js/game.js:683`).

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-spielplatz-objekte/t3_stand.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      ALT_MIT_GARTEN = {
          "floors": 4, "nuts": 7, "bridge": True, "garden": True, "night": False,
          "cutaway": False, "fulfilled": {"0": True}, "wallpaper": {"1": "punkte"}, "flooring": {"2": "dielen"},
          "rooms": {"0": [{"id": "sofa", "cell": 0, "x": -1.5, "z": -0.8, "y": 2.2, "rot": 0}]},
      }
      ALT_OHNE_GARTEN = dict(ALT_MIT_GARTEN, garden=False)
      LEERGERAEUMT = dict(ALT_MIT_GARTEN, rooms={"0": ALT_MIT_GARTEN["rooms"]["0"], "garten": []})

      READ = """
      async () => {
        const THREE = await import('three');
        const w = window.wipfelkratzer;
        const saved = JSON.parse(localStorage.getItem('wipfelkratzer-v1'));
        const meshes = (w.itemMeshes.garten || []).map(m => {
          m.updateWorldMatrix(true, true);
          const bb = new THREE.Box3().setFromObject(m);
          return { id: m.userData.pick.entry.id,
                   minz: +bb.min.z.toFixed(2), maxz: +bb.max.z.toFixed(2), maxx: +bb.max.x.toFixed(2) };
        });
        return { state: w.state, saved, meshes, gartenVisible: w.gartenG.visible, riverAt: [-10, -9, -8, -7, -6].map(x => +w.riverZ(x).toFixed(2)) };
      }
      """

      def run(save):
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = b.new_page()
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(save)))
              page.goto(URL, wait_until="networkidle")
              page.wait_for_timeout(2500)
              res = page.evaluate(READ)
              b.close()
          assert errs == [], errs
          return res

      # 1. Alter Stand mit gebautem Spielplatz -> wird einmalig in Objekte übersetzt.
      r = run(ALT_MIT_GARTEN)
      print(json.dumps(r["state"]["rooms"]["garten"], indent=2, ensure_ascii=False))
      g = r["state"]["rooms"]["garten"]
      assert len(g) == 7, g
      assert sorted(e["id"] for e in g) == ["blumen", "blumen", "blumen", "hochbeet", "rutsche", "sandkasten", "schaukel"], g
      assert r["state"]["garden"] is True
      # unveränderte Felder
      assert r["state"]["floors"] == 4 and r["state"]["nuts"] == 7 and r["state"]["bridge"] is True
      assert r["state"]["wallpaper"]["1"] == "punkte" and r["state"]["flooring"]["2"] == "dielen"
      assert [e["id"] for e in r["state"]["rooms"]["0"]] == ["sofa"]
      # einmalig zurückgeschrieben
      assert len(r["saved"]["rooms"]["garten"]) == 7, r["saved"]["rooms"].keys()
      assert r["gartenVisible"] is True
      assert len(r["meshes"]) == 7, r["meshes"]
      # keins der sieben steht im Wasser oder unter dem Turm
      river = dict(zip([-10, -9, -8, -7, -6], r["riverAt"]))
      for m in r["meshes"]:
          near = min(river.items(), key=lambda kv: abs(kv[0] - m["maxx"]))[1]
          assert m["maxz"] < near - 1.8, ("im Wasser", m)
          assert m["maxx"] < -5.0, ("unter dem Turm", m)

      # 2. Alter Stand ohne Spielplatz -> leere Liste, nichts zu sehen.
      r2 = run(ALT_OHNE_GARTEN)
      assert r2["state"]["rooms"]["garten"] == [], r2["state"]["rooms"]["garten"]
      assert r2["state"]["garden"] is False
      assert r2["gartenVisible"] is False
      assert r2["meshes"] == [], r2["meshes"]

      # 3. Leergeräumter Spielplatz bleibt leer.
      r3 = run(LEERGERAEUMT)
      assert r3["state"]["rooms"]["garten"] == [], r3["state"]["rooms"]["garten"]
      assert r3["meshes"] == [], r3["meshes"]
      assert r3["state"]["garden"] is True

      print("T3 OK")
      ```

- [ ] **Step 2: Test läuft rot** — Fall 1 bricht mit
      `KeyError: 'garten'` bzw. `assert len(g) == 7` ab, weil es die Liste
      noch nicht gibt.

- [ ] **Step 3: Startanordnung hinterlegen.** In `js/game.js` direkt nach dem
      Spielplatz-Block aus Task 2:

      ```js
      /* Die sieben Objekte des bisherigen Ensembles, umgerechnet auf die unrotierte
         Gruppe: alte Gruppenkoordinate mit R_y(0.5) gedreht, Drehung um 0.5 erhöht.
         Die Blumen rücken dabei ein Stück vom Bach weg — in der alten Reihe stand
         die äusserste Blume bei (-9.55, 5.01) und damit im Wasser. */
      const GARDEN_DEFAULT = [
        { id: 'schaukel',   cell: 0, x: -1.70, z:  1.50, y: 0, rot: 0.50 },
        { id: 'rutsche',    cell: 1, x:  0.30, z:  0.15, y: 0, rot: 0.00 },
        { id: 'sandkasten', cell: 2, x:  1.90, z: -0.50, y: 0, rot: 0.50 },
        { id: 'hochbeet',   cell: 3, x:  1.35, z:  1.60, y: 0, rot: 0.65 },
        { id: 'blumen',     cell: 4, x: -0.75, z:  2.00, y: 0, rot: 0.50 },
        { id: 'blumen',     cell: 5, x:  1.05, z:  1.05, y: 0, rot: 0.20 },
        { id: 'blumen',     cell: 6, x:  2.25, z:  0.35, y: 0, rot: 0.80 },
      ];
      /* Alte Spielstände kennen nur den Boolean state.garden. Steht der Spielplatz,
         wird das Ensemble einmalig in einzelne Objekte übersetzt — danach ist
         state.rooms.garten die Wahrheit, auch wenn es leer ist: alles weggeräumt zu
         haben ist ein gültiger Zustand und darf nicht neu bestückt werden. Deshalb
         Array.isArray und nicht der Wahrheitswert (Vorbild: Tapeten-Migration). */
      function migrateGarden() {
        if (Array.isArray(state.rooms.garten)) return;
        state.rooms.garten = state.garden ? GARDEN_DEFAULT.map(e => ({ ...e })) : [];
        migrated = true;
      }
      ```

      `migrated` wird bei `js/game.js:379` deklariert — der Block muss
      **danach** stehen; unmittelbar vor dem Ladeblock (`js/game.js:1177`) ist
      der richtige Ort.

- [ ] **Step 4: Ladeblock erweitern** (`js/game.js:1177-1184`):

      ```js
      migrateGarden();
      Object.keys(state.rooms).forEach(k => {
        const key = (k === 'roof' || k === 'garten') ? k : parseInt(k, 10);
        roomOf(key).forEach(e => {
          const m = placeItemMesh(key, e);
          if (key === 'roof' || key === 'garten') clampEntry(key, m, e);
        });
      });
      ```

      Ohne den `'garten'`-Zweig würde `parseInt('garten', 10)` `NaN` liefern.
      Das `clampEntry` beim Laden zieht Objekte zurecht, die aus einem älteren
      Stand ausserhalb der Fläche kämen — dieselbe Rolle, die es seit #20 für
      das Dach spielt.

- [ ] **Step 5: `itemMeshes.garten` anlegen.** Neben `itemMeshes.roof = []`
      (`js/game.js:301`):

      ```js
      itemMeshes.garten = [];
      ```

- [ ] **Step 6: Spielplatz bauen füllt die Liste** (`js/game.js:825-830`):

      ```js
      $('btn-garden').onclick = () => { $('extras-menu').classList.remove('open');
        if (state.garden) { enterEdit('garten'); return; }
        state.garden = true;
        state.rooms.garten = GARDEN_DEFAULT.map(e => ({ ...e }));
        roomOf('garten').forEach(e => { const m = placeItemMesh('garten', e); clampEntry('garten', m, e); });
        gartenG.visible = true; gartenG.scale.setScalar(0.01);
        tween(0.6, q => gartenG.scale.setScalar(0.01 + 0.99 * q));
        sfx.pop(); toast('Spielplatz, Beete und Blumen — fertig! Tippe drauf, wenn du umstellen willst.'); save(); };
      ```

      Die Objekte entstehen **vor** der Animation, damit `gartenG.scale` sie
      mitzieht.

- [ ] **Step 7: `checkTenant` gegen den neuen Schlüssel absichern**
      (`js/game.js:764`):

      ```js
      function checkTenant(k) { if (typeof k === 'number' && tenantIn(k) && !tenantGroups[k]) spawnTenant(k); }
      ```

      Heute ist `'garten' <= state.floors` zwar `false`, aber unabsichtlich;
      die Typprüfung macht die Absicht sichtbar und deckt auch `'roof'` ab.

- [ ] **Step 8: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t3_stand.py`
      gibt `T3 OK` aus, alle drei Spielstand-Fälle bestehen, null `pageerror`.
      Danach `t2_flaeche.py` erneut laufen lassen.

- [ ] **Step 9: Commit.**
      `feat(umgebung): Spielplatz-Objekte im Spielstand, Migration des alten Booleans`

---

### Task 4: Einrichten draussen — Modus, Katalog, Auswahl

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-spielplatz-objekte/t4_einrichten.py` (Wegwerf-Test)

**Interfaces:**
- `enterEdit('garten')` / `exitEdit()` mit Titel «Spielplatz einrichten».
- `editCamFor('garten') → { eye, tgt }` — Blick von Süden auf die Fläche.
- `renderCatalog()` zeigt draussen ausschliesslich die Kategorie `garten`,
  drinnen und auf dem Dach nie.
- `pickWall()` liefert draussen `null`; `$('btn-tip')` hat einen
  `'garten'`-Zweig.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-spielplatz-objekte/t4_einrichten.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {"floors": 3, "nuts": 9, "bridge": False, "garden": True, "night": False,
              "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
              "rooms": {"0": [{"id": "sofa", "cell": 0, "x": -1.5, "z": -0.8, "y": 2.2, "rot": 0}]}}

      SNAP = """
      () => {
        const w = window.wipfelkratzer;
        const g = w.state.rooms.garten;
        return { entries: g.map(e => ({ id: e.id, x: +e.x.toFixed(3), z: +e.z.toFixed(3), rot: +e.rot.toFixed(3) })),
                 saved: JSON.parse(localStorage.getItem('wipfelkratzer-v1')).rooms.garten
                          .map(e => ({ id: e.id, x: +e.x.toFixed(3), z: +e.z.toFixed(3), rot: +e.rot.toFixed(3) })),
                 edit: w.edit ? w.edit.k : null, edgeVisible: w.gardenEdge.visible,
                 title: document.getElementById('edit-title').textContent,
                 tabs: [...document.querySelectorAll('#catalog-tabs button')].map(b => b.textContent),
                 items: [...document.querySelectorAll('#catalog-items .item span')].map(s => s.textContent),
                 selbar: document.getElementById('selbar').classList.contains('on'),
                 moveHidden: document.getElementById('btn-move').classList.contains('hidden'),
                 rotHidden: document.getElementById('btn-rot').classList.contains('hidden'),
                 padHidden: document.getElementById('wallpad').classList.contains('hidden') };
      }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.wait_for_timeout(2500)
          page.click("#btn-start", timeout=20000)

          # Über das Extras-Menü in den Spielplatz-Modus (der Knopf meldet nicht mehr nur "ist schon da").
          page.click("#btn-extras", timeout=20000)
          page.click("#btn-garden", timeout=20000)
          page.wait_for_timeout(1500)
          a = page.evaluate(SNAP)
          assert a["edit"] == "garten", a["edit"]
          assert a["title"] == "Spielplatz einrichten", a["title"]
          assert a["tabs"] == ["Spielplatz"], a["tabs"]
          assert a["items"] == ["Schaukel", "Rutsche", "Sandkasten", "Hochbeet", "Blumen"], a["items"]
          assert a["edgeVisible"] is True, "Flächenmarkierung fehlt im Einrichten-Modus"
          assert len(a["entries"]) == 7, a["entries"]

          # Erstes Objekt auswählen (über den Debug-Hook, stabiler als ein 3D-Tap),
          # dann mit den echten Knöpfen drehen und verschieben.
          page.evaluate("() => { const w = window.wipfelkratzer; w.select(w.itemMeshes.garten[0].userData.pick); }")
          s = page.evaluate(SNAP)
          assert s["selbar"] and not s["moveHidden"] and not s["rotHidden"] and s["padHidden"], s

          before = a["entries"][0]
          page.click("#btn-rot", timeout=20000)
          page.wait_for_timeout(600)
          after_rot = page.evaluate(SNAP)["entries"][0]
          assert abs(after_rot["rot"] - (before["rot"] + 1.5708)) < 0.01, (before, after_rot)

          page.click("#btn-move", timeout=20000)
          page.wait_for_timeout(600)
          after_move = page.evaluate(SNAP)["entries"][0]
          assert (after_move["x"], after_move["z"]) != (before["x"], before["z"]), (before, after_move)

          # Pfeiltaste schiebt fein
          page.keyboard.press("ArrowLeft")
          page.wait_for_timeout(400)
          after_key = page.evaluate(SNAP)["entries"][0]
          assert abs(after_key["x"] - (after_move["x"] - 0.12)) < 0.001, (after_move, after_key)

          # Neues Objekt aus dem Katalog
          page.click("#catalog-items .item:nth-child(5)", timeout=20000)
          page.wait_for_timeout(800)
          added = page.evaluate(SNAP)
          assert len(added["entries"]) == 8, added["entries"]
          assert added["entries"][-1]["id"] == "blumen", added["entries"][-1]

          # Weg damit
          page.click("#btn-del", timeout=20000)
          page.wait_for_timeout(600)
          deleted = page.evaluate(SNAP)
          assert len(deleted["entries"]) == 7, deleted["entries"]

          # Fertig -> Markierung weg, Modus zu
          page.click("#btn-done", timeout=20000)
          page.wait_for_timeout(1500)
          done = page.evaluate(SNAP)
          assert done["edit"] is None and done["edgeVisible"] is False, done

          # Drinnen ist der Spielplatz-Tab nicht zu sehen, und Einrichten geht unverändert.
          page.evaluate("() => window.wipfelkratzer.enterEdit(0)")
          page.wait_for_timeout(1200)
          inside = page.evaluate(SNAP)
          assert "Spielplatz" not in inside["tabs"], inside["tabs"]
          assert "Tapete" in inside["tabs"] and "Möbel" in inside["tabs"], inside["tabs"]
          page.evaluate("() => window.wipfelkratzer.exitEdit()")
          page.wait_for_timeout(800)

          # Neu laden: Position und Drehung stehen noch.
          page.reload(wait_until="networkidle")
          page.wait_for_timeout(2500)
          reloaded = page.evaluate(SNAP)
          b.close()

      assert reloaded["entries"] == deleted["entries"], (deleted["entries"], reloaded["entries"])
      assert reloaded["saved"] == deleted["entries"], reloaded["saved"]
      assert errs == [], errs
      print("T4 OK")
      ```

      Der Test braucht `select` im Debug-Hook — siehe Step 6.

- [ ] **Step 2: Test läuft rot** — der Klick auf `#btn-garden` öffnet keinen
      Einrichten-Modus, `a["edit"]` ist `None`.

- [ ] **Step 3: Kamerafahrt für draussen.** In `editCamFor(k)`
      (`js/game.js:626-635`) vor dem `'roof'`-Zweig:

      ```js
      if (k === 'garten') {
        /* Blick von Süden über die Fläche, Abstand aus dem tatsächlichen Blickfeld —
           dieselbe Rechnung wie drinnen (fitDistance), damit im Hochformat nichts
           aus dem Bild fällt. */
        const dist = GARDEN_D / 2 + fitDistance(GARDEN_W / 2 + 0.6, 1.8) + 1.0;
        return { eye: new THREE.Vector3(GARDEN_POS.x, 4.2, GARDEN_POS.z + dist),
                 tgt: new THREE.Vector3(GARDEN_POS.x, 0.6, GARDEN_POS.z) };
      }
      ```

- [ ] **Step 4: `enterEdit`/`exitEdit` um den Aussenfall erweitern.** In
      `enterEdit(k)` (`js/game.js:636-656`) den Kopf so verzweigen:

      ```js
      if (k === 'garten') {
        moveCam(eye, tgt);
        gardenEdge.visible = true;
        $('edit-title').textContent = 'Spielplatz einrichten';
      } else if (k === 'roof') {
        /* … unverändert … */
      ```

      In `exitEdit()` (`js/game.js:657-670`) am Anfang:

      ```js
      gardenEdge.visible = false;
      if (edit.k !== 'roof' && edit.k !== 'garten') { for (let j = 1; j <= MAXF; j++) floorGroups[j].visible = j <= state.floors; }
      ```

      Draussen bleiben Etagen, Dach und Zwischendecken unangetastet — es wird
      nichts ausgeblendet, also muss auch nichts wiederhergestellt werden.

- [ ] **Step 5: Katalog, Wandtipp und Tipp-Knopf.**

      `renderCatalog()` (`js/game.js:552-556`):

      ```js
      const roof = edit && edit.k === 'roof';
      const garten = edit && edit.k === 'garten';
      const avail = CATS.filter(([id]) => garten ? id === 'garten' : roof ? id === 'dach' : (id !== 'dach' && id !== 'garten'));
      ```

      `pickWall()` (`js/game.js:986-991`) — sonst greift der Code auf
      `floorGroups['garten'].userData` zu:

      ```js
      if (!edit || edit.k === 'roof' || edit.k === 'garten') return null;
      ```

      `$('btn-tip')` (`js/game.js:977-983`) — sonst läuft der Aussenfall in
      `TENANTS['garten']`:

      ```js
      if (k === 'garten') { toast('Tippe ein Spielplatz-Objekt an, dann kannst du es verschieben, drehen oder wegräumen.'); return; }
      ```

      (jeweils vor dem `'roof'`-Zweig einfügen).

- [ ] **Step 6: Antippen im 3D und Debug-Hook.** Im `pointerup`-Handler
      (`js/game.js:1013-1022`) den Spielplatz zulassen — die Hitbox steckt
      schon in `hitboxes` (Task 2, Step 3):

      ```js
      if (u.type === 'garten') { if (state.garden) { enterEdit('garten'); return; } continue; }
      ```

      (direkt vor dem `'roof'`-Zweig). Zusätzlich `select` in den Debug-Hook
      aufnehmen (`js/game.js:1188`), damit die Verifikation ein Objekt ohne
      3D-Tap auswählen kann:

      ```js
      …, placeItemMesh, clampEntry, removeItem, select, …
      ```

- [ ] **Step 7: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t4_einrichten.py`
      gibt `T4 OK` aus, null `pageerror`.

- [ ] **Step 8: Commit.**
      `feat(umgebung): Einrichten-Modus für den Spielplatz mit Auswahl, Drehen und Verschieben`

---

### Task 5: Changelog und Gesamtdurchlauf

**Files:**
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-spielplatz-objekte/t5_regression.py` (Wegwerf-Test)

**Interfaces:** keine — reine Dokumentation und Abnahme.

- [ ] **Step 1: Regressionstest schreiben.**
      `.superpowers/sdd/2026-09-14-spielplatz-objekte/t5_regression.py` prüft,
      dass die Änderung drinnen nichts kaputt gemacht hat:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {"floors": 2, "nuts": 3, "bridge": False, "garden": True, "night": False,
              "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {}, "rooms": {}}

      SNAP = """
      () => { const w = window.wipfelkratzer;
        return { edit: w.edit ? w.edit.k : null,
                 room0: (w.state.rooms['0'] || []).map(e => ({ id: e.id, x: +e.x.toFixed(2), rot: +e.rot.toFixed(2) })),
                 roof: (w.state.rooms.roof || []).length,
                 wallpaper: w.state.wallpaper, floors: w.state.floors,
                 tabs: [...document.querySelectorAll('#catalog-tabs button')].map(b => b.textContent),
                 items: [...document.querySelectorAll('#catalog-items .item span')].map(s => s.textContent).length }; }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE)))
          page.goto(URL, wait_until="networkidle")
          page.wait_for_timeout(2500)
          page.click("#btn-start", timeout=20000)

          # Drinnen: Möbel setzen, drehen, Tapete wählen
          page.evaluate("() => window.wipfelkratzer.enterEdit(0)")
          page.wait_for_timeout(1200)
          inside = page.evaluate(SNAP)
          assert inside["edit"] == 0 and "Spielplatz" not in inside["tabs"], inside
          page.click("#catalog-items .item:nth-child(1)", timeout=20000)
          page.wait_for_timeout(900)
          page.click("#btn-rot", timeout=20000)
          page.wait_for_timeout(600)
          placed = page.evaluate(SNAP)
          assert len(placed["room0"]) == 1 and placed["room0"][0]["rot"] > 0, placed["room0"]

          # Tapete: Tab "Tapete" -> erste Tapete
          tabs = page.locator("#catalog-tabs button")
          for i in range(tabs.count()):
              if tabs.nth(i).inner_text() == "Tapete":
                  tabs.nth(i).click(timeout=20000); break
          page.wait_for_timeout(600)
          page.click("#catalog-items .item.look:nth-of-type(2)", timeout=20000)
          page.wait_for_timeout(600)
          papered = page.evaluate(SNAP)
          assert papered["wallpaper"].get("0"), papered["wallpaper"]

          page.evaluate("() => window.wipfelkratzer.exitEdit()")
          page.wait_for_timeout(900)

          # Dachterrasse: Modus lässt sich öffnen und zeigt nur den Dach-Tab
          page.evaluate("() => window.wipfelkratzer.enterEdit('roof')")
          page.wait_for_timeout(1200)
          roof = page.evaluate(SNAP)
          assert roof["edit"] == "roof" and roof["tabs"] == ["Dach"], roof["tabs"]
          page.evaluate("() => window.wipfelkratzer.exitEdit()")
          page.wait_for_timeout(900)

          # Ein Stockwerk bauen
          page.click("#btn-build", timeout=20000)
          page.wait_for_timeout(2200)
          built = page.evaluate(SNAP)
          assert built["floors"] == 3, built["floors"]
          b.close()

      assert errs == [], errs
      print("T5 OK")
      ```

- [ ] **Step 2: Alle vier Skripte hintereinander im Vordergrund laufen
      lassen** (Server auf demselben Port, danach über den Port beenden):

      ```
      python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t1_models.py
      python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t2_flaeche.py
      python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t3_stand.py
      python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t4_einrichten.py
      python3 .superpowers/sdd/2026-09-14-spielplatz-objekte/t5_regression.py
      ```

      Alle fünf müssen `… OK` melden, keiner darf `pageerror` sammeln.

- [ ] **Step 3: Changelog ergänzen.** In `CHANGELOG.md` **über** dem Abschnitt
      `## [0.5.0] - 2026-09-13` einen neuen Abschnitt einfügen — im Stil der
      bestehenden Einträge, deutscher Fliesstext, Issue-Nummer in Klammern:

      ```markdown
      ## [Unreleased]

      ### Added

      - Der Spielplatz war ein festes Ensemble: Schaukel, Rutsche, Sandkasten,
        Hochbeet und Blumen hingen an einer Gruppe und liessen sich weder
        auswählen noch bewegen. Jedes Teil ist jetzt ein eigenes Objekt, das
        sich — genau wie die Möbel drinnen — antippen, verschieben, drehen,
        wegräumen und aus dem Katalog neu hinzufügen lässt. Draussen gibt es
        dafür keine Wände, sondern eine Spielfläche auf der baumfreien
        Lichtung; sie hält die Objekte vom Bach, von den Bäumen und vom
        Turmsockel fern und wird beim Einrichten als Holzkante sichtbar. Ein
        Tipp auf den Spielplatz öffnet den Einrichten-Modus, der Knopf «Garten
        & Spielplatz» ebenso. Alte Spielstände, die nur wussten, *ob* der
        Spielplatz gebaut ist, werden beim ersten Laden in einzelne Objekte
        übersetzt — dabei rücken die Blumen aus dem Wasser ans Ufer (#38)
      ```

      **`version.js` bleibt unverändert**, und es gibt keinen
      `chore(release)`-Commit: die Version wird beim Release separat gehoben.

- [ ] **Step 4: Abnahme gegen die Spec.** Die Liste
      `## Acceptance Criteria` in
      `docs/ai-notes/specs/2026-09-14-spielplatz-objekte-design.md` Punkt für
      Punkt durchgehen und abhaken; die Punkte, die kein Skript abdeckt
      (Aussehen der Szene ausserhalb des Einrichtens, Aufbau-Animation beim
      erstmaligen Bauen), einmal im Browser ansehen:
      `python3 -m http.server 8981` und `http://127.0.0.1:8981/` öffnen.

- [ ] **Step 5: Server beenden.**
      `ss -lptn 'sport = :8981' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
      kein `pkill -f`.

- [ ] **Step 6: Commit.**
      `docs(changelog): Spielplatz-Objekte unter Unreleased`
