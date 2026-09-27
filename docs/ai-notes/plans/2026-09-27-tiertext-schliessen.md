# Plan — Sprechblase länger stehen lassen und mit × schliessen (Issue #104)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Sprechblase steht zwölf statt vier bis fünf Sekunden und trägt
einen runden ×, mit dem ein Kind sie sofort wegtippen kann — für alle fünf
Sprecher, also auch für die Tiere, die man von der Aussichtsplattform aus
antippt.

**Architecture:** Kein neues Subsystem. Es gibt nur **eine** Sprechblase
(`#bubble`, `index.html:463`), aber fünf Stellen, die sie von Hand öffnen.
Diese fünf werden auf eine gemeinsame Funktion `zeigeBlase()` umgestellt; der
× und die neue Dauer entstehen damit an genau einer Stelle. Geschlossen wird
über einen **einzigen delegierten** Click-Listener auf `bubbleEl`, weil der
Knopf bei jedem Sprechen durch `innerHTML` neu entsteht.

**Tech Stack:** Vanilla ES-Module, three.js r184, kein Build, kein
Test-Runner. Verifikation: headless Playwright im Vordergrund.

**Spec:** `docs/ai-notes/specs/2026-09-27-tiertext-schliessen-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`). Anredepronomen gross (`Du`,
  `Dein`).
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine committete Testdatei.**
- **`BLASE_DAUER = 12`** (Sekunden) — ein Wert für alle fünf Sprecher,
  ersetzt 4 / 4.5 / 5 / 4.5 / 5.
- **Der × misst mindestens 44 × 44 px** (Touch-Regel aus `CLAUDE.md`) und
  sieht aus wie `.toast-close` (`index.html:269`): rund, `font-size: 20px`.
- **`#bubble` bleibt `pointer-events: none`.** Nur der × bekommt `auto` —
  ein Tipp muss weiterhin durch die Blase hindurch in den Wald gehen.
- **Kein neues Feld im Spielstand**, kein `localStorage`, keine Einstellung.
- **Die Toast-Meldungen werden nicht angefasst** (`js/game.js:863-891`).
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Changed`, in der
  Sprache der Spielenden.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `fix(ui)`.

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-tiertext-schliessen/`
(über `.gitignore` ausgeschlossen, Zeile `.superpowers/`). Sie werden
**nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis,
  Port aus **9071–9075** (erster freier). Nur der Server darf in den
  Hintergrund; danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Keine Kamerafahrten nötig.** Die Sonden rufen die Sprechfunktionen über
  den Debug-Hook direkt auf, statt zu klicken — damit entfällt das
  Ankunfts-Warten, das der Aussichtsplattform-Plan brauchte.
- Das Ausblenden passiert **in der Renderschleife**, nicht im Timer. Headless
  zeichnet sie unter einem Bild pro Sekunde, also nie mit knappem `sleep`
  prüfen, sondern immer mit `page.wait_for_function(..., timeout=...,
  polling=500)`.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.

**Gemeinsamer Sondenkopf** (in jeder Sonde wortgleich, die Sonden werden
einzeln gestartet und teilen keinen Zustand):

```python
import json, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
PORT = next(p for p in range(9071, 9076)
            if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
URL = f"http://127.0.0.1:{PORT}/index.html"

def starte():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           cwd=ROOT, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    return srv
```

---

### Task 1: `zeigeBlase()` / `verbergeBlase()` und der × in der Blase

Eine Aufgabe, kein Zerlegen: der × ohne gemeinsame Öffnungsfunktion müsste
fünfmal eingebaut werden, und die gemeinsame Funktion ohne × wäre eine
Umbaute ohne sichtbaren Nutzen. Beides zusammen ist die kleinste Einheit, die
ein Prüfer sinnvoll annehmen oder ablehnen kann.

**Files:**
- Modify: `index.html:273` — `max-width` der Blase, neue Regel für
  `#bubble .blase-zu`
- Modify: `js/game.js:2318-2319` — `BLASE_DAUER`, `zeigeBlase`,
  `verbergeBlase`, delegierter Listener
- Modify: `js/game.js:2002-2010` (`tenantTalk`), `2320-2327` (`williTalk`),
  `2334-2340` (`damTalk`), `2348-2354` (`mokiTalk`), `2370-2376` (`erzaehle`)
- Modify: `js/game.js:2810-2841` — Debug-Hook
- Test: `.superpowers/sdd/2026-09-27-tiertext-schliessen/t1_blase.py`
  (nicht committet)

**Interfaces:**
- Produces: `const BLASE_DAUER = 12` in `js/game.js` — Standzeit in Sekunden.
- Produces: `function zeigeBlase(ziel, hoehe, inhalt)` — setzt
  `bubbleTarget`/`bubbleH`, schreibt `inhalt` **plus** den ×-Knopf in
  `bubbleEl.innerHTML`, setzt `show` und
  `bubbleUntil = clock.elapsedTime + BLASE_DAUER`. Gibt nichts zurück,
  spielt keinen Klang.
- Produces: `function verbergeBlase()` — entfernt `show`, setzt
  `bubbleUntil = 0`. Gibt nichts zurück.
- Produces: im Debug-Hook zusätzlich `BLASE_DAUER`, `zeigeBlase`,
  `verbergeBlase`, `erzaehle`, `williTalk`, `damTalk`, `mokiTalk`,
  `tenantTalk` und `get clock()`.
- Consumes: die vorhandenen Modulvariablen `bubbleEl` (`js/game.js:2319`),
  `bubbleTarget`, `bubbleH`, `bubbleUntil` und `clock` (`js/game.js:2909`).

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-tiertext-schliessen/t1_blase.py` —
      Sondenkopf von oben wortgleich voranstellen, dann:

      ```python
      srv = starte()
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.goto(URL, wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)

              vorher = page.evaluate("""() => {
                const w = window.wipfelkratzer;
                return { dauer: w.BLASE_DAUER,
                         hatZeige: typeof w.zeigeBlase === 'function',
                         hatVerberge: typeof w.verbergeBlase === 'function' };
              }""")

              # Die Blase über den Hook öffnen — keine Kamerafahrt nötig.
              page.evaluate("() => window.wipfelkratzer.williTalk()")
              page.wait_for_selector("#bubble.show", timeout=10000)

              form = page.evaluate("""() => {
                const el = document.getElementById('bubble');
                const btn = el.querySelector('.blase-zu');
                return { knoepfe: el.querySelectorAll('.blase-zu').length,
                         blasePE: getComputedStyle(el).pointerEvents,
                         knopfPE: btn ? getComputedStyle(btn).pointerEvents : null };
              }""")
              kasten = page.locator("#bubble .blase-zu").bounding_box()

              # Tipp auf den × blendet sofort aus.
              page.click("#bubble .blase-zu", timeout=20000)
              page.wait_for_function(
                  "() => !document.getElementById('bubble').classList.contains('show')",
                  timeout=15000, polling=250)
              zu = True
              b.close()

          print(json.dumps({"vorher": vorher, "form": form, "kasten": kasten},
                           indent=2, ensure_ascii=False))
          assert vorher["dauer"] == 12, vorher
          assert vorher["hatZeige"] and vorher["hatVerberge"], vorher
          assert form["knoepfe"] == 1, form
          assert form["blasePE"] == "none", form
          assert form["knopfPE"] == "auto", form
          assert kasten and kasten["width"] >= 44 and kasten["height"] >= 44, kasten
          assert zu
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Sonde läuft rot.**
      `python3 .superpowers/sdd/2026-09-27-tiertext-schliessen/t1_blase.py`
      bricht mit `AssertionError` beim `vorher`-Block ab (`dauer` ist
      `undefined`, `hatZeige` ist `false`). Rot gesehen zu haben ist die
      Voraussetzung für Step 3. **Im Vordergrund laufen lassen**, mit
      grosszügigem Timeout — nie `run_in_background`.

- [ ] **Step 3: CSS in `index.html`.** Die Blasenregel (`index.html:273`)
      bekommt mehr Breite, und darunter kommt eine neue Regel für den Knopf.
      Vorher:

      ```css
      #bubble { position: fixed; z-index: 6; transform: translate(-50%, -110%); padding: 8px 12px; font-size: 15px; font-weight: 600; max-width: 280px; display: none; pointer-events: none; border-radius: 16px 16px 16px 4px; align-items: center; gap: 10px; }
      #bubble.show { display: flex; }
      #bubble img { width: 52px; height: 52px; border-radius: 50%; background: #e8f0d8; border: 2px solid var(--woodL); flex-shrink: 0; }
      ```

      Nachher — `max-width` auf 320px, damit Bild (52px), Text und Knopf
      (44px) nebeneinander Platz haben, plus die Knopfregel. `pointer-events`
      an `#bubble` bleibt `none`; nur der Knopf fängt Tipps:

      ```css
      #bubble { position: fixed; z-index: 6; transform: translate(-50%, -110%); padding: 8px 12px; font-size: 15px; font-weight: 600; max-width: 320px; display: none; pointer-events: none; border-radius: 16px 16px 16px 4px; align-items: center; gap: 10px; }
      #bubble.show { display: flex; }
      #bubble img { width: 52px; height: 52px; border-radius: 50%; background: #e8f0d8; border: 2px solid var(--woodL); flex-shrink: 0; }
      /* Der × ist die einzige Stelle der Blase, die einen Tipp fängt — alles
         andere muss durchlässig bleiben, damit man durch die Blase hindurch
         in den Wald tippen kann (#104). Form wie .toast-close, damit das
         Kind denselben runden Knopf wiedererkennt. */
      #bubble .blase-zu { pointer-events: auto; min-width: 44px; min-height: 44px; padding: 0; border-radius: 50%; font-size: 20px; line-height: 1; flex-shrink: 0; }
      ```

- [ ] **Step 4: `BLASE_DAUER`, `zeigeBlase`, `verbergeBlase` und der
      Listener in `js/game.js`.** Direkt **nach** `const bubbleEl = $('bubble');`
      (`js/game.js:2319`) einfügen — vor `williTalk`:

      ```js
      /* Standzeit jeder Sprechblase. Vorher hatte jeder Sprecher seinen
         eigenen Wert (4 / 4.5 / 5 s) — zu kurz für ein Kind, das gerade
         lesen lernt, und für die Fernrohr-Texte von der Aussichtsplattform
         erst recht (#104). */
      const BLASE_DAUER = 12;

      /* Alle Sprecher öffnen die Blase hier — so entstehen der Schliessknopf
         und die Standzeit an einer Stelle statt an fünf. Der Klang bleibt
         beim Sprecher, er gehört zu ihm und nicht zur Blase. */
      function zeigeBlase(ziel, hoehe, inhalt) {
        bubbleTarget = ziel; bubbleH = hoehe;
        bubbleEl.innerHTML = inhalt +
          '<button type="button" class="blase-zu" aria-label="Zu">×</button>';
        bubbleEl.classList.add('show');
        bubbleUntil = clock.elapsedTime + BLASE_DAUER;
      }

      function verbergeBlase() {
        bubbleEl.classList.remove('show');
        bubbleUntil = 0;
      }

      /* Ein einziger Listener auf der Blase statt einer Verdrahtung pro
         Sprechen: der Knopf entsteht bei jedem zeigeBlase() durch innerHTML
         neu, ein direkt gesetzter onclick wäre danach jedes Mal weg. */
      bubbleEl.addEventListener('click', e => {
        if (e.target.closest('.blase-zu')) verbergeBlase();
      });
      ```

- [ ] **Step 5: Die fünf Sprecher auf `zeigeBlase()` umstellen.** Jeweils die
      vier Zeilen `bubbleTarget`/`bubbleH`/`innerHTML`/`classList.add` **und**
      die `bubbleUntil`-Zeile durch einen `zeigeBlase(...)`-Aufruf ersetzen.
      Klang, `buildingUntil` und `mokiWait` bleiben stehen.

      `tenantTalk` (`js/game.js:2002-2010`) — vorher:

      ```js
      function tenantTalk(i) {
        const t = tenantOf(i);
        bubbleTarget = tenantGroups[i]; bubbleH = 1.0;
        const status = state.fulfilled[i] ? 'ist glücklich und zufrieden!' : wishOpen(i) ? t.wtext : 'fühlt sich schon richtig wohl.';
        bubbleEl.innerHTML = `<img src="${animalThumbs[i] || ''}" alt=""><span><b>${t.name}</b><br>${status}</span>`;
        bubbleEl.classList.add('show');
        bubbleUntil = clock.elapsedTime + 4.5;
        sfx.pop();
      }
      ```

      nachher:

      ```js
      function tenantTalk(i) {
        const t = tenantOf(i);
        const status = state.fulfilled[i] ? 'ist glücklich und zufrieden!' : wishOpen(i) ? t.wtext : 'fühlt sich schon richtig wohl.';
        zeigeBlase(tenantGroups[i], 1.0,
          `<img src="${animalThumbs[i] || ''}" alt=""><span><b>${t.name}</b><br>${status}</span>`);
        sfx.pop();
      }
      ```

      `williTalk` (`js/game.js:2320-2327`) nachher:

      ```js
      function williTalk() {
        zeigeBlase(willi, 1.6,
          `<img src="${williThumb}" alt="Willi"><span>${PHRASES[phraseI++ % PHRASES.length]}</span>`);
        buildingUntil = clock.elapsedTime + 1.3;
        sfx.chime();
      }
      ```

      `damTalk` (`js/game.js:2334-2340`) nachher:

      ```js
      function damTalk() {
        zeigeBlase(dam, 1.4,
          `<img src="${damThumb}" alt="Biberburg"><span>${DAM_TEXTS[damI++ % DAM_TEXTS.length]}</span>`);
        sfx.splash();
      }
      ```

      `mokiTalk` (`js/game.js:2348-2354`) nachher — `mokiWait` wandert von 4
      auf `BLASE_DAUER`, sonst flitzt Móki nach vier Sekunden weiter und
      zieht die offene Blase quer über den Bildschirm:

      ```js
      function mokiTalk() {
        /* Móki bleibt stehen, solange seine Blase offen ist — die Blase hängt
           an ihm und würde sonst mitwandern (#104). */
        mokiWait = Math.max(mokiWait, BLASE_DAUER);
        zeigeBlase(moki, 1.1,
          `<img src="${mokiThumb}" alt="Móki"><span><b>Móki</b><br>${MOKI_TEXTS[mokiI2++ % MOKI_TEXTS.length]}</span>`);
        sfx.pop();
      }
      ```

      `erzaehle` (`js/game.js:2370-2376`) nachher:

      ```js
      function erzaehle(ziel, text, hoehe) {
        zeigeBlase(ziel, hoehe, `<span>${text}</span>`);
        sfx.pop();
      }
      ```

- [ ] **Step 6: Debug-Hook erweitern.** In `window.wipfelkratzer`
      (`js/game.js:2810-2841`), z. B. direkt vor `askSplashdown,
      SPLASHDOWN_URL };`, ergänzen:

      ```js
        /* Sprechblase für Playwright-Sonden (#104): die Sprecher direkt
           aufrufen spart die Kamerafahrt zur Aussichtsplattform. clock wird
           erst weiter unten angelegt (js/game.js:2909) — deshalb ein Getter,
           sonst greift das Objektliteral in die temporale Totzone. */
        BLASE_DAUER, zeigeBlase, verbergeBlase, erzaehle,
        williTalk, damTalk, mokiTalk, tenantTalk,
        get clock() { return clock; },
      ```

- [ ] **Step 7: Sonde läuft grün.**
      `python3 .superpowers/sdd/2026-09-27-tiertext-schliessen/t1_blase.py`
      endet mit `T1 OK`. Im Vordergrund, nie `run_in_background`.

- [ ] **Step 8: Committen.**

      ```bash
      git add index.html js/game.js
      git commit -m "fix(ui): Sprechblase mit Schliessknopf und längerer Standzeit

      Alle fünf Sprecher öffnen die Blase jetzt über zeigeBlase(); der
      Schliessknopf und die Standzeit entstehen dadurch an einer Stelle.
      BLASE_DAUER ersetzt die bisherigen 4/4.5/5 Sekunden durch 12.

      Refs #104"
      ```

---

### Task 2: Alle fünf Sprecher zeigen den × — und ohne Tipp bleibt die Blase zwölf Sekunden

Task 1 hat den Knopf an **einem** Sprecher (Willi) nachgewiesen. Diese
Aufgabe schliesst die Lücke: die vier anderen Pfade und das automatische
Ausblenden. Eigene Aufgabe, weil ein Prüfer Task 1 annehmen und hier trotzdem
einen vergessenen Sprecher zurückweisen kann.

**Files:**
- Test: `.superpowers/sdd/2026-09-27-tiertext-schliessen/t2_alle.py`
  (nicht committet)
- Modify (nur falls die Sonde etwas findet): `js/game.js`

**Interfaces:**
- Consumes: `BLASE_DAUER`, `zeigeBlase`, `verbergeBlase`, `erzaehle`,
  `williTalk`, `damTalk`, `mokiTalk`, `tenantTalk`, `get clock()` aus dem
  Debug-Hook von Task 1.
- Produces: nichts Neues — die Aufgabe ist ein Nachweis.

- [ ] **Step 1: Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-tiertext-schliessen/t2_alle.py` —
      Sondenkopf von oben wortgleich voranstellen, dann:

      ```python
      srv = starte()
      try:
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.goto(URL, wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)

              # Ein Stockwerk mit Bewohner, damit tenantTalk etwas zu sagen hat.
              # state.floors allein genügt nicht: die Gruppen entstehen seit #47
              # verzoegert (siehe Plan zur Aussichtsplattform).
              page.evaluate("""() => {
                const w = window.wipfelkratzer;
                w.state.floors = Math.max(w.state.floors, 1);
                w.floorGroup(1);
              }""")

              ergebnisse = {}
              for name in ["williTalk", "damTalk", "mokiTalk", "tenantTalk"]:
                  page.evaluate("() => window.wipfelkratzer.verbergeBlase()")
                  arg = "1" if name == "tenantTalk" else ""
                  page.evaluate(f"() => window.wipfelkratzer.{name}({arg})")
                  page.wait_for_selector("#bubble.show", timeout=10000)
                  ergebnisse[name] = page.evaluate(
                      "() => document.querySelectorAll('#bubble .blase-zu').length")

              # Fernrohr-Text: erzaehle direkt, ohne Besuchsmodus.
              page.evaluate("() => window.wipfelkratzer.verbergeBlase()")
              page.evaluate("""() => { const w = window.wipfelkratzer;
                w.erzaehle(w.aussicht, 'Probetext von der Plattform.', w.AUSSICHT_DECK + 1.2); }""")
              page.wait_for_selector("#bubble.show", timeout=10000)
              ergebnisse["erzaehle"] = page.evaluate(
                  "() => document.querySelectorAll('#bubble .blase-zu').length")

              # Standzeit: nach 6 s steht sie noch, nach BLASE_DAUER + Reserve
              # ist sie weg. Ausgeblendet wird in der Renderschleife, die
              # headless unter 1 fps läuft — deshalb wait_for_function statt
              # eines knappen sleep.
              start = page.evaluate("() => window.wipfelkratzer.clock.elapsedTime")
              page.wait_for_function(
                  f"() => window.wipfelkratzer.clock.elapsedTime - {start} > 6",
                  timeout=120000, polling=500)
              nach6 = page.evaluate(
                  "() => document.getElementById('bubble').classList.contains('show')")
              page.wait_for_function(
                  "() => !document.getElementById('bubble').classList.contains('show')",
                  timeout=120000, polling=500)
              weg = True
              b.close()

          print(json.dumps({"ergebnisse": ergebnisse, "nach6": nach6},
                           indent=2, ensure_ascii=False))
          for name, n in ergebnisse.items():
              assert n == 1, f"{name}: {n} Schliessknoepfe statt genau einem"
          assert nach6, "Die Blase war nach 6 Sekunden schon weg — BLASE_DAUER greift nicht"
          assert weg
          assert errs == [], errs
          print("T2 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Sonde laufen lassen.**
      `python3 .superpowers/sdd/2026-09-27-tiertext-schliessen/t2_alle.py`
      im Vordergrund, nie `run_in_background`. Erwartet: `T2 OK`.

      Schlägt sie fehl, ist in Task 1 Step 5 ein Sprecher übersehen worden —
      dann dort nachbessern und diese Sonde wiederholen, **nicht** die
      Zusicherungen aufweichen.

- [ ] **Step 3: Nur falls nachgebessert wurde, committen.**

      ```bash
      git add js/game.js
      git commit -m "fix(ui): vergessenen Sprecher auf zeigeBlase() umstellen

      Refs #104"
      ```

---

### Task 3: Changelog

**Files:**
- Modify: `CHANGELOG.md` — Abschnitt `## [Unreleased]` (Zeile 7)

**Interfaces:**
- Consumes: nichts.
- Produces: nichts — reine Dokumentation.

- [ ] **Step 1: Eintrag schreiben.** `## [Unreleased]` ist heute leer
      (`CHANGELOG.md:7`, direkt gefolgt von `## [0.11.1] - 2026-09-20`). Ein
      `### Changed` einziehen, in der Sprache der Spielenden — der Changelog
      dieses Spiels wird von dem gelesen, der spielt, nicht von dem, der das
      Repo liest:

      ```markdown
      ## [Unreleased]

      ### Changed

      - Sprechblasen bleiben jetzt zwölf Sekunden stehen statt nur vier bis
        fünf — Zeit genug zum Lesen. Und wenn Du fertig bist, tippst Du auf
        das × in der Blase, dann ist sie sofort weg. Das gilt überall: bei
        Willi, bei der Biberburg, bei Móki, bei den Tieren im Turm und bei
        den Texten, die Du von der Aussichtsplattform aus hörst (#104)
      ```

      **Niemals `git cliff -o CHANGELOG.md`** — das überschreibt die
      handgeschriebene Prosa aller früheren Versionen (siehe `CLAUDE.md`).

- [ ] **Step 2: Committen.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Sprechblase mit × und längerer Standzeit

      Refs #104"
      ```

---

## Selbstprüfung des Plans

**Spec-Abdeckung:**

| Spec-Abschnitt | Aufgabe |
|---|---|
| 1 — `zeigeBlase()`/`verbergeBlase()`, delegierter Listener | Task 1, Steps 4–5 |
| 2 — × fängt Tipps, Blase bleibt durchlässig, 44 px, `max-width` 320 px | Task 1, Step 3; Sonde T1 |
| 3 — `BLASE_DAUER = 12` für alle fünf | Task 1, Steps 4–5; Sonde T2 |
| 4 — Móki bleibt stehen | Task 1, Step 5 (`mokiTalk`) |
| Verifikation 1–3 | Sonde T1 |
| Verifikation 4–6 | Sonde T2 |
| Debug-Hook | Task 1, Step 6 |
| `CHANGELOG.md` | Task 3 |

**Platzhalter:** keine. Jeder Codeschritt zeigt den fertigen Code, jede Sonde
ihre Zusicherungen.

**Namenskonsistenz:** `zeigeBlase`, `verbergeBlase`, `BLASE_DAUER` und die
CSS-Klasse `blase-zu` heissen in Spec, Plan, Code und Sonden überall gleich;
`bubbleEl`, `bubbleTarget`, `bubbleH`, `bubbleUntil` und `clock` behalten ihre
vorhandenen Namen.

**Reihenfolge:** Task 2 hängt am Debug-Hook aus Task 1, Task 3 hängt an
nichts und könnte auch zuerst laufen.
