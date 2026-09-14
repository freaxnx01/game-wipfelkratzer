# Plan — Else Elster befüllt den Pool mit dem Eimer (Issue #45)

**Goal:** Ein neu platzierter Pool auf der Dachterrasse startet leer. Else
Elster verlässt daraufhin ihre Kreisbahn, holt am Bach dreimal einen Eimer
Wasser, kippt ihn sichtbar in den Pool und kehrt danach auf die Kreisbahn
zurück. Der Füllstand liegt im Spielstand; alte Spielstände zeigen ihren Pool
weiterhin voll.

**Architecture:** Der Pool behält seine Geometrie aus #12
(`js/models.js:214-226`) und bekommt einen Regler `g.userData.setFill(f)`, der
die Wasserplatte in ihrer Extrusionsachse skaliert (`poolSlab` dreht um
`-PI/2` um x, `js/models.js:43` — lokal `+z` ist global `+y`), die
Wellen-/Frosch-Gruppe mit dem Wasserspiegel hebt und die Frösche erst bei
vollem Becken zeigt. Der Default bleibt `setFill(1)`, damit jeder bestehende
Aufrufer — insbesondere die Katalog-Thumbnails (`js/game.js:541`) — ein
unverändertes Bild bekommt. Der Spielstand-Eintrag des Pools bekommt ein
optionales ganzzahliges Feld `fill` (0..3); fehlt es, gilt der Pool als voll.
Else bekommt in `tick()` (`js/game.js:1204-1207`) einen Zustandsautomaten:
die heutige Kreisformel bleibt wörtlich als Ruhephase erhalten, daneben treten
vier Botengang-Phasen, die `THREE.CatmullRomCurve3`-Wege mit derselben
`k*k*(3-2*k)`-Glättung abfahren wie die bestehenden Tweens
(`js/game.js:1172-1174`). `makeMagpie()` (`js/models.js:395`) gibt seine
Eimergruppe heraus und bekommt eine Wasserscheibe aus `MAT.water`.

**Spec:** `docs/ai-notes/specs/2026-09-14-elster-pool-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute, niemals `ae/oe/ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module (`CLAUDE.md:508-516`).
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  bestehende `MAT`-Töne. **Keine neuen Farbwerte.** Der Eimerinhalt benutzt
  `MAT.water` — dasselbe Material wie die Wasserplatte des Pools
  (`js/models.js:217`).
- **Keine neuen Material-Instanzen**, kein `material.clone()`, niemals
  `MAT.<ton>.color.set()` — die `MAT`-Objekte sind szenenweit geteilt
  (`js/game.js:1226` vergleicht auf Identität).
- **`version.js` wird nicht angefasst**, und es entsteht **kein**
  `chore(release)`-Commit. Der Changelog-Eintrag geht unter
  `## [Unreleased]`.
- **Keine Geometrie des Pools ändern.** Kontur, Kachelung, Rand und Leiter aus
  #12 bleiben Punkt für Punkt, wie sie sind.
- **Rückwärtskompatibilität ist Pflicht:** ein Spielstand ohne `fill` lädt
  unverändert und zeigt den Pool voll.

## Verification setup (gilt für alle Tasks)

- Wegwerf-Prüfskripte liegen unter
  `.superpowers/sdd/2026-09-14-elster-pool/` (bereits git-ignoriert,
  `.gitignore:5`) und werden **nicht** committet.
- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8981–8985** (für diese Issue-Sitzung reserviert, ersten freien
  nehmen). Danach gezielt über den Port beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  niemals `pkill -f` mit einem Muster, das den aufrufenden Befehl treffen
  kann.
- **Playwright-Läufe immer im Vordergrund, nie `run_in_background`**
  (`CLAUDE.md:550-552`). Nur der `http.server` darf in den Hintergrund.
- Chromium starten mit
  `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen.
- `js/models.js` lässt sich direkt aus der Seite heraus testen:
  `await import('/js/models.js')` in `page.evaluate` nutzt die Importmap des
  Dokuments (`index.html:10-17`).
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`).
- `localStorage['wipfelkratzer-v1']` **vor** dem Laden über
  `page.add_init_script` zu setzen ist schneller und für die
  Alt-Spielstand-Prüfungen ohnehin nötig.

---

### Task 1: Füllstandsregler am Pool und Eimer-Innenleben an der Elster

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-elster-pool/t1_models.py` (Wegwerf-Test)

**Interfaces:**
- `FURN.pool()` → `THREE.Group` mit
  `userData.setFill(f: number) => void` (f wird auf 0..1 geklemmt);
  Voreinstellung nach dem Bauen ist `setFill(1)`.
- `makeMagpie()` → `THREE.Group` mit zusätzlich
  `userData.bucket: THREE.Group` und `userData.bucketWater: THREE.Mesh`
  (`visible === false` im Ausgangszustand); `userData.wings` bleibt
  unverändert.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-elster-pool/t1_models.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const out = { errors: [] };

        const pool = m.makeFurniture('pool');
        if (typeof pool.userData.setFill !== 'function') { out.errors.push('setFill fehlt'); return out; }

        // Hilfsfunktion: Welt-Bounding-Box der Wasserplatte + Sichtbarkeiten einsammeln.
        const THREE = (await import('three'));
        const snap = g => {
          g.updateMatrixWorld(true);
          const bb = new THREE.Box3();
          const vis = [];
          g.traverse(o => {
            if (!o.isMesh) return;
            let shown = true; for (let p = o; p; p = p.parent) if (!p.visible) shown = false;
            vis.push(shown);
            if (shown) bb.expandByObject(o);
          });
          return { top: bb.max.y, shown: vis.filter(Boolean).length, total: vis.length };
        };

        // 1. Voll ist der Ausgangszustand und entspricht dem Bild aus #12.
        const full = snap(pool);
        out.fullTop = full.top; out.fullShown = full.shown;

        // 2. Leer: kein sichtbares Wasser, keine Froesche, aber Becken und Leiter bleiben.
        pool.userData.setFill(0);
        const empty = snap(pool);
        out.emptyShown = empty.shown;
        if (empty.shown >= full.shown) out.errors.push('leerer Pool verbirgt nichts');
        if (empty.shown === 0) out.errors.push('leerer Pool ist komplett unsichtbar');

        // 3. Monoton: mehr Fuellstand => mehr sichtbare Teile, nie weniger.
        let prev = -1; out.steps = [];
        for (const f of [0, 1/3, 2/3, 1]) {
          pool.userData.setFill(f);
          const s = snap(pool);
          out.steps.push({ f: Math.round(f * 100) / 100, shown: s.shown });
          if (s.shown < prev) out.errors.push('Sichtbarkeit fällt bei f=' + f);
          prev = s.shown;
        }

        // 4. Klemmen: Werte ausserhalb 0..1 duerfen nicht durchschlagen.
        pool.userData.setFill(1); const a = snap(pool).shown;
        pool.userData.setFill(9); if (snap(pool).shown !== a) out.errors.push('f>1 nicht geklemmt');
        pool.userData.setFill(0); const b = snap(pool).shown;
        pool.userData.setFill(-3); if (snap(pool).shown !== b) out.errors.push('f<0 nicht geklemmt');

        // 5. Keine neuen Materialinstanzen: alles bleibt MeshLambertMaterial.
        pool.userData.setFill(1);
        pool.traverse(o => { if (o.material && o.material.type !== 'MeshLambertMaterial')
          out.errors.push('Nicht-Lambert im Pool: ' + o.material.type); });

        // 6. Elster: Eimer und Eimerwasser sind herausgegeben.
        const mag = m.makeMagpie();
        if (!mag.userData.bucket) out.errors.push('userData.bucket fehlt');
        if (!mag.userData.bucketWater) out.errors.push('userData.bucketWater fehlt');
        if (mag.userData.bucketWater && mag.userData.bucketWater.visible)
          out.errors.push('Eimerwasser startet sichtbar');
        if (!mag.userData.wings || mag.userData.wings.length !== 2)
          out.errors.push('userData.wings kaputt');
        if (mag.userData.bucketWater && mag.userData.bucketWater.material !== m.MAT.water)
          out.errors.push('Eimerwasser benutzt nicht MAT.water');
        if (mag.userData.bucket && mag.userData.bucket.rotation.z !== 0)
          out.errors.push('Eimer startet gekippt');
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
      assert res["emptyShown"] < res["fullShown"], res
      assert [s["shown"] for s in res["steps"]] == sorted(s["shown"] for s in res["steps"]), res["steps"]
      assert errs == [], errs
      print("T1 OK")
      ```

      Server starten und laufen lassen:
      `python3 -m http.server 8981 >/dev/null 2>&1 &` (nur der Server darf in
      den Hintergrund — die Playwright-Läufe **nie**).

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-14-elster-pool/t1_models.py` muss mit
      `AssertionError: ['setFill fehlt']` abbrechen. Rot gesehen zu haben ist
      die Voraussetzung für Step 3.

- [ ] **Step 3: `FURN.pool()` umbauen** (`js/models.js:214-226`). Die
      Geometrie bleibt identisch; die Wasserplatte wird in einer Variablen
      festgehalten, die Frösche wandern in eine eigene Untergruppe, und der
      Regler kommt ans Ende:

      ```js
      pool() { const g = G();
        const outer = poolOutline(), lining = poolInset(outer, 0.07), water = poolInset(outer, 0.11), rim = poolInset(outer, -0.04);
        poolSlab(g, outer, lining, 0.36, MAT.wood, 0); poolSlab(g, lining, water, 0.36, POOL_TILE, 0);
        const wat = poolSlab(g, water, null, 0.29, MAT.water, 0);
        poolSlab(g, rim, water, 0.06, MAT.woodL, 0.36);
        const surf = G(); g.add(surf); surf.position.y = 0.29;
        [[0.05, -0.05, 0.06, 0.15], [0.14, 0.22, 0.055, -0.2], [-0.15, 0.2, 0.05, 0.3], [0.4, -0.22, 0.04, 0.1]].forEach(([x, z, r, a]) => poolRipple(surf, x, z, r, a));
        const frogs = G(); surf.add(frogs);
        poolFrogSwimming(frogs, -0.36, -0.02, 0.9); poolFrogPeeking(frogs, 0.4, 0.12, -0.4);
        const lad = G(); g.add(lad); lad.position.set(Math.max(...rim.map(p => p.x)) - 0.028, 0, 0);
        [-0.09, 0.09].forEach(z => cyl(lad, 0.022, 0.022, 0.75, MAT.grey, 0.05, 0.38, z));
        for (let i = 0; i < 3; i++) box(lad, 0.03, 0.03, 0.18, MAT.grey, 0.05, 0.18 + i * 0.2, 0);
        /* Füllstand 0..1. poolSlab dreht die Platte um -PI/2 um x, ihre
           Extrusionsachse (lokal +z) zeigt damit nach oben — Skalieren in z
           hebt und senkt den Wasserspiegel, ohne die Kontur zu verzerren.
           Ohne Aufruf bleibt der Pool voll wie seit #12. */
        g.userData.setFill = f => {
          f = Math.max(0, Math.min(1, f));
          wat.visible = f > 0.001;
          wat.scale.z = Math.max(f, 0.001);
          surf.position.y = 0.29 * f;
          surf.visible = f > 0.2;
          frogs.visible = f >= 0.999;
        };
        g.userData.setFill(1);
        return g; },
      ```

- [ ] **Step 4: `makeMagpie()` ergänzen** (`js/models.js:395-412`). Nach der
      bestehenden Eimerkonstruktion (`js/models.js:407-409`):

      ```js
      const bucket = G(); g.add(bucket); bucket.position.set(0.1, -0.32, 0);
      cyl(bucket, 0.09, 0.07, 0.12, MAT.red, 0, 0, 0, 14);
      mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), MAT.grey, 0, 0.06, 0, bucket);
      /* Wasser im Eimer — dasselbe Material wie die Wasserplatte des Pools.
         Unsichtbar, bis Else am Bach geschöpft hat. */
      const bucketWater = cyl(bucket, 0.075, 0.06, 0.02, MAT.water, 0, 0.04, 0, 14);
      bucketWater.visible = false;
      cyl(g, 0.008, 0.008, 0.2, MAT.grey, 0.08, -0.18, 0);
      g.userData.wings = wings;
      g.userData.bucket = bucket; g.userData.bucketWater = bucketWater;
      ```

- [ ] **Step 5: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-14-elster-pool/t1_models.py` gibt
      `T1 OK` aus, `errors` ist leer, null `pageerror`. Zusätzlich
      `index.html` einmal im Browser laden und prüfen, dass das
      Katalog-Thumbnail «Pool» (`js/game.js:541`) unverändert einen vollen
      Pool zeigt.

---

### Task 2: Füllstand im Spielstand — laden, normalisieren, anwenden

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-elster-pool/t2_state.py` (Wegwerf-Test)

**Interfaces:**
- `const POOL_TRIPS = 3` (`js/game.js`, bei den übrigen Konstanten
  `js/game.js:6-12`)
- `const poolFill = (en: object) => number` — Bruch 0..1 aus `en.fill`;
  `undefined` ergibt `1`.
- `placeItemMesh(k, entry)` ruft nach dem Bauen
  `m.userData.setFill?.(poolFill(entry))`.
- `addItem('pool')` setzt `entry.fill = 0`.
- `window.wipfelkratzer` bekommt `poolEntries()` → Array der Pool-Einträge aus
  `roomOf('roof')`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-elster-pool/t2_state.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      OLD_SAVE = {
          "floors": 10, "nuts": 5, "bridge": False, "garden": False,
          "night": False, "cutaway": False, "fulfilled": {"10": True},
          "wallpaper": {}, "flooring": {},
          "rooms": {"roof": [{"id": "pool", "cell": 0, "x": 0, "z": 0, "rot": 0, "y": 0.18}]},
      }

      BAD_SAVE = json.loads(json.dumps(OLD_SAVE))
      BAD_SAVE["rooms"]["roof"][0]["fill"] = 99
      BAD_SAVE["rooms"]["roof"].append(
          {"id": "pool", "cell": 1, "x": 1.6, "z": 0, "rot": 0, "y": 0.18, "fill": -4}
      )

      READ = """
      () => {
        const w = window.wipfelkratzer;
        if (!w.poolEntries) return { error: 'poolEntries fehlt' };
        const out = { entries: w.poolEntries().map(e => ({ id: e.id, fill: e.fill })), meshes: [] };
        for (const m of w.scene.children) {}
        const roof = w.roofG;
        roof.traverse(o => {
          if (o.userData && o.userData.pick && o.userData.pick.entry.id === 'pool') {
            let frogs = 0, waterTop = null;
            o.traverse(c => { if (!c.isMesh) return;
              let shown = true; for (let p = c; p && p !== o.parent; p = p.parent) if (!p.visible) shown = false;
              if (shown) frogs++; });
            out.meshes.push({ fill: o.userData.pick.entry.fill, shownMeshes: frogs });
          }
        });
        return out;
      }
      """

      def run(save, label):
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = b.new_page()
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.add_init_script(
                  "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(save))
              )
              page.goto(URL, wait_until="networkidle")
              page.wait_for_timeout(1200)
              res = page.evaluate(READ)
              b.close()
          print(label, json.dumps(res, indent=2, ensure_ascii=False))
          assert errs == [], errs
          return res

      old = run(OLD_SAVE, "ALT:")
      assert old.get("error") is None, old
      assert old["entries"] == [{"id": "pool", "fill": None}], old["entries"]
      full_shown = old["meshes"][0]["shownMeshes"]

      bad = run(BAD_SAVE, "KAPUTT:")
      shown = [m["shownMeshes"] for m in bad["meshes"]]
      assert shown[0] == full_shown, ("fill=99 nicht auf voll geklemmt", shown, full_shown)
      assert shown[1] < full_shown, ("fill=-4 nicht auf leer geklemmt", shown)
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-14-elster-pool/t2_state.py` muss mit
      `{'error': 'poolEntries fehlt'}` abbrechen.

- [ ] **Step 3: Konstante und Leser anlegen.** Direkt bei den übrigen
      Konstanten (`js/game.js:6-12`):

      ```js
      /* Wie viele Eimer füllen den Pool? Der Füllstand liegt als ganze Zahl
         0..POOL_TRIPS am Pool-Eintrag des Spielstands. */
      const POOL_TRIPS = 3;
      /* Ein Pool-Eintrag OHNE fill gilt als voll: alte Spielstände wurden mit
         einem stets vollen Pool geschrieben (#12) und dürfen ihn nicht
         verlieren. */
      const poolFill = en => en.fill === undefined ? 1
        : Math.max(0, Math.min(POOL_TRIPS, en.fill | 0)) / POOL_TRIPS;
      ```

- [ ] **Step 4: Füllstand beim Bauen anwenden.** In `placeItemMesh()`
      (`js/game.js:451-466`), unmittelbar vor `return m;`:

      ```js
      if (m.userData.setFill) m.userData.setFill(poolFill(entry));
      ```

      Der Aufruf ist bewusst an `userData.setFill` gebunden statt an
      `entry.id === 'pool'` — nur der Pool bringt den Regler mit, alle
      anderen Möbel laufen unverändert durch.

- [ ] **Step 5: Neue Pools starten leer.** In `addItem()` (`js/game.js:686`),
      direkt nach dem Anlegen von `entry`:

      ```js
      if (id === 'pool') entry.fill = 0;   /* Else bringt das Wasser (#45) */
      ```

- [ ] **Step 6: Splash beim Platzieren entfernen.** In `checkWishes()`
      (`js/game.js:778`) die Zeile `if (placedId === 'pool') sfx.splash();`
      streichen — der Splash gehört jetzt zum Ausgiessen (Task 4). Die
      Wunsch-Erfüllung samt `+3 Haselnüsse` und `sfx.chime(true)` bleibt
      unverändert.

- [ ] **Step 7: Debug-Haken erweitern.** In `window.wipfelkratzer`
      (`js/game.js:1188`) ergänzen:

      ```js
      poolEntries: () => roomOf('roof').filter(e => e.id === 'pool'),
      ```

- [ ] **Step 8: Test läuft grün.**
      `python3 .superpowers/sdd/2026-09-14-elster-pool/t2_state.py` gibt
      `T2 OK` aus: der alte Stand zeigt den Pool voll, `fill: 99` ebenfalls
      voll, `fill: -4` leer, null `pageerror`.

---

### Task 3: Elses Botengang — Zustandsautomat und Kurvenflug

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-elster-pool/t3_flight.py` (Wegwerf-Test)

**Interfaces:**
- `const MAGPIE_DUR = { holen: 3.2, schoepfen: 1.0, bringen: 3.6, giessen: 1.2 }`
  — beschreibbar, damit Tests den Ablauf raffen können.
- `const SCOOP = { x: -3.4, y: 0.75, cruiseY: 3.2 }` (z folgt aus
  `riverZ(SCOOP.x)`, `js/game.js:86`).
- `window.wipfelkratzer` bekommt `get magpiePhase()` → `'kreis' | 'holen' |
  'schoepfen' | 'bringen' | 'giessen'` und `MAGPIE_DUR`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-elster-pool/t3_flight.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {
          "floors": 10, "nuts": 0, "bridge": False, "garden": False,
          "night": False, "cutaway": False, "fulfilled": {}, "wallpaper": {},
          "flooring": {},
          "rooms": {"roof": [{"id": "pool", "cell": 0, "x": 0, "z": 0, "rot": 0, "y": 0.18, "fill": 0}]},
      }

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE))
          )
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)

          # Dauern raffen, damit drei Botengaenge in gut zwei Sekunden laufen.
          page.evaluate("""() => {
            const d = window.wipfelkratzer.MAGPIE_DUR;
            for (const k in d) d[k] = 0.12;
            window.__phases = [];
            window.__samples = [];
            const step = () => {
              const w = window.wipfelkratzer;
              const ph = w.magpiePhase;
              if (!window.__phases.length || window.__phases[window.__phases.length - 1] !== ph)
                window.__phases.push(ph);
              const m = w.magpie;
              window.__samples.push([+m.position.x.toFixed(2), +m.position.y.toFixed(2), +m.position.z.toFixed(2)]);
              requestAnimationFrame(step);
            };
            step();
          }""")
          page.wait_for_timeout(4000)
          res = page.evaluate("""() => ({
            phases: window.__phases,
            fill: window.wipfelkratzer.poolEntries()[0].fill,
            samples: window.__samples.length,
            minX: Math.min(...window.__samples.map(s => s[0])),
            maxY: Math.max(...window.__samples.map(s => s[1])),
            minY: Math.min(...window.__samples.map(s => s[1])),
            jumps: (() => { let j = 0; const s = window.__samples;
              for (let i = 1; i < s.length; i++) {
                const d = Math.hypot(s[i][0]-s[i-1][0], s[i][1]-s[i-1][1], s[i][2]-s[i-1][2]);
                if (d > 6) j++; }
              return j; })(),
          })""")
          b.close()

      print(json.dumps(res, indent=2, ensure_ascii=False))
      assert errs == [], errs
      assert res["phases"][0] in ("kreis", "holen"), res["phases"]
      for want in ("holen", "schoepfen", "bringen", "giessen"):
          assert want in res["phases"], (want, res["phases"])
      assert res["phases"].count("giessen") >= 3, res["phases"]
      assert res["phases"][-1] == "kreis", res["phases"]
      assert res["fill"] == 3, res["fill"]
      assert res["minY"] < 1.5, ("nie zum Bach hinabgestiegen", res["minY"])
      assert res["minX"] < -3.0, ("nie beim Bach westlich der Burg gewesen", res["minX"])
      assert res["jumps"] == 0, ("Positionssprung in der Flugbahn", res["jumps"])
      print("T3 OK")
      ```

- [ ] **Step 2: Test läuft rot.** `python3 …/t3_flight.py` bricht ab, weil
      `window.wipfelkratzer.MAGPIE_DUR` `undefined` ist.

- [ ] **Step 3: Zustand und Konstanten anlegen** (`js/game.js`, direkt nach
      der Erzeugung der Elster, `js/game.js:125`):

      ```js
      /* --- Elses Botengang (#45) ---------------------------------------
         Die Kreisbahn bleibt die Ruhephase. Ein Botengang besteht aus vier
         Abschnitten, die jeweils EINEN vorberechneten Weg abfahren; die
         Kurven werden beim Phasenwechsel gebaut, nicht pro Frame. */
      const MAGPIE_DUR = { holen: 3.2, schoepfen: 1.0, bringen: 3.6, giessen: 1.2 };
      const SCOOP = { x: -3.4, y: 0.75, cruiseY: 3.2 };
      let magPhase = 'kreis', magT = 0, magCurve = null, magFrom = null, magTarget = null;
      let magOffset = 0;          /* Kreiswinkel-Versatz für den nahtlosen Wiedereinstieg */
      let magToast = false;       /* Meldung "Else holt Wasser" schon gezeigt? */
      ```

- [ ] **Step 4: Zielsuche und Wegbau.** Ebenfalls bei der Elster:

      ```js
      /* Erster Pool auf dem Dach, der noch Wasser braucht (A10). */
      function thirstyPool() {
        for (const en of roomOf('roof'))
          if (en.id === 'pool' && poolFill(en) < 1) return en;
        return null;
      }
      function poolMeshOf(en) {
        return itemMeshes.roof.find(m => m.userData.pick && m.userData.pick.entry === en) || null;
      }
      /* Weltposition über dem Pool — roofG wandert mit jedem Stockwerk. */
      const poolAir = m => { roofG.updateWorldMatrix(true, false);
        const v = new THREE.Vector3(); m.getWorldPosition(v); v.y += 1.1; return v; };
      const scoopAir = () => new THREE.Vector3(SCOOP.x, SCOOP.cruiseY, riverZ(SCOOP.x));
      const scoopLow = () => new THREE.Vector3(SCOOP.x, SCOOP.y, riverZ(SCOOP.x));
      /* Drei-Punkt-Bogen: Start, überhöhter Zwischenpunkt, Ziel. */
      function magArc(a, b, lift) {
        const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + lift;
        return new THREE.CatmullRomCurve3([a.clone(), mid, b.clone()], false, 'catmullrom', 0.5);
      }
      ```

- [ ] **Step 5: Phasenwechsel.** Eine Funktion, die den nächsten Abschnitt
      aufsetzt — sie ist der einzige Ort, an dem `magCurve` entsteht:

      ```js
      function magpieEnter(phase) {
        magPhase = phase; magT = 0;
        const here = magpie.position.clone();
        if (phase === 'holen')  magCurve = magArc(here, scoopAir(), 1.6);
        if (phase === 'schoepfen') magCurve = magArc(scoopAir(), scoopLow(), 0.15);
        if (phase === 'bringen') {
          const en = thirstyPool(), m = en && poolMeshOf(en);
          magTarget = en; magCurve = m ? magArc(scoopLow(), poolAir(m), 2.4) : null;
          if (!magCurve) { magPhase = 'kreis'; magOffset = Math.atan2(here.z, here.x) - clock.elapsedTime * 0.3; }
        }
        if (phase === 'kreis') magOffset = Math.atan2(here.z, here.x) - clock.elapsedTime * 0.3;
      }
      ```

      Der `magOffset` macht den Wiedereinstieg nahtlos: die Kreisformel
      bekommt `ma = t * 0.3 + magOffset`, und solange nie ein Botengang
      geflogen wurde, ist `magOffset === 0` — die Bahn ist Frame für Frame die
      heutige (`js/game.js:1204-1207`).

- [ ] **Step 6: Die Kreisbahn in `tick()` um den Automaten erweitern.**
      `js/game.js:1204-1207` wird zu:

      ```js
      if (magPhase === 'kreis') {
        const mr = 10 + state.floors * 0.4, ma = t * 0.3 + magOffset;
        const mh = topY() + 2.6 + Math.sin(t * 0.7) * 0.4;
        const nx = Math.cos(ma + 0.08) * mr, nz = Math.sin(ma + 0.08) * mr;
        magpie.position.set(Math.cos(ma) * mr, mh, Math.sin(ma) * mr);
        magpie.lookAt(nx, mh, nz);
        if (thirstyPool()) magpieEnter('holen');
      } else {
        magT += dt;
        const dur = MAGPIE_DUR[magPhase] || 1;
        let k = Math.min(magT / dur, 1); k = k * k * (3 - 2 * k);
        if (magCurve) {
          const p = magCurve.getPointAt(k), q = magCurve.getPointAt(Math.min(k + 0.02, 1));
          magpie.position.copy(p);
          if (p.distanceToSquared(q) > 1e-6) magpie.lookAt(q);
        }
        if (magT >= dur) magpieAdvance();
      }
      magInner.userData.wings.forEach((w, i) => w.rotation.x = Math.sin(t * 9 + i) * 0.55);
      ```

      `magpieAdvance()` kommt in Task 4; für diesen Task genügt eine Fassung,
      die reihum `holen → schoepfen → bringen → giessen → holen` schaltet und
      am Ende von `giessen` `magpieEnter(thirstyPool() ? 'holen' : 'kreis')`
      aufruft.

- [ ] **Step 7: Debug-Haken erweitern** (`js/game.js:1188`):

      ```js
      magpie, MAGPIE_DUR, get magpiePhase() { return magPhase; },
      ```

- [ ] **Step 8: Test läuft grün.** `python3 …/t3_flight.py` gibt `T3 OK`
      aus: alle vier Phasen kommen vor, mindestens dreimal `giessen`, am Ende
      `kreis`, `fill === 3`, kein Positionssprung über 6 Einheiten zwischen
      zwei Frames, null `pageerror`.

---

### Task 4: Wasserübergabe — Eimer kippen, Pool füllen, Meldungen, Abbruch

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-elster-pool/t4_transfer.py` (Wegwerf-Test)

**Interfaces:**
- `function magpieAdvance(): void` — schaltet die Phase weiter und führt beim
  Verlassen von `schoepfen`/`giessen` die Zustandsänderungen aus.
- Während `giessen` wird `magInner.userData.bucket.rotation.z` von `0` auf
  `-2.2` und zurück geführt; `magInner.userData.bucketWater.visible` wechselt
  bei `k >= 0.5`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-elster-pool/t4_transfer.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = {
          "floors": 10, "nuts": 0, "bridge": False, "garden": False,
          "night": False, "cutaway": False, "fulfilled": {}, "wallpaper": {},
          "flooring": {},
          "rooms": {"roof": [{"id": "pool", "cell": 0, "x": 0, "z": 0, "rot": 0, "y": 0.18, "fill": 0}]},
      }

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script(
              "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(SAVE))
          )
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.evaluate("""() => {
            const d = window.wipfelkratzer.MAGPIE_DUR;
            for (const k in d) d[k] = 0.15;
            window.__tilt = 0; window.__waterSeen = false; window.__fills = [];
            const step = () => {
              const w = window.wipfelkratzer, m = w.magpie.children[0];
              window.__tilt = Math.min(window.__tilt, m.userData.bucket.rotation.z);
              if (m.userData.bucketWater.visible) window.__waterSeen = true;
              const f = w.poolEntries()[0] ? w.poolEntries()[0].fill : null;
              if (!window.__fills.length || window.__fills[window.__fills.length - 1] !== f)
                window.__fills.push(f);
              requestAnimationFrame(step);
            };
            step();
          }""")
          page.wait_for_timeout(5000)
          res = page.evaluate("""() => ({
            tilt: window.__tilt,
            waterSeen: window.__waterSeen,
            fills: window.__fills,
            toasts: [...document.querySelectorAll('#toast-stack .toast-msg')].map(e => e.textContent),
            stored: JSON.parse(localStorage.getItem('wipfelkratzer-v1')).rooms.roof[0].fill,
          })""")

          # Abbruch: Pool loeschen, waehrend Else unterwegs ist.
          page.evaluate("""() => {
            const w = window.wipfelkratzer;
            w.state.rooms.roof.length = 0;
            window.__after = [];
            const step = () => { const m = w.magpie;
              window.__after.push([+m.position.x.toFixed(2), +m.position.y.toFixed(2), +m.position.z.toFixed(2)]);
              requestAnimationFrame(step); };
            step();
          }""")
          page.wait_for_timeout(2500)
          after = page.evaluate("""() => ({
            phase: window.wipfelkratzer.magpiePhase,
            jumps: (() => { let j = 0; const s = window.__after;
              for (let i = 1; i < s.length; i++) {
                const d = Math.hypot(s[i][0]-s[i-1][0], s[i][1]-s[i-1][1], s[i][2]-s[i-1][2]);
                if (d > 6) j++; }
              return j; })(),
          })""")
          b.close()

      print(json.dumps({"lauf": res, "abbruch": after}, indent=2, ensure_ascii=False))
      assert errs == [], errs
      assert res["tilt"] <= -2.0, ("Eimer kippt nicht", res["tilt"])
      assert res["waterSeen"], "Eimerwasser wurde nie sichtbar"
      assert res["fills"] == [0, 1, 2, 3], res["fills"]
      assert res["stored"] == 3, ("Fuellstand nicht gespeichert", res["stored"])
      assert len(res["toasts"]) == 2, ("genau zwei Meldungen erwartet", res["toasts"])
      assert any("Wasser" in t for t in res["toasts"]), res["toasts"]
      assert any("voll" in t for t in res["toasts"]), res["toasts"]
      assert after["phase"] == "kreis", after
      assert after["jumps"] == 0, ("Positionssprung nach dem Loeschen", after)
      print("T4 OK")
      ```

- [ ] **Step 2: Test läuft rot.** `python3 …/t4_transfer.py` bricht an
      `res["tilt"] <= -2.0` ab — der Eimer kippt noch nicht.

- [ ] **Step 3: `magpieAdvance()` ausformulieren** (`js/game.js`, bei den
      übrigen Elster-Funktionen aus Task 3):

      ```js
      function magpieAdvance() {
        if (magPhase === 'holen') { magpieEnter('schoepfen'); return; }
        if (magPhase === 'schoepfen') {
          magInner.userData.bucketWater.visible = true;
          sfx.whoosh();
          magpieEnter('bringen'); return;
        }
        if (magPhase === 'bringen') {
          if (!magTarget || roomOf('roof').indexOf(magTarget) < 0) { magpieEnter('kreis'); return; }
          magpieEnter('giessen'); return;
        }
        if (magPhase === 'giessen') {
          magInner.userData.bucket.rotation.z = 0;
          magInner.userData.bucketWater.visible = false;
          magpieEnter(thirstyPool() ? 'holen' : 'kreis'); return;
        }
        magpieEnter('kreis');
      }
      ```

- [ ] **Step 4: Kippen und Übergabe im Loop.** In `tick()`, im `else`-Zweig
      aus Task 3 Step 6, nach der Kurvenauswertung:

      ```js
      if (magPhase === 'giessen') {
        /* Kippbewegung hin und zurück; genau in der Mitte wechselt das Wasser
           vom Eimer in den Pool. */
        const bk = magInner.userData.bucket;
        bk.rotation.z = -2.2 * Math.sin(k * Math.PI);
        if (!magPoured && k >= 0.5) { magPoured = true; pourBucket(); }
      } else magPoured = false;
      ```

      mit `let magPoured = false;` bei den übrigen Elster-Variablen, und:

      ```js
      /* Ein Eimer landet im Pool: Füllstand hoch, Mesh nachziehen, speichern. */
      function pourBucket() {
        const en = magTarget;
        magInner.userData.bucketWater.visible = false;
        sfx.splash();
        if (!en || roomOf('roof').indexOf(en) < 0) return;
        en.fill = Math.min(POOL_TRIPS, (en.fill | 0) + 1);
        const m = poolMeshOf(en);
        if (m && m.userData.setFill) m.userData.setFill(poolFill(en));
        if (en.fill >= POOL_TRIPS) { toast('Der Pool ist voll — Piet und Jan können baden!'); sfx.chime(true); }
        save();
      }
      ```

- [ ] **Step 5: Die erste Meldung.** In `magpieEnter('holen')` — genauer: in
      `magpieEnter`, im Zweig für `'holen'` — einmalig pro Pool:

      ```js
      if (phase === 'holen' && !magToast) { magToast = true; toast('Else holt Wasser für den Pool!'); }
      ```

      `magToast` wird in `pourBucket()` zurückgesetzt, sobald der Pool voll
      ist (`magToast = false;` im `en.fill >= POOL_TRIPS`-Zweig), damit ein
      **später** platzierter zweiter Pool seine eigene Ankündigung bekommt.
      Mehr als zwei Meldungen dürfen pro Pool nicht entstehen — der
      Meldungsstapel bleibt seit #10 stehen (`js/game.js:486-497`).

- [ ] **Step 6: Abbruch beim Löschen.** `removeItem()` (`js/game.js:713-719`)
      bleibt unverändert; der Abbruch läuft bereits über die Prüfung
      `roomOf('roof').indexOf(magTarget) < 0` in `magpieAdvance()` und
      `pourBucket()`. Zusätzlich in `magpieEnter`, Zweig `'bringen'`, den
      bereits in Task 3 Step 5 vorgesehenen Rückfall auf `'kreis'`
      beibehalten. Ergebnis: der laufende Abschnitt wird zu Ende geflogen,
      danach geht es in die Kreisbahn — kein Sprung.

- [ ] **Step 7: Test läuft grün.** `python3 …/t4_transfer.py` gibt `T4 OK`
      aus: Kippwinkel erreicht ≤ −2.0, Eimerwasser war sichtbar,
      `fills == [0,1,2,3]`, im `localStorage` steht `fill: 3`, genau zwei
      Meldungen, nach dem Löschen Phase `kreis` ohne Positionssprung, null
      `pageerror`.

---

### Task 5: Gesamtdurchlauf und Changelog

**Files:**
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-elster-pool/t5_e2e.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Durchlauf über die echte Oberfläche schreiben.**
      `.superpowers/sdd/2026-09-14-elster-pool/t5_e2e.py` — ohne
      vorbereiteten Spielstand, der Pool wird über den Katalog platziert:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8981
      URL = f"http://127.0.0.1:{PORT}/index.html"

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.clear()")
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          # Turm hochziehen, damit die Dachterrasse oben steht.
          for _ in range(10):
              page.click("#btn-build", timeout=20000)
              page.wait_for_timeout(300)
          page.wait_for_timeout(1500)
          page.evaluate("() => window.wipfelkratzer.enterEdit('roof')")
          page.wait_for_timeout(400)
          page.click("#catalog [data-id='pool']", timeout=20000)
          page.wait_for_timeout(600)
          empty = page.evaluate("() => window.wipfelkratzer.poolEntries()[0].fill")
          page.evaluate("() => { const d = window.wipfelkratzer.MAGPIE_DUR; for (const k in d) d[k] = 0.15; }")
          page.wait_for_timeout(5000)
          res = page.evaluate("""() => ({
            fill: window.wipfelkratzer.poolEntries()[0].fill,
            phase: window.wipfelkratzer.magpiePhase,
            stored: JSON.parse(localStorage.getItem('wipfelkratzer-v1')).rooms.roof[0].fill,
          })""")
          page.reload(wait_until="networkidle")
          page.wait_for_timeout(1500)
          after = page.evaluate("() => window.wipfelkratzer.poolEntries()[0].fill")
          b.close()

      print(json.dumps({"leer": empty, "lauf": res, "nach_reload": after}, indent=2))
      assert errs == [], errs
      assert empty == 0, ("neuer Pool startet nicht leer", empty)
      assert res["fill"] == 3, res
      assert res["phase"] == "kreis", res
      assert res["stored"] == 3, res
      assert after == 3, ("Fuellstand überlebt das Neuladen nicht", after)
      print("T5 OK")
      ```

      Der Selektor `#catalog [data-id='pool']` muss gegen den tatsächlichen
      Katalog-Aufbau geprüft werden (`js/game.js:541` und Umgebung); falls
      dort ein anderes Attribut verwendet wird, den Selektor entsprechend
      anpassen — **nicht** den Produktivcode an den Test anpassen.

- [ ] **Step 2: Durchlauf grün.** `python3 …/t5_e2e.py` gibt `T5 OK` aus.

- [ ] **Step 3: Von Hand nachsehen.** `index.html` im Browser öffnen, Turm
      bauen, Pool setzen und den vollständigen, **ungerafften** Ablauf
      anschauen: Else verlässt die Bahn, sinkt am Bach hinab, der Eimer füllt
      sich, sie fliegt zum Dach, kippt aus, der Wasserstand steigt. Prüfen,
      dass die Bewegung ruhig wirkt und Else nach dem dritten Eimer sauber in
      die Kreisbahn zurückfindet.

- [ ] **Step 4: Changelog.** In `CHANGELOG.md` **oberhalb** von
      `## [0.5.0] - 2026-09-13` einen Abschnitt `## [Unreleased]` mit
      `### Added` anlegen (falls noch nicht vorhanden) und dort ergänzen —
      deutscher Fliesstext im Stil der bestehenden Einträge, Issue-Nummer in
      Klammern:

      ```markdown
      ## [Unreleased]

      ### Added

      - Else Elster trug ihren Eimer bisher nur im Kreis spazieren. Sie holt
        damit jetzt Wasser: sobald ein Pool auf der Dachterrasse steht, fliegt
        sie zum Bach hinunter, schöpft, bringt den Eimer zum Dach und kippt ihn
        aus. Ein neu aufgestellter Pool startet deshalb leer und füllt sich in
        drei sichtbaren Schritten; erst im vollen Becken schwimmen Piet und
        Jan. Pools aus älteren Spielständen bleiben voll (#45)
      ```

- [ ] **Step 5: Release-Regeln einhalten.** `version.js` bleibt unverändert
      (`version.js:3` weiterhin `0.5.0`), es entsteht **kein**
      `chore(release)`-Commit und kein Tag. Mit
      `git diff --stat` prüfen, dass nur `js/models.js`, `js/game.js` und
      `CHANGELOG.md` im Diff stehen — `.superpowers/` ist ignoriert
      (`.gitignore:5`) und darf nicht auftauchen.

- [ ] **Step 6: Server beenden.**
      `ss -lptn 'sport = :8981' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.

---

Wenn Du bei der Umsetzung auf Blocker stösst, löse sie und schreibe die Lösung
in diesen Plan bzw. den Spec zurück, damit der nächste Durchlauf sie nicht neu
herleiten muss.
