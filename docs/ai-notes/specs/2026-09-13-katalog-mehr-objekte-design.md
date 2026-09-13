# Spec — Katalog: sechs neue Objekte (Bar, Kommode, Ball, Kuscheltier, Dartscheibe, Tischkicker)

Issue: freaxnx01/game-wipfelkratzer#37
Datum: 2026-09-13

## Ziel

Sechs neue Einrichtungsobjekte im Katalog, gebaut aus denselben klobigen
Primitiven wie der bestehende Bestand, ohne neue Platzierungsmechanik:

| id | Name | cat | Weg |
| --- | --- | --- | --- |
| `bar` | Bar | `dach` | Bodenobjekt auf der Dachterrasse |
| `kommode` | Kommode | `mobel` | Bodenobjekt, zusätzlich Abstellfläche |
| `ball` | Ball | `spass` | Bodenobjekt, statisch |
| `kuscheltier` | Kuscheltier | `spass` | Bodenobjekt, statisch |
| `tischkicker` | Tischkicker | `spass` | Bodenobjekt |
| `dartscheibe` | Dartscheibe | `wand` | Wandobjekt über `WALL_ITEMS` |

## Bestehendes Verhalten (Beleg)

- Ein Katalogeintrag ist ein Objekt `{ id, name, cat }` in `CATALOG`
  (`js/models.js:251`) plus eine Funktion gleichen Namens in `FURN`
  (`js/models.js:65`); `makeFurniture(id)` ruft schlicht `FURN[id]()` auf
  (`js/models.js:309`). Es gibt keine Registrierung darüber hinaus.
- Die Kategorien-Tabs stehen in `CATS` (`js/models.js:271`); `renderCatalog`
  zeigt auf dem Dach ausschliesslich `dach` und sonst alles ausser `dach`
  (`js/game.js:554`).
- Thumbnails entstehen automatisch: `makeThumbs` iteriert über `CATALOG` und
  rendert jedes Modell einmal offscreen (`js/game.js:541`). Ein neuer Eintrag
  bekommt sein Thumbnail also ohne Zutun.
- Wandobjekte werden allein über die Menge `WALL_ITEMS` (`js/models.js:272`)
  erkannt — nicht über `cat`. `placeItemMesh` (`js/game.js:450`) und
  `clampEntry` (`js/game.js:428`) verzweigen darauf und setzen Position und
  Rotation aus `wallPlacement(k, entry.wall)` (`js/game.js:371`).
- Der Wand-Picker (welche der vier Wände) wird nur gerendert, wenn der aktive
  Tab `wand` ist (`js/game.js:583`); `enterEdit` setzt `wallTarget` bei jedem
  Eintritt auf `'alle'` zurück (`js/game.js:652`), und `addItem` übersetzt
  `'alle'` zu `'back'` (`js/game.js:688`).
- Dachobjekte sind gewöhnliche Bodenobjekte in `state.rooms.roof`; `clampEntry`
  hält für `k === 'roof'` zusätzlich die Treppenöffnung frei, indem es `en.z`
  auf `ROOF_PAD_Z0 - 0.3 - hz` deckelt, sobald das Objekt in den Streifen
  `x + hx > ROOF_GAP_X0` ragt (`js/game.js:442-444`). Diese Regel greift für
  jedes Dachobjekt automatisch, auch beim Laden (`js/game.js:1177-1182`).
- `surfaceYAt` legt Deko auf die Oberkante des darunter liegenden Möbels, sofern
  diese unter 1.8 liegt (`js/game.js:415-424`); `SURFACES` (`js/game.js:426`)
  bestimmt nur, welches Möbel `addItem` als Ablage *vorschlägt*
  (`js/game.js:698-699`).
- Materialien kommen ausschliesslich aus `MAT` bzw. dem Helfer `L`
  (`js/models.js:3-12`), Geometrie aus `mesh`/`box`/`cyl`/`sph`/`G`
  (`js/models.js:14-21`). Es gibt keinen einzigen importierten Mesh im Repo.
- Es existiert keine Unit-Test-Suite; verifiziert wird headless mit Playwright
  gegen die echte Seite, und zwar **im Vordergrund** (`CLAUDE.md:515-566`).
  Für Szenenzugriff ist `window.wipfelkratzer` da (`js/game.js:1188`).
- Persistenz: `state` in `localStorage['wipfelkratzer-v1']`
  (`js/game.js:35-42`), Möbel pro Raum unter `state.rooms[k]`
  (`js/game.js:43`).

## Assumptions

- **A1** [high] Die **Dartscheibe** wird ein Wandobjekt: Eintrag mit
  `cat: 'wand'` **und** Aufnahme in `WALL_ITEMS` (`js/models.js:272`). Verworfen:
  `cat: 'spass'` bei gleichzeitiger `WALL_ITEMS`-Mitgliedschaft — technisch
  möglich, aber der Wand-Picker erscheint nur im Tab `wand`
  (`js/game.js:583`), sodass die Scheibe beim Hinzufügen kommentarlos an der
  Rückwand landet (`js/game.js:688`, `js/game.js:652`). Ebenfalls verworfen:
  Bodenständer — er würde ein zweites Platzierungsmodell für dasselbe Objekt
  erfinden.
- **A2** [high] Der **Ball** liegt still. Kein Rollen, keine Physik, kein
  `userData.wheel`-Spin. Verworfen: Rollen über den `spinners`-Pfad
  (`js/game.js:463`, `js/game.js:1211`) — der dreht nur endlos um die eigene
  Achse, was am Boden falsch aussieht; und verworfen: echte Bewegung, weil
  Position, Zellenbelegung und Speicherstand alle an einem statischen
  `entry.x/z` hängen (`js/game.js:427-446`, `js/game.js:703`) und ein rollender
  Ball Integration, Kollision gegen `itemMeshes[k]` und ein laufendes `save()`
  nach sich zöge. YAGNI: als Spielzeug im Regal-Massstab erfüllt der ruhende
  Ball den Wunsch aus der Feedback-Notiz.
- **A3** [high] Die **Bar** ist ein gewöhnliches Dach-Bodenobjekt
  (`cat: 'dach'`), ohne Sonderbehandlung. Die Treppenöffnung hält `clampEntry`
  von selbst frei (`js/game.js:442-444`); dafür muss die Bar nur schmal genug
  bleiben, um auf dem Deck ausserhalb des Öffnungsstreifens zu stehen
  (`ROOF_W = 6.6`, `js/game.js:12`; `ROOF_GAP_X0 = ROOF_W/2 - 0.9`,
  `js/game.js:176`). Verworfen: eine eigene Verbotszone pro Objekt.
- **A4** [med] Die **Kommode** kommt zusätzlich in `SURFACES`
  (`js/game.js:426`), damit Deko (Vase, Kerze, Bücher) sie wie Tisch und
  Schrank als Ablage angeboten bekommt. Ihre Oberkante liegt bei ~0.92 und
  damit unter der 1.8-Grenze von `surfaceYAt` (`js/game.js:423`). Verworfen:
  Kommode ohne `SURFACES`-Eintrag — funktioniert, wirkt aber willkürlich
  neben `tisch`/`schrank`.
- **A5** [med] Das Prüfskript wird als `tools/verify_katalog.py` eingecheckt
  (neues Verzeichnis; das Repo hat bisher keines). Es startet den statischen
  Server selbst per `subprocess` und beendet ihn im `finally` — damit bleibt
  der gesamte Lauf ein einziger Vordergrundbefehl, wie `CLAUDE.md:550-566`
  es verlangt. Verworfen: Server separat mit `run_in_background` starten.
- **A6** [med] Kein Bewohner-Wunsch (`TENANTS`, `js/game.js:20-31`) wird auf
  eines der neuen Objekte umgehängt; die neuen Einträge sind rein optional.
  Verworfen: einen bestehenden Wunsch ersetzen — das änderte den Spielverlauf
  bestehender Speicherstände.
- **A7** [low] Keines der neuen Objekte kommt in `DECO` (`js/game.js:366`).
  Ball und Kuscheltier sind klein genug, dass Tischdeko naheläge, belegen aber
  bewusst eine Zelle wie ein Möbel — `DECO` ist für Tischkram (Vase, Kerze,
  Bücher) reserviert. Verworfen: Ball/Kuscheltier als Deko auf dem Tisch.
- **A8** [low] `version.js`/`CHANGELOG.md` werden nicht angefasst; Versionen
  entstehen beim Release über Tag und `git cliff` (`CLAUDE.md:474`,
  `CLAUDE.md:763-770`).

## Consequences

- `js/models.js` wächst um sechs `FURN`-Funktionen und sechs `CATALOG`-Zeilen;
  `WALL_ITEMS` bekommt einen Eintrag. `js/game.js` ändert sich an genau einer
  Stelle: `SURFACES` um `'kommode'` (A4).
- Der Tab „Spass" verdreifacht seinen Bestand (3 → 6 Einträge), „Wand" wächst
  auf 7, „Dach" auf 5, „Möbel" auf 8. Der Katalog scrollt entsprechend länger;
  die Gitterdarstellung selbst ist unverändert.
- Die Startzeit steigt minimal, weil `makeThumbs` sechs Modelle mehr rendert
  (`js/game.js:541`).
- Bestehende Speicherstände bleiben gültig: neue ids tauchen dort schlicht nicht
  auf, und `placeItemMesh` liest nur vorhandene Einträge (`js/game.js:1177`).
- Die Dartscheibe teilt sich die Wand mit Postern und Uhr; `addItem` verteilt
  Wandobjekte bereits über den freiesten Platz derselben Wand
  (`js/game.js:688-695`) — das gilt ohne Zutun auch für sie.
- Ein rollender Ball bleibt möglich, aber als eigenes Issue: mit dieser Spec
  ist er ausdrücklich nicht gebaut (A2).
- Das Repo bekommt mit `tools/` ein erstes Verzeichnis für Prüfskripte (A5);
  folgende Katalog-Issues können dieselbe Datei erweitern statt ein neues
  Ad-hoc-Skript zu schreiben.

## Acceptance Criteria

- [ ] `CATALOG` enthält genau die sechs neuen Einträge `bar` (`dach`),
      `kommode` (`mobel`), `ball` (`spass`), `kuscheltier` (`spass`),
      `tischkicker` (`spass`), `dartscheibe` (`wand`) mit den Namen aus der
      Tabelle oben.
- [ ] Für jede neue id existiert eine `FURN`-Funktion; `makeFurniture(id)`
      liefert eine `THREE.Group` mit mindestens drei Meshes und ohne Fehler.
- [ ] Jedes Material in jedem neuen Modell ist ein `MeshLambertMaterial`; es
      werden keine Loader, Texturen oder externen Meshes verwendet.
- [ ] `WALL_ITEMS` enthält `dartscheibe` und keine der übrigen fünf ids.
- [ ] Die Dartscheibe wird an der Wand platziert: nach dem Hinzufügen liegt ihre
      Mesh-Position auf der Wandebene aus `wallPlacement(k, entry.wall)` und
      ihre Rotation auf `pl.rot`; sie belegt keine Bodenzelle
      (`freeCell`, `js/game.js:466-469`).
- [ ] Der Ball bewegt sich nicht: seine Mesh-Position und -Rotation sind nach
      zwei Sekunden Laufzeit unverändert, und er registriert sich nicht in
      `spinners` (kein `userData.wheel`).
- [ ] Die Bar lässt sich auf der Dachterrasse platzieren, steht mit ihrer
      gesamten Grundfläche auf dem Deck und ragt nicht in die Treppenöffnung —
      auch dann nicht, wenn ein Speicherstand sie dorthin setzt (Neuladen
      korrigiert die Position über `clampEntry`).
- [ ] Auf die Kommode lässt sich Deko stellen: nach dem Hinzufügen einer Vase
      bei ausgewählter Kommode liegt deren `entry.y` über der Kommoden-Oberkante
      statt auf `baseY(k)`.
- [ ] Jedes neue Bodenobjekt bleibt im Zellenmass: Grundfläche höchstens
      0.95 × 1.0 und Höhe höchstens 1.3 in einer Wohnung, höchstens
      1.7 × 1.3 × 1.3 auf dem Dach (Bar); die Dartscheibe ragt höchstens 0.35
      in den Raum.
- [ ] Alle neuen Objekte erscheinen im richtigen Tab, mit Thumbnail und Namen.
- [ ] Ein Durchlauf „alle sechs hinzufügen, Seite neu laden" stellt alle sechs
      wieder her, und die Browser-Konsole bleibt über den gesamten Lauf frei von
      Fehlern und Warnungen.
