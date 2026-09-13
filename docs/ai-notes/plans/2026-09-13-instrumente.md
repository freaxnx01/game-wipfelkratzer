# Plan: Instrumente als Möbel — Blockflöte, Harfe, Schlagzeug (Issue #36)

**Goal:** Drei neue Instrumente im Katalog-Tab «Spass» — `blockfloete`,
`harfe`, `schlagzeug` — als klobige Primitiv-Modelle im Bilderbuch-Stil des
Spiels. Kein Klang, keine neue Interaktion (das gehört zu Issue #41).

**Architecture:** Rein additive Erweiterung zweier bestehender Register. In
`js/models.js` kommen drei Bau-Funktionen zu `FURN` (`js/models.js:65-256`)
und drei Zeilen zu `CATALOG` (`js/models.js:251-270`); `makeFurniture`
(`js/models.js:309`), die Thumbnail-Erzeugung (`js/game.js:541`) und die
Katalog-Kacheln (`js/game.js:597-601`) greifen automatisch. In `js/game.js`
wird genau eine Zeile geändert: `blockfloete` kommt in das `DECO`-Set
(`js/game.js:366`), damit die winzige Flöte auf Tisch/Regal/Schrank steht
statt eine ganze Zelle zu belegen. Keine Datenformat-Änderung, keine
Migration, kein neuer Tab in `CATS` (`js/models.js:271`).

**Spec:** `docs/ai-notes/specs/2026-09-13-instrumente-design.md`

## Global Constraints

- **Nur `MeshLambertMaterial` über `MAT`** (`js/models.js:4-12`). Kein neues
  `L(0x...)`, keine neue Farbe, keine Textur, kein importiertes Mesh.
- **Nur die vorhandenen Helfer** `box`/`cyl`/`sph`/`mesh`
  (`js/models.js:14-20`) plus `THREE.TorusGeometry`, das in `FURN` bereits
  benutzt wird (`js/models.js:121`, `js/models.js:176`).
- **Masse (Spec A6):** Bodenmöbel ≤ 0.90 breit, ≤ 1.30 hoch. Grund: schmalste
  Zelle im Turm ist 0.95 (`js/game.js:358-362`), Deckenunterkante 1.82
  (`js/game.js:270`, `js/game.js:6`).
- **Kein Klang, kein Vorbau dafür** (Spec A4/A5). Weder `sfx`-Aufrufe noch
  `userData.sound`, weder in `js/models.js` noch in `js/game.js`.
- **Nichts Bestehendes anfassen.** Keine bestehende `FURN`-Funktion, kein
  bestehender `CATALOG`-Eintrag, `CATS` unverändert, `TENANTS`
  (`js/game.js:19-30`) unverändert.
- **Kein `version.js`-Bump, keine Hand-Änderung an `CHANGELOG.md`**
  (Spec A9). Commit-Typ: `feat(katalog): …`.
- **Verifikation läuft im Vordergrund. Niemals `run_in_background`.** Das
  steht so in `CLAUDE.md:550-566`; ein Lauf (Issue #11) ist genau daran
  gescheitert: 59 von 80 Turns verplempert, Meldung «success», nichts
  gepusht. Dem Vordergrund-Aufruf ein grosszügiges `timeout` geben und ihn
  blockieren lassen — Blockieren ist der Sinn der Sache.
- **Branch committen und pushen, bevor die Verifikation startet**
  (`CLAUDE.md:568-570`), damit ein abgebrochener Lauf die Arbeit nicht
  mitnimmt.
- Deutsche Texte mit echten Umlauten (ä ö ü), `ss` statt `ß`.

---

### Task 1: Verifikationsskript schreiben (läuft zuerst, schlägt fehl)

Dieses Repo hat keine Unit-Test-Suite. Geprüft wird headless mit Playwright
gegen die echte Seite, über einen lokalen HTTP-Server (das Spiel ist ein
ES-Modul mit Importmap, `index.html:10-24` — `file://` funktioniert nicht).
Das Skript entsteht **vor** dem Modellcode und muss beim ersten Lauf an
`FURN.harfe is not a function` scheitern. Genau das ist der rote Test.

**Files:**
- `/tmp/verify_instrumente.py` (Wegwerf-Skript, **nicht** committen — das Repo
  hat kein `scripts/`-Verzeichnis und soll keins bekommen)

**Interfaces:**
- `window.wipfelkratzer` (`js/game.js:1188`) — liefert `state`,
  `floorGroups`, `enterEdit`, `exitEdit`, `dims`, `cellPos`, `edit`.
- Dynamischer Import im Seitenkontext: `await import('/js/models.js')` und
  `await import('three')` — die Importmap aus `index.html:10-24` gilt auch
  für dynamische Importe, damit sind `FURN`-Ergebnisse über `makeFurniture`
  und `THREE.Box3` im Browser messbar, ohne irgendetwas zusätzlich auf
  `window` zu exportieren.
- Katalog-Kacheln: `#catalog-items .item` mit `<span>`-Namen
  (`js/game.js:597-601`), Tabs: `#catalog-tabs button` (`js/game.js:556-558`).

**Steps:**

- [ ] **Step 1: Skript anlegen.** Inhalt exakt so (Pfad zum Repo-Root wird
      als `argv[1]` übergeben, damit das Skript aus jedem Verzeichnis läuft):

```python
#!/usr/bin/env python3
"""Headless-Verifikation für Issue #36 (Instrumente). Immer im Vordergrund laufen lassen."""
import functools, http.server, json, pathlib, socketserver, sys, threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
SHOTS = pathlib.Path("/tmp/instrumente-shots")
SHOTS.mkdir(exist_ok=True)

PORT = None
for candidate in range(8951, 8956):
    try:
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
        httpd = socketserver.TCPServer(("127.0.0.1", candidate), handler)
        PORT = candidate
        break
    except OSError:
        continue
assert PORT, "kein freier Port im Bereich 8951-8955"
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/"

# Spielstand im Format aus js/game.js:31-40. Etage 1 ist eingerichtet, damit
# die Flöte eine Ablage (tisch) vorfindet und ein Klavier zum Stilvergleich
# danebensteht.
SEED = {
    "floors": 3, "nuts": 999, "bridge": False, "garden": False, "night": False,
    "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
    "rooms": {"1": [
        {"id": "klavier", "cell": 0, "x": -1.9, "z": -1.0, "rot": 0},
        {"id": "harfe", "cell": 1, "x": -0.9, "z": -1.0, "rot": 0},
        {"id": "schlagzeug", "cell": 2, "x": 0.2, "z": -1.0, "rot": 0},
        {"id": "tisch", "cell": 3, "x": 1.4, "z": -1.0, "rot": 0},
        {"id": "blockfloete", "cell": 3, "x": 1.4, "z": -1.0, "rot": 0},
    ]},
}

MAXW, MAXH = 0.90, 1.30
fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" else None)

    page.goto(BASE, wait_until="networkidle")
    page.evaluate("s => localStorage.setItem('wipfelkratzer-v1', s)", json.dumps(SEED))
    page.reload(wait_until="networkidle")
    page.click("#btn-start")
    page.wait_for_timeout(600)

    # --- 1. Modelle bauen und vermessen (AC: Masse, Bodenkontakt) ---
    measured = page.evaluate("""async () => {
      const M = await import('/js/models.js');
      const THREE = await import('three');
      const out = {};
      for (const id of ['blockfloete', 'harfe', 'schlagzeug']) {
        const g = M.makeFurniture(id);
        const bb = new THREE.Box3().setFromObject(g);
        const s = bb.getSize(new THREE.Vector3());
        let mats = 0, lambert = 0;
        g.traverse(o => { if (o.isMesh) { mats++; if (o.material.type === 'MeshLambertMaterial') lambert++; } });
        out[id] = { w: s.x, h: s.y, d: s.z, minY: bb.min.y, meshes: mats, lambert };
      }
      return out;
    }""")
    print(json.dumps(measured, indent=2))
    for iid, m in measured.items():
        check(m["meshes"] > 0, f"{iid}: hat Meshes")
        check(m["meshes"] == m["lambert"], f"{iid}: ausschliesslich MeshLambertMaterial")
        check(-0.01 <= m["minY"] <= 0.02, f"{iid}: steht auf y=0 (minY={m['minY']:.3f})")
    check(measured["harfe"]["w"] <= MAXW, "harfe: Breite <= 0.90")
    check(measured["harfe"]["h"] <= MAXH, "harfe: Höhe <= 1.30")
    check(measured["schlagzeug"]["w"] <= MAXW, "schlagzeug: Breite <= 0.90")
    check(measured["schlagzeug"]["h"] <= MAXH, "schlagzeug: Höhe <= 1.30")
    check(measured["blockfloete"]["w"] <= 0.25, "blockfloete: Breite <= 0.25")
    check(measured["blockfloete"]["h"] <= 0.50, "blockfloete: Höhe <= 0.50")

    # --- 2. Katalog-Verdrahtung (AC: CATALOG, CATS, Tab «Spass») ---
    wiring = page.evaluate("""async () => {
      const M = await import('/js/models.js');
      const want = ['blockfloete', 'harfe', 'schlagzeug'];
      return {
        entries: M.CATALOG.filter(i => want.includes(i.id)),
        cats: M.CATS.map(c => c[0]),
        spass: M.CATALOG.filter(i => i.cat === 'spass').map(i => i.id),
      };
    }""")
    print(json.dumps(wiring, indent=2, ensure_ascii=False))
    check(len(wiring["entries"]) == 3, "CATALOG: alle drei Einträge vorhanden")
    check(all(e["cat"] == "spass" for e in wiring["entries"]), "CATALOG: alle im Tab spass")
    check(sorted(e["name"] for e in wiring["entries"]) ==
          sorted(["Blockflöte", "Harfe", "Schlagzeug"]), "CATALOG: Namen mit Umlaut")
    check(wiring["cats"] == ["mobel", "gemut", "deko", "wand", "spass", "farbe", "boden", "dach"],
          "CATS unverändert (kein neuer Tab)")
    check(len(wiring["spass"]) == 6, "Tab spass hat 6 Einträge")

    # --- 3. Spielstand geladen: alle vier Objekte stehen in Etage 1 ---
    placed = page.evaluate("""() => {
      const g = window.wipfelkratzer.floorGroups[1];
      return g.children.filter(c => c.userData && c.userData.itemId).map(c => ({
        id: c.userData.itemId, x: c.position.x, y: c.position.y, z: c.position.z }));
    }""")
    print(json.dumps(placed, indent=2))
    ids = [o["id"] for o in placed]
    for iid in ["blockfloete", "harfe", "schlagzeug"]:
        check(iid in ids, f"{iid}: aus dem Spielstand wiederhergestellt")

    # --- 4. Grenzen: nichts ragt aus dem Raum (clampEntry, js/game.js:427-446) ---
    inside = page.evaluate("""async () => {
      const THREE = await import('three');
      const W = 7.6, D = 5.0;   /* W(1)/D(1), js/game.js:7-8 */
      const g = window.wipfelkratzer.floorGroups[1];
      const bad = [];
      g.children.filter(c => c.userData && c.userData.itemId).forEach(c => {
        const bb = new THREE.Box3().setFromObject(c);
        const p = g.worldToLocal.bind(g);
        const lo = p(new THREE.Vector3(bb.min.x, 0, bb.min.z));
        const hi = p(new THREE.Vector3(bb.max.x, 0, bb.max.z));
        if (Math.min(lo.x, hi.x) < -W / 2 || Math.max(lo.x, hi.x) > W / 2 ||
            Math.min(lo.z, hi.z) < -D / 2 || Math.max(lo.z, hi.z) > D / 2)
          bad.push(c.userData.itemId);
      });
      return bad;
    }""")
    check(inside == [], f"alle Objekte innerhalb der Raumgrenzen (aussen: {inside})")

    # --- 5. Katalog-Bedienung: Tab öffnen, drei Kacheln klicken ---
    page.evaluate("() => window.wipfelkratzer.enterEdit(2)")
    page.wait_for_timeout(400)
    page.click("#catalog-tabs button:text-is('Spass')")
    page.wait_for_timeout(200)
    tiles = page.locator("#catalog-items .item")
    check(tiles.count() == 6, f"Tab Spass zeigt 6 Kacheln (sind {tiles.count()})")
    empty_thumbs = page.evaluate(
        "() => [...document.querySelectorAll('#catalog-items .item img')]"
        ".filter(i => !i.src || i.src.length < 100).length")
    check(empty_thumbs == 0, "alle Thumbnails gerendert")

    # Erst einen Tisch als Ablage, dann die Flöte darauf.
    page.click("#catalog-tabs button:text-is('Möbel')")
    page.click("#catalog-items .item:has(span:text-is('Tisch'))")
    page.wait_for_timeout(400)
    page.click("#catalog-tabs button:text-is('Spass')")
    for name in ["Harfe", "Schlagzeug", "Blockflöte"]:
        page.click(f"#catalog-items .item:has(span:text-is('{name}'))")
        page.wait_for_timeout(400)

    room2 = page.evaluate("() => window.wipfelkratzer.state.rooms['2']")
    print(json.dumps(room2, indent=2, ensure_ascii=False))
    added = [e["id"] for e in room2]
    for iid in ["harfe", "schlagzeug", "blockfloete"]:
        check(iid in added, f"{iid}: per Katalog-Klick hinzugefügt")
    floete = next((e for e in room2 if e["id"] == "blockfloete"), None)
    check(floete is not None and floete["y"] > 0.2,
          f"blockfloete liegt auf einer Ablage (y={floete and floete.get('y')})")

    # --- 6. Reload-Persistenz ---
    page.reload(wait_until="networkidle")
    page.click("#btn-start")
    page.wait_for_timeout(600)
    after = page.evaluate(
        "() => (window.wipfelkratzer.state.rooms['2'] || []).map(e => e.id)")
    for iid in ["harfe", "schlagzeug", "blockfloete"]:
        check(iid in after, f"{iid}: überlebt den Reload")

    # --- 7. Screenshots aus zwei Blickwinkeln ---
    page.evaluate("() => window.wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(1400)
    page.screenshot(path=str(SHOTS / "etage1-front.png"))
    page.evaluate("""() => { const w = window.wipfelkratzer;
      w.camera.position.set(4.2, 4.6, 6.2); w.camera.lookAt(0, 3.2, 0); }""")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "etage1-schraeg.png"))

    check(errors == [], f"keine Konsolen- und Seitenfehler ({errors[:5]})")
    browser.close()

httpd.shutdown()
print("\nScreenshots:", SHOTS)
if fails:
    print("\nFEHLGESCHLAGEN:")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("\nAlles grün.")
```

- [ ] **Step 2: Roten Lauf erzwingen.** Im Vordergrund, mit grosszügigem
      Timeout:
      `python3 /tmp/verify_instrumente.py /home/.../game-wipfelkratzer`

      verify: Der Lauf bricht ab oder meldet `FAIL` — erwartet ist ein
      Fehler in Schritt 1 (`M.makeFurniture('blockfloete')` läuft in
      `FURN[id] is not a function`). Wenn dieser Lauf **grün** ist, stimmt
      etwas mit dem Skript nicht (falsche Datei, Prüfungen greifen nicht) —
      dann erst das Skript reparieren, nicht weitergehen.

- [ ] **Step 3: Playwright sicherstellen.** Falls der Import scheitert:
      `pip install playwright && playwright install chromium` — ebenfalls im
      Vordergrund (`CLAUDE.md:529-533`).

---

### Task 2: Die drei Modelle in `FURN` bauen

**Files:**
- `js/models.js` — drei neue Funktionen im `FURN`-Objekt, direkt **nach**
  `klavier()` (endet `js/models.js:150`) und **vor** `nusskiste()`, damit die
  Instrumente im Quelltext beisammenstehen.

**Interfaces:**
- `box(g, w, h, d, mat, x, y, z)` (`js/models.js:18`)
- `cyl(g, rt, rb, h, mat, x, y, z, seg)` (`js/models.js:19`)
- `sph(g, r, mat, x, y, z, sx, sy, sz)` (`js/models.js:20`)
- `mesh(geo, mat, x, y, z, g)` (`js/models.js:14-17`)
- `G()` (`js/models.js:21`), `MAT` (`js/models.js:4-12`)

**Steps:**

- [ ] **Step 1: `harfe()` einfügen.** Der Code exakt so — das Seitenprofil
      liegt in der x-y-Ebene, die lokalen Helfer `bar`/`lerp` folgen dem
      Muster aus `liegestuhl()` (`js/models.js:231-249`):

```javascript
  /* Instrumente */
  harfe() { const g = G();
    /* Seitenprofil in der x-y-Ebene: Säule vorne senkrecht, Resonanzkörper schräg
       nach hinten-unten, Hals dazwischen, Saiten spannen als Fächer darüber.
       bar() spannt einen Quader von Punkt a nach Punkt b (beide [x, y]). */
    const bar = (a, b, w, d, mat, ext = 0) => { const dx = b[0] - a[0], dy = b[1] - a[1];
      const m = box(g, w, Math.hypot(dx, dy) + ext, d, mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
      m.rotation.z = -Math.atan2(dx, dy); return m; };
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    box(g, 0.44, 0.08, 0.28, MAT.woodD, 0, 0.04);
    cyl(g, 0.045, 0.05, 1.12, MAT.wood, 0.22, 0.64, 0, 10);
    bar([-0.18, 0.08], [0.05, 0.95], 0.15, 0.22, MAT.woodL, 0.06);
    bar([-0.16, 0.10], [0.06, 0.93], 0.03, 0.16, MAT.woodD);
    bar([0.06, 0.97], [0.22, 1.15], 0.10, 0.16, MAT.woodD, 0.05);
    sph(g, 0.06, MAT.gold, 0.22, 1.20, 0);
    for (let i = 0; i < 7; i++) { const t = i / 6;
      bar(lerp([-0.09, 0.36], [0.03, 0.82], t), lerp([0.07, 0.99], [0.21, 1.14], t), 0.014, 0.014, MAT.gold); }
    return g; },
```

      verify: `Box3` liefert ca. 0.50 × 0.28 × 1.26 (b × t × h), `minY ≈ 0`.
      Das prüft Task 1 Schritt 1 automatisch.

- [ ] **Step 2: `schlagzeug()` einfügen.** Kompaktes Kinder-Set, Breite
      bewusst unter 0.90 (Spec A6):

```javascript
  schlagzeug() { const g = G();
    /* Kompaktes Set: grosse Trommel liegend (Achse entlang z), Tom obenauf,
       Snare rechts und Becken links auf dünnen Ständern. Die Gesamtbreite
       bleibt unter der schmalsten Zellenbreite (~0.95, js/game.js:358-362). */
    cyl(g, 0.26, 0.26, 0.24, MAT.red, 0, 0.28, 0, 20).rotation.x = Math.PI / 2;
    [-0.12, 0.12].forEach(z => {
      cyl(g, 0.235, 0.235, 0.02, MAT.cream, 0, 0.28, z, 20).rotation.x = Math.PI / 2;
      mesh(new THREE.TorusGeometry(0.26, 0.016, 8, 20), MAT.gold, 0, 0.28, z, g); });
    [-0.19, 0.19].forEach(x => box(g, 0.05, 0.08, 0.3, MAT.black, x, 0.04, 0));
    cyl(g, 0.12, 0.12, 0.15, MAT.red, -0.02, 0.62, 0, 16);
    cyl(g, 0.125, 0.125, 0.02, MAT.cream, -0.02, 0.70, 0, 16);
    mesh(new THREE.TorusGeometry(0.125, 0.014, 8, 16), MAT.gold, -0.02, 0.70, 0, g).rotation.x = -Math.PI / 2;
    cyl(g, 0.14, 0.14, 0.11, MAT.white, 0.30, 0.44, 0.08, 16);
    cyl(g, 0.145, 0.145, 0.02, MAT.cream, 0.30, 0.50, 0.08, 16);
    for (let i = 0; i < 3; i++) { const a = i * 2.094;
      const l = cyl(g, 0.014, 0.014, 0.44, MAT.grey, 0.30 + Math.sin(a) * 0.06, 0.21, 0.08 + Math.cos(a) * 0.06, 6);
      l.rotation.set(Math.cos(a) * 0.26, 0, -Math.sin(a) * 0.26); }
    cyl(g, 0.015, 0.015, 0.64, MAT.grey, -0.30, 0.32, 0.05, 6);
    cyl(g, 0.15, 0.15, 0.012, MAT.gold, -0.30, 0.66, 0.05, 20).rotation.z = 0.22;
    sph(g, 0.035, MAT.gold, -0.30, 0.68, 0.05);
    [-0.07, 0.07].forEach(d => { const s = cyl(g, 0.012, 0.016, 0.32, MAT.woodL, 0.04 + d, 0.30, 0.20, 6);
      s.rotation.set(-1.15, 0, d * 3); });
    return g; },
```

      verify: `Box3` ≤ 0.90 breit, ≤ 0.75 hoch, `minY ≈ 0`. Sollte die
      gemessene Breite die Grenze reissen, Becken- und Snare-x (−0.30 / +0.30)
      zusammenrücken — nicht die Radien schrumpfen, sonst zerfällt die Form.

- [ ] **Step 3: `blockfloete()` einfügen.** Senkrecht in einem kleinen
      Ständer, damit sie auch ohne Ablage nicht wie ein verlorener Stift
      wirkt:

```javascript
  blockfloete() { const g = G();
    cyl(g, 0.07, 0.085, 0.025, MAT.woodL, 0, 0.012, 0, 12);
    cyl(g, 0.026, 0.026, 0.03, MAT.woodD, 0, 0.04, 0, 10);
    cyl(g, 0.017, 0.020, 0.30, MAT.cream, 0, 0.20, 0, 10);
    cyl(g, 0.024, 0.019, 0.05, MAT.woodD, 0, 0.37, 0, 10);
    for (let i = 0; i < 5; i++) sph(g, 0.008, MAT.black, 0, 0.14 + i * 0.042, 0.016);
    return g; },
```

      verify: `Box3` ≈ 0.17 × 0.17 × 0.40, `minY ≈ 0`.

- [ ] **Step 4: Stil-Kontrolle von Hand.**

      verify: `grep -n "L(0x" js/models.js` zeigt genau dieselben Treffer wie
      vor der Änderung (`git diff` darf keine neue `L(...)`-Zeile enthalten);
      `git diff js/models.js` enthält ausser `TorusGeometry` keinen neuen
      direkten `new THREE.`-Aufruf und keinen neuen `import`.

---

### Task 3: Katalog-Verdrahtung

**Files:**
- `js/models.js` — `CATALOG` (`js/models.js:251-270`)
- `js/game.js` — `DECO` (`js/game.js:366`)

**Interfaces:**
- `CATALOG`-Eintrag: `{ id, name, cat }`
- `DECO: Set<string>` — steuert Ablage-Verhalten (`js/game.js:696-702`),
  Zellen-Belegung (`js/game.js:466-468`) und Stapelhöhe
  (`js/game.js:415-425`).

**Steps:**

- [ ] **Step 1: Drei `CATALOG`-Zeilen ergänzen**, direkt nach der
      `nusskiste`-Zeile (`js/models.js:261`), damit die «Spass»-Gruppe
      zusammenbleibt:

```javascript
  { id: 'blockfloete', name: 'Blockflöte', cat: 'spass' }, { id: 'harfe', name: 'Harfe', cat: 'spass' },
  { id: 'schlagzeug', name: 'Schlagzeug', cat: 'spass' },
```

      verify: `CATS` (`js/models.js:271`) bleibt Zeichen für Zeichen gleich —
      kein neuer Tab (Spec A3).

- [ ] **Step 2: `blockfloete` in `DECO` aufnehmen** (`js/game.js:366`):

```javascript
const DECO = new Set(['vase', 'teekanne', 'kerze', 'buecher', 'nussschale', 'blockfloete']);
```

      verify: `SURFACES` (`js/game.js:426`) bleibt unverändert — die Flöte ist
      Ablagegut, keine Ablage. `WALL_ITEMS` (`js/models.js:272`) bleibt
      ebenfalls unverändert.

- [ ] **Step 3: Gegenprobe, dass nichts Weiteres angefasst wurde.**

      verify: `git diff --stat` zeigt genau zwei geänderte Dateien
      (`js/models.js`, `js/game.js`); `git diff js/game.js` ist eine einzige
      geänderte Zeile.

---

### Task 4: Verifikation grün fahren

**Files:**
- keine Produktivdateien; nur Ausführung von `/tmp/verify_instrumente.py`

**Interfaces:** siehe Task 1.

**Steps:**

- [ ] **Step 1: Branch committen und pushen** — *vor* dem Lauf
      (`CLAUDE.md:568-570`). Commit-Nachricht im Conventional-Commits-Format,
      z. B. `feat(katalog): Blockflöte, Harfe und Schlagzeug ergänzen`.

- [ ] **Step 2: Skript im Vordergrund laufen lassen**, mit grosszügigem
      Timeout (der erste Lauf lädt three.js von unpkg und rendert 35
      Thumbnails, `js/game.js:541`):
      `python3 /tmp/verify_instrumente.py <repo-root>`

      **Niemals `run_in_background`.** Blockieren ist der Sinn der Sache
      (`CLAUDE.md:550-566`).

      verify: Exit-Code 0, jede Zeile beginnt mit `OK`, Schlusszeile
      `Alles grün.`

- [ ] **Step 3: Screenshots ansehen** (`/tmp/instrumente-shots/`).

      verify: Harfe, Schlagzeug und die Flöte auf dem Tisch stehen sichtbar in
      Etage 1; die Harfe zeigt ihren Saitenfächer zur Kamera; das Schlagzeug
      ragt nicht in das Nachbarmöbel; nichts schwebt und nichts steckt im
      Boden; die Farben liegen erkennbar in derselben warmen, entsättigten
      Palette wie das Klavier daneben.

- [ ] **Step 4: Wenn ein Mass reisst**, im Modellcode nachziehen (Task 2,
      jeweiliger `verify`-Hinweis) und Schritt 2 wiederholen — nicht die
      Grenzwerte im Skript aufweichen.

---

### Task 5: Regressionsdurchgang und Abschluss

**Files:**
- keine Änderungen erwartet; nur Prüfung

**Interfaces:** `window.wipfelkratzer` (`js/game.js:1188`), Spielstand-Schlüssel
`wipfelkratzer-v1` (`js/game.js:32`).

**Steps:**

- [ ] **Step 1: Alter Spielstand ohne Instrumente.** Denselben Lauf mit einem
      `SEED` ohne die drei neuen Ids wiederholen (einmalig von Hand, das
      Skript nimmt `SEED` als Konstante — für den Durchgang eine Kopie unter
      `/tmp/verify_alt.py` mit reduziertem `rooms` anlegen).

      verify: Spielstand lädt, keine Konsolenfehler, alle bisherigen Möbel
      stehen wie zuvor.

- [ ] **Step 2: Wunsch-Logik unberührt.** Im laufenden Spiel Etage 0
      einrichten und ein `klavier` setzen.

      verify: Die Kindergarten-Mäuse melden «Wunsch erfüllt» wie bisher
      (`js/game.js:770-780`, `TENANTS[0].wish === 'klavier'`,
      `js/game.js:20`) — die neuen Instrumente lösen keinen Wunsch aus
      (Spec A8).

- [ ] **Step 3: Kein Klang-Code eingeschleppt** (Spec A4/A5).

      verify: `grep -n "sfx\|userData.sound\|AudioContext" js/models.js` ist
      leer, und `git diff js/game.js` enthält keinen neuen `sfx`-Eintrag.

- [ ] **Step 4: Notiz für Issue #41.** Im PR-Text einen Satz hinterlassen:
      «Klang für Instrumente gehört zu #41 — dort sind `klavier`,
      `blockfloete`, `harfe`, `schlagzeug` der zustandslose Fall: Tipp → Ton,
      nichts in `state.rooms` zu speichern.» Kein Code, kein Label-Wechsel.

      verify: PR-Beschreibung enthält den Verweis auf #41 und auf die Spec.

- [ ] **Step 5: Wegwerf-Skripte aufräumen.**

      verify: `git status` zeigt keine neuen, unbeabsichtigten Dateien im
      Repo (`/tmp/verify_instrumente.py` und `/tmp/verify_alt.py` liegen
      ausserhalb).
