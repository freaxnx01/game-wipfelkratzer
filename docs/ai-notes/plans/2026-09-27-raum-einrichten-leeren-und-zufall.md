# Plan — Raum einrichten: «Alles weg» und «Zufall einrichten» (Issue #97)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Einrichten-Leiste bekommt zwei Knöpfe: «Alles weg» räumt den
Raum nach einer kindgerechten Rückfrage in einem Zug leer, «Zufall
einrichten» füllt die freien Plätze einer Wohnung mit einer gewürfelten
Einrichtung — **mit zwei Fenstern auf zwei verschiedenen Wänden**.

**Architecture:** Kein neuer Mechanismus. Geleert wird über das schon
vorhandene `clearRoom(k)` (`js/game.js:1387-1391`), aufgestellt über das schon
vorhandene `pasteEntries(k, items)` (`js/game.js:1368-1384`) — dieselbe
Funktion, die «Raum einfügen» benutzt. Neu sind: zwei Knöpfe in `#editbar`
(`index.html:327-333`), ein Bestätigungsdialog `#clearask` nach dem Vorbild
von `#pasteask` (`index.html:377-387`), eine Rezept-Konstante und die
Ziehfunktion daneben. Die Wandplatzierung aus `addItem`
(`js/game.js:1503-1511`) wird in einen Helfer `wallSlotX` gezogen und von
beiden Aufrufern benutzt.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap
(`index.html:10-27`). Kein Build, kein Bundler, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-raum-einrichten-leeren-und-zufall-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), niemals `ae/oe/ue`.
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei**. Das Repo hat keinen
  Test-Runner; TDD-Schritte sind hier Playwright-Sonden, die als
  Wegwerf-Dateien unter `.superpowers/sdd/…` liegen und **nicht** committet
  werden.
- **`index.html` ist handgeschrieben, kein erzeugtes Bündel.** Es gibt hier
  kein `src/*.dc.html` — direktes Bearbeiten von `index.html` ist in diesem
  Repo richtig.
- **Kein neues Feld im Spielstand.** Geschrieben wird ausschliesslich in
  `state.rooms[k]`. `js/standdatei.js` bleibt unangetastet.
- **Tapete (`state.wallpaper[k]`) und Boden (`state.flooring[k]`) werden
  nirgends angefasst.**
- **`pasteEntries`, `clearRoom` und `doPaste` behalten ihre heutige Wirkung
  für «Raum einfügen».** Die einzige erlaubte Änderung an `clearRoom` ist das
  Aufräumen von `spinners` (Task 2, Spec E13).
- **Keine Kosten.** Einrichten zahlt nichts (`addItem` zahlt nicht,
  `bezahle()` `js/game.js:1756` gilt nur für Extras).
- **`version.js` wird nicht angefasst**, kein Tag, kein
  `chore(release)`-Commit. Der Changelog-Eintrag geht unter `## [Unreleased]`
  → `### Added` (und `### Fixed` für das Rad), in Spielersprache.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(einrichten)` bzw. `fix(einrichten)`.

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-raum-einrichten/`
(git-ignoriert, **nicht** committen).

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9071–9075** (erster freier). Nur der Server darf in den Hintergrund.
  Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`,
  jeder `page.click` mit `timeout=20000`.
- Erwartete Warnungen, die **nicht** als Fehler zählen: `THREE.Clock`,
  `PCFSoftShadowMap`, `GL Driver Message`, 404 auf `favicon.png`. Geprüft wird
  nur auf `pageerror`.
- **Der Startschirm muss weggeklickt werden**, sonst gibt es keinen Turm. Die
  Sonden benutzen dafür den gemeinsamen Vorspann aus Task 1
  (`helfer.py`) — er lädt die Seite, wartet auf
  `window.wipfelkratzer !== undefined`, drückt `#btn-start`, baut über
  `w.state` genügend Stockwerke und ruft `w.enterEdit(k)`.
- **Auf den Endzustand pollen, nie auf eine Zeitspanne wetten.** Der
  headless Renderer läuft unter 1 fps; `enterEdit` startet einen
  Kamera-Tween. Vor jeder Messung:
  `page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=120000)`.
- **Gemessen wird über den Debug-Hook**, nicht über Bildpunkte: `w.roomOf(k)`,
  `w.itemMeshes[k]`, `w.state`, und die in Task 4/5 ergänzten Einträge.

## Dateien

| Datei | Verantwortung | Art |
|---|---|---|
| `index.html` | Zwei Knöpfe in `#editbar`, Block `#clearask`, CSS-Selektoren um `#clearask` erweitert | ändern |
| `js/game.js` | `wallSlotX`-Helfer, `spinners`-Aufräumen in `clearRoom`, `raumLeeren`, Dialog-Verdrahtung, `ZUFALL_REZEPT`, `zufallEinrichten`, `updateRoomButtons`, Debug-Hook | ändern |
| `CHANGELOG.md` | Eintrag unter `[Unreleased]` in Spielersprache | ändern |

`js/models.js`, `js/staende.js`, `js/standdatei.js`, `js/zip.js` und
`version.js` bleiben unberührt.

---

### Task 1: Sondenvorspann und die Wandplatzierung als Helfer

Zwei Dinge, die jede spätere Aufgabe braucht: ein wiederverwendbarer
Playwright-Vorspann, und `addItem`s Wandplatzierungs-Rechnung als eigene
Funktion, damit Task 5 sie benutzen kann, statt sie zu kopieren.

**Files:**
- Modify: `js/game.js:1489-1530` — `addItem`: der Wandzweig ruft künftig
  `wallSlotX`
- Modify: `js/game.js` — neue Funktion `wallSlotX` direkt **vor** `addItem`
- Modify: `js/game.js:2810-2833` — Debug-Hook: `wallSlotX` ergänzen
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/helfer.py` (Wegwerf)
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/t1_wandslot.py` (Wegwerf)

**Interfaces:**
- Produces: `wallSlotX(k, wall, taken)` — Query. `k` ist die Etage
  (Zahl | `'roof'` | `'garten'`), `wall` einer von
  `'back' | 'left' | 'right' | 'front'`, `taken` ein Array schon belegter
  `x`-Werte an dieser Wand. Gibt die Zahl `x` zurück, die den grössten
  Abstand zu allen `taken` hat. Bei leerem `taken` ist das `-hw` (der linke
  Rand), genau wie heute.
- Produces: `window.wipfelkratzer.wallSlotX` — dieselbe Funktion.
- Consumes: `wallPlacement(k, wallKey)` (`js/game.js:543-550`), `W(k)`, `D(k)`.

- [ ] **Step 1: Den gemeinsamen Sondenvorspann schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/helfer.py`:

      ```python
      import socket, subprocess, sys, time
      from pathlib import Path

      ROOT = Path(__file__).resolve().parents[3]
      WARNUNGEN_OK = ("THREE.Clock", "PCFSoftShadowMap", "GL Driver Message", "favicon.png")


      def freier_port():
          for p in range(9071, 9076):
              if socket.socket().connect_ex(("127.0.0.1", p)) != 0:
                  return p
          raise RuntimeError("kein freier Port 9071-9075")


      def server_starten(port):
          proc = subprocess.Popen(
              [sys.executable, "-m", "http.server", str(port)],
              cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
          for _ in range(50):
              if socket.socket().connect_ex(("127.0.0.1", port)) == 0:
                  return proc
              time.sleep(0.1)
          proc.kill()
          raise RuntimeError("Server kam nicht hoch")


      def seite_oeffnen(browser, port, fehler):
          page = browser.new_page()
          page.on("pageerror", lambda e: fehler.append(str(e)))
          page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
          page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
          # Startschirm wegklicken, falls er da ist.
          if page.locator("#btn-start").count():
              page.click("#btn-start", timeout=20000)
          return page


      def stockwerke_sichern(page, n):
          """Genug Etagen, damit enterEdit(n) eine echte Wohnung trifft."""
          page.evaluate(
              "(n) => { const w = window.wipfelkratzer;"
              " if (w.state.floors < n) { w.state.floors = n; location.reload(); } }", n)
          page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)


      def ruhe(page):
          page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=120000)
      ```

      Ob `#btn-start` existiert, entscheidet die Sonde zur Laufzeit — so
      bleibt sie richtig, falls der Startschirm nur beim ersten Besuch
      erscheint.

- [ ] **Step 2: Die fehlschlagende Sonde für `wallSlotX` schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/t1_wandslot.py`:

      ```python
      import sys
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      sys.path.insert(0, str(Path(__file__).parent))
      from helfer import freier_port, server_starten, seite_oeffnen, stockwerke_sichern, ruhe

      port = freier_port()
      srv = server_starten(port)
      fehler = []
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = seite_oeffnen(b, port, fehler)
              stockwerke_sichern(page, 2)
              ruhe(page)

              assert page.evaluate("typeof window.wipfelkratzer.wallSlotX") == "function", \
                  "wallSlotX fehlt auf dem Debug-Hook"

              # Leere Wand: linker Rand.
              leer = page.evaluate("window.wipfelkratzer.wallSlotX(1, 'back', [])")
              # Ein Stück in der Mitte: der Helfer weicht deutlich aus.
              mitte = page.evaluate("window.wipfelkratzer.wallSlotX(1, 'back', [0])")
              assert abs(mitte) > 0.5, f"wallSlotX weicht nicht aus: {mitte}"
              assert leer != mitte, "wallSlotX liefert immer denselben Platz"

              # Das echte Aufstellen benutzt denselben Weg: zwei Poster an
              # dieselbe Wand landen nicht an derselben Stelle.
              page.evaluate("window.wipfelkratzer.enterEdit(1)")
              ruhe(page)
              page.evaluate("window.wipfelkratzer.addItem('poster_wald')")
              page.evaluate("window.wipfelkratzer.addItem('poster_mond')")
              xs = page.evaluate(
                  "window.wipfelkratzer.roomOf(1)"
                  ".filter(e => e.id.startsWith('poster_')).map(e => e.x)")
              assert len(xs) == 2 and abs(xs[0] - xs[1]) > 0.3, f"Poster kleben aufeinander: {xs}"
              b.close()
      finally:
          srv.kill()

      assert not fehler, f"pageerror: {fehler}"
      print("t1 GRUEN")
      ```

- [ ] **Step 3: Die Sonde laufen lassen und den Fehlschlag sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t1_wandslot.py`
      Expected: `AssertionError: wallSlotX fehlt auf dem Debug-Hook`

- [ ] **Step 4: `wallSlotX` herausziehen.**

      In `js/game.js` direkt **vor** `function addItem(...)` einfügen:

      ```js
      /* Die Stelle an einer Wand, die von allen schon dort hängenden Objekten
         am weitesten entfernt ist. Abgetastet in 0.4er-Schritten — fein genug
         für Poster und Fenster, grob genug, dass die Schleife nichts kostet.
         Ein eigener Helfer, weil sowohl addItem als auch zufallEinrichten ihn
         braucht und zwei Kopien derselben Rechnung auseinanderlaufen würden. */
      function wallSlotX(k, wall, taken) {
        const pl = wallPlacement(k, wall);
        const wallLen = pl.freeAxis === 'x' ? W(k) : D(k);
        const hw = wallLen / 2 - 0.6;
        let best = 0, bd = -1;
        for (let x = -hw; x <= hw; x += 0.4) {
          const dmin = taken.length ? Math.min(...taken.map(t => Math.abs(t - x))) : 99;
          if (dmin > bd) { bd = dmin; best = x; }
        }
        return best;
      }
      ```

- [ ] **Step 5: `addItem` auf den Helfer umstellen.**

      In `addItem` (`js/game.js:1500-1508`) den Wandzweig ersetzen. Vorher:

      ```js
      if (WALL_ITEMS.has(id)) {
        entry.wall = wallTarget === 'alle' ? 'back' : wallTarget;
        entry.y = id === 'fenster' ? 1.05 : 1.2;
        const pl = wallPlacement(k, entry.wall);
        const wallLen = pl.freeAxis === 'x' ? W(k) : D(k);
        const taken = roomOf(k).filter(e => WALL_ITEMS.has(e.id) && (e.wall || 'back') === entry.wall).map(e => e.x);
        const hw = wallLen / 2 - 0.6; let best = 0, bd = -1;
        for (let x = -hw; x <= hw; x += 0.4) { const dmin = taken.length ? Math.min(...taken.map(t => Math.abs(t - x))) : 99; if (dmin > bd) { bd = dmin; best = x; } }
        entry.x = best; }
      ```

      Nachher:

      ```js
      if (WALL_ITEMS.has(id)) {
        entry.wall = wallTarget === 'alle' ? 'back' : wallTarget;
        entry.y = id === 'fenster' ? 1.05 : 1.2;
        const taken = roomOf(k).filter(e => WALL_ITEMS.has(e.id) && (e.wall || 'back') === entry.wall).map(e => e.x);
        entry.x = wallSlotX(k, entry.wall, taken); }
      ```

- [ ] **Step 6: `wallSlotX` auf den Debug-Hook legen.**

      In `window.wipfelkratzer = { … }` (`js/game.js:2810-2833`) bei den
      anderen Platzierungsfunktionen ergänzen — in der Zeile mit
      `enterEdit, exitEdit, dims, cellPos, wallPlacement`:

      ```js
      get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, wallSlotX, get edit() { return edit; },
      ```

- [ ] **Step 7: Die Sonde laufen lassen und Grün sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t1_wandslot.py`
      Expected: `t1 GRUEN`

- [ ] **Step 8: Committen.**

      ```bash
      git add js/game.js
      git commit -m "refactor(einrichten): Wandplatzierung als wallSlotX herausziehen

Dieselbe Rechnung brauchen addItem und die kommende Zufallseinrichtung.
Zwei Kopien würden auseinanderlaufen.

Refs #97"
      ```

---

### Task 2: `clearRoom` räumt auch `spinners` auf

Spec E13. Heute schiebt `placeItemMesh` das Rad eines Hamsterrads in
`spinners` (`js/game.js:378`, `js/game.js:809`); nur `rebuildItemMesh` nimmt
es wieder heraus (`js/game.js:1546`). Nach `clearRoom` dreht `tick()`
(`js/game.js:2946`) ein Rad weiter, das nicht mehr in der Szene hängt. Das
muss vor Task 3 stimmen, sonst baut «Alles weg» einen Sammler ein.

**Files:**
- Modify: `js/game.js:1387-1391` — `clearRoom`
- Modify: `js/game.js:2810-2833` — Debug-Hook: `spinnerCount()` ergänzen
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/t2_spinner.py` (Wegwerf)

**Interfaces:**
- Consumes: `helfer.py` aus Task 1.
- Produces: `window.wipfelkratzer.spinnerCount()` — Query, gibt `spinners.length`
  zurück.
- `clearRoom(k)` behält Name und Signatur; nur die Wirkung wird vollständiger.

- [ ] **Step 1: Die fehlschlagende Sonde schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/t2_spinner.py`:

      ```python
      import sys
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      sys.path.insert(0, str(Path(__file__).parent))
      from helfer import freier_port, server_starten, seite_oeffnen, stockwerke_sichern, ruhe

      port = freier_port()
      srv = server_starten(port)
      fehler = []
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = seite_oeffnen(b, port, fehler)
              stockwerke_sichern(page, 2)
              ruhe(page)

              assert page.evaluate("typeof window.wipfelkratzer.spinnerCount") == "function", \
                  "spinnerCount fehlt auf dem Debug-Hook"

              page.evaluate("window.wipfelkratzer.enterEdit(1)")
              ruhe(page)
              vorher = page.evaluate("window.wipfelkratzer.spinnerCount()")

              # Dreimal Rad aufstellen und leeren: die Liste darf nicht wachsen.
              for _ in range(3):
                  page.evaluate("window.wipfelkratzer.addItem('hamsterrad')")
                  page.evaluate("window.wipfelkratzer.clearRoom(1)")
              nachher = page.evaluate("window.wipfelkratzer.spinnerCount()")
              assert nachher == vorher, f"spinners wachsen: {vorher} -> {nachher}"
              b.close()
      finally:
          srv.kill()

      assert not fehler, f"pageerror: {fehler}"
      print("t2 GRUEN")
      ```

- [ ] **Step 2: Die Sonde laufen lassen und den Fehlschlag sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t2_spinner.py`
      Expected: `AssertionError: spinnerCount fehlt auf dem Debug-Hook`

- [ ] **Step 3: `clearRoom` ergänzen.**

      `js/game.js:1387-1391` ersetzen durch:

      ```js
      function clearRoom(k) {
        itemMeshes[k].slice().forEach(m => {
          /* Dasselbe Aufräumen wie in rebuildItemMesh: ein Rad, das nur aus
             der Szene fliegt, dreht sich in spinners weiter und wird nie
             wieder eingesammelt. */
          if (m.userData.wheel) { const si = spinners.indexOf(m.userData.wheel); if (si >= 0) spinners.splice(si, 1); }
          parentOf(k).remove(m);
        });
        itemMeshes[k].length = 0;
        roomOf(k).length = 0;
      }
      ```

      Der Kommentarblock über `clearRoom` («Leeren mit derselben Mechanik wie
      removeItem …», `js/game.js:1384-1386`) bleibt stehen.

- [ ] **Step 4: `clearRoom` und `spinnerCount` auf den Debug-Hook legen.**

      Im Objektliteral `window.wipfelkratzer` (`js/game.js:2810-2833`) bei
      `roomOf, get clip()` ergänzen:

      ```js
      ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, clearRoom, spinnerCount: () => spinners.length, get clip() { return clip; },
      ```

- [ ] **Step 5: Die Sonde laufen lassen und Grün sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t2_spinner.py`
      Expected: `t2 GRUEN`

- [ ] **Step 6: Committen.**

      ```bash
      git add js/game.js
      git commit -m "fix(einrichten): clearRoom nimmt das Hamsterrad aus spinners

Ein geleerter Raum liess sein Rad in der Dreh-Liste zurueck; es drehte
sich unsichtbar weiter und wuchs mit jedem Leeren an.

Refs #97"
      ```

---

### Task 3: «Alles weg» mit Rückfrage

**Files:**
- Modify: `index.html:246-251` — CSS-Selektoren um `#clearask` erweitern
- Modify: `index.html:327-333` — `#btn-roomclear` in `#editbar`
- Modify: `index.html:377-387` — Block `#clearask` direkt **nach** `#pasteask`
- Modify: `js/game.js:1349-1353` — `updateRoomClipButtons` → `updateRoomButtons`
- Modify: `js/game.js:1168`, `js/game.js:1189`, `js/game.js:1359` — Aufrufer
- Modify: `js/game.js` — `raumLeeren`, Dialogverdrahtung nach `doPaste`
- Modify: `js/game.js:2810-2833` — Debug-Hook: `raumLeeren`, `updateRoomButtons`
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/t3_leeren.py` (Wegwerf)

**Interfaces:**
- Consumes: `clearRoom(k)` (Task 2), `helfer.py` (Task 1).
- Produces: `raumLeeren(k)` — Kommando. Leert `roomOf(k)` **ohne** Rückfrage
  (die Rückfrage sitzt im Knopf davor), räumt Auswahl, Meldungen, Speicher und
  HUD nach. Gibt nichts zurück.
- Produces: `updateRoomButtons()` — Kommando. Ersetzt
  `updateRoomClipButtons()` und regelt die Sichtbarkeit **und** den
  `disabled`-Zustand aller vier Raum-Knöpfe. Jeder bisherige Aufruf von
  `updateRoomClipButtons()` wird zu `updateRoomButtons()`.
- Produces: `window.wipfelkratzer.raumLeeren`, `window.wipfelkratzer.updateRoomButtons`.

- [ ] **Step 1: Die fehlschlagende Sonde schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/t3_leeren.py`:

      ```python
      import sys
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      sys.path.insert(0, str(Path(__file__).parent))
      from helfer import freier_port, server_starten, seite_oeffnen, stockwerke_sichern, ruhe

      port = freier_port()
      srv = server_starten(port)
      fehler = []
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = seite_oeffnen(b, port, fehler)
              stockwerke_sichern(page, 2)
              ruhe(page)

              page.evaluate("window.wipfelkratzer.enterEdit(1)")
              ruhe(page)
              for it in ("bett", "tisch", "stuhl", "lampe"):
                  page.evaluate(f"window.wipfelkratzer.addItem('{it}')")
              page.evaluate("window.wipfelkratzer.deselect()")

              tapete = page.evaluate("JSON.stringify(window.wipfelkratzer.state.wallpaper[1] || null)")

              # Der Knopf ist da und nicht ausgegraut.
              assert page.locator("#btn-roomclear").is_visible(), "#btn-roomclear fehlt"
              assert not page.locator("#btn-roomclear").is_disabled(), "#btn-roomclear ist grau"

              # Abbrechen aendert nichts.
              page.click("#btn-roomclear", timeout=20000)
              assert page.locator("#clearask.open").count() == 1, "#clearask oeffnet nicht"
              page.click("#clear-cancel", timeout=20000)
              assert page.locator("#clearask.open").count() == 0, "#clearask bleibt offen"
              assert page.evaluate("window.wipfelkratzer.roomOf(1).length") == 4, \
                  "Abbrechen hat trotzdem geraeumt"

              # Bestaetigen raeumt.
              page.click("#btn-roomclear", timeout=20000)
              page.click("#clear-ok", timeout=20000)
              assert page.evaluate("window.wipfelkratzer.roomOf(1).length") == 0, "nicht leer"
              assert page.evaluate("window.wipfelkratzer.itemMeshes[1].length") == 0, "Meshes blieben"
              assert page.locator("#btn-roomclear").is_disabled(), \
                  "#btn-roomclear ist im leeren Raum nicht ausgegraut"

              # Tapete unveraendert.
              assert page.evaluate(
                  "JSON.stringify(window.wipfelkratzer.state.wallpaper[1] || null)") == tapete, \
                  "Tapete wurde mitgeraeumt"

              # Auch auf Dach und Spielplatz vorhanden.
              page.evaluate("window.wipfelkratzer.exitEdit()")
              ruhe(page)
              page.evaluate("window.wipfelkratzer.enterEdit('roof')")
              ruhe(page)
              assert page.locator("#btn-roomclear").is_visible(), "#btn-roomclear fehlt auf dem Dach"

              # Gespeichert: nach dem Neuladen ist der Raum leer.
              page.evaluate("window.wipfelkratzer.exitEdit()")
              page.evaluate("window.wipfelkratzer.speichern()")
              page.reload(wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
              assert page.evaluate("window.wipfelkratzer.roomOf(1).length") == 0, \
                  "nach dem Neuladen wieder voll"
              b.close()
      finally:
          srv.kill()

      assert not fehler, f"pageerror: {fehler}"
      print("t3 GRUEN")
      ```

- [ ] **Step 2: Die Sonde laufen lassen und den Fehlschlag sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t3_leeren.py`
      Expected: `AssertionError: #btn-roomclear fehlt`

- [ ] **Step 3: Den Knopf in `#editbar` einsetzen.**

      `index.html:327-333` — `#btn-roomclear` **vor** `#btn-roomcopy`:

      ```html
      <div id="editbar" class="panel">
        <span id="edit-title"></span>
        <button id="btn-roomclear" class="danger">Alles weg</button>
        <button id="btn-roomcopy" class="hidden">Raum kopieren</button>
        <button id="btn-roompaste" class="hidden">Raum einfügen</button>
        <button id="btn-tip">Tipp</button>
        <button id="btn-done" class="primary">Fertig</button>
      </div>
      ```

- [ ] **Step 4: Den Dialog `#clearask` einsetzen.**

      Direkt **nach** dem `#pasteask`-Block (`index.html:377-387`):

      ```html
      <div id="clearask">
        <div class="panel">
          <h2>Wirklich alles wegräumen?</h2>
          <p id="clearask-text"></p>
          <div id="clearask-buttons">
            <button id="clear-ok" class="danger">Ja, alles weg</button>
            <button id="clear-cancel" class="primary">Lieber nicht</button>
          </div>
        </div>
      </div>
      ```

- [ ] **Step 5: Das CSS mitnehmen, ohne es zu verdoppeln.**

      `index.html:246-251` — die fünf `#pasteask`-Regeln bekommen `#clearask`
      als zweiten Selektor:

      ```css
        #pasteask, #clearask { position: fixed; inset: 0; z-index: 10; display: none; align-items: center; justify-content: center; background: rgba(60,40,20,.35); }
        #pasteask.open, #clearask.open { display: flex; }
        #pasteask .panel, #clearask .panel { width: min(420px, 92vw); padding: 16px 20px; }
        #pasteask h2, #clearask h2 { margin: 0 0 8px; color: var(--wood); }
        #pasteask p, #clearask p { margin: 0 0 12px; font-size: 15px; line-height: 1.35; }
        #pasteask-buttons, #clearask-buttons { display: flex; flex-direction: column; gap: 8px; }
      ```

- [ ] **Step 6: `updateRoomClipButtons` zu `updateRoomButtons` erweitern.**

      `js/game.js:1349-1353` ersetzen durch:

      ```js
      /* Eine Stelle für alle vier Raum-Knöpfe. Kopieren und Einfügen gelten
         nur für gewöhnliche Wohnungen; «Alles weg» gilt überall, ist aber im
         leeren Raum ausgegraut statt versteckt — ein verschwindender Knopf
         liesse die Leiste bei jedem Aufstellen springen. */
      function updateRoomButtons() {
        const normal = !!edit && edit.k !== 'roof' && edit.k !== 'garten';
        $('btn-roomcopy').classList.toggle('hidden', !normal);
        $('btn-roompaste').classList.toggle('hidden', !(normal && clip && clip.from !== edit.k));
        $('btn-roomclear').disabled = !edit || roomOf(edit.k).length === 0;
      }
      ```

      Danach jeden Aufruf von `updateRoomClipButtons()` auf
      `updateRoomButtons()` umstellen — die Stellen sind
      `js/game.js:1168` (`enterEdit`), `js/game.js:1189` (`exitEdit`) und
      `js/game.js:1359` (`copyRoom`).
      Verify: `grep -n "updateRoomClipButtons" js/game.js` gibt **nichts** aus.

- [ ] **Step 7: `raumLeeren` und die Dialogverdrahtung schreiben.**

      In `js/game.js` direkt **nach** `$('paste-replace').onclick = …`
      (`js/game.js:1435`) einfügen:

      ```js
      /* ---------- Alles weg (#97) ----------
         Die Rückfrage ist ein eigener Dialog nach dem Vorbild von #pasteask:
         window.confirm() sieht auf dem iPad fremd aus und lässt sich nicht
         kindgerecht formulieren. Geleert wird nur die Möbelliste — Tapete und
         Boden sind der Raum selbst, nicht seine Einrichtung. */
      const raumName = k => k === 'roof' ? 'der Dachterrasse'
        : k === 'garten' ? 'dem Spielplatz' : `Stockwerk ${flLabel(k)}`;

      function raumLeeren(k) {
        clearRoom(k);
        deselect();
        renderWishes(); renderResidents();
        sfx.knock();
        toast(`Aufgeräumt — in ${raumName(k)} steht jetzt nichts mehr.`);
        save(); updateHUD(); updateRoomButtons();
      }

      function fragNachLeeren() {
        if (!edit) return;
        const k = edit.k;
        const n = roomOf(k).length;
        if (!n) return;
        $('clearask-text').textContent =
          `In ${raumName(k)} stehen ${n} Sachen. Sie sind dann alle weg.`;
        $('clearask').classList.add('open');
      }
      function closeClearAsk() { $('clearask').classList.remove('open'); }
      $('btn-roomclear').onclick = fragNachLeeren;
      $('clear-cancel').onclick = closeClearAsk;
      $('clearask').onclick = e => { if (e.target === $('clearask')) closeClearAsk(); };
      $('clear-ok').onclick = () => { const k = edit && edit.k; closeClearAsk(); if (k != null) raumLeeren(k); };
      ```

      `flLabel` ist schon vorhanden und wird von `pasteRoom`
      (`js/game.js:1426`) genauso benutzt.

- [ ] **Step 8: Die Knöpfe nach jedem Aufstellen und Wegwerfen nachziehen.**

      `updateRoomButtons()` ans Ende von `addItem` (`js/game.js:1529`, nach
      `save(); updateHUD();`) und ans Ende von `removeItem`
      (`js/game.js:1537`, nach `renderWishes();`) hängen — sonst bleibt
      «Alles weg» grau, nachdem das erste Stück aufgestellt wurde.

- [ ] **Step 9: Auf den Debug-Hook legen.**

      Im Objektliteral `window.wipfelkratzer` die in Task 2 geänderte Zeile
      weiter ergänzen:

      ```js
      ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, clearRoom, spinnerCount: () => spinners.length, raumLeeren, updateRoomButtons, get clip() { return clip; },
      ```

- [ ] **Step 10: Die Sonde laufen lassen und Grün sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t3_leeren.py`
      Expected: `t3 GRUEN`
      Dann Task 1 und 2 nachfahren, damit nichts zurückfiel:
      `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t1_wandslot.py`
      und `… t2_spinner.py` — beide GRUEN.

- [ ] **Step 11: Committen.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(einrichten): Knopf «Alles weg» mit Rueckfrage

Raeumt eine Wohnung, die Dachterrasse oder den Spielplatz in einem Zug
leer, nachdem ein Dialog nach dem Vorbild von #pasteask nachgefragt hat.
Tapete und Boden bleiben stehen.

Refs #97"
      ```

---

### Task 4: Das Rezept und die Ziehung

Nur die Datenseite: aus dem Katalog eine Einträgeliste würfeln. Noch kein
Knopf, noch nichts in der Szene. So lässt sich die Ziehung prüfen, ohne dass
eine fehlgeschlagene Platzierung das Ergebnis verfälscht.

**Files:**
- Modify: `js/game.js` — `ZUFALL_REZEPT` und `zieheEinrichtung` direkt **nach**
  dem «Alles weg»-Block aus Task 3
- Modify: `js/game.js:2810-2833` — Debug-Hook: `ZUFALL_REZEPT`, `zieheEinrichtung`
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/t4_rezept.py` (Wegwerf)

**Interfaces:**
- Consumes: `CATALOG` (`js/models.js:638`, in `js/game.js:3` importiert),
  `pick(arr, r)` (`js/game.js:82`), `WALL_ITEMS`, `DECO` (`js/game.js:538`).
- Produces: `ZUFALL_REZEPT` — Array von
  `{ rolle: string, ids: string[], min: number, max: number }`.
- Produces: `zieheEinrichtung()` — Query ohne Argumente. Gibt ein Array von
  Katalog-Ids zurück (Strings), 9–12 Stück, darunter **genau zwei** `'fenster'`.
  Keine Id doppelt ausser `'fenster'`. Kennt weder Etage noch Szene.
- Produces: `window.wipfelkratzer.ZUFALL_REZEPT`, `window.wipfelkratzer.zieheEinrichtung`.

- [ ] **Step 1: Die fehlschlagende Sonde schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/t4_rezept.py`:

      ```python
      import sys
      from collections import Counter
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      sys.path.insert(0, str(Path(__file__).parent))
      from helfer import freier_port, server_starten, seite_oeffnen, ruhe

      port = freier_port()
      srv = server_starten(port)
      fehler = []
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = seite_oeffnen(b, port, fehler)
              ruhe(page)

              assert page.evaluate("typeof window.wipfelkratzer.zieheEinrichtung") == "function", \
                  "zieheEinrichtung fehlt auf dem Debug-Hook"

              katalog = set(page.evaluate("window.wipfelkratzer.catalogIds"))
              gesehen = set()
              for _ in range(40):
                  ids = page.evaluate("window.wipfelkratzer.zieheEinrichtung()")
                  assert 9 <= len(ids) <= 12, f"Anzahl {len(ids)} ausserhalb 9-12: {ids}"
                  assert set(ids) <= katalog, f"unbekannte Id: {set(ids) - katalog}"
                  z = Counter(ids)
                  assert z["fenster"] == 2, f"nicht genau zwei Fenster: {ids}"
                  mehrfach = [i for i, n in z.items() if n > 1 and i != "fenster"]
                  assert not mehrfach, f"doppelte Id: {mehrfach}"
                  gesehen.add(tuple(sorted(ids)))
              assert len(gesehen) > 5, f"kaum Abwechslung: nur {len(gesehen)} verschiedene Ziehungen"
              b.close()
      finally:
          srv.kill()

      assert not fehler, f"pageerror: {fehler}"
      print("t4 GRUEN")
      ```

- [ ] **Step 2: Die Sonde laufen lassen und den Fehlschlag sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t4_rezept.py`
      Expected: `AssertionError: zieheEinrichtung fehlt auf dem Debug-Hook`

- [ ] **Step 3: Rezept und Ziehung schreiben.**

      In `js/game.js` nach dem «Alles weg»-Block aus Task 3 einfügen:

      ```js
      /* ---------- Zufall einrichten (#97) ----------
         Ein festes Rezept statt einer freien Ziehung aus CATALOG: frei
         gezogen kämen drei Betten und kein Fenster heraus, und CATALOG
         enthält auch Dach- und Spielplatzobjekte, die in einer Wohnung
         nichts zu suchen haben. Wer ein neues Möbelstück in den Zufall
         aufnehmen will, trägt es hier ein — an genau einer Stelle. */
      const ZUFALL_REZEPT = [
        { rolle: 'Schlafen',   ids: ['bett', 'etagenbett'],                                          min: 1, max: 1 },
        { rolle: 'Tisch',      ids: ['tisch', 'wk_tisch'],                                           min: 1, max: 1 },
        { rolle: 'Sitzen',     ids: ['stuhl', 'wk_stuhl', 'sofa', 'wk_sofa', 'schaukelstuhl'],       min: 1, max: 2 },
        { rolle: 'Verstauen',  ids: ['schrank', 'regal', 'wk_regal', 'kommode'],                     min: 1, max: 1 },
        { rolle: 'Gemütlich',  ids: ['teppich', 'lampe', 'ofen', 'pflanze', 'badewanne'],            min: 1, max: 2 },
        { rolle: 'Spass',      ids: ['hamsterrad', 'klavier', 'ball', 'kuscheltier', 'harfe', 'tischkicker'], min: 1, max: 1 },
        { rolle: 'Deko',       ids: ['vase', 'teekanne', 'kerze', 'buecher', 'nussschale'],          min: 1, max: 2 },
        { rolle: 'Fenster',    ids: ['fenster'],                                                     min: 2, max: 2 },
        { rolle: 'Wandschmuck', ids: ['poster_wald', 'poster_mond', 'poster_willi', 'uhr', 'spiegel'], min: 1, max: 1 },
      ];

      /* Je Rolle ohne Zurücklegen ziehen — kein zweites Bett, aber sehr wohl
         zwei Fenster, denn dort ist die Kandidatenliste selbst einelementig
         und min === max === 2. */
      function zieheAusRolle(rolle) {
        const anzahl = rolle.min + Math.floor(Math.random() * (rolle.max - rolle.min + 1));
        if (rolle.ids.length === 1) return Array(anzahl).fill(rolle.ids[0]);
        const topf = rolle.ids.slice();
        const raus = [];
        for (let n = 0; n < anzahl && topf.length; n++) {
          const i = Math.floor(Math.random() * topf.length);
          raus.push(topf.splice(i, 1)[0]);
        }
        return raus;
      }

      function zieheEinrichtung() {
        const bekannt = new Set(CATALOG.map(c => c.id));
        return ZUFALL_REZEPT.flatMap(zieheAusRolle).filter(id => bekannt.has(id));
      }
      ```

      Der `bekannt`-Filter ist die Absicherung gegen ein umbenanntes
      Möbelstück: lieber ein Stück weniger als ein Eintrag, den
      `makeFurniture` nicht kennt.

- [ ] **Step 4: Auf den Debug-Hook legen.**

      Im Objektliteral `window.wipfelkratzer` die Zeile aus Task 3 weiter
      ergänzen:

      ```js
      ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, clearRoom, spinnerCount: () => spinners.length, raumLeeren, updateRoomButtons, ZUFALL_REZEPT, zieheEinrichtung, get clip() { return clip; },
      ```

- [ ] **Step 5: Die Sonde laufen lassen und Grün sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t4_rezept.py`
      Expected: `t4 GRUEN`

- [ ] **Step 6: Committen.**

      ```bash
      git add js/game.js
      git commit -m "feat(einrichten): Rezept und Ziehung fuer die Zufallseinrichtung

Ein festes Rezept je Rolle statt einer freien Ziehung aus CATALOG, damit
immer genau zwei Fenster und kein zweites Bett herauskommen.

Refs #97"
      ```

---

### Task 5: «Zufall einrichten» stellt auf

**Files:**
- Modify: `index.html:327-333` — `#btn-roomrandom` in `#editbar`
- Modify: `js/game.js` — `zufallEinrichten` nach `zieheEinrichtung`
- Modify: `js/game.js` — `updateRoomButtons` um den vierten Knopf erweitern
- Modify: `js/game.js:2810-2833` — Debug-Hook: `zufallEinrichten`
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/t5_zufall.py` (Wegwerf)

**Interfaces:**
- Consumes: `zieheEinrichtung()` (Task 4), `wallSlotX(k, wall, taken)`
  (Task 1), `pasteEntries(k, items)` (`js/game.js:1368`), `freeCell(k, from)`
  (`js/game.js:814`), `cellPos(k, cell)` (`js/game.js:532`),
  `colsOf(k)` (`js/game.js:531`), `WALL_ITEMS`, `DECO`,
  `checkWishes(id, k)` (`js/game.js:1685`), `checkTenant(k)`
  (`js/game.js:1673`), `wishKey(id)` (`js/game.js:1677`),
  `tenantOf(k)` (`js/game.js:96`).
- Produces: `zufallEinrichten(k)` — Kommando. Ergänzt in `roomOf(k)`, was aus
  der Ziehung in die freien Plätze passt; löscht nie. Gibt nichts zurück.
- Produces: `window.wipfelkratzer.zufallEinrichten`.

- [ ] **Step 1: Die fehlschlagende Sonde schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/t5_zufall.py`:

      ```python
      import sys
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      sys.path.insert(0, str(Path(__file__).parent))
      from helfer import freier_port, server_starten, seite_oeffnen, stockwerke_sichern, ruhe

      port = freier_port()
      srv = server_starten(port)
      fehler = []
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = seite_oeffnen(b, port, fehler)
              stockwerke_sichern(page, 2)
              ruhe(page)

              page.evaluate("window.wipfelkratzer.enterEdit(1)")
              ruhe(page)
              page.evaluate("window.wipfelkratzer.clearRoom(1)")
              page.evaluate("window.wipfelkratzer.updateRoomButtons()")

              assert page.locator("#btn-roomrandom").is_visible(), "#btn-roomrandom fehlt"
              page.click("#btn-roomrandom", timeout=20000)
              ruhe(page)

              raum = page.evaluate("window.wipfelkratzer.roomOf(1)")
              assert 9 <= len(raum) <= 12, f"Anzahl {len(raum)}: {[e['id'] for e in raum]}"

              fenster = [e for e in raum if e["id"] == "fenster"]
              assert len(fenster) >= 2, f"zu wenige Fenster: {len(fenster)}"
              waende = [e.get("wall") for e in fenster]
              assert len(set(waende)) == len(waende), f"Fenster teilen sich eine Wand: {waende}"
              assert all(w in ("back", "left", "right") for w in waende), f"falsche Wand: {waende}"

              # Bodenobjekte: verschiedene Zellen, keine Ueberlappung.
              deko = set(page.evaluate("[...window.wipfelkratzer.DECO_IDS]"))
              wand = set(page.evaluate("[...window.wipfelkratzer.WALL_IDS]"))
              boden = [e for e in raum if e["id"] not in deko and e["id"] not in wand]
              zellen = [e["cell"] for e in boden]
              assert len(set(zellen)) == len(zellen), f"doppelte Zelle: {zellen}"
              assert page.evaluate(
                  "(() => { const w = window.wipfelkratzer;"
                  " const b = w.solidBoxes(1, null);"
                  " for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++)"
                  "   if (w.overlapsXZ(b[i], b[j])) return false;"
                  " return true; })()"), "Moebel stehen ineinander"

              # Der Bewohner ist eingezogen.
              assert page.evaluate("!!window.wipfelkratzer.tenantGroups[1]"), "kein Bewohner"

              # Ein zweiter Lauf ergaenzt, loescht aber nichts.
              alt = [(e["id"], e.get("cell")) for e in raum]
              page.evaluate("window.wipfelkratzer.zufallEinrichten(1)")
              ruhe(page)
              neu = page.evaluate("window.wipfelkratzer.roomOf(1)")
              neu_paare = [(e["id"], e.get("cell")) for e in neu]
              for paar in alt:
                  assert paar in neu_paare, f"alter Eintrag verschwunden: {paar}"
              assert len(neu) >= len(raum), "der zweite Lauf hat geloescht"

              # Gespeichert.
              page.evaluate("window.wipfelkratzer.speichern()")
              page.reload(wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
              assert len(page.evaluate("window.wipfelkratzer.roomOf(1)")) == len(neu), \
                  "nach dem Neuladen fehlt etwas"

              # Auf dem Dach gibt es den Knopf nicht.
              page.evaluate("window.wipfelkratzer.enterEdit('roof')")
              ruhe(page)
              assert page.locator("#btn-roomrandom").is_hidden(), \
                  "#btn-roomrandom ist auf dem Dach sichtbar"
              b.close()
      finally:
          srv.kill()

      assert not fehler, f"pageerror: {fehler}"
      print("t5 GRUEN")
      ```

- [ ] **Step 2: Die Sonde laufen lassen und den Fehlschlag sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t5_zufall.py`
      Expected: `AssertionError: #btn-roomrandom fehlt`

- [ ] **Step 3: Den Knopf einsetzen.**

      `index.html` — `#btn-roomrandom` direkt **nach** `#btn-roomclear`:

      ```html
        <button id="btn-roomclear" class="danger">Alles weg</button>
        <button id="btn-roomrandom" class="hidden">Zufall einrichten</button>
      ```

- [ ] **Step 4: `zufallEinrichten` schreiben.**

      In `js/game.js` direkt nach `zieheEinrichtung` einfügen:

      ```js
      /* Aufgestellt wird über pasteEntries — dieselbe Mechanik wie «Raum
         einfügen», samt der Reihenfolge Möbel-vor-Deko, die dafür sorgt, dass
         surfaceYAt die Vase auf den Tisch legt. Eine Schleife um addItem wäre
         falsch: die würde je Gegenstand auswählen, animieren, klingen und
         speichern. */
      const ZUFALL_WAENDE = ['back', 'left', 'right'];

      function zufallsEintraege(k) {
        const ids = zieheEinrichtung();
        const eintraege = [];
        let naechsteZelle = 0;
        /* Belegte Wandplätze aus dem, was schon hängt — und aus dem, was
           dieser Lauf gerade dazuhängt. */
        const belegt = {};
        ZUFALL_WAENDE.forEach(w => {
          belegt[w] = roomOf(k).filter(e => WALL_ITEMS.has(e.id) && (e.wall || 'back') === w).map(e => e.x);
        });
        let wandZeiger = Math.floor(Math.random() * ZUFALL_WAENDE.length);

        ids.forEach(id => {
          if (WALL_ITEMS.has(id)) {
            const wall = ZUFALL_WAENDE[wandZeiger % ZUFALL_WAENDE.length];
            wandZeiger++;
            const x = wallSlotX(k, wall, belegt[wall]);
            belegt[wall].push(x);
            eintraege.push({ id, cell: 0, x, y: id === 'fenster' ? 1.05 : 1.2, z: 0, rot: 0, wall });
            return;
          }
          if (DECO.has(id)) {
            /* Deko bekommt keine eigene Zelle: pasteEntries legt sie über
               surfaceYAt auf die Oberfläche unter ihr. x/z kommen von der
               Mitte des Raums, clampEntry rückt sie hinein. */
            eintraege.push({ id, cell: 0, x: (Math.random() - 0.5) * 0.6, y: 0, z: (Math.random() - 0.5) * 0.6, rot: 0 });
            return;
          }
          const cell = freeCell(k, naechsteZelle);
          if (cell < 0) return;               // voll — der Rest fällt weg
          naechsteZelle = cell + 1;
          const p = cellPos(k, cell);
          /* Die Zelle muss sofort als belegt gelten, sonst gibt freeCell sie
             beim nächsten Stück noch einmal aus: roomOf(k) wächst erst in
             pasteEntries. Deshalb wird hier vorgemerkt und die Marke in
             pasteEntries mitgezählt. */
          eintraege.push({ id, cell, x: p.x, y: 0, z: p.z, rot: 0 });
          roomOf(k).push({ id: '__platzhalter', cell, x: p.x, y: 0, z: p.z, rot: 0 });
        });
        /* Platzhalter wieder heraus — sie waren nur für freeCell da. */
        const arr = roomOf(k);
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i].id === '__platzhalter') arr.splice(i, 1);
        return eintraege;
      }

      function zufallEinrichten(k) {
        const eintraege = zufallsEintraege(k);
        if (!eintraege.length) { toast('Hier ist kein Platz mehr frei.'); return; }
        const ids = pasteEntries(k, eintraege);
        /* Dieselbe Reihenfolge wie doPaste: erst der eigene Wunsch, dann der
           Einzug — sonst sieht renderWishes den Wunschgegenstand schon im
           Raum liegen und hakt ihn still ab, ohne die drei Haselnüsse zu
           zahlen (siehe den Kommentar in doPaste). */
        const t = tenantOf(k);
        if (!t.roofWish) { const wunschId = ids.find(id => wishKey(id) === t.wish); if (wunschId) checkWishes(wunschId, k); }
        checkTenant(k);
        renderWishes(); renderResidents();
        deselect(); sfx.chime();
        toast(`${ids.length} Sachen hingestellt — bau ruhig um, wie es Dir gefällt!`);
        save(); updateHUD(); updateRoomButtons();
      }
      $('btn-roomrandom').onclick = () => { if (edit) zufallEinrichten(edit.k); };
      ```

- [ ] **Step 5: `updateRoomButtons` um den vierten Knopf erweitern.**

      Die in Task 3 geschriebene Funktion bekommt eine Zeile:

      ```js
      function updateRoomButtons() {
        const normal = !!edit && edit.k !== 'roof' && edit.k !== 'garten';
        $('btn-roomcopy').classList.toggle('hidden', !normal);
        $('btn-roompaste').classList.toggle('hidden', !(normal && clip && clip.from !== edit.k));
        $('btn-roomclear').disabled = !edit || roomOf(edit.k).length === 0;
        $('btn-roomrandom').classList.toggle('hidden', !normal);
        $('btn-roomrandom').disabled = !normal || freeCell(edit.k) < 0;
      }
      ```

- [ ] **Step 6: Die Mengen und die neue Funktion auf den Debug-Hook legen.**

      Die Sonde braucht `DECO` und `WALL_ITEMS` als Listen. Im Objektliteral
      `window.wipfelkratzer` die Zeile aus Task 4 weiter ergänzen:

      ```js
      ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, clearRoom, spinnerCount: () => spinners.length, raumLeeren, updateRoomButtons, ZUFALL_REZEPT, zieheEinrichtung, zufallEinrichten, DECO_IDS: [...DECO], WALL_IDS: [...WALL_ITEMS], get clip() { return clip; },
      ```

- [ ] **Step 7: Die Sonde laufen lassen und Grün sehen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t5_zufall.py`
      Expected: `t5 GRUEN`
      Schlägt die Überlappungsprüfung fehl, ist der Grund fast immer eine
      doppelt vergebene Zelle — dann stimmt die Platzhalter-Buchführung in
      `zufallsEintraege` nicht. Nicht die Prüfung lockern.

- [ ] **Step 8: Alle vier Sonden nachfahren.**

      Run: `for t in t1_wandslot t2_spinner t3_leeren t4_rezept t5_zufall; do
      python3 .superpowers/sdd/2026-09-27-raum-einrichten/$t.py || break; done`
      Expected: viermal `… GRUEN`, dann `t5 GRUEN`.

- [ ] **Step 9: Committen.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(einrichten): Knopf «Zufall einrichten» mit zwei Fenstern

Fuellt die freien Plaetze einer Wohnung aus einem festen Rezept und haengt
zwei Fenster an zwei verschiedene Waende. Aufgestellt wird ueber
pasteEntries, also denselben Weg wie «Raum einfuegen».

Refs #97"
      ```

---

### Task 6: Changelog und Abschlussprüfung

**Files:**
- Modify: `CHANGELOG.md:7` — Eintrag unter `## [Unreleased]`
- Test: `.superpowers/sdd/2026-09-27-raum-einrichten/t6_gesamt.py` (Wegwerf)

**Interfaces:**
- Consumes: alles aus Task 1–5.
- Produces: nichts im Code.

- [ ] **Step 1: Die Gesamtsonde schreiben.**

      `.superpowers/sdd/2026-09-27-raum-einrichten/t6_gesamt.py` — der Weg,
      den ein Kind geht: einrichten, alles weg, würfeln, neu laden.

      ```python
      import sys
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      sys.path.insert(0, str(Path(__file__).parent))
      from helfer import freier_port, server_starten, seite_oeffnen, stockwerke_sichern, ruhe

      port = freier_port()
      srv = server_starten(port)
      fehler = []
      warnungen = []
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = seite_oeffnen(b, port, fehler)
              stockwerke_sichern(page, 3)
              ruhe(page)

              page.evaluate("window.wipfelkratzer.enterEdit(2)")
              ruhe(page)
              page.click("#btn-roomrandom", timeout=20000)
              ruhe(page)
              voll = page.evaluate("window.wipfelkratzer.roomOf(2).length")
              assert voll >= 9, f"zu wenig gewuerfelt: {voll}"

              page.click("#btn-roomclear", timeout=20000)
              page.click("#clear-ok", timeout=20000)
              assert page.evaluate("window.wipfelkratzer.roomOf(2).length") == 0

              page.click("#btn-roomrandom", timeout=20000)
              ruhe(page)
              assert page.evaluate("window.wipfelkratzer.roomOf(2).length") >= 9

              page.evaluate("window.wipfelkratzer.exitEdit()")
              ruhe(page)
              page.evaluate("window.wipfelkratzer.speichern()")
              page.reload(wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
              assert page.evaluate("window.wipfelkratzer.roomOf(2).length") >= 9
              b.close()
      finally:
          srv.kill()

      assert not fehler, f"pageerror: {fehler}"
      print("t6 GRUEN")
      ```

- [ ] **Step 2: Die Sonde laufen lassen.**

      Run: `python3 .superpowers/sdd/2026-09-27-raum-einrichten/t6_gesamt.py`
      Expected: `t6 GRUEN`. Rot heisst: zurück in die Aufgabe, die den
      gebrochenen Schritt gebaut hat — nicht die Sonde entschärfen.

- [ ] **Step 3: Den Changelog schreiben — in Spielersprache.**

      `CHANGELOG.md`, direkt unter `## [Unreleased]` (Zeile 7):

      ```markdown
      ## [Unreleased]

      ### Added

      - Beim Einrichten gibt es zwei neue Knöpfe: «Alles weg» räumt die ganze
        Wohnung auf einmal leer (es fragt vorher nach, damit nichts aus
        Versehen verschwindet), und «Zufall einrichten» stellt Dir mit einem
        Tippen eine ganze Einrichtung hin — mit zwei Fenstern, damit es hell
        wird. Umbauen kannst Du danach alles wie immer (#97)

      ### Fixed

      - Ein weggeräumtes Hamsterrad drehte sich unsichtbar weiter. Jetzt
        hört es auf (#97)
      ```

- [ ] **Step 4: Prüfen, dass nichts Verbotenes dazugekommen ist.**

      ```bash
      test ! -f package.json && echo "kein package.json — gut"
      git status --porcelain
      ```
      Erwartet: nur `index.html`, `js/game.js`, `CHANGELOG.md` und die beiden
      Dokumente unter `docs/ai-notes/` sind verändert; nichts unter
      `.superpowers/` ist vorgemerkt.
      Ausserdem: `grep -n "ae\|oe\|ue" ` ist **kein** brauchbarer Test — statt
      dessen die eigenen neuen Zeilen einmal lesen und auf echte Umlaute
      prüfen; `grep -n "ß" index.html js/game.js CHANGELOG.md` muss leer sein.

- [ ] **Step 5: Committen und pushen.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Alles weg und Zufall einrichten

Refs #97"
      git push
      ```

---

## Selbstprüfung gegen die Spec

- AK 1 (zwei neue Knöpfe) → Task 3 Step 3, Task 5 Step 3.
- AK 2 (Dialog nennt Ort und Anzahl) → Task 3 Step 7 (`fragNachLeeren`),
  geprüft in `t3_leeren.py`.
- AK 3 (Abbrechen ändert nichts) → Task 3 Step 7, geprüft in `t3_leeren.py`.
- AK 4 (leer, auch nach Neuladen) → Task 3 Step 7, geprüft in `t3_leeren.py`.
- AK 5 (Tapete/Boden unverändert) → `raumLeeren` fasst sie nicht an, geprüft
  in `t3_leeren.py`.
- AK 6 (Tiere bleiben) → `clearRoom` räumt nur `itemMeshes[k]`; Task 2.
- AK 7 (Dach und Spielplatz) → `updateRoomButtons` versteckt `#btn-roomclear`
  nie, geprüft in `t3_leeren.py`.
- AK 8 (ausgegraut im leeren Raum) → Task 3 Step 6, geprüft in `t3_leeren.py`.
- AK 9 (Zufall nur in Wohnungen) → Task 5 Step 5, geprüft in `t5_zufall.py`.
- AK 10 (9–12 Stück aus CATALOG) → Task 4, geprüft in `t4_rezept.py` und
  `t5_zufall.py`.
- AK 11 (≥2 Fenster, verschiedene Wände, nie `front`) → Task 4 (`min: 2`) und
  Task 5 (`ZUFALL_WAENDE`), geprüft in `t5_zufall.py`.
- AK 12 (verschiedene Zellen) → Platzhalter-Buchführung in
  `zufallsEintraege`, geprüft in `t5_zufall.py`.
- AK 13 (keine Überlappung) → `pasteEntries` + `clampEntry`, geprüft in
  `t5_zufall.py` über `solidBoxes`/`overlapsXZ`.
- AK 14 (ergänzt, löscht nicht) → `zufallEinrichten` ruft nie `clearRoom`,
  geprüft in `t5_zufall.py`.
- AK 15 (Bewohner zieht ein) → `checkTenant(k)` in Task 5, geprüft in
  `t5_zufall.py`.
- AK 16 (genau einmal gespeichert) → ein `save()` am Ende von
  `zufallEinrichten`, geprüft über das Neuladen in `t5_zufall.py`.
- AK 17 (Abwechslung) → `t4_rezept.py` zieht 40-mal und verlangt mehr als
  fünf verschiedene Ergebnisse.
- AK 18 (ausgegraut, wenn voll) → Task 5 Step 5.
- AK 19 (`spinners` wachsen nicht) → Task 2, geprüft in `t2_spinner.py`.
- AK 20 (kein `pageerror`) → jede Sonde prüft es am Ende.
