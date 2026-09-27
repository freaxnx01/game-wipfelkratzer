# Plan — Klick-Animationen für Objekte, Klang für Klavier und Flöte (Issue #93)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Tipp auf ein bereits ausgewähltes Objekt bewegt es — Schaukelstuhl,
Klavier, Blockflöte, Harfe, Schlagzeug, Ball, Kuscheltier und Pflanze —, und
Klavier wie Blockflöte geben dabei einen gerechneten Ton.

**Architecture:** Die Registry `ACTIONS` (`js/game.js:775-779`) bekommt einen
zweiten Eintragstyp: statt `apply` (schaltbarer Zustand) trägt ein Eintrag
`play` — eine Schrittfunktion `(mesh, q) => void`, die `tween`
(`js/game.js:1103-1104`) von 0 nach 1 durchfährt. Die Schrittfunktionen kommen
aus fünf **Bewegungsbausteinen** (`ANIM`), sind also Daten und kein Code pro
Objekt. `toggleAction()` (`js/game.js:1470-1486`) wird zu `spieleAktion(pick)`
verallgemeinert, sodass der Knopf `#btn-action` und der neue Tipp-Zweig im
Pointer-Handler (`js/game.js:2043-2057`) denselben Pfad nehmen. Nur zwei
Modelle brauchen einen neuen `userData`-Griff (`schaukelstuhl`, `klavier`),
sechs Objekte sind reine Registry-Zeilen.

**Tech Stack:** Vanilla ES-Module, three.js r184 über Importmap
(`index.html:13-16`), Web Audio API (`tone()`/`noiseBurst()`,
`js/game.js:1947-1966`). Kein Build, kein Bundler, kein Test-Runner.

**Spec:** `docs/ai-notes/specs/2026-09-27-klick-animationen-design.md`

## Global Constraints

- **Deutsche Oberfläche und deutsche Kommentare.** Schweizer Schreibweise
  (`ss`, nie `ß`), echte Umlaute (`ä ö ü`), niemals `ae oe ue`.
- **Buildless.** Keine neue Abhängigkeit, kein Bundler, kein `package.json`,
  **kein Test-Framework und keine Testdatei im Repo**. Das ist eine
  Stack-Regel (`CLAUDE.md`, „Tooling & Testing“), kein Versehen.
- **Keine Audiodatei, keine externe Adresse.** Jeder neue Klang wird aus
  `tone()` und `noiseBurst()` gerechnet, genau wie die neun bestehenden
  Effekte (`js/game.js:1974-2003`). Nichts unter `assets/`, nichts von einem
  CDN.
- **Eine Klick-Animation schreibt nie in den Spielstand.** Sie verändert
  ausschliesslich `mesh.rotation.x/z`, `mesh.position.y` und `mesh.scale.y`
  und stellt bei `q === 1` exakt die Ruhelage wieder her. Kein `save()`, kein
  Feld am `entry`.
- **`mesh.rotation.y` ist tabu** — sie trägt `en.rot` aus dem Platzieren
  (`replaceMesh`, `js/game.js:706-714`).
- **Die Katalog-Vorschaubilder entstehen aus denselben Modellen**
  (`snapshot(makeFurniture(...))`, `js/game.js:936`). Neue Untergruppen in
  `js/models.js` müssen die Ruhelage pixelgleich lassen.
- **Kein neues Modul.** Registry, Bausteine und Handler brauchen `tween`,
  `selected`, `sfx`, `ACTIONS` — alles Modulinterna von `js/game.js`.
- **`version.js` wird nicht angefasst**, es gibt **keinen
  `chore(release)`-Commit**. Der Changelog-Eintrag geht unter
  `## [Unreleased]` → `### Added`, deutscher Fliesstext aus Spielersicht, mit
  `(#93)` am Ende — im Stil der bestehenden Einträge.
- **Verifikation ist headless Playwright im Vordergrund, nie
  `run_in_background`.** Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach.
- Conventional Commits, Präfix `feat(objekte)` bzw. `refactor(objekte)`.

## Dateien im Überblick

| Datei | Verantwortung | Tasks |
|---|---|---|
| `js/game.js` | `ANIM`-Bausteine, `ACTIONS`-Einträge, `spieleAktion`, Tipp-Zweig, neue `sfx`-Effekte, Debug-Hook | 1–6 |
| `js/models.js` | Zwei neue `userData`-Griffe: `wippe` (Schaukelstuhl), `tasten` (Klavier) | 3 |
| `CHANGELOG.md` | Spielerfacing-Eintrag unter `[Unreleased]` | 7 |

## Verifikations-Harness

Wegwerf-Sonden unter `.superpowers/sdd/2026-09-27-klick-animationen/`
(git-ignoriert, `.gitignore:5`). Sie werden **nicht** committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **9031–9035** (erster freier). Nur der Server darf in den Hintergrund —
  die Playwright-Läufe **nie**. Danach gezielt beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`
  (kein `pkill -f`, das Muster träfe den eigenen Aufruf).
- Chromium mit `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen. Die
  THREE-Warnungen zu `Clock` und `PCFSoftShadowMap` sind ebenfalls erwartet.
- **Spielstand vor dem Laden setzen** (`page.add_init_script` auf
  `localStorage['wipfelkratzer-v1']`) ist viel schneller als der Aufbau über
  die Oberfläche.
- **Animationsende abwarten heisst `tweenCount() === 0` pollen**
  (`js/game.js:2817`), nicht auf eine Bildrate wetten. Der headless Renderer
  zeichnet unter 1 fps, eine 2.4-s-Animation dauert dort **deutlich länger** —
  `page.wait_for_function("window.wipfelkratzer.tweenCount() === 0",
  timeout=180000)`.
- **Bildschirmkoordinaten eines Objekts** kommen aus der Szene, nicht geraten:
  `mesh.getWorldPosition(v).project(camera)` → `(v.x+1)/2*breite`,
  `(-v.y+1)/2*höhe`.
- **Klang wird über einen Ersatz gezählt, nicht gehört.** Die Registry ruft
  `sfx.klavier()` als Eigenschaftssuche zur Laufzeit; eine Sonde ersetzt
  `window.wipfelkratzer.sfx.klavier` durch einen Zähler und liest ihn danach
  aus. Dafür muss `sfx` im Debug-Hook liegen (Task 1).

Dieser Rahmen ist in jeder Sonde gleich und wird in Task 1 einmal ausgeschrieben;
spätere Tasks verweisen darauf und zeigen nur ihre eigenen Prüfungen.

---

### Task 1: Bewegungsbausteine `ANIM` und Debug-Zugang

Die Bausteine zuerst, allein und ohne Anschluss an die Registry: sie sind reine
Funktionen und damit das Einzige in dieser Änderung, was sich ohne Szene prüfen
lässt.

**Files:**
- Modify: `js/game.js` — neuer Abschnitt direkt **vor** `const ACTIONS`
  (`js/game.js:775`)
- Modify: `js/game.js:2810-2828` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-27-klick-animationen/t1_anim.py`

**Interfaces:**
- Produces: `ANIM.wippen(achse, winkel, schwingungen?) → (mesh, q) => void`
- Produces: `ANIM.huepfen(hoehe, spruenge?) → (mesh, q) => void`
- Produces: `ANIM.stauchen(tiefe) → (mesh, q) => void`
- Produces: `ANIM.reihum(griff, tiefe) → (mesh, q) => void`
- Produces: `ANIM.zusammen(...schritte) → (mesh, q) => void`
- Produces: im Debug-Hook zusätzlich `ANIM` und `sfx`.

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-klick-animationen/t1_anim.py` — das ist der
      Rahmen, den alle folgenden Sonden wiederverwenden:

      ```python
      import socket, subprocess, sys, time, json
      from pathlib import Path
      from playwright.sync_api import sync_playwright

      ROOT = Path(__file__).resolve().parents[3]
      PORT = next(p for p in range(9031, 9036)
                  if socket.socket().connect_ex(("127.0.0.1", p)) != 0)
      URL = f"http://127.0.0.1:{PORT}/index.html"

      SAVE = json.dumps({"floors": 1, "maxFloors": 10, "nuts": 99,
                         "rooms": {"1": []}, "fulfilled": {}, "wallpaper": {},
                         "flooring": {}, "tenantPos": {}, "designs": []})

      CHECK = """
      () => {
        const w = window.wipfelkratzer;
        if (!w.ANIM) return { fehlt: 'ANIM' };
        if (!w.sfx) return { fehlt: 'sfx' };
        /* Ein Wegwerf-Mesh, damit die Bausteine ohne Szene prüfbar sind. */
        const m = new w.THREE.Object3D();
        m.position.y = 2;
        const wippen = w.ANIM.wippen('z', 0.2, 3);
        const huepfen = w.ANIM.huepfen(0.5, 3);
        const stauchen = w.ANIM.stauchen(0.1);
        let maxWinkel = 0, maxHoehe = 0, minScale = 1;
        for (let i = 0; i <= 20; i++) {
          const q = i / 20;
          wippen(m, q); huepfen(m, q); stauchen(m, q);
          maxWinkel = Math.max(maxWinkel, Math.abs(m.rotation.z));
          maxHoehe = Math.max(maxHoehe, m.position.y - 2);
          minScale = Math.min(minScale, m.scale.y);
        }
        return { maxWinkel, maxHoehe, minScale,
                 endWinkel: m.rotation.z, endHoehe: m.position.y,
                 endScale: m.scale.y,
                 bausteine: Object.keys(w.ANIM).sort() };
      }
      """

      srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                             cwd=ROOT, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
      try:
          time.sleep(1.5)
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader",
                                          "--enable-unsafe-swiftshader"])
              page = b.new_page()
              errs = []
              page.on("pageerror", lambda e: errs.append(str(e)))
              page.add_init_script(
                  f"localStorage.setItem('wipfelkratzer-v1', {SAVE!r})")
              page.goto(URL, wait_until="networkidle")
              page.wait_for_function("window.wipfelkratzer !== undefined",
                                     timeout=30000)
              res = page.evaluate(CHECK)
              b.close()
          print(json.dumps(res, indent=2))
          assert not res.get("fehlt"), f"Debug-Hook fehlt: {res.get('fehlt')}"
          assert res["bausteine"] == ["huepfen", "reihum", "stauchen",
                                      "wippen", "zusammen"], res["bausteine"]
          assert res["maxWinkel"] > 0.1, "wippen lenkt nicht aus"
          assert res["maxHoehe"] > 0.2, "huepfen hebt nicht"
          assert res["minScale"] < 0.95, "stauchen drückt nicht"
          assert abs(res["endWinkel"]) < 1e-9, res["endWinkel"]
          assert abs(res["endHoehe"] - 2) < 1e-9, res["endHoehe"]
          assert abs(res["endScale"] - 1) < 1e-9, res["endScale"]
          assert errs == [], errs
          print("T1 OK")
      finally:
          srv.terminate()
      ```

- [ ] **Step 2: Sonde läuft rot.**
      `python3 .superpowers/sdd/2026-09-27-klick-animationen/t1_anim.py`
      bricht mit `AssertionError: Debug-Hook fehlt: ANIM` ab. Rot gesehen zu
      haben ist die Voraussetzung für Step 3.

- [ ] **Step 3: `ANIM` einfügen.** Direkt vor `const ACTIONS`
      (`js/game.js:775`):

      ```js
      /* ---------- Bewegungsbausteine für Klick-Animationen (#93) ---------- */
      /* Jeder Baustein ist eine Fabrik und liefert eine Schrittfunktion
         (mesh, q) mit q von 0 nach 1 (Smoothstep kommt aus tween).
         EISERNE REGEL: bei q === 1 schreibt jeder Baustein exakt die Ruhelage.
         Eine Klick-Animation hinterlässt nichts — weder am Mesh noch im
         Spielstand. mesh.rotation.y ist tabu, sie trägt en.rot. */
      const ANIM = {
        /* Gedämpfte Schwingung: sin() * (1 - q) endet von selbst auf 0. */
        wippen: (achse, winkel, schwingungen = 3) => (m, q) => {
          m.rotation[achse] = q >= 1 ? 0
            : winkel * Math.sin(q * schwingungen * 2 * Math.PI) * (1 - q);
        },
        /* Immer kleinere Sprünge über der Ruhehöhe. Die Ruhehöhe wird beim
           ersten Schritt gemerkt, weil en.y je nach Abstellfläche variiert
           (surfaceYAt für Deko-Objekte). */
        huepfen: (hoehe, spruenge = 3) => (m, q) => {
          if (m.userData.ruheY === undefined) m.userData.ruheY = m.position.y;
          m.position.y = m.userData.ruheY + (q >= 1 ? 0
            : Math.abs(Math.sin(q * spruenge * Math.PI)) * hoehe * (1 - q));
        },
        /* Einmal zusammendrücken und zurückfedern — Schlag, Anstoss. */
        stauchen: (tiefe) => (m, q) => {
          m.scale.y = q >= 1 ? 1 : 1 - tiefe * Math.sin(q * Math.PI);
        },
        /* Reihum eintauchen, für eine Teileliste in userData (Klaviertasten). */
        reihum: (griff, tiefe) => (m, q) => {
          const teile = m.userData[griff]; if (!teile) return;
          teile.forEach((t, i) => {
            if (t.userData.ruheY === undefined) t.userData.ruheY = t.position.y;
            const p = q * teile.length - i;
            t.position.y = t.userData.ruheY
              - (q >= 1 || p < 0 || p > 1 ? 0 : Math.sin(p * Math.PI) * tiefe);
          });
        },
        /* Mehrere Bausteine gleichzeitig auf demselben Mesh. */
        zusammen: (...schritte) => (m, q) => schritte.forEach(f => f(m, q)),
      };
      ```

- [ ] **Step 4: Debug-Hook ergänzen.** In der Zeile
      `ACTIONS, isOn, addItem, solidBoxes, …` (`js/game.js:2824`) wird
      `ANIM, sfx,` direkt hinter `ACTIONS,` aufgenommen:

      ```js
        ACTIONS, ANIM, sfx, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, get clip() { return clip; },
      ```

      `sfx` steht dort als Referenz auf dasselbe Objekt, das die Registry
      aufruft — nur deshalb kann eine Sonde einen Effekt durch einen Zähler
      ersetzen.

- [ ] **Step 5: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-klick-animationen/t1_anim.py`
      druckt `T1 OK`.

- [ ] **Step 6: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(objekte): Bewegungsbausteine für Klick-Animationen"
      git push
      ```

---

### Task 2: `spieleAktion` — ein Pfad für Knopf und Tipp

`toggleAction()` liest heute `selected` und kennt nur den Zustands-Fall. Es
wird zu einer Funktion, die einen Pick entgegennimmt und beide Eintragstypen
bedient. Der Tipp-Zweig kommt in Task 5 dazu; hier bleibt der Knopf der einzige
Aufrufer, damit der Umbau für sich prüfbar ist.

**Files:**
- Modify: `js/game.js:1470-1487` (`toggleAction`, `$('btn-action').onclick`)
- Modify: `js/game.js:1461-1468` (`updateActionBtn` — unverändert in der
  Logik, aber `actionLabel` muss den neuen Eintragstyp kennen; siehe Step 3)
- Modify: `js/game.js:2810-2828` (Debug-Hook)
- Test: `.superpowers/sdd/2026-09-27-klick-animationen/t2_spieleaktion.py`

**Interfaces:**
- Consumes: `ANIM` aus Task 1.
- Produces: `spieleAktion(pick) → void` — führt die Aktion des Eintrags
  `ACTIONS[pick.entry.id]` aus. Eintrag mit `apply`: schaltet `on` um,
  animiert, `save()`. Eintrag mit `play`: startet die Bewegung, **kein**
  `save()`. Danach in beiden Fällen `a.sound(...)`.
- Produces: `laeuftAnimation(pick) → boolean` im Debug-Hook.
- Produces: `actionLabel(en)` liefert für einen `play`-Eintrag dessen `label`
  (unverändertes Verhalten, `js/game.js:780-781` liest `a.label` bereits).

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-klick-animationen/t2_spieleaktion.py`,
      gleicher Rahmen wie T1 (Server, Init-Skript, `pageerror`-Sammler).
      Geprüft wird, dass es die Funktion gibt und dass sie am
      Badewannen-Zustand nichts kaputt macht:

      ```python
      SETUP = """
      () => {
        const w = window.wipfelkratzer;
        w.enterEdit(1);
        w.addItem('badewanne');
        const m = w.itemMeshes[1][0];
        w.select(m.userData.pick);
        return { on: w.isOn(m.userData.pick.entry),
                 hatFunktion: typeof w.spieleAktion === 'function',
                 hatMelder: typeof w.laeuftAnimation === 'function' };
      }
      """

      SCHALTEN = """
      () => {
        const w = window.wipfelkratzer;
        w.spieleAktion(w.selected);
        return { on: w.isOn(w.selected.entry) };
      }
      """
      ```

      Ablauf: `SETUP`, dann

      ```python
      assert vor["hatFunktion"], "spieleAktion fehlt im Debug-Hook"
      assert vor["hatMelder"], "laeuftAnimation fehlt im Debug-Hook"
      nach = page.evaluate(SCHALTEN)
      assert nach["on"] != vor["on"], "Badewanne hat nicht geschaltet"
      page.wait_for_function("window.wipfelkratzer.tweenCount() === 0",
                             timeout=180000)
      stand = json.loads(page.evaluate(
          "localStorage.getItem('wipfelkratzer-v1')"))
      assert stand["rooms"]["1"][0]["on"] == nach["on"], \
          "on wurde nicht gespeichert"
      assert errs == [], errs
      print("T2 OK")
      ```

- [ ] **Step 2: Sonde läuft rot.** Der Lauf bricht mit
      `AssertionError: spieleAktion fehlt im Debug-Hook` ab.

- [ ] **Step 3: `toggleAction` zu `spieleAktion` umbauen.**
      `js/game.js:1470-1487` wird ersetzt durch:

      ```js
      /* Ein Pfad für beide Auslöser — den Knopf #btn-action und den Tipp auf
         ein bereits ausgewähltes Objekt (#93). Deshalb nimmt die Funktion den
         Pick als Argument entgegen, statt selected zu lesen.
         - Eintrag mit `apply`: schaltbarer Zustand, en.on wird gespeichert.
         - Eintrag mit `play`:  einmalige Bewegung, NICHTS wird gespeichert.
         - Eintrag nur mit `sound`: nur der Ton. */
      function spieleAktion(pick) {
        if (!pick) return;
        const en = pick.entry, a = ACTIONS[en.id];
        if (!a) return;
        if (a.play) { starteAnimation(pick, a); return; }
        if (!a.apply) { a.sound(true); return; }
        const next = !isOn(en);
        en.on = next;
        a.sound(next);
        const mesh = pick.mesh;
        tween(0.7, q => a.apply(mesh, next, q));
        updateActionBtn();
        /* Die Fassade hängt an den Lampenzuständen (applyNight) — ohne dieses
           Nachziehen hinkte sie bis zum nächsten Tag/Nacht-Wechsel hinterher. */
        if (en.id === 'lampe') applyNight(nightK);
        save();
      }
      /* Einmalige Bewegung. Ein zweiter Tipp während des Laufs wird
         ignoriert: ein Neustart auf einer ausgelenkten Lage sähe aus wie ein
         Ruckler und könnte die in ANIM gemerkte Ruhelage verfälschen. Der
         Merker sitzt am Mesh und wird im done-Rückruf von tween gelöscht —
         nicht per Zeitrechnung. */
      function starteAnimation(pick, a) {
        /* `griff` erlaubt einen eigenen Drehpunkt (Schaukelstuhl-Kufen). Fehlt
           er am Modell, läuft die Bewegung auf dem ganzen Objekt statt an
           undefined zu scheitern. */
        const ziel = (a.griff && pick.mesh.userData[a.griff]) || pick.mesh;
        if (ziel.userData.spielt) return;
        ziel.userData.spielt = true;
        a.sound(true);
        tween(a.dauer || 1.5, q => a.play(ziel, q),
              () => { a.play(ziel, 1); ziel.userData.spielt = false; });
      }
      function laeuftAnimation(pick) {
        const a = ACTIONS[pick.entry.id]; if (!a || !a.play) return false;
        const ziel = (a.griff && pick.mesh.userData[a.griff]) || pick.mesh;
        return !!ziel.userData.spielt;
      }
      $('btn-action').onclick = () => spieleAktion(selected);
      ```

      Der `done`-Rückruf ruft `a.play(ziel, 1)` noch einmal ausdrücklich auf:
      `tween` garantiert nicht, dass der letzte Schritt genau `q === 1` trifft
      (`js/game.js:2913-2915` bricht bei `tw.t >= tw.dur` ab, nachdem `k`
      geklemmt wurde) — aber sich darauf zu verlassen, wäre eine Wette. Das
      ist die Stelle, die Akzeptanzkriterium 5 garantiert.

- [ ] **Step 4: Debug-Hook ergänzen** (`js/game.js:2824`):

      ```js
        ACTIONS, ANIM, sfx, spieleAktion, laeuftAnimation, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, get clip() { return clip; },
      ```

- [ ] **Step 5: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-klick-animationen/t2_spieleaktion.py`
      druckt `T2 OK`.

- [ ] **Step 6: Gegenprobe — Fenster und Lampe unverändert.** In derselben
      Sonde ergänzen: `w.addItem('fenster')` auswählen, `spieleAktion`
      aufrufen, `tweenCount() === 0` abwarten und prüfen, dass
      `w.itemMeshes[1].at(-1).userData.sash.rotation.x` nahe `-0.45` liegt;
      dann `w.addItem('lampe')`, schalten, und prüfen, dass
      `state.rooms['1']` für die Lampe ein `on: false` trägt und dass die
      Seite nach `page.reload()` denselben Zustand zeigt.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "refactor(objekte): toggleAction zu spieleAktion verallgemeinern"
      git push
      ```

---

### Task 3: Modellgriffe für Schaukelstuhl und Klavier

Zwei der acht Objekte brauchen einen Drehpunkt bzw. eine Teileliste. Alle
anderen kommen ohne Modelländerung aus — das ist die Probe darauf, dass die
Bausteine generisch sind.

**Files:**
- Modify: `js/models.js:336-341` (`schaukelstuhl`)
- Modify: `js/models.js:348-352` (`klavier`)
- Test: `.superpowers/sdd/2026-09-27-klick-animationen/t3_griffe.py`

**Interfaces:**
- Produces: `makeFurniture('schaukelstuhl').userData.wippe` → `THREE.Group`,
  Ursprung auf der Kufenmitte (`y = 0.34`), enthält den ganzen Stuhl.
- Produces: `makeFurniture('klavier').userData.tasten` → Array aus sieben
  Tastenmeshes, von links nach rechts.

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-klick-animationen/t3_griffe.py`, gleicher
      Rahmen. Geprüft wird die Existenz der Griffe **und** dass die Ruhelage
      sich nicht verschoben hat — das schützt die Katalogbilder:

      ```python
      CHECK = """
      () => {
        const w = window.wipfelkratzer;
        const box = g => { const b = new w.THREE.Box3().setFromObject(g);
          return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
                 .map(v => Math.round(v * 1000) / 1000); };
        w.enterEdit(1);
        w.addItem('schaukelstuhl'); const s = w.itemMeshes[1].at(-1);
        w.addItem('klavier');       const k = w.itemMeshes[1].at(-1);
        return {
          hatWippe: !!s.userData.wippe,
          wippeY: s.userData.wippe ? s.userData.wippe.position.y : null,
          stuhlBox: box(s),
          tasten: k.userData.tasten ? k.userData.tasten.length : 0,
          klavierBox: box(k),
        };
      }
      """
      ```

      Die erwarteten Hüllquader werden **vor** der Änderung einmal gegen
      `main` gemessen und als Zahlen in die Sonde eingetragen; danach prüft
      sie auf Gleichheit (Toleranz 0.002). So fällt jede versehentliche
      Verschiebung auf.

      ```python
      assert res["hatWippe"], "userData.wippe fehlt am Schaukelstuhl"
      assert abs(res["wippeY"] - 0.34) < 1e-6, res["wippeY"]
      assert res["tasten"] == 7, res["tasten"]
      for a, b in zip(res["stuhlBox"], STUHL_BOX_MAIN):
          assert abs(a - b) < 0.002, ("Schaukelstuhl verschoben", res["stuhlBox"])
      for a, b in zip(res["klavierBox"], KLAVIER_BOX_MAIN):
          assert abs(a - b) < 0.002, ("Klavier verschoben", res["klavierBox"])
      assert errs == [], errs
      print("T3 OK")
      ```

- [ ] **Step 2: Referenzwerte gegen `main` messen.** Dieselbe Sonde mit
      aufgeweichten Zusicherungen (`hatWippe`/`tasten` auskommentiert) auf
      `main` laufen lassen und `stuhlBox`/`klavierBox` notieren. Die Zahlen
      werden als `STUHL_BOX_MAIN` und `KLAVIER_BOX_MAIN` eingetragen. Ohne
      diesen Schritt prüft Step 1 gegen geratene Werte.

- [ ] **Step 3: Sonde läuft rot.** Der Lauf bricht mit
      `AssertionError: userData.wippe fehlt am Schaukelstuhl` ab.

- [ ] **Step 4: Schaukelstuhl umbauen** (`js/models.js:336-341`). Der ganze
      Stuhl wandert in eine Gruppe, deren Ursprung auf der Kufenmitte liegt
      (die Kufen sind Tori mit Radius 0.32 um `y = 0.34`, `rotation.y = π/2`
      — die Wippachse ist damit **x**). Alle y-Werte der Teile verschieben
      sich um −0.34, die Gruppe um +0.34 zurück; die Weltlage bleibt exakt
      gleich:

      ```js
        schaukelstuhl() { const g = G();
          /* Der ganze Stuhl hängt in einer Gruppe, deren Ursprung auf der
             Kufenmitte sitzt (y = 0.34, Torusradius 0.32). Nur so wippt er um
             die Kufen statt um den Boden (#93). Die Teile stehen deshalb um
             -0.34 versetzt — die Ruhelage ist dieselbe wie vorher. */
          const wippe = G(); g.add(wippe); wippe.position.y = 0.34;
          g.userData.wippe = wippe;
          box(wippe, 0.4, 0.05, 0.38, MAT.wood, 0, -0.02);
          box(wippe, 0.4, 0.5, 0.05, MAT.wood, 0, 0.21, -0.17).rotation.x = 0.15;
          [-0.16, 0.16].forEach(x => { [-0.14, 0.14].forEach(z => box(wippe, 0.045, 0.28, 0.045, MAT.woodD, x, -0.17, z));
            const r = mesh(new THREE.TorusGeometry(0.32, 0.028, 10, 24, 1.9), MAT.woodD, x, 0, 0, wippe);
            r.rotation.y = Math.PI / 2; r.rotation.z = Math.PI + 0.6; });
          return g; },
      ```

- [ ] **Step 5: Klavier umbauen** (`js/models.js:348-352`). Die sieben
      schwarzen Tasten werden eingesammelt; Korpus, weisse Leiste und Beine
      bleiben, wo sie sind:

      ```js
        klavier() { const g = G();
          box(g, 0.85, 0.72, 0.3, MAT.dark, 0, 0.44, -0.05); box(g, 0.8, 0.05, 0.2, MAT.white, 0, 0.46, 0.14);
          /* Die Tasten sind einzeln greifbar, damit ANIM.reihum sie beim
             Spielen nacheinander eintauchen lässt (#93). */
          g.userData.tasten = [];
          for (let i = 0; i < 7; i++) g.userData.tasten.push(box(g, 0.05, 0.04, 0.1, MAT.black, -0.3 + i * 0.1, 0.5, 0.1));
          [-0.36, 0.36].forEach(x => box(g, 0.07, 0.2, 0.24, MAT.dark, x, 0.1, 0));
          return g; },
      ```

- [ ] **Step 6: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-klick-animationen/t3_griffe.py`
      druckt `T3 OK`.

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/models.js
      git commit -m "feat(objekte): Griffe für Schaukelstuhl-Kufen und Klaviertasten"
      git push
      ```

---

### Task 4: Sieben gerechnete Klänge

**Files:**
- Modify: `js/game.js:1974-2003` (`sfx`) — sieben Effekte am Ende des Objekts
- Test: `.superpowers/sdd/2026-09-27-klick-animationen/t4_klang.py`

**Interfaces:**
- Consumes: `tone(f, t, dur, type, g, dest)` (`js/game.js:1947`),
  `noiseBurst(t, dur, f0, f1, g)` (`js/game.js:1957`), `midi2f(m)`
  (`js/game.js:1929`).
- Produces: `sfx.klavier()`, `sfx.floete()`, `sfx.harfe()`, `sfx.trommel()`,
  `sfx.wippe()`, `sfx.hops()`, `sfx.rascheln()` — alle ohne Argumente, alle
  mit `if (!AC) return` als erster Zeile.

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-klick-animationen/t4_klang.py`, gleicher
      Rahmen. Headless ist nichts zu hören; geprüft wird, dass es die Effekte
      gibt, dass sie ohne `AudioContext` still und fehlerfrei zurückkehren und
      dass sie mit `AudioContext` Oszillatoren erzeugen:

      ```python
      CHECK = """
      () => {
        const w = window.wipfelkratzer;
        const namen = ['klavier','floete','harfe','trommel','wippe','hops','rascheln'];
        const fehlt = namen.filter(n => typeof w.sfx[n] !== 'function');
        if (fehlt.length) return { fehlt };
        /* Vor dem ersten Tipp gibt es keinen AudioContext: jeder Effekt muss
           still aussteigen, statt zu werfen. */
        const stilleFehler = [];
        namen.forEach(n => { try { w.sfx[n](); } catch (e) { stilleFehler.push(n + ': ' + e.message); } });
        return { fehlt: [], stilleFehler };
      }
      """
      ```

      Danach den Klang tatsächlich starten: `#btn-start` klicken
      (`timeout=20000`, das erzeugt `AC`, `js/game.js:1174` Umfeld), dann pro
      Effekt zählen, wie oft `AudioContext.prototype.createOscillator`
      aufgerufen wird. Der Zähler wird **vor** `page.goto` gesetzt:

      ```python
      page.add_init_script("""
        window.__osz = 0;
        const echt = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function () {
          window.__osz++; return echt.apply(this, arguments); };
      """)
      ```

      und geprüft:

      ```python
      assert res["fehlt"] == [], res["fehlt"]
      assert res["stilleFehler"] == [], res["stilleFehler"]
      for name, mindestens in [("klavier", 5), ("harfe", 6), ("floete", 1),
                               ("trommel", 1), ("wippe", 2), ("hops", 3)]:
          vor = page.evaluate("window.__osz")
          page.evaluate(f"window.wipfelkratzer.sfx.{name}()")
          nach = page.evaluate("window.__osz")
          assert nach - vor >= mindestens, (name, nach - vor)
      assert errs == [], errs
      print("T4 OK")
      ```

      `rascheln` steht bewusst nicht in der Liste: es besteht nur aus
      `noiseBurst` und erzeugt keinen Oszillator.

- [ ] **Step 2: Sonde läuft rot.** Der Lauf bricht mit
      `AssertionError: ['klavier', 'floete', 'harfe', 'trommel', 'wippe',
      'hops', 'rascheln']` ab.

- [ ] **Step 3: Die sieben Effekte einfügen.** Ans Ende des `sfx`-Objekts,
      vor die schliessende Klammer (`js/game.js:2003`):

      ```js
        /* Klavier: fünf Töne einer C-Dur-Pentatonik nacheinander, jeder mit
           einer leisen Oktave darunter — das gibt dem Klimpern Körper. */
        klavier() { if (!AC) return; const t = AC.currentTime;
          [60, 64, 67, 72, 76].forEach((n, i) => {
            tone(midi2f(n), t + i * 0.12, 0.55, 'triangle', 0.10);
            tone(midi2f(n - 12), t + i * 0.12, 0.45, 'sine', 0.04); }); },
        /* Blockflöte: weicher Sinus mit Luftstoss davor. Das Vibrato ist ein
           zweiter, ganz leiser Ton eine Idee daneben — eine Schwebung ist
           billiger als ein LFO und klingt hier genauso. */
        floete() { if (!AC) return; const t = AC.currentTime;
          noiseBurst(t, 0.07, 3200, 1400, 0.05);
          tone(midi2f(79), t + 0.02, 1.1, 'sine', 0.11);
          tone(midi2f(79) * 1.004, t + 0.02, 1.1, 'sine', 0.05); },
        /* Harfe: aufsteigendes Arpeggio, lange Ausklingzeit. */
        harfe() { if (!AC) return; const t = AC.currentTime;
          [60, 64, 67, 71, 74, 79].forEach((n, i) =>
            tone(midi2f(n), t + i * 0.07, 0.9, 'triangle', 0.08)); },
        /* Schlagzeug: Bassdrum (fallender Sinus) und gleich danach Snare
           (Rauschstoss). */
        trommel() { if (!AC) return; const t = AC.currentTime;
          const o = tone(70, t, 0.35, 'sine', 0.28);
          if (o) o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
          noiseBurst(t + 0.18, 0.12, 4200, 1200, 0.16);
          noiseBurst(t + 0.34, 0.10, 3600, 1000, 0.10); },
        /* Schaukelstuhl: zwei sehr leise Holzknarzer im Wipptakt — ein
           gedämpfter Verwandter von creak(). */
        wippe() { if (!AC) return; const t = AC.currentTime;
          [0, 0.75].forEach(d => { const o = tone(120, t + d, 0.5, 'sawtooth', 0.035);
            if (o) o.frequency.exponentialRampToValueAtTime(84, t + d + 0.45); }); },
        /* Hüpfen: drei immer leisere Plopps, jeder steigt in der Tonhöhe. */
        hops() { if (!AC) return; const t = AC.currentTime;
          [[0, 0.16], [0.30, 0.10], [0.54, 0.06]].forEach(([d, g]) => {
            const o = tone(260, t + d, 0.13, 'sine', g);
            if (o) o.frequency.exponentialRampToValueAtTime(540, t + d + 0.1); }); },
        /* Pflanze: drei kurze, hohe Rauschstösse — Blätter, die sich bewegen. */
        rascheln() { if (!AC) return; const t = AC.currentTime;
          [[0, 0.09], [0.16, 0.07], [0.34, 0.05]].forEach(([d, g]) =>
            noiseBurst(t + d, 0.14, 5200, 2600, g)); },
      ```

- [ ] **Step 4: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-klick-animationen/t4_klang.py`
      druckt `T4 OK`.

- [ ] **Step 5: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(objekte): gerechnete Klänge für Instrumente und Bewegungen"
      git push
      ```

---

### Task 5: Acht Registry-Einträge und der Tipp-Auslöser

**Files:**
- Modify: `js/game.js:775-779` (`ACTIONS`)
- Modify: `js/game.js:2043-2057` (Tipp-Handler, Zweig für das ausgewählte
  Objekt)
- Test: `.superpowers/sdd/2026-09-27-klick-animationen/t5_tipp.py`

**Interfaces:**
- Consumes: `ANIM` (Task 1), `spieleAktion`/`laeuftAnimation` (Task 2), die
  Modellgriffe (Task 3), die `sfx`-Effekte (Task 4).
- Produces: keine neuen Namen; `ACTIONS` wächst von drei auf elf Einträge.

- [ ] **Step 1: Fehlschlagende Sonde schreiben.**
      `.superpowers/sdd/2026-09-27-klick-animationen/t5_tipp.py`, gleicher
      Rahmen. Der Kern ist ein echter Tipp über `page.mouse`, nicht ein
      Aufruf von `spieleAktion`:

      ```python
      SETUP = """
      () => {
        const w = window.wipfelkratzer;
        w.enterEdit(1);
        w.addItem('schaukelstuhl');
        const m = w.itemMeshes[1][0];
        w.select(m.userData.pick);
        return { ids: Object.keys(w.ACTIONS).sort() };
      }
      """

      SCREEN = """
      () => {
        const w = window.wipfelkratzer;
        const v = new w.THREE.Vector3();
        w.selected.mesh.getWorldPosition(v).project(w.camera);
        return { x: (v.x + 1) / 2 * innerWidth, y: (-v.y + 1) / 2 * innerHeight };
      }
      """

      STAND = """
      () => {
        const w = window.wipfelkratzer;
        const g = w.selected.mesh.userData.wippe;
        return { winkel: g.rotation.x, laeuft: w.laeuftAnimation(w.selected),
                 tweens: w.tweenCount(),
                 stand: localStorage.getItem('wipfelkratzer-v1') };
      }
      """
      ```

      Ablauf und Zusicherungen:

      ```python
      erwartet = ['badewanne', 'ball', 'blockfloete', 'fenster', 'harfe',
                  'klavier', 'kuscheltier', 'lampe', 'pflanze',
                  'schaukelstuhl', 'schlagzeug']
      assert vor["ids"] == erwartet, vor["ids"]

      pt = page.evaluate(SCREEN)
      page.wait_for_timeout(500)
      vorher = page.evaluate(STAND)
      page.mouse.move(pt["x"], pt["y"])
      page.mouse.down(); page.mouse.up()          # Tipp: 0 px, < 400 ms
      page.wait_for_timeout(300)
      mitten = page.evaluate(STAND)
      assert mitten["laeuft"], "Tipp hat keine Animation ausgelöst"

      # Zweiter Tipp während des Laufs darf nicht neu starten.
      tweens_vor = mitten["tweens"]
      page.mouse.down(); page.mouse.up()
      page.wait_for_timeout(200)
      assert page.evaluate(STAND)["tweens"] <= tweens_vor, \
          "zweiter Tipp hat die Animation neu gestartet"

      page.wait_for_function("window.wipfelkratzer.tweenCount() === 0",
                             timeout=180000)
      nachher = page.evaluate(STAND)
      assert abs(nachher["winkel"]) < 1e-6, ("Ruhelage nicht erreicht",
                                             nachher["winkel"])
      assert nachher["stand"] == vorher["stand"], \
          "Klick-Animation hat den Spielstand verändert"
      assert errs == [], errs
      print("T5 OK")
      ```

- [ ] **Step 2: Sonde läuft rot.** Der Lauf bricht bei der Liste der
      Registry-Schlüssel ab (heute nur `badewanne`, `fenster`, `lampe`).

- [ ] **Step 3: Die acht Einträge ergänzen.** `ACTIONS`
      (`js/game.js:775-779`) wird zu:

      ```js
      const ACTIONS = {
        lampe:     { doOn: 'Licht an',     doOff: 'Licht aus',    apply: applyLampe,   sound: () => sfx.click() },
        fenster:   { doOn: 'Fenster auf',  doOff: 'Fenster zu',   apply: applyFenster, sound: () => sfx.creak() },
        badewanne: { doOn: 'Wanne füllen', doOff: 'Wanne leeren', apply: applyWanne,   sound: on => on ? sfx.fill() : sfx.drain() },

        /* Einmalige Bewegungen (#93). Eine Zeile pro Objekt — genau das ist
           der Sinn der Bausteine. `griff` benennt eine Untergruppe im Modell,
           wenn die Bewegung einen eigenen Drehpunkt braucht. */
        schaukelstuhl: { label: 'Schaukeln', dauer: 2.4, griff: 'wippe',
                         play: ANIM.wippen('x', 0.16, 3),   sound: () => sfx.wippe() },
        klavier:       { label: 'Spielen',   dauer: 2.0,
                         play: ANIM.reihum('tasten', 0.022), sound: () => sfx.klavier() },
        blockfloete:   { label: 'Spielen',   dauer: 1.6,
                         play: ANIM.zusammen(ANIM.huepfen(0.05, 2), ANIM.wippen('z', 0.10, 2)),
                         sound: () => sfx.floete() },
        harfe:         { label: 'Spielen',   dauer: 1.8,
                         play: ANIM.wippen('z', 0.06, 2),    sound: () => sfx.harfe() },
        schlagzeug:    { label: 'Spielen',   dauer: 1.2,
                         play: ANIM.stauchen(0.10),          sound: () => sfx.trommel() },
        ball:          { label: 'Hüpfen',    dauer: 1.4,
                         play: ANIM.huepfen(0.45, 3),        sound: () => sfx.hops() },
        kuscheltier:   { label: 'Hüpfen',    dauer: 1.2,
                         play: ANIM.huepfen(0.18, 2),        sound: () => sfx.hops() },
        pflanze:       { label: 'Wackeln',   dauer: 1.6,
                         play: ANIM.wippen('z', 0.07, 3),    sound: () => sfx.rascheln() },
      };
      ```

      `ANIM.reihum('tasten', …)` bekommt in `starteAnimation` das ganze
      Klavier-Mesh als `ziel` (kein `griff`), weil die Teileliste an dessen
      `userData` hängt — das ist der Unterschied zwischen `griff` (Drehpunkt)
      und dem Baustein-Argument (Teileliste).

- [ ] **Step 4: Tipp-Zweig einfügen.** Im Tipp-Handler, in der Zeile mit
      `const hits = ray.intersectObjects(itemMeshes[edit.k], true);`
      (`js/game.js:2055-2057`). Der Block

      ```js
          const hits = ray.intersectObjects(itemMeshes[edit.k], true);
          if (hits.length) { let o = hits[0].object; while (o && !(o.userData && o.userData.pick)) o = o.parent;
            if (o) { select(o.userData.pick); sfx.pop(); return; } }
      ```

      wird zu

      ```js
          const hits = ray.intersectObjects(itemMeshes[edit.k], true);
          if (hits.length) { let o = hits[0].object; while (o && !(o.userData && o.userData.pick)) o = o.parent;
            /* Ein Tipp auf das BEREITS ausgewählte Objekt löst seine Aktion aus
               (#93) — der erste Tipp wählt aus und lässt #btn-action sagen, was
               ein weiterer tut. Die 8-px-/400-ms-Schwelle oben trennt das schon
               sauber vom Ziehen (#64), es kommt keine zweite Heuristik dazu. */
            if (o && selected && selected.mesh === o && ACTIONS[o.userData.pick.entry.id]) {
              spieleAktion(selected); return; }
            if (o) { select(o.userData.pick); sfx.pop(); return; } }
      ```

      Der Vergleich läuft über `selected.mesh === o`, nicht über den Pick:
      `select()` speichert den Pick aus `userData`, aber ein `rebuildItemMesh`
      (`js/game.js:1453-1458`) tauscht ihn aus — das Mesh ist die stabilere
      Identität.

- [ ] **Step 5: Sonde grün.**
      `python3 .superpowers/sdd/2026-09-27-klick-animationen/t5_tipp.py`
      druckt `T5 OK`.

- [ ] **Step 6: Gegenprobe — erster Tipp wählt weiterhin nur aus.** In
      derselben Sonde ergänzen: ein zweites Möbel (`w.addItem('klavier')`)
      setzen, den Schaukelstuhl auswählen, dann auf das **Klavier** tippen und
      prüfen, dass `w.selected.entry.id === 'klavier'` ist und
      `w.tweenCount() === 0` bleibt (keine Animation beim Auswählen). Zweite
      Gegenprobe: ein Zug über 40 px auf dem ausgewählten Objekt
      (`mouse.down`, acht `mouse.move`, `mouse.up`) verschiebt es und löst
      **keine** Animation aus (`laeuftAnimation` bleibt `false`).

- [ ] **Step 7: Commit und Push.**

      ```bash
      git add js/game.js
      git commit -m "feat(objekte): acht Objekte bewegen sich beim Antippen"
      git push
      ```

---

### Task 6: Abnahme über alle acht Objekte

**Files:**
- Test: `.superpowers/sdd/2026-09-27-klick-animationen/t6_abnahme.py`

**Interfaces:**
- Consumes: alles aus Task 1–5. Keine Produktionsänderung, ausser sie folgt
  aus einem roten Punkt.

- [ ] **Step 1: Abnahme-Sonde schreiben.** Sie geht die acht Objekte in einer
      Schleife durch und prüft pro Objekt dasselbe — das ist nur deshalb
      möglich, weil die Registry generisch ist:

      ```python
      OBJEKTE = ['schaukelstuhl', 'klavier', 'blockfloete', 'harfe',
                 'schlagzeug', 'ball', 'kuscheltier', 'pflanze']

      AUSLOESEN = """
      (id) => {
        const w = window.wipfelkratzer;
        w.addItem(id);
        const m = w.itemMeshes[1].at(-1);
        w.select(m.userData.pick);
        const a = w.ACTIONS[id];
        const ziel = (a.griff && m.userData[a.griff]) || m;
        const vor = { rx: ziel.rotation.x, rz: ziel.rotation.z,
                      y: m.position.y, sy: ziel.scale.y,
                      stand: localStorage.getItem('wipfelkratzer-v1') };
        w.spieleAktion(w.selected);
        return { vor, label: a.label, lief: w.laeuftAnimation(w.selected) };
      }
      """

      RUHELAGE = """
      (id) => {
        const w = window.wipfelkratzer;
        const m = w.itemMeshes[1].at(-1);
        const a = w.ACTIONS[id];
        const ziel = (a.griff && m.userData[a.griff]) || m;
        return { rx: ziel.rotation.x, rz: ziel.rotation.z,
                 y: m.position.y, sy: ziel.scale.y,
                 stand: localStorage.getItem('wipfelkratzer-v1') };
      }
      """
      ```

      Pro Objekt geprüft — das sind die Akzeptanzkriterien 3, 5, 6 und 10:

      ```python
      for id in OBJEKTE:
          r = page.evaluate(AUSLOESEN, id)
          assert r["lief"], f"{id}: keine Animation gestartet"
          assert r["label"], f"{id}: kein Knopf-Text"
          page.wait_for_function(
              "window.wipfelkratzer.tweenCount() === 0", timeout=180000)
          n = page.evaluate(RUHELAGE, id)
          assert abs(n["rx"]) < 1e-6 and abs(n["rz"]) < 1e-6, (id, n)
          assert abs(n["sy"] - 1) < 1e-6, (id, n["sy"])
          assert abs(n["y"] - r["vor"]["y"]) < 1e-6, (id, n["y"], r["vor"]["y"])
          assert n["stand"] == r["vor"]["stand"], \
              f"{id}: Spielstand verändert"
      assert errs == [], errs
      ```

- [ ] **Step 2: Klang für Klavier und Blockflöte am Objekt prüfen** —
      Akzeptanzkriterium 4. In derselben Sonde, nach `#btn-start`
      (`timeout=20000`):

      ```python
      page.evaluate("""() => {
        const w = window.wipfelkratzer;
        window.__klaenge = [];
        ['klavier', 'floete'].forEach(n => {
          const echt = w.sfx[n].bind(w.sfx);
          w.sfx[n] = () => { window.__klaenge.push(n); echt(); }; });
      }""")
      for id, klang in [('klavier', 'klavier'), ('blockfloete', 'floete')]:
          page.evaluate(AUSLOESEN, id)
          page.wait_for_function(
              "window.wipfelkratzer.tweenCount() === 0", timeout=180000)
      assert page.evaluate("window.__klaenge") == ['klavier', 'floete']
      ```

      Dass headless nichts zu hören ist, gehört so in die PR-Beschreibung —
      der Zähler ist der Stellvertreter für den Ton.

- [ ] **Step 3: Keine externe Ressource** — Akzeptanzkriterium 4, zweite
      Hälfte. Die Sonde sammelt jede Anfrage
      (`page.on("request", …)`) und prüft, dass keine Adresse ausserhalb von
      `127.0.0.1:<port>` steht und dass keine Audiodatei geladen wird. Dazu
      ausserhalb des Browsers:

      ```bash
      git diff --stat main -- assets/ | tee /dev/stderr | wc -l   # muss 0 sein
      grep -rn "new Audio\|<audio\|https\?://" js/ | grep -v "three@\|importmap"
      ```

- [ ] **Step 4: Bestandsprüfung — Badewanne, Fenster, Lampe.**
      Akzeptanzkriterium 8: die drei schaltbaren Objekte setzen, je zweimal
      schalten, `state.rooms['1']` prüfen, `page.reload()`, und danach prüfen,
      dass `isOn` für alle drei denselben Wert liefert wie vor dem Neuladen.

- [ ] **Step 5: Bestandsprüfung — Ziehen und Mausrad.**
      Akzeptanzkriterium 9: ein Zug über 40 px verschiebt das ausgewählte
      Objekt (`en.x`/`en.z` ändern sich) und löst keine Animation aus; ein
      `page.mouse.wheel(0, 120)` über dem ausgewählten Objekt ändert `en.rot`
      und nicht `camera.position.distanceTo(controls.target)`.

- [ ] **Step 6: Objekt während der Animation wegräumen.** Der in der Spec
      benannte Sonderfall: Animation starten, sofort `w.removeItem(pick)`
      aufrufen, `tweenCount() === 0` abwarten und prüfen, dass `errs == []`
      bleibt — der laufende `tween` schreibt auf ein elternloses Mesh und muss
      still auslaufen.

- [ ] **Step 7: Rote Punkte beheben.** Jeder Fehlschlag ist ein echter Mangel
      in Task 1–5, keine Sondenschwäche — erst die Implementierung anpassen,
      dann erneut laufen lassen. Bei drei erfolglosen Versuchen an derselben
      Stelle: anhalten und den Befund in der PR-Beschreibung festhalten, statt
      weiter zu raten (`CLAUDE.md`, Testing-Regel 8).

---

### Task 7: Changelog

**Files:**
- Modify: `CHANGELOG.md` (`## [Unreleased]` → `### Added`)

**Interfaces:**
- Consumes: nichts. Reine Dokumentation.

- [ ] **Step 1: Eintrag schreiben.** Unter `## [Unreleased]` einen Abschnitt
      `### Added` anlegen (er fehlt heute) und dort, im Ton der bestehenden
      Einträge — was sich **im Spiel** ändert, nicht im Repo:

      ```markdown
      ### Added

      - Viele Sachen bewegen sich jetzt, wenn Du sie antippst: Der
        Schaukelstuhl wippt, der Ball und das Kuscheltier hüpfen, die Pflanze
        wackelt — und beim Klavier tanzen die Tasten, während es klimpert.
        Blockflöte, Harfe und Schlagzeug spielen ebenfalls auf. Erst antippen
        zum Auswählen, dann nochmal tippen — oder den Knopf unten drücken, der
        Dir sagt, was passiert (#93)
      ```

- [ ] **Step 2: Commit und Push.**

      ```bash
      git add CHANGELOG.md
      git commit -m "docs(changelog): Klick-Animationen und Instrumentenklänge (#93)"
      git push
      ```

- [ ] **Step 3: PR-Beschreibung vervollständigen.** Die Ausgabe **jeder**
      Sonde (T1–T6) einfügen, dazu `git diff --name-only main`, und den
      **manuellen In-Browser-Playtest als offenen Posten** benennen — er ist
      das eigentliche Gate dieses Stacks und darf nicht als erledigt behauptet
      werden. Ebenfalls dort vermerken: Klang ist headless nicht hörbar, der
      Aufrufzähler ist sein Stellvertreter; und dass die Katalog-Vorschaubilder
      von Schaukelstuhl und Klavier nach der Modelländerung einmal von Hand
      angeschaut gehören.
