# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- Die Haselnüsse sind jetzt zu etwas gut: Für neun baut Willi die Brücke
  über den Fluss, für fünfzehn entstehen Garten und Spielplatz. Nüsse
  bekommst Du wie bisher, wenn Du einem Bewohner seinen Wunsch erfüllst
  — drei Stück pro Wunsch. Möbel kosten weiterhin nichts, und wer
  Brücke oder Spielplatz schon hat, behält sie natürlich. Fehlen noch
  welche, sagt Dir das Spiel, wie viele (#83)

## [0.10.0] - 2026-09-19

### Added

- «Meine Türme» ist jetzt eine Waldkarte: Statt einer Liste siehst Du vier
  Lichtungen im Wald, auf jeder steht einer Deiner Türme — und wo noch keiner
  steht, wartet ein Bauplatz, den Du antippen kannst. Umbenennen, Sichern,
  Löschen und Weiterbauen gehen wie bisher. Dazu liegen drei Orte im Wald: in
  der Schreinerei baust Du eigene Möbel, auch ohne in einer Wohnung zu sein,
  bei «Wipfkea» siehst Du die ganze Möbelserie im Schaufenster, und wo später
  einmal die Aussichtsplattform steht, ist der Platz schon freigehalten (#51)
- Du kannst jetzt in den Wipfelkratzer hineingehen: «Hineingehen» stellt
  Dich mitten in eine Wohnung, und Du schaust Dich in Ruhe um — so gross
  wie ein Biber, mit den Wänden um Dich herum. Über die Leiste unten
  gehst Du ein Stockwerk höher oder tiefer, aufs Dach oder nach draussen
  auf den Spielplatz. «Schluss» bringt Dich wieder dorthin zurück, wo Du
  vorher warst (#44)

## [0.9.0] - 2026-09-18

### Added

- Ein Turm lässt sich jetzt als Datei sichern. In «Meine Türme» steht auf jeder
  Karte ein Knopf «Sichern»; ein Tipp fragt, ob die Fotos mitkommen sollen, und
  nennt gleich, wie gross die Datei wird. Heraus kommt eine Datei
  «wipfelkratzer-<Turmname>-<Datum>.json» — auf dem Tablet über das gewohnte
  Teilen-Fenster, am Rechner als Download. Sichern lässt sich jeder Turm, auch
  einer, an dem gerade nicht gebaut wird; gewechselt wird dabei nicht (#78)
- Eine gesicherte Turm-Datei lässt sich jetzt wieder einlesen. In «Meine Türme»
  holt «Turm einlesen» sie zurück — immer auf einen freien Platz, ein
  bestehender Turm wird also nie überschrieben. Der eingelesene Turm steht
  danach als neue Karte da, mit seinen Möbeln, Tapeten und Fotos; hingehen
  kannst du mit «Weiterbauen». Auch ein Turm aus einer älteren Version des
  Spiels kommt sauber zurück. Sind schon vier Türme da, sagt das Spiel, dass
  zuerst einer gelöscht werden muss. Eine kaputte oder fremde Datei wird
  freundlich abgelehnt und ändert nichts an dem, was du gebaut hast (#79)
- Möbel lassen sich jetzt einfach an ihren Platz ziehen: erst antippen, dann
  mit Maus oder Finger verschieben — und mit dem Mausrad drehen, solange der
  Zeiger darauf liegt. Bilder und Fenster wandern dabei der Wand entlang und in
  der Höhe, und auch die Tiere lassen sich so an ihren Lieblingsplatz setzen.
  Steht ein Tier im Weg, rückt es zur Seite; ist nirgends Platz, bleibt das
  Möbel stehen, statt sich durchzudrängen — und das Klopfen kommt einmal und
  nicht im Dauerlauf.
  Pfeiltasten und Knöpfe funktionieren unverändert weiter, und überall sonst
  dreht ein Zug wie bisher die Kamera (#64)

## [0.8.0] - 2026-09-18

### Added

- Der Wald kennt jetzt Jahreszeiten. Ein neuer Knopf in der Werkzeugleiste
  schaltet zwischen Frühling, Sommer, Herbst und Winter weiter; Baumkronen,
  Wiese, Bach und Himmelston blenden dabei sanft über, so wie es der Wechsel
  zwischen Tag und Nacht schon tut. Jeder Baum behält seinen eigenen Farbton,
  der Wald wird also nie einfarbig. Die gewählte Jahreszeit bleibt gespeichert
  und lässt sich mit Tag und Nacht frei kombinieren (#50)
- Eine fertig eingerichtete Wohnung lässt sich jetzt auf ein anderes
  Stockwerk kopieren: In der Einrichtungsleiste merkt «Raum kopieren» die
  Wohnung samt Möbeln, Wandobjekten, Deko, Tapete und Bodenbelag, «Raum
  einfügen» stellt sie im nächsten Stockwerk wieder auf und rückt dabei
  alles auf dessen Masse zurecht. Steht am Ziel schon etwas, fragt das
  Spiel vorher, ob dazugestellt oder alles ersetzt werden soll — nichts
  geht unbemerkt verloren. Die Bewohner kommen nicht mit; es zieht die
  Familie ein, die auf das Zielstockwerk gehört (#48)
- Der Bach war bisher blosse Kulisse. Ein Tipp auf das Wasser fragt jetzt
  nach, ob es zu &laquo;Splashdown!&raquo; gehen soll — dem
  Wasserrutschen-Rennen nebenan. Vor dem Wechsel wird der Wipfelkratzer
  sofort gespeichert statt wie bisher erst nach einer kurzen Verzögerung,
  damit auch die allerletzte Änderung erhalten bleibt; nach der Rückkehr
  steht der Turm unverändert da (#46)
- Else Elster trug ihren Eimer bisher nur im Kreis spazieren. Sie holt damit
  jetzt Wasser: sobald ein Pool auf der Dachterrasse steht, fliegt sie zum
  Bach hinunter, schöpft, bringt den Eimer zum Dach und kippt ihn aus. Ein
  neu aufgestellter Pool startet deshalb leer und füllt sich in drei sichtbaren
  Schritten; erst im vollen Becken schwimmen Piet und Jan. Pools aus älteren
  Spielständen bleiben voll (#45)

## [0.7.0] - 2026-09-17

### Added

- Der Spielplatz war ein festes Ensemble: Schaukel, Rutsche, Sandkasten,
  Hochbeet und Blumen hingen an einer Gruppe und liessen sich weder auswählen
  noch bewegen. Jedes Teil ist jetzt ein eigenes Objekt, das sich — genau wie
  die Möbel drinnen — antippen, verschieben, drehen, wegräumen und aus dem
  Katalog neu hinzufügen lässt. Draussen gibt es dafür keine Wände, sondern
  eine Spielfläche auf der baumfreien Lichtung; sie hält die Objekte vom
  Bach, von den Bäumen und vom Turmsockel fern und wird beim Einrichten als
  Holzkante sichtbar. Ein Tipp auf den Spielplatz öffnet den
  Einrichten-Modus, der Knopf «Garten & Spielplatz» ebenso — auch beim
  allerersten Bauen, direkt nach der Aufbau-Animation. Alte Spielstände, die
  nur wussten, *ob* der Spielplatz gebaut ist, werden beim ersten Laden in
  einzelne Objekte übersetzt — dabei rücken die Blumen aus dem Wasser ans
  Ufer (#38)
- Möbel und Tiere gehen sich jetzt aus dem Weg. Wer ein Möbel auf ein Tier
  schiebt, sieht das Tier zur Seite rücken; ein Tier lässt sich nicht mehr
  in ein Sofa schieben. Ist in der Wohnung wirklich kein Platz mehr frei,
  bleibt das Möbel stehen, wo es war, und sagt Bescheid — statt das Tier
  in die Wand zu drücken. Auf einem Teppich darf ein Tier weiterhin
  stehen, und Deko landet nach wie vor auf Tisch, Regal und Schrank (#40)
- Schreinerei: eigene Möbel bauen statt nur auswählen. In der Werkstatt
  stapelst Du bis zu fünf Teile aufeinander und wählst je Teil Form
  (Platte, Klotz, Kiste, Säule, Dach), Breite und Farbe; die Vorschau
  zeigt sofort, wie das Möbel aussieht. Fertige Entwürfe landen im
  Katalog unter «Schreinerei» und lassen sich beliebig oft aufstellen —
  gelöschte Entwürfe lassen bereits aufgestellte Möbel unberührt (#43)
- Es lassen sich jetzt bis zu vier Türme nebeneinander bauen. Unter «Meine
  Türme» — im Extras-Menü und gleich im Intro — steht jeder Turm mit
  Vorschaubild, eigenem Namen und seiner Stockwerkzahl; ein Tipp wechselt
  hinüber. Jeder Turm hat seine eigene Fotogalerie. Der bisherige Spielstand
  wird beim ersten Start still zum ersten Turm, ohne dass etwas verloren geht.
  «Neu anfangen» ist dafür weggefallen: gelöscht wird jetzt ein einzelner Turm
  über seine Karte — samt seinen Fotos, die der alte Knopf stehen liess (#53)
- Die Turmhöhe ist jetzt wählbar: Wer ein neues Spiel beginnt, entscheidet
  sich am Startbildschirm für einen kleinen Turm mit 10, einen hohen mit 20
  oder einen Riesenturm mit 50 Stockwerken. Der Turm verjüngt sich dabei
  immer bis zum selben Endmass, damit auch die oberste Wohnung noch
  einrichtbar ist; oberhalb der zehnten Etage bekommen die Bewohner ihre
  Namen, Tiere und Wünsche aus Bausteinen, immer dieselben pro Stockwerk.
  Kamera und Nebel wachsen mit, und Stockwerke entstehen erst, wenn sie
  gebaut werden — der Zehner-Turm sieht aus wie bisher und lädt aus jedem
  bestehenden Spielstand unverändert (#47)

## [0.6.0] - 2026-09-17

### Added

- «Wipfkea» — eine eigene Möbelserie in Braun und Pink: Regal, Tisch,
  Stuhl und Sofa im Bausatz-Stil, alle mit derselben Brettstärke, geraden
  Kanten und sichtbaren hellen Dübeln, dazu rosa Polster auf Stuhl und
  Sofa. Die vier Stücke stehen im Katalog unter «Möbel» und lassen sich
  einrichten wie alles andere; das Wipfkea-Sofa erfüllt den Sofa-Wunsch
  genauso wie das bisherige (#42)
- Lampe, Badewanne und Fenster machen jetzt etwas: ein Knopf in der
  Auswahlleiste schaltet das Licht an und aus, lässt Wasser in die Wanne und
  wieder ab und kippt den Fensterflügel auf und zu — jedes mit eigenem
  Geräusch. Der Zustand bleibt beim Neuladen erhalten, und bei Nacht sieht man
  von draussen, in welcher Wohnung noch Licht brennt (#41)
- Möbel lassen sich einfärben: Sofa, Bett, Etagenbett, Teppich, Lampe,
  Badewanne, Pflanze und Liegestuhl bekommen über eine Farbreihe in der
  Auswahlleiste eine von sechs Farben oder «Standard» zurück. Die Wahl liegt
  im Spielstand und überlebt das Neuladen (#34)
- Sechs neue Katalogeinträge aus der Feedback-Triage: Bar auf der
  Dachterrasse, Kommode, Ball, Kuscheltier, Tischkicker und eine Dartscheibe
  an der Wand. Auf der Kommode lässt sich Deko abstellen wie auf Tisch und
  Regal (#37)
- Drei neue Instrumente im Katalog unter «Spass» — Blockflöte, Harfe und
  Schlagzeug, im selben Bilderbuch-Stil wie das Klavier. Die Blockflöte ist
  klein genug, um auf Tischen und Regalen zu stehen (#36)
- Tiere lassen sich jetzt beim Einrichten antippen, verschieben und
  drehen — genau wie ein Möbel, mit derselben Auswahlleiste. Wer ein Tier
  von Hand an seinen Platz stellt, behält ihn: die automatische Platzsuche
  beim Einzug gilt dann für diese Wohnung nicht mehr, und der Platz
  überlebt das Neuladen. Weggeworfen werden kann ein Tier nicht (#39)
- Auf der Dachterrasse lässt sich jetzt ein kleines Häuschen mit grünem
  Schilfdach aufstellen, wie auf der Buchseite mit dem Pool. Die Wände
  sind ockerfarbener Putz, das Satteldach besteht aus grünen
  Schilfbündeln mit weit überstehenden, ausgefransten Traufen, und
  vorne führt eine rundbogige Türöffnung in einen dunklen Innenraum, aus
  dem ein Frosch lugt. Das Häuschen ist gross — es lässt sich über die
  ganze Terrasse schieben, weicht dem Treppenaufgang aber automatisch
  aus, und Pool und Häuschen haben nebeneinander Platz (#49)
- Fotos lassen sich jetzt alle auf einmal sichern — auf dem Tablet über das
  System-Sheet, am Rechner als ein ZIP mit allen Bildern (#33)

### Fixed

- Wer die Stockwerke am fertigen Turm abzählte, kam auf 11 statt der
  angezeigten 10 — das Erdgeschoss ist von Anfang an da und wird nie gebaut,
  sah am Turm aber wie ein vollwertiges Stockwerk aus. Das HUD sagt jetzt
  «Erdgeschoss + N von 10 Stockwerken», und die Bewohnerliste erklärt in der
  `E`-Zeile, dass das Erdgeschoss schon vor dem ersten Klick da war. Die
  Zielzahl kommt in HUD, Bauknopf und Dach-Tipp aus `MAXF` statt aus
  Literalen (#35)
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
