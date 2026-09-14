# Spec — Tiere in der Wohnung verschieben und drehen (Issue #39)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js über Importmap.
Kein Build-Schritt, kein Test-Runner.

Quelle: Feedback-Triage 12.09.2026, Eintrag 08 — Block C.

## Problem

Tiere sind keine auswählbaren Objekte. `spawnTenant` baut pro Bewohner-Eintrag
eine `THREE.Group`, hängt die einzelnen Tiere hinein, registriert sie in
`critters` für die Wackel-Animation und hängt die Gruppe an `floorGroups[i]`
(`js/game.js:750-763`). Dabei entsteht **kein** `userData.pick`, nichts landet
in `itemMeshes[k]` (`js/game.js:462` ist der einzige Ort, der dort einträgt).

Der Auswahl-Raycast im Einrichten-Modus prüft die Bewohnergruppe zwar, aber nur
um die Sprechblase zu öffnen, und bricht danach ab — die Möbel-Auswahl darunter
wird gar nicht mehr erreicht:

```js
const tg = edit.k !== 'roof' && tenantGroups[edit.k] ? [tenantGroups[edit.k]] : [];
if (tg.length && ray.intersectObjects(tg, true).length) { tenantTalk(edit.k); return; }
const hits = ray.intersectObjects(itemMeshes[edit.k], true);
```
(`js/game.js:1000-1002`)

Damit greift die gesamte bestehende Bearbeitungsmechanik nicht: `select`
(`js/game.js:672-678`), die Auswahlleiste `#selbar` (`index.html:187-197`),
«Verschieben» (`js/game.js:1043-1049`), «Drehen» (`js/game.js:1050-1054`), die
Pfeiltasten und `PageUp`/`PageDown` (`js/game.js:1069-1090`) und die Begrenzung
`clampEntry` (`js/game.js:427-446`).

Drei Dinge machen das nicht trivial:

1. **Tiere sind keine Möbel.** `state.rooms[k]` ist die Möbelliste, und ihre
   Länge entscheidet, ob überhaupt jemand einzieht:
   `const tenantIn = i => i <= state.floors && roomOf(i).length >= 3;`
   (`js/game.js:44`). Ein Tier als Eintrag in derselben Liste wäre zirkulär —
   das Tier existiert, *weil* drei Möbel dastehen, und würde selbst als eines
   davon zählen.
2. **Tiere bewegen sich schon von selbst.** Die Wackel-Animation schreibt jeden
   Frame direkt in die Position:
   `critters.forEach(c => { c.g.position.y = c.base + Math.abs(Math.sin(t * 2.2 + c.ph)) * 0.03; });`
   (`js/game.js:1208`).
3. **Seit #14 suchen Tiere sich ihren Platz selbst.** `tenantSpot(k)` wählt aus
   einem 5×3-Raster den Punkt mit dem grössten Abstand zum nächsten Möbel
   (`js/game.js:724-748`), und `spawnTenant` ruft das bei **jedem** Laden neu
   auf (`js/game.js:754`, Ladepfad `js/game.js:1184`). Eine von Hand gesetzte
   Position würde beim nächsten Neuladen überschrieben.

## Goals

- Ein Tier im Einrichten-Modus antippen wählt es aus — mit derselben
  Auswahlleiste und demselben roten Auswahlrahmen wie ein Möbel.
- Ein ausgewähltes Tier lässt sich **verschieben** (Knopf «Verschieben»,
  Pfeiltasten) und **drehen** (Knopf «Drehen», `PageUp`/`PageDown`).
- Die Wackel-Animation läuft unverändert weiter, auch am neuen Platz.
- Eine von Hand gesetzte Position überlebt das Neuladen und schaltet die
  automatische Platzsuche für diese Wohnung ab.
- Alte Spielstände laden unverändert; Tiere ohne gespeicherte Position werden
  weiterhin über `tenantSpot` platziert.
- Ein Tier lässt sich **nicht** löschen.

## Non-goals

- **Keine Kollisionserkennung.** Ein Tier darf nach dieser Änderung weiterhin in
  einem Sofa stehen — das ist Issue #40 und baut auf dieser Änderung auf.
- Kein Umziehen zwischen Stockwerken. Ein Tier bleibt in seiner Wohnung.
- Kein Verschieben ausserhalb des Einrichten-Modus (im freien Blick bleibt der
  Tipp auf ein Tier die Sprechblase, `js/game.js:1018-1024`).
- Keine Tiere auf der Dachterrasse — dort gibt es keine Bewohner
  (`tenantGroups` existiert nur für Stockwerke, `js/game.js:299`).
- Kein «Zurück zur Automatik»-Knopf (A6).
- Keine Änderung an `version.js` und kein `chore(release)`-Commit.

## Design

### 1. Tiere bekommen eine eigene Struktur, keinen `state.rooms`-Eintrag

Neues Spielstand-Feld, parallel zu `state.rooms`:

```js
/* Von Hand gesetzte Tierplätze. Schlüssel = Stockwerk, Wert = ein Eintrag pro
   Tier der Wohnung, in der Reihenfolge von TENANTS[i].animals. Fehlt der
   Eintrag, platziert tenantSpot() automatisch (Verhalten aus #14). */
tenantPos: {}   // { [floor]: Array<{ x, z, rot }> }
```

Ergänzt `state` (`js/game.js:35`). Alte Stände ohne das Feld laden
unverändert, weil `Object.assign` den Default `{}` stehen lässt
(`js/game.js:36`), und `save()` serialisiert `{ ...state }` ohnehin mit
(`js/game.js:38-42`).

### 2. Das Tier-Mesh trägt ein `userData.pick` wie ein Möbel

`spawnTenant` hängt an jedes Tier-Mesh dieselbe Struktur, die Möbel in
`placeItemMesh` bekommen (`js/game.js:461`), plus eine Kennzeichnung:

```js
a.userData.pick = { k: i, entry, mesh: a, tenant: { floor: i, idx: n } };
```

`entry` ist `{ x, z, rot, manual }` — **ohne** `id`. Das ist Absicht: der
bestehende Code fragt `id` nur über Set-Mitgliedschaft ab
(`DECO.has(en.id)`, `WALL_ITEMS.has(en.id)`, `js/game.js:419, 428, 1043`), und
`Set.has(undefined)` ist `false`. Ein Tier verhält sich damit überall wie ein
gewöhnliches Bodenmöbel, ohne dass eine einzige dieser Abfragen angepasst
werden muss.

Die Meshes kommen in eine eigene Registry `tenantMeshes[k]`, **nicht** in
`itemMeshes[k]` — dort würden sie `surfaceYAt` (`js/game.js:415-426`) als
Abstellfläche und `tenantSpot` (`js/game.js:728-732`) als Hindernis fehldeuten
und `freeCell`/`removeItem` (`js/game.js:466-469, 713-720`) durcheinander
bringen.

### 3. Auswahl: der Tipp wählt aus *und* lässt reden

Der Zweig in `pointerup` (`js/game.js:1000-1001`) trifft heute die ganze
Bewohnergruppe und ruft `tenantTalk`. Neu wird das getroffene Tier ermittelt,
ausgewählt **und** die Sprechblase gezeigt — ein Tipp, beide Wirkungen, nichts
geht verloren:

```js
if (tenantMeshes[edit.k] && tenantMeshes[edit.k].length) {
  const th = ray.intersectObjects(tenantMeshes[edit.k], true);
  if (th.length) { let o = th[0].object; while (o && !(o.userData && o.userData.pick)) o = o.parent;
    if (o) { select(o.userData.pick); tenantTalk(edit.k); return; } }
}
```

`select` blendet zusätzlich «Weg damit» aus, wenn ein Tier gewählt ist
(`$('btn-del').classList.toggle('hidden', !!pick.tenant)`) — ein Tier kann nicht
weggeworfen werden.

### 4. Bewegen: x/z gehören dem Kind, y gehört der Animation

Die Zuständigkeiten werden sauber getrennt:

| Achse | Wer schreibt | Wo |
| --- | --- | --- |
| `x`, `z`, `rotation.y` | Auswahlleiste / Tastatur | `js/game.js:1043-1054, 1069-1090` |
| `position.y` | Wackel-Animation | `js/game.js:1208` |

Das ist konfliktfrei, weil `critters` ausschliesslich `position.y` setzt und
`c.base` beim Spawn festgehalten wird (`js/game.js:758`) — ein Ortswechsel
ändert die Basishöhe nicht, `baseY(i)` ist im Stockwerk konstant
(`js/game.js:364`).

`clampEntry(k, mesh, entry)` funktioniert unverändert für Tiere: es misst die
Box3 des Meshes und klemmt gegen die Raumgrenzen (`js/game.js:437-443`). Es
schreibt dabei auch `position.y = en.y ?? baseY(k)` — harmlos, weil die
Animation im nächsten Frame ohnehin ihren Wert setzt.

Einzige nötige Ausnahme im bestehenden Code: der Pfeiltasten-Zweig setzt
`en.y`/`mesh.position.y` über `surfaceYAt` bzw. `baseY` (`js/game.js:1077-1078`).
Für Tiere wird dieser Schritt übersprungen.

«Verschieben» kann für Tiere nicht die Möbelraster-Zelle nutzen (`freeCell`
zählt Möbelplätze, `js/game.js:466`). Stattdessen wird `tenantSpot` in
`tenantSpots(k)` aufgetrennt — dieselbe Berechnung, aber die vollständige, nach
Abstand absteigend sortierte Kandidatenliste; `tenantSpot(k)` ist danach
`tenantSpots(k)[0]`, das Verhalten aus #14 bleibt bitgleich. «Verschieben»
springt zum besten Kandidaten, der mindestens 0.4 vom aktuellen Platz entfernt
ist, sonst zum besten überhaupt.

### 5. Automatik abschalten — pro Wohnung, nicht pro Tier

Sobald ein Tier von Hand bewegt oder gedreht wurde, schreibt
`setTenantPos(i, n, entry)` den Platz in `state.tenantPos[i]`. Dabei werden die
Plätze **aller** Tiere derselben Wohnung festgeschrieben, auch der nicht
bewegten:

```js
function setTenantPos(i, n, en) {
  const arr = state.tenantPos[i] || (state.tenantPos[i] = []);
  tenantMeshes[i].forEach((m, j) => { if (!arr[j]) { const e = m.userData.pick.entry;
    arr[j] = { x: +e.x.toFixed(3), z: +e.z.toFixed(3), rot: +e.rot.toFixed(3) }; } });
  arr[n] = { x: +en.x.toFixed(3), z: +en.z.toFixed(3), rot: +en.rot.toFixed(3) };
  en.manual = true; save();
}
```

Sonst käme es zum halb automatischen Zustand: das bewegte Tier bliebe stehen,
sein Mitbewohner würde beim nächsten Laden zu einem neuen `tenantSpot` springen
und womöglich ins erste hineinlaufen (A3).

`spawnTenant` liest die gespeicherten Plätze, bevor es auf die Automatik
zurückfällt:

```js
const saved = state.tenantPos[i];
const spot = saved ? null : tenantSpot(i);
t.animals.forEach((sp, n) => {
  const man = saved && saved[n];
  const entry = man
    ? { x: man.x, z: man.z, rot: man.rot, manual: true }
    : { x: spot.x + (n - (t.animals.length - 1) / 2) * 0.55, z: spot.z,
        rot: (n - 0.5) * 0.5, manual: false };
  ...
});
```

Der automatische Zweig bleibt damit rechnerisch identisch zu heute
(`js/game.js:755-757`).

### 6. Auswahlrahmen folgt dem Wackeln

`selHelper` ist ein `THREE.BoxHelper`, der sich nur auf `update()` neu misst
(`js/game.js:673`). Bei einem wackelnden Tier stünde der Rahmen sonst leicht
daneben. Eine Zeile in der Render-Schleife genügt:

```js
if (selHelper && selected && selected.tenant) selHelper.update();
```

## Assumptions

- **A1** [high] Tiere werden **nicht** zu Einträgen in `state.rooms`, sondern
  bekommen mit `state.tenantPos` eine eigene Struktur. Verworfen: Tier als
  regulärer `entry` in `state.rooms[k]`. Grund: `tenantIn` zählt genau diese
  Liste und macht daraus die Einzugsbedingung — `const tenantIn = i => i <= state.floors && roomOf(i).length >= 3;`
  (`js/game.js:44`); zusätzlich würde `placeItemMesh` versuchen, das Tier über
  `makeFurniture(entry.id)` zu bauen (`js/game.js:449`), und `removeItem` könnte
  es löschen (`js/game.js:713-720`).
- **A2** [high] Die Tier-Meshes kommen in eine eigene Registry
  `tenantMeshes[k]`, nicht in `itemMeshes[k]`. Verworfen: Tiere in
  `itemMeshes[k]` einhängen, um den bestehenden Auswahl-Raycast unverändert zu
  lassen. Grund: `surfaceYAt` iteriert `itemMeshes[k]` und würde ein Tier als
  Abstellfläche für Deko anbieten (`js/game.js:419-423`), `tenantSpot` würde es
  als Möbel-Hindernis werten (`js/game.js:728-732`).
- **A3** [med] Bewegt das Kind **ein** Tier, werden die Plätze **aller** Tiere
  derselben Wohnung festgeschrieben. Verworfen: nur das bewegte Tier
  festschreiben. Grund: `spawnTenant` berechnet `tenantSpot(i)` einmal für die
  ganze Wohnung und verteilt die Tiere mit festem Versatz darum
  (`js/game.js:754-756`); ein halb automatischer Zustand hätte beim nächsten
  Laden zwei Tiere an unvorhersehbaren Stellen.
- **A4** [med] Der Tipp auf ein Tier **wählt es aus und zeigt zusätzlich die
  Sprechblase**. Verworfen: Auswahl ersetzt die Sprechblase. Grund: die
  Sprechblase ist heute die einzige Rückmeldung im Einrichten-Modus
  (`js/game.js:1001` → `tenantTalk`, `js/game.js:959-967`) und transportiert den
  offenen Wunsch; sie ersatzlos zu streichen wäre ein Funktionsverlust.
- **A5** [high] Ein ausgewähltes Tier zeigt **kein** «Weg damit». Verworfen:
  Knopf aktiv lassen. Grund: `removeItem` arbeitet auf `state.rooms` und
  `itemMeshes` (`js/game.js:713-719`) — für ein Tier gibt es dort nichts zu
  löschen, und ein löschbarer Bewohner widerspräche dem Einzugsmodell
  (`js/game.js:764`).
- **A6** [med] Es gibt **keinen** «Zurück zur Automatik»-Knopf. Verworfen: ein
  dritter Knopf in `#selbar`. Grund: `#selbar` trägt heute drei Elemente
  (`index.html:187-197`) und jeder Knopf braucht 44 px Trefferfläche
  (`index.html:73`); der Automatikzustand ist für ein Kind kein sichtbares
  Konzept. Rückweg bleibt: Tier wieder von Hand an die gewünschte Stelle
  schieben.
- **A7** [low] Die manuelle Position wird auf drei Nachkommastellen gerundet
  gespeichert. Verworfen: volle Gleitkommagenauigkeit. Grund: der Spielstand
  liegt als JSON in `localStorage` (`js/game.js:41`), und ein Tierplatz braucht
  keine Millimetergenauigkeit.
- **A8** [low] «Verschieben» springt für ein Tier zum nächstbesten Rasterpunkt
  aus `tenantSpots(k)` statt zur nächsten Möbelzelle. Verworfen:
  `freeCell`/`cellPos` mitbenutzen. Grund: `freeCell` verwaltet Möbelplätze über
  `entry.cell` (`js/game.js:466-469`), das ein Tier nicht besitzt; das
  5×3-Raster aus #14 ist bereits die Tier-Heuristik (`js/game.js:724-748`).

## Consequences

- `state` bekommt ein neues Feld; der Spielstandschlüssel `wipfelkratzer-v1`
  bleibt (`js/game.js:41`), alte Stände laden ohne Migration.
- Der Raycast-Zweig für Bewohner in `pointerup` (`js/game.js:1000-1001`) ändert
  sein Verhalten: aus «reden» wird «auswählen und reden».
- `tenantSpot(k)` wird zu einem Einzeiler über `tenantSpots(k)`; #40 kann die
  sortierte Kandidatenliste direkt für die Ausweichsuche weiterverwenden.
- Ein Tier kann nach dieser Änderung von Hand **in** ein Möbel geschoben
  werden. Das ist bewusst offen und genau der Auftrag von #40.
- `tenantMeshes` ist eine zweite Mesh-Registry neben `itemMeshes`; jeder neue
  Code, der «alle antippbaren Dinge im Raum» braucht, muss beide lesen.

## Acceptance Criteria

- [ ] Im Einrichten-Modus wählt ein Tipp auf ein Tier dieses aus: roter
      Auswahlrahmen sichtbar, `#selbar` offen — und die Sprechblase erscheint.
- [ ] Bei ausgewähltem Tier sind «Verschieben» und «Drehen» sichtbar,
      «Weg damit» ist ausgeblendet, das Wand-Steuerkreuz `#wallpad` ebenfalls.
- [ ] «Verschieben» setzt das Tier sichtbar an eine andere Stelle im Raum,
      innerhalb der Raumgrenzen.
- [ ] «Drehen» dreht das Tier um 90°; `PageUp`/`PageDown` drehen fein.
- [ ] Die Pfeiltasten verschieben das ausgewählte Tier in Schritten von 0.12
      und lassen es nicht durch eine Wand.
- [ ] Das Tier wackelt nach dem Verschieben weiter (`position.y` schwankt), und
      seine x/z bleiben dabei unverändert.
- [ ] Nach `location.reload()` steht das Tier an der von Hand gesetzten Stelle
      und in der gesetzten Drehung — nicht an `tenantSpot`.
- [ ] Ein Spielstand ohne `tenantPos` platziert die Tiere wie heute über
      `tenantSpot`; die berechnete Position ist identisch zur Version vor der
      Änderung.
- [ ] Ein nie von Hand bewegtes Tier schreibt **nichts** nach
      `state.tenantPos`.
- [ ] Ein Tier ist nicht löschbar: weder über `#btn-del` noch über die
      `Delete`-Taste verschwindet es.
- [ ] Ausserhalb des Einrichten-Modus öffnet ein Tipp auf ein Tier weiterhin nur
      die Sprechblase (Durchblick-Modus, `state.cutaway`).
- [ ] `version.js` ist unverändert, `CHANGELOG.md` hat einen Eintrag unter
      `## [Unreleased]` / `### Added` mit `(#39)`.
- [ ] Null `pageerror` im Playwright-Lauf.
