# Spec: Instrumente als Möbel — Blockflöte, Harfe, Schlagzeug (Issue #36)

Issue: `freaxnx01/game-wipfelkratzer#36`
Plan: `docs/ai-notes/plans/2026-09-13-instrumente.md`
Datum: 13.09.2026

## Ziel

Der Katalog bekommt drei neue Instrumente — **Blockflöte**, **Harfe**,
**Schlagzeug** — im bestehenden Bilderbuch-Stil. Das Klavier (`FURN.klavier`,
`js/models.js:145-150`) ist heute das einzige Instrument im Turm und zugleich
der Wunsch der Kindergarten-Mäuse (`js/game.js:20`); Instrumente sind damit
etabliert, es fehlt die Breite.

**Nicht Ziel:** Klang beim Antippen. Das gehört zu Issue #41 (siehe A4).

## Ausgangslage im Code

- Möbel sind Funktionen in `FURN` (`js/models.js:65-256`), gebaut nur aus den
  Helfern `box`/`cyl`/`sph`/`mesh` (`js/models.js:14-20`) und den Materialien
  aus `MAT` (`js/models.js:4-12`), alle `MeshLambertMaterial` (`js/models.js:3`).
- `makeFurniture(id)` ruft schlicht `FURN[id]()` auf und setzt
  `userData.itemId` (`js/models.js:309`) — ein neuer Eintrag braucht nur die
  Bau-Funktion plus einen `CATALOG`-Eintrag (`js/models.js:251-270`).
- Katalog-Kacheln und Thumbnails entstehen automatisch aus `CATALOG`
  (`js/game.js:541`, `js/game.js:597-601`) — kein Bild-Asset nötig.
- Bodenmöbel landen in Zellen (`cellPos`, `js/game.js:360-362`) und werden von
  `clampEntry` (`js/game.js:427-446`) in den Raum gezwungen.
- Kleinkram («Deko») steht stattdessen auf Möbeln: `DECO`
  (`js/game.js:366`) + `SURFACES` (`js/game.js:426`) + `surfaceYAt`
  (`js/game.js:415-425`), gesetzt in `addItem` (`js/game.js:696-702`).

## Grössenordnung — was der Raum wirklich hergibt

Die Zellenbreite ist `dims(k).w / colsOf(k)` (`js/game.js:358-362`):

| Etage | `W(k)` | `dims.w` | Spalten | Zellenbreite |
|---|---|---|---|---|
| 0 (EG) | 8.6 | 7.9 | 8 | 0.99 |
| 1 | 7.6 | 6.9 | 7 | 0.99 |
| 5 | 6.4 | 5.7 | 6 | **0.95** |
| 10 | 4.9 | 4.2 | 4 | 1.05 |

Schmalste Zelle im ganzen Turm: **0.95** (Etage 5). Die breitesten
bestehenden Möbel bleiben knapp darunter — `sofa` 0.85 (`js/models.js:84`),
`klavier` 0.85 (`js/models.js:146`), `regal` 0.85 (`js/models.js:98`).

Nach oben begrenzt die Decke: sie sitzt bei `h - 0.13` mit Dicke 0.1
(`js/game.js:270`), die Unterkante also bei **1.82** für Etagen ≥ 1
(`FLOOR_H = 2.0`, `js/game.js:6`). Höchstes bestehendes Möbel: `schrank`,
Oberkante 1.36 (`js/models.js:91-93`).

`clampEntry` (`js/game.js:436-441`) scheitert an Breite nicht hart — es
schiebt jedes Objekt anhand seiner Box3 in den Raum, notfalls mittig. Das
Problem sehr breiter Objekte ist rein optisch: sie ragen in die Nachbarzelle
und drängen den nächsten Einrichtungsgegenstand weg. Das Problem sehr kleiner
Objekte ist ebenfalls optisch: eine 0.3 lange Flöte mitten in einer 0.95
breiten Zelle wirkt verloren — genau dafür gibt es bereits den `DECO`-Pfad.

## Entscheid: welche Instrumente, in welcher Form

- **Harfe** — Bodenmöbel, aufrecht, Silhouette wie ein Buchstabe «D» von der
  Seite. Hüllmass ≈ 0.50 × 0.28 × 1.26 (b × t × h). Passt in die schmalste
  Zelle, bleibt unter der Decke, ist deutlich höher als alles andere im Raum
  ausser dem Schrank — das ist gewollt, «fast mannshoch» ist ihr Charakter.
- **Schlagzeug** — Bodenmöbel, breit aber gedeckelt auf **0.90** Gesamtbreite
  (kompaktes Kinder-Set: grosse Trommel, ein Tom, Snare, ein Becken). Hüllmass
  ≈ 0.90 × 0.50 × 0.70.
- **Blockflöte** — **kein** Bodenmöbel, sondern `DECO`: sie steht senkrecht in
  einem kleinen Holzständer auf Tisch, Regal, Schrank, Klavier oder Nusskiste.
  Hüllmass ≈ 0.17 × 0.17 × 0.41, also in der Liga von `vase` (0.31 hoch,
  `js/models.js:168-173`) und `kerze` (0.20 hoch, `js/models.js:181-185`).

## Stil-Vorgaben (Hausregel, nicht verhandelbar)

- Nur `MeshLambertMaterial` über `MAT` — keine neuen Farben, kein `L(...)`
  mit einem neuen Hex.
- Nur `box`/`cyl`/`sph`/`mesh` plus, wo nötig, `THREE.TorusGeometry` (bereits
  in `schaukelstuhl` und `teekanne` benutzt, `js/models.js:121`,
  `js/models.js:176`).
- Keine importierten Meshes, keine Texturen.

### Formbeschreibung Harfe

Seitenprofil in der x-y-Ebene, damit der Betrachter beim Standard-Blick auf
die Wohnung die Dreiecksform sieht:

- **Fuss**: flacher Holzquader, 0.44 breit, 0.08 hoch, 0.28 tief.
- **Säule** (vorne, bei x ≈ +0.22): senkrechter Zylinder, Radius 0.045,
  Höhe 1.12, `MAT.wood`. Oben ein goldener Knauf (`sph`, r 0.06).
- **Resonanzkörper**: ein schräger Balken von (−0.18, 0.08) nach (0.05, 0.95),
  0.15 breit, 0.22 tief, `MAT.woodL` — lehnt nach hinten weg und bildet mit
  der Säule das Dreieck.
- **Hals**: kurzer, steiler Balken vom Körperkopf zur Säulenspitze,
  `MAT.woodD`.
- **Saiten**: 7 sehr dünne goldene Balken zwischen Hals und Körper, nach vorne
  hin kürzer werdend — der klassische Fächer. Keine runden Geometrien, damit
  sie auch aus der Ferne als klare Linien lesbar bleiben.

### Formbeschreibung Schlagzeug

- Grosse Trommel liegend (Zylinderachse entlang z), `MAT.red`, Radius 0.26,
  mit cremefarbenen Fellen und goldenen Spannreifen (`TorusGeometry`) auf
  beiden Seiten, zwei schwarze Füsschen.
- Ein Tom obenauf (`MAT.red`, r 0.12), Fell + Reifen wie oben.
- Snare rechts auf einem dreibeinigen grauen Ständer, `MAT.white` Kessel.
- Becken links auf einer dünnen Stange, `MAT.gold`, leicht gekippt.
- Zwei Schlägel aus `MAT.woodL`, an die grosse Trommel gelehnt.

### Formbeschreibung Blockflöte

Zylinderrohr in `MAT.cream`, Kopfstück und Fussring in `MAT.woodD`, fünf
schwarze Griffloch-Punkte (`sph`, r 0.008) auf der Vorderseite, unten ein
runder Holzständer (`cyl`, r 0.07/0.085) — der Ständer ist der Grund, warum
sie auch allein auf dem Boden nicht wie ein liegengelassener Stift aussieht.

## Katalog-Einordnung

Alle drei kommen in den bestehenden Tab **«Spass»** (`CATS`,
`js/models.js:271`). Heute hat der Tab drei Einträge (`hamsterrad`,
`klavier`, `nusskiste`, `js/models.js:259-260`), danach sechs — eine gesunde
Kachelzahl. Ein eigener Tab «Musik» hätte vier Einträge (mit umgezogenem
Klavier) und liesse «Spass» mit zweien zurück; ausserdem hat `CATS` bereits
acht Tabs, und der Tab-Streifen ist auf schmalen Viewports schon eng (siehe
die vorangegangenen Issues #16/#19 zur Katalog-Überlagerung).

## Assumptions

**A1** [high] Genau diese drei Instrumente im ersten Wurf; «was sonst noch
dazugehört» (Gitarre, Trompete, Triangel …) wird nicht mitgeliefert.
Verworfen: fünf bis sechs Instrumente auf einen Schlag. Ein Instrument sind
hier ~20 Zeilen Modellcode plus Sichtprüfung; drei sind ein überschaubarer PR,
sechs nicht. Die Breite lässt sich später billig nachlegen, weil ein neuer
Eintrag nur `FURN` + `CATALOG` braucht (`js/models.js:309`,
`js/models.js:251`).

**A2** [med] Die Blockflöte wird ein `DECO`-Objekt, kein Bodenmöbel — sie
kommt in `DECO` (`js/game.js:366`) und steht damit auf den `SURFACES`
(`js/game.js:426`). Verworfen: als normales Bodenmöbel in eine eigene Zelle.
Bei 0.3 Rohrlänge gegen 0.95 Zellenbreite (`js/game.js:360-362`) belegte sie
eine volle Zelle für fast nichts und würde von `freeCell`
(`js/game.js:466-468`) wie ein Schrank gezählt. Als `DECO` bekommt sie
zusätzlich die Ablage-Automatik aus `addItem` (`js/game.js:696-702`) und
`surfaceYAt` (`js/game.js:415-425`) geschenkt. Risiko des Entscheids: die
Flöte lässt sich dann nicht mehr frei im Raum drehen wie ein Möbel — für ein
Objekt dieser Grösse ist das vertretbar.

**A3** [high] Kein neuer Katalog-Tab; alle drei gehen nach `spass`.
Verworfen: ein Tab «Musik». `CATS` hat schon acht Einträge
(`js/models.js:271`), und ein Musik-Tab wäre erst ab ~fünf eigenständigen
Instrumenten mehr Ordnung als Reibung. Ausserdem müsste dafür das Klavier
umziehen, was den Wunsch-Text der Kindergarten-Mäuse (`js/game.js:20`) zwar
nicht bricht, aber den vertrauten Fundort verschiebt.

**A4** [high] **Klang gehört zu Issue #41, nicht hierher.** Dieses Issue
liefert Modelle und Katalog-Verdrahtung, sonst nichts. Verworfen: ein
Antipp-Ton nur für Instrumente. Begründung: Antippen ist heute mit *Auswählen*
belegt (`js/game.js:1003-1004`) — wer hier Klang einbaut, muss genau die
Bedienfrage lösen, die #41 als offenen Punkt führt («ob ein zweiter Tipp
schaltet, oder ein eigener Knopf in `#selbar` erscheint»). Käme hier ein
eigener Pfad und dort ein zweiter, hätte das Spiel zwei Interaktionsmuster für
dieselbe Geste. #41 baut den Mechanismus einmal (Zustand pro Objekt in
`state.rooms`, Auslöser, Sound-Aufruf) und bekommt die Instrumente dann
geschenkt — ein Instrument ist dort der einfachste Fall, weil es keinen
Zustand hat, nur einen Ton. Nebenbefund: das Klavier ist seit jeher stumm,
stumme Instrumente sind also kein Rückschritt gegenüber heute.

**A5** [med] Es wird **kein** Vorbau für #41 mitgeliefert — kein
`userData.sound`, kein Feld im `CATALOG`-Eintrag, keine leere `sfx`-Funktion.
Verworfen: ein kleiner Marker als «Brücke». Solange #41 den Auslöser noch
nicht entschieden hat, ist jeder Marker eine Wette auf eine Schnittstelle, die
niemand liest — toter Code im Review. #41 kann ohnehin über `entry.id`
(`js/game.js:461`) bzw. `userData.itemId` (`js/models.js:309`) unterscheiden.

**A6** [high] Harte Masse: Gesamtbreite ≤ **0.90**, Gesamthöhe ≤ **1.30** für
die beiden Bodenmöbel. Verworfen: ein «echtes» breites Schlagzeug mit Hi-Hat
und zweitem Becken (~1.3 breit). Begründung siehe Tabelle oben — 0.95 ist die
schmalste Zelle (Etage 5), und die Decke liegt bei 1.82 (`js/game.js:270`,
`js/game.js:6`). 0.90/1.30 lässt in beiden Richtungen Luft.

**A7** [high] Keine neuen Materialien. Alles aus `MAT` (`js/models.js:4-12`):
`wood`, `woodD`, `woodL`, `cream`, `white`, `red`, `gold`, `grey`, `black`.
Verworfen: ein eigenes Becken-Messing und ein Trommelfell-Weiss. `MAT.gold`
(0xd9973f) und `MAT.cream` (0xfdf4e0) decken beides ab, und die Palette bleibt
geschlossen.

**A8** [high] Kein Bewohner bekommt einen Instrumenten-Wunsch. Verworfen: dem
Kindergarten einen zweiten Wunsch geben. `TENANTS` (`js/game.js:19-30`) hat
genau einen `wish` pro Partei, und `checkWishes` (`js/game.js:770-780`) hängt
an dieser 1:1-Zuordnung; das umzubauen ist ein eigenes Thema.

**A9** [med] Kein `version.js`-Bump und keine Hand-Pflege an `CHANGELOG.md` im
PR. Verworfen: Version im selben Commit hochziehen. Laut Hausregel ist das
Git-Tag die Wahrheit und `version.js` nur ein Spiegel, gesetzt beim Release
(`CLAUDE.md:467-495`); der Changelog wird mit `git-cliff` aus den Commits
erzeugt. Der Conventional-Commit-Typ `feat` reicht.

**A10** [high] Katalognamen mit echten Umlauten: «Blockflöte», «Harfe»,
«Schlagzeug». Verworfen: Kunstnamen wie «Trommelset». Der Katalog nennt Dinge
beim Kindernamen (`js/models.js:251-270`).

## Consequences

- **Für Issue #41:** dessen Umfang wächst um drei Fälle. Wenn #41 das
  Auslöser-Muster baut, sind `blockfloete`, `harfe`, `schlagzeug` (und das
  bestehende `klavier`) die zustandslose Variante: Tipp → Ton, nichts zu
  speichern. Das sollte dort als Notiz landen, sobald dieses Issue durch ist.
- **Bis #41 landet, sind die Instrumente stumm.** Das ist bewusst und
  entspricht dem heutigen Klavier. Wer das Issue testet, wird keinen Ton
  hören — das ist kein Fehler.
- **Die Flöte ist nicht drehbar.** `DECO`-Objekte werden über `#btn-move` in
  Zellen versetzt und per `surfaceYAt` auf die Ablage gehoben; die freie
  Drehung bleibt den Bodenmöbeln. Für ein rotationssymmetrisches Rohr ist das
  folgenlos.
- **Die Harfe wird zur Stapelfläche.** `surfaceYAt` (`js/game.js:415-425`)
  berücksichtigt jedes Nicht-Deko-Möbel unter 1.8 Höhe; eine Deko, die in der
  Harfen-Zelle landet, sitzt dann auf 1.26. Gleiches gilt heute schon für den
  Schrank (1.36) — kein neues Verhalten, aber beim Testen nicht erschrecken.
- **Sechs Kacheln im Tab «Spass».** Wenn später noch Instrumente dazukommen
  (A1), ist bei ~acht Einträgen der Punkt erreicht, an dem A3 neu zu bewerten
  ist.
- **Keine Migration.** Neue `CATALOG`-Einträge sind reine Erweiterung; alte
  Spielstände (`wipfelkratzer-v1`, `js/game.js:32`) laden unverändert.

## Acceptance Criteria

- [ ] `FURN.blockfloete`, `FURN.harfe` und `FURN.schlagzeug` existieren in
      `js/models.js` und liefern je eine `THREE.Group`.
- [ ] Alle drei bauen ausschliesslich mit `box`/`cyl`/`sph`/`mesh` und
      Materialien aus `MAT`; kein neues `L(...)`, kein Import.
- [ ] `CATALOG` enthält `{ id: 'blockfloete', name: 'Blockflöte', cat: 'spass' }`,
      `{ id: 'harfe', name: 'Harfe', cat: 'spass' }` und
      `{ id: 'schlagzeug', name: 'Schlagzeug', cat: 'spass' }`.
- [ ] `CATS` ist unverändert — kein neuer Tab.
- [ ] `DECO` in `js/game.js` enthält zusätzlich `'blockfloete'`.
- [ ] Gemessen über `Box3.setFromObject`: Harfe ≤ 0.90 breit und ≤ 1.30 hoch;
      Schlagzeug ≤ 0.90 breit und ≤ 1.30 hoch; Blockflöte ≤ 0.25 breit und
      ≤ 0.50 hoch.
- [ ] Alle drei Modelle stehen auf y ≈ 0 (Box3-Minimum zwischen −0.01 und
      0.02), damit sie auf `baseY(k)` nicht schweben oder einsinken.
- [ ] Der Tab «Spass» zeigt sechs Kacheln mit Thumbnail und Namen; die drei
      neuen Thumbnails sind nicht leer.
- [ ] Ein Klick auf jede der drei Kacheln fügt das Objekt der Wohnung hinzu,
      ohne Fehler in der Konsole.
- [ ] Die Blockflöte landet auf einem vorhandenen Tisch (ihre y-Position liegt
      über `baseY(k)`), nicht auf dem Boden.
- [ ] Harfe und Schlagzeug bleiben nach `clampEntry` vollständig innerhalb der
      Raumgrenzen, auch auf der schmalsten Etage.
- [ ] Ein Spielstand mit allen drei Objekten übersteht einen Reload und stellt
      sie wieder her.
- [ ] Ganzer Durchlauf ohne `pageerror` und ohne `console.error`.
- [ ] Screenshots aus mindestens zwei Blickwinkeln zeigen die drei Instrumente
      in einer Wohnung, stilistisch passend zum Klavier daneben.
- [ ] Kein Klang-Code: `grep` auf `sfx` in `js/models.js` bleibt leer, und
      `js/game.js` bekommt keinen neuen `sfx`-Eintrag.
