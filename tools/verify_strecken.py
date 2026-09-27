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


def warte_ruhig(page):
    """Auf das ENDE der Aufpopp-Animation warten, nicht auf eine feste Zeit.
    Der headless-Renderer zeichnet weit unter 60 fps, die 0.35-s-Blende aus
    addItem dauert damit gut eine Sekunde — wer frueher misst, misst ein halb
    aufgepopptes Moebel (CLAUDE.md, «wait for arrival, not stillness»)."""
    page.wait_for_timeout(150)
    page.wait_for_function("() => window.wipfelkratzer.tweenCount() === 0", timeout=120000)


def add_item(page, k, tab, name):
    """Moebel ueber die echte UI hinzufuegen (wie tools/verify_katalog.py)."""
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.evaluate("k => window.wipfelkratzer.enterEdit(k)", k)
    page.click(f"#catalog-tabs button:text-is('{tab}')")
    page.click(f"#catalog-items .item:has(span:text-is('{name}'))")
    warte_ruhig(page)


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
