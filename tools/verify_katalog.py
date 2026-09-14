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
    """Seedet localStorage nur bei der ersten Navigation dieser Page — ein
    add_init_script feuert sonst auch bei page.reload() erneut und würde den
    frisch gespeicherten Spielstand vor dem Persistenz-Check überschreiben.
    sessionStorage übersteht denselben Reload, ist aber pro Browserkontext
    (also pro Playwright-Page) isoliert."""
    st = dict(SEED)
    st["rooms"] = rooms or {}
    page.add_init_script(
        "if (!sessionStorage.getItem('kat_seeded')) { "
        "localStorage.setItem('wipfelkratzer-v1', " + json.dumps(json.dumps(st)) + "); "
        "sessionStorage.setItem('kat_seeded', '1'); }")


def open_game(page):
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer")
    page.click("#btn-start")


def add_item(page, k, tab, name):
    """Möbel über die echte UI hinzufügen: Etage betreten, Tab wählen, Karte klicken.
    enterEdit() ist ein No-op, solange schon editiert wird (js/game.js:659) — ohne das
    vorherige exitEdit() würden aufeinanderfolgende add_item()-Aufrufe für verschiedene
    Etagen/das Dach alle in der zuerst betretenen Etage landen."""
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
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
