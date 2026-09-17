# Plan — Maus-Objekte verschieben und Mausrad-Objekt drehen (Issue #64)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Einrichtungsmodus lässt sich das **ausgewählte** Objekt mit Maus
oder Finger an seinen Platz ziehen, und das Mausrad dreht es, solange der
Zeiger auf ihm liegt. Überall sonst bleiben Kamera-Drehen und Zoom exakt wie
heute.

**Architecture:** Ein neuer Abschnitt in `js/game.js` hinter dem bestehenden
Zeigerblock (`js/game.js:1646-1700`) hält drei Variablen (`ziehen`,
`zugEbene`, `zugVersatz`) und drei Handler (`pointerdown`, `pointermove`,
`pointerup`) plus einen `wheel`-Handler. Jeder Zugschritt läuft durch das
vorhandene `applyMove` (`js/game.js:678-684`), damit die Kollisionsprüfung aus
#40 gilt. Voraussetzung dafür ist Task 1: die Rückmeldung bei Blockade
(`sfx.knock()` in `applyMove`, `toast(...)` in `resolveItemMove`) wandert in
ein `meldeBlockade()`, das der Aufrufer auslöst — sonst klopft und toastet ein
laufender Zug 60× pro Sekunde. Der Zug ruft es nur an der steigenden Flanke.

**Tech Stack:** Vanilla ES-Module, three.js r184 über Importmap
(`index.html:13-16`), `OrbitControls`, Pointer Events mit
`setPointerCapture`. Kein Build, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-17-mausinteraktionen-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine Testdatei**. Das ist eine
  ausdrückliche Stack-Regel, kein Versehen.
- **Kein neues Modul.** Die Geste braucht `selected`, `applyMove`,
  `clampEntry`, `moveWallItem`, `setTenantPos`, `save`, `controls`, `ray`,
  `ptr` — alles Modulinterna von `js/game.js`. Ein `js/drag.js` müsste sie
  sich zurückholen und verschlechterte die Kapselung.
- **Jeder Bewegungsweg läuft durch `applyMove`.** Kein direktes Schreiben von
  `en.x`/`en.z`/`en.rot` ohne diese Prüfung — sonst fällt #40 still aus.
- **`en.x`/`en.y`/`en.z` sind lokal zur Elterngruppe.** `parentOf(k)`
  (`js/game.js:500`) liefert `roofG`, `gartenG` oder `floorGroup(k)`;
  `gartenG` trägt `GARDEN_POS`, die Stockwerksgruppen ihre Höhe. Ein
  Weltpunkt von der Zugebene muss deshalb **immer** über
  `parentOf(k).worldToLocal(p)` umgerechnet werden. Ohne das springt jedes
  Gartenobjekt um den Lichtungsversatz.
- **Tiere:** `position.y` gehört allein der Wackel-Animation (#39). Nach einer
  Bewegung `setTenantPos(floor, idx, en)` statt `save()`.
- **Wandobjekte:** `en.x` läuft entlang der Wand, `en.y` ist die Höhe
  (`moveWallItem`, `js/game.js:1732-1737`); `clampEntry` erzwingt
  `en.rot = pl.rot` (`js/game.js:597`). Sie werden **nicht** gedreht.
- **Touch first.** Die Gesten gelten für jeden `pointerType`, nicht nur
  `'mouse'`. Auf dem Tablet bleiben `#btn-rot` und Bild↑/↓ der Weg zum Drehen.
- **`version.js` wird nicht angefasst**, es gibt **keinen
  `chore(release)`-Commit**. Der Changelog-Eintrag geht unter
  `## [Unreleased]` → `### Added`, deutscher Fliesstext aus Spielersicht,
  Issue-Nummer in Klammern, im Stil der bestehenden Einträge.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(einrichten)` bzw. `refactor(einrichten)`.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-17-mausinteraktionen/`
(git-ignoriert, `.gitignore:5`). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9021–9025** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`
  (kein `pkill -f`, das Muster träfe den eigenen Aufruf).
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen. Die
  THREE-Warnungen zu `Clock` und `PCFSoftShadowMap` sind ebenfalls erwartet.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:2058-2069`) liefert bereits
  `state`, `camera`, `controls`, `enterEdit`, `exitEdit`, `select`,
  `deselect`, `selected`, `itemMeshes`, `tenantMeshes`, `applyMove`,
  `solidBoxes`, `addItem`. Dieser Plan ergänzt `meldeBlockade`, `ziehtGerade`
  und `zugBlockiert`.
- **Spielstand vor dem Laden setzen** (`page.add_init_script` auf
  `localStorage['wipfelkratzer-v1']`) ist viel schneller als der Aufbau über
  die Oberfläche. Ein Stand mit `floors: 1` und einer eingerichteten Wohnung
  genügt für alle Sonden.
- **Gesten fahren über `page.mouse`**, nicht über `locator.drag_to`: das Ziel
  ist der Canvas, nicht ein DOM-Knoten. Ein Zug ist
  `mouse.move(x0,y0)` → `mouse.down()` → mehrere `mouse.move(...)` →
  `mouse.up()`. **Mehrere Zwischenschritte sind Pflicht** — ein einzelner
  `move` erzeugt genau ein `pointermove`, und die Flankenlogik aus Task 5
  liesse sich damit nicht prüfen.
- **Bildschirmkoordinaten eines Objekts** kommen aus der Szene, nicht geraten:
  `mesh.getWorldPosition(v).project(camera)` → `(v.x+1)/2*breite`,
  `(-v.y+1)/2*höhe`. Ein Helfer dafür gehört in jede Sonde.

---

### Task 1: Rückmeldung aus dem Ablehnungspfad herausziehen

Voraussetzung für alles Weitere. Heute meldet der Ablehnungspfad selbst; ein
gezogenes Objekt würde damit pro Mausbewegung klopfen und toasten.

**Files:**
- Modify: `js/game.js:678-684` (`applyMove`)
- Modify: `js/game.js:1329-1342` (`resolveItemMove`)
- Modify: `js/game.js:1702-1717` (`#btn-move`), `js/game.js:1719-1724`
  (`#btn-rot`), `js/game.js:1742-1762` (Tastatur)
- Modify: `js/game.js:2058-2069` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-17-mausinteraktionen/t1_melden.py`

**Interfaces:**
- Produces: `meldeBlockade()` — spielt `sfx.knock()` und zeigt, falls gesetzt,
  den hinterlegten Grund als Toast; setzt den Grund danach zurück.
- Produces: `applyMove(pick, mutate) → boolean` — Signatur und
  Rücksetzverhalten unverändert, **ohne** eigene Tonausgabe.
- Produces: im Debug-Hook zusätzlich `meldeBlockade`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-17-mausinteraktionen/t1_melden.py`:

      ```python
      import socket, subprocess, sys, time, json
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9021, 9026)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = json.dumps({"floors": 1, "maxFloors": 10, "nuts": 99,
                         "rooms": {"1": []}, "fulfilled": {}, "wallpaper": {},
                         "flooring": {}, "tenantPos": {}, "designs": []})

      CHECK = """
      () => {
        const w = window.wipfelkratzer;
        return { hatMelder: typeof w.meldeBlockade === 'function' };
      }
      """

      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.5)
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page()
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.add_init_script(
                  f"localStorage.setItem('wipfelkratzer-v1', {SAVE!r})")
              page.goto(URL, wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined",
                                     timeout=30000)
              res = page.evaluate(CHECK)
              b.close()
          print(json.dumps(res, indent=2))
          assert res["hatMelder"], "meldeBlockade fehlt im Debug-Hook"
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-17-mausinteraktionen/t1_melden.py`
      muss mit `AssertionError: meldeBlockade fehlt im Debug-Hook` abbrechen.
      Rot gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: `meldeBlockade` einführen.** Direkt **vor** `applyMove`
      (`js/game.js:678`) einfügen:

      ```js
      /* Der Ablehnungspfad meldet sich nicht mehr selbst: wer die Geste kennt,
         entscheidet, ob und wie oft gemeldet wird. Ein gezogenes Objekt stösst
         pro Mausbewegung an und würde sonst 60× pro Sekunde klopfen (#64). */
      let blockGrund = null;
      function meldeBlockade() {
        sfx.knock();
        if (blockGrund) toast(blockGrund);
        blockGrund = null;
      }
      ```

- [ ] **Step 4: `applyMove` verstummen lassen** (`js/game.js:678-684`). Die
      Zeile `if (!ok) { Object.assign(en, snap); replaceMesh(pick); sfx.knock(); }`
      wird zu:

      ```js
        if (!ok) { Object.assign(en, snap); replaceMesh(pick); }
      ```

- [ ] **Step 5: `resolveItemMove` hinterlegt den Grund statt zu toasten**
      (`js/game.js:1338`). Die Zeile
      `toast(\`Hier ist kein Platz — ${TENANTS[pick.k].name} steht im Weg!\`);`
      wird zu:

      ```js
        blockGrund = `Hier ist kein Platz — ${TENANTS[pick.k].name} steht im Weg!`;
      ```

- [ ] **Step 6: Die drei bestehenden Aufrufer melden selbst.** Überall dort,
      wo heute `if (!applyMove(...)) return;` steht, wird daraus
      `if (!applyMove(...)) { meldeBlockade(); return; }`. Das sind genau fünf
      Stellen:

      - `#btn-move`, Tier-Zweig (`js/game.js:1708`)
      - `#btn-move`, Möbel-Zweig (`js/game.js:1714`)
      - `#btn-rot` (`js/game.js:1721`)
      - Tastatur, Pfeiltasten (`js/game.js:1748`)
      - Tastatur, Bild↑/↓ (`js/game.js:1756`)

      Beispiel für `#btn-rot`:

      ```js
      $('btn-rot').onclick = () => { if (!selected || WALL_ITEMS.has(selected.entry.id)) return;
        const en = selected.entry;
        if (!applyMove(selected, () => { en.rot += Math.PI / 2;
          selected.mesh.rotation.y = en.rot;
          clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
        if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, en); else save();
        selHelper.update(); sfx.pop(); };
      ```

- [ ] **Step 7: Debug-Hook ergänzen** (`js/game.js:2058-2069`). In die Zeile
      mit `ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove,`
      wird `meldeBlockade` aufgenommen:

      ```js
        ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade,
      ```

- [ ] **Step 8: Test grün.**
      `python3 .superpowers/sdd/2026-09-17-mausinteraktionen/t1_melden.py`
      druckt `T1 OK`.

- [ ] **Step 9: Tastaturverhalten ist unverändert.** Sonde
      `.superpowers/sdd/2026-09-17-mausinteraktionen/t1b_tastatur.py`: Wohnung
      betreten, zwei sperrige Möbel (`bett`) nebeneinander setzen, eines
      auswählen, mit `ArrowLeft` gegen das andere fahren und prüfen, dass
      `state.rooms['1']` unverändert bleibt und **genau ein** Eintrag in
      `#toast-stack .toast-item` steht, wenn ein Tier im Weg war. Der Zähler
      kommt aus
      `page.evaluate("document.querySelectorAll('#toast-stack .toast-item').length")`.
      Das Klopfgeräusch selbst ist headless nicht beobachtbar; der Toast ist
      der Stellvertreter dafür, und das gehört so in die PR-Beschreibung.

- [ ] **Step 10: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "refactor(einrichten): Blockade-Rückmeldung aus applyMove herausziehen"
      git push
      ```

---

### Task 2: Ziehen für Bodenobjekte

**Files:**
- Modify: `js/game.js` — neuer Abschnitt direkt nach `js/game.js:1700`
- Modify: `js/game.js:2058-2069` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-17-mausinteraktionen/t2_ziehen.py`

**Interfaces:**
- Produces: `ziehtGerade() → boolean` im Debug-Hook — `true`, solange ein Zug
  läuft.
- Consumes: `meldeBlockade()` aus Task 1.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-17-mausinteraktionen/t2_ziehen.py` — gleicher
      Rahmen wie T1 (Server, Init-Skript, `pageerror`-Sammler), dazu dieser
      Helfer und Ablauf:

      ```python
      SETUP = """
      () => {
        const w = window.wipfelkratzer;
        w.enterEdit(1);
        w.addItem('bett');
        const m = w.itemMeshes[1][0];
        w.select(m.userData.pick);
        return { x: m.userData.pick.entry.x, z: m.userData.pick.entry.z };
      }
      """

      SCREEN = """
      () => {
        const w = window.wipfelkratzer;
        const m = w.selected.mesh;
        const v = new w.THREE.Vector3();
        m.getWorldPosition(v).project(w.camera);
        return { x: (v.x + 1) / 2 * innerWidth, y: (-v.y + 1) / 2 * innerHeight };
      }
      """

      STATE = """
      () => {
        const w = window.wipfelkratzer;
        const en = w.selected.entry;
        return { x: en.x, z: en.z, rot: en.rot,
                 cam: w.camera.position.toArray(), zieht: w.ziehtGerade() };
      }
      """
      ```

      Danach: `SETUP` ausführen, `page.wait_for_timeout(1000)`, `SCREEN`
      lesen, den Zug fahren

      ```python
      page.mouse.move(pt["x"], pt["y"])
      page.mouse.down()
      for i in range(1, 9):
          page.mouse.move(pt["x"] + i * 12, pt["y"] + i * 6)
          page.wait_for_timeout(30)
      page.mouse.up()
      page.wait_for_timeout(500)
      ```

      und prüfen:

      ```python
      assert vorher["cam"] == nachher["cam"], ("Kamera hat sich bewegt", vorher["cam"], nachher["cam"])
      assert (vorher["x"], vorher["z"]) != (nachher["x"], nachher["z"]), "Objekt hat sich nicht bewegt"
      assert nachher["zieht"] is False, "Zug wurde nicht beendet"
      assert errs == [], errs
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Der Lauf bricht mit
      `TypeError: w.ziehtGerade is not a function` ab (oder, sobald der Hook
      steht, mit `Objekt hat sich nicht bewegt`). Rot gesehen zu haben ist die
      Voraussetzung für Step 3.

- [ ] **Step 3: Zug-Abschnitt einfügen.** Nach `js/game.js:1700`
      (`$('btn-catclose')…` bleibt darüber):

      ```js
      /* ---------- Objekt ziehen (#64) ---------- */
      /* Nur das bereits ausgewählte Objekt lässt sich ziehen, und nur wenn der
         Zug auf ihm beginnt — sonst bliebe in einer vollen Wohnung keine
         Fläche mehr übrig, um die Kamera zu drehen. Gilt für Maus und Finger. */
      let ziehen = null;
      const zugEbene = new THREE.Plane();
      const zugVersatz = new THREE.Vector3();
      const zugPunkt = new THREE.Vector3();

      function zeigerStrahl(e) {
        const r = renderer.domElement.getBoundingClientRect();
        ptr.set(((e.clientX - r.left) / r.width) * 2 - 1,
                -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ptr, camera);
      }

      /* Liegt der Zeiger auf dem ausgewählten Objekt? Liefert den Weltpunkt
         des Treffers oder null. */
      function trifftAuswahl(e) {
        if (!edit || !selected) return null;
        zeigerStrahl(e);
        const hits = ray.intersectObject(selected.mesh, true);
        return hits.length ? hits[0].point.clone() : null;
      }
      ```

      **Reihenfolge-Falle:** `OrbitControls` hängt seinen eigenen
      `pointerdown` schon an `renderer.domElement` (`js/game.js:153`), also
      **vor** diesem hier — es hat den Zug bereits begonnen, wenn
      `controls.enabled = false` gesetzt wird. Das ist in Ordnung und der
      Grund, warum `enabled` und nicht `stopPropagation()` das Mittel ist:
      `OrbitControls.onPointerMove` prüft `enabled` bei **jeder** Bewegung und
      steigt aus, die Kamera bewegt sich also keinen Pixel.
      `stopImmediatePropagation()` würde hier nichts nützen — der fremde
      Handler läuft wegen der früheren Registrierung ohnehin zuerst.

      ```js
      renderer.domElement.addEventListener('pointerdown', e => {
        const treffer = trifftAuswahl(e);
        if (!treffer) return;
        const en = selected.entry;
        if (WALL_ITEMS.has(en.id)) return;        /* Wandobjekte: Task 3 */
        zugEbene.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), treffer);
        selected.mesh.getWorldPosition(zugPunkt);
        zugVersatz.copy(treffer).sub(zugPunkt);
        ziehen = { id: e.pointerId, blockiert: false };
        controls.enabled = false;
        renderer.domElement.setPointerCapture(e.pointerId);
      });

      renderer.domElement.addEventListener('pointermove', e => {
        if (!ziehen || e.pointerId !== ziehen.id || !selected) return;
        zeigerStrahl(e);
        if (!ray.ray.intersectPlane(zugEbene, zugPunkt)) return;
        zugPunkt.sub(zugVersatz);
        /* en.x/en.z sind lokal zur Elterngruppe — gartenG trägt GARDEN_POS,
           die Stockwerksgruppen ihre Höhe. */
        const lokal = parentOf(selected.k).worldToLocal(zugPunkt.clone());
        const en = selected.entry;
        const frei = applyMove(selected, () => { en.x = lokal.x; en.z = lokal.z;
          clampEntry(selected.k, selected.mesh, en); });
        if (!frei) { if (!ziehen.blockiert) { ziehen.blockiert = true; meldeBlockade(); } return; }
        ziehen.blockiert = false;
        if (selected.tenant) { setTenantPos(selected.tenant.floor, selected.tenant.idx, en); }
        else { en.y = DECO.has(en.id) ? surfaceYAt(selected.k, en.x, en.z, selected.mesh) : baseY(selected.k);
               selected.mesh.position.y = en.y; }
        selHelper.update();
      });

      function zugEnde(e) {
        if (!ziehen || (e && e.pointerId !== ziehen.id)) return;
        if (e) { try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {} }
        ziehen = null;
        controls.enabled = true;
        save();
      }
      renderer.domElement.addEventListener('pointerup', zugEnde);
      renderer.domElement.addEventListener('pointercancel', zugEnde);
      ```

- [ ] **Step 4: Debug-Hook ergänzen** (`js/game.js:2058-2069`):

      ```js
        ziehtGerade: () => !!ziehen, zugBlockiert: () => !!(ziehen && ziehen.blockiert),
      ```

- [ ] **Step 5: Test grün.**
      `python3 .superpowers/sdd/2026-09-17-mausinteraktionen/t2_ziehen.py`
      druckt `T2 OK`.

- [ ] **Step 6: Gegenprobe — ein Zug daneben dreht die Kamera.** In derselben
      Sonde ergänzen: Objekt mit `w.deselect()` abwählen, denselben Zug noch
      einmal fahren, und prüfen

      ```python
      assert vorher["cam"] != nachher["cam"], "Kamera hat sich nicht gedreht"
      assert (vorher["x"], vorher["z"]) == (nachher["x"], nachher["z"]), "Objekt bewegte sich ohne Auswahl"
      ```

      Zweite Gegenprobe: `w.exitEdit()`, Zug auf dieselbe Stelle → Kamera
      dreht sich, kein Objekt bewegt sich.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(einrichten): ausgewähltes Objekt mit der Maus verschieben"
      git push
      ```

---

### Task 3: Ziehen für Wandobjekte und Tiere

**Files:**
- Modify: `js/game.js` — der Zug-Abschnitt aus Task 2
- Test: `.superpowers/sdd/2026-09-17-mausinteraktionen/t3_wand_tier.py`

**Interfaces:**
- Consumes: `ziehen`, `zugEbene`, `zugVersatz`, `trifftAuswahl` aus Task 2.
- Produces: keine neuen Namen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-17-mausinteraktionen/t3_wand_tier.py`, gleicher
      Rahmen. Zwei Fälle:

      ```python
      WAND_SETUP = """
      () => {
        const w = window.wipfelkratzer;
        w.enterEdit(1);
        w.addItem('poster_wald');
        const m = w.itemMeshes[1].at(-1);
        w.select(m.userData.pick);
        const en = m.userData.pick.entry;
        return { x: en.x, y: en.y, wall: en.wall, rot: en.rot };
      }
      """
      ```

      Zug waagrecht über 100 px; erwartet: `en.x` ändert sich, `en.wall` und
      `en.rot` bleiben gleich, und die Weltposition liegt weiterhin auf der
      Wandebene (`Math.abs(pos[pl.fixedAxis] - pl.fixed) < 0.01`, geprüft über
      `w.wallPlacement(1, en.wall)`).

      Für das Tier: Stockwerk mit eingezogenem Bewohner aufbauen (drei Möbel
      setzen, `w.tenantMeshes[1][0]` auswählen), ziehen, und prüfen, dass
      `state.tenantPos['1']` gesetzt ist und nach `page.reload()` erhalten
      bleibt.

- [ ] **Step 2: Test läuft rot.** Der Wandfall bricht mit unverändertem `en.x`
      ab — der `pointerdown`-Handler steigt bei `WALL_ITEMS` aus (Task 2,
      Step 3).

- [ ] **Step 3: Wandebene aufspannen.** Im `pointerdown`-Handler die Zeile
      `if (WALL_ITEMS.has(en.id)) return;` ersetzen durch:

      ```js
        if (WALL_ITEMS.has(en.id)) {
          /* Wandobjekte laufen nicht über eine Bodenebene: en.x läuft entlang
             der Wand, en.y ist die Höhe. Die Ebene ist die Wand selbst. */
          const pl = wallPlacement(selected.k, en.wall || 'back');
          const n = new THREE.Vector3();
          n[pl.fixedAxis] = 1;
          zugEbene.setFromNormalAndCoplanarPoint(n, treffer);
          ziehen = { id: e.pointerId, blockiert: false, wand: pl, wandStart: treffer.clone() };
          controls.enabled = false;
          renderer.domElement.setPointerCapture(e.pointerId);
          return;
        }
      ```


- [ ] **Step 4: Wandzug im `pointermove` behandeln.** Ganz am Anfang des
      Handlers, nach der `ziehen`-Prüfung:

      ```js
        if (ziehen.wand) {
          if (!ray.ray.intersectPlane(zugEbene, zugPunkt)) return;
          const pl = ziehen.wand;
          const en = selected.entry;
          /* Der freie Wandachsen-Anteil des Treffers, im lokalen System der
             Stockwerksgruppe — dieselbe Achse, die en.x führt. */
          const lokal = parentOf(selected.k).worldToLocal(zugPunkt.clone());
          const startLokal = parentOf(selected.k).worldToLocal(ziehen.wandStart.clone());
          moveWallItem(selected, lokal[pl.freeAxis] - startLokal[pl.freeAxis],
                                 lokal.y - startLokal.y);
          ziehen.wandStart = zugPunkt.clone();
          return;
        }
      ```

      `ziehen.wandStart` wird in Step 3 gesetzt und hier nach jedem Schritt
      nachgeführt, damit die Deltas relativ bleiben.

      `moveWallItem` ruft `clampEntry`, `selHelper.update()`, `sfx.pop()` und
      `save()` bereits selbst (`js/game.js:1732-1737`); der Zug braucht dort
      nichts weiter. Das `sfx.pop()` pro Bewegung ist bewusst in Kauf
      genommen — anders als `sfx.knock()` markiert es Erfolg, nicht Blockade,
      und die vier Wandknöpfe lösen es heute schon pro Klick aus.

- [ ] **Step 5: Test grün.**
      `python3 .superpowers/sdd/2026-09-17-mausinteraktionen/t3_wand_tier.py`
      druckt `T3 OK`.

- [ ] **Step 6: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(einrichten): Wandobjekte und Tiere lassen sich ebenfalls ziehen"
      git push
      ```

---

### Task 4: Mausrad dreht das ausgewählte Objekt

**Files:**
- Modify: `js/game.js` — hinter dem Zug-Abschnitt
- Test: `.superpowers/sdd/2026-09-17-mausinteraktionen/t4_rad.py`

**Interfaces:**
- Consumes: `trifftAuswahl`, `meldeBlockade`.
- Produces: keine neuen Namen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-17-mausinteraktionen/t4_rad.py`: Möbel setzen
      und auswählen, Bildschirmpunkt bestimmen, dann

      ```python
      page.mouse.move(pt["x"], pt["y"])
      page.mouse.wheel(0, 120)
      page.wait_for_timeout(400)
      ```

      und prüfen:

      ```python
      assert abs(nachher["rot"] - vorher["rot"] - math.pi / 12) < 1e-6, (vorher["rot"], nachher["rot"])
      assert vorher["camDist"] == nachher["camDist"], "Kamera hat gezoomt"
      ```

      `camDist` kommt aus
      `w.camera.position.distanceTo(w.controls.target)`.

      Gegenprobe im selben Skript: Zeiger auf eine leere Ecke
      (`pt["x"] + 300`), Rad drehen → `camDist` ändert sich, `rot` nicht.

- [ ] **Step 2: Test läuft rot.** `rot` bleibt unverändert und `camDist`
      ändert sich — heute zoomt das Rad immer.

- [ ] **Step 3: `wheel`-Handler einfügen**, direkt hinter `zugEnde`:

      ```js
      /* Das Rad dreht nur über dem ausgewählten Objekt — dieselbe Bedingung
         wie beim Ziehen. Überall sonst zoomt OrbitControls unverändert, und
         genau dann darf preventDefault nicht laufen (#64). */
      renderer.domElement.addEventListener('wheel', e => {
        if (!trifftAuswahl(e)) return;
        const en = selected.entry;
        if (WALL_ITEMS.has(en.id)) return;   /* Wandrotation gehört der Wand */
        e.preventDefault();
        /* Math.sign statt deltaY: Mäuse, Trackpads und deltaMode 0/1/2 liefern
           völlig verschiedene Beträge — eine Kerbe soll eine Rasterung sein. */
        if (!applyMove(selected, () => { en.rot += Math.sign(e.deltaY) * Math.PI / 12;
          selected.mesh.rotation.y = en.rot;
          clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
        if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, en); else save();
        selHelper.update();
      }, { passive: false });
      ```

- [ ] **Step 4: Test grün.**
      `python3 .superpowers/sdd/2026-09-17-mausinteraktionen/t4_rad.py`
      druckt `T4 OK`.

- [ ] **Step 5: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(einrichten): Mausrad dreht das ausgewählte Objekt"
      git push
      ```

---

### Task 5: Kollisionsflanke, Abnahme und Changelog

**Files:**
- Modify: `CHANGELOG.md` (`## [Unreleased]` → `### Added`)
- Test: `.superpowers/sdd/2026-09-17-mausinteraktionen/t5_abnahme.py`

**Interfaces:**
- Consumes: alles aus Task 1–4.

- [ ] **Step 1: Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-17-mausinteraktionen/t5_abnahme.py` prüft die
      Akzeptanzkriterien der Spec am Stück:

      1. **Hängenbleiben:** zwei `bett` nebeneinander, eines auswählen, in
         zwölf Schritten in das andere ziehen. Erwartet: `en.x`/`en.z` stehen
         am Hindernis (die Differenz zum Startpunkt ist kleiner als der volle
         Zugweg), und **genau ein** Toast steht in `#toast-stack .toast-item`,
         wenn die Blockade durch ein Tier entstand — nie mehr als einer.
      2. **Entlanggleiten:** aus der blockierten Lage seitlich weiterziehen;
         `en.z` ändert sich, obwohl `en.x` blockiert bleibt.
      3. **Zug reisst nicht ab:** ein Zug, dessen Zeiger über den Rand des
         Objekts hinausläuft, bewegt es weiter (`ziehtGerade()` bleibt `true`
         bis `mouse.up()`).
      4. **Spielstand:** nach `mouse.up()` und `page.wait_for_timeout(600)`
         enthält `localStorage['wipfelkratzer-v1']` die neue Position; nach
         `page.reload()` steht das Objekt dort.
      5. **Konsole:** `errs == []` über den ganzen Lauf.

- [ ] **Step 2: Sonde laufen lassen und rote Punkte beheben.** Jeder
      Fehlschlag ist ein echter Mangel in Task 1–4, keine Sondenschwäche —
      erst die Implementierung anpassen, dann erneut laufen lassen. Bei drei
      erfolglosen Versuchen an derselben Stelle: anhalten und den Befund in
      der PR-Beschreibung festhalten, statt weiter zu raten
      (`CLAUDE.md`, Testing-Regel 8).

- [ ] **Step 3: Changelog-Eintrag.** Unter `## [Unreleased]` → `### Added`
      (Abschnitt anlegen, falls er fehlt), deutscher Fliesstext aus
      Spielersicht:

      ```markdown
      - Möbel lassen sich jetzt einfach an ihren Platz ziehen: Erst antippen,
        dann mit Maus oder Finger verschieben — und mit dem Mausrad drehen,
        solange der Zeiger darauf liegt. Stösst ein Möbel an ein anderes,
        bleibt es stehen und rutscht daran entlang, statt hindurchzugehen.
        Pfeiltasten und Knöpfe funktionieren unverändert weiter, und überall
        sonst dreht ein Zug wie bisher die Kamera (#64)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Mausinteraktionen (#64)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Vor/Nach-Ausgabe **jeder**
      Sonde einfügen, dazu `git diff --name-only` gegen `main`, und den
      **manuellen In-Browser-Playtest als offenen Posten** benennen — er ist
      das eigentliche Gate dieses Stacks und darf nicht als erledigt behauptet
      werden. Ebenfalls dort vermerken: das Klopfgeräusch ist headless nicht
      prüfbar, der Toast-Zähler ist sein Stellvertreter.
