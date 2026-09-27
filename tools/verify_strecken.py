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


def raeume_toasts(page):
    """Offene Meldungen wegtippen — sie liegen ueber der Auswahlleiste."""
    for _ in range(10):
        offen = page.locator(".toast-item")
        if not offen.count():
            return
        offen.first.click()


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


def teil2_bedienung(page):
    """Task 2: Knoepfe, Schritte, Grenzen, Kollision."""
    print("Teil 2 — Bedienung")
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
    warte_ruhig(page)
    nach1 = box1(0)
    check(abs(nach1["x"] - vorher["x"] * 1.25) < 0.02, "Ein Schritt macht den Tisch 1.25x lang")
    check(abs(nach1["y"] - vorher["y"]) < 0.01, "Die Höhe bleibt beim Dehnen gleich")

    page.click("#btn-kuerzer")
    page.click("#btn-kuerzer")
    warte_ruhig(page)
    nach2 = box1(0)
    check(abs(nach2["x"] - vorher["x"] * 0.75) < 0.02, "Zwei Schritte zurück ergeben 0.75x")

    # bis ans untere Ende der Liste
    page.click("#btn-kuerzer")
    warte_ruhig(page)
    check(page.is_disabled("#btn-kuerzer"), "Am unteren Ende ist «Kürzer» gesperrt")

    # zurueck auf 1 und ans obere Ende — entweder Liste zu Ende oder Raum zu klein
    for _ in range(6):
        if page.is_disabled("#btn-laenger"):
            break
        page.click("#btn-laenger")
        warte_ruhig(page)
    check(page.is_disabled("#btn-laenger"), "Am oberen Ende ist «Länger» gesperrt")
    grenze = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const en = w.roomOf(1)[0], m = w.modellMass(en), g = w.raumGrenzen(1);
      const d = w.dehnungOf(en);
      return Math.max(m.w * d.x, m.d * d.z) <= 2 * Math.min(g.x, g.z) + 0.001;
    }""")
    check(grenze, "Das gedehnte Möbel passt noch in den Raum")

    # Ein gedrehtes Moebel wird entlang seiner eigenen Laenge gedehnt (Spec E2)
    gedreht = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const en = w.roomOf(1)[0], m = w.itemMeshes[1][0];
      const d = w.dehnungOf(en);
      return { sx: m.scale.x, sz: m.scale.z, dx: d.x, dz: d.z };
    }""")
    page.click("#btn-rot")
    warte_ruhig(page)
    nach_dreh = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const en = w.roomOf(1)[0], m = w.itemMeshes[1][0];
      const d = w.dehnungOf(en);
      return { sx: m.scale.x, sz: m.scale.z, dx: d.x, dz: d.z, rot: en.rot };
    }""")
    check(nach_dreh["sx"] == gedreht["sx"] and nach_dreh["sz"] == gedreht["sz"],
          "Drehen laesst die lokalen Dehnfaktoren stehen (%s -> %s)" % (gedreht, nach_dreh))

    # Die Raumgrenze sperrt «Länger», BEVOR die Stufenliste zu Ende ist: das
    # Häuschen misst 2.4 in der Laenge, die Dachterrasse ist quer nur
    # 2 * (ROOF_D/2 - 0.1) = 4.6 tief — 2x (4.8) passt nicht mehr, 1.5x (3.6)
    # schon.
    add_item(page, "roof", "Dach", "Häuschen")
    page.evaluate("() => { const w = window.wipfelkratzer; const m = w.itemMeshes.roof.find(x => x.userData.pick.entry.id === 'terrassenhaus'); w.select(m.userData.pick); }")
    page.click("#btn-stretch")
    for _ in range(6):
        if page.is_disabled("#btn-laenger"):
            break
        page.click("#btn-laenger")
        warte_ruhig(page)
    stufe = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf('roof').find(e => e.id === 'terrassenhaus').dehnung)")
    check(page.is_disabled("#btn-laenger") and stufe == '{"x":1.5,"z":1}',
          "Kein Möbel ragt durch die Wand: «Länger» sperrt bei 1.5x (%s)" % stufe)

    # Wandobjekt ist nicht dehnbar
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
    add_item(page, 2, "Möbel", "Sofa")
    page.evaluate("() => window.wipfelkratzer.select(window.wipfelkratzer.itemMeshes[2][0].userData.pick)")
    page.click("#btn-stretch")
    page.click("#btn-laenger")
    warte_ruhig(page)
    page.click("#btn-color")
    page.click("#colorpick button:nth-child(2)")
    warte_ruhig(page)
    nach_farbe = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(2)[0].dehnung)")
    skala = page.evaluate("() => window.wipfelkratzer.itemMeshes[2][0].scale.x")
    check(nach_farbe == '{"x":1.25,"z":1}', "Umfärben lässt die Dehnung stehen (%s)" % nach_farbe)
    check(abs(skala - 1.25) < 0.02, "Auch das Mesh ist nach dem Umfärben noch gedehnt (%s)" % skala)


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
    if page.is_visible("#paste-add"):
        page.click("#paste-add")
    warte_ruhig(page)
    kopiert = page.evaluate("() => JSON.stringify(window.wipfelkratzer.roomOf(3)[0].dehnung)")
    check(kopiert == '{"x":1.25,"z":1}', "Raum einfügen überträgt die Dehnung (%s)" % kopiert)

    # Export -> Import durch die Positivliste von js/standdatei.js.
    # baueDatei({ name, bild, stand, fotos }) liefert ein Objekt, pruefeDatei(text)
    # gibt { ok, datei } zurueck — beides synchron (js/standdatei.js:41, :65).
    durchgereicht = page.evaluate("""async () => {
      const m = await import('/js/standdatei.js');
      const stand = JSON.parse(JSON.stringify(window.wipfelkratzer.state));
      const text = JSON.stringify(m.baueDatei({ name: 'Test', bild: null, stand, fotos: null }));
      const geprueft = m.pruefeDatei(text);
      if (!geprueft.ok) return 'nicht gelesen: ' + geprueft.grund;
      return JSON.stringify(geprueft.datei.stand.rooms['2'][0].dehnung);
    }""")
    check(durchgereicht == '{"x":1.25,"z":1}',
          "Export/Import erhält die Dehnung (%s)" % durchgereicht)

    # Ein erfundener Faktor faellt weg
    gefiltert = page.evaluate("""async () => {
      const m = await import('/js/standdatei.js');
      const stand = JSON.parse(JSON.stringify(window.wipfelkratzer.state));
      stand.rooms['2'][0].dehnung = { x: 7, z: 1 };
      const text = JSON.stringify(m.baueDatei({ name: 'Test', bild: null, stand, fotos: null }));
      const geprueft = m.pruefeDatei(text);
      return geprueft.ok && geprueft.datei.stand.rooms['2'][0].dehnung === undefined;
    }""")
    check(gefiltert, "Ein ungültiger Faktor fällt beim Einlesen weg")

    # Ein alter Spielstand ohne Dehnung laedt unveraendert
    unberuehrt = page.evaluate("""async () => {
      const m = await import('/js/standdatei.js');
      const stand = JSON.parse(JSON.stringify(window.wipfelkratzer.state));
      delete stand.rooms['2'][0].dehnung;
      const text = JSON.stringify(m.baueDatei({ name: 'Test', bild: null, stand, fotos: null }));
      const geprueft = m.pruefeDatei(text);
      return geprueft.ok && !('dehnung' in geprueft.datei.stand.rooms['2'][0]);
    }""")
    check(unberuehrt, "Ein Möbel ohne Dehnung bekommt keins angehängt")


def teil4_kollision(page):
    """Task 4: Ein Tier im Weg nimmt den Schritt zurueck (Spec E7).

    Der Raum wird lueckenlos zugestellt — erst dann findet nudgeTenant
    garantiert keinen Ausweichplatz mehr und die Ruecknahme ist keine
    Zufallsfrage. Die fuenf mal vier Hochbeete decken nach clampEntry die
    ganze Flaeche von Stockwerk 1 ab (je 2.0 x 1.7 bei 7.6 x 5.0 Raum)."""
    print("Teil 4 — Kollision")
    for name in ("Sofa", "Bett", "Stuhl"):
        add_item(page, 1, "Möbel", name)
    lage = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      for (const x of [-3.3, -1.6, 0.1, 1.8, 3.3])
        for (const z of [-2.2, -0.6, 1.0, 2.2]) {
          const en = { id: 'hochbeet', cell: 0, x, z, rot: 0 };
          w.roomOf(1).push(en);
          w.clampEntry(1, w.placeItemMesh(1, en), en);
        }
      const tier = w.tenantMeshes[1][0].userData.pick;
      return { tier: (w.tenantMeshes[1] || []).length, eingeklemmt: w.tenantBlocked(tier),
               x: tier.entry.x, z: tier.entry.z };
    }""")
    check(lage["tier"] == 1 and lage["eingeklemmt"],
          "Der zugestellte Raum laesst dem Tier keinen Ausweichplatz (%s)" % lage)

    # Die Einzugs-Meldung liegt ueber der Auswahlleiste und faengt sonst den
    # Klick ab. Toasts verschwinden nie von selbst (js/game.js:906), sie
    # muessen weggetippt werden — danach ist der Stapel leer und die naechste
    # Meldung darin ist die, auf die es hier ankommt.
    raeume_toasts(page)
    page.evaluate("() => { const w = window.wipfelkratzer; w.select(w.itemMeshes[1].find(m => m.userData.pick.entry.id === 'sofa').userData.pick); }")
    page.click("#btn-stretch")
    page.click("#btn-laenger")
    warte_ruhig(page)
    nachher = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      const m = w.itemMeshes[1].find(x => x.userData.pick.entry.id === 'sofa');
      const tier = w.tenantMeshes[1][0].userData.pick;
      return { dehnung: JSON.stringify(m.userData.pick.entry.dehnung || null), sx: m.scale.x,
               tx: tier.entry.x, tz: tier.entry.z };
    }""")
    check(nachher["dehnung"] == "null", "Der Schritt wird zurückgenommen (%s)" % nachher["dehnung"])
    check(abs(nachher["sx"] - 1) < 0.001, "Auch das Mesh ist wieder ungedehnt (%s)" % nachher["sx"])
    check(abs(nachher["tx"] - lage["x"]) < 0.001 and abs(nachher["tz"] - lage["z"]) < 0.001,
          "Das Tier steht noch da, wo es stand")
    klopfen = page.evaluate("() => document.getElementById('toast-stack').textContent")
    check("steht im Weg" in klopfen, "Es klopft und sagt, wer im Weg steht (%s)" % klopfen[:60])


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
            teil2_bedienung(page)
            teil3_datei(page)

            # Eigene Page: der zugestellte Raum aus Teil 4 wuerde die Raeume
            # der frueheren Teile unbrauchbar machen. new_page() ist ein
            # eigener Browserkontext, also auch ein eigener localStorage.
            page4 = browser.new_page()
            page4.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page4.on("pageerror", lambda e: errors.append(str(e)))
            seed(page4)
            open_game(page4)
            teil4_kollision(page4)
            page4.close()

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
