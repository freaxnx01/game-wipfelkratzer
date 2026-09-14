# Spec — Else Elster befüllt den Pool mit dem Eimer (Issue #45)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:508-516`).

Quelle: Feedback-Triage 12.09.2026, Eintrag 17 — Block C.

## Problem

Else Elster trägt einen roten Eimer am Bauch (`js/models.js:407-409`) und
fliegt damit eine reine Dekorationsschleife: eine Kreisbahn um den Turm,
jeden Frame neu aus Winkel und Radius gerechnet
(`js/game.js:1204-1207`):

```js
const mr = 10 + state.floors * 0.4, ma = t * 0.3;
const mh = topY() + 2.6 + Math.sin(t * 0.7) * 0.4;
const nx = Math.cos(ma + 0.08) * mr, nz = Math.sin(ma + 0.08) * mr;
magpie.position.set(Math.cos(ma) * mr, mh, Math.sin(ma) * mr);
magpie.lookAt(nx, mh, nz);
```

Der Eimer hat damit keinen Zweck. Gleichzeitig gibt es seit #12 erstmals eine
echte Wasserfläche im Spiel: `FURN.pool()` (`js/models.js:214-226`) zeichnet
eine nierenförmige Wanne mit einer **fest** auf 0.29 hochgezogenen
Wasserplatte, Wellenlinien und zwei Fröschen. Der Pool ist also immer voll,
vom ersten Frame an.

Drei Dinge machen die Aufgabe nicht trivial:

1. **Der Pool kennt keinen Füllstand.** `poolSlab(g, water, null, 0.29,
   MAT.water, 0)` (`js/models.js:217`) ist ein starrer Extrusionskörper; die
   Wellen und die beiden Frösche hängen in `surf` fest auf `y = 0.29`
   (`js/models.js:218-220`).
2. **Die Flugbahn ist ein Kreis, kein Weg.** Bach → Dach → zurück lässt sich
   nicht als Parameter an `Math.cos(ma) * mr` anhängen. Es braucht eine
   zweite, wegbasierte Bewegungsart neben der bestehenden Kreisbahn.
3. **Der Pool ist ein gewöhnliches Katalog-Möbel.** Er wird über `addItem()`
   (`js/game.js:680-711`) auf `roof` gesetzt, lebt als Eintrag in
   `state.rooms.roof` und kann jederzeit mit `#btn-del` wieder gelöscht werden
   (`js/game.js:713-719`). Er hängt an `roofG`, dessen Höhe sich mit jedem
   neuen Stockwerk ändert (`js/game.js:353`).

## Goals

- Else fliegt sichtbar vom Bach zum Pool auf der Dachterrasse, kippt dort den
  Eimer aus und kehrt zum Bach zurück — in einer Schleife, bis der Pool voll
  ist.
- Der Pool **startet leer** und füllt sich in mehreren erkennbaren Schritten
  (A1, A2). Ein Kind sieht den Zusammenhang Eimer → Wasserstand.
- Der Füllstand überlebt Neuladen (Teil von `state.rooms.roof`).
- Ist der Pool voll, kehrt Else auf ihre heutige Kreisbahn zurück — pixelgleich
  zum jetzigen Verhalten.
- **Alte Spielstände mit einem Pool zeigen ihn weiterhin voll** (A3). Niemandem
  läuft beim Update das Wasser aus.
- Die Frösche schwimmen erst, wenn Wasser da ist (A6).
- Bilderbuch-Look bleibt: nur `MeshLambertMaterial`, bestehende `MAT`-Töne,
  keine neuen Farbwerte, keine neuen Abhängigkeiten.

## Non-goals

- **Keine Physik und keine Partikel.** Kein Wasserstrahl-System, keine
  Tropfen-Simulation; das Ausgiessen ist eine Kipp-Animation am bestehenden
  Eimer plus `sfx.splash()` (`js/game.js:953`).
- **Keine Steuerung durch das Kind.** Else lässt sich nicht antippen, nicht
  anhalten, nicht schneller machen. Sie ist Umgebung, kein Werkzeug (A9).
- Keine Änderung an der Wunsch-Logik: der Froschwunsch gilt weiterhin in dem
  Moment als erfüllt, in dem der Pool platziert wird (`js/game.js:771-780`,
  A5).
- Keine zweite Wasserquelle. Geschöpft wird ausschliesslich am Bach
  (`riverZ`, `js/game.js:86`), in der Nähe von Willis Biberburg
  (`js/game.js:102`).
- Kein Leerlaufen, kein Verdunsten, kein Nachfüllen nach dem Vollwerden.
- Keine Änderung an `makeDam`/`makeBridge` und keine neue Trefferfläche am
  Bach — das ist Issue #46.
- Keine Animation der Frösche (Springen, Tauchen). Sie erscheinen, mehr nicht.

## Design

### 1. Der Pool bekommt einen Füllstand — als Regler, nicht als Neubau

`FURN.pool()` (`js/models.js:214`) baut weiterhin **genau dieselbe Geometrie**
wie heute und hängt zusätzlich einen Setter an die Gruppe:

```js
pool() { const g = G();
  const outer = poolOutline(), lining = poolInset(outer, 0.07), water = poolInset(outer, 0.11), rim = poolInset(outer, -0.04);
  poolSlab(g, outer, lining, 0.36, MAT.wood, 0); poolSlab(g, lining, water, 0.36, POOL_TILE, 0);
  const wat = poolSlab(g, water, null, 0.29, MAT.water, 0);
  poolSlab(g, rim, water, 0.06, MAT.woodL, 0.36);
  const surf = G(); g.add(surf); surf.position.y = 0.29;
  [[0.05, -0.05, 0.06, 0.15], [0.14, 0.22, 0.055, -0.2], [-0.15, 0.2, 0.05, 0.3], [0.4, -0.22, 0.04, 0.1]].forEach(([x, z, r, a]) => poolRipple(surf, x, z, r, a));
  const frogs = G(); surf.add(frogs);
  poolFrogSwimming(frogs, -0.36, -0.02, 0.9); poolFrogPeeking(frogs, 0.4, 0.12, -0.4);
  /* ... Leiter unverändert ... */
  /* Füllstand 0..1. Die Wasserplatte ist um -PI/2 um x gedreht, ihre
     Extrusionsachse (lokal +z) zeigt damit nach oben — Skalieren in z hebt
     und senkt den Wasserspiegel, ohne die Kontur zu verzerren. */
  g.userData.setFill = f => {
    f = Math.max(0, Math.min(1, f));
    wat.visible = f > 0.001;
    wat.scale.z = Math.max(f, 0.001);
    surf.position.y = 0.29 * f;
    surf.visible = f > 0.2;
    frogs.visible = f >= 0.999;
  };
  g.userData.setFill(1);
  return g; }
```

Warum Skalieren statt Neubau: das Mesh der Auswahl bleibt dasselbe, der
`BoxHelper` der Auswahl (`js/game.js:673`) muss nicht umgehängt werden, es
entstehen keine neuen Geometrien pro Eimer, und `placeItemMesh()`
(`js/game.js:451-466`) bleibt der einzige Ort, der Möbel-Meshes baut.

Die Drehachse ist nachgerechnet: `poolSlab` setzt `m.rotation.x = -Math.PI/2`
(`js/models.js:43`); mit `Rx(-90°)` geht lokal `+z` nach global `+y`. Die
Extrusionstiefe wächst also nach oben, und `scale.z` ist exakt der
Wasserspiegel.

`g.userData.setFill(1)` am Ende hält alle **bestehenden** Aufrufer bei
unverändertem Bild — insbesondere die Katalog-Thumbnails (`js/game.js:541`),
die `makeFurniture('pool')` ohne Zusatzwissen aufrufen. Ein Thumbnail zeigt
den vollen Pool; das ist das Bild, das im Katalog verkauft wird (A4).

### 2. Spielstand: ein optionales `fill` am Pool-Eintrag

`state.rooms.roof[i]` bekommt für `id === 'pool'` ein optionales Feld `fill`:
eine **ganze Zahl 0..POOL_TRIPS**, die Anzahl bereits abgelieferter Eimer.

| Fall | `fill` | angezeigt |
| --- | --- | --- |
| Alter Spielstand (Feld fehlt) | `undefined` | voll (A3) |
| Frisch platziert | `0` | leer |
| Nach dem 1. Eimer | `1` | ein Drittel |
| Voll | `3` | voll, Frösche da |

Regeln, nach dem Vorbild der bestehenden Normalisierung (`js/game.js:379-390`,
`js/game.js:1186`):

```js
const POOL_TRIPS = 3;
/* Füllstand eines Pool-Eintrags als Bruch 0..1. Ein fehlendes Feld heisst
   "voll" — alte Spielstände wurden mit einem stets vollen Pool geschrieben
   (#12) und dürfen ihn nicht verlieren. */
const poolFill = en => en.fill === undefined ? 1 : Math.max(0, Math.min(POOL_TRIPS, en.fill | 0)) / POOL_TRIPS;
```

`placeItemMesh()` ruft nach dem Bauen `m.userData.setFill?.(poolFill(entry))`
auf — der optionale Aufruf trifft nur den Pool, alle anderen Möbel haben
kein `setFill`. `addItem()` (`js/game.js:686`) setzt für `id === 'pool'`
`entry.fill = 0`.

### 3. Else bekommt einen Zustandsautomaten statt einer Kreisformel

Die Kreisbahn bleibt **wörtlich** erhalten und wird zur Ruhephase. Daneben
tritt ein Botengang aus drei Abschnitten:

| Phase | Bedeutung | Dauer |
| --- | --- | --- |
| `kreis` | heutige Kreisbahn (`js/game.js:1204-1207`), unverändert | bis ein leerer Pool da ist |
| `holen` | von der aktuellen Position zum Schöpfpunkt über dem Bach | 3.2 s |
| `schoepfen` | Sinkflug, Eimer taucht ein, Wasser erscheint im Eimer | 1.0 s |
| `bringen` | Schöpfpunkt → über den Pool | 3.6 s |
| `giessen` | Eimer kippt, `sfx.splash()`, Füllstand steigt um 1 | 1.2 s |

Nach `giessen` beginnt entweder der nächste Botengang (`holen`) oder — wenn
der Pool voll ist bzw. verschwunden ist — der Rückweg in die Kreisbahn
(`kreis`). Ein Botengang dauert damit rund 9 s, ein voller Pool rund 27 s.
Langsam genug, dass ein Kind mitkommt (A8).

**Bewegung entlang eines Wegs, nicht auf einem Kreis.** Jeder Abschnitt ist
eine `THREE.CatmullRomCurve3` aus drei Punkten — Start, ein überhöhter
Zwischenpunkt, Ziel —, die über eine geglättete Zeit `k = k*k*(3-2*k)`
abgefahren wird, genau wie die bestehenden Tweens (`js/game.js:1172-1174`).
Die Blickrichtung kommt aus einem zweiten Kurvenpunkt kurz vor dem aktuellen,
nicht mehr aus `lookAt` auf den nächsten Kreispunkt:

```js
const p = curve.getPointAt(k), q = curve.getPointAt(Math.min(k + 0.02, 1));
magpie.position.copy(p); magpie.lookAt(q);
```

Die Zwischenpunkte werden pro Abschnitt **einmal** beim Phasenwechsel
berechnet, nicht pro Frame — der Pool wandert mit `roofG` nach oben
(`js/game.js:353`), steht aber während eines Abschnitts still.

**Schöpfpunkt.** Über dem offenen Wasser flussabwärts von Willis Biberburg,
die an `(-7, 0, riverZ(-7) - 1.2)` steht (`js/game.js:102`):
`SCOOP = { x: -3.4, z: riverZ(-3.4) }`, Reiseflughöhe `y = 3.2`,
Schöpfhöhe `y = 0.75`. Damit ist der Bach die sichtbare Quelle, ohne dass Else
in der Burg verschwindet.

**Poolziel.** Weltposition des Pool-Meshes über
`mesh.getWorldPosition(v)` (`roofG` muss vorher
`updateWorldMatrix(true, false)` gesehen haben, wie in `js/game.js:416`
bereits gemacht), plus `y + 1.1`.

**Rückweg in den Kreis.** Die Kreisbahn ist zeitparametrisiert
(`ma = t * 0.3`) und hat deshalb keinen Einstiegspunkt, der zu Elses
Endposition passt. Beim Wechsel zurück nach `kreis` wird einmalig ein Versatz
`maOffset` gesetzt, sodass der Kreiswinkel an Elses aktueller Position
ansetzt; die Formel bleibt sonst identisch:

```js
const ma = t * 0.3 + maOffset;
```

Solange Else nie einen Botengang geflogen ist, ist `maOffset === 0` und die
Bahn ist Frame für Frame die heutige.

### 4. Der Eimer bekommt Wasser und eine Kippachse

`makeMagpie()` (`js/models.js:395-412`) legt die Eimergruppe bereits an
(`js/models.js:407-409`), gibt sie aber nicht heraus — nur `wings`
(`js/models.js:411`). Neu:

```js
const water = cyl(bucket, 0.075, 0.06, 0.02, MAT.water, 0, 0.04, 0, 14);
water.visible = false;
g.userData.bucket = bucket; g.userData.bucketWater = water;
```

`MAT.water` ist bereits vorhanden und wird auch vom Pool benutzt
(`js/models.js:217`) — kein neuer Farbwert.

Kippen beim Giessen: `bucket.rotation.z` von 0 auf `-2.2` und zurück, über
dieselbe geglättete Zeitrampe wie die Flugabschnitte. Das Wasser im Eimer wird
zur Hälfte der Kippbewegung unsichtbar; im selben Moment steigt der Füllstand
des Pools und `sfx.splash()` spielt.

### 5. Wann fliegt sie? — sobald ein Pool da ist, der Wasser braucht

**Auslöser:** in `roomOf('roof')` steht ein Eintrag mit `id === 'pool'` und
`fill < POOL_TRIPS`. Sonst nichts (A7).

Kein Gate auf `state.floors === MAXF`. Der Pool ist über den Katalog-Tab
«Dach» jederzeit platzierbar, und die Dachterrasse ist ab dem ersten
Stockwerk sichtbar (`js/game.js:353` setzt `roofG.visible = true`
bedingungslos). Ein Kind, das den Pool auf einen halbhohen Turm stellt und
dann nichts passieren sieht, lernt den Zusammenhang gerade **nicht** — das
Gegenteil dessen, was das Issue will.

Abbruch: wird der Pool während eines Botengangs gelöscht (`js/game.js:713`),
fliegt Else den laufenden Abschnitt zu Ende und geht danach in `kreis`. Kein
Sprung, kein Teleport.

### 6. Rückmeldung an das Kind — genau zwei Meldungen

Meldungen bleiben seit #10 stehen, bis sie weggetippt werden
(`js/game.js:486-497`). Eine Meldung pro Eimer würde einen Stapel hinterlassen.
Deshalb exakt zwei pro Pool:

- beim Start des ersten Botengangs: «Else holt Wasser für den Pool!»
- beim letzten Eimer: «Der Pool ist voll — Piet und Jan können baden!»,
  zusammen mit `sfx.chime()`.

`sfx.splash()` spielt bei **jedem** Eimer (`js/game.js:953`). Der bisherige
Splash beim Platzieren des Pools (`js/game.js:778`) entfällt — er würde zu
einem leeren Becken gehören (A5).

### 7. Speichern

Nach jedem Eimer `save()` (`js/game.js:37-42`). Der 300-ms-Debounce ist hier
unkritisch, weil zwischen zwei Eimern rund 9 s liegen.

### 8. Prüf-Haken

`window.wipfelkratzer` (`js/game.js:1188`) bekommt zwei Ergänzungen, damit die
Playwright-Prüfung nicht 27 s pro Lauf warten muss:

- `get magpiePhase()` — der Name der aktuellen Phase.
- `MAGPIE_DUR` — das Dauern-Objekt aus Abschnitt 3, beschreibbar. Ein Test
  setzt alle Dauern auf 0.12 und sieht drei Botengänge in gut zwei Sekunden.

Das ist eine Testnaht, kein Spielfeature: der Produktivpfad liest dieselben
Werte, die Voreinstellung ist unverändert.

## Assumptions

- **A1** [high] Der Pool startet **leer**, wenn er neu platziert wird
  (`entry.fill = 0` in `addItem()`, `js/game.js:686`). Verworfen: Pool bleibt
  immer voll und Else giesst nur symbolisch nach — dann bleibt der Eimer
  weiterhin Dekoration, also genau das Problem aus dem Issue-Text.
- **A2** [med] Drei Eimer füllen den Pool (`POOL_TRIPS = 3`), also drei
  sichtbare Stufen des Wasserspiegels. Verworfen: (a) ein einziger Eimer —
  der Zusammenhang ist dann ein Einzelereignis, das man verpasst, wenn man
  gerade woanders hinschaut; (b) acht bis zehn Eimer — bei ~9 s pro Botengang
  wären das über eine Minute, in der nichts anderes passiert.
- **A3** [high] Ein Pool-Eintrag **ohne** `fill` gilt als voll. Verworfen:
  fehlendes Feld als 0 lesen — dann steht nach dem Update jeder bereits
  gebaute Pool leer da, obwohl das Kind ihn nie geleert hat, und der schon
  erfüllte Froschwunsch passt nicht mehr zum Bild.
- **A4** [low] Das Katalog-Thumbnail zeigt den Pool **voll**
  (`js/game.js:541` ruft `makeFurniture('pool')`, `setFill(1)` ist der
  Default). Verworfen: leeres Thumbnail — im Katalog steht, was man bekommt,
  und «Pool» ist ein Becken mit Wasser.
- **A5** [med] Der Froschwunsch gilt weiterhin beim **Platzieren** als erfüllt
  und bringt sofort +3 Haselnüsse (`js/game.js:774-779`); nur der
  `sfx.splash()` an dieser Stelle (`js/game.js:778`) wandert zum Giessen.
  Verworfen: Wunsch erst beim vollen Pool erfüllen — dann lägen ~27 s
  zwischen der Handlung des Kindes und der Belohnung, und bereits erfüllte
  Wünsche in alten Spielständen müssten künstlich wieder geöffnet werden.
- **A6** [med] Die beiden Frösche erscheinen erst bei vollem Pool, die
  Wellenlinien schon ab etwa einem Fünftel Wasserstand
  (`js/models.js:218-220`). Verworfen: Frösche immer sichtbar — zwei Frösche,
  die in einem trockenen Becken schwimmen, sind genau die Art Bild, die dem
  Spiel den Zauber nimmt.
- **A7** [med] Der Botengang beginnt, sobald irgendein Pool auf dem Dach
  Wasser braucht — unabhängig davon, ob der Turm fertig ist. Verworfen: erst
  ab `state.floors === MAXF` fliegen (`js/game.js:6`, `MAXF = 10`) — der Pool
  lässt sich lange vorher platzieren, und ein Pool, bei dem sichtbar nichts
  geschieht, bricht die Ursache-Wirkung-Kette, die das Issue herstellen will.
- **A8** [low] Zeiten: 3.2 s Hinflug, 1.0 s Schöpfen, 3.6 s Rückflug, 1.2 s
  Giessen. Verworfen: doppelt so schnell — die Bewegung wird dann als
  Zappeln gelesen, nicht als Botengang.
- **A9** [low] Else lässt sich nicht antippen; sie kommt nicht in die
  Trefferliste der Interaktion (`js/game.js:1023`). Verworfen: Else als
  vierte Sprechfigur neben Willi, Móki und der Biberburg
  (`js/game.js:1023-1031`) — das ist ein eigener Wunsch und gehört nicht in
  dieses Issue.
- **A10** [med] Bei mehreren Pools auf dem Dach bedient Else den **ersten**
  nicht vollen Eintrag aus `roomOf('roof')` und arbeitet sie nacheinander ab.
  Verworfen: nur den zuletzt platzierten bedienen — dann bliebe ein früherer
  Pool für immer trocken, ohne dass erkennbar wäre, warum.
- **A11** [low] Wird der Pool mitten im Botengang gelöscht
  (`js/game.js:713-719`), fliegt Else den laufenden Abschnitt zu Ende und
  kehrt danach in die Kreisbahn zurück. Verworfen: sofortiger Wechsel — das
  ergibt einen sichtbaren Richtungssprung mitten in der Luft.
- **A12** [low] `MAGPIE_DUR` und `magpiePhase` hängen am bestehenden
  Debug-Objekt `window.wipfelkratzer` (`js/game.js:1188`), das schon für die
  Playwright-Prüfungen existiert. Verworfen: eine versteckte URL-Option — ein
  zweiter Konfigurationsweg, den niemand pflegt.

## Consequences

- **#12 wird erweitert, nicht zurückgenommen.** Die Geometrie des Pools bleibt
  Punkt für Punkt dieselbe; dazu kommt ein Regler für den Wasserspiegel. Ohne
  Aufruf von `setFill` sieht der Pool exakt aus wie seit #12.
- **Ein frisch platzierter Pool ist ~27 s lang nicht der Pool aus dem
  Katalog-Thumbnail.** Das ist gewollt (A1), aber es ist eine sichtbare
  Abweichung zwischen Thumbnail und Ergebnis.
- **Der Spielstand wächst um ein Zahlenfeld pro Pool.** Alte Stände schreiben
  nichts und bleiben gültig.
- **Der Animationsschritt wird teurer**, aber nur um ein paar
  Kurvenauswertungen pro Frame — dieselbe Grössenordnung wie der bestehende
  Móki-Wegpunktlauf (`js/game.js:1213-1218`).
- **Else ist während eines Botengangs nicht mehr auf ihrer Bahn.** Wer sie
  gewohnt am Turm kreisen sieht, findet sie zeitweise über dem Bach. Das ist
  der Punkt der Änderung, aber es verändert das ruhige Gesamtbild der Szene.
- **Zwei Meldungen pro Pool** landen im Meldungsstapel (`js/game.js:486`), der
  seit #10 stehen bleibt. Wer nie wegtippt, sammelt sie.
- **Der Splash beim Platzieren verschwindet** (`js/game.js:778`). Wer das
  Geräusch mit «Pool gebaut» verknüpft hat, hört es jetzt erst beim ersten
  Eimer.
- **Ein Kipp-Zustand am Eimer ist neu am Elster-Modell.** Wer Else später
  anders animieren will (Landen, Sitzen), muss sich zu diesem Automaten
  verhalten.

## Acceptance Criteria

- [ ] Ohne Pool auf dem Dach fliegt Else exakt die heutige Kreisbahn; Radius
      und Höhe folgen weiterhin `10 + state.floors * 0.4` bzw.
      `topY() + 2.6 + …` (`js/game.js:1204-1206`).
- [ ] Ein frisch aus dem Katalog platzierter Pool ist **leer**: keine
      sichtbare Wasserfläche, keine Wellenlinien, keine Frösche.
- [ ] Kurz nach dem Platzieren verlässt Else die Kreisbahn und fliegt zum Bach
      in die Nähe von Willis Biberburg.
- [ ] Am Bach sinkt sie hinab, der Eimer taucht ein, und danach ist im Eimer
      Wasser sichtbar.
- [ ] Über dem Pool kippt der Eimer, `sfx.splash()` spielt, und der
      Wasserspiegel im Pool steigt sichtbar um eine Stufe.
- [ ] Nach drei Eimern ist der Pool voll, die Wellenlinien liegen auf dem
      Wasserspiegel, und die beiden Frösche sind da.
- [ ] Ist der Pool voll, kehrt Else auf die Kreisbahn zurück und fliegt keinen
      weiteren Botengang.
- [ ] Genau zwei Meldungen erscheinen pro Pool: eine beim ersten Botengang,
      eine beim Vollwerden. Kein Stapel aus drei oder mehr.
- [ ] Nach Neuladen der Seite steht der Pool mit demselben Wasserstand da wie
      vor dem Neuladen, und Else setzt einen unvollständigen Pool fort.
- [ ] **Ein Spielstand mit einem Pool-Eintrag ohne `fill`-Feld (alte Struktur)
      lädt fehlerfrei, zeigt den Pool voll samt Fröschen, und Else bleibt auf
      der Kreisbahn.**
- [ ] Ein Spielstand mit `fill: 99` oder `fill: -4` lädt, wird auf den
      gültigen Bereich geklemmt und erzeugt keine Fehlermeldung.
- [ ] Wird der Pool während eines Botengangs gelöscht, fliegt Else zu Ende und
      kehrt danach in die Kreisbahn zurück — ohne Positionssprung.
- [ ] Das Katalog-Thumbnail «Pool» zeigt weiterhin den vollen Pool.
- [ ] Ein zweiter Pool auf dem Dach wird nach dem ersten ebenfalls befüllt.
- [ ] Es entstehen keine neuen Material-Instanzen: der Eimerinhalt benutzt
      `MAT.water` (`js/models.js:217`), alle Materialien bleiben
      `MeshLambertMaterial`.
- [ ] `version.js` ist unverändert; der Changelog-Eintrag steht unter
      `## [Unreleased]`.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
