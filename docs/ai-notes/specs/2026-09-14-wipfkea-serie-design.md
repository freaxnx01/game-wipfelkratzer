# Spec — «Wipfkea»: eine eigene Möbelserie (Issue #42)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:490-560`).

Quelle: Feedback-Triage 12.09.2026, Eintrag 13
(`docs/ai-notes/feedback/2026-09-12-test-mit-tochter.md:30`).

## Problem

Gewünscht ist eine wiedererkennbare Möbelserie im Stil eines bekannten
schwedischen Möbelhauses — in **Braun und Pink** statt Blau und Gelb.

Heute ist jedes Möbel ein Einzelstück: `FURN` (`js/models.js:65`) enthält 32
parameterlose Funktionen, jede baut ihr Modell aus `box`/`cyl`/`sph`
(`js/models.js:17-20`) mit frei gewählten Massen. Es gibt keine gemeinsame
Formsprache und keinen Begriff «Serie». Ein `sofa` ist 0.85 breit
(`js/models.js:86`), ein `regal` 0.85 (`js/models.js:94`), ein `stuhl` 0.34
(`js/models.js:82`) — die Masse sind je Modell einzeln gesetzt, nicht aus
gemeinsamen Konstanten abgeleitet.

Zwei Fragen entscheiden den Zuschnitt:

1. **Was macht eine Serie aus?** Wenn nur die Farbe, dann ist die Serie
   dasselbe wie die Möbelfarbe aus #34 — und #34 löst das bereits, ohne neue
   Modelle. Wenn die Form, dann braucht es eigene `FURN`-Einträge.
2. **Nebeneinanderstehen.** Ein Serien-Sofa muss neben dem bestehenden Sofa
   stehen können, ohne dass eines von beiden falsch aussieht. Beide sind
   `MeshLambertMaterial`-Primitive im selben Raster; der Unterschied muss also
   in der Formsprache liegen und **gewollt** aussehen, nicht wie ein Fehler.

### Abgrenzung gegen #34 (Möbelfarbe)

#34 ist bereits enrichet (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`)
und noch offen. Der dortige Entscheid: die Farbauswahl legt **keine** neuen
Materialien an, sondern reicht eine bestehende `MAT`-Instanz als optionalen
ersten Parameter ins Modell (`makeFurniture(id, colorId)`, Spec #34 Abschnitt 1).
Nach #34 lässt sich jedes einfärbbare Möbel in sechs Tönen darstellen, Rosa
(`MAT.pink`, `js/models.js:11`) inklusive.

**Daraus folgt für dieses Issue:** Wipfkea darf keine zweite Farbmechanik
bauen. Eine Serie, die nur «braun und pink» ist, wäre nach #34 ein
Duplikat — zwei rosa Sofas sind dann ohnehin einen Tipp entfernt. Wipfkea ist
deshalb **eine Formsprache** mit einer braun-rosa Vorgabefarbe, und die
Vorgabefarbe besteht ausschliesslich aus bestehenden `MAT`-Einträgen
(`woodD`, `woodL`, `pink`; `js/models.js:5, 11`). Die Einfärbbarkeit selbst
kommt später aus #34 — dieses Issue baut sie nicht, bereitet sie aber vor (A5).

### Abgrenzung gegen #51 (Walddorf)

Mit #51 wird «Wipfkea» zusätzlich ein **Ort**, an dem man einkauft. Dieses
Issue bleibt die **Möbelserie selbst**: vier Modelle im bestehenden Katalog,
sofort platzierbar. Kein Laden, keine Karte, kein Weg dorthin, kein Kaufen,
keine Preise, keine Flachpack-Kiste, kein Aufbauen. Das gehört ins Walddorf.

## Goals

- Vier Möbel bilden eine sichtbare Serie: **Regal, Tisch, Stuhl, Sofa**.
- Die Serie ist an der **Form** erkennbar — gleiche Brettstärke, gerade
  Kanten, sichtbare helle Dübel — nicht bloss an der Farbe.
- Braun (`MAT.woodD`) als Korpus, Pink (`MAT.pink`) als Polster-/Akzentton.
- Ein Wipfkea-Sofa und das bestehende Sofa können im selben Raum stehen; der
  Unterschied liest sich als «Bausatz neben handgemacht», nicht als Bruch.
- Die Serienmöbel verhalten sich im Katalog, im Raster, beim Verschieben,
  Drehen und im Spielstand exakt wie bestehende Möbel — keine Sonderwege.
- Das Wipfkea-Sofa erfüllt den Sofa-Wunsch von Jimmy und Jule
  (`js/game.js:25`) wie ein Sofa (A4).
- Alte Spielstände laden unverändert.

## Non-goals

- **Kein Wipfkea-Laden, keine Karte, kein Einkaufen** — das ist #51.
- **Keine neue Farbmechanik.** Keine Einfärb-Oberfläche, keine
  `FURN_COLORS`-Palette, kein `TINTABLE` — das ist #34 (A5).
- **Keine neuen `MAT`-Einträge und keine neuen Farbwerte.** Braun und Pink
  sind `MAT.woodD` und `MAT.pink` (`js/models.js:5, 11`).
- Keine importierten Meshes, keine Texturen, kein anderes Material als
  `MeshLambertMaterial` (`CLAUDE.md:796-821`).
- Kein eigener Katalog-Tab «Wipfkea». `CATS` (`js/models.js:271`) bleibt
  unverändert; die vier Stücke stehen im Tab «Möbel» (A3).
- Kein Ersetzen oder Umbauen bestehender Möbel. `sofa`, `tisch`, `stuhl`,
  `regal` bleiben Zeile für Zeile, wie sie sind.
- Keine Serie für Deko, Wandobjekte oder Dachmöbel — nur die vier.
- Keine Flachpack-Kiste, kein Aufbau-Minispiel, keine Anleitung, kein
  Inbusschlüssel.

## Design

### 1. Die Serie ist eine Formsprache, kein Farbschalter

Fünf Regeln, die alle vier Modelle teilen — sie sind das, was die Serie
ausmacht, und sie stehen als Konstanten oben in `js/models.js`, damit sie nicht
pro Modell auseinanderlaufen:

1. **Eine einzige Brettstärke.** Jedes Brett ist `WK_T = 0.06` dick. Das ist
   das stärkste Erkennungszeichen: bestehende Möbel haben je Modell eigene
   Stärken (0.05 am Stuhl, 0.06 am Tisch, 0.26 am Sofasitz;
   `js/models.js:82, 79, 86`).
2. **Nur rechte Winkel.** Der Korpus besteht ausschliesslich aus `box()`.
   Einzige Ausnahme: die Rückenlehne des Stuhls ist um 0.12 rad geneigt, damit
   man sich anlehnen kann.
3. **Sichtbare Dübel.** Helle Zylinderköpfe (`MAT.woodL`, Radius 0.02) sitzen
   aussen an jeder Verbindung. Das ist das zweite Erkennungszeichen und der
   einzige Grund, warum `cyl` in der Serie überhaupt vorkommt.
4. **Seitenteile statt Beine**, wo möglich: Regal, Stuhl und Sofa stehen auf
   durchgehenden Brettwangen; nur der Tisch hat vier Vierkantbeine
   (`WK_LEG = 0.05`). Bestehende Möbel stehen auf gedrechselten oder
   konischen Füssen (`js/models.js:79, 83`).
5. **Braun trägt, Pink polstert.** `MAT.woodD` für alles Tragende,
   `MAT.pink` ausschliesslich für Polster und Blenden, `MAT.woodL` für Dübel
   und Rückwand.

Warum das neben dem bestehenden Mobiliar funktioniert: die bestehenden Möbel
sind rundlich, unterschiedlich dick und warm-braun (`MAT.wood`/`woodL`), die
Serie ist flach, gleichmässig und dunkler (`MAT.woodD`) mit rosa Akzent. Beides
ist derselbe Bilderbuch-Stil aus denselben Primitiven — der Kontrast liegt in
Proportion und Konsequenz, nicht in Stilbruch.

### 2. Die gemeinsamen Bausteine

```js
/* ---------- Wipfkea: die gemeinsame Formsprache der Serie ----------
   Alles, was die vier Serienmöbel zusammenhält, steht hier — Brettstärke,
   Beinstärke, Farbrollen. Ein Serienmöbel greift nie direkt auf ein anderes
   MAT zu, sondern immer über diese Rollen. */
const WK_T = 0.06;           /* Brettstärke, in der ganzen Serie identisch */
const WK_LEG = 0.05;         /* Kantenmass der Vierkantbeine */
const WK_BOARD = MAT.woodD;  /* Braun: alles Tragende */
const WK_SOFT = MAT.pink;    /* Pink: Polster und Blenden */
const WK_DOWEL = MAT.woodL;  /* Hell: sichtbare Dübel und Rückwand */

/* Liegendes Brett (Boden, Tablar, Sitzfläche). */
const wkBoard = (g, w, d, mat, x, y, z) => box(g, w, WK_T, d, mat, x, y, z);
/* Stehende Wange (Seitenteil, Armlehne). */
const wkPanel = (g, h, d, mat, x, y, z) => box(g, WK_T, h, d, mat, x, y, z);
/* Sichtbarer Dübelkopf — das Erkennungszeichen der Serie.
   axis 'x' zeigt seitlich heraus, 'y' nach oben, 'z' nach vorn. */
function wkDowel(g, x, y, z, axis = 'z') {
  const d = cyl(g, 0.02, 0.02, 0.03, WK_DOWEL, x, y, z, 8);
  if (axis === 'z') d.rotation.x = Math.PI / 2;
  else if (axis === 'x') d.rotation.z = Math.PI / 2;
  return d;
}
```

### 3. Die vier Modelle

Ids tragen das Präfix `wk_` und enden auf den Namen des klassischen
Gegenstücks: `wk_regal`, `wk_tisch`, `wk_stuhl`, `wk_sofa`. Das Präfix ist
nicht Kosmetik — daran hängt die Wunsch-Zuordnung (A4).

Die Bauhöhen bleiben im Rahmen der bestehenden Möbel (Regal 1.2 gegen 1.15
beim bestehenden `regal`, `js/models.js:94-100`), damit die Kamera beim
Einrichten und die Ablagelogik (`surfaceYAt`, Grenze `ly < 1.8`,
`js/game.js:425`) unverändert greifen.

Der optionale Korpusparameter `body` folgt exakt der Signatur aus #34
(Spec #34 Abschnitt 1): ohne Argument sieht das Modell aus wie beschrieben.
Das kostet hier nichts und macht #34 später zu einem Vierzeiler (A5).

### 4. Katalog und Ablagefläche

Vier neue Einträge in `CATALOG` (`js/models.js:251-270`), alle
`cat: 'mobel'`, direkt hinter den bestehenden Möbeln:

```js
{ id: 'wk_regal', name: 'Wipfkea Regal', cat: 'mobel' },
{ id: 'wk_tisch', name: 'Wipfkea Tisch', cat: 'mobel' },
{ id: 'wk_stuhl', name: 'Wipfkea Stuhl', cat: 'mobel' },
{ id: 'wk_sofa',  name: 'Wipfkea Sofa',  cat: 'mobel' },
```

`SURFACES` (`js/game.js:429`) bekommt `wk_regal` und `wk_tisch` dazu: auf
beiden hat Deko sichtbar Platz, und ohne den Eintrag findet `addItem` sie beim
Ablegen einer Vase nicht (`js/game.js:697-700`). `DECO` und `WALL_ITEMS`
bleiben unberührt — die Serienmöbel sind Bodenmöbel.

### 5. Wünsche: das Serienmöbel zählt wie sein Gegenstück

Jimmy und Jule wünschen sich ein `sofa` (`js/game.js:25`). Stellt das Kind
ein Wipfkea-Sofa hinein, passiert heute nichts — der Vergleich ist
`t.wish === placedId` (`js/game.js:775`) bzw. `e.id === t.wish`
(`js/game.js:768`). Für ein Kind ist das ein Fehler, kein Feature.

Lösung, eine Zeile, generisch für die ganze Serie:

```js
/* Ein Serienmöbel zählt bei Wünschen wie sein klassisches Gegenstück:
   'wk_sofa' erfüllt den Sofa-Wunsch. Die Serien-ids sind genau dafür als
   'wk_' + klassische id gebaut (siehe Spec Wipfkea). */
const wishKey = id => id.startsWith('wk_') ? id.slice(3) : id;
```

eingesetzt in `wishOpen` (`js/game.js:768`) und `checkWishes`
(`js/game.js:775`). Betroffen ist nur `wk_sofa`; `wk_regal`, `wk_tisch` und
`wk_stuhl` haben ohnehin kein Wunsch-Gegenstück (`js/game.js:20-30`).

### 6. Spielstand

**Keine Änderung.** Ein Serienmöbel ist ein ganz normaler Eintrag mit einer
neuen `id`; `state.rooms` (`js/game.js:35`), `placeItemMesh`
(`js/game.js:447`) und `save()` (`js/game.js:37-42`) brauchen keine Zeile.
Alte Stände kennen die neuen ids schlicht nicht — das ist gültig.

## Assumptions

- **A1** [med] Die Serie besteht aus genau vier Stücken: Regal, Tisch, Stuhl,
  Sofa. Verworfen: die ganze Möbelkategorie doppeln (sieben Stücke,
  `js/models.js:252-255`) — der Tab «Möbel» zeigt heute sieben Einträge in
  einem 3-Spalten-Raster (`index.html:61`); vierzehn Stücke machen daraus eine
  Scrollwand, in der die Serie als Serie gar nicht mehr auffällt. Vier
  Stücke füllen eine Wohnung vollständig und zeigen die Formsprache an genau
  den Stellen, wo das Vorbild wiedererkennbar ist (Regal, Klapptisch,
  Stuhl, Zweisitzer).
- **A2** [high] Die Serie ist eine **Formsprache** (Brettstärke, rechte
  Winkel, sichtbare Dübel, Wangen statt Beine) mit brauner Vorgabe und rosa
  Polster — nicht bloss eine Farbwelt. Verworfen: die bestehenden Modelle in
  Braun/Pink einfärben und das «Serie» nennen — das ist exakt das, was #34
  ohnehin liefert (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`,
  Abschnitt 1), und wäre doppelt gebaut.
- **A3** [med] Die vier Stücke stehen im bestehenden Tab «Möbel», nicht in
  einem eigenen Tab. Verworfen: ein Tab «Wipfkea» in `CATS`
  (`js/models.js:271`) — die Tab-Leiste bricht auf dem Tablet schon heute um
  (`index.html:58`), und ein Tab mit vier Einträgen neben einem Tab mit sieben
  trennt Möbel, die beim Einrichten nebeneinander gehören.
- **A4** [med] `wk_sofa` erfüllt den Sofa-Wunsch, über die Ableitung
  `wishKey` aus dem `wk_`-Präfix. Verworfen: (a) Serienmöbel erfüllen keine
  Wünsche — das Kind stellt ein Sofa hin und die Sprechblase bleibt stehen,
  ohne erkennbaren Grund; (b) eine Tabelle `WISH_ALIAS` — eine zweite Liste,
  die bei jedem neuen Serienstück mitgepflegt werden muss, während das Präfix
  ohnehin schon die Zuordnung trägt.
- **A5** [med] Dieses Issue baut **keine** Einfärbbarkeit. Die vier Modelle
  bekommen aber bereits den optionalen `body`-Parameter nach der #34-Signatur
  (`FURN.sofa(body = MAT.red)`, Spec #34 Abschnitt 1), sodass #34 sie
  später nur noch in `TINTABLE` eintragen muss. Verworfen: (a) auf #34 warten
  und #42 blockieren — die vier Modelle hängen an keiner Zeile aus #34; (b)
  hier eine eigene Farbwahl bauen — genau die Doppelarbeit, die das Issue
  ausschliesst.
- **A6** [med] Die Reihenfolge der beiden Issues ist offen: #42 und #34 sind
  unabhängig und dürfen in beliebiger Reihenfolge landen. Verworfen: #42 als
  Folgeissue von #34 führen — es entstünde eine Wartezeit ohne technischen
  Grund, und der Konflikt beschränkt sich auf eine Zeile (`TINTABLE`).
- **A7** [low] `wk_regal` und `wk_tisch` kommen in `SURFACES`
  (`js/game.js:429`), damit Deko darauf landet. Verworfen: aussen vor lassen —
  ein Regal, auf dem kein Bücherstapel steht, während das Regal daneben es
  kann, liest sich als Fehler.
- **A8** [low] Die Namen im Katalog lauten «Wipfkea Regal», «Wipfkea Tisch»,
  «Wipfkea Stuhl», «Wipfkea Sofa». Verworfen: Fantasienamen im Stil des
  Vorbilds («Björkli») — im Katalog steht unter dem Bild nur eine Zeile
  (`js/game.js:602`), und ein Kind soll dort lesen, *was* das Ding ist.
- **A9** [low] Pink kommt ausschliesslich als Polster/Blende vor, nie als
  Korpus. Verworfen: ganze Korpusse in Pink — `MAT.pink` (`js/models.js:11`)
  ist ein heller Ton, eine 1.2 m hohe rosa Regalwand dominiert die Wohnung und
  kippt den warmen Grundton.
- **A10** [low] Die Serie greift den Stil des Vorbilds auf, ohne dessen Marke,
  Schrift, Logo oder Produktnamen zu verwenden — «Wipfkea» ist der einzige
  Anklang. Verworfen: Flachpack-Kisten mit gelb-blauer Aufschrift — Marke im
  Spiel, ohne Gewinn für das Einrichten.

## Consequences

- **Der Tab «Möbel» wächst von sieben auf elf Einträge.** Bei drei Spalten
  sind das vier statt drei Zeilen (`index.html:61`) — der Katalog scrollt
  etwas früher, die Serie steht aber geschlossen am Ende.
- **Vier zusätzliche Thumbnails** werden beim Start gerendert
  (`js/game.js:541`); die Startzeit wächst um vier `snap`-Durchläufe.
- **Keine neuen Materialien, keine neuen Farbwerte.** Die Serie benutzt
  `MAT.woodD`, `MAT.pink`, `MAT.woodL` — die Material-Instanzzahl der Szene
  bleibt bei den heutigen ~22, und das Batching bleibt intakt.
- **`wishKey` ändert die Wunschprüfung für alle Möbel**, auch für die
  bestehenden — für ids ohne `wk_`-Präfix ist die Funktion die Identität, das
  Verhalten also unverändert. Trotzdem ist es eine Änderung an einem Pfad,
  der bisher nur Gleichheit verglich (`js/game.js:768, 775`).
- **Das `wk_`-Präfix wird zur Konvention.** Wer später ein Serienstück
  ergänzt, muss es `wk_<klassische id>` nennen, sonst greift die
  Wunsch-Zuordnung nicht. Das steht als Kommentar an `wishKey`.
- **#34 bekommt vier Kandidaten mehr.** Landet #34 später, gehören
  `wk_sofa` (Polster) und vermutlich `wk_stuhl` (Blende) in `TINTABLE`; Regal
  und Tisch haben keine bunte Fläche und bleiben aussen vor.
- **Die Serie ist bewusst nicht komplett.** Es gibt kein Wipfkea-Bett, keine
  Wipfkea-Lampe. Wer die Wohnung vollständig in der Serie einrichten will,
  kann es nicht — das ist der Preis von A1 und wird sichtbar sein.

## Acceptance Criteria

- [ ] Der Katalog-Tab «Möbel» zeigt vier zusätzliche Einträge: «Wipfkea
      Regal», «Wipfkea Tisch», «Wipfkea Stuhl», «Wipfkea Sofa», jeder mit
      gerendertem Thumbnail.
- [ ] Jedes der vier Stücke lässt sich platzieren, verschieben, drehen und
      wieder entfernen wie ein bestehendes Möbel.
- [ ] Alle vier Modelle verwenden ausschliesslich `MeshLambertMaterial`; jedes
      Material im Modell ist eine Instanz aus `MAT` — es wird keine neue
      erzeugt und keine mutiert.
- [ ] Jedes Modell enthält mindestens zwei sichtbare Dübelköpfe in `MAT.woodL`.
- [ ] Jedes liegende und stehende Brett der vier Modelle ist exakt `0.06`
      dick — messbar über die `BoxGeometry`-Parameter.
- [ ] `wk_sofa` und `wk_stuhl` enthalten mindestens ein Teil in `MAT.pink`;
      `wk_regal` und `wk_tisch` enthalten kein `MAT.pink`.
- [ ] Kein Serienmöbel ist höher als 1.5 und keines breiter als 0.9, sodass es
      im Raster und unter der Decke (`FLOOR_H = 2.0`, `js/game.js:6`) Platz
      hat.
- [ ] Ein Wipfkea-Sofa im Stock von Jimmy und Jule erfüllt deren Sofa-Wunsch:
      Meldung «Wunsch erfüllt! +3 Haselnüsse», Nusszahl steigt um 3, die
      Wunschblase verschwindet.
- [ ] Ein bestehendes `sofa` erfüllt denselben Wunsch weiterhin.
- [ ] Ein Wipfkea-Regal und ein Wipfkea-Tisch nehmen Deko (Vase, Teekanne,
      Kerze, Bücherstapel, Nussschale) auf der Oberfläche auf statt am Boden.
- [ ] Ein Wipfkea-Sofa und ein bestehendes Sofa stehen gleichzeitig im selben
      Raum, ohne sich zu überlappen; ein Screenshot beider zusammen liegt vor.
- [ ] Ein Spielstand, der vor der Änderung geschrieben wurde, lädt fehlerfrei
      und unverändert; kein bestehendes Möbel sieht anders aus.
- [ ] Ein Spielstand mit den vier neuen ids übersteht Neuladen und zeigt die
      Möbel an derselben Stelle wieder.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
- [ ] `version.js` ist unverändert; es gibt keinen `chore(release)`-Commit.
