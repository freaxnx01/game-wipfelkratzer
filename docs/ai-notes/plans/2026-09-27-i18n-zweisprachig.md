# Plan — Zweisprachig de/en über das gemeinsame `i18n.js` (Issue #107)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Spiel bekommt den gemeinsamen Sprachumschalter aus `CLAUDE.md`
und eine `t()`-Schicht, und die **gesamte Bedienoberfläche** (Intro, HUD,
alle Leisten, alle Dialog-Überschriften und -Knöpfe) spricht Deutsch und
Englisch — umschaltbar ohne Reload. Toasts, Katalog und Tierdialoge bleiben
bewusst dieser Etappe fern und bekommen eigene Issues.

**Architecture:** Drei Bausteine. (1) `i18n.js` im Wurzelverzeichnis,
wortgleich aus der Konvention, als klassisches Skript neben `version.js` —
es besitzt Erkennung, `localStorage`, den Knopf in `#game-nav` und das
Ereignis `gg-langchange`. (2) Neues ES-Modul `js/strings.js` mit der
englischen Tabelle, `t(key, vars)` und einem Applier für das statische
Markup. Deutsch wird **nicht** dupliziert, sondern beim Start aus dem DOM
gelesen (`rememberDe`); nur die drei Vorlagen mit Platzhaltern tragen beide
Sprachen. (3) In `js/game.js` ein einziger `gg-langchange`-Listener, der den
Applier und die vorhandenen Beschriftungs-Aktualisierer erneut anwirft.

**Tech Stack:** Vanilla ES-Module, three.js r184, kein Build, kein
Test-Runner. Verifikation: headless Playwright im Vordergrund.

**Spec:** `docs/ai-notes/specs/2026-09-27-i18n-zweisprachig-design.md`

## Global Constraints

- **Zeilennummern sind Schätzungen.** Während dieser Plan entstand, liefen
  rund zehn `ai-implement`-Läufe parallel gegen `main`. Jede Angabe
  `datei:zeile` vor dem Anfassen mit `grep` auf das genannte **Symbol**
  nachprüfen. Vor Task 1: `git fetch origin && git rebase origin/main`.
- **Deutsche Oberfläche bleibt die Ursprungssprache.** Deutsche Literale
  werden **nicht** in eine Tabelle verschoben und nicht dupliziert — sie
  bleiben, wo sie sind, und bekommen nur einen Schlüssel.
- **Deutsche Kommentare**, Schweizer Schreibweise (`ss`, nie `ß`), echte
  Umlaute (`ä ö ü`), Anredepronomen gross (`Du`, `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei.**
- **`i18n.js` wird wortgleich übernommen** — inklusive `btn.blur()`. Keine
  spielspezifische Anpassung darin; alles Spielspezifische lebt in
  `js/strings.js`.
- **Kein neues Feld im Spielstand.** `gg-lang` ist eine Browser-Einstellung.
- **Vom Spieler eingegebene Texte werden nie übersetzt** (Raumnamen aus #103,
  Turmnamen, Namen eigener Möbelentwürfe).
- **Ein unübersetzter Schlüssel zeigt Deutsch**, nie den rohen Schlüssel.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`, in der
  Sprache der Spielenden.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(i18n)`.

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-i18n-zweisprachig/`
(über `.gitignore` ausgeschlossen, Zeile `.superpowers/`). Sie werden
**nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis,
  Port aus **9101–9105** (erster freier). Nur der Server darf in den
  Hintergrund; danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Keine Kamerafahrten nötig.** Alle Prüfungen dieses Plans sind DOM-
  Prüfungen; es wird nie auf eine Animation gewartet.
- Sprache setzen **vor** dem Laden, damit der Startzustand geprüft werden
  kann: `context.add_init_script("localStorage.setItem('gg-lang','en')")`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.

**Gemeinsamer Sondenkopf** (in jeder Sonde wortgleich; die Sonden werden
einzeln gestartet und teilen keinen Zustand):

```python
import socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
PORT = next(p for p in range(9101, 9106)
            if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
URL = f"http://127.0.0.1:{PORT}/index.html"
ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
fehler = []

def starte():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           cwd=ROOT, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    return srv

def check(ok, was):
    print(("  OK   " if ok else "  FAIL ") + was)
    if not ok:
        fehler.append(was)
```

---

### Task 1: `i18n.js` wortgleich übernehmen und laden

**Files:**

- Create: `i18n.js` (Repo-Wurzel)
- Modify: `index.html` (eine Zeile neben `<script src="./version.js">`,
  heute `index.html:488`)

**Interfaces (von `i18n.js` bereitgestellt, nicht neu erfunden):**

- `window.GG_LANG` — `'de'` oder `'en'`
- `window.ggSetLang(lang)`
- Ereignis `gg-langchange` auf `window`, `detail.lang`
- `localStorage`-Schlüssel `gg-lang`
- Knopf `#gg-lang-toggle` in `#game-nav`

**Steps:**

- [ ] **Step 1: Sonde schreiben, die heute rot ist.**

  `.superpowers/sdd/2026-09-27-i18n-zweisprachig/p1_toggle.py`:

  ```python
  # <Sondenkopf einsetzen>
  srv = starte()
  try:
      with sync_playwright() as p:
          b = p.chromium.launch(args=ARGS)
          ctx = b.new_context()
          page = ctx.new_page()
          page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))
          page.goto(URL, wait_until="networkidle")

          print("\n=== Der Umschalter ist da und sichtbar ===")
          knopf = page.locator("#gg-lang-toggle")
          check(knopf.count() == 1, "genau ein #gg-lang-toggle")
          check(knopf.is_visible(), "der Knopf ist sichtbar")
          check(knopf.evaluate("el => el.closest('#game-nav') !== null"),
                "er sitzt in #game-nav")
          check(knopf.inner_text().strip() in ("DE", "EN"), "Beschriftung DE/EN")

          print("\n=== Ein Klick schaltet um und haelt ===")
          vorher = page.evaluate("() => window.GG_LANG")
          knopf.click()
          nachher = page.evaluate("() => window.GG_LANG")
          check(vorher != nachher, "GG_LANG hat gewechselt")
          check(page.evaluate("() => localStorage.getItem('gg-lang')") == nachher,
                "gg-lang steht im localStorage")
          check(knopf.inner_text().strip() == nachher.upper(),
                "die Beschriftung folgt")

          print("\n=== Der Knopf behaelt den Fokus nicht (btn.blur) ===")
          check(page.evaluate("() => document.activeElement.id !== 'gg-lang-toggle'"),
                "nach dem Klick ist der Knopf nicht mehr fokussiert")

          print("\n=== Nach einem Reload gilt die Wahl weiter ===")
          page.reload(wait_until="networkidle")
          check(page.evaluate("() => window.GG_LANG") == nachher,
                "GG_LANG ueberlebt den Reload")
          b.close()
  finally:
      srv.terminate()
  print("\nFEHLER:", fehler or "keine")
  sys.exit(1 if fehler else 0)
  ```

  Im Vordergrund starten: `python3 .superpowers/sdd/2026-09-27-i18n-zweisprachig/p1_toggle.py`.
  Erwartet: rot (`#gg-lang-toggle` fehlt).

- [ ] **Step 2: `i18n.js` anlegen — wortgleich aus `CLAUDE.md`.**

  Der Abschnitt „Localization (i18n)" in `CLAUDE.md` enthält die Datei als
  Codeblock. Sie wird **unverändert** kopiert, Kommentare eingeschlossen:

  ```javascript
  (function () {
    "use strict";

    var SUPPORTED = ["en", "de"];
    var STORAGE_KEY = "gg-lang";

    function detect() {
      var stored = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
      var nav = (navigator.language || "en").toLowerCase();
      return nav.indexOf("de") === 0 ? "de" : "en";
    }

    window.GG_LANG = detect();

    window.ggSetLang = function (lang) {
      if (SUPPORTED.indexOf(lang) === -1) return;
      window.GG_LANG = lang;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
      window.dispatchEvent(new CustomEvent("gg-langchange", { detail: { lang: lang } }));
    };

    // Delegated on `document`, not on the button itself: some games' #game-nav
    // is managed by a UI framework (e.g. a dc-tool-bundled game whose runtime
    // mounts a React root over it) that periodically recreates its DOM
    // subtree from the framework's own tracked template — silently dropping
    // any listener attached directly to a child node (and stripping raw
    // `onclick="..."` attributes, since a framework like React expects a
    // function-valued prop, not a string). A listener on `document` is
    // outside that subtree, so it survives regardless of how often the
    // button node underneath it gets replaced; it just re-checks
    // `event.target` on every click.
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("#gg-lang-toggle");
      if (!btn) return;
      window.ggSetLang(window.GG_LANG === "en" ? "de" : "en");
      // Games with keyboard-driven controls (e.g. Enter/Space to confirm) can
      // otherwise re-trigger this button via the browser's native
      // button-activation-on-keypress behavior if it retains focus after the
      // mouse click.
      if (typeof btn.blur === "function") btn.blur();
    });

    function injectToggle() {
      if (document.getElementById("gg-lang-toggle")) return;

      var nav = document.getElementById("game-nav");
      if (!nav) return;

      var sep = document.createElement("span");
      sep.setAttribute("aria-hidden", "true");
      sep.style.color = "#5a6072";
      sep.textContent = "·";

      var btn = document.createElement("button");
      btn.id = "gg-lang-toggle";
      btn.type = "button";
      btn.title = "Switch language";
      btn.style.cssText =
        "background:none;border:none;padding:0;margin:0;font:inherit;color:#8fd8e8;cursor:pointer";
      btn.textContent = window.GG_LANG.toUpperCase();

      window.addEventListener("gg-langchange", function (e) {
        var b = document.getElementById("gg-lang-toggle");
        if (b) b.textContent = e.detail.lang.toUpperCase();
      });

      nav.appendChild(sep);
      nav.appendChild(btn);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectToggle);
    } else {
      injectToggle();
    }
  })();
  ```

  **Nichts daran ändern.** Wenn etwas fehlt, gehört es nach `js/strings.js`.

- [ ] **Step 3: In `index.html` laden.**

  Die Zeile `<script src="./version.js"></script>` suchen (`grep -n
  'version.js' index.html`, heute Zeile 488) und direkt darunter ergänzen:

  ```html
  <script src="./version.js"></script>
  <script src="./i18n.js"></script>
  ```

  Beide stehen vor `<nav id="game-nav">`, also greift der
  `DOMContentLoaded`-Pfad in `injectToggle()`.

- [ ] **Step 4: Sonde grün.** `p1_toggle.py` erneut im Vordergrund laufen
  lassen — alle Prüfungen grün, keine `pageerror`.

- [ ] **Step 5: Commit.** `feat(i18n): gemeinsames i18n.js einbinden`

---

### Task 2: `js/strings.js` — `t()`, `rememberDe()`, `applyStatic()`

**Files:**

- Create: `js/strings.js`
- Modify: `js/game.js` (Import, Start-Aufruf, `gg-langchange`-Listener; der
  Import gehört zu den bestehenden `import`-Zeilen ganz oben)

**Interfaces:**

- `export function t(key, vars)` — liefert den Text der aktuellen Sprache,
  ersetzt `{name}`-Platzhalter, fällt auf Deutsch zurück, dann auf Englisch,
  zuletzt auf den Schlüssel.
- `export function rememberDe(key, text)` — merkt den deutschen Wert;
  **überschreibt nie** einen schon gemerkten (sonst würde der Applier beim
  zweiten Lauf Englisch als Deutsch einlesen).
- `export function applyStatic(wurzel = document)` — übersetzt alle Elemente
  mit `data-i18n*`-Attributen unter `wurzel`.
- `export function initI18n(nachWechsel)` — merkt Deutsch aus dem DOM, setzt
  `lang`/`title`, wendet `applyStatic()` an und hängt den
  `gg-langchange`-Listener ein, der zusätzlich `nachWechsel()` ruft.

**Steps:**

- [ ] **Step 1: Sonde schreiben, die heute rot ist.**

  `.superpowers/sdd/2026-09-27-i18n-zweisprachig/p2_schicht.py` — prüft die
  Schicht selbst, noch ohne Auszeichnung im Markup:

  ```python
  # <Sondenkopf einsetzen>
  srv = starte()
  try:
      with sync_playwright() as p:
          b = p.chromium.launch(args=ARGS)
          page = b.new_context().new_page()
          page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))
          page.goto(URL, wait_until="networkidle")

          print("\n=== Die Schicht haengt am Debug-Hook ===")
          check(page.evaluate("() => typeof wipfelkratzer.t === 'function'"),
                "wipfelkratzer.t ist eine Funktion")

          print("\n=== Fallback: unbekannter Schluessel bleibt er selbst ===")
          check(page.evaluate("() => wipfelkratzer.t('gibt.es.nicht')") == "gibt.es.nicht",
                "unbekannter Schluessel kommt unveraendert zurueck")

          print("\n=== Platzhalter ===")
          check(page.evaluate("() => wipfelkratzer.t('hud.floors', {n: 3, max: 10})")
                == "Erdgeschoss + 3 von 10 Stockwerken", "de-Vorlage mit {n}/{max}")
          page.evaluate("() => ggSetLang('en')")
          check(page.evaluate("() => wipfelkratzer.t('hud.floors', {n: 3, max: 10})")
                == "Ground floor + 3 of 10 storeys", "en-Vorlage mit {n}/{max}")

          print("\n=== Sprache faellt auf Deutsch zurueck, nie auf den Schluessel ===")
          check(page.evaluate("() => wipfelkratzer.t('app.title')") != "app.title",
                "app.title liefert Text")

          print("\n=== lang und title folgen ===")
          check(page.evaluate("() => document.documentElement.lang") == "en",
                "<html lang> ist en")
          page.evaluate("() => ggSetLang('de')")
          check(page.evaluate("() => document.documentElement.lang") == "de",
                "<html lang> ist wieder de")
          check(page.evaluate("() => document.title") == "Willi baut den Wipfelkratzer",
                "document.title ist wieder deutsch")
          b.close()
  finally:
      srv.terminate()
  print("\nFEHLER:", fehler or "keine")
  sys.exit(1 if fehler else 0)
  ```

- [ ] **Step 2: `js/strings.js` anlegen.**

  ```js
  /* Zweisprachigkeit de/en. Deutsch ist die Ursprungssprache des Spiels und
     steht weiterhin dort, wo es hingehoert: im Markup und in js/game.js.
     Diese Datei traegt deshalb nur Englisch — plus die wenigen Vorlagen mit
     Platzhaltern, deren deutsche Fassung nicht aus dem DOM lesbar ist.
     Schnittstelle nach aussen ist i18n.js (window.GG_LANG, gg-langchange). */

  /* Vorlagen: hier steht Deutsch ausnahmsweise mit, weil {n}/{max} kein
     Textknoten sind, den applyStatic() auslesen koennte. */
  const DE_VORLAGEN = {
    'hud.nuts': '{n} Haselnüsse',
    'hud.floors': 'Erdgeschoss + {n} von {max} Stockwerken',
    'build.next': 'Stockwerk bauen ({n}/{max})',
    'edit.flat': '{fl} — Wohnung einrichten',
    'edit.tenant': '{fl} — {name}',
  };

  export const EN = {
    /* wird in Task 3 und 4 gefuellt */
  };

  const DE = {};

  /* Nie ueberschreiben: beim zweiten Lauf stuende im DOM sonst Englisch, und
     das wuerde als deutscher Wert gemerkt. */
  export function rememberDe(key, text) {
    if (!(key in DE) && typeof text === 'string' && text.length) DE[key] = text;
  }
  for (const [k, v] of Object.entries(DE_VORLAGEN)) rememberDe(k, v);

  export function t(key, vars) {
    const roh = (window.GG_LANG === 'en' ? EN[key] : DE[key]) ?? DE[key] ?? EN[key] ?? key;
    return vars ? roh.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? '')) : roh;
  }

  /* Attribut -> Ziel. null heisst textContent. */
  const ZIELE = [['data-i18n', null], ['data-i18n-title', 'title'],
                 ['data-i18n-aria', 'aria-label'], ['data-i18n-placeholder', 'placeholder']];

  export function applyStatic(wurzel = document) {
    for (const [attr, ziel] of ZIELE)
      for (const el of wurzel.querySelectorAll(`[${attr}]`)) {
        const key = el.getAttribute(attr);
        rememberDe(key, ziel ? el.getAttribute(ziel) : el.textContent);
        const wert = t(key);
        if (ziel) el.setAttribute(ziel, wert); else el.textContent = wert;
      }
  }

  /* Ein einziger Einstiegspunkt fuer js/game.js. nachWechsel() zieht die
     Beschriftungen nach, die das Spiel selbst setzt (Task 4). */
  export function initI18n(nachWechsel) {
    const anwenden = () => {
      document.documentElement.lang = window.GG_LANG;
      document.title = t('app.title');
      applyStatic();
      if (nachWechsel) nachWechsel();
    };
    anwenden();
    window.addEventListener('gg-langchange', anwenden);
  }
  ```

  **`app.title`** braucht einen deutschen Wert, den es im `<title>` nicht als
  `data-i18n` geben kann (der Applier fasst nur Elemente im `<body>` an).
  Deshalb wird er in Task 3 als `data-i18n="app.title"` an die HUD-`<h1>`
  gehängt — dieselbe Zeichenkette — und `document.title` zieht darüber nach.

- [ ] **Step 3: In `js/game.js` verdrahten.**

  Bei den bestehenden `import`-Zeilen ganz oben:

  ```js
  import { t, initI18n, applyStatic } from './strings.js';
  ```

  Unten, wo `window.wipfelkratzer = { … }` gesetzt wird (heute
  `js/game.js:2810`, mit `grep -n 'window.wipfelkratzer' js/game.js`
  nachprüfen), `t` und `applyStatic` in das Objekt aufnehmen — die Sonden
  brauchen sie.

  `initI18n(refreshChrome)` wird erst in Task 4 gerufen, wenn
  `refreshChrome` existiert; bis dahin `initI18n()` ohne Argument, direkt
  vor `tick()`.

- [ ] **Step 4: Sonde grün.** `p2_schicht.py` im Vordergrund.

- [ ] **Step 5: Commit.** `feat(i18n): t()-Schicht und Applier fuer statisches Markup`

---

### Task 3: Das statische Markup auszeichnen und die englischen Texte schreiben

**Files:**

- Modify: `index.html` (`data-i18n*`-Attribute; **keine** deutschen Texte
  ändern)
- Modify: `js/strings.js` (`EN` füllen)

**Interfaces:** keine neuen. Schlüssel-Namensschema:
`bereich.sache` — `intro.*`, `hud.*`, `toolbar.*`, `extras.*`, `edit.*`,
`besuch.*`, `sel.*`, `dlg.*`, `season.*`, `app.title`.

**Steps:**

- [ ] **Step 1: Sonde schreiben, die heute rot ist.**

  `.superpowers/sdd/2026-09-27-i18n-zweisprachig/p3_chrome.py`:

  ```python
  # <Sondenkopf einsetzen>
  # Erwartungspaare: (Selektor, deutsch, englisch)
  PAARE = [
      ("#btn-catalog",       "Einrichten",       "Furnish"),
      ("#btn-extras",        "Extras",           "Extras"),
      ("#btn-cutaway",       "Wände weg",        "Walls away"),
      ("#btn-besuch",        "Hineingehen",      "Go inside"),
      ("#btn-photo",         "Foto",             "Photo"),
      ("#btn-bridge",        "Brücke bauen",     "Build a bridge"),
      ("#btn-animals",       "Tier-Übersicht",   "All the animals"),
      ("#btn-staende",       "Meine Türme",      "My towers"),
      ("#btn-tip",           "Tipp",             "Hint"),
      ("#btn-done",          "Fertig",           "Done"),
      ("#btn-besuch-dach",   "Dach",             "Roof"),
      ("#btn-besuch-zu",     "Schluss",          "Leave"),
      ("#btn-move",          "Verschieben",      "Move"),
      ("#btn-rot",           "Drehen",           "Turn"),
      ("#btn-del",           "Weg damit",        "Remove"),
      ("#btn-galclose",      "Zu",               "Close"),
      ("#toast-clear-all",   "Alle schliessen",  "Close all"),
  ]
  srv = starte()
  try:
      with sync_playwright() as p:
          b = p.chromium.launch(args=ARGS)
          page = b.new_context().new_page()
          page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))
          page.goto(URL, wait_until="networkidle")

          print("\n=== Deutsch ist der Ausgangszustand ===")
          page.evaluate("() => ggSetLang('de')")
          for sel, de, _ in PAARE:
              ist = page.locator(sel).inner_text().strip()
              check(ist == de, f"{sel} = «{de}» (ist: «{ist}»)")

          print("\n=== Umschalten auf Englisch, ohne Reload ===")
          page.evaluate("() => ggSetLang('en')")
          for sel, _, en in PAARE:
              ist = page.locator(sel).inner_text().strip()
              check(ist == en, f"{sel} = «{en}» (ist: «{ist}»)")

          print("\n=== Und wieder zurueck ===")
          page.evaluate("() => ggSetLang('de')")
          for sel, de, _ in PAARE:
              check(page.locator(sel).inner_text().strip() == de, f"{sel} zurueck auf «{de}»")

          print("\n=== Kein roher Schluessel irgendwo im Body ===")
          page.evaluate("() => ggSetLang('en')")
          import re
          txt = page.locator("body").inner_text()
          treffer = re.findall(r"\b(?:intro|hud|toolbar|extras|edit|besuch|sel|dlg|season|app)\.[a-z]\w+", txt)
          check(not treffer, f"keine rohen Schluessel sichtbar (gefunden: {treffer[:5]})")

          print("\n=== aria-label und title folgen mit ===")
          check(page.get_attribute("#btn-wall-up", "aria-label") == "Up",
                "aria-label von #btn-wall-up ist englisch")
          check(page.get_attribute("#btn-besuch-hoch", "title") == "one floor up",
                "title von #btn-besuch-hoch ist englisch")
          b.close()
  finally:
      srv.terminate()
  print("\nFEHLER:", fehler or "keine")
  sys.exit(1 if fehler else 0)
  ```

- [ ] **Step 2: Attribute setzen — Gruppe für Gruppe.**

  Die deutschen Texte bleiben **wortgleich** stehen; es kommt nur ein
  Attribut dazu. Beispiel:

  ```html
  <button id="btn-catalog" data-i18n="toolbar.catalog">Einrichten</button>
  <button id="btn-besuch-hoch" title="ein Stockwerk höher"
          data-i18n-title="besuch.up">▲</button>
  <button id="btn-wall-up" aria-label="Nach oben" data-i18n-aria="sel.up">↑</button>
  ```

  Abzuarbeiten, in dieser Reihenfolge (Zeilen vorher mit `grep -n` prüfen):

  | Gruppe | heute | Schlüssel-Präfix |
  |---|---|---|
  | HUD-Titel (`<h1>`) | `index.html:298` | `app.title` |
  | Hauptleiste, 9 Knöpfe | `index.html:305-315` | `toolbar.` |
  | Extras-Menü, 7 Knöpfe | `index.html:317-325` | `extras.` |
  | Einrichte-Leiste | `index.html:327-333` | `edit.` |
  | Besuchsleiste (inkl. 2 `title`) | `index.html:335-343` | `besuch.` |
  | Auswahlleiste (inkl. 5 `aria-label`) | `index.html:345-358` | `sel.` |
  | Dialoge: `<h2>` und Knöpfe | `index.html:361-460` | `dlg.` |
  | Toast-Sammelknopf | `index.html:462` | `dlg.closeAll` |
  | Intro: `<h1>`, 3 `<p>`, Frage, 3 Turmgrössen, 2 Knöpfe | `index.html:465-479` | `intro.` |

  **Nicht auszeichnen:** `#nutrow` und `#floorinfo` (gemischte Kindknoten →
  Task 4), `#edit-title`, `#besuch-titel`, `#btn-action` (leer, wird von JS
  gesetzt), alles in `#game-nav`, `#version-badge`.

  Knöpfe, deren Beschriftung das Spiel umschaltet (`btn-build`,
  `btn-cutaway`, `btn-night`, `btn-music`, `btn-season`), bekommen **kein**
  `data-i18n` — sonst überschriebe der Applier den JS-Zustand. Sie gehören zu
  Task 4.

- [ ] **Step 3: `EN` in `js/strings.js` füllen.**

  Für jeden gesetzten Schlüssel ein englischer Eintrag. Ton: kindgerecht,
  kurz, wie das deutsche Original — nicht wörtlich. Anhaltspunkte:

  ```js
  export const EN = {
    'app.title': 'Willi builds the Treetop Scraper',

    'toolbar.build': 'Build a floor',
    'toolbar.catalog': 'Furnish',
    'toolbar.extras': 'Extras',
    'toolbar.night': 'Night',
    'toolbar.day': 'Day',
    'toolbar.cutaway.off': 'Walls away',
    'toolbar.cutaway.on': 'Walls back',
    'toolbar.besuch': 'Go inside',
    'toolbar.photo': 'Photo',
    'toolbar.music.on': 'Music off',
    'toolbar.music.off': 'Music on',

    'extras.bridge': 'Build a bridge',
    'extras.garden': 'Garden & playground',
    'extras.sign': 'Name board',
    'extras.animals': 'All the animals',
    'extras.gallery': 'Photo gallery',
    'extras.party': 'Throw a roof party!',
    'extras.staende': 'My towers',

    'edit.copy': 'Copy room',
    'edit.paste': 'Paste room',
    'edit.tip': 'Hint',
    'edit.done': 'Done',

    'besuch.down': 'one floor down',
    'besuch.up': 'one floor up',
    'besuch.roof': 'Roof',
    'besuch.outside': 'Outside',
    'besuch.view': 'Lookout',
    'besuch.close': 'Leave',

    'sel.move': 'Move',
    'sel.turn': 'Turn',
    'sel.up': 'Up', 'sel.left': 'Left', 'sel.down': 'Down', 'sel.right': 'Right',
    'sel.color': 'Colour',
    'sel.colorpick': 'Pick a colour',
    'sel.delete': 'Remove',

    'dlg.close': 'Close',
    'dlg.closeAll': 'Close all',
    /* … Dialogtitel, Intro-Texte, Jahreszeiten … */
  };
  ```

  Die Liste im Codeblock ist **unvollständig** — sie zeigt das Schema. Jeder
  in Step 2 gesetzte Schlüssel braucht einen Eintrag; die Sonde in Step 4
  fängt die Lücken, weil sie den sichtbaren Text im EN-Modus gegen die
  deutschen Werte prüft.

- [ ] **Step 4: Sonden grün.** `p3_chrome.py` **und** `p1_toggle.py` und
  `p2_schicht.py` erneut, alle im Vordergrund.

- [ ] **Step 5: Commit.** `feat(i18n): Bedienoberflaeche zweisprachig auszeichnen`

---

### Task 4: Die Beschriftungen, die das Spiel selbst setzt

**Files:**

- Modify: `js/game.js` (`flLabel`, Bauknopf, Wände-weg, Tag/Nacht, Musik,
  Jahreszeit, HUD-Zähler, Einrichte-Titel, Besuchstitel, `refreshChrome`)
- Modify: `js/models.js` (`SEASONS` bekommt ein `key`-Feld)
- Modify: `js/strings.js` (die zugehörigen `EN`-Einträge)

**Interfaces:**

- `function refreshChrome()` in `js/game.js` — ruft die vorhandenen
  Aktualisierer; wird `initI18n(refreshChrome)` übergeben.
- `SEASONS[i].key` in `js/models.js` — `'season.spring' | 'season.summer' |
  'season.autumn' | 'season.winter'`; `name` bleibt unverändert als deutscher
  Wert und wird beim Start über `rememberDe` eingespeist.

**Steps:**

- [ ] **Step 1: Sonde schreiben, die heute rot ist.**

  `.superpowers/sdd/2026-09-27-i18n-zweisprachig/p4_labels.py`:

  ```python
  # <Sondenkopf einsetzen>
  srv = starte()
  try:
      with sync_playwright() as p:
          b = p.chromium.launch(args=ARGS)
          page = b.new_context().new_page()
          page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))
          page.goto(URL, wait_until="networkidle")
          page.evaluate("() => { wipfelkratzer.state.floors = 3; }")
          page.evaluate("() => ggSetLang('de')")

          print("\n=== HUD-Vorlagen, deutsche Wortstellung ===")
          check("von" in page.locator("#floorinfo").inner_text(), "de: «von» im Zaehler")
          check("Haselnüsse" in page.locator("#nutrow").inner_text(), "de: Haselnuesse")

          print("\n=== Umschalten ===")
          page.evaluate("() => ggSetLang('en')")
          zaehler = page.locator("#floorinfo").inner_text()
          check("Ground floor" in zaehler and " of " in zaehler,
                f"en: «Ground floor … of …» (ist: «{zaehler}»)")
          check("hazelnut" in page.locator("#nutrow").inner_text().lower(), "en: hazelnuts")

          print("\n=== Umschaltknoepfe in beiden Zustaenden ===")
          check("Walls away" == page.locator("#btn-cutaway").inner_text().strip(),
                "en: Waende weg")
          page.locator("#btn-cutaway").click()
          check("Walls back" == page.locator("#btn-cutaway").inner_text().strip(),
                "en: Waende hin")
          check(page.locator("#btn-night").inner_text().strip() in ("Night", "Day"),
                "en: Tag/Nacht")
          check(page.locator("#btn-music").inner_text().strip() in ("Music off", "Music on"),
                "en: Musik")
          check(page.locator("#btn-season").inner_text().strip()
                in ("Spring", "Summer", "Autumn", "Winter"), "en: Jahreszeit")
          check("Build a floor" in page.locator("#btn-build").inner_text(), "en: Bauknopf")

          print("\n=== Etagenkuerzel ===")
          check(page.evaluate("() => wipfelkratzer.t('fl.ground')") == "G", "en: E -> G")
          page.evaluate("() => ggSetLang('de')")
          check(page.evaluate("() => wipfelkratzer.t('fl.ground')") == "E", "de: E")

          print("\n=== Spielerdaten bleiben unangetastet ===")
          page.evaluate("() => { wipfelkratzer.state.designs = [{name: 'Mein Möbel', parts: []}]; }")
          page.evaluate("() => ggSetLang('en')")
          check(page.evaluate("() => wipfelkratzer.state.designs[0].name") == "Mein Möbel",
                "der Name eines eigenen Entwurfs bleibt, wie er ist")
          b.close()
  finally:
      srv.terminate()
  print("\nFEHLER:", fehler or "keine")
  sys.exit(1 if fehler else 0)
  ```

- [ ] **Step 2: `flLabel` zweisprachig.**

  Heute `js/game.js:40` (`grep -n 'const flLabel'`):

  ```js
  const flLabel = i => i === 0 ? t('fl.ground') : String(i);
  ```

  `EN['fl.ground'] = 'G'`, deutsch `'E'` — deutscher Wert über
  `DE_VORLAGEN` in `js/strings.js`, weil es dafür kein DOM-Element gibt.

- [ ] **Step 3: Die fünf Umschaltknöpfe.**

  Jeweils die vorhandene Zeile suchen und das Literal durch `t()` ersetzen —
  **die Logik bleibt, wie sie ist**:

  | heute | wird zu |
  |---|---|
  | `js/game.js:897` Bauknopf | `t('build.done')` bzw. `t('build.next', { n: state.floors + 1, max: MAXF })` |
  | `js/game.js:1116` Wände | `t(state.cutaway ? 'toolbar.cutaway.on' : 'toolbar.cutaway.off')` |
  | `js/game.js:1871` Tag/Nacht | `t(k > 0.5 ? 'toolbar.day' : 'toolbar.night')` |
  | `js/game.js:2000` Musik | `t(musicOn ? 'toolbar.music.on' : 'toolbar.music.off')` |
  | `js/game.js:1910` Jahreszeit | `t((q < 0.5 ? a : b).key)` |

  In `js/models.js` bekommt jeder `SEASONS`-Eintrag ein `key`-Feld
  (`js/models.js:28-48`); `name` bleibt unverändert. Beim Start speist
  `js/game.js` die deutschen Werte ein:

  ```js
  for (const s of SEASONS) rememberDe(s.key, s.name);
  ```

- [ ] **Step 4: Die beiden HUD-Vorlagen.**

  `#nutrow` und `#floorinfo` bekommen je eine Zeichenkette statt gemischter
  Kindknoten. Die Stellen, die heute `$('nuts').textContent` bzw.
  `$('floors').textContent` setzen, mit `grep -n "'nuts'\|'floors'" js/game.js`
  finden und auf eine gemeinsame Funktion umstellen:

  ```js
  function zeichneHud() {
    $('nutrow').lastElementChild.textContent = t('hud.nuts', { n: state.nuts });
    $('floorinfo').textContent = t('hud.floors', { n: state.floors, max: MAXF });
  }
  ```

  Das `<span class="nut">`-Icon in `#nutrow` bleibt als erstes Kind stehen —
  nur der Textteil wird ersetzt. Die inneren `<span id="nuts">`/`<span
  id="floors">`/`<span id="floors-max">` entfallen damit; **vorher mit
  `grep -n "id=\"nuts\"\|getElementById('nuts')\|\$('nuts')" index.html js/`
  prüfen**, dass sie nirgends sonst gelesen werden, und alle Fundstellen
  mitziehen.

- [ ] **Step 5: Einrichte- und Besuchsleisten-Titel.**

  **Zuerst `git fetch origin && git rebase origin/main`** und nachsehen, ob
  #103 schon gelandet ist (`grep -n 'setzeEditLeiste' js/game.js`):

  - **Ja** → `setzeEditLeiste()` lokalisieren und zusätzlich
    `en`-Einträge für `edit.placeholder` („Name this flat"), `edit.garden`
    („Furnish the playground") und `edit.roof` („Furnish the roof terrace")
    setzen; am `<input id="edit-name">` ein
    `data-i18n-placeholder="edit.placeholder"` ergänzen.
  - **Nein** → die drei `$('edit-title').textContent`-Zuweisungen
    (`js/game.js:1147-1170`) einzeln lokalisieren und im PR-Text vermerken,
    dass #103 die neuen Literale mit `t()` nachziehen muss.

  Der Besuchstitel (`js/game.js:1296`) nutzt dieselben Vorlagen
  `edit.flat`/`edit.tenant`. **Der Bewohner- und der Raumname selbst gehen
  unverändert als `{name}` hinein** — nie durch `t()`.

- [ ] **Step 6: `refreshChrome()` und Verdrahtung.**

  ```js
  /* Nach einem Sprachwechsel zieht dies alles nach, was das Spiel selbst
     beschriftet. Es ruft nur die vorhandenen Aktualisierer — es gibt keine
     zweite Render-Wahrheit. */
  function refreshChrome() {
    zeichneHud();
    updateBuildBtn();          /* bzw. die Funktion um js/game.js:897 */
    $('btn-cutaway').textContent = t(state.cutaway ? 'toolbar.cutaway.on' : 'toolbar.cutaway.off');
    $('btn-night').textContent = t(nightK > 0.5 ? 'toolbar.day' : 'toolbar.night');
    $('btn-music').textContent = t(musicOn ? 'toolbar.music.on' : 'toolbar.music.off');
    $('btn-season').textContent = t(SEASONS[seasonTo].key);
    if (edit) setzeEditLeiste(edit.k);     /* bzw. der Vorgaenger aus Step 5 */
    if (besuch) zeichneBesuchTitel();      /* vorhandene Funktion um js/game.js:1296 */
  }
  ```

  Den Aufruf aus Task 2 Step 3 auf `initI18n(refreshChrome)` ändern.

- [ ] **Step 7: Alle vier Sonden grün**, im Vordergrund, nacheinander.

- [ ] **Step 8: Commit.** `feat(i18n): JS-Beschriftungen und HUD zweisprachig`

---

### Task 5: Layout gegenprüfen, Changelog, Abschluss

**Files:**

- Modify: `CHANGELOG.md` (unter `## [Unreleased]` → `### Added`)

**Steps:**

- [ ] **Step 1: Die Navileiste ist breiter geworden.**
  `tools/verify_game_nav.py` aus #32 gegenlaufen lassen, im Vordergrund:

  ```bash
  python3 tools/verify_game_nav.py
  python3 tools/verify_game_nav.py --viewport 360x640
  ```

  Grün erwartet. Rot heisst: der zusätzliche Knopf sprengt die Leiste auf
  schmalen Geräten — dann in `#game-nav` `flex-wrap: wrap` ergänzen und
  erneut messen. **`i18n.js` bleibt dabei unangetastet**; die Korrektur
  gehört ins `style`-Attribut der Leiste in `index.html`.

- [ ] **Step 2: Gesamtdurchlauf in beiden Sprachen.**
  Eine letzte Sonde `p5_gesamt.py`, die die Seite je einmal mit
  vorgesetztem `gg-lang=de` und `gg-lang=en` lädt (über
  `context.add_init_script`), in jeder Sprache einen Turm baut
  (`#btn-start`, dann `#btn-build`), das Extras-Menü und zwei Dialoge
  öffnet, und dabei prüft: keine `pageerror`, kein roher Schlüssel im
  sichtbaren Text, `#gg-lang-toggle` weiterhin sichtbar.

- [ ] **Step 3: Changelog.** Unter `## [Unreleased]` → `### Added`, in der
  Sprache der Spielenden:

  ```markdown
  - Das Spiel spricht jetzt Deutsch **und** Englisch. Unten rechts in der
    Leiste steht ein Knopf `DE`/`EN` — ein Tipp darauf schaltet die
    Menüs, Knöpfe und Fenstertitel sofort um, ohne die Seite neu zu laden.
    Die Wahl gilt auch in den anderen Spielen auf github.freaxnx01.ch.
    Meldungen, Möbelnamen und die Sprüche der Tiere sind noch Deutsch;
    sie folgen in den nächsten Ausgaben. Selbst vergebene Namen — Räume,
    Türme, eigene Möbel — bleiben immer so, wie Du sie geschrieben hast.
  ```

- [ ] **Step 4: Aufräumen.** `.superpowers/` wird nicht committet; prüfen mit
  `git status --porcelain`, dass nur `i18n.js`, `index.html`, `js/strings.js`,
  `js/game.js`, `js/models.js` und `CHANGELOG.md` im Diff stehen.

- [ ] **Step 5: Commit und PR.** `feat(i18n): Layout gegengeprueft und Changelog`

---

## Folge-Issues (nicht Teil von #107)

Nach dem Merge anlegen, jeweils mit `needs-enrichment`:

1. `feat(i18n): Meldungen und Tipps zweisprachig` — die 47 `toast(...)`-Aufrufe
   und `TIPS`, samt Platzhalterform für die Vorlagen.
2. `feat(i18n): Katalog und Materialien zweisprachig` — `CATALOG`, `CATS`,
   `FURN_COLORS`, `BUILD_SHAPES`, `BUILD_WIDTHS`, `WALLS`, `FLOORS`,
   `ACTIONS`.
3. `feat(i18n): Tiere und Dialoge zweisprachig` — `PHRASES`, `DAM_TEXTS`,
   `MOKI_TEXTS`, Aussichts-Erzählungen, `TENANTS`, `TENANT_WISHES`,
   `HOUSEHOLDS`; hier steckt die Singular-/Plural-Grammatik.
4. `feat(i18n): Türme, Spielstände und Export zweisprachig` —
   `js/staende.js`, `js/standdatei.js`.
