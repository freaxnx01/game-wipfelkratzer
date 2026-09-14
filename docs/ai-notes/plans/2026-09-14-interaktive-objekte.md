# Plan: Objekte interaktiv machen — Fenster, Badewanne, Lampe (Issue #41)

**Goal:** Lampe, Badewanne und Fenster bekommen einen schaltbaren, im
Spielstand gespeicherten Zustand mit eigenem Geräusch, bedient über einen neuen
Knopf `#btn-action` in `#selbar`. Bei Nacht verrät die Fassade, ob in einer
Wohnung Licht brennt — damit ist `TODO.md:6` eingelöst. `TODO.md:5` (die
Tag/Nacht-Beleuchtungsschicht selbst) bleibt ausdrücklich offen.

**Architecture:** Ein Mechanismus, vier Bausteine.

1. `js/models.js` legt benannte Griffe in `userData` ab — genau wie
   `hamsterrad()` das mit `userData.wheel` tut (`js/models.js:139`,
   abgeholt in `js/game.js:463`). Neu: `userData.bulb`/`userData.shade` an
   der Lampe, `userData.water` an der Wanne, `userData.sash` (Kippflügel-
   Gruppe) am Fenster. Die Lampe klont dabei `MAT.glow`, weil `MAT.*`
   modulweit geteilt ist (`js/models.js:4-12`) und ein Schalten sonst alle
   Lampen im Turm träfe.
2. `js/game.js` bekommt die Registry `ACTIONS`, den Lesehelfer `isOn` mit
   `DEFAULT_ON`, die drei `apply*`-Funktionen und `applyItemState`, das aus
   `placeItemMesh` (`js/game.js:447-465`) heraus beim Laden einmal ohne
   Animation gerufen wird.
3. `index.html` bekommt `<button id="btn-action">` in `#selbar`
   (`index.html:187-198`); `select()` (`js/game.js:672-678`) blendet ihn ein
   wie heute schon `#btn-move`/`#btn-rot`/`#wallpad`, `toggleAction()` hängt
   am Klick.
4. `applyNight` (`js/game.js:873-884`) koppelt die Fassadenscheiben
   (`js/game.js:877-881`) an die Lampenzustände der Etage und setzt die
   Birnen-Helligkeit nach.

Zustand ist **ein** boolesches Feld `on` am bestehenden Eintrag in
`state.rooms` (`js/game.js:36`, `js/game.js:685-694`). Fehlt es, greift
`DEFAULT_ON` — kein Umschreiben beim Laden, kein `migrated`-Flag.

**Spec:** `docs/ai-notes/specs/2026-09-14-interaktive-objekte-design.md`

## Global Constraints

- **Keine neue Lichtquelle.** Die Szene behält genau zwei Lichter
  (`js/game.js:61-62`). Kein `THREE.PointLight`, kein `SpotLight` — Spec A5.
- **Nur `MeshLambertMaterial` über `MAT`** (`js/models.js:3-12`). Erlaubt ist
  genau ein `MAT.glow.clone()` pro Lampe (Spec A9); keine neue Farbe in `MAT`,
  keine Textur, keine Audiodatei.
- **Keine neue Geste.** Der Pointer-Handler (`js/game.js:996-1032`) wird
  **nicht** angefasst. Antippen wählt weiterhin aus.
- **Zustand nur in `state.rooms`.** Kein zweites Register, kein
  `localStorage`-Schlüssel neben `wipfelkratzer-v1` (`js/game.js:37`).
- **Alte Spielstände bleiben unangetastet**, solange nicht geschaltet wird:
  kein `save()` beim Laden, kein Auffüllen fehlender `on`-Felder.
- **Keine neuen Katalogeinträge**, `CATALOG`/`CATS`/`WALL_ITEMS`
  (`js/models.js:251-272`) bleiben unverändert. Kein Instrument wird
  eingetragen — #36 ist noch nicht implementiert; diese Arbeit baut nur die
  Weiche.
- **Kein `version.js`-Bump, kein `chore(release)`-Commit** (Spec A11). Der
  Changelog-Eintrag kommt unter `## [Unreleased]`.
- **Verifikation läuft im Vordergrund. Niemals `run_in_background`.** So steht
  es in `CLAUDE.md:550-570`; ein Lauf (Issue #11) ist genau daran gescheitert:
  59 von 80 Turns auf `sleep`/`echo idle` verplempert, Meldung «success»,
  nichts gepusht. Dem Vordergrund-Aufruf ein grosszügiges `timeout` geben und
  ihn blockieren lassen — Blockieren ist der Sinn der Sache.
- **Server per Port beenden, nie `pkill -f`.** Das Verifikationsskript startet
  seinen HTTP-Server selbst im selben Prozess und fährt ihn mit
  `httpd.shutdown()` wieder herunter; wird ausserhalb davon ein Server
  gebraucht, wird er über seinen Port identifiziert und beendet.
- **Branch committen und pushen, bevor die Verifikation startet**
  (`CLAUDE.md:568-570`), damit ein abgebrochener Lauf die Arbeit nicht
  mitnimmt.
- Deutsche Texte mit **echten Umlauten** (ä ö ü), `ss` statt `ß` — auch in
  Kommentaren und Commit-Nachrichten.
- Commit-Typen: `feat(einrichten): …` für Code, `docs(einrichten): …` für
  Changelog/TODO.

---

### Task 1: Verifikationsskript schreiben (läuft zuerst, schlägt fehl)

Dieses Repo hat keine Unit-Test-Suite und soll keine bekommen. Geprüft wird
headless mit Playwright gegen die echte Seite über einen selbst gestarteten
lokalen HTTP-Server — das Spiel ist ein ES-Modul mit Importmap
(`index.html:10-24`), `file://` funktioniert nicht.

Das Skript entsteht **vor** dem Produktivcode und muss beim ersten Lauf
scheitern: `#btn-action` existiert nicht, `userData.bulb` ist `undefined`.
Genau das ist der rote Test.

**Files:**
- Create: `/tmp/verify_interaktive_objekte.py` (Wegwerf-Skript, **nicht**
  committen — das Repo hat kein `scripts/`-Verzeichnis und soll keins bekommen)

**Interfaces:**
- `window.wipfelkratzer` (`js/game.js:1188`) liefert heute `state`,
  `floorGroups`, `scene`, `camera`, `enterEdit`, `exitEdit`, `dims`,
  `cellPos`, `wallPlacement`, `edit`. Task 3 ergänzt dort `ACTIONS` und
  `isOn`; bis dahin schlagen die betroffenen Prüfungen fehl.
- Möbelgruppen hängen direkt unter `floorGroups[k]` und tragen
  `userData.itemId` (`js/models.js:309`) sowie `userData.pick`
  (`js/game.js:461`) — darüber sind Griffe und Spielstandeintrag erreichbar,
  ohne irgendetwas zusätzlich zu exportieren.
- Fassadenscheiben: `floorGroups[i].userData.wins` (`js/game.js:274-281`).
- Katalog: Tabs `#catalog-tabs button` mit den Beschriftungen aus `CATS`
  (`js/models.js:271`), Kacheln `#catalog-items .item` mit `<span>`-Namen
  (`js/game.js:598-601`). Ein Klick auf eine Kachel ruft `addItem`, und
  `addItem` wählt das neue Objekt sofort aus (`js/game.js:708`) — so kommt der
  Test an `#selbar`, ohne in 3D treffen zu müssen.
- `#btn-night` (`index.html:165`) löst `setNight` aus, das über `tween(1.2, …)`
  läuft (`js/game.js:886-887`) — nach dem Klick mindestens 1600 ms warten.

**Steps:**

- [ ] **Step 1: Skript anlegen.** Inhalt exakt so (Repo-Root als `argv[1]`,
      damit es aus jedem Verzeichnis läuft):

```python
#!/usr/bin/env python3
"""Headless-Verifikation für Issue #41 (interaktive Objekte).

Immer im Vordergrund laufen lassen — niemals run_in_background.
Aufruf:  python3 /tmp/verify_interaktive_objekte.py <repo-root>
"""
import functools, http.server, json, pathlib, socketserver, sys, threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
SHOTS = pathlib.Path("/tmp/interaktive-objekte-shots")
SHOTS.mkdir(exist_ok=True)

PORT, httpd = None, None
for candidate in range(8971, 8976):
    try:
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
        httpd = socketserver.TCPServer(("127.0.0.1", candidate), handler)
        PORT = candidate
        break
    except OSError:
        continue
assert PORT, "kein freier Port im Bereich 8971-8975"
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/"

# Alter Spielstand im Format von js/game.js:36 — die Einträge haben BEWUSST
# kein Feld "on". Genau so sieht ein Stand aus, der vor dieser Änderung
# geschrieben wurde.
OLD_SAVE = {
    "floors": 3, "nuts": 999, "bridge": False, "garden": False, "night": False,
    "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
    "rooms": {
        "1": [
            {"id": "lampe", "cell": 0, "x": -2.4, "y": 0.155, "z": -1.2, "rot": 0},
            {"id": "lampe", "cell": 1, "x": -1.4, "y": 0.155, "z": -1.2, "rot": 0},
            {"id": "badewanne", "cell": 2, "x": -0.3, "y": 0.155, "z": -1.2, "rot": 0},
            {"id": "fenster", "wall": "back", "x": 0.6, "y": 1.05, "z": 0, "rot": 0, "cell": 0},
        ],
        # Etage 2 ist bewohnt (>= 3 Sachen) und hat KEINE Lampe — die Fassade
        # dieser Etage muss sich bei Nacht verhalten wie bisher.
        "2": [
            {"id": "tisch", "cell": 0, "x": -1.8, "y": 0.155, "z": -1.0, "rot": 0},
            {"id": "stuhl", "cell": 1, "x": -0.8, "y": 0.155, "z": -1.0, "rot": 0},
            {"id": "sofa", "cell": 2, "x": 0.4, "y": 0.155, "z": -1.0, "rot": 0},
        ],
    },
}

fails = []


def check(ok, label):
    print(("OK   " if ok else "FAIL ") + label)
    if not ok:
        fails.append(label)


def seed(page, data):
    page.evaluate("s => localStorage.setItem('wipfelkratzer-v1', s)", json.dumps(data))


def start(page):
    """Seite neu laden und den Startknopf drücken (der weckt den AudioContext)."""
    page.reload(wait_until="networkidle")
    page.click("#btn-start")
    page.wait_for_timeout(700)


def items(page, floor):
    """Alle Möbelgruppen einer Etage mit ihren Griffen und Spielstand-Feldern."""
    return page.evaluate(
        """f => window.wipfelkratzer.floorGroups[f].children
             .filter(c => c.userData && c.userData.itemId)
             .map(c => ({
               id: c.userData.itemId,
               on: c.userData.pick.entry.on,
               hasBulb: !!c.userData.bulb,
               bulbIntensity: c.userData.bulb ? c.userData.bulb.material.emissiveIntensity : null,
               bulbShared: c.userData.bulb ? c.userData.bulb.material === c.userData.matGlowRef : null,
               hasWater: !!c.userData.water,
               waterVisible: c.userData.water ? c.userData.water.visible : null,
               hasSash: !!c.userData.sash,
               sashRotX: c.userData.sash ? c.userData.sash.rotation.x : null,
             }))""",
        floor,
    )


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type in ("error", "warning") else None)

    page.goto(BASE, wait_until="networkidle")
    seed(page, OLD_SAVE)
    start(page)

    # --- 1. Alter Spielstand: lädt, sieht aus wie bisher, wird nicht umgeschrieben ---
    raw_after_load = page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')")
    check(json.loads(raw_after_load) == OLD_SAVE,
          "alter Spielstand wird beim Laden nicht umgeschrieben")

    f1 = items(page, 1)
    print(json.dumps(f1, indent=2, ensure_ascii=False))
    lamps = [i for i in f1 if i["id"] == "lampe"]
    tub = next((i for i in f1 if i["id"] == "badewanne"), None)
    win = next((i for i in f1 if i["id"] == "fenster"), None)
    check(len(lamps) == 2, "beide Lampen aus dem alten Stand geladen")
    check(all(i["on"] is None for i in f1), "kein Eintrag hat ein Feld on")
    check(all(i["hasBulb"] for i in lamps), "Lampe hat userData.bulb")
    check(all((i["bulbIntensity"] or 0) > 0 for i in lamps),
          "Lampe leuchtet ohne Feld on (DEFAULT_ON.lampe === true)")
    check(tub is not None and tub["hasWater"], "Badewanne hat userData.water")
    check(tub is not None and tub["waterVisible"] is True,
          "Wanne ist ohne Feld on voll (DEFAULT_ON.badewanne === true)")
    check(win is not None and win["hasSash"], "Fenster hat userData.sash")
    check(win is not None and abs(win["sashRotX"] or 0) < 0.01,
          "Fenster ist ohne Feld on zu (DEFAULT_ON.fenster === false)")

    # --- 2. Genau zwei Lichter in der Szene (Spec A5) ---
    lights = page.evaluate(
        """() => { const out = []; window.wipfelkratzer.scene.traverse(
             o => { if (o.isLight) out.push(o.type); }); return out.sort(); }""")
    print("Lichter:", lights)
    check(lights == ["DirectionalLight", "HemisphereLight"],
          f"Szene hat genau zwei Lichter (ist: {lights})")

    # --- 3. Knopf erscheint nur für interaktive Objekte ---
    page.evaluate("() => window.wipfelkratzer.enterEdit(3)")
    page.wait_for_timeout(500)

    def add(tab, name):
        page.click(f"#catalog-tabs button:text-is('{tab}')")
        page.wait_for_timeout(200)
        page.click(f"#catalog-items .item:has(span:text-is('{name}'))")
        page.wait_for_timeout(500)   # addItem wählt sofort aus (js/game.js:708)

    add("Möbel", "Tisch")
    check(page.locator("#btn-action").is_hidden(), "Tisch: kein Aktionsknopf")

    add("Gemütlich", "Lampe")
    check(page.locator("#btn-action").is_visible(), "Lampe: Aktionsknopf sichtbar")
    check(page.locator("#btn-action").inner_text().strip() == "Licht aus",
          f"Lampe an -> Knopf sagt «Licht aus» (ist: {page.locator('#btn-action').inner_text()!r})")

    # --- 4. Lampe schalten: nur diese eine, Zustand im Spielstand, Knopf dreht ---
    page.click("#btn-action")
    page.wait_for_timeout(500)
    check(page.locator("#btn-action").inner_text().strip() == "Licht an",
          "nach dem Druck sagt der Knopf «Licht an»")
    st3 = page.evaluate("() => window.wipfelkratzer.state.rooms['3']")
    lamp_entry = next((e for e in st3 if e["id"] == "lampe"), None)
    check(lamp_entry is not None and lamp_entry.get("on") is False,
          f"entry.on === false im Spielstand (ist: {lamp_entry})")
    dark = page.evaluate(
        """() => window.wipfelkratzer.floorGroups[3].children
             .filter(c => c.userData && c.userData.itemId === 'lampe')
             .map(c => c.userData.bulb.material.emissiveIntensity)""")
    check(dark == [0] or dark[0] == 0, f"ausgeschaltete Birne hat Intensität 0 (ist: {dark})")

    # zweite Lampe daneben: muss weiterleuchten (kein geteiltes MAT.glow)
    add("Gemütlich", "Lampe")
    both = page.evaluate(
        """() => window.wipfelkratzer.floorGroups[3].children
             .filter(c => c.userData && c.userData.itemId === 'lampe')
             .map(c => c.userData.bulb.material.emissiveIntensity)""")
    print("Birnen in Etage 3:", both)
    check(sorted(both)[0] == 0 and sorted(both)[-1] > 0,
          f"eine Lampe aus, die andere an — Material nicht geteilt (ist: {both})")

    # --- 5. Badewanne und Fenster schalten ---
    add("Gemütlich", "Badewanne")
    check(page.locator("#btn-action").inner_text().strip() == "Wanne leeren",
          "volle Wanne -> Knopf sagt «Wanne leeren»")
    page.click("#btn-action")
    page.wait_for_timeout(1200)
    water = page.evaluate(
        """() => { const c = window.wipfelkratzer.floorGroups[3].children
             .find(c => c.userData && c.userData.itemId === 'badewanne');
             return { visible: c.userData.water.visible, on: c.userData.pick.entry.on }; }""")
    check(water["visible"] is False and water["on"] is False,
          f"Wanne ist leer und der Zustand steht im Spielstand (ist: {water})")

    add("Wand", "Fenster")
    check(page.locator("#wallpad").is_visible(), "Fenster: Wandkreuz weiterhin sichtbar")
    check(page.locator("#btn-action").is_visible(), "Fenster: Aktionsknopf zusätzlich sichtbar")
    check(page.locator("#btn-action").inner_text().strip() == "Fenster auf",
          "geschlossenes Fenster -> Knopf sagt «Fenster auf»")
    page.click("#btn-action")
    page.wait_for_timeout(1200)
    sash = page.evaluate(
        """() => { const c = window.wipfelkratzer.floorGroups[3].children
             .find(c => c.userData && c.userData.itemId === 'fenster');
             return { rot: c.userData.sash.rotation.x, on: c.userData.pick.entry.on }; }""")
    check(abs(sash["rot"]) > 0.3 and sash["on"] is True,
          f"Fensterflügel ist gekippt (ist: {sash})")

    # --- 6. Reload-Persistenz ---
    start(page)
    after = page.evaluate("() => window.wipfelkratzer.state.rooms['3']")
    print(json.dumps(after, indent=2, ensure_ascii=False))
    tub_a = next((e for e in after if e["id"] == "badewanne"), None)
    win_a = next((e for e in after if e["id"] == "fenster"), None)
    check(tub_a is not None and tub_a.get("on") is False, "Wanne bleibt nach dem Reload leer")
    check(win_a is not None and win_a.get("on") is True, "Fenster bleibt nach dem Reload offen")
    live = items(page, 3)
    tub_l = next((i for i in live if i["id"] == "badewanne"), None)
    win_l = next((i for i in live if i["id"] == "fenster"), None)
    check(tub_l is not None and tub_l["waterVisible"] is False,
          "Wanne wird beim Laden leer aufgebaut")
    check(win_l is not None and abs(win_l["sashRotX"]) > 0.3,
          "Fenster wird beim Laden offen aufgebaut")

    # --- 7. Nacht: Fassade folgt den Lampen, Etage ohne Lampe bleibt wie bisher ---
    def wins_lit(floor):
        return page.evaluate(
            "f => window.wipfelkratzer.floorGroups[f].userData.wins"
            "      .map(w => w.material.emissiveIntensity)", floor)

    page.click("#btn-night")
    page.wait_for_timeout(1800)
    check(all(v > 0 for v in wins_lit(1)),
          f"Nacht: Etage 1 (Lampen an) leuchtet (ist: {wins_lit(1)})")
    check(all(v > 0 for v in wins_lit(2)),
          f"Nacht: Etage 2 ohne Lampe leuchtet wie bisher (ist: {wins_lit(2)})")
    night_bulb = page.evaluate(
        """() => window.wipfelkratzer.floorGroups[1].children
             .find(c => c.userData && c.userData.itemId === 'lampe')
             .userData.bulb.material.emissiveIntensity""")
    check(night_bulb > 0.8, f"Birne ist bei Nacht heller (ist: {night_bulb})")

    # beide Lampen der Etage 1 ausschalten -> Fassade dieser Etage wird dunkel
    page.evaluate(
        """() => { const w = window.wipfelkratzer;
             w.floorGroups[1].children
               .filter(c => c.userData && c.userData.itemId === 'lampe')
               .forEach(c => { c.userData.pick.entry.on = true; });
           }""")
    page.evaluate("() => window.wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(500)
    # über die Oberfläche schalten, nicht am Zustand vorbei: beide Lampen
    # nacheinander auswählen ist ohne 3D-Treffer nicht möglich, deshalb wird
    # hier eine frische Lampe hinzugefügt und ausgeschaltet, während die
    # beiden alten per Zustand auf aus gesetzt werden.
    page.evaluate(
        """() => { const w = window.wipfelkratzer;
             (w.state.rooms['1'] || []).forEach(e => { if (e.id === 'lampe') e.on = false; });
           }""")
    add("Gemütlich", "Lampe")
    page.click("#btn-action")          # die neue Lampe aus -> alle drei aus
    page.wait_for_timeout(1800)
    check(all(v == 0 for v in wins_lit(1)),
          f"Nacht: Etage 1 wird dunkel, wenn alle Lampen aus sind (ist: {wins_lit(1)})")
    page.click("#btn-action")          # wieder an
    page.wait_for_timeout(800)
    check(all(v > 0 for v in wins_lit(1)),
          f"Nacht: eine einzige eingeschaltete Lampe erhellt die Fassade (ist: {wins_lit(1)})")

    # --- 8. Zustandsloser Eintrag (der Fall aus Issue #36) ---
    stateless = page.evaluate(
        """() => { const w = window.wipfelkratzer;
             w.ACTIONS.klavier = { label: 'Spielen', sound: () => {} };
             return Object.keys(w.ACTIONS); }""")
    print("ACTIONS:", stateless)
    add("Spass", "Klavier")
    check(page.locator("#btn-action").inner_text().strip() == "Spielen",
          "zustandsloser Eintrag: Knopf trägt die feste Beschriftung")
    page.click("#btn-action")
    page.wait_for_timeout(400)
    piano = page.evaluate(
        """() => (window.wipfelkratzer.state.rooms['1'] || [])
             .filter(e => e.id === 'klavier').map(e => e.on)""")
    check(piano and all(v is None for v in piano),
          f"zustandsloser Eintrag schreibt kein on (ist: {piano})")
    check(page.locator("#btn-action").inner_text().strip() == "Spielen",
          "zustandsloser Eintrag: Beschriftung bleibt gleich")

    # --- 9. Löschen räumt auf ---
    page.click("#btn-del")
    page.wait_for_timeout(400)
    check(page.locator("#selbar").is_hidden() or page.locator("#btn-action").is_hidden(),
          "nach «Weg damit» ist der Aktionsknopf weg")

    # --- 10. Screenshots (Sichtprüfung) ---
    page.evaluate("() => window.wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(1400)
    page.screenshot(path=str(SHOTS / "etage1-nacht.png"))
    page.click("#btn-night")
    page.wait_for_timeout(1800)
    page.screenshot(path=str(SHOTS / "etage1-tag.png"))
    page.evaluate("() => window.wipfelkratzer.exitEdit()")
    page.wait_for_timeout(1400)
    page.screenshot(path=str(SHOTS / "turm-aussen.png"))
    page.set_viewport_size({"width": 390, "height": 780})
    page.evaluate("() => window.wipfelkratzer.enterEdit(3)")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(SHOTS / "schmal-selbar.png"))

    # --- 11. Konsole sauber ---
    print("Konsolenmeldungen:", errors)
    check(not errors, f"keine Konsolenfehler/-warnungen ({len(errors)}): {errors[:5]}")

    browser.close()

httpd.shutdown()
print(f"\nScreenshots in {SHOTS}")
if fails:
    print(f"\n{len(fails)} FEHLGESCHLAGEN:")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("\nAlles grün.")
```

- [ ] **Step 2: Skript einmal laufen lassen — es muss rot sein.**
      `timeout 600000` beim Aufruf, im Vordergrund:
      `python3 /tmp/verify_interaktive_objekte.py /home/freax/repos/github/freaxnx01/public/game-wipfelkratzer`
      Erwartete Fehlschläge: «Lampe hat userData.bulb», «Badewanne hat
      userData.water», «Fenster hat userData.sash», alle Knopfprüfungen
      (`#btn-action` existiert nicht), «zustandsloser Eintrag …»
      (`w.ACTIONS` ist `undefined`). Falls stattdessen schon der erste
      `page.goto` scheitert, ist Playwright/Chromium nicht installiert —
      `pip install playwright && playwright install chromium` nachziehen und
      diesen Befund am Ende in `CLAUDE.md` festhalten.

- [ ] **Step 3: Den roten Lauf festhalten.** Die Liste der Fehlschläge in die
      Commit-Nachricht des ersten Codecommits übernehmen, damit im PR sichtbar
      ist, was vorher nicht ging.

---

### Task 2: Griffe in den drei Modellen (`js/models.js`)

Die Modelle bekommen benannte `userData`-Griffe, sonst nichts. Kein Verhalten,
kein `sfx`, kein Spielstand — genau wie `hamsterrad()` nur `userData.wheel`
setzt (`js/models.js:139`).

**Files:**
- Modify: `js/models.js` (Funktionen `lampe` `js/models.js:106-109`,
  `badewanne` `js/models.js:115-121`, `fenster` `js/models.js:207-213`)

**Interfaces:**
- `lampe()` → `g.userData.bulb` (Kugelmesh mit instanzeigenem Material),
  `g.userData.shade` (Schirmzylinder)
- `badewanne()` → `g.userData.water` (Wasserscheibe)
- `fenster()` → `g.userData.sash` (`THREE.Group` mit Scheibe und Sprossen,
  Drehpunkt an der Scheibenunterkante)

**Steps:**

- [ ] **Step 1: Lampe.** `js/models.js:106-109` ersetzen durch:

```javascript
  lampe() { const g = G();
    cyl(g, 0.14, 0.18, 0.05, MAT.woodD, 0, 0.025); cyl(g, 0.025, 0.025, 0.85, MAT.wood, 0, 0.45);
    /* Schirm und Birne sind schaltbar (Issue #41), darum bekommt die Birne ein
       eigenes Material: MAT.glow ist modulweit geteilt, ein Schalten daran
       träfe jede Lampe im Turm gleichzeitig. */
    g.userData.shade = cyl(g, 0.12, 0.24, 0.24, MAT.orange.clone(), 0, 0.95);
    g.userData.bulb = sph(g, 0.06, MAT.glow.clone(), 0, 0.86);
    return g; },
```

      Der Schirm wird mitgeklont, weil `js/game.js` beim Einschalten sein
      `emissive` leicht anhebt (Spec «Lampe — Licht»); `MAT.orange` wird von
      `regal`, `teppich` und `ofen` mitbenutzt (`js/models.js:96`,
      `js/models.js:103`) und darf nicht mutiert werden.

- [ ] **Step 2: Badewanne.** In `js/models.js:115-121` die Zuweisung der
      Wasserscheibe umschreiben, Rest unverändert:

```javascript
    /* Wasser ist schaltbar (Issue #41) — js/game.js greift über userData.water
       zu und ändert nur visible/scale/position, nie das geteilte MAT.water. */
    const w = cyl(g, 0.29, 0.29, 0.03, MAT.water, 0, 0.42, 0, 24); w.scale.x = 1.35;
    g.userData.water = w;
```

- [ ] **Step 3: Fenster.** `js/models.js:207-213` so umbauen, dass Scheibe und
      Sprossen in einer Kippgruppe hängen. Rahmen (0.74 × 0.94), Fensterbank
      und die roten Läden bleiben unverändert am Gruppenursprung:

```javascript
  fenster() { const g = G();
    box(g, 0.74, 0.94, 0.06, MAT.woodD, 0, 0, 0.03);
    /* Kippflügel (Issue #41): Scheibe und Sprossen hängen in einer Gruppe,
       deren Drehpunkt auf der Scheibenunterkante sitzt (y = -0.41). Offen ist
       rotation.x = -0.45; ein nach innen aufschlagender Drehflügel würde bei
       0.62 Scheibenbreite durch Schrank und Regal schneiden — Wandobjekte
       kennen keine Kollisionsprüfung (js/game.js:427-434). */
    const sash = G(); sash.position.y = -0.41; g.add(sash); g.userData.sash = sash;
    box(sash, 0.62, 0.82, 0.04, L(0xb8dcf0, { emissive: 0x9cc8e6, emissiveIntensity: 0.25 }), 0, 0.41, 0.05);
    box(sash, 0.04, 0.82, 0.03, MAT.woodD, 0, 0.41, 0.075);
    box(sash, 0.62, 0.04, 0.03, MAT.woodD, 0, 0.51, 0.075);
    box(g, 0.86, 0.06, 0.16, MAT.woodL, 0, -0.5, 0.08);
    [-0.34, 0.34].forEach(x => box(g, 0.14, 0.9, 0.05, MAT.red, x + (x > 0 ? 0.08 : -0.08), 0.02, 0.09));
    return g; },
```

      Prüfen: bei `rotation.x = 0` muss das Fenster **pixelgleich** aussehen
      wie vorher — die y-Werte innerhalb der Gruppe sind um +0.41 verschoben,
      damit das aufgeht (vorher 0 / 0.1, jetzt 0.41 / 0.51 in einer Gruppe bei
      −0.41).

- [ ] **Step 4: Gegenprobe im Browser.** Server starten, Seite öffnen, ein
      Fenster, eine Lampe und eine Badewanne setzen und mit der alten Ansicht
      vergleichen (Screenshot aus `/tmp/interaktive-objekte-shots` vom roten
      Lauf). Keine Konsolenfehler. Server anschliessend über seinen Port
      beenden, nie `pkill -f`.

- [ ] **Step 5: Commit.**
      `git add js/models.js && git commit -m "feat(einrichten): benannte Griffe an Lampe, Badewanne und Fenster (#41)"`

---

### Task 3: Zustand und Registry in `js/game.js`

Der Kern: `DEFAULT_ON`, `isOn`, `ACTIONS`, die drei `apply*`-Funktionen und
`applyItemState`. Noch keine Bedienung — nach dieser Task lädt ein Spielstand
mit `on`-Feldern korrekt, aber es gibt keinen Knopf.

**Files:**
- Modify: `js/game.js`

**Interfaces:**
- `isOn(entry) -> boolean`
- `applyItemState(mesh, animate)` — liest `mesh.userData.pick.entry`, ruft die
  passende `apply`-Funktion; `animate === false` setzt den Endzustand sofort.
- `applyLampe(mesh, on, q)`, `applyWanne(mesh, on, q)`,
  `applyFenster(mesh, on, q)` — `q` läuft von 0 (Start) bis 1 (Ende).
- `ACTIONS[id] = { doOn, doOff, apply, sound } | { label, sound }`
- Debug-Export (`js/game.js:1188`) wird um `ACTIONS` und `isOn` erweitert.

**Steps:**

- [ ] **Step 1: Zustandshelfer.** Direkt vor `placeItemMesh`
      (`js/game.js:447`) einfügen:

```javascript
/* ---------- Schaltbare Objekte (Issue #41) ---------- */
/* Der Zustand ist ein einziges Feld `on` am Eintrag in state.rooms. Fehlt es,
   greift DEFAULT_ON — und DEFAULT_ON bildet exakt das Aussehen ab, das die
   Modelle vor dieser Änderung hatten. Ein alter Spielstand sieht damit gleich
   aus wie vorher und wird beim Laden NICHT umgeschrieben (anders als bei der
   Tapete, js/game.js:379-390 — dort änderte sich die Form des Werts, hier
   fehlt nur ein Feld mit wohldefinierter Vorgabe). */
const DEFAULT_ON = { lampe: true, badewanne: true, fenster: false };
const isOn = en => en.on === undefined ? !!DEFAULT_ON[en.id] : en.on;

const BULB_ON = 0xffd98a, BULB_OFF = 0xcfc0a4, SHADE_ON = 0x3a2408;
function applyLampe(m, on, q) {
  const bulb = m.userData.bulb, shade = m.userData.shade;
  if (!bulb) return;
  const f = on ? q : 1 - q;   /* 0 = aus, 1 = an */
  bulb.material.color.setHex(f > 0.5 ? BULB_ON : BULB_OFF);
  /* Bei Nacht deutlich heller als bei Tag — das ist der Ersatz für eine
     echte Lichtquelle pro Lampe (Spec A5). */
  bulb.material.emissiveIntensity = f * (0.5 + 0.5 * nightK);
  if (shade) shade.material.emissive.setHex(f > 0.5 ? SHADE_ON : 0x000000);
}
function applyWanne(m, on, q) {
  const w = m.userData.water; if (!w) return;
  const f = on ? q : 1 - q;
  w.scale.y = 0.05 + 0.95 * f;
  w.position.y = 0.115 + 0.305 * f;
  w.visible = f > 0.02;
}
const SASH_OPEN = -0.45;
function applyFenster(m, on, q) {
  const s = m.userData.sash; if (!s) return;
  s.rotation.x = SASH_OPEN * (on ? q : 1 - q);
}

/* Registry der Objekte, die etwas tun.
   - Eintrag MIT `apply` trägt einen Zustand (Feld `on` im Spielstand).
   - Eintrag OHNE `apply`, nur mit `label` + `sound`, ist ein reiner Auslöser.
     Das ist der Fall, den die Instrumente aus Issue #36 brauchen: Tipp -> Ton,
     kein Zustand, kein save(). Ein Instrument kostet dann genau eine Zeile
     hier plus einen sfx-Effekt. */
const ACTIONS = {
  lampe:     { doOn: 'Licht an',     doOff: 'Licht aus',    apply: applyLampe,   sound: () => sfx.click() },
  fenster:   { doOn: 'Fenster auf',  doOff: 'Fenster zu',   apply: applyFenster, sound: () => sfx.creak() },
  badewanne: { doOn: 'Wanne füllen', doOff: 'Wanne leeren', apply: applyWanne,   sound: on => on ? sfx.fill() : sfx.drain() },
};
const actionLabel = en => { const a = ACTIONS[en.id]; if (!a) return null;
  return a.label || (isOn(en) ? a.doOff : a.doOn); };
/* animate === false: Endzustand sofort setzen (beim Aufbau aus dem Spielstand). */
function applyItemState(m, animate) {
  const en = m.userData.pick.entry, a = ACTIONS[en.id];
  if (!a || !a.apply) return;
  const on = isOn(en);
  if (animate === false) { a.apply(m, on, 1); return; }
  tween(0.7, q => a.apply(m, on, q));
}
```

- [ ] **Step 2: Beim Aufbau anwenden.** In `placeItemMesh` die Zeile
      `if (m.userData.wheel) spinners.push(m.userData.wheel);`
      (`js/game.js:463`) so ergänzen:

```javascript
  if (m.userData.wheel) spinners.push(m.userData.wheel);
  applyItemState(m, false);
```

      Damit wird jedes geladene und jedes neu gesetzte Objekt genau einmal in
      seinen Zustand gebracht — ohne Animation und ohne Ton.

- [ ] **Step 3: `nightK` muss vor `applyLampe` deklariert sein.** `nightK`
      steht heute bei `js/game.js:872`, also **nach** der neuen Stelle. Da
      `applyLampe` erst zur Laufzeit gerufen wird und `let nightK` per
      Hoisting in der temporalen Todzone läge, muss die Deklaration nach oben:
      `let nightK = state.night ? 1 : 0;` zu den übrigen Zustandsvariablen
      direkt unter `state`/`save` (`js/game.js:36-42`) verschieben und an der
      alten Stelle die Zeile entfernen. Der Kommentar `/* Tag/Nacht */`
      (`js/game.js:871`) bleibt bei `applyNight`.

- [ ] **Step 4: Debug-Export erweitern.** `js/game.js:1188` um zwei Felder
      ergänzen, damit die Playwright-Prüfung den zustandslosen Fall testen kann:

```javascript
window.wipfelkratzer = { state, floorGroups, roofG, roofStairG, roofGapG, scene, camera, controls, WALL_KEYS, get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; }, ACTIONS, isOn };
```

- [ ] **Step 5: Zwischenprüfung.** Verifikationsskript laufen lassen. Jetzt
      müssen die Prüfungen aus Abschnitt 1 und 2 grün sein (alter Spielstand
      lädt, Griffe vorhanden, Vorgaben stimmen, zwei Lichter); die
      Knopfprüfungen bleiben rot, weil `#btn-action` noch fehlt. Im Vordergrund
      aufrufen, mit grosszügigem `timeout`.

- [ ] **Step 6: Commit.**
      `git add js/game.js && git commit -m "feat(einrichten): Zustand und Registry für schaltbare Objekte (#41)"`

---

### Task 4: Geräusche

Drei neue Effekte im bestehenden `sfx`-Baukasten, gebaut aus `tone()`
(`js/game.js:922-929`) und `noiseBurst()` (`js/game.js:930-940`). Keine
Audiodatei, kein Ladepfad.

**Files:**
- Modify: `js/game.js` (`sfx`, `js/game.js:948-956`)

**Interfaces:**
- `sfx.click()` — Lichtschalter
- `sfx.creak()` — Fensterknarzen
- `sfx.fill()` / `sfx.drain()` — Wasser ein / aus

**Steps:**

- [ ] **Step 1: Effekte ergänzen.** In das `sfx`-Objekt aufnehmen, vor der
      schliessenden Klammer, im Stil der bestehenden Einträge (jeder prüft
      zuerst `if (!AC) return`, damit vor `#btn-start` nichts klingt):

```javascript
  /* Lichtschalter: kurzer, trockener Klick aus zwei Rauschstössen. */
  click() { if (!AC) return; const t = AC.currentTime;
    noiseBurst(t, 0.03, 5200, 1800, 0.18); tone(196, t, 0.06, 'square', 0.08); },
  /* Fenster: tiefes Holzknarzen, das in der Tonhöhe wandert. */
  creak() { if (!AC) return; const t = AC.currentTime;
    const o = tone(150, t, 0.45, 'sawtooth', 0.07);
    if (o) o.frequency.exponentialRampToValueAtTime(96, t + 0.4);
    noiseBurst(t + 0.05, 0.3, 900, 320, 0.05); },
  /* Wasser läuft ein: rauschen, das heller wird, dazu ein steigender Ton. */
  fill() { if (!AC) return; const t = AC.currentTime;
    noiseBurst(t, 0.9, 700, 3000, 0.13);
    const o = tone(280, t, 0.85, 'sine', 0.05);
    if (o) o.frequency.exponentialRampToValueAtTime(520, t + 0.8); },
  /* Wasser läuft ab: dasselbe rückwärts, mit Gluckern. */
  drain() { if (!AC) return; const t = AC.currentTime;
    noiseBurst(t, 0.9, 2600, 420, 0.12);
    [0, 0.22, 0.46, 0.68].forEach((d, i) => tone(220 - i * 32, t + d, 0.12, 'sine', 0.07)); },
```

      `noiseBurst` filtert mit `exponentialRampToValueAtTime`, das keinen
      Zielwert 0 verträgt — alle Werte oben sind positiv, das ist kein Zufall.

- [ ] **Step 2: Von Hand hören.** Server starten, Startknopf drücken, alle vier
      Effekte über die Konsole auslösen — `sfx` ist nicht exportiert, darum
      über die Oberfläche prüfen, sobald Task 5 den Knopf gebracht hat; bis
      dahin genügt ein Blick in die Konsole auf Fehler beim Laden. Server über
      seinen Port beenden.

- [ ] **Step 3: Commit.**
      `git add js/game.js && git commit -m "feat(einrichten): Geräusche für Schalter, Fenster und Wasser (#41)"`

---

### Task 5: Bedienung — `#btn-action` in `#selbar`

**Files:**
- Modify: `index.html` (`#selbar`, `index.html:187-198`)
- Modify: `js/game.js` (`select`, `js/game.js:672-678`; Knopf-Handler bei
  `js/game.js:1043-1056`)

**Interfaces:**
- Neues Element `#btn-action`
- `updateActionBtn()` — setzt Sichtbarkeit und Beschriftung aus `selected`
- `toggleAction()` — Klickhandler

**Steps:**

- [ ] **Step 1: Markup.** In `index.html` zwischen `#wallpad` und `#btn-del`
      einfügen:

```html
  <button id="btn-action" class="hidden"></button>
```

      Kein eigenes CSS nötig: `#selbar button { min-height: 44px; font-size: 14px; }`
      (`index.html:73`) greift bereits, und `.hidden` ist die im Projekt
      übliche Sichtbarkeitsklasse (`js/game.js:675-677`).

- [ ] **Step 2: Beschriftung und Sichtbarkeit.** In `js/game.js` direkt nach
      `select` (`js/game.js:678`) einfügen und aus `select` heraus rufen:

```javascript
/* Der Aktionsknopf sagt, was der nächste Druck TUT — nicht, wie der Zustand
   gerade heisst. Er erscheint nur für Objekte, die in ACTIONS stehen. */
function updateActionBtn() {
  const b = $('btn-action');
  const label = selected ? actionLabel(selected.entry) : null;
  b.classList.toggle('hidden', !label);
  if (label) b.textContent = label;
}
```

      und in `select` als letzte Zeile vor `$('selbar').classList.add('on');`
      ein `updateActionBtn();` ergänzen.

- [ ] **Step 3: Schalten.** Bei den übrigen `#selbar`-Handlern
      (`js/game.js:1043-1056`), direkt vor `$('btn-del').onclick`:

```javascript
/* Antippen bleibt mit Auswählen belegt (js/game.js:1003-1005) — geschaltet
   wird über diesen Knopf. Ein Eintrag ohne `apply` (Instrumente, Issue #36)
   spielt nur seinen Ton und schreibt nichts in den Spielstand. */
function toggleAction() {
  if (!selected) return;
  const en = selected.entry, a = ACTIONS[en.id];
  if (!a) return;
  if (!a.apply) { a.sound(true); return; }
  const next = !isOn(en);
  en.on = next;
  a.sound(next);
  tween(0.7, q => a.apply(selected.mesh, next, q));
  updateActionBtn();
  /* Die Fassade hängt an den Lampenzuständen (applyNight) — ohne dieses
     Nachziehen hinkte sie bis zum nächsten Tag/Nacht-Wechsel hinterher. */
  if (en.id === 'lampe') applyNight(nightK);
  save();
}
$('btn-action').onclick = toggleAction;
```

      `tween` läuft hier gegen `selected.mesh` statt gegen einen mitgegebenen
      Mesh, weil der Benutzer währenddessen etwas anderes auswählen könnte —
      darum wird `selected.mesh` **vor** dem Tween in eine lokale Konstante
      gezogen:

```javascript
  const mesh = selected.mesh;
  tween(0.7, q => a.apply(mesh, next, q));
```

      (die lokale Konstante ist die Fassung, die eingebaut wird).

- [ ] **Step 4: Von Hand prüfen.** Server starten, Etage einrichten, alle drei
      Objekte setzen und schalten: Beschriftung dreht, Animation läuft, Ton
      kommt, Konsole bleibt still. Danach `#selbar` auf einem schmalen Viewport
      (390 px) mit ausgewähltem **Fenster** ansehen — das ist der breiteste
      Fall (Wandkreuz + Aktionsknopf + «Weg damit»). Die schon bekannte
      Überlappung mit `#btn-catalog` (`TODO.md:39`) wird hier **nicht**
      behoben; falls sie sich sichtbar verschlimmert, den Befund in `TODO.md`
      präzisieren, nicht die Leiste umbauen. Server über seinen Port beenden.

- [ ] **Step 5: Commit.**
      `git add index.html js/game.js && git commit -m "feat(einrichten): Aktionsknopf in der Auswahlleiste (#41)"`

---

### Task 6: Nachtkopplung — Lampen erhellen die Fassade

Löst `TODO.md:6` ein. `TODO.md:5` bleibt unangetastet.

**Files:**
- Modify: `js/game.js` (`applyNight`, `js/game.js:873-884`)

**Interfaces:**
- `floorLampState(i) -> { has: boolean, any: boolean }` — hat die Etage Lampen,
  und ist mindestens eine an?

**Steps:**

- [ ] **Step 1: Helfer.** Direkt vor `applyNight` einfügen:

```javascript
/* Issue #41: Bei Nacht verrät die Fassade, ob in der Wohnung Licht brennt.
   Eine Wohnung OHNE Lampe verhält sich weiter wie bisher (js/game.js:877-881)
   — sonst wären alle bestehenden Spielstände über Nacht schwarz. */
function floorLampState(i) {
  const lamps = roomOf(i).filter(e => e.id === 'lampe');
  return { has: lamps.length > 0, any: lamps.some(isOn) };
}
```

- [ ] **Step 2: Fassadenzeilen ersetzen.** In `applyNight` die Schleife
      (`js/game.js:877-881`) so fassen:

```javascript
  for (let i = 0; i <= MAXF; i++) { const ls = floorLampState(i);
    const lit = k > 0.5 && tenantIn(i) && (!ls.has || ls.any);
    floorGroups[i].userData.wins.forEach(w => { w.material.color.set(lit ? 0xffd98a : 0x6b4526);
      w.material.emissive.set(lit ? 0xffc257 : 0x000000); w.material.emissiveIntensity = lit ? 0.9 : 0; }); }
```

- [ ] **Step 3: Birnen nachziehen.** `applyNight` setzt `nightK = k` als erste
      Zeile; die Birnenhelligkeit hängt daran (`applyLampe` liest `nightK`).
      Am Ende von `applyNight`, vor dem Setzen von `$('btn-night').textContent`,
      ergänzen:

```javascript
  /* Birnen folgen der Tageszeit — applyLampe rechnet mit nightK. */
  for (let i = 0; i <= MAXF; i++) itemMeshes[i].forEach(m => {
    if (m.userData.pick.entry.id === 'lampe') applyLampe(m, isOn(m.userData.pick.entry), 1); });
```

      `itemMeshes` ist ein Objekt mit Zahl- und `'roof'`-Schlüsseln
      (`js/game.js:243`); Lampen gibt es nur in Wohnungen, die Schleife bis
      `MAXF` genügt. `itemMeshes[i]` kann vor dem Aufbau leer sein — die
      Initialisierung passiert beim Bau der Etagen, und `applyNight` wird
      zuerst bei `js/game.js:1189` gerufen, also danach; im Zweifel mit
      `(itemMeshes[i] || [])` absichern.

- [ ] **Step 4: Von Hand prüfen.** Server starten, drei Stockwerke bauen,
      Etage 1 mit Lampe einrichten, Etage 2 ohne Lampe bewohnen, auf Nacht
      schalten: Etage 2 leuchtet wie bisher, Etage 1 lässt sich über den
      Aktionsknopf sichtbar verdunkeln und wieder erhellen. Die Birne selbst
      ist bei Nacht deutlich heller als bei Tag. Server über seinen Port
      beenden.

- [ ] **Step 5: Commit.**
      `git add js/game.js && git commit -m "feat(einrichten): Lampen erhellen bei Nacht die Fassade (#41)"`

---

### Task 7: Verifikation grün fahren und Regressionsdurchgang

**Files:**
- Modify: `js/game.js`, `js/models.js`, `index.html` (nur, was die Prüfungen
  verlangen)
- Read: `/tmp/verify_interaktive_objekte.py`

**Interfaces:**
- Keine neuen. Diese Task korrigiert, sie erweitert nicht.

**Steps:**

- [ ] **Step 1: Vollen Lauf im Vordergrund.**
      `python3 /tmp/verify_interaktive_objekte.py <repo-root>` mit grosszügigem
      `timeout`. Erwartung: «Alles grün», Exit 0.

- [ ] **Step 2: Fehlschläge einzeln beheben.** Für jeden roten Punkt zuerst
      feststellen, ob der Code oder die Prüfung falsch liegt. Eine Prüfung darf
      nur dann geändert werden, wenn sie das Akzeptanzkriterium der Spec
      falsch abbildet — nicht, weil der Code sie nicht erfüllt. Häufig zu
      erwarten:
      - Beschriftungsvergleiche scheitern an Leerzeichen → `.strip()` ist im
        Skript schon drin, also liegt es an der Beschriftung im Code.
      - «Etage 1 wird dunkel» scheitert, weil `applyNight` nach dem Schalten
        nicht gerufen wird → Task 5, Step 3.
      - «alter Spielstand wird nicht umgeschrieben» scheitert, weil irgendwo
        ein `save()` beim Laden passiert → Aufrufkette prüfen; `applyItemState`
        darf nichts speichern.

- [ ] **Step 3: Screenshots ansehen.** Alle vier Bilder aus
      `/tmp/interaktive-objekte-shots` öffnen und beurteilen: Kippflügel als
      solcher erkennbar, leere Wanne sieht leer aus (nicht «Wasser
      durchsichtig»), erleuchtete und dunkle Fassade unterscheidbar, `#selbar`
      auf 390 px Breite bedienbar.

- [ ] **Step 4: Regressionsdurchgang von Hand**, weil das Skript nur prüft, was
      es kennt. Server starten und in einem frischen Spiel (Knopf «Neu
      anfangen», zweimal drücken) der Reihe nach:
      1. Drei Stockwerke bauen, eine Wohnung einrichten, Bewohner zieht ein.
      2. Tapete und Bodenbelag setzen und wieder entfernen — `applyLook` darf
         unverändert funktionieren.
      3. Ein Möbel verschieben, drehen, löschen; ein Wandobjekt mit dem Kreuz
         bewegen.
      4. Cutaway «Wände weg», Dachterrasse einrichten, Dachparty feiern.
      5. Ein Foto schiessen und in der Galerie ansehen.
      6. Tag/Nacht mehrfach umschalten, dazwischen Lampen schalten.
      7. Seite neu laden und alles wiederfinden.
      Server über seinen Port beenden, nie `pkill -f`.

- [ ] **Step 5: Commit der Korrekturen**, falls welche nötig waren:
      `git commit -am "fix(einrichten): Korrekturen aus dem Verifikationslauf (#41)"`

---

### Task 8: Changelog, TODO und Abschluss

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`

**Interfaces:**
- Keine. Diese Task ändert keinen Code.

**Steps:**

- [ ] **Step 1: Changelog.** Der Eintrag gehört unter `## [Unreleased]` — die
      Versionsnummer entsteht erst beim Release, nicht hier. Stil wie die
      bestehenden Einträge: deutscher Fliesstext unter `### Added`,
      Issue-Nummer in Klammern am Ende. `CHANGELOG.md` hat heute keinen
      `## [Unreleased]`-Abschnitt; er wird direkt über `## [0.5.0] - 2026-09-13`
      angelegt:

```markdown
## [Unreleased]

### Added

- Lampe, Badewanne und Fenster machen jetzt etwas: ein Knopf in der
  Auswahlleiste schaltet das Licht an und aus, lässt Wasser in die Wanne und
  wieder ab und kippt den Fensterflügel auf und zu — jedes mit eigenem
  Geräusch. Der Zustand bleibt beim Neuladen erhalten, und bei Nacht sieht man
  von draussen, in welcher Wohnung noch Licht brennt (#41)
```

- [ ] **Step 2: TODO fortschreiben.** In `TODO.md` die Zeile 6 («Bei Nacht soll
      die Lampe wirklich Licht geben — pro Lampe an/aus schaltbar»)
      **entfernen**. Zeile 5 («Tag/Nacht mit Beleuchtung (Innenlicht, Lampen
      leuchten richtig)») bleibt **unverändert** stehen — das ist die
      Beleuchtungsschicht selbst, nicht der Schalter. Unter «Erledigt»
      ergänzen:

```markdown
- [x] Fenster, Badewanne und Lampe sind schaltbar — mit Geräusch, gespeichert, und bei Nacht sieht man das Licht von aussen (#41)
```

- [ ] **Step 3: Gegenprüfung.** `grep -n "Tag/Nacht" TODO.md` muss genau eine
      Zeile liefern; `grep -n "pro Lampe" TODO.md` muss leer sein.

- [ ] **Step 4: Commit.**
      `git add CHANGELOG.md TODO.md && git commit -m "docs(einrichten): Changelog und TODO für #41"`

**Nicht Teil dieser Task:** `version.js` und ein `chore(release)`-Commit. Die
Version wird beim Schneiden des Release gehoben, nachdem der PR gemergt ist —
ein Feature-Plan, der das selbst tut, kollidiert mit jedem anderen Plan, der
gerade offen ist.
