#!/usr/bin/env python3
"""Headless-Prüfung des Aquarell-Stils aus Issue #90.

Startet den statischen Server selbst und läuft komplett im Vordergrund —
siehe CLAUDE.md: "Run the verification in the foreground. Never
run_in_background."

    python3 tools/verify_stil.py
"""
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8124
URL = f"http://127.0.0.1:{PORT}/"

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


def open_game(page):
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer")
    page.click("#btn-start")
    page.wait_for_timeout(300)


FURN_CHECK_JS = """
async () => {
  const m = await import('/js/models.js');
  const bad = [];
  for (const c of m.CATALOG) {
    const g = m.makeFurniture(c.id);
    g.traverse(o => { if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(mt => { if (mt.type !== 'MeshLambertMaterial') bad.push([c.id, 'type', mt.type]);
                            if (mt.map) bad.push([c.id, 'map', true]); }); });
  }
  return bad;
}
"""

FRAME_TIME_JS = """
async (aquarell) => {
  window.wipfelkratzer.setStil(aquarell);
  await new Promise(r => setTimeout(r, 300));
  const times = [];
  await new Promise(resolve => {
    let last = performance.now(), n = 0;
    function frame(t) {
      times.push(t - last); last = t; n++;
      if (n >= 60) resolve(); else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  return times.reduce((a, b) => a + b, 0) / times.length;
}
"""


def run():
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

            open_game(page)

            # --- 1. Knopf kippt die Uniform, Beschriftung folgt -------------
            print("[Umschalter]")
            v0 = page.evaluate("() => window.wipfelkratzer.STYLE.aquarell.value")
            check(v0 == 0, f"Start: aquarell == 0 (ist {v0})")
            label0 = page.evaluate("() => document.getElementById('btn-stil').textContent")
            check(label0 == "Aquarell", f"Start: Beschriftung 'Aquarell' (ist {label0!r})")
            page.click("#btn-stil")
            page.wait_for_timeout(200)
            v1 = page.evaluate("() => window.wipfelkratzer.STYLE.aquarell.value")
            check(v1 == 1, f"Nach Klick: aquarell == 1 (ist {v1})")
            label1 = page.evaluate("() => document.getElementById('btn-stil').textContent")
            check(label1 == "Bilderbuch", f"Nach Klick: Beschriftung 'Bilderbuch' (ist {label1!r})")

            # --- 2. matCount() unverändert -----------------------------------
            print("[Materialzahl]")
            mc1 = page.evaluate("() => window.wipfelkratzer.matCount()")
            page.click("#btn-stil")
            page.wait_for_timeout(200)
            mc0 = page.evaluate("() => window.wipfelkratzer.matCount()")
            check(mc0 == mc1, f"matCount() unverändert ({mc1} vs {mc0})")

            # --- 3. Möbelmaterial bleibt MeshLambertMaterial ohne map --------
            print("[Möbelmaterial]")
            bad0 = page.evaluate(FURN_CHECK_JS)
            check(not bad0, f"aquarell=0: kein abweichendes Möbelmaterial ({bad0[:5]})")
            page.evaluate("() => window.wipfelkratzer.setStil(1)")
            bad1 = page.evaluate(FURN_CHECK_JS)
            check(not bad1, f"aquarell=1: kein abweichendes Möbelmaterial ({bad1[:5]})")

            # --- 4. Farben nach Rückschalten identisch (Hex) ------------------
            print("[Farbtreue]")
            page.evaluate("() => window.wipfelkratzer.setStil(0)")
            page.wait_for_timeout(150)
            snap_js = """() => { const w = window.wipfelkratzer;
                const mat = {}; Object.entries(w.MAT).forEach(([k, m]) => mat[k] = m.color.getHexString());
                return { bg: w.scene.background.getHexString(), fog: w.scene.fog.color.getHexString(), mat }; }"""
            before = page.evaluate(snap_js)
            page.evaluate("() => window.wipfelkratzer.setStil(1)")
            page.wait_for_timeout(150)
            page.evaluate("() => window.wipfelkratzer.setStil(0)")
            page.wait_for_timeout(150)
            after = page.evaluate(snap_js)
            check(before["bg"] == after["bg"], f"scene.background identisch ({before['bg']} vs {after['bg']})")
            check(before["fog"] == after["fog"], f"scene.fog.color identisch ({before['fog']} vs {after['fog']})")
            matdiff = {k: (v, after["mat"].get(k)) for k, v in before["mat"].items() if after["mat"].get(k) != v}
            check(not matdiff, f"MAT-Farben identisch ({matdiff})")

            # --- 5. Besuchsmodus: Kontur folgt Fenstertausch ------------------
            print("[Besuchsmodus]")
            page.evaluate("() => window.wipfelkratzer.setStil(1)")
            page.evaluate("() => window.wipfelkratzer.enterBesuch(0)")
            page.wait_for_timeout(300)
            geo_offen = page.evaluate("""() => { const w = window.wipfelkratzer;
                const g = w.floorGroups[0]; const kern = g.userData.frontKern, panel = g.userData.wallPanels.front;
                const hk = w.hullOf(kern), hp = w.hullOf(panel);
                return hk && hp && hk.geometry === g.userData.fensterGeo.kernOffen
                    && hp.geometry === g.userData.fensterGeo.panelOffen; }""")
            check(geo_offen, "fensterAuf: Kontur referenziert kernOffen/panelOffen")
            page.evaluate("() => window.wipfelkratzer.exitBesuch()")
            page.wait_for_timeout(300)
            geo_zu = page.evaluate("""() => { const w = window.wipfelkratzer;
                const g = w.floorGroups[0]; const kern = g.userData.frontKern, panel = g.userData.wallPanels.front;
                const hk = w.hullOf(kern), hp = w.hullOf(panel);
                return hk && hp && hk.geometry === g.userData.fensterGeo.kernZu
                    && hp.geometry === g.userData.fensterGeo.panelZu; }""")
            check(geo_zu, "fensterZu: Kontur referenziert kernZu/panelZu")
            page.evaluate("() => window.wipfelkratzer.setStil(0)")

            # --- 6. Reload behält den Stil, Spielstand ohne 'stil' -----------
            print("[Persistenz]")
            page.evaluate("() => window.wipfelkratzer.setStil(1)")
            page.wait_for_timeout(150)
            ls_stil = page.evaluate("() => localStorage.getItem('wipfelkratzer-stil')")
            check(ls_stil == "aquarell", f"localStorage['wipfelkratzer-stil'] == 'aquarell' (ist {ls_stil!r})")
            page.reload(wait_until="networkidle")
            page.wait_for_function("() => !!window.wipfelkratzer")
            page.wait_for_timeout(300)
            v_reload = page.evaluate("() => window.wipfelkratzer.STYLE.aquarell.value")
            check(v_reload == 1, f"Nach Reload: aquarell == 1 (ist {v_reload})")
            save_json = page.evaluate("() => localStorage.getItem('wipfelkratzer-v1') || ''")
            check('"stil"' not in save_json, "Spielstand (wipfelkratzer-v1) enthält kein 'stil'")
            for k in page.evaluate("() => Object.keys(localStorage)"):
                if k.startswith("wipfelkratzer-stand-"):
                    val = page.evaluate("k => localStorage.getItem(k)", k)
                    check('"stil"' not in (val or ''), f"{k} enthält kein 'stil'")
            page.evaluate("() => window.wipfelkratzer.setStil(0)")

            # --- 7. Frame-Zeit: Aquarell <= 1.4x Bilderbuch (10 Stockwerke) --
            print("[Frame-Zeit, Zehnstöcker]")
            page.evaluate("() => { window.wipfelkratzer.state.floors = 10; }")
            for i in range(1, 11):
                page.evaluate("i => window.wipfelkratzer.floorGroup(i)", i)
            page.wait_for_timeout(300)
            t_buch = page.evaluate(FRAME_TIME_JS, 0)
            t_aq = page.evaluate(FRAME_TIME_JS, 1)
            page.evaluate("() => window.wipfelkratzer.setStil(0)")
            print(f"  Bilderbuch: {t_buch:.2f} ms/Frame, Aquarell: {t_aq:.2f} ms/Frame")
            check(t_aq <= t_buch * 1.4 + 0.05,
                  f"Aquarell-Frame-Zeit <= 1.4x Bilderbuch ({t_aq:.2f} vs {t_buch:.2f} ms)")

            # --- 8. Konsole ----------------------------------------------------
            print("[Konsole]")
            check(not errors, f"keine Konsolenfehler ({errors[:5]})")
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
    sys.exit(run())
