# Plan — Hauptbutton für die Waldkarte (Issue #106)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Waldkarte bekommt einen Knopf «Waldkarte» in der
Werkzeugleiste, statt nur als «Meine Türme» im Extras-Menü zu stecken.

**Architecture:** Reine Markup-Änderung an `index.html`. Der bestehende
`#btn-staende` wandert aus `#extras-menu` (`index.html:324`) an die dritte
Stelle von `#toolbar` (`index.html:305-315`), seine Aufschrift wird
«Waldkarte», und die Überschrift des Dialogs (`index.html:440`) heisst gleich.
Kein neues CSS, kein neues JavaScript: `#toolbar > button` und die
Basisregeln (`index.html:34-37`, `:59-60`) gelten sofort, und der Handler
`js/game.js:2640` hängt an der `id`, nicht am Ort.

**Tech Stack:** Vanilla HTML/CSS/JS, three.js über Importmap. Kein Build,
kein Bundler, kein Test-Runner. Verifikation ist headless Playwright im
Vordergrund.

**Spec:** `docs/ai-notes/specs/2026-09-27-waldkarte-hauptbutton-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei**.
- **`js/game.js`, `js/staende.js` und `js/standdatei.js` bleiben unverändert.**
  Wer dort etwas ändert, hat den Zuschnitt verlassen (Spec, E7).
- **Die `id` `btn-staende` bleibt.** An ihr hängt `js/game.js:2640`.
- **Kein zweiter Weg zur Karte.** Der Knopf wandert, er wird nicht kopiert
  (Spec, E1).
- **Keine Klasse `primary` auf dem neuen Knopf.** «Stockwerk bauen» bleibt der
  einzige grüne Knopf der Leiste (Spec, E6).
- **`#btn-intro-staende` bleibt «Meine Türme»** (Spec, E4).
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Changed`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(ui)` bzw. `docs(changelog)`.

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-waldkarte-hauptbutton/`
(in `.gitignore`, Zeile `.superpowers/`). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9061–9065** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden (`srv.terminate()` im
  `finally`, kein `pkill -f`, das Muster träfe den eigenen Aufruf).
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- Startablauf: Ohne Spielstand zeigt das Intro die Turmwahl
  (`js/game.js:2751`), also erst `#pick-10` klicken, falls `#tower-pick` nicht
  `hidden` ist, dann `#btn-start` (`index.html:473,477`).
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:2810`) — die Sonden warten
  darauf, bevor sie messen.

---

### Task 1: Der Knopf steht in der Werkzeugleiste

**Files:**
- Modify: `index.html:305-315` (Block `#toolbar`), `index.html:324`
  (Block `#extras-menu`), `index.html:440` (Überschrift `#staende`)
- Test: `.superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t1_hauptbutton.py`

**Interfaces:**
- Produces: `#btn-staende` ist ein direktes Kind von `#toolbar`, drittes
  Element, Text «Waldkarte», ohne Klasse `primary`. `#extras-menu` enthält ihn
  nicht mehr. `#staende h2` lautet «Waldkarte».
- Consumes: `$('btn-staende').onclick` (`js/game.js:2640`) und
  `oeffneStaende()` (`js/game.js:2635`) — beide unverändert.

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t1_hauptbutton.py`:

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
              page.wait_for_function("window.wipfelkratzer !== undefined",
                                     timeout=40000)
              if not page.evaluate("document.getElementById('tower-pick')"
                                   ".classList.contains('hidden')"):
                  page.click("#pick-10", timeout=20000)
              if page.locator("#btn-start").is_visible():
                  page.click("#btn-start", timeout=20000)
              page.wait_for_timeout(600)

              platz = page.evaluate("""() => {
                const tb = document.getElementById('toolbar');
                const kn = document.getElementById('btn-staende');
                return {
                  inLeiste: !!kn && kn.parentElement === tb,
                  stelle: kn ? [...tb.children].indexOf(kn) + 1 : -1,
                  text: kn ? kn.textContent.trim() : null,
                  gruen: kn ? kn.classList.contains('primary') : null,
                  imMenue: !!document.querySelector('#extras-menu #btn-staende'),
                  menueEintraege: document.querySelectorAll('#extras-menu button').length,
                  ueberschrift: document.querySelector('#staende h2').textContent.trim(),
                  introText: document.getElementById('btn-intro-staende')
                               .textContent.trim(),
                }
              }""")

              # Das Extras-Menü offen lassen: derselbe Klick muss es zumachen.
              page.click("#btn-extras", timeout=20000)
              page.wait_for_timeout(300)
              menue_vorher = page.evaluate(
                  "() => document.getElementById('extras-menu').classList.contains('open')")
              page.click("#btn-staende", timeout=20000)
              page.wait_for_timeout(900)
              wirkung = page.evaluate("""() => ({
                offen: document.getElementById('staende').classList.contains('open'),
                karte: document.getElementById('stand-grid')
                         .classList.contains('waldkarte'),
                lichtungen: document.querySelectorAll('#stand-grid .lichtung').length,
                menueZu: !document.getElementById('extras-menu').classList.contains('open'),
              })""")
              b.close()

          print(json.dumps({"platz": platz, "wirkung": wirkung,
                            "menue_vorher": menue_vorher},
                           indent=2, ensure_ascii=False))
          assert platz["inLeiste"], "#btn-staende hängt nicht in #toolbar"
          assert platz["stelle"] == 3, platz["stelle"]
          assert platz["text"] == "Waldkarte", platz["text"]
          assert platz["gruen"] is False, "der Knopf ist grün (primary)"
          assert not platz["imMenue"], "der Knopf steht noch im Extras-Menü"
          assert platz["menueEintraege"] == 6, platz["menueEintraege"]
          assert platz["ueberschrift"] == "Waldkarte", platz["ueberschrift"]
          assert platz["introText"] == "Meine Türme", platz["introText"]
          assert menue_vorher, "das Extras-Menü liess sich nicht öffnen"
          assert wirkung["offen"], "die Übersicht ging nicht auf"
          assert wirkung["karte"], "#stand-grid trägt die Klasse waldkarte nicht"
          assert wirkung["lichtungen"] == 4, wirkung["lichtungen"]
          assert wirkung["menueZu"], "das Extras-Menü blieb offen"
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Sonde läuft rot.**
      `python3 .superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t1_hauptbutton.py`
      bricht mit `AssertionError: #btn-staende hängt nicht in #toolbar` ab.
      Rot gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: Den Knopf in die Werkzeugleiste setzen.** In `index.html` den
      Block `#toolbar` (`index.html:305-315`) so ändern, dass der neue Knopf
      als drittes Element zwischen «Einrichten» und «Extras» steht. Der Block
      lautet danach **wörtlich**:

      ```html
      <div id="toolbar">
        <button id="btn-build" class="primary">Stockwerk bauen</button>
        <button id="btn-catalog">Einrichten</button>
        <button id="btn-staende">Waldkarte</button>
        <button id="btn-extras">Extras</button>
        <button id="btn-night">Nacht</button>
        <button id="btn-season">Sommer</button>
        <button id="btn-cutaway">Wände weg</button>
        <button id="btn-besuch">Hineingehen</button>
        <button id="btn-photo">Foto</button>
        <button id="btn-music">Musik aus</button>
      </div>
      ```

- [ ] **Step 4: Den alten Eintrag aus dem Extras-Menü entfernen.** In
      `index.html` die Zeile

      ```html
        <button id="btn-staende">Meine Türme</button>
      ```

      aus dem Block `#extras-menu` (`index.html:317-325`) **löschen**. Der
      Block lautet danach wörtlich:

      ```html
      <div id="extras-menu" class="panel">
        <button id="btn-bridge">Brücke bauen</button>
        <button id="btn-garden">Garten &amp; Spielplatz</button>
        <button id="btn-sign">Bewohner-Schild</button>
        <button id="btn-animals">Tier-Übersicht</button>
        <button id="btn-gallery">Fotogalerie</button>
        <button id="btn-party" class="primary hidden">Dachparty feiern!</button>
      </div>
      ```

      Zwei Knöpfe mit derselben `id` wären sonst im Dokument, und
      `document.getElementById` träfe den ersten — ein Fehler, der sich als
      «der Knopf tut nichts» zeigen würde, nicht als Meldung.

- [ ] **Step 5: Die Überschrift des Dialogs angleichen.** In `index.html`
      (`index.html:440`)

      ```html
          <h2>Meine Türme</h2>
      ```

      ersetzen durch

      ```html
          <h2>Waldkarte</h2>
      ```

      `#btn-intro-staende` (`index.html:478`) bleibt «Meine Türme» — dort gibt
      es noch keinen Wald (Spec, E4).

- [ ] **Step 6: Commit und Push.**

      ```bash
      git add index.html
      git commit -m "feat(ui): Waldkarte als Hauptbutton in der Werkzeugleiste"
      git push
      ```

- [ ] **Step 7: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t1_hauptbutton.py`
      druckt `T1 OK`.

---

### Task 2: Schmalansicht, Abnahme und Changelog

**Files:**
- Modify: `CHANGELOG.md` (Abschnitt `## [Unreleased]`)
- Test: `.superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t2_abnahme.py`

**Interfaces:**
- Consumes: das Markup aus Task 1 (`#btn-staende` in `#toolbar`).
- Produces: keine neuen Namen.

- [ ] **Step 1: Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t2_abnahme.py`,
      derselbe Rahmen wie T1 (Server, Chromium-Flags, Intro-Ablauf,
      `pageerror`-Sammler), aber mit
      `viewport={"width": 400, "height": 800}` und diesen Prüfungen:

      ```python
      # 1. Trefferfläche und Sichtbarkeit auf 400 px Breite
      kasten = page.locator("#btn-staende").bounding_box()
      assert kasten is not None and kasten["height"] >= 44, kasten
      assert page.locator("#btn-staende").is_visible()

      # 2. Die Leiste scrollt nicht waagrecht, und --toolbar-h stimmt mit
      #    ihrer wirklichen Höhe überein (daran hängen #selbar, #wishes,
      #    #extras-menu, #catalog, #toast-stack — js/game.js:826-828).
      mass = page.evaluate("""() => {
        const tb = document.getElementById('toolbar');
        const v = getComputedStyle(document.documentElement)
                    .getPropertyValue('--toolbar-h').trim();
        return { scroll: tb.scrollWidth <= tb.clientWidth + 1,
                 gemeldet: parseFloat(v), echt: tb.offsetHeight };
      }""")
      assert mass["scroll"], mass
      assert abs(mass["gemeldet"] - mass["echt"]) < 1.5, mass

      # 3. Der Knopf öffnet die Karte auch hier
      page.click("#btn-staende", timeout=20000)
      page.wait_for_timeout(900)
      assert page.evaluate(
          "() => document.getElementById('staende').classList.contains('open')")
      page.click("#btn-standclose", timeout=20000)
      page.wait_for_timeout(400)

      # 4. Der Intro-Knopf tut weiterhin dasselbe
      page.reload(wait_until="networkidle")
      page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
      page.click("#btn-intro-staende", timeout=20000)
      page.wait_for_timeout(900)
      assert page.evaluate(
          "() => document.getElementById('staende').classList.contains('open')")

      # 5. Kein pageerror über den ganzen Lauf
      assert errs == [], errs
      print("T2 OK")
      ```

      Zusätzlich im selben Skript, ohne Browser — die drei Dateien dürfen sich
      nicht geändert haben (Spec, Zuschnitt):

      ```python
      import subprocess
      geaendert = subprocess.run(
          ["git", "diff", "--name-only", "origin/main...HEAD"],
          cwd=ROOT, capture_output=True, text=True).stdout.split()
      for f in ("js/game.js", "js/staende.js", "js/standdatei.js"):
          assert f not in geaendert, (f, geaendert)
      ```

- [ ] **Step 2: Sonde laufen lassen.**
      `python3 .superpowers/sdd/2026-09-27-waldkarte-hauptbutton/t2_abnahme.py`
      druckt `T2 OK`. Jeder Fehlschlag ist ein Mangel aus Task 1, keine
      Sondenschwäche. Bei drei erfolglosen Versuchen an derselben Stelle
      anhalten und den Befund in der PR-Beschreibung festhalten, statt weiter
      zu raten.

- [ ] **Step 3: Changelog-Eintrag.** In `CHANGELOG.md` unter
      `## [Unreleased]` einen Abschnitt `### Changed` anlegen (falls er dort
      noch fehlt) und darin ergänzen:

      ```markdown
      ### Changed

      - Die Waldkarte hat jetzt einen eigenen Knopf in der Leiste unten: Du
        tippst auf «Waldkarte» und bist sofort im Wald bei Deinen Türmen.
        Vorher musste man erst «Extras» öffnen und dort «Meine Türme» suchen
        (#106)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Hauptbutton für die Waldkarte (#106)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Die Ausgabe **beider**
      Sonden einfügen, dazu `git diff --name-only origin/main...HEAD` (es
      sollten genau `index.html` und `CHANGELOG.md` erscheinen), und den
      **manuellen In-Browser-Playtest als offenen Posten** benennen — er ist
      das eigentliche Gate dieses Stacks und darf nicht als erledigt behauptet
      werden. Ebenfalls dort vermerken: geprüft wurde bei 1280 px und 400 px
      Breite, aber nicht auf einem echten Tablet.
