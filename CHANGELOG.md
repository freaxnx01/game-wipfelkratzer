# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [0.3.0] - 2026-09-12

### Added

- Letzter Treppenlauf vom 10. Stock hinauf auf die Dachterrasse — das Geländer
  hat dort eine saubere Öffnung mit Pfosten an beiden Seiten, und die Treppe
  erscheint erst, wenn der Turm fertig gebaut ist (#6)

### Fixed

- Die Auswahlleiste verdeckte auf schmalen Fenstern die Werkzeugleiste. Sie
  richtet sich jetzt nach deren tatsächlicher Höhe statt nach einem festen Wert
  und wandert mit, wenn die Leiste auf zwei Zeilen umbricht (#7)
- Ein Tipp auf eine Wand sprang im Katalog ungewollt auf den Tab «Tapete».
  Der Tipp setzt jetzt immer die aktive Wand, wechselt den Tab aber nur noch,
  wenn «Tapete» ohnehin offen ist (#8)
- Der Spielstand sammelte leere Einträge für jedes nie eingerichtete Stockwerk;
  ausserdem ist ein toter Test-Hook entfernt (#9)

## [0.2.0] - 2026-09-12

### Added

- Fotos lassen sich aus der Galerie herunterladen — «Herunterladen» pro Foto,
  Dateiname `wipfelkratzer-JJJJ-MM-TT-HHMMSS.jpg`
- Wand-Objekte (Poster, Wanduhr, Spiegel, Fenster) lassen sich mit einem
  Richtungs-Kreuz in x/y verschieben — funktioniert auch auf dem Tablet, nicht
  nur mit den Pfeiltasten
- Tapete pro Wand statt pro Wohnung: Wand antippen oder in «Tapete» auswählen,
  «Alle Wände» bleibt der schnelle Weg
- «Entfernen» für Tapete und Bodenbelag

### Fixed

- Wand-Objekte liessen sich gar nicht platzieren: eine lokale Konstante in
  `clampEntry()` verdeckte den `wallZ`-Helper, jeder Klick im Katalog-Tab «Wand»
  brach mit einem ReferenceError ab
- Tapeten färbten auch die Aussenfassade des Turms — jede Wand hat jetzt einen
  Putz-Kern und ein eigenes, tapezierbares Innenpaneel
- Die rechte Zimmerwand nahm nie Tapete an (sie war mit dem geteilten
  Grundmaterial gebaut)
- Aussentreppe und Wohnungstüren passen zusammen: Podest, Lauf und Tür bilden
  auf allen zehn Stockwerken eine durchgehende Kette, auch mit dem zufälligen
  Versatz jedes Stockwerks

### Changed

- Die Aussenfarbe des Turms ist jetzt einheitlich `#f3e2bd`; vorher waren Rück-
  und linke Wand versehentlich leicht heller

## [0.1.0] - 2026-09-11

### Added

- 3D-Bauspiel «Willi baut den Wipfelkratzer»: Holzturm mit bis zu 10 Stockwerken,
  gebaut auf einer Plattform im Wald (three.js r184, buildless ES-Module)
- Einrichtungsmodus mit Möbelkatalog, Thumbnail-Rendering der 3D-Modelle,
  Verschieben per Pfeiltasten, Drehen per Bild↑/Bild↓ und Wand-Clamping
- Deko-Objekte (Vase, Teekanne, Kerze, Bücher, Nussschale), die automatisch auf
  Tischen, Regalen und Schränken landen
- Tierische Bewohner mit Wünschen; erfüllte Wünsche geben Haselnüsse
- Dachterrasse mit Pool ab 10 Stockwerken, inklusive Dachparty mit tanzenden Tieren
- Tag/Nacht-Wechsel mit Sternen, Mond und leuchtenden Fenstern
- Querschnitt-Modus «Wände weg» im Bilderbuch-Stil
- Extras: Brücke, Garten & Spielplatz, Bewohner-Schild, Tier-Übersicht
- Willi Biber, Biberburg, Elster «Else» und ein handgezeichnet wirkender Wald
  mit Bach als lebendige Szenerie
- Synthetisierte Musik und Soundeffekte (Web Audio, keine Asset-Dateien)
- Spielstand-Persistenz im `localStorage`
- Wand-Deko (Poster, Wanduhr, Spiegel) und platzierbare Fenster
- Wohnungstüren pro Stock plus Aussentreppe mit Geländer und Podesten
- Tapeten (9 Muster) und Bodenbeläge (6 Varianten) pro Wohnung
- Móki das Eichhörnchen, das ums Haus flitzt und erzählt
- Fotomodus mit Galerie und Kommentaren
- Fokus auf platziertes Objekt, Wand-Kollision und ausgeblendete Decke im Einrichtungsmodus
- Hub-Navigation mit Versions-Badge, Feedback-Link und GitHub-Star-Button
