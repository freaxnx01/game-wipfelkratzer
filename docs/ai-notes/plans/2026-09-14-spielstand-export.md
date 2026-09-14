# Plan: Turm als Datei sichern und wieder einlesen

Issue: `freaxnx01/game-wipfelkratzer#52`

**Goal:** Ein einzelner Turm lässt sich aus der Übersicht «Meine Türme» als
JSON-Datei sichern — wahlweise mit oder ohne Fotos — und wieder einlesen. Der
Import legt **immer einen neuen** Turm an und überschreibt nie einen
bestehenden. Fremde Dateien werden vor dem Einlesen geprüft und aus einer
Positivliste neu aufgebaut; die Datei trägt ihre Formatgeneration mit.

**Architecture:** Buildless, ES-Module, three.js r184 über die Import-Map
(`index.html:10-27`) — an der Import-Map wird nichts geändert. **Setzt #53
voraus:** `js/staende.js` (Index, `aktiverStand`, `neuerStand`, `loescheStand`,
`merkeBild`, `MAX_STAENDE`) und die Übersicht `#staende` mit `renderStaende()`
existieren bereits und werden hier nur benutzt und erweitert. Neu ist ein
abhängigkeitsfreies Modul `js/standdatei.js` (Format, Prüfung, Bereinigung), das
`CATALOG`/`WALLS`/`FLOORS` aus `./models.js` importiert. In `js/game.js` kommen
Export- und Import-Weg im Block «Turm-Übersicht» dazu, in `index.html` zwei
Knöpfe und ein verstecktes Datei-Feld.

**Spec:** `docs/ai-notes/specs/2026-09-14-spielstand-export-design.md`

## Global Constraints

- **#53 muss gemerged sein.** Vor Task 1 prüfen:
  `test -f js/staende.js && grep -q "renderStaende" js/game.js` — schlägt das
  fehl, ist dieser Plan noch nicht dran.
- **Keine neue Laufzeit-Abhängigkeit.** Kein Eintrag in der Import-Map, kein
  `package.json`, kein `node_modules`, kein neuer `<script src="https://…">`
  (`CLAUDE.md:796-821`).
- **Der Stand-Inhalt bleibt unverändert.** Das Objekt in der Datei unter `stand`
  ist exakt das, was `js/game.js:38-41` schreibt — es wird kein zweites Format
  erfunden.
- **Fremde Dateien sind Eingaben.** Nichts aus einer Datei landet per
  `Object.assign` in `state`; alles wird aus einer Positivliste neu aufgebaut.
- **Verifikation immer im Vordergrund.** Niemals `run_in_background` — ein
  headless Agent bekommt die Rückmeldung sonst nie und meldet fälschlich Erfolg
  (`CLAUDE.md:550-567`). Lieber ein grosszügiges `timeout` setzen und blockieren
  lassen.
- **Lokaler Server:** `python3 -m http.server 8000` aus dem Repo-Wurzelverzeichnis,
  danach **nur über den Port** beenden:
  `ss -lptn 'sport = :8000' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  niemals `pkill -f`.
- **Prüfskripte sind Wegwerfware** und liegen unter `.superpowers/verify/`
  (bereits in `.gitignore:3-6`). Sie werden **nicht** committet.
- Deutsche UI-Texte und Kommentare mit echten Umlauten (ä ö ü), niemals
  `ae oe ue`; `ss` statt `ß`.
- **`version.js` wird nicht angefasst** und es gibt **keinen**
  `chore(release)`-Commit.
- Jeder Task endet mit einem Commit im Conventional-Commit-Format
  (`CLAUDE.md:180-207`).

Einmalige Vorbereitung vor Task 1:

```bash
mkdir -p .superpowers/verify
python3 -c "import playwright" || pip install playwright && playwright install chromium
```

---

### Task 1: Dateiformat und Bereinigung — `js/standdatei.js`

**Files:**
- Create: `js/standdatei.js`
- Test: `.superpowers/verify/test_standdatei_modul.py` (nicht committet)

**Interfaces:**
- `export const DATEI_TYP = 'wipfelkratzer-stand'`
- `export const DATEI_V = 2`
- `export const MAX_DATEI = 6 * 1024 * 1024`
- `export function baueDatei({ name, bild, stand, fotos }): object`
- `export function dateiName(name: string, datum?: Date): string`
- `export function pruefeDatei(text: string): { ok: true, datei } | { ok: false, grund: string }`
- `export function bereinigeStand(roh: any): object`
- `export function bereinigeFotos(roh: any): array`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_standdatei_modul.py`:

```python
#!/usr/bin/env python3
"""Prueft js/standdatei.js: Format, Versionen, Positivliste, boesartige Eingaben."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        # models.js braucht keine three-Instanz zum Import der Konstanten, aber die
        # Import-Map steht nur in index.html -> darum die echte Seite laden.
        page.goto(f"http://localhost:{PORT}/", wait_until="load")

        def run(script, arg=None):
            return page.evaluate(
                "async (arg) => { const D = await import('/js/standdatei.js');"
                + script + " }", arg)

        # --- Format
        d = run("""return D.baueDatei({ name: 'Julias Turm', bild: 'data:image/jpeg;base64,AAA',
            stand: { floors: 3, rooms: {}, wallpaper: {}, flooring: {}, fulfilled: {},
                     nuts: 7, bridge: true, garden: false, night: false, cutaway: false },
            fotos: null });""")
        assert d["typ"] == "wipfelkratzer-stand", d
        assert d["version"] == 2, d
        assert d["fotos"] is None, d
        assert d["stand"]["floors"] == 3 and d["stand"]["nuts"] == 7, d
        assert isinstance(d["erstellt"], str) and d["erstellt"].endswith("Z"), d
        assert d["spiel"] == page.evaluate("() => window.GAME_VERSION"), d

        # --- Dateiname
        n = run("return D.dateiName('Julias Turm', new Date(2026, 8, 14));")
        assert n == "wipfelkratzer-julias-turm-2026-09-14.json", n
        n = run("return D.dateiName('  Schräg/Weg? ', new Date(2026, 8, 14));")
        assert "/" not in n and "?" not in n and n.endswith(".json"), n
        assert n.startswith("wipfelkratzer-"), n

        # --- Ablehnungen, jede mit eigener Begruendung
        gruende = set()
        for text in ["", "{kaputt", "null", "[1,2,3]",
                     json.dumps({"foo": 1}),
                     json.dumps({"typ": "wipfelkratzer-stand", "version": 99, "stand": {}}),
                     json.dumps({"typ": "wipfelkratzer-stand", "version": 2})]:
            r = run("return D.pruefeDatei(arg);", text)
            assert r["ok"] is False, (text[:30], r)
            assert isinstance(r["grund"], str) and len(r["grund"]) > 5, r
            gruende.add(r["grund"])
        assert len(gruende) >= 4, gruende

        # --- Version 1 (Tapete als String) wird angenommen
        alt = json.dumps({"typ": "wipfelkratzer-stand", "version": 1,
                          "stand": {"floors": 2, "wallpaper": {"1": "blumen"}, "rooms": {}}})
        r = run("return D.pruefeDatei(arg);", alt)
        assert r["ok"] is True, r
        assert r["datei"]["stand"]["wallpaper"]["1"] == "blumen", r

        # --- Positivliste: unbekannte Möbel, kaputte Zahlen, zu viele Stockwerke
        boese = json.dumps({
            "typ": "wipfelkratzer-stand", "version": 2,
            "name": "x", "stand": {
                "floors": 999, "nuts": -5, "bridge": "ja", "boeserSchluessel": 1,
                "rooms": {"1": [{"id": "bett", "x": 0.5, "y": 2.2, "z": 0, "rot": 0},
                                {"id": "raketenwerfer", "x": 0, "y": 0, "z": 0, "rot": 0},
                                {"id": "bett", "x": "NaN", "y": None, "z": 0, "rot": 0},
                                {"id": "poster", "x": 0, "y": 2.6, "z": 0, "rot": 0, "wall": "oben"}],
                          "boeserRaum": [{"id": "bett"}],
                          "roof": [{"id": "pool", "x": 0, "y": 0, "z": 0, "rot": 0}]},
                "wallpaper": {"1": {"back": "blumen", "front": "gibtsnicht"}},
                "flooring": {"1": "gibtsnicht"},
                "fulfilled": {"1": True}},
            "fotos": [{"url": "javascript:alert(1)", "text": "b", "t": 1},
                      {"url": "data:image/jpeg;base64,/9j/4AAQ", "text": "x" * 900, "t": 1},
                      {"url": "data:image/jpeg;base64,/9j/4AAQ", "text": "y", "t": "morgen"}]})
        r = run("return D.pruefeDatei(arg);", boese)
        assert r["ok"] is True, r
        st = r["datei"]["stand"]
        assert st["floors"] == 10, st["floors"]          # auf MAXF begrenzt
        assert st["nuts"] == 0, st["nuts"]               # nicht negativ
        assert st["bridge"] is True, st["bridge"]        # zu Boolean gemacht
        assert "boeserSchluessel" not in st, st
        assert "boeserRaum" not in st["rooms"], st["rooms"]
        assert "roof" in st["rooms"], st["rooms"]
        ids = [e["id"] for e in st["rooms"]["1"]]
        assert ids == ["bett"], ids                      # unbekannt + kaputt + falsche Wand weg
        assert st["wallpaper"]["1"] == {"back": "blumen"}, st["wallpaper"]
        assert st["flooring"] == {}, st["flooring"]
        fotos = r["datei"]["fotos"]
        assert len(fotos) == 1, fotos                    # javascript: und kaputtes t weg
        assert len(fotos[0]["text"]) == 500, len(fotos[0]["text"])

        # --- Prototype Pollution
        gift = json.dumps({"typ": "wipfelkratzer-stand", "version": 2,
                           "stand": {"__proto__": {"gehackt": True}, "floors": 1, "rooms": {}}})
        r = run("return D.pruefeDatei(arg);", gift)
        assert r["ok"] is True, r
        assert page.evaluate("() => ({}).gehackt === undefined") is True, "Prototyp vergiftet"
        assert "gehackt" not in json.dumps(r["datei"]["stand"]), r["datei"]["stand"]

        # --- Fotos: hoechstens 20
        viele = json.dumps({"typ": "wipfelkratzer-stand", "version": 2,
                            "stand": {"floors": 0, "rooms": {}},
                            "fotos": [{"url": "data:image/jpeg;base64,/9j/4AAQ", "text": "", "t": 1}] * 40})
        r = run("return D.pruefeDatei(arg);", viele)
        assert len(r["datei"]["fotos"]) == 20, len(r["datei"]["fotos"])

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Dateiformat, Versionen und Positivliste halten stand")
```

  Ausführen (Vordergrund, grosszügiges `timeout`):
  `python3 .superpowers/verify/test_standdatei_modul.py` → muss scheitern
  («Failed to fetch dynamically imported module: /js/standdatei.js»).

- [ ] **Step 2: `js/standdatei.js` anlegen.** Vollständiger Inhalt:

```js
/* Das Dateiformat für einen gesicherten Turm — und die Prüfung fremder Dateien.
   Eine importierte Datei ist eine Eingabe, keine Quelle der Wahrheit: der Stand
   wird nicht gemerged, sondern aus einer Positivliste neu aufgebaut. Was die
   Liste nicht kennt, fällt still weg — lieber ein Turm ohne Sessel als ein
   weisses Bild. */
import { CATALOG, WALL_ITEMS, WALLS, FLOORS } from './models.js';

export const DATEI_TYP = 'wipfelkratzer-stand';
export const DATEI_V = 2;              /* 2 = Tapete pro Wand, 1 = Tapete als String */
export const MAX_DATEI = 6 * 1024 * 1024;
const MAXF = 10;                        /* wie js/game.js:6 */
const WALL_KEYS = ['back', 'left', 'right', 'front'];
const MAX_FOTOS = 20;                   /* wie js/game.js:1145 */
const MAX_TEXT = 500;

const MOEBEL = new Set(CATALOG.map(c => c.id));
const TAPETEN = new Set(WALLS.map(w => w.id));
const BOEDEN = new Set(FLOORS.map(f => f.id));
const RAUM_KEYS = new Set(['roof', ...Array.from({ length: MAXF + 1 }, (_, i) => String(i))]);

const zahl = (v, min, max, vor) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return vor;
  return Math.min(max, Math.max(min, n));
};

export function baueDatei({ name, bild, stand, fotos }) {
  return {
    typ: DATEI_TYP,
    version: DATEI_V,
    spiel: (typeof window !== 'undefined' && window.GAME_VERSION) || '',
    erstellt: new Date().toISOString(),
    name: String(name || 'Wipfelkratzer').slice(0, 40),
    bild: typeof bild === 'string' && bild.startsWith('data:image/') ? bild : null,
    stand: stand || {},
    fotos: Array.isArray(fotos) ? fotos : null,
  };
}

/* iOS filtert den Dateidialog nach Typ — deshalb .json und nicht eine eigene
   Endung, die in «Dateien» ausgegraut wäre. */
export function dateiName(name, datum) {
  const d = datum || new Date(), pad = n => String(n).padStart(2, '0');
  const teil = String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'turm';
  return `wipfelkratzer-${teil}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function pruefeDatei(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, grund: 'Diese Datei ist leer.' };
  if (text.length > MAX_DATEI) return { ok: false, grund: 'Diese Datei ist zu gross.' };
  let roh = null;
  try { roh = JSON.parse(text); } catch (e) { return { ok: false, grund: 'Diese Datei versteht Willi nicht.' }; }
  if (!roh || typeof roh !== 'object' || Array.isArray(roh))
    return { ok: false, grund: 'Diese Datei versteht Willi nicht.' };
  if (roh.typ !== DATEI_TYP) return { ok: false, grund: 'Das ist kein gesicherter Wipfelkratzer.' };
  const v = Number(roh.version);
  if (!Number.isFinite(v) || v < 1) return { ok: false, grund: 'Das ist kein gesicherter Wipfelkratzer.' };
  if (v > DATEI_V) return { ok: false, grund: 'Diese Datei kommt aus einer neueren Version des Spiels.' };
  if (!roh.stand || typeof roh.stand !== 'object' || Array.isArray(roh.stand))
    return { ok: false, grund: 'In dieser Datei steckt kein Turm.' };
  return { ok: true, datei: {
    version: v,
    spiel: typeof roh.spiel === 'string' ? roh.spiel.slice(0, 20) : '',
    name: (typeof roh.name === 'string' ? roh.name.trim().slice(0, 40) : '') || 'Eingelesener Turm',
    bild: typeof roh.bild === 'string' && roh.bild.startsWith('data:image/') ? roh.bild.slice(0, 200000) : null,
    stand: bereinigeStand(roh.stand),
    fotos: roh.fotos == null ? null : bereinigeFotos(roh.fotos),
  } };
}

/* Positivliste: nur bekannte Felder, nur bekannte Möbel, nur endliche Zahlen.
   Object.create(null) als Zwischenstufe wäre unnötig — wir bauen ohnehin ein
   frisches Literal auf und übernehmen nie fremde Schlüssel. */
export function bereinigeStand(roh) {
  const s = roh && typeof roh === 'object' ? roh : {};
  const out = {
    floors: Math.round(zahl(s.floors, 0, MAXF, 0)),
    nuts: Math.round(zahl(s.nuts, 0, 999999, 0)),
    bridge: !!s.bridge, garden: !!s.garden, night: !!s.night, cutaway: !!s.cutaway,
    rooms: {}, wallpaper: {}, flooring: {}, fulfilled: {},
  };
  const raeume = s.rooms && typeof s.rooms === 'object' && !Array.isArray(s.rooms) ? s.rooms : {};
  for (const k of Object.keys(raeume)) {
    if (!RAUM_KEYS.has(k)) continue;
    if (!Array.isArray(raeume[k])) continue;
    const liste = [];
    for (const e of raeume[k].slice(0, 80)) {
      if (!e || typeof e !== 'object' || !MOEBEL.has(e.id)) continue;
      const eintrag = {
        id: e.id,
        x: zahl(e.x, -50, 50, NaN),
        y: zahl(e.y, -50, 50, NaN),
        z: zahl(e.z, -50, 50, NaN),
        rot: zahl(e.rot, -100, 100, 0),
      };
      if (!Number.isFinite(eintrag.x) || !Number.isFinite(eintrag.y) || !Number.isFinite(eintrag.z)) continue;
      if (WALL_ITEMS.has(e.id)) {
        if (e.wall !== undefined && !WALL_KEYS.includes(e.wall)) continue;
        eintrag.wall = WALL_KEYS.includes(e.wall) ? e.wall : 'back';
      }
      if (e.farbe !== undefined && typeof e.farbe === 'string') eintrag.farbe = e.farbe.slice(0, 20);
      liste.push(eintrag);
    }
    if (liste.length) out.rooms[k] = liste;
  }
  const tap = s.wallpaper && typeof s.wallpaper === 'object' && !Array.isArray(s.wallpaper) ? s.wallpaper : {};
  for (const k of Object.keys(tap)) {
    if (!RAUM_KEYS.has(k)) continue;
    const wp = tap[k];
    /* Generation 1: ein String für die ganze Wohnung. Bleibt ein String — die
       bestehende Migration macht daraus beim Laden vier Wände (js/game.js:379-386). */
    if (typeof wp === 'string') { if (TAPETEN.has(wp)) out.wallpaper[k] = wp; continue; }
    if (!wp || typeof wp !== 'object' || Array.isArray(wp)) continue;
    const sauber = {};
    for (const w of WALL_KEYS) if (TAPETEN.has(wp[w])) sauber[w] = wp[w];
    if (Object.keys(sauber).length) out.wallpaper[k] = sauber;
  }
  const bod = s.flooring && typeof s.flooring === 'object' && !Array.isArray(s.flooring) ? s.flooring : {};
  for (const k of Object.keys(bod)) if (RAUM_KEYS.has(k) && BOEDEN.has(bod[k])) out.flooring[k] = bod[k];
  const erf = s.fulfilled && typeof s.fulfilled === 'object' && !Array.isArray(s.fulfilled) ? s.fulfilled : {};
  for (const k of Object.keys(erf)) if (RAUM_KEYS.has(k) && erf[k]) out.fulfilled[k] = true;
  return out;
}

/* Fotos landen als src in der Galerie (js/game.js:1160) — nur echte
   Bild-Data-URLs kommen durch. */
export function bereinigeFotos(roh) {
  if (!Array.isArray(roh)) return [];
  const out = [];
  for (const f of roh) {
    if (out.length >= MAX_FOTOS) break;
    if (!f || typeof f !== 'object') continue;
    if (typeof f.url !== 'string') continue;
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f.url)) continue;
    const t = Number(f.t);
    if (!Number.isFinite(t)) continue;
    out.push({ url: f.url, text: typeof f.text === 'string' ? f.text.slice(0, MAX_TEXT) : '', t });
  }
  return out;
}
```

- [ ] **Step 3: Test grün.** `python3 .superpowers/verify/test_standdatei_modul.py`
      → `OK: Dateiformat, Versionen und Positivliste halten stand`. Zusätzlich
      prüfen, dass nur das eine erlaubte Modul importiert wird:
      `grep -n "^import" js/standdatei.js` → genau eine Zeile, `./models.js`.

- [ ] **Step 4: Commit.**
      `git add js/standdatei.js && git commit -m "feat(spielstand): Dateiformat und Prüfung für gesicherte Türme"`

---

### Task 2: Export-Weg in `js/game.js`

**Files:**
- Modify: `js/game.js` (Import bei `js/game.js:1-4`, neuer Abschnitt im Block
  «Turm-Übersicht», Debug-Hook)
- Test: `.superpowers/verify/test_stand_export.py` (nicht committet)

**Interfaces:**
- `import { baueDatei, dateiName, pruefeDatei, MAX_DATEI } from './standdatei.js';`
- `function standDatei(eintrag, mitFotos): { text: string, name: string }`
- `async function exportiereStand(eintrag, mitFotos): Promise<void>`
- `window.wipfelkratzer.standDatei = standDatei`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_stand_export.py`:

```python
#!/usr/bin/env python3
"""Der Export liest den richtigen Turm, respektiert 'mit/ohne Fotos' und laedt genau eine Datei."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = {"floors": 3, "nuts": 7, "rooms": {"1": [{"id": "bett", "x": 0.4, "y": 2.2, "z": 0.2, "rot": 0}]},
       "wallpaper": {}, "flooring": {}, "fulfilled": {},
       "bridge": True, "garden": False, "night": False, "cutaway": False}
FOTO = "data:image/jpeg;base64,/9j/4AAQ"

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1100, "height": 800}, accept_downloads=True)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""([alt, foto]) => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', JSON.stringify(alt));
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify([{url: foto, text: 'alt', t: 1}]));
        }""", [ALT, FOTO])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.standDatei")

        # 1) Ohne Fotos
        d = json.loads(page.evaluate(
            "() => window.wipfelkratzer.standDatei(window.wipfelkratzer.stand, false).text"))
        assert d["typ"] == "wipfelkratzer-stand" and d["version"] == 2, d
        assert d["fotos"] is None, d
        assert d["stand"]["floors"] == 3 and d["stand"]["bridge"] is True, d["stand"]
        assert d["spiel"] == page.evaluate("() => window.GAME_VERSION"), d

        # 2) Mit Fotos — und nur den eigenen
        d = json.loads(page.evaluate(
            "() => window.wipfelkratzer.standDatei(window.wipfelkratzer.stand, true).text"))
        assert len(d["fotos"]) == 1 and d["fotos"][0]["text"] == "alt", d["fotos"]

        # 3) Der aktive Turm wird vorher gesichert (Entprellung umgangen)
        page.evaluate("() => { window.wipfelkratzer.state.nuts = 99; }")
        d = json.loads(page.evaluate(
            "() => window.wipfelkratzer.standDatei(window.wipfelkratzer.stand, false).text"))
        assert d["stand"]["nuts"] == 99, d["stand"]

        # 4) Ein NICHT aktiver Turm laesst sich sichern, ohne zu wechseln
        neu = page.evaluate("() => window.wipfelkratzer.staende.neuerStand('Zweiter')")
        page.evaluate("""e => {
            localStorage.setItem(e.standKey, JSON.stringify({floors: 5, nuts: 1, rooms: {},
                wallpaper: {}, flooring: {}, fulfilled: {}, bridge: false, garden: false,
                night: false, cutaway: false}));
            localStorage.setItem(e.fotoKey, '[]');
        }""", neu)
        d = json.loads(page.evaluate("e => window.wipfelkratzer.standDatei(e, true).text", neu))
        assert d["stand"]["floors"] == 5, d["stand"]
        assert d["name"] == "Zweiter", d
        assert d["fotos"] == [], d["fotos"]
        assert page.evaluate("() => window.wipfelkratzer.stand.standKey") == "wipfelkratzer-v1", "gewechselt!"

        # 5) Dateiname
        assert page.evaluate("e => window.wipfelkratzer.standDatei(e, false).name", neu).startswith(
            "wipfelkratzer-zweiter-")

        # 6) Ein Klick, genau ein Download
        downloads = []
        page.on("download", downloads.append)
        page.evaluate("() => { navigator.share = undefined; navigator.canShare = undefined; }")
        page.evaluate("""async () => {
            await window.wipfelkratzer.exportiereStand(window.wipfelkratzer.stand, false); }""")
        page.wait_for_timeout(1500)
        assert len(downloads) == 1, downloads
        assert downloads[0].suggested_filename.endswith(".json"), downloads[0].suggested_filename

        # 7) Auf einem Geraet, das teilen kann, wird geteilt statt geladen
        page.evaluate("""() => {
            window.__geteilt = null;
            navigator.canShare = () => true;
            navigator.share = d => { window.__geteilt = d.files.map(f => [f.name, f.type]); return Promise.resolve(); };
        }""")
        downloads.clear()
        page.evaluate("""async () => {
            await window.wipfelkratzer.exportiereStand(window.wipfelkratzer.stand, false); }""")
        page.wait_for_timeout(1000)
        geteilt = page.evaluate("() => window.__geteilt")
        assert geteilt and geteilt[0][1] == "application/json", geteilt
        assert not downloads, "es darf nicht zusaetzlich geladen werden"

        # 8) Abbruch im Share-Sheet bleibt folgenlos
        page.evaluate("""() => { navigator.share = () => Promise.reject(
            Object.assign(new Error('abgebrochen'), { name: 'AbortError' })); }""")
        page.evaluate("""async () => {
            await window.wipfelkratzer.exportiereStand(window.wipfelkratzer.stand, false); }""")
        page.wait_for_timeout(800)
        assert not downloads, downloads

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Export liest den richtigen Turm und liefert genau eine Datei")
```

  Ausführen → scheitert an `wait_for_function` (`standDatei` fehlt).

- [ ] **Step 2: Modul importieren.** In `js/game.js` unter die Import-Zeile für
      `./staende.js` (aus #53, `js/game.js:4`) einfügen:

```js
import { baueDatei, dateiName, pruefeDatei, MAX_DATEI } from './standdatei.js';
```

- [ ] **Step 3: Export bauen.** Im Block «Turm-Übersicht» (`js/game.js`, nach
      `renderStaende()`) einfügen:

```js
/* ---------- Turm sichern ---------- */
/* Liest den Turm aus seinen Schlüsseln — auch einen, der gerade nicht gespielt
   wird. Beim aktiven Turm vorher schreiben: save() ist entprellt (js/game.js:37),
   sonst fehlten die letzten 300 ms in der Datei. */
function standDatei(eintrag, mitFotos) {
  if (eintrag.id === STAND.id) schreibeStand();
  let stand = {}, fotos = null;
  try { stand = JSON.parse(localStorage.getItem(eintrag.standKey) || '{}'); } catch (e) { stand = {}; }
  if (mitFotos) {
    try { fotos = JSON.parse(localStorage.getItem(eintrag.fotoKey) || '[]'); } catch (e) { fotos = []; }
    if (!Array.isArray(fotos)) fotos = [];
  }
  const datei = baueDatei({ name: eintrag.name, bild: eintrag.bild, stand, fotos });
  return { text: JSON.stringify(datei), name: dateiName(eintrag.name) };
}

/* Zwei Wege: Tablets bekommen das System-Sheet, alles andere eine Datei.
   Ein Blob statt einer Data-URL, weil iOS-Safari grosse Data-URLs in einem
   neuen Tab öffnet statt sie zu sichern. */
async function exportiereStand(eintrag, mitFotos) {
  const { text, name } = standDatei(eintrag, mitFotos);
  const blob = new Blob([text], { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.share) {
      const f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: eintrag.name }); }
        catch (e) { if (e && e.name !== 'AbortError') toast('Das Sichern hat nicht geklappt.'); }
        return;
      }
    }
  } catch (e) {}
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Der Turm ist als Datei gesichert.');
}
```

- [ ] **Step 4: Debug-Hook erweitern.** Im Literal `window.wipfelkratzer = { … }`
      ergänzen:

```js
  standDatei, exportiereStand,
```

- [ ] **Step 5: Test grün.** `python3 .superpowers/verify/test_stand_export.py`
      → `OK: Export liest den richtigen Turm und liefert genau eine Datei`.

- [ ] **Step 6: Commit.**
      `git add js/game.js && git commit -m "feat(spielstand): Turm als Datei sichern"`

---

### Task 3: «Sichern» auf der Turm-Karte

**Files:**
- Modify: `index.html` (CSS bei den `#staende`-Regeln aus #53)
- Modify: `js/game.js` (`renderStaende()` und die Hörer auf `#stand-grid`)
- Test: `.superpowers/verify/test_sichern_knopf.py` (nicht committet)

**Interfaces:**
- Neue Elemente pro Karte: `button.stand-save`, `.stand-save-zeile.hidden` mit
  `button.stand-save-mit` und `button.stand-save-ohne`
- `function exportGroesse(eintrag): { mit: string, ohne: string }` — Grössen als
  lesbarer Text für die Knopfbeschriftung

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_sichern_knopf.py`:

```python
#!/usr/bin/env python3
"""'Sichern' klappt die Auswahl mit/ohne Fotos auf und nennt die Grösse."""
import re, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = ('{"floors":3,"nuts":0,"rooms":{},"wallpaper":{},"flooring":{},"fulfilled":{},'
       '"bridge":false,"garden":false,"night":false,"cutaway":false}')

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1100, "height": 800}, accept_downloads=True)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""alt => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', alt);
            const f = [];
            for (let i = 0; i < 5; i++) f.push({url: 'data:image/jpeg;base64,' + 'A'.repeat(4000), text: '', t: i});
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify(f));
        }""", ALT)
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.renderStaende")
        page.click("#btn-start"); page.click("#btn-extras"); page.click("#btn-staende")
        page.wait_for_selector("#staende.open")

        karte = page.locator("#staende .standkarte").first
        # Zuerst ist die Auswahl eingeklappt
        assert karte.locator(".stand-save").count() == 1
        assert not karte.locator(".stand-save-zeile").is_visible()
        karte.locator(".stand-save").click()
        assert karte.locator(".stand-save-zeile").is_visible()

        mit = karte.locator(".stand-save-mit").inner_text()
        ohne = karte.locator(".stand-save-ohne").inner_text()
        assert "Fotos" in mit and "Fotos" in ohne, (mit, ohne)
        assert re.search(r"\d", mit) and re.search(r"\d", ohne), (mit, ohne)
        assert ("MB" in mit or "KB" in mit) and ("KB" in ohne or "MB" in ohne), (mit, ohne)

        # 'Ohne Fotos' laedt eine kleine Datei
        page.evaluate("() => { navigator.share = undefined; navigator.canShare = undefined; }")
        with page.expect_download(timeout=15000) as dl:
            karte.locator(".stand-save-ohne").click()
        pfad = dl.value.path()
        gr_ohne = __import__("os").path.getsize(pfad)
        assert dl.value.suggested_filename.endswith(".json"), dl.value.suggested_filename

        # 'Mit Fotos' ist deutlich grösser
        karte.locator(".stand-save").click()
        with page.expect_download(timeout=15000) as dl2:
            karte.locator(".stand-save-mit").click()
        gr_mit = __import__("os").path.getsize(dl2.value.path())
        assert gr_mit > gr_ohne * 3, (gr_ohne, gr_mit)

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: 'Sichern' bietet mit/ohne Fotos samt Grössenangabe")
```

  Ausführen → scheitert (`.stand-save` existiert nicht).

- [ ] **Step 2: Grössenschätzung ergänzen.** Im Block «Turm sichern»
      (`js/game.js`, Task 2) einfügen:

```js
/* Für die Beschriftung: wie gross wird die Datei ungefähr? Die Länge der
   Zeichenkette genügt als Schätzung — JSON ist hier reines ASCII. */
const lesbar = n => n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
function exportGroesse(eintrag) {
  const laenge = k => { try { return (localStorage.getItem(k) || '').length; } catch (e) { return 0; } };
  const stand = laenge(eintrag.standKey) + 400;
  return { ohne: lesbar(stand), mit: lesbar(stand + laenge(eintrag.fotoKey)) };
}
```

- [ ] **Step 3: Karte erweitern.** In `renderStaende()` (`js/game.js`, aus #53)
      die Zeile mit den Karten-Knöpfen ersetzen. Aus

```js
      <div class="zeile">${hier ? '<span class="stand-hier">Hier bist du</span>'
        : '<button class="stand-hin primary">Weiterbauen</button>'}
        <button class="stand-weg danger">Löschen</button></div>`;
```

      wird

```js
      <div class="zeile">${hier ? '<span class="stand-hier">Hier bist du</span>'
        : '<button class="stand-hin primary">Weiterbauen</button>'}
        <button class="stand-save">Sichern</button>
        <button class="stand-weg danger">Löschen</button></div>
      <div class="stand-save-zeile hidden">
        <button class="stand-save-mit">Mit Fotos (${gr.mit})</button>
        <button class="stand-save-ohne">Ohne Fotos (${gr.ohne})</button>
      </div>`;
```

      und oberhalb, neben `const info = staende.standInfo(e), hier = …`, kommt

```js
    const gr = exportGroesse(e);
```

- [ ] **Step 4: Hörer ergänzen.** Im `click`-Hörer auf `#stand-grid` (aus #53,
      Task 5) vor der Behandlung von `.stand-hin` einfügen:

```js
  if (ev.target.classList.contains('stand-save')) {
    karte.querySelector('.stand-save-zeile').classList.toggle('hidden');
    return;
  }
  if (ev.target.classList.contains('stand-save-mit') || ev.target.classList.contains('stand-save-ohne')) {
    const mit = ev.target.classList.contains('stand-save-mit');
    const eintrag = staende.ladeIndex().staende.find(x => x.id === karte.dataset.id);
    if (!eintrag) { renderStaende(); return; }
    const knopf = ev.target; knopf.disabled = true;
    exportiereStand(eintrag, mit).finally(() => {
      knopf.disabled = false;
      karte.querySelector('.stand-save-zeile').classList.add('hidden');
    });
    return;
  }
```

- [ ] **Step 5: CSS ergänzen.** In `index.html` bei den `#staende`-Regeln (aus
      #53, direkt nach `.standkarte .zeile { … }`) einfügen:

```css
  .stand-save-zeile { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
  .stand-save-zeile button { font-size: 12.5px; }
```

- [ ] **Step 6: Test grün.** `python3 .superpowers/verify/test_sichern_knopf.py`
      → `OK: 'Sichern' bietet mit/ohne Fotos samt Grössenangabe`.

- [ ] **Step 7: Commit.**
      `git add index.html js/game.js && git commit -m "feat(spielstand): Sichern-Knopf mit Auswahl mit/ohne Fotos"`

---

### Task 4: Import in einen freien Platz

**Files:**
- Modify: `index.html` (`#staende-actions` aus #53 um Knopf und Datei-Feld)
- Modify: `js/game.js` (Block «Turm einlesen»)
- Test: `.superpowers/verify/test_stand_import.py` (nicht committet)

**Interfaces:**
- Neue Elemente: `#btn-stand-import`, `#stand-datei` (`<input type="file" class="hidden">`)
- `function importiereText(text: string): { ok: boolean, grund?: string, eintrag?: object }`
- `function importiereDatei(file: File): void`
- `window.wipfelkratzer.importiereText = importiereText`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_stand_import.py`:

```python
#!/usr/bin/env python3
"""Import geht in einen freien Platz, überschreibt nie und ist ein sauberer Rundlauf."""
import json, os, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = {"floors": 3, "nuts": 7, "rooms": {"1": [{"id": "bett", "x": 0.4, "y": 2.2, "z": 0.2, "rot": 0}]},
       "wallpaper": {}, "flooring": {}, "fulfilled": {},
       "bridge": True, "garden": False, "night": False, "cutaway": False}
FOTO = "data:image/jpeg;base64,/9j/4AAQ"

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
tmp = tempfile.mkdtemp()
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""([alt, foto]) => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', JSON.stringify(alt));
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify([{url: foto, text: 'alt', t: 1}]));
        }""", [ALT, FOTO])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.importiereText")

        # Export der aktuellen Lage als Datei auf die Platte
        text = page.evaluate("() => window.wipfelkratzer.standDatei(window.wipfelkratzer.stand, true).text")
        pfad = os.path.join(tmp, "turm.json")
        open(pfad, "w", encoding="utf-8").write(text)

        # --- Rundlauf über das echte Datei-Feld
        page.click("#btn-start"); page.click("#btn-extras"); page.click("#btn-staende")
        page.wait_for_selector("#staende.open")
        page.set_input_files("#stand-datei", pfad)
        page.wait_for_function("() => window.wipfelkratzer.staende.ladeIndex().staende.length === 2",
                               timeout=10000)
        idx = page.evaluate("() => window.wipfelkratzer.staende.ladeIndex()")
        neu = [e for e in idx["staende"] if e["standKey"] != "wipfelkratzer-v1"][0]
        # kein automatischer Wechsel
        assert idx["aktiv"] != neu["id"], idx
        # Inhalt ist gleich
        kopie = json.loads(page.evaluate("k => localStorage.getItem(k)", neu["standKey"]))
        assert kopie["floors"] == 3 and kopie["nuts"] == 7, kopie
        assert kopie["rooms"]["1"][0]["id"] == "bett", kopie["rooms"]
        assert abs(kopie["rooms"]["1"][0]["x"] - 0.4) < 1e-9, kopie["rooms"]
        fotos = json.loads(page.evaluate("k => localStorage.getItem(k)", neu["fotoKey"]))
        assert len(fotos) == 1 and fotos[0]["text"] == "alt", fotos
        # Vorschaubild übernommen
        assert (neu["bild"] or "").startswith("data:image/"), neu
        # Original unangetastet
        orig = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))
        assert orig["nuts"] == 7 and orig["floors"] == 3, orig
        # Die Karte ist sofort da
        assert page.locator("#staende .standkarte").count() == 2

        # --- Der importierte Turm laesst sich betreten
        page.evaluate("id => window.wipfelkratzer.staende.wähleStand(id)", neu["id"])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 3
        assert page.evaluate("() => window.wipfelkratzer.state.rooms['1'].length") == 1
        assert page.evaluate("() => window.wipfelkratzer.fotos.length") == 1

        # --- Alte Generation (version 1, Tapete als String)
        alt1 = json.dumps({"typ": "wipfelkratzer-stand", "version": 1, "name": "Uralt",
                           "stand": {"floors": 2, "rooms": {}, "wallpaper": {"1": "blumen"},
                                     "flooring": {}, "fulfilled": {}, "nuts": 0,
                                     "bridge": False, "garden": False, "night": False, "cutaway": False}})
        r = page.evaluate("t => window.wipfelkratzer.importiereText(t)", alt1)
        assert r["ok"] is True, r
        page.evaluate("id => window.wipfelkratzer.staende.wähleStand(id)", r["eintrag"]["id"])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        wp = page.evaluate("() => window.wipfelkratzer.state.wallpaper['1']")
        assert sorted(wp.keys()) == ["back", "front", "left", "right"], wp

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Import legt einen neuen Turm an und ist ein sauberer Rundlauf")
```

  Ausführen → scheitert (`importiereText` fehlt, `#stand-datei` existiert nicht).

- [ ] **Step 2: Markup ergänzen.** In `index.html` im Block `#staende-actions`
      (aus #53) **vor** `#btn-standclose` einfügen:

```html
      <button id="btn-stand-import">Turm einlesen</button>
      <input id="stand-datei" class="hidden" type="file" accept="application/json,.json">
```

- [ ] **Step 3: Import bauen.** In `js/game.js` nach dem Block «Turm sichern»
      einfügen:

```js
/* ---------- Turm einlesen ---------- */
/* Ein Import geht immer in einen freien Platz — überschrieben wird nie.
   Schlägt das Schreiben fehl (voller Speicher), wird der eben angelegte Turm
   wieder entfernt, damit keine Ruine stehen bleibt. */
function importiereText(text) {
  const geprüft = pruefeDatei(text);
  if (!geprüft.ok) { toast(geprüft.grund); return { ok: false, grund: geprüft.grund }; }
  const d = geprüft.datei;
  const idx = staende.ladeIndex();
  const name = idx.staende.some(e => e.name === d.name) ? d.name + ' (eingelesen)' : d.name;
  const eintrag = staende.neuerStand(name);
  if (!eintrag) {
    const grund = 'Es sind schon vier Türme da — lösche zuerst einen.';
    toast(grund); return { ok: false, grund };
  }
  let ok = true;
  try { localStorage.setItem(eintrag.standKey, JSON.stringify(d.stand)); } catch (e) { ok = false; }
  if (ok && d.fotos) { try { localStorage.setItem(eintrag.fotoKey, JSON.stringify(d.fotos)); } catch (e) { ok = false; } }
  if (!ok) {
    staende.loescheStand(eintrag.id);
    const grund = 'Der Speicher ist voll — lösche ein paar Fotos oder einen Turm.';
    toast(grund); renderStaende(); return { ok: false, grund };
  }
  if (d.bild) staende.merkeBild(eintrag.id, d.bild);
  renderStaende();
  toast('«' + name + '» ist da. Tippe auf «Weiterbauen», um hinzugehen.');
  return { ok: true, eintrag };
}

/* Auf dem Tablet gibt es kein Ziehen von Dateien — der Dateidialog ist der
   einzige Weg, der auf iPad und Rechner gleich funktioniert. */
function importiereDatei(file) {
  if (!file) return;
  if (file.size > MAX_DATEI) { toast('Diese Datei ist zu gross.'); return; }
  const leser = new FileReader();
  leser.onload = () => importiereText(String(leser.result || ''));
  leser.onerror = () => toast('Diese Datei liess sich nicht lesen.');
  leser.readAsText(file);
}
$('btn-stand-import').onclick = () => $('stand-datei').click();
$('stand-datei').onchange = ev => {
  importiereDatei(ev.target.files && ev.target.files[0]);
  ev.target.value = '';   /* sonst löst dieselbe Datei kein zweites Mal aus */
};
```

- [ ] **Step 4: Debug-Hook erweitern.** Im Literal `window.wipfelkratzer = { … }`
      ergänzen:

```js
  importiereText,
```

- [ ] **Step 5: Test grün.** `python3 .superpowers/verify/test_stand_import.py`
      → `OK: Import legt einen neuen Turm an und ist ein sauberer Rundlauf`.

- [ ] **Step 6: Commit.**
      `git add index.html js/game.js && git commit -m "feat(spielstand): Turm aus Datei einlesen"`

---

### Task 5: Fehlerfälle — kaputte Dateien, voller Speicher, kein Platz

**Files:**
- Modify: `js/game.js` (nur falls der Test Lücken zeigt; sonst reiner Prüftask)
- Test: `.superpowers/verify/test_import_fehler.py` (nicht committet)

**Interfaces:** keine neuen.

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_import_fehler.py`:

```python
#!/usr/bin/env python3
"""Kaputte, fremde und boesartige Dateien richten nichts an — und lassen keine Ruine zurueck."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = ('{"floors":3,"nuts":7,"rooms":{},"wallpaper":{},"flooring":{},"fulfilled":{},'
       '"bridge":false,"garden":false,"night":false,"cutaway":false}')

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("alt => { localStorage.clear(); localStorage.setItem('wipfelkratzer-v1', alt); }", ALT)
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.importiereText")
        page.click("#btn-start"); page.click("#btn-extras"); page.click("#btn-staende")
        page.wait_for_selector("#staende.open")

        def anzahl():
            return page.evaluate("() => window.wipfelkratzer.staende.ladeIndex().staende.length")

        vorher = anzahl()
        gruende = []
        for text in ["", "{kaputt", json.dumps({"hallo": "welt"}),
                     json.dumps({"typ": "wipfelkratzer-stand", "version": 99, "stand": {}}),
                     json.dumps({"typ": "wipfelkratzer-stand", "version": 2})]:
            r = page.evaluate("t => window.wipfelkratzer.importiereText(t)", text)
            assert r["ok"] is False, (text[:20], r)
            gruende.append(r["grund"])
            assert anzahl() == vorher, f"halb angelegter Turm nach: {text[:20]}"
        assert len(set(gruende)) >= 4, gruende
        # Die Meldung erscheint auch sichtbar
        assert page.locator(".toast-item").count() >= 1

        # Der Spielstand ist unberuehrt
        assert json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))["nuts"] == 7

        # --- Kein Platz mehr: vier Tuerme -> Import wird abgelehnt, nichts halb angelegt
        page.evaluate("""() => { const S = window.wipfelkratzer.staende;
            while (S.ladeIndex().staende.length < S.MAX_STAENDE) S.neuerStand(); }""")
        voll = json.dumps({"typ": "wipfelkratzer-stand", "version": 2, "name": "Passt nicht",
                           "stand": {"floors": 1, "rooms": {}}})
        r = page.evaluate("t => window.wipfelkratzer.importiereText(t)", voll)
        assert r["ok"] is False and "vier" in r["grund"], r
        assert anzahl() == 4, anzahl()

        # --- Voller Speicher: setItem wirft -> der angelegte Turm wird zurueckgenommen
        page.evaluate("""() => { const S = window.wipfelkratzer.staende;
            const ids = S.ladeIndex().staende.slice(1).map(e => e.id);
            ids.forEach(id => S.loescheStand(id)); }""")
        vorher = anzahl()
        page.evaluate("""() => {
            window.__echt = Storage.prototype.setItem;
            Storage.prototype.setItem = function (k, v) {
                if (k.indexOf('wipfelkratzer-stand-') === 0) throw new DOMException('voll', 'QuotaExceededError');
                return window.__echt.call(this, k, v);
            };
        }""")
        r = page.evaluate("t => window.wipfelkratzer.importiereText(t)", voll)
        page.evaluate("() => { Storage.prototype.setItem = window.__echt; }")
        assert r["ok"] is False and "voll" in r["grund"].lower(), r
        assert anzahl() == vorher, "Ruine nach vollem Speicher"
        keys = page.evaluate("() => Object.keys(localStorage).filter(k => k.indexOf('wipfelkratzer-stand-') === 0)")
        assert keys == [], keys

        # --- Boesartige Datei: nichts davon landet im Spiel
        boese = json.dumps({"typ": "wipfelkratzer-stand", "version": 2, "name": "Boese",
                            "stand": {"__proto__": {"gehackt": True}, "floors": 99,
                                      "rooms": {"1": [{"id": "raketenwerfer", "x": 0, "y": 0, "z": 0, "rot": 0}]}},
                            "fotos": [{"url": "javascript:alert(1)", "text": "", "t": 1}]})
        r = page.evaluate("t => window.wipfelkratzer.importiereText(t)", boese)
        assert r["ok"] is True, r
        assert page.evaluate("() => ({}).gehackt === undefined") is True
        kopie = json.loads(page.evaluate("k => localStorage.getItem(k)", r["eintrag"]["standKey"]))
        assert kopie["floors"] == 10, kopie["floors"]
        assert kopie["rooms"] == {}, kopie["rooms"]
        fotos = page.evaluate("k => localStorage.getItem(k)", r["eintrag"]["fotoKey"])
        assert fotos in (None, "[]"), fotos

        # --- Der boese Turm laesst sich gefahrlos betreten
        page.evaluate("id => window.wipfelkratzer.staende.wähleStand(id)", r["eintrag"]["id"])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 10

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Fehlerfaelle melden verstaendlich und lassen keine Ruine zurueck")
```

  Ausführen → erwartet werden Treffer an drei Stellen: die Rücknahme bei vollem
  Speicher, die Unterscheidbarkeit der Meldungen und die Toast-Sichtbarkeit.

- [ ] **Step 2: Lücken schliessen.** Genau die Stellen nachziehen, an denen der
      Test fällt — erwartbar sind:
  - `importiereText()` muss `staende.loescheStand(eintrag.id)` **auch** dann
    aufrufen, wenn erst das Foto-Schreiben scheitert (Stand-Schlüssel ist dann
    schon geschrieben und muss mitverschwinden — `loescheStand` entfernt beide).
  - Die fünf Ablehnungsgründe aus `pruefeDatei()` (Task 1) dürfen nicht
    versehentlich zu einem Sammeltext zusammenfallen.
  - `toast()` muss auch aufgerufen werden, wenn die Übersicht offen ist — der
    Toast-Stapel liegt bei `z-index: 9` (`index.html:127`), das Overlay bei
    `z-index: 25`. Damit die Meldung sichtbar ist, bekommt der Stapel
    `z-index: 26`. Änderung in `index.html` an der Regel `#toast-stack { … }`:
    `z-index: 9` → `z-index: 26`.

- [ ] **Step 3: Test grün.** `python3 .superpowers/verify/test_import_fehler.py`
      → `OK: Fehlerfaelle melden verstaendlich und lassen keine Ruine zurueck`.

- [ ] **Step 4: Regression prüfen.** Die Prüfskripte aus #53 noch einmal laufen
      lassen, soweit vorhanden — insbesondere
      `python3 .superpowers/verify/test_staende_abnahme.py` — damit die
      `z-index`-Änderung nichts umgeworfen hat.

- [ ] **Step 5: Commit.**
      `git add index.html js/game.js && git commit -m "fix(spielstand): Import nimmt sich bei vollem Speicher zurück"`

---

### Task 6: Gesamtdurchlauf, Changelog und TODO

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`
- Test: `.superpowers/verify/test_export_abnahme.py` (nicht committet)

**Interfaces:** keine neuen.

**Steps:**

- [ ] **Step 1: Abnahmeskript schreiben und laufen lassen.**
      `.superpowers/verify/test_export_abnahme.py` fährt den vollen Rundlauf der
      Acceptance Criteria ab: sichern, Turm löschen, einlesen, vergleichen —
      und prüft nebenbei die Konsole.

```python
#!/usr/bin/env python3
"""Abnahme zu #52 — Rundlauf sichern/loeschen/einlesen und saubere Konsole."""
import json, os, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = {"floors": 4, "nuts": 12,
       "rooms": {"1": [{"id": "bett", "x": 0.4, "y": 2.2, "z": 0.2, "rot": 0},
                       {"id": "tisch", "x": -0.6, "y": 2.2, "z": 0.5, "rot": 1.5707963}],
                 "roof": [{"id": "pool", "x": 0.2, "y": 0, "z": 0.1, "rot": 0}]},
       "wallpaper": {"1": {"back": "blumen", "left": "blumen", "right": "blumen", "front": "blumen"}},
       "flooring": {}, "fulfilled": {"1": True},
       "bridge": True, "garden": True, "night": False, "cutaway": False}

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
tmp = tempfile.mkdtemp()
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        laut = []
        page.on("pageerror", lambda e: laut.append("pageerror: " + str(e)))
        page.on("console", lambda m: laut.append(m.type + ": " + m.text)
                if m.type in ("error", "warning") else None)

        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""alt => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', JSON.stringify(alt));
            localStorage.setItem('wipfelkratzer-fotos',
                '[{"url":"data:image/jpeg;base64,/9j/4AAQ","text":"Erinnerung","t":1}]');
        }""", ALT)
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.importiereText")

        # sichern
        text = page.evaluate("() => window.wipfelkratzer.standDatei(window.wipfelkratzer.stand, true).text")
        pfad = os.path.join(tmp, "abnahme.json")
        open(pfad, "w", encoding="utf-8").write(text)
        datei = json.loads(text)
        assert datei["typ"] == "wipfelkratzer-stand" and isinstance(datei["version"], int), datei
        assert datei["spiel"] == page.evaluate("() => window.GAME_VERSION"), datei

        # Turm loeschen (über die Slot-Ebene aus #53)
        page.evaluate("() => { const S = window.wipfelkratzer.staende;"
                      " S.loescheStand(window.wipfelkratzer.stand.id); }")
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 0

        # wieder einlesen — über das echte Datei-Feld
        page.click("#btn-start"); page.click("#btn-extras"); page.click("#btn-staende")
        page.wait_for_selector("#staende.open")
        page.set_input_files("#stand-datei", pfad)
        page.wait_for_function("() => window.wipfelkratzer.staende.ladeIndex().staende.length === 2",
                               timeout=10000)
        idx = page.evaluate("() => window.wipfelkratzer.staende.ladeIndex()")
        neu = [e for e in idx["staende"] if e["id"] != idx["aktiv"]][0]
        page.evaluate("id => window.wipfelkratzer.staende.wähleStand(id)", neu["id"])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")

        st = page.evaluate("() => window.wipfelkratzer.state")
        assert st["floors"] == 4 and st["nuts"] == 12, st
        assert st["bridge"] is True and st["garden"] is True, st
        assert [e["id"] for e in st["rooms"]["1"]] == ["bett", "tisch"], st["rooms"]
        assert abs(st["rooms"]["1"][1]["rot"] - 1.5707963) < 1e-6, st["rooms"]
        assert st["rooms"]["roof"][0]["id"] == "pool", st["rooms"]
        assert st["wallpaper"]["1"]["back"] == "blumen", st["wallpaper"]
        assert page.evaluate("() => window.wipfelkratzer.fotos[0].text") == "Erinnerung"

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not laut, laut
print("OK: Abnahme #52 bestanden, Konsole sauber")
```

      Danach den Server per Port beenden, nie `pkill -f`:
      `ss -lptn 'sport = :8000' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`

- [ ] **Step 2: Alle Prüfskripte hintereinander.** Reihenfolge:
      `test_standdatei_modul.py`, `test_stand_export.py`, `test_sichern_knopf.py`,
      `test_stand_import.py`, `test_import_fehler.py`, `test_export_abnahme.py`
      — dazu die sieben aus #53 als Regression. Alle müssen `OK:` melden. Im
      Vordergrund, mit grosszügigem `timeout`.

- [ ] **Step 3: Manueller iPad-Schritt festhalten.** Der Share-Weg und der
      iOS-Dateidialog lassen sich headless nur gestellt prüfen. In `TODO.md`
      unter «Offen» vermerken:

```markdown
- [ ] Auf dem iPad einmal von Hand prüfen: «Sichern» legt über das Share-Sheet
      eine .json in «Dateien» ab, und «Turm einlesen» findet sie dort wieder (#52)
```

- [ ] **Step 4: Changelog.** Der Eintrag gehört unter `## [Unreleased]` — die
      Versionsnummer entsteht erst beim Release, nicht hier. Stil wie die
      bestehenden Einträge in `CHANGELOG.md`: deutscher Fliesstext unter
      `### Added`, Issue-Nummer in Klammern am Ende. Steht der Eintrag aus #53
      schon dort, kommt dieser darunter:

```markdown
- Ein Turm lässt sich jetzt als Datei sichern und wieder einlesen. In «Meine
  Türme» sichert «Sichern» den gewählten Turm — wahlweise mit oder ohne Fotos,
  die ungefähre Grösse steht auf dem Knopf — auf dem Tablet über das
  System-Sheet, am Rechner als Datei. «Turm einlesen» holt eine solche Datei
  zurück, und zwar immer in einen freien Platz: ein bestehender Turm wird nie
  überschrieben. Fremde oder kaputte Dateien werden vorher geprüft und mit
  einer verständlichen Meldung abgelehnt (#52)
```

- [ ] **Step 5: TODO fortschreiben.** In `TODO.md` unter «Erledigt» ergänzen:

```markdown
- [x] Turm als Datei sichern und wieder einlesen — Import geht in einen freien Platz (#52)
```

- [ ] **Step 6: Commit.**
      `git add CHANGELOG.md TODO.md && git commit -m "docs(spielstand): Changelog und TODO für #52"`

**Nicht Teil dieser Task:** `version.js` und ein `chore(release)`-Commit. Die
Version wird beim Schneiden des Release gehoben, nachdem der PR gemergt ist —
ein Feature-Plan, der das selbst tut, kollidiert mit jedem anderen offenen Plan.
