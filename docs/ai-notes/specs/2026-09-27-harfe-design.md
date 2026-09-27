# Spec — Die Harfe bekommt sichtbare Saiten (Issue #101)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js r184 über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #101, abgespalten aus #92 («Möbel skalieren und Harfe-Design
fixen»). Das Skalieren der Möbel bleibt in #92 — hier geht es **nur** um das
Aussehen der Harfe.

## Problem

Die Harfe steht seit #59 im Katalog (`js/models.js:656`). Ihr Modell
(`js/models.js:354-372`) zeichnet durchaus sieben goldene Saiten — man sieht
sie bloss nie. Zwei Fehler überlagern sich.

### 1. Die Saiten stecken im Resonanzkörper

Der Korpus ist ein Quader von `(-0.18, 0.08)` nach `(0.05, 0.95)`, **0.15
breit** (`js/models.js:365`). Die Saiten spannen von einem Punkt *auf dieser
Achse* zu einem Punkt am Hals (`js/models.js:370-371`) — sie laufen damit
fast parallel zum Korpus und liegen die meiste Zeit **in ihm drin**.

Nachgerechnet (jede Saite an 21 Punkten gegen den Korpus-Quader geprüft):

| Saite | Länge | Winkel zur Senkrechten | Anteil im Korpus |
|---|---|---|---|
| 0 | 0.65 | 14.3° | 20/21 |
| 1 | 0.60 | 15.8° | 19/21 |
| 2 | 0.55 | 17.6° | 18/21 |
| 3 | 0.51 | 19.7° | 16/21 |
| 4 | 0.46 | 22.3° | 15/21 |
| 5 | 0.41 | 25.4° | 12/21 |
| 6 | 0.37 | 29.4° | 10/21 |

Der Korpus selbst steht bei 14.8° zur Senkrechten — Saite 0 ist also
praktisch mit ihm deckungsgleich. Sichtbar bleiben ein paar Zentimeter
Saitenspitze oben am Hals. Genau das meldet die Überschrift des Issues:
**keine Saiten**.

### 2. Der Rahmen hat keinen Platz für einen Fächer

Der Hals geht von `(0.06, 0.97)` nach `(0.22, 1.15)` (`js/models.js:368`) und
setzt fast geradlinig auf dem Korpus auf: der Innenwinkel am Knoten
Korpus/Hals beträgt **158°**. Ein Saitenfächer braucht dort einen deutlichen
Knick — bei 158° ist zwischen Korpus und Hals schlicht keine Fläche, über die
Saiten spannen könnten. Selbst wenn man sie aus dem Korpus herausschöbe,
blieben sie ein Bündel nahezu paralleler Striche direkt neben dem Korpus.

Dazu kommt, dass die Zuordnung verdreht ist: die **längste** Saite hängt am
halsnahen Ende (dort, wo eine echte Harfe ihre kürzeste hat) und die
**kürzeste** an der Säule. Das ist der zweite Teil der Meldung, «sieht komisch
aus» — die Silhouette liest sich nicht als Harfe.

Fazit: Saiten nur nach vorne zu versetzen repariert das Bild nicht. Der Rahmen
muss mit.

## Entscheidungen

Ohne Rückfrage entschieden (Quick-Modus), jeweils mit der verworfenen
Alternative:

- **E1 — Der Rahmen wird neu gesetzt, das Möbel bleibt dasselbe.** `harfe()`
  in `js/models.js` wird ersetzt; `id`, Katalogeintrag, Kategorie, Name,
  Spielstand-Format und alles ausserhalb der Funktion bleiben unangetastet.
  Verworfen: nur die Saiten versetzen — bei 158° Innenwinkel entsteht dabei
  kein Fächer, sondern ein Bündel.

- **E2 — Drei gerade Seiten statt einer Rundung.** Korpus, Hals und Säule
  bleiben Quader bzw. Zylinder, wie der ganze Bilderbuch-Look des Spiels
  (`js/models.js:3-11`: ausschliesslich `MeshLambertMaterial`; alle Möbel sind
  klobige Primitive). Verworfen: eine `TubeGeometry`-Rundung für den Hals —
  hübscher, aber der einzige gerundete Freiformkörper im ganzen Katalog.

- **E3 — Sieben Saiten bleiben sieben.** Die Zahl stimmt mit dem heutigen
  Modell überein und ergibt bei der neuen Geometrie 1.5–2.7 cm Luft zwischen
  benachbarten Saiten. Verworfen: mehr Saiten für Realismus — bei 0.014
  Saitenstärke verschmelzen sie dann zu einer Fläche.

- **E4 — Die Grundfläche bleibt etwa gleich.** Breite 0.36 (heute 0.44 durch
  den Fuss), Höhe 1.22 (heute 1.26). Die Harfe belegt weiter eine Zelle, passt
  unter die Decke (`FLOOR_H = 2.0`, `js/game.js:13`) und bleibt unter der
  schmalsten Zellenbreite von ~0.95 (`js/game.js:531`). Verworfen: die Harfe
  grösser machen, damit die Saiten auffallen — das ist #92s Thema, nicht
  dieses.

## Entwurf

### Die Silhouette

Alle Koordinaten sind Punkte `[x, y]` im Seitenprofil (x-y-Ebene, z ist die
Tiefe). Der Nullpunkt liegt am Boden, die Harfe ist um x = 0 zentriert.

```
              Säulenkopf (0.18, 1.22)
   Hals ──────────╱
 (-0.18, 1.00) ╱  │
   Knoten  ╲ ╱    │  Säule (senkrecht, x = 0.18)
            ╲     │
     Korpus  ╲    │
              ╲   │
 (-0.06, 0.10) ╲  │
   ════════════════  Fuss
```

- **Korpus** — von `[-0.06, 0.10]` nach `[-0.18, 1.00]`, Länge 0.908,
  Breite 0.16, Tiefe 0.24. Er lehnt nach **hinten**, oben ist er weiter von
  der Säule weg als unten — anders als heute.
- **Hals** — vom Knoten `[-0.18, 1.00]` zum Säulenkopf `[0.18, 1.22]`,
  Länge 0.422. Der Innenwinkel am Knoten beträgt damit **113.8°** statt 158°.
  Das ist die Fläche, über die die Saiten spannen.
- **Säule** — senkrechter Zylinder bei x = 0.18, von y = 0.10 bis y = 1.22.
- **Fuss** — flacher Quader, trägt Korpusfuss und Säulenfuss.

### Die Saiten

Sieben Saiten, 0.014 × 0.014 stark, `MAT.gold`. Sie hängen nicht an den
Achsen, sondern an den **Aussenkanten**: der Saitenfuss sitzt 0.10 seitlich
neben der Korpusachse (Halbbreite 0.08 plus 0.02 Luft), der Saitenkopf 0.045
unter der Halsachse. Damit tritt keine Saite mehr in einen Körper ein.

Die Verteilung folgt der Harfenregel «gleicher Abstandsfaktor vom Knoten»:
Saite *i* hängt am Hals im Abstand *aᵢ* vom Knoten und am Korpus im Abstand
**1.70 · aᵢ**. Bei konstantem Faktor stehen alle Saiten zueinander nahezu
parallel und werden gleichmässig länger, je weiter sie zur Säule wandern —
genau das Bild einer Harfe. `aᵢ` läuft in sieben gleichen Schritten von 0.10
bis 0.38.

Nachgerechnet ergibt das:

| Saite | Fuss | Kopf | Länge | Anteil im Korpus |
|---|---|---|---|---|
| 0 | `[-0.058, 0.845]` | `[-0.071, 1.014]` | 0.170 | 0 |
| 1 | `[-0.048, 0.766]` | `[-0.031, 1.038]` | 0.273 | 0 |
| 2 | `[-0.037, 0.687]` | `[ 0.008, 1.062]` | 0.378 | 0 |
| 3 | `[-0.027, 0.609]` | `[ 0.048, 1.087]` | 0.484 | 0 |
| 4 | `[-0.016, 0.530]` | `[ 0.088, 1.111]` | 0.590 | 0 |
| 5 | `[-0.006, 0.452]` | `[ 0.128, 1.135]` | 0.697 | 0 |
| 6 | `[ 0.004, 0.373]` | `[ 0.168, 1.160]` | 0.804 | 0 |

Kleinster Abstand zwischen benachbarten Saiten: 0.015 (unten) bis 0.027
(oben) — bei 0.014 Saitenstärke bleibt überall eine sichtbare Lücke.

Die Zahlen oben sind das **Ergebnis** der Regel, nicht von Hand gesetzte
Konstanten: im Code stehen Knoten, Korpusfuss, Säulenkopf, der Faktor 1.70 und
die beiden Versätze, den Rest rechnet eine Schleife aus. Wer später die
Proportionen ändert, ändert fünf Zahlen, nicht vierzehn.

### Was gleich bleibt

- Der Helfer `bar(a, b, w, d, mat, ext)` (`js/models.js:358-361`) bleibt, wie
  er ist — er spannt einen Quader von Punkt zu Punkt und ist korrekt.
- Der Zierknauf am Säulenkopf (`sph`, `MAT.gold`) bleibt.
- Materialien: `MAT.woodD`, `MAT.wood`, `MAT.woodL`, `MAT.gold` — keine neue
  Materialinstanz, sonst wächst `matCount()`.
- `id: 'harfe'`, Katalogeintrag, Kategorie `spass`, Name «Harfe»
  (`js/models.js:656`).
- Die Harfe ist weiterhin **nicht** in `TINTABLE` (`js/models.js:59`) und
  **nicht** in `DECO` (`js/game.js:538`) — sie bleibt ein Möbel auf einer
  Zelle, verschiebbar und drehbar wie heute.
- Kein neues Feld im Spielstand. Bestehende Stände mit einer Harfe zeigen nach
  dem Neuladen einfach die neue Harfe — Position, Zelle und Drehung sind
  unabhängig vom Modell.

### Was ausdrücklich nicht dazugehört

- **Möbel skalieren** (x1.5, x2) und **Tisch/Sofa in die Länge ziehen** —
  das ist der Rest von #92 und bleibt dort.
- Ein Klang für die Harfe. Sie ist heute kein interaktives Objekt
  (`ACTIONS`, `js/game.js`), und das bleibt so.
- Blockflöte und Schlagzeug. Nur die Harfe wird gemeldet, nur die Harfe wird
  angefasst.

## Akzeptanzkriterien

- [ ] Alle sieben Saiten sind sichtbar: von einer Kamera vor der Harfe aus
      trifft ein Strahl auf jede der sieben Saiten **zuerst** die Saite selbst
      und nicht Korpus, Hals oder Säule.
- [ ] Keine Saite verläuft durch den Korpus: kein abgetasteter Punkt einer
      Saite liegt innerhalb des Korpus-Quaders.
- [ ] Die Saiten kreuzen und berühren sich nicht — benachbarte Saiten sind
      überall mindestens 0.012 voneinander entfernt.
- [ ] Der Saitenfächer läuft in die richtige Richtung: die zur Säule hin
      gelegene Saite ist die längste, die knotennahe die kürzeste, und die
      Längen wachsen dazwischen streng monoton.
- [ ] Der Innenwinkel zwischen Korpus und Hals liegt zwischen 100° und 130°.
- [ ] Der Rahmen ist geschlossen: Korpus, Hals und Säule stossen am Knoten
      bzw. am Säulenkopf ohne sichtbare Lücke aneinander (Abstand der
      Anschlusspunkte < 0.04), und Korpusfuss wie Säulenfuss stehen auf dem
      Fuss.
- [ ] Die Harfe steht auf dem Boden (`bbox.min.y` zwischen −0.01 und 0.02),
      ist höchstens 0.60 breit und 0.60 tief und höchstens 1.35 hoch — sie
      passt also weiter auf eine Zelle und unter die Decke.
- [ ] Ausschliesslich `MeshLambertMaterial`, und `matCount()` steigt durch die
      Änderung nicht.
- [ ] Das Katalog-Vorschaubild zeigt die Saiten: es unterscheidet sich vom
      bisherigen Bild und enthält sichtbar mehr Goldanteil.
- [ ] Eine Harfe aus einem bestehenden Spielstand lädt fehlerfrei, steht auf
      derselben Zelle mit derselben Drehung, lässt sich verschieben, drehen
      und entfernen — die Konsole bleibt ohne `pageerror`.
