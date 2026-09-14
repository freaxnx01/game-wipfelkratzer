# Plan: Mehrere Spielstände nebeneinander führen

Issue: `freaxnx01/game-wipfelkratzer#53`

**Goal:** Über dem heutigen Einzelstand entsteht eine Slot-Ebene: ein schlanker
Index `wipfelkratzer-staende` verweist auf bis zu vier Stände, jeder mit eigenem
Stand-Schlüssel und eigener Fotogalerie. Der bestehende Stand wird beim ersten
Start zu Stand 1, **ohne dass ein Byte umkopiert wird** — er behält die
Schlüssel `wipfelkratzer-v1` und `wipfelkratzer-fotos`. Gewählt wird ein Turm
über Bild und Namen in einer neuen Übersicht «Meine Türme», die auch das
Löschen eines einzelnen Turms übernimmt; «Neu anfangen» entfällt.

**Architecture:** Buildless, ES-Module, three.js r184 über die Import-Map
(`index.html:10-27`) — an der Import-Map wird nichts geändert. Neu ist ein
abhängigkeitsfreies Modul `js/staende.js`, das ausschliesslich auf
`localStorage` arbeitet und von `js/game.js` relativ importiert wird. In
`js/game.js` ändern sich nur die vier Speicherzugriffe (`js/game.js:36`, `:41`,
`:1137`, `:1138`), der Reset-Block (`js/game.js:894-899`) und ein neuer
Übersichts-Block bei den Overlays. In `index.html` kommen ein Overlay `#staende`,
dessen CSS und zwei Einstiegsknöpfe dazu.

**Spec:** `docs/ai-notes/specs/2026-09-14-mehrere-spielstaende-design.md`

## Global Constraints

- **Keine neue Laufzeit-Abhängigkeit.** Kein Eintrag in der Import-Map, kein
  `package.json`, kein `node_modules`, kein neuer `<script src="https://…">`
  (`CLAUDE.md:796-821`).
- **Das Format des Stand-Inhalts bleibt unverändert.** `JSON.stringify({ ...state,
  wallpaper })` (`js/game.js:38-41`) wird nicht angefasst, ebenso wenig die
  Tapeten-Migration (`js/game.js:379-386`). Nur der **Ziel-Schlüssel** ändert sich.
- **Die Migration kopiert nichts um.** Stand 1 behält `wipfelkratzer-v1` und
  `wipfelkratzer-fotos`. Wer in einem Task Umkopieren einbaut, verletzt A2 der Spec.
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
  `ae oe ue`; `ss` statt `ß` — wie der bestehende Code.
- **`version.js` wird nicht angefasst** und es gibt **keinen**
  `chore(release)`-Commit. Die Version entsteht separat beim Release.
- Jeder Task endet mit einem Commit im Conventional-Commit-Format
  (`CLAUDE.md:180-207`).

Einmalige Vorbereitung vor Task 1:

```bash
mkdir -p .superpowers/verify
python3 -c "import playwright" || pip install playwright && playwright install chromium
```

Alle Prüfskripte benutzen denselben Rahmen; er wird pro Skript ausgeschrieben
(kein gemeinsames Hilfsmodul, damit jedes Skript einzeln lauffähig bleibt).

---

### Task 1: Slot-Ebene `js/staende.js`

**Files:**
- Create: `js/staende.js`
- Test: `.superpowers/verify/test_staende_modul.py` (nicht committet)

**Interfaces:**
- `export const INDEX_KEY = 'wipfelkratzer-staende'`
- `export const LEGACY_STAND = 'wipfelkratzer-v1'`
- `export const LEGACY_FOTOS = 'wipfelkratzer-fotos'`
- `export const MAX_STAENDE = 4`
- `export function ladeIndex(): { v: number, aktiv: string, staende: Eintrag[] }`
- `export function schreibeIndex(idx): boolean`
- `export function aktiverStand(): Eintrag`
- `export function wähleStand(id: string): boolean`
- `export function neuerStand(name?: string): Eintrag | null`
- `export function benenneUm(id: string, name: string): boolean`
- `export function loescheStand(id: string): Eintrag` (gibt den danach aktiven zurück)
- `export function merkeBild(id: string, dataUrl: string): boolean`
- `export function standInfo(e: Eintrag): { floors: number, möbel: number }`
- `Eintrag = { id, name, standKey, fotoKey, bild, angelegt, zuletzt }`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_staende_modul.py`:

```python
#!/usr/bin/env python3
"""Prueft js/staende.js: Migration ohne Umkopieren, CRUD, Obergrenze, kaputter Index."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT_STAND = {"floors": 3, "nuts": 7, "bridge": True, "garden": False, "night": False,
             "cutaway": False, "fulfilled": {"1": True}, "flooring": {"1": "dielen"},
             "wallpaper": {"1": "blumen"},
             "rooms": {"1": [{"id": "bett", "x": 0.5, "y": 2.2, "z": 0.0, "rot": 0}]}}
ALT_FOTOS = [{"url": "data:image/jpeg;base64,/9j/4AAQ", "text": "Hallo", "t": 1789999530000}]

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Das Spiel selbst wird hier nicht gebraucht: leere Seite auf derselben Origin.
        page.goto(f"http://localhost:{PORT}/", wait_until="domcontentloaded")

        def run(script, arg=None):
            return page.evaluate(
                "async (arg) => { const S = await import('/js/staende.js?t=' + Math.random());"
                + script + " }", arg)

        # --- Fall 1: Altbestand ohne Index -> ein Eintrag auf den Altschluesseln
        page.evaluate("""([stand, fotos]) => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', JSON.stringify(stand));
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify(fotos));
        }""", [ALT_STAND, ALT_FOTOS])
        idx = run("const i = S.ladeIndex(); S.schreibeIndex(i); return i;")
        assert len(idx["staende"]) == 1, idx
        e = idx["staende"][0]
        assert e["standKey"] == "wipfelkratzer-v1", e
        assert e["fotoKey"] == "wipfelkratzer-fotos", e
        assert idx["aktiv"] == e["id"], idx
        # nichts umkopiert, nichts verändert
        roh = page.evaluate("() => [localStorage.getItem('wipfelkratzer-v1'), localStorage.getItem('wipfelkratzer-fotos')]")
        assert json.loads(roh[0]) == ALT_STAND, "Stand-Inhalt wurde angefasst"
        assert json.loads(roh[1]) == ALT_FOTOS, "Fotos wurden angefasst"
        keys = page.evaluate("() => Object.keys(localStorage).sort()")
        assert keys == ["wipfelkratzer-fotos", "wipfelkratzer-staende", "wipfelkratzer-v1"], keys

        # standInfo liest die Stockwerke aus dem Stand-Inhalt
        info = run("const i = S.ladeIndex(); return S.standInfo(i.staende[0]);")
        assert info["floors"] == 3, info
        assert info["möbel"] == 1, info

        # --- Fall 2: frische Installation -> ebenfalls Altschluessel
        page.evaluate("() => localStorage.clear()")
        idx = run("const i = S.ladeIndex(); S.schreibeIndex(i); return i;")
        assert idx["staende"][0]["standKey"] == "wipfelkratzer-v1", idx

        # --- Fall 3: kaputter Index -> verworfen, kein Wurf
        page.evaluate("() => { localStorage.setItem('wipfelkratzer-staende', '{kaputt'); }")
        idx = run("const i = S.ladeIndex(); S.schreibeIndex(i); return i;")
        assert len(idx["staende"]) == 1, idx
        page.evaluate("() => { localStorage.setItem('wipfelkratzer-staende', '[1,2,3]'); }")
        idx = run("const i = S.ladeIndex(); S.schreibeIndex(i); return i;")
        assert len(idx["staende"]) == 1 and idx["aktiv"], idx

        # --- Fall 4: aktiv zeigt ins Leere -> erster Eintrag wird aktiv
        page.evaluate("""() => {
            const i = JSON.parse(localStorage.getItem('wipfelkratzer-staende'));
            i.aktiv = 'gibtsnicht';
            localStorage.setItem('wipfelkratzer-staende', JSON.stringify(i));
        }""")
        akt = run("return S.aktiverStand();")
        assert akt["standKey"] == "wipfelkratzer-v1", akt

        # --- Fall 5: neuer Stand bekommt eigene Schluessel, alte bleiben unberuehrt
        neu = run("return S.neuerStand('Julias Turm');")
        assert neu["name"] == "Julias Turm", neu
        assert neu["standKey"] == "wipfelkratzer-stand-" + neu["id"], neu
        assert neu["fotoKey"] == "wipfelkratzer-fotos-" + neu["id"], neu
        assert neu["standKey"] != "wipfelkratzer-v1"
        alle = run("return S.ladeIndex().staende.map(e => e.standKey);")
        assert alle == ["wipfelkratzer-v1", neu["standKey"]], alle

        # --- Fall 6: Wechsel
        assert run("return S.wähleStand(arg);", neu["id"]) is True
        assert run("return S.aktiverStand().id;") == neu["id"]

        # --- Fall 7: Umbenennen überlebt einen frischen Modul-Import
        run("S.benenneUm(arg, 'Waldturm'); return null;", neu["id"])
        assert run("return S.aktiverStand().name;") == "Waldturm"

        # --- Fall 8: Obergrenze
        run("while (S.ladeIndex().staende.length < S.MAX_STAENDE) S.neuerStand(); return null;")
        n = run("return S.ladeIndex().staende.length;")
        assert n == 4, n
        assert run("return S.neuerStand('zu viel');") is None, "MAX_STAENDE greift nicht"

        # --- Fall 9: Loeschen entfernt beide Schluessel, nur die des Standes
        page.evaluate("""id => {
            localStorage.setItem('wipfelkratzer-stand-' + id, '{"floors":1}');
            localStorage.setItem('wipfelkratzer-fotos-' + id, '[]');
        }""", neu["id"])
        run("S.loescheStand(arg); return null;", neu["id"])
        keys = page.evaluate("() => Object.keys(localStorage)")
        assert ("wipfelkratzer-stand-" + neu["id"]) not in keys, keys
        assert ("wipfelkratzer-fotos-" + neu["id"]) not in keys, keys
        assert "wipfelkratzer-v1" in keys and "wipfelkratzer-fotos" in keys, keys
        assert run("return S.ladeIndex().staende.length;") == 3

        # --- Fall 10: letzten Stand loeschen -> sofort ein frischer leerer
        run("for (const e of S.ladeIndex().staende) S.loescheStand(e.id); return null;")
        idx = run("return S.ladeIndex();")
        assert len(idx["staende"]) == 1, idx
        assert idx["aktiv"] == idx["staende"][0]["id"], idx

        # --- Fall 11: Bild landet im Index, nicht im Stand
        run("S.merkeBild(S.aktiverStand().id, 'data:image/jpeg;base64,AAA'); return null;")
        assert run("return S.aktiverStand().bild;") == "data:image/jpeg;base64,AAA"

        browser.close()
finally:
    srv.kill(); srv.wait()

print("OK: Slot-Ebene migriert ohne Umkopieren und verwaltet bis zu vier Staende")
```

  Ausführen (Vordergrund, grosszügiges `timeout`):
  `python3 .superpowers/verify/test_staende_modul.py` → muss scheitern
  («Failed to fetch dynamically imported module: /js/staende.js»).

- [ ] **Step 2: `js/staende.js` anlegen.** Vollständiger Inhalt:

```js
/* Slot-Ebene über dem Spielstand.
   Ein Index verweist auf bis zu vier Stände; jeder Stand hat einen eigenen
   Schlüssel für den Inhalt und einen für seine Fotos. Der Index schaut nie in
   einen Stand hinein — was drinsteht, geht nur das Spiel etwas an.
   Stand 1 eines Altbestands behält bewusst die alten Schlüssel: so muss beim
   Umstieg kein einziges Byte umkopiert werden (der Speicher ist knapp). */
export const INDEX_KEY = 'wipfelkratzer-staende';
export const LEGACY_STAND = 'wipfelkratzer-v1';
export const LEGACY_FOTOS = 'wipfelkratzer-fotos';
export const MAX_STAENDE = 4;
const INDEX_V = 2;

const lies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const schreib = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const weg = k => { try { localStorage.removeItem(k); } catch (e) {} };

const neueId = () => 's' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

function frischerEintrag(name, legacy) {
  const id = legacy ? 's1' : neueId();
  return { id, name: name || 'Mein Wipfelkratzer',
    standKey: legacy ? LEGACY_STAND : 'wipfelkratzer-stand-' + id,
    fotoKey: legacy ? LEGACY_FOTOS : 'wipfelkratzer-fotos-' + id,
    bild: null, angelegt: Date.now(), zuletzt: Date.now() };
}

function gueltig(e) {
  return !!e && typeof e === 'object' && typeof e.id === 'string' && e.id
    && typeof e.standKey === 'string' && e.standKey
    && typeof e.fotoKey === 'string' && e.fotoKey;
}

/* Liest den Index. Wirft nie: ist er kaputt, fremd oder gar nicht da, entsteht
   ein Index mit genau einem Stand auf den Altschlüsseln — derselbe Pfad für
   «alter Einzelstand» und «frische Installation». */
export function ladeIndex() {
  let idx = null;
  try { idx = JSON.parse(lies(INDEX_KEY) || 'null'); } catch (e) { idx = null; }
  if (!idx || typeof idx !== 'object' || Array.isArray(idx) || !Array.isArray(idx.staende)) idx = null;
  if (idx) {
    idx.staende = idx.staende.filter(gueltig).slice(0, MAX_STAENDE);
    idx.staende.forEach(e => { if (typeof e.name !== 'string' || !e.name) e.name = 'Wipfelkratzer'; });
    if (!idx.staende.length) idx = null;
  }
  if (!idx) idx = { v: INDEX_V, aktiv: '', staende: [frischerEintrag(null, true)] };
  idx.v = INDEX_V;
  if (!idx.staende.some(e => e.id === idx.aktiv)) idx.aktiv = idx.staende[0].id;
  return idx;
}

export function schreibeIndex(idx) { return schreib(INDEX_KEY, JSON.stringify(idx)); }

export function aktiverStand() {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === idx.aktiv) || idx.staende[0];
  if (lies(INDEX_KEY) === null) schreibeIndex(idx);
  return e;
}

export function wähleStand(id) {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === id);
  if (!e) return false;
  idx.aktiv = id; e.zuletzt = Date.now();
  return schreibeIndex(idx);
}

/* Legt einen Stand an — immer mit eigenen Schlüsseln, nie auf den Altschlüsseln.
   Gibt null zurück, wenn kein Platz mehr ist oder der Index nicht schreibbar
   war; dann ist auch nichts halb angelegt. */
export function neuerStand(name) {
  const idx = ladeIndex();
  if (idx.staende.length >= MAX_STAENDE) return null;
  const e = frischerEintrag(name || vorschlagsName(idx), false);
  idx.staende.push(e);
  if (!schreibeIndex(idx)) return null;
  return e;
}

function vorschlagsName(idx) {
  const basis = 'Neuer Turm';
  if (!idx.staende.some(e => e.name === basis)) return basis;
  for (let n = 2; ; n++) { const k = basis + ' ' + n; if (!idx.staende.some(e => e.name === k)) return k; }
}

export function benenneUm(id, name) {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === id);
  if (!e) return false;
  e.name = String(name || '').trim().slice(0, 40) || 'Wipfelkratzer';
  return schreibeIndex(idx);
}

/* Löscht Stand-Inhalt und Galerie und den Eintrag. War es der letzte, entsteht
   sofort ein frischer leerer Stand — das Spiel ist nie standlos. */
export function loescheStand(id) {
  const idx = ladeIndex();
  const i = idx.staende.findIndex(x => x.id === id);
  if (i < 0) return aktiverStand();
  const e = idx.staende[i];
  weg(e.standKey); weg(e.fotoKey);
  idx.staende.splice(i, 1);
  if (!idx.staende.length) idx.staende.push(frischerEintrag(null, true));
  if (!idx.staende.some(x => x.id === idx.aktiv)) idx.aktiv = idx.staende[0].id;
  schreibeIndex(idx);
  return idx.staende.find(x => x.id === idx.aktiv);
}

export function merkeBild(id, dataUrl) {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === id);
  if (!e) return false;
  e.bild = dataUrl; e.zuletzt = Date.now();
  return schreibeIndex(idx);
}

/* Für die Karten in der Übersicht: Stockwerke und Möbelzahl, ohne den Stand ins
   Spiel zu laden. Ein unlesbarer Stand gilt als leer, nicht als Fehler. */
export function standInfo(e) {
  let s = null;
  try { s = JSON.parse(lies(e.standKey) || 'null'); } catch (err) { s = null; }
  if (!s || typeof s !== 'object') return { floors: 0, möbel: 0 };
  let möbel = 0;
  const r = s.rooms && typeof s.rooms === 'object' ? s.rooms : {};
  for (const k in r) if (Array.isArray(r[k])) möbel += r[k].length;
  return { floors: Number(s.floors) || 0, möbel };
}
```

- [ ] **Step 3: Test grün.** `python3 .superpowers/verify/test_staende_modul.py`
      → `OK: Slot-Ebene migriert ohne Umkopieren und verwaltet bis zu vier Staende`.
      Zusätzlich prüfen, dass das Modul nichts importiert:
      `grep -n "^import\|require(" js/staende.js` → keine Treffer.

- [ ] **Step 4: Commit.**
      `git add js/staende.js && git commit -m "feat(spielstand): Slot-Ebene für mehrere Stände"`

---

### Task 2: `js/game.js` liest und schreibt den aktiven Stand

**Files:**
- Modify: `js/game.js` (Import bei `js/game.js:1-3`, Laden `js/game.js:36`,
  Speichern `js/game.js:37-42`, Fotos `js/game.js:1137-1138`, Debug-Hook
  `js/game.js:1188`)
- Test: `.superpowers/verify/test_stand_anbindung.py` (nicht committet)

**Interfaces:**
- `import * as staende from './staende.js';`
- `const STAND = staende.aktiverStand();` (einmalig beim Start, Modulvariable)
- `window.wipfelkratzer.stand = STAND`
- `window.wipfelkratzer.staende = staende`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_stand_anbindung.py`:

```python
#!/usr/bin/env python3
"""Der alte Einzelstand laedt unverändert und wird über die Slot-Ebene geschrieben."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT_STAND = {"floors": 3, "nuts": 7, "bridge": True, "garden": True, "night": False,
             "cutaway": False, "fulfilled": {}, "flooring": {},
             "wallpaper": {"1": "blumen"},   # alte Form: ein String für die ganze Wohnung
             "rooms": {"1": [{"id": "bett", "x": 0.4, "y": 2.2, "z": 0.2, "rot": 0}]}}
ALT_FOTOS = [{"url": "data:image/jpeg;base64,/9j/4AAQ", "text": "Turm", "t": 1789999530000}]

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""([stand, fotos]) => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', JSON.stringify(stand));
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify(fotos));
        }""", [ALT_STAND, ALT_FOTOS])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")

        # 1) Der alte Stand ist da
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 3
        assert page.evaluate("() => window.wipfelkratzer.state.nuts") == 7
        assert page.evaluate("() => window.wipfelkratzer.state.bridge") is True
        assert page.evaluate("() => window.wipfelkratzer.state.rooms['1'].length") == 1

        # 2) Die Tapeten-Migration lief weiterhin: String -> vier Waende
        wp = page.evaluate("() => window.wipfelkratzer.state.wallpaper['1']")
        assert isinstance(wp, dict), wp
        assert sorted(wp.keys()) == ["back", "front", "left", "right"], wp
        assert set(wp.values()) == {"blumen"}, wp

        # 3) Der aktive Stand zeigt auf die Altschluessel
        st = page.evaluate("() => window.wipfelkratzer.stand")
        assert st["standKey"] == "wipfelkratzer-v1", st
        assert st["fotoKey"] == "wipfelkratzer-fotos", st

        # 4) Der Index wurde angelegt
        idx = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-staende')"))
        assert len(idx["staende"]) == 1 and idx["aktiv"] == idx["staende"][0]["id"], idx

        # 5) Gespeichert wird in den Schluessel des aktiven Standes
        page.evaluate("() => { window.wipfelkratzer.state.nuts = 42; }")
        page.evaluate("() => window.wipfelkratzer.speichern()")
        page.wait_for_function(
            "() => JSON.parse(localStorage.getItem('wipfelkratzer-v1')).nuts === 42", timeout=5000)

        # 6) Ein zweiter Stand wird sauber getrennt bedient
        neu = page.evaluate("() => window.wipfelkratzer.staende.neuerStand('Zweiter')")
        page.evaluate("id => window.wipfelkratzer.staende.wähleStand(id)", neu["id"])
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 0, "neuer Turm ist nicht leer"
        assert page.evaluate("() => window.wipfelkratzer.stand.standKey") == neu["standKey"]
        # Fotos sind getrennt
        assert page.evaluate("() => window.wipfelkratzer.fotos.length") == 0, "Galerie ist nicht getrennt"
        page.evaluate("() => window.wipfelkratzer.speichern()")
        page.wait_for_function(
            "k => localStorage.getItem(k) !== null", arg=neu["standKey"], timeout=5000)
        # der alte Stand blieb unangetastet
        assert json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))["nuts"] == 42

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Alter Einzelstand laedt unverändert, Staende schreiben getrennt")
```

  Ausführen → scheitert an `wait_for_function` (kein `window.wipfelkratzer.stand`).

- [ ] **Step 2: Modul importieren.** In `js/game.js` unter die bestehende
      `import`-Zeile für `./models.js` (`js/game.js:3`) einfügen:

```js
import * as staende from './staende.js';
```

- [ ] **Step 3: Laden auf den aktiven Stand umstellen.** In `js/game.js` die
      Zeilen 35-42 ersetzen durch:

```js
let state = { floors: 0, rooms: {}, nuts: 0, bridge: false, garden: false, night: false, cutaway: false, fulfilled: {}, wallpaper: {}, flooring: {} };
/* Welcher Turm gerade gespielt wird, entscheidet die Slot-Ebene. Ein Wechsel
   lädt die Seite neu, deshalb genügt es, den Eintrag einmal beim Start zu holen. */
const STAND = staende.aktiverStand();
try { const s = localStorage.getItem(STAND.standKey); if (s) state = Object.assign(state, JSON.parse(s)); } catch (e) {}
let saveT = 0;
const schreibeStand = () => { try {
  const wallpaper = {};
  for (const k in state.wallpaper) { const wp = state.wallpaper[k]; if (wp && typeof wp === 'object' && Object.keys(wp).length) wallpaper[k] = wp; }
  localStorage.setItem(STAND.standKey, JSON.stringify({ ...state, wallpaper }));
} catch (e) {} };
const save = () => { clearTimeout(saveT); saveT = setTimeout(schreibeStand, 300); };
```

- [ ] **Step 4: Fotos auf den aktiven Stand umstellen.** In `js/game.js` die
      Zeilen 1136-1138 (Block «Fotos») ersetzen durch:

```js
let photos = [];
try { photos = JSON.parse(localStorage.getItem(STAND.fotoKey) || '[]'); } catch (e) {}
if (!Array.isArray(photos)) photos = [];
function savePhotos() { try { localStorage.setItem(STAND.fotoKey, JSON.stringify(photos)); } catch (e) { toast('Die Galerie ist voll — lösche ein paar Fotos.'); } }
```

- [ ] **Step 5: Debug-Hook erweitern.** Im Objektliteral `window.wipfelkratzer = { … }`
      (`js/game.js:1188`) **vor** der schliessenden Klammer ergänzen:

```js
  staende, stand: STAND, speichern: schreibeStand, get fotos() { return photos; },
```

- [ ] **Step 6: Test grün.** `python3 .superpowers/verify/test_stand_anbindung.py`
      → `OK: Alter Einzelstand laedt unverändert, Staende schreiben getrennt`.
      Zusätzlich: `grep -n "'wipfelkratzer-v1'\|'wipfelkratzer-fotos'" js/game.js`
      → **keine Treffer mehr** (die Konstanten leben nur noch in `js/staende.js`);
      der Reset in `js/game.js:896` wird in Task 6 entfernt und darf hier als
      einziger Treffer noch stehen.

- [ ] **Step 7: Commit.**
      `git add js/game.js && git commit -m "feat(spielstand): Laden, Speichern und Fotos am aktiven Stand"`

---

### Task 3: Vorschaubild eines Standes

**Files:**
- Modify: `js/game.js` (neue Funktion neben den Foto-Funktionen, nach
  `photoFilename()` bei `js/game.js:1150-1153`; Debug-Hook `js/game.js:1188`)
- Test: `.superpowers/verify/test_standbild.py` (nicht committet)

**Interfaces:**
- `function standBild(): string` — JPEG-Data-URL, Breite ≤ 240 px, Qualität 0,5
- `function merkeStandBild(): void` — nimmt auf und legt es über
  `staende.merkeBild(STAND.id, …)` im Index ab
- `window.wipfelkratzer.standBild = standBild`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_standbild.py`:

```python
#!/usr/bin/env python3
"""Das Vorschaubild ist klein, ein echtes JPEG und landet im Index, nicht im Stand."""
import base64, json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
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
        page.evaluate("() => localStorage.clear()")
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.standBild")

        url = page.evaluate("() => window.wipfelkratzer.standBild()")
        assert url.startswith("data:image/jpeg;base64,"), url[:40]
        roh = base64.b64decode(url.split(",", 1)[1])
        assert roh[:3] == b"\xff\xd8\xff", roh[:8]          # echtes JPEG
        assert len(roh) < 40000, f"Vorschaubild zu gross: {len(roh)} Bytes"

        # Breite <= 240
        w = page.evaluate("""url => new Promise(res => {
            const im = new Image(); im.onload = () => res(im.naturalWidth); im.src = url;
        })""", url)
        assert w <= 240, w

        # merkeStandBild legt es im Index ab, nicht im Stand
        page.evaluate("() => window.wipfelkratzer.merkeStandBild()")
        idx = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-staende')"))
        assert idx["staende"][0]["bild"].startswith("data:image/jpeg;base64,"), idx["staende"][0]
        page.evaluate("() => window.wipfelkratzer.speichern()")
        stand = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))
        assert "bild" not in stand, "Das Bild gehört nicht in den Stand"

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Vorschaubild ist ein kleines JPEG und liegt im Index")
```

  Ausführen → scheitert an `wait_for_function` (`standBild` fehlt).

- [ ] **Step 2: Aufnahme einbauen.** In `js/game.js` direkt nach
      `photoFilename()` (`js/game.js:1153`) einsetzen:

```js
/* Vorschaubild für die Turm-Übersicht: klein und sparsam, weil es im Index
   liegt und der Index bei jedem Wechsel geschrieben wird. Bewusst nicht im
   save()-Pfad — der läuft bei jedem Handgriff (js/game.js:37). */
function standBild() {
  renderer.render(scene, camera);
  const src = renderer.domElement, s = Math.min(1, 240 / src.width);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.5);
}
function merkeStandBild() { try { staende.merkeBild(STAND.id, standBild()); } catch (e) {} }
```

- [ ] **Step 3: Debug-Hook erweitern.** Im Literal `window.wipfelkratzer = { … }`
      (`js/game.js:1188`) ergänzen:

```js
  standBild, merkeStandBild,
```

- [ ] **Step 4: Test grün.** `python3 .superpowers/verify/test_standbild.py`
      → `OK: Vorschaubild ist ein kleines JPEG und liegt im Index`.

- [ ] **Step 5: Commit.**
      `git add js/game.js && git commit -m "feat(spielstand): Vorschaubild je Turm"`

---

### Task 4: Übersicht «Meine Türme» — Markup, CSS, Darstellung

**Files:**
- Modify: `index.html` (neues Overlay nach dem Galerie-Block
  `index.html:224-230`; CSS nach `#gallery .empty` bei `index.html:107`)
- Modify: `js/game.js` (neuer Block «Turm-Übersicht» nach den Foto-Funktionen,
  vor `$('btn-start').onclick` bei `js/game.js:1174`)
- Test: `.superpowers/verify/test_staende_uebersicht.py` (nicht committet)

**Interfaces:**
- Neue Elemente: `#staende`, `#stand-grid`, `#staende-actions`, `#btn-stand-neu`,
  `#stand-voll`, `#btn-standclose`
- Karte: `.standkarte[data-id]` mit `img.stand-bild`, `input.stand-name`,
  `.stand-info`, `button.stand-hin`, `.stand-hier`, `button.stand-weg`
- `function renderStaende(): void`
- `window.wipfelkratzer.renderStaende = renderStaende`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_staende_uebersicht.py`:

```python
#!/usr/bin/env python3
"""Die Übersicht zeigt Bild, Namen und Stockwerke — und markiert den aktiven Turm."""
import subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = ('{"floors":3,"nuts":0,"rooms":{"1":[{"id":"bett","x":0,"y":2.2,"z":0,"rot":0}]},'
       '"wallpaper":{},"flooring":{},"fulfilled":{},"bridge":false,"garden":false,'
       '"night":false,"cutaway":false}')

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
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.renderStaende")

        # Einstieg aus dem Intro, noch bevor 'Los geht's' getippt wurde
        assert page.locator("#intro").is_visible()
        page.click("#btn-intro-staende")
        page.wait_for_selector("#staende.open")
        # Das Overlay muss über dem Intro liegen, sonst ist es nicht bedienbar
        z_st = page.evaluate("() => getComputedStyle(document.getElementById('staende')).zIndex")
        z_in = page.evaluate("() => getComputedStyle(document.getElementById('intro')).zIndex")
        assert int(z_st) > int(z_in), (z_st, z_in)
        assert page.locator("#staende .standkarte").count() == 1
        assert "3" in page.locator("#staende .standkarte .stand-info").inner_text()
        assert page.locator("#staende .standkarte .stand-hier").count() == 1, "aktiver Turm nicht markiert"
        assert page.locator("#staende .standkarte .stand-hin").count() == 0, "aktiver Turm braucht kein 'Weiterbauen'"
        page.click("#btn-standclose")
        assert not page.locator("#staende.open").count()

        # Einstieg aus den Extras
        page.click("#btn-start")
        page.click("#btn-extras")
        page.click("#btn-staende")
        page.wait_for_selector("#staende.open")
        assert not page.locator("#extras-menu.open").count(), "Extras-Menue muss sich schliessen"
        # Beim Oeffnen wird das Vorschaubild aufgefrischt
        page.wait_for_function(
            "() => (JSON.parse(localStorage.getItem('wipfelkratzer-staende')).staende[0].bild || '').startsWith('data:image/jpeg')")
        assert page.locator("#staende .stand-bild").first.get_attribute("src").startswith("data:image/jpeg")

        # Name steht in einem Textfeld, nicht als Nummer
        assert page.locator("#staende .stand-name").first.input_value(), "Turm ohne Namen"

        # Zweiter Turm -> zwei Karten, genau eine Markierung
        page.evaluate("() => window.wipfelkratzer.staende.neuerStand('Julias Turm')")
        page.evaluate("() => window.wipfelkratzer.renderStaende()")
        assert page.locator("#staende .standkarte").count() == 2
        assert page.locator("#staende .stand-hier").count() == 1
        assert page.locator("#staende .stand-hin").count() == 1
        # Turm ohne Bild bekommt einen Platzhalter, kein kaputtes <img>
        zweite = page.locator("#staende .standkarte").nth(1)
        assert zweite.locator(".stand-bild.leer").count() == 1, "Platzhalter fehlt"

        # Obergrenze: bei vier Tuermen ist 'Neuer Turm' gesperrt und erklaert warum
        page.evaluate("""() => { const S = window.wipfelkratzer.staende;
            while (S.ladeIndex().staende.length < S.MAX_STAENDE) S.neuerStand(); }""")
        page.evaluate("() => window.wipfelkratzer.renderStaende()")
        assert page.locator("#staende .standkarte").count() == 4
        assert page.locator("#btn-stand-neu").is_disabled()
        assert page.locator("#stand-voll").is_visible()

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Übersicht zeigt Bild, Namen und Stockwerke")
```

  Ausführen → scheitert (`#btn-intro-staende` existiert nicht).

- [ ] **Step 2: Markup ergänzen.** In `index.html` **nach** dem Galerie-Block
      (`index.html:224-230`, endet mit `</div>` vor `<div id="flash">`) einfügen:

```html
<div id="staende">
  <div class="panel">
    <h2>Meine Türme</h2>
    <div id="stand-grid"></div>
    <p id="stand-voll" class="hidden">Mehr als vier Türme passen nicht. Lösche zuerst einen.</p>
    <div id="staende-actions">
      <button id="btn-stand-neu">Neuer Turm</button>
      <button id="btn-standclose" class="primary">Zu</button>
    </div>
  </div>
</div>
```

      Im Intro (`index.html:236-243`) unter `#btn-start` ergänzen:

```html
    <button id="btn-intro-staende">Meine Türme</button>
```

      Im Extras-Menü (`index.html:171-179`) den Knopf `#btn-reset`
      (`index.html:178`) **noch stehen lassen** und direkt darüber einfügen:

```html
  <button id="btn-staende">Meine Türme</button>
```

      (`#btn-reset` fällt in Task 6.)

- [ ] **Step 3: CSS ergänzen.** In `index.html` direkt nach der Regel
      `#gallery .empty { … }` (`index.html:107`) einfügen:

```css
  /* Turm-Übersicht — liegt über dem Intro (z-index 20), weil man von dort
     hineinkommt. */
  #staende { position: fixed; inset: 0; z-index: 25; display: none; align-items: center; justify-content: center; background: rgba(60,40,20,.45); }
  #staende.open { display: flex; }
  #staende .panel { width: min(760px, 94vw); max-height: 88vh; overflow-y: auto; padding: 16px 20px; }
  #staende h2 { margin: 0 0 10px; color: var(--wood); }
  #stand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .standkarte { background: #fff9ec; border: 3px solid var(--woodL); border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .standkarte.aktiv { border-color: var(--green); }
  .stand-bild { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; display: block; background: #cfe3c2; }
  .stand-bild.leer { border: 2px dashed var(--woodL); background: repeating-linear-gradient(45deg, #f8ecd0 0 7px, #e7d3ab 7px 14px); }
  .stand-name { font-family: inherit; font-size: 15px; font-weight: 700; color: var(--ink); border: 2px solid var(--woodL); border-radius: 8px; background: #fff; padding: 6px 8px; }
  .stand-info { font-size: 12.5px; opacity: .75; }
  .stand-hier { font-size: 13px; font-weight: 700; color: var(--green); align-self: center; }
  .standkarte .zeile { display: flex; gap: 6px; justify-content: flex-end; }
  .standkarte button { min-height: 40px; font-size: 13px; padding: 2px 10px; }
  #stand-voll { margin: 0 0 10px; font-size: 13.5px; opacity: .8; }
  #staende-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  #btn-intro-staende { margin-top: 8px; font-size: 15px; padding: 6px 18px; }
```

- [ ] **Step 4: Darstellung in `js/game.js`.** Direkt **vor**
      `$('btn-start').onclick = …` (`js/game.js:1174`) einfügen:

```js
/* ---------- Turm-Übersicht ---------- */
function renderStaende() {
  const idx = staende.ladeIndex(), grid = $('stand-grid');
  grid.innerHTML = '';
  idx.staende.forEach(e => {
    const info = staende.standInfo(e), hier = e.id === idx.aktiv;
    const d = document.createElement('div');
    d.className = 'standkarte' + (hier ? ' aktiv' : '');
    d.dataset.id = e.id;
    const bild = e.bild
      ? `<img class="stand-bild" src="${e.bild}" alt="">`
      : '<div class="stand-bild leer"></div>';
    d.innerHTML = `${bild}
      <input class="stand-name" maxlength="40" value="${String(e.name).replace(/"/g, '&quot;')}">
      <div class="stand-info">${info.floors} Stockwerke · ${info.möbel} Möbel</div>
      <div class="zeile">${hier ? '<span class="stand-hier">Hier bist du</span>'
        : '<button class="stand-hin primary">Weiterbauen</button>'}
        <button class="stand-weg danger">Löschen</button></div>`;
    grid.appendChild(d);
  });
  const voll = idx.staende.length >= staende.MAX_STAENDE;
  $('btn-stand-neu').disabled = voll;
  $('stand-voll').classList.toggle('hidden', !voll);
}
function oeffneStaende() {
  merkeStandBild();
  renderStaende();
  $('staende').classList.add('open');
}
$('btn-staende').onclick = () => { $('extras-menu').classList.remove('open'); oeffneStaende(); };
$('btn-intro-staende').onclick = oeffneStaende;
$('btn-standclose').onclick = () => $('staende').classList.remove('open');
$('staende').onclick = e => { if (e.target === $('staende')) $('staende').classList.remove('open'); };
```

- [ ] **Step 5: Debug-Hook erweitern.** Im Literal `window.wipfelkratzer = { … }`
      (`js/game.js:1188`) ergänzen:

```js
  renderStaende,
```

- [ ] **Step 6: Test grün.** `python3 .superpowers/verify/test_staende_uebersicht.py`
      → `OK: Übersicht zeigt Bild, Namen und Stockwerke`.

- [ ] **Step 7: Commit.**
      `git add index.html js/game.js && git commit -m "feat(spielstand): Übersicht «Meine Türme»"`

---

### Task 5: Neuer Turm, Wechseln, Umbenennen

**Files:**
- Modify: `js/game.js` (Block «Turm-Übersicht» aus Task 4)
- Test: `.superpowers/verify/test_stand_wechsel.py` (nicht committet)

**Interfaces:**
- `#btn-stand-neu` legt an, wechselt und lädt neu
- `.stand-hin` wechselt und lädt neu (`location.reload()`)
- `.stand-name` schreibt bei `change` über `staende.benenneUm`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_stand_wechsel.py`:

```python
#!/usr/bin/env python3
"""Neu anlegen, hin- und herwechseln, umbenennen — mit getrennten Galerien."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = ('{"floors":3,"nuts":5,"rooms":{},"wallpaper":{},"flooring":{},"fulfilled":{},'
       '"bridge":false,"garden":false,"night":false,"cutaway":false}')
FOTO = "data:image/jpeg;base64,/9j/4AAQ"

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1100, "height": 800})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def übersicht():
            page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.renderStaende")
            page.click("#btn-start")
            page.click("#btn-extras")
            page.click("#btn-staende")
            page.wait_for_selector("#staende.open")

        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""([alt, foto]) => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', alt);
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify([{url: foto, text: 'alt', t: 1}]));
        }""", [ALT, FOTO])
        page.reload(wait_until="load")
        übersicht()

        # Neuer Turm -> Seite laedt neu, Turm ist leer, Galerie ist leer
        page.click("#btn-stand-neu")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand", timeout=15000)
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 0
        assert page.evaluate("() => window.wipfelkratzer.fotos.length") == 0
        neu_key = page.evaluate("() => window.wipfelkratzer.stand.standKey")
        assert neu_key.startswith("wipfelkratzer-stand-"), neu_key

        # Foto im neuen Turm landet nicht im alten
        page.evaluate("foto => { window.wipfelkratzer.fotos.push({url: foto, text: 'neu', t: 2});"
                      " window.wipfelkratzer.speichernFotos(); }", FOTO)
        alt_fotos = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-fotos')"))
        assert len(alt_fotos) == 1 and alt_fotos[0]["text"] == "alt", alt_fotos

        # Umbenennen in der Karte
        übersicht()
        assert page.locator("#staende .standkarte").count() == 2
        feld = page.locator("#staende .standkarte.aktiv .stand-name")
        feld.fill("Julias Turm")
        feld.press("Enter")
        page.wait_for_function(
            "() => JSON.parse(localStorage.getItem('wipfelkratzer-staende'))"
            ".staende.some(e => e.name === 'Julias Turm')")

        # Zurueck zum alten Turm
        page.click("#staende .standkarte:not(.aktiv) .stand-hin")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand", timeout=15000)
        assert page.evaluate("() => window.wipfelkratzer.stand.standKey") == "wipfelkratzer-v1"
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 3, "alter Turm ist nicht mehr da"
        assert page.evaluate("() => window.wipfelkratzer.fotos[0].text") == "alt"

        # Der Name hat den Neustart überlebt
        übersicht()
        namen = page.eval_on_selector_all("#staende .stand-name", "els => els.map(e => e.value)")
        assert "Julias Turm" in namen, namen

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Anlegen, Wechseln und Umbenennen funktionieren")
```

  Ausführen → scheitert (Klick auf `#btn-stand-neu` bewirkt nichts).

- [ ] **Step 2: Foto-Speichern im Hook verfügbar machen.** Im Literal
      `window.wipfelkratzer = { … }` (`js/game.js:1188`) ergänzen:

```js
  speichernFotos: savePhotos,
```

- [ ] **Step 3: Wechsel, Anlegen, Umbenennen verdrahten.** Im Block
      «Turm-Übersicht» (Task 4) nach `renderStaende()` einfügen:

```js
/* Ein Wechsel lädt die Seite neu: die Szene wird beim Start einmalig aus state
   aufgebaut (js/game.js:1177-1190), einen Abbau-Pfad gibt es nicht. Vorher noch
   schnell den aktuellen Stand sichern — save() ist entprellt. */
function wechsleZu(id) {
  schreibeStand();
  merkeStandBild();
  if (!staende.wähleStand(id)) { toast('Dieser Turm ist nicht mehr da.'); renderStaende(); return; }
  location.reload();
}
$('btn-stand-neu').onclick = () => {
  const e = staende.neuerStand();
  if (!e) { toast('Mehr als vier Türme passen nicht — lösche zuerst einen.'); renderStaende(); return; }
  wechsleZu(e.id);
};
$('stand-grid').addEventListener('click', ev => {
  const karte = ev.target.closest('.standkarte'); if (!karte) return;
  if (ev.target.classList.contains('stand-hin')) wechsleZu(karte.dataset.id);
});
$('stand-grid').addEventListener('change', ev => {
  const karte = ev.target.closest('.standkarte'); if (!karte) return;
  if (ev.target.classList.contains('stand-name')) {
    staende.benenneUm(karte.dataset.id, ev.target.value);
    renderStaende();
  }
});
$('stand-grid').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.classList.contains('stand-name')) ev.target.blur();
});
```

- [ ] **Step 4: Test grün.** `python3 .superpowers/verify/test_stand_wechsel.py`
      → `OK: Anlegen, Wechseln und Umbenennen funktionieren`.

- [ ] **Step 5: Commit.**
      `git add js/game.js && git commit -m "feat(spielstand): Turm anlegen, wechseln und umbenennen"`

---

### Task 6: Einen einzelnen Turm löschen — «Neu anfangen» entfällt

**Files:**
- Modify: `js/game.js` (Reset-Block `js/game.js:894-899` entfernen; Löschgeste im
  Block «Turm-Übersicht» ergänzen)
- Modify: `index.html` (`#btn-reset` aus dem Extras-Menü entfernen,
  `index.html:178`)
- Test: `.superpowers/verify/test_stand_loeschen.py` (nicht committet)

**Interfaces:**
- `.stand-weg` mit derselben doppelt-antippen-Bestätigung wie der alte Reset
  (4 Sekunden Fenster, Beschriftung wechselt auf «Wirklich löschen?»)
- `#btn-reset` existiert nicht mehr

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_stand_loeschen.py`:

```python
#!/usr/bin/env python3
"""Loeschen trifft genau einen Turm — mit beiden Schluesseln — und nie das ganze Spiel."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = ('{"floors":3,"nuts":5,"rooms":{},"wallpaper":{},"flooring":{},"fulfilled":{},'
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

        def übersicht():
            page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.renderStaende")
            page.click("#btn-start")
            page.click("#btn-extras")
            page.click("#btn-staende")
            page.wait_for_selector("#staende.open")

        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("""alt => {
            localStorage.clear();
            localStorage.setItem('wipfelkratzer-v1', alt);
            localStorage.setItem('wipfelkratzer-fotos', '[{"url":"data:image/jpeg;base64,x","text":"alt","t":1}]');
        }""", ALT)
        page.reload(wait_until="load")
        übersicht()

        # 'Neu anfangen' gibt es nicht mehr
        assert page.locator("#btn-reset").count() == 0, "#btn-reset lebt noch"

        # Zweiter Turm mit eigenen Schluesseln
        neu = page.evaluate("() => window.wipfelkratzer.staende.neuerStand('Weg damit')")
        page.evaluate("""e => {
            localStorage.setItem(e.standKey, '{"floors":1}');
            localStorage.setItem(e.fotoKey, '[]');
        }""", neu)
        page.evaluate("() => window.wipfelkratzer.renderStaende()")

        karte = page.locator(f'.standkarte[data-id="{neu["id"]}"]')
        weg = karte.locator(".stand-weg")
        # Erstes Antippen löscht nichts, sondern fragt nach
        weg.click()
        assert "Wirklich" in weg.inner_text(), weg.inner_text()
        assert page.evaluate("k => localStorage.getItem(k) !== null", neu["standKey"]) is True
        # Zweites Antippen löscht beide Schluessel
        weg.click()
        page.wait_for_function("k => localStorage.getItem(k) === null", arg=neu["standKey"], timeout=5000)
        assert page.evaluate("k => localStorage.getItem(k) === null", neu["fotoKey"]) is True
        # Der andere Turm ist unberuehrt
        assert json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))["floors"] == 3
        assert page.locator("#staende .standkarte").count() == 1

        # Den letzten Turm loeschen -> frischer leerer Turm, kein Fehler
        letzte = page.locator("#staende .standkarte").first.locator(".stand-weg")
        letzte.click(); letzte.click()
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand", timeout=15000)
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 0
        assert page.evaluate("() => window.wipfelkratzer.fotos.length") == 0
        idx = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-staende')"))
        assert len(idx["staende"]) == 1, idx

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Loeschen trifft genau einen Turm")
```

  Ausführen → scheitert (`#btn-reset` ist noch da, `.stand-weg` tut nichts).

- [ ] **Step 2: `#btn-reset` aus dem Markup entfernen.** In `index.html` die
      Zeile `<button id="btn-reset" class="danger">Neu anfangen</button>`
      (`index.html:178`) ersatzlos streichen. Der in Task 4 eingefügte
      `#btn-staende` bleibt und ist damit der letzte Eintrag im Extras-Menü.

- [ ] **Step 3: Reset-Block aus `js/game.js` entfernen.** Den gesamten Block
      `js/game.js:893-899` streichen:

```js
/* Reset */
let resetArmed = 0;
$('btn-reset').onclick = () => { … };
```

      Damit verschwinden auch die letzten Vorkommen von `'wipfelkratzer-v1'` aus
      `js/game.js`.

- [ ] **Step 4: Löschgeste in der Übersicht ergänzen.** Im Block
      «Turm-Übersicht» nach den Hörern aus Task 5 einfügen:

```js
/* Löschen trifft genau einen Turm — und braucht wie früher das zweite
   Antippen (vormals js/game.js:894-899). Danach ist auch die Galerie dieses
   Turms weg, was der alte Reset vergessen hatte. */
let wegArmed = { id: '', t: 0 };
$('stand-grid').addEventListener('click', ev => {
  const karte = ev.target.closest('.standkarte'); if (!karte) return;
  if (!ev.target.classList.contains('stand-weg')) return;
  const id = karte.dataset.id;
  if (wegArmed.id === id && Date.now() - wegArmed.t < 4000) {
    wegArmed = { id: '', t: 0 };
    const bleibt = staende.loescheStand(id);
    if (id === STAND.id) { location.reload(); return; }
    renderStaende();
    toast('Der Turm ist weg. Du baust an «' + bleibt.name + '» weiter.');
    return;
  }
  wegArmed = { id, t: Date.now() };
  ev.target.textContent = 'Wirklich löschen?';
  setTimeout(() => {
    if (wegArmed.id !== id) return;
    wegArmed = { id: '', t: 0 };
    renderStaende();
  }, 4000);
});
```

- [ ] **Step 5: Test grün.** `python3 .superpowers/verify/test_stand_loeschen.py`
      → `OK: Loeschen trifft genau einen Turm`. Zusätzlich:
      `grep -n "btn-reset\|wipfelkratzer-v1" js/game.js index.html` → keine Treffer.

- [ ] **Step 6: Commit.**
      `git add index.html js/game.js && git commit -m "feat(spielstand): einzelnen Turm löschen statt alles zurücksetzen"`

---

### Task 7: Gesamtdurchlauf, Changelog und TODO

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`
- Test: `.superpowers/verify/test_staende_abnahme.py` (nicht committet)

**Interfaces:** keine neuen.

**Steps:**

- [ ] **Step 1: Abnahmeskript schreiben und laufen lassen.**
      `.superpowers/verify/test_staende_abnahme.py` fährt die Acceptance
      Criteria der Spec in einem Durchgang ab:

```python
#!/usr/bin/env python3
"""Abnahme zu #53 — Migration, Trennung, Grenzen, saubere Konsole."""
import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
ALT = {"floors": 2, "nuts": 4, "rooms": {"1": [{"id": "bett", "x": 0, "y": 2.2, "z": 0, "rot": 0}]},
       "wallpaper": {"1": "blumen"}, "flooring": {}, "fulfilled": {},
       "bridge": True, "garden": False, "night": False, "cutaway": False}

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            localStorage.setItem('wipfelkratzer-fotos', '[{"url":"data:image/jpeg;base64,x","text":"alt","t":1}]');
        }""", ALT)
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")

        # AC: alter Einzelstand laedt, Inhalt unverändert im alten Schluessel
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 2
        assert page.evaluate("() => window.wipfelkratzer.state.bridge") is True
        assert page.evaluate("() => window.wipfelkratzer.fotos[0].text") == "alt"
        st = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')"))
        assert st["nuts"] == 4, st
        # AC: Tapeten-Migration läuft weiter
        wp = page.evaluate("() => window.wipfelkratzer.state.wallpaper['1']")
        assert sorted(wp.keys()) == ["back", "front", "left", "right"], wp
        # AC: Index angelegt, zeigt auf die Altschluessel
        idx = json.loads(page.evaluate("() => localStorage.getItem('wipfelkratzer-staende')"))
        assert idx["staende"][0]["standKey"] == "wipfelkratzer-v1", idx
        assert idx["staende"][0]["fotoKey"] == "wipfelkratzer-fotos", idx
        # AC: kein #btn-reset mehr
        assert page.locator("#btn-reset").count() == 0

        # AC: kaputter Index -> kein weisses Bild
        page.evaluate("() => localStorage.setItem('wipfelkratzer-staende', 'kaputt!!')")
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 2

        # AC: frische Installation
        page.evaluate("() => localStorage.clear()")
        page.reload(wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.stand")
        assert page.evaluate("() => window.wipfelkratzer.stand.standKey") == "wipfelkratzer-v1"
        assert page.evaluate("() => window.wipfelkratzer.state.floors") == 0

        browser.close()
finally:
    srv.kill(); srv.wait()

assert not laut, laut
print("OK: Abnahme #53 bestanden, Konsole sauber")
```

      Danach den Server per Port beenden, nie `pkill -f`:
      `ss -lptn 'sport = :8000' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`

- [ ] **Step 2: Alle Prüfskripte noch einmal hintereinander.** Reihenfolge:
      `test_staende_modul.py`, `test_stand_anbindung.py`, `test_standbild.py`,
      `test_staende_uebersicht.py`, `test_stand_wechsel.py`,
      `test_stand_loeschen.py`, `test_staende_abnahme.py`. Alle sieben müssen
      `OK:` melden. Im Vordergrund, mit grosszügigem `timeout`.

- [ ] **Step 3: Changelog.** Der Eintrag gehört unter `## [Unreleased]` — die
      Versionsnummer entsteht erst beim Release, nicht hier. Stil wie die
      bestehenden Einträge in `CHANGELOG.md`: deutscher Fliesstext unter
      `### Added`, Issue-Nummer in Klammern am Ende. Falls es noch keinen
      `## [Unreleased]`-Abschnitt gibt, direkt über `## [0.5.0]` anlegen:

```markdown
## [Unreleased]

### Added

- Es lassen sich jetzt bis zu vier Türme nebeneinander bauen. Unter «Meine
  Türme» — im Extras-Menü und gleich im Intro — steht jeder Turm mit
  Vorschaubild, eigenem Namen und seiner Stockwerkzahl; ein Tipp wechselt
  hinüber. Jeder Turm hat seine eigene Fotogalerie. Der bisherige Spielstand
  wird beim ersten Start still zum ersten Turm, ohne dass etwas verloren geht.
  «Neu anfangen» ist dafür weggefallen: gelöscht wird jetzt ein einzelner Turm
  über seine Karte — samt seinen Fotos, die der alte Knopf stehen liess (#53)
```

- [ ] **Step 4: TODO fortschreiben.** In `TODO.md` unter «Erledigt» ergänzen:

```markdown
- [x] Mehrere Spielstände nebeneinander — Übersicht «Meine Türme», je eigene Galerie (#53)
```

- [ ] **Step 5: Commit.**
      `git add CHANGELOG.md TODO.md && git commit -m "docs(spielstand): Changelog und TODO für #53"`

**Nicht Teil dieser Task:** `version.js` und ein `chore(release)`-Commit. Die
Version wird beim Schneiden des Release gehoben, nachdem der PR gemergt ist —
ein Feature-Plan, der das selbst tut, kollidiert mit jedem anderen offenen Plan.
