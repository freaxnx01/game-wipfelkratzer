# Plan — Aussichtsplattform mit Fernrohr (Issue #82)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Aussichtsplattform im Wald, die man über den Besuchsmodus
betritt — und von der aus ein Tipp auf Turm, Brücke, Spielplatz oder Else
Elster erzählt, was man da sieht.

**Architecture:** Kein neues Subsystem. Die Plattform ist Geometrie
(`makeAussicht()` in `js/models.js`) plus ein vierter Standpunkt in
`besuchCamFor` (`js/game.js:1180`). Das «Fernrohr» ist **keine neue
Mechanik**, sondern eine andere Antwort des vorhandenen Tipp-Handlers
(`js/game.js:2041-2054`), solange ein Besuch läuft: draussen öffnet ein Tipp
etwas, im Besuch erzählt er davon — über dieselbe Sprechblase
(`js/game.js:2256`).

**Tech Stack:** Vanilla ES-Module, three.js r184. Kein Build, kein
Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-19-aussichtsplattform-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`).
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine Testdatei**.
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  warme entsättigte Töne, klobige Primitive. Keine Texturen ausser der
  vorhandenen Canvas-Technik, keine Shader, keine Partikel.
- **Das Verhalten ausserhalb des Besuchs bleibt exakt gleich.** Ein Tipp auf
  ein Stockwerk öffnet weiterhin das Einrichten, einer auf den Bach die
  Splashdown-Rückfrage. Wer das ändert, hat den Zuschnitt verlassen.
- **Keine Kosten in Nüssen.** #83 hat das Thema gerade geklärt; zwei
  Währungsfragen gleichzeitig wären eine zu viel.
- **Kein Hinaufsteigen.** Die Leiter ist Geometrie, kein Weg.
- **Kein neues Feld im Spielstand.** Die Plattform steht immer da; sie wird
  nicht gebaut, nicht freigeschaltet und nicht gespeichert.
- **Touch first.** Der neue Leistenknopf bleibt mindestens 44 px hoch.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(welt)`.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-19-aussichtsplattform/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9061–9065** (erster freier). Nur der Server darf in den Hintergrund.
  Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`,
  jeder `page.click` mit `timeout=20000`.
- **Kamerafahrten: auf Ankunft warten, nicht auf Stillstand.** Die Schleife
  klammert den Zeitschritt (`dt = Math.min(clock.getDelta(), 0.05)`,
  `js/game.js:2793`) und ein headless Renderer zeichnet unter einem Bild pro
  Sekunde — eine 0.9-Sekunden-Fahrt dauert dann rund **25 Sekunden**. Wer
  früher misst, liest eine Kamera im Durchflug und hält das für einen Fehler:

  ```python
  DA = """() => { const w = window.wipfelkratzer;
    if (!w.besuch) return w.tweenCount() === 0;
    const { eye } = w.besuchCamFor(w.besuch.k);
    return w.tweenCount() === 0 && w.camera.position.distanceTo(eye) < 0.2; }"""
  page.wait_for_function(DA, timeout=120000, polling=1000)
  ```

- **Bildschirmkoordinaten kommen aus der Szene**, nie geraten:
  `mesh.getWorldPosition(v).project(camera)` → `(v.x+1)/2*breite`,
  `(-v.y+1)/2*höhe`. Ein Helfer dafür gehört in jede Sonde.
- **Ein Stockwerk entsteht nicht durch `state.floors`.** Seit #47 werden die
  Gruppen verzögert erzeugt: `w.state.floors = 3; w.floorGroup(1);
  w.floorGroup(2); w.floorGroup(3);` — oder `page.reload()` nach
  `w.speichern()`, dann baut der Ladeweg sie selbst.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.

---

### Task 1: Die Plattform steht im Wald

**Files:**
- Modify: `js/models.js` — neue Funktion `makeAussicht()`
- Modify: `js/game.js:235-237` (wo Schild, Willi und Móki aufgestellt werden)
- Modify: `js/game.js:2058-2069` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-19-aussichtsplattform/t1_plattform.py`

**Interfaces:**
- Produces: `export function makeAussicht()` in `js/models.js` — liefert eine
  `THREE.Group` mit vier Stämmen, Plattform, Geländer und Leiter; der
  Ursprung liegt am Boden, die Plattformoberkante bei `AUSSICHT_DECK = 5.2`.
- Produces: `export const AUSSICHT_DECK = 5.2` in `js/models.js`.
- Produces: `aussicht` (die aufgestellte Gruppe) in `js/game.js`, mit
  `userData.type = 'aussicht'`, und `AUSSICHT_POS` als ihre Weltposition.
- Produces: im Debug-Hook zusätzlich `aussicht` und `AUSSICHT_POS`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-aussichtsplattform/t1_plattform.py`:

      ```python
      import json, socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9061, 9066)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

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
              res = page.evaluate("""() => {
                const w = window.wipfelkratzer;
                if (!w.aussicht) return { da: false };
                const bb = new w.THREE.Box3().setFromObject(w.aussicht);
                let lambert = true;
                w.aussicht.traverse(o => { if (o.material && !o.material.isMeshLambertMaterial) lambert = false; });
                return { da: true, typ: w.aussicht.userData.type,
                         hoehe: +(bb.max.y - bb.min.y).toFixed(2),
                         inSzene: w.aussicht.parent === w.scene,
                         lambert,
                         abstandZumTurm: +Math.hypot(w.aussicht.position.x, w.aussicht.position.z).toFixed(2) };
              }""")
              b.close()
          print(json.dumps(res, indent=2, ensure_ascii=False))
          assert res["da"], "makeAussicht() ist nicht aufgestellt"
          assert res["typ"] == "aussicht", res
          assert res["hoehe"] > 4.5, res
          assert res["inSzene"], res
          assert res["lambert"], "nur MeshLambertMaterial ist erlaubt"
          assert res["abstandZumTurm"] > 12, "zu nah am Turm — von dort sieht man ihn nicht"
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-19-aussichtsplattform/t1_plattform.py`
      bricht mit `AssertionError: makeAussicht() ist nicht aufgestellt` ab.
      Rot gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: `makeAussicht()` in `js/models.js`.** Ans Ende der
      Modellfunktionen, im Stil von `makeSign` (`js/models.js` — `G()`, `cyl`
      und `mesh` sind die vorhandenen Helfer, `js/models.js:117-119`):

      ```js
      /* Aussichtsplattform: vier Stämme, ein Deck, ein Geländer, eine Leiter.
         Klobige Primitive wie der übrige Wald — die Leiter ist Geometrie, kein
         Weg (#82). */
      export const AUSSICHT_DECK = 5.2;
      export function makeAussicht() {
        const g = G();
        const halb = 1.1;
        [[-halb, -halb], [halb, -halb], [-halb, halb], [halb, halb]].forEach(([x, z]) => {
          cyl(g, 0.16, 0.2, AUSSICHT_DECK, MAT.woodD, x, AUSSICHT_DECK / 2, z, 10);
        });
        /* Deck */
        mesh(new THREE.BoxGeometry(halb * 2 + 0.5, 0.18, halb * 2 + 0.5), MAT.woodL,
             0, AUSSICHT_DECK, 0, g);
        /* Geländer: vier Pfosten und ein umlaufender Holm */
        [[-halb, -halb], [halb, -halb], [-halb, halb], [halb, halb]].forEach(([x, z]) => {
          cyl(g, 0.06, 0.06, 0.9, MAT.wood, x, AUSSICHT_DECK + 0.54, z, 8);
        });
        [[0, -halb, 0], [0, halb, 0], [-halb, 0, Math.PI / 2], [halb, 0, Math.PI / 2]]
          .forEach(([x, z, rot]) => {
            const holm = mesh(new THREE.BoxGeometry(halb * 2 + 0.5, 0.1, 0.1), MAT.wood,
                              x, AUSSICHT_DECK + 0.92, z, g);
            if (rot) holm.rotation.y = rot;
          });
        /* Leiter an der Südseite */
        const leiter = G(); g.add(leiter); leiter.position.set(0, 0, halb + 0.3);
        cyl(leiter, 0.05, 0.05, AUSSICHT_DECK, MAT.wood, -0.28, AUSSICHT_DECK / 2, 0, 8);
        cyl(leiter, 0.05, 0.05, AUSSICHT_DECK, MAT.wood, 0.28, AUSSICHT_DECK / 2, 0, 8);
        for (let y = 0.45; y < AUSSICHT_DECK; y += 0.45) {
          const sprosse = mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), MAT.woodD, 0, y, 0, leiter);
          sprosse.castShadow = false;
        }
        return g;
      }
      ```

- [ ] **Step 4: Aufstellen in `js/game.js`.** Neben Schild, Willi und Móki
      (`js/game.js:235-237`) ergänzen — und `makeAussicht`/`AUSSICHT_DECK` in
      die Importliste aus `./models.js` aufnehmen (`js/game.js:3-6`):

      ```js
      /* Abseits des Turms am Waldrand: von hier sieht man den Wipfelkratzer
         ganz — das ist der eine Blick, den die Dachterrasse nicht bietet (#82). */
      const AUSSICHT_POS = new THREE.Vector3(-15, 0, 13);
      const aussicht = makeAussicht();
      aussicht.position.copy(AUSSICHT_POS);
      aussicht.rotation.y = 0.5;
      aussicht.userData.type = 'aussicht';
      scene.add(aussicht);
      ```

- [ ] **Step 5: Debug-Hook ergänzen** (`js/game.js:2058-2069`):

      ```js
        aussicht, AUSSICHT_POS,
      ```

- [ ] **Step 6: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-aussichtsplattform/t1_plattform.py`
      druckt `T1 OK`.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/models.js js/game.js
      git commit -m "feat(welt): Aussichtsplattform steht im Wald"
      git push
      ```

---

### Task 2: Der Standpunkt auf der Plattform

**Files:**
- Modify: `js/game.js:1180-1192` (`besuchCamFor`)
- Modify: `js/game.js:1262-1274` (`renderBesuchbar`), `js/game.js:1293-1294`
  (Leistenknöpfe)
- Modify: `index.html` — ein Knopf in `#besuchbar`
- Modify: `js/game.js:2585-2587` (Kartenpunkt `#ort-aussicht`)
- Test: `.superpowers/sdd/2026-09-19-aussichtsplattform/t2_standpunkt.py`

**Interfaces:**
- Consumes: `aussicht`, `AUSSICHT_POS`, `AUSSICHT_DECK` aus Task 1;
  `enterBesuch`, `wechsleBesuch`, `besuchCamFor`, `renderBesuchbar` aus #44.
- Produces: `#btn-besuch-aussicht` im Markup; `besuch.k === 'aussicht'` als
  gültiger Standpunkt.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-aussichtsplattform/t2_standpunkt.py`,
      gleicher Rahmen wie T1, mit der Ankunftsbedingung aus dem Harness:

      ```python
      page.evaluate("() => { const w=window.wipfelkratzer; w.state.floors=3;"
                    " w.speichern(); }")
      page.reload(wait_until="networkidle")
      page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
      if page.locator("#btn-start").is_visible(): page.click("#btn-start", timeout=20000)
      page.wait_for_timeout(600)
      page.evaluate("() => document.getElementById('btn-staende').click()")
      page.wait_for_timeout(900)
      page.click("#ort-aussicht", timeout=20000)
      page.wait_for_function(DA, timeout=120000, polling=1000)
      res = page.evaluate("""() => { const w=window.wipfelkratzer;
        const { eye } = w.besuchCamFor('aussicht');
        const turm = new w.THREE.Vector3(0, w.topY() / 2, 0);
        const blick = new w.THREE.Vector3();
        w.camera.getWorldDirection(blick);
        const hin = turm.clone().sub(w.camera.position).normalize();
        return { k: w.besuch && w.besuch.k, y: +w.camera.position.y.toFixed(2),
                 sollY: +eye.y.toFixed(2),
                 uebersicht: !document.getElementById('staende').classList.contains('open'),
                 titel: document.getElementById('besuch-titel').textContent,
                 eigenerKnopf: document.getElementById('btn-besuch-aussicht').disabled,
                 zumTurm: +blick.dot(hin).toFixed(2) }; }""")
      assert res["k"] == "aussicht", res
      assert abs(res["y"] - res["sollY"]) < 0.1, res
      assert res["uebersicht"], "die Turm-Uebersicht muss sich schliessen"
      assert "ussicht" in res["titel"], res
      assert res["eigenerKnopf"] is True, "auf der Plattform ist ihr Knopf gesperrt"
      assert res["zumTurm"] > 0.5, f"der Blick zeigt nicht zum Turm: {res}"
      ```

- [ ] **Step 2: Test läuft rot.** `#ort-aussicht` zeigt noch den Hinweis aus
      #51, `besuch` bleibt `null`.

- [ ] **Step 3: Standpunkt in `besuchCamFor`.** In `js/game.js:1180` als
      erster Fall ergänzen:

      ```js
        if (k === 'aussicht') {
          /* Auf dem Deck, Blick zur Turmmitte — von hier ist der ganze
             Wipfelkratzer im Bild (#82). */
          const y = AUSSICHT_DECK + AUGE;
          const hin = new THREE.Vector3(0, topY() / 2, 0)
            .sub(AUSSICHT_POS).setY(0).normalize();
          return { eye: new THREE.Vector3(AUSSICHT_POS.x, y, AUSSICHT_POS.z),
                   tgt: new THREE.Vector3(AUSSICHT_POS.x + hin.x * 3, y, AUSSICHT_POS.z + hin.z * 3) };
        }
      ```

      Der Blick geht drei Meter voraus in Richtung Turm; damit liegt das
      Blickziel **vor** der Kamera statt in ihr, und `OrbitControls` dreht um
      einen sinnvollen Punkt.

- [ ] **Step 4: Knopf in der Leiste.** In `index.html` in `#besuchbar` neben
      `#btn-besuch-dach`:

      ```html
        <button id="btn-besuch-aussicht">Aussicht</button>
      ```

      und in `js/game.js` neben `$('btn-besuch-dach').onclick`
      (`js/game.js:1293`):

      ```js
      $('btn-besuch-aussicht').onclick = () => wechsleBesuch('aussicht');
      ```

- [ ] **Step 5: Leiste beschriften und sperren.** In `renderBesuchbar`
      (`js/game.js:1262-1274`) den Titel um den neuen Fall erweitern und den
      Knopf sperren:

      ```js
        $('besuch-titel').textContent = k === 'roof' ? 'Dachterrasse'
          : k === 'garten' ? 'Spielplatz'
          : k === 'aussicht' ? 'Aussichtsplattform'
          : `${flLabel(k)} — ${tenantIn(k) ? (tenantOf(k).unit || tenantOf(k).name) : 'noch niemand'}`;
      ```

      und nach der `btn-besuch-garten`-Zeile:

      ```js
        $('btn-besuch-aussicht').disabled = k === 'aussicht';
      ```

      `$('btn-besuch-hoch').disabled = !zahl || k >= state.floors;` und
      `runter` greifen über `zahl` bereits richtig — `'aussicht'` ist keine
      Zahl, also sind beide dort gesperrt.

- [ ] **Step 6: Der Kartenpunkt startet den Besuch.**
      `js/game.js:2585-2587` wird zu:

      ```js
        if (ev.target.id === 'ort-aussicht') {
          $('staende').classList.remove('open');
          enterBesuch('aussicht');
          return;
        }
      ```

- [ ] **Step 7: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-aussichtsplattform/t2_standpunkt.py`
      druckt `T2 OK`.

- [ ] **Step 8: Commit und Push.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(welt): die Aussichtsplattform ist ein Standpunkt im Besuch"
      git push
      ```

---

### Task 3: Das Fernrohr — im Besuch erzählt ein Tipp

**Files:**
- Modify: `js/game.js:2041-2054` (Tipp-Handler draussen)
- Modify: `js/game.js` — Textliste neben `PHRASES`/`DAM_TEXTS`/`MOKI_TEXTS`
  (`js/game.js:2248, 2266, 2279`)
- Modify: `js/game.js:240` (`magpie`), `js/game.js:245` (`bridge`) — beide
  bekommen `userData.type`
- Test: `.superpowers/sdd/2026-09-19-aussichtsplattform/t3_fernrohr.py`

**Interfaces:**
- Consumes: `besuch` aus #44, `bubbleTarget`/`bubbleH`/`bubbleUntil`
  (`js/game.js:2256`), `toast`, `sfx`.
- Produces: `erzaehle(ziel, text, hoehe)` — setzt die Sprechblase auf ein
  beliebiges Objekt, im selben Muster wie `damTalk()`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-aussichtsplattform/t3_fernrohr.py`,
      gleicher Rahmen. Der Helfer für Bildschirmkoordinaten:

      ```python
      SCREEN = """(name) => { const w = window.wipfelkratzer;
        const ziel = { turm: w.floorGroups[1], elster: w.magpie,
                       burg: w.dam, moki: w.moki }[name];
        const v = new w.THREE.Vector3();
        ziel.getWorldPosition(v).project(w.camera);
        return { x: (v.x + 1) / 2 * innerWidth, y: (-v.y + 1) / 2 * innerHeight,
                 sichtbar: v.z < 1 }; }"""
      ```

      Ablauf: drei Stockwerke bauen, über den Kartenpunkt auf die Plattform,
      auf Ankunft warten, dann:

      ```python
      pt = page.evaluate(SCREEN, "turm")
      assert pt["sichtbar"], "der Turm ist von der Plattform nicht im Bild"
      page.mouse.click(pt["x"], pt["y"])
      page.wait_for_timeout(900)
      res = page.evaluate("""() => { const w=window.wipfelkratzer;
        return { blase: document.getElementById('bubble').classList.contains('show'),
                 text: document.getElementById('bubble').textContent,
                 edit: !!w.edit, besuch: w.besuch && w.besuch.k }; }""")
      assert res["blase"], res
      assert "3" in res["text"], f"die Stockwerkzahl fehlt: {res}"
      assert res["edit"] is False, "im Besuch darf kein Einrichten starten"
      assert res["besuch"] == "aussicht", res
      ```

      Dazu die Gegenprobe **ausserhalb** des Besuchs: `exitBesuch()`, auf
      Ankunft warten, denselben Turmpunkt antippen — jetzt muss
      `w.edit` gesetzt sein, die Sprechblase dagegen nicht erscheinen.

- [ ] **Step 2: Test läuft rot.** Im Besuch passiert beim Tipp auf den Turm
      nichts: `enterEdit` steigt aus (#44), eine Sprechblase gibt es nicht.

- [ ] **Step 3: Elster und Brücke ansprechbar machen.** In `js/game.js:240`
      hinter `scene.add(magpie);` ergänzen:

      ```js
      magpie.userData.type = 'elster';
      ```

      und in `js/game.js:245` hinter der `bridge`-Zeile:

      ```js
      bridge.userData.type = 'bruecke';
      ```

      Dazu die Trefferliste in `js/game.js:2041` erweitern:

      ```js
        const hits = ray.intersectObjects([...hitboxes, sign, willi, dam, moki, river, magpie, bridge, aussicht], true);
      ```

- [ ] **Step 4: Texte und Erzähl-Helfer.** Neben `MOKI_TEXTS`
      (`js/game.js:2279`) ergänzen:

      ```js
      /* Was die Aussichtsplattform über den Wald zu erzählen weiss (#82).
         Der Turm bekommt seinen Text zur Laufzeit — er hängt von der
         Stockwerkzahl ab. */
      const FERNROHR = {
        elster: 'Das ist Else Elster. Sie sammelt alles, was glänzt — und holt Wasser für den Pool.',
        bruecke: 'Über diese Brücke kommt Willi trockenen Fusses auf die andere Seite.',
        garten: 'Der Spielplatz! Schaukel, Rutsche und Sandkasten — dort ist immer etwas los.',
        aussicht: 'Von hier oben siehst Du den ganzen Wald. Tippe etwas an, dann erzähle ich davon.',
        bach: 'Der Bach kommt aus den Bergen und fliesst am Wipfelkratzer vorbei.',
      };

      function erzaehle(ziel, text, hoehe) {
        bubbleTarget = ziel; bubbleH = hoehe;
        bubbleEl.innerHTML = `<span>${text}</span>`;
        bubbleEl.classList.add('show');
        bubbleUntil = clock.elapsedTime + 5;
        sfx.pop();
      }
      ```

- [ ] **Step 5: Der Tipp-Handler antwortet im Besuch anders.** In
      `js/game.js:2042-2054` die Schleife um einen Besuchszweig ergänzen, der
      **vor** den bestehenden Zweigen greift:

      ```js
        for (const h of hits) {
          let o = h.object; while (o && !(o.userData && o.userData.type)) o = o.parent;
          if (!o) continue; const u = o.userData;
          /* Im Besuch erzählt ein Tipp, statt etwas zu öffnen — dasselbe
             Ereignis, eine andere Antwort (#82). Draussen bleibt alles, wie
             es war. */
          if (besuch) {
            if (u.type === 'floor' || u.type === 'roof') {
              erzaehle(towerG, `Das ist Dein Wipfelkratzer — ${state.floors} ${state.floors === 1 ? 'Stockwerk' : 'Stockwerke'} hoch.`, topY() * 0.6);
              return; }
            if (u.type === 'elster') { erzaehle(magpie, FERNROHR.elster, 0.6); return; }
            if (u.type === 'bruecke') { erzaehle(bridge, FERNROHR.bruecke, 0.8); return; }
            if (u.type === 'garten') { if (!state.garden) continue;
              erzaehle(gartenG, FERNROHR.garten, 1.4); return; }
            if (u.type === 'aussicht') { erzaehle(aussicht, FERNROHR.aussicht, AUSSICHT_DECK + 1.2); return; }
            /* Der Bach MUSS hier abgefangen werden: draussen führt er zu
               «Splashdown!» (#46), also aus dem Spiel heraus. Ein Kind, das
               von der Plattform aufs Wasser tippt, wollte nicht das Spiel
               wechseln — es wollte wissen, was da unten fliesst. */
            if (u.type === 'bach') { erzaehle(river, FERNROHR.bach, 0.4); return; }
            /* Willi, Biberburg, Móki und das Schild behalten ihr Verhalten —
               sie erzählen ohnehin schon, und das Schild zeigt die Bewohner. */
          }
          if (u.type === 'sign') { renderResidents(); $('residents').classList.add('open'); return; }
          if (u.type === 'willi') { williTalk(); return; }
          if (u.type === 'dam') { damTalk(); return; }
          if (u.type === 'moki') { mokiTalk(); return; }
          if (u.type === 'bach') { askSplashdown(); return; }
          if (u.type === 'roof') { enterEdit('roof'); return; }
          if (u.type === 'garten') { if (state.garden) { enterEdit('garten'); return; } continue; }
          if (u.type === 'floor') { if (u.floor <= state.floors) { enterEdit(u.floor); return; } continue; }
        }
      ```

      `towerG` ist die Turmgruppe (`js/game.js:362`); die Blase hängt damit
      am Turm und folgt ihm im Bild.

- [ ] **Step 6: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-aussichtsplattform/t3_fernrohr.py`
      druckt `T3 OK`.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(welt): von der Plattform erzählt ein Tipp, was man sieht"
      git push
      ```

---

### Task 4: Abnahme und Changelog

**Files:**
- Modify: `CHANGELOG.md`
- Test: `.superpowers/sdd/2026-09-19-aussichtsplattform/t4_abnahme.py`

**Interfaces:**
- Consumes: alles aus Task 1–3.

- [ ] **Step 1: Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-19-aussichtsplattform/t4_abnahme.py` prüft die
      Akzeptanzkriterien am Stück:

      1. **Draussen ist alles unverändert:** ohne Besuch einen Turmpunkt
         antippen → `w.edit` ist gesetzt, keine Sprechblase. Danach
         `exitEdit()`.
      2. **Rundreise über die Leiste:** Plattform → Dach → Stockwerk 1 →
         Plattform, jeweils auf Ankunft warten; auf der Plattform ist
         `#btn-besuch-aussicht` gesperrt, `hoch` und `runter` ebenso.
      3. **Brücke und Spielplatz nur, wenn gebaut:** ohne beide auf ihre
         (nicht vorhandene) Position tippen ändert nichts; nach
         `state.bridge = true` und `state.garden = true` plus Neuladen
         erzählen beide.
      4. **Ein Tipp ins Leere tut nichts:** auf den Himmel tippen, danach ist
         die Sprechblase nicht sichtbar und `w.edit` unverändert `null`.
      4b. **Der Bach führt im Besuch nicht aus dem Spiel:** von der Plattform
         auf das Wasserband tippen — es erscheint eine Sprechblase, und
         `#splash-ask` bleibt geschlossen. Draussen dagegen erscheint die
         Rückfrage wie bisher. Das ist der einzige Fall, in dem ein
         versehentlicher Tipp das Spiel verlassen könnte.
      5. **Der Spielstand ist unverändert:** `localStorage` vor und nach der
         Rundreise byte-gleich.
      6. Konsole ohne `pageerror` über den ganzen Lauf.

- [ ] **Step 2: Sonde laufen lassen und rote Punkte beheben.** Jeder
      Fehlschlag ist ein Mangel in Task 1–3, keine Sondenschwäche. Bei drei
      erfolglosen Versuchen an derselben Stelle anhalten und den Befund in der
      PR-Beschreibung festhalten, statt weiter zu raten.

- [ ] **Step 3: Changelog-Eintrag.** Unter `## [Unreleased]` → `### Added`:

      ```markdown
      - Im Wald steht jetzt eine Aussichtsplattform. Über die Waldkarte gehst
        Du hinauf und schaust Dich um — von dort siehst Du Deinen ganzen
        Wipfelkratzer, was von der Dachterrasse aus nicht geht. Und wenn Du
        etwas antippst, erzählt Willi Dir davon: wie hoch Dein Turm schon ist,
        was Else Elster treibt, wozu die Brücke da ist. Auch die Biberburg,
        Móki und der Bach erzählen von dort oben (#82)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Aussichtsplattform mit Fernrohr (#82)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Vor/Nach-Ausgabe **jeder**
      Sonde einfügen, dazu `git diff --name-only` gegen `main`. Den **manuellen
      In-Browser-Playtest als offenen Posten** benennen: ob die Plattform am
      gewählten Ort gut aussieht und der Blick auf den Turm etwas hergibt,
      sagt keine Sonde. Falls die Position `(-15, 0, 13)` im Bild schlecht
      wirkt, ist sie eine einzelne Zahlenzeile und im Review leicht zu
      verschieben — das gehört in die Beschreibung.
