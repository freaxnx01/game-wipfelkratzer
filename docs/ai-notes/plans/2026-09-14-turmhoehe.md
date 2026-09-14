# Plan — Wählbare Turmhöhe: 10, 20 oder 50 Stockwerke (Issue #47)

Repo: `game-wipfelkratzer`. Basis: `main` (v0.5.0). Buildless Vanilla:
`index.html` + `js/game.js` + `js/models.js`, three.js r184 über Importmap.
Kein Build-Schritt, kein npm, kein Test-Framework.

**Goal:** Wer ein neues Spiel beginnt, wählt 10, 20 oder 50 Stockwerke. Der
Turm bleibt bis oben bewohnbar, sichtbar und flüssig, und jeder bestehende
Zehner-Spielstand lädt unverändert.

**Architecture:** `MAXF` wird von einer Modulkonstante (`js/game.js:6`) zu
einem aus `state.maxFloors` gelesenen Wert, der danach konstant bleibt. Vier
Schichten hängen daran und werden nacheinander gelöst: die
Etagengeometrie (`W`/`D`, `js/game.js:7-8`), die Bewohner
(`TENANTS`, `js/game.js:19-31`, künftig hinter `tenantOf(i)`), die
Szenenhülle (Kamera, Nebel, Sterne, Schatten — `js/game.js:55, 59, 62-64,
71, 74-79`) und der Aufbau der Etagengruppen (`js/game.js:246-300`, künftig
verzögert). Zuletzt kommt die Bedienung: drei Knöpfe im Startbildschirm
(`index.html:236-244`) und die Anpassung der Anzeige-Literale.

**Spec:** `docs/ai-notes/specs/2026-09-14-turmhoehe-design.md`

## Global Constraints

- **Deutsche UI durchgehend.** Schweizer Schreibweise: `ss` statt `ß`,
  echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Build-Schritt, kein npm,
  kein Test-Runner, kein Bundler. Nur ES-Module.
- **`js/models.js` wird nicht angefasst.** Keine neuen Tierarten, keine
  neuen Möbel; die Bewohner werden aus dem vorhandenen Bestand kombiniert.
- **Der Zehner-Turm bleibt identisch.** Jede Formel, die `MAXF` einführt,
  muss bei `MAXF = 10` auf die heutigen Zahlen fallen. Das ist in mehreren
  Tasks ausdrücklich mitgeprüft.
- **Speicherformat rückwärtskompatibel.** `state` wird nur um
  `maxFloors` erweitert; fehlt das Feld, gilt 10. `wipfelkratzer-fotos`
  wird nicht angefasst.
- **`version.js` nicht ändern, kein `chore(release)`-Commit.** Der
  Changelog-Eintrag gehört unter `## [Unreleased]`.
- **Verifikation ist headless Playwright** gegen einen lokalen
  `python3 -m http.server`. Null `pageerror` gehört zu jedem Durchlauf.
- **Jeder Verifikationslauf läuft im Vordergrund. Niemals
  `run_in_background`.** `CLAUDE.md` verbietet das ausdrücklich: ein
  backgroundeter Playwright-Lauf meldet sich nie zurück, der Agent verbrennt
  seine Turns mit Warten und meldet am Ende «success», ohne etwas gepusht zu
  haben. Issue #11 ist genau so gestorben. Wenn ein Lauf langsam ist, gib
  dem Vordergrundaufruf ein grosszügiges `timeout` und lass ihn blockieren.
- **Server über den Port beenden**, nie über `pkill -f`: der Harness hält
  das `Popen`-Objekt und ruft `proc.terminate()`; kein Mustertöten.
- **Branch vor der Verifikation pushen**, nicht danach.
- **Verhältnis zu Issue #35:** #35 bindet dieselben drei Anzeige-Literale
  an `MAXF`. Task 7 ist so geschrieben, dass er beide Fälle verträgt — ist
  #35 schon zusammengeführt, sind die Stellen bereits gebunden und der
  Wortlaut von #35 («Erdgeschoss + N von M Stockwerken») bleibt stehen.

## Verifikations-Harness

Wegwerf-Skripte liegen unter
`.superpowers/sdd/2026-09-14-issue-47-turmhoehe/` (per `.gitignore`
ausgeschlossen). Lege dort zuerst `harness.py` an — alle Task-Skripte
importieren es:

```python
# .superpowers/sdd/2026-09-14-issue-47-turmhoehe/harness.py
import json
import pathlib
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

REPO = pathlib.Path(__file__).resolve().parents[3]
PORT = 8947
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


def stop(proc):
    """Server über das Prozessobjekt beenden — niemals pkill -f."""
    proc.terminate()
    proc.wait(timeout=10)


def open_game(pw, save=None):
    """Browser + Seite, optional mit vorbelegtem Spielstand.

    save ist ein dict, das als localStorage['wipfelkratzer-v1'] gesetzt wird,
    bevor die Seite laedt. None heisst: leerer localStorage.
    """
    browser = pw.chromium.launch(
        args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
    )
    page = browser.new_page(viewport={"width": 1024, "height": 768})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if save is not None:
        page.add_init_script(
            "localStorage.setItem('wipfelkratzer-v1', %s)"
            % json.dumps(json.dumps(save))
        )
    page.goto(BASE, wait_until="load")
    page.wait_for_function(
        "() => window.wipfelkratzer !== undefined", timeout=30000
    )
    page.wait_for_timeout(1500)  # three.js-Aufbau unter swiftshader
    return browser, page, errors


def check(label, actual, expected):
    ok = actual == expected
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {actual!r}"
          + ("" if ok else f"  (erwartet {expected!r})"))
    return ok


def check_true(label, value):
    ok = bool(value)
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {value!r}")
    return ok


def check_close(label, actual, expected, eps=1e-6):
    ok = abs(actual - expected) < eps
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {actual!r}"
          + ("" if ok else f"  (erwartet {expected!r})"))
    return ok
```

Aufruf immer so — im Vordergrund, mit grosszügigem Timeout:

```bash
cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
  python3 .superpowers/sdd/2026-09-14-issue-47-turmhoehe/task1_maxf.py
```

Ein 404 auf `favicon.png` ist erwartet und wird nicht gewertet; gewertet
wird nur `pageerror`.

---

### Task 1: `MAXF` aus dem Spielstand lesen

**Files:**
- `js/game.js` (Zeilen 6, 35, 1188)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/harness.py` (neu)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task1_maxf.py` (neu)

**Interfaces:**
- `state` bekommt das Feld `maxFloors` mit Default `10`
  (`js/game.js:35`). Fehlt es im gespeicherten Stand, greift der Default
  über `Object.assign` (`js/game.js:36`).
- `MAXF` bleibt ein `const` auf Modulebene, wird aber **nach** dem Laden
  des Spielstands deklariert und aus `state.maxFloors` gespeist. Erlaubte
  Werte: 10, 20, 50; alles andere fällt auf 10 zurück.
- `window.wipfelkratzer` (`js/game.js:1188`) wird um `MAXF` erweitert.

Schritte:

- [ ] **Step 1: Harness anlegen.** Verzeichnis
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/` erstellen und
      `harness.py` mit dem Inhalt aus dem Abschnitt
      «Verifikations-Harness» ablegen.

- [ ] **Step 2: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task1_maxf.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  # Altstand ohne maxFloors -> 10
                  browser, page, errors = open_game(pw, save={"floors": 3})
                  ok &= check("MAXF bei Altstand", page.evaluate("() => wipfelkratzer.MAXF"), 10)
                  ok &= check("maxFloors im state", page.evaluate("() => wipfelkratzer.state.maxFloors"), 10)
                  ok &= check("pageerror Altstand", errors, [])
                  browser.close()

                  for want in (20, 50):
                      browser, page, errors = open_game(pw, save={"floors": 0, "maxFloors": want})
                      ok &= check(f"MAXF bei maxFloors={want}", page.evaluate("() => wipfelkratzer.MAXF"), want)
                      ok &= check(f"pageerror bei {want}", errors, [])
                      browser.close()

                  # Unsinniger Wert fällt auf 10 zurueck
                  browser, page, errors = open_game(pw, save={"floors": 0, "maxFloors": 7})
                  ok &= check("MAXF bei maxFloors=7", page.evaluate("() => wipfelkratzer.MAXF"), 10)
                  ok &= check("pageerror bei 7", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — `wipfelkratzer.MAXF` ist noch `undefined`.

- [ ] **Step 3: `state` um `maxFloors` erweitern.** In `js/game.js:35` das
      Zustandsliteral ergänzen (neues Feld am Ende, vor der schliessenden
      Klammer):

      ```js
      let state = { floors: 0, rooms: {}, nuts: 0, bridge: false, garden: false, night: false, cutaway: false, fulfilled: {}, wallpaper: {}, flooring: {}, maxFloors: 10 };
      ```

- [ ] **Step 4: `MAXF` verschieben.** In `js/game.js:6` `MAXF` aus der
      Konstantenzeile entfernen:

      ```js
      const PLAT_Y = 2.2, E_H = 2.4, FLOOR_H = 2.0;
      ```

      und direkt **nach** der `try`-Zeile, die den Spielstand lädt
      (`js/game.js:36`), einfügen:

      ```js
      /* Turmhöhe: einmal pro Spielstand gewählt, danach konstant. Ein fremder
         oder fehlender Wert fällt auf den klassischen Zehner-Turm zurück. */
      const TOWER_CHOICES = [10, 20, 50];
      const MAXF = TOWER_CHOICES.includes(state.maxFloors) ? state.maxFloors : 10;
      state.maxFloors = MAXF;
      ```

      `W`, `D`, `H`, `floorY` und `topY` (`js/game.js:7-11`) stehen damit
      **vor** `MAXF` und müssen mitwandern — verschiebe die Zeilen 7–11
      unverändert hinter den neuen `MAXF`-Block. Sie sind Pfeilfunktionen
      und werden erst zur Laufzeit ausgewertet, aber `MAXF` ist ein `const`
      in der temporalen Totzone; die Umsortierung nimmt das Risiko heraus.

- [ ] **Step 5: Debug-Zugriff erweitern.** In `js/game.js:1188`
      `window.wipfelkratzer` um `MAXF` ergänzen:

      ```js
      window.wipfelkratzer = { state, MAXF, floorGroups, roofG, roofStairG, roofGapG, scene, camera, controls, WALL_KEYS, get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; } };
      ```

- [ ] **Step 6: Test erneut im Vordergrund laufen lassen** — derselbe
      Befehl wie in Step 2. Erwartet: `ERGEBNIS: PASS`, keine
      `pageerror`.

---

### Task 2: Verjüngung an die Turmhöhe koppeln

**Files:**
- `js/game.js` (`W`, `D`, jetzt hinter dem `MAXF`-Block aus Task 1)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task2_verjuengung.py` (neu)

**Interfaces:**
- `W(i)` und `D(i)` behalten ihre Signatur (`i` = Etagenindex, `0` =
  Erdgeschoss) und ihre heutigen Werte für `MAXF = 10`.
- Neue Modulkonstanten `W_TOP = 4.9`, `D_TOP = 3.92` — die Masse der
  obersten Etage, unabhängig von der Turmhöhe.
- Abhängig davon und damit automatisch mitgezogen: `dims()`
  (`js/game.js:358`), `colsOf()` (`js/game.js:359`), `bounds()`
  (`js/game.js:414`), `wallPlacement()` (`js/game.js:371-378`), `armX()`
  (`js/game.js:164`), `winCount()`/`doorX()` (`js/game.js:156-159`).

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task2_verjuengung.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_close, check_true

      MEASURE = """() => {
        const n = wipfelkratzer.MAXF;
        const out = [];
        for (let i = 0; i <= n; i++) out.push(wipfelkratzer.dims(i));
        return { n, dims: out };
      }"""

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  # Zehner-Turm: heutige Masse, unverändert
                  browser, page, errors = open_game(pw, save={"floors": 10})
                  d = page.evaluate(MEASURE)
                  ok &= check("MAXF", d["n"], 10)
                  ok &= check_close("dims(10).w", d["dims"][10]["w"], 4.9 - 0.7)
                  ok &= check_close("dims(10).d", d["dims"][10]["d"], 3.92 - 1.0)
                  ok &= check_close("dims(1).w", d["dims"][1]["w"], 7.6 - 0.7)
                  ok &= check("pageerror 10", errors, [])
                  browser.close()

                  for want in (20, 50):
                      browser, page, errors = open_game(pw, save={"floors": 0, "maxFloors": want})
                      d = page.evaluate(MEASURE)
                      ok &= check(f"MAXF {want}", d["n"], want)
                      ok &= check_close(f"dims({want}).w", d["dims"][want]["w"], 4.9 - 0.7)
                      ok &= check_close(f"dims({want}).d", d["dims"][want]["d"], 3.92 - 1.0)
                      widths = [x["w"] for x in d["dims"][1:]]
                      depths = [x["d"] for x in d["dims"][1:]]
                      ok &= check_true(f"alle Breiten > 1.5 bei {want}", min(widths) > 1.5)
                      ok &= check_true(f"alle Tiefen > 1.5 bei {want}", min(depths) > 1.5)
                      ok &= check_true(
                          f"monoton fallend bei {want}",
                          all(widths[i] >= widths[i + 1] - 1e-9 for i in range(len(widths) - 1)))
                      ok &= check(f"pageerror {want}", errors, [])
                      browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — bei `MAXF = 50` ist `dims(50).w` heute
      `-7.1 - 0.7`, also weit negativ.

- [ ] **Step 2: `W` und `D` umschreiben.** Die beiden Zeilen (heute
      `js/game.js:7-8`, nach Task 1 hinter dem `MAXF`-Block) ersetzen
      durch:

      ```js
      /* Der Turm verjüngt sich vom Erdgeschoss bis zur obersten Etage immer
         auf dasselbe Endmass — egal ob er zehn, zwanzig oder fünfzig
         Stockwerke hoch ist. Bei MAXF = 10 ergeben die Schritte exakt die
         früheren Festwerte 0.3 und 0.12. */
      const W_TOP = 4.9, D_TOP = 3.92;
      const W_STEP = (7.6 - W_TOP) / (MAXF - 1), D_STEP = (5.0 - D_TOP) / (MAXF - 1);
      const W = i => i === 0 ? 8.6 : 7.6 - (i - 1) * W_STEP;
      const D = i => i === 0 ? 5.6 : 5.0 - (i - 1) * D_STEP;
      ```

- [ ] **Step 3: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`. Prüfe im Ausgabeprotokoll besonders die Zeilen
      `dims(1).w` und `dims(10).w` des Zehner-Laufs — sie belegen, dass
      der bestehende Turm unverändert ist.

---

### Task 3: Bewohner für beliebige Turmhöhe

**Files:**
- `js/game.js` (`TENANTS`-Block ab Zeile 19; neue Funktion `tenantOf`;
  Aufrufstellen 542, 649, 752, 767, 772, 785, 796, 833, 856, 960, 978, 979)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task3_bewohner.py` (neu)

**Interfaces:**
- Neu: `tenantOf(i)` liefert für jedes `i` von `0` bis `MAXF` ein Objekt
  mit denselben Feldern, die `TENANTS` heute hat: `name`, optional `unit`,
  `animals` (Array von `SPECIES`-Schlüsseln), `wish` (Katalog-Id),
  optional `roofWish`, `wtext`.
- `TENANTS` bleibt als Array bestehen, wird aber nur noch von `tenantOf`
  gelesen.
- Alle zwölf direkten Zugriffe auf `TENANTS[i]` bzw. `TENANTS.forEach`
  werden auf `tenantOf(i)` bzw. eine Indexschleife `0..MAXF` umgestellt.
  Nach dem Umbau darf `grep -n "TENANTS\[" js/game.js` **keinen** Treffer
  mehr liefern und `grep -n "TENANTS" js/game.js` nur noch die Definition
  (Zeile 19) und die drei Zugriffe innerhalb von `tenantOf`.
- `window.wipfelkratzer` bekommt `tenantOf` dazu.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task3_bewohner.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_true

      COLLECT = """() => {
        const n = wipfelkratzer.MAXF, out = [];
        for (let i = 0; i <= n; i++) {
          const t = wipfelkratzer.tenantOf(i);
          out.push({ name: t.name, wish: t.wish, wtext: t.wtext,
                     animals: t.animals, roof: !!t.roofWish });
        }
        return out;
      }"""

      CATALOG_IDS = """() => wipfelkratzer.catalogIds"""

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  # Zehner-Turm: die elf handgeschriebenen Eintraege, unverändert
                  browser, page, errors = open_game(pw, save={"floors": 10})
                  ts = page.evaluate(COLLECT)
                  ok &= check("Anzahl bei MAXF=10", len(ts), 11)
                  ok &= check("Etage 0", ts[0]["name"], "Die Kindergarten-Mäuse")
                  ok &= check("Etage 5", ts[5]["name"], "Jimmy Wiesel und Jule Wühlmaus")
                  ok &= check("Etage 10", ts[10]["name"], "Piet und Jan Waldfrosch")
                  ok &= check("roofWish auf 10", [i for i, t in enumerate(ts) if t["roof"]], [10])
                  ok &= check("pageerror 10", errors, [])
                  browser.close()

                  ids = None
                  for want in (20, 50):
                      browser, page, errors = open_game(pw, save={"floors": 0, "maxFloors": want})
                      ts = page.evaluate(COLLECT)
                      ids = page.evaluate(CATALOG_IDS)
                      ok &= check(f"Anzahl bei MAXF={want}", len(ts), want + 1)
                      ok &= check(f"Etage 0 bei {want}", ts[0]["name"], "Die Kindergarten-Mäuse")
                      ok &= check(f"Frosch oben bei {want}", ts[want]["name"], "Piet und Jan Waldfrosch")
                      ok &= check(f"roofWish genau oben bei {want}",
                                  [i for i, t in enumerate(ts) if t["roof"]], [want])
                      for i, t in enumerate(ts):
                          ok &= check_true(f"Name {i} nicht leer bei {want}", bool(t["name"]))
                          ok &= check_true(f"kein undefined im wtext {i} bei {want}",
                                           "undefined" not in t["wtext"])
                          ok &= check_true(f"wtext {i} endet auf Punkt bei {want}", t["wtext"].endswith("."))
                          ok &= check_true(f"wish {i} im Katalog bei {want}", t["wish"] in ids)
                          ok &= check_true(f"animals {i} nicht leer bei {want}", len(t["animals"]) >= 1)
                      names = [t["name"] for t in ts]
                      ok &= check_true(f"mindestens 15 verschiedene Namen bei {want}",
                                       len(set(names)) >= min(15, want))
                      ok &= check(f"pageerror {want}", errors, [])
                      browser.close()

                  # Determinismus: zweimal laden, gleiche Namen
                  first = None
                  for run in range(2):
                      browser, page, errors = open_game(pw, save={"floors": 0, "maxFloors": 50})
                      names = [t["name"] for t in page.evaluate(COLLECT)]
                      if first is None:
                          first = names
                      else:
                          ok &= check("Namen stabil über zwei Laeufe", names, first)
                      browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — `wipfelkratzer.tenantOf` gibt es noch nicht.

- [ ] **Step 2: Bausteine und `tenantOf` ergänzen.** Direkt **nach** dem
      `TENANTS`-Array (`js/game.js:31`) einfügen:

      ```js
      /* Ab Etage 10 gibt es keine handgeschriebenen Bewohner mehr. Sie werden
         aus vier Töpfen zusammengesetzt und mit demselben Hash ausgewürfelt,
         der schon Etagenversatz und Bäume bestimmt (rnd). Damit liefert
         dieselbe Etage bei jedem Laden dieselbe Familie, ohne dass etwas
         gespeichert werden muss. */
      const SURNAMES = ['Tannenzapfen', 'Moosbart', 'Farnkraut', 'Beerenbusch', 'Haselstrauch',
        'Ahornblatt', 'Kiefernzweig', 'Wurzelholz', 'Rindenstück', 'Eichelhut',
        'Brombeer', 'Löwenzahn', 'Klee', 'Birkenrinde', 'Fichtennadel',
        'Wiesenschaum', 'Waldmeister', 'Sauerklee', 'Heidelbeer', 'Buchenkeim'];
      const FIRSTNAMES = ['Fritzi', 'Mira', 'Bosco', 'Lenni', 'Paula', 'Tuula', 'Nando',
        'Smilla', 'Kuno', 'Ronja', 'Emil', 'Frida', 'Otto', 'Nelli', 'Karlo', 'Juna'];
      const TENANT_SPECIES = ['maus', 'haselmaus', 'hamster', 'frosch', 'eidechse',
        'maulwurf', 'siebenschlaefer', 'wiesel', 'eichhoernchen'];
      /* Wunsch samt Akkusativform, damit der Satz stimmt. Nur Gegenstände, die
         in einer Wohnung stehen können — nichts aus der Kategorie «dach». */
      const TENANT_WISHES = [
        { id: 'bett', txt: 'ein kuschliges Bett' },
        { id: 'etagenbett', txt: 'ein Etagenbett' },
        { id: 'sofa', txt: 'ein weiches Sofa' },
        { id: 'tisch', txt: 'einen grossen Tisch' },
        { id: 'schrank', txt: 'einen Schrank' },
        { id: 'regal', txt: 'ein Bücherregal' },
        { id: 'ofen', txt: 'einen warmen Ofen' },
        { id: 'teppich', txt: 'einen weichen Teppich' },
        { id: 'lampe', txt: 'eine Lampe' },
        { id: 'badewanne', txt: 'eine Badewanne' },
        { id: 'pflanze', txt: 'eine Pflanze' },
        { id: 'bild', txt: 'ein Blumenbild' },
        { id: 'schaukelstuhl', txt: 'einen Schaukelstuhl' },
        { id: 'klavier', txt: 'ein Klavier' },
        { id: 'hamsterrad', txt: 'ein Hamsterrad' },
        { id: 'nusskiste', txt: 'eine Nusskiste' },
      ];
      /* Haushaltsform: wie der Name gebaut wird, wie viele Tiere einziehen und
         ob der Wunschsatz im Singular oder Plural steht. */
      const HOUSEHOLDS = [
        { make: (f, s) => `Familie ${s}`, n: 2, plural: true },
        { make: (f, s) => `Oma und Opa ${s}`, n: 2, plural: true },
        { make: (f, s) => `${f} ${s}`, n: 1, plural: false },
        { make: (f, s) => `Die Geschwister ${s}`, n: 2, plural: true },
      ];
      const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
      function madeTenant(i) {
        const hh = pick(HOUSEHOLDS, rnd(i * 3 + 501));
        const name = hh.make(pick(FIRSTNAMES, rnd(i * 3 + 502)), pick(SURNAMES, rnd(i * 3 + 503)));
        const sp = pick(TENANT_SPECIES, rnd(i * 3 + 504));
        const w = pick(TENANT_WISHES, rnd(i * 3 + 505));
        return { name, animals: Array.from({ length: hh.n }, () => sp), wish: w.id,
          wtext: `${name} ${hh.plural ? 'wünschen' : 'wünscht'} sich ${w.txt}.` };
      }
      /* Etage 0 und die oberste Etage sind gesetzt: unten der Kindergarten, oben
         die Frösche, deren Wunsch (roofWish) auf die Dachterrasse zeigt und an
         dem der Party-Knopf hängt. Dazwischen so viele handgeschriebene wie da
         sind, danach erzeugte. */
      const TENANT_CACHE = {};
      function tenantOf(i) {
        if (TENANT_CACHE[i]) return TENANT_CACHE[i];
        const t = i === MAXF ? TENANTS[TENANTS.length - 1]
          : i < TENANTS.length - 1 ? TENANTS[i]
          : madeTenant(i);
        TENANT_CACHE[i] = t; return t;
      }
      ```

- [ ] **Step 3: Aufrufstellen umstellen.** Zwölf Stellen, jede einzeln:

      - `js/game.js:542` (`makeThumbs`): `TENANTS.forEach((t, i) => {` wird
        zu `for (let i = 0; i <= MAXF; i++) { const t = tenantOf(i);` — die
        schliessende `});` entsprechend zu `}`. (Diese Stelle wird in
        Step 4 ohnehin ganz ersetzt.)
      - `js/game.js:649` (`enterEdit`): `const t = TENANTS[k];` wird zu
        `const t = tenantOf(k);`.
      - `js/game.js:752` (`spawnTenant`): `const t = TENANTS[i];` wird zu
        `const t = tenantOf(i);`.
      - `js/game.js:767` (`wishOpen`): `const t = TENANTS[i];` wird zu
        `const t = tenantOf(i);`.
      - `js/game.js:772` (`checkWishes`): `const t = TENANTS[i];` wird zu
        `const t = tenantOf(i);`.
      - `js/game.js:785` (`renderWishes`): `const t = TENANTS[i];` wird zu
        `const t = tenantOf(i);`.
      - `js/game.js:796` (`renderResidents`): `TENANTS[i].unit ||
        TENANTS[i].name` wird zu `tenantOf(i).unit || tenantOf(i).name`.
      - `js/game.js:833` (`renderAnimals`): `TENANTS.forEach((t, i) => {`
        wird zu `for (let i = 0; i <= MAXF; i++) { const t = tenantOf(i);`,
        schliessende `});` zu `}`.
      - `js/game.js:856` (Dachparty-Tänzer): `TENANTS[i].animals.forEach(…)`
        wird zu `tenantOf(i).animals.forEach(…)`.
      - `js/game.js:960` (`tenantTalk`): `const t = TENANTS[i];` wird zu
        `const t = tenantOf(i);`.
      - `js/game.js:978` (Tipp-Knopf): `${TENANTS[k].name}` wird zu
        `${tenantOf(k).name}`.
      - `js/game.js:979` (Tipp-Knopf): `toast(TENANTS[k].wtext)` wird zu
        `toast(tenantOf(k).wtext)`.

      Danach prüfen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        grep -n "TENANTS\[" js/game.js
      ```

      Erwartet: nur noch die drei Treffer innerhalb von `tenantOf`.

- [ ] **Step 4: Vorschaubilder nach Tierkombination ablegen.** In
      `makeThumbs()` (`js/game.js:542-545`) das Bild nicht pro Etage
      rendern, sondern pro Kombination, und die Etage darauf zeigen
      lassen:

      ```js
      const thumbByKey = {};
      for (let i = 0; i <= MAXF; i++) { const t = tenantOf(i);
        const key = t.animals.join('+');
        if (!thumbByKey[key]) { const o = new THREE.Group();
          t.animals.forEach((sp, n) => { const a = makeAnimal(sp);
            a.position.x = (n - (t.animals.length - 1) / 2) * 0.52; a.rotation.y = (n - 0.5) * -0.5; o.add(a); });
          thumbByKey[key] = snap(o, 0.4, 0.55, 1.5); }
        animalThumbs[i] = thumbByKey[key]; }
      ```

- [ ] **Step 5: Debug-Zugriff erweitern.** In `js/game.js:1188`
      `tenantOf` und eine Liste der Katalog-Ids ergänzen, damit der Test
      den Wunsch gegen den echten Katalog prüfen kann:

      ```js
      window.wipfelkratzer = { state, MAXF, tenantOf, catalogIds: CATALOG.map(c => c.id), floorGroups, roofG, roofStairG, roofGapG, scene, camera, controls, WALL_KEYS, get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; } };
      ```

- [ ] **Step 6: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`. Der Zehner-Lauf muss die drei namentlich
      geprüften Bewohner unverändert melden.

---

### Task 4: Szene an die Turmhöhe anpassen

**Files:**
- `js/game.js` (Zeilen 55, 59, 62-64, 71, 74-79)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task4_szene.py` (neu)

**Interfaces:**
- Neue Modulkonstanten direkt nach dem `MAXF`-Block:
  `TOWER_TOP = PLAT_Y + E_H + MAXF * FLOOR_H` (die Höhe des fertigen
  Turms), `REF_TOP = PLAT_Y + E_H + 10 * FLOOR_H` (die Höhe, für die die
  Szene ursprünglich eingerichtet wurde) und
  `HSCALE = Math.max(1, TOWER_TOP / REF_TOP)`.
- Bei `MAXF = 10` ist `HSCALE === 1`; alle abgeleiteten Werte sind dann
  buchstäblich die heutigen.
- Die Schattenkamera (`js/game.js:64`) bleibt unverändert; stattdessen
  wirft Geometrie oberhalb ihres Ausschnitts keinen Schatten (Task 5).

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task4_szene.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_true

      SCENE = """() => ({
        far: wipfelkratzer.camera.far,
        maxDist: wipfelkratzer.controls.maxDistance,
        fogNear: wipfelkratzer.scene.fog.near,
        fogFar: wipfelkratzer.scene.fog.far,
        topY: wipfelkratzer.topY(),
      })"""

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save={"floors": 10})
                  s = page.evaluate(SCENE)
                  ok &= check("camera.far bei 10", s["far"], 200)
                  ok &= check("maxDistance bei 10", s["maxDist"], 44)
                  ok &= check("fog.near bei 10", s["fogNear"], 45)
                  ok &= check("fog.far bei 10", s["fogFar"], 110)
                  ok &= check("pageerror 10", errors, [])
                  browser.close()

                  for want in (20, 50):
                      browser, page, errors = open_game(pw, save={"floors": want, "maxFloors": want})
                      s = page.evaluate(SCENE)
                      ok &= check_true(f"Turm im Nebelbereich bei {want}", s["topY"] < s["fogFar"])
                      ok &= check_true(f"Nebelanfang hinter dem Turm bei {want}", s["fogNear"] > s["topY"] * 0.4)
                      ok &= check_true(f"far reicht bei {want}", s["far"] > s["topY"] + s["maxDist"])
                      ok &= check_true(f"maxDistance reicht bei {want}", s["maxDist"] > s["topY"])
                      ok &= check(f"pageerror {want}", errors, [])
                      browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — bei 50 Stockwerken ist `topY() = 104.6`,
      `fog.far = 110` (knapp) und `maxDistance = 44` (weit zu klein);
      zusätzlich fehlt `topY` in `window.wipfelkratzer`.

- [ ] **Step 2: Höhenkonstanten ergänzen.** Direkt nach dem
      `MAXF`-Block (Task 1, Step 4) einfügen:

      ```js
      /* Die Szene war auf einen Zehner-Turm eingerichtet. Alles, was von der
         Turmhöhe abhängt — Sichtweite, Nebel, Umlaufbahn, Sterne — wächst mit
         demselben Faktor mit. Bei MAXF = 10 ist er 1, die Zahlen bleiben dann
         exakt die alten. */
      const TOWER_TOP = PLAT_Y + E_H + MAXF * FLOOR_H;
      const REF_TOP = PLAT_Y + E_H + 10 * FLOOR_H;
      const HSCALE = Math.max(1, TOWER_TOP / REF_TOP);
      ```

- [ ] **Step 3: Kamera und Steuerung skalieren.** `js/game.js:55`:

      ```js
      const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 200 * HSCALE);
      ```

      und in `js/game.js:59` nur `maxDistance` anfassen:

      ```js
      controls.minDistance = 4; controls.maxDistance = 44 * HSCALE; controls.maxPolarAngle = 1.52; controls.minPolarAngle = 0.12;
      ```

- [ ] **Step 4: Nebel skalieren.** `js/game.js:71`:

      ```js
      scene.fog = new THREE.Fog(SKY.d.clone(), 45 * HSCALE, 110 * HSCALE);
      ```

- [ ] **Step 5: Sterne und Mond mitheben.** `js/game.js:75` und
      `js/game.js:79`:

      ```js
      { const p = []; for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 30) * HSCALE, y = (8 + Math.random() * 45) * HSCALE; p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
      ```

      ```js
      const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6 * HSCALE, 20, 14), moonMat); moon.position.set(-24 * HSCALE, 30 * HSCALE, -30 * HSCALE); scene.add(moon);
      ```

- [ ] **Step 6: `topY` im Debug-Zugriff.** `js/game.js:1188` um `topY`
      ergänzen (an den bestehenden Objektliteral-Eintrag anhängen, wie in
      Task 1 und 3).

- [ ] **Step 7: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`. Der Zehner-Lauf muss 200 / 44 / 45 / 110 exakt
      melden.

---

### Task 5: Etagengruppen erst beim Bauen erzeugen

**Files:**
- `js/game.js` (Etagenschleife 246-300; `applyFronts` 614-617;
  `enterEdit` 644; `exitEdit` 659-660; `highlightWalls` 397-403;
  Ladeblock 1184-1185; `buildFloor` 803-817)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task5_leistung.py` (neu)

**Interfaces:**
- Neu: `function makeFloor(i)` — der heutige Schleifenrumpf
  (`js/game.js:247-299`), wortgleich übernommen, mit
  `floorGroups[i] = g` statt `floorGroups.push(g)` am Ende.
- Neu: `function floorGroup(i)` — liefert `floorGroups[i]` und erzeugt es
  beim ersten Zugriff über `makeFloor(i)`.
- `floorGroups` bleibt ein Array, ist aber **löchrig**. Jede Schleife über
  `0..MAXF`, die `floorGroups[j]` anfasst, überspringt fehlende Einträge.
- `parentOf(k)` (`js/game.js:363`) benutzt `floorGroup(k)` statt
  `floorGroups[k]`, damit ein Zugriff auf eine noch nicht erzeugte Etage
  sie nachzieht.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task5_leistung.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_true

      COUNT = """() => ({
        groups: wipfelkratzer.floorGroups.filter(Boolean).length,
        meshes: (() => { let n = 0; wipfelkratzer.scene.traverse(o => { if (o.isMesh) n++; }); return n; })(),
        shadowCasters: (() => { let n = 0; wipfelkratzer.scene.traverse(o => { if (o.isMesh && o.castShadow) n++; }); return n; })(),
      })"""

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  # Frischer Stand: nur das Erdgeschoss existiert
                  browser, page, errors = open_game(pw, save={"floors": 0, "maxFloors": 50})
                  c0 = page.evaluate(COUNT)
                  ok &= check_true(f"hoechstens 2 Gruppen beim Start ({c0['groups']})", c0["groups"] <= 2)
                  ok &= check("pageerror Start", errors, [])

                  # Zehnmal bauen -> elf Gruppen
                  page.evaluate("() => document.getElementById('intro').classList.add('hidden')")
                  for _ in range(10):
                      page.locator("#btn-build").click()
                      page.wait_for_timeout(120)
                  c1 = page.evaluate(COUNT)
                  ok &= check("elf Gruppen nach zehn Klicks", c1["groups"], 11)
                  ok &= check("pageerror nach Bauen", errors, [])
                  browser.close()

                  # Voller 50er-Turm: Schattenwerfer begrenzt
                  browser, page, errors = open_game(pw, save={"floors": 50, "maxFloors": 50})
                  c2 = page.evaluate(COUNT)
                  ok &= check("51 Gruppen bei vollem Turm", c2["groups"], 51)
                  ok &= check_true(
                      f"weniger als die Haelfte wirft Schatten ({c2['shadowCasters']} von {c2['meshes']})",
                      c2["shadowCasters"] * 2 < c2["meshes"])
                  ok &= check("pageerror voller Turm", errors, [])
                  browser.close()

                  # Zehner-Turm bleibt vollstaendig und sichtbar
                  browser, page, errors = open_game(pw, save={"floors": 10})
                  c3 = page.evaluate(COUNT)
                  ok &= check("elf Gruppen beim Zehner-Altstand", c3["groups"], 11)
                  ok &= check_true("alle elf sichtbar", page.evaluate(
                      "() => wipfelkratzer.floorGroups.filter(Boolean).every(g => g.visible)"))
                  ok &= check("pageerror Zehner", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — heute entstehen beim Start alle `MAXF + 1`
      Gruppen.

- [ ] **Step 2: Schleife in eine Funktion umbauen.** Die Zeilen
      `js/game.js:246-300` (`for (let i = 0; i <= MAXF; i++) { … }`)
      werden zu `function makeFloor(i) { … }`. Der Rumpf bleibt
      **wortgleich**, mit zwei Änderungen am Ende:

      ```js
        g.visible = i === 0 || i <= state.floors;
        /* Über dem Ausschnitt der Schattenkamera (top: 32) landet ohnehin
           nichts mehr in der Schattenkarte — dort spart der Verzicht auf
           castShadow den zweiten Zeichendurchgang. */
        if (floorY(i) > 30) g.traverse(o => { o.castShadow = false; });
        towerG.add(g); floorGroups[i] = g;
        itemMeshes[i] = []; tenantGroups[i] = null;
        return g;
      }
      function floorGroup(i) { return floorGroups[i] || makeFloor(i); }
      ```

- [ ] **Step 3: Erdgeschoss sofort erzeugen.** Unmittelbar nach der
      Funktionsdefinition:

      ```js
      makeFloor(0);
      ```

      Das Dach-Kapitel darunter (`js/game.js:302-356`) rechnet nur mit
      `MAXF` und Konstanten und braucht keine Etagengruppe.

- [ ] **Step 4: `parentOf` nachziehen.** `js/game.js:363`:

      ```js
      function parentOf(k) { return k === 'roof' ? roofG : floorGroup(k); }
      ```

- [ ] **Step 5: Schleifen gegen Löcher absichern.** Fünf Stellen, jede
      bekommt einen Wächter auf `floorGroups[j]`:

      - `highlightWalls` (`js/game.js:398`):
        `for (let i = 0; i <= MAXF; i++) { if (!floorGroups[i]) continue;`
      - `applyFronts` (`js/game.js:615`):
        `for (let j = 0; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].userData.front.visible = …`
      - `enterEdit` (`js/game.js:644`):
        `for (let j = k + 1; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].visible = false;`
      - `exitEdit` (`js/game.js:659-660`): beide Schleifen analog mit
        `if (floorGroups[j])` absichern.
      - Ladeblock (`js/game.js:1185`):
        `for (let i = 0; i <= MAXF; i++) if (floorGroups[i]) applyLook(i);`

- [ ] **Step 6: Gebaute Etagen beim Laden erzeugen.** Vor dem
      `applyLook`-Lauf (also vor `js/game.js:1184`) einfügen:

      ```js
      for (let i = 1; i <= state.floors; i++) floorGroup(i);
      ```

      Das muss **vor** der bestehenden Zeile
      `Object.keys(state.rooms).forEach(...)` (`js/game.js:1177`) stehen,
      weil `placeItemMesh` über `parentOf` auf die Gruppe zugreift —
      `floorGroup` zieht sie zwar nach, aber die Reihenfolge explizit zu
      machen erspart eine Überraschung bei den Treppenläufen.

- [ ] **Step 7: `buildFloor` die Gruppe ziehen lassen.**
      `js/game.js:806`:

      ```js
      const i = state.floors, g = floorGroup(i);
      ```

- [ ] **Step 8: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`. Sieh dir im Protokoll die gemeldeten
      Mesh-/Schattenzahlen des 50er-Turms an und halte sie im
      Abschlussbericht fest.

---

### Task 6: Wunschkasten und Bewohnerliste für hohe Türme

**Files:**
- `js/game.js` (`renderWishes` 782-790)
- `index.html` (`.wish`-Regeln um `#wishes` bei 50)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task6_wunschkasten.py` (neu)

**Interfaces:**
- `renderWishes()` zeigt höchstens fünf offene Wünsche und hängt, wenn
  mehr offen sind, eine nicht anklickbare Zeile
  `<div class="wish panel more">… und N weitere Wünsche</div>` an.
- `#resident-list` (`index.html:118-122`) braucht keine Änderung: das
  Panel ist bereits `max-height: 84vh; overflow-y: auto`
  (`index.html:118`) und trägt 51 Zeilen.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task6_wunschkasten.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_true

      def full_save(floors, maxf):
          """Jede Etage mit drei Möbeln, damit überall jemand einzieht und
          jeder Wunsch offen ist."""
          rooms = {}
          for i in range(0, floors + 1):
              rooms[str(i)] = [
                  {"id": "stuhl", "cell": 0, "x": 0.0, "z": 0.0, "rot": 0},
                  {"id": "lampe", "cell": 1, "x": 0.6, "z": 0.0, "rot": 0},
                  {"id": "pflanze", "cell": 2, "x": -0.6, "z": 0.0, "rot": 0},
              ]
          return {"floors": floors, "maxFloors": maxf, "rooms": rooms}

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save=full_save(50, 50))
                  cards = page.locator("#wishes .wish")
                  ok &= check("hoechstens sechs Kaesten (5 + Sammelzeile)", cards.count(), 6)
                  ok &= check_true("Sammelzeile nennt eine Anzahl",
                                   "weitere" in page.locator("#wishes .wish.more").inner_text())
                  box = page.locator("#wishes").bounding_box()
                  ok &= check_true(f"Wunschkasten passt auf den Schirm ({box})",
                                   box["y"] + box["height"] <= 768)
                  ok &= check("pageerror 50", errors, [])
                  browser.close()

                  # Bei wenigen offenen Wuenschen keine Sammelzeile
                  browser, page, errors = open_game(pw, save=full_save(3, 10))
                  ok &= check("keine Sammelzeile bei vier Wuenschen",
                              page.locator("#wishes .wish.more").count(), 0)
                  ok &= check_true("vier Kaesten", page.locator("#wishes .wish").count() == 4)
                  ok &= check("pageerror 10", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — heute rendert `renderWishes()` alle offenen
      Wünsche, bei 51 Etagen läuft die Spalte unten aus dem Bild.

- [ ] **Step 2: `renderWishes` begrenzen.** `js/game.js:782-790`
      ersetzen:

      ```js
      const WISH_MAX = 5;
      function renderWishes() {
        const box = $('wishes'); box.innerHTML = '';
        const open = [];
        for (let i = 0; i <= MAXF; i++) if (wishOpen(i)) open.push(i);
        open.slice(0, WISH_MAX).forEach(i => {
          const t = tenantOf(i);
          const d = document.createElement('div'); d.className = 'wish panel';
          d.innerHTML = `<b>${flLabel(i)}:</b> ${t.wtext}`;
          d.onclick = () => { if (edit) exitEdit(); setTimeout(() => enterEdit(t.roofWish ? 'roof' : i), 60); $('extras-menu').classList.remove('open'); };
          box.appendChild(d); });
        if (open.length > WISH_MAX) {
          const rest = open.length - WISH_MAX;
          const d = document.createElement('div'); d.className = 'wish panel more';
          d.textContent = `… und ${rest} weitere ${rest === 1 ? 'Wunsch' : 'Wünsche'} weiter oben.`;
          box.appendChild(d); }
      }
      ```

- [ ] **Step 3: Die Sammelzeile anders aussehen lassen.** In
      `index.html` bei den `.wish`-Regeln (`index.html:51-52`) ergänzen:

      ```css
      .wish.more { cursor: default; font-style: italic; opacity: .8; }
      ```

- [ ] **Step 4: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`.

---

### Task 7: Höhenwahl im Startbildschirm

**Files:**
- `index.html` (`#intro`, Zeilen 236-244; `#floorinfo`, Zeile 156)
- `js/game.js` (`updateHUD` 522-526; `btn-start` 1174; `wishOpen(10)` 977)
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task7_wahl.py` (neu)

**Interfaces:**
- `#intro` bekommt einen Block `#tower-pick` mit drei Knöpfen
  `#pick-10`, `#pick-20`, `#pick-50`. Er ist sichtbar, wenn noch kein
  Spielstand existiert; sonst bleibt der bestehende `#btn-start` allein
  stehen.
- Ein Klick schreibt `state.maxFloors`, speichert sofort (nicht über den
  300-ms-Puffer von `save()`, `js/game.js:37-42`) und lädt die Seite neu,
  falls sich die Höhe ändert; sonst verhält er sich wie `#btn-start`.
- Die drei Zielzahl-Literale werden an `MAXF` gebunden — sofern Issue #35
  das nicht schon getan hat.

Schritte:

- [ ] **Step 1: Zustand von Issue #35 feststellen.** Ausführen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        grep -n "floors-max" index.html js/game.js; \
        grep -n "wishOpen(10)\|/10\`" js/game.js
      ```

      Findet der erste Befehl `floors-max`, ist #35 bereits
      zusammengeführt: Step 4 und Step 5 entfallen dann ersatzlos, der
      Wortlaut der HUD-Zeile bleibt unangetastet. Findet der zweite
      Befehl noch Treffer, sind die Literale zu binden.

- [ ] **Step 2: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task7_wahl.py`:

      ```python
      import json
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_true

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  # Leerer localStorage -> drei Höhenknöpfe
                  browser, page, errors = open_game(pw)
                  ok &= check_true("Höhenwahl sichtbar", page.locator("#tower-pick").is_visible())
                  for pid in ("pick-10", "pick-20", "pick-50"):
                      ok &= check_true(f"#{pid} sichtbar", page.locator(f"#{pid}").is_visible())
                  page.locator("#pick-50").click()
                  page.wait_for_function("() => window.wipfelkratzer && wipfelkratzer.MAXF === 50",
                                         timeout=30000)
                  saved = json.loads(page.evaluate(
                      "() => localStorage.getItem('wipfelkratzer-v1')"))
                  ok &= check("maxFloors gespeichert", saved.get("maxFloors"), 50)
                  ok &= check("MAXF nach Neuladen", page.evaluate("() => wipfelkratzer.MAXF"), 50)
                  ok &= check_true("Höhenwahl danach weg",
                                   not page.locator("#tower-pick").is_visible())
                  ok &= check("pageerror Wahl", errors, [])
                  browser.close()

                  # Vorhandener Spielstand -> keine Höhenwahl
                  browser, page, errors = open_game(pw, save={"floors": 3})
                  ok &= check_true("keine Höhenwahl bei Altstand",
                                   not page.locator("#tower-pick").is_visible())
                  ok &= check_true("Los geht's sichtbar", page.locator("#btn-start").is_visible())
                  hud = " ".join(page.locator("#floorinfo").inner_text().split())
                  ok &= check_true(f"HUD nennt 10 ({hud})", "10" in hud)
                  ok &= check_true("Bauknopf nennt 10",
                                   "/10)" in page.locator("#btn-build").inner_text())
                  ok &= check("pageerror Altstand", errors, [])
                  browser.close()

                  # 50er-Turm: HUD und Knopf nennen 50
                  browser, page, errors = open_game(pw, save={"floors": 3, "maxFloors": 50})
                  hud = " ".join(page.locator("#floorinfo").inner_text().split())
                  ok &= check_true(f"HUD nennt 50 ({hud})", "50" in hud)
                  ok &= check_true("Bauknopf nennt 50",
                                   "/50)" in page.locator("#btn-build").inner_text())
                  ok &= check("pageerror 50", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — `#tower-pick` gibt es noch nicht.

- [ ] **Step 3: Markup ergänzen.** In `index.html` im `#intro`-Panel
      **vor** `#btn-start` einfügen:

      ```html
      <div id="tower-pick" class="hidden">
        <p style="margin:0 0 6px; font-weight:700;">Wie hoch soll der Wipfelkratzer werden?</p>
        <button id="pick-10" class="primary">Kleiner Turm — 10 Stockwerke</button>
        <button id="pick-20">Hoher Turm — 20 Stockwerke</button>
        <button id="pick-50">Riesenturm — 50 Stockwerke</button>
      </div>
      ```

      und bei den `#intro`-Regeln (`index.html`, Block um Zeile 136):

      ```css
      #tower-pick { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
      #tower-pick.hidden { display: none; }
      ```

- [ ] **Step 4: Wahl verdrahten.** In `js/game.js` bei `btn-start`
      (`js/game.js:1174`) ergänzen:

      ```js
      /* Die Turmhöhe steckt in jedem Mass der Szene, die beim Laden des Moduls
         schon steht. Deshalb wird die Wahl geschrieben und die Seite neu
         geladen, statt die Szene zur Laufzeit umzubauen. */
      const freshGame = state.floors === 0 && !Object.keys(state.rooms).length;
      if (freshGame) $('tower-pick').classList.remove('hidden');
      TOWER_CHOICES.forEach(n => { $(`pick-${n}`).onclick = () => {
        if (n === MAXF) { initAudio(); $('intro').classList.add('hidden'); return; }
        state.maxFloors = n;
        try { localStorage.setItem('wipfelkratzer-v1', JSON.stringify(state)); } catch (e) {}
        location.reload(); }; });
      ```

      Der bestehende `$('btn-start').onclick` bleibt unverändert.

- [ ] **Step 5: HUD-Literal binden** — **nur wenn Step 1 zeigt, dass #35
      noch nicht zusammengeführt ist.** In `index.html:156`:

      ```html
      <div class="panel" id="floorinfo">Stockwerke: <span id="floors">0</span> / <span id="floors-max">10</span></div>
      ```

      und in `updateHUD()` (`js/game.js:522`) als erste Anweisung
      ergänzen: `$('floors-max').textContent = MAXF;`

- [ ] **Step 6: Bauknopf- und Wunsch-Literal binden** — **nur wenn Step 1
      sie noch findet.** `js/game.js:523`:

      ```js
      $('btn-build').textContent = state.floors >= MAXF ? 'Fertig gebaut!' : `Stockwerk bauen (${state.floors + 1}/${MAXF})`;
      ```

      und `js/game.js:977`: `wishOpen(10)` wird zu `wishOpen(MAXF)`.

- [ ] **Step 7: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`.

---

### Task 8: Gesamtabnahme gegen alten und neuen Spielstand

**Files:**
- `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task8_abnahme.py` (neu)

**Interfaces:**
- Keine Codeänderung, sofern der Lauf durchgeht. Schlägt etwas fehl, wird
  im jeweils zuständigen Task nachgebessert und dessen Test erneut
  ausgeführt.

Schritte:

- [ ] **Step 1: Abnahmelauf schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-47-turmhoehe/task8_abnahme.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, check, check_true, check_close

      # Ein Spielstand, wie ihn die heutige Version schreibt: kein maxFloors,
      # zehn Stockwerke, eine eingerichtete Wohnung mit Tapete und Boden.
      OLD_SAVE = {
          "floors": 10, "nuts": 6, "bridge": True, "garden": False,
          "night": False, "cutaway": False, "fulfilled": {"3": True},
          "rooms": {
              "3": [
                  {"id": "etagenbett", "cell": 0, "x": -1.2, "z": -0.6, "rot": 0},
                  {"id": "tisch", "cell": 1, "x": 0.4, "z": -0.6, "rot": 0},
                  {"id": "lampe", "cell": 2, "x": 1.3, "z": 0.5, "rot": 0},
                  {"id": "uhr", "cell": 0, "x": 0.3, "y": 1.2, "rot": 0, "wall": "back"},
              ],
              "roof": [{"id": "liegestuhl", "cell": 0, "x": 0.5, "z": 0.3, "rot": 0}],
          },
          "wallpaper": {"3": {"back": "blumen", "left": "mint", "right": "mint", "front": "mint"}},
          "flooring": {"3": "teppich_rot"},
      }

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save=OLD_SAVE)
                  ok &= check("MAXF", page.evaluate("() => wipfelkratzer.MAXF"), 10)
                  ok &= check("floors", page.evaluate("() => wipfelkratzer.state.floors"), 10)
                  ok &= check("Bewohnerzeilen", page.evaluate(
                      "() => { document.getElementById('btn-sign').click();"
                      " return document.querySelectorAll('#resident-list li').length; }"), 11)
                  ok &= check("Möbel in Etage 3", page.evaluate(
                      "() => wipfelkratzer.state.rooms['3'].length"), 4)
                  ok &= check("Tapete erhalten", page.evaluate(
                      "() => wipfelkratzer.state.wallpaper['3'].back"), "blumen")
                  ok &= check("Boden erhalten", page.evaluate(
                      "() => wipfelkratzer.state.flooring['3']"), "teppich_rot")
                  ok &= check_close("W(10)", page.evaluate(
                      "() => wipfelkratzer.dims(10).w"), 4.9 - 0.7)
                  ok &= check("camera.far", page.evaluate("() => wipfelkratzer.camera.far"), 200)
                  ok &= check("fog.far", page.evaluate("() => wipfelkratzer.scene.fog.far"), 110)
                  ok &= check("pageerror Altstand", errors, [])
                  browser.close()

                  # Voller 50er-Turm, alle Etagen bewohnt
                  rooms = {str(i): [
                      {"id": "stuhl", "cell": 0, "x": 0.0, "z": 0.0, "rot": 0},
                      {"id": "lampe", "cell": 1, "x": 0.6, "z": 0.0, "rot": 0},
                      {"id": "pflanze", "cell": 2, "x": -0.6, "z": 0.0, "rot": 0},
                  ] for i in range(0, 51)}
                  browser, page, errors = open_game(
                      pw, save={"floors": 50, "maxFloors": 50, "rooms": rooms})
                  ok &= check("Bewohnerzeilen bei 50", page.evaluate(
                      "() => { document.getElementById('btn-sign').click();"
                      " return document.querySelectorAll('#resident-list li').length; }"), 51)
                  ok &= check_true("Party-Knopf sichtbar", page.evaluate(
                      "() => !document.getElementById('btn-party').classList.contains('hidden')"))
                  ok &= check_true("kein undefined in der Bewohnerliste", page.evaluate(
                      "() => !document.getElementById('resident-list').innerText.includes('undefined')"))
                  ok &= check("Tierübersicht: 51 Familien + Moki", page.evaluate(
                      "() => { document.getElementById('btn-animals').click();"
                      " return document.querySelectorAll('#animal-grid .acard').length; }"), 52)
                  ok &= check("pageerror 50er", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

- [ ] **Step 2: Alle sieben vorherigen Tests noch einmal im Vordergrund
      laufen lassen**, in dieser Reihenfolge:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        for t in task1_maxf task2_verjuengung task3_bewohner task4_szene \
                 task5_leistung task6_wunschkasten task7_wahl task8_abnahme; do \
          echo "== $t"; \
          python3 .superpowers/sdd/2026-09-14-issue-47-turmhoehe/$t.py || exit 1; \
        done
      ```

      Erwartet: acht Mal `ERGEBNIS: PASS`.

- [ ] **Step 3: Screenshots zur Sichtprüfung.** Im selben Lauf für die
      drei Höhen je ein `page.screenshot()` nach
      `#intro`-Wegtippen ablegen und ansehen: steht der Turm ganz im Bild,
      sind die oberen Etagen breit genug, ist nichts umgestülpt?

---

### Task 9: Changelog

**Files:**
- `CHANGELOG.md`

**Interfaces:**
- Der Eintrag gehört unter `## [Unreleased]` mit der Unterüberschrift
  `### Added`, im Stil der bestehenden Einträge: deutscher Fliesstext,
  Issue-Nummer in Klammern am Satzende.
- `version.js` wird **nicht** angefasst, und es gibt **keinen**
  `chore(release)`-Commit.

Schritte:

- [ ] **Step 1: Abschnitt anlegen, falls er fehlt.** Prüfen:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        grep -n "Unreleased" CHANGELOG.md
      ```

      Fehlt er, direkt nach der Einleitung (vor `## [0.5.0] - 2026-09-13`)
      einfügen:

      ```markdown
      ## [Unreleased]

      ### Added
      ```

- [ ] **Step 2: Eintrag schreiben.** Unter `### Added` ergänzen:

      ```markdown
      - Die Turmhöhe ist jetzt wählbar: Wer ein neues Spiel beginnt, entscheidet
        sich am Startbildschirm für einen kleinen Turm mit 10, einen hohen mit 20
        oder einen Riesenturm mit 50 Stockwerken. Der Turm verjüngt sich dabei
        immer bis zum selben Endmass, damit auch die oberste Wohnung noch
        einrichtbar ist; oberhalb der zehnten Etage bekommen die Bewohner ihre
        Namen, Tiere und Wünsche aus Bausteinen, immer dieselben pro Stockwerk.
        Kamera und Nebel wachsen mit, und Stockwerke entstehen erst, wenn sie
        gebaut werden — der Zehner-Turm sieht aus wie bisher und lädt aus jedem
        bestehenden Spielstand unverändert (#47)
      ```

- [ ] **Step 3: Prüfen, dass nichts Verbotenes mitgelaufen ist.**

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        git diff --stat -- version.js; \
        grep -n "ß" CHANGELOG.md | head; \
        Stockwerkzaehl|Stockwerkzaehl|waehlbar|möglich|Turmhoehe" CHANGELOG.md | head
      ```

      Erwartet: `version.js` ohne Änderung, keine `ß`, keine
      Umlaut-Umschreibungen im neuen Eintrag.
