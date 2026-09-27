# Möbel in die Länge ziehen — Implementierungsplan (Issue #100)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein ausgewähltes Möbel lässt sich über zwei Knöpfe («Länger» /
«Kürzer») entlang seiner eigenen Längsachse in festen Schritten dehnen und
wieder kürzen; die Dehnung überlebt Speichern, Umfärben, Raum-Kopieren und
Export/Import.

**Architecture:** Ein optionales Feld `dehnung: { x, z }` am Möbeleintrag in
`state.rooms`. Eine einzige Funktion `applyEntryScale(mesh, entry, q)` setzt
`mesh.scale` — überall, wo heute `scale` gesetzt wird. Ein Schritt läuft durch
das bestehende `applyMove` und damit durch `clampEntry` und die
Tier-Kollision. Die Längsachse wird aus der ungedehnten Geometrie des Modells
bestimmt und pro Modell zwischengespeichert.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap, `localStorage`,
kein Build-Schritt, kein Test-Runner. Abnahme: Playwright im Vordergrund.

**Spec:** [`docs/ai-notes/specs/2026-09-27-moebel-strecken-design.md`](../specs/2026-09-27-moebel-strecken-design.md)

## Global Constraints

- **Kein Build-Schritt, kein npm, kein Framework, keine neue Abhängigkeit.**
  `index.html` im Repo-Wurzelverzeichnis ist das Auslieferbare.
- **Kein Test-Runner.** Jede „failing test"-Stufe dieses Plans ist ein
  konkreter Playwright-Check in `tools/verify_strecken.py`, der **im
  Vordergrund** läuft — nie `run_in_background` (CLAUDE.md, «Tooling &
  Testing»).
- **`const`/`let`, kein `var`.** Keine neuen Globals ausser dem bestehenden
  Debug-Objekt `window.wipfelkratzer` (`js/game.js:2810`).
- **Deutsche UI-Texte mit echten Umlauten**, `Du`/`Dein` gross, wenn jemand
  angesprochen wird. `ss` statt `ß` (Schweizer Schreibung, wie im ganzen Repo).
- **Höhe wird nie gedehnt** (Spec E1): `mesh.scale.y` trägt nur `en.scale`.
- **Schrittliste ist verbindlich:** `STRETCH_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]`
  (Spec E9).
- **`en.scale` gehört Issue #99** und wird hier nur gelesen
  (`en.scale ?? 1`), nie geschrieben (Spec E5).
- **Nicht dehnbar:** `WALL_ITEMS` und Bewohner (`pick.tenant`) (Spec E10).
- **Conventional Commits**, Commit-Fuss:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Dateien im Überblick

| Datei | Verantwortung | Änderung |
|---|---|---|
| `js/models.js` | Modelle + geteilte Konstanten | `STRETCH_STEPS` exportieren |
| `js/game.js` | Zustand, Szene, Bedienung | Datenfeld, `applyEntryScale`, Längsachse, Grenzen, Knöpfe |
| `index.html` | Markup + CSS | `#btn-stretch`, `#stretchpad`, CSS |
| `js/standdatei.js` | Export-/Import-Positivliste | `dehnung` durchlassen |
| `tools/verify_strecken.py` | Abnahme | neu |
| `CHANGELOG.md` | Spielerlesbarer Eintrag | Zeile unter `[Unreleased]` |

---

### Task 1: Datenfeld, gemeinsamer Skalierungspunkt und Längsachse

**Files:**
- Modify: `js/models.js` (nach `BUILD_MAX_H`, ~Zeile 87)
- Modify: `js/game.js` — Import (Zeile 3-7), neben `normalizeColor` (563),
  `clampEntry` (630, 665-666), `replaceMesh` (707), `applyMove` (726),
  `placeItemMesh` (791-792), `addItem` (1525-1526), Debug-Hook (2810)
- Test: `tools/verify_strecken.py` (neu)

**Interfaces:**
- Consumes: nichts aus früheren Tasks.
- Produces:
  - `STRETCH_STEPS: number[]` — exportiert aus `js/models.js`
  - `dehnungOf(en) -> { x: number, z: number }`
  - `setDehnung(en, { x, z }) -> void` (löscht das Feld bei 1/1)
  - `applyEntryScale(mesh, en, q = 1) -> void`
  - `modellMass(en) -> { achse: 'x'|'z', w: number, d: number }`
  - `raumGrenzen(k) -> { x: number, z: number }` (halbe nutzbare Kantenlängen)
  - `normalizeDehnung(en) -> void`
  - Debug-Hook: `window.wipfelkratzer.STRETCH_STEPS`,
    `.applyEntryScale`, `.modellMass`, `.raumGrenzen`

- [ ] **Step 1: Prüfskript mit dem ersten roten Check anlegen**

Neue Datei `tools/verify_strecken.py`. Sie startet den statischen Server
selbst und läuft vollständig im Vordergrund — wie `tools/verify_katalog.py`.

```python
#!/usr/bin/env python3
"""Headless-Prüfung des Dehnens aus Issue #100.

Startet den statischen Server selbst und läuft komplett im Vordergrund —
siehe CLAUDE.md: "Run the verification in the foreground. Never
run_in_background."

    python3 tools/verify_strecken.py
"""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8124
URL = f"http://127.0.0.1:{PORT}/"

SEED = {"floors": 10, "rooms": {}, "nuts": 99, "bridge": True, "garden": True,
        "night": False, "cutaway": False, "fulfilled": {}, "wallpaper": {},
        "flooring": {}}

failures = []


def check(ok, label):
    print(("  OK   " if ok else "  FAIL ") + label)
    if not ok:
        failures.append(label)


def wait_port(port, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def seed(page, rooms=None):
    """Seedet localStorage nur bei der ersten Navigation dieser Page — ein
    add_init_script feuert sonst auch bei page.reload() erneut und wuerde den
    frisch gespeicherten Spielstand vor dem Persistenz-Check ueberschreiben."""
    st = dict(SEED)
    st["rooms"] = rooms or {}
    page.add_init_script(
        "if (!sessionStorage.getItem('str_seeded')) { "
        "localStorage.setItem('wipfelkratzer-v1', " + json.dumps(json.dumps(st)) + "); "
        "sessionStorage.setItem('str_seeded', '1'); }")


def open_game(page):
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer")
    page.click("#btn-start")


def add_item(page, k, tab, name):
    """Moebel ueber die echte UI hinzufuegen (wie tools/verify_katalog.py)."""
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.evaluate("k => window.wipfelkratzer.enterEdit(k)", k)
    page.click(f"#catalog-tabs button:text-is('{tab}')")
    page.click(f"#catalog-items .item:has(span:text-is('{name}'))")
    page.wait_for_timeout(500)


BOX_JS = """
(idx) => {
  const w = window.wipfelkratzer;
  const m = w.itemMeshes[0][idx];
  const bb = new w.THREE.Box3().setFromObject(m);
  return { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
}
"""


def teil1_modell(page):
    """Task 1: Datenfeld, applyEntryScale, Laengsachse."""
    print("Teil 1 — Datenmodell")
    add_item(page, 0, "Möbel", "Sofa")
    vorher = page.evaluate(BOX_JS, 0)

    achse = page.evaluate(
        "() => window.wipfelkratzer.modellMass(window.wipfelkratzer.roomOf(0)[0]).achse")
    check(achse == "x", "Laengsachse des Sofas ist x")

    page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const en = w.roomOf(0)[0];
      en.dehnung = { x: 1.5, z: 1 };
      w.applyEntryScale(w.itemMeshes[0][0], en);
    }""")
    nachher = page.evaluate(BOX_JS, 0)
    check(abs(nachher["x"] - vorher["x"] * 1.5) < 0.02, "Sofa ist in x 1.5x so lang")
    check(abs(nachher["y"] - vorher["y"]) < 0.01, "Hoehe unveraendert")
    check(abs(nachher["z"] - vorher["z"]) < 0.01, "Tiefe unveraendert")

    add_item(page, 0, "Möbel", "Bett")
    bett_achse = page.evaluate(
        "() => window.wipfelkratzer.modellMass(window.wipfelkratzer.roomOf(0)[1]).achse")
    check(bett_achse == "z", "Laengsachse des Bettes ist z")

    schritte = page.evaluate("() => window.wipfelkratzer.STRETCH_STEPS")
    check(schritte == [0.5, 0.75, 1, 1.25, 1.5, 2], "STRETCH_STEPS wie in der Spec")


def run():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           cwd=str(ROOT), stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    try:
        if not wait_port(PORT):
            print("Server kam nicht hoch")
            return 1
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            seed(page)
            open_game(page)

            teil1_modell(page)

            check(not errors, "Konsole bleibt leer (%s)" % (errors[:3] or "leer"))
            browser.close()
    finally:
        srv.terminate()
        srv.wait()
    print()
    if failures:
        print("FEHLGESCHLAGEN: %d" % len(failures))
        for f in failures:
            print(" - " + f)
        return 1
    print("Alle Checks bestanden.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
```

- [ ] **Step 2: Lauf zeigt Rot**

Run: `python3 tools/verify_strecken.py`
Expected: FAIL — `modellMass`, `applyEntryScale` und `STRETCH_STEPS` sind
nicht auf `window.wipfelkratzer`; die Checks scheitern, der Konsolen-Check
ebenfalls (`TypeError: ...modellMass is not a function`).

- [ ] **Step 3: `STRETCH_STEPS` in `js/models.js` exportieren**

Direkt nach `export const DESIGN_MAX = 6;` (Zeile 88):

```js
/* Dehnstufen für «in die Länge ziehen» (Issue #100). Geteilt mit
   js/standdatei.js, damit die Positivliste beim Einlesen dieselbe Liste
   prüft wie die Bedienung. */
export const STRETCH_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
```

- [ ] **Step 4: Import in `js/game.js` ergänzen**

In der Importliste (`js/game.js:4`) `BUILD_MAX_H, DESIGN_MAX` zu
`BUILD_MAX_H, DESIGN_MAX, STRETCH_STEPS` erweitern.

- [ ] **Step 5: Dehnungs-Hilfen neben `normalizeColor` einsetzen**

Direkt nach `normalizeColor` (endet `js/game.js:567`):

```js
/* ---------- Dehnung (Issue #100) ---------- */
/* Zwei Faktoren auf den lokalen Achsen des Modells. Fehlt das Feld, ist das
   Möbel ungedehnt — ein alter Spielstand ist damit gültig, ohne Migration. */
const dehnungOf = en => (en.dehnung ? { x: en.dehnung.x, z: en.dehnung.z } : { x: 1, z: 1 });
function setDehnung(en, d) {
  if (d.x === 1 && d.z === 1) delete en.dehnung; else en.dehnung = { x: d.x, z: d.z };
}
/* Der einzige Ort, an dem mesh.scale eines Möbels gesetzt wird. `en.scale`
   gehört Issue #99 (gleichmässiges Vergrössern) und wird hier nur gelesen;
   `q` ist der Faktor der Aufpopp-Animation. */
function applyEntryScale(mesh, en, q = 1) {
  const d = dehnungOf(en), g = (en.scale ?? 1) * q;
  mesh.scale.set(g * d.x, g, g * d.z);
}
/* Ungedehnte Grundmasse des Modells, einmal pro Bauform gemessen. Ein frisch
   gebautes Modell hängt an keinem Elternknoten, seine Weltmatrix ist also die
   Einheitsmatrix — Box3 liefert damit lokale Masse, ungedreht und
   unskaliert. */
const massCache = new Map();
function modellMass(en) {
  const key = en.id === 'eigenbau' ? 'eigenbau:' + JSON.stringify(en.build) : en.id;
  if (!massCache.has(key)) {
    const probe = en.id === 'eigenbau' ? makeCustomFurniture(en.build) : makeFurniture(en.id);
    probe.updateWorldMatrix(true, false);
    const bb = new THREE.Box3().setFromObject(probe);
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    massCache.set(key, { achse: w >= d ? 'x' : 'z', w, d });
  }
  return massCache.get(key);
}
/* Eine Dehnung ist Fremdeingabe wie eine Farbe: unbekannte Werte verschwinden
   still, 1/1 wird ganz entfernt, und der bereinigte Stand wird über das
   bestehende migrated-Flag einmalig zurückgeschrieben. */
function normalizeDehnung(en) {
  if (en.dehnung === undefined) return;
  const d = en.dehnung;
  const gueltig = !!d && typeof d === 'object' && !WALL_ITEMS.has(en.id)
    && STRETCH_STEPS.includes(d.x) && STRETCH_STEPS.includes(d.z);
  if (!gueltig || (d.x === 1 && d.z === 1)) { delete en.dehnung; migrated = true; return; }
  en.dehnung = { x: d.x, z: d.z };
}
```

- [ ] **Step 6: `raumGrenzen(k)` aus `clampEntry` herausziehen**

`js/game.js:665-666` lautet heute:

```js
  const limX = k === 'roof' ? ROOF_W / 2 - 0.1 : W(k) / 2 - 0.13;
  const limZ = k === 'roof' ? ROOF_D / 2 - 0.1 : D(k) / 2 - 0.13;
```

Ersetzen durch:

```js
  const { x: limX, z: limZ } = raumGrenzen(k);
```

und oberhalb von `clampEntry` (also vor `js/game.js:630`) einsetzen:

```js
/* Halbe nutzbare Kantenlängen eines Raums — geteilt von clampEntry und der
   Dehnungsgrenze (Issue #100). */
function raumGrenzen(k) {
  if (k === 'roof') return { x: ROOF_W / 2 - 0.1, z: ROOF_D / 2 - 0.1 };
  if (k === 'garten') return { x: GARDEN_W / 2, z: GARDEN_D / 2 };
  return { x: W(k) / 2 - 0.13, z: D(k) / 2 - 0.13 };
}
```

`GARDEN_W`/`GARDEN_D` stehen in `js/game.js:455`, also vor dieser Stelle —
die Reihenfolge stimmt. (Der Gartenzweig von `clampEntry` rechnet weiterhin
mit seiner eigenen Box3-Logik, `js/game.js:643-664`; `raumGrenzen('garten')`
wird dort nicht benutzt, nur von der Dehnungsgrenze in Task 2.)

- [ ] **Step 7: Skalierung an die drei bestehenden Stellen hängen**

`placeItemMesh` (`js/game.js:791-792`) — nach `normalizeColor(entry);`:

```js
  normalizeDehnung(entry);
```

und im gleichen Block, direkt nach der Zeile
`m.userData.pick = { k, entry, mesh: m };`:

```js
  applyEntryScale(m, entry);
```

`replaceMesh` (`js/game.js:707-713`) — im Nicht-Tier-Zweig, also aus

```js
  else pick.mesh.position.set(en.x, en.y ?? baseY(pick.k), en.z);
```

wird

```js
  else { pick.mesh.position.set(en.x, en.y ?? baseY(pick.k), en.z); applyEntryScale(pick.mesh, en); }
```

`addItem` (`js/game.js:1525-1526`) — die Aufpopp-Animation darf die Dehnung
nicht plattmachen:

```js
  applyEntryScale(m, entry, 0.01);
  tween(0.35, q => { applyEntryScale(m, entry, 0.01 + 0.99 * q); if (selHelper) selHelper.update(); });
```

- [ ] **Step 8: `applyMove` nimmt die Dehnung in den Schnappschuss**

`js/game.js:726-733` — die Rücknahme muss auch eine Dehnung zurückdrehen,
sonst bleibt bei einem abgelehnten Zug die neue Grösse stehen:

```js
function applyMove(pick, mutate) {
  const en = pick.entry;
  const snap = { x: en.x, z: en.z, y: en.y, rot: en.rot, wall: en.wall,
    dehnung: en.dehnung && { ...en.dehnung } };
  mutate();
  const ok = pick.tenant ? resolveTenantMove(pick) : resolveItemMove(pick);
  if (!ok) { Object.assign(en, snap); if (!snap.dehnung) delete en.dehnung; replaceMesh(pick); }
  return ok;
}
```

- [ ] **Step 9: Debug-Hook ergänzen**

In `window.wipfelkratzer` (`js/game.js:2810 ff.`), in der Zeile mit
`placeItemMesh, clampEntry, removeItem`:

```js
  STRETCH_STEPS, applyEntryScale, modellMass, raumGrenzen, dehnungOf,
```

- [ ] **Step 10: Lauf zeigt Grün**

Run: `python3 tools/verify_strecken.py`
Expected: PASS — alle Checks aus `teil1_modell` und der leere Konsolen-Check.

- [ ] **Step 11: Commit**

```bash
git add js/models.js js/game.js tools/verify_strecken.py
git commit -m "$(cat <<'EOF'
feat(moebel): Dehnungsfeld und gemeinsamer Skalierungspunkt

mesh.scale eines Möbels wird ab jetzt ausschliesslich über
applyEntryScale gesetzt — inklusive der Aufpopp-Animation, die eine
Dehnung sonst beim Umfärben zurücksetzte. Die Längsachse kommt aus der
ungedehnten Geometrie, nicht aus einer Tabelle.

Refs #100

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Bedienung — «Strecken» mit «Länger» und «Kürzer»

**Files:**
- Modify: `index.html:94-110` (CSS) und `index.html:345-358` (`#selbar`)
- Modify: `js/game.js` — `deselect`/`select` (1328-1341), neben
  `btn-rot`/`btn-color` (2264-2272), Debug-Hook (2810)
- Test: `tools/verify_strecken.py` (erweitern)

**Interfaces:**
- Consumes: `STRETCH_STEPS`, `dehnungOf`, `setDehnung`, `applyEntryScale`,
  `modellMass`, `raumGrenzen` aus Task 1.
- Produces:
  - `dehnbar(pick) -> boolean`
  - `passtInRaum(pick, achse, faktor) -> boolean`
  - `kannDehnen(pick, dir) -> boolean` (`dir` ist `+1` oder `-1`)
  - `dehneSchritt(dir) -> void`
  - `renderStretchPad() -> void`
  - DOM: `#btn-stretch`, `#stretchpad`, `#btn-laenger`, `#btn-kuerzer`
  - Debug-Hook: `.dehneSchritt`, `.kannDehnen`

- [ ] **Step 1: Die roten Checks ins Prüfskript schreiben**

In `tools/verify_strecken.py` nach `teil1_modell` einfügen:

```python
def teil2_bedienung(page):
    """Task 2: Knoepfe, Schritte, Grenzen, Kollision."""
    print("Teil 2 — Bedienung")
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.evaluate("() => window.wipfelkratzer.enterEdit(1)")
    add_item(page, 1, "Möbel", "Tisch")
    page.evaluate("() => window.wipfelkratzer.select(window.wipfelkratzer.itemMeshes[1][0].userData.pick)")

    check(page.is_visible("#btn-stretch"), "«Strecken» ist bei einem Tisch sichtbar")
    page.click("#btn-stretch")
    check(page.is_visible("#btn-laenger"), "Das Feld mit «Länger»/«Kürzer» geht auf")

    def box1(i):
        return page.evaluate("""(i) => {
          const w = window.wipfelkratzer;
          const bb = new w.THREE.Box3().setFromObject(w.itemMeshes[1][i]);
          return { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
        }""", i)

    vorher = box1(0)
    page.click("#btn-laenger")
    page.wait_for_timeout(200)
    nach1 = box1(0)
    check(abs(nach1["x"] - vorher["x"] * 1.25) < 0.02, "Ein Schritt macht den Tisch 1.25x lang")
    check(abs(nach1["y"] - vorher["y"]) < 0.01, "Die Höhe bleibt beim Dehnen gleich")

    page.click("#btn-kuerzer")
    page.click("#btn-kuerzer")
    page.wait_for_timeout(200)
    nach2 = box1(0)
    check(abs(nach2["x"] - vorher["x"] * 0.75) < 0.02, "Zwei Schritte zurück ergeben 0.75x")

    # bis ans untere Ende der Liste
    page.click("#btn-kuerzer")
    page.wait_for_timeout(200)
    check(page.is_disabled("#btn-kuerzer"), "Am unteren Ende ist «Kürzer» gesperrt")

    # zurueck auf 1 und ans obere Ende — entweder Liste zu Ende oder Raum zu klein
    for _ in range(5):
        if page.is_disabled("#btn-laenger"):
            break
        page.click("#btn-laenger")
        page.wait_for_timeout(120)
    check(page.is_disabled("#btn-laenger"), "Am oberen Ende ist «Länger» gesperrt")
    grenze = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const en = w.roomOf(1)[0], m = w.modellMass(en), g = w.raumGrenzen(1);
      const d = w.dehnungOf(en);
      return Math.max(m.w * d.x, m.d * d.z) <= 2 * Math.min(g.x, g.z) + 0.001;
    }""")
    check(grenze, "Das gedehnte Möbel passt noch in den Raum")

    # Wandobjekt und Bewohner sind nicht dehnbar
    add_item(page, 1, "Wand", "Wanduhr")
    page.evaluate("() => { const w = window.wipfelkratzer; const m = w.itemMeshes[1].find(x => x.userData.pick.entry.id === 'uhr'); w.select(m.userData.pick); }")
    check(page.is_hidden("#btn-stretch"), "Bei einem Wandobjekt ist «Strecken» versteckt")

    # Persistenz ueber einen Reload
    page.evaluate("() => window.wipfelkratzer.deselect()")
    vor_reload = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(1)[0].dehnung)")
    page.reload(wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer")
    page.click("#btn-start")
    nach_reload = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(1)[0].dehnung)")
    check(vor_reload == nach_reload, "Die Dehnung übersteht einen Reload (%s / %s)"
          % (vor_reload, nach_reload))

    # Umfaerben darf die Dehnung nicht zuruecksetzen (Spec E6)
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.evaluate("() => window.wipfelkratzer.enterEdit(2)")
    add_item(page, 2, "Möbel", "Sofa")
    page.evaluate("() => window.wipfelkratzer.select(window.wipfelkratzer.itemMeshes[2][0].userData.pick)")
    page.click("#btn-stretch")
    page.click("#btn-laenger")
    page.wait_for_timeout(200)
    page.click("#btn-color")
    page.click("#colorpick button:nth-child(2)")
    page.wait_for_timeout(600)
    nach_farbe = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(2)[0].dehnung)")
    skala = page.evaluate("() => window.wipfelkratzer.itemMeshes[2][0].scale.x")
    check(nach_farbe == '{"x":1.25,"z":1}', "Umfärben lässt die Dehnung stehen (%s)" % nach_farbe)
    check(abs(skala - 1.25) < 0.02, "Auch das Mesh ist nach dem Umfärben noch gedehnt (%s)" % skala)
```

und in `run()` nach `teil1_modell(page)`:

```python
            teil2_bedienung(page)
```

- [ ] **Step 2: Lauf zeigt Rot**

Run: `python3 tools/verify_strecken.py`
Expected: FAIL ab „«Strecken» ist bei einem Tisch sichtbar" — `#btn-stretch`
gibt es noch nicht; Teil 1 bleibt grün.

- [ ] **Step 3: Markup und CSS in `index.html`**

In `#selbar` (`index.html:345-358`) zwischen `btn-rot` und `wallpad`:

```html
  <button id="btn-stretch">Strecken</button>
  <div id="stretchpad" aria-label="Länge ändern">
    <button id="btn-kuerzer">Kürzer</button>
    <button id="btn-laenger">Länger</button>
  </div>
```

Im `<style>`-Block direkt nach der `#colorpick`-Regel (`index.html:105-110`),
gleiche Machart — das Feld schwebt über der Auswahlleiste:

```css
  #stretchpad { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
    display: none; gap: 8px; background: var(--cream); border: 3px solid var(--woodL); border-radius: 12px; padding: 8px; }
  #stretchpad.open { display: flex; }
  #stretchpad button { min-height: 44px; min-width: 88px; }
  #stretchpad button:disabled { opacity: 0.4; }
```

- [ ] **Step 4: Schrittlogik in `js/game.js`**

Direkt vor `function renderColorPick()` (`js/game.js:1438`) einsetzen:

```js
/* ---------- Dehnen: Bedienung (Issue #100) ---------- */
/* Wandobjekte kennen ihre Breite nicht (wallPlacement rechnet mit festen
   Rändern), und ein Tier ist kein Möbel. */
const dehnbar = pick => !!pick && !pick.tenant && !WALL_ITEMS.has(pick.entry.id);
/* Passt das Möbel mit dem neuen Faktor noch in den Raum? Verglichen wird die
   längere Kante gegen die kürzere Raumseite — das gilt unabhängig davon, wie
   das Möbel gerade gedreht ist. */
function passtInRaum(pick, achse, faktor) {
  const en = pick.entry, mass = modellMass(en), g = en.scale ?? 1;
  const d = dehnungOf(en); d[achse] = faktor;
  const grenze = raumGrenzen(pick.k);
  return Math.max(mass.w * g * d.x, mass.d * g * d.z) <= 2 * Math.min(grenze.x, grenze.z);
}
function kannDehnen(pick, dir) {
  if (!dehnbar(pick)) return false;
  const achse = modellMass(pick.entry).achse;
  const i = STRETCH_STEPS.indexOf(dehnungOf(pick.entry)[achse]);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= STRETCH_STEPS.length) return false;
  return dir < 0 || passtInRaum(pick, achse, STRETCH_STEPS[j]);
}
function renderStretchPad() {
  const auf = dehnbar(selected);
  $('btn-laenger').disabled = !(auf && kannDehnen(selected, 1));
  $('btn-kuerzer').disabled = !(auf && kannDehnen(selected, -1));
}
/* Ein Schritt ist ein Zug wie Verschieben oder Drehen: applyMove räumt
   danach die Kollisionen auf und nimmt den Zug zurück, wenn ein Tier
   eingeklemmt würde. */
function dehneSchritt(dir) {
  if (!kannDehnen(selected, dir)) return;
  const pick = selected, en = pick.entry, achse = modellMass(en).achse;
  const neu = dehnungOf(en);
  neu[achse] = STRETCH_STEPS[STRETCH_STEPS.indexOf(neu[achse]) + dir];
  if (!applyMove(pick, () => { setDehnung(en, neu);
    applyEntryScale(pick.mesh, en);
    clampEntry(pick.k, pick.mesh, en); })) { meldeBlockade(); renderStretchPad(); return; }
  selHelper.update(); sfx.pop(); save(); renderStretchPad();
}
```

- [ ] **Step 5: Knöpfe verdrahten**

Direkt nach dem `btn-rot`-Block (`js/game.js:2264-2270`):

```js
$('btn-stretch').onclick = () => { if (!dehnbar(selected)) return;
  $('stretchpad').classList.toggle('open'); renderStretchPad(); };
$('btn-laenger').onclick = () => dehneSchritt(1);
$('btn-kuerzer').onclick = () => dehneSchritt(-1);
```

In `deselect()` (`js/game.js:1328`) neben dem Schliessen von `#colorpick`:

```js
  $('stretchpad').classList.remove('open');
```

In `select(pick)` (`js/game.js:1329-1341`) neben der `btn-color`-Zeile:

```js
  $('btn-stretch').classList.toggle('hidden', !dehnbar(pick));
  renderStretchPad();
```

- [ ] **Step 6: Debug-Hook ergänzen**

In `window.wipfelkratzer` die in Task 1 eingefügte Zeile erweitern:

```js
  STRETCH_STEPS, applyEntryScale, modellMass, raumGrenzen, dehnungOf, dehneSchritt, kannDehnen,
```

- [ ] **Step 7: Lauf zeigt Grün**

Run: `python3 tools/verify_strecken.py`
Expected: PASS — Teil 1 und Teil 2, Konsole leer.

- [ ] **Step 8: Commit**

```bash
git add index.html js/game.js tools/verify_strecken.py
git commit -m "$(cat <<'EOF'
feat(moebel): «Strecken» mit «Länger» und «Kürzer» in der Auswahlleiste

Der Schritt läuft über applyMove, damit clampEntry und die
Tier-Kollision gelten wie beim Verschieben. Passt der nächste Schritt
nicht mehr in den Raum, ist der Knopf gesperrt statt stumm.

Refs #100

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Dehnung übersteht Raum-Kopieren, Export und Import

**Files:**
- Modify: `js/standdatei.js:8-9` (Import) und `js/standdatei.js:141-168`
  (`bereinigeMoebel`)
- Test: `tools/verify_strecken.py` (erweitern)

**Interfaces:**
- Consumes: `STRETCH_STEPS` aus `js/models.js` (Task 1).
- Produces: `dehnung` als erlaubtes Feld der Export-/Import-Positivliste.

- [ ] **Step 1: Die roten Checks ins Prüfskript schreiben**

In `tools/verify_strecken.py` nach `teil2_bedienung` einfügen:

```python
def teil3_datei(page):
    """Task 3: Raum kopieren, Export/Import."""
    print("Teil 3 — Kopieren und Datei")
    # Raum 2 traegt aus Teil 2 ein gedehntes Sofa.
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.evaluate("() => window.wipfelkratzer.enterEdit(2)")
    page.click("#btn-roomcopy")
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.evaluate("() => window.wipfelkratzer.enterEdit(3)")
    page.click("#btn-roompaste")
    page.wait_for_timeout(300)
    if page.is_visible("#paste-add"):
        page.click("#paste-add")
        page.wait_for_timeout(600)
    kopiert = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(3)[0].dehnung)")
    check(kopiert == '{"x":1.25,"z":1}', "Raum einfügen überträgt die Dehnung (%s)" % kopiert)

    # Export -> Import durch die Positivliste von js/standdatei.js
    durchgereicht = page.evaluate("""async () => {
      const m = await import('/js/standdatei.js');
      const stand = JSON.parse(JSON.stringify(window.wipfelkratzer.state));
      const datei = m.baueDatei(stand, []);
      const text = typeof datei === 'string' ? datei : JSON.stringify(datei);
      const geprueft = await m.pruefeDatei(text);
      const raum = (geprueft.stand || geprueft).rooms['2'];
      return JSON.stringify(raum[0].dehnung);
    }""")
    check(durchgereicht == '{"x":1.25,"z":1}',
          "Export/Import erhält die Dehnung (%s)" % durchgereicht)

    # Ein erfundener Faktor faellt weg
    gefiltert = page.evaluate("""async () => {
      const m = await import('/js/standdatei.js');
      const stand = JSON.parse(JSON.stringify(window.wipfelkratzer.state));
      stand.rooms['2'][0].dehnung = { x: 7, z: 1 };
      const datei = m.baueDatei(stand, []);
      const text = typeof datei === 'string' ? datei : JSON.stringify(datei);
      const geprueft = await m.pruefeDatei(text);
      const raum = (geprueft.stand || geprueft).rooms['2'];
      return raum[0].dehnung === undefined;
    }""")
    check(gefiltert, "Ein ungültiger Faktor fällt beim Einlesen weg")
```

und in `run()` nach `teil2_bedienung(page)`:

```python
            teil3_datei(page)
```

Sollten `baueDatei`/`pruefeDatei` eine andere Signatur oder Rückgabeform
haben als hier angenommen, ist das im Skript anzupassen — nicht in
`js/standdatei.js`. Die Signatur steht in `js/standdatei.js` selbst; lies sie
vor dem ersten Lauf nach.

- [ ] **Step 2: Lauf zeigt Rot**

Run: `python3 tools/verify_strecken.py`
Expected: FAIL bei „Export/Import erhält die Dehnung" — `bereinigeMoebel`
ist eine Positivliste, `dehnung` steht nicht darin und fällt still weg
(`undefined`). Der Raum-Kopieren-Check ist bereits grün (`deepCopy` in
`js/game.js:1345` kopiert den ganzen Eintrag).

- [ ] **Step 3: Import in `js/standdatei.js` ergänzen**

`js/standdatei.js:8-9`:

```js
import { CATALOG, WALL_ITEMS, WALLS, FLOORS, FURN_COLORS, SEASONS,
  DESIGN_MAX, STRETCH_STEPS, normalizeBuild } from './models.js';
```

- [ ] **Step 4: `dehnung` in die Positivliste aufnehmen**

In `bereinigeMoebel`, direkt nach der Farbzeile
(`if (FARBEN.has(e.color)) eintrag.color = e.color;`, `js/standdatei.js:165`):

```js
  /* Dehnung (#100): nur die bekannten Stufen, und nur wenn sie etwas ändert.
     Wandobjekte sind nicht dehnbar (js/game.js, normalizeDehnung). */
  const deh = objekt(e.dehnung);
  if (deh && !WALL_ITEMS.has(e.id)
      && STRETCH_STEPS.includes(deh.x) && STRETCH_STEPS.includes(deh.z)
      && !(deh.x === 1 && deh.z === 1)) {
    eintrag.dehnung = { x: deh.x, z: deh.z };
  }
```

Zusätzlich den Formkommentar über `bereinigeMoebel`
(`js/standdatei.js:140-142`) auf die neue Form bringen:

```js
/* Ein Möbeleintrag hat die Form
   { id, cell, x, y, z, rot, wall?, color?, dehnung?, build?, fill? } */
```

- [ ] **Step 5: Lauf zeigt Grün**

Run: `python3 tools/verify_strecken.py`
Expected: PASS — Teile 1 bis 3, Konsole leer.

- [ ] **Step 6: Commit**

```bash
git add js/standdatei.js tools/verify_strecken.py
git commit -m "$(cat <<'EOF'
feat(standdatei): Dehnung durch die Export-Positivliste lassen

bereinigeMoebel baut jeden Eintrag aus einer Positivliste neu auf — ohne
diesen Eintrag verlöre jede gesicherte Wohnung ihre Dehnungen still.

Refs #100

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Kollisionsfall, Gesamtlauf und Changelog

**Files:**
- Modify: `tools/verify_strecken.py` (letzter Prüfteil)
- Modify: `CHANGELOG.md` (unter `## [Unreleased]`)

**Interfaces:**
- Consumes: alles aus Task 1-3.
- Produces: keine neuen Schnittstellen.

- [ ] **Step 1: Den Kollisions-Check schreiben**

In `tools/verify_strecken.py` nach `teil3_datei` einfügen:

```python
def teil4_kollision(page):
    """Task 4: Ein Tier im Weg nimmt den Schritt zurueck (Spec E7)."""
    print("Teil 4 — Kollision")
    # Erdgeschoss hat aus Teil 1 ein Sofa und ein Bett; ein Bewohner zieht
    # dort ein, sobald genug Moebel stehen (checkTenant).
    hat_tier = page.evaluate("() => (window.wipfelkratzer.tenantMeshes[0] || []).length > 0")
    if not hat_tier:
        print("  --   kein Bewohner im Erdgeschoss, Kollisionsfall uebersprungen")
        return
    page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const tier = w.tenantMeshes[0][0].userData.pick;
      const sofa = w.itemMeshes[0][0].userData.pick;
      tier.entry.x = sofa.entry.x + 0.45; tier.entry.z = sofa.entry.z;
      w.setTenantPos(0, 0, tier.entry);
      w.select(sofa);
    }""")
    vorher = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(0)[0].dehnung)")
    for _ in range(4):
        if page.is_disabled("#btn-laenger"):
            break
        page.click("#btn-laenger")
        page.wait_for_timeout(150)
    stimmig = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const en = w.roomOf(0)[0], m = w.itemMeshes[0][0];
      const d = w.dehnungOf(en);
      return Math.abs(m.scale.x - d.x * (en.scale ?? 1)) < 0.01;
    }""")
    check(stimmig, "Nach jedem Versuch passen Eintrag und Mesh zusammen (vorher %s)" % vorher)
    frei = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      return !w.tenantBlocked(w.tenantMeshes[0][0].userData.pick);
    }""")
    check(frei, "Kein Tier steckt nach dem Dehnen in einem Möbel")
```

und in `run()` nach `teil3_datei(page)`:

```python
            teil4_kollision(page)
```

Das Erdgeschoss muss dafür sichtbar sein: `page.evaluate` vor dem Teil ruft
`exitEdit()`/`enterEdit(0)` — ergänze diese zwei Zeilen am Anfang von
`teil4_kollision`, falls der Lauf sonst in der falschen Etage misst.

- [ ] **Step 2: Gesamtlauf im Vordergrund**

Run: `python3 tools/verify_strecken.py`
Expected: PASS für alle vier Teile; letzte Zeile „Alle Checks bestanden."
Läuft blockierend — **nicht** in den Hintergrund schicken, auch wenn es
Minuten dauert (CLAUDE.md).

- [ ] **Step 3: Bestehende Prüfskripte gegenprüfen**

Run: `python3 tools/verify_katalog.py`
Expected: PASS wie vor der Änderung — `applyEntryScale` ersetzt die
Aufpopp-Animation in `addItem`, und dieses Skript stellt Möbel über dieselbe
UI auf. Schlägt es fehl, liegt der Fehler in Task 1 Step 7, nicht im Skript.

- [ ] **Step 4: Changelog-Eintrag in Spielersprache**

Unter `## [Unreleased]` in `CHANGELOG.md` (falls noch kein `### Added`
darunter steht, eines anlegen):

```markdown
### Added

- Möbel lassen sich jetzt in die Länge ziehen und wieder kürzen: Möbel
  antippen, «Strecken» wählen, dann «Länger» oder «Kürzer». Aus dem Tisch
  wird eine lange Tafel, aus dem Sofa eine Bank für die ganze Familie. Passt
  das Möbel nicht mehr ins Zimmer, geht es nicht weiter (#100)
```

- [ ] **Step 5: Commit**

```bash
git add tools/verify_strecken.py CHANGELOG.md
git commit -m "$(cat <<'EOF'
test(moebel): Kollisionsfall beim Dehnen prüfen und Changelog nachziehen

Closes #100

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Selbstprüfung des Plans

- **Spec-Abdeckung:** E1/E2 → Task 1 Step 5 (`applyEntryScale` lässt `y` in
  Ruhe, `scale` wirkt vor `rotation.y`); E3 → Task 1 Step 5 (`modellMass`);
  E4 → Datenfeld `{ x, z }`, Bedienung nur auf der Längsachse (Task 2
  Step 4); E5/E6 → Task 1 Step 5 und Step 7; E7 → Task 1 Step 8 und Task 2
  Step 4; E8 → Task 2 Step 4 (`passtInRaum`, `raumGrenzen` aus Task 1
  Step 6); E9 → Task 1 Step 3; E10 → `dehnbar` in Task 2 Step 4 und
  `normalizeDehnung`; E11 → es gibt keinen Nuss-Code in diesem Plan;
  E12 → Task 1 Step 5; E13 → Task 3.
  Abnahmeliste der Spec: 1-2 → Teil 1; 3, 4, 7 → Teil 2; 5, 6 → Teil 3;
  8 → Teil 4; 9 → Teil 2 (Wandobjekt) — der Bewohner-Fall ist über
  `dehnbar(pick)` mitabgedeckt, das `pick.tenant` genauso prüft; 10 → der
  Konsolen-Check am Ende jedes Laufs.
- **Platzhalter:** keine „TBD"/„später"/„analog zu Task N" — jeder
  Code-Schritt trägt den vollständigen Text.
- **Namenskonsistenz:** `STRETCH_STEPS`, `dehnungOf`, `setDehnung`,
  `applyEntryScale`, `modellMass`, `raumGrenzen`, `normalizeDehnung`,
  `dehnbar`, `passtInRaum`, `kannDehnen`, `dehneSchritt`, `renderStretchPad`
  — in allen Tasks gleich geschrieben; DOM-Ids `#btn-stretch`,
  `#stretchpad`, `#btn-laenger`, `#btn-kuerzer` ebenso.
