# Spec: Dach-Möbel lassen sich in die Treppenöffnung stellen (#20)

## Problem

Seit #6 (v0.3.0) hat die Brüstung der Dachterrasse an der +X-Seite eine Öffnung,
durch die die letzte Treppenflucht (`roofStairG`) ankommt. Die
Platzierungsgrenzen für Dach-Möbel wurden dabei nicht angepasst: ein Pool oder
Liegestuhl lässt sich mitten in diese Öffnung ziehen. Rein kosmetisch — es gibt
keine Laufwege-Simulation, niemand bleibt stecken — aber die Treppe mündet dann
sichtbar in ein Möbelstück statt in eine freie Ankunftsfläche.

## Ist-Zustand (Belege)

- `js/game.js:402` — `const bounds = k => ...` ist **toter Code**: im ganzen
  `js/`-Verzeichnis kommt der Bezeichner `bounds` kein zweites Mal vor
  (`grep -rn "bounds" js/*.js` → ein einziger Treffer, die Definition selbst).
  Er wird nirgends aufgerufen.
- Die tatsächliche Freiheitsgrenze für Möbel wird von `clampEntry` durchgesetzt
  (`js/game.js:415-426`), aufgerufen beim Platzieren (`js/game.js:598`),
  Verschieben (`916`, `925`, `939`, `946`) und Drehen. Für die Dachterrasse:
  `limX = ROOF_W / 2 - 0.1` (= 3.2), `limZ = ROOF_D / 2 - 0.1` (= 2.3)
  (`js/game.js:419-420`) — ein symmetrisches Rechteck ohne Aussparung für die
  Öffnung.
- Die Öffnung selbst: `ROOF_PAD_Z0 = ROOF_PAD_Z1 - ROOF_PAD_D = 2.4 - 1.0 = 1.4`
  (`js/game.js:174`), und `inRoofGap = z => z > ROOF_PAD_Z0 - 0.3` (`= 1.1`,
  `js/game.js:175`) entscheidet bereits, welche Brüstungspfosten auf der
  +X-Seite ausgelassen werden (`js/game.js:310`). Das ist die einzige
  bestehende Quelle der Wahrheit für "wo ist die Öffnung" — sie referenziert
  nur `z`, nicht `x`, weil sie für Pfosten an einer festen `x`-Position gilt.
- **Laden bestehender Spielstände ruft `clampEntry` nicht auf.** Beim Start
  passiert nur `roomOf(key).forEach(e => placeItemMesh(key, e));`
  (`js/game.js:1042`) — `placeItemMesh` (`js/game.js:427-436`) setzt Position
  und Rotation direkt aus dem gespeicherten Eintrag, ohne erneutes Clamping.
  `clampEntry` läuft nur bei Platzieren/Verschieben/Drehen im laufenden Spiel.

## Entscheidung: Ausschlusszone statt neuer Simulation

Die Öffnung wird als rechteckige Sperrzone in `clampEntry` für `k === 'roof'`
modelliert, zusätzlich zum bestehenden `limX`/`limZ`-Rechteck:

```js
const ROOF_GAP_X0 = ROOF_W / 2 - 0.9;   // Streifenbreite ab der Brüstungskante
// bestehend: const inRoofGap = z => z > ROOF_PAD_Z0 - 0.3;  (js/game.js:175)

// in clampEntry, k === 'roof', nach der bestehenden limX/limZ-Klemmung,
// vor `m.position.set(...)`:
if (en.x + hx > ROOF_GAP_X0 && inRoofGap(en.z + hz)) {
  en.z = Math.min(en.z, (ROOF_PAD_Z0 - 0.3) - hz);
}
```

- Wiederverwendet `inRoofGap`/`ROOF_PAD_Z0` als einzige Quelle der Wahrheit für
  die Z-Grenze der Öffnung (statt einer zweiten, potenziell abweichenden
  Konstante).
- `ROOF_GAP_X0` ist neu: die Pfosten-Logik kennt nur eine feste Kanten-`x`, aber
  für Möbel-Bounding-Boxen braucht es einen Streifen ab der Kante nach innen
  (~0.9 — deckt marktübliche Möbelbreiten wie Liegestuhl/Pool-Ecke ab, ohne den
  ganzen rechten Terrassenteil zu sperren).
- Bei Kollision wird nur `z` nach innen (Richtung Terrassenmitte) gezogen —
  minimale Bewegung, keine Bewegung in `x`, kein Sonderfall für Rotation
  nötig (Bounding-Box `hx`/`hz` ist bereits rotationsbewusst, siehe
  `js/game.js:421-422`).

## Bereits platzierte Möbel (bestehende Spielstände)

**Entscheidung: nudge, nicht ignorieren, nicht löschen.** Beim Laden wird
`clampEntry('roof', mesh, entry)` zusätzlich für Dach-Einträge aufgerufen,
direkt nach `placeItemMesh`:

```js
roomOf(key).forEach(e => {
  const m = placeItemMesh(key, e);
  if (key === 'roof') clampEntry('roof', m, e);
});
```

- Für die überwältigende Mehrheit der Dach-Einträge ist das ein No-Op:
  `clampEntry` klemmt nur, wenn die Position ausserhalb der (ohnehin schon
  bestehenden) `limX`/`limZ`-Grenzen oder neu in der Gap-Zone liegt.
- Ein Pool/Liegestuhl, der exakt in der Öffnung stand, wird beim nächsten Laden
  minimal nach innen (kleineres `z`) verschoben — sichtbar, aber nicht
  zerstörerisch: das Kind verliert das Möbelstück nicht, es rutscht nur aus dem
  Durchgang. Das ist konsistent mit dem bestehenden Verhalten bei Drehen/
  Verschieben, wo `clampEntry` schon heute unbemerkt nachjustiert.
- Kein Try/Catch nötig über das bestehende Muster hinaus: `clampEntry` wirft
  nicht (reine Arithmetik + `THREE.Box3` auf ein bereits erzeugtes Mesh), und
  der Aufruf steht ausserhalb des vorhandenen `try {} catch(e) {}` um
  `localStorage.getItem` (`js/game.js:36`) — er läuft immer erst *nach*
  erfolgreichem Parsen des Spielstands, verändert also das Lade-Verhalten bei
  kaputtem/leerem `localStorage` nicht.
- Automatische Katalog-Platzierung (`cellPos`, `js/game.js:359-361`) trifft die
  Gap-Zone ohnehin nicht: für `roof` ist `d = ROOF_D - 0.9 = 3.9`, Zeilen liegen
  bei `z ≈ -0.975` und `z ≈ +0.975` (`row * d/2`) — beides `< 1.1`, also nie in
  `inRoofGap`. Nur manuelles Ziehen/Drehen/Verschieben (das den vollen
  `limX`/`limZ`-Bereich ausnutzt) konnte je in die Öffnung gelangen.

## Nicht im Scope

- Keine Kollisions-/Laufweg-Simulation — das Issue nennt den Bug explizit
  kosmetisch.
- Kein Entfernen des toten `bounds` (`js/game.js:402`) als Pflichtteil dieses
  Fixes — siehe Entscheidung A2 unten.
- Keine Änderung an `cellPos`/`freeCell` (automatische Erstplatzierung ist
  bereits ausserhalb der Gap-Zone, siehe oben).

## Akzeptanzkriterien

- Neues Platzieren, Ziehen, Drehen oder Verschieben eines Dach-Möbels kann das
  Möbelstück nicht mehr so positionieren, dass seine Bounding-Box die
  Treppenöffnung (Brüstungslücke, +X-Seite) überlappt.
- Ein Spielstand mit einem Möbelstück, das exakt in der (alten) Öffnungszone
  lag, lädt ohne Fehler und das Möbelstück erscheint ausserhalb der Öffnung
  (nach innen verschoben), nicht verschwunden, nicht weiterhin in der Öffnung.
- `localStorage` (`wipfelkratzer-v1`) lädt in jedem Fall weiter, auch bei
  fehlendem/leerem/kaputtem Eintrag — kein neuer Fehlerpfad, kein `throw`.
- Kein uncaught page error im headless-Playwright-Lauf (leeres Terrassen-Setup,
  volle Terrasse, Terrasse mit Alt-Spielstand in der Gap-Zone).

## Entscheidungen (unaided)

- **A1** [high] `bounds` (`js/game.js:402`) ist toter Code und nicht die
  tatsächlich wirksame Platzierungsgrenze. Das Issue zitiert `bounds` als
  Stelle des Fixes, aber `grep -rn "bounds" js/*.js` zeigt nur die Definition,
  nirgends einen Aufruf. Die real wirksame Grenze ist `clampEntry`
  (`js/game.js:415-426`, insbesondere `limX`/`limZ` für `k === 'roof'` in
  Zeile 419-420). Der Fix muss dort ansetzen, nicht in `bounds`.
  Rejected: `bounds` unverändert lassen und einen Fix daneben schreiben, der
  nie ausgeführt wird — würde das Issue technisch "beheben" ohne
  Wirkung im Spiel.

- **A2** [med] Das tote `bounds` wird in diesem Fix **nicht entfernt** — nur
  als Beobachtung dokumentiert (optionale Aufräum-Task im Plan, nicht
  AC-relevant). Rejected: `bounds` im selben PR löschen — spart eine Zeile,
  vergrössert aber den Diff eines kosmetischen Ein-Zeilen-Fixes und bindet ihn
  an eine Entscheidung (toten Code entfernen vs. für später aufheben), die der
  Issue-Owner nicht explizit angefragt hat.

- **A3** [med] Für Alt-Spielstände: **nudge nach innen** (kleineres `z`) statt
  ignorieren oder Möbel entfernen. Rejected (ignorieren): würde den Bug, den
  das Issue beschreibt ("Treppe mündet in Pool"), für jeden bereits gespeicherten
  Spielstand unverändert bestehen lassen — der Fix griffe nur für neue
  Platzierungen. Rejected (entfernen): ein Kind verliert dadurch sichtbar ein
  Möbelstück, das es bewusst dorthin gestellt hat — unverhältnismässig für
  einen als "kosmetisch" markierten Bug ohne Gameplay-Konsequenz.

- **A4** [low] Streifenbreite `ROOF_GAP_X0 = ROOF_W / 2 - 0.9` ist eine neue,
  freihändig gewählte Konstante (kein bestehender Wert deckt sie exakt ab).
  Rejected: dieselbe Breite wie `limX`-Rand (`0.1`) verwenden — das würde nur
  den unmittelbaren Rand sperren, ein Liegestuhl mit ~1m Breite könnte
  trotzdem noch teilweise in der Öffnung stehen.
