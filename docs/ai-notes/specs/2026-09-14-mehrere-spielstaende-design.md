# Spec: Mehrere Spielstände nebeneinander führen

Issue: `freaxnx01/game-wipfelkratzer#53`
Datum: 2026-09-14

## Problem

Es gibt heute **genau einen** Spielstand. Er liegt flach in einem einzigen
`localStorage`-Schlüssel: gelesen in `js/game.js:36`
(`localStorage.getItem('wipfelkratzer-v1')`), geschrieben in `js/game.js:41`
(`localStorage.setItem('wipfelkratzer-v1', JSON.stringify({ ...state, wallpaper }))`).
Die Fotos liegen daneben in einem zweiten, völlig unabhängigen Schlüssel
(`js/game.js:1137`, `wipfelkratzer-fotos`).

Wer neu anfangen will, hat genau einen Weg: den Knopf «Neu anfangen»
(`js/game.js:894-899`), der nach doppeltem Antippen
`localStorage.removeItem('wipfelkratzer-v1')` ausführt und neu lädt. Der alte
Turm ist damit unwiderruflich weg — Fotos bleiben übrigens stehen, weil der
Reset den Foto-Schlüssel gar nicht anfasst.

Gewünscht: **mehrere Türme nebeneinander** führen und zwischen ihnen wechseln,
ohne dass einer dafür sterben muss.

## Ausgangslage im Code (Belege)

- Zustand und Laden: `let state = { floors: 0, rooms: {}, nuts: 0, bridge: false,
  garden: false, night: false, cutaway: false, fulfilled: {}, wallpaper: {},
  flooring: {} }` (`js/game.js:35`), danach
  `Object.assign(state, JSON.parse(s))` aus `wipfelkratzer-v1` (`js/game.js:36`).
- Speichern ist entprellt (300 ms) und schreibt das **ganze** Wurzelobjekt in
  einen Schlüssel (`js/game.js:37-42`).
- Alles liegt flach im Wurzelobjekt: `state.rooms` (`js/game.js:43`),
  `state.floors` (`js/game.js:11`), `state.wallpaper` (`js/game.js:383`),
  `state.night` (`js/game.js:885`), `state.garden` (`js/game.js:827`),
  `state.bridge` (`js/game.js:822`).
- Ein Raum-Eintrag hat die Form `{ id, x, y, z, rot, wall?, cell? }`
  (`js/game.js:447-459`, `js/game.js:696-703`).
- Fotos: `photos = JSON.parse(localStorage.getItem('wipfelkratzer-fotos') || '[]')`
  (`js/game.js:1137`), Schreiben mit bereits vorhandener Quota-Abfederung:
  `catch (e) { toast('Die Galerie ist voll — lösche ein paar Fotos.'); }`
  (`js/game.js:1138`). Maximal 20 Fotos, JPEG-Data-URL bei max. 800 px Breite,
  Qualität 0,72 (`js/game.js:1141-1146`).
- Es gibt bereits eine stille Migration als Vorbild: eine Tapete, die als
  einzelner String gespeichert war, wandert beim Laden auf alle vier Wände und
  setzt `migrated = true` (`js/game.js:379-386`), worauf am Ende des Ladens
  einmal gespeichert wird (`js/game.js:1186`).
- Reset: `js/game.js:894-899`, Knopf `#btn-reset` im Extras-Menü
  (`index.html:178`).
- Extras-Menü: `index.html:171-179`, geöffnet über `#btn-extras`
  (`js/game.js:1042`).
- Intro-Overlay mit `#btn-start` (`index.html:236-243`, `js/game.js:1174`),
  `z-index: 20` (`index.html:139`); die Galerie liegt bei `z-index: 10`
  (`index.html:96`).
- Playwright-Hook für Tests existiert bereits:
  `window.wipfelkratzer = { state, floorGroups, … }` (`js/game.js:1188`).
- Es gibt keinen Test-Runner; der Playtest im echten Browser mit Playwright,
  **im Vordergrund**, ist das Test-Gate (`CLAUDE.md:508-567`).
- Bibliotheken: ausschliesslich `three` über die Import-Map (`index.html:10-27`);
  neue Abhängigkeiten sind verboten (`CLAUDE.md:796-821`).

## Goals

- Mehrere Spielstände nebeneinander, jeder mit eigenem Turm **und** eigener
  Fotogalerie.
- Der bestehende Einzelstand lädt unverändert weiter und wird beim ersten Start
  automatisch zum ersten Stand — ohne dass ein Kind etwas merkt.
- Ein Stand wird über **Bild und Namen** gewählt, nicht über eine Nummer.
- «Alles löschen» wird durch «diesen einen Turm löschen» ersetzt.
- Die Struktur verbaut dem Walddorf (#51) nichts.

## Non-Goals

- Mehrere Türme **innerhalb** eines Standes (das ist #51).
- Export/Import als Datei (das ist #52; diese Spec legt nur die Ebene, auf der
  #52 aufsetzt).
- Synchronisation zwischen Geräten, Konten, Cloud.
- Ein Umbau des Stand-Inhalts selbst: das Wurzelobjekt bleibt Byte für Byte so,
  wie es heute geschrieben wird (`js/game.js:38-41`).

## Assumptions

- **A1** [high] Die Spielstände werden **nicht** in einem einzigen grossen
  Schlüssel zusammengefasst, sondern bleiben **ein Schlüssel pro Stand**, mit
  einem schlanken Index-Schlüssel `wipfelkratzer-staende` darüber. Verworfen:
  ein Sammelobjekt `wipfelkratzer-v2 = { staende: [...] }`. Grund: das
  entprellte Speichern schreibt heute bei **jeder** Möbelbewegung den ganzen
  Schlüssel (`js/game.js:37-42`) — mit einem Sammelobjekt schriebe jeder
  Handgriff auch alle anderen Türme samt deren Fotos mit, und ein einziger
  Quota-Fehler nähme alle Stände gleichzeitig mit.
- **A2** [high] Der migrierte erste Stand **behält die bestehenden Schlüssel**
  `wipfelkratzer-v1` und `wipfelkratzer-fotos`; der Index merkt sich pro Stand
  seine Schlüsselnamen (`standKey`, `fotoKey`). Verworfen: Umkopieren auf
  `wipfelkratzer-stand-<id>`. Grund: Umkopieren verdoppelt die Foto-Data-URLs
  kurzzeitig im ohnehin knappen `localStorage` (`js/game.js:1137-1138`) und
  kann genau beim Kind mit der vollsten Galerie fehlschlagen. Diese Migration
  bewegt **kein einziges Byte** — sie legt nur den Index an.
- **A3** [high] Die Fotos gehören zum Stand: pro Stand eine eigene Galerie.
  Verworfen: eine gemeinsame Galerie über alle Türme. Beleg: die Galerie zeigt
  Bilder genau dieser Szene (`takePhoto()` rendert `scene`/`camera`,
  `js/game.js:1140-1147`) — zwei Türme, ein Fototopf wäre nicht erklärbar.
- **A4** [med] Höchstens **vier** Stände. Verworfen: unbegrenzt viele. Grund:
  jeder Stand darf 20 Fotos halten (`js/game.js:1145`), und die Galerie stösst
  schon heute an die Quota (`js/game.js:1138`); vier ist für ein Kind
  überschaubar und deckelt den Speicher.
- **A5** [med] Der Wechsel zwischen Ständen läuft über `location.reload()`,
  nachdem der aktive Stand im Index umgesetzt wurde. Verworfen: die Szene im
  laufenden Betrieb neu aufbauen. Grund: die Szene wird beim Start einmalig aus
  `state` aufgebaut (`js/game.js:1177-1190`) und es gibt keinen Abbau-Pfad; der
  Reset macht es heute bereits genauso (`js/game.js:896`).
- **A6** [med] Das Vorschaubild eines Standes ist ein kleiner JPEG-Schnappschuss
  der Szene (Breite 240 px, Qualität 0,5), gespeichert **im Index**, nicht im
  Stand. Verworfen: gar kein Bild (nur Name), und: ein Bild in voller
  Fotoqualität. Grund: die Aufnahmetechnik existiert bereits
  (`js/game.js:1140-1146`), und der Index bleibt so klein genug, um jederzeit
  geschrieben werden zu können.
- **A7** [med] Das Bild wird **nicht** bei jedem Speichern erneuert, sondern nur
  beim Öffnen der Turm-Übersicht und unmittelbar vor einem Wechsel. Verworfen:
  Aufnahme im `save()`-Pfad. Grund: `save()` läuft entprellt bei jedem
  Handgriff (`js/game.js:37`); ein `renderer.render` plus `toDataURL` pro
  Handgriff wäre ein spürbarer Ruckler auf dem Tablet.
- **A8** [med] Der Einstieg liegt an **zwei** Stellen: ein Knopf «Meine Türme»
  im Extras-Menü — er ersetzt dort «Neu anfangen» — und ein zweiter im Intro
  unter «Los geht's!». Verworfen: nur das Intro (dann kommt man im Spiel nicht
  mehr weg) und nur die Extras (dann sieht ein Kind seine Türme beim Start
  nicht). Beleg: Extras-Menü `index.html:171-179`, Intro `index.html:236-243`.
- **A9** [med] «Neu anfangen» verschwindet ersatzlos; gelöscht wird künftig **ein
  einzelner Turm** über seine Karte, mit derselben doppelt-antippen-Bestätigung
  wie bisher (`js/game.js:894-899`). Löscht man den letzten, entsteht sofort ein
  frischer leerer Turm — das Spiel ist nie standlos. Verworfen: «Neu anfangen»
  daneben stehen lassen. Grund: zwei Löschgesten nebeneinander sind für ein Kind
  eine Falle.
- **A10** [low] Ein neuer Stand bekommt den Vorschlagsnamen «Turm von …» mit
  einer fortlaufenden Nummer nur als Notnagel bei Namensgleichheit; der Name ist
  in der Karte direkt über ein Textfeld änderbar, ohne Dialog. Verworfen: ein
  Umbenennen-Dialog mit `prompt()`. Grund: `prompt()` ist auf iPad-Safari im
  Vollbild ein Bruch, und im Spiel wird sonst nirgends einer benutzt (kein
  Treffer für `prompt(` in `js/game.js`).
- **A11** [low] Das Overlay der Turm-Übersicht bekommt `z-index: 25`. Verworfen:
  der Galerie-Wert 10. Grund: es muss auch **über** dem Intro liegen
  (`z-index: 20`, `index.html:139`), sonst ist der Intro-Einstieg aus A8 nicht
  bedienbar.
- **A12** [high] Der Stand-Inhalt selbst bleibt unangetastet — insbesondere die
  Tapeten-Migration (`js/game.js:379-386`) läuft unverändert weiter und gilt
  jetzt pro Stand. Verworfen: die Gelegenheit für ein `v2`-Format des
  Stand-Inhalts nutzen. Grund: das verdoppelt das Risiko der Migration und
  bringt für #53 nichts.

## Entwurf

### Speicherstruktur

```
wipfelkratzer-staende        Index (klein, ohne Fotos)
  { v: 2,
    aktiv: "s1",
    staende: [
      { id: "s1",
        name: "Mein Wipfelkratzer",
        standKey: "wipfelkratzer-v1",        <- Altbestand behält seinen Schlüssel
        fotoKey:  "wipfelkratzer-fotos",
        bild: "data:image/jpeg;base64,…" | null,
        angelegt: 1789…, zuletzt: 1789… },
      { id: "sk3f9",
        name: "Julias Turm",
        standKey: "wipfelkratzer-stand-sk3f9",
        fotoKey:  "wipfelkratzer-fotos-sk3f9",
        bild: …, angelegt: …, zuletzt: … }
    ] }

wipfelkratzer-v1             Stand-Inhalt (unverändertes Format)
wipfelkratzer-fotos          Galerie dazu (unverändertes Format)
wipfelkratzer-stand-<id>     Stand-Inhalt weiterer Türme
wipfelkratzer-fotos-<id>     deren Galerien
```

Der Index kennt die Schlüsselnamen; **niemand ausser dem Spiel selbst schaut in
einen Stand hinein**. Die Ebene darüber ist damit vollständig unabhängig davon,
was im Stand liegt.

### Migration beim Start

`ladeIndex()` läuft vor dem ersten Lesen von `state`:

1. Index vorhanden und lesbar, `staende` ist ein nicht leeres Array → benutzen.
   Zeigt `aktiv` ins Leere, wird der erste Eintrag aktiv.
2. Kein Index (oder unlesbar) → genau ein Eintrag wird angelegt, mit den
   **Altschlüsseln** `wipfelkratzer-v1` / `wipfelkratzer-fotos`. Ob dort schon
   etwas liegt, spielt keine Rolle: liegt etwas da, ist es ab sofort Stand 1;
   liegt nichts da, schreibt das Spiel wie bisher genau dorthin.

Damit ist der Fall «alter Einzelstand» und der Fall «frische Installation»
derselbe Code-Pfad, und die Migration kann nicht an der Quota scheitern.

### Neues Modul `js/staende.js`

Rein auf `localStorage` arbeitend, ohne three.js-Bezug, damit es einzeln
prüfbar ist:

```
INDEX_KEY, LEGACY_STAND, LEGACY_FOTOS, MAX_STAENDE
ladeIndex()            -> Index (migriert bei Bedarf, wirft nie)
schreibeIndex(idx)     -> true|false (false bei Quota)
aktiverStand()         -> Eintrag
wähleStand(id)        -> setzt aktiv, schreibt Index
neuerStand(name)       -> Eintrag | null (null, wenn MAX_STAENDE erreicht)
benenneUm(id, name)
loescheStand(id)       -> entfernt beide Schlüssel und den Eintrag;
                          war es der letzte, entsteht sofort ein neuer leerer
merkeBild(id, dataUrl)
standInfo(eintrag)     -> { floors, möbel } aus dem Stand-Inhalt gelesen
```

### Anbindung in `js/game.js`

- `js/game.js:36` liest aus `aktiverStand().standKey` statt aus der Konstante.
- `js/game.js:41` schreibt nach `aktiverStand().standKey`.
- `js/game.js:1137-1138` lesen/schreiben `aktiverStand().fotoKey`.
- Der Eintrag wird **einmal** beim Start geholt und in einer Modulvariablen
  gehalten; ein Wechsel lädt die Seite ohnehin neu (A5).

### Oberfläche

Neues Overlay `#staende` («Meine Türme»), im Aufbau wie die Galerie
(`index.html:224-230`), aber mit `z-index: 25`:

- Pro Stand eine Karte: Vorschaubild (oder ein gezeichneter Platzhalter, wenn
  noch keines aufgenommen wurde), ein Textfeld mit dem Namen, die Zeile
  «N Stockwerke», und die Knöpfe «Weiterbauen» (beim aktiven Stand stattdessen
  die Marke «Hier bist du») und «Löschen».
- Darunter «Neuer Turm» (ausgegraut, wenn vier Stände existieren, mit Hinweis)
  und «Zu».
- Einstiege: `#btn-staende` im Extras-Menü (ersetzt `#btn-reset`) und
  `#btn-intro-staende` im Intro.

## Consequences

- **Ein weiterer `localStorage`-Schlüssel pro Stand**, plus der Index. Bei vier
  Ständen sind das neun Schlüssel statt zwei. Der Browser zählt aber Bytes, nicht
  Schlüssel — der Index kostet mit Vorschaubildern grob 4 × 8 KB.
- **Die Quota wird häufiger erreicht.** Vier Galerien à 20 Fotos sprengen jedes
  realistische Budget. Der bestehende Fang (`js/game.js:1138`) greift weiterhin
  pro Stand und meldet «Die Galerie ist voll»; neu kann auch das Anlegen eines
  Standes am Index-Schreiben scheitern und wird dann mit einer eigenen Meldung
  abgelehnt, statt halb angelegt zu werden.
- **Der Wechsel lädt die Seite neu.** Sichtbar als kurzer Ladevorgang mit Intro.
  Das ist der Preis dafür, dass kein Abbau-Pfad für die Szene gebaut werden muss.
- **«Neu anfangen» ist weg.** Wer den Knopf kennt, sucht ihn. Die Ersatzgeste
  liegt eine Ebene tiefer (Karte → «Löschen»), dafür trifft sie nur einen Turm.
- **Der Reset-Fehler verschwindet nebenbei:** heute lässt «Neu anfangen» die
  Fotos stehen (`js/game.js:896` entfernt nur `wipfelkratzer-v1`). Das Löschen
  einer Karte entfernt beide Schlüssel.
- **Zwei Aufnahmezeitpunkte fürs Vorschaubild** heissen: ein Turm, den man baut
  und dann die Seite schliesst, ohne die Übersicht zu öffnen, zeigt beim
  nächsten Mal noch das ältere Bild. Akzeptiert.
- **Für #52 ist die Arbeit halb getan:** «ein Stand» ist ab jetzt ein
  benanntes, abgeschlossenes Paar aus Stand-Inhalt und Galerie, und ein Import
  hat mit `neuerStand()` bereits ein Ziel, das nichts überschreibt.

## Was diese Struktur für #51 (Walddorf) offen lässt

- **Die Slot-Ebene schaut nie in den Stand hinein.** Sie kennt Name, Bild,
  Zeitstempel und zwei Schlüsselnamen. Ob im Stand ein Turm liegt oder zehn
  Orte mit je einem Turm, ist ihr gleichgültig — #51 kann `state` beliebig
  umbauen (etwa zu `state.orte = { lichtung: { rooms, floors, … }, laden: … }`),
  ohne eine Zeile in `js/staende.js` zu ändern.
- **Die beiden Richtungen kreuzen sich nicht:** #53 wächst **neben** dem Stand
  (mehrere Stände), #51 wächst **innerhalb** eines Standes (mehrere Orte). Ein
  Walddorf-Spielstand ist für #53 einfach ein Stand mehr.
- **Die Migrationsstelle ist bereits benannt.** #51 braucht eine Migration des
  Stand-Inhalts («flacher Turm» → «Ort `zuhause` mit diesem Turm»), und die
  gehört genau dorthin, wo heute die Tapeten-Migration sitzt
  (`js/game.js:379-386`) — also **innerhalb** eines Standes, pro Stand einmal.
  #53 fasst diese Stelle nicht an (A12).
- **Vorschaubild und Name liegen im Index, nicht im Stand.** Ein Walddorf-Stand
  kann später seine Übersichtskarte als Vorschaubild hinterlegen, ohne dass die
  Kartenlogik etwas über Stände wissen muss.
- **Was #53 bewusst nicht entscheidet:** wie viele Türme ein Stand hat, wie
  gross er werden darf, und ob Fotos künftig pro Ort getrennt werden. Der
  Foto-Schlüssel gehört zum Stand, nicht zum Turm — sollte #51 pro Ort eigene
  Galerien wollen, geschieht das **innerhalb** des Foto-Arrays (ein Feld `ort`
  pro Foto), nicht durch weitere Schlüssel.

## Acceptance Criteria

- [ ] Ein bestehender **Einzelstand** aus `wipfelkratzer-v1` lädt nach dem
      Update unverändert: gleiche Stockwerkzahl, gleiche Möbel, gleiche Tapeten,
      gleiche Fotos — und zwar ohne dass der Schlüsselinhalt umkopiert wurde
      (`wipfelkratzer-v1` und `wipfelkratzer-fotos` existieren weiter mit
      unverändertem Inhalt).
- [ ] Ein Stand, der noch die **alte Tapete als String** enthält, wird beim
      Laden weiterhin still auf vier Wände migriert (`js/game.js:379-386`) —
      die Slot-Ebene stört das nicht.
- [ ] Beim ersten Start nach dem Update entsteht `wipfelkratzer-staende` mit
      genau einem Eintrag, dessen `standKey` `wipfelkratzer-v1` und dessen
      `fotoKey` `wipfelkratzer-fotos` ist.
- [ ] Eine **frische Installation** (kein Schlüssel vorhanden) startet mit genau
      einem leeren Stand und schreibt dessen Inhalt weiterhin nach
      `wipfelkratzer-v1`.
- [ ] Ein **kaputter oder fremder** Index-Schlüssel führt nicht zu einem weissen
      Bild: er wird verworfen und wie «kein Index» behandelt.
- [ ] «Meine Türme» ist aus dem Extras-Menü **und** aus dem Intro erreichbar und
      zeigt pro Stand Bild, Namen und Stockwerkzahl — keine Nummer.
- [ ] «Neuer Turm» legt einen zweiten Stand an; nach dem Wechsel ist der Turm
      leer (0 Stockwerke), während der erste Stand unverändert erhalten bleibt.
- [ ] Die Galerien sind getrennt: ein Foto im zweiten Stand taucht im ersten
      **nicht** auf, und umgekehrt.
- [ ] Der Name lässt sich in der Karte direkt ändern und überlebt einen Neustart.
- [ ] Bei vier Ständen ist «Neuer Turm» nicht mehr bedienbar und erklärt warum.
- [ ] «Löschen» auf einer Karte verlangt ein zweites Antippen und entfernt
      danach **beide** Schlüssel des Standes; alle anderen Stände bleiben
      unberührt.
- [ ] Wird der letzte Stand gelöscht, startet das Spiel mit einem frischen
      leeren Turm statt mit einem Fehler.
- [ ] `#btn-reset` («Neu anfangen») existiert nicht mehr.
- [ ] Beim ganzen Ablauf bleibt die Konsole fehlerfrei.
- [ ] `index.html` lädt weiterhin keine Bibliothek ausser `three` (Import-Map
      `index.html:10-27` unverändert, kein `package.json`).
- [ ] `version.js` ist **unverändert**; `CHANGELOG.md` hat einen Eintrag unter
      `## [Unreleased]` / `### Added` mit Bezug auf #53.
