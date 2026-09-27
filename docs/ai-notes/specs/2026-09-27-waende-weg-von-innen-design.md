# Spec — «Wände weg» soll auch von innen wirken (Issue #95)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #95, abgespalten aus #91 (Feedback-Sammlung vom 27.09.2026).
Der ganze Wortlaut: «Hineingehen: Wände weg soll auch von innen funktionieren.»

## Problem

Die Werkzeugleiste hat zwei Knöpfe nebeneinander: «Hineingehen»
(`index.html:312`) und «Wände weg» (`index.html:311`). Steht man drinnen,
bleibt der zweite wirkungslos.

Im Code ist das kein Versehen, sondern eine bewusste Entscheidung aus #44
(`js/game.js:1110-1117`):

```js
/* Von innen gilt das Gegenteil von aussen: die Wand muss stehen, sonst sieht
   man in einen offenen Setzkasten statt in ein Zimmer. state.cutaway selbst
   bleibt unangetastet, damit die Aussenansicht nach dem Besuch unverändert
   ist (#44). */
floorGroups[j].userData.front.visible = besuch ? true : (!state.cutaway && !(edit && edit.k === j));
```

Der Besuch **erzwingt** also alle Vorderwände, egal was `state.cutaway` sagt.
Ein Kind, das drinnen steht und «Wände weg» drückt, erlebt heute Folgendes:

- Die Wand bleibt stehen — nichts passiert sichtbar.
- Die Aufschrift des Knopfes wechselt trotzdem auf «Wände hin»
  (`js/game.js:1116`).
- `state.cutaway` wird umgelegt **und gespeichert** (`js/game.js:1923`), d. h.
  die Aussenansicht sieht nach dem Verlassen des Besuchs anders aus als vorher.

Das ist die schlechteste aller Varianten: kein Effekt dort, wo man drückt, und
ein Effekt dort, wo man nicht hinsieht.

## Was der Wunsch meint

Der Standpunkt im Zimmer liegt an der Rückwand und blickt nach vorn
(`js/game.js:1216-1218`: Auge bei `-d/2 + 0.5`, Ziel in der Raummitte). Genau
in dieser Blickrichtung steht die Vorderwand. «Wände weg» von innen heisst
deshalb: **die Wand vor mir verschwindet, ich schaue aus der Wohnung hinaus** —
auf den Wald, den Bach, die Brücke, den restlichen Turm.

Das ist dieselbe Geometrie, die die Aussenansicht schon wegnimmt: die Gruppe
`userData.front` (`js/game.js:409-411`) mit Wandkern, Innenpanel, Fenstern und
Tür.

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründungen stehen jeweils
dabei, damit sie widerlegbar sind.

- **E1 — «Wände weg» wirkt von innen auf dieselben Vorderwände wie von
  aussen.** Alle `userData.front`-Gruppen werden unsichtbar, nicht nur die des
  besuchten Stockwerks. Verworfen: alle vier Wände wegnehmen. Rück-, Seiten-
  und Vorderwand bestehen aus einem Kern *und* einem Innenpanel, und nur die
  Panels sind einzeln greifbar (`js/game.js:392-407`, `wallPanels`); die Kerne
  liegen anonym in der Etagengruppe. Ein Raum ohne alle Wände wäre ausserdem
  genau der «offene Setzkasten», vor dem der Kommentar aus #44 warnt — die
  Möbel stünden im Nichts.

- **E2 — Der Zustand von innen ist ein eigenes, nicht gespeichertes Merkmal am
  Besuch (`besuch.wandWeg`), nicht `state.cutaway`.** Verworfen:
  `state.cutaway` auch von innen benutzen. Der Besuch darf den Spielstand nicht
  verändern — das ist eine feste Zusage aus #44 (`js/game.js:1112-1114`, und
  `save()` wird in `enterBesuch`/`exitBesuch`/`wechsleBesuch` nirgends
  gerufen). Mit `state.cutaway` wäre die Aussenansicht nach jedem Besuch anders
  als davor, und `localStorage` nicht mehr byte-gleich.

- **E3 — Beim Betreten steht die Wand immer.** `besuch.wandWeg` beginnt bei
  jedem `enterBesuch` mit `false`; beim Wechsel des Standpunkts
  (`wechsleBesuch`, `js/game.js:1307-1313`) bleibt der gewählte Zustand
  erhalten — es ist derselbe Besuch. Verworfen: den Zustand über das Verlassen
  hinaus merken; dafür gäbe es keinen Ort ausserhalb des Spielstands, und E2
  schliesst den aus.

- **E4 — Derselbe Knopf, keine neue Schaltfläche.** `#btn-cutaway` bleibt in
  der Werkzeugleiste und bedient je nach Lage den Aussen- oder den
  Innenzustand. Verworfen: ein eigener Knopf in `#besuchbar`. Die Leiste trägt
  schon Titel und sechs Bedienelemente und bricht bei 400 px Breite um
  (`index.html:88-92`); ein siebtes Element verschlechtert genau den Fall, für
  den sie gebaut wurde.

- **E5 — Die Aufschrift folgt dem Zustand, den der Knopf gerade bedient.**
  Drinnen zeigt er «Wände weg»/«Wände hin» nach `besuch.wandWeg`, draussen
  unverändert nach `state.cutaway`. Beim Verlassen des Besuchs stellt
  `applyFronts()` die Aussen-Aufschrift wieder her — das tut es heute schon
  (`js/game.js:1116`, aufgerufen aus `exitBesuch`, `js/game.js:1278`).

## Entwurf

### Die Regel in einem Satz

`applyFronts()` liest künftig **eine** Quelle — den Zustand, der gerade gilt:

```js
const wandWeg = besuch ? besuch.wandWeg : state.cutaway;
```

Damit fällt die Sonderbehandlung `besuch ? true : …` weg; der Rest der Zeile
(Einrichten blendet die eigene Vorderwand aus) bleibt, wie er ist. Einrichten
und Besuch schliessen sich ohnehin aus (`js/game.js:1146`, `js/game.js:1246`).

### Der Knopf

`$('btn-cutaway').onclick` bekommt einen Vorabzweig für den Besuch: Merkmal
umlegen, `applyFronts()`, Geräusch, Meldung — **kein `save()`, kein Schreiben
an `state`**. Ausserhalb des Besuchs bleibt der heutige Pfad unverändert,
`save()` eingeschlossen.

Die Meldung unterscheidet sich, weil die Wirkung eine andere ist: draussen
«Blick in alle Wohnungen — wie im Buch!», drinnen sinngemäss «Die Wände sind
weg — Du siehst hinaus.» Beim Zurückstellen gibt es wie heute keine Meldung.

### Was sich sonst ändert

Nichts. Die Decke des besuchten Stockwerks bleibt unabhängig davon ausgeblendet
(`js/game.js:1264`) — das ist die Lichtfrage, nicht die Wandfrage. Kamera,
Polargrenzen (`besuchPolar`), Zoom-Sperre und die Trefferlogik im Besuch
(`js/game.js:2090-2105`) bleiben unberührt.

## Abnahmekriterien

1. Im Besuch in einer Wohnung nimmt «Wände weg» die Vorderwände weg: alle
   `floorGroups[j].userData.front.visible` sind `false`, die Sicht geht aus dem
   Zimmer hinaus.
2. Ein zweiter Druck («Wände hin») stellt sie wieder her.
3. Der Knopf zeigt drinnen die Aufschrift zum *inneren* Zustand.
4. Ein Besuch verändert `state.cutaway` nicht — der in `localStorage`
   gespeicherte Stand ist vor und nach dem Besuch byte-gleich, auch wenn drinnen
   mehrfach umgeschaltet wurde.
5. Nach «Schluss» steht die Aussenansicht genau so da wie vor dem Besuch
   (Wände sichtbar oder weg gemäss `state.cutaway`), und die Aufschrift passt
   dazu.
6. Beim nächsten «Hineingehen» stehen die Wände wieder — der innere Zustand
   wird nicht über den Besuch hinaus gemerkt.
7. Der Wechsel des Standpunkts (hoch/runter/Dach/Draussen/Aussicht) behält den
   inneren Zustand bei.
8. Draussen verhält sich der Knopf unverändert, `save()` eingeschlossen.
9. Die Seite lädt ohne `pageerror`.

## Was dieser Entwurf nicht liefert

- Kein Wegnehmen der Rück- und Seitenwände (E1).
- Keine Lösung für die «Lücke zwischen Wand und Decke» — das ist ein eigenes
  Issue aus derselben Sammlung (#91).
- Keine Tastaturbedienung, kein neuer Knopf, keine Änderung an `#besuchbar`.
- Kein Speichern des inneren Zustands.

## Folgen

- Wandobjekte (Poster, Uhr, Spiegel, Fenster-Objekt, Dartscheibe) an der
  Vorderwand hängen weiter frei in der Luft, wenn die Wand weg ist: sie sind
  Kinder der Etagengruppe, nicht der Front-Gruppe (`js/game.js:799-808`).
  Draussen ist das heute schon so — der Besuch erbt es, er verursacht es nicht.
- Mit weggenommenen Wänden zeigt ein Foto aus dem Besuch den Turm offen. Das
  ist gewollt und der eigentliche Reiz des Wunsches.
- Die Vorderwand trägt Tür und Fenster des besuchten Stockwerks
  (`js/game.js:410-432`); beide verschwinden mit ihr. Von innen fällt das kaum
  auf, weil dahinter dieselbe Aussenwelt liegt.
