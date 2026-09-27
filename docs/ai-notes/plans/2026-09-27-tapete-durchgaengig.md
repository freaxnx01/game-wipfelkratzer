# Plan — Tapete durchgängig statt unterbrochen (Issue #98)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Tapete läuft in jeder Wohnung wie eine Bahn um den Raum — gleich
grosse Kacheln auf allen vier Wänden, ganze Kachelzahlen, kein Massstabssprung
in der Ecke und keine angeschnittene Musterreihe an der Decke.

**Architecture:** Zwei kleine Eingriffe. In `js/models.js` bekommt die
Wandtextur `repeat (1, 1)` statt `(5, 1.6)`, und ein neuer exportierter Helfer
`tapeziereUV(geo, breite, hoehe)` multipliziert die uv-Werte einer
Panelgeometrie mit der Kachelzahl dieser Wand (`WALL_TILE = 1.2` Meter,
gerundet auf ganze Kacheln). In `js/game.js` schickt `makeFloor` die drei
`panel(...)`-Geometrien durch diesen Helfer. Die Textur bleibt eine einzige
zwischengespeicherte Instanz pro Muster — die Kachelung steckt in der
Geometrie, nicht in der Textur.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap, `OrbitControls`.
Kein Build, kein Bundler, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-tapete-durchgaengig-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), Anredefürwörter gross (`Du`,
  `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei**.
- **Eine Textur pro Muster.** Der Zwischenspeicher `texCache`
  (`js/models.js:704`) bleibt, wie er ist — keine Texturkopie pro Wand, pro
  Etage oder pro Material (Spec, E1). `w.matCount()` darf nicht wachsen.
- **Nur die Tapete.** Der Bodenbelag (`repeat (4, 3)`) bleibt unverändert
  (Spec, E5). Decke, Wandkerne und die Aussenhaut (`MAT.plaster`) werden nicht
  angefasst.
- **Kein neues Feld im Spielstand**, kein Eintrag in `js/standdatei.js`, keine
  Migration (Spec, E6). Alte Spielstände müssen ohne Zutun weiterlaufen.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Fixed`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `fix(turm)` für den Code, `docs(changelog)` für
  den Changelog.

## Was dieser Plan nicht baut

Keinen durchgängigen Bodenbelag, keine Tapete an der Decke, keinen
`offset`-Versatz für eine exakte Musterfortsetzung über die Ecke, keine neuen
Tapetenmuster, keinen Schalter und keine Einstellung. Wer davon etwas anfängt,
hat den Zuschnitt verlassen.

## File Structure

| Datei | Rolle in dieser Änderung |
|---|---|
| `js/models.js` | Kachelmass `WALL_TILE`, Helfer `tapeziereUV`, `lookTexture` für Wände auf `repeat (1, 1)` |
| `js/game.js` | `makeFloor` schickt die vier Wandpanele durch `tapeziereUV`; Debug-Hook gibt `WALL_TILE` heraus |
| `CHANGELOG.md` | Eintrag unter `[Unreleased]` → `### Fixed` |

Neue Dateien: keine. Beide JS-Dateien sind gewachsen, werden hier aber nur
punktuell angefasst — kein Aufteilen, kein Umbauen drumherum.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-27-tapete-durchgaengig/`
(git-ignoriert über `.superpowers/`). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9081–9085** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Geprüft wird nur auf `pageerror`.
- **Mehrere Etagen** entstehen über den Debug-Hook (`window.wipfelkratzer`,
  `js/game.js:2810`): `w.floorGroup(1); w.floorGroup(2); w.floorGroup(3);`.
  `floorGroup(i)` baut die Etagengruppe bei Bedarf (`js/game.js:445`) — das
  genügt für eine Geometriemessung, die Etage muss dafür nicht sichtbar sein.
  **Nicht** `w.speichern()` benutzen: das ist `schreibeStand`, der Schreiber
  für die Standdatei, nicht das `save()` in den `localStorage`.
- Dieser Plan misst **Geometrie**, keine Kameraflüge — kein Warten auf
  `tweenCount()` nötig. Ein `page.wait_for_timeout(300)` nach einem Klick
  genügt, weil `applyLook` synchron läuft.
- Jeder `page.click` bekommt `timeout=20000` oder mehr.

Der Kern jeder Messung ist immer dieselbe Funktion im Browser: aus einem
Wandpanel die uv-Spanne der Grossfläche und das echte Mass in Metern lesen und
daraus Meter pro Kachel rechnen.

```js
/* Im Browser, über window.wipfelkratzer. Liefert pro Wand die Kachelzahl und
   die Kachelgrösse in Metern. */
(etage => {
  const w = window.wipfelkratzer, g = w.floorGroups[etage];
  const out = {};
  w.WALL_KEYS.forEach(key => {
    const m = g.userData.wallPanels[key], geo = m.geometry, uv = geo.attributes.uv;
    geo.computeBoundingBox();
    const bb = geo.boundingBox, sp = new w.THREE.Vector3(); bb.getSize(sp);
    /* Die Grossfläche einer Wand ist die breiteste Achse ausser y. */
    const breite = Math.max(sp.x, sp.z), hoehe = sp.y;
    let umax = 0, vmax = 0;
    for (let i = 0; i < uv.count; i++) { umax = Math.max(umax, uv.getX(i)); vmax = Math.max(vmax, uv.getY(i)); }
    out[key] = { breite, hoehe, u: umax, v: vmax, mProU: breite / umax, mProV: hoehe / vmax };
  });
  return out;
})
```

---

### Task 1: Kachelmass und uv-Helfer in `js/models.js`

**Files:**
- Modify: `js/models.js:704-713` (Texturzwischenspeicher und `lookTexture`)

**Interfaces:**
- Consumes: nichts aus früheren Tasks.
- Produces:
  - `export const WALL_TILE = 1.2` — Kantenlänge einer Tapetenkachel in Metern.
  - `export function tapeziereUV(geo, breite, hoehe)` — skaliert das
    `uv`-Attribut von `geo` (eine `THREE.BufferGeometry`) auf
    `Math.max(1, Math.round(breite / WALL_TILE))` Kacheln waagrecht und
    `Math.max(1, Math.round(hoehe / WALL_TILE))` senkrecht; setzt
    `uv.needsUpdate = true` und gibt **dieselbe** `geo` zurück, damit der
    Aufruf direkt in ein `new THREE.BoxGeometry(...)` eingeschachtelt werden
    kann.

- [ ] **Schritt 1: Den roten Messwert festhalten**

Vor jeder Änderung den Ist-Zustand messen, damit «grün» später etwas bedeutet.
Server starten (Port aus 9081–9085), dann im Vordergrund:

```python
# .superpowers/sdd/2026-09-27-tapete-durchgaengig/mess.py
import json, sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[1]
MESSUNG = open(".superpowers/sdd/2026-09-27-tapete-durchgaengig/messung.js").read()

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(f"http://localhost:{PORT}/", wait_until="load")
    page.wait_for_function("window.wipfelkratzer !== undefined", timeout=60000)
    page.evaluate("() => { const w = window.wipfelkratzer; [1, 2, 3].forEach(i => w.floorGroup(i)); }")
    for etage in (0, 1):
        werte = page.evaluate(f"({MESSUNG})({etage})")
        print(f"Etage {etage}: {json.dumps(werte, indent=2)}")
        mpu = [v["mProU"] for v in werte.values()]
        print(f"  groesster Unterschied waagrecht: {max(mpu) / min(mpu):.3f}")
    print("pageerror:", fehler)
    b.close()
```

`messung.js` ist die Funktion aus dem Harness-Abschnitt oben, wörtlich.

Ausführen: `python3 .superpowers/sdd/2026-09-27-tapete-durchgaengig/mess.py <port>`

Erwartet (rot): Etage 0 zeigt `u = 5` und `v = 1.6` auf allen vier Wänden,
`mProU` rund `1.672` hinten/vorne gegen rund `1.120` links/rechts, grösster
Unterschied **rund 1.49**. `pageerror: []`.

- [ ] **Schritt 2: Kachelmass und Helfer schreiben**

In `js/models.js` direkt vor `const texCache = {};` (heute Zeile 704)
einfügen:

```js
/* Eine Tapete soll wie eine Bahn um den Raum laufen: überall gleich grosse
   Kacheln und auf jeder Wand eine ganze Zahl davon, damit das Muster in der
   Ecke an einer Kachelkante weitergeht statt mitten im Punkt abzureissen
   (#98). Die Kachelzahl steckt deshalb in den uv-Werten der Wand — nicht in
   der Textur, die sich alle Wände teilen. */
export const WALL_TILE = 1.2;
const kacheln = meter => Math.max(1, Math.round(meter / WALL_TILE));
export function tapeziereUV(geo, breite, hoehe) {
  const uv = geo.attributes.uv, u = kacheln(breite), v = kacheln(hoehe);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  uv.needsUpdate = true;
  return geo;
}
```

- [ ] **Schritt 3: Die feste Kachelzahl aus der Wandtextur nehmen**

In `lookTexture` (heute `js/models.js:712`) die Zeile

```js
  t.repeat.set(kind === 'wall' ? 5 : 4, kind === 'wall' ? 1.6 : 3); t.colorSpace = THREE.SRGBColorSpace;
```

ersetzen durch

```js
  /* Wände kacheln über ihre uv-Werte (tapeziereUV), Böden weiterhin über die
     Textur — der Bodenbelag ist nicht Teil von #98. */
  if (kind === 'floor') t.repeat.set(4, 3);
  t.colorSpace = THREE.SRGBColorSpace;
```

`THREE.Texture` startet mit `repeat (1, 1)`, für Wände ist also nichts zu
setzen.

- [ ] **Schritt 4: Messen — jetzt sind die Wände unkachelig**

Denselben Lauf wie in Schritt 1 wiederholen.

Erwartet: `u = 1`, `v = 1` auf allen Wänden (die uv-Skalierung kommt erst in
Task 2), `pageerror: []`. Das ist ein bewusster Zwischenstand: eine einzige
riesige Kachel pro Wand. Er beweist, dass Schritt 3 gegriffen hat und die
Seite weiterhin ohne Fehler lädt.

- [ ] **Schritt 5: Committen**

```bash
git add js/models.js
git commit -m "$(cat <<'EOF'
refactor(tapete): Kachelzahl der Wandtextur in die Geometrie verlagern

Die Wandtextur trug bisher eine feste Kachelzahl (5 × 1.6) für jede Wand,
egal wie breit sie in Metern ist. Damit hing die Kachelgrösse allein an der
Wandbreite und sprang in jeder Ecke um. WALL_TILE und tapeziereUV rechnen
die Kachelzahl stattdessen aus dem echten Mass; die Textur bleibt eine
einzige zwischengespeicherte Instanz pro Muster.

Refs #98

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V6sbyGYqz5PaHY3WqtS8bK
EOF
)"
```

---

### Task 2: Die vier Wandpanele in `js/game.js` tapezieren

**Files:**
- Modify: `js/game.js:5` (Import), `js/game.js:404`, `js/game.js:407`,
  `js/game.js:412` (die drei `panel(...)`-Aufrufe), `js/game.js:2810`, `js/game.js:2818`
  (Debug-Hook)

**Interfaces:**
- Consumes: `WALL_TILE` und `tapeziereUV(geo, breite, hoehe)` aus Task 1.
- Produces:
  - `window.wipfelkratzer.WALL_TILE` — das Kachelmass in Metern, damit eine
    Prüfung die erwartete Kachelzahl selbst nachrechnen kann, statt 1.2
    doppelt zu führen.
  - `window.wipfelkratzer.applyLook` — die schon vorhandene Funktion
    `applyLook(k)` (`js/game.js:590`), damit eine Prüfung eine Tapete setzen
    kann, ohne sich durch den Katalog zu klicken.

- [ ] **Schritt 1: Die Messung ist noch rot**

Der Lauf aus Task 1 Schritt 4 zeigt `u = 1`, `v = 1` — eine Kachel pro Wand,
also überhaupt kein Muster. Das ist der rote Ausgangspunkt dieses Tasks. Ihn
noch einmal laufen lassen und festhalten.

Erwartet: `u === 1 && v === 1` auf allen vier Wänden beider Etagen,
`pageerror: []`.

- [ ] **Schritt 2: Helfer importieren**

In `js/game.js:5` die Importliste aus `./models.js` um `tapeziereUV` und
`WALL_TILE` erweitern. Die Zeile lautet heute:

```js
  makeCustomFurniture, lookCanvas, lookTexture, makeFurniture, makeAnimal, makeWilli,
```

und danach:

```js
  makeCustomFurniture, lookCanvas, lookTexture, tapeziereUV, WALL_TILE, makeFurniture, makeAnimal, makeWilli,
```

- [ ] **Schritt 3: Die drei `panel(...)`-Aufrufe durch den Helfer schicken**

In `makeFloor` gibt es genau drei Stellen, die ein tapezierbares Innenpanel
bauen. Die Breite ist jeweils das Mass **entlang der Wand**, die Höhe immer
`h`.

Rückwand — heute `js/game.js:404`:

```js
  panel('back', new THREE.BoxGeometry(w - 0.24, h, WALL_PANEL), 0, h / 2, -d / 2 + WALL_T - WALL_PANEL / 2, g);
```

wird zu

```js
  panel('back', tapeziereUV(new THREE.BoxGeometry(w - 0.24, h, WALL_PANEL), w - 0.24, h), 0, h / 2, -d / 2 + WALL_T - WALL_PANEL / 2, g);
```

Seitenwände — heute `js/game.js:407`:

```js
    panel(s > 0 ? 'right' : 'left', new THREE.BoxGeometry(WALL_PANEL, h, d), s * (w / 2 - WALL_T + WALL_PANEL / 2), h / 2, 0, g);
```

wird zu

```js
    panel(s > 0 ? 'right' : 'left', tapeziereUV(new THREE.BoxGeometry(WALL_PANEL, h, d), d, h), s * (w / 2 - WALL_T + WALL_PANEL / 2), h / 2, 0, g);
```

Vorderwand — heute `js/game.js:412`:

```js
  panel('front', new THREE.BoxGeometry(w - 0.24, h, WALL_PANEL), 0, h / 2, 0.06 - WALL_T + WALL_PANEL / 2, front);
```

wird zu

```js
  panel('front', tapeziereUV(new THREE.BoxGeometry(w - 0.24, h, WALL_PANEL), w - 0.24, h), 0, h / 2, 0.06 - WALL_T + WALL_PANEL / 2, front);
```

Über dem Block der Rückwand (heute der Kommentar ab `js/game.js:402`) den
Grund in einem Satz ergänzen:

```js
  /* Die Kachelzahl der Tapete kommt aus dem echten Wandmass, damit die Kacheln
     auf allen vier Wänden gleich gross sind und in der Ecke an einer
     Kachelkante aufeinandertreffen (#98). */
```

- [ ] **Schritt 4: Kachelmass und `applyLook` auf den Debug-Hook legen**

In `js/game.js:2810` das Objekt `window.wipfelkratzer` um `WALL_TILE`
erweitern — dieselbe Zeile, auf der schon `WALL_KEYS` steht:

```js
window.wipfelkratzer = { THREE, state, floorGroups, roofG, roofStairG, roofGapG, gartenG, gardenEdge, scene, camera, controls, WALL_KEYS, WALL_TILE, FURN_COLORS, TINTABLE,
```

Und `applyLook` dazu, in der Zeile, auf der schon `floorGroup` steht
(heute `js/game.js:2818`):

```js
  MAXF, tenantOf, topY, floorGroup, applyLook, catalogIds: CATALOG.map(c => c.id),
```

`applyLook` ist bestehender Code und wird nicht verändert — es wird nur
herausgereicht, wie `floorGroup` und `clampEntry` daneben auch.

- [ ] **Schritt 5: Messen — jetzt grün**

Den Lauf aus Task 1 Schritt 1 wiederholen, diesmal mit Behauptungen statt
blosser Ausgabe:

```python
# .superpowers/sdd/2026-09-27-tapete-durchgaengig/pruef.py
import sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[1]
MESSUNG = open(".superpowers/sdd/2026-09-27-tapete-durchgaengig/messung.js").read()

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(f"http://localhost:{PORT}/", wait_until="load")
    page.wait_for_function("window.wipfelkratzer !== undefined", timeout=60000)
    page.evaluate("() => { const w = window.wipfelkratzer; [1, 2, 3].forEach(i => w.floorGroup(i)); }")

    kachel = page.evaluate("() => window.wipfelkratzer.WALL_TILE")
    assert kachel == 1.2, f"WALL_TILE ist {kachel}"

    for etage in (0, 1, 2, 3):
        werte = page.evaluate(f"({MESSUNG})({etage})")
        for key, v in werte.items():
            assert abs(v["u"] - round(v["u"])) < 1e-6, f"Etage {etage} {key}: u = {v['u']} ist keine ganze Zahl"
            assert abs(v["v"] - round(v["v"])) < 1e-6, f"Etage {etage} {key}: v = {v['v']} ist keine ganze Zahl"
            assert v["u"] >= 1 and v["v"] >= 1, f"Etage {etage} {key}: Kachelzahl unter 1"
            assert abs(v["u"] - max(1, round(v["breite"] / kachel))) < 1e-6, f"Etage {etage} {key}: u passt nicht zum Mass"
            assert abs(v["v"] - max(1, round(v["hoehe"] / kachel))) < 1e-6, f"Etage {etage} {key}: v passt nicht zum Mass"
        masse = [v["mProU"] for v in werte.values()] + [v["mProV"] for v in werte.values()]
        spanne = max(masse) / min(masse)
        print(f"Etage {etage}: Spanne {spanne:.3f}")
        assert spanne < 1.30, f"Etage {etage}: Kachelgrössen laufen um {spanne:.3f} auseinander"

    assert not fehler, fehler
    print("alles gruen")
    b.close()
```

Ausführen: `python3 .superpowers/sdd/2026-09-27-tapete-durchgaengig/pruef.py <port>`

Erwartet: `alles gruen`. Etage 0 zeigt hinten/vorne `u = 7` (8.36 m → 1.194 m
pro Kachel), links/rechts `u = 5` (5.6 m → 1.120 m), senkrecht `v = 2`
(2.4 m → 1.200 m). Die Spanne über *alle* Kachelmasse einer Etage —
waagrecht wie senkrecht — bleibt unter 1.30; vor der Änderung lag allein der
waagrechte Ecksprung bei 1.49.

- [ ] **Schritt 6: Tapezieren geht weiter, und es entstehen keine neuen Materialien**

Zweiter Lauf im Vordergrund, gegen denselben Server:

```python
# .superpowers/sdd/2026-09-27-tapete-durchgaengig/pruef-tapezieren.py
import sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[1]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(f"http://localhost:{PORT}/", wait_until="load")
    page.wait_for_function("window.wipfelkratzer !== undefined", timeout=60000)

    vorher = page.evaluate("() => window.wipfelkratzer.matCount()")
    page.evaluate("""() => {
      const w = window.wipfelkratzer;
      w.state.wallpaper[0] = { back: 'punkte', left: 'punkte', right: 'punkte', front: 'punkte' };
      w.applyLook(0);
    }""")
    page.wait_for_timeout(300)
    gleich = page.evaluate("""() => {
      const w = window.wipfelkratzer, g = w.floorGroups[0];
      const maps = w.WALL_KEYS.map(k => g.userData.wallMats[k].map);
      return { alleGesetzt: maps.every(m => !!m), eineInstanz: new Set(maps).size };
    }""")
    nachher = page.evaluate("() => window.wipfelkratzer.matCount()")

    assert not fehler, fehler
    assert gleich["alleGesetzt"], "nicht jede Wand hat eine Textur"
    assert gleich["eineInstanz"] == 1, f"{gleich['eineInstanz']} Texturinstanzen statt einer"
    assert nachher <= vorher, f"Materialzahl gewachsen: {vorher} -> {nachher}"
    print("tapezieren gruen")
    b.close()
```

Hinweis: `w.state.wallpaper[0]` direkt zu setzen und `w.applyLook(0)` zu
rufen ist bewusst — es umgeht die Oberfläche und prüft genau das, worum es
geht: dass sich vier Wände **eine** Texturinstanz teilen.

Erwartet: `tapezieren gruen`.

- [ ] **Schritt 7: Ein Bild machen und hinsehen**

Die Zahlen sagen, dass es rechnerisch stimmt; das Bild sagt, ob es aussieht
wie eine durchgehende Bahn. Im Vordergrund einen Screenshot des Erdgeschosses
mit «Punkte» auf allen vier Wänden aufnehmen
(`page.screenshot(path=".superpowers/sdd/2026-09-27-tapete-durchgaengig/eg.png")`)
und anschauen: gleich grosse Punkte auf allen Wänden, an der Decke keine
halbe Punktreihe, in der Ecke kein Massstabssprung.

Sieht es falsch aus, obwohl die Zahlen grün sind: **nicht** die Prüfung
anpassen, sondern melden. Nach drei erfolglosen Versuchen anhalten und
erklären, was nicht aufgeht.

- [ ] **Schritt 8: Committen**

```bash
git add js/game.js
git commit -m "$(cat <<'EOF'
fix(turm): Tapete läuft durchgängig um den Raum

Die vier Wandpanele bekommen ihre Kachelzahl aus dem echten Wandmass, statt
überall fünf Kacheln zu tragen. Dadurch sind die Kacheln auf allen Wänden und
in allen Etagen gleich gross, und weil es ganze Kacheln sind, treffen sie in
der Ecke an einer Kachelkante aufeinander, statt mitten im Muster
abzubrechen. Senkrecht endet das Muster an der Decke ebenfalls an einer
Kachelkante (vorher 1.6 Kacheln).

Closes #98

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V6sbyGYqz5PaHY3WqtS8bK
EOF
)"
```

---

### Task 3: Changelog

**Files:**
- Modify: `CHANGELOG.md:7` (die Zeile `## [Unreleased]`)

**Interfaces:**
- Consumes: das fertige Verhalten aus Task 2.
- Produces: nichts, was Code liest.

- [ ] **Schritt 1: Eintrag schreiben**

Unter `## [Unreleased]` einen `### Fixed`-Abschnitt anlegen (falls noch
keiner da ist) und eintragen — Spielersicht, kein Code-Vokabular:

```markdown
## [Unreleased]

### Fixed

- Die Tapete läuft jetzt durchgängig um das Zimmer. Vorher waren die Punkte
  auf der breiten Rückwand deutlich grösser als auf den Seitenwänden, das
  Muster brach in jeder Ecke ab und an der Decke war die oberste Reihe
  angeschnitten (#98)
```

**`git cliff -o CHANGELOG.md` niemals ausführen** — es überschreibt die von
Hand geschriebenen Abschnitte aller früheren Versionen.

- [ ] **Schritt 2: Prüfen, dass sonst nichts verändert wurde**

```bash
git diff --stat CHANGELOG.md
```

Erwartet: nur `CHANGELOG.md` mit einer Handvoll hinzugefügter Zeilen und
**null** gelöschten.

- [ ] **Schritt 3: Committen und pushen**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(changelog): durchgängige Tapete eintragen

Refs #98

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V6sbyGYqz5PaHY3WqtS8bK
EOF
)"
git push -u origin HEAD
```

Der Push kommt **vor** einer allfälligen Abschlussprüfung — stirbt ein Lauf
mitten drin, ist die Arbeit trotzdem gesichert.

---

## Abschluss-Checkliste

- [ ] Seite lädt ohne `pageerror` (alle Läufe).
- [ ] Kachelzahlen sind auf jeder Wand jeder geprüften Etage ganze Zahlen.
- [ ] Grösster Unterschied der Kachelmasse innerhalb einer Etage unter 1.30
      (vorher 1.49 allein waagrecht).
- [ ] Alle vier Wände einer Wohnung teilen sich **eine** Texturinstanz;
      `matCount()` ist nicht gewachsen.
- [ ] Screenshot des Erdgeschosses mit «Punkte» von Hand angeschaut.
- [ ] Ein alter Spielstand (ohne Zutun im `localStorage`) lädt weiterhin —
      `js/standdatei.js` und `js/game.js:554-558` wurden nicht angefasst.
- [ ] Der Bodenbelag sieht aus wie vorher (`repeat (4, 3)` unverändert).
- [ ] `version.js` unverändert, kein `chore(release)`-Commit.
- [ ] Nichts unter `.superpowers/` committet.

## Funde ausserhalb des Zuschnitts

- **Der Bodenbelag hat dasselbe Problem.** `repeat (4, 3)` liegt auf einer
  Fläche, die sich pro Etage verjüngt (`js/models.js` `lookTexture`,
  `js/game.js:400`). Dieselbe Rechnung würde ihn lösen — bewusst nicht Teil
  von #98 (Spec, E5). Als eigenes Issue notieren, nicht hier mitmachen.
