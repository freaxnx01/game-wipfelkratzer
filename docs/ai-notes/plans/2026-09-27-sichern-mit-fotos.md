# Plan — «Sichern mit Fotos» klappt nicht (Issue #94)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Turm mit Fotos landet immer irgendwo — geteilt oder als Datei.
Scheitert das System-Sheet, fällt `exportiereStand` auf den Download zurück
statt still aufzugeben; ein Fehler beim Bauen der Datei wird gemeldet statt
verschluckt.

**Architecture:** Zwei chirurgische Eingriffe in `js/game.js`. Erstens wird
die Sheet-Behandlung aus `exportiereStand` (`js/game.js:2558-2579`) in eine
kleine Funktion `teileStand` gezogen, die «erledigt / nicht erledigt»
beantwortet; nur bei «erledigt» steigt `exportiereStand` aus, sonst läuft der
bestehende Download-Weg weiter. Zweitens bekommt der Aufrufer im
`#stand-grid`-Handler (`js/game.js:2704`) ein `.catch()`. Kein neues Modul,
keine Formatänderung, kein neues Bedienelement.

**Tech Stack:** Vanilla ES-Module, three.js über Importmap. Kein Build, kein
Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-sichern-mit-fotos-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), Anrede gross (`Du`, `Dein`).
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine committete Testdatei**.
- **Kein neues `window`-Objekt.** Der bestehende Debug-Hook
  `window.wipfelkratzer` (`js/game.js:2810`) reicht; er exportiert
  `exportiereStand`, `standDatei`, `fotos`, `speichernFotos` und `staende`
  bereits (`js/game.js:2830-2831`).
- **Das Dateiformat bleibt unverändert.** `js/standdatei.js` wird nicht
  angefasst — auch `MAX_DATEI` nicht (Spec, E4: eine Grössenprüfung beim
  Sichern kann nicht auslösen, weil das `localStorage`-Kontingent darunter
  liegt).
- **Der Weg «Ohne Fotos» verhält sich unverändert.** Er läuft durch dieselbe
  Funktion; jede Änderung an ihm ist ein Regressionsfehler.
- **Ein echter Abbruch im Sheet bleibt folgenlos und stumm.** Erkannt wird er
  an der Zeit: `AbortError` **ab 400 ms** gilt als Abbruch, darunter als
  technisches Scheitern.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Fixed`.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `fix(staende)`.

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-sichern-mit-fotos/`
(git-ignoriert, siehe `.gitignore:4`). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9061–9065** (erster freier). Nur der Server darf in den Hintergrund.
  Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`,
  `accept_downloads=True` am Kontext, jeder `page.click` mit `timeout=20000`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Chromium kennt `navigator.canShare({files})` nicht** — dort läuft von Haus
  aus der Download-Weg. Die Sheet-Fälle werden mit `page.add_init_script`
  gesetzt, **vor** `page.goto`.
- **Über die echten Knöpfe sichern, nicht über Funktionsaufrufe.** Die
  Turmübersicht öffnet `#btn-extras` → `#btn-staende`; in der Karte öffnet
  `.stand-save` die Zeile mit `.stand-save-mit` / `.stand-save-ohne`.
- Toasts stehen als Text in `#toast-stack .toast-msg`.
- **Diese Änderung animiert nichts an der Kamera.** Die Ankunftsregel aus dem
  Stack-Overlay ist hier nicht nötig.

### Bausteine für jede Sonde

Diese drei Blöcke werden in allen Sonden gleich verwendet — in jede Sonde
hineinkopieren, kein gemeinsames Modul anlegen (Wegwerfcode).

**(a) Ein Foto in den aktiven Turm legen** (echtes 1×1-JPEG, damit der
Round-Trip durch `bereinigeFotos`, `js/standdatei.js:189`, etwas durchlässt):

```python
JPEG_1PX = ("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgH"
            "BwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgy"
            "PC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA"
            "AAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==")

def foto_anlegen(page):
    page.evaluate("""(url) => {
        const w = window.wipfelkratzer;
        w.fotos.length = 0;
        w.fotos.push({ url, text: 'Sonde', t: Date.now() });
        w.speichernFotos();
        w.renderStaende();
    }""", JPEG_1PX)
```

**(b) Die Sichern-Zeile der aktiven Karte öffnen:**

```python
def sichern_zeile_oeffnen(page):
    page.click("#btn-extras", timeout=20000)
    page.click("#btn-staende", timeout=20000)
    page.wait_for_selector(".standkarte.aktiv .stand-save", timeout=20000)
    page.click(".standkarte.aktiv .stand-save", timeout=20000)
    page.wait_for_selector(".standkarte.aktiv .stand-save-mit:visible", timeout=20000)
```

**(c) Eine Share-Attrappe setzen** (vor `page.goto` aufrufen). `verzoegerung`
in Millisekunden, `fehler` ist `None` für Erfolg oder ein DOMException-Name:

```python
def share_attrappe(page, verzoegerung, fehler):
    page.add_init_script("""(cfg) => {
        window.__shareAufrufe = 0;
        navigator.canShare = () => true;
        navigator.share = () => {
            window.__shareAufrufe++;
            return new Promise((ok, weg) => setTimeout(
                () => cfg.fehler ? weg(new DOMException('Sonde', cfg.fehler)) : ok(),
                cfg.verzoegerung));
        };
    }""", {"verzoegerung": verzoegerung, "fehler": fehler})
```

---

### Task 1: Ein gescheitertes Teilen fällt auf den Download zurück

Deckt F1 und F2 der Spec ab: das unbedingte `return` nach dem `catch`
(`js/game.js:2569`) und den stumm geschluckten `AbortError`
(`js/game.js:2568`).

**Files:**
- Modify: `js/game.js:2555-2579` (`exportiereStand` und der Kommentarblock
  darüber)
- Test: Wegwerf-Sonde
  `.superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_share.py` (nicht
  committet)

**Interfaces:**
- Consumes: `standDatei(eintrag, mitFotos)` → `{ text, name }`
  (`js/game.js:2543`), `toast(msg)` (`js/game.js:863`).
- Produces: `exportiereStand(eintrag, mitFotos)` bleibt `async` und liefert
  weiterhin `undefined`; neu ist, dass sie bei einem technischen
  Sheet-Fehler nicht mehr vorzeitig aussteigt. Neue modul-lokale Funktion
  `teileStand(datei, titel)` → `Promise<boolean>` (`true` = erledigt) und die
  Konstante `ABBRUCH_MIN_MS = 400`. Beide bleiben **modul-lokal**, sie kommen
  **nicht** an den Debug-Hook.

- [ ] **Step 1: Die rote Sonde schreiben**

`.superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_share.py` — die drei
Bausteine (a), (b), (c) oben in die Datei kopieren, dann:

```python
import sys
from playwright.sync_api import sync_playwright

BASIS = "http://localhost:9061/"

def fall(p, name, verzoegerung, fehler, download_erwartet):
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(accept_downloads=True)
    page = ctx.new_page()
    fehlerliste = []
    page.on("pageerror", lambda e: fehlerliste.append(str(e)))
    share_attrappe(page, verzoegerung, fehler)
    page.goto(BASIS, wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)
    foto_anlegen(page)
    sichern_zeile_oeffnen(page)

    gab_download = False
    try:
        with page.expect_download(timeout=8000):
            page.click(".standkarte.aktiv .stand-save-mit", timeout=20000)
        gab_download = True
    except Exception:
        page.wait_for_timeout(2000)

    aufrufe = page.evaluate("() => window.__shareAufrufe")
    toasts = page.locator("#toast-stack .toast-msg").all_inner_texts()
    ctx.close(); browser.close()

    ok = (gab_download == download_erwartet) and aufrufe == 1 and not fehlerliste
    if download_erwartet is False:
        ok = ok and not any("nicht geklappt" in t for t in toasts)
    print(f"{'OK  ' if ok else 'FAIL'} {name}: download={gab_download} "
          f"erwartet={download_erwartet} share={aufrufe} toasts={toasts} "
          f"pageerror={fehlerliste}")
    return ok

with sync_playwright() as p:
    alles = [
        fall(p, "technischer Fehler -> Datei", 50, "NotAllowedError", True),
        fall(p, "sofortiger Abbruch -> Datei", 50, "AbortError", True),
        fall(p, "spaeter Abbruch -> keine Datei", 1200, "AbortError", False),
        fall(p, "Teilen klappt -> keine Datei", 50, None, False),
    ]
sys.exit(0 if all(alles) else 1)
```

- [ ] **Step 2: Sonde laufen lassen und rot sehen**

```bash
python3 -m http.server 9061 &   # nur der Server im Hintergrund
python3 .superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_share.py
```

Erwartet: die ersten beiden Fälle **FAIL** (`download=False`, während `True`
erwartet ist) — genau die Sackgasse aus dem Issue. Die letzten beiden Fälle
sind schon heute grün und sichern ab, dass die Änderung sie nicht kaputt
macht.

- [ ] **Step 3: `exportiereStand` umbauen**

`js/game.js:2555-2579` vollständig ersetzen durch:

```js
/* Zwei Wege: Tablets bekommen das System-Sheet, alles andere eine Datei.
   Ein Blob statt einer Data-URL, weil iOS-Safari grosse Data-URLs in einem
   neuen Tab öffnet statt sie zu sichern. */

/* Ein Abbruch im Sheet ist kein Fehler — das Kind hat es sich anders
   überlegt, und ein zusätzlicher Download wäre erst recht verwirrend. iOS
   meldet aber auch ein gescheitertes Teilen grosser Dateien als Abbruch
   (#94), und das darf nicht folgenlos bleiben: mit zwanzig Fotos blieb so
   beides aus, Sheet und Datei. Unterschieden wird an der Zeit — wer wirklich
   abbricht, hatte das Sheet offen und hat darin getippt. */
const ABBRUCH_MIN_MS = 400;

/* Liefert true, wenn der Turm untergebracht ist (geteilt oder bewusst
   abgebrochen) — dann ist nichts weiter zu tun. */
async function teileStand(datei, titel) {
  const start = Date.now();
  try {
    await navigator.share({ files: [datei], title: titel });
    return true;
  } catch (e) {
    return !!(e && e.name === 'AbortError' && Date.now() - start >= ABBRUCH_MIN_MS);
  }
}

async function exportiereStand(eintrag, mitFotos) {
  const { text, name } = standDatei(eintrag, mitFotos);
  const blob = new Blob([text], { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.share) {
      const f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare({ files: [f] }) && await teileStand(f, eintrag.name)) return;
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

Wichtig: `teileStand` steht **vor** `exportiereStand` im Modul und fängt
seine eigenen Fehler selbst — das äussere `try` deckt weiterhin nur
`canShare`/`new File`, die auf alten Browsern werfen können.

- [ ] **Step 4: Sonde laufen lassen und grün sehen**

```bash
python3 .superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_share.py
```

Erwartet: alle vier Fälle `OK`, `pageerror=[]`. Fällt ein Fall um, ist die
Implementierung schuld, **nicht** die Sonde — die Erwartungen stehen
unverändert in den Akzeptanzkriterien der Spec.

- [ ] **Step 5: Committen**

```bash
git add js/game.js
git commit -m "fix(staende): Sichern faellt nach gescheitertem Teilen auf die Datei zurueck

Auf dem iPad meldet das System-Sheet ein gescheitertes Teilen grosser
Dateien als Abbruch. Das unbedingte return danach warf den fertigen Blob
weg — mit zwanzig Fotos blieb so beides aus, Sheet und Datei.

Refs #94"
```

---

### Task 2: Ein Fehler beim Sichern wird gemeldet

Deckt F3 der Spec ab: der Aufrufer hängt nur ein `.finally()` an
(`js/game.js:2704`), kein `.catch()` — wirft irgendetwas im Export-Weg, wird
die Zeile eingeklappt und niemand erfährt etwas.

**Files:**
- Modify: `js/game.js:2696-2708` (der `.stand-save-mit`/`.stand-save-ohne`-Zweig)
- Modify: `CHANGELOG.md` (`## [Unreleased]` → `### Fixed`)
- Test: Wegwerf-Sonde
  `.superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_fehler.py` (nicht
  committet)

**Interfaces:**
- Consumes: `exportiereStand(eintrag, mitFotos)` aus Task 1 — unveränderte
  Signatur, sie kann weiterhin ablehnen (z. B. wenn `JSON.stringify` wirft).
- Produces: nichts Neues. Der Handler bleibt ein Handler.

- [ ] **Step 1: Die rote Sonde schreiben**

`.superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_fehler.py` — Bausteine
(a) und (b) von oben hineinkopieren, dann:

```python
import sys
from playwright.sync_api import sync_playwright

BASIS = "http://localhost:9061/"

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(accept_downloads=True)
    page = ctx.new_page()
    fehlerliste = []
    page.on("pageerror", lambda e: fehlerliste.append(str(e)))
    page.goto(BASIS, wait_until="networkidle")
    page.wait_for_function("() => !!window.wipfelkratzer", timeout=60000)
    foto_anlegen(page)
    # Das Bauen der Datei zum Scheitern bringen: Blob wirft.
    page.evaluate("() => { window.Blob = function () { throw new Error('Sonde: zu gross'); }; }")
    sichern_zeile_oeffnen(page)
    page.click(".standkarte.aktiv .stand-save-mit", timeout=20000)
    page.wait_for_timeout(1500)

    toasts = page.locator("#toast-stack .toast-msg").all_inner_texts()
    gemeldet = any("ohne Fotos" in t for t in toasts)
    knopf_frei = page.evaluate(
        "() => !document.querySelector('.standkarte.aktiv .stand-save-mit').disabled")
    zeile_zu = page.locator(".standkarte.aktiv .stand-save-zeile.hidden").count() == 1
    ctx.close(); browser.close()

    ok = gemeldet and knopf_frei and zeile_zu
    print(f"{'OK  ' if ok else 'FAIL'} Fehler wird gemeldet: toasts={toasts} "
          f"knopf_frei={knopf_frei} zeile_zu={zeile_zu} pageerror={fehlerliste}")
sys.exit(0 if ok else 1)
```

`pageerror` wird hier nur ausgegeben, nicht geprüft: die Attrappe wirft
absichtlich, und je nach Browser landet die abgelehnte Zusage zusätzlich als
`unhandledrejection` in der Konsole — genau das soll das `.catch()` beenden.

- [ ] **Step 2: Sonde laufen lassen und rot sehen**

```bash
python3 .superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_fehler.py
```

Erwartet: **FAIL** mit `toasts=[]` — die Zeile klappt ein, es passiert sonst
nichts.

- [ ] **Step 3: Das `.catch()` ergänzen**

In `js/game.js:2704` den Aufruf ersetzen:

```js
    exportiereStand(eintrag, mit)
      /* Ohne dieses catch endet ein Fehler beim Bauen der Datei im Nichts:
         die Zeile klappt ein, der Knopf wird frei, und niemand erfährt
         etwas (#94). */
      .catch(() => toast('Das Sichern hat nicht geklappt — versuche es ohne Fotos.'))
      .finally(() => {
        knopf.disabled = false;
        karte.querySelector('.stand-save-zeile').classList.add('hidden');
      });
```

- [ ] **Step 4: Sonde laufen lassen und grün sehen**

```bash
python3 .superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_fehler.py
python3 .superpowers/sdd/2026-09-27-sichern-mit-fotos/probe_share.py
```

Erwartet: beide `OK` — die zweite Sonde beweist, dass Task 1 unberührt
bleibt.

- [ ] **Step 5: Changelog-Eintrag**

In `CHANGELOG.md` unter `## [Unreleased]` einen Abschnitt `### Fixed`
anlegen, falls er fehlt, und eintragen (Spielersprache, nicht Repo-Sprache):

```markdown
### Fixed

- «Sichern mit Fotos» hat auf dem Tablet manchmal nichts getan: Wenn das
  Teilen-Fenster die grosse Datei nicht annahm, war der Turm weg statt
  gesichert. Jetzt wird er in so einem Fall als Datei heruntergeladen — und
  wenn wirklich etwas schiefgeht, steht es als Hinweis auf dem Bildschirm.
```

- [ ] **Step 6: Committen**

```bash
git add js/game.js CHANGELOG.md
git commit -m "fix(staende): Fehler beim Sichern wird gemeldet statt verschluckt

Der Aufrufer hatte nur ein finally: warf das Bauen der Datei, klappte die
Zeile ein und niemand erfuhr etwas.

Closes #94"
```

---

### Task 3: Abschluss — Konsole, Regression, PR

**Files:**
- keine (nur Prüfen und die PR-Beschreibung)

**Interfaces:**
- Consumes: der Stand nach Task 2.
- Produces: nichts.

- [ ] **Step 1: Regression «Ohne Fotos» prüfen**

Sonde `probe_share.py` um einen Durchlauf ergänzen, der statt
`.stand-save-mit` auf `.stand-save-ohne` klickt, ohne Share-Attrappe
(`share_attrappe` einfach nicht aufrufen) — erwartet: ein Download, Toast
«Der Turm ist als Datei gesichert.», kein `pageerror`.

- [ ] **Step 2: Round-Trip prüfen**

Die heruntergeladene Datei aus dem «Mit Fotos»-Durchlauf über
`download.path()` einlesen und im Browser durchreichen:

```python
text = open(download.path(), encoding="utf-8").read()
ergebnis = page.evaluate("(t) => window.wipfelkratzer.importiereText(t)", text)
assert ergebnis["ok"] is True
```

Erwartet: `ok == True` — die mit Fotos gesicherte Datei lässt sich wieder
einlesen.

- [ ] **Step 3: Konsole prüfen**

Ein normaler Durchlauf (laden, Übersicht öffnen, «Ohne Fotos» sichern) ohne
`pageerror`; die bekannten Warnungen aus dem Harness sind erlaubt.

- [ ] **Step 4: Server beenden und aufräumen**

```bash
ss -lptn 'sport = :9061' | grep -oP 'pid=\K[0-9]+' | xargs -r kill
git status --short   # .superpowers/ darf nicht im Diff stehen
```

- [ ] **Step 5: PR öffnen**

Titel: `fix(staende): Sichern mit Fotos endet nie mehr ohne Ergebnis`.
In die Beschreibung gehört als **offener Posten**: der manuelle Playtest in
Safari auf dem iPad — die eigentliche Fehlerumgebung, die keine Sonde
nachstellen kann. Zu prüfen ist dort: «Mit Fotos» bringt entweder das Sheet
oder eine Datei in «Dateien», und ein bewusst geschlossenes Sheet lädt
**nichts** herunter.
