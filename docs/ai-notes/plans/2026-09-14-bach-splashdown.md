# Plan — Auf den Bach tippen startet Splashdown und kehrt zurück (Issue #46)

**Goal:** Ein Tipp auf das Wasser des Bachs öffnet eine Rückfrage; wird sie
bejaht, wird der Spielstand **synchron** geschrieben und die Seite wechselt zu
`https://github.freaxnx01.ch/game-splashdown/` — mit dem Rückweg als
Query-Parameter. Der Wipfelkratzer-Teil ist allein lauffähig; die
Splashdown-Seite des Rückwegs ist als Vertrag dokumentiert und gehört in ein
eigenes Issue im Repo `game-splashdown`.

**Architecture:** `ribbon()` (`js/game.js:87-99`) gibt sein Mesh bereits
zurück, der Wert wird heute nur verworfen (`js/game.js:99-101`). Das mittlere,
3.6 breite Wasserband wird festgehalten, bekommt `userData.type = 'bach'` und
wandert in die bestehende Trefferliste (`js/game.js:1023`) sowie als Zweig in
die bestehende Auswertungsschleife (`js/game.js:1024-1032`). Das entprellte
`save()` (`js/game.js:37-42`) bekommt einen zweiten, synchronen Einstieg
`saveNow()`, der denselben Rumpf benutzt; `pagehide` ruft ihn als Netz. Die
Rückfrage ist eine Tafel im Muster von `#residents`
(`index.html:208-214`, CSS `index.html:84-85, 117-118`). Die Navigation baut
die Rückweg-Adresse aus `new URL('.', location.href)`, damit keine Adresse
fest im Code steht.

**Spec:** `docs/ai-notes/specs/2026-09-14-bach-splashdown-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute, niemals `ae/oe/ue`.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein
  `package.json`, kein Test-Runner (`CLAUDE.md:508-516`).
- **`game-splashdown` wird in diesem Plan NICHT verändert.** Kein Commit, kein
  Branch, keine Datei in jenem Repo. Der Rückweg-Vertrag wird ausschliesslich
  hier dokumentiert.
- **`version.js` wird nicht angefasst**, und es entsteht **kein**
  `chore(release)`-Commit. Der Changelog-Eintrag geht unter
  `## [Unreleased]`.
- **Kein neuer `localStorage`-Schlüssel.** Die Ablage bleibt bei
  `wipfelkratzer-v1` (`js/game.js:36, 41, 896`) und `wipfelkratzer-fotos`
  (`js/game.js:1137-1138`).
- **Der `?zurueck`-Parameter wird nirgends ungeprüft in ein `href` gesetzt.**
  Im Wipfelkratzer wird er nur erzeugt, nie gelesen; die Prüfung auf gleiche
  Herkunft ist Teil des Splashdown-Vertrags.
- Bilderbuch-Look bleibt: bestehende `.panel`-Optik, keine neuen Farbwerte,
  keine neuen Schriften.

## Verification setup (gilt für alle Tasks)

- Wegwerf-Prüfskripte liegen unter
  `.superpowers/sdd/2026-09-14-bach-splashdown/` (bereits git-ignoriert,
  `.gitignore:5`) und werden **nicht** committet.
- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8986–8990** (für diese Issue-Sitzung reserviert, ersten freien
  nehmen). Danach gezielt über den Port beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  niemals `pkill -f` mit einem Muster, das den aufrufenden Befehl treffen
  kann.
- **Playwright-Läufe immer im Vordergrund, nie `run_in_background`**
  (`CLAUDE.md:550-552`). Nur der `http.server` darf in den Hintergrund.
- Chromium starten mit
  `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr.**
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`).
- Die echte Splashdown-Adresse darf in den Prüfungen **nicht** aufgerufen
  werden. Die Tests fangen die Navigation ab, indem sie
  `window.location.href` nicht folgen lassen: `page.route("**/game-splashdown/**",
  lambda r: r.fulfill(status=200, content_type="text/html", body="<h1>SPLASHDOWN-STUB</h1>"))`
  greift nur bei gleicher Herkunft — sicherer und ausreichend ist, den
  Zielaufruf über `window.__lastNav` abzufangen (siehe Task 3).

---

### Task 1: Trefferfläche für den Bach

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-bach-splashdown/t1_hit.py` (Wegwerf-Test)

**Interfaces:**
- `const river: THREE.Mesh` — das 3.6 breite Wasserband, mit
  `userData.type === 'bach'`.
- Die Trefferliste in `pointerup` (`js/game.js:1023`) enthält `river`.
- `window.wipfelkratzer` bekommt `river` und
  `pickAt(nx: number, ny: number) => string | null` — der `userData.type` des
  ersten Treffers an normalisierten Bildschirmkoordinaten, ohne dass eine
  Aktion ausgelöst wird.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-bach-splashdown/t1_hit.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8986
      URL = f"http://127.0.0.1:{PORT}/index.html"

      CHECK = """
      () => {
        const w = window.wipfelkratzer;
        const out = { errors: [] };
        if (!w.river) { out.errors.push('river fehlt'); return out; }
        if (!w.pickAt) { out.errors.push('pickAt fehlt'); return out; }
        out.riverType = w.river.userData.type;

        // Kamera so stellen, dass Bach, Ufer und Biberburg sicher im Bild sind.
        const THREE = w.river.parent ? null : null;
        w.camera.position.set(0, 26, 30);
        w.controls.target.set(-4, 0, 9);
        w.controls.update();
        w.camera.updateMatrixWorld(true);

        // Weltpunkt -> normalisierte Bildschirmkoordinaten.
        const at = (x, y, z) => {
          const v = new w.THREE.Vector3(x, y, z).project(w.camera);
          return [v.x, v.y];
        };
        const riverZ = x => 9 + Math.sin(x * 0.18) * 2.4;

        // 1. Mitten auf dem Wasser, weit weg von der Biberburg (die steht bei x=-7).
        out.water = w.pickAt(...at(4, 0.05, riverZ(4)));
        // 2. Sandufer: knapp ausserhalb des 3.6 breiten Bandes, innerhalb des 5.6 breiten.
        out.sand = w.pickAt(...at(4, 0.03, riverZ(4) + 2.3));
        // 3. Biberburg muss gewinnen, obwohl sie im Bach steht.
        out.dam = w.pickAt(...at(-7, 1.0, riverZ(-7) - 1.2));
        // 4. Wiese abseits des Bachs.
        out.grass = w.pickAt(...at(14, 0.02, -14));
        return out;
      }
      """

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.wait_for_timeout(800)
          res = page.evaluate(CHECK)
          b.close()

      print(json.dumps(res, indent=2, ensure_ascii=False))
      assert res.get("errors") == [], res["errors"]
      assert res["riverType"] == "bach", res
      assert res["water"] == "bach", ("Wasser nicht getroffen", res["water"])
      assert res["sand"] != "bach", ("Sandufer loest den Bach aus", res["sand"])
      assert res["dam"] == "dam", ("Biberburg verliert gegen den Bach", res["dam"])
      assert res["grass"] is None, ("Wiese liefert einen Treffer", res["grass"])
      assert errs == [], errs
      print("T1 OK")
      ```

      Server starten und laufen lassen:
      `python3 -m http.server 8986 >/dev/null 2>&1 &` (nur der Server darf in
      den Hintergrund — die Playwright-Läufe **nie**).

- [ ] **Step 2: Test läuft rot.**
      `python3 .superpowers/sdd/2026-09-14-bach-splashdown/t1_hit.py` bricht
      mit `['river fehlt']` ab.

- [ ] **Step 3: Das Wasserband festhalten und markieren**
      (`js/game.js:99-101`):

      ```js
      ribbon(5.6, 0.02, new THREE.MeshLambertMaterial({ color: 0xc9b083 }));
      /* Das breite Wasserband ist die Trefferfläche des Bachs (#46) — nicht
         das Sandufer darunter und nicht der helle Streifen darüber. Der helle
         Streifen liegt zwar höher, steht aber nicht in der Trefferliste und
         schirmt deshalb nichts ab. */
      const river = ribbon(3.6, 0.045, MAT.water);
      river.userData.type = 'bach';
      ribbon(1.5, 0.06, new THREE.MeshLambertMaterial({ color: 0x7fc4dd }));
      ```

- [ ] **Step 4: In die Trefferliste aufnehmen** (`js/game.js:1023`):

      ```js
      const hits = ray.intersectObjects([...hitboxes, sign, willi, dam, moki, river], true);
      ```

      und in der Schleife darunter (`js/game.js:1024-1032`), **nach** den
      bestehenden Zweigen für `sign`, `willi`, `dam` und `moki`:

      ```js
      if (u.type === 'bach') { askSplashdown(); return; }
      ```

      `askSplashdown()` entsteht in Task 3; für diesen Task genügt ein
      Platzhalter, der `toast('Bach angetippt')` ruft — er wird in Task 3
      ersetzt und darf **nicht** stehen bleiben.

- [ ] **Step 5: Prüfhaken ergänzen** (`js/game.js:1188`):

      ```js
      river, THREE,
      pickAt: (nx, ny) => {
        ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hs = ray.intersectObjects([...hitboxes, sign, willi, dam, moki, river], true);
        for (const h of hs) { let o = h.object; while (o && !(o.userData && o.userData.type)) o = o.parent;
          if (o) return o.userData.type; }
        return null;
      },
      ```

      `pickAt` benutzt exakt dieselbe Liste und dieselbe Auflösungsschleife
      wie der `pointerup`-Handler — sonst prüft der Test etwas anderes als das
      Spiel tut. Beide Vorkommen der Liste in **eine** Konstante
      `const PICKABLE = () => [...hitboxes, sign, willi, dam, moki, river];`
      zusammenziehen und an beiden Stellen aufrufen.

- [ ] **Step 6: Test läuft grün.** `python3 …/t1_hit.py` gibt `T1 OK` aus:
      Wasser liefert `bach`, Sandufer nicht, Biberburg liefert weiterhin
      `dam`, Wiese liefert `null`, null `pageerror`.

---

### Task 2: `saveNow()` — synchroner Spielstand vor jeder Navigation

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-bach-splashdown/t2_save.py` (Wegwerf-Test)

**Interfaces:**
- `function saveNow(): void` — schreibt `wipfelkratzer-v1` sofort und löscht
  einen anstehenden Debounce-Timer.
- `const save = () => …` bleibt in Signatur und Verhalten unverändert
  (300 ms entprellt), benutzt aber `saveNow` als Rumpf.
- `addEventListener('pagehide', saveNow)`.
- `window.wipfelkratzer` bekommt `saveNow`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.** Der Test weist zuerst nach,
      dass das heutige Verhalten **verliert**, und danach, dass `saveNow()`
      das behebt.
      `.superpowers/sdd/2026-09-14-bach-splashdown/t2_save.py`:

      ```python
      import json
      from playwright.sync_api import sync_playwright

      PORT = 8986
      URL = f"http://127.0.0.1:{PORT}/index.html"

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.clear()")
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.click("#btn-build", timeout=20000)
          page.wait_for_timeout(1500)

          # A: Änderung + sofort lesen -> der Debounce hat noch nicht geschrieben.
          before = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            w.enterEdit(0);
            w.state.nuts = 4242;          // steht stellvertretend für jede Änderung
            w.saveNowMissing = typeof w.saveNow !== 'function';
            return { missing: w.saveNowMissing };
          }""")
          assert not before["missing"], "saveNow fehlt"

          got = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            w.state.nuts = 4242;
            w.saveNow();
            return JSON.parse(localStorage.getItem('wipfelkratzer-v1')).nuts;
          }""")
          assert got == 4242, ("saveNow schreibt nicht sofort", got)

          # B: pagehide schreibt ebenfalls.
          page.evaluate("() => { window.wipfelkratzer.state.nuts = 777; }")
          page.evaluate("() => window.dispatchEvent(new PageTransitionEvent('pagehide'))")
          got2 = page.evaluate("() => JSON.parse(localStorage.getItem('wipfelkratzer-v1')).nuts")
          assert got2 == 777, ("pagehide schreibt nicht", got2)

          # C: save() bleibt entprellt und schreibt nach der Wartezeit.
          page.evaluate("() => { window.wipfelkratzer.state.nuts = 11; window.wipfelkratzer.save(); }")
          page.wait_for_timeout(600)
          got3 = page.evaluate("() => JSON.parse(localStorage.getItem('wipfelkratzer-v1')).nuts")
          assert got3 == 11, ("save() schreibt nicht mehr", got3)

          # D: Kein zusaetzlicher Schluessel.
          keys = page.evaluate("() => Object.keys(localStorage).sort()")
          b.close()

      print(json.dumps({"keys": keys}, indent=2))
      assert errs == [], errs
      assert set(keys) <= {"wipfelkratzer-v1", "wipfelkratzer-fotos"}, keys
      print("T2 OK")
      ```

- [ ] **Step 2: Test läuft rot.** `python3 …/t2_save.py` bricht mit
      `AssertionError: saveNow fehlt` ab.

- [ ] **Step 3: Den Speicherblock umbauen** (`js/game.js:37-42`). Der Rumpf
      wandert in `saveNow()`, `save()` wird zum Entpreller darum herum:

      ```js
      let saveT = 0;
      /* Schreibt den Spielstand SOFORT. save() entprellt um 300 ms — wer die
         Seite verlässt, verliert damit die letzte Änderung, weil der
         setTimeout mit dem Dokument stirbt. Vor jeder Navigation deshalb
         saveNow() (#46). */
      function saveNow() {
        clearTimeout(saveT); saveT = 0;
        try {
          const wallpaper = {};
          for (const k in state.wallpaper) { const wp = state.wallpaper[k]; if (wp && typeof wp === 'object' && Object.keys(wp).length) wallpaper[k] = wp; }
          localStorage.setItem('wipfelkratzer-v1', JSON.stringify({ ...state, wallpaper }));
        } catch (e) {}
      }
      const save = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); };
      /* Netz für alle übrigen Wege aus der Seite: Zurück-Taste, Tab schliessen,
         Wechsel in den bfcache. pagehide statt beforeunload — letzteres ist auf
         mobilen Browsern unzuverlässig und bfcache-feindlich. */
      addEventListener('pagehide', saveNow);
      ```

      Der `addEventListener` muss **nach** der Definition von `state` stehen
      (`js/game.js:35`) — er liegt im selben Block und ist damit korrekt
      platziert.

- [ ] **Step 4: Prüfhaken ergänzen** (`js/game.js:1188`): `saveNow, save,`.

- [ ] **Step 5: Test läuft grün.** `python3 …/t2_save.py` gibt `T2 OK` aus:
      `saveNow()` schreibt sofort, `pagehide` schreibt, `save()` bleibt
      entprellt und schreibt nach 600 ms, es existiert kein zusätzlicher
      Schlüssel, null `pageerror`.

---

### Task 3: Rückfrage-Tafel und Navigation mit Rückweg-Parameter

**Files:**
- `index.html`
- `js/game.js`
- `.superpowers/sdd/2026-09-14-bach-splashdown/t3_nav.py` (Wegwerf-Test)

**Interfaces:**
- Markup `#splash-ask` mit `.panel`, zwei Knöpfen `#btn-splash-go` und
  `#btn-splash-stay`; Öffnen/Schliessen über die Klasse `open`, genau wie
  `#residents` (`index.html:208-214`, CSS `index.html:84-85, 117-118`).
- `function askSplashdown(): void` — öffnet die Tafel.
- `function gotoSplashdown(): void` — `saveNow()`, `sfx.splash()`, Navigation.
- `const SPLASHDOWN_URL = 'https://github.freaxnx01.ch/game-splashdown/'`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-bach-splashdown/t3_nav.py`:

      ```python
      import json
      from urllib.parse import urlparse, parse_qs
      from playwright.sync_api import sync_playwright

      PORT = 8986
      URL = f"http://127.0.0.1:{PORT}/index.html"

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page()
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.clear()")
          # Die echte Splashdown-Adresse wird nie geladen: der Aufruf wird
          # abgefangen und durch eine Stub-Seite beantwortet.
          page.route("**://github.freaxnx01.ch/**", lambda r: r.fulfill(
              status=200, content_type="text/html", body="<h1>SPLASHDOWN-STUB</h1>"))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.click("#btn-build", timeout=20000)
          page.wait_for_timeout(1500)

          # Tafel öffnen über denselben Weg wie ein Tipp auf den Bach.
          page.evaluate("() => window.wipfelkratzer.askSplashdown()")
          page.wait_for_timeout(200)
          open_state = page.evaluate("""() => ({
            open: document.getElementById('splash-ask').classList.contains('open'),
            text: document.getElementById('splash-ask').textContent,
          })""")
          assert open_state["open"], "Tafel oeffnet nicht"
          assert "Splashdown" in open_state["text"], open_state["text"]
          assert "gespeichert" in open_state["text"], open_state["text"]

          # "Lieber hier bleiben" schliesst und navigiert nicht.
          page.click("#btn-splash-stay", timeout=20000)
          page.wait_for_timeout(200)
          assert not page.evaluate(
              "() => document.getElementById('splash-ask').classList.contains('open')"
          ), "Tafel bleibt offen"
          assert page.url.startswith(f"http://127.0.0.1:{PORT}"), page.url

          # Änderung + sofort "Ja, rutschen!" -> darf NICHT verloren gehen.
          page.evaluate("() => { window.wipfelkratzer.state.nuts = 1234; window.wipfelkratzer.save(); }")
          page.evaluate("() => window.wipfelkratzer.askSplashdown()")
          page.wait_for_timeout(150)
          page.click("#btn-splash-go", timeout=20000)
          page.wait_for_load_state("load")
          target = page.url
          stored = page.evaluate("() => localStorage.getItem('wipfelkratzer-v1')")
          b.close()

      print(target)
      q = parse_qs(urlparse(target).query)
      assert urlparse(target).netloc == "github.freaxnx01.ch", target
      assert urlparse(target).path == "/game-splashdown/", target
      assert q.get("zurueck"), q
      assert q["zurueck"][0].startswith(f"http://127.0.0.1:{PORT}"), q["zurueck"]
      assert q.get("zurueck-name") == ["Wipfelkratzer"], q
      assert json.loads(stored)["nuts"] == 1234, ("Spielstand verloren", stored)
      assert errs == [], errs
      print("T3 OK")
      ```

      Der `localStorage` bleibt beim Stub erhalten, weil der Stub unter einer
      **anderen** Herkunft liegt — deshalb liest der Test den Spielstand über
      die Stub-Seite hinweg nicht direkt; falls das in der Praxis scheitert,
      stattdessen vor dem Klick `page.evaluate` auf
      `localStorage.getItem(...)` ausführen und danach nur noch die Ziel-URL
      prüfen. Die Reihenfolge im Skript oben ist so gewählt, dass zuerst die
      Navigation und erst dann der Speicherinhalt gelesen wird — schlägt das
      fehl, den Lesevorgang vor den Klick ziehen und den Klick als letzten
      Schritt belassen; **nicht** den Produktivcode an den Test anpassen.

- [ ] **Step 2: Test läuft rot.** `python3 …/t3_nav.py` bricht ab, weil
      `window.wipfelkratzer.askSplashdown` nicht existiert bzw.
      `#splash-ask` fehlt.

- [ ] **Step 3: Markup ergänzen.** In `index.html` direkt nach dem Block
      `#residents` (`index.html:208-214`):

      ```html
      <div id="splash-ask">
        <div class="panel">
          <h2>Zum Bach hinunter?</h2>
          <p>Du kommst zu &laquo;Splashdown!&raquo; &mdash; dem Wasserrutschen-Rennen.</p>
          <p>Dein Wipfelkratzer bleibt gespeichert und wartet auf Dich.</p>
          <button id="btn-splash-go" class="primary">Ja, rutschen!</button>
          <button id="btn-splash-stay">Lieber hier bleiben</button>
        </div>
      </div>
      ```

      und beim CSS von `#residents` (`index.html:84-85, 117-118`) die
      Selektoren um `#splash-ask` erweitern, statt neue Regeln zu erfinden:

      ```css
      #residents, #splash-ask { position: fixed; inset: 0; z-index: 10; display: none; align-items: center; justify-content: center; background: rgba(60,40,20,.35); }
      #residents.open, #splash-ask.open { display: flex; }
      #residents .panel, #splash-ask .panel { width: min(420px, 92vw); max-height: 84vh; overflow-y: auto; padding: 16px 20px; }
      #residents h2, #splash-ask h2 { margin: 0 0 8px; color: var(--wood); }
      ```

- [ ] **Step 4: Die Tafel verdrahten** (`js/game.js`, bei den übrigen
      Dialog-Handlern in der Nähe von `#btn-resclose`):

      ```js
      /* --- Bach -> Splashdown (#46) -------------------------------------
         Splashdown ist ein eigenes Spiel unter derselben Domain in einem
         anderen Pfad. Der Rückweg wird als Query-Parameter mitgegeben;
         Splashdown darf ihn heute noch ignorieren — dann führt der Rückweg
         über die Zurück-Taste und den «More Games…»-Link. */
      const SPLASHDOWN_URL = 'https://github.freaxnx01.ch/game-splashdown/';
      function askSplashdown() { $('splash-ask').classList.add('open'); sfx.pop(); }
      function gotoSplashdown() {
        saveNow();                                   /* NICHT save() — das ist entprellt */
        sfx.splash();
        const back = new URL('.', location.href).href;
        location.href = SPLASHDOWN_URL + '?zurueck=' + encodeURIComponent(back)
          + '&zurueck-name=' + encodeURIComponent('Wipfelkratzer');
      }
      $('btn-splash-go').onclick = gotoSplashdown;
      $('btn-splash-stay').onclick = () => { $('splash-ask').classList.remove('open'); sfx.pop(); };
      $('splash-ask').onclick = e => { if (e.target === $('splash-ask')) $('splash-ask').classList.remove('open'); };
      ```

      Das Muster «Klick auf den Hintergrund schliesst» ist bereits im Spiel
      (`js/game.js`, `$('gallery').onclick`).

- [ ] **Step 5: Platzhalter aus Task 1 ersetzen.** Der Zweig in der
      Trefferschleife ruft jetzt die echte Funktion:
      `if (u.type === 'bach') { askSplashdown(); return; }` — der
      `toast('Bach angetippt')` aus Task 1 Step 4 ist zu entfernen. Mit
      `grep -n "Bach angetippt" js/game.js` gegenprüfen, dass nichts
      übrigbleibt.

- [ ] **Step 6: Prüfhaken ergänzen** (`js/game.js:1188`):
      `askSplashdown, SPLASHDOWN_URL,`.

- [ ] **Step 7: Test läuft grün.** `python3 …/t3_nav.py` gibt `T3 OK` aus:
      Tafel öffnet mit dem erwarteten Text, «Lieber hier bleiben» schliesst
      ohne Navigation, «Ja, rutschen!» führt auf
      `github.freaxnx01.ch/game-splashdown/` mit `zurueck` und `zurueck-name`,
      und die letzte Änderung steht im Spielstand, null `pageerror`.

---

### Task 4: Rückweg-Vertrag festhalten, Gesamtdurchlauf, Changelog

**Files:**
- `docs/ai-notes/specs/2026-09-14-bach-splashdown-design.md` (nur der
  Abschnitt «Abhängigkeit», falls beim Umsetzen präzisiert)
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-bach-splashdown/t4_e2e.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Gesamtdurchlauf über die echte Oberfläche schreiben.**
      `.superpowers/sdd/2026-09-14-bach-splashdown/t4_e2e.py` — der Tipp
      erfolgt als echter Zeigerdruck auf die Leinwand, nicht über den
      Debug-Haken:

      ```python
      import json
      from urllib.parse import urlparse, parse_qs
      from playwright.sync_api import sync_playwright

      PORT = 8986
      URL = f"http://127.0.0.1:{PORT}/index.html"

      with sync_playwright() as p:
          b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
          page = b.new_page(viewport={"width": 1000, "height": 700})
          errs = []
          page.on("pageerror", lambda e: errs.append(str(e)))
          page.add_init_script("localStorage.clear()")
          page.route("**://github.freaxnx01.ch/**", lambda r: r.fulfill(
              status=200, content_type="text/html", body="<h1>SPLASHDOWN-STUB</h1>"))
          page.goto(URL, wait_until="networkidle")
          page.click("#btn-start", timeout=20000)
          page.click("#btn-build", timeout=20000)
          page.wait_for_timeout(1500)

          # Kamera so stellen, dass ein Punkt des Bachs sicher im Bild liegt,
          # und die Bildschirmkoordinaten dieses Punkts ausrechnen.
          pt = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            w.camera.position.set(0, 26, 30);
            w.controls.target.set(4, 0, 9);
            w.controls.update(); w.camera.updateMatrixWorld(true);
            const riverZ = x => 9 + Math.sin(x * 0.18) * 2.4;
            const v = new w.THREE.Vector3(4, 0.05, riverZ(4)).project(w.camera);
            return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight,
                     type: w.pickAt(v.x, v.y) };
          }""")
          assert pt["type"] == "bach", pt

          # Im Einrichten-Modus darf der Tipp NICHT greifen.
          page.evaluate("() => window.wipfelkratzer.enterEdit(0)")
          page.wait_for_timeout(300)
          page.mouse.click(pt["x"], pt["y"])
          page.wait_for_timeout(300)
          assert not page.evaluate(
              "() => document.getElementById('splash-ask').classList.contains('open')"
          ), "Tafel öffnet im Einrichten-Modus"
          page.evaluate("() => window.wipfelkratzer.exitEdit()")
          page.wait_for_timeout(600)

          # Echter Tipp auf den Bach.
          pt = page.evaluate("""() => {
            const w = window.wipfelkratzer;
            w.camera.position.set(0, 26, 30);
            w.controls.target.set(4, 0, 9);
            w.controls.update(); w.camera.updateMatrixWorld(true);
            const riverZ = x => 9 + Math.sin(x * 0.18) * 2.4;
            const v = new w.THREE.Vector3(4, 0.05, riverZ(4)).project(w.camera);
            return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
          }""")
          page.mouse.click(pt["x"], pt["y"])
          page.wait_for_timeout(400)
          assert page.evaluate(
              "() => document.getElementById('splash-ask').classList.contains('open')"
          ), "Tipp auf den Bach öffnet die Tafel nicht"

          keys_before = page.evaluate("() => Object.keys(localStorage).sort()")
          page.click("#btn-splash-go", timeout=20000)
          page.wait_for_load_state("load")
          target = page.url
          b.close()

      print(json.dumps({"ziel": target, "keys": keys_before}, indent=2))
      q = parse_qs(urlparse(target).query)
      assert urlparse(target).path == "/game-splashdown/", target
      assert q.get("zurueck"), q
      assert set(keys_before) <= {"wipfelkratzer-v1", "wipfelkratzer-fotos"}, keys_before
      assert errs == [], errs
      print("T4 OK")
      ```

- [ ] **Step 2: Durchlauf grün.** `python3 …/t4_e2e.py` gibt `T4 OK` aus.

- [ ] **Step 3: Von Hand nachsehen.** `index.html` im Browser öffnen, auf das
      Wasser tippen, die Tafel lesen, «Lieber hier bleiben» prüfen, dann
      «Ja, rutschen!» und **tatsächlich** bei
      `https://github.freaxnx01.ch/game-splashdown/?zurueck=…` landen. Dort
      prüfen: Splashdown startet normal und ignoriert die Parameter
      (kein Fehler in der Konsole); der Rückweg über die Zurück-Taste und über
      «More Games…» (`game-splashdown/index.html:893`) funktioniert; nach der
      Rückkehr steht der Turm vollständig da.

- [ ] **Step 4: Das Splashdown-Issue vorbereiten — als Text, nicht als
      Aktion.** Der Abschnitt «Abhängigkeit» im Spec
      (`docs/ai-notes/specs/2026-09-14-bach-splashdown-design.md`) enthält den
      fertigen Issue-Text für `freaxnx01/game-splashdown`. Beim Umsetzen
      prüfen, ob die dort genannten Zeilenangaben
      (`game-splashdown/index.html:890-896`) noch stimmen, und sie
      gegebenenfalls berichtigen. **Kein `gh issue create`, kein Commit in
      `game-splashdown`** — das Anlegen des Issues ist eine Entscheidung des
      Menschen.

- [ ] **Step 5: Changelog.** In `CHANGELOG.md` unter `## [Unreleased]` /
      `### Added` ergänzen (Abschnitt anlegen, falls noch nicht vorhanden) —
      deutscher Fliesstext im Stil der bestehenden Einträge, Issue-Nummer in
      Klammern:

      ```markdown
      - Der Bach war bisher blosse Kulisse. Ein Tipp auf das Wasser fragt jetzt
        nach, ob es zu &laquo;Splashdown!&raquo; gehen soll — dem
        Wasserrutschen-Rennen nebenan. Vor dem Wechsel wird der Wipfelkratzer
        sofort gespeichert statt wie bisher erst nach einer kurzen Verzögerung,
        damit auch die allerletzte Änderung erhalten bleibt; nach der Rückkehr
        steht der Turm unverändert da (#46)
      ```

- [ ] **Step 6: Release-Regeln einhalten.** `version.js` bleibt unverändert
      (`version.js:3` weiterhin `0.5.0`), kein `chore(release)`-Commit, kein
      Tag. Mit `git diff --stat` prüfen, dass nur `index.html`, `js/game.js`
      und `CHANGELOG.md` im Diff stehen; mit
      `git -C ../game-splashdown status --porcelain` prüfen, dass das
      Nachbarrepo **unberührt** ist.

- [ ] **Step 7: Server beenden.**
      `ss -lptn 'sport = :8986' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.

---

Wenn Du bei der Umsetzung auf Blocker stösst, löse sie und schreibe die Lösung
in diesen Plan bzw. den Spec zurück, damit der nächste Durchlauf sie nicht neu
herleiten muss.
