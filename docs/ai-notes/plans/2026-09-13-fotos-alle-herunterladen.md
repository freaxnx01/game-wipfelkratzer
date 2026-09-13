# Plan: Alle Fotos auf einmal herunterladen

Issue: `freaxnx01/game-wipfelkratzer#33`

**Goal:** Die Fotogalerie bekommt einen Knopf «Alle herunterladen», der
sämtliche Fotos in einem Vorgang sichert — auf teilfähigen Geräten (iPad) über
`navigator.share({files})`, sonst als ein einziges, selbst geschriebenes
ZIP-Archiv. Ohne neue Abhängigkeit.

**Architecture:** Buildless, ES-Module, three.js r184 über die Import-Map — an
der Import-Map (`index.html:10-27`) wird nichts geändert. Neu ist ein
abhängigkeitsfreies Modul `js/zip.js` (ZIP-Methode 0, *stored*), das
`js/game.js` relativ importiert. Der Rest der Arbeit liegt in den
Foto-Funktionen von `js/game.js` (ab `js/game.js:1135`) und im Galerie-Markup
plus `<style>` von `index.html`.

**Spec:** `docs/ai-notes/specs/2026-09-13-fotos-alle-herunterladen-design.md`

## Global Constraints

- **Keine neue Laufzeit-Abhängigkeit.** Kein Eintrag in der Import-Map, kein
  `package.json`, kein `node_modules`, kein neuer `<script src="https://…">`.
  (`CLAUDE.md:796-812`)
- **Der bestehende Einzel-Download bleibt unangetastet**
  (`js/game.js:1161-1165`), ebenso `photoFilename()` (`js/game.js:1150-1153`),
  `takePhoto()` und `savePhotos()`.
- **Verifikation immer im Vordergrund.** Niemals `run_in_background` — ein
  headless Agent bekommt die Rückmeldung sonst nie und meldet fälschlich
  Erfolg (`CLAUDE.md:552-567`). Lieber ein grosszügiges `timeout` setzen und
  blockieren lassen.
- **Lokaler Server:** `python3 -m http.server 8000` aus dem Repo-Wurzelverzeichnis,
  danach **nur über den Port** beenden:
  `ss -lptn 'sport = :8000' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  niemals `pkill -f`.
- **Prüfskripte sind Wegwerfware** und liegen unter `.superpowers/verify/`
  (bereits in `.gitignore:3-6`). Sie werden **nicht** committet.
- Deutsche UI-Texte mit echten Umlauten, Kommentare auf Deutsch — wie der
  bestehende Code.
- Jeder Task endet mit einem Commit im Conventional-Commit-Format
  (`CLAUDE.md:180-207`).

Einmalige Vorbereitung vor Task 1:

```bash
mkdir -p .superpowers/verify
python3 -c "import playwright" || pip install playwright && playwright install chromium
```

---

### Task 1: ZIP-Schreiber `js/zip.js`

**Files:**
- Create: `js/zip.js`
- Test: `.superpowers/verify/test_zip_module.py` (nicht committet)

**Interfaces:**
- `export function crc32(bytes: Uint8Array): number`
- `export function zipStore(entries: {name: string, data: Uint8Array, date?: Date}[]): Blob`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_zip_module.py`:

```python
#!/usr/bin/env python3
"""Prueft js/zip.js gegen Pythons zipfile — eine fremde ZIP-Implementierung."""
import base64, io, subprocess, sys, time, zipfile
from playwright.sync_api import sync_playwright

PORT = 8000
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}/", wait_until="domcontentloaded")
        b64 = page.evaluate("""async () => {
            const { zipStore } = await import('/js/zip.js');
            const enc = new TextEncoder();
            const blob = zipStore([
                { name: 'a.txt', data: enc.encode('Hallo Willi'), date: new Date(2026, 8, 13, 14, 15, 30) },
                { name: 'b.bin', data: new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01]), date: new Date(2026, 8, 13, 14, 15, 30) },
            ]);
            const buf = new Uint8Array(await blob.arrayBuffer());
            let s = '';
            for (const b of buf) s += String.fromCharCode(b);
            return btoa(s);
        }""")
        browser.close()
finally:
    srv.kill(); srv.wait()

zf = zipfile.ZipFile(io.BytesIO(base64.b64decode(b64)))
assert zf.testzip() is None, "CRC-Fehler im Archiv"
assert zf.namelist() == ["a.txt", "b.bin"], zf.namelist()
assert zf.read("a.txt") == b"Hallo Willi"
assert zf.read("b.bin") == bytes([0xFF, 0xD8, 0xFF, 0x00, 0x01])
assert zf.getinfo("a.txt").compress_type == zipfile.ZIP_STORED
assert zf.getinfo("a.txt").date_time == (2026, 9, 13, 14, 15, 30)
print("OK: zipStore erzeugt ein gueltiges STORED-Archiv")
```

  Ausführen (Vordergrund, `timeout` grosszügig):
  `python3 .superpowers/verify/test_zip_module.py` → muss scheitern
  («Failed to fetch dynamically imported module: /js/zip.js»).

- [ ] **Step 2: `js/zip.js` anlegen** — exakt der Code aus der Spec, Abschnitt
      «Neue Datei `js/zip.js`»: `CRC_TABLE` als IIFE über `Uint32Array(256)`,
      `crc32()`, `dosStamp()`, `zipStore()` mit Local-File-Header (Signatur
      `0x04034b50`, Methode `0`, CRC/Grösse/Grösse, Namenslänge), Central
      Directory (`0x02014b50`, Offset an Byte 42) und End-of-Central-Directory
      (`0x06054b50`). Kein Import, kein Fremdcode.

- [ ] **Step 3: Test grün.** `python3 .superpowers/verify/test_zip_module.py`
      → `OK: zipStore erzeugt ein gueltiges STORED-Archiv`. Zusätzlich prüfen,
      dass nichts Fremdes hereingerutscht ist:
      `grep -n "import\|require(" js/zip.js` → keine Treffer.

- [ ] **Step 4: Commit.**
      `git add js/zip.js && git commit -m "feat(fotos): minimaler ZIP-Schreiber ohne Abhaengigkeit"`
      (Commit-Text im Editor mit echten Umlauten nachziehen: «Abhängigkeit»).

---

### Task 2: Foto-Helfer in `js/game.js`

**Files:**
- Modify: `js/game.js` (Foto-Block ab `js/game.js:1135`, Debug-Hook `js/game.js:1194`)
- Test: `.superpowers/verify/test_photo_helpers.py` (nicht committet)

**Interfaces:**
- `dataUrlToBytes(url: string): Uint8Array`
- `uniquePhotoNames(list: {t:number}[]): string[]`
- `photoZipFilename(): string`
- `window.wipfelkratzer.photoTools = { photoFilename, uniquePhotoNames, dataUrlToBytes, photoZipFilename }`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_photo_helpers.py`:

```python
#!/usr/bin/env python3
"""Prueft die Foto-Helfer über den bestehenden Playwright-Hook window.wipfelkratzer."""
import subprocess, sys, time
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
        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.wait_for_function("() => window.wipfelkratzer && window.wipfelkratzer.photoTools")

        # Gleiche Sekunde zweimal -> zweiter Name bekommt -2
        t = 1789999530000  # fester Zeitstempel
        names = page.evaluate(
            "t => window.wipfelkratzer.photoTools.uniquePhotoNames([{t}, {t}, {t: t + 60000}])", t)
        assert len(set(names)) == 3, names
        assert names[1] == names[0].replace(".jpg", "-2.jpg"), names
        assert all(n.endswith(".jpg") and n.startswith("wipfelkratzer-") for n in names), names

        # Data-URL -> Bytes
        got = page.evaluate(
            "() => Array.from(window.wipfelkratzer.photoTools.dataUrlToBytes('data:image/jpeg;base64,/9j/4AAQ'))")
        assert got[:3] == [0xFF, 0xD8, 0xFF], got

        zipname = page.evaluate("() => window.wipfelkratzer.photoTools.photoZipFilename()")
        assert zipname.startswith("wipfelkratzer-fotos-") and zipname.endswith(".zip"), zipname
        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Foto-Helfer liefern eindeutige Namen und korrekte Bytes")
```

  Ausführen → muss an `wait_for_function` scheitern (Timeout, `photoTools`
  existiert nicht).

- [ ] **Step 2: Helfer einfügen.** In `js/game.js` direkt nach
      `photoFilename()` (`js/game.js:1153`) einsetzen:

```js
function dataUrlToBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* Zwei Fotos in derselben Sekunde ergeben denselben Namen — im Archiv und im
   Share-Sheet muss jeder Name eindeutig sein. */
function uniquePhotoNames(list) {
  const seen = new Map();
  return list.map(p => {
    const base = photoFilename(p);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : base.replace(/\.jpg$/, `-${n}.jpg`);
  });
}
function photoZipFilename() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `wipfelkratzer-fotos-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}
```

- [ ] **Step 3: Debug-Hook erweitern.** In `js/game.js:1194` das Objektliteral
      `window.wipfelkratzer = { state, floorGroups, … }` um einen Eintrag
      ergänzen — **vor** der schliessenden Klammer:

```js
  photoTools: { photoFilename, uniquePhotoNames, dataUrlToBytes, photoZipFilename },
```

- [ ] **Step 4: Test grün.** `python3 .superpowers/verify/test_photo_helpers.py`
      → `OK: Foto-Helfer liefern eindeutige Namen und korrekte Bytes`.

- [ ] **Step 5: Commit.**
      `git add js/game.js && git commit -m "feat(fotos): Helfer für Dateinamen und Data-URL-Bytes"`
      (Umlaute im Editor nachziehen: «für»).

---

### Task 3: Knopf «Alle herunterladen» und Leerzustand

**Files:**
- Modify: `index.html` (Galerie-Markup `index.html:224-229`, `<style>` bei `index.html:107`)
- Modify: `js/game.js` (`renderGallery()`, `js/game.js:1154-1156`)
- Test: `.superpowers/verify/test_gallery_button.py` (nicht committet)

**Interfaces:**
- Neues Element `#btn-download-all` innerhalb `#gallery-actions`
- `renderGallery()` schaltet die Klasse `hidden` auf `#btn-download-all`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_gallery_button.py`:

```python
#!/usr/bin/env python3
"""Der Knopf 'Alle herunterladen' erscheint nur, wenn Fotos da sind."""
import subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
FOTO = ("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL"
        "DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
        "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==")

def seed(page, n):
    page.evaluate("""([url, n]) => {
        const now = Date.now();
        const arr = [];
        for (let i = 0; i < n; i++) arr.push({ url, text: '', t: now - i * 1000 });
        localStorage.setItem('wipfelkratzer-fotos', JSON.stringify(arr));
    }""", [FOTO, n])

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # 1) leere Galerie -> Knopf unsichtbar
        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        page.evaluate("() => localStorage.removeItem('wipfelkratzer-fotos')")
        page.reload(wait_until="load")
        page.click("#btn-start")
        page.click("#btn-extras")
        page.click("#btn-gallery")
        page.wait_for_selector("#gallery.open")
        assert page.locator("#gallery .empty").count() == 1
        assert not page.locator("#btn-download-all").is_visible(), "Knopf darf bei leerer Galerie nicht sichtbar sein"

        # 2) drei Fotos -> Knopf sichtbar
        seed(page, 3)
        page.reload(wait_until="load")
        page.click("#btn-start")
        page.click("#btn-extras")
        page.click("#btn-gallery")
        page.wait_for_selector("#gallery.open")
        assert page.locator(".photo").count() == 3
        assert page.locator("#btn-download-all").is_visible(), "Knopf fehlt trotz Fotos"
        assert page.locator("#btn-galclose").is_visible(), "'Zu' muss erhalten bleiben"
        assert page.locator(".photo-actions .download").count() == 3, "Einzel-Download muss bleiben"
        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Knopf erscheint nur bei gefuellter Galerie")
```

  Ausführen → scheitert, `#btn-download-all` existiert nicht.

- [ ] **Step 2: Markup ändern.** In `index.html` den Block `#gallery`
      (`index.html:224-229`) ersetzen durch:

```html
<div id="gallery">
  <div class="panel">
    <h2>Fotogalerie</h2>
    <div id="photo-grid"></div>
    <div id="gallery-actions">
      <button id="btn-download-all" class="hidden">Alle herunterladen</button>
      <button id="btn-galclose" class="primary">Zu</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: CSS ergänzen.** In `index.html` direkt nach der Regel
      `#gallery .empty { … }` (`index.html:107`) einfügen:

```css
  #gallery-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
```

- [ ] **Step 4: `renderGallery()` schaltet den Knopf.** In `js/game.js` die
      ersten beiden Zeilen der Funktion (`js/game.js:1155-1156`) ersetzen durch:

```js
  const grid = $('photo-grid'); grid.innerHTML = '';
  $('btn-download-all').classList.toggle('hidden', !photos.length);
  if (!photos.length) { grid.innerHTML = '<div class="empty">Noch keine Fotos. Drücke unten auf «Foto»!</div>'; return; }
```

- [ ] **Step 5: Test grün.** `python3 .superpowers/verify/test_gallery_button.py`
      → `OK: Knopf erscheint nur bei gefuellter Galerie`.

- [ ] **Step 6: Commit.**
      `git add index.html js/game.js && git commit -m "feat(fotos): Knopf 'Alle herunterladen' in der Galerie"`

---

### Task 4: ZIP-Weg — ein Download für alle Fotos

**Files:**
- Modify: `js/game.js` (Import von `./zip.js` bei `js/game.js:1-3`, neue
  Funktion `downloadAllPhotos()` nach `renderGallery()`, Verdrahtung bei
  `js/game.js:1169-1172`)
- Test: `.superpowers/verify/test_download_all_zip.py` (nicht committet)

**Interfaces:**
- `import { zipStore } from './zip.js';`
- `async function downloadAllPhotos(): Promise<void>`
- `$('btn-download-all').onclick = downloadAllPhotos;`

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_download_all_zip.py`:

```python
#!/usr/bin/env python3
"""Ein Tipp auf 'Alle herunterladen' erzeugt genau ein gueltiges ZIP mit allen Fotos."""
import subprocess, sys, tempfile, time, zipfile, pathlib
from playwright.sync_api import sync_playwright

PORT = 8000
FOTO = ("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL"
        "DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
        "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==")

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(accept_downloads=True)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        downloads = []
        page.on("download", downloads.append)

        page.goto(f"http://localhost:{PORT}/", wait_until="load")
        # Zwei Fotos in derselben Sekunde + eins später -> Namenskollision erzwingen
        page.evaluate("""url => {
            const t = 1789999530000;
            localStorage.setItem('wipfelkratzer-fotos', JSON.stringify([
                { url, text: '', t },
                { url, text: '', t: t + 400 },
                { url, text: '', t: t + 60000 },
            ]));
        }""", FOTO)
        page.reload(wait_until="load")
        page.click("#btn-start"); page.click("#btn-extras"); page.click("#btn-gallery")
        page.wait_for_selector("#gallery.open")

        with page.expect_download(timeout=15000) as info:
            page.click("#btn-download-all")
        dl = info.value
        target = pathlib.Path(tempfile.mkdtemp()) / "fotos.zip"
        dl.save_as(target)
        page.wait_for_timeout(1500)
        assert len(downloads) == 1, f"genau ein Download erwartet, waren {len(downloads)}"
        assert dl.suggested_filename.startswith("wipfelkratzer-fotos-"), dl.suggested_filename
        assert dl.suggested_filename.endswith(".zip"), dl.suggested_filename
        assert page.locator("#btn-download-all").is_enabled(), "Knopf muss danach wieder bedienbar sein"
        browser.close()
finally:
    srv.kill(); srv.wait()

zf = zipfile.ZipFile(target)
assert zf.testzip() is None, "CRC-Fehler im Archiv"
names = zf.namelist()
assert len(names) == 3, names
assert len(set(names)) == 3, f"Namenskollision nicht aufgeloest: {names}"
assert any(n.endswith("-2.jpg") for n in names), names
for n in names:
    assert n.endswith(".jpg"), n
    assert zf.read(n)[:3] == b"\xff\xd8\xff", f"{n} ist kein JPEG"
assert not errors, errors
print("OK: ein Download, ein gueltiges ZIP mit drei JPEGs")
```

  Ausführen → scheitert (`expect_download` läuft in den Timeout, weil der
  Knopf noch keinen Handler hat).

- [ ] **Step 2: Import ergänzen.** In `js/game.js` nach Zeile 3 (dem Import aus
      `./models.js`) einfügen:

```js
import { zipStore } from './zip.js';
```

- [ ] **Step 3: `downloadAllPhotos()` einsetzen** — direkt nach dem Ende von
      `renderGallery()` (`js/game.js:1168`):

```js
async function downloadAllPhotos() {
  if (!photos.length) return;
  const btn = $('btn-download-all');
  btn.disabled = true;
  try {
    const names = uniquePhotoNames(photos);
    const bytes = photos.map(p => dataUrlToBytes(p.url));
    const blob = zipStore(photos.map((p, i) => ({ name: names[i], data: bytes[i], date: new Date(p.t) })));
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = photoZipFilename();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
    toast(`${photos.length} Fotos als ZIP gespeichert.`);
  } finally {
    btn.disabled = false;
  }
}
```

- [ ] **Step 4: Verdrahten.** In `js/game.js` neben die bestehenden
      Galerie-Handler (`js/game.js:1169-1172`) einfügen:

```js
$('btn-download-all').onclick = downloadAllPhotos;
```

- [ ] **Step 5: Test grün.** `python3 .superpowers/verify/test_download_all_zip.py`
      → `OK: ein Download, ein gueltiges ZIP mit drei JPEGs`. Danach die
      früheren Prüfungen erneut laufen lassen (volle Suite):
      `for t in .superpowers/verify/test_*.py; do python3 "$t" || exit 1; done`

- [ ] **Step 6: Commit.**
      `git add js/game.js && git commit -m "feat(fotos): alle Fotos als ein ZIP herunterladen"`

---

### Task 5: Share-Weg für iPad und Android

**Files:**
- Modify: `js/game.js` (`downloadAllPhotos()`)
- Test: `.superpowers/verify/test_download_all_share.py` (nicht committet)

**Interfaces:**
- `downloadAllPhotos()` ruft `navigator.share({ files, title })`, wenn
  `navigator.canShare({ files })` wahr ist; ZIP nur als Ersatzweg.
- Abbruch (`err.name === 'AbortError'`) endet still.

**Steps:**

- [ ] **Step 1: Fehlschlagenden Test schreiben.** `.superpowers/verify/test_download_all_share.py`:

```python
#!/usr/bin/env python3
"""Auf teilfaehigen Geraeten wird geteilt statt gezippt; Abbruch tut nichts."""
import subprocess, sys, time
from playwright.sync_api import sync_playwright

PORT = 8000
FOTO = ("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL"
        "DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
        "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==")

STUB = """(() => {
    const ABORT = __ABORT__;
    window.__shared = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
        window.__shared = {
            count: data.files.length,
            names: data.files.map(f => f.name),
            types: data.files.map(f => f.type),
            title: data.title || '',
        };
        if (ABORT) { const e = new Error('abgebrochen'); e.name = 'AbortError'; throw e; }
    }});
})();"""

def open_gallery(page, abort):
    page.goto(f"http://localhost:{PORT}/", wait_until="load")
    page.evaluate("""url => {
        const t = 1789999530000;
        localStorage.setItem('wipfelkratzer-fotos', JSON.stringify([
            { url, text: '', t }, { url, text: '', t: t + 60000 },
        ]));
    }""", FOTO)
    page.add_init_script(STUB.replace("__ABORT__", "true" if abort else "false"))
    page.reload(wait_until="load")
    page.click("#btn-start"); page.click("#btn-extras"); page.click("#btn-gallery")
    page.wait_for_selector("#gallery.open")

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1) Share gelingt -> kein Download
        page = browser.new_page(accept_downloads=True)
        errors, downloads = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("download", downloads.append)
        open_gallery(page, abort=False)
        page.click("#btn-download-all")
        page.wait_for_function("() => window.__shared !== null", timeout=10000)
        shared = page.evaluate("() => window.__shared")
        assert shared["count"] == 2, shared
        assert all(t == "image/jpeg" for t in shared["types"]), shared
        assert all(n.endswith(".jpg") for n in shared["names"]), shared
        assert shared["title"] == "Wipfelkratzer-Fotos", shared
        page.wait_for_timeout(2000)
        assert downloads == [], "auf dem Share-Weg darf kein ZIP heruntergeladen werden"
        page.close()

        # 2) Abbruch -> weder Download noch Toast
        page = browser.new_page(accept_downloads=True)
        downloads2 = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("download", downloads2.append)
        open_gallery(page, abort=True)
        page.click("#btn-download-all")
        page.wait_for_function("() => window.__shared !== null", timeout=10000)
        page.wait_for_timeout(2000)
        assert downloads2 == [], "nach Abbruch darf kein ZIP kommen"
        assert page.locator(".toast-item").count() == 0, "nach Abbruch kein Toast"
        assert page.locator("#btn-download-all").is_enabled(), "Knopf muss wieder bedienbar sein"
        browser.close()
finally:
    srv.kill(); srv.wait()

assert not errors, errors
print("OK: Share bevorzugt, Abbruch bleibt folgenlos")
```

  Ausführen → scheitert: der heutige Handler zippt immer, `window.__shared`
  bleibt `null`.

- [ ] **Step 2: Share-Zweig einbauen.** In `js/game.js` `downloadAllPhotos()`
      so ergänzen, dass zwischen `bytes` und `zipStore(...)` steht:

```js
    const files = bytes.map((b, i) => new File([b], names[i], { type: 'image/jpeg' }));
    /* iPad/Android: das System-Sheet legt alle Bilder auf einmal in «Fotos» —
       dort gehören sie hin, nicht als Archiv nach «Dateien». */
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: 'Wipfelkratzer-Fotos' });
        toast(`${files.length} Fotos weitergegeben.`);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;  // abgebrochen: kein Ersatzweg
      }
    }
```

      Der ZIP-Block aus Task 4 bleibt unverändert darunter stehen und ist damit
      der Ersatzweg. `finally { btn.disabled = false; }` umfasst beide Zweige.

- [ ] **Step 3: Test grün.** `python3 .superpowers/verify/test_download_all_share.py`
      → `OK: Share bevorzugt, Abbruch bleibt folgenlos`. Danach die volle Suite:
      `for t in .superpowers/verify/test_*.py; do python3 "$t" || exit 1; done`
      — alle fünf Skripte müssen `OK: …` melden, insbesondere
      `test_download_all_zip.py` (headless Chromium hat kein
      `navigator.share`, der ZIP-Weg muss weiterhin greifen).

- [ ] **Step 4: Commit.**
      `git add js/game.js && git commit -m "feat(fotos): Fotos auf dem Tablet über das System-Sheet teilen"`

---

### Task 6: Changelog, TODO und manueller Schlusscheck

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `TODO.md`

**Interfaces:**
- Keine. Diese Task ändert keinen Code.

**Steps:**

- [ ] **Step 1: Konsolen-Schlusscheck im echten Browser.** Server starten,
      Galerie mit 20 Fotos befüllen (`takePhoto()` 20-mal über die
      Extras-Leiste oder per `localStorage`-Seed wie in den Tests), «Alle
      herunterladen» tippen, das entstandene ZIP mit einem Entpacker öffnen und
      ein Bild ansehen. Dabei die Konsole beobachten: keine Fehler, keine
      Warnungen. Anschliessend die Seite neu laden und prüfen, dass die Galerie
      unverändert 20 Fotos zeigt (`localStorage` unberührt).
      Server per Port beenden, nie `pkill -f`.

- [ ] **Step 2: Changelog.** Der Eintrag gehört unter `## [Unreleased]` — die
      Versionsnummer entsteht erst beim Release, nicht hier. Stil wie die
      bestehenden Einträge in `CHANGELOG.md`: deutscher Fliesstext unter
      `### Added`, Issue-Nummer in Klammern am Ende. Falls es noch keinen
      `## [Unreleased]`-Abschnitt gibt, direkt über dem obersten
      Versionsabschnitt anlegen:

```markdown
## [Unreleased]

### Added

- Fotos lassen sich jetzt alle auf einmal sichern — auf dem Tablet über das
  System-Sheet, am Rechner als ein ZIP mit allen Bildern (#33)
```

- [ ] **Step 3: TODO fortschreiben.** In `TODO.md` unter «Erledigt» ergänzen:

```markdown
- [x] Alle Fotos auf einmal herunterladen — Teilen auf dem Tablet, ZIP am Rechner (#33)
```

- [ ] **Step 4: Commit.**
      `git add CHANGELOG.md TODO.md && git commit -m "docs(fotos): Changelog und TODO für #33"`

**Nicht Teil dieser Task:** `version.js` und ein `chore(release)`-Commit. Die
Version wird beim Schneiden des Release gehoben, nachdem der PR gemergt ist —
ein Feature-Plan, der das selbst tut, kollidiert mit jedem anderen Plan, der
gerade offen ist.
