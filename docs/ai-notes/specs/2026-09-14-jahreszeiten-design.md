# Spec — Jahreszeiten im Wald (Issue #50)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:508-516`).

Quelle: Feedback-Triage 12.09.2026, Eintrag 27 — Block C.

## Problem

Der Wald rund um den Turm sieht immer gleich aus. Gewünscht sind Jahreszeiten:
Laubfärbung, Schnee, wechselnde Farben.

Die Ausgangslage ist nicht so, wie der Issue-Text sie vermutet — das ist der
Kern dieser Spec:

1. **Die Bäume teilen sich `MAT.leaf`/`MAT.leafD` nicht.** Der Issue-Text sagt,
   ein Wechsel dort färbe alle Bäume auf einmal. Tatsächlich erzeugen
   `makeTree()` und `makeTallTree()` **pro Baum eine eigene
   `MeshLambertMaterial`-Instanz** mit individueller Farbe:

   ```js
   const lf = L(new THREE.Color().setHSL(0.28 + j * 0.06, 0.42, 0.38 + j * 0.12));  // js/models.js:377
   const lf = L(new THREE.Color().setHSL(0.27 + j * 0.07, 0.4,  0.3  + j * 0.15));  // js/models.js:387
   ```

   `j` ist ein aus dem Seed abgeleiteter Jitter (`js/models.js:375, 386`), der
   den Wald bunt-uneinheitlich macht. Es gibt 60 hohe (`js/game.js:104-115`)
   plus 22 kleine Bäume (`js/game.js:116-123`), also **82 einzelne
   Laubmaterialien**, und keine einzige Referenz darauf wird aufbewahrt — die
   Bäume werden mit `scene.add(t)` abgelegt und nie wieder angefasst
   (`js/game.js:114, 122`).

2. **`MAT.leaf`/`MAT.leafD` färben etwas ganz anderes.** Sie stecken in der
   Zimmerpflanze (`js/models.js:122-123`), in Bücherrücken
   (`js/models.js:97, 174`), im Gitarrenhals (`js/models.js:159`), in den
   Tannenzweigen der Deko (`js/models.js:184`), in der Rutsche und im
   Blumenbeet des Spielplatzes (`js/models.js:470, 480, 483`). Ein
   `MAT.leaf.color.set(...)` für den Herbst würde die Zimmerpflanze im
   Wohnzimmer mitfärben — genau die Falle, die #34 für `MAT.red` dokumentiert
   hat (`docs/ai-notes/specs/2026-09-13-moebelfarbe-design.md`, A1).

3. **Dasselbe gilt für den Bach.** Das mittlere Wasserband benutzt die geteilte
   Instanz `MAT.water` (`js/game.js:100`), und die steckt auch in der
   Badewanne (`js/models.js:117`), in der Teekanne (`js/models.js:157`) und im
   Dachpool (`js/models.js:217`). Ein zugefrorener Bach würde das Badewasser
   mit einfrieren. Zusätzlich verwirft `ribbon()` seinen Rückgabewert an der
   Aufrufstelle (`js/game.js:99-101`) — an die drei Bandmaterialien kommt man
   heute gar nicht mehr heran.

Was dagegen **schon da ist**: `applyNight(k)` (`js/game.js:873-883`) zeigt
vorbildlich, wie ein globaler Zustandswechsel in diesem Spiel aussieht — ein
Skalar, über `tween(1.2, …)` überblendet (`js/game.js:884-888`), mit
`state.night` im Spielstand (`js/game.js:35`) und einem Knopf in der
Werkzeugleiste (`index.html:165`).

## Verhältnis zum Wetter

`TODO.md:7` — «Wetter (Regen, Wind, Schnee)» — **bleibt stehen und wird nicht
entfernt.** Die beiden Dinge sind verschiedene Achsen:

- Eine **Jahreszeit** ist ein Zustand von Monaten. Sie färbt die Welt: Laub,
  Wiese, Bachfarbe, Himmelston. Sie ist statisch, sobald sie gesetzt ist, und
  sie steht im Spielstand.
- **Wetter** ist ein Zustand von Minuten. Es bewegt sich: fallende Flocken,
  Regenstreifen, Wind in den Kronen. Es ist vergänglich und muss nicht
  gespeichert werden.

Beides kann nebeneinander bestehen — Regen im Herbst, Schneefall im Winter.
Diese Spec liefert **nur die Färbung**; es gibt in ihr keine Partikel, keine
fallenden Blätter, keine Flocken. Genauso wie `applyNight` und die Dachparty
nebeneinander laufen (`js/game.js:889`), soll späteres Wetter **auf** der
Jahreszeit laufen, nicht statt ihr.

## Goals

- Ein Knopf in der Werkzeugleiste schaltet die Jahreszeit weiter; die Welt
  blendet sichtbar über — nicht springt.
- Der Wald färbt sich: im Herbst bunt, im Winter fast weiss, im Frühling
  frischer als im Sommer. Die heutige Baum-zu-Baum-Streuung bleibt dabei
  erhalten — der Wald darf nie einfarbig werden.
- Boden (Wiese) und Bach färben sich mit. Schnee auf den Bäumen bei grüner
  Wiese wäre falsch.
- Die Jahreszeit steht im Spielstand und überlebt das Neuladen — wie
  `state.night`.
- **Sommer ist pixelgleich mit heute.** Ein Spielstand ohne Jahreszeit lädt als
  Sommer und sieht exakt so aus wie vor der Änderung.
- Jahreszeit und Tag/Nacht sind unabhängig kombinierbar: eine Winternacht sieht
  aus wie eine Nacht über Schnee.
- Kein neues Material wird gegenüber heute zusätzlich erzeugt und **kein
  geteiltes `MAT` mutiert**.

## Non-goals

- **Kein Wetter** — keine Flocken, keine Regenstreifen, kein Wind (`TODO.md:7`
  bleibt offen, siehe oben).
- **Kein echtes Datum und keine Spieluhr.** Die Jahreszeit wechselt nur, wenn
  das Kind den Knopf drückt (A3).
- **Keine neue Geometrie.** Keine Schneehauben auf den Kronen, keine kahlen
  Winteräste, keine Blätter am Boden (A5).
- Keine Jahreszeit für den Turm, die Dachterrasse, die Aussentreppe, den
  Garten/Spielplatz (`js/models.js:461-485`), die Brücke oder die Biberburg —
  gefärbt wird nur, was der Issue nennt: Laub, Boden, Bach, Himmel (A6).
- Keine jahreszeitlichen Wünsche, Bewohner, Texte, Tiere oder Musikstücke.
- Keine Änderung an `MAT` (`js/models.js:4-12`), an Tapeten/Böden
  (`js/models.js:275-295`) oder an der Möbelfarbe aus #34.

## Design

### 1. Die Jahreszeit ist eine Tabelle, kein Zustandsautomat

Neu in `js/models.js`, neben `MAT`, damit sowohl die Baumfunktionen als auch
`js/game.js` daraus lesen:

```js
/* Jahreszeiten. `leaf` ist bewusst ein *Delta* auf die bestehende
   HSL-Formel der Baumkronen (js/models.js:377, 387) und nicht eine feste
   Farbe: so bleibt der Jitter pro Baum erhalten, und der Sommer ist
   nachweislich identisch mit heute (dh=0, ks=1, dl=0). */
export const SEASONS = [
  { id: 'fruehling', name: 'Frühling',
    leaf: { dh: -0.010, ks: 1.15, dl:  0.08 },
    ground: 0x9fc776, hemiGround: 0xa9c886, sky: 0xd7e9c9,
    sand: 0xc9b083, water: 0x5aa7c7, foam: 0x7fc4dd },
  { id: 'sommer', name: 'Sommer',
    leaf: { dh:  0.000, ks: 1.00, dl:  0.00 },
    ground: 0x8fbb6e, hemiGround: 0x9dbb7a, sky: 0xcfe3c2,
    sand: 0xc9b083, water: 0x5aa7c7, foam: 0x7fc4dd },
  { id: 'herbst', name: 'Herbst',
    leaf: { dh: -0.180, ks: 1.30, dl:  0.02 },
    ground: 0xa8a862, hemiGround: 0xb0a86e, sky: 0xdcd9b8,
    sand: 0xc0a679, water: 0x53929f, foam: 0x84b6c4 },
  { id: 'winter', name: 'Winter',
    leaf: { dh:  0.020, ks: 0.16, dl:  0.34 },
    ground: 0xe6ecef, hemiGround: 0xd3dde4, sky: 0xd3dbe6,
    sand: 0xe0e4e6, water: 0x9fc4d2, foam: 0xd8e6ec },
];
```

Die Sommerwerte sind **wörtlich** die heutigen Konstanten: `ground` ist
`js/game.js:84`, `hemiGround` ist `GRND.d` (`js/game.js:72`), `sky` ist `SKY.d`
(`js/game.js:70`), `sand`/`water`/`foam` sind `js/game.js:99-101` — wobei
`0x5aa7c7` exakt die Farbe von `MAT.water` ist (`js/models.js:8`). Damit ist
«Sommer ist pixelgleich mit heute» nicht behauptet, sondern abgelesen.

Der Herbstton entsteht rein über den Farbtonversatz: `0.27 + 0.07·j − 0.18`
ergibt Farbtöne zwischen 0.09 und 0.16 — Orange bis Gelb — bei gleichzeitig
1.3-fach erhöhter Sättigung. Der Winter dagegen nimmt die Sättigung auf 16 %
zurück und hebt die Helligkeit um 0.34: aus jedem Grünton wird ein leicht
unterschiedliches Schneeweiss, und der Jitter bleibt als feiner Grauverlauf
sichtbar.

### 2. Die Baumkronen bekommen ein Register

`makeTree()`/`makeTallTree()` legen ihr Laubmaterial weiterhin selbst an,
merken sich aber ihre **Basis-HSL** und tragen sich in ein exportiertes
Register ein:

```js
/* Alle Laubmaterialien des Waldes, mit ihrer Sommer-Basis in HSL. Jeder Baum
   hat seine eigene Instanz (Jitter pro Baum) — deshalb ein Register statt
   eines geteilten MAT-Eintrags. */
export const LEAVES = [];
function leafMat(h, s, l) {
  const m = L(new THREE.Color().setHSL(h, s, l));
  LEAVES.push({ mat: m, h, s, l }); return m;
}
```

`makeTree()` ruft dann `leafMat(0.28 + j * 0.06, 0.42, 0.38 + j * 0.12)`,
`makeTallTree()` ruft `leafMat(0.27 + j * 0.07, 0.4, 0.3 + j * 0.15)` — dieselben
Zahlen wie heute, nur über den Helfer.

Wichtig: `makeTree`/`makeTallTree` werden ausschliesslich beim Aufbau der Szene
gerufen (`js/game.js:113, 121`) und **nicht** für Katalog-Thumbnails —
`makeThumbs()` rendert nur `CATALOG`-Möbel, Tiere, Willi, Biberburg und Móki
(`js/game.js:544-552`). Das Register wächst also genau einmal auf 82 Einträge
und danach nie wieder.

### 3. `applySeason(q)` nach dem Vorbild von `applyNight(k)`

In `js/game.js`, unmittelbar neben Tag/Nacht:

```js
/* Jahreszeit. Gemischt wird zwischen zwei Tabelleneinträgen, genau wie
   applyNight zwischen Tag und Nacht mischt. */
let seasonFrom = seasonIndex(state.season), seasonTo = seasonFrom, seasonK = 1;
const cA = new THREE.Color(), cB = new THREE.Color();
const lerpHex = (out, a, b, q) => out.lerpColors(cA.setHex(a), cB.setHex(b), q);

function applySeason(q) {
  seasonK = q;
  const a = SEASONS[seasonFrom], b = SEASONS[seasonTo];
  lerpHex(SKY.d, a.sky, b.sky, q);
  lerpHex(GRND.d, a.hemiGround, b.hemiGround, q);
  lerpHex(ground.material.color, a.ground, b.ground, q);
  lerpHex(riverSandMat.color, a.sand, b.sand, q);
  lerpHex(riverWaterMat.color, a.water, b.water, q);
  lerpHex(riverFoamMat.color, a.foam, b.foam, q);
  const dh = a.leaf.dh + (b.leaf.dh - a.leaf.dh) * q;
  const ks = a.leaf.ks + (b.leaf.ks - a.leaf.ks) * q;
  const dl = a.leaf.dl + (b.leaf.dl - a.leaf.dl) * q;
  LEAVES.forEach(e => e.mat.color.setHSL(e.h + dh,
    Math.min(1, e.s * ks), Math.min(1, e.l + dl)));
  applyNight(nightK);          /* Himmel, Nebel und Hemisphäre neu mischen */
  $('btn-season').textContent = (q < 0.5 ? a : b).name;
}
```

**Die Arbeitsteilung zwischen Jahreszeit und Nacht ist die eine Regel, die
nicht gebrochen werden darf:** die Jahreszeit schreibt ausschliesslich die
**Tag-Endpunkte** `SKY.d` und `GRND.d` (`js/game.js:70-72`); `applyNight(k)`
mischt daraus wie bisher Himmel, Nebel und Hemisphärenlicht
(`js/game.js:875-877`). Würde `applySeason` `scene.background` direkt setzen,
überschrieben sich die beiden Überblendungen gegenseitig, sobald sie
gleichzeitig laufen. Der Trick funktioniert, weil `scene.background` und
`scene.fog.color` beim Start **Klone** von `SKY.d` sind (`js/game.js:73-74`)
und nicht dieselbe Instanz.

Der Wechsel selbst ist `setNight` nachgebildet (`js/game.js:884-888`):

```js
function setSeason(idx) {
  seasonFrom = seasonTo; seasonTo = idx;
  const from = seasonK;     /* laufende Überblendung sauber abholen */
  state.season = SEASONS[idx].id; save();
  tween(1.4, q => applySeason(from + (1 - from) * q));
  toast(SEASON_TEXT[SEASONS[idx].id]);
  sfx.whoosh();
}
```

### 4. Die drei Bachbänder bekommen eigene Materialien

`js/game.js:99-101` wird zu:

```js
/* Eigene Instanzen statt MAT.water: der Bach friert im Winter zu, das
   Badewasser (js/models.js:117), die Teekanne (:157) und der Dachpool (:217)
   aber nicht. Die Startfarben sind identisch mit heute. */
const riverSandMat  = new THREE.MeshLambertMaterial({ color: 0xc9b083 });
const riverWaterMat = new THREE.MeshLambertMaterial({ color: 0x5aa7c7 });
const riverFoamMat  = new THREE.MeshLambertMaterial({ color: 0x7fc4dd });
ribbon(5.6, 0.02, riverSandMat); ribbon(3.6, 0.045, riverWaterMat); ribbon(1.5, 0.06, riverFoamMat);
```

Das ist **eine** zusätzliche Material-Instanz gegenüber heute (`MAT.water`
wurde geteilt, jetzt hat der Bach seine eigene) — die beiden anderen wurden
schon vorher an Ort und Stelle erzeugt, nur ohne Referenz.

### 5. Oberfläche: ein Knopf, der die aktuelle Jahreszeit zeigt

Neu in `index.html` direkt hinter `#btn-night` (`index.html:165`):

```html
<button id="btn-season">Sommer</button>
```

- Der Knopf trägt den Namen der **aktuellen** Jahreszeit, nicht den der
  nächsten. Ein Tipp schaltet weiter — Frühling → Sommer → Herbst → Winter →
  Frühling — und eine Meldung sagt, was passiert ist («Jetzt ist Herbst — die
  Blätter werden bunt.»). Die Meldungen bleiben seit #10 stehen, bis sie
  weggetippt werden, und sind damit auch für ein langsam lesendes Kind
  brauchbar (`CHANGELOG.md`, 0.5.0 Fixed).
- `#toolbar` ist `flex-wrap: wrap` mit `max-width: 96vw` (`index.html:47`), und
  `--toolbar-h` wird aus der tatsächlichen Höhe nachgeführt
  (`js/game.js:476`). Ein achter Knopf bricht auf schmalen Geräten in eine
  zweite Zeile um; Katalog, Auswahlleiste und Meldungsstapel rücken
  automatisch nach (`index.html:54, 71, 126`). Das war genau die Korrektur aus
  #16 — es braucht dafür nichts Neues.
- Kein Sperrfall wie bei der Dachparty (`js/game.js:889`): die Jahreszeit lässt
  sich jederzeit umschalten, auch während einer Party.

### 6. Spielstand

`state` bekommt ein Feld `season` mit einer `SEASONS`-id, Vorgabe `'sommer'`
(`js/game.js:35`). Fehlt es (alter Stand) oder steht ein unbekannter Wert
darin, wird auf Sommer zurückgefallen und `migrated = true` gesetzt, sodass der
bereinigte Stand einmalig zurückgeschrieben wird — nach dem Muster der
Tapeten-Migration (`js/game.js:379-390`, `js/game.js:1186`).

## Assumptions

- **A1** [high] Die Baumkronen werden über ein Register einzelner
  Laubmaterialien (`LEAVES`) umgefärbt, nicht über `MAT.leaf`/`MAT.leafD`.
  Verworfen: `MAT.leaf.color.set(...)` wie im Issue-Text vorgeschlagen — die
  Waldbäume hängen gar nicht an diesen Instanzen (`js/models.js:377, 387`),
  wohl aber die Zimmerpflanze (`js/models.js:122-123`), Bücherrücken
  (`js/models.js:97, 174`), Gitarre (`js/models.js:159`), Rutsche und
  Blumenbeet (`js/models.js:470, 480, 483`). Der Wald bliebe grün, und die
  Zimmerpflanze würde orange — exakt die Falle aus #34.
- **A2** [high] Die Jahreszeit verändert nur `SKY.d` und `GRND.d`, nie
  `scene.background`, `scene.fog.color` oder `hemi.*` direkt; das Mischen
  bleibt bei `applyNight` (`js/game.js:875-877`), das am Ende jedes
  Jahreszeiten-Schrittes erneut gerufen wird. Verworfen: beide Wechsler
  schreiben dieselben Ziele — dann überschreibt eine laufende
  Nacht-Überblendung (`js/game.js:886-887`) die Jahreszeitenfarben Bild für
  Bild und umgekehrt.
- **A3** [high] Den Wechsel treibt ein **Knopf**, nicht das echte Datum und
  keine Spieluhr. Verworfen: `new Date().getMonth()` — die Jahreszeit wäre
  monatelang unveränderlich und liesse sich vom Kind weder ausprobieren noch
  zurücknehmen; genau deshalb ist auch Tag/Nacht ein Knopf
  (`js/game.js:889`). Verworfen ebenso: automatischer Wechsel nach Spielzeit —
  ein Bild, das sich ungefragt verändert, während das Kind einrichtet.
- **A4** [med] **Vier** Jahreszeiten, ein durchschaltender Knopf. Verworfen:
  nur Sommer und Winter als Umschalter wie «Tag/Nacht» — dann fällt die
  Laubfärbung weg, die im Issue-Titel an erster Stelle steht («Jahreszeiten —
  Laub, Schnee, Farben»). Frühling und Herbst kosten in dieser Lösung nur zwei
  weitere Tabellenzeilen, weil die Färbung ein Delta auf einer Formel ist und
  kein eigener Code-Pfad.
- **A5** [med] Der Winter entsteht **rein über Farbe**, nicht über Geometrie:
  entsättigte, aufgehellte Kronen statt aufgesetzter Schneehauben. Verworfen:
  Schneekappen auf die Kronen legen — bei 82 Bäumen (`js/game.js:104-123`) mit
  je drei bis vier Kugeln pro Krone (`js/models.js:378-380, 388-391`) wären das
  über 250 zusätzliche Meshes, die im Sommer sinnlos in der Szene stehen oder
  bei jedem Wechsel auf- und abgebaut werden müssten.
- **A6** [med] Garten und Spielplatz (`js/models.js:461-485`), Brücke,
  Biberburg und der Turm selbst bleiben unverändert. Verworfen: alles
  mitfärben — Spielplatz und Turm sind vom Kind gebaute Objekte, und deren
  Farbe ist Teil dessen, was es sich eingerichtet hat.
- **A7** [med] Der Knopf zeigt die **aktuelle** Jahreszeit, nicht die nächste
  (anders als `#btn-night`, das mit «Tag»/«Nacht» die Aktion beschriftet,
  `js/game.js:882`). Verworfen: die nächste Jahreszeit als Beschriftung — bei
  zwei Zuständen ist «Nacht» eindeutig, bei vier Namen ist «Herbst» auf dem
  Knopf nicht mehr von einer Zustandsanzeige zu unterscheiden. Die Meldung
  nach dem Tipp trägt stattdessen die Aktion.
- **A8** [med] Der Bach bekommt drei eigene Materialinstanzen
  (`js/game.js:99-101`), damit `MAT.water` unangetastet bleibt. Verworfen:
  `MAT.water.color.set(...)` — friert Badewanne (`js/models.js:117`),
  Teekanne (`js/models.js:157`) und Dachpool (`js/models.js:217`) mit ein.
- **A9** [low] Die Überblendung dauert 1.4 s, etwas länger als die 1.2 s von
  Tag/Nacht (`js/game.js:887`), weil deutlich mehr Flächen gleichzeitig
  wandern. Verworfen: harter Schnitt — der Issue nennt die Überblendung von
  `applyNight` ausdrücklich als Vorbild.
- **A10** [low] Das Feld heisst `season` und trägt eine `SEASONS`-id als
  String. Verworfen: ein Index — eine spätere Umsortierung der Tabelle würde
  alte Spielstände still auf die falsche Jahreszeit setzen.
- **A11** [low] Die Reihenfolge beginnt bei Frühling und läuft vorwärts durchs
  Jahr; Startzustand eines neuen Spiels ist **Sommer**, nicht Frühling.
  Verworfen: Frühling als Start — der Sommer ist der heutige Look, und ein
  frisch geladener alter Spielstand darf sich nicht verändern.

## Consequences

- **Der Sommer ist beweisbar unverändert.** Alle Sommerwerte der Tabelle sind
  aus dem heutigen Code abgeschrieben, und die Laub-Deltas sind im Sommer
  `dh=0, ks=1, dl=0` — `setHSL` schreibt dieselbe Farbe zurück, die schon
  drinsteht.
- **Eine zusätzliche Material-Instanz** im ganzen Spiel (der Bach löst sich von
  `MAT.water`). Die 82 Laubmaterialien existierten schon vorher; sie werden nur
  noch referenziert.
- **Der Wechsel kostet pro Bild 82 `setHSL`-Aufrufe** über 1.4 Sekunden. Das ist
  in derselben Grössenordnung wie die 11 Fenstergruppen, die `applyNight` heute
  pro Bild durchläuft (`js/game.js:879-881`), aber messbar mehr — auf einem
  alten Tablet kann die Überblendung leicht ruckeln.
- **Der Spielplatz passt im Winter nicht zum Rest.** Blumenbeet und Blüten
  (`js/models.js:477-484`) blühen weiter im Schnee. Das ist bewusst (A6),
  fällt aber auf, sobald Garten und Winter gleichzeitig an sind.
- **Der Dachpool bleibt im Winter blau** — er ist ein Möbel auf der Terrasse,
  kein Teil der Umgebung. Für ein Kind eher ein Feature als ein Fehler, aber
  niemand hat es bestellt.
- **Die Werkzeugleiste wird auf schmalen Geräten zweizeilig.** Das ist
  abgefangen (`js/game.js:476`, `index.html:54, 71, 126`), kostet aber
  Bildfläche im Hochformat.
- **Wetter bleibt offen und wird durch diese Änderung leichter**: ein späterer
  Flockeneffekt kann `state.season` lesen und muss keine eigenen Farbregeln
  mitbringen.
- **Die Tabelle ist der einzige Ort für Farbentscheide.** Eine fünfte
  Jahreszeit oder ein anderer Herbstton ist eine Zeile, kein neuer Code-Pfad —
  aber jeder Ton muss weiterhin von Hand gegen den Bilderbuch-Look geprüft
  werden.

## Acceptance Criteria

- [ ] Ein frisches Spiel (leerer `localStorage`) sieht exakt so aus wie vor der
      Änderung; der Knopf `#btn-season` trägt die Beschriftung «Sommer».
- [ ] Ein Tipp auf den Knopf schaltet auf «Herbst»; die Baumkronen wandern
      innerhalb von rund 1.4 s sichtbar von Grün nach Orange/Gelb, ohne Sprung.
- [ ] Im Herbst sind die Farbtöne der 82 Kronen **nicht identisch** — die
      Streuung von Baum zu Baum bleibt messbar erhalten.
- [ ] Im Winter sind Kronen, Wiese und Bach hell und entsättigt; keine Krone
      ist mehr sattgrün.
- [ ] Die Zimmerpflanze (`pflanze`) in einer eingerichteten Wohnung behält in
      **allen vier** Jahreszeiten ihr Grün — `MAT.leaf`/`MAT.leafD` wurden
      nicht mutiert.
- [ ] Das Wasser in einer platzierten Badewanne behält im Winter sein Blau —
      `MAT.water` wurde nicht mutiert.
- [ ] Vier Tipps auf den Knopf führen wieder zum Ausgangszustand; die
      Baumfarben nach der vollen Runde sind identisch mit den Farben vorher.
- [ ] Nach einem Wechsel auf Winter, Neuladen der Seite und erneutem Start ist
      es weiterhin Winter.
- [ ] Ein Spielstand ohne `season`-Feld lädt fehlerfrei als Sommer; ein
      Spielstand mit `season: "matsch"` lädt als Sommer und wird einmalig
      bereinigt zurückgeschrieben.
- [ ] Winter und Nacht lassen sich gleichzeitig einschalten, in beiden
      Reihenfolgen; das Ergebnis ist in beiden Fällen dasselbe Bild, und die
      Fenster der bewohnten Stockwerke leuchten weiterhin.
- [ ] Ein Jahreszeitenwechsel, der mitten in einer laufenden
      Tag/Nacht-Überblendung gestartet wird, endet ohne Flackern im korrekten
      Endzustand.
- [ ] Alle Materialien im Spiel sind weiterhin `MeshLambertMaterial`; die
      Gesamtzahl der Material-Instanzen in der Szene ist nach vier
      Jahreszeitenwechseln unverändert.
- [ ] `TODO.md:7` («Wetter (Regen, Wind, Schnee)») steht unverändert in der
      Datei.
- [ ] `version.js` ist unverändert bei `0.5.0`; der Changelog-Eintrag steht
      unter `## [Unreleased]`.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
