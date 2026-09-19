# Plan — Besuchsmodus: den Turm von innen ansehen (Issue #44)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Knopf stellt die Kamera in Augenhöhe **in** eine Wohnung; man
sieht sich frei um und wechselt über vier Knöpfe zwischen Stockwerken,
Dachterrasse und Spielplatz. Kein Laufen, keine Kollision, keine Schwerkraft.

**Architecture:** Ein dritter Kamerazustand `besuch` neben «frei» und
`edit`, gebaut auf derselben Maschinerie wie `enterEdit`: Kamera merken,
über `moveCam` an einen berechneten Standpunkt fahren, Sichtbarkeit anpassen,
beim Verlassen alles zurückstellen. Neu sind `besuchCamFor(k)`,
`enterBesuch(k)`, `exitBesuch()` und eine Leiste `#besuchbar` nach dem Vorbild
von `#editbar`.

**Tech Stack:** Vanilla ES-Module, three.js r184, `OrbitControls`. Kein Build,
kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-19-besuchsmodus-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`).
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine Testdatei**.
- **Der Besuch verändert den Spielstand nicht.** Kein `save()`, kein Schreiben
  an `state` ausser dem Kamerazustand, der nicht im Spielstand liegt.
  `localStorage` ist vor und nach dem Besuch byte-gleich.
- **`state.cutaway` wird nie verändert.** Der Besuch *ignoriert* es; die
  Aussenansicht danach ist unverändert.
- **Die vier `OrbitControls`-Grenzen werden gesichert, nicht neu
  hingeschrieben.** `minDistance`, `maxDistance`, `minPolarAngle`,
  `maxPolarAngle` plus `enableZoom` kommen beim Verlassen exakt auf ihre
  vorherigen Werte zurück. Ein zweiter Ort mit denselben Zahlen wäre genau die
  Dopplung, die später auseinanderläuft (`js/game.js:164`).
- **Einrichten und Besuch schliessen sich aus.** `enterBesuch` steigt aus,
  wenn `edit` gesetzt ist, und umgekehrt.
- **Touch first.** Jeder Knopf der Leiste mindestens 44 px hoch, bei 400 px
  Breite erreichbar.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(turm)`.

## Was dieser Plan nicht baut

Kein Laufen, keine Kollision, keine Schwerkraft, keine begehbaren Treppen,
kein Umland. Wer davon etwas anfängt, hat den Zuschnitt verlassen — die
Begründung steht in der Spec unter «Was dieser Entwurf nicht liefert».

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-19-besuchsmodus/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9041–9045** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr.**
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Die Kamera fährt über `moveCam` rund eine Sekunde und schwingt danach mit
  `enableDamping` nach.** Eine Messung direkt nach dem Klick misst die Fahrt,
  nicht das Ziel. Vor jeder Kameraprüfung auf Stillstand warten:

  ```python
  STILL = """() => { const w = window.wipfelkratzer; const p = w.camera.position;
    const k = p.x.toFixed(4)+','+p.y.toFixed(4)+','+p.z.toFixed(4);
    if (window.__l === k) window.__n = (window.__n||0)+1; else window.__n = 0;
    window.__l = k; return (window.__n||0) >= 3; }"""
  page.wait_for_function(STILL, timeout=60000, polling=400)
  ```

  Das ist kein Schönheitsfehler der Sonde: dieselbe Falle hat bei #64 eine
  Kameraprüfung fälschlich rot gemeldet, und die Gegenprobe gegen `main` zeigte
  dieselbe Drift — es war die Einflugfahrt, nicht die Änderung.
- **Einen Turm aufbauen** geht am schnellsten über den Debug-Hook:
  `w.state.floors = 3; w.speichern();` und danach `page.reload()`, damit die
  Etagen wirklich entstehen.

---

### Task 1: Zustand, Standpunkt und die Kameragrenzen

**Files:**
- Modify: `index.html` (Knopf in `#toolbar`, Markup und CSS für `#besuchbar`)
- Modify: `js/game.js` (neuer Abschnitt nach `exitEdit`, `js/game.js:1142-1156`)
- Modify: `js/game.js:2058-2069` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-19-besuchsmodus/t1_standpunkt.py`

**Interfaces:**
- Produces: `besuchCamFor(k) → { eye: THREE.Vector3, tgt: THREE.Vector3 }`
- Produces: `enterBesuch(k)`, `exitBesuch()`
- Produces: im Debug-Hook `enterBesuch`, `exitBesuch`, `besuchCamFor` und
  `get besuch()` (der Zustand oder `null`).
- Consumes: `moveCam`, `camSave`, `floorY`, `topY`, `dims`, `ROOF_D`,
  `GARDEN_POS`, `GARDEN_D`, `controls`, `camera` — alle vorhanden.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-besuchsmodus/t1_standpunkt.py`:

      ```python
      import json, socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9041, 9046)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      STILL = """() => { const w = window.wipfelkratzer; const p = w.camera.position;
        const k = p.x.toFixed(4)+','+p.y.toFixed(4)+','+p.z.toFixed(4);
        if (window.__l === k) window.__n = (window.__n||0)+1; else window.__n = 0;
        window.__l = k; return (window.__n||0) >= 3; }"""

      GRENZEN = """() => { const c = window.wipfelkratzer.controls;
        return { min: c.minDistance, max: c.maxDistance,
                 minP: c.minPolarAngle, maxP: c.maxPolarAngle,
                 zoom: c.enableZoom }; }"""

      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.5)
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.goto(URL, wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
              if not page.evaluate("document.getElementById('tower-pick')"
                                   ".classList.contains('hidden')"):
                  page.click("#pick-10", timeout=20000)
              if page.locator("#btn-start").is_visible():
                  page.click("#btn-start", timeout=20000)
              page.wait_for_timeout(600)
              page.evaluate("() => { const w = window.wipfelkratzer;"
                            " w.state.floors = 3; w.speichern(); }")
              page.reload(wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
              if page.locator("#btn-start").is_visible():
                  page.click("#btn-start", timeout=20000)
              page.wait_for_timeout(600)
              page.wait_for_function(STILL, timeout=60000, polling=400)

              vorher = page.evaluate(GRENZEN)
              vorKam = page.evaluate("() => window.wipfelkratzer.camera.position.toArray()"
                                     ".map(n => +n.toFixed(4))")
              speicherVor = page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')")

              page.evaluate("() => window.wipfelkratzer.enterBesuch(2)")
              page.wait_for_function(STILL, timeout=60000, polling=400)
              drin = page.evaluate("""() => { const w = window.wipfelkratzer;
                const { tgt } = w.besuchCamFor(2);
                const p = w.camera.position;
                return { y: +p.y.toFixed(3), sollY: +(w.floorYOf(2) + 1.5).toFixed(3),
                         abstand: +p.distanceTo(tgt).toFixed(3),
                         halbeTiefe: +(w.dims(2).d / 2).toFixed(3),
                         besuch: !!w.besuch }; }""")
              waehrend = page.evaluate(GRENZEN)

              page.evaluate("() => window.wipfelkratzer.exitBesuch()")
              page.wait_for_function(STILL, timeout=60000, polling=400)
              nachher = page.evaluate(GRENZEN)
              nachKam = page.evaluate("() => window.wipfelkratzer.camera.position.toArray()"
                                      ".map(n => +n.toFixed(4))")
              speicherNach = page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')")
              b.close()

          print(json.dumps({"drin": drin, "vorher": vorher,
                            "waehrend": waehrend, "nachher": nachher}, indent=2))
          assert drin["besuch"], "kein Besuchszustand"
          assert abs(drin["y"] - drin["sollY"]) < 0.05, drin
          assert drin["abstand"] < drin["halbeTiefe"], drin
          assert waehrend["min"] < 1.0, waehrend
          assert waehrend["zoom"] is False, waehrend
          assert nachher == vorher, (vorher, nachher)
          assert nachKam == vorKam, (vorKam, nachKam)
          assert speicherVor == speicherNach, "der Besuch hat den Spielstand angefasst"
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-19-besuchsmodus/t1_standpunkt.py` bricht
      mit `TypeError: window.wipfelkratzer.enterBesuch is not a function` ab.
      Rot gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: Besuchsabschnitt einfügen.** In `js/game.js` direkt **nach**
      `exitEdit` (endet auf `js/game.js:1156`):

      ```js
      /* ---------- Besuchsmodus (#44) ---------- */
      /* Standpunkte statt Laufen: die Kamera steht in Augenhöhe im Raum, das
         Blickziel liegt in dessen Mitte. Gedreht wird um dieses Ziel, was sich
         von innen wie Umsehen anfühlt — ohne Kollision, Schwerkraft oder ein
         zweites Steuerungssystem. */
      const AUGE = 1.5;
      let besuch = null, besuchSave = null;

      function besuchCamFor(k) {
        if (k === 'garten') {
          const y = AUGE;
          return { eye: new THREE.Vector3(GARDEN_POS.x, y, GARDEN_POS.z + GARDEN_D / 2 - 0.6),
                   tgt: new THREE.Vector3(GARDEN_POS.x, y, GARDEN_POS.z) };
        }
        if (k === 'roof') {
          const y = topY() + AUGE;
          return { eye: new THREE.Vector3(0, y, ROOF_D / 2 - 0.6),
                   tgt: new THREE.Vector3(0, y, 0) };
        }
        const y = floorY(k) + AUGE;
        const x = floorGroups[k] ? floorGroups[k].position.x : 0;
        return { eye: new THREE.Vector3(x, y, -dims(k).d / 2 + 0.5),
                 tgt: new THREE.Vector3(x, y, 0) };
      }

      function enterBesuch(k) {
        if (edit || besuch) return;
        besuch = { k };
        camSave = { p: camera.position.clone(), t: controls.target.clone() };
        /* Die heutigen Grenzen sind für die Aussenansicht gemacht:
           minDistance 4 bei rund 1.5 m Abstand im Raum würde die Kamera beim
           ersten update() durch die Wand nach aussen schieben (js/game.js:164).
           Gesichert statt neu hingeschrieben — ein zweiter Ort mit denselben
           Zahlen läuft später auseinander. */
        besuchSave = { min: controls.minDistance, max: controls.maxDistance,
                       minP: controls.minPolarAngle, maxP: controls.maxPolarAngle,
                       zoom: controls.enableZoom };
        controls.minDistance = 0.4;
        controls.maxDistance = 6;
        controls.minPolarAngle = 0.35;
        controls.maxPolarAngle = 2.4;
        controls.enableZoom = false;
        const { eye, tgt } = besuchCamFor(k);
        moveCam(eye, tgt);
        sfx.whoosh();
      }

      function exitBesuch() {
        if (!besuch) return;
        Object.assign(controls, { minDistance: besuchSave.min, maxDistance: besuchSave.max,
          minPolarAngle: besuchSave.minP, maxPolarAngle: besuchSave.maxP,
          enableZoom: besuchSave.zoom });
        besuch = null; besuchSave = null;
        moveCam(camSave.p, camSave.t);
        sfx.whoosh();
      }
      ```

- [ ] **Step 4: Die Sperre gilt in beide Richtungen.** `enterBesuch` steigt
      oben bei `if (edit || besuch) return;` aus — `enterEdit` kennt den Besuch
      aber noch nicht. In `js/game.js:1115` die erste Zeile von `enterEdit`

      ```js
        if (edit) return;
      ```

      ändern zu

      ```js
        if (edit || besuch) return;
      ```

      Ohne das liesse sich aus dem Besuch heraus das Einrichten starten, und
      beide Zustände schrieben gleichzeitig an Kamera und Sichtbarkeit.

- [ ] **Step 5: Knopf in der Werkzeugleiste.** In `index.html` in `#toolbar`
      (`index.html:234-243`) nach `#btn-cutaway` einfügen:

      ```html
        <button id="btn-besuch">Hineingehen</button>
      ```

      und in `js/game.js` neben den anderen Knopf-Handlern:

      ```js
      /* Beginnt beim untersten gebauten Stockwerk — das Erdgeschoss ist
         immer da, auch in einem frisch begonnenen Turm. */
      $('btn-besuch').onclick = () => { if (besuch) exitBesuch(); else enterBesuch(0); };
      ```

- [ ] **Step 6: Debug-Hook ergänzen** (`js/game.js:2058-2069`), damit die
      Sonden prüfen können:

      ```js
        enterBesuch, exitBesuch, besuchCamFor, get besuch() { return besuch; },
        floorYOf: floorY, dims,
      ```

      `dims` steht dort eventuell schon — dann nicht doppelt eintragen.

- [ ] **Step 7: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-besuchsmodus/t1_standpunkt.py`
      druckt `T1 OK`.

- [ ] **Step 8: Commit und Push.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(turm): Besuchsmodus — Kamera in Augenhöhe im Raum"
      git push
      ```

---

### Task 2: Sichtbarkeit von innen

**Files:**
- Modify: `js/game.js:1086-1088` (`applyFronts`)
- Modify: `js/game.js` — `enterBesuch`/`exitBesuch` aus Task 1
- Test: `.superpowers/sdd/2026-09-19-besuchsmodus/t2_sicht.py`

**Interfaces:**
- Consumes: `besuch`, `enterBesuch`, `exitBesuch` aus Task 1.
- Produces: keine neuen Namen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-besuchsmodus/t2_sicht.py`, gleicher Rahmen
      wie T1 (drei Stockwerke). Ablauf: `state.cutaway` einschalten, Besuch in
      Stockwerk 2 starten, dann prüfen:

      ```python
      page.evaluate("() => { const w = window.wipfelkratzer;"
                    " if (!w.state.cutaway) document.getElementById('btn-cutaway').click(); }")
      page.wait_for_timeout(600)
      page.evaluate("() => window.wipfelkratzer.enterBesuch(2)")
      page.wait_for_timeout(1500)
      res = page.evaluate("""() => { const w = window.wipfelkratzer;
        return { front: w.floorGroups[2].userData.front.visible,
                 decke: w.floorGroups[2].userData.ceil.visible,
                 oben: w.floorGroups[3] ? w.floorGroups[3].visible : null,
                 cutaway: w.state.cutaway }; }""")
      assert res["front"] is True, res       # Vorderwand trotz cutaway da
      assert res["decke"] is False, res      # Decke bleibt weg, sonst ist es dunkel
      assert res["oben"] is True, res        # höhere Stockwerke bleiben stehen
      assert res["cutaway"] is True, res     # der Schalter selbst unverändert

      page.evaluate("() => window.wipfelkratzer.exitBesuch()")
      page.wait_for_timeout(1200)
      nach = page.evaluate("""() => { const w = window.wipfelkratzer;
        return { front: w.floorGroups[2].userData.front.visible,
                 decke: w.floorGroups[2].userData.ceil.visible,
                 cutaway: w.state.cutaway }; }""")
      assert nach["front"] is False, nach    # cutaway wirkt danach wieder
      assert nach["decke"] is True, nach
      assert nach["cutaway"] is True, nach
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Die Vorderwand fehlt im Besuch, weil
      `applyFronts` nur `state.cutaway` und `edit` kennt.

- [ ] **Step 3: `applyFronts` kennt den Besuch** (`js/game.js:1086-1088`):

      ```js
      function applyFronts() {
        /* Von innen gilt das Gegenteil von aussen: die Wand muss stehen, sonst
           sieht man in einen offenen Setzkasten statt in ein Zimmer.
           state.cutaway selbst bleibt unangetastet, damit die Aussenansicht
           nach dem Besuch unverändert ist (#44). */
        for (let j = 0; j <= MAXF; j++) if (floorGroups[j])
          floorGroups[j].userData.front.visible =
            besuch ? true : (!state.cutaway && !(edit && edit.k === j));
        $('btn-cutaway').textContent = state.cutaway ? 'Wände hin' : 'Wände weg';
      }
      ```

- [ ] **Step 4: Decke weg, höhere Stockwerke stehen lassen.** In
      `enterBesuch` nach `moveCam(eye, tgt);` ergänzen:

      ```js
        /* Die Decke ist die Lichtquelle des Raums — mit ihr wird es dunkel und
           trüb. Dieselbe bewusste Unehrlichkeit, die enterEdit schon trifft
           (js/game.js:1131). Höhere Stockwerke bleiben dagegen stehen: beim
           Blick aus dem Fenster fehlte sonst der halbe Turm. */
        if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
        applyFronts();
      ```

      und in `exitBesuch` **vor** `moveCam(camSave.p, camSave.t);`:

      ```js
        for (let j = 0; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].userData.ceil.visible = true;
      ```

      Die Reihenfolge in `exitBesuch` ist heikel, weil `applyFronts()` den
      Zustand `besuch` liest. Der Rumpf lautet nach diesem Task vollständig:

      ```js
      function exitBesuch() {
        if (!besuch) return;
        Object.assign(controls, { minDistance: besuchSave.min, maxDistance: besuchSave.max,
          minPolarAngle: besuchSave.minP, maxPolarAngle: besuchSave.maxP,
          enableZoom: besuchSave.zoom });
        besuch = null; besuchSave = null;
        /* Erst jetzt, mit besuch === null, stellt applyFronts den Aussenzustand
           her — vorher hielte es alle Wände sichtbar. */
        for (let j = 0; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].userData.ceil.visible = true;
        applyFronts();
        moveCam(camSave.p, camSave.t);
        renderBesuchbar();
        sfx.whoosh();
      }
      ```

      `renderBesuchbar()` entsteht erst in Task 3; bis dahin bleibt die Zeile
      weg.

- [ ] **Step 5: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-besuchsmodus/t2_sicht.py` druckt
      `T2 OK`.

- [ ] **Step 6: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(turm): im Besuch stehen die Wände, die Decke bleibt weg"
      git push
      ```

---

### Task 3: Die Leiste — hoch, runter, Dach, Draussen

**Files:**
- Modify: `index.html` (Markup `#besuchbar`, CSS nach dem Vorbild `#editbar`,
  `index.html:83-85`)
- Modify: `js/game.js` — Handler und `renderBesuchbar()`
- Test: `.superpowers/sdd/2026-09-19-besuchsmodus/t3_leiste.py`

**Interfaces:**
- Consumes: `besuch`, `enterBesuch`, `exitBesuch`, `besuchCamFor`,
  `flLabel(i)` (`js/game.js:39`), `tenantOf(i)`, `tenantIn(i)`.
- Produces: `renderBesuchbar()` — schreibt Titel und Sperrzustände; wird von
  `enterBesuch` und bei jedem Wechsel gerufen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-besuchsmodus/t3_leiste.py`, gleicher Rahmen,
      drei Stockwerke gebaut, `state.garden` aus:

      ```python
      page.click("#btn-besuch", timeout=20000)
      page.wait_for_timeout(1500)
      res = page.evaluate("""() => ({
        offen: document.getElementById('besuchbar').classList.contains('on'),
        titel: document.getElementById('besuch-titel').textContent,
        runter: document.getElementById('btn-besuch-runter').disabled,
        hoch: document.getElementById('btn-besuch-hoch').disabled,
        draussen: document.getElementById('btn-besuch-garten').classList.contains('hidden'),
      })""")
      assert res["offen"], res
      assert res["runter"] is True, res      # im Erdgeschoss gesperrt
      assert res["hoch"] is False, res
      assert res["draussen"] is True, res    # kein Spielplatz -> kein Knopf

      for _ in range(3):
          page.click("#btn-besuch-hoch", timeout=20000); page.wait_for_timeout(1300)
      res = page.evaluate("""() => ({
        k: window.wipfelkratzer.besuch.k,
        hoch: document.getElementById('btn-besuch-hoch').disabled,
        titel: document.getElementById('besuch-titel').textContent })""")
      assert res["k"] == 3, res              # drei Stockwerke gebaut
      assert res["hoch"] is True, res        # oben gesperrt
      assert "3" in res["titel"], res

      page.click("#btn-besuch-dach", timeout=20000); page.wait_for_timeout(1300)
      assert page.evaluate("() => window.wipfelkratzer.besuch.k") == "roof"
      page.click("#btn-besuch-zu", timeout=20000); page.wait_for_timeout(1300)
      assert page.evaluate("() => window.wipfelkratzer.besuch") is None
      assert page.evaluate("() => !document.getElementById('besuchbar')"
                           ".classList.contains('on')")
      print("T3 OK")
      ```

- [ ] **Step 2: Test läuft rot.** `#besuchbar` gibt es nicht — der erste
      `page.evaluate` liefert `null` für `offen`.

- [ ] **Step 3: Markup.** In `index.html` direkt nach dem `#editbar`-Block:

      ```html
      <div id="besuchbar" class="panel">
        <span id="besuch-titel"></span>
        <button id="btn-besuch-runter" title="ein Stockwerk tiefer">▼</button>
        <button id="btn-besuch-hoch" title="ein Stockwerk höher">▲</button>
        <button id="btn-besuch-dach">Dach</button>
        <button id="btn-besuch-garten">Draussen</button>
        <button id="btn-besuch-zu" class="primary">Schluss</button>
      </div>
      ```

- [ ] **Step 4: CSS.** In `index.html` neben der `#editbar`-Regel
      (`index.html:83-85`) — dieselbe Anordnung, nur unten statt oben, damit
      sie auf dem Tablet unter dem Daumen liegt:

      ```css
      #besuchbar { position: fixed; bottom: calc(var(--toolbar-h, 60px) + 16px); left: 50%; transform: translateX(-50%); z-index: 6; display: none; align-items: center; gap: 8px; padding: 8px 10px 8px 16px; max-width: 92vw; flex-wrap: wrap; justify-content: center; }
      #besuchbar.on { display: flex; }
      #besuch-titel { font-size: 16px; font-weight: 700; }
      #besuchbar button { min-height: 44px; min-width: 44px; }
      #besuchbar button:disabled { opacity: .45; }
      ```

- [ ] **Step 5: `renderBesuchbar` und die Handler.** In `js/game.js` im
      Besuchsabschnitt:

      ```js
      /* Gesperrt statt versteckt: ein Knopf, der verschwindet, verwirrt mehr
         als einer, der grau ist (#44). */
      function renderBesuchbar() {
        const bar = $('besuchbar');
        bar.classList.toggle('on', !!besuch);
        if (!besuch) return;
        const k = besuch.k;
        const zahl = typeof k === 'number';
        $('besuch-titel').textContent = k === 'roof' ? 'Dachterrasse'
          : k === 'garten' ? 'Spielplatz'
          : `${flLabel(k)} — ${tenantIn(k) ? (tenantOf(k).unit || tenantOf(k).name) : 'noch niemand'}`;
        $('btn-besuch-runter').disabled = !zahl || k <= 0;
        $('btn-besuch-hoch').disabled = !zahl || k >= state.floors;
        $('btn-besuch-dach').disabled = k === 'roof';
        $('btn-besuch-garten').classList.toggle('hidden', !state.garden);
        $('btn-besuch-garten').disabled = k === 'garten';
      }

      /* Der Wechsel ist ein neuer Standpunkt, kein neuer Besuch: camSave und
         die gesicherten Grenzen bleiben, damit «Schluss» auch nach fünf
         Wechseln dorthin zurückführt, wo man angefangen hat. */
      function wechsleBesuch(k) {
        if (!besuch) return;
        besuch.k = k;
        if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
        const { eye, tgt } = besuchCamFor(k);
        moveCam(eye, tgt);
        renderBesuchbar();
        sfx.pop();
      }

      $('btn-besuch-runter').onclick = () => { if (besuch && typeof besuch.k === 'number' && besuch.k > 0) wechsleBesuch(besuch.k - 1); };
      $('btn-besuch-hoch').onclick = () => { if (besuch && typeof besuch.k === 'number' && besuch.k < state.floors) wechsleBesuch(besuch.k + 1); };
      $('btn-besuch-dach').onclick = () => wechsleBesuch('roof');
      $('btn-besuch-garten').onclick = () => { if (state.garden) wechsleBesuch('garten'); };
      $('btn-besuch-zu').onclick = exitBesuch;
      ```

      Dazu `renderBesuchbar();` am Ende von `enterBesuch` **und** am Ende von
      `exitBesuch` aufrufen — im zweiten Fall schaltet es die Leiste aus, weil
      `besuch` dann `null` ist.

- [ ] **Step 6: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-besuchsmodus/t3_leiste.py` druckt
      `T3 OK`.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(turm): Leiste für den Besuch — hoch, runter, Dach, Draussen"
      git push
      ```

---

### Task 4: Abnahme, Schmalansicht und Changelog

**Files:**
- Modify: `CHANGELOG.md`
- Test: `.superpowers/sdd/2026-09-19-besuchsmodus/t4_abnahme.py`

**Interfaces:**
- Consumes: alles aus Task 1–3.

- [ ] **Step 1: Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-19-besuchsmodus/t4_abnahme.py` prüft die
      Akzeptanzkriterien am Stück:

      1. **Einrichten und Besuch schliessen sich aus:** `enterEdit(1)`, dann
         `enterBesuch(1)` → `besuch` bleibt `null`; umgekehrt `enterBesuch(1)`,
         dann `enterEdit(1)` → `edit` bleibt `null`.
      2. **Spielplatz:** `state.garden` einschalten (`#btn-garden`), Besuch
         starten, «Draussen» ist sichtbar und führt nach `'garten'`.
      3. **Rundreise:** Erdgeschoss → hoch → hoch → Dach → Schluss; danach
         stimmen Kameraposition, Blickziel und alle vier Grenzen mit den
         Werten vor dem Besuch überein (nach Stillstand gemessen).
      4. **Schmalansicht:** `page.set_viewport_size({"width": 400, "height": 800})`,
         Besuch starten, jeder sichtbare Knopf in `#besuchbar` hat
         `bounding_box()["height"] >= 44`.
      5. **Spielstand:** `localStorage` vor und nach der Rundreise byte-gleich.
      6. Konsole ohne `pageerror` über den ganzen Lauf.

- [ ] **Step 2: Sonde laufen lassen und rote Punkte beheben.** Jeder
      Fehlschlag ist ein Mangel in Task 1–3, keine Sondenschwäche. Bei drei
      erfolglosen Versuchen an derselben Stelle anhalten und den Befund in der
      PR-Beschreibung festhalten, statt weiter zu raten.

- [ ] **Step 3: Changelog-Eintrag.** Unter `## [Unreleased]` → `### Added`:

      ```markdown
      - Du kannst jetzt in den Wipfelkratzer hineingehen: «Hineingehen» stellt
        Dich mitten in eine Wohnung, und Du schaust Dich in Ruhe um — so gross
        wie ein Biber, mit den Wänden um Dich herum. Über die Leiste unten
        gehst Du ein Stockwerk höher oder tiefer, aufs Dach oder nach draussen
        auf den Spielplatz. «Schluss» bringt Dich wieder dorthin zurück, wo Du
        vorher warst (#44)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Besuchsmodus (#44)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Vor/Nach-Ausgabe **jeder**
      Sonde einfügen, dazu `git diff --name-only` gegen `main`. Den **manuellen
      In-Browser-Playtest als offenen Posten** benennen — bei einer
      Kameraänderung besonders, weil sich «wird mir davon schwindlig» nicht
      automatisiert prüfen lässt. Ebenfalls vermerken: geprüft wurde bei 400 px
      Breite, nicht auf einem echten Tablet.
