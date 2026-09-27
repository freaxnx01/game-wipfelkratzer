# Spec — Fenster geben im Besuch den Blick nach aussen frei (Issue #102)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #102, abgespalten aus #91 (Feedback-Sammlung vom 27.09.2026).
Der ganze Wortlaut: «Hineingehen: Fenster soll Blick nach Aussen freigeben.»

## Problem

Im Besuchsmodus steht die Kamera in Augenhöhe an der Rückwand und blickt nach
vorn (`js/game.js:1216-1219`: Auge bei `-d/2 + 0.5`, Ziel in der Raummitte).
Genau in dieser Blickrichtung steht die Vorderwand — und die ist von innen eine
geschlossene Fläche: Wandkern aus Putz plus tapezierbares Innenpanel
(`js/game.js:411-412`).

Die Fenster, die man von aussen sieht, sind **keine Öffnungen**. Es sind flache
Bogenscheiben aus `matWin` (`js/game.js:278`, Farbe `0x6b4526`), die in der
Front-Gruppe bei lokal `z = 0.08` hängen (`js/game.js:419`). Die Gruppe steht
bei `d/2 - 0.06` (`js/game.js:410`), der Wandkern endet also bei `d/2` und die
Scheibe sitzt von `d/2 + 0.02` bis `d/2 + 0.07` — **vollständig aussen vor der
Wand**. Von innen ist sie nicht einmal sichtbar.

Ein Kind, das «Hineingehen» drückt, steht deshalb in einem fensterlosen Kasten,
obwohl der Turm von aussen voller Fenster ist. Der Kommentar in `enterBesuch`
rechnet sogar schon mit dem Gegenteil — höhere Stockwerke bleiben stehen,
«beim Blick aus dem Fenster fehlte sonst der halbe Turm» (`js/game.js:1260-1263`).
Der Blick aus dem Fenster, den dieser Kommentar meint, gibt es bis heute nicht.

## Was der Wunsch meint

Drinnen soll die Vorderwand dort, wo von aussen ein Fenster sitzt, ein echtes
Loch haben: man sieht den Wald, den Bach, den Himmel und den restlichen Turm.
Kein gemaltes Bild, sondern dieselbe Welt, die man von draussen sieht.

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründungen stehen jeweils
dabei, damit sie widerlegbar sind.

- **E1 [high] — Nur die Fassadenfenster der Vorderwand, nicht das Möbel
  «Fenster».** Gemeint sind ausschliesslich die Einträge in
  `g.userData.wins` (`js/game.js:413-420`). Verworfen: auch das Katalogmöbel
  `fenster` (`js/models.js:493-506`, in `WALL_ITEMS`, `js/models.js:676`)
  durchsichtig machen. Es hängt an einer frei wählbaren Stelle einer frei
  wählbaren Wand (`wallPlacement`, `js/game.js:543`) und kann verschoben und
  wieder weggenommen werden; ein Loch dafür müsste bei jedem Zug neu in die
  Wandgeometrie geschnitten werden. Das ist ein eigener, deutlich grösserer
  Wunsch.

- **E2 [high] — Echte Öffnungen, keine Attrappe.** Wandkern und Innenpanel der
  Vorderwand bekommen an den Fensterstellen Bogenlöcher. Verworfen: eine
  hellblaue «Himmelscheibe» innen an die Wand hängen (so wie die Scheibe des
  Möbels, `js/models.js:501`). Die Kamera dreht sich im Besuch frei um das
  Blickziel (`js/game.js:1237-1243`); ohne Parallaxe verrät sich ein Aufkleber
  bei der ersten Drehung.

- **E3 [high] — Gelocht nur im Besuch, draussen bleibt alles, wie es ist.** Die
  beiden Vorderwand-Meshes behalten ihre Position und ihr Material und
  tauschen nur ihre Geometrie; zusätzlich werden die Bogenscheiben `wins` des
  besuchten Stockwerks ausgeblendet, sonst verstopfen sie das Loch von aussen.
  Verworfen: die Wand dauerhaft lochen. Zwischen Wandaussenfläche (`d/2`) und
  Scheibe (`d/2 + 0.02`) liegt ein 2 cm tiefer Schlitz; von schräg aussen sähe
  man dauerhaft durch ihn ins Zimmer. Ausserdem lebt die Nachtfassade genau
  von diesen Scheiben — `applyNight` färbt sie gelb, wenn drinnen Licht brennt
  (`js/game.js:1864-1868`).

- **E4 [med] — Die gelochte Geometrie entsteht beim ersten Besuch des
  Stockwerks, nicht beim Bauen.** Sie wird an der Etagengruppe gemerkt und beim
  zweiten Besuch wiederverwendet. Verworfen: sie in `makeFloor` gleich
  mitbauen. Etagen entstehen schon heute erst, wenn sie gebraucht werden
  (`js/game.js:381-386`, #47); zwei zusätzliche Extrusionsgeometrien pro
  Stockwerk gehören zur selben Sparsamkeit. Bei fünfzig Stockwerken zahlt sonst
  jeder für Zimmer, die er nie betritt.

- **E5 [high] — Die UV der gelochten Geometrie müssen von Hand normalisiert
  werden.** `THREE.ExtrudeGeometry` legt die UV der Deckflächen in
  Shape-Koordinaten an, also in Metern; `THREE.BoxGeometry` legt sie auf
  `0…1`. Die Tapete ist eine gemeinsame, zwischengespeicherte Textur mit
  `repeat 5 × 1.6` (`js/models.js:709-714`) — sie wird von allen Etagen geteilt
  und darf nicht pro Wand umgestellt werden. Ohne Normalisierung kachelt die
  Tapete auf einer 5 m breiten Wand 25-fach statt 5-fach und das Zimmer sieht
  im Besuch anders aus als beim Einrichten.

- **E6 [med] — Die Öffnung hat genau die Kontur der Bogenscheibe.** Derselbe
  Bogen wie `makeArchGeo(0.5, 0.8)` (`js/game.js:275-277`), an derselben
  Stelle (`x` aus der Schleife, `y = h * 0.24`, `js/game.js:416-419`). Kein
  Rahmen, keine Scheibe, keine Fensterbank in dieser Runde. Verworfen: ein
  rechteckiges Loch — es ginge auch, sieht von innen aber nach Bauloch aus,
  während der Bogen zum Rest des Turms passt.

- **E7 [high] — Tür und Torbogen bleiben zu.** Die Wohnungstür
  (`js/game.js:425-428`) und der Torbogen im Erdgeschoss (`js/game.js:417`)
  stehen nicht in `g.userData.wins` und bekommen kein Loch. Ein 1.1 × 1.8
  grosses Loch statt des Tors wäre kein Fenster, sondern eine offene Wand.

- **E8 [high] — Keine neue Bedienung, kein neuer Zustand im Spielstand.** Die
  Öffnungen sind einfach da, solange man drinnen ist. Verworfen: ein Knopf
  «Fenster auf». `#besuchbar` trägt schon Titel und sechs Bedienelemente und
  bricht bei 400 px um (`index.html:337-342`), und der Besuch darf den
  Spielstand nicht verändern (Zusage aus #44, `js/game.js:1112-1114`).

- **E9 [med] — Alle Fenster des besuchten Stockwerks öffnen sich, nicht nur
  die im Blickfeld.** Der Standpunkt lässt sich frei drehen; eine Auswahl nach
  Blickrichtung müsste pro Bild nachgeführt werden und flackerte beim Drehen.

## Entwurf

### Wo der Eingriff sitzt

Alles spielt sich in `js/game.js` ab, in drei kleinen Ecken:

1. **Bauen (einmalig pro Stockwerk, beim ersten Besuch).** Eine neue Funktion
   baut zu den beiden Vorderwand-Meshes je eine zweite Geometrie mit
   Bogenlöchern und legt sie an der Etagengruppe ab. Nötige Zutaten sind alle
   schon da: `makeArchGeo`s Bogenpfad (`js/game.js:275-277`), die
   Fensterpositionen aus derselben Rechnung wie in `makeFloor`
   (`js/game.js:414-420`) und die Wandmasse `w`, `h`, `WALL_CORE`,
   `WALL_PANEL` (`js/game.js:25`).

2. **Umschalten.** Eine Funktion setzt für ein Stockwerk «Fenster offen» oder
   «Fenster zu»: Geometrie tauschen und die Bogenscheiben `wins` sichtbar bzw.
   unsichtbar schalten. Gerufen wird sie aus `enterBesuch`
   (`js/game.js:1245-1268`), `wechsleBesuch` (`js/game.js:1308-1315`) — dort
   auch für das *verlassene* Stockwerk, das wieder zugehen muss — und
   `exitBesuch` (`js/game.js:1270-1282`).

3. **Sichtbarkeit.** Nichts an `applyFronts()` (`js/game.js:1109-1117`): die
   Öffnung ist eine Frage der Geometrie, nicht der Sichtbarkeit der Wand.

### Die Löcher

Der Bogen ist ein `THREE.Path` in denselben Koordinaten wie die Wandscheibe.
Die Wandscheibe selbst ist ein Rechteck `(w - 0.24) × h`, die Löcher sitzen bei
denselben `x` wie die Scheiben, mit Unterkante `h * 0.24`. `js/models.js:190-199`
zeigt das Muster (`hausArch` / `hausWall`) bereits für das Terrassenhäuschen —
dieselbe Technik, aber in `js/game.js` nachgebaut statt importiert, weil die
dortige Fassung fest an `HAUS_WALL` und an die Hauskontur gebunden ist.

Beide Schichten brauchen dasselbe Loch: der Kern (`WALL_CORE = 0.09`) und das
Innenpanel (`WALL_PANEL = 0.02`) liegen hintereinander in derselben Wand
(`js/game.js:411-412`). Ein Loch nur im Panel zeigte den Putz dahinter.

### Was man dann sieht

Wald, Bach, Himmel, Brücke, die Aussenwelt — und Teile des eigenen Turms: den
Laufsteg und das Deck der Aussentreppe (`js/game.js:297-299`), die direkt vor
der Vorderwand liegen, sowie höhere Stockwerke, die im Besuch bewusst stehen
bleiben (`js/game.js:1260-1263`). Das ist gewollt und der Grund, warum jener
Kommentar überhaupt dort steht.

### Verhältnis zu den Nachbar-Issues

- **#95 («Wände weg» soll auch von innen wirken).** Dort verschwindet die
  ganze Vorderwand; hier bleibt sie stehen und bekommt Löcher. Die beiden
  vertragen sich: ist die Wand weg, sieht man ohnehin alles, und die
  ausgeblendeten Scheiben verschwinden mit ihrer Gruppe. Beide Issues fassen
  `enterBesuch`/`exitBesuch` an — wer als Zweiter merged, muss von Hand
  zusammenführen.
- **#96 (Lücke zwischen Wand und Decke).** Ein eigener Fehler an derselben
  Stelle im Bild, aber eine andere Ursache (Deckenmass gegen Wandhöhe). Dieser
  Entwurf ändert daran nichts und macht es auch nicht schlimmer: die Löcher
  liegen zwischen `h * 0.24` und `h * 0.24 + 0.8`, also weit unter der Decke.

## Abnahmekriterien

1. Im Besuch in einer Wohnung hat die Vorderwand dort, wo von aussen ein
   Fenster sitzt, eine echte Öffnung — ein Strahl vom Auge durch die
   Fenstermitte trifft die eigene Vorderwand nicht mehr, sondern die Aussenwelt
   (oder nichts).
2. Von innen ist durch die Öffnung die Aussenwelt zu sehen, keine braune
   Scheibe: die Bogenscheiben des besuchten Stockwerks sind ausgeblendet.
3. Fenster hat jedes besuchte Stockwerk, auch das Erdgeschoss; Tür und
   Torbogen bleiben geschlossen.
4. Nach «Schluss» ist die Aussenansicht wieder genau wie vorher: massive
   Vorderwand, alle Bogenscheiben sichtbar, auch nach mehreren Besuchen.
5. Beim Wechsel des Standpunkts (hoch/runter/Dach/Draussen/Aussicht) geht das
   verlassene Stockwerk wieder zu und das neue auf.
6. Die Tapete sieht im Besuch genauso aus wie beim Einrichten — gleiche
   Kachelung, kein gestreckter oder geschrumpfter Musterrapport.
7. Der Besuch verändert den Spielstand nicht: `localStorage` ist vor und nach
   dem Besuch byte-gleich.
8. Nachts funktioniert die Fassade unverändert: nach dem Besuch leuchten die
   Fenster beleuchteter Wohnungen wieder (`applyNight`, `js/game.js:1864-1868`).
9. Die Seite lädt und der ganze Ablauf läuft ohne `pageerror`.

## Was dieser Entwurf nicht liefert

- Kein durchsichtiges Katalogmöbel «Fenster» (E1).
- Keine Glasscheibe, kein Fensterrahmen, keine Fensterbank von innen (E6).
- Kein Öffnen/Schliessen von Hand, kein Knopf, kein gespeicherter Zustand (E8).
- Keine Öffnungen in Rück- und Seitenwänden — dort gibt es gar keine Fenster
  (`js/game.js:413-420` baut sie nur in die Front-Gruppe).
- Keine Lösung für die Lücke zwischen Wand und Decke (#96).
- Kein zusätzliches Licht im Zimmer (siehe Folgen).

## Folgen

- **Heller wird es nicht.** Die Szene hat Hemisphären- und Richtungslicht
  (`js/game.js:167-168`) und keine Lichtberechnung durch Öffnungen; das
  Loch lässt Aussicht herein, keine Helligkeit. Der Lichttrick des Besuchs
  bleibt die ausgeblendete Decke (`js/game.js:1264`).
- **Während des Besuchs leuchtet die eigene Fassade nicht.** Die Scheiben des
  besuchten Stockwerks sind ausgeblendet, `applyNight` färbt sie zwar weiter,
  sichtbar ist davon aber nichts. Von innen fällt das nicht auf; auf einem Foto
  aus der Vogelperspektive gäbe es den eigenen Turm ohnehin nicht zu sehen.
- **Mehr Dreiecke, aber nur für besuchte Stockwerke.** Zwei
  Extrusionsgeometrien pro Stockwerk, einmalig, dauerhaft gehalten.
- **Durch die Öffnung sieht man auch Steg und Deck der Aussentreppe** — sie
  liegen unmittelbar vor der Vorderwand. Das ist ehrlich: dort sind sie.
- **Schattenwurf ändert sich minimal**, weil die Wand nun Löcher hat. Über
  Etage 30 wirft ohnehin nichts mehr Schatten (`js/game.js:437-440`).
