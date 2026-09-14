# Plan — Tiere in der Wohnung verschieben und drehen (Issue #39)

**Goal:** Ein Tier lässt sich im Einrichten-Modus antippen, verschieben und
drehen — mit derselben Auswahlleiste wie ein Möbel. Die Wackel-Animation läuft
unverändert weiter, die von Hand gesetzte Position überlebt das Neuladen und
schaltet die automatische Platzsuche aus #14 für diese Wohnung ab. Alte
Spielstände laden unverändert.

**Architecture:** Tiere werden **nicht** zu `state.rooms`-Einträgen — diese
Liste ist die Einzugsbedingung (`js/game.js:44`). Stattdessen kommt ein
eigenes Spielstandfeld `state.tenantPos` (`{ [floor]: Array<{x,z,rot}> }`) und
eine eigene Mesh-Registry `tenantMeshes` neben `itemMeshes`. Jedes Tier-Mesh
bekommt in `spawnTenant` ein `userData.pick = { k, entry, mesh, tenant }` in
exakt der Form, die `placeItemMesh` für Möbel erzeugt (`js/game.js:461`), mit
einem `entry` **ohne** `id` — dadurch verhalten sich Tiere in `clampEntry`,
`select` und den Tastenzweigen wie Bodenmöbel, ohne dass eine der
`DECO.has(...)`/`WALL_ITEMS.has(...)`-Abfragen angefasst werden muss.
Zuständigkeiten werden getrennt: Auswahl und Tastatur schreiben `x`, `z` und
`rotation.y`, die Wackel-Animation schreibt weiter allein `position.y`
(`js/game.js:1208`). `tenantSpot(k)` wird in `tenantSpots(k)` aufgetrennt
(sortierte Kandidatenliste, Rechnung unverändert), damit «Verschieben» einen
Nachbarplatz findet und #40 dieselbe Liste für die Ausweichsuche nutzen kann.

**Spec:** `docs/ai-notes/specs/2026-09-14-tiere-verschiebbar-design.md`

## Global Constraints

- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute — auch in Kommentaren und Commit-Nachrichten.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein `package.json`,
  kein Test-Runner. Nur ES-Module.
- **Rückwärtskompatibler Spielstand.** Schlüssel `wipfelkratzer-v1`
  (`js/game.js:41`) bleibt. Ein Stand ohne `tenantPos` ist gültig und bedeutet
  «automatische Platzierung wie in #14».
- **`tenantSpot`s Rechnung bleibt bitgleich.** Die Auftrennung in
  `tenantSpots(k)` ist eine reine Refaktorierung; für einen Raum ohne
  gespeicherte Tierplätze muss dieselbe Position herauskommen wie heute.
- **Die Wackel-Animation wird nicht angefasst.** `critters` bleibt wie
  `js/game.js:1208`; kein anderer Code darf `position.y` eines Tieres dauerhaft
  setzen.
- **Keine Kollisionslogik.** Dass ein Tier in einem Sofa landen kann, ist hier
  erlaubt und Gegenstand von #40.
- **Touch first.** Spielerin ist ein Kind, meist am Tablet: jede Trefferfläche
  mindestens 44 × 44 px wie die bestehenden Knöpfe (`index.html:73`).
- **Keine neuen Toasts pro Tastendruck.** Toasts verschwinden nie von selbst und
  stapeln sich (`js/game.js:680-690` Bereich `toast`/`TOAST_MAX_VISIBLE`).
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag kommt unter `## [Unreleased]`.
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, niemals `run_in_background`** (`CLAUDE.md:540-568`).
  Ein Lauf ist genau daran gescheitert: 59 von 80 Turns verbraucht, Erfolg
  gemeldet, nichts gepusht. Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- Conventional Commits, Präfix `feat(tiere)` bzw. `test(tiere)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-tiere-verschiebbar/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8981–8985** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
  Danach gezielt über den Port beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  **niemals `pkill -f`** mit einem Muster, das den aufrufenden Befehl treffen
  kann.
- Chromium starten mit
  `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr** — unter
  Software-Rendering dauert ein Klick in diesem Spiel bis zu ~7 s.
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen.
- Debug-Hook: `window.wipfelkratzer` (`js/game.js:1188`). Er wird in Task 2 um
  `tenantMeshes`, `tenantGroups`, `select`, `deselect` und `get selected()`
  erweitert; alle Prüfskripte greifen darauf zu.
- Spielstand **vor** dem Laden setzen ist deutlich schneller als der Aufbau
  über die Oberfläche:

  ```python
  SAVE = {"floors": 0, "rooms": {"0": [
      {"id": "tisch",  "cell": 0, "x": -1.2, "z": -0.9, "rot": 0},
      {"id": "regal",  "cell": 1, "x":  1.2, "z": -0.9, "rot": 0},
      {"id": "sofa",   "cell": 2, "x":  0.0, "z":  1.1, "rot": 0}]},
      "nuts": 0, "bridge": False, "garden": False, "night": False,
      "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {}}

  def boot(page, port, save=SAVE, extra=""):
      page.add_init_script(
          "localStorage.setItem('wipfelkratzer-v1', %s);%s"
          % (json.dumps(json.dumps(save)), extra))
      page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
      page.click("#btn-start", timeout=20000)
      page.wait_for_timeout(800)
      page.evaluate("() => window.wipfelkratzer.enterEdit(0)")
      page.wait_for_timeout(600)
  ```

  Drei Möbel in Wohnung 0 erfüllen `tenantIn` (`js/game.js:44`), also zieht
  «Die Kindergarten-Mäuse» (zwei Tiere) automatisch ein.
- Fehler einsammeln: `page.on("pageerror", lambda e: errors.append(str(e)))`,
  und am Ende `assert not errors`.

---

### Task 1: Spielstandfeld, Mesh-Registry und `tenantSpots`

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t1_state.py` (Wegwerf-Test)

**Interfaces:**
- `state.tenantPos: { [floor: string]: Array<{ x: number, z: number, rot: number }> }`
- `const tenantMeshes = {}` — `tenantMeshes[i] = []` für jedes Stockwerk
- `function tenantSpots(k): Array<{ x: number, z: number, score: number }>`
  (absteigend nach `score` = Abstand zum nächsten Möbel)
- `const tenantSpot = k => tenantSpots(k)[0]`
- `function setTenantPos(i, n, en): void`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t1_state.py`:

      ```python
      import json, sys
      from playwright.sync_api import sync_playwright

      PORT = 8981
      SAVE = {...}  # siehe Harness oben, wortwörtlich übernehmen

      CHECK = """
      () => {
        const w = window.wipfelkratzer, out = { errors: [] };
        if (!w.tenantSpots) { out.errors.push('tenantSpots fehlt'); return out; }
        if (!w.tenantMeshes) { out.errors.push('tenantMeshes fehlt'); return out; }
        if (!w.state.tenantPos) { out.errors.push('state.tenantPos fehlt'); return out; }

        // 1. tenantSpots liefert das volle 5x3-Raster, absteigend sortiert.
        const sp = w.tenantSpots(0);
        if (sp.length !== 15) out.errors.push('tenantSpots liefert ' + sp.length + ' statt 15 Punkte');
        for (let i = 1; i < sp.length; i++)
          if (sp[i].score > sp[i - 1].score + 1e-9) { out.errors.push('tenantSpots ist nicht sortiert'); break; }

        // 2. tenantSpot() == bester Kandidat (Verhalten aus #14 unverändert).
        const best = w.tenantSpot(0);
        if (Math.abs(best.x - sp[0].x) > 1e-9 || Math.abs(best.z - sp[0].z) > 1e-9)
          out.errors.push('tenantSpot != tenantSpots[0]');
        out.spot = { x: best.x, z: best.z };

        // 3. Tiere hängen in tenantMeshes, nicht in itemMeshes.
        const tm = w.tenantMeshes[0] || [];
        if (tm.length !== 2) out.errors.push('tenantMeshes[0] hat ' + tm.length + ' statt 2 Tiere');
        const im = w.itemMeshes[0] || [];
        if (im.some(m => tm.includes(m))) out.errors.push('Tier steckt in itemMeshes');
        if (im.length !== 3) out.errors.push('itemMeshes[0] hat ' + im.length + ' statt 3 Möbel');

        // 4. Ohne Handbewegung bleibt tenantPos leer.
        if (Object.keys(w.state.tenantPos).length) out.errors.push('tenantPos ist unaufgefordert gefüllt');

        // 5. setTenantPos schreibt beide Tiere der Wohnung fest.
        const en = tm[1].userData.pick.entry;
        w.setTenantPos(0, 1, { x: 0.5, z: -0.5, rot: 1.0 });
        const arr = w.state.tenantPos[0];
        if (!arr || arr.length !== 2) out.errors.push('setTenantPos schreibt nicht beide Tiere');
        else {
          if (Math.abs(arr[1].x - 0.5) > 1e-6 || Math.abs(arr[1].z + 0.5) > 1e-6 || Math.abs(arr[1].rot - 1.0) > 1e-6)
            out.errors.push('setTenantPos hat den übergebenen Platz nicht gespeichert');
          const e0 = tm[0].userData.pick.entry;
          if (Math.abs(arr[0].x - e0.x) > 2e-3 || Math.abs(arr[0].z - e0.z) > 2e-3)
            out.errors.push('Mitbewohner wurde nicht mit festgeschrieben');
        }
        out.saved = arr;
        return out;
      }
      """

      def main():
          errors = []
          with sync_playwright() as p:
              b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
              page = b.new_page()
              page.on("pageerror", lambda e: errors.append(str(e)))
              boot(page, PORT)
              res = page.evaluate(CHECK)
              # 6. Der Schreibvorgang landet debounced im localStorage.
              page.wait_for_timeout(600)
              stored = json.loads(page.evaluate(
                  "() => localStorage.getItem('wipfelkratzer-v1')"))
              if not stored.get("tenantPos", {}).get("0"):
                  res["errors"].append("tenantPos fehlt im gespeicherten Stand")
              b.close()
          print(json.dumps(res, indent=2))
          errors += res["errors"]
          if errors:
              print("FEHLER:", *errors, sep="\n  "); sys.exit(1)
          print("OK")

      main()
      ```

- [ ] **Step 2: Test laufen lassen und scheitern sehen.** Server auf Port 8981
      starten, `python3 .superpowers/sdd/2026-09-14-tiere-verschiebbar/t1_state.py`
      im Vordergrund. Erwartet: `tenantSpots fehlt`. Server über den Port
      beenden.

- [ ] **Step 3: `state.tenantPos` ergänzen.** In `js/game.js:35` das Feld
      `tenantPos: {}` in die `state`-Literalliste aufnehmen, mit Kommentar:
      «Von Hand gesetzte Tierplätze pro Stockwerk; fehlt der Eintrag, platziert
      `tenantSpot` automatisch (#14).» Nichts an `save()` ändern —
      `{ ...state }` (`js/game.js:41`) nimmt das Feld mit.

- [ ] **Step 4: `tenantMeshes` anlegen.** In `js/game.js:243` die Registry
      `tenantMeshes = {}` zur Deklarationszeile hinzufügen und in der
      Stockwerkschleife bei `js/game.js:299` `tenantMeshes[i] = [];` neben
      `itemMeshes[i] = []` setzen.

- [ ] **Step 5: `tenantSpot` in `tenantSpots` auftrennen.** Aus
      `js/game.js:727-748` wird:

      ```js
      function tenantSpots(k) {
        const boxes = itemMeshes[k].filter(m => {
          const id = m.userData.pick.entry.id;
          return !DECO.has(id) && !WALL_ITEMS.has(id);
        }).map(m => new THREE.Box3().setFromObject(m));
        const { w, d } = dims(k), parent = parentOf(k); parent.updateWorldMatrix(true, false);
        const cols = 5, rows = 3, out = [];
        /* Ohne Möbel bleibt die Raummitte der beste Platz (Verhalten aus #14). */
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = -w / 2 + (c + 0.5) * w / cols, z = -d / 2 + (r + 0.5) * d / rows;
          const wp = parent.localToWorld(new THREE.Vector3(x, 0, z));
          let minDist = Infinity;
          boxes.forEach(bb => {
            const dx = Math.max(bb.min.x - wp.x, 0, wp.x - bb.max.x);
            const dz = Math.max(bb.min.z - wp.z, 0, wp.z - bb.max.z);
            const dist = Math.hypot(dx, dz);
            if (dist < minDist) minDist = dist;
          });
          out.push({ x, z, score: minDist });
        }
        return out.sort((a, b) => b.score - a.score);
      }
      /* Freieste Stelle im Raum (Verhalten aus #14): der bestbewertete Kandidat. */
      const tenantSpot = k => { const s = tenantSpots(k)[0]; return { x: s.x, z: s.z }; };
      ```

      Der bisherige frühe Rücksprung für den möbellosen Raum
      (`js/game.js:730`, `return { x: 0, z: 0 }`) bleibt inhaltlich erhalten:
      Ist `boxes` leer, wird das Raster trotzdem aufgebaut, jeder Punkt bekommt
      `score: Infinity`, und `{ x: 0, z: 0, score: Infinity }` wird der Liste
      vorangestellt. So liefert `tenantSpot(k)` weiterhin die Raummitte, und
      «Verschieben» hat auch im leeren Raum Ausweichpunkte.

- [ ] **Step 6: `setTenantPos` ergänzen.** Direkt unter `tenantSpot` einfügen,
      wortwörtlich wie im Spec, Abschnitt 5. `en.manual = true` setzen und
      `save()` aufrufen.

- [ ] **Step 7: Tier-Meshes in `spawnTenant` registrieren.**
      `js/game.js:750-763` so umbauen, dass jedes Tier ein `entry` bekommt
      (`{ x, z, rot, manual }`, ohne `id`), `a.userData.pick = { k: i, entry, mesh: a, tenant: { floor: i, idx: n } }`
      gesetzt wird und das Mesh zusätzlich in `tenantMeshes[i]` landet. Die
      gespeicherten Plätze aus `state.tenantPos[i]` haben Vorrang vor
      `tenantSpot(i)` — Code wie im Spec, Abschnitt 5. `critters.push(...)`
      bleibt unverändert. Bei jedem `spawnTenant` zuerst
      `tenantMeshes[i] = []` zurücksetzen.

- [ ] **Step 8: Debug-Hook erweitern.** `js/game.js:1188` um `itemMeshes`,
      `tenantMeshes`, `tenantGroups`, `tenantSpot`, `tenantSpots`,
      `setTenantPos` ergänzen.

- [ ] **Step 9: Test laufen lassen und grün sehen.** Server auf 8981, Skript im
      Vordergrund, danach Server über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

---

### Task 2: Tier antippen und auswählen

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t2_select.py` (Wegwerf-Test)

**Interfaces:**
- `select(pick)` akzeptiert zusätzlich `pick.tenant` und blendet dann
  `#btn-del` aus.
- `window.wipfelkratzer` liefert `select`, `deselect` und `get selected()`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t2_select.py`, Port 8981:

      ```python
      CHECK_PICK = """
      () => {
        const w = window.wipfelkratzer, out = { errors: [] };
        const a = w.tenantMeshes[0][0];
        if (!a.userData.pick) { out.errors.push('Tier hat kein userData.pick'); return out; }
        const p = a.userData.pick;
        if (p.k !== 0) out.errors.push('pick.k falsch: ' + p.k);
        if (!p.tenant || p.tenant.idx !== 0) out.errors.push('pick.tenant fehlt oder falsch');
        if (p.mesh !== a) out.errors.push('pick.mesh zeigt nicht auf das Tier');
        if ('id' in p.entry) out.errors.push('Tier-entry hat ein id-Feld');
        return out;
      }
      """

      # Auswahl über den echten Raycast: das Tier auf die Bildmitte holen und
      # dorthin tippen wäre fragil -> stattdessen select() direkt aufrufen und
      # zusätzlich einen echten Tap auf die projizierte Bildschirmposition.
      TAP = """
      () => {
        const w = window.wipfelkratzer;
        const a = w.tenantMeshes[0][0];
        const p = a.getWorldPosition(new w.THREE.Vector3());
        p.y += 0.2; p.project(w.camera);
        return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
      }
      """

      AFTER = """
      () => {
        const w = window.wipfelkratzer, out = { errors: [] };
        const s = w.selected;
        if (!s) { out.errors.push('nichts ausgewählt'); return out; }
        if (!s.tenant) out.errors.push('ausgewählt wurde kein Tier');
        out.selbar = document.getElementById('selbar').classList.contains('on');
        out.delHidden = document.getElementById('btn-del').classList.contains('hidden');
        out.moveHidden = document.getElementById('btn-move').classList.contains('hidden');
        out.rotHidden = document.getElementById('btn-rot').classList.contains('hidden');
        out.padHidden = document.getElementById('wallpad').classList.contains('hidden');
        out.bubble = document.getElementById('bubble').classList.contains('show');
        if (!out.selbar) out.errors.push('#selbar ist nicht offen');
        if (!out.delHidden) out.errors.push('«Weg damit» ist bei einem Tier sichtbar');
        if (out.moveHidden || out.rotHidden) out.errors.push('Verschieben/Drehen fehlen');
        if (!out.padHidden) out.errors.push('#wallpad ist sichtbar');
        if (!out.bubble) out.errors.push('Sprechblase fehlt');
        return out;
      }
      """
      ```

      Ablauf im Skript: `boot(page, PORT)`, `page.evaluate(CHECK_PICK)`, dann
      die Bildschirmposition des Tieres über `TAP` berechnen (dafür `THREE` mit
      in den Debug-Hook aufnehmen, siehe Step 4) und mit
      `page.mouse.click(x, y)` tippen, `page.wait_for_timeout(400)`, dann
      `page.evaluate(AFTER)`. Zusätzlich prüfen, dass ein `Delete`-Tastendruck
      das Tier **nicht** entfernt:
      `page.keyboard.press("Delete")` → `w.tenantMeshes[0].length === 2`.

- [ ] **Step 2: Test laufen lassen und scheitern sehen.** Erwartet:
      `nichts ausgewählt` (der Raycast ruft heute nur `tenantTalk`).

- [ ] **Step 3: `select` um den Tierfall erweitern.** In `js/game.js:672-678`
      nach den bestehenden Umschaltungen ergänzen:

      ```js
      const isTenant = !!pick.tenant;
      $('btn-del').classList.toggle('hidden', isTenant);
      ```

      `#btn-move`/`#btn-rot` bleiben über `wall` gesteuert; `pick.entry.id` ist
      bei einem Tier `undefined`, also ist `wall` dort `false` und beide Knöpfe
      erscheinen.

- [ ] **Step 4: Raycast-Zweig in `pointerup` umbauen.** `js/game.js:1000-1001`
      ersetzen durch die Fassung aus dem Spec, Abschnitt 3: Treffer in
      `tenantMeshes[edit.k]` suchen, das Elterntier mit `userData.pick`
      hochlaufen, `select(...)`, `tenantTalk(edit.k)`, `return`. Die
      bestehende Möbelsuche in `itemMeshes` bleibt darunter unverändert.
      `THREE` zusätzlich in `window.wipfelkratzer` (`js/game.js:1188`)
      exportieren, ebenso `select`, `deselect` und `get selected()`.

- [ ] **Step 5: `Delete` gegen Tiere absichern.** Im `keydown`-Zweig
      (`js/game.js:1088`) `if (e.key === 'Delete')` um `&& !selected.tenant`
      erweitern, und in `$('btn-del').onclick` (`js/game.js:1055`) ebenso:
      `if (selected && !selected.tenant) removeItem(selected);`.

- [ ] **Step 6: Test laufen lassen und grün sehen.** Server auf 8981 starten,
      Skript im Vordergrund, Server über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

---

### Task 3: Verschieben, Drehen und Speichern

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t3_move.py` (Wegwerf-Test)

**Interfaces:**
- `$('btn-move').onclick` springt für ein Tier auf einen Kandidaten aus
  `tenantSpots(k)`.
- `$('btn-rot').onclick` dreht ein Tier um 90°.
- `keydown`: Pfeiltasten verschieben, `PageUp`/`PageDown` drehen — beides auch
  für Tiere, ohne `surfaceYAt`/`baseY` auf `position.y` anzuwenden.
- Jede dieser Bewegungen ruft `setTenantPos(pick.tenant.floor, pick.tenant.idx, entry)`.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t3_move.py`, Port 8982:

      ```python
      MOVE = """
      () => {
        const w = window.wipfelkratzer, out = { errors: [] };
        const a = w.tenantMeshes[0][0];
        w.select(a.userData.pick);
        const before = { x: a.position.x, z: a.position.z, rot: a.rotation.y };
        document.getElementById('btn-move').click();
        const afterMove = { x: a.position.x, z: a.position.z };
        if (Math.hypot(afterMove.x - before.x, afterMove.z - before.z) < 0.3)
          out.errors.push('«Verschieben» hat das Tier nicht bewegt');
        document.getElementById('btn-rot').click();
        if (Math.abs((a.rotation.y - before.rot) - Math.PI / 2) > 1e-6)
          out.errors.push('«Drehen» dreht nicht um 90 Grad');
        out.after = { x: a.position.x, z: a.position.z, rot: a.rotation.y };
        out.saved = JSON.parse(JSON.stringify(w.state.tenantPos));
        if (!out.saved['0'] || out.saved['0'].length !== 2)
          out.errors.push('tenantPos wurde nicht geschrieben');
        return out;
      }
      """

      WALL = """
      () => {
        const w = window.wipfelkratzer, out = { errors: [] };
        const a = w.tenantMeshes[0][0];
        w.select(a.userData.pick);
        for (let i = 0; i < 60; i++)
          dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        const half = w.dims(0).w / 2 + 1;   // grosszügige Obergrenze
        if (Math.abs(a.position.x) > half)
          out.errors.push('Tier wurde durch die Wand geschoben: x=' + a.position.x);
        out.x = a.position.x; out.z = a.position.z;
        return out;
      }
      """

      WOBBLE = """
      async () => {
        const w = window.wipfelkratzer;
        const a = w.tenantMeshes[0][0];
        const x0 = a.position.x, z0 = a.position.z;
        const ys = [];
        for (let i = 0; i < 12; i++) {
          await new Promise(r => requestAnimationFrame(r));
          ys.push(a.position.y);
        }
        return { spread: Math.max(...ys) - Math.min(...ys),
                 drift: Math.hypot(a.position.x - x0, a.position.z - z0) };
      }
      """
      ```

      Nach `MOVE`/`WALL` prüft das Skript `WOBBLE`: `spread > 0.005` (das Tier
      wackelt weiter) und `drift < 1e-9` (x/z bleiben unangetastet).
      Anschliessend `page.wait_for_timeout(600)`, `page.reload(...)`,
      `page.click('#btn-start')`, `enterEdit(0)` und vergleichen, dass
      `tenantMeshes[0][0].position.x/z` und `rotation.y` mit den gespeicherten
      Werten aus `out.after` auf 2e-3 übereinstimmen. Zuletzt ein zweiter Lauf
      mit einem Spielstand **ohne** `tenantPos`: die Position muss gleich
      `tenantSpot(0)` sein (Automatik aus #14 unverändert).

- [ ] **Step 2: Test laufen lassen und scheitern sehen.** Erwartet:
      `«Verschieben» hat das Tier nicht bewegt` (der Knopf steigt heute bei
      einem Eintrag ohne `cell` aus bzw. verschiebt nichts Sinnvolles).

- [ ] **Step 3: `#btn-move` für Tiere.** `js/game.js:1043-1049` um einen
      vorgeschalteten Tierzweig ergänzen:

      ```js
      $('btn-move').onclick = () => { if (!selected || WALL_ITEMS.has(selected.entry.id)) return;
        if (selected.tenant) { const en = selected.entry;
          const cands = tenantSpots(selected.k);
          const far = cands.find(c => Math.hypot(c.x - en.x, c.z - en.z) > 0.4) || cands[0];
          en.x = far.x; en.z = far.z;
          clampEntry(selected.k, selected.mesh, en);
          setTenantPos(selected.tenant.floor, selected.tenant.idx, en);
          selHelper.update(); sfx.pop(); return; }
        ... bisheriger Möbelzweig unverändert ... };
      ```

- [ ] **Step 4: `#btn-rot` für Tiere.** `js/game.js:1050-1054` nach
      `clampEntry` ergänzen:
      `if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, selected.entry); else save();`
      Der übrige Ablauf (`entry.rot += Math.PI / 2`, `mesh.rotation.y`,
      `clampEntry`, `selHelper.update()`, `sfx.pop()`) bleibt gemeinsam.

- [ ] **Step 5: Tastatur.** Im Pfeiltasten-Zweig (`js/game.js:1073-1080`) nach
      `clampEntry` aufspalten:

      ```js
      if (selected.tenant) { setTenantPos(selected.tenant.floor, selected.tenant.idx, en); }
      else { en.y = DECO.has(en.id) ? surfaceYAt(selected.k, en.x, en.z, selected.mesh) : baseY(selected.k);
             selected.mesh.position.y = en.y; save(); }
      ```

      Damit schreibt für ein Tier niemand ausser der Wackel-Animation auf
      `position.y`. Im `PageUp`/`PageDown`-Zweig (`js/game.js:1081-1087`) analog
      `setTenantPos(...)` statt `save()` für Tiere.

- [ ] **Step 6: Auswahlrahmen dem Wackeln nachführen.** In der Render-Schleife
      direkt nach `critters.forEach(...)` (`js/game.js:1208`) ergänzen:
      `if (selHelper && selected && selected.tenant) selHelper.update();`

- [ ] **Step 7: Test laufen lassen und grün sehen.** Server auf 8982, Skript im
      Vordergrund, danach über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

---

### Task 4: Gesamtregression und Changelog

**Files:**
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t4_regress.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Regressionsskript schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-verschiebbar/t4_regress.py`, Port 8983.
      Es prüft, dass die bestehenden Abläufe unversehrt sind:

      ```python
      REGRESS = """
      () => {
        const w = window.wipfelkratzer, out = { errors: [] };

        // 1. Möbel bleiben auswählbar, verschiebbar, löschbar.
        const m = w.itemMeshes[0][0];
        w.select(m.userData.pick);
        if (!w.selected || w.selected.tenant) out.errors.push('Möbelauswahl kaputt');
        if (document.getElementById('btn-del').classList.contains('hidden'))
          out.errors.push('«Weg damit» fehlt beim Möbel');
        const p0 = { x: m.position.x, z: m.position.z };
        document.getElementById('btn-move').click();
        if (Math.hypot(m.position.x - p0.x, m.position.z - p0.z) < 1e-6)
          out.errors.push('Möbel «Verschieben» wirkungslos');
        const n0 = w.itemMeshes[0].length;
        document.getElementById('btn-del').click();
        if (w.itemMeshes[0].length !== n0 - 1) out.errors.push('Möbel löschen kaputt');

        // 2. Deko landet weiterhin auf einer Abstellfläche, nicht auf einem Tier.
        w.deselect();
        return out;
      }
      """
      ```

      Zusätzlich im Skript, über die Oberfläche:
      - Spielstand **ohne** Tiere (zwei Möbel) laden, drittes Möbel über den
        Katalog hinzufügen, prüfen dass danach `tenantMeshes[0].length === 2`
        ist und der Einzugs-Toast erscheint (`tenantIn`/`checkTenant`,
        `js/game.js:44, 764`).
      - Im Durchblick-Modus (`state.cutaway = true`, `exitEdit()`) auf ein Tier
        tippen: `w.selected` muss `null` bleiben, die Sprechblase erscheinen.
      - Eine Vase (`DECO`) auf den Tisch stellen und prüfen, dass ihre `y` über
        `baseY(0)` liegt — Beweis, dass `surfaceYAt` weiterhin nur Möbel sieht.

- [ ] **Step 2: Skript laufen lassen und grün sehen.** Server auf 8983, im
      Vordergrund, danach über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

- [ ] **Step 3: Changelog ergänzen.** In `CHANGELOG.md` **oberhalb** von
      `## [0.5.0] - 2026-09-13` einen Abschnitt `## [Unreleased]` anlegen (falls
      noch nicht vorhanden) und darunter unter `### Added` einfügen:

      ```markdown
      ## [Unreleased]

      ### Added

      - Tiere lassen sich jetzt beim Einrichten antippen, verschieben und
        drehen — genau wie ein Möbel, mit derselben Auswahlleiste. Wer ein Tier
        von Hand an seinen Platz stellt, behält ihn: die automatische Platzsuche
        beim Einzug gilt dann für diese Wohnung nicht mehr, und der Platz
        überlebt das Neuladen. Weggeworfen werden kann ein Tier nicht (#39)
      ```

      `version.js` bleibt unangetastet, kein `chore(release)`-Commit.

- [ ] **Step 4: Abschlussprüfung.** `git status` zeigt ausser `js/game.js` und
      `CHANGELOG.md` nichts Verfolgtes; `.superpowers/` ist ignoriert
      (`.gitignore:5`). `grep -n 'ae\|oe\|ue' ` **nicht** blind anwenden —
      stattdessen den Diff auf transliterierte Umlaute durchsehen
      (`übernehme`, `wären`, `möglich`) und auf `ß`.
