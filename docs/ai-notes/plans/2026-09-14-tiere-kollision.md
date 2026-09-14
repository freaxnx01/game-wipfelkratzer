# Plan — Kollisionserkennung zwischen Objekten und Tieren (Issue #40)

**Goal:** Ein Möbel kann nicht mehr auf ein Tier gesetzt werden und ein Tier
nicht mehr in ein Möbel geschoben werden. Bei einem Möbelzug weicht das Tier
freundlich aus; ist kein Platz mehr frei, wird der Möbelzug zurückgenommen und
erklärt, statt das Tier in die Wand zu drücken. Deko auf Abstellflächen und
Tiere auf Teppichen funktionieren unverändert.

**Architecture:** Baut auf **#39** auf (`state.tenantPos`, `tenantMeshes`,
`pick.tenant`, `setTenantPos()`, `tenantSpots(k)`). Neu kommt ein kleiner
Kollisionskern in `js/game.js`: `solidBoxes(k, exclude)` liefert die
Box3-Hindernisse einer Wohnung (Deko, Wandobjekte und alles flacher als
`SOLID_H` fallen raus), `overlapsXZ(a, b)` vergleicht rein zweidimensional in
Weltkoordinaten mit einem Toleranzrand. Darüber liegt ein gemeinsamer Rahmen
`applyMove(pick, mutate)`, durch den alle Bewegungen laufen — Möbel wie Tiere.
Er nimmt einen Schnappschuss des `entry`, führt die Bewegung aus, lässt sie von
`resolveItemMove` bzw. `resolveTenantMove` auflösen und setzt bei Misserfolg
alles zurück. Ausgewichen wird über `nudgeTenant`, das zuerst einen feinen Ring
um den bisherigen Platz und danach die aus #39 stammende, nach Freiraum
sortierte Liste `tenantSpots(k)` abklappert; jeder Kandidat läuft durch das
bestehende `clampEntry`, weshalb ein Ausweichmanöver nie in eine Wand führen
kann. **Möbel gegen Möbel wird bewusst nicht geprüft** — das würde `surfaceYAt`
und damit das Abstellen von Deko brechen.

**Spec:** `docs/ai-notes/specs/2026-09-14-tiere-kollision-design.md`

## Global Constraints

- **Voraussetzung #39.** Die Bausteine aus
  `docs/ai-notes/plans/2026-09-14-tiere-verschiebbar.md` müssen auf `main`
  liegen. Task 1, Step 1 prüft das ausdrücklich und bricht sonst ab — nichts
  davon wird hier noch einmal gebaut.
- **Deutsche Oberfläche durchgehend.** Schweizer Schreibweise (`ss`, nie `ß`),
  echte Umlaute — auch in Kommentaren und Commit-Nachrichten.
- **Buildless.** Keine neuen Abhängigkeiten, kein Bundler, kein `package.json`,
  kein Test-Runner. Nur ES-Module.
- **Keine Möbel-gegen-Möbel-Kollision.** `surfaceYAt`, `SURFACES` und der
  Deko-Zweig in `addItem` (`js/game.js:415-426, 695-703`) müssen unverändert
  weiterarbeiten.
- **Keine Tier-gegen-Tier-Kollision.** Zwei Tiere einer Wohnung stehen
  absichtlich dicht nebeneinander (`js/game.js:755-757`).
- **Die Wackel-Animation wird nicht angefasst.** `critters` behält die alleinige
  Hoheit über `position.y` (`js/game.js:1208`); die Kollisionsprüfung ist rein
  zweidimensional in x/z.
- **Höchstens ein Toast pro Zug**, und nur für den Fall «kein Platz mehr». Ein
  blockierter Tierschritt meldet sich nur über `sfx.knock()` — Toasts
  verschwinden nie von selbst und stapeln sich.
- **Rückwärtskompatibler Spielstand.** Schlüssel `wipfelkratzer-v1` bleibt; es
  kommt kein neues Feld dazu.
- **Touch first**, 44 × 44 px Trefferflächen (`index.html:73`). Diese Änderung
  fügt keine Bedienelemente hinzu.
- **`version.js` wird nicht angefasst**, kein `chore(release)`-Commit. Der
  Changelog-Eintrag kommt unter `## [Unreleased]`.
- **Verifikation ist headless Playwright** gegen `python3 -m http.server`,
  **immer im Vordergrund, niemals `run_in_background`** (`CLAUDE.md:540-568`).
  Ein Lauf ist genau daran gescheitert: 59 von 80 Turns verbraucht, Erfolg
  gemeldet, nichts gepusht. Null `pageerror` gehört zu jedem grünen Durchlauf.
- **Commit und Push vor der Verifikation**, nicht danach (`CLAUDE.md:566-568`).
- Conventional Commits, Präfix `feat(tiere)` bzw. `test(tiere)`.

## Verifikations-Harness

Wegwerf-Skripte liegen unter `.superpowers/sdd/2026-09-14-tiere-kollision/`
(bereits git-ignoriert, `.gitignore:5`). Sie werden nicht committet.

- Server: `python3 -m http.server <port>` aus dem Repo-Wurzelverzeichnis, Port
  aus **8986–8990** (für diese Issue-Sitzung reserviert, ersten freien nehmen).
  Danach gezielt über den Port beenden:
  `ss -lptn 'sport = :<port>' | grep -oP 'pid=\K[0-9]+' | xargs -r kill` —
  **niemals `pkill -f`** mit einem Muster, das den aufrufenden Befehl treffen
  kann.
- Chromium starten mit
  `args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]`.
- **Jeder `page.click` braucht `timeout=20000` oder mehr.**
- Ein 404 auf `favicon.png` ist erwartet; nur auf `pageerror` prüfen.
- Debug-Hook: `window.wipfelkratzer` — nach #39 mit `state`, `itemMeshes`,
  `tenantMeshes`, `tenantSpots`, `setTenantPos`, `select`, `deselect`,
  `get selected()`, `THREE`, `enterEdit`, `exitEdit`, `dims`. In Task 1 kommen
  `solidBoxes`, `overlapsXZ` und `tenantBlocked` dazu.
- Spielstände vor dem Laden setzen (`page.add_init_script`), Bootstrap wie in
  `docs/ai-notes/plans/2026-09-14-tiere-verschiebbar.md`, Abschnitt
  «Verifikations-Harness». Drei Spielstände werden gebraucht:

  ```python
  # A: drei Möbel locker verteilt -> Tiere ziehen ein, Platz ist frei
  SAVE_ROOMY = {"floors": 0, "rooms": {"0": [
      {"id": "tisch", "cell": 0, "x": -2.4, "z": -1.2, "rot": 0},
      {"id": "regal", "cell": 1, "x":  2.4, "z": -1.2, "rot": 0},
      {"id": "sofa",  "cell": 2, "x":  2.4, "z":  1.2, "rot": 0}]},
      "nuts": 0, "bridge": False, "garden": False, "night": False,
      "cutaway": False, "fulfilled": {}, "wallpaper": {}, "flooring": {},
      "tenantPos": {}}

  # B: Tier von Hand an einen bekannten Platz gesetzt (Feld aus #39)
  SAVE_FIXED = {**SAVE_ROOMY,
      "tenantPos": {"0": [{"x": -1.0, "z": 0.8, "rot": 0.0},
                          {"x": -0.4, "z": 0.8, "rot": 0.0}]}}

  # C: Wohnung mit Möbeln zugestellt -> kein Ausweichplatz mehr
  SAVE_FULL = {**SAVE_ROOMY, "rooms": {"0": [
      {"id": "sofa", "cell": i, "x": x, "z": z, "rot": 0}
      for i, (x, z) in enumerate(
          [(x, z) for z in (-1.3, -0.4, 0.5, 1.3) for x in (-2.6, -1.3, 0.0, 1.3, 2.6)])]}}
  ```

  Spielstand C erzeugt mehr Sofas, als `freeCell` Zellen kennt — das ist für
  den Ladeweg (`js/game.js:1177-1183`) egal, weil der `entry.cell` nur beim
  Hinzufügen über den Katalog vergeben wird.
- Hilfsprädikat für alle Skripte, im Browser ausgewertet:

  ```js
  const hits = (w, k) => {
    const T = w.THREE, out = [];
    w.tenantMeshes[k].forEach((a, i) => {
      const ab = new T.Box3().setFromObject(a);
      w.solidBoxes(k).forEach(bb => { if (w.overlapsXZ(ab, bb)) out.push(i); });
    });
    return out;   // Indizes der Tiere, die in einem Möbel stecken
  };
  ```

---

### Task 1: Kollisionskern und Bewegungsrahmen

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-tiere-kollision/t1_core.py` (Wegwerf-Test)

**Interfaces:**
- `const SOLID_H = 0.12`, `const COLL_PAD = 0.04`
- `function solidBoxes(k, exclude): THREE.Box3[]`
- `function overlapsXZ(a: THREE.Box3, b: THREE.Box3): boolean`
- `function tenantBlocked(pick): boolean` — Box3 des Tieres gegen `solidBoxes`
- `function replaceMesh(pick): void` — Mesh aus dem `entry` neu setzen; bei
  einem Tier ohne `position.y`
- `function applyMove(pick, mutate): boolean`

- [ ] **Step 1: Voraussetzung aus #39 prüfen.** `grep -n "tenantMeshes\|setTenantPos\|function tenantSpots" js/game.js`
      muss alle drei finden. Fehlt eines, **abbrechen und melden** — dieser Plan
      setzt #39 als gemergt voraus und baut nichts davon nach.

- [ ] **Step 2: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-kollision/t1_core.py`, Port 8986,
      Spielstand A:

      ```python
      CHECK = """
      () => {
        const w = window.wipfelkratzer, T = w.THREE, out = { errors: [] };
        for (const n of ['solidBoxes', 'overlapsXZ', 'tenantBlocked', 'applyMove'])
          if (typeof w[n] !== 'function') out.errors.push(n + ' fehlt');
        if (out.errors.length) return out;

        // 1. Deko und Wandobjekte zählen nicht als Hindernis.
        const before = w.solidBoxes(0).length;
        w.addItem('vase');      // DECO, landet auf dem Tisch
        w.addItem('bild');      // WALL_ITEM, hängt an der Wand
        const after = w.solidBoxes(0).length;
        if (after !== before) out.errors.push('Deko/Wandobjekt zählt als Hindernis: ' + before + ' -> ' + after);

        // 2. Der flache Teppich zählt nicht als Hindernis.
        w.addItem('teppich');
        if (w.solidBoxes(0).length !== before) out.errors.push('Teppich blockiert');

        // 3. Ein echtes Möbel schon.
        w.addItem('schrank');
        if (w.solidBoxes(0).length !== before + 1) out.errors.push('Schrank zählt nicht als Hindernis');

        // 4. overlapsXZ: Berühren ist erlaubt, Durchdringen nicht.
        const bx = (x0, z0, x1, z1) => new T.Box3(new T.Vector3(x0, 0, z0), new T.Vector3(x1, 1, z1));
        if (w.overlapsXZ(bx(0, 0, 1, 1), bx(1, 0, 2, 1))) out.errors.push('Kante an Kante gilt als Kollision');
        if (!w.overlapsXZ(bx(0, 0, 1, 1), bx(0.5, 0.5, 1.5, 1.5))) out.errors.push('Echte Überlappung nicht erkannt');
        if (w.overlapsXZ(bx(0, 0, 1, 1), bx(2, 2, 3, 3))) out.errors.push('Getrennte Boxen gelten als Kollision');

        // 5. applyMove nimmt einen blockierten Tierzug vollständig zurück.
        const a = w.tenantMeshes[0][0], pk = a.userData.pick;
        const solid = w.solidBoxes(0)[0];
        const snap = { x: pk.entry.x, z: pk.entry.z };
        const cx = (solid.min.x + solid.max.x) / 2, cz = (solid.min.z + solid.max.z) / 2;
        const lp = w.floorGroups[0].worldToLocal(new T.Vector3(cx, 0, cz));
        const ok = w.applyMove(pk, () => { pk.entry.x = lp.x; pk.entry.z = lp.z; });
        if (ok) out.errors.push('applyMove liess das Tier ins Möbel');
        if (Math.abs(pk.entry.x - snap.x) > 1e-6 || Math.abs(pk.entry.z - snap.z) > 1e-6)
          out.errors.push('applyMove hat den entry nicht zurückgesetzt');
        if (Math.abs(a.position.x - snap.x) > 1e-6) out.errors.push('applyMove hat das Mesh nicht zurückgesetzt');
        return out;
      }
      """
      ```

      Zusätzlich prüft das Skript nach dem Lauf: `spread` der `position.y` des
      Tieres über 12 Frames `> 0.005` — `replaceMesh` darf die Wackel-Animation
      nicht abwürgen.

- [ ] **Step 3: Test laufen lassen und scheitern sehen.** Server auf 8986,
      Skript im Vordergrund. Erwartet: `solidBoxes fehlt`. Server über den Port
      beenden.

- [ ] **Step 4: Kollisionskern einfügen.** Direkt unterhalb von `clampEntry`
      (`js/game.js:446`) `SOLID_H`, `COLL_PAD`, `solidBoxes` und `overlapsXZ`
      wortwörtlich aus dem Spec, Abschnitt 2, einsetzen — mit dem Kommentar zur
      Begehbarkeit flacher Objekte und zum Toleranzrand.

- [ ] **Step 5: `tenantBlocked` und `replaceMesh` ergänzen.**

      ```js
      /* Steckt das Tier an seinem aktuellen Platz in einem Möbel? Rein x/z,
         weil die Wackel-Animation position.y jeden Frame verändert. */
      function tenantBlocked(pick) {
        const ab = new THREE.Box3().setFromObject(pick.mesh);
        return solidBoxes(pick.k).some(bb => overlapsXZ(ab, bb));
      }
      /* Mesh aus dem entry neu setzen. Bei einem Tier bleibt position.y in der
         Hoheit der Wackel-Animation (js/game.js Render-Schleife). */
      function replaceMesh(pick) {
        const en = pick.entry;
        if (pick.tenant) { pick.mesh.position.x = en.x; pick.mesh.position.z = en.z; }
        else pick.mesh.position.set(en.x, en.y ?? baseY(pick.k), en.z);
        pick.mesh.rotation.y = en.rot ?? 0;
        clampEntry(pick.k, pick.mesh, en);
        if (selHelper && selected === pick) selHelper.update();
      }
      ```

- [ ] **Step 6: `applyMove` einfügen.** Fassung aus dem Spec, Abschnitt 3.
      `resolveItemMove` wird in Task 2 ergänzt; in diesem Task ist es zunächst
      `const resolveItemMove = () => true;` — der Möbelfall ändert sein
      Verhalten hier also noch nicht. `resolveTenantMove(pick)` ist
      `!tenantBlocked(pick)`.

- [ ] **Step 7: Debug-Hook erweitern.** `window.wipfelkratzer` um
      `solidBoxes`, `overlapsXZ`, `tenantBlocked`, `applyMove`, `addItem` und
      `floorGroups` ergänzen (`floorGroups` ist bereits exportiert).

- [ ] **Step 8: Test laufen lassen und grün sehen.** Server auf 8986, im
      Vordergrund, danach über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

---

### Task 2: Tiere weichen einem Möbel aus

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-tiere-kollision/t2_nudge.py` (Wegwerf-Test)

**Interfaces:**
- `function nudgeTenant(pick): boolean` — sucht einen freien Platz, animiert
  ihn an und schreibt ihn über `setTenantPos` fest
- `function resolveItemMove(pick): boolean` — lässt alle betroffenen Tiere
  ausweichen; meldet `false`, wenn eines nicht kann
- `addItem` und die Möbelzweige von `#btn-move`, `#btn-rot` sowie der
  Tastatursteuerung laufen über `applyMove`

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-kollision/t2_nudge.py`, Port 8987:

      ```python
      HITS = """
      const hits = (w, k) => { const T = w.THREE, out = [];
        w.tenantMeshes[k].forEach((a, i) => { const ab = new T.Box3().setFromObject(a);
          w.solidBoxes(k).forEach(bb => { if (w.overlapsXZ(ab, bb)) out.push(i); }); });
        return out; };
      """

      PUSH = """
      async () => {
        const w = window.wipfelkratzer, T = w.THREE, out = { errors: [] };
        """ + HITS + """
        const a = w.tenantMeshes[0][0], ap = a.userData.pick;
        const start = { x: ap.entry.x, z: ap.entry.z };

        // Sofa genau auf das Tier schieben.
        const sofa = w.itemMeshes[0].find(m => m.userData.pick.entry.id === 'sofa');
        const sp = sofa.userData.pick;
        const ok = w.applyMove(sp, () => { sp.entry.x = start.x; sp.entry.z = start.z; });
        if (!ok) out.errors.push('Möbelzug wurde abgelehnt, obwohl Platz frei ist');
        await new Promise(r => setTimeout(r, 500));   // Ausweich-Tween abwarten

        const h = hits(w, 0);
        if (h.length) out.errors.push('Tier steckt nach dem Möbelzug im Möbel: ' + h);
        const moved = Math.hypot(ap.entry.x - start.x, ap.entry.z - start.z);
        if (moved < 0.1) out.errors.push('Tier ist nicht ausgewichen');
        if (Math.abs(sp.entry.x - start.x) > 1e-6) out.errors.push('Das Möbel wurde zurückgesetzt statt das Tier zu bewegen');
        if (!w.state.tenantPos['0']) out.errors.push('Ausweichplatz wurde nicht gespeichert');
        out.tenantPos = JSON.parse(JSON.stringify(w.state.tenantPos));
        out.moved = moved;
        return out;
      }
      """
      ```

      Nach `PUSH` prüft das Skript über einen `page.reload()` mit demselben
      `localStorage`, dass das Tier am ausgewichenen Platz steht und `hits`
      wieder leer ist. Ein zweiter Durchgang setzt ein Möbel über den Katalog
      (`w.addItem('schrank')` nach `w.select(...)` eines Möbels in der Nähe des
      Tieres) und prüft dasselbe.

- [ ] **Step 2: Test laufen lassen und scheitern sehen.** Erwartet:
      `Tier steckt nach dem Möbelzug im Möbel`.

- [ ] **Step 3: `nudgeTenant` einfügen.**

      ```js
      /* Ausweichkandidaten: erst ein feiner Ring um den bisherigen Platz (das
         Tier soll sichtbar nur zur Seite rutschen), danach das Freiraum-Raster
         aus #14/#39. Jeder Kandidat läuft durch clampEntry, deshalb kann das
         Ausweichen nie in eine Wand führen. */
      const NUDGE_DIRS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const a = i * Math.PI / 4; return { dx: Math.cos(a), dz: Math.sin(a) }; });
      const NUDGE_STEPS = [0.18, 0.36, 0.54, 0.72];
      function nudgeTenant(pick) {
        const en = pick.entry, from = { x: en.x, z: en.z };
        const cands = [];
        NUDGE_STEPS.forEach(r => NUDGE_DIRS.forEach(d =>
          cands.push({ x: from.x + d.dx * r, z: from.z + d.dz * r })));
        tenantSpots(pick.k).forEach(s => cands.push({ x: s.x, z: s.z }));
        for (const c of cands) {
          en.x = c.x; en.z = c.z;
          clampEntry(pick.k, pick.mesh, en);
          if (tenantBlocked(pick)) continue;
          const to = { x: en.x, z: en.z };
          en.x = from.x; en.z = from.z;
          tween(0.25, q => { pick.mesh.position.x = from.x + (to.x - from.x) * q;
                             pick.mesh.position.z = from.z + (to.z - from.z) * q;
                             if (selHelper && selected === pick) selHelper.update(); },
                () => { en.x = to.x; en.z = to.z; });
          en.x = to.x; en.z = to.z;
          setTenantPos(pick.tenant.floor, pick.tenant.idx, en);
          return true;
        }
        en.x = from.x; en.z = from.z;
        replaceMesh(pick);
        return false;
      }
      ```

      Die Signatur von `tween` aus dem bestehenden Code prüfen
      (`tween(dur, step, done)`); falls kein `done`-Argument existiert, den
      Endwert am Ende des `step`-Aufrufs bei `q === 1` setzen.

- [ ] **Step 4: `resolveItemMove` ausformulieren.** Der Platzhalter aus Task 1,
      Step 6 wird ersetzt:

      ```js
      /* Ein Möbelzug lässt betroffene Tiere ausweichen. Kann eines nicht
         ausweichen, wird der ganze Zug zurückgenommen — lieber gesperrt als
         ein Tier in der Wand. */
      function resolveItemMove(pick) {
        if (pick.k === 'roof' || !tenantMeshes[pick.k]) return true;
        const moved = [];
        for (const a of tenantMeshes[pick.k]) {
          const ap = a.userData.pick;
          if (!tenantBlocked(ap)) continue;
          const snap = { x: ap.entry.x, z: ap.entry.z };
          if (nudgeTenant(ap)) { moved.push({ ap, snap }); continue; }
          moved.forEach(m => { m.ap.entry.x = m.snap.x; m.ap.entry.z = m.snap.z; replaceMesh(m.ap); });
          toast(`Hier ist kein Platz — ${TENANTS[pick.k].name} steht im Weg!`);
          return false;
        }
        return true;
      }
      ```

- [ ] **Step 5: Möbelbewegungen durch `applyMove` führen.** Vier Stellen:
      - `#btn-move` (`js/game.js:1043-1049`, Möbelzweig): die Zuweisungen von
        `en.cell`, `en.x`, `en.z`, `en.y` und `mesh.position.set` in den
        `mutate`-Rumpf von `applyMove` verschieben; `selHelper.update()`,
        `sfx.pop()` und `save()` laufen nur bei Rückgabe `true`.
      - `#btn-rot` (`js/game.js:1050-1054`, Möbelzweig): `en.rot += Math.PI / 2`
        plus `mesh.rotation.y` und `clampEntry` in `mutate`.
      - Pfeiltasten (`js/game.js:1073-1080`, Möbelzweig): `en.x/en.z`,
        `clampEntry`, `surfaceYAt`/`baseY` in `mutate`.
      - `PageUp`/`PageDown` (`js/game.js:1081-1087`, Möbelzweig): `en.rot`,
        `mesh.rotation.y`, `clampEntry` in `mutate`.

      Der Tierzweig aus #39 ruft dieselbe Funktion; dort bewirkt eine Rückgabe
      `false`, dass `setTenantPos` **nicht** aufgerufen wird (Task 3).

- [ ] **Step 6: `addItem` absichern.** In `js/game.js:680-712` nach
      `clampEntry(k, m, entry)` (`js/game.js:705`) und **vor** `select`,
      `checkTenant` und `checkWishes`:

      ```js
      if (!resolveItemMove(m.userData.pick)) {
        const arr = roomOf(k); const idx = arr.indexOf(entry); if (idx >= 0) arr.splice(idx, 1);
        parentOf(k).remove(m);
        const mi = itemMeshes[k].indexOf(m); if (mi >= 0) itemMeshes[k].splice(mi, 1);
        sfx.knock(); save(); return;
      }
      ```

      Damit erfüllt ein zurückgenommenes Möbel keinen Wunsch und löst keinen
      Einzug aus. Der Toast kommt bereits aus `resolveItemMove`.

- [ ] **Step 7: Einzug heilen.** Am Ende von `spawnTenant` (`js/game.js:759`,
      nach `tenantGroups[i] = g`) ergänzen:

      ```js
      /* tenantSpot ist eine Platzierungsheuristik, keine Kollisionsprüfung:
         in einer vollen Wohnung liefert sie trotzdem einen Punkt. Wer ohne
         gespeicherten Platz einzieht, wird darum einmal freigeräumt. Ein von
         Hand gesetzter Platz (state.tenantPos, #39) bleibt unangetastet. */
      if (!state.tenantPos[i]) tenantMeshes[i].forEach(a => {
        const ap = a.userData.pick; if (tenantBlocked(ap)) nudgeTenant(ap); });
      ```

      **Achtung:** `nudgeTenant` ruft `setTenantPos` und schreibt damit
      `state.tenantPos[i]`. Das ist gewollt (A9 im Spec) — beim nächsten Laden
      steht das Tier dort, wo es freigeräumt wurde.

- [ ] **Step 8: Test laufen lassen und grün sehen.** Server auf 8987, im
      Vordergrund, danach über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

---

### Task 3: Tiere kommen nicht ins Möbel — und der Fall «kein Platz mehr»

**Files:**
- `js/game.js`
- `.superpowers/sdd/2026-09-14-tiere-kollision/t3_block.py` (Wegwerf-Test)

**Interfaces:**
- Die Tierzweige von `#btn-move`, `#btn-rot`, Pfeiltasten und
  `PageUp`/`PageDown` (aus #39) laufen über `applyMove`; `setTenantPos` wird nur
  bei Rückgabe `true` aufgerufen.

- [ ] **Step 1: Fehlschlagenden Test schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-kollision/t3_block.py`, Port 8988:

      ```python
      BLOCK = """
      () => {
        const w = window.wipfelkratzer, T = w.THREE, out = { errors: [] };
        const a = w.tenantMeshes[0][0], ap = a.userData.pick;
        w.select(ap);

        // Tier Schritt für Schritt aufs Sofa zuschieben.
        const sofa = w.itemMeshes[0].find(m => m.userData.pick.entry.id === 'sofa');
        const sb = new T.Box3().setFromObject(sofa);
        const c = w.floorGroups[0].worldToLocal(
          new T.Vector3((sb.min.x + sb.max.x) / 2, 0, (sb.min.z + sb.max.z) / 2));
        const key = c.x > ap.entry.x ? 'ArrowRight' : 'ArrowLeft';
        const toasts0 = document.querySelectorAll('.toast-item').length;
        for (let i = 0; i < 80; i++) dispatchEvent(new KeyboardEvent('keydown', { key }));

        const ab = new T.Box3().setFromObject(a);
        if (w.solidBoxes(0).some(bb => w.overlapsXZ(ab, bb)))
          out.errors.push('Tier wurde ins Möbel geschoben');
        const toasts1 = document.querySelectorAll('.toast-item').length;
        if (toasts1 > toasts0) out.errors.push('Blockierter Tierschritt hat ' + (toasts1 - toasts0) + ' Toasts erzeugt');
        out.pos = { x: ap.entry.x, z: ap.entry.z };

        // Auch «Drehen» darf das Tier nicht in ein Möbel drehen.
        const before = a.rotation.y;
        for (let i = 0; i < 8; i++) document.getElementById('btn-rot').click();
        const ab2 = new T.Box3().setFromObject(a);
        if (w.solidBoxes(0).some(bb => w.overlapsXZ(ab2, bb)))
          out.errors.push('Drehen hat das Tier ins Möbel gedreht');
        return out;
      }
      """

      FULL = """
      async () => {
        const w = window.wipfelkratzer, T = w.THREE, out = { errors: [] };
        const sofa = w.itemMeshes[0][0], sp = sofa.userData.pick;
        const before = { x: sp.entry.x, z: sp.entry.z };
        const a = w.tenantMeshes[0][0];
        const t0 = document.querySelectorAll('.toast-item').length;
        const ok = w.applyMove(sp, () => { sp.entry.x = a.position.x; sp.entry.z = a.position.z; });
        await new Promise(r => setTimeout(r, 500));
        if (ok) out.errors.push('Möbelzug hatte Bestand, obwohl kein Ausweichplatz frei ist');
        if (Math.abs(sp.entry.x - before.x) > 1e-6 || Math.abs(sp.entry.z - before.z) > 1e-6)
          out.errors.push('Das Möbel steht nicht wieder am Ausgangsort');
        const t1 = document.querySelectorAll('.toast-item').length;
        if (t1 - t0 !== 1) out.errors.push('Erwartet genau ein Toast, bekommen: ' + (t1 - t0));
        out.toast = document.querySelector('.toast-item .toast-msg')?.textContent || '';
        return out;
      }
      """
      ```

      `BLOCK` läuft mit Spielstand A, `FULL` mit Spielstand C. Bei `FULL`
      zusätzlich prüfen, dass der Toasttext den Bewohnernamen
      «Die Kindergarten-Mäuse» enthält.

- [ ] **Step 2: Test laufen lassen und scheitern sehen.** Erwartet:
      `Tier wurde ins Möbel geschoben` — die Tierzweige aus #39 kennen
      `applyMove` noch nicht.

- [ ] **Step 3: Tierzweige über `applyMove` führen.** Vier Stellen aus #39:
      - `#btn-move`, Tierzweig: Sprung auf den Kandidaten aus `tenantSpots` in
        den `mutate`-Rumpf; `setTenantPos` und `sfx.pop()` nur bei `true`.
      - `#btn-rot`, Tierzweig: `en.rot += Math.PI / 2` in `mutate` — ein Tier
        ist nicht rotationssymmetrisch, seine Box3 ändert sich beim Drehen, also
        muss auch das Drehen geprüft werden.
      - Pfeiltasten, Tierzweig: `en.x`/`en.z` und `clampEntry` in `mutate`.
      - `PageUp`/`PageDown`, Tierzweig: analog zu `#btn-rot`.

      Muster für alle vier:

      ```js
      if (applyMove(selected, () => { /* ... */ }))
        setTenantPos(selected.tenant.floor, selected.tenant.idx, selected.entry);
      ```

      `applyMove` erledigt bei `false` bereits `sfx.knock()` und das
      Zurücksetzen; es wird **kein** Toast ausgegeben.

- [ ] **Step 4: Test laufen lassen und grün sehen.** Server auf 8988, beide
      Prüfungen (`BLOCK`, `FULL`) im Vordergrund, danach über den Port beenden.
      Ausgabe `OK`, keine `pageerror`.

---

### Task 4: Gesamtregression und Changelog

**Files:**
- `CHANGELOG.md`
- `.superpowers/sdd/2026-09-14-tiere-kollision/t4_regress.py` (Wegwerf-Test)

**Interfaces:** keine neuen.

- [ ] **Step 1: Regressionsskript schreiben.**
      `.superpowers/sdd/2026-09-14-tiere-kollision/t4_regress.py`, Port 8989.
      Es sichert die Nicht-Ziele ab:

      ```python
      REGRESS = """
      () => {
        const w = window.wipfelkratzer, T = w.THREE, out = { errors: [] };

        // 1. Möbel dürfen sich weiterhin überlappen.
        const [m1, m2] = w.itemMeshes[0];
        const p1 = m1.userData.pick, p2 = m2.userData.pick;
        const ok = w.applyMove(p2, () => { p2.entry.x = p1.entry.x; p2.entry.z = p1.entry.z; });
        if (!ok) out.errors.push('Möbel-gegen-Möbel wurde gesperrt');
        if (Math.abs(p2.entry.x - p1.entry.x) > 1e-6) out.errors.push('Möbelzug wurde zurückgenommen');

        // 2. Deko landet weiterhin auf einer Abstellfläche.
        w.select(w.itemMeshes[0].find(m => m.userData.pick.entry.id === 'tisch').userData.pick);
        w.addItem('vase');
        const vase = w.itemMeshes[0].find(m => m.userData.pick.entry.id === 'vase');
        if (!vase) out.errors.push('Vase wurde nicht gesetzt');
        else if (vase.userData.pick.entry.y <= 0.155 + 1e-6)
          out.errors.push('Vase steht auf dem Boden statt auf dem Tisch');

        // 3. Ein Tier darf auf dem Teppich stehen.
        w.deselect(); w.addItem('teppich');
        const tep = w.itemMeshes[0].find(m => m.userData.pick.entry.id === 'teppich');
        const tp = tep.userData.pick;
        const a = w.tenantMeshes[0][0];
        const ok2 = w.applyMove(tp, () => { tp.entry.x = a.position.x; tp.entry.z = a.position.z; });
        if (!ok2) out.errors.push('Teppich unter dem Tier wurde gesperrt');

        // 4. Zwei Tiere derselben Wohnung schieben sich nicht gegenseitig weg.
        const [a0, a1] = w.tenantMeshes[0];
        const d = Math.hypot(a0.position.x - a1.position.x, a0.position.z - a1.position.z);
        if (d > 1.5) out.errors.push('Die beiden Tiere sind auseinandergetrieben: ' + d);
        return out;
      }
      """
      ```

      Zusätzlich im Skript:
      - Spielstand B (`SAVE_FIXED`) laden, bei dem ein Tier laut `tenantPos` in
        einem Möbel steht, und prüfen, dass die Position nach dem Laden
        **unverändert** ist (A6 im Spec).
      - Spielstand A laden, drei weitere Möbel über den Katalog setzen und
        prüfen, dass der Einzugs-Toast und die Wunschlogik (`renderWishes`)
        weiterhin funktionieren.
      - Vollständiger Durchlauf von Issue #39s Akzeptanzkriterien in Kurzform:
        Tier antippen, verschieben, drehen, neu laden — der Platz hält.

- [ ] **Step 2: Skript laufen lassen und grün sehen.** Server auf 8989, im
      Vordergrund, danach über den Port beenden. Ausgabe `OK`, keine
      `pageerror`.

- [ ] **Step 3: Changelog ergänzen.** In `CHANGELOG.md` unter dem bestehenden
      `## [Unreleased]` / `### Added` (aus #39 bereits angelegt; sonst neu
      oberhalb von `## [0.5.0] - 2026-09-13` anlegen) ergänzen:

      ```markdown
      - Möbel und Tiere gehen sich jetzt aus dem Weg. Wer ein Möbel auf ein Tier
        schiebt, sieht das Tier zur Seite rücken; ein Tier lässt sich nicht mehr
        in ein Sofa schieben. Ist in der Wohnung wirklich kein Platz mehr frei,
        bleibt das Möbel stehen, wo es war, und sagt Bescheid — statt das Tier
        in die Wand zu drücken. Auf einem Teppich darf ein Tier weiterhin
        stehen, und Deko landet nach wie vor auf Tisch, Regal und Schrank (#40)
      ```

      `version.js` bleibt unangetastet, kein `chore(release)`-Commit.

- [ ] **Step 4: Abschlussprüfung.** `git status` zeigt ausser `js/game.js` und
      `CHANGELOG.md` nichts Verfolgtes; `.superpowers/` ist ignoriert
      (`.gitignore:5`). Den Diff auf transliterierte Umlaute (`übernehme`,
      `wären`, `möglich`) und auf `ß` durchsehen.
