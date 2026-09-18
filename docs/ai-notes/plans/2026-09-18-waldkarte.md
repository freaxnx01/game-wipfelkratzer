# Plan — Waldkarte statt Turmliste (Issue #51)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** «Meine Türme» zeigt statt eines Kachelrasters eine gemalte Waldkarte:
vier Lichtungen für die vier Spielstände, dazu drei Orte — Schreinerei,
Wipfkea, Aussicht. Die Mechanik dahinter bleibt unverändert.

**Architecture:** Reine Darstellungsänderung an **einer** Funktion
(`renderStaende`, `js/game.js:2232-2260`), ihrem Markup (`index.html`,
Block `#staende`) und dessen CSS. `js/staende.js` und `js/standdatei.js`
werden nicht angefasst. Kein WebGL, keine zweite Szene, kein neuer
Netzzugriff — die Waldgrafik ist CSS plus ein SVG-`data:`-URI.

**Tech Stack:** Vanilla ES-Module, CSS Grid/Flexbox und absolute
Positionierung, SVG als `data:`-URI. Kein Build, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-18-waldkarte-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, **kein Test-Framework und keine Testdatei**.
- **`js/staende.js` und `js/standdatei.js` bleiben unverändert.** Wer dort
  etwas ändern will, hat den Zuschnitt verlassen.
- **Der Container behält seine `id`.** Siehe «Abweichung von der Spec» unten:
  `#stand-grid` wird **nicht** umbenannt.
- **Die Klassennamen der Karten bleiben**: `.standkarte`, `.stand-name`,
  `.stand-hin`, `.stand-save`, `.stand-save-zeile`, `.stand-save-mit`,
  `.stand-save-ohne`, `.stand-weg`, dazu `dataset.id` auf `.standkarte`.
  Jeder davon trägt einen bestehenden Handler.
- **Kein neuer Netzzugriff.** Die Waldgrafik ist CSS oder ein `data:`-URI;
  `index.html` lädt weiterhin nur `three` über die Importmap.
- **Touch first.** Jede Schaltfläche mindestens 44 px hoch, bei 400 px Breite
  bleibt alles erreichbar.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag geht unter `## [Unreleased]` → `### Added`, deutscher
  Fliesstext aus Spielersicht, Issue-Nummer in Klammern.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(welt)` bzw. `refactor(welt)`.

## Abweichung von der Spec — bitte lesen

Die Spec sagt, `#stand-grid` werde zu `#waldkarte`. **Das wird hier nicht
gemacht**, und der Grund ist handfest: an `$('stand-grid')` hängen **vier**
Ereignis-Handler (`js/game.js:2381`, `:2403`, `:2410`, `:2417`) — Sichern
auf-/zuklappen, Datei schreiben, Wechseln, Umbenennen, Löschen mit
Doppeltipp. Eine Umbenennung zöge alle vier nach sich, ohne dass sich an
ihrem Verhalten etwas ändern soll.

Der Container behält deshalb `id="stand-grid"` und bekommt zusätzlich die
Klasse `waldkarte`, die das neue Aussehen trägt. Die Handler bleiben
unberührt — das ist der Unterschied zwischen «Darstellung tauschen» und
«Dialog neu bauen».

## Verifikations-Harness

Wegwerf-Skripte unter `.superpowers/sdd/2026-09-18-waldkarte/`
(git-ignoriert). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9031–9035** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`
  (kein `pkill -f`, das Muster träfe den eigenen Aufruf).
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Erwartete Warnungen: `THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`,
  404 auf `favicon.png`. Nur auf `pageerror` prüfen.
- **Türme über die echte API anlegen, nicht den Index von Hand schreiben.**
  `staende.neuerStand(name)` hängt am Debug-Hook und legt Eintrag, Schlüssel
  und Fotoschlüssel so an, wie das Spiel es tut — eine von Hand gebaute
  `localStorage`-Struktur prüft am Ende die Sonde gegen sich selbst statt
  gegen das Spiel. Ein zweiter Turm entsteht also mit

  ```python
  page.evaluate("() => { window.wipfelkratzer.staende.neuerStand('Juliska'); }")
  page.reload(wait_until="networkidle")
  page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
  ```

  Nebeneffekt, der hier willkommen ist: der Scanner im Pre-Commit-Haken hält
  Schlüsselnamen wie `wipfelkratzer-stand-<id>` für API-Keys und blockiert
  einen Commit, der sie wörtlich enthält.
- Debug-Hook: `window.wipfelkratzer` liefert `staende`, `stand`, `state`,
  `renderStaende`. Dieser Plan ergänzt nichts daran.
- **Ein Turmwechsel lädt die Seite neu** (`js/game.js:2374`) — nach einem
  Klick auf «Weiterbauen» also `page.wait_for_load_state` und danach erneut
  auf `window.wipfelkratzer` warten.

---

### Task 1: Die Karte als Rahmen — vier Lichtungen

**Files:**
- Modify: `index.html` (CSS-Block bei `#staende`, `js/game.js:148-166` im
  `<style>`; Markup `#staende`)
- Modify: `js/game.js:2232-2260` (`renderStaende`)
- Test: `.superpowers/sdd/2026-09-18-waldkarte/t1_karte.py`

**Interfaces:**
- Produces: `#stand-grid` trägt zusätzlich die Klasse `waldkarte` und enthält
  vier Kinder mit der Klasse `.lichtung`; eine belegte Lichtung enthält
  unverändert ein `.standkarte`-Element mit `dataset.id`, eine leere ein
  `<button class="bauplatz">`.
- Consumes: `staende.ladeIndex()`, `staende.standInfo(e)`, `exportGroesse(e)`
  — alle unverändert.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-18-waldkarte/t1_karte.py`:

      ```python
      import json, socket, subprocess, sys, time
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9031, 9036)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"


      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.5)
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page(viewport={"width": 1280, "height": 900})
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.goto(URL, wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined",
                                     timeout=40000)
              if not page.evaluate("document.getElementById('tower-pick')"
                                   ".classList.contains('hidden')"):
                  page.click("#pick-10", timeout=20000)
              if page.locator("#btn-start").is_visible():
                  page.click("#btn-start", timeout=20000)
              page.wait_for_timeout(600)
              # Zwei Türme über die echte API — siehe Harness.
              page.evaluate("() => { const w = window.wipfelkratzer;"
                            " w.state.floors = 3; w.speichern();"
                            " w.staende.neuerStand('Juliska'); }")
              page.reload(wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
              if page.locator("#btn-start").is_visible():
                  page.click("#btn-start", timeout=20000)
              page.wait_for_timeout(600)
              page.evaluate("() => document.getElementById('btn-staende').click()")
              page.wait_for_timeout(900)
              res = page.evaluate("""() => ({
                karte: document.getElementById('stand-grid')
                         .classList.contains('waldkarte'),
                lichtungen: document.querySelectorAll('#stand-grid .lichtung').length,
                belegt: document.querySelectorAll('#stand-grid .standkarte').length,
                bauplaetze: document.querySelectorAll('#stand-grid .bauplatz').length,
                namen: [...document.querySelectorAll('#stand-grid .stand-name')]
                         .map(i => i.value),
                hier: !!document.querySelector('#stand-grid .stand-hier'),
                info: [...document.querySelectorAll('#stand-grid .stand-info')]
                        .map(d => d.textContent),
              })""")
              b.close()
          print(json.dumps(res, indent=2, ensure_ascii=False))
          assert res["karte"], "#stand-grid tragt die Klasse waldkarte nicht"
          assert res["lichtungen"] == 4, res["lichtungen"]
          assert res["belegt"] == 2, res["belegt"]
          assert res["bauplaetze"] == 2, res["bauplaetze"]
          assert res["namen"][-1] == "Juliska", res["namen"]
          assert res["hier"], "aktiver Turm ist nicht markiert"
          assert all("Stockwerke" in t for t in res["info"]), res["info"]
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-18-waldkarte/t1_karte.py` bricht mit
      `AssertionError: #stand-grid tragt die Klasse waldkarte nicht` ab. Rot
      gesehen zu haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: CSS für die Karte.** In `index.html` die bestehende Regel
      `#stand-grid { display: grid; … }` (`index.html:152`) **ersetzen**
      durch:

      ```css
      /* Waldkarte: vier feste Lichtungen plus drei Orte. Der Wald ist ein
         CSS-Verlauf mit ein paar SVG-Kronen als data:-URI — kein Netzzugriff,
         kein WebGL, keine zweite Szene. */
      #stand-grid.waldkarte { position: relative; aspect-ratio: 4 / 3; width: 100%;
        margin-bottom: 12px; border: 3px solid var(--woodL); border-radius: 12px;
        overflow: hidden;
        background:
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='%237fa663' opacity='.55'%3E%3Ccircle cx='20' cy='28' r='13'/%3E%3Ccircle cx='86' cy='16' r='10'/%3E%3Ccircle cx='58' cy='92' r='12'/%3E%3Ccircle cx='104' cy='74' r='9'/%3E%3C/g%3E%3C/svg%3E"),
          linear-gradient(160deg, #d9e7c4 0%, #c6dcae 55%, #b7d3a0 100%); }
      /* Der Bach zieht diagonal durch die Karte und trennt die Lichtungen. */
      #stand-grid.waldkarte::after { content: ''; position: absolute; inset: 0;
        background: linear-gradient(105deg, transparent 46%, #8fc7dd 46%, #8fc7dd 54%, transparent 54%);
        pointer-events: none; }
      /* z-index 1: ::after (der Bach) ist selbst positioniert und käme in der
         DOM-Reihenfolge zuletzt — ohne das läge das Wasserband über den
         Turmkarten statt darunter. */
      .lichtung { position: absolute; width: 38%; z-index: 1; }
      .lichtung:nth-child(1) { left: 4%;  top: 6%; }
      .lichtung:nth-child(2) { right: 4%; top: 6%; }
      .lichtung:nth-child(3) { left: 4%;  bottom: 6%; }
      .lichtung:nth-child(4) { right: 4%; bottom: 6%; }
      .bauplatz { width: 100%; min-height: 96px; border: 3px dashed var(--woodL);
        border-radius: 12px; background: rgba(255,249,236,.6); font: inherit;
        font-size: 14px; color: var(--ink); cursor: pointer; }
      ```

      Die bestehenden Regeln `.standkarte`, `.standkarte.aktiv`, `.stand-bild`,
      `.stand-name`, `.stand-info`, `.stand-hier` und `.standkarte button`
      (`index.html:153-164`) bleiben **unverändert** — sie beschreiben den
      Inhalt einer Lichtung, nicht ihre Anordnung.

- [ ] **Step 4: Schmalansicht.** Direkt darunter ergänzen — auf einem
      schmalen Gerät wird aus der Karte eine Spalte, sonst sind 38 % breite
      Lichtungen unlesbar:

      ```css
      @media (max-width: 560px) {
        #stand-grid.waldkarte { aspect-ratio: auto; display: flex;
          flex-direction: column; gap: 10px; padding: 10px; }
        #stand-grid.waldkarte::after { display: none; }
        .lichtung { position: static; width: 100%; }
      }
      ```

- [ ] **Step 5: `renderStaende` baut Lichtungen.** In `js/game.js` den Rumpf
      von `renderStaende` (`js/game.js:2232-2260`) ersetzen. Der innere
      `d.innerHTML`-Block der `.standkarte` bleibt **wörtlich wie er ist** —
      nur die Umhüllung ist neu:

      ```js
      function renderStaende() {
        const idx = staende.ladeIndex(), grid = $('stand-grid');
        grid.classList.add('waldkarte');
        grid.innerHTML = '';
        /* Vier Plätze, fest: MAX_STAENDE ist 4. Belegte tragen ihre Karte,
           freie einen Bauplatz — die Anordnung ist reine Darstellung, die
           Reihenfolge kommt weiter aus dem Index. */
        for (let i = 0; i < staende.MAX_STAENDE; i++) {
          const platz = document.createElement('div');
          platz.className = 'lichtung';
          const e = idx.staende[i];
          if (e) {
            const info = staende.standInfo(e), hier = e.id === idx.aktiv;
            const gr = exportGroesse(e);
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
                <button class="stand-save">Sichern</button>
                <button class="stand-weg danger">Löschen</button></div>
              <div class="stand-save-zeile hidden">
                <button class="stand-save-mit">Mit Fotos (${gr.mit})</button>
                <button class="stand-save-ohne">Ohne Fotos (${gr.ohne})</button>
              </div>`;
            platz.appendChild(d);
          } else {
            const b = document.createElement('button');
            b.className = 'bauplatz';
            b.textContent = 'Hier ist Platz für einen Turm';
            platz.appendChild(b);
          }
          grid.appendChild(platz);
        }
        const voll = idx.staende.length >= staende.MAX_STAENDE;
        $('btn-stand-neu').disabled = voll;
        $('stand-voll').classList.toggle('hidden', !voll);
      }
      ```

- [ ] **Step 6: Test grün.**
      `python3 .superpowers/sdd/2026-09-18-waldkarte/t1_karte.py` druckt
      `T1 OK`.

- [ ] **Step 7: Die bestehenden Handler funktionieren weiter.** Sonde
      `.superpowers/sdd/2026-09-18-waldkarte/t1b_handler.py` mit demselben
      Rahmen: Umbenennen (`.stand-name` füllen, `blur`, dann steht der neue
      Name im Index), «Sichern» klappt die Zeile auf, «Löschen» verlangt den
      zweiten Tipp (`textContent` wird zu `Wirklich löschen?`), und
      «Weiterbauen» auf dem zweiten Turm führt nach dem Neuladen zu
      `window.wipfelkratzer.stand.id === 's2'`. Kein Handler wurde angefasst —
      diese Sonde beweist es.

- [ ] **Step 8: Commit und Push.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(welt): «Meine Türme» als Waldkarte mit vier Lichtungen"
      git push
      ```

---

### Task 2: Der leere Bauplatz legt einen Turm an

**Files:**
- Modify: `js/game.js` — neuer Handler neben den bestehenden
  (`js/game.js:2381` ff.)
- Test: `.superpowers/sdd/2026-09-18-waldkarte/t2_bauplatz.py`

**Interfaces:**
- Consumes: `.bauplatz` aus Task 1, `staende.neuerStand()`, `wechsleZu(id)`.
- Produces: keine neuen Namen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-18-waldkarte/t2_bauplatz.py`, gleicher Rahmen
      wie T1 (zwei Türme im Index). Ablauf: Übersicht öffnen, ersten
      `.bauplatz` klicken, auf das Neuladen warten, dann prüfen:

      ```python
      page.click("#stand-grid .bauplatz", timeout=20000)
      page.wait_for_load_state("networkidle")
      page.wait_for_function("window.wipfelkratzer !== undefined", timeout=40000)
      res = page.evaluate("""() => {
        const w = window.wipfelkratzer;
        return { anzahl: w.staende.ladeIndex().staende.length,
                 aktiv: w.stand.id,
                 istNeu: !['s1','s2'].includes(w.stand.id) };
      }""")
      assert res["anzahl"] == 3, res
      assert res["istNeu"], res
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.** Der Klick tut nichts, die Seite lädt nicht
      neu, `anzahl` bleibt 2.

- [ ] **Step 3: Handler ergänzen.** Direkt **nach** dem bestehenden
      `$('btn-stand-neu').onclick`-Block (`js/game.js:2376-2380`) einfügen:

      ```js
      /* Ein leerer Bauplatz auf der Karte tut dasselbe wie «Neuer Turm» — der
         Knopf bleibt, weil er auf der Schmalansicht schneller zu treffen ist. */
      $('stand-grid').addEventListener('click', ev => {
        if (!ev.target.classList.contains('bauplatz')) return;
        $('btn-stand-neu').onclick();
      });
      ```

- [ ] **Step 4: Test grün.**
      `python3 .superpowers/sdd/2026-09-18-waldkarte/t2_bauplatz.py` druckt
      `T2 OK`.

- [ ] **Step 5: Bei vier Türmen gibt es keinen Bauplatz.** In derselben Sonde
      ergänzen: einen Index mit vier Türmen setzen, Übersicht öffnen, prüfen

      ```python
      assert page.evaluate("() => document.querySelectorAll('#stand-grid .bauplatz').length") == 0
      assert page.evaluate("() => !document.getElementById('stand-voll').classList.contains('hidden')")
      ```

- [ ] **Step 6: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(welt): leerer Bauplatz auf der Karte legt einen Turm an"
      git push
      ```

---

### Task 3: Die drei Orte — Schreinerei, Wipfkea, Aussicht

**Files:**
- Modify: `index.html` (Markup im Block `#staende`, CSS bei `.lichtung`)
- Modify: `js/game.js` (Handler neben den bestehenden)
- Test: `.superpowers/sdd/2026-09-18-waldkarte/t3_orte.py`

**Interfaces:**
- Consumes: `openWorkshop()` (`js/game.js:1010`), `CATALOG` und `thumbs` aus
  dem Katalog, `toast(text)`.
- Produces: drei Knöpfe `#ort-schreinerei`, `#ort-wipfkea`, `#ort-aussicht`
  im Markup von `#stand-grid`; ein Schaufenster-Dialog `#schaufenster`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-18-waldkarte/t3_orte.py`, gleicher Rahmen.
      Drei Fälle:

      ```python
      # Schreinerei öffnet die Werkstatt
      page.click("#ort-schreinerei", timeout=20000)
      page.wait_for_timeout(700)
      assert page.evaluate("() => document.getElementById('workshop').classList.contains('open')")
      vor = page.evaluate("() => window.wipfelkratzer.state.designs.length")
      page.click("#ws-ok", timeout=20000)
      page.wait_for_timeout(700)
      nach = page.evaluate("() => window.wipfelkratzer.state.designs.length")
      assert nach == vor + 1, (vor, nach)

      # Wipfkea zeigt die Serie, ohne Platzieren-Knopf
      page.click("#ort-wipfkea", timeout=20000)
      page.wait_for_timeout(700)
      res = page.evaluate("""() => ({
        offen: document.getElementById('schaufenster').classList.contains('open'),
        stueck: document.querySelectorAll('#schaufenster .item').length,
        platzieren: document.querySelectorAll('#schaufenster button.platzieren').length,
      })""")
      assert res["offen"] and res["stueck"] >= 4 and res["platzieren"] == 0, res

      # Aussicht sagt, dass sie noch nicht da ist
      page.click("#ort-aussicht", timeout=20000)
      page.wait_for_timeout(700)
      assert page.evaluate("() => [...document.querySelectorAll('#toast-stack .toast-item')]"
                           ".some(t => t.textContent.includes('Aussichtsplattform'))")
      ```

- [ ] **Step 2: Test läuft rot.** Es gibt keinen `#ort-schreinerei` — der
      erste `page.click` läuft in seinen Timeout.

- [ ] **Step 3: Die drei Orte entstehen in `renderStaende`, nicht im Markup.**
      `renderStaende` leert `#stand-grid` bei jedem Aufruf (`grid.innerHTML = ''`),
      fest ins Markup geschriebene Orte wären also nach dem ersten Rendern weg.
      Deshalb am Ende von `renderStaende` (Task 1, Step 5), **vor** der
      `voll`-Zeile, ergänzen:

      ```js
        /* Drei Orte neben den Lichtungen. Sie hängen im selben Container, aber
           ausserhalb jeder .standkarte — die bestehenden Handler steigen bei
           ihnen über ihr closest('.standkarte') von selbst aus. */
        [['ort-schreinerei', 'Schreinerei', 'schreinerei'],
         ['ort-wipfkea', 'Wipfkea', 'wipfkea'],
         ['ort-aussicht', 'Aussicht', 'aussicht']].forEach(([id, label, klasse]) => {
          const b = document.createElement('button');
          b.id = id; b.className = 'ort ' + klasse; b.textContent = label;
          grid.appendChild(b);
        });
      ```

- [ ] **Step 4: CSS der Orte.** In `index.html` neben `.lichtung` ergänzen:

      ```css
      .ort { position: absolute; z-index: 1; min-height: 44px; padding: 4px 14px; font: inherit;
        font-size: 14px; font-weight: 700; color: var(--ink); cursor: pointer;
        background: #fff9ec; border: 3px solid var(--woodL); border-radius: 999px; }
      .ort.schreinerei { right: 6%; top: 47%; }
      .ort.wipfkea     { left: 6%;  top: 47%; }
      .ort.aussicht    { left: 50%; top: 2%; transform: translateX(-50%); }
      @media (max-width: 560px) { .ort { position: static; transform: none; width: 100%; } }
      ```

- [ ] **Step 5: Schaufenster-Dialog im Markup.** In `index.html` neben den
      anderen Dialogen (z.B. nach `<div id="staende">…</div>`):

      ```html
      <div id="schaufenster">
        <div class="panel">
          <h2>Wipfkea</h2>
          <p class="hint">Diese Möbel stehen im Katalog bereit, wenn du eine Wohnung einrichtest.</p>
          <div id="schaufenster-items"></div>
          <button id="btn-schaufenster-zu" class="primary">Zu</button>
        </div>
      </div>
      ```

      dazu das CSS, dem der `#staende`-Dialog als Vorlage dient
      (`index.html:148-151`) — `z-index: 27`, damit es über der Übersicht
      (25) und über dem Toast-Stapel (26) liegt:

      ```css
      #schaufenster { position: fixed; inset: 0; z-index: 27; display: none; align-items: center; justify-content: center; background: rgba(60,40,20,.45); }
      #schaufenster.open { display: flex; }
      #schaufenster .panel { width: min(520px, 94vw); max-height: 88vh; overflow-y: auto; padding: 16px 20px; }
      #schaufenster h2 { margin: 0 0 6px; color: var(--wood); }
      #schaufenster-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin: 10px 0; }
      ```

- [ ] **Step 6: Handler der drei Orte.** In `js/game.js` neben den
      Bauplatz-Handler aus Task 2:

      ```js
      /* Die Werkstatt braucht keine Wohnung: openWorkshop baut an wsBuild und
         legt fertige Entwürfe in state.designs (js/game.js:1010). Von der
         Karte aus ist sie deshalb ein echter Ort, kein Schaufenster. */
      $('stand-grid').addEventListener('click', ev => {
        if (ev.target.id === 'ort-schreinerei') { openWorkshop(); return; }
        if (ev.target.id === 'ort-wipfkea') { zeigeSchaufenster(); return; }
        if (ev.target.id === 'ort-aussicht') {
          toast('Hier soll einmal eine Aussichtsplattform stehen — die gibt es noch nicht.');
        }
      });

      /* Schaufenster: die Wipfkea-Serie zum Anschauen. Platzieren braucht eine
         Wohnung und wäre von der Karte aus sinnlos — deshalb gibt es hier
         bewusst keinen Platzieren-Knopf. */
      function zeigeSchaufenster() {
        const wrap = $('schaufenster-items'); wrap.innerHTML = '';
        CATALOG.filter(it => it.id.startsWith('wk_')).forEach(it => {
          const d = document.createElement('div'); d.className = 'item';
          d.innerHTML = `<img src="${thumbs[it.id]}" alt=""><span>${it.name}</span>`;
          wrap.appendChild(d);
        });
        $('schaufenster').classList.add('open');
      }
      $('btn-schaufenster-zu').onclick = () => $('schaufenster').classList.remove('open');
      ```

      `wk_` ist das Präfix der Serie (`js/models.js:646-649`).

- [ ] **Step 7: Test grün.**
      `python3 .superpowers/sdd/2026-09-18-waldkarte/t3_orte.py` druckt
      `T3 OK`.

- [ ] **Step 8: Commit und Push.**

      ```bash
      git add index.html js/game.js
      git commit -m "feat(welt): Schreinerei, Wipfkea und Aussicht als Orte auf der Karte"
      git push
      ```

---

### Task 4: Abnahme, Schmalansicht und Changelog

**Files:**
- Modify: `CHANGELOG.md`
- Test: `.superpowers/sdd/2026-09-18-waldkarte/t4_abnahme.py`

**Interfaces:**
- Consumes: alles aus Task 1–3.

- [ ] **Step 1: Abnahme-Sonde schreiben.**
      `.superpowers/sdd/2026-09-18-waldkarte/t4_abnahme.py` prüft die
      Akzeptanzkriterien der Spec am Stück:

      1. Übersicht öffnen: vier `.lichtung`, davon zwei belegt, zwei
         `.bauplatz`; «Turm einlesen» (`#btn-stand-import`) und «Zu»
         (`#btn-standclose`) sind sichtbar und klickbar.
      2. `js/staende.js` und `js/standdatei.js` sind unverändert:
         `git diff --name-only origin/main...HEAD` nennt sie **nicht** — als
         `subprocess.run`-Prüfung im Skript, nicht von Hand.
      3. Schmalansicht: `page.set_viewport_size({"width": 400, "height": 800})`,
         danach hat jede Schaltfläche in `#staende` eine
         `bounding_box()["height"] >= 44` und `#stand-grid` scrollt nicht
         waagrecht (`scrollWidth <= clientWidth + 1`).
      4. Kein neuer Netzzugriff: `page.on("request", …)` sammelt alle
         Anfragen; nach dem Öffnen der Übersicht ist keine dabei, deren Host
         nicht `127.0.0.1` oder `unpkg.com` (die Importmap) ist.
      5. Konsole ohne `pageerror` über den ganzen Lauf.

- [ ] **Step 2: Sonde laufen lassen und rote Punkte beheben.** Jeder
      Fehlschlag ist ein Mangel in Task 1–3, keine Sondenschwäche. Bei drei
      erfolglosen Versuchen an derselben Stelle anhalten und den Befund in der
      PR-Beschreibung festhalten, statt weiter zu raten.

- [ ] **Step 3: Changelog-Eintrag.** Unter `## [Unreleased]` → `### Added`
      (Abschnitt anlegen, falls er fehlt):

      ```markdown
      - «Meine Türme» ist jetzt eine Waldkarte: Statt einer Liste siehst Du
        vier Lichtungen im Wald, auf jeder steht einer Deiner Türme — und wo
        noch keiner steht, wartet ein Bauplatz, den Du antippen kannst.
        Umbenennen, Sichern, Löschen und Weiterbauen gehen wie bisher. Dazu
        liegen drei Orte im Wald: in der Schreinerei baust Du eigene Möbel,
        auch ohne in einer Wohnung zu sein, bei «Wipfkea» siehst Du die ganze
        Möbelserie im Schaufenster, und wo später einmal die
        Aussichtsplattform steht, ist der Platz schon freigehalten (#51)
      ```

- [ ] **Step 4: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Waldkarte (#51)"
      git push
      ```

- [ ] **Step 5: PR-Beschreibung vervollständigen.** Vor/Nach-Ausgabe **jeder**
      Sonde einfügen, dazu `git diff --name-only` gegen `main`, und den
      **manuellen In-Browser-Playtest als offenen Posten** benennen — er ist
      das eigentliche Gate dieses Stacks und darf nicht als erledigt behauptet
      werden. Ebenfalls dort vermerken: die Karte wurde bei 400 px Breite
      geprüft, aber nicht auf einem echten Tablet.
