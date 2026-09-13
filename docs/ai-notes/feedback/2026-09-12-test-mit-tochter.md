# Feedback-Triage — Test mit Tochter, 12.09.2026

status: abgeschlossen — Block A ausgeliefert (v0.4.0/v0.5.0), Block B und C angelegt, Rückfrage beantwortet
Quelle: Telegram-Notizen 11:42–16:21 + 1 Screenshot
Repo-Stand: v0.2.0 (+ Branch `feat/dach-treppe-und-feinschliff` offen für #6–#9)

## Hinweis zu Topics

Das Repo hat noch **keine `area:*`-Labels** und `TODO.md` hat nur generische
Abschnitte (`Geplant`, `Erledigt`, `Gefunden beim Aufräumen`). Die Topics unten
sind daher an der **Domänensprache des Spiels** verankert (Katalog, Dach,
Einrichten, Tiere, Umgebung, Turm, Fotos, UI) und wären als Labels neu anzulegen.

## Triage

| # | Notiz (kurz) | Att. | Topic | Art | Disposition | Begründung |
|---|---|---|---|---|---|---|
| 01 | Toasts bleiben offen, schliessbar per X oder Klick | | ui | Verbesserung | Issue | Zwei Notizen (11:42 Tipp-Toast, 12:01 alle Toasts) — die zweite verallgemeinert die erste. `toast()` blendet hart nach 2800 ms aus. |
| 02 | Möbelfarbe wählen | | einrichten | Neu | Issue | Existiert nicht; Möbel haben feste Materialien aus `MAT`. |
| 03 | Wand-Objekte: zuerst Wand wählen, dann platzieren | | einrichten | Verbesserung | Issue | Heute landet ein Wand-Objekt immer an der Rückwand (`wallZ`). Nicht dasselbe wie #8 (Tab-Sprung). |
| 04 | Pool hat Deckel, kein Wasser sichtbar — **soll aussehen wie im Buch** | 2 | dach | Verbesserung (bug) | Issue | Modell `pool` in `models.js`. Buch-Scan zeigt: organische Nierenform, sichtbares blaues Wasser mit Wellen, Edelstahl-Leiter, Frösche schwimmen darin. **Design mit Fable.** |
| 05 | Liegestuhl sieht komisch aus | | dach | Verbesserung (bug) | Issue | Modell `liegestuhl`, `models.js:180`. |
| 06 | Mehr Dach-Objekte: Bar, … | | katalog | Neu | Issue (gemeinsam mit 12, 19) | Drei Notizen derselben Form — ein Issue «Katalog erweitern» statt drei fast identischer. |
| 07 | Spielplatz-Objekte platzierbar/verschiebbar/drehbar | | umgebung | Neu | Issue | `makeGarden()` ist heute ein fixes Ensemble. |
| 08 | Tiere in der Wohnung verschiebbar/drehbar | | tiere | Neu | Issue | Tiere sind keine auswählbaren Objekte. |
| 09 | Kollisionserkennung Objekte ↔ Tiere | | tiere | Neu | Issue | Hängt an 08 und 11. |
| 10 | Objekte interaktiv: Fenster auf/zu, Badewanne füllen/leeren, Lampe an/aus + passende Geräusche | | einrichten | Neu | Issue | Eine Notiz, ein Feature. **Deckt die bestehende TODO-Zeile «Lampe an/aus schaltbar» ab** — die Zeile wird beim Anlegen entfernt. |
| 11 | Tiere initial in Raummitte platzieren | | tiere | Verbesserung | Issue | Heute an der Rückwand (`spawnTenant`, `game.js:561`). Sinnvoll erst mit 09. |
| 12 | Mehr Möbel: Kommode | | katalog | Neu | Issue (gemeinsam mit 06, 19) | siehe 06 |
| 13 | «Wipfkea» — IKEA-artige Möbelserie, braun/pink statt blau/gelb | | katalog | Neu | Issue | Zwei Notizen (12:00, 13:42). **Mit 26 wird Wipfkea zusätzlich ein Ort**, an dem man einkauft — dieses Issue bleibt die Möbelserie selbst. |
| 14 | Möbeldesigner / Schreinerei | | katalog | Neu | Issue | Zwei Notizen (12:00, 13:42). **Mit 26 bekommt die Schreinerei einen Ort**; dieses Issue bleibt der Designer selbst. |
| 15 | «Wie Spielstand speichern?» | | — | — | **Rückfrage** | Unklar: Export/Import, mehrere Spielstände, oder geräteübergreifend? Ich rate nicht. |
| 16 | First-Person: Umland, Treppen, Wohnungen, Dachterrasse begehbar | | turm | Neu | Issue | Sehr gross — eigene Kamera-/Steuerungsschicht. |
| 17 | Else Elster befüllt den Pool mit dem Eimer | | umgebung | Neu | Issue | Else trägt den Eimer schon, fliegt aber nur im Kreis. |
| 18 | Auf den Bach klicken → Splashdown starten, danach zurück | | umgebung | Neu | Issue | Repo-übergreifend (`game-splashdown`). |
| 19 | Spass-Objekte: Ball, Kuscheltier, Dartscheibe, Tischkicker | | katalog | Neu | Issue (gemeinsam mit 06, 12) | siehe 06 |
| 20 | Fotogalerie: alle herunterladen | | fotos | Neu | Issue | Einzel-Download kam in v0.2.0; «alle» fehlt. |
| 21 | 10 / 20 / 50 Stockwerke | | turm | Neu | Issue | `MAXF = 10` ist hart verdrahtet und `TENANTS` hat genau 11 Einträge. |
| 22 | Räume mit Einrichtung kopieren | | einrichten | Neu | Issue | |
| 23 | Aussichtsturm Sisslerfeld (plattform-sisslerfeld.com) | | welt | Neu | Issue (Teil von 26) | War als reine Referenz notiert; mit 26 wird daraus **ein Ort im Walddorf**. |
| 25 | Terrassenhäuschen auf dem Dach platzierbar | 2 (geteilt mit 04) | dach | Neu | Issue | Aus demselben Buch-Scan: kleines Häuschen mit grünem Schilfdach auf der Dachterrasse. **Design mit Fable.** |
| 26 | **Walddorf mit Übersichtskarte**: mehrere Orte im Wald, je ein Wipfelkratzer; Orte für Schreinerei, «Wipfkea» und Aussichtsplattform | | welt | Neu | Issue | Grösster Brocken im Batch — verwandelt das Spiel von einem Turm in eine kleine Welt. Klammert 13, 14 und 23. Braucht eigenes Brainstorming vor jedem Spec. |
| 27 | Jahreszeiten | | umgebung | Neu | Issue | Verwandt mit der bestehenden TODO-Zeile «Wetter (Regen, Wind, Schnee)» — Wetter bleibt separat, Jahreszeiten sind die grössere Klammer (Laub, Schnee, Farben). |
| 24 | Bewohner-Namen klingen in der Sprechblase komisch | 1 | tiere | Verbesserung (bug) | Issue | **Verifiziert:** `TENANTS[].name` mischt Wohnungs-Bezeichnungen («Kindergarten und Partyraum», «Ferienwohnung für Hausmäuse») mit Bewohner-Namen («Lisa Feldmaus»). Die Sprechblase setzt `<b>name</b> + Status` → «Kindergarten und Partyraum ist glücklich und zufrieden!». |

## Prozess-Entscheid (gilt für diesen Batch und weiter)

**Neue Designelemente werden mit Fable umgesetzt** — also die visuell/ästhetisch
getriebenen Einträge (04 Pool, 05 Liegestuhl, 25 Terrassenhäuschen, 13 Wipfkea,
und die Modelle aus 06/12/19). Logik-, Interaktions- und Refactoring-Einträge
laufen wie bisher.

## Raw notes

Siehe Chatverlauf 12.09.2026 11:42–16:21. Zuordnung:

- 11:42 Tipp-Toast [#01], Möbelfarbe [#02], Wand-Objekte [#03]
- 11:53 Pool [#04], Liegestuhl [#05], mehr Objekte/Bar [#06]
- 11:54 Spielplatz [#07]
- 11:55 Tiere verschiebbar [#08], Kollision [#09]
- 11:56 Interaktion + Geräusche [#10]
- 11:58 Tiere Raummitte [#11]
- 12:00 Kommode [#12], IKEA [#13], Möbeldesigner [#14]
- 12:00 Spielstand [#15]
- 12:01 alle Toasts [#01]
- 12:06 First Person [#16]
- 12:07 Else/Pool [#17]
- 12:09 Bach → Splashdown [#18]
- 12:10 Spass-Objekte [#19]
- 12:12 Galerie alle herunterladen [#20]
- 13:42 Wipfkea [#13], Möbeldesigner/Schreinerei [#14]
- 13:43 Stockwerke [#21]
- 13:44 Räume kopieren [#22]
- 16:21 Sisslerfeld [#23]
- Walddorf/Übersichtskarte [#26], Orte Schreinerei/Wipfkea/Aussichtsplattform [#26, #13, #14, #23]
- Jahreszeiten [#27]
- Screenshot Sprechblase [#24]
- Foto Buchseite Dachterrasse (Pool + Häuschen) [#04, #25]
- «Solche neuen Designelemente sollen mit Fable umgesetzt werden» → Prozess-Entscheid oben

## Freigabe 12.09.2026

Block A freigegeben und angelegt:

| # | Issue |
|---|---|
| 01 | #10 fix(ui): Toasts bleiben offen und sind schliessbar |
| 03 | #11 feat(einrichten): Wand-Objekte erst nach Wandwahl platzieren |
| 04 | #12 fix(dach): Pool zeigt einen Deckel statt sichtbarem Wasser — `area:design` |
| 05 | #13 fix(dach): Liegestuhl sieht komisch aus — `area:design` |
| 11 | #14 fix(tiere): Tiere ziehen an die Rückwand statt in die Raummitte |
| 24 | #15 fix(tiere): Bewohner-Namen klingen in der Sprechblase falsch |

## Freigabe 13.09.2026

Block B nachträglich freigegeben und angelegt:

| # | Issue |
|---|---|
| 02 | #34 feat(einrichten): Möbelfarbe auswählen |
| 20 | #33 feat(fotos): alle Fotos auf einmal herunterladen |

Ausserhalb des Batches am selben Tag dazugekommen:

| Quelle | Issue |
|---|---|
| Meldung 13.09. | #35 fix(turm): der Turm hat 11 Ebenen, gezählt werden 10 |
| Notiz 13.09. | #36 feat(katalog): Instrumente als Möbel — Blockflöte, Harfe, Schlagzeug |

Block A ist vollständig ausgeliefert (v0.4.0 und v0.5.0).
Block C angelegt 13.09.2026:

| Eintrag | Issue |
|---|---|
| 06, 12, 19 | #37 feat(katalog): mehr Objekte — Bar, Kommode, Ball, Kuscheltier, Dartscheibe, Tischkicker |
| 07 | #38 feat(umgebung): Spielplatz-Objekte platzieren, verschieben, drehen |
| 08 | #39 feat(tiere): Tiere in der Wohnung verschieben und drehen |
| 09 | #40 feat(tiere): Kollisionserkennung zwischen Objekten und Tieren |
| 10 | #41 feat(einrichten): Objekte interaktiv machen — Fenster, Badewanne, Lampe |
| 13 | #42 feat(katalog): «Wipfkea» — eine eigene Möbelserie in Braun und Pink |
| 14 | #43 feat(katalog): Möbeldesigner / Schreinerei |
| 16 | #44 feat(turm): First-Person |
| 17 | #45 feat(umgebung): Else Elster befüllt den Pool |
| 18 | #46 feat(umgebung): auf den Bach tippen startet Splashdown |
| 21 | #47 feat(turm): wählbare Turmhöhe — 10, 20 oder 50 Stockwerke |
| 22 | #48 feat(einrichten): einen Raum samt Einrichtung kopieren |
| 25 | #49 feat(dach): Terrassenhäuschen mit grünem Schilfdach |
| 27 | #50 feat(umgebung): Jahreszeiten |
| 26 (klammert 13, 14, 23) | #51 feat(welt): Walddorf mit Übersichtskarte |

15 Issues aus 18 Einträgen: 06/12/19 sind zu einem geklammert, 23 geht in 26 auf.

**#44 (First-Person) und #51 (Walddorf) brauchen je ein eigenes Brainstorming
vor dem Spec** — beide sind zu gross, um aus der Notiz abgeleitet zu werden.
Das ist in beiden Issue-Bodies vermerkt.
Eintrag 15 (Spielstand) — Rückfrage am 13.09.2026 beantwortet: **mehrere
Spielstände nebeneinander** und **Export/Import als Datei**. Angelegt als:

| Issue | |
|---|---|
| #53 | feat(spielstand): mehrere Spielstände nebeneinander führen |
| #52 | feat(spielstand): Turm als Datei sichern und wieder einlesen |

#52 sinnvollerweise nach #53, sonst wird das Dateiformat zweimal gebaut. #53 und
#51 (Walddorf) brechen beide dieselbe flache Speicherstruktur auf, in
verschiedene Richtungen — gemeinsam entwerfen.

Damit ist die Triage vom 12.09.2026 vollständig abgearbeitet.
Anhänge persistiert und in die Issues eingebettet:

| Eintrag | Datei | verwendet in |
|---|---|---|
| 04, 25 | `assets/2026-09-12-test-mit-tochter/entry-04-buchseite-dachterrasse.png` (Original) und `entry-04-buchseite-ausschnitt.png` (zugeschnitten) | #12 |
| 24 | `assets/2026-09-12-test-mit-tochter/entry-24-sprechblase.png` | #15 |
