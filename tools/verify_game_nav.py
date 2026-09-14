#!/usr/bin/env python3
"""Headless-Prüfung der Navileisten-Überlappung aus Issue #32.

Startet den statischen Server selbst und läuft komplett im Vordergrund —
siehe CLAUDE.md: "Run the verification in the foreground. Never
run_in_background." Der Server wird über den eigenen Prozess-Handle beendet;
bleibt doch einmal einer liegen, hilft `fuser -k 8237/tcp` — niemals
`pkill -f`.

    python3 tools/verify_game_nav.py
    python3 tools/verify_game_nav.py --viewport 600x900
"""
import argparse
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 8237

# Die drei ersten stammen aus Issue #32 (600x900 gemeldet, 480x800 und
# 820x1180 in der Gegenprobe ebenfalls betroffen), 1280x800 ist die
# Gegenprobe ohne Überlappung, 360x640 der schmale Extremfall.
VIEWPORTS = [(600, 900), (480, 800), (820, 1180), (1280, 800), (360, 640)]

# 16px in den bestehenden calc()-Formeln = 10px Bodenabstand der
# Werkzeugleiste + 6px Luft (index.html:48 gegen index.html:71).
TOOLBAR_BOTTOM = 10.0
GAP = 6.0
TOL = 1.0

MEASURE_JS = """() => {
  const R = el => { const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height,
             top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
  const out = { hits: {}, buttons: {}, boxes: {}, vars: {},
                innerHeight: window.innerHeight, innerWidth: window.innerWidth };
  for (const btn of document.querySelectorAll('#toolbar button')) {
    const b = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    out.hits[btn.id] = hit
      ? (hit.id || (hit.closest('#game-nav') ? 'game-nav>' + hit.tagName : hit.tagName))
      : null;
    out.buttons[btn.id] = R(btn);
  }
  for (const id of ['toolbar', 'game-nav', 'selbar', 'extras-menu', 'catalog',
                    'toast-stack', 'wishes']) {
    const el = document.getElementById(id);
    out.boxes[id] = el ? R(el) : null;
  }
  const rootCS = getComputedStyle(document.documentElement);
  out.vars = {
    nav: rootCS.getPropertyValue('--nav-h').trim(),
    toolbar: rootCS.getPropertyValue('--toolbar-h').trim(),
    selbar: rootCS.getPropertyValue('--selbar-h').trim(),
  };
  const bottomOf = id => getComputedStyle(document.getElementById(id)).bottom;
  out.bottoms = {
    selbar: bottomOf('selbar'), extras: bottomOf('extras-menu'),
    catalog: bottomOf('catalog'), toast: bottomOf('toast-stack'),
  };
  out.toolbarPad = getComputedStyle(document.getElementById('toolbar')).paddingBottom;
  const tops = [...document.querySelectorAll('#toolbar button')]
    .map(b => b.getBoundingClientRect().top);
  out.topRow = tops.length ? Math.min(...tops) : null;
  return out;
}"""

ADD_WISH_JS = """() => {
  const w = document.getElementById('wishes');
  const d = document.createElement('div');
  d.className = 'wish panel';
  d.id = 'wish-probe';
  d.textContent = 'Prüfwunsch für die Geometrie';
  w.appendChild(d);
}"""

DROP_WISH_JS = "() => { const d = document.getElementById('wish-probe'); if (d) d.remove(); }"
DROP_NAV_JS = "() => { const n = document.getElementById('game-nav'); if (n) n.remove(); }"

failures = []


def check(ok, label, detail=""):
    print(("  OK   " if ok else "  FAIL ") + label + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(label + (f" [{detail}]" if detail else ""))


def px(value):
    value = str(value).strip()
    return float(value.removesuffix("px")) if value else 0.0


def intersects(a, b):
    return (a["left"] < b["right"] - TOL and b["left"] < a["right"] - TOL
            and a["top"] < b["bottom"] - TOL and b["top"] < a["bottom"] - TOL)


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


def open_page(browser, url, width, height):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url, wait_until="networkidle")
    # Der Intro-Dialog gilt Playwright wegen seiner Einblend-Animation nie als
    # "stabil"; ein gewöhnlicher click() läuft in den Timeout. force=True klickt
    # ihn trotzdem weg — der Knopf ist sicht- und treffbar.
    page.click("#btn-start", force=True)
    page.wait_for_timeout(700)
    return page, errors


def run_viewport(browser, url, width, height):
    label = f"{width}x{height}"
    print(f"\n=== {label} ===")
    page, errors = open_page(browser, url, width, height)
    m = page.evaluate(MEASURE_JS)

    # 1. Jeder Knopf trifft sich selbst.
    wrong = {k: v for k, v in m["hits"].items() if v != k}
    check(not wrong, f"{label}: alle #toolbar-Knöpfe treffen sich selbst", str(wrong))

    # 2. Kein Knopfrechteck schneidet die Navileiste.
    nav = m["boxes"]["game-nav"]
    check(nav is not None, f"{label}: #game-nav vorhanden")
    if nav:
        clash = [k for k, b in m["buttons"].items() if intersects(b, nav)]
        check(not clash, f"{label}: kein Knopf schneidet #game-nav", str(clash))

        # 3. --nav-h ist der belegte Streifen.
        want = round(m["innerHeight"] - nav["top"])
        check(abs(px(m["vars"]["nav"]) - want) <= TOL and want > 0,
              f"{label}: --nav-h == innerHeight - navRect.top",
              f"{m['vars']['nav']} vs {want}px")

    # 4. Der Innenabstand der Werkzeugleiste ist der Streifen, und ihre
    #    Unterkante steht unverändert 10px über dem Rand.
    tb = m["boxes"]["toolbar"]
    check(abs(px(m["toolbarPad"]) - px(m["vars"]["nav"])) <= TOL,
          f"{label}: #toolbar padding-bottom == --nav-h",
          f"{m['toolbarPad']} vs {m['vars']['nav']}")
    check(abs((m["innerHeight"] - tb["bottom"]) - TOOLBAR_BOTTOM) <= TOL,
          f"{label}: #toolbar sitzt weiterhin 10px über dem Rand",
          f"{m['innerHeight'] - tb['bottom']}")

    # 5. Die bestehende Kette ist intakt: --toolbar-h ist die Border-Box, und
    #    #selbar/#extras-menu stehen 6px über der obersten Knopfzeile.
    check(abs(px(m["vars"]["toolbar"]) - tb["h"]) <= TOL,
          f"{label}: --toolbar-h == offsetHeight inkl. Innenabstand",
          f"{m['vars']['toolbar']} vs {tb['h']}")
    for key in ("selbar", "extras"):
        edge = m["innerHeight"] - px(m["bottoms"][key])
        check(abs((m["topRow"] - edge) - GAP) <= TOL,
              f"{label}: {key} lässt 6px Luft über der obersten Knopfzeile",
              f"{m['topRow'] - edge}")

    # 6. Extras-Menü geöffnet: dieselbe Luft, jetzt am echten Rechteck.
    page.click("#btn-extras", force=True)
    page.wait_for_timeout(300)
    m2 = page.evaluate(MEASURE_JS)
    ex = m2["boxes"]["extras-menu"]
    check(abs((m2["topRow"] - ex["bottom"]) - GAP) <= TOL,
          f"{label}: geöffnetes #extras-menu überlappt #toolbar nicht",
          f"{m2['topRow'] - ex['bottom']}")
    page.click("#btn-extras", force=True)
    page.wait_for_timeout(200)

    # 7. #wishes: mit einem eingefügten Prüfwunsch darf nichts überlappen.
    page.evaluate(ADD_WISH_JS)
    page.wait_for_timeout(200)
    m3 = page.evaluate(MEASURE_JS)
    wish = m3["boxes"]["wishes"]
    clash = [k for k, b in m3["buttons"].items() if intersects(b, wish)]
    check(not clash, f"{label}: #wishes überlappt keinen Knopf", str(clash))
    page.evaluate(DROP_WISH_JS)

    # 8. Ohne Navileiste fällt alles auf das frühere Layout zurück. Das
    #    Entfernen allein feuert keinen Beobachter, der Viewport-Stups schon.
    page.evaluate(DROP_NAV_JS)
    page.set_viewport_size({"width": width - 1, "height": height})
    page.wait_for_timeout(300)
    m4 = page.evaluate(MEASURE_JS)
    check(px(m4["toolbarPad"]) <= TOL,
          f"{label}: ohne #game-nav ist der Innenabstand 0", m4["toolbarPad"])
    check(abs((m4["innerHeight"] - m4["boxes"]["toolbar"]["bottom"]) - TOOLBAR_BOTTOM) <= TOL,
          f"{label}: ohne #game-nav steht #toolbar wie vor der Änderung")

    check(not errors, f"{label}: Konsole fehlerfrei", "; ".join(errors[:3]))
    page.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--viewport", action="append", default=None,
                    help="z.B. 600x900; mehrfach erlaubt")
    args = ap.parse_args()

    viewports = VIEWPORTS
    if args.viewport:
        viewports = [tuple(int(n) for n in v.split("x")) for v in args.viewport]

    if not port_free(args.port):
        print(f"Port {args.port} ist belegt. Beenden mit: fuser -k {args.port}/tcp")
        return 1

    url = f"http://127.0.0.1:{args.port}/"
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(args.port)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(args.port):
            print("Server kam nicht hoch.")
            return 1
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                for width, height in viewports:
                    run_viewport(browser, url, width, height)
            finally:
                browser.close()
    finally:
        server.terminate()
        server.wait()

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
