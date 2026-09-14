# Spec — Spielplatz-Objekte platzieren, verschieben, drehen (Issue #38)

Repo: `game-wipfelkratzer`. Basis: `main`, v0.5.0 (`version.js`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js über Importmap.
Kein Build-Schritt, kein Test-Framework, keine Unit-Test-Suite. UI einsprachig
Deutsch (`ls js/` zeigt nur `game.js` und `models.js`).

## Problem

`makeGarden()` (`js/models.js:461-486`) baut ein **einziges** Objekt: Schaukel,
Rutsche, Sandkasten, Hochbeet und eine Reihe aus acht Blumen hängen als
Untergruppen an einer gemeinsamen Gruppe. Diese Gruppe wird einmal gesetzt und
nie wieder angefasst:

```js
const garden = makeGarden(); garden.position.set(-8, 0, 2); garden.rotation.y = 0.5; garden.visible = state.garden; scene.add(garden);
```
(`js/game.js:127`)

Der einzige Zustand dazu ist ein Boolean: `state.garden`
(`js/game.js:34`), gesetzt von `$('btn-garden').onclick` (`js/game.js:825-830`),
das bei bereits gebautem Spielplatz nur noch «Garten und Spielplatz sind schon
da!» meldet. Es gibt draussen weder Auswahl noch Verschieben noch Drehen.

Drinnen existiert die komplette Mechanik bereits, aber ausschliesslich für
Etagen und die Dachterrasse:

- Auswahl über den Raycast auf `itemMeshes[edit.k]` und das Hochlaufen zu
  `userData.pick` (`js/game.js:1002-1004`), gesetzt in `placeItemMesh()`
  (`js/game.js:461`).
- Auswahlleiste `#selbar` mit «Verschieben» (`js/game.js:1044-1050`, springt
  über `freeCell`/`cellPos` in die nächste freie Zelle), «Drehen»
  (`js/game.js:1051-1055`, 90°-Schritte) und «Weg damit»
  (`js/game.js:715-721`). Tastatur: Pfeile verschieben, Bild-Tasten drehen fein
  (`js/game.js:1069-1090`).
- Begrenzung über `clampEntry()` (`js/game.js:427-446`): rechteckiger Raum aus
  `W(k)`/`D(k)` bzw. `ROOF_W`/`ROOF_D`, abzüglich der halben Objekt-Box3.
- Speicherung als Einträge `{ id, cell, x, z, y, rot }` in `state.rooms[k]`
  (`js/game.js:43`, `js/game.js:704-712`), Rehydrierung beim Laden
  (`js/game.js:1177-1184`).

Diese Mechanik hängt an drei Dingen, die es draussen nicht gibt: an einem
Zimmer (`floorGroups[k]`), an Zellen (`cellPos`, `colsOf`) und an Wänden
(`clampEntry`, `wallPlacement`). Ohne Ersatz landen Objekte im Bach, im
Baumstamm oder unter dem Turm.

### Was draussen tatsächlich im Weg steht

| Hindernis | Wo es im Code steht | Lage beim Garten |
| --- | --- | --- |
| Bach | `riverZ = x => 9 + Math.sin(x * 0.18) * 2.4` (`js/game.js:86`), drei Bänder: Kies 5.6 breit, Wasser 3.6, Strömung 1.5 (`js/game.js:99-101`) | Wasserkante bei `x ≈ -8.7` auf `z ≈ 4.80`, Kieskante auf `z ≈ 3.80` |
| Bäume | Beide Baumschleifen überspringen `Math.hypot(x + 8, z - 2) < 5.5` (`js/game.js:106`, `js/game.js:116`) | Um `(-8, 2)` liegt eine **baumfreie Lichtung mit Radius 5.5** — genau dort steht der Garten |
| Turmsockel | Plattform `9.8 × 6.8` um den Ursprung (`js/game.js:130`), Stützen bei `x = ±4`, `z = ±2.4` mit Fussradius 0.7 (`js/game.js:131-132`) | Plattformkante bei `x = -4.9`, nächster Stamm bei `x = -4.7` |

Die Lichtung ist also bereits im Code definiert; der Bach schneidet sie im
Norden an, der Turm im Osten. Dass das heute nicht sauber ist, zeigt die
Blumenreihe: die linkeste Blume steht bei Weltkoordinate
`(-9.55, 5.01)` — das ist **im Wasser** (Wasserkante dort `z ≈ 4.82`).

## Entscheidung

### 1. Der Spielplatz wird ein vierter «Raum»

Statt einer eigenen Auswahl-/Bewegen-Mechanik für draussen bekommt der
Spielplatz denselben Schlüssel-Mechanismus, den die Dachterrasse schon benutzt:
`edit.k === 'garten'`. `state.rooms` hat mit `'roof'` bereits einen nicht
numerischen Schlüssel (`js/game.js:1178`), `parentOf()`, `baseY()`, `dims()`
und `clampEntry()` verzweigen bereits auf `k === 'roof'`
(`js/game.js:358-362`, `js/game.js:427-446`). Es kommt je ein `'garten'`-Zweig
dazu — damit funktionieren Auswahl, `#selbar`, Tastatur, Löschen, Speichern und
Rehydrieren **ohne eigenen Code**.

### 2. Die Gartengruppe wird entdreht

`gartenG` steht weiterhin bei `(-8, 0, 2)`, aber mit `rotation.y = 0` statt
0.5. Die alte Gruppendrehung wird in die einzelnen Objekte hineingerechnet
(Position mit `R_y(0.5)` gedreht, `rot += 0.5`), sie stehen also weiterhin
schräg zum Bach wie bisher. Gewinn: die Spielfläche ist achsenparallel zur
Welt, damit direkt mit `riverZ(x)` und der Turmplattform vergleichbar — und
`cellPos()` (`js/game.js:360-363`) rechnet ohnehin symmetrisch um den
Gruppenursprung, was eine schiefe Fläche nicht hergibt.

### 3. Die Spielfläche

```js
const GARDEN_POS = new THREE.Vector3(-8, 0, 2);
const GARDEN_W = 5.4, GARDEN_D = 5.0;   /* Halbmasse 2.7 / 2.5 */
```

Damit gilt in Weltkoordinaten `x ∈ [-10.7, -5.3]`, `z ∈ [-0.5, 4.5]`. Geprüft
gegen alle drei Hindernisse:

- **Bäume:** grösster Eckabstand zum Lichtungsmittelpunkt `hypot(2.7, 2.5) =
  3.68 < 5.5` — die Fläche liegt vollständig in der baumfreien Lichtung
  (`js/game.js:106`).
- **Bach:** `riverZ` hat im Bereich `x ∈ [-10.7, -5.3]` sein Minimum bei
  `x ≈ -8.73` mit `riverZ = 6.60`; die Wasserkante liegt dort bei `4.80`, die
  Flächenkante bei `4.50`. **0.30 Abstand zum Wasser**, im ungünstigsten
  Schnitt. Der Kiesstreifen (Kante `3.80`) darf bespielt werden — Kies ist
  Boden, Wasser nicht.
- **Turm:** `x ≤ -5.3`, Plattformkante `-4.9`, nächster Stammfuss `-4.7` —
  **0.40 Abstand**, und `clampEntry()` zieht zusätzlich die halbe Objektbreite
  ab, sodass kein Objekt die Plattform berührt.

Die Begrenzung ist damit **ein einziger Mechanismus** (dasselbe Rechteck-Clamp
wie drinnen, nur mit anderen Halbmassen), und die Sicherheit gegen Wasser,
Stamm und Turm steckt in den zwei Zahlen, die die Verifikation gegen `riverZ`
und die Lichtungsformel nachrechnet.

### 4. Die fünf Objekte

`makeGarden()` wird in fünf `FURN`-Einträge zerlegt — Geometrie **unverändert**
übernommen, nur der Gruppenursprung wandert in jedes Objekt:

| id | Name im Katalog | Herkunft |
| --- | --- | --- |
| `schaukel` | Schaukel | `js/models.js:463-467` |
| `rutsche` | Rutsche | `js/models.js:468-472` |
| `sandkasten` | Sandkasten | `js/models.js:473-477` |
| `hochbeet` | Hochbeet | `js/models.js:478-480` |
| `blumen` | Blumen | `js/models.js:481-484`, auf ein Büschel aus drei Blumen eingekürzt |

Sie kommen in `CATALOG` mit der neuen Kategorie `garten` (`CATS`), damit
`makeFurniture()` (`js/models.js:309`), `makeThumbs()` (`js/game.js:529-551`),
`renderCatalog()` (`js/game.js:552-601`), `addItem()` (`js/game.js:679-714`)
und `placeItemMesh()` (`js/game.js:447-470`) sie ohne Sonderfall tragen.
`makeGarden()` entfällt; einziger Aufrufer ist `js/game.js:127`.

### 5. Spielstand

`state.garden` (Boolean) bleibt genau das, was es heute ist: «Ist der
Spielplatz schon gebaut?» — es steuert weiter `gartenG.visible` und den
Extras-Knopf. Die Objekte liegen in `state.rooms.garten`, in exakt derselben
Eintragsform wie drinnen.

Migration nach dem Vorbild der Tapeten-Migration (`js/game.js:379-390` mit dem
`migrated`-Flag und dem einmaligen `save()` in `js/game.js:1186`):

```js
/* Alte Stände kennen nur den Boolean. Steht der Spielplatz, wird das feste
   Ensemble einmalig in einzelne Objekte übersetzt — danach ist state.rooms.garten
   die Wahrheit, auch wenn es leer ist (alles weggeräumt ist ein gültiger Zustand). */
function migrateGarden() {
  if (Array.isArray(state.rooms.garten)) return;
  state.rooms.garten = state.garden ? GARDEN_DEFAULT.map(e => ({ ...e })) : [];
  migrated = true;
}
```

Entscheidend ist `Array.isArray`, nicht Wahrheitswert: ein leerer Spielplatz
(alle Objekte gelöscht) darf beim nächsten Laden **nicht** neu bestückt werden.

`GARDEN_DEFAULT` sind die aus der heutigen Anordnung umgerechneten Positionen
(Gruppenkoordinaten, `y = 0`):

| id | x | z | rot | Herkunft (alt, vor Entdrehung) |
| --- | --- | --- | --- | --- |
| `schaukel` | -1.70 | 1.50 | 0.50 | `(-2.2, 0.5)`, rot 0 |
| `rutsche` | 0.30 | 0.15 | 0.00 | `(0.2, 0.3)`, rot -0.5 |
| `sandkasten` | 1.90 | -0.50 | 0.50 | `(2.2, 0.6)`, rot 0 |
| `hochbeet` | 1.35 | 1.60 | 0.65 | `(0.4, 2.1)`, rot 0.15 |
| `blumen` | -0.75 | 2.00 | 0.50 | Blume 1 der alten Reihe |
| `blumen` | 1.05 | 1.05 | 0.20 | Blume 4 der alten Reihe |
| `blumen` | 2.25 | 0.35 | 0.80 | Blume 7 der alten Reihe |

Das Bild bleibt praktisch dasselbe; nur die Blumen rücken vom Bach weg — sie
standen bisher zum Teil im Wasser (siehe Problembeschreibung).

### 6. Hineinkommen und Begrenzung sehen

- Ein unsichtbarer Quader (`GARDEN_W × 1.6 × GARDEN_D`) in `gartenG` mit
  `userData.type = 'garten'` hängt sich in den bestehenden Raycast
  (`js/game.js:1013`) ein: Antippen des Spielplatzes öffnet
  `enterEdit('garten')` — dasselbe Muster wie `{ type: 'roof' }`
  (`js/game.js:305`).
- `$('btn-garden')` (`js/game.js:825-830`) baut den Spielplatz wie bisher; ist
  er schon da, öffnet der Knopf jetzt den Einrichten-Modus, statt nur «ist
  schon da» zu melden.
- Solange draussen eingerichtet wird, zeigt eine flache Holzkante (vier dünne
  `MAT.woodL`-Boxen bei `y = 0.03`) die Spielfläche. Sonst ist sie unsichtbar —
  die Szene sieht ausserhalb des Einrichtens exakt aus wie heute.

## Goals

- Jedes der fünf Spielplatz-Objekte lässt sich einzeln auswählen, verschieben,
  drehen, löschen und neu hinzufügen — mit derselben Leiste und denselben
  Tasten wie drinnen.
- Position und Drehung überleben das Neuladen.
- Kein Objekt kann im Wasser, im Baum oder unter dem Turm landen.
- Alte Spielstände (nur `garden: true/false`) laden unverändert und sehen nach
  der Migration praktisch aus wie vorher.
- Beim Bau des Spielplatzes und ausserhalb des Einrichtens ändert sich optisch
  nichts.

## Non-Goals

- **Eintrag 08 (Tiere verschiebbar)** bleibt offen. Willi, Móki und die
  Bewohner sind keine `CATALOG`-Objekte und hängen nicht an `itemMeshes`
  (`js/game.js:123-125`, `js/game.js:744-757`).
- Brücke (`js/game.js:126`), Biberburg (`js/game.js:102`), Schild
  (`js/game.js:122`) und die Bäume bleiben unbeweglich.
- Kein Ziehen mit dem Finger. Verschoben wird wie drinnen: «Verschieben»
  springt in die nächste freie Zelle, die Pfeiltasten schieben fein.
- Keine neuen Materialien, keine neuen Modelle — die fünf Objekte sind die
  bestehende Geometrie aus `makeGarden()`.
- Keine Tapeten/Böden draussen; die Kategorien `farbe`/`boden` sind im
  Spielplatz-Katalog nicht sichtbar.
- Kein Wunsch- oder Bewohner-Mechanismus draussen (`TENANTS` bleibt
  unverändert).
- **Keine Versionsanhebung.** `version.js` wird nicht angefasst, kein
  `chore(release)`-Commit; der Changelog-Eintrag geht unter `[Unreleased]`.

## Assumptions

- **A1** [high] Der Spielplatz wird über den Schlüssel `edit.k === 'garten'` in
  die bestehende Einrichten-Mechanik gehängt, statt eine zweite Mechanik für
  draussen zu bauen. Verworfen: eigener Auswahl-/Bewegen-Code im Freien
  (dupliziert `select`/`clampEntry`/`#selbar`, `js/game.js:671-678`,
  `js/game.js:427-446`, `index.html:187-196`). Beleg, dass nicht numerische
  Schlüssel bereits getragen werden: `js/game.js:301` (`itemMeshes.roof`),
  `js/game.js:1178`.
- **A2** [high] Die Objekte liegen in `state.rooms.garten` mit demselben
  Eintragsformat wie drinnen (`{ id, cell, x, z, y, rot }`), nicht in einem
  eigenen `state.gardenItems`. Verworfen: eigene Struktur — sie bräuchte
  eigenes Speichern, eigenes Rehydrieren und eigenes Löschen. Beleg für das
  bestehende Format: `js/game.js:683`, `js/game.js:1177-1184`.
- **A3** [high] `state.garden` bleibt als Boolean erhalten und behält seine
  Bedeutung («Spielplatz gebaut?»). Verworfen: `state.garden` durch die Liste
  ersetzen — dann wäre «gebaut, aber leergeräumt» nicht mehr von «nie gebaut»
  unterscheidbar, und `js/game.js:826-830` (Extras-Knopf, Aufbau-Animation)
  müsste umgeschrieben werden.
- **A4** [high] Die Migration prüft auf `Array.isArray(state.rooms.garten)`,
  nicht auf Wahrheitswert, und läuft über das bestehende `migrated`-Flag
  (`js/game.js:379`, `js/game.js:1186`). Verworfen: `if
  (!state.rooms.garten.length)` — das würde einen leergeräumten Spielplatz bei
  jedem Laden neu bestücken.
- **A5** [med] Die Spielfläche ist ein achsenparalleles Rechteck
  `5.4 × 5.0` um `(-8, 0, 2)`, und `gartenG.rotation.y` wird dafür von 0.5 auf
  0 gesetzt, mit der Drehung hineingerechnet in die Startpositionen.
  Verworfen: Rechteck in den gedrehten Gruppenkoordinaten (dann ist die
  Bachkante keine Rechteckkante mehr — die am weitesten aussen liegende Ecke
  läge im Wasser, gerechnet mit `riverZ`, `js/game.js:86`) und ein Kreis um den
  Lichtungsmittelpunkt (schneidet bei jedem brauchbaren Radius den Bach, weil
  `riverZ(-8) ≈ 6.62` bei 1.8 Wasserhalbbreite nur `z ≤ 4.82` zulässt).
- **A6** [med] Die Kieskante des Bachs darf bespielt werden, die Wasserkante
  nicht. Die Flächenkante `z = 4.5` hält 0.30 Abstand zum Wasser
  (`riverZ`-Minimum 6.60 bei `x ≈ -8.73`, minus 1.8 Wasserhalbbreite,
  `js/game.js:100`) und liegt bis zu 0.7 auf dem Kies (`js/game.js:99`).
  Verworfen: auch den Kies sperren (`z ≤ 3.5`) — das nimmt gut einen Fünftel
  der Fläche und schiebt das Hochbeet von seinem heutigen Platz.
- **A7** [med] `makeGarden()` wird ersatzlos entfernt und durch fünf
  `FURN`-Einträge mit der Kategorie `garten` ersetzt. Verworfen: `makeGarden()`
  als Komposition der fünf neuen Bauteile stehen lassen — es hätte nach dem
  Umbau keinen Aufrufer mehr (einziger heute: `js/game.js:127`).
- **A8** [med] Die acht Blumen der alten Reihe (`js/models.js:481-484`) werden
  zu **einem** Objekt «Blumen» aus drei Blumen, von dem drei Stück
  vorplatziert werden. Verworfen: die ganze Reihe als ein Objekt (5.6 breit —
  breiter als die halbe Spielfläche, nach jedem Clamp verschoben) und jede
  Blume einzeln (acht Objekte, die ein Kind einzeln anfassen muss).
- **A9** [med] Verschoben wird mit den bestehenden Bedienelementen:
  «Verschieben» springt über `freeCell`/`cellPos` (`js/game.js:1044-1050`) in
  die nächste freie Zelle des Rasters, das `dims('garten')` aufspannt; die
  Pfeiltasten schieben fein (`js/game.js:1071-1078`). Verworfen: ein eigenes
  Richtungskreuz für draussen (neues UI, neue Trefferflächen) und Ziehen mit
  dem Finger (kollidiert mit `OrbitControls`, `js/game.js:57-61`).
- **A10** [med] In den Spielplatz-Modus kommt man per Tipp auf die Fläche
  (unsichtbarer Quader mit `userData.type = 'garten'`, Muster wie
  `js/game.js:305`) **und** über «Garten & Spielplatz» im Extras-Menü, das bei
  schon gebautem Spielplatz statt der Meldung den Einrichten-Modus öffnet
  (`js/game.js:825-830`). Verworfen: nur der Extras-Knopf (draussen tippt ein
  Kind auf das Ding, das es meint) und ein eigener Knopf in `#toolbar`
  (`index.html` — die Leiste bricht auf schmalen Viewports schon um).
- **A11** [low] Die Spielfläche wird während des Einrichtens durch vier flache
  `MAT.woodL`-Leisten bei `y = 0.03` sichtbar gemacht, sonst ausgeblendet.
  Verworfen: eine dauerhaft sichtbare Kante (verändert das Bild ausserhalb des
  Einrichtens) und gar keine Markierung (das Kind sieht nicht, warum ein Objekt
  stehen bleibt).
- **A12** [high] Die Verifikation läuft headless über Playwright gegen einen
  selbst gestarteten `python3 -m http.server`, **im Vordergrund**, weil das
  Repo kein Test-Framework hat und `CLAUDE.md:550-563` `run_in_background` für
  Verifikationsläufe ausdrücklich verbietet (Issue #11 ist genau daran
  gescheitert). Der Server wird über seinen Port beendet, nie mit `pkill -f`.
  Verworfen: `curl` auf `index.html` (zeigt nur statisches Markup, nicht die
  3D-Szene, `CLAUDE.md:525-549`).
- **A13** [med] Spielstände werden in der Prüfung über
  `page.add_init_script` in `localStorage['wipfelkratzer-v1']` vorbelegt statt
  über die Oberfläche aufgebaut. Beleg, dass das trägt: `js/game.js:35`
  (`Object.assign(state, JSON.parse(s))`).
- **A14** [low] `checkTenant()` (`js/game.js:764`) bekommt zusätzlich zur
  `'roof'`-Ausnahme eine Typprüfung, damit der Schlüssel `'garten'` nie in die
  Bewohnerlogik läuft. Heute ist das schon folgenlos (`'garten' <=
  state.floors` ist `false`), aber unabsichtlich. Verworfen: unangetastet
  lassen.

## Consequences

- **Positiv:** Draussen und drinnen teilen sich eine Mechanik. Wer später
  Eintrag 08 (Tiere verschiebbar) angeht, braucht nur noch eine Antwort auf
  «was ist ein bewegliches Tier», nicht auf «wie funktioniert Auswahl im
  Freien».
- **Positiv:** Die Lichtung ist jetzt eine Zahl im Code statt einer stillen
  Absprache zwischen zwei Baumschleifen und einer Gruppenposition.
- **Positiv:** Die Blumen stehen nicht mehr im Bach.
- **Kosten:** `makeGarden()` verschwindet. Wer das Ensemble als Ganzes
  wiederhaben will, findet es nur noch als `GARDEN_DEFAULT`-Liste.
- **Kosten:** Der Spielplatz ist beim Aufbau weiterhin ein Ensemble, aber die
  Aufbau-Animation skaliert ab jetzt `gartenG` mit den einzelnen Objekten
  darin; die Objekte müssen also **vor** der Animation existieren
  (`js/game.js:827-828`).
- **Kosten:** `state.rooms` bekommt einen dritten Schlüsseltyp. Jede Stelle,
  die über `state.rooms` iteriert, muss `'garten'` vertragen — heute ist das
  nur `js/game.js:1177-1184`.
- **Risiko, gering:** `dims('garten')` speist über `colsOf`/`cellPos` auch
  `freeCell`; ein zu grobes Raster könnte «Kein Platz frei!» melden, obwohl
  draussen sichtbar Platz ist. `dims('garten') = 4.7 × 4.1` ergibt 4 Spalten × 2 Reihen = 8 Zellen, mehr
  als die sieben vorplatzierten Objekte. Teil der Abnahme.
- **Kein Risiko für bestehende Stände:** Der `localStorage`-Schlüssel
  `wipfelkratzer-v1` und alle bisherigen Felder bleiben unverändert;
  `state.rooms.garten` kommt additiv dazu.

## Acceptance Criteria

- [ ] Ein Tipp auf den gebauten Spielplatz öffnet den Einrichten-Modus; die
      Titelzeile lautet «Spielplatz einrichten».
- [ ] Im Spielplatz-Modus zeigt der Katalog genau eine Kategorie
      («Spielplatz») mit den fünf Objekten Schaukel, Rutsche, Sandkasten,
      Hochbeet, Blumen — und **keine** Kategorie «Tapete», «Boden», «Wand»
      oder «Dach».
- [ ] Drinnen und auf dem Dach taucht die Kategorie «Spielplatz» **nicht** auf.
- [ ] Ein Tipp auf ein Spielplatz-Objekt wählt es aus (`#selbar` wird
      sichtbar, «Verschieben» und «Drehen» sind sichtbar, das Wand-Kreuz
      nicht).
- [ ] «Drehen» dreht das ausgewählte Objekt um 90°; die Drehung steht danach
      in `state.rooms.garten[i].rot` und im `localStorage`.
- [ ] «Verschieben» setzt das Objekt auf eine andere Stelle innerhalb der
      Fläche; Position steht danach in `state.rooms.garten[i].x/.z` und im
      `localStorage`.
- [ ] Die Pfeiltasten verschieben das ausgewählte Objekt fein, Bild-hoch/-runter
      drehen es fein — wie drinnen.
- [ ] «Weg damit» entfernt das Objekt aus Szene und Spielstand.
- [ ] Ein neues Objekt aus dem Katalog landet innerhalb der Fläche und ist
      danach auswählbar.
- [ ] Kein Objekt lässt sich über die Fläche hinausschieben: nach 200
      Pfeiltastendrücken in jede Richtung liegt die Objekt-Box3 vollständig in
      `x ∈ [-10.7, -5.3]`, `z ∈ [-0.5, 4.5]` (Weltkoordinaten).
- [ ] Für jede erreichbare Objektposition gilt `z < riverZ(x) - 1.8`
      (ausserhalb des Wassers), `hypot(x + 8, z - 2) < 5.5` (in der
      baumfreien Lichtung) und `x < -5.0` (ausserhalb der Turmplattform).
- [ ] Nach einem Neuladen stehen alle Objekte mit Position und Drehung genau
      dort, wo sie vorher standen.
- [ ] **Alte Spielstände:** ein Stand mit `garden: true` und **ohne**
      `rooms.garten` lädt fehlerfrei, erzeugt genau die sieben
      vorplatzierten Objekte, schreibt sie einmalig zurück in den
      `localStorage` und lässt alle übrigen Felder (`floors`, `rooms` der
      Etagen, `nuts`, `bridge`, `wallpaper`, `flooring`, `fulfilled`)
      unverändert.
- [ ] **Alte Spielstände ohne Spielplatz:** ein Stand mit `garden: false`
      lädt fehlerfrei, `state.rooms.garten` ist ein leeres Array, und in der
      Szene ist draussen nichts zu sehen.
- [ ] **Leergeräumter Spielplatz:** ein Stand mit `garden: true` und
      `rooms.garten: []` bleibt nach dem Neuladen leer — die Objekte kommen
      **nicht** zurück.
- [ ] Der Extras-Knopf «Garten & Spielplatz» baut den Spielplatz beim ersten
      Mal (mit Aufbau-Animation und Meldung) und öffnet danach den
      Einrichten-Modus, statt «ist schon da» zu melden.
- [ ] Ausserhalb des Einrichten-Modus ist die Flächenmarkierung unsichtbar;
      die Szene sieht aus wie vor der Änderung.
- [ ] Einrichten drinnen und auf dem Dach funktioniert unverändert:
      Auswahl, Verschieben, Drehen, Tapete, Boden, Wandobjekte, Einzug der
      Bewohner.
- [ ] Beim Laden und während der gesamten Prüfung wird kein `pageerror`
      ausgelöst (ein `favicon.png`-404 ist erlaubt und wird nicht gewertet).
- [ ] `js/models.js` enthält kein `makeGarden` mehr, und `js/game.js`
      importiert es nicht mehr.
- [ ] `version.js` ist unverändert (`window.GAME_VERSION = "0.5.0"`).
- [ ] `CHANGELOG.md` hat unter `## [Unreleased]` → `### Added` einen Eintrag
      zu diesem Issue mit der Nummer `(#38)`.
