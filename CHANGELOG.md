# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Fixed

- Wer die Stockwerke am fertigen Turm abzählte, kam auf 11 statt der
  angezeigten 10 — das Erdgeschoss ist von Anfang an da und wird nie gebaut,
  sah am Turm aber wie ein vollwertiges Stockwerk aus. Das HUD sagt jetzt
  «Erdgeschoss + N von 10 Stockwerken», und die Bewohnerliste erklärt in der
  `E`-Zeile, dass das Erdgeschoss schon vor dem ersten Klick da war. Die
  Zielzahl kommt in HUD, Bauknopf und Dach-Tipp aus `MAXF` statt aus
  Literalen (#35)
### Added

- Tiere lassen sich jetzt beim Einrichten antippen, verschieben und
  drehen — genau wie ein Möbel, mit derselben Auswahlleiste. Wer ein Tier
  von Hand an seinen Platz stellt, behält ihn: die automatische Platzsuche
  beim Einzug gilt dann für diese Wohnung nicht mehr, und der Platz
  überlebt das Neuladen. Weggeworfen werden kann ein Tier nicht (#39)
### Added

- Auf der Dachterrasse lässt sich jetzt ein kleines Häuschen mit grünem
  Schilfdach aufstellen, wie auf der Buchseite mit dem Pool. Die Wände
  sind ockerfarbener Putz, das Satteldach besteht aus grünen
  Schilfbündeln mit weit überstehenden, ausgefransten Traufen, und
  vorne führt eine rundbogige Türöffnung in einen dunklen Innenraum, aus
  dem ein Frosch lugt. Das Häuschen ist gross — es lässt sich über die
  ganze Terrasse schieben, weicht dem Treppenaufgang aber automatisch
  aus, und Pool und Häuschen haben nebeneinander Platz (#49)
- Auf schmalen Fenstern brach die Werkzeugleiste auf mehrere Zeilen um und die
  unterste Zeile verschwand unter der Navileiste am unteren Bildrand — «Foto»
  und «Musik aus» waren sichtbar, liessen sich aber nicht antippen. Die Leiste
  hält jetzt den Streifen frei, den die Navileiste tatsächlich belegt, und
  alles, was über ihr hängt (Auswahlleiste, Extras-Menü, Katalog, Meldungen),
  rückt mit. Auf schmalen Fenstern richten sich auch die Wunschzettel nach der
  gemessenen Leistenhöhe statt nach einem festen Abstand (#32)

## [0.5.0] - 2026-09-13

### Added

- Wand-Objekte (Poster, Wanduhr, Spiegel, Fenster) landen jetzt auf der Wand,
  die im Katalog gerade gewählt ist, statt immer an der Rückwand. Der
  «Wand»-Tab hat dafür eine eigene Knopfreihe für die vier Wände, genau wie
  «Tapete» — Antippen einer Wand in 3D funktioniert weiterhin ebenfalls (#11)

### Fixed

- Der geöffnete Katalog überlappte auf schmalen Fenstern die ganze
  Werkzeugleiste und, bei ausgewähltem Möbel, auch die Auswahlleiste. Er
  richtet sich jetzt nach deren tatsächlicher Höhe statt nach einem festen
  Abstand zum unteren Rand (#16)
- Meldungen verschwanden nach 2,8 Sekunden von selbst — oft, bevor sie fertig
  gelesen waren. Sie bleiben jetzt stehen, stapeln sich statt sich gegenseitig
  zu überschreiben und werden einzeln über ein grosses × oder einen Tipp auf
  die Meldung geschlossen; ab zwei offenen Meldungen räumt «Alle schliessen»
  den Stapel auf einmal weg (#10)
- Einziehende Tiere wurden fix an die Rückwand gesetzt und standen teils in
  Möbeln. Sie erscheinen jetzt an der Stelle im Raum mit dem grössten Abstand
  zu vorhandenem Mobiliar — bei freier Mitte in der Mitte, sonst an der
  nächstfreien Stelle (#14)
- Der Liegestuhl auf der Dachterrasse war ein schräges Brett, das an vier
  Stäben vorbeischwebte. Er ist jetzt ein richtiger Klapp-Liegestuhl: flache
  Sitzfläche und steilere Rückenlehne mit Knick, rot-weisse Stoffbahnen,
  Holzgestell mit Streben, das die Liegefläche an Fuss- und Kopfende trägt,
  und ein kleines Kissen (#13)
- Der Dachpool sah aus wie ein zugedecktes Fass: ein runder Kübel mit flacher
  Scheibe obendrauf. Er ist jetzt nierenförmig wie auf der Buchseite, mit
  vertieftem blauem Wasser, Wellenlinien, zwei Fröschen im Wasser und der
  Leiter am Rand (#12)

## [0.4.0] - 2026-09-13

### Fixed

- Die Sprechblase nannte zwei Bewohner nach ihrer Wohnung statt nach sich
  selbst («Kindergarten und Partyraum» wünscht sich ein Klavier). Bewohner und
  Wohnung sind jetzt getrennt: die Blase nennt den Namen, Titelzeile und
  Bewohnerliste weiterhin die Wohnung (#15)
- Im Hochformat rahmte die Kamera beim Einrichten die Möbel aus dem Bild. Der
  Abstand wird jetzt aus dem tatsächlichen Blickfeld berechnet, waagrecht wie
  senkrecht, und beim Drehen des Geräts neu gesetzt (#17)
- Ein Tipp auf eine Wand scrollte den Katalog zurück nach oben, wenn ein
  anderer Tab als «Tapete» offen war. Die Wand wird dort jetzt still gesetzt,
  ohne den Katalog neu aufzubauen (#18)
- Das Extras-Menü überlappte die Werkzeugleiste genauso, wie es die
  Auswahlleiste vor #7 tat — es hing noch an einem festen Abstand. Es rechnet
  jetzt mit derselben Formel aus der gemessenen Leistenhöhe (#19)
- Dach-Möbel liessen sich in die neue Treppenöffnung stellen, wo sie in der
  Luft standen. Die Öffnung ist jetzt für Möbel gesperrt, und Spielstände mit
  einem Möbel darin werden beim Laden zurechtgeschoben (#20)

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
