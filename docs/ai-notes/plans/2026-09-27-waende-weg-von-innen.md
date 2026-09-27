# Plan — «Wände weg» wirkt auch von innen (Issue #95)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wer im Besuchsmodus in einer Wohnung steht und «Wände weg» drückt,
sieht die Vorderwände verschwinden und blickt aus dem Zimmer hinaus — ohne dass
der Besuch den Spielstand verändert.

**Architecture:** Zwei kleine Eingriffe in `js/game.js`. `applyFronts()` liest
statt der Sonderregel «im Besuch stehen die Wände immer» eine einzige Quelle:
im Besuch das nicht gespeicherte Merkmal `besuch.wandWeg`, sonst wie bisher
`state.cutaway`. Der Knopf `#btn-cutaway` bekommt einen Vorabzweig, der im
Besuch nur dieses Merkmal umlegt — ohne `save()`, ohne Schreiben an `state`.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap, `OrbitControls`.
Kein Build, kein Bundler, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-waende-weg-von-innen-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), Anredefürwörter gross (`Du`,
  `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei**.
- **Der Besuch verändert den Spielstand nicht.** Im Besuchszweig kein `save()`
  und kein Schreiben an `state` — `localStorage` ist vor und nach dem Besuch
  byte-gleich (Zusage aus #44, `js/game.js:1112-1114`).
- **`state.cutaway` bleibt die alleinige Quelle für die Aussenansicht.** Kein
  zweites gespeichertes Feld, kein Eintrag in `js/standdatei.js`.
- **Nur Vorderwände.** Rück- und Seitenwände werden nicht angefasst (Spec, E1).
- **Kein neuer Knopf, keine Änderung an `#besuchbar`** (Spec, E4).
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Fixed`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `fix(turm)` für den Code, `docs(changelog)` für
  den Changelog.

## Was dieser Plan nicht baut

Kein Wegnehmen der Rück- und Seitenwände, keine Lösung für die «Lücke zwischen
Wand und Decke» (eigenes Issue aus #91), kein Speichern des inneren Zustands,
keine Tastaturbedienung. Wer davon etwas anfängt, hat den Zuschnitt verlassen.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-27-waende-weg-von-innen/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9061–9065** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr.**
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Einen Turm aufbauen** geht über den Debug-Hook
  (`window.wipfelkratzer`, `js/game.js:2810`):
  `w.state.floors = 3; w.speichern();` und danach `page.reload()`, damit die
  Etagen wirklich entstehen.
- **Die Kamera fährt über `moveCam` rund eine Sekunde und schwingt mit
  `enableDamping` nach.** Dieser Plan prüft aber **Sichtbarkeiten**, keine
  Kamerapositionen — nach einem Klick genügt `page.wait_for_timeout(300)`,
  weil `applyFronts()` synchron im Klick läuft. Wer trotzdem eine Kamera misst,
  wartet auf Ankunft (`w.tweenCount() === 0`), nicht auf Stillstand.
- Der Besuch lässt sich auch direkt über den Hook fahren
  (`w.enterBesuch(0)`, `w.exitBesuch()`, `w.besuch`), aber **die
  Abnahmeprüfung klickt echte Knöpfe** (`#btn-besuch`, `#btn-cutaway`) — genau
  der Pfad, der heute kaputt ist.

---

### Task 1: «Wände weg» wirkt im Besuch

**Files:**
- Modify: `js/game.js:1109-1117` (`applyFronts`)
- Modify: `js/game.js:1246-1247` (`enterBesuch`, Anfangswert des Merkmals)
- Modify: `js/game.js:1923-1924` (`$('btn-cutaway').onclick`)
- Test: `.superpowers/sdd/2026-09-27-waende-weg-von-innen/t1_innen.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Produces: `besuch.wandWeg` — `boolean`, Teil des bestehenden
  `besuch`-Objekts (`js/game.js:1195`), **nicht** Teil von `state`, **nicht**
  gespeichert. `true` heisst «die Vorderwände sind weg». Über den Debug-Hook
  als `window.wipfelkratzer.besuch.wandWeg` lesbar, weil `besuch` dort schon
  als Getter hängt (`js/game.js:2822`).
- Produces: `applyFronts()` bleibt namens- und signaturgleich (keine
  Argumente, kein Rückgabewert).

- [ ] **Step 1: Die rote Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-waende-weg-von-innen/t1_innen.py`:

      ```python
      import re
      from playwright.sync_api import sync_playwright

      PORT = 9061  # ersten freien Port aus 9061-9065 nehmen
      URL = f"http://127.0.0.1:{PORT}/"

      FRONTS_WEG = """() => { const w = window.wipfelkratzer;
        const gs = []; for (let i = 0; i <= w.MAXF; i++) if (w.floorGroups[i]) gs.push(w.floorGroups[i]);
        return gs.length > 0 && gs.every(g => g.userData.front.visible === false); }"""
      FRONTS_DA = """() => { const w = window.wipfelkratzer;
        const gs = []; for (let i = 0; i <= w.MAXF; i++) if (w.floorGroups[i]) gs.push(w.floorGroups[i]);
        return gs.length > 0 && gs.every(g => g.userData.front.visible === true); }"""

      with sync_playwright() as p:
          browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = browser.new_page()
          fehler = []
          page.on("pageerror", lambda e: fehler.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")

          page.click("#btn-besuch", timeout=20000)
          page.wait_for_timeout(300)
          assert page.evaluate("() => !!window.wipfelkratzer.besuch"), "Besuch nicht gestartet"
          assert page.evaluate(FRONTS_DA), "AK6: beim Betreten müssen die Wände stehen"
          assert page.evaluate("() => window.wipfelkratzer.besuch.wandWeg === false"), \
              "AK6: besuch.wandWeg beginnt mit false"

          page.click("#btn-cutaway", timeout=20000)
          page.wait_for_timeout(300)
          assert page.evaluate(FRONTS_WEG), "AK1: drinnen muss «Wände weg» die Vorderwände wegnehmen"
          assert page.inner_text("#btn-cutaway").strip() == "Wände hin", \
              "AK3: die Aufschrift folgt dem inneren Zustand"

          page.click("#btn-cutaway", timeout=20000)
          page.wait_for_timeout(300)
          assert page.evaluate(FRONTS_DA), "AK2: der zweite Druck stellt die Wände wieder her"
          assert page.inner_text("#btn-cutaway").strip() == "Wände weg", "AK3: Aufschrift zurück"

          assert not fehler, f"AK9: pageerror: {fehler}"
          print("T1 OK")
          browser.close()
      ```

- [ ] **Step 2: Sonde laufen lassen — sie muss ROT sein.**

      ```bash
      python3 -m http.server 9061 &   # nur der Server in den Hintergrund
      python3 .superpowers/sdd/2026-09-27-waende-weg-von-innen/t1_innen.py
      ```

      Erwartet: `AssertionError: AK1: drinnen muss «Wände weg» die Vorderwände
      wegnehmen` — heute erzwingt `applyFronts()` im Besuch alle Wände. Läuft
      die Sonde grün durch, stimmt die Sonde nicht, nicht der Code: prüfen,
      ob der Besuch wirklich gestartet ist.

- [ ] **Step 3: `applyFronts()` auf eine Quelle umstellen.** In
      `js/game.js:1109-1117` den Rumpf ersetzen. Vorher:

      ```js
      function applyFronts() {
        /* Von innen gilt das Gegenteil von aussen: die Wand muss stehen, sonst sieht
           man in einen offenen Setzkasten statt in ein Zimmer. state.cutaway selbst
           bleibt unangetastet, damit die Aussenansicht nach dem Besuch unverändert
           ist (#44). */
        for (let j = 0; j <= MAXF; j++) if (floorGroups[j])
          floorGroups[j].userData.front.visible = besuch ? true : (!state.cutaway && !(edit && edit.k === j));
        $('btn-cutaway').textContent = state.cutaway ? 'Wände hin' : 'Wände weg';
      }
      ```

      Nachher:

      ```js
      function applyFronts() {
        /* Eine Quelle, je nachdem wo man steht: drinnen das nicht gespeicherte
           besuch.wandWeg, draussen state.cutaway. Der Besuch beginnt mit
           stehenden Wänden — sonst sähe man in einen offenen Setzkasten statt
           in ein Zimmer (#44) —, aber «Wände weg» wirkt jetzt auch von innen
           und nimmt dieselben Vorderwände weg wie draussen (#95).
           state.cutaway bleibt dabei unangetastet: die Aussenansicht nach dem
           Besuch ist unverändert. */
        const wandWeg = besuch ? besuch.wandWeg : state.cutaway;
        for (let j = 0; j <= MAXF; j++) if (floorGroups[j])
          floorGroups[j].userData.front.visible = !wandWeg && !(edit && edit.k === j);
        $('btn-cutaway').textContent = wandWeg ? 'Wände hin' : 'Wände weg';
      }
      ```

      `edit` und `besuch` schliessen sich aus (`js/game.js:1146`,
      `js/game.js:1246`), die zweite Bedingung stört im Besuch also nicht.

- [ ] **Step 4: Anfangswert setzen.** In `enterBesuch` (`js/game.js:1246-1247`)
      die Zuweisung erweitern, damit `besuch.wandWeg` nie `undefined` ist:

      ```js
      function enterBesuch(k) {
        if (edit || besuch) return;
        /* Jeder Besuch beginnt mit stehenden Wänden; der Zustand lebt nur so
           lange wie der Besuch und wird nicht gespeichert (#95). */
        besuch = { k, wandWeg: false };
      ```

      `wechsleBesuch` (`js/game.js:1307`) schreibt nur `besuch.k` und lässt
      `wandWeg` damit von selbst stehen — der Standpunktwechsel ist derselbe
      Besuch (AK7). Dort ist nichts zu ändern.

- [ ] **Step 5: Den Knopf im Besuch abzweigen.** `js/game.js:1923-1924`
      ersetzen. Vorher:

      ```js
      $('btn-cutaway').onclick = () => { state.cutaway = !state.cutaway; applyFronts(); sfx.whoosh(); save();
        if (state.cutaway) toast('Blick in alle Wohnungen — wie im Buch!'); };
      ```

      Nachher:

      ```js
      /* Im Besuch legt der Knopf nur den Besuchszustand um: kein save(), kein
         Schreiben an state — der Spielstand bleibt byte-gleich (#44, #95). */
      $('btn-cutaway').onclick = () => {
        if (besuch) {
          besuch.wandWeg = !besuch.wandWeg; applyFronts(); sfx.whoosh();
          if (besuch.wandWeg) toast('Die Wände sind weg — Du schaust hinaus!');
          return;
        }
        state.cutaway = !state.cutaway; applyFronts(); sfx.whoosh(); save();
        if (state.cutaway) toast('Blick in alle Wohnungen — wie im Buch!');
      };
      ```

- [ ] **Step 6: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-waende-weg-von-innen/t1_innen.py`
      druckt `T1 OK`.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "fix(turm): «Wände weg» wirkt auch von innen (#95)"
      git push
      ```

---

### Task 2: Abnahme, Spielstand-Treue und Changelog

**Files:**
- Modify: `CHANGELOG.md`
- Test: `.superpowers/sdd/2026-09-27-waende-weg-von-innen/t2_abnahme.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `besuch.wandWeg` und das geänderte `applyFronts()` aus Task 1.

- [ ] **Step 1: Die Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-waende-weg-von-innen/t2_abnahme.py` prüft
      die restlichen Akzeptanzkriterien am Stück:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 9061  # derselbe freie Port wie in t1
      URL = f"http://127.0.0.1:{PORT}/"

      FRONTS = """() => { const w = window.wipfelkratzer; const v = [];
        for (let i = 0; i <= w.MAXF; i++) if (w.floorGroups[i]) v.push(w.floorGroups[i].userData.front.visible);
        return v; }"""
      STAND = """() => localStorage.getItem(window.wipfelkratzer.stand.standKey)"""

      with sync_playwright() as p:
          browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = browser.new_page()
          fehler = []
          page.on("pageerror", lambda e: fehler.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
          page.reload(wait_until="networkidle")

          # Ausgangslage draussen: Wände stehen, state.cutaway === false
          assert page.evaluate("() => window.wipfelkratzer.state.cutaway") is False
          vorher_stand = page.evaluate(STAND)
          vorher_fronts = page.evaluate(FRONTS)

          # AK4: mehrfaches Umschalten im Besuch lässt den Spielstand unberührt
          page.click("#btn-besuch", timeout=20000)
          page.wait_for_timeout(300)
          for _ in range(3):
              page.click("#btn-cutaway", timeout=20000)
              page.wait_for_timeout(200)
          assert page.evaluate("() => window.wipfelkratzer.state.cutaway") is False, \
              "AK4: der Besuch darf state.cutaway nicht verändern"
          assert page.evaluate(STAND) == vorher_stand, "AK4: localStorage muss byte-gleich bleiben"

          # AK7: der Standpunktwechsel behält den inneren Zustand
          drin = page.evaluate("() => window.wipfelkratzer.besuch.wandWeg")
          page.click("#btn-besuch-hoch", timeout=20000)
          page.wait_for_timeout(400)
          assert page.evaluate("() => window.wipfelkratzer.besuch.wandWeg") == drin, \
              "AK7: der Wechsel des Standpunkts behält den inneren Zustand"
          page.click("#btn-besuch-dach", timeout=20000)
          page.wait_for_timeout(400)
          assert page.evaluate("() => window.wipfelkratzer.besuch.wandWeg") == drin, \
              "AK7: auch der Wechsel aufs Dach behält ihn"

          # AK5: nach «Schluss» steht die Aussenansicht wie vorher da
          page.click("#btn-besuch-zu", timeout=20000)
          page.wait_for_timeout(400)
          assert page.evaluate(FRONTS) == vorher_fronts, "AK5: Aussenansicht unverändert"
          assert page.inner_text("#btn-cutaway").strip() == "Wände weg", "AK5: Aufschrift passt dazu"

          # AK6: der nächste Besuch beginnt wieder mit stehenden Wänden
          page.click("#btn-besuch", timeout=20000)
          page.wait_for_timeout(300)
          assert page.evaluate("() => window.wipfelkratzer.besuch.wandWeg") is False, \
              "AK6: der innere Zustand wird nicht über den Besuch hinaus gemerkt"
          page.click("#btn-besuch-zu", timeout=20000)
          page.wait_for_timeout(400)

          # AK8: draussen verhält sich der Knopf unverändert, save() eingeschlossen
          page.click("#btn-cutaway", timeout=20000)
          page.wait_for_timeout(300)
          assert page.evaluate("() => window.wipfelkratzer.state.cutaway") is True
          assert all(v is False for v in page.evaluate(FRONTS)), "AK8: draussen sind die Wände weg"
          assert json.loads(page.evaluate(STAND))["cutaway"] is True, \
              "AK8: draussen schreibt der Knopf weiterhin in den Spielstand"
          page.reload(wait_until="networkidle")
          assert page.evaluate("() => window.wipfelkratzer.state.cutaway") is True, \
              "AK8: der Zustand überlebt den Neuladen"

          assert not fehler, f"AK9: pageerror: {fehler}"
          print("T2 OK")
          browser.close()
      ```

- [ ] **Step 2: Sonde laufen lassen und rote Punkte beheben.** Jeder Fehlschlag
      ist ein Mangel in Task 1, keine Sondenschwäche. Bei drei erfolglosen
      Versuchen an derselben Stelle anhalten und den Befund in der
      PR-Beschreibung festhalten, statt weiter zu raten.

- [ ] **Step 3: Changelog-Eintrag.** Unter `## [Unreleased]` → `### Fixed`
      (Abschnitt anlegen, falls er fehlt):

      ```markdown
      - «Wände weg» wirkt jetzt auch, wenn Du drinnen stehst: Im Besuch nimmt
        der Knopf die Vorderwände weg, und Du schaust aus der Wohnung hinaus
        auf den Wald, den Bach und den Rest Deines Turms. Ein zweiter Druck
        stellt sie wieder hin. Beim nächsten «Hineingehen» stehen die Wände
        wieder, und die Aussenansicht bleibt genau so, wie Du sie verlassen
        hast (#95)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): «Wände weg» wirkt auch von innen (#95)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Die Ausgabe **beider**
      Sonden einfügen (T1 rot vor der Änderung, T1 und T2 grün danach), dazu
      `git diff --name-only` gegen `main`. Den **manuellen In-Browser-Playtest
      als offenen Posten** benennen: ob der Blick aus der Wohnung ohne
      Vorderwand für ein Kind gut aussieht, sagt keine Sonde. Ebenfalls
      vermerken, dass Wandobjekte an der Vorderwand dann frei in der Luft
      hängen — draussen ist das heute schon so (`js/game.js:799-808`), der
      Besuch erbt es.
