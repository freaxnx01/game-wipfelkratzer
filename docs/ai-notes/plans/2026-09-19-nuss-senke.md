# Plan — Die Nüsse bekommen einen Zweck (Issue #83)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brücke (9) und Garten & Spielplatz (15) kosten Haselnüsse statt
gratis zu sein. Möbel bleiben kostenlos.

**Architecture:** Eine Preistabelle und eine gemeinsame Kaufprüfung neben den
beiden bestehenden Extras-Handlern (`js/game.js:1715-1729`). Die Handler
bekommen davor ein Tor; ihr Rumpf bleibt unverändert. Die Knopfbeschriftung
trägt den Preis, solange das Extra fehlt. Kein neues Spielstandfeld —
`state.nuts` existiert bereits.

**Tech Stack:** Vanilla ES-Module. Kein Build, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-19-nuss-senke-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`).
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine Testdatei**.
- **Möbel bleiben gratis.** Wer irgendwo im Katalog oder in `addItem` einen
  Preis einbaut, hat den Zuschnitt verlassen — Nüsse verdient man **nur**
  durch Aufstellen des Wunschmöbels (`js/game.js:1655-1661`), ein Preis
  darauf wäre eine Sackgasse.
- **Die Dachparty bleibt kostenlos.** Das Finale wird nicht verkauft.
- **Kein neues Feld im Spielstand.** `state.nuts`, `state.bridge` und
  `state.garden` gibt es schon; das Format ändert sich nicht.
- **Ein zu teures Extra ändert gar nichts** — kein Zustand, kein `save()`,
  nur ein Hinweis. Der Knopf wird **nicht** gesperrt (`disabled`): ein graues
  Feld sagt einem Kind nichts.
- **Wer ein Extra schon besitzt, zahlt nicht nach.** Die Handler steigen wie
  heute vorher aus.
- **Touch first.** Die Knöpfe bleiben mindestens 44 px hoch.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(spiel)`.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-19-nuss-senke/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9051–9055** (erster freier). Nur der Server darf in den Hintergrund.
  Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`,
  jeder `page.click` mit `timeout=20000`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Über die echten Knöpfe kaufen, nicht über Funktionsaufrufe.** Das
  Extras-Menü öffnet `#btn-extras`, danach liegt `#btn-bridge` darin.
- Den Nussstand setzt die Sonde über den Debug-Hook:
  `w.state.nuts = 12; w.speichern();` — danach `updateHUD()` auslösen, indem
  das Menü neu geöffnet wird, oder direkt `w.updateHUD()` rufen, falls
  exportiert.
- **Diese Änderung animiert nichts an der Kamera.** Die Ankunftsregel aus dem
  Stack-Overlay ist hier nicht nötig; ein `wait_for_timeout` nach dem Klick
  genügt, weil nur Zustand und Text geprüft werden.

---

### Task 1: Preise, Beschriftung und der Kauf der Brücke

**Files:**
- Modify: `js/game.js:1715-1719` (`#btn-bridge`-Handler), neuer Abschnitt davor
- Modify: `js/game.js:878` (`updateHUD`)
- Modify: `js/game.js:2058-2069` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-19-nuss-senke/t1_bruecke.py`

**Interfaces:**
- Produces: `const EXTRA_PREIS = { bridge: 9, garden: 15 }`
- Produces: `bezahle(key) → boolean` — zieht den Preis ab und liefert `true`,
  oder meldet die fehlende Anzahl und liefert `false`, ohne etwas zu ändern.
- Produces: `beschrifteExtras()` — schreibt Preis oder Normaltext auf beide
  Knöpfe; wird von `updateHUD()` gerufen.
- Produces: im Debug-Hook zusätzlich `EXTRA_PREIS` und `updateHUD`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-nuss-senke/t1_bruecke.py`:

      ```python
      import json, socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9051, 9056)
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
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              start(page)

              # Ohne Nüsse: Preis steht auf dem Knopf, der Tipp ändert nichts.
              page.evaluate("() => { const w = window.wipfelkratzer;"
                            " w.state.nuts = 0; w.updateHUD(); }")
              page.click("#btn-extras", timeout=20000)
              page.wait_for_timeout(300)
              text_arm = page.evaluate("() => document.getElementById('btn-bridge').textContent")
              page.click("#btn-bridge", timeout=20000)
              page.wait_for_timeout(800)
              arm = page.evaluate("""() => { const w = window.wipfelkratzer;
                return { bridge: w.state.bridge, nuts: w.state.nuts,
                         hinweis: [...document.querySelectorAll('#toast-stack .toast-item')]
                                    .map(t => t.textContent).join(' | ') }; }""")

              # Mit genug Nüssen: Kauf zieht ab und baut.
              page.evaluate("() => { const w = window.wipfelkratzer;"
                            " w.state.nuts = 12; w.updateHUD(); }")
              page.click("#btn-extras", timeout=20000)
              page.wait_for_timeout(300)
              page.click("#btn-bridge", timeout=20000)
              page.wait_for_timeout(1200)
              reich = page.evaluate("""() => { const w = window.wipfelkratzer;
                return { bridge: w.state.bridge, nuts: w.state.nuts }; }""")
              b.close()

          print(json.dumps({"text": text_arm, "arm": arm, "reich": reich},
                           indent=2, ensure_ascii=False))
          assert "9" in text_arm, f"Preis fehlt auf dem Knopf: {text_arm!r}"
          assert arm["bridge"] is False, arm
          assert arm["nuts"] == 0, arm
          assert "Haselnüsse" in arm["hinweis"], arm
          assert reich["bridge"] is True, reich
          assert reich["nuts"] == 3, reich          # 12 - 9
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-19-nuss-senke/t1_bruecke.py` bricht mit
      `AssertionError: Preis fehlt auf dem Knopf: 'Brücke bauen'` ab. Rot
      gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: Preistabelle und Kaufprüfung einfügen.** In `js/game.js`
      direkt **vor** `$('btn-bridge').onclick` (`js/game.js:1715`):

      ```js
      /* ---------- Was die Welt kostet (#83) ---------- */
      /* Möbel bleiben gratis: Nüsse verdient man nur durch Aufstellen des
         Wunschmöbels (js/game.js:1655-1661) — ein Preis darauf wäre eine
         Sackgasse, weil ein Kind ohne Nüsse dann keine verdienen könnte.
         Bezahlt wird, was die Welt verändert, und davon gibt es genau zwei. */
      const EXTRA_PREIS = { bridge: 9, garden: 15 };

      /* Zieht den Preis ab, oder erklärt, wie viele Nüsse fehlen. Ein zu
         teures Extra ändert gar nichts — kein Zustand, kein save(). Der Knopf
         bleibt bedienbar: ein graues Feld sagt einem Kind nichts, ein Tipp,
         der die Spielregel erklärt, bringt sie ihm bei. */
      function bezahle(key) {
        const preis = EXTRA_PREIS[key];
        if (state.nuts >= preis) { state.nuts -= preis; updateHUD(); return true; }
        const fehlt = preis - state.nuts;
        toast(`Dafür brauchst Du noch ${fehlt} ${fehlt === 1 ? 'Haselnuss' : 'Haselnüsse'} — erfülle noch einen Wunsch!`);
        sfx.knock();
        return false;
      }

      /* Der Preis steht auf dem Knopf, solange das Extra fehlt. Danach der
         gewohnte Text — bezahlt wird nur einmal. */
      function beschrifteExtras() {
        $('btn-bridge').textContent = state.bridge
          ? 'Brücke bauen' : `Brücke bauen — ${EXTRA_PREIS.bridge} 🌰`;
        $('btn-garden').textContent = state.garden
          ? 'Garten & Spielplatz' : `Garten & Spielplatz — ${EXTRA_PREIS.garden} 🌰`;
      }
      ```

- [ ] **Step 4: `updateHUD` beschriftet mit.** In `js/game.js:878` ans Ende
      des Rumpfes von `updateHUD()` ergänzen:

      ```js
        beschrifteExtras();
      ```

      `updateHUD()` läuft beim Start und nach jeder Zustandsänderung, die den
      Nussstand betrifft — damit stimmt die Beschriftung immer, ohne einen
      zweiten Auslöser.

      **Reihenfolge beachten:** `EXTRA_PREIS` ist ein `const` und steht bei
      Zeile ~1715, `updateHUD` ist eine Funktionsdeklaration bei 878. Das geht
      nur gut, weil der einzige Aufruf auf oberster Ebene bei `js/game.js:2728`
      steht, also **nach** der Tabelle; alle übrigen Aufrufe stecken in
      Funktionsrümpfen und laufen erst auf Benutzeraktion. Wer `updateHUD()`
      weiter nach oben zieht oder die Tabelle weiter nach unten schiebt, bekommt
      beim Laden `ReferenceError: Cannot access 'EXTRA_PREIS' before
      initialization` — und das Spiel startet gar nicht.

- [ ] **Step 5: Der Brücken-Handler bekommt ein Tor.** `js/game.js:1715-1719`
      wird zu:

      ```js
      $('btn-bridge').onclick = () => { $('extras-menu').classList.remove('open');
        if (state.bridge) { toast('Die Brücke steht schon!'); return; }
        if (!bezahle('bridge')) return;
        state.bridge = true; bridge.visible = true; bridge.scale.setScalar(0.01);
        tween(0.6, q => bridge.scale.setScalar(0.01 + 0.99 * q));
        sfx.knock(); toast('Willi baut eine Brücke über den Fluss!'); save(); };
      ```

      Die Reihenfolge ist wesentlich: **erst** die Besitzprüfung, **dann** die
      Bezahlung. Wer die Brücke schon hat, zahlt nicht nach.

- [ ] **Step 6: Debug-Hook ergänzen** (`js/game.js:2058-2069`):

      ```js
        EXTRA_PREIS, updateHUD,
      ```

- [ ] **Step 7: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-nuss-senke/t1_bruecke.py` druckt
      `T1 OK`.

- [ ] **Step 8: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(spiel): die Brücke kostet neun Haselnüsse"
      git push
      ```

---

### Task 2: Der Spielplatz kostet

**Files:**
- Modify: `js/game.js:1720-1729` (`#btn-garden`-Handler)
- Test: `.superpowers/sdd/2026-09-19-nuss-senke/t2_spielplatz.py`

**Interfaces:**
- Consumes: `bezahle(key)`, `EXTRA_PREIS`, `beschrifteExtras()` aus Task 1.
- Produces: keine neuen Namen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-19-nuss-senke/t2_spielplatz.py`, gleicher
      Rahmen wie T1. Drei Fälle:

      ```python
      # Preis auf dem Knopf
      page.click("#btn-extras", timeout=20000); page.wait_for_timeout(300)
      assert "15" in page.evaluate("() => document.getElementById('btn-garden').textContent")

      # Mit 10 Nüssen (zu wenig): nichts passiert
      page.evaluate("() => { const w=window.wipfelkratzer; w.state.nuts=10; w.updateHUD(); }")
      page.click("#btn-garden", timeout=20000); page.wait_for_timeout(900)
      arm = page.evaluate("""() => { const w=window.wipfelkratzer;
        return { garten: w.state.garden, nuts: w.state.nuts,
                 edit: !!w.edit }; }""")
      assert arm["garten"] is False and arm["nuts"] == 10, arm
      assert arm["edit"] is False, "das Einrichten darf nicht starten, wenn nicht bezahlt wurde"

      # Mit 20 Nüssen: Kauf, Abzug, Spielplatz steht
      page.evaluate("() => { const w=window.wipfelkratzer; w.state.nuts=20; w.updateHUD(); }")
      page.click("#btn-extras", timeout=20000); page.wait_for_timeout(300)
      page.click("#btn-garden", timeout=20000); page.wait_for_timeout(1500)
      reich = page.evaluate("""() => { const w=window.wipfelkratzer;
        return { garten: w.state.garden, nuts: w.state.nuts,
                 objekte: (w.state.rooms.garten || []).length }; }""")
      assert reich["garten"] is True and reich["nuts"] == 5, reich
      assert reich["objekte"] > 0, reich
      ```

- [ ] **Step 2: Test läuft rot.** Der Preis fehlt auf dem Knopf, und mit zehn
      Nüssen entsteht der Spielplatz trotzdem.

- [ ] **Step 3: Der Garten-Handler bekommt dasselbe Tor.**
      `js/game.js:1720-1729` wird zu:

      ```js
      $('btn-garden').onclick = () => { $('extras-menu').classList.remove('open');
        if (state.garden) { enterEdit('garten'); return; }
        if (!bezahle('garden')) return;
        state.garden = true;
        state.rooms.garten = GARDEN_DEFAULT.map(e => ({ ...e }));
        roomOf('garten').forEach(e => { const m = placeItemMesh('garten', e); clampEntry('garten', m, e); });
        gartenG.visible = true; gartenG.scale.setScalar(0.01);
        tween(0.6, q => gartenG.scale.setScalar(0.01 + 0.99 * q));
        sfx.pop(); toast('Spielplatz, Beete und Blumen — fertig!'); save();
        enterEdit('garten'); };
      ```

      Auch hier gilt: wer den Spielplatz schon hat, geht wie bisher direkt ins
      Einrichten und zahlt nicht nach.

- [ ] **Step 4: Test grün.**
      `python3 .superpowers/sdd/2026-09-19-nuss-senke/t2_spielplatz.py` druckt
      `T2 OK`.

- [ ] **Step 5: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(spiel): der Spielplatz kostet fünfzehn Haselnüsse"
      git push
      ```

---

### Task 3: Bestehende Spielstände, Abnahme und Changelog

**Files:**
- Modify: `CHANGELOG.md`
- Test: `.superpowers/sdd/2026-09-19-nuss-senke/t3_abnahme.py`

**Interfaces:**
- Consumes: alles aus Task 1–2.

- [ ] **Step 1: Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-19-nuss-senke/t3_abnahme.py` prüft die
      Akzeptanzkriterien am Stück:

      1. **Bestehender Besitz wird nicht belastet:** einen Spielstand mit
         `bridge: true`, `garden: true` und `nuts: 20` über
         `page.add_init_script` vorbelegen (nur setzen, wenn noch nichts da
         ist), dann beide Knöpfe tippen. Erwartet: `state.nuts` bleibt 20, und
         beide Knöpfe tragen ihren Normaltext ohne Preis.
      2. **Der Nussstand überlebt den Neuladen:** mit 12 Nüssen die Brücke
         kaufen, `page.wait_for_timeout(700)`, `page.reload()`, danach ist
         `state.nuts === 3` und `state.bridge === true`.
      3. **Möbel kosten nichts:** mit 0 Nüssen eine Wohnung betreten und
         `addItem('bett')` über die Oberfläche aufstellen; `state.nuts` bleibt
         0 und das Möbel liegt im Raum.
      4. **Die Dachparty bleibt kostenlos:** `state.floors = MAXF` setzen, eine
         Wohnung im obersten Stock einrichten, bis der Party-Knopf erscheint
         (`#btn-party` ohne `hidden`), mit 0 Nüssen tippen — die Party startet
         (`partyG.visible === true` bzw. der Knopftext wechselt auf «Party
         beenden»).
      5. Konsole ohne `pageerror` über den ganzen Lauf.

- [ ] **Step 2: Sonde laufen lassen und rote Punkte beheben.** Jeder
      Fehlschlag ist ein Mangel in Task 1–2, keine Sondenschwäche. Bei drei
      erfolglosen Versuchen an derselben Stelle anhalten und den Befund in der
      PR-Beschreibung festhalten, statt weiter zu raten.

- [ ] **Step 3: Changelog-Eintrag.** Unter `## [Unreleased]` → `### Added`
      (Abschnitt anlegen, falls er fehlt):

      ```markdown
      - Die Haselnüsse sind jetzt zu etwas gut: Für neun baut Willi die Brücke
        über den Fluss, für fünfzehn entstehen Garten und Spielplatz. Nüsse
        bekommst Du wie bisher, wenn Du einem Bewohner seinen Wunsch erfüllst
        — drei Stück pro Wunsch. Möbel kosten weiterhin nichts, und wer
        Brücke oder Spielplatz schon hat, behält sie natürlich. Fehlen noch
        welche, sagt Dir das Spiel, wie viele (#83)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Nüsse bezahlen Brücke und Spielplatz (#83)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Vor/Nach-Ausgabe **jeder**
      Sonde einfügen, dazu `git diff --name-only` gegen `main`. Den **manuellen
      In-Browser-Playtest als offenen Posten** benennen — hier zählt er
      doppelt: ob sich neun und fünfzehn für ein Kind richtig anfühlen, sagt
      keine Sonde. Ebenfalls vermerken, dass ein bestehender Spielstand ohne
      Brücke sie künftig verdienen muss; das ist beabsichtigt.
