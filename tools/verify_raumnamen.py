#!/usr/bin/env python3
"""Headless-Prüfung der Wohnungsnamen aus Issue #103.

Startet den statischen Server selbst und läuft komplett im Vordergrund —
siehe CLAUDE.md: "Run the verification in the foreground. Never
run_in_background." Der Server wird über den eigenen Prozess-Handle beendet;
bleibt doch einmal einer liegen, hilft `fuser -k 8241/tcp` — niemals
`pkill -f`.

    python3 tools/verify_raumnamen.py
"""
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8241

failures = []


def check(ok, label, detail=""):
    print(("  OK   " if ok else "  FAIL ") + label + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(label + (f" [{detail}]" if detail else ""))


def wait_port(port, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def port_free(port):
    try:
        with socket.create_connection(("127.0.0.1", port), 0.4):
            return False
    except OSError:
        return True


def open_page(context, url):
    """Frische Seite im geteilten Kontext, Intro weggeklickt, Fehler gesammelt.

    Der Kontext wird geteilt, weil der localStorage an ihm hängt — mit
    browser.new_page() bekäme jede Seite einen eigenen und die Prüfung
    "Name überlebt das Neuladen" hätte nichts zu finden.
    """
    page = context.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url, wait_until="networkidle")
    # Der Intro-Dialog gilt Playwright wegen seiner Einblend-Animation nie als
    # "stabil"; force=True klickt ihn trotzdem weg (wie in verify_game_nav.py).
    page.click("#btn-start", force=True)
    page.wait_for_timeout(700)
    return page, errors


def schliesse(page):
    """Der Stand ist um 300 ms entprellt — vor dem Schliessen schreiben."""
    page.evaluate("() => wipfelkratzer.speichern()")
    page.close()


def baue_ein_stockwerk(page):
    """Stockwerk 1 über den echten Knopf bauen — der Bau dauert ~1.4 s."""
    page.click("#btn-build")
    page.wait_for_timeout(1800)


def setze_namen(page, k, name):
    """Namen so eintippen, wie das Kind es tut: Feld füllen, input-Ereignis."""
    page.evaluate(f"() => wipfelkratzer.enterEdit({k})")
    page.wait_for_timeout(300)
    page.fill("#edit-name", name)
    page.wait_for_timeout(500)
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def pruefe_feld(page):
    print("\n=== Namensfeld in der Einrichte-Leiste ===")
    baue_ein_stockwerk(page)
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)

    check(page.is_visible("#edit-name"), "Feld ist sichtbar")
    check(page.input_value("#edit-name") == "", "Feld ist anfangs leer")
    check(page.get_attribute("#edit-name", "placeholder") == "Wohnung anschreiben",
          "Platzhalter stimmt")
    check(page.get_attribute("#edit-name", "maxlength") == "24", "maxlength ist 24")
    check("1" in (page.inner_text("#edit-nr") or ""), "Nummer steht weiter da")

    page.fill("#edit-name", "Musikzimmer")
    page.wait_for_timeout(500)   # save() ist um 300 ms entprellt
    gespeichert = page.evaluate("() => wipfelkratzer.state.roomNames['1']")
    check(gespeichert == "Musikzimmer", "Name steht im Zustand", repr(gespeichert))

    # fill() setzt den Wert programmatisch und umgeht maxlength — genau
    # deshalb kappt setzeRaumName zusätzlich selbst.
    page.fill("#edit-name", "x" * 40)
    page.wait_for_timeout(500)
    lang = page.evaluate("() => wipfelkratzer.state.roomNames['1']")
    check(lang == "x" * 24, "Zu langer Name wird auf 24 Zeichen gekappt",
          str(len(lang or "")))

    page.fill("#edit-name", "   ")
    page.wait_for_timeout(500)
    leer = page.evaluate("() => '1' in wipfelkratzer.state.roomNames")
    check(leer is False, "Leerer Name löscht den Eintrag")

    page.fill("#edit-name", "Musikzimmer")
    page.wait_for_timeout(500)
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def pruefe_dach_und_spielplatz(page):
    print("\n=== Dach und Spielplatz haben kein Feld ===")
    for k, titel in [("roof", "Dachterrasse"), ("garten", "Spielplatz")]:
        page.evaluate(f"() => wipfelkratzer.enterEdit('{k}')")
        page.wait_for_timeout(300)
        check(page.is_hidden("#edit-name"), f"{titel}: Feld ist versteckt")
        check(titel in (page.inner_text("#edit-nr") or ""),
              f"{titel}: Aufschrift unverändert", page.inner_text("#edit-nr"))
        page.evaluate("() => wipfelkratzer.exitEdit()")
        page.wait_for_timeout(300)


def pruefe_tastatur(page):
    print("\n=== Tasten im Feld steuern das Spiel nicht ===")
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)
    # Ein Möbel hinstellen — addItem wählt es selbst aus, erst dann greift
    # der keydown-Handler überhaupt (js/game.js:2288).
    page.evaluate("() => wipfelkratzer.addItem('stuhl')")
    page.wait_for_timeout(600)
    vorher = page.evaluate("() => { const e = wipfelkratzer.roomOf(1)[0]; return e ? e.x : null; }")
    check(vorher is not None, "Möbel steht in der Wohnung", repr(vorher))
    page.click("#edit-name")
    page.keyboard.press("ArrowLeft")
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(400)
    nachher = page.evaluate("() => { const e = wipfelkratzer.roomOf(1)[0]; return e ? e.x : null; }")
    check(vorher is not None and vorher == nachher,
          "Pfeiltaste im Feld bewegt kein Möbel", f"{vorher} -> {nachher}")
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def pruefe_neuladen(page):
    print("\n=== Name überlebt das Neuladen ===")
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)
    wert = page.input_value("#edit-name")
    check(wert == "Musikzimmer", "Feld trägt den gespeicherten Namen", repr(wert))
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def main():
    if not port_free(PORT):
        print(f"Port {PORT} ist belegt — bitte freigeben (fuser -k {PORT}/tcp).")
        return 2
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{PORT}/"
    alle_fehler = []
    try:
        if not wait_port(PORT):
            print("Server kam nicht hoch.")
            return 2
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport={"width": 1280, "height": 900})

            page, errors = open_page(context, url)
            pruefe_feld(page)
            pruefe_dach_und_spielplatz(page)
            pruefe_tastatur(page)
            alle_fehler += errors
            schliesse(page)

            page, errors = open_page(context, url)
            pruefe_neuladen(page)
            alle_fehler += errors
            schliesse(page)

            context.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)

    print("\n=== Konsole ===")
    check(not alle_fehler, "Konsole ohne Fehler", "; ".join(alle_fehler[:3]))

    print()
    if failures:
        print(f"ROT — {len(failures)} Prüfung(en) fehlgeschlagen:")
        for f in failures:
            print("  - " + f)
        return 1
    print("GRÜN — alle Prüfungen bestanden.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
