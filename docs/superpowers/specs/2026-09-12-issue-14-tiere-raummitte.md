# Spec: Tiere ziehen in die Raummitte statt an die Rückwand (Issue #14)

Repo: `freaxnx01/game-wipfelkratzer` · Branch: `main` · v0.3.0

## Problem

`spawnTenant` (`js/game.js:616-629`) setzt neu eingezogene Tiere fix an die
Rückwand: `a.position.set(..., baseY(i), -d / 2 + 0.28)` (`js/game.js:622`,
`d` aus `dims(i)`, `js/game.js:357`). Das sieht an der Wand "angeklebt" aus
und ignoriert, wo im Zimmer schon Möbel stehen — die Tiere ziehen dort ein,
sobald `tenantIn(i)` (`js/game.js:44`: `roomOf(i).length >= 3`) erfüllt ist,
unabhängig von der Möblierung.

Das Issue benennt selbst den Zielkonflikt: ein simpler Wechsel auf einen
festen Mittelpunkt tauscht "an der Wand kleben" gegen "im Tisch stehen",
weil Möbel oft genau in der Raummitte platziert wird.

## Entscheidung: Kollisions-Minimalvariante ist Teil dieses Issues

- **A1** [med] Dieses Issue trägt eine minimale Kollisionsvermeidung
  (Notlösung: freieste Stelle im Raum statt geometrischer Mittelpunkt),
  statt kosmetisch zu bleiben und ein separates Kollisions-Issue
  vorauszusetzen.
  Begründung: Es gibt aktuell **keine** Kollisionserkennung im Spiel und
  **kein** dafür offenes Issue. Ein rein kosmetischer Fix würde den im
  Issue selbst benannten Fehler eins zu eins reproduzieren (Tier im Tisch)
  und wäre beim Review nicht abnahmefähig, weil die Akzeptanzkriterien des
  Issues implizit "steht nicht mehr in Möbeln" verlangen. Die Minimalvariante
  bleibt aber bewusst klein: kein Rigid-Body-System, keine allgemeine
  Kollisionserkennung für Möbel-Platzierung (das bliebe für ein separates
  Issue, falls gewünscht) — nur ein Punktwahl-Algorithmus, der die
  vorhandene `Box3`-Bounding-Box-Technik aus `surfaceYAt`
  (`js/game.js:403-413`) für Tiere wiederverwendet.
  Rejected: Fix bleibt kosmetisch (Tiere immer exakt in Raummitte), mit
  Verweis auf ein separates, noch zu erstellendes Kollisions-Issue.
  `js/game.js:616-629` zeigt, dass `spawnTenant` heute keinerlei
  Möbelabfrage macht — ein neues Issue dafür existiert nicht und die
  Priorität dafür ist unklar; das Tier würde bis dahin weiterhin im
  Möbel stehen, was den ursprünglichen Bug nur verschiebt statt behebt.

## Lösung

Neue Funktion `tenantSpot(k)` neben `spawnTenant`: rastert das nutzbare
Raumrechteck (`dims(k)`, dieselbe Fläche wie für `cellPos`/Möbel-Zellen,
`js/game.js:357-361`) in ein kleines Gitter (5 Spalten × 3 Reihen) und
wählt den Gitterpunkt mit dem grössten Mindestabstand zu allen
bestehenden Möbel-Bounding-Boxen (`Box3.setFromObject`, wie in
`surfaceYAt`, `js/game.js:403-413`). Wand-Items (`WALL_ITEMS`) und
Deko-Objekte (`DECO`) werden dabei ignoriert — exakt dieselbe Ausnahme,
die `surfaceYAt` schon für Regal-/Tisch-Auflagen macht
(`js/game.js:407`), weil Deko meist auf Möbeln steht und keine
Bodenfläche blockiert.

Steht kein Möbel im Raum (leeres Zimmer, `boxes.length === 0`), liefert
`tenantSpot` den geometrischen Mittelpunkt zurück (Distanzscore
unendlich für jeden Punkt) — das deckt den vom Issue gewünschten
Normalfall "Tier in der Mitte" ab, sobald das Zimmer genug Möbel für den
Einzug hat, aber noch Platz in der Mitte frei ist.

`spawnTenant` ersetzt die feste `z = -d/2 + 0.28`-Position durch
`tenantSpot(i)` und zentriert die (bis zu zwei) Tiere eines
Bewohner-Eintrags um diesen Punkt, statt sie an der Wand aufzureihen.

### Warum kein feinerer Algorithmus

- **A2** [low] 5×3-Gitter (15 Kandidatenpunkte) statt kontinuierlicher
  Optimierung oder Physik-Bibliothek.
  Rejected: exakte Freiflächen-Berechnung (Polygon-Differenz Raum minus
  Möbel-Footprints). Buildless-Vorgabe verbietet neue Abhängigkeiten;
  ein Gitter reicht, weil das Spielfeld selbst klein und blockig ist
  (`colsOf`, `js/game.js:358`, nutzt ein vergleichbares Gitter für
  Möbel-Zellen) und Tiere nur eine ungefähre "freie Stelle" brauchen,
  keine exakte Passform.
- **A3** [low] Zwei Tiere eines Eintrags bleiben um den gewählten Punkt
  herum versetzt (`± 0.55` wie bisher, `js/game.js:622`), ohne eigene
  Kollisionsprüfung pro Tier.
  Rejected: pro-Tier-Kollisionsprüfung. Die zwei Tiere eines Eintrags
  stehen ohnehin nah beieinander (Familien-/Paar-Bewohner); eine
  zusätzliche Prüfung pro Einzeltier wäre Overengineering für ein
  kosmetisches Detail und witzeln würde die Minimalvariante nicht mehr
  rechtfertigen (siehe A1).

## Nicht betroffen (bewusst ausgeklammert)

- Allgemeine Möbel-Kollisionsprüfung beim Platzieren/Verschieben von
  Möbeln selbst (`clampEntry`, `js/game.js:415-426`) — bleibt wie heute
  ohne Überlappungsprüfung. Das ist ein separates, grösseres Thema
  (Möbel-Kollision generell) und nicht Gegenstand von Issue #14.
- Speicherformat: Tier-Positionen werden **nicht** persistiert.
  `tenantIn(i)` (`js/game.js:44`) wird aus der aktuellen Möblierung neu
  berechnet, und `spawnTenant` wird beim Laden für jedes Stockwerk neu
  aufgerufen (`js/game.js:1044`). Bestehende Spielstände (`localStorage`
  `wipfelkratzer-v1`) enthalten daher keine Tier-Koordinaten und
  brauchen keine Migration — sie laden unverändert weiter, und die neue
  Platzierung wird beim nächsten Laden automatisch aus der vorhandenen
  Möblierung berechnet.

## Akzeptanzkriterien

1. Tiere erscheinen beim Einzug (und beim Neuladen eines Spielstands) an
   der Stelle im Raum mit dem grössten Abstand zu vorhandenen Möbeln,
   nicht mehr fix an der Rückwand.
2. Ist das Zimmer möbliert, aber die Mitte frei, stehen die Tiere in der
   Mitte (das ursprünglich gewünschte Verhalten).
3. Ist die Mitte durch Möbel belegt, weichen die Tiere sichtbar auf eine
   freie Stelle aus statt im Möbel zu stehen.
4. Bestehende Spielstände mit bereits eingezogenen Bewohnern laden ohne
   Fehler und zeigen die Tiere an der neu berechneten Position.
5. Keine uncaught page errors (Playwright-Check).

## Verifikation (headless Playwright)

- Serve `index.html` auf einem Port aus 8951-8955, Chromium mit
  `args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"]`.
- Leeres Zimmer + 3 kleine Möbel weit auseinander platzieren → Tier
  spawnt sichtbar in Zimmer-Mitte, nicht an der Wand.
- 3 Möbel so platzieren, dass die geometrische Mitte blockiert ist →
  Tier-Bounding-Box überschneidet sich nicht mit Möbel-Bounding-Boxen
  (per `getBoundingClientRect`/Weltkoordinaten-Check im Testskript oder
  visuellem Screenshot-Vergleich).
- Bestehenden Spielstand mit `localStorage`-Fixture (Wohnung mit
  Bewohner) laden → keine uncaught errors, Tier sichtbar, nicht mehr an
  der Rückwand.
- Null uncaught page errors über den ganzen Testlauf.
