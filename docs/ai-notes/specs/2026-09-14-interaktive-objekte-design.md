# Spec: Objekte interaktiv machen — Fenster, Badewanne, Lampe (Issue #41)

Issue: `freaxnx01/game-wipfelkratzer#41`
Plan: `docs/ai-notes/plans/2026-09-14-interaktive-objekte.md`
Datum: 14.09.2026

## Ziel

Drei Möbel bekommen einen schaltbaren Zustand mit Geräusch:

- **Fenster** — Flügel kippt auf und zu (`fenster`, `js/models.js:207-213`)
- **Badewanne** — Wasser rein und raus (`badewanne`, `js/models.js:115-121`)
- **Lampe** — Licht an und aus, bei Nacht sichtbar (`lampe`, `js/models.js:106-109`)

Getragen wird das von **einem** Mechanismus — einer Registry `ACTIONS`, einem
Knopf in `#selbar`, einem Feld `on` im `state.rooms`-Eintrag. Der Mechanismus
ist ausdrücklich so geschnitten, dass ein **zustandsloses** Objekt (Instrument
aus Issue #36: Tipp → Ton, sonst nichts) derselbe Fall mit weniger Feldern ist.

**Nicht Ziel:** die Tag/Nacht-Beleuchtungsschicht selbst (`TODO.md:5` bleibt
stehen), neue Katalog-Objekte, Instrumentenklänge (die kommen, wenn #36
implementiert ist — diese Spec liefert nur die Aufhängung dafür).

## Ausgangslage im Code

- **Antippen ist mit Auswählen belegt.** Im Einrichten-Modus trifft der
  Pointer-Handler zuerst die Möbel und ruft `select(o.userData.pick)`
  (`js/game.js:1003-1005`). Ausserhalb des Einrichten-Modus werden Möbel gar
  nicht geraycastet — dort zählen nur `hitboxes`, Willi, Móki, Damm und Schild
  (`js/game.js:1023-1032`). Möbel sind also heute ausschliesslich im
  Einrichten-Modus antippbar.
- **`#selbar` ist die etablierte Stelle für «was kann ich mit dem Ausgewählten
  tun»** — «Verschieben», «Drehen», das `#wallpad`-Kreuz und «Weg damit»
  (`index.html:187-198`). `select()` blendet die Knöpfe je nach Objektart ein
  und aus (`js/game.js:674-678`), es gibt für diese Unterscheidung also schon
  ein Muster.
- **Objekte tragen schon eigenes Verhalten.** `hamsterrad()` hängt die
  drehbare Radgruppe an `g.userData.wheel` (`js/models.js:139`),
  `placeItemMesh` sammelt sie in `spinners` ein (`js/game.js:463`,
  `js/game.js:243`), die Loop dreht sie (`js/game.js:1211`). Genau dieses
  Muster — **Modell legt einen benannten Griff in `userData`, `js/game.js`
  benutzt ihn** — wird hier weiterverwendet.
- **`MAT.*` sind modulweit geteilte Materialien** (`js/models.js:4-12`). Die
  Glühbirne der Lampe benutzt `MAT.glow` (`js/models.js:108`), die Wanne
  `MAT.water` (`js/models.js:117`). Wer eines davon umschaltet, schaltet
  **alle** Lampen bzw. alles Wasser im Spiel gleichzeitig. Die Fensterscheibe
  ist die Ausnahme: sie wird mit einem frischen `L(0xb8dcf0, …)` **pro
  Aufruf** gebaut (`js/models.js:209`) und wäre schon heute instanzeigen.
- **Zustand liegt in `state.rooms[k]` als Liste von Einträgen**
  (`js/game.js:36`), jeder Eintrag ist `{ id, cell, x, y, z, rot, wall? }`
  (`js/game.js:685-694`), gespeichert wird alles zusammen mit `save()`
  (`js/game.js:38-42`), beim Start wird jeder Eintrag durch `placeItemMesh`
  wieder aufgebaut (`js/game.js:1177-1183`).
- **Vorbild Migration:** die Tapete war früher ein String pro Wohnung und ist
  heute ein Objekt pro Wand; `wallpaperOf` biegt das beim ersten Zugriff um und
  setzt `migrated = true`, worauf einmal gespeichert wird (`js/game.js:379-390`,
  `js/game.js:1186`).
- **Nacht:** `applyNight(k)` interpoliert Himmel, Hemisphäre und Sonne und
  setzt die Fensterscheiben der Fassade auf «bewohnt leuchtet»
  (`js/game.js:873-884`, Scheiben in `js/game.js:877-881`). Die Szene hat
  heute genau **zwei** Lichter: ein `HemisphereLight` und ein
  `DirectionalLight` (`js/game.js:61-62`).
- **Klang** ist ein kleiner Web-Audio-Baukasten: `initAudio()` beim Start
  (`js/game.js:912-921`, ausgelöst von `#btn-start`, `js/game.js:1174`),
  Bausteine `tone()` und `noiseBurst()`, sechs fertige Effekte in `sfx`
  (`js/game.js:948-956`). Alle prüfen `if (!AC) return`, sind also vor dem
  ersten Tipp still.
- **Animationen** laufen über `tween(dur, step, done)` (`js/game.js:608-609`),
  abgearbeitet in der Loop mit Smoothstep.

## Der Bedien-Entscheid

**Ein eigener Knopf in `#selbar`, nicht der zweite Tipp.** Der Knopf
(`#btn-action`) erscheint nur für Objekte, die in `ACTIONS` stehen, sitzt
zwischen `#wallpad` und «Weg damit» und beschriftet sich mit dem, was der
nächste Druck *tut*: «Licht aus», «Fenster auf», «Wanne leeren», bei einem
zustandslosen Objekt schlicht «Spielen».

Warum nicht der zweite Tipp:

1. **Er ist unsichtbar.** Ein Kind sieht einem Möbel nicht an, dass ein
   zweiter Tipp etwas anderes tut als der erste. `#selbar` ist die Leiste, die
   ohnehin schon sagt, was mit dem ausgewählten Ding geht.
2. **Er kollidiert mit dem Auswählen.** `select()` ruft zuerst `deselect()`
   (`js/game.js:672`); ein Tipp auf ein bereits ausgewähltes Möbel ist heute
   ein harmloses Neu-Auswählen. Beim Wandobjekt tippt man zusätzlich dauernd
   in die Nähe des Objekts, während man es mit dem `#wallpad` verschiebt —
   jeder Fehlgriff würde das Fenster auf- und zuklappen.
3. **Er braucht eine Zeitschwelle**, sonst ist er vom Doppeltipp-Zoom nicht zu
   unterscheiden. Der Handler wertet heute schon `downT`/`downX`
   (`js/game.js:996-999`); eine zweite Zeitlogik darüberzulegen ist die Art
   Heuristik, die auf dem iPad schiefgeht.
4. **Er beantwortet #36 nicht.** Ein Instrument ohne Zustand müsste beim
   zweiten Tipp klingen — also müsste man erst auswählen, dann nochmal tippen,
   um einen Ton zu hören. Mit dem Knopf heisst es «Spielen» und ist beim ersten
   Blick klar.

Warum das auch für #36 trägt: der Registry-Eintrag eines Instruments hat nur
`label` und `sound` und **kein** `apply`/`state`; `toggleAction()` steigt dann
nach dem Ton aus, ohne `entry.on` zu setzen und ohne `save()` zu rufen. #36
muss also genau eine Zeile pro Instrument in `ACTIONS` ergänzen und einen
`sfx`-Effekt mitbringen — keine neue Geste, kein zweites Interaktionsmuster.

## Der Zustand

Ein Feld pro Eintrag: **`on` (boolean)** in `state.rooms[k][i]`. Bedeutung ist
pro Objekt definiert, immer «der aktive Zustand»:

| id | `on: true` | `on: false` |
|---|---|---|
| `lampe` | Glühbirne leuchtet | dunkel |
| `badewanne` | Wasser drin | leer |
| `fenster` | Flügel gekippt | geschlossen |

Gelesen wird ausschliesslich über einen Helfer, nie direkt:

```js
const DEFAULT_ON = { lampe: true, badewanne: true, fenster: false };
const isOn = en => en.on === undefined ? !!DEFAULT_ON[en.id] : en.on;
```

Die Vorgaben sind **exakt das heutige Aussehen** der drei Modelle: die
Glühbirne ist heute immer `MAT.glow` (`js/models.js:108`), die Wanne hat heute
immer die Wasserscheibe (`js/models.js:117`), das Fenster hat heute keinen
beweglichen Flügel und steht damit zu (`js/models.js:207-213`). Ein alter
Spielstand ohne `on` sieht nach dem Update also pixelgleich aus wie vorher.

**Keine Migration, kein `migrated`-Flag.** Die Tapeten-Migration
(`js/game.js:379-390`) war nötig, weil sich die *Form* geändert hat — `applyLook`
hätte über einem String nicht iterieren können. Hier fehlt nur ein Feld mit
wohldefinierter Vorgabe; ein Umschreiben beim Laden brächte nichts ausser einem
zusätzlichen `save()` und einer zweiten Stelle, an der die Vorgabe steht. `on`
landet erst dann im Spielstand, wenn das Kind zum ersten Mal schaltet.

## Licht: emissiv, keine Lichtquelle

Kein `THREE.PointLight` pro Lampe. Die Szene hat heute zwei Lichter
(`js/game.js:61-62`); alle Materialien sind `MeshLambertMaterial`
(`js/models.js:3`), und three.js kompiliert deren Shader neu, sobald sich die
Zahl der Lichter ändert. Bei zehn Stockwerken plus Erdgeschoss sind zweistellig
viele Lampen möglich — pro Toggle ein Shader-Neubau und dauerhaft
Per-Fragment-Kosten für jede Lichtquelle auf jedem Material der Szene. Auf dem
iPad ist das der falsche Handel für einen Lichtschalter.

Stattdessen:

1. **Instanzeigenes Birnenmaterial.** `lampe()` klont `MAT.glow`
   (`MAT.glow.clone()`) für die Kugel und legt Kugel und Schirm als
   `g.userData.bulb` / `g.userData.shade` ab. Ohne den Klon schaltete ein
   Druck alle Lampen im Turm gleichzeitig.
2. **Nachtgekoppelte Stärke.** `emissiveIntensity` der Birne ist
   `on ? 0.5 + 0.5 * nightK : 0`, dazu wechselt die Farbe zwischen `0xffd98a`
   (an) und `0xcfc0a4` (aus). Bei Tag glimmt sie dezent, bei Nacht deutlich.
3. **Die Fassade verrät es.** `applyNight` entscheidet heute pro Etage
   `lit = k > 0.5 && tenantIn(i)` (`js/game.js:877-881`). Neu:
   `lit = k > 0.5 && tenantIn(i) && (keine Lampe in der Wohnung || mindestens
   eine Lampe an)`. Eine Wohnung ohne Lampe verhält sich damit **exakt wie
   heute**; eine Wohnung mit Lampen lässt sich von aussen sichtbar
   dunkelschalten. Das ist der Teil, der `TODO.md:6` («Bei Nacht soll die Lampe
   wirklich Licht geben — pro Lampe an/aus schaltbar») einlöst.

`TODO.md:5` (Tag/Nacht mit Innenbeleuchtung) bleibt offen — eine echte
Innenraum-Beleuchtungsschicht ist ein eigenes Thema und wird hier nicht
angefasst.

## Die drei Objekte im Detail

### Fenster — Kippflügel

Der Flügel (Scheibe `js/models.js:209` plus die beiden Sprossen
`js/models.js:210`) wandert in eine Gruppe, deren Drehpunkt an der
**Unterkante** der Scheibe liegt (y ≈ −0.41). Offen heisst
`rotation.x = -0.45` (rund 26°, Kippfenster), zu heisst `0`. Die Fensterbank
(`js/models.js:211`), der Rahmen (`js/models.js:208`) und die roten Läden
(`js/models.js:212`) bleiben stehen.

Verworfen: ein nach innen aufschlagender Drehflügel. Die Scheibe ist 0.62
breit; aufgeschlagen ragte sie bis zu 0.62 in den Raum und schnitte je nach
Möblierung durch Schrank oder Regal — Wandobjekte kennen keine
Kollisionsprüfung (`clampEntry` behandelt sie rein entlang der Wand,
`js/game.js:427-434`). Der Kippflügel ragt bei 0.94 Scheibenhöhe höchstens
≈ 0.36 nach innen und sitzt auf 1.05 Höhe (`js/game.js:689`), also über allen
Bodenmöbeln.

Klang: `sfx.creak()` — ein kurzer, tiefer Holzknarz.

### Badewanne — Wasser

Die Wasserscheibe (`js/models.js:117`) bekommt den Griff `g.userData.water`.
Gefüllt: sichtbar, `scale.y = 1`, `position.y = 0.42`. Leer:
`scale.y = 0.05`, `position.y = 0.115` (auf dem Wannenboden), danach
`visible = false`. Die Tween-Dauer ist die Füllzeit, das Geräusch läuft
parallel.

Kein Materialklon nötig — `visible` und `scale` sind Objekt-, nicht
Materialeigenschaften; `MAT.water` bleibt geteilt.

Klang: `sfx.fill()` (rauschendes Einlaufen, aufsteigend) bzw. `sfx.drain()`
(gluckerndes Ablaufen, absteigend).

### Lampe — Licht

Griffe `g.userData.bulb` (Kugel, geklontes `MAT.glow`) und
`g.userData.shade` (Schirm). Beim Einschalten hellt der Schirm minimal auf
(`emissive` 0x000000 → 0x3a2408), damit auch bei Tag sichtbar ist, dass etwas
passiert ist. Kein Tween nötig — ein Lichtschalter schaltet hart; einzig der
Fassaden-Effekt läuft über den bestehenden `applyNight`-Pfad.

Klang: `sfx.click()` — trockener Schalterklick.

## Schnittstelle `ACTIONS`

```js
/* Registry der «Objekte, die etwas tun». Ein Eintrag mit `apply` trägt einen
   Zustand (Feld `on` im Spielstand); ein Eintrag ohne `apply` ist ein reiner
   Auslöser — genau der Fall, den die Instrumente aus Issue #36 brauchen. */
const ACTIONS = {
  lampe:     { doOn: 'Licht an',     doOff: 'Licht aus',    apply: applyLampe,  sound: on => sfx.click() },
  fenster:   { doOn: 'Fenster auf',  doOff: 'Fenster zu',   apply: applyFenster, sound: on => sfx.creak() },
  badewanne: { doOn: 'Wanne füllen', doOff: 'Wanne leeren', apply: applyWanne,   sound: on => on ? sfx.fill() : sfx.drain() },
  /* Beispiel für #36 (hier nicht eingebaut):
     blockfloete: { label: 'Spielen', sound: () => sfx.note(74) } */
};
```

- `doOn`/`doOff` sind Beschriftungen für den **nächsten Druck**: ist das Objekt
  aus, steht `doOn` auf dem Knopf.
- `label` (statt `doOn`/`doOff`) markiert einen zustandslosen Eintrag.
- `apply(mesh, on, q)` setzt die Darstellung; `q` läuft von 0 bis 1 und kommt
  aus `tween` — beim Laden wird `apply(mesh, on, 1)` einmal direkt gerufen.
- `sound(on)` darf `sfx` benutzen; `sfx` ist vor `#btn-start` still, weil jeder
  Effekt `if (!AC) return` prüft (`js/game.js:948-956`).

## Assumptions

- **A1** [med] **Eigener Knopf `#btn-action` in `#selbar`, kein zweiter Tipp.**
  Verworfen: Tipp auf ein bereits ausgewähltes Objekt schaltet. Begründung
  ausführlich unter «Der Bedien-Entscheid»; der Kern ist, dass der zweite Tipp
  keine Affordanz hat, sich mit dem Neu-Auswählen in `select()`
  (`js/game.js:672-678`) und mit dem `#wallpad`-Verschieben
  (`js/game.js:1065-1066`) überlagert und für ein zustandsloses Instrument aus
  #36 einen Umweg über «erst auswählen, dann nochmal tippen» erzwingt.

- **A2** [med] **Interaktion bleibt im Einrichten-Modus.** Ausserhalb werden
  Möbel gar nicht geraycastet (`js/game.js:1023-1032`), und `#selbar` hängt an
  `select()`, das nur dort aufgerufen wird. Verworfen: Möbel auch im freien
  Blick antippbar machen. Das hiesse, `select()` ausserhalb des
  Einrichten-Modus zuzulassen — mitsamt «Verschieben», «Drehen» und «Weg
  damit», also Löschen mit zwei Tippern ohne Einrichten-Modus. Das ist ein
  eigener Entscheid und gehört nicht in dieses Issue. Folge: wer eine Lampe
  schalten will, tippt zuerst auf das Stockwerk. Als Nachtrag festgehalten
  unter «Consequences».

- **A3** [high] **Ein einzelnes boolesches Feld `on` pro Eintrag**, kein
  Objekt, kein Aufzählungstyp. Verworfen: `{ state: 'offen' | 'zu' }` oder ein
  paralleles `state.objects`-Register. Alle drei Objekte haben genau zwei
  Zustände, und der Eintrag in `state.rooms` ist bereits die Stelle, an der
  alles Objektbezogene liegt (`js/game.js:685-694`); ein zweites Register
  müsste beim Löschen (`removeItem`, `js/game.js:715-719`) mitgepflegt werden
  und wäre die nächste Quelle für Karteileichen — vergleiche die schon
  bekannten leeren `wallpaperOf`-Objekte (`TODO.md:43-44`).

- **A4** [high] **Keine Migration beim Laden, sondern eine Vorgabe beim Lesen.**
  `DEFAULT_ON = { lampe: true, badewanne: true, fenster: false }` bildet das
  heutige Aussehen ab. Verworfen: ein Durchlauf über `state.rooms` beim Start
  mit `migrated = true` nach dem Vorbild von `wallpaperOf`
  (`js/game.js:379-390`). Dort änderte sich die *Form* des Werts und der
  Lesecode wäre sonst gebrochen; hier fehlt nur ein Feld. Eine Migration
  schriebe bei jedem alten Spielstand einmal die ganze Datei neu und legte die
  Vorgabe an einer zweiten Stelle ab.

- **A5** [high] **Emissives Material statt `THREE.PointLight` pro Lampe.**
  Verworfen: eine echte Punktlichtquelle pro eingeschalteter Lampe. Die Szene
  fährt heute mit zwei Lichtern (`js/game.js:61-62`) und durchweg
  `MeshLambertMaterial` (`js/models.js:3`); jede Änderung der Lichtzahl löst in
  three.js eine Shader-Neukompilierung aus, und bei elf Etagen sind zweistellig
  viele Lampen realistisch. Der sichtbare Gewinn — ein Lichtkegel im Raum — ist
  gegenüber einer stärker leuchtenden Birne plus erleuchteter Fassade klein.

- **A6** [med] **Die Fassadenfenster folgen den Lampen**, aber nur wenn die
  Wohnung überhaupt eine Lampe hat: `lit = nacht && tenantIn(i) && (keine
  Lampe || mindestens eine an)`. Verworfen: «Fassade leuchtet nur noch, wenn
  eine Lampe an ist». Das machte jede bewohnte Wohnung ohne Lampe über Nacht
  schwarz und wäre für bestehende Spielstände eine sichtbare Verschlechterung
  gegenüber `js/game.js:877-881`.

- **A7** [med] **Kippflügel statt Drehflügel beim Fenster.** Verworfen: nach
  innen aufschlagender Flügel. Begründung oben — 0.62 Scheibenbreite gegen
  keinerlei Kollisionsprüfung für Wandobjekte (`js/game.js:427-434`).

- **A8** [high] **Die Modelle bekommen benannte Griffe in `userData`, die Logik
  bleibt in `js/game.js`.** Verworfen: `js/models.js` bekommt Schalt-Methoden.
  Das ist das bestehende Muster von `userData.wheel` (`js/models.js:139`,
  `js/game.js:463`); `js/models.js` baut Geometrie und weiss nichts von
  Spielstand, `sfx` oder `tween`.

- **A9** [med] **`lampe()` klont `MAT.glow`, sonst nichts.** Verworfen: alle
  drei Objekte auf instanzeigene Materialien umstellen. Nur die Birne wird
  materialseitig geschaltet; Wanne (`visible`/`scale`) und Fenster (`rotation`)
  kommen ohne Materialänderung aus, und jeder überflüssige Klon kostet
  Speicher und einen eigenen Shader-Cache-Eintrag pro Möbelstück.

- **A10** [high] **Drei neue `sfx`-Effekte: `creak`, `fill`/`drain`, `click`** —
  gebaut aus den vorhandenen `tone()`/`noiseBurst()`-Bausteinen, keine
  Audiodateien. Verworfen: echte Samples. Das Spiel hat bis heute keine einzige
  Mediendatei für Klang (`js/game.js:912-956`), und ein Sample-Ladepfad wäre
  neue Infrastruktur für drei Geräusche.

- **A11** [high] **Kein `version.js`-Bump, kein `chore(release)`-Commit.** Der
  Changelog-Eintrag kommt unter `## [Unreleased]`. Verworfen: Version im selben
  PR heben. Die Version entsteht beim Release; parallel angereicherte Issues
  kollidierten sonst in `version.js`.

- **A12** [low] **`#btn-action` steht zwischen `#wallpad` und «Weg damit»** und
  ist wie `#btn-move`/`#btn-rot` per `classList.toggle('hidden', …)` geschaltet
  (`js/game.js:674-678`). Verworfen: ganz links, vor «Verschieben». Rechts
  neben den Positionierhilfen und links vom Gefahrenknopf ist die
  Lesereihenfolge «wo → was → weg».

## Consequences

- **`#selbar` wird breiter.** Die Leiste überlappt laut `TODO.md:39` schon
  heute `#btn-catalog`, wenn etwas ausgewählt ist. Der Knopf erscheint nur für
  drei von 32 Katalogeinträgen (`js/models.js:251-270`) und beim Fenster
  gemeinsam mit dem `#wallpad` — das ist der breiteste Fall und gehört im
  Schlusscheck auf einem schmalen Viewport angesehen. Der Eintrag in `TODO.md`
  bleibt offen und wird hier nicht gelöst.
- **Der Spielstand wächst um ein Feld pro geschaltetem Objekt.** Nur
  geschaltete Objekte bekommen `on`; ein nie angerührter Spielstand bleibt
  byte-gleich.
- **Instrumente aus #36 kosten danach eine Zeile.** Ein Eintrag mit `label` und
  `sound` in `ACTIONS` genügt; `toggleAction` steigt ohne Zustandsschreiben
  aus. Diese Spec baut die Weiche, aber trägt kein Instrument ein — #36 ist
  noch nicht implementiert.
- **`TODO.md:6` verschwindet, `TODO.md:5` bleibt.** Die Innenraum-Beleuchtung
  als eigene Schicht ist weiter offen; hier wird nur pro Lampe geschaltet und
  die Fassade daran gekoppelt.
- **`applyNight` bekommt eine Abhängigkeit auf `state.rooms`.** Wer eine Lampe
  schaltet, muss `applyNight(nightK)` nachziehen, sonst hinkt die Fassade bis
  zum nächsten Tag/Nacht-Wechsel hinterher. Das ist eine stille Kopplung und
  gehört kommentiert.
- **Kein Effekt ausserhalb des Einrichten-Modus** (A2). Im Cutaway-Blick sieht
  man alle Wohnungen, kann aber nichts schalten. Falls das stört, ist das ein
  eigenes Folge-Issue, kein Nachtrag hier.

## Acceptance Criteria

- [ ] Im Einrichten-Modus zeigt `#selbar` bei ausgewählter **Lampe**,
      **Badewanne** oder **Fenster** einen zusätzlichen Knopf; bei allen
      anderen Möbeln (z. B. Tisch, Sofa, Poster) erscheint er nicht.
- [ ] Die Knopfbeschriftung nennt die nächste Wirkung und wechselt beim Druck:
      «Licht aus» ↔ «Licht an», «Fenster auf» ↔ «Fenster zu», «Wanne leeren» ↔
      «Wanne füllen».
- [ ] **Fenster:** Druck kippt den Flügel sichtbar auf (Drehung um die
      Unterkante) und wieder zu; Rahmen, Fensterbank und Läden bleiben stehen.
- [ ] **Badewanne:** Druck lässt das Wasser sichtbar ab (Wasserscheibe
      unsichtbar) und wieder ein.
- [ ] **Lampe:** Druck schaltet die Glühbirne aus (`emissiveIntensity` 0) und
      wieder an; bei Nacht ist die eingeschaltete Birne deutlich heller als bei
      Tag.
- [ ] Das Schalten einer Lampe verändert **nur diese** Lampe — eine zweite
      Lampe im selben Raum bleibt unberührt (kein geteiltes `MAT.glow`).
- [ ] Bei Nacht sind die Fassadenfenster einer bewohnten Etage dunkel, wenn
      dort alle Lampen aus sind, und hell, sobald mindestens eine an ist. Eine
      bewohnte Etage **ohne** Lampe leuchtet unverändert wie bisher.
- [ ] Jeder Schaltvorgang spielt ein eigenes Geräusch; kein Geräusch vor dem
      Tipp auf `#btn-start` (kein `AudioContext`-Fehler in der Konsole).
- [ ] Der Zustand überlebt einen Reload: geschaltete Objekte stehen nach
      `location.reload()` wieder so da, wie sie verlassen wurden.
- [ ] **Alter Spielstand ohne `on`:** ein Spielstand, der vor dieser Änderung
      geschrieben wurde (Einträge ganz ohne Feld `on`), lädt fehlerfrei; Lampe
      leuchtet, Wanne ist voll, Fenster ist zu — also genau das bisherige
      Aussehen. Es wird dabei **nichts** in den Spielstand zurückgeschrieben,
      solange nicht geschaltet wird.
- [ ] Die Szene enthält weiterhin genau zwei Lichter (`HemisphereLight`,
      `DirectionalLight`) — keine Lichtquelle pro Lampe.
- [ ] `ACTIONS` verarbeitet einen Eintrag **ohne** `apply` (nur `label` +
      `sound`): Knopf erscheint mit fester Beschriftung, Druck spielt den Ton,
      `entry.on` bleibt ungesetzt. Nachweisbar über einen zur Laufzeit
      eingefügten Testeintrag.
- [ ] Beim Löschen eines interaktiven Objekts («Weg damit») verschwinden Objekt
      und Zustand zusammen; `#btn-action` ist danach ausgeblendet.
- [ ] `TODO.md:6` ist entfernt, `TODO.md:5` unverändert vorhanden.
- [ ] Keine Konsolenfehler und keine Warnungen beim Laden, Schalten, Nachtwechsel
      und Reload.
- [ ] `version.js` unverändert; Changelog-Eintrag steht unter `## [Unreleased]`.
