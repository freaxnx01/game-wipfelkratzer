# Plan — Jahreszeiten im Wald (Issue #50)

**Goal:** Ein Knopf in der Werkzeugleiste schaltet die Jahreszeit weiter
(Frühling → Sommer → Herbst → Winter). Baumkronen, Wiese, Bach und Himmelston
blenden über 1.4 s sichtbar über. Die Jahreszeit steht im Spielstand. Sommer
ist pixelgleich mit dem heutigen Spiel, und Wetter bleibt als getrennte,
unberührte Idee offen (`TODO.md:7`).

**Architecture:** Eine exportierte Tabelle `SEASONS` in `js/models.js` hält pro
Jahreszeit die Farben für Boden, Hemisphäre, Himmel und die drei Bachbänder
sowie ein **Delta** auf die bestehende HSL-Laubformel (`js/models.js:377, 387`)
— dadurch bleibt der Jitter pro Baum erhalten und der Sommer ist rechnerisch
identisch mit heute. Die 82 einzelnen Laubmaterialien des Waldes werden über
ein neues Register `LEAVES` erreichbar gemacht, statt wie bisher unerreichbar
in `scene` zu verschwinden. In `js/game.js` kommt `applySeason(q)` neben
`applyNight(k)` (`js/game.js:873-888`) und wird über `tween()` überblendet.
Die Arbeitsteilung ist streng: **die Jahreszeit schreibt nur die Tag-Endpunkte
`SKY.d`/`GRND.d`** (`js/game.js:70-72`) und ruft danach `applyNight(nightK)`,
das wie bisher Himmel, Nebel und Hemisphärenlicht daraus mischt. Die drei
Bachbänder (`js/game.js:99-101`) bekommen eigene Materialinstanzen, damit
`MAT.water` — geteilt mit Badewanne, Teekanne und Dachpool — unangetastet
bleibt.

**Spec:** `docs/ai-notes/specs/2026-09-14-jahreszeiten-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner. Nur ES-Module (`CLAUDE.md:796-821`).
- **Bilderbuch-Look ist verbindlich:** ausschliesslich `MeshLambertMaterial`,
  warme entsättigte Töne, klobige Primitive. Keine Texturen, keine Shader,
  keine Partikel.
- **Kein geteiltes `MAT` mutieren.** `MAT.leaf`, `MAT.leafD` und `MAT.water`
  (`js/models.js:6, 8`) werden **nie** über `.color.set()` verändert — sie
  stecken in Zimmerpflanze, Bücherrücken, Gitarre, Rutsche, Blumenbeet,
  Badewanne, Teekanne und Dachpool. Das ist dieselbe Regel wie in #34
  (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`, A1).
- **Keine neue Geometrie.** Der Winter entsteht über Farbe, nicht über
  Schneekappen.
- **Wetter bleibt getrennt.** `TODO.md:7` («Wetter (Regen, Wind, Schnee)») wird
  **nicht** entfernt und nicht umformuliert. Diese Änderung liefert keine
  Flocken, keinen Regen, keinen Wind.
- **Rückwärtskompatibler Spielstand.** `localStorage`-Schlüssel
  `wipfelkratzer-v1` muss weiter laden. Ein Stand ohne `season` ist gültig und
  bedeutet Sommer.
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: der neue Knopf
  erbt `min-height: 48px` aus der Knopfregel (`index.html:32`).
- **`version.js` wird nicht angefasst** und es gibt **keinen
  `chore(release)`-Commit.** Der Changelog-Eintrag geht unter
  `## [Unreleased]` → `### Added`, deutscher Fliesstext, Issue-Nummer in
  Klammern, im Stil der bestehenden Einträge (`CHANGELOG.md:9-15`).
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, nie `run_in_background`** (`CLAUDE.md:550-560`).
  Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- Conventional Commits, Präfix `feat(umgebung)` bzw. `test(umgebung)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-jahreszeiten/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9007–9011** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
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
  `floorGroups`, `roofG`, `scene`, `camera`, `enterEdit`, `exitEdit`, `dims`.
  Dieser Plan erweitert ihn um `LEAVES`, `SEASONS`, `setSeason`, `ground`,
  `riverMats` und `leafColors()`.
- `localStorage['wipfelkratzer-v1']` **vor** dem Laden zu setzen
  (`page.add_init_script`) ist deutlich schneller als der Aufbau über die
  Oberfläche und für die Alt-Spielstand-Prüfungen ohnehin nötig.
- Nach jedem Jahreszeitenwechsel `page.wait_for_timeout(2200)` warten — die
  Überblendung dauert 1.4 s (`tween`, `js/game.js:609`), plus Puffer unter
  Software-Rendering.

---

### Task 1: Jahreszeiten-Tabelle und Laub-Register in `js/models.js`

**Files:**
- `js/models.js`
- `.superpowers/sdd/2026-09-14-jahreszeiten/t1_seasons.py` (Wegwerf-Test)

**Interfaces:**
- `export const SEASONS: Array<{ id, name, leaf: { dh, ks, dl }, ground, hemiGround, sky, sand, water, foam }>`
  in der Reihenfolge `fruehling, sommer, herbst, winter`.
- `export const LEAVES: Array<{ mat: THREE.MeshLambertMaterial, h: number, s: number, l: number }>`
- `makeTree(s, seed)` und `makeTallTree(h, seed)` bleiben in Signatur und
  erzeugter Geometrie **unverändert**; sie legen ihr Laubmaterial nur noch über
  den neuen internen Helfer `leafMat(h, s, l)` an.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-jahreszeiten/t1_seasons.py`:

      ```python
      import subprocess, sys, time, socket
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9007, 9012)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      async () => {
        const m = await import('/js/models.js');
        const out = { errors: [] };
        if (!m.SEASONS) { out.errors.push('SEASONS fehlt'); return out; }
        if (!m.LEAVES)  { out.errors.push('LEAVES fehlt');  return out; }

        out.ids = m.SEASONS.map(s => s.id);
        out.names = m.SEASONS.map(s => s.name);

        // 1. Jede Jahreszeit hat den vollstaendigen Farbsatz.
        for (const s of m.SEASONS)
          for (const key of ['ground','hemiGround','sky','sand','water','foam'])
            if (typeof s[key] !== 'number') out.errors.push(s.id + ' ohne ' + key);

        // 2. Sommer ist die Identitaet auf der Laubformel.
        const so = m.SEASONS.find(s => s.id === 'sommer');
        if (so.leaf.dh !== 0 || so.leaf.ks !== 1 || so.leaf.dl !== 0)
          out.errors.push('Sommer-Laubdelta ist nicht die Identitaet');

        // 3. Sommerfarben sind die heutigen Konstanten aus game.js.
        const heute = { ground: 0x8fbb6e, hemiGround: 0x9dbb7a, sky: 0xcfe3c2,
                        sand: 0xc9b083, water: 0x5aa7c7, foam: 0x7fc4dd };
        for (const k in heute)
          if (so[k] !== heute[k]) out.errors.push('Sommer.' + k + ' weicht ab: ' +
            so[k].toString(16) + ' statt ' + heute[k].toString(16));

        // 4. Das Register fuellt sich beim Bauen von Baeumen und merkt die Basis-HSL.
        const vorher = m.LEAVES.length;
        const t1 = m.makeTree(1.2, 3), t2 = m.makeTallTree(14, 5);
        if (m.LEAVES.length !== vorher + 2)
          out.errors.push('LEAVES waechst nicht um 2, sondern um ' + (m.LEAVES.length - vorher));

        // 5. Die erzeugte Farbe ist exakt die heutige Formel.
        const THREE = await import('three');
        const erw = (h, s, l) => new THREE.Color().setHSL(h, s, l).getHexString();
        const j3 = (3 * 37) % 10 / 10, j5 = ((5 * 37) % 10) / 10;
        const e1 = erw(0.28 + j3 * 0.06, 0.42, 0.38 + j3 * 0.12);
        const e2 = erw(0.27 + j5 * 0.07, 0.40, 0.30 + j5 * 0.15);
        const reg = m.LEAVES.slice(-2);
        if (reg[0].mat.color.getHexString() !== e1)
          out.errors.push('makeTree-Farbe geändert: ' + reg[0].mat.color.getHexString() + ' statt ' + e1);
        if (reg[1].mat.color.getHexString() !== e2)
          out.errors.push('makeTallTree-Farbe geändert: ' + reg[1].mat.color.getHexString() + ' statt ' + e2);

        // 6. Basis-HSL im Register stimmt mit der Farbe überein.
        for (const e of reg) {
          if (erw(e.h, e.s, e.l) !== e.mat.color.getHexString())
            out.errors.push('Basis-HSL passt nicht zur Materialfarbe');
          if (e.mat.type !== 'MeshLambertMaterial')
            out.errors.push('Laubmaterial ist kein MeshLambertMaterial');
        }

        // 7. Die geteilten MAT-Instanzen sind unverändert.
        if (m.MAT.leaf.color.getHexString() !== '77aa5c') out.errors.push('MAT.leaf mutiert');
        if (m.MAT.leafD.color.getHexString() !== '568b49') out.errors.push('MAT.leafD mutiert');
        if (m.MAT.water.color.getHexString() !== '5aa7c7') out.errors.push('MAT.water mutiert');
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
          assert res["ids"] == ["fruehling", "sommer", "herbst", "winter"], res["ids"]
          assert res["names"] == ["Frühling", "Sommer", "Herbst", "Winter"], res["names"]
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate(); srv.wait()
      ```

- [ ] **Step 2: `SEASONS` in `js/models.js` anlegen**, direkt unter `MAT`
      (`js/models.js:12`), mit exakt den Werten aus der Spec, Abschnitt 1. Die
      Sommerzeile wird aus `js/game.js:70, 72, 84, 99-101` abgeschrieben, nicht
      geschätzt.

- [ ] **Step 3: Register und Helfer einführen.** Über `makeTree`
      (`js/models.js:374`):

      ```js
      /* Alle Laubmaterialien des Waldes samt ihrer Sommer-Basis in HSL. Jeder
         Baum hat wegen des Jitters seine eigene Instanz — deshalb ein Register
         statt eines geteilten MAT-Eintrags (siehe Spec, Problem 1). */
      export const LEAVES = [];
      function leafMat(h, s, l) {
        const m = L(new THREE.Color().setHSL(h, s, l));
        LEAVES.push({ mat: m, h, s, l });
        return m;
      }
      ```

- [ ] **Step 4: `makeTree` und `makeTallTree` umstellen.** In `makeTree`
      (`js/models.js:377`) wird
      `const lf = L(new THREE.Color().setHSL(0.28 + j * 0.06, 0.42, 0.38 + j * 0.12));`
      zu `const lf = leafMat(0.28 + j * 0.06, 0.42, 0.38 + j * 0.12);`, in
      `makeTallTree` (`js/models.js:387`) entsprechend
      `const lf = leafMat(0.27 + j * 0.07, 0.4, 0.3 + j * 0.15);`. Die Zahlen
      werden **nicht** angefasst — Sommer muss pixelgleich bleiben. Sonst
      ändert sich in beiden Funktionen nichts.

- [ ] **Step 5: `t1_seasons.py` im Vordergrund laufen lassen**, bis er grün
      ist. Jede rote Zusicherung wird in `js/models.js` behoben, nie im Test
      (`CLAUDE.md:48-62`).

---

### Task 2: `applySeason` in `js/game.js` und die eigenen Bachmaterialien

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-jahreszeiten/t2_apply.py` (Wegwerf-Test)

**Interfaces:**
- `const riverSandMat, riverWaterMat, riverFoamMat: THREE.MeshLambertMaterial`
  (Modulebene, `js/game.js` bei Zeile 99).
- `function applySeason(q: number): void` — mischt zwischen `SEASONS[seasonFrom]`
  und `SEASONS[seasonTo]` und ruft am Ende `applyNight(nightK)`.
- `function setSeason(idx: number): void` — setzt `state.season`, speichert,
  startet die Überblendung, zeigt eine Meldung.
- `function seasonIndex(id: string): number` — liefert den Index oder den von
  `'sommer'`, wenn `id` unbekannt oder fehlend ist.
- `window.wipfelkratzer` wird erweitert um `SEASONS`, `LEAVES`, `setSeason`,
  `ground`, `riverMats: { sand, water, foam }` und
  `leafColors(): string[]` (Hex-Strings aller Laubmaterialien).

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-jahreszeiten/t2_apply.py` — gleicher
      Server-/Browser-Rahmen wie `t1_seasons.py` (Port aus 9007–9011,
      SwiftShader, `pageerror`-Sammler), Kern:

      ```python
      SNAP = """() => {
        const w = window.wipfelkratzer;
        return {
          leaves: w.leafColors(),
          ground: w.ground.material.color.getHexString(),
          sand:   w.riverMats.sand.color.getHexString(),
          water:  w.riverMats.water.color.getHexString(),
          foam:   w.riverMats.foam.color.getHexString(),
          sky:    w.scene.background.getHexString(),
          fog:    w.scene.fog.color.getHexString(),
          matWater: w.MAT.water.color.getHexString(),
          matLeaf:  w.MAT.leaf.color.getHexString(),
        };
      }"""

      page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(2500)
      sommer = page.evaluate(SNAP)

      # 1. Sommer-Ausgangszustand ist der heutige.
      assert sommer["ground"] == "8fbb6e", sommer["ground"]
      assert sommer["sky"] == "cfe3c2", sommer["sky"]
      assert sommer["water"] == "5aa7c7", sommer["water"]
      assert len(sommer["leaves"]) == 82, len(sommer["leaves"])
      assert len(set(sommer["leaves"])) > 8, "Wald ist einfarbig"

      # 2. Bachwasser ist eine eigene Instanz, nicht MAT.water.
      getrennt = page.evaluate("() => window.wipfelkratzer.riverMats.water !== window.wipfelkratzer.MAT.water")
      assert getrennt, "Bach benutzt weiterhin die geteilte MAT.water-Instanz"

      # 3. Herbst: Laub wandert, MAT bleibt.
      page.evaluate("() => window.wipfelkratzer.setSeason(2)")
      page.wait_for_timeout(2200)
      herbst = page.evaluate(SNAP)
      assert herbst["leaves"] != sommer["leaves"], "Laub hat sich nicht verändert"
      assert len(set(herbst["leaves"])) > 8, "Herbstwald ist einfarbig"
      assert herbst["ground"] != sommer["ground"]
      assert herbst["matWater"] == "5aa7c7", "MAT.water wurde mutiert"
      assert herbst["matLeaf"] == "77aa5c", "MAT.leaf wurde mutiert"

      # 4. Winter: alles hell, Bach mit.
      page.evaluate("() => window.wipfelkratzer.setSeason(3)")
      page.wait_for_timeout(2200)
      winter = page.evaluate(SNAP)
      assert winter["water"] != sommer["water"], "Bach friert nicht zu"
      assert winter["matWater"] == "5aa7c7", "MAT.water wurde mutiert"
      hell = lambda hexs: min(int(hexs[i:i+2], 16) for i in (0, 2, 4))
      assert hell(winter["ground"]) > 180, winter["ground"]
      assert all(hell(c) > 120 for c in winter["leaves"]), "es gibt noch dunkle Kronen"

      # 5. Volle Runde fuehrt exakt zurueck.
      page.evaluate("() => window.wipfelkratzer.setSeason(1)")
      page.wait_for_timeout(2200)
      zurueck = page.evaluate(SNAP)
      assert zurueck["leaves"] == sommer["leaves"], "Sommer ist nach der Runde nicht wiederhergestellt"
      assert zurueck["ground"] == sommer["ground"]
      assert zurueck["sky"] == sommer["sky"]
      assert zurueck["water"] == sommer["water"]

      # 6. Der Nebel folgt dem Himmel (applyNight hat zuletzt geschrieben).
      assert zurueck["fog"] == zurueck["sky"], (zurueck["fog"], zurueck["sky"])
      ```

      Die Zahl 82 ist keine Magie: 60 hohe Bäume (`js/game.js:104`) plus 22
      kleine (`js/game.js:116`). Schlägt sie fehl, weil `continue`-Zweige
      (`js/game.js:106-107, 118-119`) Bäume überspringen, wird die Zusicherung
      auf `>= 40` gelockert — aber erst, nachdem die tatsächliche Zahl
      **ausgelesen** und hier notiert wurde.

- [ ] **Step 2: Die drei Bachbänder von `MAT.water` lösen.**
      `js/game.js:99-101` wird ersetzt durch die drei benannten
      Materialkonstanten aus der Spec, Abschnitt 4. Die Startfarben sind
      identisch mit heute (`0xc9b083`, `0x5aa7c7`, `0x7fc4dd`), der Kommentar
      nennt den Grund (Badewanne `js/models.js:117`, Teekanne `:157`, Dachpool
      `:217`).

- [ ] **Step 3: `applySeason(q)` schreiben**, direkt unter `applyNight`
      (`js/game.js:883`), im Wortlaut der Spec, Abschnitt 3. Die Reihenfolge
      im Rumpf ist bindend: erst `SKY.d`/`GRND.d` und die eigenen Materialien
      mischen, **dann** `applyNight(nightK)` rufen. `applySeason` fasst
      `scene.background`, `scene.fog.color` und `hemi.*` niemals direkt an.

- [ ] **Step 4: `setSeason(idx)` und `seasonIndex(id)` ergänzen**, nach dem
      Vorbild von `setNight` (`js/game.js:884-888`). `setSeason` holt eine
      laufende Überblendung über `const from = seasonK` ab, damit ein zweiter
      Tipp mitten in der Blende nicht springt. Dazu die Meldungstexte:

      ```js
      const SEASON_TEXT = {
        fruehling: 'Jetzt ist Frühling — alles wird frisch und hellgrün.',
        sommer:    'Jetzt ist Sommer — der Wald steht sattgrün.',
        herbst:    'Jetzt ist Herbst — die Blätter werden bunt.',
        winter:    'Jetzt ist Winter — Schnee liegt auf dem Wald.',
      };
      ```

- [ ] **Step 5: Den Debug-Hook erweitern** (`js/game.js:1188`) um `SEASONS`,
      `LEAVES`, `MAT`, `setSeason`, `ground`,
      `riverMats: { sand: riverSandMat, water: riverWaterMat, foam: riverFoamMat }`
      und `leafColors: () => LEAVES.map(e => e.mat.color.getHexString())`.

- [ ] **Step 6: Erstaufruf verdrahten.** Neben `applyNight(state.night ? 1 : 0)`
      (`js/game.js:1189`) kommt `applySeason(1)` — mit `seasonFrom === seasonTo`
      ist das der reine Setzvorgang ohne Überblendung. `applySeason` muss
      **vor** dem ersten `applyNight`-Aufruf stehen bzw. ihn selbst auslösen;
      am einfachsten ersetzt `applySeason(1)` den bestehenden Aufruf, weil es
      `applyNight(nightK)` am Ende ohnehin ruft.

- [ ] **Step 7: `t2_apply.py` im Vordergrund laufen lassen**, bis er grün ist.
      Danach den Server über seinen Port beenden.

---

### Task 3: Knopf in der Werkzeugleiste und Spielstand

**Files:**
- `index.html`
- `js/game.js`
- `.superpowers/sdd/2026-09-14-jahreszeiten/t3_ui.py` (Wegwerf-Test)

**Interfaces:**
- `<button id="btn-season">` in `#toolbar`, direkt hinter `#btn-night`
  (`index.html:165`).
- `state.season: string` (Vorgabe `'sommer'`), Teil von
  `wipfelkratzer-v1`.
- `$('btn-season').onclick` schaltet auf
  `(seasonTo + 1) % SEASONS.length` weiter.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-jahreszeiten/t3_ui.py` — gleicher Rahmen wie
      Task 1, Kern:

      ```python
      OUT = Path(__file__).parent / "screens"; OUT.mkdir(exist_ok=True)

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

          # a) Frisches Spiel startet im Sommer.
          page = b.new_page(); page.on("pageerror", lambda e: errs.append(str(e)))
          page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(2500)
          page.click("#btn-start", timeout=20000)
          page.wait_for_timeout(800)
          assert page.inner_text("#btn-season").strip() == "Sommer"
          assert page.evaluate("() => window.wipfelkratzer.state.season") == "sommer"
          page.screenshot(path=str(OUT / "01-sommer.png"))

          # b) Ein Tipp -> Herbst, Knopf zeigt die aktuelle Jahreszeit, Meldung erscheint.
          page.click("#btn-season", timeout=20000)
          page.wait_for_timeout(2200)
          assert page.inner_text("#btn-season").strip() == "Herbst"
          assert "Herbst" in page.inner_text("#toast-stack")
          assert page.evaluate("() => window.wipfelkratzer.state.season") == "herbst"
          page.screenshot(path=str(OUT / "02-herbst.png"))

          # c) Zweiter Tipp -> Winter, dann Nacht dazu.
          page.click("#btn-season", timeout=20000); page.wait_for_timeout(2200)
          assert page.inner_text("#btn-season").strip() == "Winter"
          page.screenshot(path=str(OUT / "03-winter.png"))
          page.click("#btn-night", timeout=20000); page.wait_for_timeout(1800)
          page.screenshot(path=str(OUT / "04-winternacht.png"))
          winternacht = page.evaluate(SNAP)

          # d) Neuladen: Winter und Nacht überleben.
          page.reload(wait_until="networkidle"); page.wait_for_timeout(2800)
          assert page.evaluate("() => window.wipfelkratzer.state.season") == "winter"
          assert page.inner_text("#btn-season").strip() == "Winter"
          nachher = page.evaluate(SNAP)
          assert nachher["ground"] == winternacht["ground"], (nachher["ground"], winternacht["ground"])

          # e) Umgekehrte Reihenfolge (erst Nacht, dann Winter) ergibt dasselbe Bild.
          page2 = b.new_page(); page2.on("pageerror", lambda e: errs.append(str(e)))
          page2.goto(URL, wait_until="networkidle"); page2.wait_for_timeout(2500)
          page2.evaluate("() => { localStorage.removeItem('wipfelkratzer-v1'); }")
          page2.reload(wait_until="networkidle"); page2.wait_for_timeout(2500)
          page2.evaluate("() => window.wipfelkratzer.setNight(true)")
          page2.wait_for_timeout(1800)
          page2.evaluate("() => window.wipfelkratzer.setSeason(3)")
          page2.wait_for_timeout(2200)
          andersrum = page2.evaluate(SNAP)
          for key in ("ground", "sky", "fog", "water"):
              assert andersrum[key] == winternacht[key], (key, andersrum[key], winternacht[key])

          # f) Alter Spielstand ohne season -> Sommer, und ein Muellwert wird bereinigt.
          for vorgabe, erwartet in [({"floors": 2}, "sommer"),
                                    ({"floors": 2, "season": "matsch"}, "sommer")]:
              p3 = b.new_page(); p3.on("pageerror", lambda e: errs.append(str(e)))
              p3.add_init_script(
                  "localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps(vorgabe)))
              p3.goto(URL, wait_until="networkidle"); p3.wait_for_timeout(2800)
              assert p3.evaluate("() => window.wipfelkratzer.state.season") == erwartet
              gespeichert = json.loads(p3.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))
              assert gespeichert["season"] == "sommer", gespeichert
              p3.close()

          b.close()
      assert errs == [], errs
      print("T3 OK")
      ```

      `setNight` muss dafür ebenfalls im Debug-Hook liegen — falls es dort noch
      fehlt, wird es in diesem Schritt ergänzt.

- [ ] **Step 2: Knopf einfügen.** `<button id="btn-season">Sommer</button>`
      in `#toolbar` hinter `#btn-night` (`index.html:165`). Keine neue CSS-Regel
      — die Knopfregel (`index.html:32`) liefert bereits `min-height: 48px`,
      und `#toolbar` bricht dank `flex-wrap: wrap` / `max-width: 96vw`
      (`index.html:47`) selbst um; `--toolbar-h` wird aus der gemessenen Höhe
      nachgeführt (`js/game.js:476`).

- [ ] **Step 3: `state.season` einführen.** In der Zustandszeile
      (`js/game.js:35`) `season: 'sommer'` ergänzen. Direkt nach dem Laden aus
      `localStorage` normalisieren, nach dem Muster von `wallpaperOf`
      (`js/game.js:379-390`):

      ```js
      /* Jahreszeit. Alte Staende haben hier nichts — das ist gueltig und heisst
         Sommer. Ein unbekannter Wert wird still auf Sommer zurueckgesetzt. */
      if (!SEASONS.some(s => s.id === state.season)) { state.season = 'sommer'; migrated = true; }
      ```

      Die Prüfung muss **vor** `if (migrated) save();` (`js/game.js:1186`)
      laufen, damit der bereinigte Stand tatsächlich einmalig zurückgeschrieben
      wird.

- [ ] **Step 4: `onclick` verdrahten**, neben `$('btn-night').onclick`
      (`js/game.js:889`):

      ```js
      $('btn-season').onclick = () => setSeason((seasonTo + 1) % SEASONS.length);
      ```

      Bewusst **ohne** Sperre während der Dachparty — anders als bei Tag/Nacht
      (`js/game.js:889`) gibt es keinen Grund, die Jahreszeit festzuhalten.

- [ ] **Step 5: `t3_ui.py` im Vordergrund laufen lassen**, bis er grün ist.

- [ ] **Step 6: Die vier Screenshots ansehen** (`01-sommer.png` …
      `04-winternacht.png`) und beurteilen, ob der Look hält: der Sommer muss
      aussehen wie vorher, der Herbst bunt und nicht matschig, der Winter hell
      ohne ausgebleichten Himmel, die Winternacht dunkel, aber erkennbar
      verschneit. Farbwerte in `SEASONS` (`js/models.js`) nachziehen, wenn
      nicht — der Test bleibt dabei unverändert, er prüft Richtungen, keine
      Hex-Werte.

---

### Task 4: Abnahme, Abgrenzung zum Wetter und Changelog

**Files:**
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-jahreszeiten/t4_abnahme.py` (Wegwerf-Test)

**Interfaces:** keine neuen — dieser Task ändert nur `CHANGELOG.md` und prüft
die Abnahmekriterien der Spec.

- [ ] **Step 1: Abnahme-Skript schreiben.**
      `.superpowers/sdd/2026-09-14-jahreszeiten/t4_abnahme.py` — prüft genau
      die Kriterien, die T1–T3 nicht abdecken:

      ```python
      # 1. Zimmerpflanze und Badewanne bleiben in allen vier Jahreszeiten farbtreu.
      page.add_init_script("localStorage.setItem('wipfelkratzer-v1', %s)" % json.dumps(json.dumps({
          "floors": 1, "nuts": 99,
          "rooms": {"0": [{"id": "pflanze", "x": -1.2, "z": 0.4, "rot": 0, "cell": 0},
                          {"id": "badewanne", "x": 1.2, "z": 0.4, "rot": 0, "cell": 1}]},
      })))
      page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(2800)

      FARBEN = """() => {
        const out = {};
        window.wipfelkratzer.floorGroups[0].traverse(o => {
          const p = o.userData && o.userData.pick;
          if (!p) return;
          const acc = out[p.entry.id] = out[p.entry.id] || [];
          p.mesh.traverse(x => { if (x.material) acc.push(x.material.color.getHexString()); });
        });
        return out;
      }"""
      vorher = page.evaluate(FARBEN)
      assert "77aa5c" in vorher["pflanze"], vorher["pflanze"]
      assert "5aa7c7" in vorher["badewanne"], vorher["badewanne"]

      for idx in (0, 2, 3, 1):
          page.evaluate(f"() => window.wipfelkratzer.setSeason({idx})")
          page.wait_for_timeout(2200)
          jetzt = page.evaluate(FARBEN)
          assert jetzt["pflanze"] == vorher["pflanze"], (idx, jetzt["pflanze"])
          assert jetzt["badewanne"] == vorher["badewanne"], (idx, jetzt["badewanne"])

      # 2. Die Zahl der Material-Instanzen bleibt nach vier Wechseln konstant.
      ZAEHLEN = """() => { const s = new Set();
        window.wipfelkratzer.scene.traverse(o => {
          if (!o.material) return;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m.uuid)); });
        return s.size; }"""
      n0 = page.evaluate(ZAEHLEN)
      for idx in (0, 1, 2, 3):
          page.evaluate(f"() => window.wipfelkratzer.setSeason({idx})")
          page.wait_for_timeout(2200)
      assert page.evaluate(ZAEHLEN) == n0, (page.evaluate(ZAEHLEN), n0)

      # 3. Wechsel mitten in einer laufenden Nacht-Blende endet sauber.
      page.evaluate("() => { window.wipfelkratzer.setNight(true); }")
      page.wait_for_timeout(400)                       # mitten in der 1.2s-Blende
      page.evaluate("() => window.wipfelkratzer.setSeason(3)")
      page.wait_for_timeout(3000)
      mix = page.evaluate(SNAP)
      page.evaluate("() => window.wipfelkratzer.setNight(true)")   # idempotent
      page.wait_for_timeout(1800)
      assert page.evaluate(SNAP)["sky"] == mix["sky"], "Blenden haben sich gegenseitig überschrieben"

      # 4. Alle Materialien sind weiterhin MeshLambertMaterial.
      typen = page.evaluate("""() => { const s = new Set();
        window.wipfelkratzer.scene.traverse(o => {
          if (!o.material) return;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m.type)); });
        return [...s]; }""")
      assert set(typen) <= {"MeshLambertMaterial", "MeshBasicMaterial", "PointsMaterial"}, typen
      ```

      `MeshBasicMaterial` und `PointsMaterial` sind erlaubt, weil Mond
      (`js/game.js:82`), Sterne (`js/game.js:80`) und die unsichtbaren
      Trefferboxen (`js/game.js:319`) sie schon heute benutzen.

- [ ] **Step 2: `t4_abnahme.py` im Vordergrund laufen lassen**, bis er grün
      ist. Jede rote Zusicherung wird im Produktivcode behoben, nicht im Test.

- [ ] **Step 3: `TODO.md` bewusst *nicht* anfassen.** Mit
      `grep -n 'Wetter (Regen, Wind, Schnee)' TODO.md` bestätigen, dass Zeile 7
      unverändert dasteht, und dass `git diff --stat` keine Änderung an
      `TODO.md` zeigt. Die Abgrenzung Jahreszeit ↔ Wetter steht in der Spec und
      gehört nicht in die TODO-Liste.

- [ ] **Step 4: `CHANGELOG.md` ergänzen.** Über `## [0.5.0] - 2026-09-13`
      (`CHANGELOG.md:6`) eine neue Sektion einziehen — `version.js` bleibt
      dabei unverändert bei `0.5.0`, und es gibt **keinen**
      `chore(release)`-Commit:

      ```markdown
      ## [Unreleased]

      ### Added

      - Der Wald kennt jetzt Jahreszeiten. Ein neuer Knopf in der
        Werkzeugleiste schaltet zwischen Frühling, Sommer, Herbst und Winter
        weiter; Baumkronen, Wiese, Bach und Himmelston blenden dabei sanft
        über, so wie es der Wechsel zwischen Tag und Nacht schon tut. Jeder
        Baum behält seinen eigenen Farbton, der Wald wird also nie einfarbig.
        Die gewählte Jahreszeit bleibt gespeichert und lässt sich mit Tag und
        Nacht frei kombinieren (#50)
      ```

      Gibt es die Sektion `## [Unreleased]` bereits (etwa weil ein anderer
      Issue zuerst gelandet ist), wird der Eintrag dort unter `### Added`
      **angehängt**, statt eine zweite Sektion anzulegen.

- [ ] **Step 5: Restliche Kriterien von Hand im Browser prüfen** (Playwright
      deckt sie nicht sinnvoll ab): die Überblendung läuft flüssig und ohne
      Sprung; die Werkzeugleiste bleibt im Tablet-Hochformat vollständig
      erreichbar und überdeckt weder Katalog noch Auswahlleiste; die
      Herbstfarben wirken im Bilderbuch-Ton und nicht neonartig; die Fenster
      der bewohnten Stockwerke leuchten in der Winternacht wie gewohnt.

- [ ] **Step 6: Alle vier Skripte nacheinander grün laufen lassen**
      (`t1_seasons.py`, `t2_apply.py`, `t3_ui.py`, `t4_abnahme.py`), jeweils im
      Vordergrund. Danach den Server über seinen Port beenden:
      `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.

- [ ] **Step 7: Commit.**
      `feat(umgebung): Abnahme der Jahreszeiten und Changelog`
