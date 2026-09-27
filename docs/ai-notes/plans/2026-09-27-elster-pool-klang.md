# Plan — Else füllt den Pool: Wasserplätschern statt komischem Geräusch (Issue #105)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elses Botengang klingt nach Wasser: ein kurzes Blubb beim Schöpfen am
Bach, ein Plätschern aus Strahl und aufsteigenden Blasen beim Ausgiessen in den
Pool — statt des Kameraschwenk-Rauschers und des dumpfen Wumms von heute.

**Architecture:** Zwei neue Einträge im bestehenden `sfx`-Objekt
(`js/game.js:1974-1999`) und eine dritte Klang-Grundfunktion `bubble()` neben
`tone()` (`js/game.js:1948`) und `noiseBurst()` (`js/game.js:1956`). Danach
zeigen die beiden Aufrufstellen in Elses Zustandsautomat
(`js/game.js:2882`, `js/game.js:2899`) auf die neuen Effekte. `sfx.splash()`
und `sfx.whoosh()` bleiben unverändert — sie haben andere Aufrufer. Der
Debug-Hook bekommt `sfx`, damit eine Playwright-Sonde zählen kann, welcher
Effekt gelaufen ist.

**Tech Stack:** Vanilla ES-Module, Web Audio API, three.js über Importmap. Kein
Build, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-elster-pool-klang-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), niemals `ae/oe/ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine committete Testdatei**.
- **Keine Audiodateien.** Die Klangschicht ist vollständig synthetisiert
  (`js/game.js:1926-2000`); das Repo hat kein Asset-Verzeichnis.
- **`sfx.splash()` und `sfx.whoosh()` werden nicht angefasst.** `splash()` hat
  zwei weitere Aufrufer (`js/game.js:1817` Wasserrutsche, `js/game.js:2339`
  Biberburg), `whoosh()` fünf (`js/game.js:1170`, `1267`, `1282`, `1918`,
  `1923`). Wer sie umstimmt, hat den Zuschnitt verlassen.
- **Kein neues Spielstandfeld und keine Änderung an Elses Wegen oder Dauern.**
  `MAGPIE_DUR` (`js/game.js:242`), `POOL_TRIPS` (`js/game.js:19`) und
  `entry.fill` bleiben, wie sie sind.
- **Jeder neue Effekt steigt bei fehlendem `AudioContext` sofort aus**
  (`if (!AC) return;`) — genau wie alle bestehenden.
- **`version.js` wird nicht angefasst**, kein Tag, kein
  `chore(release)`-Commit. Der Changelog-Eintrag geht unter `## [Unreleased]`
  → `### Changed`, in Spielersprache.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `fix(klang)`.

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-elster-pool-klang/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9061–9065** (erster freier). Nur der Server darf in den Hintergrund.
  Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--autoplay-policy=no-user-gesture-required"]`, jeder `page.click` mit
  `timeout=20000`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Der `AudioContext` entsteht erst beim Klick auf `#btn-start`**
  (`js/game.js:2747`). Ohne diesen Klick steigen alle Effekte bei `!AC`
  wortlos aus und die Sonde misst nichts.
- **Hören kann die Sonde nicht.** Gemessen wird, *welcher* Effekt gerufen
  wurde: die Sonde umhüllt die Einträge in `w.sfx` mit Zählern. Dafür muss
  `sfx` auf dem Debug-Hook liegen — das ist Task 1.
- **Elses Botengang dauert im headless Renderer Minuten.** Die Phasendauern
  summieren sich auf ~9 s Spielzeit pro Fahrt (`MAGPIE_DUR`,
  `js/game.js:242`), und bei unter 1 fps mit `dt`-Klemme auf 0.05
  (`js/game.js:2912`) vergeht dafür ein Vielfaches an Echtzeit. `MAGPIE_DUR`
  ist auf dem Hook exportiert (`js/game.js:2827`) und wird in `tick()` bei
  jedem Bild frisch gelesen (`js/game.js:2925`) — die Sonde darf die Werte
  herunterschrauben. Nicht unter 0.4 gehen: die Giessphase löst erst bei
  `k >= 0.5` aus (`js/game.js:2935`), und bei zu kurzer Dauer springt `k` in
  einem Bild darüber hinweg.
- **Auf den Endzustand pollen, nicht auf eine Zeitspanne wetten:**
  `page.wait_for_function` auf `w.poolEntries()[0].fill >= 1` mit
  `timeout=120000`.

---

### Task 1: Die beiden Wasserklänge

**Files:**
- Modify: `js/game.js:1956-1966` — neuer Helfer `bubble()` direkt **nach**
  `noiseBurst()`
- Modify: `js/game.js:1974-1999` — zwei neue Einträge im `sfx`-Objekt, nach
  `drain()`
- Modify: `js/game.js:2810-2840` — `sfx` in den Debug-Hook
- Test: `.superpowers/sdd/2026-09-27-elster-pool-klang/t1_klaenge.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Produces: `bubble(t, f0, f1, dur = 0.09, g = 0.07)` — Kommando, gibt nichts
  zurück. Spielt einen Sinuston, dessen Tonhöhe von `f0` nach `f1` wandert.
- Produces: `sfx.plaetschern()` — Kommando ohne Argumente.
- Produces: `sfx.schoepfen()` — Kommando ohne Argumente.
- Produces: `window.wipfelkratzer.sfx` — dasselbe `sfx`-Objekt, damit eine
  Sonde seine Einträge umhüllen kann.
- Consumes: `tone()` (`js/game.js:1948`), `noiseBurst()` (`js/game.js:1956`),
  `AC` (`js/game.js:1927`).

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-elster-pool-klang/t1_klaenge.py`:

      ```python
      import json, socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9061, 9066)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      def start(page):
          page.goto(URL, wait_until="networkidle")
          page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
          if not page.evaluate("document.getElementById('tower-pick')"
                               ".classList.contains('hidden')"):
              page.click("#pick-10", timeout=20000)
          if page.locator("#btn-start").is_visible():
              page.click("#btn-start", timeout=20000)
          page.wait_for_timeout(600)

      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.5)
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader",
                                          "--autoplay-policy=no-user-gesture-required"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              start(page)

              # Der Hook muss sfx herausgeben, sonst kann niemand messen.
              hat = page.evaluate("""() => { const w = window.wipfelkratzer;
                return { hook: !!(w && w.sfx),
                         plaetschern: typeof (w.sfx || {}).plaetschern,
                         schoepfen:   typeof (w.sfx || {}).schoepfen,
                         splash:      typeof (w.sfx || {}).splash,
                         whoosh:      typeof (w.sfx || {}).whoosh }; }""")

              # Beide neuen Effekte laufen mit lebendem AudioContext durch und
              # hängen wirklich Knoten an den Graphen (running == AC existiert).
              lief = page.evaluate("""() => { const w = window.wipfelkratzer;
                try { w.sfx.plaetschern(); w.sfx.schoepfen(); return 'ok'; }
                catch (e) { return String(e); } }""")
              page.wait_for_timeout(1200)
              b.close()

          print(json.dumps({"hat": hat, "lief": lief}, indent=2, ensure_ascii=False))
          assert hat["hook"], "sfx fehlt auf dem Debug-Hook"
          assert hat["plaetschern"] == "function", hat
          assert hat["schoepfen"] == "function", hat
          assert hat["splash"] == "function", hat      # unangetastet
          assert hat["whoosh"] == "function", hat      # unangetastet
          assert lief == "ok", lief
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Sonde läuft rot.**
      `python3 .superpowers/sdd/2026-09-27-elster-pool-klang/t1_klaenge.py`
      bricht mit `AssertionError: sfx fehlt auf dem Debug-Hook` ab. Rot
      gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: Helfer `bubble()` einfügen.** In `js/game.js` direkt **nach**
      dem Ende von `noiseBurst()` (`js/game.js:1966`), vor `schedBeat()`:

      ```js
      /* Eine Wasserblase: kurzer Sinuston, dessen Tonhöhe aufwärts wandert.
         Das ist der hörbare Kern eines Tropfens — die aufsteigende Luftblase
         schrumpft und klingt dabei höher. Genau diese Aufwärtsbewegung fehlt
         drain(), das mit konstanten, absteigenden Tönen gluckert (#105). */
      function bubble(t, f0, f1, dur = 0.09, g = 0.07) {
        const o = tone(f0, t, dur, 'sine', g);
        if (o) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
      }
      ```

- [ ] **Step 4: Die beiden Effekte einfügen.** In `js/game.js` im
      `sfx`-Objekt, **nach** `drain()` (`js/game.js:1996-1998`) und vor der
      schliessenden `};`:

      ```js
        /* Eimer taucht in den Bach: ein kurzes Blubb mit einer Nachblase.
           Vorher lief hier whoosh() — der Kameraschwenk-Rauscher (#105). */
        schoepfen() { if (!AC) return; const t = AC.currentTime;
          noiseBurst(t, 0.3, 1800, 1100, 0.09);
          bubble(t, 300, 620, 0.14, 0.09);
          bubble(t + 0.12, 520, 780, 0.08, 0.05); },
        /* Eimer kippt ins Becken: ein heller Strahl und aufsteigende Blasen.
           Bewusst NICHT splash() — dessen Tiefpassfahrt bis 260 Hz ist der
           dumpfe Wumms, der für Wasserrutsche und Biberburg richtig ist, für
           ein flaches Becken aber nicht. Die Blasen liegen zufällig, damit
           die drei Fahrten pro Pool nicht identisch klingen (#105). */
        plaetschern() { if (!AC) return; const t = AC.currentTime;
          noiseBurst(t, 0.85, 1500, 900, 0.10);
          for (let i = 0; i < 5; i++) {
            const f = 420 + Math.random() * 380;
            bubble(t + 0.05 + Math.random() * 0.6, f, f * 1.7);
          } },
      ```

- [ ] **Step 5: `sfx` in den Debug-Hook.** In `js/game.js` die Zeile
      `askSplashdown, SPLASHDOWN_URL };` (`js/game.js:2840`) ersetzen durch:

      ```js
        /* sfx liegt hier, weil eine Playwright-Sonde nicht hören kann — sie
           umhüllt die Einträge mit Zählern und prüft so, welcher Effekt bei
           Elses Botengang wirklich gelaufen ist (#105). */
        sfx,
        askSplashdown, SPLASHDOWN_URL };
      ```

- [ ] **Step 6: Sonde läuft grün.**
      `python3 .superpowers/sdd/2026-09-27-elster-pool-klang/t1_klaenge.py`
      endet mit `T1 OK`. Bei `pageerror` **nicht** die Sonde anpassen, sondern
      die Ursache im Spiel suchen.

- [ ] **Step 7: Commit.**

      ```bash
      git add js/game.js
      git commit -m "feat(klang): Wasserblasen, Schöpf- und Plätschergeräusch

      Zwei neue sfx-Einträge und ein Helfer bubble() für Sinustöne mit
      aufwärts wandernder Tonhöhe — der hörbare Kern eines Wassertropfens.
      Noch nicht verdrahtet; sfx liegt jetzt auf dem Debug-Hook, damit eine
      Playwright-Sonde messen kann, welcher Effekt gelaufen ist.

      Refs #105"
      ```

---

### Task 2: Elses Botengang klingt nach Wasser

**Files:**
- Modify: `js/game.js:2882` — `sfx.whoosh()` → `sfx.schoepfen()` in
  `magpieAdvance()`
- Modify: `js/game.js:2899` — `sfx.splash()` → `sfx.plaetschern()` in
  `pourBucket()`
- Modify: `CHANGELOG.md` — Eintrag unter `## [Unreleased]` → `### Changed`
- Test: `.superpowers/sdd/2026-09-27-elster-pool-klang/t2_botengang.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `sfx.plaetschern()`, `sfx.schoepfen()` und
  `window.wipfelkratzer.sfx` aus Task 1.
- Consumes: `w.enterEdit(k)`, `w.addItem(id)`, `w.exitEdit()`,
  `w.poolEntries()`, `w.MAGPIE_DUR` — alle bereits auf dem Debug-Hook
  (`js/game.js:2822-2827`).
- Produces: keine neuen Bezeichner.

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-elster-pool-klang/t2_botengang.py`:

      ```python
      import json, socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9061, 9066)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      def start(page):
          page.goto(URL, wait_until="networkidle")
          page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
          if not page.evaluate("document.getElementById('tower-pick')"
                               ".classList.contains('hidden')"):
              page.click("#pick-10", timeout=20000)
          if page.locator("#btn-start").is_visible():
              page.click("#btn-start", timeout=20000)
          page.wait_for_timeout(600)

      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.5)
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader",
                                          "--autoplay-policy=no-user-gesture-required"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              start(page)

              # Einen leeren Pool aufs Dach stellen. addItem setzt fill = 0
              # (js/game.js:1499), also wird Else durstig.
              page.evaluate("""() => { const w = window.wipfelkratzer;
                w.enterEdit('roof'); w.addItem('pool'); w.exitEdit(); }""")
              page.wait_for_timeout(800)

              # Phasen kürzen — headless dauert der volle Botengang Minuten.
              # Nicht unter 0.4: die Giessphase löst erst bei k >= 0.5 aus.
              # Danach die Zähler anlegen, damit enterEdit/exitEdit (die
              # selbst whoosh() rufen) nicht mitgezählt werden.
              page.evaluate("""() => { const w = window.wipfelkratzer;
                Object.keys(w.MAGPIE_DUR).forEach(k => w.MAGPIE_DUR[k] = 0.6);
                w.zaehler = {};
                ['plaetschern','schoepfen','splash','whoosh'].forEach(n => {
                  const f = w.sfx[n].bind(w.sfx);
                  w.zaehler[n] = 0;
                  w.sfx[n] = function () { w.zaehler[n]++; return f.apply(null, arguments); };
                }); }""")

              # Auf den Endzustand pollen, nicht auf eine Zeitspanne wetten.
              page.wait_for_function(
                  "() => { const e = window.wipfelkratzer.poolEntries()[0];"
                  " return e && (e.fill | 0) >= 1; }", timeout=120000)
              page.wait_for_timeout(500)
              z = page.evaluate("() => window.wipfelkratzer.zaehler")
              fill = page.evaluate("() => window.wipfelkratzer.poolEntries()[0].fill")
              b.close()

          print(json.dumps({"zaehler": z, "fill": fill}, indent=2, ensure_ascii=False))
          assert z["schoepfen"] >= 1, z    # Bach: Blubb statt Kameraschwenk
          assert z["plaetschern"] >= 1, z  # Pool: Plätschern statt Wumms
          assert z["splash"] == 0, z       # der dumpfe Platscher bleibt weg
          assert z["whoosh"] == 0, z       # kein Kameraschwenk im Botengang
          assert fill >= 1, fill           # der Pool füllt sich weiterhin
          assert errs == [], errs
          print("T2 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Sonde läuft rot.**
      `python3 .superpowers/sdd/2026-09-27-elster-pool-klang/t2_botengang.py`
      bricht ab, weil `schoepfen` und `plaetschern` auf 0 stehen, während
      `whoosh` und `splash` gezählt haben — die Aufrufstellen zeigen noch auf
      die alten Effekte.

- [ ] **Step 3: Die Schöpfstelle umhängen.** In `js/game.js` in
      `magpieAdvance()` (`js/game.js:2880-2884`):

      ```js
        if (magPhase === 'schoepfen') {
          magInner.userData.bucketWater.visible = true;
          sfx.schoepfen();
          magpieEnter('bringen'); return;
        }
      ```

- [ ] **Step 4: Die Giessstelle umhängen.** In `js/game.js` in `pourBucket()`
      (`js/game.js:2896-2899`):

      ```js
      function pourBucket() {
        const en = magTarget;
        magInner.userData.bucketWater.visible = false;
        sfx.plaetschern();
      ```

      Der Rest von `pourBucket()` bleibt unverändert — insbesondere
      `sfx.chime(true)` beim vollen Becken (`js/game.js:2904`).

- [ ] **Step 5: Sonde läuft grün.**
      `python3 .superpowers/sdd/2026-09-27-elster-pool-klang/t2_botengang.py`
      endet mit `T2 OK`. Schlägt sie nach drei Versuchen weiter fehl: stoppen
      und erklären, nicht die Zusicherungen aufweichen.

- [ ] **Step 6: Changelog.** In `CHANGELOG.md` direkt unter
      `## [Unreleased]` einfügen:

      ```markdown
      ### Changed

      - Wenn Else Elster Wasser für den Pool holt, klingt es jetzt nach
        Wasser: ein Blubb, wenn sie den Eimer in den Bach taucht, und ein
        Plätschern mit aufsteigenden Blasen, wenn sie ihn ins Becken kippt.
        Vorher rauschte es dort, als würde die Kamera schwenken, und der
        Guss klang wie ein dumpfer Plumps (#105)
      ```

- [ ] **Step 7: Commit und Push — vor jeder weiteren Prüfung.**

      ```bash
      git add js/game.js CHANGELOG.md
      git commit -m "fix(klang): Elses Botengang plätschert statt zu rauschen

      pourBucket() rief splash() — einen Rauschstoss, dessen Tiefpass bis auf
      260 Hz abfällt und dadurch wie ein dumpfer Plumps klingt; die
      Schöpfphase rief whoosh(), den Effekt der Kameraflüge. Beide zeigen
      jetzt auf die Wasserklänge aus dem vorigen Commit. splash() und
      whoosh() selbst bleiben unverändert — Wasserrutsche, Biberburg und die
      Kameraflüge klingen wie bisher.

      Closes #105"
      git push
      ```

- [ ] **Step 8: Gesamtdurchlauf.** Beide Sonden noch einmal nacheinander im
      **Vordergrund** laufen lassen
      (`t1_klaenge.py`, dann `t2_botengang.py`); beide enden grün und ohne
      `pageerror`. Anschliessend den Port freigeben:
      `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.

---

## Selbstprüfung gegen die Spec

- Problem (beide Klangstellen) → Task 2, Steps 3 und 4.
- Helfer `bubble()` → Task 1, Step 3.
- `sfx.plaetschern()` / `sfx.schoepfen()` → Task 1, Step 4.
- Debug-Hook → Task 1, Step 5.
- AK 1 (Blubb am Bach) → T2, `schoepfen >= 1` und `whoosh == 0`.
- AK 2 (Plätschern am Pool) → T2, `plaetschern >= 1` und `splash == 0`.
- AK 3 (drei Fahrten klingen unterschiedlich) → die Zufallsstreuung in
  `plaetschern()` (Task 1, Step 4). Nicht maschinell prüfbar, weil die Sonde
  nicht hört; abgesichert dadurch, dass `Math.random()` im Code steht.
- AK 4 (Wasserrutsche, Biberburg, Kameraflüge unverändert) → T1 prüft, dass
  `splash` und `whoosh` weiter existieren; die Global Constraints verbieten,
  sie zu ändern.
- AK 5 (Pool füllt sich weiter) → T2, `fill >= 1`.
- AK 6 (kein `pageerror`) → beide Sonden.
- Nicht-Ziele → Global Constraints.
