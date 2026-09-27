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


def pruefe_besuch(page):
    print("\n=== Name in der Besuchsleiste ===")
    page.evaluate("() => wipfelkratzer.enterBesuch(1)")
    page.wait_for_timeout(600)
    titel = page.inner_text("#besuch-titel")
    check("Musikzimmer" in titel, "Besuchsleiste zeigt den Namen", titel)
    check("1" in titel, "Besuchsleiste zeigt weiter die Nummer", titel)
    page.evaluate("() => wipfelkratzer.exitBesuch()")
    page.wait_for_timeout(600)


def raeume_toasts(page):
    """Ein Toast bleibt offen, bis er weggetippt wird (js/game.js:887), und
    liegt über dem Bewohner-Schild — er fängt sonst den Klick auf «Zu» ab."""
    page.evaluate("() => document.querySelectorAll('#toast-stack .toast-item').forEach(el => el.click())")
    page.wait_for_timeout(200)


def oeffne_schild(page):
    raeume_toasts(page)
    page.click("#btn-extras")
    page.wait_for_timeout(200)
    page.click("#btn-sign")
    page.wait_for_timeout(400)


def schliesse_schild(page):
    page.click("#btn-resclose")
    page.wait_for_timeout(300)


def pruefe_schild(page):
    print("\n=== Name auf dem Bewohner-Schild ===")
    oeffne_schild(page)
    zeilen = page.inner_text("#resident-list")
    check("Musikzimmer" in zeilen, "Bewohner-Schild zeigt den Namen")
    check("1" in zeilen, "Bewohner-Schild zeigt weiter die Nummer")
    schliesse_schild(page)


# 20 Zeichen, passt also unter die Kappung bei 24 — eine Nutzlast, die erst
# durch das Kürzen harmlos wird, würde nichts über die Ausgabe beweisen.
BOESE = "<svg onload=ggXss()>"


def pruefe_kein_html(page):
    print("\n=== Ein Name, der wie HTML aussieht, bleibt Text ===")
    page.evaluate("() => { window.__xss = undefined; window.ggXss = () => { window.__xss = 1; }; }")
    setze_namen(page, 1, BOESE)
    check(page.evaluate("() => wipfelkratzer.state.roomNames['1']") == BOESE,
          "Die Nutzlast wird ungekürzt gespeichert")
    oeffne_schild(page)
    check(page.evaluate("() => window.__xss === undefined"),
          "Bewohner-Schild: kein Skript ausgeführt")
    check(page.evaluate("() => document.querySelectorAll('#resident-list svg').length === 0"),
          "Bewohner-Schild: kein <svg> im Baum")
    check(BOESE in page.evaluate("() => document.getElementById('resident-list').textContent"),
          "Bewohner-Schild: der Text steht wörtlich da")
    schliesse_schild(page)

    page.evaluate("() => wipfelkratzer.enterBesuch(1)")
    page.wait_for_timeout(600)
    check(page.evaluate("() => document.querySelectorAll('#besuch-titel svg').length === 0"),
          "Besuchsleiste: kein <svg> im Baum")
    check(BOESE in page.evaluate("() => document.getElementById('besuch-titel').textContent"),
          "Besuchsleiste: der Text steht wörtlich da")
    page.evaluate("() => wipfelkratzer.exitBesuch()")
    page.wait_for_timeout(600)
    check(page.evaluate("() => window.__xss === undefined"), "Insgesamt kein Skript ausgeführt")

    # Wieder auf den gutartigen Namen, damit die späteren Prüfungen ihn finden.
    setze_namen(page, 1, "Musikzimmer")


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


# Die Dateiprüfung ist reine Logik — sie läuft im Browser über dasselbe Modul,
# das das Spiel auch lädt, statt über eine Nachbildung in Python.
DATEI_JS = """async () => {
  const m = await import('./js/standdatei.js');
  const roh = { maxFloors: 10, floors: 3, roomNames: {
    '1': '  Musikzimmer  ',
    '2': 'x'.repeat(40),
    '3': '',
    'kueche': 'Unbekannter Raum',
    'roof': 'Dachterrasse',
    '4': 42,
  } };
  return { v: m.DATEI_V, namen: m.bereinigeStand(roh).roomNames };
}"""

# Der echte Weg: sichern, wie «Meine Türme» es tut, und als neuen Turm wieder
# einlesen — bis in den localStorage des neuen Slots hinein.
RUNDREISE_JS = """async () => {
  const m = await import('./js/standdatei.js');
  const { text } = wipfelkratzer.standDatei(wipfelkratzer.stand, false);
  const geprueft = m.pruefeDatei(text);
  if (!geprueft.ok) return { ok: false, grund: geprueft.grund, namen: null, imSlot: null };
  const rein = wipfelkratzer.importiereText(text);
  let imSlot = null;
  if (rein.ok) {
    imSlot = JSON.parse(localStorage.getItem(rein.eintrag.standKey) || '{}').roomNames;
    wipfelkratzer.staende.loescheStand(rein.eintrag.id);
  }
  return { ok: true, grund: rein.ok ? '' : rein.grund,
           namen: geprueft.datei.stand.roomNames, imSlot };
}"""

# Eine Datei aus der Zeit vor diesem Vorhaben: kein roomNames, Version 2.
ALT_JS = """async () => {
  const m = await import('./js/standdatei.js');
  const alt = { typ: 'wipfelkratzer-stand', version: 2, name: 'Alter Turm',
    stand: { maxFloors: 10, floors: 2, nuts: 7, rooms: { '1': [] } } };
  const geprueft = m.pruefeDatei(JSON.stringify(alt));
  return { ok: geprueft.ok, grund: geprueft.grund || '',
           namen: geprueft.ok ? geprueft.datei.stand.roomNames : null,
           floors: geprueft.ok ? geprueft.datei.stand.floors : null };
}"""


def pruefe_datei(page):
    print("\n=== Turmdatei ===")
    out = page.evaluate(DATEI_JS)
    namen = out["namen"] or {}
    check(out["v"] == 2, "DATEI_V ist unverändert 2", str(out["v"]))
    check(namen.get("1") == "Musikzimmer", "Name wird getrimmt", repr(namen.get("1")))
    check(namen.get("2") == "x" * 24, "Name wird auf 24 Zeichen gekappt",
          str(len(namen.get("2") or "")))
    check("3" not in namen, "Leerer Name fällt weg")
    check("kueche" not in namen, "Unbekannter Raumschlüssel fällt weg")
    check(namen.get("roof") == "Dachterrasse", "Bekannter Raumschlüssel roof bleibt")
    check("4" not in namen, "Nicht-String fällt weg")

    rund = page.evaluate(RUNDREISE_JS)
    check(rund["ok"], "Gesicherter Turm lässt sich einlesen", rund["grund"])
    check((rund["namen"] or {}).get("1") == "Musikzimmer",
          "Der Name kommt durch Sichern und Einlesen", repr(rund["namen"]))
    check((rund["imSlot"] or {}).get("1") == "Musikzimmer",
          "Der eingelesene Turm hat den Namen im Spielstand",
          rund["grund"] or repr(rund["imSlot"]))

    alt = page.evaluate(ALT_JS)
    check(alt["ok"], "Ältere Datei ohne roomNames lädt weiter", alt["grund"])
    check(alt["floors"] == 2, "Ältere Datei behält ihre Stockwerke", str(alt["floors"]))
    check(alt["namen"] == {}, "Ältere Datei bekommt ein leeres roomNames",
          repr(alt["namen"]))


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
            pruefe_besuch(page)
            pruefe_schild(page)
            pruefe_kein_html(page)
            pruefe_datei(page)
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
