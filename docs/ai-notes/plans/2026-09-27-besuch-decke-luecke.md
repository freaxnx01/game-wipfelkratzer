# Plan — Die Lücke zwischen Wand und Decke schliessen (Issue #96)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wer im Besuchsmodus in eine Wohnung geht und nach oben schaut, sieht
eine Decke statt den Himmel — in jedem Stockwerk, auch im Erdgeschoss und im
obersten.

**Architecture:** Die Decke wird im Besuch nicht mehr ausgeblendet, die
Deckenplatte reicht bis an die Innenflächen der vier Wände, die Kamera rechnet
ihre Obergrenze gegen die Deckenunterkante statt gegen die Raumhöhe, und eine
einzige mitwandernde Punktlichtquelle ersetzt das Aussenlicht, das die
geschlossene Decke aussperrt. Alle vier Eingriffe liegen in `js/game.js`; es
kommt keine Datei dazu.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap. Kein Build, kein
Test-Runner, kein `package.json`.

**Spec:** `docs/ai-notes/specs/2026-09-27-besuch-decke-luecke-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), Anrede gross (`Du`, `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei**.
- **Nur `js/game.js` und `CHANGELOG.md` werden geändert.** `index.html`,
  `js/models.js`, `version.js` bleiben unangetastet.
- **Der Einrichten-Modus wird nicht angefasst.** Er blendet die Decke weiter
  aus (`js/game.js:1161`) und stellt sie beim Verlassen wieder her
  (`js/game.js:1176`).
- **Die Aussenstandorte bleiben Aussenstandorte.** Dachterrasse
  (`'roof'`), Spielplatz (`'garten'`) und Aussichtsplattform (`'aussicht'`)
  bekommen weder Decke noch Lampe.
- **Die Aussenansicht des Turms ändert sich nicht.** `state.cutaway` wird nie
  geschrieben, keine Platte eines anderen Stockwerks wird verbreitert.
- **Kein neues Feld im Spielstand.** Das Speicherformat bleibt gleich.
- **Höchstens ein zusätzliches Licht in der Szene, und zwar ohne
  Schattenwurf** (`castShadow = false`). Die Szene hat sonst genau zwei
  Lichter (`js/game.js:167-168`).
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Fixed`.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `fix(besuch)`.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-27-besuch-decke/`
(git-ignoriert, `.gitignore:5`). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9061–9065** (erster freier — andere Sitzungen laufen parallel). Nur
  der Server darf in den Hintergrund. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`,
  jeder `page.click` mit `timeout=20000`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Vor jeder Messung auf die Ankunft der Kamera warten**, nicht auf Stillstand
  (Stack-Overlay): `w.tweenCount() === 0` **und**
  `camera.position.distanceTo(eye) < 0.2`, mit `timeout=120000`. Der Besuch
  fährt die Kamera mit `moveCam(..., 0.9)` (`js/game.js:1243`), und ein
  headless Renderer zeichnet unter 1 fps.
- Frischer Spielstand je Lauf: vor `goto` `localStorage.clear()` über
  `context.add_init_script("try{localStorage.clear()}catch(e){}")`.
- Ein Turm mit mehreren Stockwerken entsteht am schnellsten über den
  Debug-Hook: `w.state.floors = 3; w.speichern();` und **danach neu laden** —
  die Etagengruppen entstehen beim Laden (`js/game.js:384`, `makeFloor`).

### Baustein: Sondenkopf (in jedem Testskript gleich)

```python
import json, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]

def freier_port():
    for p in range(9061, 9066):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    raise SystemExit("kein freier Port in 9061-9065")

def lauf(fn):
    port = freier_port()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)],
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
            ctx = b.new_context(viewport={"width": 1000, "height": 700})
            ctx.add_init_script("try{localStorage.clear()}catch(e){}")
            page = ctx.new_page()
            fehler = []
            page.on("pageerror", lambda e: fehler.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}/", wait_until="networkidle")
            page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)
            fn(page)
            assert not fehler, f"pageerror: {fehler}"
            b.close()
    finally:
        srv.terminate()
    print("OK")

ANGEKOMMEN = """() => {
  const w = window.wipfelkratzer;
  if (w.tweenCount() !== 0) return false;
  const k = w.besuch && w.besuch.k;
  if (k === undefined || k === null) return false;
  const { eye } = w.besuchCamFor(k);
  return w.camera.position.distanceTo(eye) < 0.2;
}"""
```

---

### Task 1: Die Decke bleibt beim Besuch stehen und reicht bis an die Wände

**Files:**
- Modify: `js/game.js:25` (Konstanten, neue Zeilen dahinter)
- Modify: `js/game.js:409` (Deckenplatte)
- Modify: `js/game.js:1260-1264` (`enterBesuch`)
- Modify: `js/game.js:1311` (`wechsleBesuch`)
- Modify: `js/game.js:2818-2822` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-27-besuch-decke/t1_decke.py` (wegwerf)

**Interfaces:**
- Produces: `const CEIL_T = 0.1, CEIL_DROP = 0.13`
- Produces: `deckeUnterY(k) → number` — Deckenunterkante in Etagenkoordinaten,
  `H(k) − 0.18`.
- Produces: im Debug-Hook zusätzlich `deckeUnterY` und
  `sichtFrei(k) → number` — Anzahl der fünf Proben, deren erstes getroffenes
  Objekt **nicht** die Decke dieses Raums ist. `0` heisst: oben dicht.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-27-besuch-decke/t1_decke.py` — Sondenkopf von
      oben, dann:

      ```python
      PRUEFE = """() => {
        const w = window.wipfelkratzer;
        const k = w.besuch.k;
        const g = w.floorGroups[k];
        return { sichtbar: g.userData.ceil.visible,
                 frei: w.sichtFrei(k),
                 halbB: g.userData.ceil.geometry.parameters.width / 2,
                 halbT: g.userData.ceil.geometry.parameters.depth / 2,
                 innenB: w.WALL_MASSE.w(k) / 2 - w.WALL_MASSE.t,
                 innenT: w.WALL_MASSE.d(k) / 2 - w.WALL_MASSE.t };
      }"""

      def pruefe_etage(page, k):
          page.evaluate(f"() => {{ const w = window.wipfelkratzer; if (w.besuch) w.exitBesuch(); w.enterBesuch({k}); }}")
          page.wait_for_function(ANGEKOMMEN, timeout=120000)
          r = page.evaluate(PRUEFE)
          assert r["sichtbar"] is True, f"Etage {k}: Decke unsichtbar"
          assert r["frei"] == 0, f"Etage {k}: {r['frei']} von 5 Proben verlassen den Raum"
          assert abs(r["halbB"] - r["innenB"]) < 1e-9, f"Etage {k}: Deckenbreite {r}"
          assert abs(r["halbT"] - r["innenT"]) < 1e-9, f"Etage {k}: Deckentiefe {r}"

      def fn(page):
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")
          page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)
          for k in (0, 2, 3):          # Erdgeschoss, Mitte, oberstes
              pruefe_etage(page, k)

      lauf(fn)
      ```

      `WALL_MASSE` ist der Sammelname, unter dem der Hook `W`, `D` und
      `WALL_T` herausgibt (Step 3).

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t1_decke.py`
      Expected: FAIL — `w.sichtFrei is not a function` (der Hook fehlt noch).

- [ ] **Step 3: Konstanten und Deckenunterkante einführen.**

      In `js/game.js` direkt hinter Zeile 25
      (`const WALL_T = 0.12, WALL_CORE = 0.09, WALL_PANEL = 0.02;`):

      ```js
      /* Die Decke ist eine Platte der Dicke CEIL_T, deren Mitte CEIL_DROP
         unter der Rohdecke hängt. Ihre Unterkante ist die Grenze, gegen die
         der Besuch seine Kamera rechnet — vorher war es die Raumhöhe, und die
         liegt 3 cm zu hoch (#96). */
      const CEIL_T = 0.1, CEIL_DROP = 0.13;
      const deckeUnterY = k => H(k) - CEIL_DROP - CEIL_T / 2;
      ```

- [ ] **Step 4: Deckenplatte bis an die Wände ziehen.**

      `js/game.js:409` ersetzen:

      ```js
      /* Bis an die Innenflächen der vier Wände (±(Mass/2 − WALL_T)) — die
         frühere Platte (w − 0.3) liess rundum einen 3 cm breiten Schlitz
         offen, durch den man beim Besuch nach draussen sah (#96). Nicht
         weiter: bei w − 0.18 schnitte sie durch die Innenpanele, die die
         Tapete tragen. */
      g.userData.ceil = mesh(new THREE.BoxGeometry(w - 2 * WALL_T, CEIL_T, d - 2 * WALL_T), MAT.plasterIn, 0, h - CEIL_DROP, 0, g); g.userData.ceil.castShadow = false;
      ```

- [ ] **Step 5: Das Ausblenden im Besuch entfernen.**

      In `enterBesuch` den Block `js/game.js:1260-1264` (Kommentar *und*
      `if`-Zeile) ersetzen durch:

      ```js
      /* Die Decke bleibt beim Besuch stehen. Ohne sie schaut man aus dem
         Zimmer in den Himmel: der Turm verjüngt sich nach oben, die
         Bodenplatte des Stockwerks darüber deckt den Raum also nicht, und
         über dem obersten Stockwerk liegt nur die schmalere Dachterrasse
         (#96). */
      ```

      In `wechsleBesuch` die Zeile `js/game.js:1311` ersatzlos streichen:

      ```js
      if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
      ```

      Die Wiederherstellungsschleife in `exitBesuch` (`js/game.js:1278`)
      **bleibt** — sie ist für den Besuch jetzt wirkungslos, deckt aber
      weiterhin den Fall ab, dass ein Besuch endet, während etwas anderes eine
      Decke versteckt hat.

- [ ] **Step 6: Debug-Hook erweitern.**

      Im Objektliteral `window.wipfelkratzer` (`js/game.js:2818-2822`)
      ergänzen:

      ```js
      deckeUnterY, WALL_MASSE: { w: W, d: D, t: WALL_T },
      /* Strahlenprobe für die Playwright-Checks (#96): vom Augpunkt des
         Besuchs gerade nach oben und in die vier oberen Raumecken. Gezählt
         wird jede Probe, deren erstes Objekt nicht die Decke dieses Raums
         ist — 0 heisst, der Raum ist oben dicht. Möbel im Weg verfälschen
         das Ergebnis; die Probe gehört in einen leeren Raum. */
      sichtFrei(k) {
        if (typeof k !== 'number' || !floorGroups[k]) return 0;
        const g = floorGroups[k], decke = g.userData.ceil;
        const { eye } = besuchCamFor(k);
        const ziele = [eye.clone().add(new THREE.Vector3(0, 1, 0))];
        const ex = W(k) / 2 - WALL_T - 0.03, ez = D(k) / 2 - WALL_T - 0.03;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
          ziele.push(g.localToWorld(new THREE.Vector3(sx * ex, deckeUnterY(k), sz * ez))));
        let frei = 0;
        for (const ziel of ziele) {
          ray.set(eye, ziel.clone().sub(eye).normalize());
          const treffer = ray.intersectObjects(scene.children, true)
            .filter(h => h.object.material && h.object.material.visible !== false && h.distance > 0.01);
          if (!treffer.length || treffer[0].object !== decke) frei++;
        }
        return frei;
      },
      ```

      `ray` ist der bestehende Raycaster (`js/game.js:2027`), derselbe, den
      `pickAt` benutzt. Der Materialfilter hält die unsichtbaren Trefferboxen
      heraus (`js/game.js:434`, `MeshBasicMaterial({ visible: false })`).

- [ ] **Step 7: Test laufen lassen, Erfolg bestätigen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t1_decke.py`
      Expected: `OK` — für Etage 0, 2 und 3 je `sichtbar`, `frei == 0` und
      passende Deckenmasse, keine `pageerror`.

- [ ] **Step 8: Committen.**

      ```bash
      git add js/game.js
      git commit -m "fix(besuch): Decke bleibt beim Hineingehen stehen und schliesst an die Wände an

      Refs #96"
      ```

---

### Task 2: Die Kamera bleibt unter der Decke

**Files:**
- Modify: `js/game.js:1233` (`besuchPolar`, `nachOben`)
- Test: `.superpowers/sdd/2026-09-27-besuch-decke/t2_kamera.py` (wegwerf)

**Interfaces:**
- Consumes: `deckeUnterY(k)` aus Task 1.
- Produces: nichts Neues; `besuchPolar` behält Signatur und Rückgabeform
  `{ minP, maxP }`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-27-besuch-decke/t2_kamera.py` — Sondenkopf von
      oben, dann:

      ```python
      HOECHSTE = """(k) => {
        const w = window.wipfelkratzer;
        const { eye, tgt } = w.besuchCamFor(k);
        const bahn = eye.distanceTo(tgt);
        /* minPolarAngle ist die Grenze nach oben: Polarwinkel 0 liegt senkrecht
           über dem Blickziel. */
        const hoechste = tgt.y + bahn * Math.cos(w.controls.minPolarAngle);
        return { hoechste, decke: w.floorYOf(k) + w.deckeUnterY(k) };
      }"""

      def fn(page):
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")
          page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)
          for k in (0, 2, 3):
              page.evaluate(f"() => {{ const w = window.wipfelkratzer; if (w.besuch) w.exitBesuch(); w.enterBesuch({k}); }}")
              page.wait_for_function(ANGEKOMMEN, timeout=120000)
              r = page.evaluate(HOECHSTE, k)
              assert r["hoechste"] <= r["decke"] + 1e-6, f"Etage {k}: Kamera bis {r['hoechste']}, Decke bei {r['decke']}"

      lauf(fn)
      ```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t2_kamera.py`
      Expected: FAIL — die höchste erreichbare Kameraposition liegt 0.03 über
      der Deckenunterkante (`H − 0.15` statt `H − 0.18`).

- [ ] **Step 3: `besuchPolar` gegen die Deckenunterkante rechnen.**

      `js/game.js:1233` ersetzen:

      ```js
      const nachOben = Math.max(0, deckeUnterY(k) - AUGE - BESUCH_LUFT);
      ```

      `BESUCH_LUFT`, `nachUnten` und `BESUCH_POLAR_FREI` bleiben unverändert.
      Den Kommentarblock darüber (`js/game.js:1224-1230`) um einen Satz
      ergänzen:

      ```js
         Gerechnet wird gegen die Deckenunterkante, nicht gegen die Raumhöhe —
         seit die Decke im Besuch steht, führe die Raumhöhe die Kamera 3 cm zu
         weit hinauf, mitten durch die Platte (#96).
      ```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t2_kamera.py`
      Expected: `OK`, keine `pageerror`.

- [ ] **Step 5: Committen.**

      ```bash
      git add js/game.js
      git commit -m "fix(besuch): Kamera bleibt beim Hochschauen unter der Decke

      Refs #96"
      ```

---

### Task 3: Eine Raumlampe ersetzt das Licht, das die Decke aussperrt

**Files:**
- Modify: `js/game.js:1236` (neuer Abschnitt hinter `besuchPolar`)
- Modify: `js/game.js:1265` (`enterBesuch`), `js/game.js:1276` (`exitBesuch`),
  `js/game.js:1311` (`wechsleBesuch`) — je ein Aufruf
- Modify: Debug-Hook (`js/game.js:2818-2822`)
- Test: `.superpowers/sdd/2026-09-27-besuch-decke/t3_lampe.py` (wegwerf)

**Interfaces:**
- Consumes: `H(k)`, `floorGroups` — beide bestehen.
- Produces: `const besuchLampe` — ein `THREE.PointLight`.
- Produces: `setzeBesuchLampe(k) → void` — hängt die Lampe an
  `floorGroups[k]`, wenn `k` eine Zahl ist, und entfernt sie sonst
  (`'roof'`, `'garten'`, `'aussicht'`, `null`).
- Produces: im Debug-Hook zusätzlich `besuchLampe`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-27-besuch-decke/t3_lampe.py` — Sondenkopf von
      oben, dann:

      ```python
      WO = """() => {
        const w = window.wipfelkratzer;
        const p = w.besuchLampe.parent;
        const k = w.floorGroups.findIndex(g => g === p);
        return { haengt: !!p, etage: k, schatten: w.besuchLampe.castShadow };
      }"""

      HELLIGKEIT = """async () => {
        const url = window.wipfelkratzer.standBild();
        const img = new Image(); img.src = url; await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < px.length; i += 4) s += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        return s / (px.length / 4);
      }"""

      # Aus Step 2, auf origin/main gemessen:
      BASIS = 0.0   # <- Zahl aus Step 2 eintragen, sonst ist Prüfung 5 wertlos

      def besuche(page, k):
          page.evaluate("(k) => { const w = window.wipfelkratzer; if (w.besuch) w.exitBesuch(); w.enterBesuch(k); }", k)
          page.wait_for_function(ANGEKOMMEN, timeout=120000)

      def fn(page):
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")
          page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)

          # 1. Im Stockwerk hängt die Lampe an genau dieser Etage, ohne Schatten.
          besuche(page, 0)
          r = page.evaluate(WO)
          assert r["haengt"] and r["etage"] == 0 and r["schatten"] is False, r
          hell = page.evaluate(HELLIGKEIT)

          # 2. Der Etagenwechsel nimmt sie mit — über den echten Knopf.
          page.click("#btn-besuch-hoch", timeout=20000)
          page.wait_for_function(ANGEKOMMEN, timeout=120000)
          assert page.evaluate(WO)["etage"] == 1, page.evaluate(WO)

          # 3. Draussen hängt sie nirgends.
          page.click("#btn-besuch-dach", timeout=20000)
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert page.evaluate(WO)["haengt"] is False

          # 4. Nach «Schluss» hängt sie nirgends.
          page.click("#btn-besuch-zu", timeout=20000)
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert page.evaluate(WO)["haengt"] is False

          # 5. Der Raum ist nicht dunkler als vor der Änderung.
          #    BASIS wird in Step 2 auf main gemessen und hier eingetragen.
          assert hell >= 0.75 * BASIS, f"Raum zu dunkel: {hell} gegen Basis {BASIS}"

      lauf(fn)
      ```

- [ ] **Step 2: Basis-Helligkeit auf `main` messen und eintragen.**

      Den Messlauf in einem **eigenen Worktree von `origin/main`** machen —
      nie mit `git stash`, der Stapel ist zwischen den Worktrees geteilt:

      ```bash
      git worktree add .worktrees/wk96-basis origin/main
      # dort t3_lampe.py nur bis zur ersten Messung laufen lassen
      git worktree remove .worktrees/wk96-basis
      ```

      Dort `enterBesuch(0)` und nur `HELLIGKEIT` auswerten. Den Zahlenwert als
      `BASIS = <wert>` oben in `t3_lampe.py` eintragen. Ohne diese Zahl ist
      Prüfung 5 nicht auswertbar.

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t3_lampe.py`
      Expected: FAIL — `Cannot read properties of undefined (reading 'parent')`
      (`besuchLampe` gibt es noch nicht).

- [ ] **Step 4: Lampe und Setzfunktion anlegen.**

      In `js/game.js` hinter `besuchPolar` (also vor `stelleBesuchKamera`,
      `js/game.js:1236`):

      ```js
      /* Mit geschlossener Decke fällt kein Aussenlicht mehr von oben in den
         Raum (#96). Eine einzige Lampe wandert mit dem Besuch mit statt einer
         pro Etage, und Schatten wirft sie keine: die Szene hat sonst genau
         zwei Lichter (js/game.js:167-168), ein drittes mit Schattenkarte wäre
         der teuerste Teil dieser Änderung. */
      const besuchLampe = new THREE.PointLight(0xfff1d6, 6, 9, 2);
      besuchLampe.castShadow = false;
      /* Ein einziger Ort entscheidet, wo die Lampe hängt — zwei Stellen, die
         unabhängig an- und abhängen, liefen auseinander. */
      function setzeBesuchLampe(k) {
        if (besuchLampe.parent) besuchLampe.parent.remove(besuchLampe);
        if (typeof k !== 'number' || !floorGroups[k]) return;
        besuchLampe.position.set(0, H(k) - 0.5, 0);
        floorGroups[k].add(besuchLampe);
      }
      ```

- [ ] **Step 5: Die drei Aufrufe setzen.**

      - In `enterBesuch`, unmittelbar vor `applyFronts();`
        (`js/game.js:1265`): `setzeBesuchLampe(k);`
      - In `exitBesuch`, unmittelbar nach `besuch = null; besuchSave = null;`
        (`js/game.js:1275`): `setzeBesuchLampe(null);`
      - In `wechsleBesuch`, an die Stelle der in Task 1 gestrichenen Zeile
        (`js/game.js:1311`): `setzeBesuchLampe(k);`

- [ ] **Step 6: Debug-Hook erweitern.**

      Im Objektliteral `window.wipfelkratzer` neben `deckeUnterY` aus Task 1:

      ```js
      besuchLampe,
      ```

- [ ] **Step 7: Test laufen lassen, Erfolg bestätigen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t3_lampe.py`
      Expected: `OK`, keine `pageerror`.

      Scheitert nur Prüfung 5 (zu dunkel oder grell überstrahlt), die
      Intensität im Bereich **3 bis 14** nachziehen und erneut laufen lassen —
      Farbe, Reichweite (9) und `decay` (2) bleiben, wie sie sind. Nach drei
      erfolglosen Anläufen anhalten und den Befund melden, statt weiter zu
      drehen.

- [ ] **Step 8: Committen.**

      ```bash
      git add js/game.js
      git commit -m "fix(besuch): Raumlampe ersetzt das Licht der offenen Decke

      Refs #96"
      ```

---

### Task 4: Nichts anderes hat sich geändert — Regression und Changelog

**Files:**
- Modify: `CHANGELOG.md` (Abschnitt `## [Unreleased]`)
- Test: `.superpowers/sdd/2026-09-27-besuch-decke/t4_regression.py` (wegwerf)

**Interfaces:**
- Consumes: alles aus Task 1-3. Kein neuer Produktcode.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-27-besuch-decke/t4_regression.py` —
      Sondenkopf von oben, dann:

      ```python
      DECKEN = """() => window.wipfelkratzer.floorGroups
        .map(g => g && g.userData.ceil.visible).filter(v => v === true || v === false)"""

      def fn(page):
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 2; w.speichern(); }")
          page.reload(wait_until="networkidle")
          page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)

          vorher = page.evaluate("() => window.wipfelkratzer.state.cutaway")

          # Einrichten blendet die Decke weiterhin aus und stellt sie wieder her.
          page.evaluate("() => window.wipfelkratzer.enterEdit(1)")
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert page.evaluate("() => window.wipfelkratzer.floorGroups[1].userData.ceil.visible") is False
          page.evaluate("() => window.wipfelkratzer.exitEdit()")
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert all(page.evaluate(DECKEN)), "nach exitEdit fehlt eine Decke"

          # Besuch und zurück lassen die Aussenansicht, wie sie war.
          page.evaluate("() => window.wipfelkratzer.enterBesuch(0)")
          page.wait_for_function(ANGEKOMMEN, timeout=120000)
          page.evaluate("() => window.wipfelkratzer.exitBesuch()")
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert all(page.evaluate(DECKEN)), "nach exitBesuch fehlt eine Decke"
          assert page.evaluate("() => window.wipfelkratzer.state.cutaway") == vorher

          # Besuch auf dem Spielplatz und auf der Aussichtsplattform stürzt nicht ab.
          page.evaluate("() => { const w = window.wipfelkratzer; w.enterBesuch('roof'); }")
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          page.evaluate("() => window.wipfelkratzer.exitBesuch()")
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)

      lauf(fn)
      ```

- [ ] **Step 2: Test laufen lassen.**

      Run: `python3 .superpowers/sdd/2026-09-27-besuch-decke/t4_regression.py`
      Expected: `OK`. Schlägt er fehl, ist eine der Änderungen aus Task 1-3 zu
      weit gegangen — dort beheben, nicht hier nachbessern.

- [ ] **Step 3: Changelog-Eintrag schreiben.**

      In `CHANGELOG.md` unter `## [Unreleased]` einen Abschnitt `### Fixed`
      anlegen (falls noch keiner da ist) und eintragen — in der Stimme des
      Kindes, das spielt, nicht in der des Repos:

      ```markdown
      ### Fixed

      - Beim Hineingehen hat Dein Zimmer jetzt eine richtige Decke. Vorher
        klaffte oben zwischen Wand und Decke eine Lücke, durch die man in den
        Himmel schaute — besonders im Erdgeschoss. Damit es drinnen trotzdem
        hell bleibt, brennt während des Besuchs eine Lampe im Raum (#96)
      ```

- [ ] **Step 4: Committen.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Lücke zwischen Wand und Decke (#96)

      Closes #96"
      ```

- [ ] **Step 5: Aufräumen.**

      `.superpowers/` ist git-ignoriert und bleibt liegen; nichts davon darf im
      Diff auftauchen. Prüfen: `git status --porcelain` zeigt nur die beiden
      geänderten Dateien `js/game.js` und `CHANGELOG.md`.

---

## Verifikation zum Schluss

Alle vier Skripte noch einmal nacheinander im **Vordergrund**:

```bash
for t in t1_decke t2_kamera t3_lampe t4_regression; do
  python3 .superpowers/sdd/2026-09-27-besuch-decke/$t.py || break
done
```

Erwartet: viermal `OK`, kein `pageerror`. Danach den Server-Port freigeben
(siehe Harness).
