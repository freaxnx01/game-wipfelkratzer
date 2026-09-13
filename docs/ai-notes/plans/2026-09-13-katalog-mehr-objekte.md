# Plan — Katalog: sechs neue Objekte (Issue #37)

**Goal:** Sechs neue Katalogobjekte — Bar (Dach), Kommode (Möbel), Ball,
Kuscheltier, Tischkicker (Spass) und Dartscheibe (Wand) — im vorhandenen Stil
bauen und verdrahten, ohne neue Platzierungsmechanik.

**Architecture:** Jedes Objekt ist eine `FURN`-Funktion in `js/models.js`
(`js/models.js:65`) plus ein Eintrag in `CATALOG` (`js/models.js:251`). Die
Dartscheibe kommt zusätzlich in `WALL_ITEMS` (`js/models.js:272`) und läuft
damit über `wallPlacement` (`js/game.js:371`) statt über die Zellenplatzierung.
Die Bar ist ein gewöhnliches Dachobjekt; die Treppenöffnung hält `clampEntry`
von allein frei (`js/game.js:442-444`). In `js/game.js` ändert sich genau eine
Zeile: `SURFACES` (`js/game.js:426`) bekommt `'kommode'`. Thumbnails entstehen
automatisch über `makeThumbs` (`js/game.js:541`).

**Spec:** `docs/ai-notes/specs/2026-09-13-katalog-mehr-objekte-design.md`

## Global Constraints

- **Nur `MeshLambertMaterial`.** Farben ausschliesslich aus `MAT`
  (`js/models.js:4`) oder über den Helfer `L` (`js/models.js:3`). Keine
  Texturen, keine Loader, keine importierten Meshes, keine neuen Abhängigkeiten.
- **Nur die vorhandenen Geometrie-Helfer** `mesh`/`box`/`cyl`/`sph`/`G`
  (`js/models.js:14-21`). Klobige Primitive, warme entsättigte Palette.
- **Kein Eingriff in die Platzierungslogik.** `clampEntry`, `placeItemMesh`,
  `wallPlacement`, `cellPos`, `freeCell` und `addItem` bleiben unverändert;
  einzige Ausnahme in `js/game.js` ist die `SURFACES`-Zeile aus Task 2.
- **Verifikation im Vordergrund. Niemals `run_in_background`.** So steht es in
  `CLAUDE.md:550-566`, und genau daran ist der Lauf zu Issue #11 gescheitert
  (59 von 80 Turns, „success", nichts gepusht). Das Prüfskript startet seinen
  Server selbst und blockiert; dem Aufruf notfalls ein grosszügiges `timeout`
  geben (z.B. 300000 ms) statt ihn in den Hintergrund zu schieben.
- **Branch vor der Verifikation pushen**, nicht danach (`CLAUDE.md:566-570`).
- **Buildless.** Kein Bundler, kein npm-Schritt; `python3 -m http.server`
  genügt (`CLAUDE.md:763`).
- `version.js` und `CHANGELOG.md` bleiben unangetastet — die entstehen beim
  Release über Tag und `git cliff`.
- Reihenfolge im Katalog: jeder neue Eintrag wandert an das Ende seines
  Kategorieblocks in `CATALOG`, jede `FURN`-Funktion an das Ende des passenden
  Kommentarblocks in `FURN`.

---

### Task 1: Prüfharness `tools/verify_katalog.py`

**Files:** `tools/verify_katalog.py` (neu)

**Interfaces:**
- CLI: `python3 tools/verify_katalog.py [id ...]` — ohne Argumente alle sechs
  ids, sonst die genannte Teilmenge. Exit-Code 0 = grün, 1 = rot.
- Nutzt `window.wipfelkratzer` (`js/game.js:1188`) für `enterEdit`,
  `state` und `scene`, und dynamisches `import('/js/models.js')` für
  `CATALOG`, `WALL_ITEMS`, `makeFurniture`.

- [ ] **Step 1: Playwright verfügbar machen.** `python3 -c "import
      playwright"` prüfen; falls nicht vorhanden, `pip install playwright &&
      playwright install chromium` — im Vordergrund.
- [ ] **Step 2: Skript anlegen.** `tools/verify_katalog.py` mit exakt diesem
      Inhalt:

```python
#!/usr/bin/env python3
"""Headless-Prüfung der Katalog-Objekte aus Issue #37.

Startet den statischen Server selbst und läuft komplett im Vordergrund —
siehe CLAUDE.md: "Run the verification in the foreground. Never
run_in_background."

    python3 tools/verify_katalog.py                 # alle sechs
    python3 tools/verify_katalog.py kommode ball    # Teilmenge
"""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8123
URL = f"http://127.0.0.1:{PORT}/"

# id -> Kategorie, Anzeigename, Wandobjekt?, Maximalmasse (w, h, d)
SPECS = {
    "kommode":     {"cat": "mobel", "tab": "Möbel", "name": "Kommode",     "wall": False, "max": (0.95, 1.30, 0.70)},
    "ball":        {"cat": "spass", "tab": "Spass", "name": "Ball",        "wall": False, "max": (0.50, 0.50, 0.50)},
    "kuscheltier": {"cat": "spass", "tab": "Spass", "name": "Kuscheltier", "wall": False, "max": (0.50, 0.70, 0.50)},
    "tischkicker": {"cat": "spass", "tab": "Spass", "name": "Tischkicker", "wall": False, "max": (0.95, 1.00, 1.00)},
    "dartscheibe": {"cat": "wand",  "tab": "Wand",  "name": "Dartscheibe", "wall": True,  "max": (0.70, 0.70, 0.35)},
    "bar":         {"cat": "dach",  "tab": "Dach",  "name": "Bar",         "wall": False, "max": (1.70, 1.30, 1.30)},
}

SEED = {"floors": 10, "rooms": {}, "nuts": 99, "bridge": True, "garden": True,
        "night": False, "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {}}

failures = []
notes = []


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
    st = dict(SEED)
    st["rooms"] = rooms or {}
    page.add_init_script(
        "localStorage.setItem('wipfelkratzer-v1', " + json.dumps(json.dumps(st)) + ")")


def open_game(page):
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer")
    page.click("#btn-start")


def add_item(page, k, tab, name):
    """Möbel über die echte UI hinzufügen: Etage betreten, Tab wählen, Karte klicken."""
    page.evaluate("k => window.wipfelkratzer.enterEdit(k)", k)
    page.click(f"#catalog-tabs button:text-is('{tab}')")
    page.click(f"#catalog-items .item:has(span:text-is('{name}'))")
    page.wait_for_timeout(500)


MODEL_JS = """
async (ids) => {
  const T = await import('three');
  const m = await import('/js/models.js');
  const out = { catalog: m.CATALOG.map(e => ({ id: e.id, name: e.name, cat: e.cat })),
                wall: [...m.WALL_ITEMS], models: {} };
  for (const id of ids) {
    const entry = { meshes: 0, badMats: [], size: null, minY: null, wheel: false, error: null };
    try {
      const g = m.makeFurniture(id);
      entry.wheel = !!g.userData.wheel;
      g.traverse(o => { if (!o.isMesh) return; entry.meshes++;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mt => { if (mt.type !== 'MeshLambertMaterial') entry.badMats.push(mt.type);
                             if (mt.map) entry.badMats.push('texture-map'); }); });
      const bb = new T.Box3().setFromObject(g);
      const s = bb.getSize(new T.Vector3());
      entry.size = [s.x, s.y, s.z]; entry.minY = bb.min.y;
    } catch (e) { entry.error = String(e); }
    out.models[id] = entry;
  }
  return out;
}
"""


def run(ids):
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(PORT):
            print("Server kam nicht hoch"); return 1
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on("console", lambda msg: (errors.append(msg.text) if msg.type == "error"
                                            else notes.append(msg.text) if msg.type == "warning" else None))
            page.on("pageerror", lambda e: errors.append(str(e)))

            # --- 1. Katalog + Modelle ---------------------------------------
            seed(page)
            open_game(page)
            rep = page.evaluate(MODEL_JS, ids)
            cat = {e["id"]: e for e in rep["catalog"]}
            for i in ids:
                spec = SPECS[i]
                print(f"[{i}]")
                check(i in cat, f"{i}: Eintrag in CATALOG")
                if i in cat:
                    check(cat[i]["cat"] == spec["cat"], f"{i}: cat == {spec['cat']} (ist {cat[i]['cat']})")
                    check(cat[i]["name"] == spec["name"], f"{i}: name == {spec['name']}")
                mo = rep["models"][i]
                check(mo["error"] is None, f"{i}: makeFurniture ohne Fehler ({mo['error']})")
                check(mo["meshes"] >= 3, f"{i}: mindestens 3 Meshes (sind {mo['meshes']})")
                check(not mo["badMats"], f"{i}: nur MeshLambertMaterial ({mo['badMats']})")
                if mo["size"]:
                    w, h, d = mo["size"]; mw, mh, md = spec["max"]
                    check(w <= mw and h <= mh and d <= md,
                          f"{i}: Masse {w:.2f}x{h:.2f}x{d:.2f} <= {mw}x{mh}x{md}")
                    if not spec["wall"]:
                        check(mo["minY"] >= -0.03, f"{i}: steht auf y=0 (minY {mo['minY']:.3f})")
                check(spec["wall"] == (i in rep["wall"]), f"{i}: WALL_ITEMS-Mitgliedschaft korrekt")

            # --- 2. Wandobjekt: Dartscheibe ---------------------------------
            if "dartscheibe" in ids:
                print("[dartscheibe: Wandplatzierung]")
                add_item(page, 1, "Wand", "Dartscheibe")
                res = page.evaluate("""() => { const w = window.wipfelkratzer;
                    const en = (w.state.rooms[1] || []).filter(e => e.id === 'dartscheibe').pop();
                    if (!en) return null;
                    const pl = w.wallPlacement(1, en.wall || 'back');
                    return { wall: en.wall, z: en.z, fixed: pl.fixed, rot: en.rot, plrot: pl.rot,
                             x: en.x, half: pl.half, y: en.y }; }""")
                check(res is not None, "dartscheibe: Eintrag liegt in state.rooms[1]")
                if res:
                    check(abs(res["z"] - res["fixed"]) < 0.02, "dartscheibe: sitzt auf der Wandebene")
                    check(abs(res["rot"] - res["plrot"]) < 1e-6, "dartscheibe: Rotation aus wallPlacement")
                    check(abs(res["x"]) <= res["half"] + 1e-6, "dartscheibe: x innerhalb der Wandbreite")
                    check(0.45 <= res["y"] <= 1.5, f"dartscheibe: Höhe {res['y']}")

            # --- 3. Ball bewegt sich nicht ----------------------------------
            if "ball" in ids:
                print("[ball: statisch]")
                add_item(page, 2, "Spass", "Ball")
                snap = """() => { let f = null; window.wipfelkratzer.scene.traverse(o => {
                    if (o.userData && o.userData.itemId === 'ball') f = o; });
                    return f ? [f.position.x, f.position.y, f.position.z,
                                f.rotation.x, f.rotation.y, f.rotation.z] : null; }"""
                a = page.evaluate(snap)
                check(a is not None, "ball: Mesh in der Szene gefunden")
                page.wait_for_timeout(2000)
                b = page.evaluate(snap)
                check(a == b, f"ball: nach 2s unverändert ({a} -> {b})")
                check(not rep["models"]["ball"]["wheel"], "ball: kein userData.wheel (kein Spinner)")

            # --- 4. Kommode trägt Deko --------------------------------------
            if "kommode" in ids:
                print("[kommode: Ablagefläche]")
                add_item(page, 3, "Möbel", "Kommode")
                add_item(page, 3, "Deko", "Blumenvase")
                res = page.evaluate("""() => { const r = window.wipfelkratzer.state.rooms[3] || [];
                    const v = r.filter(e => e.id === 'vase').pop(); return v ? v.y : null; }""")
                check(res is not None and res > 0.5, f"kommode: Vase liegt oben auf (y={res})")

            # --- 5. Bar hält die Treppenöffnung frei ------------------------
            if "bar" in ids:
                print("[bar: Dachterrasse]")
                add_item(page, "roof", "Dach", "Bar")
                placed = page.evaluate("() => (window.wipfelkratzer.state.rooms.roof || []).length")
                check(placed >= 1, "bar: Eintrag in state.rooms.roof")
                page2 = browser.new_page()
                page2.on("pageerror", lambda e: errors.append(str(e)))
                seed(page2, {"roof": [{"id": "bar", "cell": 0, "x": 3.1, "z": 2.2, "rot": 0}]})
                open_game(page2)
                page2.wait_for_timeout(500)
                z = page2.evaluate("() => window.wipfelkratzer.state.rooms.roof[0].z")
                x = page2.evaluate("() => window.wipfelkratzer.state.rooms.roof[0].x")
                check(z < 1.1, f"bar: clampEntry schiebt aus der Treppenöffnung (z={z})")
                check(x <= 3.2, f"bar: bleibt auf dem Deck (x={x})")
                page2.close()

            # --- 6. Persistenz über einen Reload ----------------------------
            print("[Persistenz]")
            page3 = browser.new_page()
            page3.on("pageerror", lambda e: errors.append(str(e)))
            seed(page3)
            open_game(page3)
            for i in ids:
                s = SPECS[i]
                add_item(page3, "roof" if s["cat"] == "dach" else 4, s["tab"], s["name"])
            page3.wait_for_timeout(600)
            page3.reload(wait_until="networkidle")
            page3.wait_for_function("() => !!window.wipfelkratzer")
            page3.wait_for_timeout(500)
            got = page3.evaluate("""() => { const r = window.wipfelkratzer.state.rooms; const out = [];
                Object.keys(r).forEach(k => (r[k] || []).forEach(e => out.push(e.id))); return out; }""")
            for i in ids:
                check(i in got, f"{i}: überlebt den Reload")
            page3.close()

            # --- 7. Konsole -------------------------------------------------
            print("[Konsole]")
            check(not errors, f"keine Konsolenfehler ({errors[:3]})")
            if notes:
                print("  Hinweis — Warnungen:", notes[:5])
            browser.close()
    finally:
        srv.terminate()
        srv.wait()

    print()
    if failures:
        print(f"ROT — {len(failures)} Prüfung(en) fehlgeschlagen:")
        for f in failures:
            print("  -", f)
        return 1
    print("GRÜN — alle Prüfungen bestanden.")
    return 0


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(SPECS)
    unknown = [i for i in wanted if i not in SPECS]
    if unknown:
        print("Unbekannte id(s):", unknown); sys.exit(2)
    sys.exit(run(wanted))
```

- [ ] **Step 3: Rot sehen.** `python3 tools/verify_katalog.py` im Vordergrund
      laufen lassen. Erwartet: Exit 1, weil keine der sechs ids existiert
      (`CATALOG`-Prüfung und `makeFurniture` schlagen fehl). Ein grüner Lauf
      an dieser Stelle wäre ein Harness-Fehler, kein Erfolg.
- [ ] **Step 4: Harness gegen Bestehendes gegenprüfen.** Kurz im Python-REPL
      oder per temporärer Änderung `SPECS` auf `{"tisch": {...}}` zeigen
      lassen und bestätigen, dass die Modell- und Reload-Prüfungen für ein
      vorhandenes Möbel grün sind. Danach die temporäre Änderung zurücknehmen.

---

### Task 2: Kommode (`cat: 'mobel'`) und Ablagefläche

**Files:** `js/models.js`, `js/game.js`

**Interfaces:** `FURN.kommode()` → `THREE.Group`; `CATALOG`-Eintrag
`{ id: 'kommode', name: 'Kommode', cat: 'mobel' }`; `SURFACES` um `'kommode'`
erweitert (`js/game.js:426`).

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_katalog.py
      kommode` im Vordergrund — muss rot sein (kein `CATALOG`-Eintrag).
- [ ] **Step 2: Modell einfügen** in `js/models.js`, direkt nach `regal()` (Ende
      des Möbelblocks), exakt so:

```js
  kommode() { const g = G();
    /* Korpus auf kurzen Füssen, drei Schubladen, Deckplatte als Ablage (SURFACES). */
    box(g, 0.86, 0.76, 0.40, MAT.wood, 0, 0.48);
    box(g, 0.94, 0.07, 0.46, MAT.woodL, 0, 0.89);
    [0.26, 0.50, 0.74].forEach(y => { box(g, 0.76, 0.20, 0.03, MAT.woodL, 0, y, 0.205);
      [-0.18, 0.18].forEach(x => sph(g, 0.035, MAT.woodD, x, y, 0.235)); });
    [-0.35, 0.35].forEach(x => [-0.15, 0.15].forEach(z => box(g, 0.09, 0.10, 0.09, MAT.woodD, x, 0.05, z)));
    return g; },
```

- [ ] **Step 3: Katalogeintrag** in `js/models.js` ans Ende des `mobel`-Blocks
      in `CATALOG` (`js/models.js:251`), nach dem `regal`-Eintrag:

```js
  { id: 'kommode', name: 'Kommode', cat: 'mobel' },
```

- [ ] **Step 4: Ablagefläche** in `js/game.js:426`:

```js
const SURFACES = ['tisch', 'regal', 'schrank', 'klavier', 'nusskiste', 'kommode'];
```

- [ ] **Step 5: Grün sehen.** `python3 tools/verify_katalog.py kommode` im
      Vordergrund. Erwartet: Eintrag, Masse (0.94 × 0.96 × 0.46 innerhalb
      0.95 × 1.30 × 0.70), nur Lambert-Materialien, Vase landet oben auf.

---

### Task 3: Ball und Kuscheltier (`cat: 'spass'`, beide statisch)

**Files:** `js/models.js`

**Interfaces:** `FURN.ball()`, `FURN.kuscheltier()` → `THREE.Group`, beide
**ohne** `userData.wheel` (sonst würden sie sich über `spinners` drehen,
`js/game.js:463`, `js/game.js:1211`); `CATALOG`-Einträge mit `cat: 'spass'`.

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_katalog.py ball
      kuscheltier` im Vordergrund — muss rot sein.
- [ ] **Step 2: Ball einfügen** in `js/models.js` nach `nusskiste()` (Ende des
      Spass-Blocks), exakt so:

```js
  ball() { const g = G();
    /* Liegt einfach da — bewusst ohne Physik und ohne Spinner (Spec A2).
       Zwei leicht grössere, plattgedrückte Kugeln geben die Streifen. */
    const r = 0.20;
    sph(g, r, MAT.red, 0, r, 0);
    sph(g, r * 1.01, MAT.cream, 0, r, 0, 1, 0.26, 1);
    sph(g, r * 1.02, MAT.blue, 0, r, 0, 0.24, 1, 1);
    return g; },
```

- [ ] **Step 3: Kuscheltier einfügen**, direkt nach `ball()`:

```js
  kuscheltier() { const g = G();
    /* Sitzender Teddy, nur aus Kugeln — warm und entsättigt, kein Fell-Shader. */
    const fell = L(0xc99a63);
    sph(g, 0.17, fell, 0, 0.18, 0, 1, 0.95, 0.9);
    sph(g, 0.13, fell, 0, 0.42, 0.01);
    [-0.09, 0.09].forEach(x => sph(g, 0.05, fell, x, 0.52, -0.01));
    sph(g, 0.06, MAT.cream, 0, 0.40, 0.10, 1, 0.8, 0.6);
    sph(g, 0.02, MAT.black, 0, 0.42, 0.14);
    [-0.05, 0.05].forEach(x => sph(g, 0.016, MAT.black, x, 0.46, 0.12));
    [-1, 1].forEach(s => { const a = sph(g, 0.06, fell, s * 0.18, 0.22, 0.06, 1, 1.5, 1); a.rotation.z = s * 0.6; });
    [-1, 1].forEach(s => sph(g, 0.07, MAT.woodD, s * 0.10, 0.08, 0.15, 1, 0.8, 1.4));
    box(g, 0.22, 0.05, 0.04, MAT.red, 0, 0.31, 0.08);
    return g; },
```

- [ ] **Step 4: Katalogeinträge** ans Ende des `spass`-Blocks in `CATALOG`:

```js
  { id: 'ball', name: 'Ball', cat: 'spass' }, { id: 'kuscheltier', name: 'Kuscheltier', cat: 'spass' },
```

- [ ] **Step 5: Grün sehen.** `python3 tools/verify_katalog.py ball
      kuscheltier` im Vordergrund. Die Ball-Prüfung vergleicht Position und
      Rotation nach zwei Sekunden Laufzeit — sie muss unverändert sein, und
      `userData.wheel` darf nicht gesetzt sein.

---

### Task 4: Tischkicker (`cat: 'spass'`)

**Files:** `js/models.js`

**Interfaces:** `FURN.tischkicker()` → `THREE.Group`; `CATALOG`-Eintrag
`{ id: 'tischkicker', name: 'Tischkicker', cat: 'spass' }`. Die Stangen sind
starre Meshes; kein `userData.wheel`, keine Animation.

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_katalog.py
      tischkicker` im Vordergrund — muss rot sein.
- [ ] **Step 2: Modell einfügen** in `js/models.js`, direkt nach
      `kuscheltier()`, exakt so:

```js
  tischkicker() { const g = G();
    /* Kasten auf vier Beinen, grünes Feld, vier Stangen quer (entlang z) mit je zwei Figuren. */
    box(g, 0.90, 0.16, 0.56, MAT.wood, 0, 0.68);
    box(g, 0.80, 0.04, 0.46, MAT.green2, 0, 0.77);
    box(g, 0.80, 0.012, 0.02, MAT.white, 0, 0.79);
    [-0.38, 0.38].forEach(x => box(g, 0.03, 0.10, 0.22, MAT.white, x, 0.82));
    [-0.40, 0.40].forEach(x => [-0.24, 0.24].forEach(z => box(g, 0.08, 0.60, 0.08, MAT.woodD, x, 0.30, z)));
    [[-0.28, MAT.red], [-0.09, MAT.blue], [0.09, MAT.red], [0.28, MAT.blue]].forEach(([x, m]) => {
      const rod = cyl(g, 0.015, 0.015, 0.78, MAT.grey, x, 0.86, 0, 8); rod.rotation.x = Math.PI / 2;
      [-0.14, 0.14].forEach(z => box(g, 0.06, 0.14, 0.05, m, x, 0.82, z));
      [-1, 1].forEach(s => { const k = cyl(g, 0.025, 0.025, 0.05, MAT.woodD, x, 0.86, s * 0.42, 8); k.rotation.x = Math.PI / 2; }); });
    sph(g, 0.03, MAT.white, 0.10, 0.80, 0.10);
    return g; },
```

- [ ] **Step 3: Katalogeintrag** ans Ende des `spass`-Blocks in `CATALOG`:

```js
  { id: 'tischkicker', name: 'Tischkicker', cat: 'spass' },
```

- [ ] **Step 4: Grün sehen.** `python3 tools/verify_katalog.py tischkicker` im
      Vordergrund. Masse müssen unter 0.95 × 1.00 × 1.00 bleiben (die Stangen
      bestimmen die Tiefe) und das Modell auf `y = 0` stehen.

---

### Task 5: Dartscheibe (`cat: 'wand'`, Wandobjekt)

**Files:** `js/models.js`

**Interfaces:** `FURN.dartscheibe()` → `THREE.Group` in der xy-Ebene, +z zeigt
in den Raum (wie `uhr()`, `js/models.js:197`); `CATALOG`-Eintrag
`{ id: 'dartscheibe', name: 'Dartscheibe', cat: 'wand' }`; zusätzlich
`'dartscheibe'` in `WALL_ITEMS` (`js/models.js:272`). Damit läuft sie über
`wallPlacement`/`clampEntry` (`js/game.js:371`, `js/game.js:428-435`) und
belegt keine Bodenzelle.

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_katalog.py
      dartscheibe` im Vordergrund — muss rot sein.
- [ ] **Step 2: Modell einfügen** in `js/models.js`, direkt nach `fenster()`
      (Ende des Wandblocks), exakt so:

```js
  dartscheibe() { const g = G();
    /* Wandobjekt: liegt in der xy-Ebene, +z zeigt in den Raum (wie uhr/spiegel). */
    const ring = (r, h, mat, z) => { const m = cyl(g, r, r, h, mat, 0, 0, z, 24); m.rotation.x = Math.PI / 2; return m; };
    ring(0.30, 0.05, MAT.woodD, 0.025);
    ring(0.26, 0.03, MAT.cream, 0.05);
    ring(0.19, 0.02, MAT.dark, 0.065);
    ring(0.12, 0.02, MAT.red, 0.075);
    ring(0.05, 0.02, MAT.green2, 0.085);
    sph(g, 0.025, MAT.gold, 0, 0, 0.09);
    /* Drei Pfeile stecken schräg in der Scheibe. */
    [[-0.10, 0.08, -0.4], [0.13, -0.02, 0.3], [0.02, -0.14, 0.1]].forEach(([x, y, a]) => {
      const s = G(); g.add(s); s.position.set(x, y, 0.08); s.rotation.z = a; s.rotation.x = -0.3;
      const sh = cyl(s, 0.012, 0.012, 0.14, MAT.grey, 0, 0, 0.07, 8); sh.rotation.x = Math.PI / 2;
      const tp = cyl(s, 0.010, 0.020, 0.05, MAT.red, 0, 0, 0.16, 8); tp.rotation.x = Math.PI / 2;
      box(s, 0.006, 0.07, 0.07, MAT.orange, 0, 0, 0.185); });
    return g; },
```

- [ ] **Step 3: Katalogeintrag** ans Ende des `wand`-Blocks in `CATALOG`:

```js
  { id: 'dartscheibe', name: 'Dartscheibe', cat: 'wand' },
```

- [ ] **Step 4: `WALL_ITEMS` erweitern** (`js/models.js:272`):

```js
export const WALL_ITEMS = new Set(['poster_wald', 'poster_mond', 'poster_willi', 'uhr', 'spiegel', 'fenster', 'dartscheibe']);
```

- [ ] **Step 5: Grün sehen.** `python3 tools/verify_katalog.py dartscheibe` im
      Vordergrund. Geprüft werden: `WALL_ITEMS`-Mitgliedschaft, Sitz auf der
      Wandebene (`|en.z - pl.fixed| < 0.02`), Rotation aus `wallPlacement`,
      Höhe im erlaubten Band und Tiefe höchstens 0.35.
- [ ] **Step 6: Sichtprüfung.** Im laufenden Spiel eine Etage betreten, Tab
      „Wand", Dartscheibe auf jede der vier Wände legen (Wand-Picker) und
      bestätigen, dass sie flach anliegt und die Pfeile in den Raum zeigen.

---

### Task 6: Bar (`cat: 'dach'`)

**Files:** `js/models.js`

**Interfaces:** `FURN.bar()` → `THREE.Group`, Bodenobjekt mit Ursprung auf
`y = 0`; `CATALOG`-Eintrag `{ id: 'bar', name: 'Bar', cat: 'dach' }`. Keine
Sonderbehandlung: das Freihalten der Treppenöffnung erledigt `clampEntry`
(`js/game.js:442-444`), sowohl beim Verschieben als auch beim Laden
(`js/game.js:1177-1182`).

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_katalog.py bar`
      im Vordergrund — muss rot sein.
- [ ] **Step 2: Modell einfügen** in `js/models.js`, nach `lampion()` (Ende des
      Dachblocks, vor der schliessenden Klammer von `FURN`), exakt so:

```js
  bar() { const g = G();
    /* Tresen mit Front nach +z, Rückbord mit Flaschen, zwei Hocker davor. */
    box(g, 1.50, 0.92, 0.50, MAT.wood, 0, 0.46, -0.25);
    box(g, 1.62, 0.08, 0.62, MAT.woodL, 0, 0.96, -0.25);
    box(g, 1.50, 0.05, 0.04, MAT.woodD, 0, 0.16, -0.02);
    [-0.45, 0.45].forEach(x => box(g, 0.50, 0.46, 0.03, MAT.woodD, x, 0.52, -0.005));
    [-0.62, 0.62].forEach(x => box(g, 0.07, 0.85, 0.22, MAT.woodD, x, 0.42, -0.62));
    [0.45, 0.78].forEach(y => box(g, 1.30, 0.05, 0.22, MAT.woodL, 0, y, -0.62));
    [[MAT.red, -0.30], [MAT.green2, -0.12], [MAT.blue, 0.06], [MAT.orange, 0.24]].forEach(([m, x]) => {
      cyl(g, 0.045, 0.05, 0.20, m, x, 0.58, -0.62, 10); cyl(g, 0.018, 0.018, 0.07, m, x, 0.71, -0.62, 8); });
    [-0.20, 0.10].forEach(x => cyl(g, 0.05, 0.035, 0.09, MAT.white, x, 0.86, -0.62, 10));
    [-0.42, 0.42].forEach(x => { cyl(g, 0.17, 0.17, 0.07, MAT.red, x, 0.66, 0.34, 14);
      cyl(g, 0.05, 0.06, 0.62, MAT.woodD, x, 0.31, 0.34, 10);
      cyl(g, 0.20, 0.20, 0.04, MAT.woodD, x, 0.02, 0.34, 14);
      const f = mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 14), MAT.grey, x, 0.22, 0.34, g); f.rotation.x = Math.PI / 2; });
    return g; },
```

- [ ] **Step 3: Katalogeintrag** ans Ende des `dach`-Blocks in `CATALOG`:

```js
  { id: 'bar', name: 'Bar', cat: 'dach' },
```

- [ ] **Step 4: Grün sehen.** `python3 tools/verify_katalog.py bar` im
      Vordergrund. Die Dachprüfung setzt per Speicherstand eine Bar auf
      `x = 3.1, z = 2.2` — also mitten in die Treppenöffnung — lädt neu und
      erwartet, dass `clampEntry` sie auf `z < 1.1` zurückschiebt und `x` auf
      dem Deck hält.
- [ ] **Step 5: Sichtprüfung.** Dachterrasse betreten, Bar platzieren, an die
      Treppenöffnung schieben und bestätigen, dass sie am Rand der Öffnung
      stehen bleibt und der Aufgang begehbar bleibt.

---

### Task 7: Gesamtlauf und Abnahme

**Files:** keine Codeänderung; nur Verifikation und, falls nötig, Nachschärfen
der vorherigen Tasks.

**Interfaces:** `python3 tools/verify_katalog.py` (ohne Argumente, alle sechs).

- [ ] **Step 1: Branch pushen.** Vor der Verifikation pushen, nicht danach
      (`CLAUDE.md:566-570`) — ein Lauf, der mitten im Check stirbt, darf die
      Arbeit nicht mitnehmen.
- [ ] **Step 2: Vollen Lauf fahren.** `python3 tools/verify_katalog.py` im
      Vordergrund, mit grosszügigem Timeout. Erwartet: „GRÜN — alle Prüfungen
      bestanden.", insbesondere die Reload-Prüfung über alle sechs ids und die
      leere Fehlerkonsole.
- [ ] **Step 3: Katalog-Sichtprüfung.** Spiel öffnen und Tab für Tab
      durchgehen: „Möbel" zeigt 8 Einträge (neu: Kommode), „Spass" 6 (neu:
      Ball, Kuscheltier, Tischkicker), „Wand" 7 (neu: Dartscheibe), „Dach" 5
      (neu: Bar). Jedes neue Objekt hat ein erkennbares Thumbnail und den
      richtigen Namen.
- [ ] **Step 4: Manuelle Checkliste** aus `CLAUDE.md:515-520` abarbeiten: Seite
      lädt mit leerer Konsole, erste Frame rendert, Eingaben reagieren,
      `localStorage`-Stand überlebt einen Reload.
- [ ] **Step 5: Abnahme gegen die Spec.** Jede Zeile der `## Acceptance
      Criteria` in
      `docs/ai-notes/specs/2026-09-13-katalog-mehr-objekte-design.md`
      einzeln abhaken; offene Punkte gehören zurück in den jeweiligen Task,
      nicht in eine Fussnote.
