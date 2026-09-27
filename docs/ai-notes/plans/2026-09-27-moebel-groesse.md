# Plan — Möbel um Faktoren vergrössern (Issue #99)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein ausgewähltes, frei stehendes Möbel lässt sich über eine Reihe in
der Auswahlleiste auf `1×`, `1,5×` oder `2×` stellen; die Grösse bleibt im
Spielstand und in der Sicherungsdatei erhalten, und eine Stufe, die nicht mehr
passt, wird mit Ton und Meldung abgelehnt.

**Architecture:** Ein optionales Zahlenfeld `scale` am Möbel-Eintrag in
`state.rooms[k]`. Angewendet wird es an genau **einer** Stelle —
`applyEntryScale(mesh, entry)` skaliert den Gruppenknoten, nie ein Kind —, und
alles, was über `Box3.setFromObject` rechnet (Begrenzung, Kollision,
Ablagehöhe, Auswahlrahmen), wächst dadurch von selbst mit. Die Bedienung ist
eine zweite Reihe neben der bestehenden Farbreihe.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap, `OrbitControls`,
`localStorage`. Kein Build, kein Bundler, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-moebel-groesse-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), Anredefürwörter gross (`Du`,
  `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei.**
- **Nur drei Stufen: `1`, `1.5`, `2`** (Spec, E2). Kein Schieberegler, keine
  Verkleinerung unter 1.
- **`scale === 1` wird nicht gespeichert, sondern gelöscht** (Spec,
  «Datenmodell»). Ein Spielstand ohne `scale` bleibt unverändert.
- **Skaliert wird ausschliesslich der Gruppenknoten des Möbels, nie ein Kind**
  (Spec, «Was mitwächst»). Die Schaltzustände greifen in Kinder ein
  (`applyWanne` setzt `w.scale.y`, `js/game.js:759`; `setFill` beim Pool,
  `js/game.js:810`) und dürfen davon nichts merken.
- **Genau eine Skalier-Fundstelle: `applyEntryScale`** (Spec, E7). Sie ist der
  Haken, an dem Issue #100 (ungleichmässiges Strecken in die Länge) später
  hängt. Kein zweiter Pfad, der `mesh.scale` direkt setzt — ausser der
  Einfahr-Animation, die den Faktor mitrechnet.
- **Keine Grösse für Wandobjekte (`WALL_ITEMS`) und keine für Tiere**
  (Spec, E4).
- **`DATEI_V` bleibt 2** (Spec, «Sicherungsdatei»). Ein zusätzliches optionales
  Feld ist kein Formatbruch.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(einrichten)` für den Code,
  `docs(changelog)` für den Changelog.

## Was dieser Plan nicht baut

Kein ungleichmässiges Strecken in die Länge (Issue #100), kein Verkleinern
unter 1×, keine Grösse für Wandobjekte oder Tiere, keine Grössenwahl im Katalog
vor dem Hinstellen, keine Skalierung von Räumen oder Stockwerken. Wer davon
etwas anfängt, hat den Zuschnitt verlassen.

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-27-moebel-groesse/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9081–9085** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr.**
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:2810-2830`). Er exportiert
  schon `state`, `itemMeshes`, `roomOf`, `addItem`, `select`, `deselect`,
  `enterEdit`, `speichern`, `tweenCount`, `THREE`.
- **Einen Turm aufbauen** geht über den Hook:
  `w.state.floors = 3; w.speichern();` und danach `page.reload()`, damit die
  Etagen wirklich entstehen.
- **Ein Möbel bekommt man so in einen Raum** (echter Pfad, inklusive
  Einfahr-Animation):

  ```python
  page.evaluate("""() => {
    const w = window.wipfelkratzer;
    w.enterEdit(1);            /* Stockwerk 1 einrichten */
    w.addItem('tisch');
  }""")
  page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)
  ```

  `addItem` wählt das neue Möbel gleich aus (`js/game.js:1528`), die
  Auswahlleiste ist danach offen.
- **Breite messen** statt Pixel vergleichen — der Faktor ist eine Zahl, kein
  Bild:

  ```python
  page.evaluate("""() => {
    const w = window.wipfelkratzer;
    const m = w.itemMeshes[1][0];
    const bb = new w.THREE.Box3().setFromObject(m);
    return { scaleX: m.scale.x, breite: bb.max.x - bb.min.x, hoehe: bb.max.y - bb.min.y };
  }""")
  ```

  `scaleX` prüft den Gruppenknoten (Global Constraints), `breite` prüft die
  Wirkung. Beide gehören in jede Messung.
- **Ein Reload prüft die Speicherung.** `save()` ist um 300 ms entprellt
  (`js/game.js:139`), also vor dem Reload `page.wait_for_timeout(500)` oder
  `w.speichern()` aufrufen.
- Kameraprüfungen kommen in diesem Plan nicht vor — gemessen werden
  Sichtbarkeiten, Zahlen und Speicherinhalte, alles synchron nach dem Klick.
  Wo doch auf eine Animation gewartet wird, wird auf **Ankunft**
  (`w.tweenCount() === 0`) gewartet, nie auf Stillstand.

---

### Task 1: Datenmodell und Skalierung

Die Grösse existiert als Feld, wird beim Aufbau angewendet und übersteht einen
Reload. Noch keine Bedienung — gesetzt wird in diesem Task über den Spielstand.

**Files:**
- Modify: `js/models.js:50-57` (neue Konstante `FURN_SIZES` neben `FURN_COLORS`)
- Modify: `js/game.js:3-8` (Import erweitern)
- Modify: `js/game.js:563-566` (`normalizeSize` neben `normalizeColor`)
- Modify: `js/game.js:707-714` (`replaceMesh`)
- Modify: `js/game.js:727-733` (`applyMove`, Schnappschuss)
- Modify: `js/game.js:791-816` (`placeItemMesh`)
- Modify: `js/game.js:1525-1526` (`addItem`, Einfahr-Animation)
- Modify: `js/game.js:2810-2830` (Debug-Hook: `FURN_SIZES`, `applyEntryScale`)
- Test: `.superpowers/sdd/2026-09-27-moebel-groesse/t1_skalierung.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Produces: `FURN_SIZES` — `Array<{ f: number, name: string }>` aus
  `js/models.js`, exportiert. Genau drei Einträge, `f` ist der Faktor.
- Produces: `sizeOf(entry)` — `number`. Liefert den gültigen Faktor eines
  Eintrags, `1` wenn `entry.scale` fehlt oder unbekannt ist.
- Produces: `applyEntryScale(mesh, entry, q)` — setzt `mesh.scale`. `q` ist ein
  optionaler Fortschritt für Animationen (Vorgabe `1`). **Die einzige Stelle,
  die `mesh.scale` eines Möbels setzt.**
- Produces: `normalizeSize(entry)` — entfernt ein ungültiges oder
  `1`-wertiges `scale` und setzt dabei `migrated = true`.
- Produces: `entry.scale` — optionales `number`-Feld am Eintrag in
  `state.rooms[k]`.

- [ ] **Step 1: Wegwerf-Prüfung schreiben (der erwartete Fehlschlag)**

`.superpowers/sdd/2026-09-27-moebel-groesse/t1_skalierung.py`:

```python
import json, sys
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1])
URL = f"http://localhost:{PORT}/"

MESS = """() => {
  const w = window.wipfelkratzer;
  const m = w.itemMeshes[1][0];
  const bb = new w.THREE.Box3().setFromObject(m);
  return { scaleX: m.scale.x, breite: bb.max.x - bb.min.x };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(URL, wait_until="networkidle")

    # Turm bauen und ein Möbel hinstellen
    page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
    page.reload(wait_until="networkidle")
    page.evaluate("() => { const w = window.wipfelkratzer; w.enterEdit(1); w.addItem('tisch'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)

    normal = page.evaluate(MESS)
    assert abs(normal["scaleX"] - 1) < 1e-6, f"Startgroesse nicht 1: {normal}"

    # Groesse im Spielstand setzen und neu laden
    page.evaluate("""() => {
      const w = window.wipfelkratzer;
      w.roomOf(1)[0].scale = 1.5;
      w.speichern();
    }""")
    page.reload(wait_until="networkidle")
    page.wait_for_function("window.wipfelkratzer.itemMeshes[1].length > 0", timeout=20000)
    gross = page.evaluate(MESS)
    assert abs(gross["scaleX"] - 1.5) < 1e-6, f"scale nicht angewendet: {gross}"
    assert abs(gross["breite"] - normal["breite"] * 1.5) < 0.02, f"Box waechst nicht mit: {gross} vs {normal}"

    # Ein unbekannter Wert faellt still weg
    page.evaluate("""() => {
      const w = window.wipfelkratzer;
      w.roomOf(1)[0].scale = 7;
      w.speichern();
    }""")
    page.reload(wait_until="networkidle")
    page.wait_for_function("window.wipfelkratzer.itemMeshes[1].length > 0", timeout=20000)
    krumm = page.evaluate(MESS)
    assert abs(krumm["scaleX"] - 1) < 1e-6, f"Fremdwert nicht entfernt: {krumm}"
    assert page.evaluate("() => window.wipfelkratzer.roomOf(1)[0].scale") is None, "scale-Feld nicht geloescht"

    assert not fehler, f"pageerror: {fehler}"
    print("T1 OK", json.dumps({"normal": normal, "gross": gross}))
    b.close()
```

- [ ] **Step 2: Prüfung laufen lassen und den Fehlschlag sehen**

```bash
python3 -m http.server 9081 >/dev/null 2>&1 &
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t1_skalierung.py 9081
```

Erwartet: `AssertionError: scale nicht angewendet: {'scaleX': 1.0, ...}` — das
Feld wird heute ignoriert.

- [ ] **Step 3: `FURN_SIZES` in `js/models.js` anlegen**

Direkt unter `FURN_COLORS` (nach `js/models.js:57`), vor `TINTABLE`:

```js
/* Grössenstufen für frei stehende Möbel (Issue #99). Drei feste Faktoren
   statt eines Schiebereglers: mit dem Finger treffbar, und «zurück auf
   normal» ist ein Knopf statt einer Zielsuche. Der Faktor 1 ist die
   Vorgabe und wird im Spielstand nicht gespeichert.
   Die Längsachse aus Issue #100 kommt hier NICHT dazu — sie ist ein
   zweites, unabhängiges Feld am Eintrag. */
export const FURN_SIZES = [
  { f: 1, name: 'Normal' },
  { f: 1.5, name: 'Gross' },
  { f: 2, name: 'Riesig' },
];
```

- [ ] **Step 4: Import in `js/game.js` erweitern**

In der bestehenden Importzeile aus `./models.js` (`js/game.js:3-8`)
`FURN_SIZES` neben `FURN_COLORS` aufnehmen:

```js
import { MAT, SEASONS, LEAVES, CATALOG, CATS, WALL_ITEMS, WALLS, FLOORS, FURN_COLORS, FURN_SIZES, TINTABLE,
```

(der Rest der Zeile bleibt unverändert)

- [ ] **Step 5: `sizeOf`, `normalizeSize` und `applyEntryScale` ergänzen**

Direkt nach `normalizeColor` (`js/game.js:566`) einfügen:

```js
/* Grösse pro Möbel (Issue #99). Wie bei der Farbe heisst «kein Feld»
   Standard — hier Faktor 1. Ein unbekannter Wert oder eine Grösse an einem
   Wandobjekt/Tier wird still entfernt; der Faktor 1 wird ebenfalls entfernt,
   damit ein Stand nicht pro Möbel um ein nutzloses Feld wächst. */
const SIZE_FACTORS = FURN_SIZES.map(s => s.f);
const sizeOf = en => (en && SIZE_FACTORS.includes(en.scale) ? en.scale : 1);
function normalizeSize(en) {
  if (en.scale === undefined) return;
  if (!SIZE_FACTORS.includes(en.scale) || en.scale === 1 || WALL_ITEMS.has(en.id)) {
    delete en.scale; migrated = true; }
}
/* Die einzige Stelle, die die Grösse eines Möbels ans Mesh bringt. Sie sitzt
   auf dem Gruppenknoten, nie auf einem Kind: die Schaltzustände (Badewanne,
   Pool, Fenster) rechnen in Kindern und dürfen davon nichts merken.
   q ist der Fortschritt einer Einfahr-Animation (1 = fertig).
   Issue #100 (in die Länge ziehen) erweitert genau diese eine Zeile zu
   m.scale.set(f * laenge, f, f) — deshalb geht jeder Pfad hier durch. */
function applyEntryScale(mesh, entry, q = 1) {
  mesh.scale.setScalar(sizeOf(entry) * q);
}
```

- [ ] **Step 6: `placeItemMesh` anwenden lassen**

In `js/game.js:792` neben `normalizeColor(entry)`:

```js
  normalizeColor(entry);
  normalizeSize(entry);
```

und unmittelbar vor `m.userData.pick = { k, entry, mesh: m };`
(`js/game.js:806`):

```js
  applyEntryScale(m, entry);
```

- [ ] **Step 7: `replaceMesh` und den Schnappschuss von `applyMove` ergänzen**

`replaceMesh` (`js/game.js:707-714`) — der Rücknahmepfad muss auch die Grösse
zurückdrehen, sonst bleibt bei einer Ablehnung ein grosses Mesh an einem
kleinen Eintrag hängen. Nach `pick.mesh.rotation.y = en.rot ?? 0;` einfügen:

```js
  if (!pick.tenant) applyEntryScale(pick.mesh, en);
```

`applyMove` (`js/game.js:729`) — `scale` in den Schnappschuss:

```js
  const snap = { x: en.x, z: en.z, y: en.y, rot: en.rot, wall: en.wall, scale: en.scale };
```

Achtung: `Object.assign(en, snap)` schreibt `scale: undefined` zurück statt das
Feld zu löschen. Deshalb in `applyMove` nach dem `Object.assign` aufräumen:

```js
  if (!ok) { Object.assign(en, snap); if (en.scale === undefined) delete en.scale; replaceMesh(pick); }
```

- [ ] **Step 8: Die Einfahr-Animation auf die Zielgrösse fahren lassen**

`addItem` (`js/game.js:1525-1526`) skaliert heute fest von 0.01 auf 1. Ersetzen
durch den gemeinsamen Pfad:

```js
  applyEntryScale(m, entry, 0.01);
  tween(0.35, q => { applyEntryScale(m, entry, 0.01 + 0.99 * q); if (selHelper) selHelper.update(); });
```

- [ ] **Step 9: Debug-Hook erweitern**

Im Objektliteral `window.wipfelkratzer` (`js/game.js:2810-2830`), bei den
anderen Konstanten (`FURN_COLORS, TINTABLE`):

```js
  FURN_SIZES, sizeOf, applyEntryScale,
```

- [ ] **Step 10: Prüfung erneut laufen lassen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t1_skalierung.py 9081
```

Erwartet: `T1 OK {...}` und kein `pageerror`.

- [ ] **Step 11: Commit**

```bash
git add js/models.js js/game.js
git commit -m "feat(einrichten): Grösse als Feld am Möbel-Eintrag

Ein optionales scale-Feld am Eintrag in state.rooms, angewendet über die
einzige Fundstelle applyEntryScale auf dem Gruppenknoten. Fehlendes oder
unbekanntes Feld heisst Faktor 1.

Refs #99"
```

---

### Task 2: Grösse setzen, mit Ablehnung

Eine Funktion, die eine Stufe setzt, dabei die Decke und die Kollision prüft
und im Zweifel sauber zurücknimmt. Noch ohne Knöpfe — aufgerufen wird sie in
diesem Task über den Debug-Hook.

**Files:**
- Modify: `js/game.js` (neue Funktion `setItemSize` bei `setItemColor`,
  `js/game.js:1452-1458`)
- Modify: `js/game.js:2810-2830` (Debug-Hook: `setItemSize`)
- Test: `.superpowers/sdd/2026-09-27-moebel-groesse/t2_ablehnung.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `sizeOf(entry)`, `applyEntryScale(mesh, entry, q)`, `FURN_SIZES`
  aus Task 1; `applyMove(pick, mutate)` (`js/game.js:727`),
  `clampEntry(k, mesh, entry)` (`js/game.js:640`), `meldeBlockade()`
  (`js/game.js:719`), `blockGrund` (`js/game.js:718`), `H(k)`
  (`js/game.js:14`).
- Produces: `setItemSize(f)` — `boolean`. Setzt die Grösse des ausgewählten
  Möbels auf den Faktor `f`. `true` = angenommen (gespeichert, Ton),
  `false` = abgelehnt (Klopfen + Meldung, Möbel unverändert).

- [ ] **Step 1: Wegwerf-Prüfung schreiben (der erwartete Fehlschlag)**

`.superpowers/sdd/2026-09-27-moebel-groesse/t2_ablehnung.py`:

```python
import sys
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1])
URL = f"http://localhost:{PORT}/"

def mess(page, k, i=0):
    return page.evaluate("""([k, i]) => {
      const w = window.wipfelkratzer;
      const m = w.itemMeshes[k][i];
      const bb = new w.THREE.Box3().setFromObject(m);
      return { scaleX: m.scale.x, eintrag: w.roomOf(k)[i].scale ?? null,
               hoehe: bb.max.y - bb.min.y };
    }""", [k, i])

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
    page.reload(wait_until="networkidle")

    # a) Annahme: ein Tisch passt in 1,5x
    page.evaluate("() => { const w = window.wipfelkratzer; w.enterEdit(1); w.addItem('tisch'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)
    ok = page.evaluate("() => window.wipfelkratzer.setItemSize(1.5)")
    assert ok is True, "1,5x wurde abgelehnt, obwohl ein Tisch hineinpasst"
    m = mess(page, 1)
    assert abs(m["scaleX"] - 1.5) < 1e-6 and m["eintrag"] == 1.5, f"nicht gesetzt: {m}"

    # b) Zurueck auf 1x loescht das Feld
    assert page.evaluate("() => window.wipfelkratzer.setItemSize(1)") is True
    m = mess(page, 1)
    assert abs(m["scaleX"] - 1) < 1e-6 and m["eintrag"] is None, f"1x nicht sauber: {m}"

    # c) Ablehnung an der Decke: ein Schrank in 2x ist hoeher als H(1) = 2.0
    page.evaluate("() => { const w = window.wipfelkratzer; w.addItem('schrank'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)
    idx = page.evaluate("() => window.wipfelkratzer.roomOf(1).findIndex(e => e.id === 'schrank')")
    vorher = mess(page, 1, idx)
    assert page.evaluate("() => window.wipfelkratzer.setItemSize(2)") is False, \
        f"2x am Schrank wurde angenommen, obwohl er nicht unter die Decke passt (Hoehe {vorher['hoehe']})"
    nachher = mess(page, 1, idx)
    assert nachher["eintrag"] is None, f"Eintrag nicht zurueckgenommen: {nachher}"
    assert abs(nachher["scaleX"] - 1) < 1e-6, f"Mesh nicht zurueckgenommen: {nachher}"
    assert page.locator("#toast-stack", has_text="unter die Decke").count() > 0, "keine Deckenmeldung"

    # d) Auf dem Dach gibt es keine Decke
    page.evaluate("() => { const w = window.wipfelkratzer; w.enterEdit('roof'); w.addItem('schrank'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)
    assert page.evaluate("() => window.wipfelkratzer.setItemSize(2)") is True, \
        "2x auf dem Dach wurde abgelehnt, obwohl dort Himmel ist"

    assert not fehler, f"pageerror: {fehler}"
    print("T2 OK")
    b.close()
```

- [ ] **Step 2: Prüfung laufen lassen und den Fehlschlag sehen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t2_ablehnung.py 9081
```

Erwartet: `TypeError: window.wipfelkratzer.setItemSize is not a function`.

- [ ] **Step 3: `setItemSize` schreiben**

`renderSizePick()` bekommt erst in Task 3 Inhalt. Damit Task 2 für sich
lauffähig ist, wird die Funktion hier als leere Vorwärtsdeklaration angelegt —
Task 3 ersetzt ihren Rumpf, nicht ihren Namen. Direkt nach `setItemColor`
(`js/game.js:1458`) einfügen:

```js
/* Vorwärtsdeklaration: die Grössenreihe entsteht in der Bedienung (#99).
   setItemSize ruft sie nach jedem Zug, damit die Markierung stimmt. */
function renderSizePick() {}

/* Grösse setzen (Issue #99). Der Weg ist derselbe wie beim Drehen: die
   Änderung läuft durch applyMove, das bei einer Ablehnung x/z/y/rot/scale
   zurücknimmt und über replaceMesh auch das Mesh wieder herrichtet.
   Die Deckenprüfung kann nicht in applyMove hinein — das entscheidet allein
   anhand von resolveItemMove (Kollision mit Tieren). Sie läuft deshalb davor,
   als Probe am Mesh, die sofort wieder zurückgesetzt wird. clampEntry
   begrenzt nur x und z; ohne diese Prüfung stiesse ein doppelt so hoher
   Schrank durch die Decke. Auf dem Dach und im Garten (k ist dort ein String)
   entfällt sie, dort ist Himmel. */
function paesstUnterDecke(k, mesh, f) {
  if (typeof k !== 'number') return true;
  const vorher = mesh.scale.x;
  mesh.scale.setScalar(f);
  const bb = new THREE.Box3().setFromObject(mesh);
  mesh.scale.setScalar(vorher);
  return bb.max.y - bb.min.y <= H(k) - 0.1;
}
function setItemSize(f) {
  if (!selected || selected.tenant || WALL_ITEMS.has(selected.entry.id)) return false;
  const en = selected.entry, mesh = selected.mesh;
  if (sizeOf(en) === f) return true;
  if (!paesstUnterDecke(selected.k, mesh, f)) {
    blockGrund = 'So gross passt das nicht unter die Decke.';
    meldeBlockade(); return false;
  }
  const ok = applyMove(selected, () => {
    if (f === 1) delete en.scale; else en.scale = f;
    applyEntryScale(mesh, en);
    clampEntry(selected.k, mesh, en);
  });
  if (!ok) { meldeBlockade(); renderSizePick(); return false; }
  selHelper.update(); sfx.pop(); save(); renderSizePick();
  return true;
}
```

- [ ] **Step 4: Debug-Hook erweitern**

Im Objektliteral `window.wipfelkratzer` neben `setItemSize` auch die
Deckengrenze sichtbar machen, damit eine Prüfung nicht raten muss:

```js
  setItemSize, H,
```

- [ ] **Step 5: Prüfung laufen lassen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t2_ablehnung.py 9081
```

Erwartet: `T2 OK` und kein `pageerror`.

Wenn Teil (c) scheitert, weil der Schrank auch in `2×` unter die Decke passt:
nimm statt `schrank` das `etagenbett` und passe die Prüfung an — die
Deckengrenze ist `H(1) - 0.1 = 1.9`. **Ändere nicht die Grenze, damit die
Prüfung grün wird.**

- [ ] **Step 6: Commit**

```bash
git add js/game.js
git commit -m "feat(einrichten): Grösse setzen mit Decken- und Kollisionsprüfung

setItemSize läuft durch applyMove und nimmt eine abgelehnte Stufe an
Eintrag und Mesh zurück. Eine Stufe, die nicht mehr unter die Decke
passt, wird vorab geprüft und mit Meldung abgelehnt.

Refs #99"
```

---

### Task 3: Bedienung — Knopf «Grösse» und Stufenreihe

**Files:**
- Modify: `index.html:103-110` (CSS: `#sizepick` neben `#colorpick`)
- Modify: `index.html:345-357` (Markup: `#btn-size` und `#sizepick` in
  `#selbar`)
- Modify: `js/game.js:1327-1341` (`deselect`/`select`)
- Modify: `js/game.js` (`renderSizePick` aus Task 2 füllen, bei
  `renderColorPick`, `js/game.js:1438-1450`)
- Modify: `js/game.js:2271-2272` (`btn-color`-Klick: Gegenseitigkeit)
- Test: `.superpowers/sdd/2026-09-27-moebel-groesse/t3_bedienung.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `setItemSize(f)` aus Task 2, `sizeOf(entry)` und `FURN_SIZES` aus
  Task 1.
- Produces: `#btn-size` — Knopf in `#selbar`, Aufschrift «Grösse», versteckt
  bei Wandobjekten und Tieren (Klasse `hidden`, wie `js/game.js:1332-1336`).
- Produces: `#sizepick` — Reihe mit drei Knöpfen, `data-size="1|1.5|2"`, der
  aktive trägt `class="on"`. Offen ist sie mit der Klasse `open`, wie
  `#colorpick`.
- Produces: `renderSizePick()` — baut die Reihe neu und markiert die aktive
  Stufe.

- [ ] **Step 1: Wegwerf-Prüfung schreiben (der erwartete Fehlschlag)**

`.superpowers/sdd/2026-09-27-moebel-groesse/t3_bedienung.py`:

```python
import sys
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1])
URL = f"http://localhost:{PORT}/"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
    page.reload(wait_until="networkidle")
    page.evaluate("() => { const w = window.wipfelkratzer; w.enterEdit(1); w.addItem('tisch'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)

    # a) Der Knopf ist da und sichtbar
    assert page.locator("#btn-size").is_visible(), "#btn-size fehlt oder ist versteckt"

    # b) Ein Druck oeffnet die Reihe mit drei Stufen, 1x ist markiert
    page.click("#btn-size", timeout=20000)
    assert page.locator("#sizepick.open").count() == 1, "#sizepick oeffnet nicht"
    assert page.locator("#sizepick button").count() == 3, "nicht drei Stufen"
    assert page.locator('#sizepick button[data-size="1"].on').count() == 1, "1x nicht markiert"

    # c) 1,5x wirkt sofort und markiert um
    page.click('#sizepick button[data-size="1.5"]', timeout=20000)
    page.wait_for_timeout(200)
    s = page.evaluate("() => window.wipfelkratzer.itemMeshes[1][0].scale.x")
    assert abs(s - 1.5) < 1e-6, f"Klick wirkt nicht: {s}"
    assert page.locator('#sizepick button[data-size="1.5"].on').count() == 1, "1,5x nicht markiert"

    # d) Farbreihe und Groessenreihe sind nie gleichzeitig offen
    page.click("#btn-color", timeout=20000)
    assert page.locator("#colorpick.open").count() == 1, "#colorpick oeffnet nicht"
    assert page.locator("#sizepick.open").count() == 0, "beide Reihen gleichzeitig offen"
    page.click("#btn-size", timeout=20000)
    assert page.locator("#colorpick.open").count() == 0, "Farbreihe bleibt offen"

    # e) deselect schliesst beides
    page.evaluate("() => window.wipfelkratzer.deselect()")
    assert page.locator("#sizepick.open").count() == 0 and page.locator("#colorpick.open").count() == 0

    # f) Nach Reload ist die Groesse noch da
    page.wait_for_timeout(500)
    page.reload(wait_until="networkidle")
    page.wait_for_function("window.wipfelkratzer.itemMeshes[1].length > 0", timeout=20000)
    s = page.evaluate("() => window.wipfelkratzer.itemMeshes[1][0].scale.x")
    assert abs(s - 1.5) < 1e-6, f"Groesse ueberlebt den Reload nicht: {s}"

    # g) Wandobjekt zeigt den Knopf nicht
    page.evaluate("() => { const w = window.wipfelkratzer; w.enterEdit(1); w.addItem('uhr'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)
    assert page.locator("#btn-size").is_hidden(), "#btn-size bei einem Wandobjekt sichtbar"

    # h) Deko landet auf der Platte des vergroesserten Tisches
    hoehe = page.evaluate("""() => {
      const w = window.wipfelkratzer;
      w.select(w.itemMeshes[1].find(m => m.userData.pick.entry.id === 'tisch').userData.pick);
      w.setItemSize(2);
      w.addItem('vase');
      return w.roomOf(1).find(e => e.id === 'vase').y;
    }""")
    assert hoehe > 0.6, f"Vase liegt nicht auf der grossen Tischplatte: y={hoehe}"

    assert not fehler, f"pageerror: {fehler}"
    print("T3 OK")
    b.close()
```

- [ ] **Step 2: Prüfung laufen lassen und den Fehlschlag sehen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t3_bedienung.py 9081
```

Erwartet: `AssertionError: #btn-size fehlt oder ist versteckt`.

- [ ] **Step 3: CSS ergänzen**

In `index.html` direkt nach dem `#colorpick`-Block (nach `index.html:110`):

```css
  /* Grössenreihe (#99) — selbe Machart und selber Platz wie die Farbreihe.
     Die beiden sind nie gleichzeitig offen, siehe js/game.js. */
  #sizepick { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
    display: none; gap: 6px; padding: 8px; background: var(--cream);
    border: 3px solid var(--woodL); border-radius: 16px; box-shadow: 0 4px 14px rgba(74,58,36,.25); }
  #sizepick.open { display: flex; }
  #sizepick button { min-width: 52px; min-height: 44px; padding: 0; border-radius: 14px; font-size: 14px; }
  #sizepick button.on { outline: 3px solid var(--wood); outline-offset: 2px; }
```

- [ ] **Step 4: Markup ergänzen**

In `#selbar` (`index.html:345-357`), zwischen `#colorpick` und `#btn-del`:

```html
  <button id="btn-size">Grösse</button>
  <div id="sizepick" aria-label="Grösse wählen"></div>
```

- [ ] **Step 5: `renderSizePick` füllen**

Den Platzhalter aus Task 2 ersetzen (bei `renderColorPick`,
`js/game.js:1438-1450`):

```js
/* Die Reihe zeigt die drei Stufen aus FURN_SIZES; die aktive ist markiert.
   Beschriftet wird mit dem Faktor in deutscher Schreibweise (1,5×). */
function renderSizePick() {
  const el = $('sizepick'); el.innerHTML = '';
  if (!selected) return;
  const cur = sizeOf(selected.entry);
  FURN_SIZES.forEach(s => {
    const b = document.createElement('button');
    b.dataset.size = String(s.f);
    b.textContent = String(s.f).replace('.', ',') + '×';
    b.title = s.name; b.setAttribute('aria-label', s.name);
    if (s.f === cur) b.className = 'on';
    b.onclick = () => setItemSize(s.f);
    el.appendChild(b);
  });
}
```

- [ ] **Step 6: `select`/`deselect` erweitern**

`deselect` (`js/game.js:1327-1328`) schliesst beide Reihen:

```js
function deselect() { if (selHelper) { scene.remove(selHelper); selHelper = null; } selected = null;
  $('colorpick').classList.remove('open'); $('sizepick').classList.remove('open'); $('selbar').classList.remove('on'); }
```

In `select` (`js/game.js:1329-1341`), neben der Zeile für `btn-color`:

```js
  /* Grösse gibt es nur für frei stehende Möbel: ein Wandobjekt wird über feste
     Wandkonstanten platziert, ein Tier ist ein Bewohner und kein Möbel (#99). */
  $('btn-size').classList.toggle('hidden', wall || !!pick.tenant);
  renderSizePick();
```

- [ ] **Step 7: Knöpfe verdrahten, Reihen gegenseitig ausschliessen**

`btn-color` (`js/game.js:2271-2272`) schliesst beim Öffnen die Grössenreihe,
und der neue Knopf umgekehrt:

```js
$('btn-color').onclick = () => { if (!selected || !TINTABLE.has(selected.entry.id)) return;
  $('sizepick').classList.remove('open');
  $('colorpick').classList.toggle('open'); renderColorPick(); };
$('btn-size').onclick = () => { if (!selected || selected.tenant || WALL_ITEMS.has(selected.entry.id)) return;
  $('colorpick').classList.remove('open');
  $('sizepick').classList.toggle('open'); renderSizePick(); };
```

- [ ] **Step 8: Prüfung laufen lassen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t3_bedienung.py 9081
```

Erwartet: `T3 OK` und kein `pageerror`.

- [ ] **Step 9: Commit**

```bash
git add index.html js/game.js
git commit -m "feat(ui): Knopf «Grösse» mit Stufenreihe in der Auswahlleiste

Ein Knopf neben «Farbe» öffnet eine Reihe mit 1×, 1,5× und 2×. Die beiden
Reihen schliessen einander aus, deselect schliesst beide. Wandobjekte und
Tiere zeigen den Knopf nicht.

Refs #99"
```

---

### Task 4: Sicherungsdatei und Changelog

**Files:**
- Modify: `js/standdatei.js:8-9` (Import: `FURN_SIZES`)
- Modify: `js/standdatei.js:28` (`GROESSEN` neben `FARBEN`)
- Modify: `js/standdatei.js:143-168` (`bereinigeMoebel`)
- Modify: `CHANGELOG.md:7` (`## [Unreleased]`)
- Test: `.superpowers/sdd/2026-09-27-moebel-groesse/t4_datei.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: `FURN_SIZES` aus Task 1.
- Produces: `eintrag.scale` in der bereinigten Möbelliste — nur wenn der Wert
  in `FURN_SIZES` vorkommt.

- [ ] **Step 1: Wegwerf-Prüfung schreiben (der erwartete Fehlschlag)**

`.superpowers/sdd/2026-09-27-moebel-groesse/t4_datei.py`:

```python
import sys
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1])
URL = f"http://localhost:{PORT}/"

# bereinigeStand ist ein reines Modul — es laesst sich ohne UI importieren.
PRUEFUNG = """async () => {
  const mod = await import('./js/standdatei.js');
  const roh = { floors: 1, maxFloors: 10, rooms: { '1': [
    { id: 'tisch', cell: 0, x: 0, z: 0, rot: 0, scale: 1.5 },
    { id: 'sofa',  cell: 1, x: 1, z: 0, rot: 0, scale: 7 },
    { id: 'stuhl', cell: 2, x: -1, z: 0, rot: 0 },
  ] } };
  const sauber = mod.bereinigeStand(roh);
  return sauber.rooms['1'].map(e => [e.id, e.scale ?? null]);
}"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    got = page.evaluate(PRUEFUNG)
    assert got == [["tisch", 1.5], ["sofa", None], ["stuhl", None]], f"unerwartet: {got}"
    assert not fehler, f"pageerror: {fehler}"
    print("T4 OK")
    b.close()
```

- [ ] **Step 2: Prüfung laufen lassen und den Fehlschlag sehen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t4_datei.py 9081
```

Erwartet: `AssertionError: unerwartet: [['tisch', None], ['sofa', None], ['stuhl', None]]`
— `scale` fällt heute aus der Positivliste.

- [ ] **Step 3: Import und Positivliste ergänzen**

`js/standdatei.js:8-9`:

```js
import { CATALOG, WALL_ITEMS, WALLS, FLOORS, FURN_COLORS, FURN_SIZES, SEASONS,
  DESIGN_MAX, normalizeBuild } from './models.js';
```

Bei `FARBEN` (`js/standdatei.js:28`):

```js
const GROESSEN = new Set(FURN_SIZES.map(s => s.f));
```

- [ ] **Step 4: `bereinigeMoebel` erweitern**

Direkt nach der Farbzeile (`js/standdatei.js:166`):

```js
  if (GROESSEN.has(e.scale)) eintrag.scale = e.scale;
```

- [ ] **Step 5: Prüfung laufen lassen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t4_datei.py 9081
```

Erwartet: `T4 OK`.

- [ ] **Step 6: Changelog ergänzen**

In `CHANGELOG.md` unter `## [Unreleased]` (Zeile 7):

```markdown
## [Unreleased]

### Added

- Möbel lassen sich jetzt in drei Grössen aufstellen: normal, gross (1,5×) und
  riesig (2×). Tippe ein Möbel an und drücke «Grösse» — ein Riesen-Sofa fürs
  Erdgeschoss, ein winziger Tisch in der Dachkammer. Was nicht mehr unter die
  Decke passt, bleibt wie es war (#99)
```

- [ ] **Step 7: Commit**

```bash
git add js/standdatei.js CHANGELOG.md
git commit -m "feat(einrichten): Grösse übersteht Sicherung und Einlesen

bereinigeMoebel übernimmt scale nur aus der Positivliste FURN_SIZES; ein
fremder Wert fällt still weg. DATEI_V bleibt 2 — ein zusätzliches
optionales Feld ist kein Formatbruch.

Refs #99"
```

---

### Task 5: Abnahme am ganzen Weg

Ein Durchlauf, der die Abnahmekriterien der Spec am echten Klickpfad abfährt —
nicht am Debug-Hook. Er ersetzt keine der Prüfungen aus Task 1–4, sondern
fängt, was zwischen ihnen liegt.

**Files:**
- Test: `.superpowers/sdd/2026-09-27-moebel-groesse/t5_abnahme.py`
  (Wegwerf, nicht committen)

**Interfaces:**
- Consumes: alles aus Task 1–4. Erzeugt nichts Neues.

- [ ] **Step 1: Abnahme schreiben**

`.superpowers/sdd/2026-09-27-moebel-groesse/t5_abnahme.py`:

```python
import sys
from playwright.sync_api import sync_playwright

PORT = int(sys.argv[1])
URL = f"http://localhost:{PORT}/"

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    page.evaluate("() => { const w = window.wipfelkratzer; w.state.floors = 3; w.speichern(); }")
    page.reload(wait_until="networkidle")
    page.evaluate("() => { const w = window.wipfelkratzer; w.enterEdit(1); w.addItem('sofa'); }")
    page.wait_for_function("window.wipfelkratzer.tweenCount() === 0", timeout=20000)

    def box():
        return page.evaluate("""() => {
          const w = window.wipfelkratzer;
          const m = w.itemMeshes[1].find(x => x.userData.pick.entry.id === 'sofa');
          const bb = new w.THREE.Box3().setFromObject(m);
          return { b: bb.max.x - bb.min.x, minX: bb.min.x, maxX: bb.max.x };
        }""")

    klein = box()
    page.click("#btn-size", timeout=20000)
    page.click('#sizepick button[data-size="2"]', timeout=20000)
    page.wait_for_timeout(200)
    gross = box()
    assert gross["b"] > klein["b"] * 1.9, f"2x wirkt nicht: {klein} -> {gross}"

    # Bleibt innerhalb der Wohnung (W(1) = 7.6, clampEntry haelt 0.13 Rand)
    halb = page.evaluate("() => window.wipfelkratzer.dims(1).w") / 2 + 0.4
    assert gross["maxX"] < halb and gross["minX"] > -halb, f"ragt aus der Wohnung: {gross}"

    # Sichern und wieder einlesen
    datei = page.evaluate("""async () => {
      const w = window.wipfelkratzer;
      const mod = await import('./js/standdatei.js');
      const d = mod.baueDatei({ name: 'Pruefturm', bild: null, stand: w.state, fotos: null });
      const ein = mod.pruefeDatei(JSON.stringify(d));
      return ein.ok ? ein.datei.stand.rooms['1'].map(e => [e.id, e.scale ?? null]) : ein.grund;
    }""")
    assert ["sofa", 2] in [list(x) for x in datei], f"Groesse ueberlebt die Datei nicht: {datei}"

    # Zurueck auf 1x
    page.click('#sizepick button[data-size="1"]', timeout=20000)
    page.wait_for_timeout(200)
    zurueck = box()
    assert abs(zurueck["b"] - klein["b"]) < 0.02, f"1x bringt nicht zurueck: {zurueck} vs {klein}"

    assert not fehler, f"pageerror: {fehler}"
    print("T5 OK")
    b.close()
```

- [ ] **Step 2: Abnahme laufen lassen**

```bash
python3 .superpowers/sdd/2026-09-27-moebel-groesse/t5_abnahme.py 9081
```

Erwartet: `T5 OK` und kein `pageerror`.

- [ ] **Step 3: Server beenden**

```bash
ss -lptn 'sport = :9081' | grep -oP 'pid=\K[0-9]+' | xargs -r kill
```

- [ ] **Step 4: Alle vier vorherigen Prüfungen noch einmal am Stück**

```bash
python3 -m http.server 9081 >/dev/null 2>&1 &
for t in t1_skalierung t2_ablehnung t3_bedienung t4_datei t5_abnahme; do
  python3 .superpowers/sdd/2026-09-27-moebel-groesse/$t.py 9081 || break
done
ss -lptn 'sport = :9081' | grep -oP 'pid=\K[0-9]+' | xargs -r kill
```

Erwartet: fünfmal `OK`. Ein Fehlschlag hier heisst, dass sich zwei Tasks in die
Quere gekommen sind — nicht, dass die Prüfung angepasst gehört.

- [ ] **Step 5: Nichts committen**

Die Prüfskripte bleiben ungetrackt (`.superpowers/` ist git-ignoriert). Prüfe
mit `git status --short`, dass nur die Quelldateien aus Task 1–4 committet
sind.
