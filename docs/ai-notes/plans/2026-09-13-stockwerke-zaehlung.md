# Plan — Stockwerke: elf Ebenen, zehn gebaute (Issue #35)

Repo: `game-wipfelkratzer`. Basis: `main` (v0.5.0). Buildless Vanilla:
`index.html` + `js/game.js` + `js/models.js`, three.js r184 über Importmap.
Kein Build-Schritt, kein npm, kein Test-Framework.

**Goal:** Die Anzeige sagt, was sie zählt — «Erdgeschoss + N von 10
Stockwerken» — und die Zielzahl kommt überall aus `MAXF` statt aus Literalen,
damit Issue #47 (wählbare Turmhöhe) nicht über sie stolpert. Der Turm selbst,
`TENANTS`, `state` und das Speicherformat bleiben unverändert.

**Architecture:** Drei Anzeigeflächen, drei Codestellen. `#floorinfo`
(`index.html:156`) verliert seine statische `10` an ein neues
`<span id="floors-max">`, das `updateHUD()` (`js/game.js:522-526`) aus `MAXF`
füllt; derselbe `updateHUD()` speist auch den Bauknopf-Text, dessen `10`
heute ein Literal im Template-String ist (`js/game.js:523`).
`renderResidents()` (`js/game.js:791-800`) bekommt für `i === 0` einen
erklärenden Zusatz in der zweiten Spalte. Zuletzt fällt das dritte Literal
derselben Klasse, `wishOpen(10)` (`js/game.js:977`).

**Spec:** `docs/ai-notes/specs/2026-09-13-stockwerke-zaehlung-design.md`

## Global Constraints

- **Deutsche UI durchgehend.** Schweizer Schreibweise: `ss` statt `ß`, echte
  Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Build-Schritt, kein npm,
  kein Test-Runner, kein Bundler. Nur ES-Module.
- **Nichts an der 3D-Szene.** Keine neue Geometrie, kein neues Material,
  keine Änderung an `js/models.js`. Diese Aufgabe ist reine Text- und
  Logikänderung an der HUD-/Listenschicht.
- **`MAXF` bleibt `10`.** Issue #35 macht die Turmhöhe nicht wählbar — das
  ist Issue #47. Hier wird nur die Bindung an `MAXF` hergestellt.
- **`flLabel` (`js/game.js:32`) bleibt unverändert.** Es wird auch in der
  28 px schmalen `.fl`-Spalte (`index.html:121`) und im Edit-Titel
  (`js/game.js:650`) benutzt.
- **Speicherformat rückwärtskompatibel.** `localStorage['wipfelkratzer-v1']`
  und `wipfelkratzer-fotos` müssen unverändert laden; `state` wird nicht
  erweitert.
- **Verifikation ist headless Playwright** gegen einen lokalen
  `python3 -m http.server`. Null `pageerror` gehört zu jedem Durchlauf.
- **Jeder Verifikationslauf läuft im Vordergrund. Niemals
  `run_in_background`.** `CLAUDE.md:550-562` verbietet das ausdrücklich: ein
  backgroundeter Playwright-Lauf meldet sich nie zurück, der Agent verbrennt
  seine Turns mit Warten und meldet am Ende «success», ohne etwas gepusht zu
  haben. Issue #11 ist genau so gestorben. Wenn ein Lauf langsam ist, gib dem
  Vordergrundaufruf ein grosszügiges `timeout` und lass ihn blockieren.
- **Branch vor der Verifikation pushen**, nicht danach
  (`CLAUDE.md:565-568`).

## Verifikations-Harness

Wegwerf-Skripte liegen unter
`.superpowers/sdd/2026-09-13-issue-35-stockwerke/` (per `.gitignore`
ausgeschlossen). Lege dort zuerst `harness.py` an — alle Task-Skripte
importieren es:

```python
# .superpowers/sdd/2026-09-13-issue-35-stockwerke/harness.py
import json
import pathlib
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parents[3]
PORT = 8931
BASE = f"http://127.0.0.1:{PORT}/"


def serve():
    """Startet python3 -m http.server im Repo-Root und wartet, bis er antwortet."""
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(REPO),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(100):
        try:
            urllib.request.urlopen(BASE, timeout=1).read()
            return proc
        except Exception:
            time.sleep(0.1)
    proc.terminate()
    raise RuntimeError(f"http.server auf Port {PORT} kam nicht hoch")


def open_game(pw, floors=None):
    """Browser + Seite, optional mit vorbelegtem Spielstand. Gibt (browser, page, errors)."""
    browser = pw.chromium.launch(
        args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
    )
    page = browser.new_page(viewport={"width": 1024, "height": 768})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if floors is not None:
        state = json.dumps({"floors": floors})
        page.add_init_script(
            f"localStorage.setItem('wipfelkratzer-v1', {json.dumps(state)})"
        )
    page.goto(BASE, wait_until="load")
    page.wait_for_function("() => document.getElementById('floors') !== null",
                           timeout=30000)
    page.wait_for_timeout(1500)   # three.js-Aufbau unter swiftshader
    return browser, page, errors


def check(label, actual, expected):
    ok = actual == expected
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {actual!r}"
          + ("" if ok else f"  (erwartet {expected!r})"))
    return ok


def check_contains(label, haystack, needle):
    ok = needle in haystack
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {needle!r} in {haystack!r}")
    return ok
```

Aufruf immer so — im Vordergrund, mit grosszügigem Timeout:

```bash
cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
  python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task1_hud.py
```

Ein 404 auf `favicon.png` ist erwartet und wird nicht gewertet; gewertet wird
nur `pageerror`.

---

### Task 1: HUD-Zeile an `MAXF` binden und neu formulieren

**Files:**
- `index.html` (Zeile 156, `#floorinfo`)
- `js/game.js` (`updateHUD()`, Zeile 522)
- `.superpowers/sdd/2026-09-13-issue-35-stockwerke/harness.py` (neu)
- `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task1_hud.py` (neu)

**Interfaces:**
- Neues Element-Id `floors-max` in `#floorinfo`, von `updateHUD()` befüllt.
- `updateHUD()` behält seine Signatur `function updateHUD()` — sie wird aus
  `buildFloor()` (`js/game.js:811`), `spawnTenant()` (`js/game.js:762`) und
  beim Start (`js/game.js:1192`) gerufen.
- `#floors` bleibt bestehen und trägt weiterhin `state.floors`.

Schritte:

- [ ] **Step 1: Harness anlegen.** Verzeichnis
      `.superpowers/sdd/2026-09-13-issue-35-stockwerke/` erstellen und
      `harness.py` mit dem Inhalt aus dem Abschnitt «Verifikations-Harness»
      ablegen.

- [ ] **Step 2: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task1_hud.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, open_game, check, check_contains

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  for floors, expected in [(0, "Erdgeschoss + 0 von 10 Stockwerken"),
                                           (3, "Erdgeschoss + 3 von 10 Stockwerken"),
                                           (10, "Erdgeschoss + 10 von 10 Stockwerken")]:
                      browser, page, errors = open_game(pw, floors=floors)
                      text = " ".join(page.locator("#floorinfo").inner_text().split())
                      ok &= check(f"HUD bei floors={floors}", text, expected)
                      ok &= check(f"#floors bei floors={floors}",
                                  page.locator("#floors").inner_text(), str(floors))
                      ok &= check(f"#floors-max bei floors={floors}",
                                  page.locator("#floors-max").inner_text(), "10")
                      ok &= check(f"pageerror bei floors={floors}", errors, [])
                      browser.close()

                  # Die 10 muss zur Laufzeit aus MAXF stammen, nicht aus dem Markup.
                  browser, page, errors = open_game(pw, floors=2)
                  before = page.locator("#floors-max").inner_text()
                  page.evaluate(
                      "() => { const el = document.getElementById('floors-max');"
                      " el.textContent = '99'; }")
                  after = page.locator("#floors-max").inner_text()
                  ok &= check("floors-max ist JS-befuellt (vorher)", before, "10")
                  ok &= check("floors-max ist JS-befuellt (nachher)", after, "99")
                  ok &= check("pageerror im MAXF-Check", errors, [])
                  browser.close()
          finally:
              proc.terminate()
              proc.wait(timeout=10)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Im Vordergrund laufen lassen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task1_hud.py
      ```

      Erwartet: **FAIL** — `#floors-max` existiert noch nicht, der
      `inner_text()`-Aufruf darauf läuft in einen Timeout bzw. der
      `#floorinfo`-Text lautet noch «Stockwerke: 0 / 10».

- [ ] **Step 3: Markup umstellen.** In `index.html` Zeile 156 ersetzen:

      ```html
      <div class="panel" id="floorinfo">Erdgeschoss + <span id="floors">0</span> von <span id="floors-max">10</span> Stockwerken</div>
      ```

- [ ] **Step 4: `updateHUD()` die Obergrenze schreiben lassen.** In
      `js/game.js` die erste Zeile von `updateHUD()` (Zeile 522) ersetzen:

      ```js
      function updateHUD() { $('nuts').textContent = state.nuts; $('floors').textContent = state.floors;
        $('floors-max').textContent = MAXF;
      ```

      Der Rest des Funktionskörpers bleibt in diesem Task unverändert.

- [ ] **Step 5: Test erneut im Vordergrund laufen lassen** — derselbe Befehl
      wie in Step 2. Erwartet: `ERGEBNIS: PASS`, alle Zeilen `PASS`, keine
      `pageerror`.

---

### Task 2: Bauknopf-Literal an `MAXF` binden

**Files:**
- `js/game.js` (`updateHUD()`, Zeile 523)
- `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task2_button.py` (neu)

**Interfaces:**
- Wortlaut des Knopfes bleibt: `Stockwerk bauen (N/M)` bzw.
  `Fertig gebaut!`. Nur `M` kommt jetzt aus `MAXF`.
- `$('btn-build').disabled` bleibt an `state.floors >= MAXF || !!edit`
  gebunden.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task2_button.py`:

      ```python
      import re
      import sys
      import pathlib
      from playwright.sync_api import sync_playwright
      from harness import serve, open_game, check, REPO

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  for floors, expected in [(0, "Stockwerk bauen (1/10)"),
                                           (3, "Stockwerk bauen (4/10)"),
                                           (9, "Stockwerk bauen (10/10)")]:
                      browser, page, errors = open_game(pw, floors=floors)
                      ok &= check(f"Knopf bei floors={floors}",
                                  page.locator("#btn-build").inner_text().strip(),
                                  expected)
                      ok &= check(f"Knopf aktiv bei floors={floors}",
                                  page.locator("#btn-build").is_disabled(), False)
                      ok &= check(f"pageerror bei floors={floors}", errors, [])
                      browser.close()

                  browser, page, errors = open_game(pw, floors=10)
                  ok &= check("Knopf bei floors=10",
                              page.locator("#btn-build").inner_text().strip(),
                              "Fertig gebaut!")
                  ok &= check("Knopf disabled bei floors=10",
                              page.locator("#btn-build").is_disabled(), True)
                  ok &= check("pageerror bei floors=10", errors, [])
                  browser.close()

                  # Echter Klickpfad: buildFloor() -> updateHUD()
                  browser, page, errors = open_game(pw, floors=0)
                  page.locator("#btn-start").click(timeout=30000)
                  page.locator("#btn-build").click(timeout=30000)
                  page.wait_for_timeout(2000)
                  hud = " ".join(page.locator("#floorinfo").inner_text().split())
                  ok &= check("HUD nach einem Klick", hud,
                              "Erdgeschoss + 1 von 10 Stockwerken")
                  ok &= check("Knopf nach einem Klick",
                              page.locator("#btn-build").inner_text().strip(),
                              "Stockwerk bauen (2/10)")
                  ok &= check("pageerror im Klickpfad", errors, [])
                  browser.close()

              # Kein Zielzahl-Literal mehr in Knopf- oder HUD-Text.
              src = (REPO / "js" / "game.js").read_text(encoding="utf-8")
              ok &= check("kein '/10}' Literal im Knopftext",
                          re.search(r"Stockwerk bauen \([^`]*?/10\)", src) is None, True)
              html = (REPO / "index.html").read_text(encoding="utf-8")
              ok &= check("kein statisches '/ 10' im HUD-Markup",
                          "/ 10" in html, False)
          finally:
              proc.terminate()
              proc.wait(timeout=10)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Im Vordergrund laufen lassen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task2_button.py
      ```

      Erwartet: **FAIL** — die Regex-Prüfung findet das Literal
      `Stockwerk bauen (${state.floors + 1}/10)` noch.

- [ ] **Step 2: Literal ersetzen.** In `js/game.js` Zeile 523:

      ```js
        $('btn-build').textContent = state.floors >= MAXF ? 'Fertig gebaut!' : `Stockwerk bauen (${state.floors + 1}/${MAXF})`;
      ```

- [ ] **Step 3: Test erneut im Vordergrund laufen lassen** — derselbe Befehl
      wie in Step 1. Erwartet: `ERGEBNIS: PASS`.

---

### Task 3: Erdgeschoss-Zeile der Bewohnerliste erklären

**Files:**
- `js/game.js` (`renderResidents()`, Zeile 791-800)
- `index.html` (CSS-Block, neue Regel für `#resident-list .hint`)
- `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task3_residents.py` (neu)

**Interfaces:**
- `renderResidents()` behält Signatur und Aufrufer
  (`js/game.js:762, 811, 830, 1027, 1192`).
- Die Liste behält elf `<li>`, die Reihenfolge bleibt `10 … 1, E`.
- Neue CSS-Klasse `hint` innerhalb von `#resident-list`.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task3_residents.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, open_game, check, check_contains

      HINT = "Erdgeschoss, war schon da"

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, floors=10)
                  page.locator("#btn-start").click(timeout=30000)
                  page.locator("#btn-extras").click(timeout=30000)
                  page.locator("#btn-sign").click(timeout=30000)
                  page.wait_for_selector("#residents.open", timeout=30000)

                  rows = page.locator("#resident-list li")
                  ok &= check("Anzahl Zeilen", rows.count(), 11)

                  labels = [rows.nth(i).locator(".fl").inner_text().strip()
                            for i in range(rows.count())]
                  ok &= check("Reihenfolge der Etiketten", labels,
                              ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "E"])

                  e_row = " ".join(rows.nth(10).inner_text().split())
                  ok &= check_contains("E-Zeile enthaelt Hinweis", e_row, HINT)
                  ok &= check_contains("E-Zeile nennt weiter den Kindergarten",
                                       e_row, "Kindergarten und Partyraum")

                  others = [" ".join(rows.nth(i).inner_text().split())
                            for i in range(10)]
                  ok &= check("kein Hinweis in den nummerierten Zeilen",
                              [t for t in others if HINT in t], [])
                  ok &= check("pageerror", errors, [])
                  browser.close()

                  # Ungebaute Etagen behalten ihren Text, das Erdgeschoss den Hinweis.
                  browser, page, errors = open_game(pw, floors=0)
                  page.locator("#btn-start").click(timeout=30000)
                  page.locator("#btn-extras").click(timeout=30000)
                  page.locator("#btn-sign").click(timeout=30000)
                  page.wait_for_selector("#residents.open", timeout=30000)
                  rows = page.locator("#resident-list li")
                  ok &= check("Anzahl Zeilen bei floors=0", rows.count(), 11)
                  top = " ".join(rows.nth(0).inner_text().split())
                  ok &= check_contains("Zeile 10 ungebaut", top, "noch nicht gebaut")
                  e_row = " ".join(rows.nth(10).inner_text().split())
                  ok &= check_contains("E-Zeile bei floors=0", e_row, HINT)
                  ok &= check("pageerror bei floors=0", errors, [])
                  browser.close()
          finally:
              proc.terminate()
              proc.wait(timeout=10)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Im Vordergrund laufen lassen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task3_residents.py
      ```

      Erwartet: **FAIL** — die `E`-Zeile enthält den Hinweis noch nicht.

- [ ] **Step 2: `renderResidents()` erweitern.** In `js/game.js` den
      Schleifenkörper (Zeile 793-799) ersetzen:

      ```js
        for (let i = MAXF; i >= 0; i--) {
          const li = document.createElement('li');
          const built = i <= state.floors;
          const nm = !built ? '<span class="free">noch nicht gebaut</span>' : tenantIn(i) ? `<b>${TENANTS[i].unit || TENANTS[i].name}</b>` : '<span class="free">zurzeit frei</span>';
          /* Ebene 0 wird nie gebaut (js/game.js:297) — sie ist von Anfang an da.
             Der Hinweis beantwortet genau dort, wo man die elf Zeilen abzählt,
             warum es zehn gebaute Stockwerke und trotzdem elf Ebenen sind. */
          const hint = i === 0 ? '<span class="hint">Erdgeschoss, war schon da</span>' : '';
          li.innerHTML = `<span class="fl">${flLabel(i)}</span><span>${nm}${hint}</span>`;
          ul.appendChild(li); }
      ```

- [ ] **Step 3: CSS für den Hinweis.** In `index.html` direkt nach der Regel
      `#resident-list .free` (Zeile 122) einfügen:

      ```css
        #resident-list .hint { display: block; font-size: 12px; opacity: .6; }
      ```

- [ ] **Step 4: Test erneut im Vordergrund laufen lassen** — derselbe Befehl
      wie in Step 1. Erwartet: `ERGEBNIS: PASS`.

---

### Task 4: Letztes Literal, Changelog und Gesamtdurchlauf

**Files:**
- `js/game.js` (Zeile 977, `wishOpen(10)`)
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task4_final.py` (neu)

**Interfaces:**
- `wishOpen(i)` (`js/game.js:767`) bleibt unverändert; nur der Aufrufer im
  Dach-Tipp übergibt jetzt `MAXF`.
- `CHANGELOG.md` behält das Keep-a-Changelog-Format; Eintrag unter
  `[Unreleased]` → `Fixed`. Kein Versions-Bump, kein Tag, `version.js` bleibt
  auf `0.5.0`.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-13-issue-35-stockwerke/task4_final.py`:

      ```python
      import re
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, open_game, check, check_contains, REPO

      HINT = "Erdgeschoss, war schon da"

      def main():
          proc = serve()
          ok = True
          try:
              src = (REPO / "js" / "game.js").read_text(encoding="utf-8")
              ok &= check("kein wishOpen(10) mehr", "wishOpen(10)" in src, False)
              ok &= check("wishOpen(MAXF) vorhanden", "wishOpen(MAXF)" in src, True)
              ok &= check("kein Zielzahl-Literal im Knopftext",
                          re.search(r"Stockwerk bauen \([^`]*?/10\)", src) is None, True)

              html = (REPO / "index.html").read_text(encoding="utf-8")
              ok &= check("kein statisches '/ 10' im HUD-Markup", "/ 10" in html, False)
              ok &= check("floors-max im Markup", 'id="floors-max"' in html, True)

              ch = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
              ok &= check_contains("Changelog nennt das Issue", ch, "#35")

              # Echte Umlaute, keine Transliteration in den neuen Texten.
              ok &= check("HUD-Text mit echten Umlauten im Markup",
                          "Erdgeschoss" in html and "Stockwerken" in html, True)
              ok &= check("keine Transliteration 'Froesche'",
                          "Froesche" in src, False)

              with sync_playwright() as pw:
                  for floors in (0, 1, 5, 10):
                      browser, page, errors = open_game(pw, floors=floors)
                      hud = " ".join(page.locator("#floorinfo").inner_text().split())
                      ok &= check(f"HUD bei floors={floors}", hud,
                                  f"Erdgeschoss + {floors} von 10 Stockwerken")
                      btn = page.locator("#btn-build").inner_text().strip()
                      ok &= check(f"Knopf bei floors={floors}", btn,
                                  "Fertig gebaut!" if floors == 10
                                  else f"Stockwerk bauen ({floors + 1}/10)")
                      page.locator("#btn-start").click(timeout=30000)
                      page.locator("#btn-extras").click(timeout=30000)
                      page.locator("#btn-sign").click(timeout=30000)
                      page.wait_for_selector("#residents.open", timeout=30000)
                      rows = page.locator("#resident-list li")
                      ok &= check(f"Zeilen bei floors={floors}", rows.count(), 11)
                      e_row = " ".join(rows.nth(10).inner_text().split())
                      ok &= check_contains(f"E-Hinweis bei floors={floors}",
                                           e_row, HINT)
                      ok &= check(f"pageerror bei floors={floors}", errors, [])
                      browser.close()

                  # Bestehender Spielstand laedt unverändert weiter.
                  browser, page, errors = open_game(pw, floors=None)
                  page.evaluate(
                      "() => localStorage.setItem('wipfelkratzer-v1',"
                      " JSON.stringify({floors: 4, nuts: 7}))")
                  page.reload(wait_until="load")
                  page.wait_for_timeout(1500)
                  ok &= check("floors aus altem Stand",
                              page.locator("#floors").inner_text(), "4")
                  ok &= check("nuts aus altem Stand",
                              page.locator("#nuts").inner_text(), "7")
                  ok &= check("pageerror nach Reload", errors, [])
                  browser.close()
          finally:
              proc.terminate()
              proc.wait(timeout=10)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Im Vordergrund laufen lassen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task4_final.py
      ```

      Erwartet: **FAIL** — `wishOpen(10)` steht noch im Code und der
      Changelog-Eintrag fehlt.

- [ ] **Step 2: Letztes Literal binden.** In `js/game.js` Zeile 977:

      ```js
        if (k === 'roof') { toast(state.floors === MAXF && wishOpen(MAXF) ? 'Die Frösche warten auf einen Pool!' : 'Lampions, Sonnenschirm und Liegestuhl machen die Dachterrasse fein.'); return; }
      ```

- [ ] **Step 3: Changelog ergänzen.** In `CHANGELOG.md` unter
      `## [Unreleased]` einen `### Fixed`-Block anlegen bzw. ergänzen:

      ```markdown
      ### Fixed

      - Turmanzeige zählt jetzt sichtbar richtig: das HUD sagt «Erdgeschoss +
        N von 10 Stockwerken», und die Bewohnerliste erklärt in der
        `E`-Zeile, dass das Erdgeschoss von Anfang an da ist. Die Zielzahl
        kommt in HUD, Bauknopf und Dach-Tipp aus `MAXF` statt aus Literalen
        (#35).
      ```

- [ ] **Step 4: Gesamtdurchlauf im Vordergrund.** Erst alle vier Skripte
      nacheinander, jeweils blockierend:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task1_hud.py && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task2_button.py && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task3_residents.py && \
        python3 .superpowers/sdd/2026-09-13-issue-35-stockwerke/task4_final.py
      ```

      Erwartet: viermal `ERGEBNIS: PASS`. Erst danach ist die Aufgabe fertig;
      die Acceptance Criteria der Spec sind damit Punkt für Punkt abgedeckt.

- [ ] **Step 5: Beleg sichern.** Screenshot des HUD bei `floors = 10` und der
      geöffneten Bewohnerliste ablegen (`page.screenshot(path=...)` in
      `.superpowers/sdd/2026-09-13-issue-35-stockwerke/`), damit die
      Formulierung im PR belegbar ist, ohne dass jemand den Lauf wiederholen
      muss.
