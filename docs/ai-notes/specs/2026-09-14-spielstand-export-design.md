# Spec: Turm als Datei sichern und wieder einlesen

Issue: `freaxnx01/game-wipfelkratzer#52`
Datum: 2026-09-14

**Baut auf #53 auf.** Diese Spec setzt die Slot-Ebene aus
`docs/ai-notes/specs/2026-09-14-mehrere-spielstaende-design.md` voraus:
`js/staende.js` mit Index, `aktiverStand()`, `neuerStand()`, `loescheStand()`
und der Übersicht «Meine Türme» (`#staende`). Ohne #53 gibt es keinen freien
Platz, in den ein Import gehen könnte — deshalb kommt #52 danach und baut das
Dateiformat **einmal**, gleich für mehrere Türme.

## Problem

Der Spielstand lebt ausschliesslich im Browser: ein `localStorage`-Schlüssel je
Turm (vor #53: `wipfelkratzer-v1`, `js/game.js:36,41`), die Fotos daneben
(`js/game.js:1137-1138`). Wer die Browserdaten löscht, ein anderes Gerät nimmt
oder das Tablet neu aufsetzt, verliert den Turm — und hat keinen Weg, ihn
vorher zu sichern.

Gewünscht: den Turm als **Datei exportieren** und wieder **importieren**.

## Ausgangslage im Code (Belege)

- Der Stand ist bereits JSON: `JSON.stringify({ ...state, wallpaper })`
  (`js/game.js:38-41`). Ein Export ist im Kern dieselbe Zeichenkette.
- Der Weg zum Download existiert: die Fotogalerie erzeugt ein `<a download>` mit
  einer Data-URL und klickt es (`js/game.js:1161-1165`).
- Fotos sind JPEG-Data-URLs, max. 20 Stück, max. 800 px breit, Qualität 0,72
  (`js/game.js:1140-1146`) — je Foto grob 30-80 KB.
- Es gibt bereits eine Migration alter Stände: eine Tapete als String wandert
  auf vier Wände (`js/game.js:379-386`). Das ist der Beleg dafür, dass
  Stand-Inhalte **Generationen** haben und eine Datei ihre mitführen muss.
- Ein Raum-Eintrag hat die Form `{ id, x, y, z, rot, wall?, cell? }`
  (`js/game.js:447-459`, `js/game.js:696-703`); beim Laden wird er ungeprüft
  an `makeFurniture(entry.id)` weitergereicht (`js/game.js:449`).
- Die erlaubten Werte stehen als Exporte in `js/models.js` bereit: `CATALOG`
  (`js/models.js:251`), `WALL_ITEMS`, `WALLS`, `FLOORS` — importiert in
  `js/game.js:3`.
- Höchstens zehn Stockwerke: `MAXF = 10` (`js/game.js:6`); Wandnamen:
  `WALL_KEYS = ['back', 'left', 'right', 'front']` (`js/game.js:15`).
- Die Spielversion liegt als `window.GAME_VERSION` bereit (`version.js:3`).
- Bibliotheken: ausschliesslich `three` über die Import-Map (`index.html:10-27`);
  neue Abhängigkeiten sind verboten (`CLAUDE.md:796-821`).
- Playwright im Vordergrund ist das Test-Gate (`CLAUDE.md:508-567`).

## Goals

- Einen einzelnen Turm als Datei sichern — **wahlweise mit oder ohne Fotos**.
- Eine solche Datei wieder einlesen, und zwar in einen **freien Platz**, ohne
  einen bestehenden Turm anzufassen.
- Die Datei trägt ihre Version mit und ist in einem halben Jahr noch lesbar.
- Eine fremde, kaputte oder böswillige Datei kann das Spiel nicht beschädigen.
- Beides funktioniert auf dem iPad, wo tatsächlich gespielt wird.

## Non-Goals

- Alle Türme auf einmal sichern (ein Archiv über mehrere Stände).
- Import, der einen bestehenden Turm überschreibt oder mit ihm verschmilzt.
- Cloud, Konten, Geräte-Synchronisation.
- Export einzelner Fotos — den gibt es bereits (`js/game.js:1161-1165`).

## Assumptions

- **A1** [high] Die Exportdatei ist **JSON mit Hülle**, nicht der nackte
  Stand-Inhalt: `{ typ, version, spiel, erstellt, name, bild, stand, fotos }`.
  Verworfen: die Zeichenkette aus `js/game.js:41` unverändert wegschreiben.
  Grund: ohne Hülle gibt es keinen Platz für Version, Name und Fotos, und eine
  beliebige JSON-Datei wäre von einem Spielstand nicht unterscheidbar.
- **A2** [high] Die Datei endet auf **`.json`** und trägt den Typ
  `application/json`. Verworfen: eine eigene Endung wie `.wipfelkratzer`.
  Grund: der Dateidialog auf iOS filtert nach Typ; eine unbekannte Endung ist
  in «Dateien» ausgegraut und damit nicht auswählbar. Der Name macht die
  Zugehörigkeit klar: `wipfelkratzer-<turmname>-YYYY-MM-DD.json`.
- **A3** [high] `version` in der Datei bezeichnet die Generation des
  **Stand-Inhalts**, nicht die Spielversion. `2` = Tapete pro Wand (heutiger
  Stand), `1` = Tapete als String. Beide werden angenommen, weil die bestehende
  Migration den Fall bereits abfängt (`js/game.js:379-386`); alles `> 2` wird
  mit einer freundlichen Meldung abgelehnt. Verworfen: `window.GAME_VERSION`
  als Dateiversion. Grund: die Spielversion steigt bei jedem Release, das
  Speicherformat nicht — sie wird als `spiel` nur informativ mitgeschrieben
  (`version.js:3`).
- **A4** [high] Der Import legt **immer einen neuen Turm** über
  `staende.neuerStand()` an und überschreibt nie. Sind schon vier Türme da,
  wird der Import abgelehnt mit dem Hinweis, zuerst einen zu löschen.
  Verworfen: «überschreiben?»-Rückfrage. Grund: das Überschreiben ist die
  gefährlichste Geste im Spiel und mit #53 schlicht nicht mehr nötig.
- **A5** [med] Fotos sind beim Export **wählbar**: die Karte bietet «Mit Fotos»
  und «Ohne Fotos» und nennt jeweils die ungefähre Grösse. Ohne Fotos sind es
  wenige Kilobyte, mit Fotos bis etwa 2 MB (20 × ~60-80 KB Base64,
  `js/game.js:1141-1145`). Verworfen: immer mit Fotos (Datei zu gross fürs
  Verschicken) und immer ohne (halbe Erinnerung weg).
- **A6** [med] Der Stand-Inhalt wird beim Import **nicht gemerged, sondern aus
  einer Positivliste neu aufgebaut** (`bereinigeStand()`): nur bekannte Felder,
  nur `CATALOG`-`id`s (`js/models.js:251`), nur `WALL_KEYS`-Wandnamen
  (`js/game.js:15`), nur `WALLS`/`FLOORS`-Tapeten, `floors` auf `0…MAXF`
  begrenzt (`js/game.js:6`), Zahlen auf Endlichkeit geprüft. Verworfen:
  `Object.assign` wie beim Laden (`js/game.js:36`). Grund: dort ist die Quelle
  der eigene Schlüssel, hier eine fremde Datei — ein `__proto__`- oder
  `rooms: {"1": [{"id": "<script>"}]}`-Eintrag darf gar nicht erst in `state`
  landen, und ein unbekanntes Möbel liesse `makeFurniture()` auflaufen
  (`js/game.js:449`).
- **A7** [med] Fotos werden ebenso gefiltert: höchstens 20 (`js/game.js:1145`),
  `url` muss mit `data:image/jpeg;base64,` oder `data:image/png;base64,`
  beginnen, `text` wird auf 500 Zeichen gekürzt, `t` muss eine endliche Zahl
  sein. Verworfen: Fotos ungeprüft übernehmen. Grund: sie landen als `src` in
  der Galerie (`js/game.js:1160`); eine `javascript:`- oder `data:text/html`-URL
  hätte dort nichts zu suchen.
- **A8** [med] Heruntergeladen wird über einen **`Blob` mit Object-URL** in
  einem `<a download>` — und, wenn das Gerät Dateien teilen kann
  (`navigator.canShare({ files })`), stattdessen über `navigator.share`.
  Verworfen: Data-URL wie bei den Fotos (`js/game.js:1163`). Grund: iOS-Safari
  öffnet grosse Data-URLs in einem neuen Tab statt sie zu sichern, und eine
  2-MB-Data-URL reisst zusätzlich eine Kopie im Speicher auf. Dieselbe
  Zweiteilung hat #33 für die Foto-Sicherung bereits gewählt.
- **A9** [med] Eingelesen wird über ein verstecktes
  `<input type="file" accept="application/json,.json">` samt `FileReader`.
  Verworfen: Drag-and-drop. Grund: auf einem Tablet gibt es kein Ziehen von
  Dateien; der Dateidialog ist der einzige Weg, der auf iPad und Rechner
  gleichermassen funktioniert.
- **A10** [med] Die Datei wird auf **6 MB** begrenzt, bevor sie überhaupt
  gelesen wird. Verworfen: unbegrenzt. Grund: 20 Fotos ergeben höchstens rund
  2 MB (A5); alles jenseits von 6 MB ist entweder kaputt oder ein Angriff, und
  `JSON.parse` auf einer 500-MB-Datei friert das Tablet ein.
- **A11** [med] Schlägt beim Import das Schreiben fehl (Quota), wird der eben
  angelegte Turm **wieder entfernt** (`staende.loescheStand()`), statt einen
  halb gefüllten stehen zu lassen. Verworfen: stehen lassen und hoffen. Beleg:
  die Quota ist in diesem Spiel ein realer Fall, das Spiel fängt sie heute schon
  ab (`js/game.js:1138`).
- **A12** [low] Import und Export leben beide in der Übersicht «Meine Türme»:
  «Sichern» auf jeder Karte, «Turm einlesen» neben «Neuer Turm». Verworfen: ein
  eigener Eintrag im Extras-Menü. Grund: die Übersicht ist seit #53 der Ort, an
  dem es um ganze Türme geht; zwei Orte für dieselbe Sache verwirren.
- **A13** [low] Nach einem erfolgreichen Import wird **nicht** automatisch
  gewechselt; die Übersicht zeigt den neuen Turm mit einer Meldung, der Wechsel
  bleibt ein bewusster Tipp. Verworfen: sofort hinwechseln. Grund: der Wechsel
  lädt die Seite neu (#53, A5) und riss dem Kind sonst den gerade gebauten Turm
  unter den Fingern weg.
- **A14** [low] Das Vorschaubild (`bild` aus dem Index, #53 A6) wandert mit in
  die Datei und wird beim Import übernommen. Verworfen: weglassen und beim
  ersten Öffnen neu aufnehmen. Grund: es kostet ~8 KB und die Karte des
  importierten Turms wäre sonst bis zum ersten Wechsel ein leerer Platzhalter.

## Entwurf

### Dateiformat

```json
{
  "typ": "wipfelkratzer-stand",
  "version": 2,
  "spiel": "0.5.0",
  "erstellt": "2026-09-14T10:12:00.000Z",
  "name": "Julias Turm",
  "bild": "data:image/jpeg;base64,…",
  "stand": { "floors": 3, "rooms": { … }, "wallpaper": { … }, "flooring": { … },
             "fulfilled": { … }, "nuts": 7, "bridge": true, "garden": false,
             "night": false, "cutaway": false },
  "fotos": [ { "url": "data:image/jpeg;base64,…", "text": "…", "t": 1789… } ]
}
```

- `stand` ist exakt das Objekt, das heute in den `localStorage` geschrieben wird
  (`js/game.js:38-41`) — kein zweites Format.
- `fotos` fehlt (`null`), wenn ohne Fotos exportiert wurde.
- `typ` ist die Erkennungsmarke: fehlt sie, ist es kein Spielstand.

### Neues Modul `js/standdatei.js`

Ohne three.js-Bezug und ohne DOM-Zugriff, damit es einzeln prüfbar ist:

```
DATEI_V = 2
MAX_DATEI = 6 * 1024 * 1024
baueDatei({ name, bild, stand, fotos })  -> Objekt in Dateiform
dateiName(name, datum)                   -> "wipfelkratzer-<name>-YYYY-MM-DD.json"
pruefeDatei(text)                        -> { ok: true, datei } | { ok: false, grund }
bereinigeStand(roh)                      -> sauberes state-Objekt (Positivliste)
bereinigeFotos(roh)                      -> Array (höchstens 20, geprüfte Data-URLs)
```

`pruefeDatei()` gibt im Fehlerfall einen **kindgerechten deutschen Satz** zurück
— nicht den technischen Fehler. Die unterschiedenen Fälle:

| Fall | Meldung |
|---|---|
| kein JSON | «Diese Datei versteht Willi nicht.» |
| `typ` fehlt/falsch | «Das ist kein gesicherter Wipfelkratzer.» |
| `version > 2` | «Diese Datei kommt aus einer neueren Version des Spiels.» |
| `stand` fehlt/kein Objekt | «In dieser Datei steckt kein Turm.» |
| grösser als 6 MB | «Diese Datei ist zu gross.» |

### Export

`exportiereStand(eintrag, mitFotos)` in `js/game.js`:

1. Stand-Inhalt und Fotos direkt aus `localStorage` lesen (`eintrag.standKey`,
   `eintrag.fotoKey`) — auch für **nicht aktive** Türme, ohne sie zu laden.
   Ist der exportierte Turm der aktive, vorher `schreibeStand()` aufrufen, damit
   der entprellte Speicherstand (`js/game.js:37`) aktuell ist.
2. `baueDatei(...)`, `JSON.stringify`, `new Blob([...], { type: 'application/json' })`.
3. Kann das Gerät Dateien teilen → `navigator.share({ files: [new File(...)] })`;
   ein `AbortError` (Kind bricht ab) bleibt folgenlos.
4. Sonst Object-URL, `<a download>` klicken, URL nach kurzer Frist mit
   `URL.revokeObjectURL` freigeben.

### Import

`importiereDatei(file)` in `js/game.js`:

1. `file.size > MAX_DATEI` → ablehnen, ohne zu lesen.
2. `FileReader.readAsText`, dann `pruefeDatei()`.
3. `staende.neuerStand(name)` → `null` heisst «kein Platz», Meldung und Abbruch.
4. Stand-Inhalt und (falls vorhanden) Fotos in die Schlüssel des neuen Eintrags
   schreiben; `bild` über `staende.merkeBild()`. Schlägt ein Schreiben fehl →
   `staende.loescheStand(neu.id)` und Meldung «Der Speicher ist voll».
5. `renderStaende()` und eine Meldung mit dem Namen des neuen Turms. Kein
   automatischer Wechsel (A13).

Doppelte Namen werden nicht verhindert, aber entzerrt: heisst ein Turm bereits
so, bekommt der importierte den Zusatz «(eingelesen)».

### Oberfläche

In der Übersicht `#staende` (aus #53):

- Pro Karte ein Knopf «Sichern»; ein Tipp klappt in der Karte eine Zeile mit
  «Mit Fotos (ca. N MB)» und «Ohne Fotos (ca. N KB)» auf.
- Neben «Neuer Turm» ein Knopf «Turm einlesen» plus das versteckte
  `<input type="file">`.

## Consequences

- **Die Datei ist der Stand, im Klartext.** Wer sie öffnet, sieht das
  Speicherformat und kann es von Hand ändern. Das ist bei einem Kinderspiel
  ohne Wettbewerb harmlos — der Import prüft ohnehin alles nach (A6), ein
  manipulierter Stand kann also höchstens einen seltsamen, aber gültigen Turm
  ergeben.
- **Der Import ist nicht verlustfrei.** Was die Positivliste nicht kennt — ein
  Möbel aus einer neueren Spielversion, eine unbekannte Tapete — fällt still
  weg. Gewollt: lieber ein Turm mit einem fehlenden Sessel als ein weisses Bild.
- **Zwei Wege, zwei Ergebnisse.** Derselbe Tipp öffnet auf dem iPad ein
  Share-Sheet und legt am Rechner eine Datei ab. Eine Anleitung stimmt damit nie
  für beide Geräte gleichzeitig.
- **Der Share-Weg lässt sich headless nur gestellt prüfen.** Das echte
  iPad-Sheet und der iOS-Dateidialog bleiben ein manueller Schritt — genau wie
  bei #33.
- **Spitzenspeicher beim Export mit Fotos.** Die Bilder liegen kurzzeitig
  dreifach vor: als Data-URLs im Array, im JSON-String und im `Blob`. Bei
  20 Fotos grob 6 MB auf einem Tablet — vertretbar, aber nicht null. Der Knopf
  ist `disabled`, solange der Vorgang läuft.
- **Die vierte Datei unter `js/`.** Bisher `models.js`, `game.js`, `staende.js`
  (#53); `standdatei.js` kommt dazu — relativ importiert, kein Eintrag in der
  Import-Map nötig.
- **Die Positivliste ist ab jetzt Unterhalt.** Jedes neue Möbel muss in
  `CATALOG` stehen, sonst verschwindet es beim Import. Da `bereinigeStand()`
  `CATALOG` importiert statt eine eigene Liste zu führen, geschieht das
  automatisch — das ist der Grund für diese Wahl.
- **`version: 2` ist eine Zusage.** Ändert #51 später das Format des
  Stand-Inhalts, muss `DATEI_V` auf 3 steigen **und** `bereinigeStand()` eine
  Migration von 2 nach 3 mitbringen — sonst sind heute gesicherte Dateien in
  einem halben Jahr tot. Diese Spec legt die Stelle fest, an der das passiert.

## Acceptance Criteria

- [ ] Ein Turm lässt sich aus seiner Karte in der Übersicht sichern; es entsteht
      genau **eine** Datei `wipfelkratzer-<name>-YYYY-MM-DD.json`.
- [ ] «Ohne Fotos» erzeugt eine Datei mit `fotos: null`; «Mit Fotos» eine mit
      allen Fotos des Turms — und **nur** dessen Fotos.
- [ ] Die Datei enthält `typ: "wipfelkratzer-stand"`, eine Zahl `version`, die
      Spielversion aus `window.GAME_VERSION` (`version.js:3`) und den
      Stand-Inhalt unter `stand`.
- [ ] Auch ein **nicht aktiver** Turm lässt sich sichern, ohne dass zu ihm
      gewechselt wird.
- [ ] Beim aktiven Turm enthält die Datei auch Änderungen, die jünger als die
      300-ms-Entprellung sind (`js/game.js:37`).
- [ ] Export → den Turm löschen → Import ergibt denselben Turm: gleiche
      Stockwerkzahl, gleiche Möbel an gleicher Stelle, gleiche Tapeten, gleiche
      Fotos.
- [ ] Der Import legt **immer einen neuen** Turm an; kein bestehender Turm und
      keine bestehende Galerie wird verändert.
- [ ] Bei bereits vier Türmen lehnt der Import ab und sagt, dass zuerst einer
      gelöscht werden muss — es entsteht **kein** halb angelegter Turm.
- [ ] Eine Datei aus einer **älteren Generation** (`version: 1`, Tapete als
      String) lässt sich einlesen und der Turm lädt danach mit Tapete auf allen
      vier Wänden (`js/game.js:379-386`).
- [ ] Eine Datei mit `version: 99` wird mit der Meldung «neuere Version»
      abgelehnt.
- [ ] Kaputtes JSON, eine fremde JSON-Datei ohne `typ`, eine leere Datei und
      eine Datei über 6 MB werden je mit einer eigenen, verständlichen Meldung
      abgelehnt — und das Spiel läuft danach unverändert weiter.
- [ ] Eine böswillige Datei richtet nichts an: `__proto__`-Schlüssel landen
      nicht im Prototyp, unbekannte Möbel-`id`s werden verworfen, `floors`
      ausserhalb `0…10` wird begrenzt, `rooms`-Einträge mit unsinnigen
      Koordinaten fallen weg, und eine Foto-`url`, die nicht
      `data:image/...;base64,` ist, wird nicht übernommen.
- [ ] Nach einem abgelehnten Import ist die Zahl der Türme unverändert.
- [ ] **Regression:** ein alter Einzelstand aus `wipfelkratzer-v1` lädt
      weiterhin unverändert (Stockwerke, Möbel, Tapeten, Fotos) und lässt sich
      als erster Turm sichern — Export und Import fassen weder den Schlüssel
      noch sein Format an (`js/game.js:36,41`).
- [ ] Beim ganzen Ablauf bleibt die Konsole fehlerfrei.
- [ ] `index.html` lädt weiterhin keine Bibliothek ausser `three` (Import-Map
      `index.html:10-27` unverändert, kein `package.json`).
- [ ] `version.js` ist **unverändert**; `CHANGELOG.md` hat einen Eintrag unter
      `## [Unreleased]` / `### Added` mit Bezug auf #52.
