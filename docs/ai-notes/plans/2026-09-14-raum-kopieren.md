# Plan — Einen Raum samt Einrichtung kopieren (Issue #48)

Repo: `game-wipfelkratzer`. Basis: `main` (v0.5.0). Buildless Vanilla:
`index.html` + `js/game.js` + `js/models.js`, three.js r184 über Importmap.
Kein Build-Schritt, kein npm, kein Test-Framework.

**Goal:** Eine fertig eingerichtete Wohnung lässt sich mit zwei Tipps auf
ein anderes Stockwerk übertragen — Möbel, Wandobjekte, Deko, Tapete und
Boden —, ohne dass dabei je unbemerkt etwas verlorengeht.

**Architecture:** Eine Zwischenablage im Arbeitsspeicher hält eine tiefe
Kopie von `state.rooms[quelle]`, `state.wallpaper[quelle]` und
`state.flooring[quelle]` (`js/game.js:35, 43`). Zwei neue Knöpfe in
`#editbar` (`index.html:181-185`) füllen und leeren sie; `enterEdit()`
(`js/game.js:635-656`) entscheidet bei jedem Betreten einer Etage, welcher
der beiden sichtbar ist. Das Einfügen selbst benutzt ausschliesslich
vorhandene Bausteine: `placeItemMesh` (`js/game.js:447-464`) für das Mesh,
`clampEntry` (`js/game.js:427-446`) für die Anpassung an die Masse der
Zieletage, `surfaceYAt` (`js/game.js:415-424`) für die Deko, `applyLook`
(`js/game.js:388-395`) für Tapete und Boden, `checkTenant`/`checkWishes`
(`js/game.js:764, 771-781`) für Bewohner und Wünsche. Die Rückfrage bei
nicht leerem Ziel ist ein Overlay nach dem Muster von `#residents`
(`index.html:208-214`).

**Spec:** `docs/ai-notes/specs/2026-09-14-raum-kopieren-design.md`

## Global Constraints

- **Deutsche UI durchgehend.** Schweizer Schreibweise: `ss` statt `ß`,
  echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Build-Schritt, kein npm,
  kein Test-Runner, kein Bundler. Nur ES-Module.
- **`js/models.js` wird nicht angefasst.** Keine neue Geometrie, kein neues
  Material.
- **Das Speicherformat bleibt unverändert.** `state` bekommt kein neues
  Feld; die Zwischenablage lebt nur im Arbeitsspeicher.
- **Die Dachterrasse bleibt aussen vor** — weder Quelle noch Ziel. Die
  Knöpfe erscheinen dort gar nicht erst.
- **Kein `window.confirm()`, kein `window.alert()`.** Rückfragen laufen
  über ein Overlay in der Bildsprache des Spiels.
- **`version.js` nicht ändern, kein `chore(release)`-Commit.** Der
  Changelog-Eintrag gehört unter `## [Unreleased]`.
- **Verifikation ist headless Playwright** gegen einen lokalen
  `python3 -m http.server`. Null `pageerror` gehört zu jedem Durchlauf.
- **Jeder Verifikationslauf läuft im Vordergrund. Niemals
  `run_in_background`.** `CLAUDE.md` verbietet das ausdrücklich: ein
  backgroundeter Playwright-Lauf meldet sich nie zurück, der Agent
  verbrennt seine Turns mit Warten und meldet am Ende «success», ohne
  etwas gepusht zu haben. Issue #11 ist genau so gestorben. Wenn ein Lauf
  langsam ist, gib dem Vordergrundaufruf ein grosszügiges `timeout` und
  lass ihn blockieren.
- **Server über den Port beenden**, nie über `pkill -f`: der Harness hält
  das `Popen`-Objekt und ruft `proc.terminate()`.
- **Branch vor der Verifikation pushen**, nicht danach.

## Verifikations-Harness

Wegwerf-Skripte liegen unter
`.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/` (per `.gitignore`
ausgeschlossen). Lege dort zuerst `harness.py` an — alle Task-Skripte
importieren es:

```python
# .superpowers/sdd/2026-09-14-issue-48-raum-kopieren/harness.py
import json
import pathlib
import subprocess
import sys
import time
import urllib.request

REPO = pathlib.Path(__file__).resolve().parents[3]
PORT = 8948
BASE = f"http://127.0.0.1:{PORT}/"

# Eine eingerichtete Quellwohnung auf Etage 2: zwei Möbel, eine Deko auf dem
# Tisch, ein Wandobjekt an der linken Wand. Dazu Tapete und Boden.
SOURCE_ROOM = [
    {"id": "tisch", "cell": 0, "x": -0.8, "z": -0.4, "rot": 0, "y": 0.155},
    {"id": "sofa", "cell": 1, "x": 0.9, "z": -0.4, "rot": 0, "y": 0.155},
    {"id": "vase", "cell": 0, "x": -0.8, "z": -0.4, "rot": 0, "y": 0.9},
    {"id": "uhr", "cell": 0, "x": 0.2, "y": 1.3, "rot": 0, "wall": "left"},
]


def base_save(**over):
    save = {
        "floors": 6, "nuts": 0, "rooms": {"2": [dict(e) for e in SOURCE_ROOM]},
        "wallpaper": {"2": {"back": "blumen", "left": "mint",
                            "right": "mint", "front": "punkte"}},
        "flooring": {"2": "teppich_blau"},
    }
    save.update(over)
    return save


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
    """Browser + Seite mit vorbelegtem Spielstand, Startbildschirm bereits weg."""
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
    page.wait_for_function("() => window.wipfelkratzer !== undefined", timeout=30000)
    page.wait_for_timeout(1500)  # three.js-Aufbau unter swiftshader
    page.evaluate("() => document.getElementById('intro').classList.add('hidden')")
    return browser, page, errors


def enter(page, k):
    """In die Einrichtungsansicht einer Etage wechseln und die Kamerafahrt abwarten."""
    page.evaluate(
        "(k) => { if (wipfelkratzer.edit) wipfelkratzer.exitEdit();"
        " wipfelkratzer.enterEdit(k); }", k)
    page.wait_for_timeout(1200)


def check(label, actual, expected):
    ok = actual == expected
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {actual!r}"
          + ("" if ok else f"  (erwartet {expected!r})"))
    return ok


def check_true(label, value):
    ok = bool(value)
    print(("PASS  " if ok else "FAIL  ") + f"{label}: {value!r}")
    return ok
```

Aufruf immer so — im Vordergrund, mit grosszügigem Timeout:

```bash
cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
  python3 .superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task1_knoepfe.py
```

Ein 404 auf `favicon.png` ist erwartet und wird nicht gewertet; gewertet
wird nur `pageerror`.

---

### Task 1: Zwischenablage und die zwei Knöpfe in `#editbar`

**Files:**
- `index.html` (`#editbar`, Zeilen 181-185)
- `js/game.js` (`enterEdit` 635-656; `exitEdit` 657-670; neuer Block bei
  den Einrichten-Funktionen; Debug-Zugriff 1188)
- `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/harness.py` (neu)
- `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task1_knoepfe.py` (neu)

**Interfaces:**
- Neu in `#editbar`: `<button id="btn-roomcopy">Raum kopieren</button>` und
  `<button id="btn-roompaste">Raum einfügen</button>`, beide vor
  `#btn-done`.
- Neu in `js/game.js`: `let clip = null;` — die Zwischenablage. Gefüllt
  trägt sie `{ from, items, wallpaper, flooring }`.
- Neu: `function updateRoomClipButtons()` — setzt die Sichtbarkeit beider
  Knöpfe aus `edit` und `clip`. Wird von `enterEdit()` am Ende und vom
  Kopier-Knopf gerufen.
- Sichtbarkeitsregeln: «Raum kopieren» nur wenn `edit && edit.k !==
  'roof'`; «Raum einfügen» nur wenn zusätzlich `clip` gesetzt ist und
  `clip.from !== edit.k`.
- `window.wipfelkratzer` (`js/game.js:1188`) wird um `roomOf`,
  `itemMeshes` und einen Getter auf `clip` erweitert.

Schritte:

- [ ] **Step 1: Harness anlegen.** Verzeichnis
      `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/` erstellen und
      `harness.py` mit dem Inhalt aus dem Abschnitt
      «Verifikations-Harness» ablegen.

- [ ] **Step 2: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task1_knoepfe.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, enter, base_save, check, check_true

      def vis(page, sel):
          return page.evaluate(
              "(s) => { const el = document.querySelector(s);"
              " return !!el && el.offsetParent !== null; }", sel)

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save=base_save())

                  # Ausserhalb der Einrichtungsansicht: beide weg
                  ok &= check("Kopieren aus, ohne Edit", vis(page, "#btn-roomcopy"), False)
                  ok &= check("Einfuegen aus, ohne Edit", vis(page, "#btn-roompaste"), False)

                  # Normale Etage: Kopieren da, Einfuegen noch nicht
                  enter(page, 2)
                  ok &= check("Kopieren sichtbar in Etage 2", vis(page, "#btn-roomcopy"), True)
                  ok &= check("Einfuegen noch aus", vis(page, "#btn-roompaste"), False)

                  # Kopieren fuellt die Zwischenablage
                  page.locator("#btn-roomcopy").click()
                  page.wait_for_timeout(200)
                  ok &= check("clip.from", page.evaluate("() => wipfelkratzer.clip.from"), 2)
                  ok &= check("clip hat vier Eintraege",
                              page.evaluate("() => wipfelkratzer.clip.items.length"), 4)
                  ok &= check("Einfuegen in der Quelle weiter aus",
                              vis(page, "#btn-roompaste"), False)

                  # Andere Etage: Einfuegen da
                  enter(page, 4)
                  ok &= check("Einfuegen sichtbar in Etage 4", vis(page, "#btn-roompaste"), True)
                  ok &= check("Kopieren auch sichtbar", vis(page, "#btn-roomcopy"), True)

                  # Dachterrasse: beide weg
                  enter(page, "roof")
                  ok &= check("Kopieren aus auf dem Dach", vis(page, "#btn-roomcopy"), False)
                  ok &= check("Einfuegen aus auf dem Dach", vis(page, "#btn-roompaste"), False)

                  # Die Kopie ist tief: Umraeumen der Quelle ändert sie nicht
                  page.evaluate("() => { wipfelkratzer.exitEdit();"
                                " wipfelkratzer.state.rooms['2'].length = 1; }")
                  ok &= check("clip bleibt bei vier",
                              page.evaluate("() => wipfelkratzer.clip.items.length"), 4)

                  ok &= check("pageerror", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — `#btn-roomcopy` gibt es noch nicht.

- [ ] **Step 3: Markup ergänzen.** In `index.html` das `#editbar`-Panel
      (Zeilen 181-185) ersetzen durch:

      ```html
      <div id="editbar" class="panel">
        <span id="edit-title"></span>
        <button id="btn-roomcopy" class="hidden">Raum kopieren</button>
        <button id="btn-roompaste" class="hidden">Raum einfügen</button>
        <button id="btn-tip">Tipp</button>
        <button id="btn-done" class="primary">Fertig</button>
      </div>
      ```

      Die Klasse `hidden` ist im Stylesheet bereits definiert und wird
      auch von `#btn-party` (`index.html:177`) so benutzt.

- [ ] **Step 4: Zwischenablage und Sichtbarkeit.** In `js/game.js` direkt
      **nach** `deselect()`/`select()` (also nach `js/game.js:679`, vor
      `addItem`) einfügen:

      ```js
      /* ---------- Raum kopieren ----------
         Die Zwischenablage hält eine tiefe Kopie der Quellwohnung: Möbelliste,
         Tapete (vier Wände) und Bodenbelag. Sie lebt nur in dieser Sitzung und
         wird nicht gespeichert — ein über Tage gemerkter Raum, dessen Quelle
         längst umgeräumt ist, wäre mehr Überraschung als Hilfe. */
      let clip = null;
      const deepCopy = v => JSON.parse(JSON.stringify(v));
      function updateRoomClipButtons() {
        const normal = !!edit && edit.k !== 'roof';
        $('btn-roomcopy').classList.toggle('hidden', !normal);
        $('btn-roompaste').classList.toggle('hidden', !(normal && clip && clip.from !== edit.k));
      }
      function copyRoom() {
        if (!edit || edit.k === 'roof') return;
        const k = edit.k;
        clip = { from: k, items: deepCopy(roomOf(k)),
          wallpaper: deepCopy(wallpaperOf(k)), flooring: state.flooring[k] || null };
        updateRoomClipButtons(); sfx.pop();
        toast(`Wohnung ${flLabel(k)} gemerkt — geh auf ein anderes Stockwerk und tippe auf «Raum einfügen».`);
      }
      $('btn-roomcopy').onclick = copyRoom;
      ```

- [ ] **Step 5: `enterEdit` und `exitEdit` anschliessen.** In
      `enterEdit()` die vorletzte Zeile (`js/game.js:655`) um den Aufruf
      ergänzen:

      ```js
        updateRoomClipButtons();
        updateHUD(); sfx.whoosh();
      ```

      und in `exitEdit()` nach `edit = null;` (`js/game.js:663`):

      ```js
        updateRoomClipButtons();
      ```

      (`updateRoomClipButtons` liest `edit`; nach dem Nullsetzen verstecken
      sich damit beide Knöpfe von selbst.)

- [ ] **Step 6: Debug-Zugriff erweitern.** `js/game.js:1188` ergänzen:

      ```js
      window.wipfelkratzer = { state, floorGroups, roofG, roofStairG, roofGapG, scene, camera, controls, WALL_KEYS, roomOf, itemMeshes, get clip() { return clip; }, get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; } };
      ```

- [ ] **Step 7: Test erneut im Vordergrund laufen lassen** — derselbe
      Befehl wie in Step 2. Erwartet: `ERGEBNIS: PASS`, keine
      `pageerror`.

---

### Task 2: Einfügen in eine leere Wohnung

**Files:**
- `js/game.js` (neuer Block direkt nach `copyRoom`)
- `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task2_einfuegen.py` (neu)

**Interfaces:**
- Neu: `function pasteEntries(k, items)` — fügt die Einträge in Etage `k`
  ein und liefert die Liste der eingefügten `id`-Werte zurück. Reihenfolge:
  erst alle Einträge, die **keine** Deko sind, dann die Deko — damit
  `surfaceYAt` die frisch gestellten Möbel schon sieht.
- Neu: `function pasteRoom()` — der Knopf-Handler. In diesem Task nur der
  Fall «Ziel ist leer»; der Rückfrage-Zweig kommt in Task 4 dazu.
- Je Eintrag: `cell` auf `colsOf(k) * 2 - 1` begrenzen, `placeItemMesh(k,
  entry)`, `clampEntry(k, mesh, entry)`; für Deko davor
  `entry.y = surfaceYAt(k, entry.x, entry.z)`.
- `save()` und `updateHUD()` am Ende.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task2_einfuegen.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, enter, base_save, check, check_true

      TARGET = """() => {
        const k = 5, arr = wipfelkratzer.roomOf(k);
        return {
          ids: arr.map(e => e.id),
          cells: arr.map(e => e.cell),
          walls: arr.filter(e => e.wall).map(e => ({ wall: e.wall, x: e.x, z: e.z, y: e.y })),
          xs: arr.filter(e => !e.wall).map(e => e.x),
          zs: arr.filter(e => !e.wall).map(e => e.z),
          ys: arr.map(e => e.y),
          meshes: wipfelkratzer.itemMeshes[k].length,
          parentOk: wipfelkratzer.itemMeshes[k].every(m => m.parent === wipfelkratzer.floorGroups[k]),
          cols: 2 * Math.max(3, Math.floor(wipfelkratzer.dims(k).w / 0.95)),
          halfW: wipfelkratzer.dims(k).w / 2 + 0.35,
          halfD: wipfelkratzer.dims(k).d / 2 + 0.5,
        };
      }"""

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save=base_save())
                  enter(page, 2)
                  page.locator("#btn-roomcopy").click()
                  enter(page, 5)
                  page.locator("#btn-roompaste").click()
                  page.wait_for_timeout(500)

                  t = page.evaluate(TARGET)
                  ok &= check("ids in Etage 5", sorted(t["ids"]),
                              sorted(["tisch", "sofa", "vase", "uhr"]))
                  ok &= check("Möbel vor Deko",
                              t["ids"].index("vase") > t["ids"].index("tisch"), True)
                  ok &= check("Meshes = Eintraege", t["meshes"], len(t["ids"]))
                  ok &= check_true("alle Meshes an der Zieletage", t["parentOk"])
                  ok &= check_true(f"Zellen im Bereich ({t['cells']} < {t['cols']})",
                                   all(0 <= c < t["cols"] for c in t["cells"]))
                  ok &= check_true(f"x im Raum ({t['xs']})",
                                   all(abs(x) < t["halfW"] for x in t["xs"]))
                  ok &= check_true(f"z im Raum ({t['zs']})",
                                   all(abs(z) < t["halfD"] for z in t["zs"]))
                  ok &= check("Wandobjekt behaelt die Wand",
                              [w["wall"] for w in t["walls"]], ["left"])
                  ok &= check_true("Vase liegt über dem Boden",
                                   t["ys"][t["ids"].index("vase")] > 0.3)
                  ok &= check("pageerror", errors, [])

                  # Die Wandebene stammt aus der Zieletage, nicht aus der Quelle
                  same = page.evaluate("""() => {
                    const q = wipfelkratzer.wallPlacement(2, 'left').fixed;
                    const z = wipfelkratzer.wallPlacement(5, 'left').fixed;
                    const m = wipfelkratzer.itemMeshes[5].find(
                      m => m.userData.pick.entry.wall === 'left');
                    return { q, z, mx: m.position.x };
                  }""")
                  ok &= check_true(f"Wandebene der Zieletage ({same})",
                                   abs(same["mx"] - same["z"]) < 1e-6)

                  # Neu laden: die Kopie überlebt
                  page.reload(wait_until="load")
                  page.wait_for_function("() => window.wipfelkratzer !== undefined", timeout=30000)
                  page.wait_for_timeout(1500)
                  ok &= check("nach Neuladen vier Eintraege",
                              page.evaluate("() => wipfelkratzer.roomOf(5).length"), 4)
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — `#btn-roompaste` hat noch keinen Handler,
      Etage 5 bleibt leer.

- [ ] **Step 2: Einfügen schreiben.** Direkt nach `copyRoom` (Task 1,
      Step 4) einfügen:

      ```js
      /* Eingefügt wird in zwei Durchgängen: erst die Möbel, dann die Deko. Nur so
         sieht surfaceYAt beim Ablegen der Vase den Tisch, auf dem sie stand.
         clampEntry rechnet jeden Eintrag auf die Masse der ZIELetage um — obere
         Stockwerke sind schmaler als untere (siehe W/D). */
      function pasteEntries(k, items) {
        const maxCell = colsOf(k) * 2 - 1;
        const order = [...items.filter(e => !DECO.has(e.id)), ...items.filter(e => DECO.has(e.id))];
        const placed = [];
        order.forEach(src => {
          const en = deepCopy(src);
          en.cell = Math.max(0, Math.min(maxCell, en.cell || 0));
          if (DECO.has(en.id)) en.y = surfaceYAt(k, en.x, en.z);
          else if (!WALL_ITEMS.has(en.id)) en.y = baseY(k);
          roomOf(k).push(en);
          const m = placeItemMesh(k, en);
          clampEntry(k, m, en);
          placed.push(en.id);
        });
        return placed;
      }
      function pasteRoom() {
        if (!edit || edit.k === 'roof' || !clip || clip.from === edit.k) return;
        const k = edit.k;
        pasteEntries(k, clip.items);
        deselect(); sfx.pop(); save(); updateHUD();
        toast(`Die Wohnung von Stockwerk ${flLabel(clip.from)} ist eingezogen!`);
      }
      $('btn-roompaste').onclick = pasteRoom;
      ```

      `colsOf`, `DECO`, `WALL_ITEMS`, `baseY`, `surfaceYAt`,
      `placeItemMesh` und `clampEntry` stehen alle weiter oben im Modul
      (`js/game.js:359, 366, 364, 415, 427, 447`, `WALL_ITEMS` aus dem
      Import in Zeile 3) und sind hier verfügbar.

- [ ] **Step 3: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`. Achte im Protokoll besonders auf die Zeile
      «Wandebene der Zieletage» — sie belegt, dass die Kopie nicht die
      Masse der Quelle mitschleppt.

---

### Task 3: Tapete und Boden mitkopieren

**Files:**
- `js/game.js` (`pasteRoom`)
- `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task3_tapete.py` (neu)

**Interfaces:**
- `pasteRoom()` schreibt nach dem Einfügen der Möbel
  `state.wallpaper[k]` aus `clip.wallpaper` (tiefe Kopie, alle vier
  Schlüssel aus `WALL_KEYS`, `js/game.js:15`) und `state.flooring[k]` aus
  `clip.flooring`, und ruft anschliessend `applyLook(k)`
  (`js/game.js:388-395`), damit die Materialien wechseln.
- Ist `clip.flooring` `null` (Quelle hatte keinen Belag), wird
  `state.flooring[k]` gelöscht statt auf `null` gesetzt — `applyLook`
  prüft auf Falsy (`js/game.js:394`), aber `save()` soll keinen
  Null-Eintrag mitschleppen.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task3_tapete.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, enter, base_save, check, check_true

      LOOK = """(k) => ({
        wp: wipfelkratzer.state.wallpaper[k],
        fl: wipfelkratzer.state.flooring[k],
        matMaps: wipfelkratzer.WALL_KEYS.map(
          key => !!wipfelkratzer.floorGroups[k].userData.wallMats[key].map),
        floorMap: !!wipfelkratzer.floorGroups[k].userData.floorMat.map,
      })"""

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save=base_save())
                  enter(page, 2)
                  page.locator("#btn-roomcopy").click()
                  enter(page, 5)
                  page.locator("#btn-roompaste").click()
                  page.wait_for_timeout(500)

                  src = page.evaluate(LOOK, 2)
                  dst = page.evaluate(LOOK, 5)
                  ok &= check("Tapete übernommen", dst["wp"], src["wp"])
                  ok &= check("Boden übernommen", dst["fl"], "teppich_blau")
                  ok &= check_true("alle vier Wandmaterialien haben eine Textur",
                                   all(dst["matMaps"]))
                  ok &= check_true("Bodenmaterial hat eine Textur", dst["floorMap"])

                  # Die Kopie hängt nicht am selben Objekt wie die Quelle
                  page.evaluate("() => { wipfelkratzer.state.wallpaper['2'].back = 'sonne'; }")
                  ok &= check("Ziel bleibt unabhaengig",
                              page.evaluate("() => wipfelkratzer.state.wallpaper['5'].back"),
                              "blumen")

                  # Quelle ohne Bodenbelag: das Ziel bekommt keinen Null-Eintrag
                  page.evaluate("() => { delete wipfelkratzer.state.flooring['2']; }")
                  enter(page, 2)
                  page.locator("#btn-roomcopy").click()
                  enter(page, 6)
                  page.locator("#btn-roompaste").click()
                  page.wait_for_timeout(400)
                  ok &= check("kein Boden-Eintrag bei leerer Quelle",
                              page.evaluate("() => 'flooring' in wipfelkratzer.state"
                                            " && '6' in wipfelkratzer.state.flooring"), False)
                  ok &= check("pageerror", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — Tapete und Boden werden noch nicht
      übertragen.

- [ ] **Step 2: `pasteRoom` erweitern.** Den Rumpf von `pasteRoom` (Task
      2, Step 2) um den Look ergänzen, unmittelbar nach
      `pasteEntries(k, clip.items);`:

      ```js
        /* Tapete liegt pro Wand, der Bodenbelag als einzelne Id — beides
           getrennt von der Möbelliste. Wer «den Raum» kopiert, meint sie mit. */
        state.wallpaper[k] = deepCopy(clip.wallpaper);
        if (clip.flooring) state.flooring[k] = clip.flooring;
        else delete state.flooring[k];
        applyLook(k);
      ```

- [ ] **Step 3: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`.

- [ ] **Step 4: Task 2 nachprüfen.** `task2_einfuegen.py` noch einmal im
      Vordergrund laufen lassen — der Look-Teil darf die Möbelprüfungen
      nicht verschoben haben. Erwartet: weiterhin `ERGEBNIS: PASS`.

---

### Task 4: Rückfrage bei nicht leerem Ziel

**Files:**
- `index.html` (neues Overlay `#pasteask` samt CSS)
- `js/game.js` (`pasteRoom`; neue Funktionen `clearRoom`,
  `askPaste`)
- `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task4_rueckfrage.py` (neu)

**Interfaces:**
- Neues Overlay `#pasteask` nach dem Muster von `#residents`
  (`index.html:208-214`, CSS `index.html:84-85, 118`) mit drei Knöpfen:
  `#paste-replace` («Alles ersetzen», `class="danger"`), `#paste-add`
  («Dazustellen», `class="primary"`) und `#paste-cancel` («Abbrechen»).
- `pasteRoom()` prüft `roomOf(k).length`: ist sie `0`, wird direkt
  eingefügt (Verhalten aus Task 2/3); sonst öffnet sich `#pasteask` und
  **nichts** am Zustand ändert sich, bis ein Knopf gedrückt wird.
- Neu: `function clearRoom(k)` — leert Liste **und** Meshes, mit derselben
  Mechanik wie `removeItem` (`js/game.js:713-719`).
- Neu: `function doPaste(k, replace)` — führt aus, was der Dialog
  entschieden hat.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task4_rueckfrage.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, enter, base_save, check, check_true

      def with_target():
          """Quelle auf Etage 2 (vier Sachen), Ziel auf Etage 5 (zwei Sachen)."""
          save = base_save()
          save["rooms"]["5"] = [
              {"id": "bett", "cell": 0, "x": -0.7, "z": -0.4, "rot": 0, "y": 0.155},
              {"id": "lampe", "cell": 1, "x": 0.8, "z": 0.3, "rot": 0, "y": 0.155},
          ]
          return save

      def counts(page, k):
          return page.evaluate(
              "(k) => ({ list: wipfelkratzer.roomOf(k).length,"
              " meshes: wipfelkratzer.itemMeshes[k].length })", k)

      def copy_to_5(page):
          enter(page, 2)
          page.locator("#btn-roomcopy").click()
          enter(page, 5)
          page.locator("#btn-roompaste").click()
          page.wait_for_timeout(300)

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  # Abbrechen ändert nichts
                  browser, page, errors = open_game(pw, save=with_target())
                  copy_to_5(page)
                  ok &= check_true("Dialog offen", page.locator("#pasteask").is_visible())
                  ok &= check("vor der Antwort unverändert", counts(page, 5),
                              {"list": 2, "meshes": 2})
                  page.locator("#paste-cancel").click()
                  page.wait_for_timeout(300)
                  ok &= check_true("Dialog zu", not page.locator("#pasteask").is_visible())
                  ok &= check("nach Abbrechen unverändert", counts(page, 5),
                              {"list": 2, "meshes": 2})
                  ok &= check("pageerror Abbrechen", errors, [])
                  browser.close()

                  # Dazustellen
                  browser, page, errors = open_game(pw, save=with_target())
                  copy_to_5(page)
                  page.locator("#paste-add").click()
                  page.wait_for_timeout(500)
                  ok &= check("nach Dazustellen", counts(page, 5),
                              {"list": 6, "meshes": 6})
                  ok &= check_true("das alte Bett steht noch", page.evaluate(
                      "() => wipfelkratzer.roomOf(5).some(e => e.id === 'bett')"))
                  ok &= check("pageerror Dazustellen", errors, [])
                  browser.close()

                  # Alles ersetzen
                  browser, page, errors = open_game(pw, save=with_target())
                  copy_to_5(page)
                  page.locator("#paste-replace").click()
                  page.wait_for_timeout(500)
                  ok &= check("nach Ersetzen", counts(page, 5),
                              {"list": 4, "meshes": 4})
                  ok &= check_true("das alte Bett ist weg", page.evaluate(
                      "() => !wipfelkratzer.roomOf(5).some(e => e.id === 'bett')"))
                  ok &= check_true("keine Geistermöbel an der Etage", page.evaluate(
                      "() => wipfelkratzer.floorGroups[5].children"
                      ".filter(o => o.userData && o.userData.pick).length") == 4)
                  ok &= check("pageerror Ersetzen", errors, [])
                  browser.close()

                  # Leeres Ziel: keine Rueckfrage
                  browser, page, errors = open_game(pw, save=base_save())
                  copy_to_5(page)
                  ok &= check_true("kein Dialog bei leerem Ziel",
                                   not page.locator("#pasteask").is_visible())
                  ok &= check("direkt eingefuegt", counts(page, 5),
                              {"list": 4, "meshes": 4})
                  ok &= check("pageerror leeres Ziel", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — `#pasteask` gibt es noch nicht, und Task 2
      fügt heute ohne Rückfrage in ein volles Ziel ein.

- [ ] **Step 2: Overlay-Markup ergänzen.** In `index.html` **nach** dem
      `#residents`-Block (Zeile 214) einfügen:

      ```html
      <div id="pasteask">
        <div class="panel">
          <h2>Hier wohnt schon etwas</h2>
          <p id="pasteask-text"></p>
          <div id="pasteask-buttons">
            <button id="paste-add" class="primary">Dazustellen</button>
            <button id="paste-replace" class="danger">Alles ersetzen</button>
            <button id="paste-cancel">Abbrechen</button>
          </div>
        </div>
      </div>
      ```

      und im Stylesheet neben den `#residents`-Regeln
      (`index.html:84-85, 118`):

      ```css
      #pasteask { position: fixed; inset: 0; z-index: 10; display: none; align-items: center; justify-content: center; background: rgba(60,40,20,.35); }
      #pasteask.open { display: flex; }
      #pasteask .panel { width: min(420px, 92vw); padding: 16px 20px; }
      #pasteask h2 { margin: 0 0 8px; color: var(--wood); }
      #pasteask p { margin: 0 0 12px; font-size: 15px; line-height: 1.35; }
      #pasteask-buttons { display: flex; flex-direction: column; gap: 8px; }
      ```

- [ ] **Step 3: Leeren und Ausführen trennen.** In `js/game.js` die
      Funktion `pasteRoom` aus Task 2/3 ersetzen durch:

      ```js
      /* Leeren mit derselben Mechanik wie removeItem: Liste, Szenengraph und
         itemMeshes müssen zusammen aufgeräumt werden, sonst bleiben Möbel
         sichtbar stehen, die es im Spielstand nicht mehr gibt. */
      function clearRoom(k) {
        itemMeshes[k].slice().forEach(m => parentOf(k).remove(m));
        itemMeshes[k].length = 0;
        roomOf(k).length = 0;
      }
      function doPaste(k, replace) {
        if (replace) clearRoom(k);
        pasteEntries(k, clip.items);
        state.wallpaper[k] = deepCopy(clip.wallpaper);
        if (clip.flooring) state.flooring[k] = clip.flooring;
        else delete state.flooring[k];
        applyLook(k);
        deselect(); sfx.pop(); save(); updateHUD();
        toast(`Die Wohnung von Stockwerk ${flLabel(clip.from)} ist eingezogen!`);
      }
      let pasteTarget = null;
      function pasteRoom() {
        if (!edit || edit.k === 'roof' || !clip || clip.from === edit.k) return;
        const k = edit.k;
        if (!roomOf(k).length) { doPaste(k, false); return; }
        pasteTarget = k;
        $('pasteask-text').textContent =
          `In Stockwerk ${flLabel(k)} stehen schon ${roomOf(k).length} Sachen. Soll die kopierte Wohnung dazukommen oder alles ersetzen?`;
        $('pasteask').classList.add('open');
      }
      $('btn-roompaste').onclick = pasteRoom;
      function closePasteAsk() { $('pasteask').classList.remove('open'); pasteTarget = null; }
      $('paste-cancel').onclick = closePasteAsk;
      $('pasteask').onclick = e => { if (e.target === $('pasteask')) closePasteAsk(); };
      $('paste-add').onclick = () => { const k = pasteTarget; closePasteAsk(); if (k !== null) doPaste(k, false); };
      $('paste-replace').onclick = () => { const k = pasteTarget; closePasteAsk(); if (k !== null) doPaste(k, true); };
      ```

      Der Klick auf den Hintergrund schliesst den Dialog wie bei
      `#residents`, `#animals` und `#gallery` (`js/game.js:843, 1172`).

- [ ] **Step 4: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`.

- [ ] **Step 5: Task 2 und 3 nachprüfen.** Beide Skripte noch einmal im
      Vordergrund laufen lassen; sie decken den Zweig «leeres Ziel» ab,
      der durch den Umbau neu verdrahtet wurde. Erwartet: zweimal
      `ERGEBNIS: PASS`.

---

### Task 5: Bewohner und Wünsche nach dem Einfügen

**Files:**
- `js/game.js` (`doPaste`)
- `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task5_bewohner.py` (neu)

**Interfaces:**
- `doPaste()` ruft nach `applyLook(k)`:
  `checkTenant(k)` (`js/game.js:764`), danach je eingefügtem Gegenstand
  einmal `checkWishes(id, k)` (`js/game.js:771-781`), dann
  `renderWishes()` und `renderResidents()`.
- `pasteEntries` liefert dafür die Liste der eingefügten `id`-Werte
  zurück (schon in Task 2 so angelegt).
- Bewohner werden **nicht** kopiert: `tenantGroups` (`js/game.js:243`)
  wird nicht angefasst; `checkTenant` lässt die Familie der **Zieletage**
  einziehen.

Schritte:

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Datei
      `.superpowers/sdd/2026-09-14-issue-48-raum-kopieren/task5_bewohner.py`:

      ```python
      import sys
      from playwright.sync_api import sync_playwright
      from harness import serve, stop, open_game, enter, base_save, check, check_true

      def wish_save():
          """Quelle auf Etage 2 enthaelt das Wunschmöbel von Etage 5
          (Jimmy Wiesel und Jule Wuehlmaus wuenschen sich ein Sofa) sowie zwei
          weitere Sachen, damit tenantIn greift."""
          save = base_save()
          save["nuts"] = 0
          return save

      def main():
          proc = serve()
          ok = True
          try:
              with sync_playwright() as pw:
                  browser, page, errors = open_game(pw, save=wish_save())
                  # Das Sofa in der Quellwohnung ist genau der Wunsch von Etage 5
                  # (TENANTS[5], js/game.js:25) — die Kopie muss ihn erfuellen.
                  ok &= check_true("Quelle enthaelt ein Sofa", page.evaluate(
                      "() => wipfelkratzer.roomOf(2).some(e => e.id === 'sofa')"))
                  ok &= check("Etage 5 anfangs unbewohnt", page.evaluate(
                      "() => !!wipfelkratzer.tenantGroups[5]"), False)

                  enter(page, 2)
                  page.locator("#btn-roomcopy").click()
                  enter(page, 5)
                  page.locator("#btn-roompaste").click()
                  page.wait_for_timeout(700)

                  ok &= check_true("Etage 5 ist jetzt bewohnt", page.evaluate(
                      "() => !!wipfelkratzer.tenantGroups[5]"))
                  ok &= check("Wunsch von Etage 5 erfuellt", page.evaluate(
                      "() => !!wipfelkratzer.state.fulfilled[5]"), True)
                  nuts = page.evaluate("() => wipfelkratzer.state.nuts")
                  ok &= check("drei Haselnuesse gutgeschrieben", nuts, 3)

                  # Die Bewohnerliste nennt für Etage 5 die eigene Familie
                  page.evaluate("() => { wipfelkratzer.exitEdit();"
                                " document.getElementById('btn-sign').click(); }")
                  page.wait_for_timeout(300)
                  row5 = page.evaluate("""() => {
                    const lis = [...document.querySelectorAll('#resident-list li')];
                    const li = lis.find(l => l.querySelector('.fl').textContent === '5');
                    return li ? li.innerText : null;
                  }""")
                  ok &= check_true(f"Etage 5 hat eigene Bewohner ({row5})",
                                   row5 and "Jimmy" in row5)

                  # Quelle behaelt ihre eigenen Bewohner, nichts wurde verschoben
                  ok &= check_true("Etage 2 weiterhin bewohnt", page.evaluate(
                      "() => !!wipfelkratzer.tenantGroups[2]"))

                  # Ein zweites Einfuegen zahlt nicht noch einmal
                  page.evaluate("() => document.getElementById('btn-resclose').click()")
                  enter(page, 6)
                  page.locator("#btn-roompaste").click()
                  page.wait_for_timeout(600)
                  ok &= check("Nuesse nach dem zweiten Einfuegen", page.evaluate(
                      "() => wipfelkratzer.state.nuts") >= nuts, True)
                  ok &= check("Etage 5 zahlt nicht doppelt", page.evaluate(
                      "() => wipfelkratzer.state.fulfilled[5]"), True)
                  ok &= check("pageerror", errors, [])
                  browser.close()
          finally:
              stop(proc)
          print("ERGEBNIS:", "PASS" if ok else "FAIL")
          return 0 if ok else 1

      sys.exit(main())
      ```

      Erwartet: **FAIL** — heute zieht nach dem Einfügen niemand ein,
      `tenantGroups[5]` bleibt leer (und `wipfelkratzer.tenantGroups`
      gibt es noch gar nicht, das kommt in Step 3).

- [ ] **Step 2: `doPaste` abschliessen.** In `doPaste` (Task 4, Step 3)
      die Zeile `pasteEntries(k, clip.items);` durch den vollständigen
      Nachlauf ersetzen:

      ```js
        const ids = pasteEntries(k, clip.items);
        state.wallpaper[k] = deepCopy(clip.wallpaper);
        if (clip.flooring) state.flooring[k] = clip.flooring;
        else delete state.flooring[k];
        applyLook(k);
        /* Bewohner werden nicht mitkopiert — die Tiere hängen an tenantGroups[i]
           und gehören zur Wohnung, nicht zur Einrichtung. Was die Kopie auslöst,
           ist der Einzug der Familie, die auf DIESE Etage gehört, und die
           Erfüllung ihres Wunsches, falls er mitgekommen ist. */
        checkTenant(k);
        ids.forEach(id => checkWishes(id, k));
        renderWishes(); renderResidents();
        deselect(); sfx.pop(); save(); updateHUD();
      ```

- [ ] **Step 3: Debug-Zugriff erweitern.** `js/game.js:1188` um
      `tenantGroups` ergänzen (an das bestehende Objektliteral anhängen,
      wie in Task 1, Step 6).

- [ ] **Step 4: Test erneut im Vordergrund laufen lassen.** Erwartet:
      `ERGEBNIS: PASS`.

- [ ] **Step 5: Alle vorherigen Tests noch einmal laufen lassen**, im
      Vordergrund, in dieser Reihenfolge:

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        for t in task1_knoepfe task2_einfuegen task3_tapete task4_rueckfrage \
                 task5_bewohner; do \
          echo "== $t"; \
          python3 .superpowers/sdd/2026-09-14-issue-48-raum-kopieren/$t.py || exit 1; \
        done
      ```

      Erwartet: fünf Mal `ERGEBNIS: PASS`.

- [ ] **Step 6: Screenshot zur Sichtprüfung.** Nach einem Einfügen in
      Etage 5 ein `page.screenshot()` ablegen und ansehen: stehen die
      Möbel im Raum statt in der Wand, hängt die Uhr an der linken Wand,
      ist die Tapete gewechselt?

---

### Task 6: Changelog

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
      - Eine fertig eingerichtete Wohnung lässt sich jetzt auf ein anderes
        Stockwerk kopieren: In der Einrichtungsleiste merkt «Raum kopieren» die
        Wohnung samt Möbeln, Wandobjekten, Deko, Tapete und Bodenbelag, «Raum
        einfügen» stellt sie im nächsten Stockwerk wieder auf und rückt dabei
        alles auf dessen Masse zurecht. Steht am Ziel schon etwas, fragt das
        Spiel vorher, ob dazugestellt oder alles ersetzt werden soll — nichts
        geht unbemerkt verloren. Die Bewohner kommen nicht mit; es zieht die
        Familie ein, die auf das Zielstockwerk gehört (#48)
      ```

- [ ] **Step 3: Prüfen, dass nichts Verbotenes mitgelaufen ist.**

      ```bash
      cd /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer && \
        git diff --stat -- version.js; \
        grep -n "ß" CHANGELOG.md | head
      ```

      Erwartet: `version.js` ohne Änderung, keine `ß` im neuen Eintrag,
      echte Umlaute durchgehend.
