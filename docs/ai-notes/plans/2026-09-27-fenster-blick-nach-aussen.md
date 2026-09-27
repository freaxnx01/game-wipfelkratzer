# Plan — Fenster geben im Besuch den Blick nach aussen frei (Issue #102)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wer im Besuchsmodus in einer Wohnung steht, sieht dort, wo von aussen
ein Fenster sitzt, eine echte Öffnung in der Vorderwand und blickt durch sie in
den Wald hinaus.

**Architecture:** Drei Eingriffe in `js/game.js`. (1) `makeFloor` merkt sich
den bisher anonymen Vorderwand-Kern, damit man ihn später greifen kann.
(2) Eine neue Funktion baut beim ersten Besuch eines Stockwerks zu Kern und
Innenpanel je eine zweite Geometrie mit Bogenlöchern an den Fensterstellen und
merkt sie an der Etagengruppe. (3) `enterBesuch`/`wechsleBesuch`/`exitBesuch`
tauschen die Geometrie und blenden die Bogenscheiben der Fassade aus bzw.
wieder ein. Kein neuer Knopf, kein Zustand im Spielstand.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap, `OrbitControls`.
Kein Build, kein Bundler, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-fenster-blick-nach-aussen-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), Anredefürwörter gross (`Du`,
  `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei**.
- **Der Besuch verändert den Spielstand nicht.** Kein `save()`, kein Schreiben
  an `state` — `localStorage` ist vor und nach dem Besuch byte-gleich (Zusage
  aus #44, `js/game.js:1112-1114`).
- **Draussen ändert sich nichts.** Ausserhalb des Besuchs stehen dieselbe
  massive Wand und dieselben sichtbaren Bogenscheiben wie heute (Spec, E3).
- **Nur die Fassadenfenster der Vorderwand** (`g.userData.wins`,
  `js/game.js:413-420`). Das Katalogmöbel `fenster` wird nicht angefasst
  (Spec, E1), Tür und Torbogen bleiben zu (Spec, E7).
- **Keine neue Bedienung**, kein Eintrag in `js/standdatei.js`, kein neues Feld
  in `state` (Spec, E8).
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(turm)` für den Code, `docs(changelog)`
  für den Changelog.

## Was dieser Plan nicht baut

Kein durchsichtiges Katalogmöbel «Fenster», keine Glasscheibe und kein
Fensterrahmen, kein Öffnen von Hand, keine Öffnungen in Rück- und
Seitenwänden, keine Lösung für die Lücke zwischen Wand und Decke (#96), kein
Wegnehmen der Vorderwand von innen (das ist #95). Wer davon etwas anfängt, hat
den Zuschnitt verlassen.

## Berührung mit #95

#95 («Wände weg» soll auch von innen wirken) ändert `applyFronts` und die
Besuchsfunktionen in derselben Datei. Beide Änderungen vertragen sich
inhaltlich (dort verschwindet die Wand, hier bekommt sie Löcher), aber wer als
Zweiter merged, führt `enterBesuch`/`exitBesuch` von Hand zusammen. Nichts aus
diesem Plan setzt #95 voraus.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9081–9085** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr.**
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Einen Turm aufbauen** geht über den Debug-Hook (`window.wipfelkratzer`,
  `js/game.js:2810`): `w.state.floors = 3; w.speichern();` und danach
  `page.reload()`, damit die Etagen wirklich entstehen.
- **Dieser Plan prüft Geometrie und Sichtbarkeit, keine Kamerapositionen.**
  Der Geometrietausch läuft synchron in `enterBesuch`; nach dem Aufruf genügt
  `page.wait_for_timeout(300)`. Wer trotzdem eine Kamera misst, wartet auf
  Ankunft (`w.tweenCount() === 0`), nicht auf Stillstand.
- **Vor jeder Strahlprobe `w.scene.updateMatrixWorld(true)` rufen** — sonst
  stehen die Weltmatrizen der frisch getauschten Meshes noch auf dem Stand des
  letzten gezeichneten Bildes.
- Der Besuch lässt sich über den Hook fahren (`w.enterBesuch(1)`,
  `w.wechsleBesuch(2)`, `w.exitBesuch()`); die Abnahmeprüfung in Task 3 klickt
  zusätzlich die echten Knöpfe `#btn-besuch` und `#btn-besuch-zu`.

---

### Task 1: Gelochte Vorderwand bauen

**Files:**
- Modify: `js/game.js:410-412` (`makeFloor`, Vorderwand-Kern merken)
- Modify: `js/game.js:275-278` (direkt danach die neuen Helfer einfügen)
- Modify: `js/game.js:2810-2840` (Debug-Hook erweitern)
- Test: `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t1_geometrie.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Produces: `g.userData.frontKern` — das `THREE.Mesh` des Vorderwand-Kerns
  (bisher anonym, `js/game.js:411`). Das Innenpanel ist schon über
  `g.userData.wallPanels.front` greifbar (`js/game.js:387-389, 412`).
- Produces: `fensterSchichten(i)` → `{ kern, panel, wins, geo }` oder `null`.
  `kern`/`panel` sind die beiden `THREE.Mesh`, `wins` ist
  `g.userData.wins`, `geo` ist
  `{ kernZu, kernOffen, panelZu, panelOffen }` mit vier
  `THREE.BufferGeometry`. Reine Abfrage mit einem Nebeneffekt beim ersten
  Aufruf: die gelochten Geometrien werden gebaut und an
  `g.userData.fensterGeo` gemerkt.
- Produces: `holedWallGeo(w, h, t, xs, y0)` → `THREE.ExtrudeGeometry`, Nullpunkt
  in der Mitte wie bei `THREE.BoxGeometry`, UV auf `0…1` normalisiert.
- Produces: `archPath(cx, cy, w, h)` → `THREE.Path` (Bogenkontur als Loch).

- [ ] **Step 1: Die rote Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t1_geometrie.py`:

      ```python
      from playwright.sync_api import sync_playwright

      PORT = 9081  # ersten freien Port aus 9081-9085 nehmen
      URL = f"http://127.0.0.1:{PORT}/"

      SCHICHTEN = """() => { const w = window.wipfelkratzer;
        const s = w.fensterSchichten(1);
        if (!s) return 'keine Schichten';
        if (!s.kern || !s.panel) return 'Kern oder Panel fehlt';
        if (s.wins.length < 1) return 'keine Fenster';
        const g = s.geo;
        if (!g.kernOffen || !g.panelOffen) return 'gelochte Geometrie fehlt';
        if (g.kernZu !== s.kern.geometry) return 'massive Geometrie nicht gemerkt';
        /* Ein Loch braucht zusaetzliche Eckpunkte: die gelochte Scheibe hat
           mehr davon als der Quader, bei gleicher Aussenkontur (weiter unten
           ueber die Bounding-Box geprueft). */
        if (g.panelOffen.attributes.position.count <= g.panelZu.attributes.position.count)
          return 'gelochtes Panel hat nicht mehr Eckpunkte als der Quader';
        const uv = g.panelOffen.attributes.uv;
        let min = 9, max = -9;
        for (let i = 0; i < uv.count; i++) {
          min = Math.min(min, uv.getX(i), uv.getY(i));
          max = Math.max(max, uv.getX(i), uv.getY(i)); }
        if (min < -0.001 || max > 1.001) return 'UV nicht normalisiert: ' + min + '..' + max;
        /* Gleiche Lage wie der Quader: gleiche Bounding-Box in x und y. */
        g.panelOffen.computeBoundingBox(); g.panelZu.computeBoundingBox();
        const a = g.panelOffen.boundingBox, b = g.panelZu.boundingBox;
        if (Math.abs(a.min.y - b.min.y) > 0.001 || Math.abs(a.max.y - b.max.y) > 0.001)
          return 'gelochte Scheibe sitzt nicht auf derselben Höhe';
        if (Math.abs(a.min.x - b.min.x) > 0.001 || Math.abs(a.max.x - b.max.x) > 0.001)
          return 'gelochte Scheibe ist nicht gleich breit';
        return 'ok'; }"""

      with sync_playwright() as p:
          browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = browser.new_page()
          fehler = []
          page.on("pageerror", lambda e: fehler.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")
          ergebnis = page.evaluate(SCHICHTEN)
          print("Schichten:", ergebnis)
          assert ergebnis == "ok", ergebnis
          assert not fehler, fehler
          browser.close()
          print("T1 gruen")
      ```

- [ ] **Step 2: Sonde laufen lassen, sie muss rot sein.**

      ```bash
      python3 -m http.server 9081 >/dev/null 2>&1 &
      python3 .superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t1_geometrie.py
      ```

      Erwartet: Abbruch mit `TypeError: w.fensterSchichten is not a function`
      — die Funktion gibt es noch nicht.

- [ ] **Step 3: Den Vorderwand-Kern merken.**
      In `makeFloor`, `js/game.js:411`, aus dem anonymen Aufruf eine Zuweisung
      machen (die Zeile daneben, `panel('front', …)`, bleibt unverändert):

      ```js
      g.userData.frontKern = mesh(new THREE.BoxGeometry(w - 0.24, h, WALL_CORE), MAT.plaster, 0, h / 2, 0.06 - WALL_CORE / 2, front);
      ```

- [ ] **Step 4: Die Helfer einfügen.**
      Direkt unter `const matWin = …` (`js/game.js:278`):

      ```js
      /* ---------- Fensteröffnungen für den Besuch (#102) ----------
         Die Fassadenfenster sind flache Bogenscheiben VOR der Wand (siehe
         makeFloor); die Wand selbst hat kein Loch, drinnen steht man deshalb
         in einem fensterlosen Kasten. Für den Besuch bekommen Wandkern und
         Innenpanel je eine zweite Geometrie mit Bogenlöchern an genau den
         Stellen der Scheiben. Gebaut wird sie beim ersten Besuch eines
         Stockwerks und danach behalten — Etagen entstehen hier grundsätzlich
         erst, wenn sie gebraucht werden (#47). */
      const WIN_W = 0.5, WIN_H = 0.8;
      const winY = h => h * 0.24;            /* Unterkante, wie in makeFloor */

      /* Dieselbe Kontur wie makeArchGeo, aber als Loch-Pfad. */
      function archPath(cx, cy, w, h) {
        const r = w / 2, p = new THREE.Path();
        p.moveTo(cx - r, cy); p.lineTo(cx - r, cy + h - r);
        p.absarc(cx, cy + h - r, r, Math.PI, 0, true);
        p.lineTo(cx + r, cy); p.closePath();
        return p;
      }

      /* Wandscheibe w × h, Dicke t, mit je einem Bogenloch an den x aus xs.
         Zwei Fallen: (1) ExtrudeGeometry legt die UV in Shape-Koordinaten an,
         also in Metern — die Tapete ist aber eine geteilte Textur mit
         repeat 5 × 1.6 (js/models.js:709-714) und kachelte sonst um ein
         Vielfaches zu dicht. Deshalb werden die UV aus der Position neu
         berechnet. (2) ExtrudeGeometry beginnt bei y = 0 und z = 0,
         BoxGeometry ist mittig — die Verschiebung am Ende macht beide
         austauschbar, ohne die Mesh-Position anzufassen. */
      function holedWallGeo(w, h, t, xs, y0) {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
        xs.forEach(x => s.holes.push(archPath(x, y0, WIN_W, WIN_H)));
        const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
        const pos = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++)
          uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / h);
        uv.needsUpdate = true;
        geo.translate(0, -h / 2, -t / 2);
        return geo;
      }

      /* Abfrage: die beiden Wandschichten eines Stockwerks samt beider
         Geometrien. Beim ersten Aufruf werden die gelochten Varianten gebaut
         und gemerkt. */
      function fensterSchichten(i) {
        const g = floorGroups[i];
        if (!g || !g.userData.frontKern) return null;
        const kern = g.userData.frontKern, panel = g.userData.wallPanels.front;
        if (!g.userData.fensterGeo) {
          const w = W(i) - 0.24, h = H(i), y0 = winY(H(i));
          const xs = g.userData.wins.map(m => m.position.x);
          g.userData.fensterGeo = {
            kernZu: kern.geometry, panelZu: panel.geometry,
            kernOffen: holedWallGeo(w, h, WALL_CORE, xs, y0),
            panelOffen: holedWallGeo(w, h, WALL_PANEL, xs, y0),
          };
        }
        return { kern, panel, wins: g.userData.wins, geo: g.userData.fensterGeo };
      }
      ```

- [ ] **Step 5: Den Debug-Hook erweitern.**
      In der Liste bei `js/game.js:2810` (dort, wo schon `enterBesuch,
      exitBesuch, besuchCamFor` stehen) ergänzen:

      ```js
      fensterSchichten,
      ```

- [ ] **Step 6: Sonde laufen lassen, sie muss grün sein.**

      ```bash
      python3 .superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t1_geometrie.py
      ```

      Erwartet: `Schichten: ok` und `T1 gruen`, keine `pageerror`.
      Bei `UV nicht normalisiert` fehlt die Schleife aus Step 4; bei
      `massive Geometrie nicht gemerkt` wurde `kernZu` nach dem Tausch
      geschrieben statt davor.

- [ ] **Step 7: Commit.**

      ```bash
      git add js/game.js
      git commit -m "feat(turm): gelochte Vorderwand fuer den Besuch bauen

      Wandkern und Innenpanel bekommen je eine zweite Geometrie mit
      Bogenloechern an den Stellen der Fassadenfenster. Gebaut wird sie
      beim ersten Besuch eines Stockwerks, getauscht wird sie noch nicht.

      Refs #102"
      ```

---

### Task 2: Fenster im Besuch öffnen und wieder schliessen

**Files:**
- Modify: `js/game.js` (neue Funktionen `fensterAuf` / `fensterZu` direkt
  unter `fensterSchichten` aus Task 1)
- Modify: `js/game.js:1245-1268` (`enterBesuch`)
- Modify: `js/game.js:1270-1282` (`exitBesuch`)
- Modify: `js/game.js:1308-1315` (`wechsleBesuch`)
- Modify: `js/game.js:2810-2840` (Debug-Hook: `fensterAuf`, `fensterZu`)
- Test: `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t2_durchblick.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `fensterSchichten(i)` aus Task 1 — `{ kern, panel, wins, geo }`
  mit `geo = { kernZu, kernOffen, panelZu, panelOffen }`.
- Produces: `fensterAuf(i)` und `fensterZu(i)` — Befehle ohne Rückgabewert,
  `i` ist eine Stockwerksnummer. Für `'roof'`, `'garten'`, `'aussicht'` und
  für noch nicht gebaute Stockwerke tun sie nichts (Wächter in
  `fensterSchichten`).

- [ ] **Step 1: Die rote Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t2_durchblick.py`:

      ```python
      from playwright.sync_api import sync_playwright

      PORT = 9081  # derselbe freie Port wie in Task 1
      URL = f"http://127.0.0.1:{PORT}/"

      # Strahl vom Auge des Besuchers durch die Mitte der ersten Fensteroeffnung:
      # trifft er die eigene Vorderwand noch, gibt es kein Loch.
      DURCHBLICK = """(k) => { const w = window.wipfelkratzer;
        w.scene.updateMatrixWorld(true);
        const g = w.floorGroups[k], win = g.userData.wins[0];
        const ziel = new w.THREE.Vector3(); win.getWorldPosition(ziel);
        ziel.y += 0.4;                       /* Mitte der Bogenoeffnung */
        const eye = w.besuchCamFor(k).eye;
        const r = new w.THREE.Raycaster(eye, ziel.clone().sub(eye).normalize());
        const wand = [g.userData.frontKern, g.userData.wallPanels.front];
        return r.intersectObjects(wand, false).length; }"""

      ZUSTAND = """(k) => { const w = window.wipfelkratzer;
        const g = w.floorGroups[k], s = w.fensterSchichten(k);
        return { scheiben: g.userData.wins.map(m => m.visible),
                 kernOffen: s.kern.geometry === s.geo.kernOffen,
                 panelOffen: s.panel.geometry === s.geo.panelOffen }; }"""

      with sync_playwright() as p:
          browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = browser.new_page()
          fehler = []
          page.on("pageerror", lambda e: fehler.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")

          STAND = "() => localStorage.getItem(window.wipfelkratzer.stand.standKey)"
          vorher = page.evaluate(STAND)
          assert page.evaluate(DURCHBLICK, 1) > 0, "draussen darf die Wand zu sein"

          page.evaluate("(k) => window.wipfelkratzer.enterBesuch(k)", 1)
          page.wait_for_timeout(300)
          assert page.evaluate(DURCHBLICK, 1) == 0, "im Besuch steht die Wand noch im Weg"
          z = page.evaluate(ZUSTAND, 1)
          assert all(v is False for v in z["scheiben"]), z
          assert z["kernOffen"] and z["panelOffen"], z

          # Standpunktwechsel: unten geht zu, oben geht auf.
          page.evaluate("(k) => window.wipfelkratzer.wechsleBesuch(k)", 2)
          page.wait_for_timeout(300)
          z1, z2 = page.evaluate(ZUSTAND, 1), page.evaluate(ZUSTAND, 2)
          assert all(v is True for v in z1["scheiben"]) and not z1["kernOffen"], z1
          assert all(v is False for v in z2["scheiben"]) and z2["kernOffen"], z2

          page.evaluate("() => window.wipfelkratzer.exitBesuch()")
          page.wait_for_timeout(300)
          for k in (1, 2):
              z = page.evaluate(ZUSTAND, k)
              assert all(v is True for v in z["scheiben"]), (k, z)
              assert not z["kernOffen"] and not z["panelOffen"], (k, z)
              assert page.evaluate(DURCHBLICK, k) > 0, k

          assert page.evaluate(STAND) == vorher, \
              "der Besuch hat den Spielstand veraendert"
          assert not fehler, fehler
          browser.close()
          print("T2 gruen")
      ```

- [ ] **Step 2: Sonde laufen lassen, sie muss rot sein.**

      ```bash
      python3 .superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t2_durchblick.py
      ```

      Erwartet: `AssertionError: im Besuch steht die Wand noch im Weg` —
      `enterBesuch` tauscht noch nichts.

- [ ] **Step 3: Die beiden Befehle einfügen.**
      Direkt unter `fensterSchichten` (Task 1):

      ```js
      /* Zwei Funktionen statt eines Schalters — ein Flag-Argument würde hier
         nur den Tausch verstecken. */
      function fensterAuf(i) {
        const s = fensterSchichten(i); if (!s) return;
        s.kern.geometry = s.geo.kernOffen;
        s.panel.geometry = s.geo.panelOffen;
        s.wins.forEach(m => { m.visible = false; });
      }
      function fensterZu(i) {
        const s = fensterSchichten(i); if (!s) return;
        s.kern.geometry = s.geo.kernZu;
        s.panel.geometry = s.geo.panelZu;
        s.wins.forEach(m => { m.visible = true; });
      }
      ```

      Warum die Scheiben mit ausgeblendet werden: sie stehen 2 cm **vor** der
      Wand (`js/game.js:419`) und verstopften die frische Öffnung von aussen.

- [ ] **Step 4: `enterBesuch` das Fenster öffnen lassen.**
      In `js/game.js:1245-1268`, in der Zeile, die schon die Decke ausblendet
      (`if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;`),
      direkt danach:

      ```js
      fensterAuf(k);
      ```

- [ ] **Step 5: `wechsleBesuch` das verlassene Stockwerk schliessen lassen.**
      In `js/game.js:1308-1315` vor dem Setzen von `besuch.k` den alten
      Standpunkt merken und zumachen:

      ```js
      function wechsleBesuch(k) {
        if (!besuch) return;
        fensterZu(besuch.k);
        besuch.k = k;
        if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
        fensterAuf(k);
        stelleBesuchKamera(k);
        renderBesuchbar();
        sfx.pop();
      }
      ```

- [ ] **Step 6: `exitBesuch` alles zumachen lassen.**
      In `js/game.js:1270-1282` **vor** der Zeile `besuch = null; besuchSave = null;`
      (danach wäre das Stockwerk nicht mehr bekannt):

      ```js
      fensterZu(besuch.k);
      ```

- [ ] **Step 7: Den Debug-Hook erweitern.**
      In der Liste bei `js/game.js:2810`, neben `fensterSchichten`:

      ```js
      fensterAuf, fensterZu,
      ```

- [ ] **Step 8: Sonde laufen lassen, sie muss grün sein.**

      ```bash
      python3 .superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t2_durchblick.py
      ```

      Erwartet: `T2 gruen`, keine `pageerror`. Schlägt `der Besuch hat den
      Spielstand veraendert` an, ist irgendwo ein `save()` in den Besuchszweig
      geraten — es gehört dort nicht hin.

- [ ] **Step 9: Commit.**

      ```bash
      git add js/game.js
      git commit -m "feat(turm): Fenster geben im Besuch den Blick nach aussen frei

      enterBesuch tauscht die Vorderwand gegen die gelochte Variante und
      blendet die Fassadenscheiben aus, exitBesuch und wechsleBesuch stellen
      beides wieder her. Kein save(), kein neues Feld im Spielstand.

      Closes #102"
      ```

---

### Task 3: Abnahme am echten Knopf und Changelog

**Files:**
- Modify: `CHANGELOG.md` (Abschnitt `## [Unreleased]`)
- Test: `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t3_abnahme.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `fensterAuf(i)` / `fensterZu(i)` aus Task 2, verdrahtet in
  `enterBesuch` / `wechsleBesuch` / `exitBesuch`.
- Produces: nichts für spätere Tasks — das ist die letzte Stufe.

- [ ] **Step 1: Die Abnahmeprüfung schreiben — echte Knöpfe, kein Hook.**
      `.superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t3_abnahme.py`:

      ```python
      from playwright.sync_api import sync_playwright

      PORT = 9081
      URL = f"http://127.0.0.1:{PORT}/"

      DURCHBLICK = """(k) => { const w = window.wipfelkratzer;
        w.scene.updateMatrixWorld(true);
        const g = w.floorGroups[k], win = g.userData.wins[0];
        const ziel = new w.THREE.Vector3(); win.getWorldPosition(ziel);
        ziel.y += 0.4;
        const eye = w.besuchCamFor(k).eye;
        const r = new w.THREE.Raycaster(eye, ziel.clone().sub(eye).normalize());
        const wand = [g.userData.frontKern, g.userData.wallPanels.front];
        return r.intersectObjects(wand, false).length; }"""

      with sync_playwright() as p:
          browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = browser.new_page(viewport={"width": 1000, "height": 700})
          fehler = []
          page.on("pageerror", lambda e: fehler.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")

          page.click("#btn-besuch", timeout=20000)      # startet im Erdgeschoss
          page.wait_for_timeout(500)
          page.click("#btn-besuch-hoch", timeout=20000) # 1. Stock
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert page.evaluate(DURCHBLICK, 1) == 0, "kein Durchblick nach dem Knopfweg"
          page.screenshot(path=".superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/innen.png")

          page.click("#btn-besuch-zu", timeout=20000)
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          assert page.evaluate(DURCHBLICK, 1) > 0, "die Wand ist nach dem Besuch nicht wieder zu"
          page.screenshot(path=".superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/aussen.png")

          # Nachtfassade lebt weiter: nach dem Besuch leuchten beleuchtete Wohnungen.
          page.evaluate("() => window.wipfelkratzer.setNight(true)")
          page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)
          sichtbar = page.evaluate(
              "() => window.wipfelkratzer.floorGroups[1].userData.wins.every(m => m.visible)")
          assert sichtbar, "Fassadenscheiben bleiben nach dem Besuch ausgeblendet"

          assert not fehler, fehler
          browser.close()
          print("T3 gruen")
      ```

- [ ] **Step 2: Abnahmeprüfung laufen lassen.**

      ```bash
      python3 .superpowers/sdd/2026-09-27-fenster-blick-nach-aussen/t3_abnahme.py
      ```

      Erwartet: `T3 gruen`, keine `pageerror`. Sie sollte nach Task 2 sofort
      grün sein; ist sie es nicht, fehlt ein Aufruf in einem der drei
      Besuchs-Einstiege.

- [ ] **Step 3: Die beiden Bilder ansehen.**
      `innen.png` zeigt aus dem Zimmer heraus Bogenöffnungen mit Wald/Himmel
      dahinter — keine braunen Scheiben, keine schwarzen Löcher. `aussen.png`
      zeigt die Fassade unverändert mit allen Fenstern. Stimmt eines der
      beiden nicht, ist die Sache nicht fertig, auch wenn alle Zusicherungen
      grün sind.

- [ ] **Step 4: Changelog-Eintrag.**
      In `CHANGELOG.md` unter `## [Unreleased]` (Abschnitt `### Added`
      anlegen, falls er noch fehlt) — Spielersprache, nicht Repo-Sprache:

      ```markdown
      ### Added

      - Beim «Hineingehen» sind die Fenster jetzt echte Öffnungen: Du schaust
        aus der Wohnung hinaus auf Wald, Bach und den Rest Deines Turms.
        Sobald Du wieder draussen bist, ist die Fassade wie vorher (#102)
      ```

- [ ] **Step 5: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Fensterblick aus der Wohnung (#102)"
      git push
      ```

- [ ] **Step 6: Server beenden.**

      ```bash
      ss -lptn 'sport = :9081' | grep -oP 'pid=\K[0-9]+' | xargs -r kill
      ```

---

## Abnahmekriterien (aus der Spec)

1. Ein Strahl vom Auge des Besuchers durch die Fenstermitte trifft die eigene
   Vorderwand nicht mehr (Task 2, `DURCHBLICK == 0`).
2. Die Bogenscheiben des besuchten Stockwerks sind ausgeblendet (Task 2).
3. Jedes besuchte Stockwerk hat Fenster, Tür und Torbogen bleiben zu — es
   werden nur die Einträge aus `g.userData.wins` gelocht (Task 1, Step 4).
4. Nach «Schluss» ist die Aussenansicht wieder wie vorher: massive Geometrie,
   alle Scheiben sichtbar (Task 2 und Task 3).
5. Der Standpunktwechsel macht das verlassene Stockwerk zu und das neue auf
   (Task 2).
6. Die Tapete kachelt im Besuch wie beim Einrichten — UV auf `0…1` (Task 1).
7. `localStorage` ist vor und nach dem Besuch byte-gleich (Task 2).
8. Die Nachtfassade funktioniert nach dem Besuch unverändert (Task 3).
9. Kein `pageerror` in allen drei Läufen.
