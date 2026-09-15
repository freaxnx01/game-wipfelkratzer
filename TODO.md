# Wipfelkratzer — Ideen & offene Punkte

## Geplant
- [ ] Pixi (der Wal aus dem Pixi-Bücher-Logo) soll irgendwo/irgendwann im Spiel auftauchen
- [ ] Tag/Nacht mit Beleuchtung (Innenlicht, Lampen leuchten richtig)
- [ ] Wetter (Regen, Wind, Schnee)
- [ ] Material sammeln: Willi nagt Äste, Schilf, Gras — Bauen kostet Material

## Erledigt
- [x] Pool: Dachterrasse ist jetzt von Anfang an oben auf dem Turm einrichtbar (Katalog «Dach»)
- [x] Dichter, hoher Wald rundherum — der Turm kratzt an den Wipfeln
- [x] Möbel mit Pfeiltasten verschieben, Bild↑/Bild↓ drehen, bis ganz an die Wand
- [x] Flickern zwischen Stockwerken behoben
- [x] Räume doppelt so gross
- [x] Deko-Objekte (Vase, Teekanne, Kerze, Bücher, Nussschale) für Regal & Tisch
- [x] Natürlicherer, geschwungener Bach mit Ufer
- [x] Biberburg aus richtigen Ästen statt braunem Haufen
- [x] Mit Willi reden: Willi antippen — er erzählt und hämmert
- [x] Fokus auf platziertes Objekt, Wand-Kollision, Decke ausblenden beim Einrichten
- [x] Bewohner-Tooltip mit Porträt, Tipp-Knopf für Einrichtungsideen
- [x] Cutaway-Modus «Wände weg» (Querschnitt wie im Buch)
- [x] Biberburg anklickbar mit Beschreibung
- [x] Wand-Deko: Poster, Wanduhr, Spiegel — und platzierbare Fenster
- [x] Wohnungstüren pro Stock + Aussentreppe mit Geländer und Podesten
- [x] Tapeten (9 Muster) und Bodenbeläge (6 Varianten) pro Wohnung
- [x] Móki das Eichhörnchen flitzt ums Haus und redet
- [x] Fotos schiessen, Galerie mit Kommentaren
- [x] Fotos aus der Galerie herunterladen (#1)
- [x] Wand-Objekte mit Knöpfen in x/y verschieben — auch auf dem Tablet (#2)
- [x] Aussentreppe trifft die Wohnungstüren, Podeste und Läufe hängen zusammen (#3)
- [x] Tapete pro Wand auswählbar, nur innen, wieder entfernbar (#4)
- [x] Bodenbelag wieder entfernbar (#5)
- [x] Alle Fotos auf einmal herunterladen — Teilen auf dem Tablet, ZIP am Rechner (#33)
- [x] «Wipfkea»-Möbelserie in Braun und Pink: Regal, Tisch, Stuhl, Sofa (#42)
- [x] Fenster, Badewanne und Lampe sind schaltbar — mit Geräusch, gespeichert, und bei Nacht sieht man das Licht von aussen (#41)

## Gefunden beim Aufräumen (noch offen)

- [ ] Keine Treppe vom 10. Stock auf die Dachterrasse — die Terrasse hat ein
      Geländer, ist aber über nichts erreichbar
- [ ] `#selbar` überlappt `#btn-catalog`, wenn ein Objekt ausgewählt ist
      (bestand schon vorher; durch das neue Richtungs-Kreuz höher geworden)
- [ ] Ein Tipp auf eine Wand springt im Katalog automatisch auf den Tab «Tapete»
      — stört evtl., wenn man nur einen Stuhl abwählen wollte
- [ ] `wallpaperOf` schreibt `{}` für jedes Stockwerk in den Spielstand (harmlos,
      nur unnötig gross)
- [ ] Toter Test-Hook `g.userData.doorX`
- [ ] Aussenfarbe des Turms ist jetzt einheitlich `#f3e2bd`; vorher waren Rück-
      und linke Wand versehentlich leicht heller — bewusst prüfen, ob das gefällt
