# Plan — Navileiste verdeckt «Foto» und «Musik aus» (Issue #32)

**Goal:** Die Werkzeugleiste und alles, was über ihr hängt, halten den Streifen
am unteren Bildrand frei, den die Navileiste `#game-nav` belegt. Jeder Knopf in
`#toolbar` ist auf schmalen Fenstern wieder anklickbar — insbesondere «Foto»
und «Musik aus» bei 600×900, 480×800 und 820×1180.

**Architecture:** Eine dritte gemessene Variable `--nav-h` tritt neben die
bestehenden `--toolbar-h` (`js/game.js:475-477`) und `--selbar-h`
(`js/game.js:480-482`). Sie hält den vom Vorlagenblock `#game-nav`
(`index.html:253`) belegten Streifen, gemessen als `innerHeight − navRect.top`,
also Höhe plus eigener Bodenabstand in einer Zahl. Verbraucht wird sie an
**genau einer** Stelle: `#toolbar { padding-bottom: var(--nav-h, 0px) }`
(`index.html:48`). Weil `--toolbar-h` aus `offsetHeight` kommt und
`offsetHeight` den Innenabstand mitzählt, wachsen `#selbar` (`index.html:71`),
`#extras-menu` (`index.html:81`), `#catalog` (`index.html:54`) und
`#toast-stack` (`index.html:126`) von allein mit — ihre `calc()`-Formeln
bleiben Zeichen für Zeichen unverändert. Damit das greift, beobachtet der
bestehende `ResizeObserver` die Border-Box statt der Content-Box; auf der
Content-Box feuert er bei einer reinen Innenabstandsänderung nicht. `#game-nav`
selbst wird nicht angefasst, damit der nächste ai-instructions-Sync den Fix
nicht überschreibt.

**Spec:** `docs/ai-notes/specs/2026-09-14-game-nav-ueberlappung-design.md`

## Global Constraints

- **`#game-nav` bleibt unberührt.** Der `<nav>`-Block (`index.html:253`) und
  seine Inline-Styles werden nicht editiert, nicht verschoben, nicht umgehängt.
  Er stammt aus der ai-instructions-Vorlage (`CLAUDE.md:400`); jede Änderung
  dort wäre beim nächsten Sync wieder weg.
- **Die drei bestehenden `calc()`-Formeln bleiben unverändert.**
  `index.html:54`, `:71`, `:81` und `:126` dürfen im `git diff` nicht auftauchen.
  Wer sie anfasst, hat den Fix falsch gebaut — er soll sich in die Kette
  einfügen, nicht ein viertes Mal dasselbe abschreiben.
- **Keine festen Pixelwerte aus der Vorlage abschreiben.** Weder die Höhe der
  Navileiste (schwankt zwischen 37px und 48px) noch ihr `bottom: 8px`. Alles
  wird gemessen.
- **Verifikation im Vordergrund. Niemals `run_in_background`.** So steht es in
  `CLAUDE.md:550-561`, und genau daran ist der Lauf zu Issue #11 gescheitert
  (59 von 80 Turns, „success", nichts gepusht). Das Prüfskript startet seinen
  Server selbst und blockiert; dem Aufruf notfalls ein grosszügiges `timeout`
  geben (z.B. 300000 ms), statt ihn in den Hintergrund zu schieben.
- **Server nur über den Port beenden.** Das Skript hält seinen
  `subprocess.Popen` selbst und beendet ihn im `finally`. Bleibt doch einmal
  einer liegen: `fuser -k 8237/tcp`. **Niemals `pkill -f`** — das erwischt
  fremde Python-Prozesse in anderen Sessions.
- **Branch vor der Verifikation pushen**, nicht danach (`CLAUDE.md:566-570`).
- **Buildless.** Kein Bundler, kein npm-Schritt; `python3 -m http.server`
  genügt (`CLAUDE.md:763`).
- **`version.js` bleibt unangetastet, kein `chore(release)`-Commit.** Die
  Version wird beim Schneiden des Release gehoben, nachdem der PR gemergt ist.
- **Deutsch mit echten Umlauten** in Kommentaren, Changelog und
  Commit-Nachrichten — `ä ö ü`, niemals `ae oe ue`; `ss` statt `ß` ist richtig.

---

### Task 1: Prüfharness `tools/verify_game_nav.py`

**Files:** `tools/verify_game_nav.py` (neu)

**Interfaces:**
- CLI: `python3 tools/verify_game_nav.py [--port 8237] [--viewport 600x900]`.
  Ohne `--viewport` laufen alle fünf. Exit-Code 0 = grün, 1 = rot.
- Startet `python3 -m http.server <port>` im Repo-Wurzelverzeichnis selbst und
  beendet ihn im `finally`.
- Prüft ausschliesslich Geometrie und Treffer über
  `document.elementFromPoint`, `getBoundingClientRect` und
  `getComputedStyle` — kein Zugriff auf Spielinterna, keine gesetzten
  Spielstände nötig.

- [ ] **Step 1: Playwright verfügbar machen.** `python3 -c "import playwright"`
      prüfen; falls nicht vorhanden, `pip install playwright && playwright
      install chromium` — im Vordergrund.
- [ ] **Step 2: `tools/verify_game_nav.py` mit exakt diesem Inhalt anlegen:**

```python
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
    return float(str(value).strip().removesuffix("px"))


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
```

- [ ] **Step 3: Rot sehen.** `python3 tools/verify_game_nav.py` im Vordergrund
      laufen lassen. Erwartet wird ein roter Lauf, und zwar mit genau diesen
      Fehlern: bei 600×900 trifft `btn-photo` ein `game-nav>A` und `btn-music`
      das `game-nav`, bei 480×800 und 820×1180 mindestens `btn-music`; dazu
      überall `--nav-h == innerHeight - navRect.top` (die Variable existiert
      noch nicht) und `#toolbar padding-bottom == --nav-h`. Bei 1280×800
      müssen die Treffer-Prüfungen schon jetzt grün sein — sonst misst das
      Harness etwas anderes als gemeint.
- [ ] **Step 4: Gegenprobe, dass das Harness nicht blind ist.** Im Lauf aus
      Step 3 müssen die Kettenprüfungen („6px Luft", „--toolbar-h ==
      offsetHeight") **grün** sein: sie beschreiben den heutigen, korrekten
      Zustand. Wäre auch das rot, prüft das Skript die falsche Grösse.

---

### Task 2: `--nav-h` messen (`js/game.js`)

**Files:** `js/game.js`

**Interfaces:**
- Neue CSS-Variable `--nav-h` auf `document.documentElement`, gesetzt in `px`.
  Fehlt `#game-nav`, wird sie **nicht** gesetzt; der CSS-Fallback `0px` gilt.
- Der bestehende `--toolbar-h`-Beobachter beobachtet neu die Border-Box.

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_game_nav.py
      --viewport 600x900` im Vordergrund; die Prüfung
      „`--nav-h == innerHeight - navRect.top`" muss rot sein. Genau sie wird
      dieser Task grün machen.
- [ ] **Step 2: Kommentar und Beobachter der Werkzeugleiste anpassen.** In
      `js/game.js` den Block `js/game.js:472-477` ersetzen durch:

```javascript
/* #selbar's bottom offset tracks #toolbar's real rendered height (it wraps to two
   rows on narrow viewports), so the two never overlap and #selbar never has to
   guess the toolbar's height. Beobachtet wird ausdrücklich die Border-Box: die
   Werkzeugleiste hält den Navileisten-Streifen als Innenabstand frei, und auf der
   Content-Box feuert der Beobachter bei dessen Änderung nicht — --toolbar-h bliebe
   stehen und das Extras-Menü rutschte in die Leiste hinein. */
(() => { const tb = $('toolbar');
  const sync = () => document.documentElement.style.setProperty('--toolbar-h', tb.offsetHeight + 'px');
  new ResizeObserver(sync).observe(tb, { box: 'border-box' }); sync(); })();
```

- [ ] **Step 3: Die Messung der Navileiste direkt hinter den
      `--selbar-h`-Block (`js/game.js:480-482`) setzen**, mit exakt diesem
      Inhalt:

```javascript
/* --nav-h ist der Streifen am unteren Bildrand, den die Navileiste #game-nav aus
   der ai-instructions-Vorlage belegt (index.html, Ende der Datei): Höhe plus
   eigener Bodenabstand in einer Zahl, damit keine Zahl aus deren Inline-Style
   hier abgeschrieben wird — die Höhe schwankt je nach Umbruch zwischen 37 und
   48 Pixeln. #toolbar hält diesen Streifen frei; ohne Navileiste bleibt die
   Variable ungesetzt und der CSS-Fallback 0px stellt das frühere Layout her.
   Die Vorlage selbst wird nicht angefasst, sonst überschreibt sie der nächste
   Sync (Issue #32). */
(() => { const nav = $('game-nav'); if (!nav) return;
  const sync = () => document.documentElement.style.setProperty('--nav-h',
    Math.max(0, Math.round(window.innerHeight - nav.getBoundingClientRect().top)) + 'px');
  new ResizeObserver(sync).observe(nav);
  new ResizeObserver(sync).observe(document.documentElement);
  addEventListener('resize', sync); sync(); })();
```

- [ ] **Step 4: Grün für die Messung.** `python3 tools/verify_game_nav.py` im
      Vordergrund. Neu grün: `--nav-h == innerHeight - navRect.top` auf allen
      fünf Viewports. Weiterhin rot: die Treffer-Prüfungen und
      `#toolbar padding-bottom == --nav-h` — die Variable wird noch von
      niemandem verbraucht. Die Kettenprüfungen bleiben grün (die Umstellung
      auf `border-box` darf ohne Innenabstand nichts ändern).

---

### Task 3: `#toolbar` reserviert den Streifen (`index.html`)

**Files:** `index.html`

**Interfaces:**
- `#toolbar` verbraucht `var(--nav-h, 0px)` als `padding-bottom`.
- `#toolbar` wird klickdurchlässig, seine Knöpfe bleiben klickbar.

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_game_nav.py
      --viewport 600x900` im Vordergrund; „alle #toolbar-Knöpfe treffen sich
      selbst" und „#toolbar padding-bottom == --nav-h" müssen rot sein.
- [ ] **Step 2: `index.html:48` ersetzen.** Aus der einen Zeile

```css
  #toolbar { position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; z-index: 5; max-width: 96vw; }
```

      werden diese drei Blöcke:

```css
  /* Die Leiste bleibt bei bottom: 10px stehen, reserviert aber als
     Innenabstand den Streifen, den die Navileiste #game-nav (Ende dieser
     Datei, aus der ai-instructions-Vorlage, z-index 2147483647) am unteren
     Rand belegt — sonst liegt die unterste umbrochene Knopfzeile darunter und
     «Foto» und «Musik aus» sind nicht mehr anklickbar (Issue #32). Weil
     --toolbar-h aus offsetHeight kommt, wachsen #selbar, #extras-menu,
     #catalog und #toast-stack von allein mit; deren Formeln bleiben
     unverändert. Ohne Navileiste greift der Fallback 0px.
     Klickdurchlässig, damit der reservierte Streifen und die Lücken zwischen
     den Knöpfen Tipps an die 3D-Szene durchlassen; die Knöpfe selbst fangen
     sie weiterhin ab. */
  #toolbar { position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; z-index: 5; max-width: 96vw; padding-bottom: var(--nav-h, 0px); pointer-events: none; }
  #toolbar > button { pointer-events: auto; }
```

- [ ] **Step 3: Grün.** `python3 tools/verify_game_nav.py` im Vordergrund. Jetzt
      müssen alle Treffer-, Schnitt- und Innenabstandsprüfungen auf allen fünf
      Viewports grün sein, ebenso „ohne #game-nav …". Rot bleiben darf nur noch
      „#wishes überlappt keinen Knopf" unter 640px Breite (Task 4).
- [ ] **Step 4: Nachweis, dass die Kette unangetastet blieb.**
      `git diff -U0 index.html` zeigen und prüfen, dass **keine** der Zeilen mit
      `#selbar`, `#extras-menu`, `#catalog` oder `#toast-stack` im Diff steht.
      Steht eine davon drin, zurücknehmen — der Fix hängt an `--toolbar-h`, nicht
      an vierfach abgeschriebenen Formeln.
- [ ] **Step 5: Klickdurchlässigkeit von Hand nachstellen.** Im Prüflauf ist
      belegt, dass die Knöpfe treffen; zusätzlich kurz mit Playwright prüfen,
      dass ein Punkt im reservierten Streifen unterhalb der untersten Knopfzeile
      und ausserhalb von `#game-nav` **nicht** `#toolbar` trifft (bei 1280×800
      z.B. der Punkt `(340, innerHeight - 20)`).

---

### Task 4: `#wishes` an dieselbe Kette hängen (`index.html`)

**Files:** `index.html`

**Interfaces:** `#wishes` unter 640px Breite verwendet dieselbe Formel wie
`#selbar` (`index.html:71`).

- [ ] **Step 1: Verifikation zuerst.** `python3 tools/verify_game_nav.py
      --viewport 600x900 --viewport 480x800` im Vordergrund; „#wishes überlappt
      keinen Knopf" muss rot sein. (Sie war es schon vor Task 3 — der feste
      Wert `130px` überlappt die dreizeilige Leiste bereits heute; die
      Reservierung vergrössert die Überlappung nur.)
- [ ] **Step 2: `index.html:146` ersetzen.** Aus

```css
    #wishes { max-width: 190px; top: auto; bottom: 130px; }
```

      wird

```css
    /* Dieselbe Formel wie #selbar: ein fester Abstand kannte die Höhe der
       umbrechenden Werkzeugleiste nicht und überlappte sie (Issue #32). */
    #wishes { max-width: 190px; top: auto; bottom: calc(var(--toolbar-h, 60px) + 16px); }
```

- [ ] **Step 3: Grün.** `python3 tools/verify_game_nav.py` im Vordergrund — alle
      fünf Viewports vollständig grün, kein Eintrag mehr in der
      Fehlerliste.

---

### Task 5: Changelog und Abschluss

**Files:** `CHANGELOG.md`

**Interfaces:** Neuer Abschnitt `## [Unreleased]` mit `### Fixed`, direkt über
`## [0.5.0] - 2026-09-13` (`CHANGELOG.md:7`).

- [ ] **Step 1: Eintrag einfügen.** Über der Zeile `## [0.5.0] - 2026-09-13`
      genau diesen Block einsetzen:

```markdown
## [Unreleased]

### Fixed

- Auf schmalen Fenstern brach die Werkzeugleiste auf mehrere Zeilen um und die
  unterste Zeile verschwand unter der Navileiste am unteren Bildrand — «Foto»
  und «Musik aus» waren sichtbar, liessen sich aber nicht antippen. Die Leiste
  hält jetzt den Streifen frei, den die Navileiste tatsächlich belegt, und
  alles, was über ihr hängt (Auswahlleiste, Extras-Menü, Katalog, Meldungen),
  rückt mit. Auf schmalen Fenstern richten sich auch die Wunschzettel nach der
  gemessenen Leistenhöhe statt nach einem festen Abstand (#32)
```

- [ ] **Step 2: Nichts angefasst, was nicht in den Plan gehört.**
      `git status --short` zeigt genau vier geänderte bzw. neue Dateien:
      `index.html`, `js/game.js`, `CHANGELOG.md`, `tools/verify_game_nav.py`
      (plus die beiden Dokumente aus `docs/ai-notes/`). `git diff version.js`
      ist leer.
- [ ] **Step 3: Commit und Push**, mit deutscher Nachricht und echten Umlauten,
      z.B. `fix(ui): Werkzeugleiste hält den Streifen der Navileiste frei`.
      Push **vor** dem abschliessenden Prüflauf (`CLAUDE.md:566-570`).
- [ ] **Step 4: Abschliessender Gesamtlauf.** `python3
      tools/verify_game_nav.py` im Vordergrund, vollständig grün, die Ausgabe
      in die PR-Beschreibung übernehmen (die Zeile „GRÜN — alle Prüfungen
      bestanden." plus die Tabelle der geprüften Viewports).
- [ ] **Step 5: PR eröffnen** gegen `main`, mit Bezug auf Issue #32 und dem
      ausdrücklichen Hinweis, dass `#game-nav` selbst unverändert blieb und der
      Fix deshalb einen ai-instructions-Sync übersteht. Ebenfalls erwähnen: das
      Muster gehört als Hinweis in den browser-game-Overlay von
      `ai-instructions` — als eigenes Issue dort, nicht in diesem PR.
