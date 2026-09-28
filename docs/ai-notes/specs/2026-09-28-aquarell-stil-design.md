# Spec — Zweiter Grafikstil «Aquarell-Bilderbuch» zur Laufzeit umschaltbar (Issue #90)

Repo: `game-wipfelkratzer`. Base: `main`, v0.12.0 (`version.js:3`). Buildless
Vanilla, three.js 0.184 über Importmap (`index.html:13`). Kein Build-Schritt,
kein Test-Runner — die Abnahme ist ein Playwright-Lauf im Vordergrund
(`CLAUDE.md`, Abschnitt «Tooling & Testing»).

Quelle: Issue #90. Prototyp mit einzeln zuschaltbaren Effekten:
<https://claude.ai/artifact/45aBiqjkq1tVwF6bbXAVvo>.

> **Achtung, Zahlen im Issue-Text sind veraltet.** Das Issue wurde vor den 14
> Pull Requests geschrieben, die in v0.12.0 gelandet sind. Alle Stellenangaben
> in dieser Spec sind gegen den aktuellen `main` nachgemessen; die Tabelle in
> E4 nennt Soll und Ist nebeneinander.

## Problem

Alle 3D-Spiele des Autors sehen gleich aus: `MeshLambertMaterial` plus
Default-Beleuchtung. Der Look ist bewusst gewählt und in
`docs/design-handoff.md:15` als verbindlich festgeschrieben
(«`MeshLambertMaterial` only (no PBR…) — flat, illustrative shading»). Gesucht
ist ein **zweiter**, eigenständiger Look in Anlehnung an gezeichnete
Bilderbücher (Aquarell/Tusche), ohne dass der erste dabei verschwindet.

## Die eine harte Anforderung

**Das Kind muss mitten im Spiel zwischen beiden Looks hin- und herschalten
können.** Das ist nicht Beiwerk, das ist das Feature. Daraus folgt alles
Weitere:

- **eine** Uniform `STYLE.aquarell.value = 0 | 1` schaltet den Look
- kein Szenen-Rebuild, keine neuen Materialinstanzen, keine Neukompilierung
  ausser der, die `customProgramCacheKey` ohnehin einmal pro Variante erzwingt
- Persistenz in `localStorage`, **nicht** im Turm-JSON — ein exportierter
  Spielstand darf den Stil nicht mitschleppen
- der Schalter sitzt in der Toolbar neben Nacht/Sommer (`index.html:344-345`)

Der Prototyp schaltet seinen Stil über `rebuild()` um und wirft dabei jedes
Mesh weg. **Das Spiel darf das nicht.** Ein Turm mit zehn Stockwerken, Möbeln,
Tieren, Tapeten-UVs und laufenden Tweens (`js/game.js:1355-1356`) überlebt
keinen Rebuild, ohne dass Auswahl, Besuchsmodus und Animationen dabei
zerbrechen.

## Der zentrale Entwurfskonflikt: Prototyp ≠ Issue-Architektur

Das Issue schlägt vor, die bestehenden Lambert-Instanzen per
`onBeforeCompile` zu patchen, damit `material.type` `'MeshLambertMaterial'`
bleibt und `tools/verify_katalog.py:103` weiterhin durchläuft. **Der Prototyp
macht etwas anderes:** er ersetzt das Material vollständig durch eine
`THREE.ShaderMaterial` und rechnet die Beleuchtung selbst.

Das ist kein Detail, sondern der eigentliche Portierungsaufwand. Unter
`onBeforeCompile` bleibt Lamberts eigene Beleuchtung in der Kette; der
Form-Shading-Term des Prototyps

```glsl
float l = dot(n, normalize(vec3(-0.42, 0.78, 0.46)));   // View Space
float s = smoothstep(-0.15, 0.65, l);
col = mix(col * 0.80, col, mix(1.0, s, uForm));
```

würde also **zusätzlich** zu Hemisphere- plus Directional-Light wirken
(`js/game.js:190-194`) und das Bild doppelt abschatten.

**Entscheid (E1): der Form-Shading-Term wird nicht portiert.** Er existiert im
Prototyp nur, weil eine `ShaderMaterial` gar keine Beleuchtung hat. Was er
liefert — ein weicher, richtungsabhängiger Helligkeitsverlauf mit
`smoothstep`-Kante — liefert Lambert bereits. Der Term wird also nicht
«überlagert oder neutralisiert», sondern **von Lamberts eigener Beleuchtung
erfüllt**. Damit fällt die schwierigste Unverträglichkeit ersatzlos weg.

Alle verbleibenden Effekte des Prototyps sind **nachgelagert**: sie
multiplizieren auf die fertig beleuchtete Farbe. Die lassen sich sauber hinter
`#include <opaque_fragment>` einhängen, ohne Lamberts Lichtrechnung anzufassen.

## Was in diese Scheibe kommt — und was nicht

Der Prototyp hat **acht** einzeln schaltbare Effekte plus drei Regler. Das Kind
bekommt **einen** Schalter. Es muss also entschieden werden, was dieser eine
Schalter bedeutet.

**Entscheid (E2): Scheibe 1 liefert den Umschalter plus genau die drei Effekte,
die das Issue selbst als tragend benennt.**

| # | Effekt | Scheibe 1 | Begründung |
|---|---|---|---|
| 1 | **Randpigment** (inverses Fresnel) | ja | Der wichtigste Einzeleffekt. Reine Fragment-Rechnung, braucht nur `vNormal` und `vViewPosition`, die Lambert beide schon führt. |
| 2 | **Papierkorn** (Screen Space) | ja | Trägt den «gedruckt statt gerendert»-Eindruck. `gl_FragCoord` plus eine einmalig gemalte Canvas-Textur, kein Fetch. |
| 3 | **Tuschekontur** (Inverted Hull) + Passerversatz | ja | Macht aus «schattiert» ein «gezeichnet». Teuerster Posten (Draw Calls), deshalb nur auf Struktur. |
| 4 | Unregelmässiger Wash | nein → Folge-Issue | Braucht ein zusätzliches Objektraum-Varying im Vertex-Shader jeder Lambert-Variante. Eigener Eingriff, kleiner Gewinn. |
| 5 | Geometrie-Jitter | nein → Folge-Issue | Lässt sich **nicht** über eine Uniform schalten. Siehe E5. |
| 6 | Gemalter Hintergrund | nein → Folge-Issue | Das Issue nennt ihn selbst unter «Nicht in diesem Issue». Scheibe 1 wechselt nur die Hintergrundfarbe. |
| 7 | `ColorManagement.enabled = false` | nein | Siehe E3 — global unverträglich. |
| 8 | Die drei Regler (Konturbreite, Pigment, Korn) | nein | Ein Kind bekommt keine Shader-Regler. Die Prototyp-Defaults werden fest verdrahtet: `uWidth = 1.25`, `uEdge = 1.0`, `uGrain = 0.85`. |

Benannte Folge-Issues (beim Abschluss anzulegen, nicht hier zu bauen):
«Aquarell: unregelmässiger Wash», «Aquarell: Geometrie-Jitter»,
«Aquarell: gemalter Hintergrund», «Aquarell: Konturen auch auf Möbeln».

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründung steht jeweils dabei,
damit sie widerlegbar ist.

### E1 — Kein Form-Shading-Term (oben ausgeführt)

Lamberts eigene Beleuchtung bleibt unangetastet und **ist** das Form-Shading.

### E2 — Drei Effekte in Scheibe 1 (oben ausgeführt)

### E3 — `THREE.ColorManagement.enabled` bleibt unangetastet

Der Prototyp schaltet es global ab, um flache, gedruckte Tusche zu bekommen.
Im Spiel beträfe das **jede** bestehende Farbe — die 21 Einträge in `MAT`
(`js/models.js:4-12`), die Himmels- und Jahreszeitentabellen
(`js/game.js:197-199`), die Fensterfarben in `applyNight`
(`js/game.js:2484-2485`). Damit wäre das Akzeptanzkriterium «der bestehende
Look ist nach Rückschalten pixelgleich» sofort verletzt, und zwar
**unabhängig** davon, welcher Stil gerade aktiv ist, weil
`ColorManagement.enabled` keine Uniform ist.

Ersatz: wo der Aquarell-Look zu blass wirkt, werden die Aquarell-eigenen
Konstanten (`uEdge`, der Pigment-Faktor `0.56`, die Papierhelligkeit)
nachgezogen — nicht der Farbraum der ganzen Szene.

### E4 — Einstiegspunkt ist `L()`, und alle Umgeher werden dorthin geführt

`L()` (`js/models.js:3`) baut heute alle `MAT`-Töne und praktisch alle
Möbelmaterialien. Fünf Instanzen umgehen es und würden sonst im Aquarell-Stil
unbehandelt stehenbleiben:

| Stelle (aktuell, nachgemessen) | Issue behauptete | Was es ist |
|---|---|---|
| `js/game.js:214` | `js/game.js:190` | Boden (`CircleGeometry(70,40)`, `0x8fbb6e`) |
| `js/game.js:232-234` | `js/game.js:208-210` | `riverSandMat`, `riverWaterMat`, `riverFoamMat` |
| `js/game.js:302` | `js/game.js:278` | `matWin` (`0x6b4526`) |
| `js/models.js:968` | `js/models.js:880` | Schild-Brett mit `map: tex` |

Unverändert korrekt im Issue: `L()` selbst steht auf `js/models.js:3`, und
`tools/verify_katalog.py` prüft hart auf `MeshLambertMaterial` in **Zeile 103**
(Auswertung in **Zeile 145**).

`L()` bekommt für die Umgeher nichts Neues: `L(0x8fbb6e)` bzw.
`L(0xffffff, { map: tex })` genügen, weil `L` seine Optionen schon
durchreicht (`js/models.js:3`).

### E5 — Geometrie-Jitter fällt aus Scheibe 1 heraus, statt eingebacken zu werden

Das Issue schlägt vor, den Jitter «dauerhaft einzubacken», weil er sich nicht
über eine Uniform schalten lässt. Das ist richtig beobachtet und die falsche
Folgerung: eingebacken verändert er **sichtbar auch den bestehenden Look** und
bricht damit das eigene Akzeptanzkriterium «pixelgleich nach Rückschalten» aus
demselben Issue.

Deshalb: **Scheibe 1 liefert keinen Jitter.** Das ist ein Umfangsentscheid, kein
Ratespiel — die Alternative wäre, eine sichtbare Änderung am bestehenden Look
als Nebenwirkung eines Zusatz-Features durchzuwinken. Der Jitter wird als
eigenes Issue nachgezogen; dort ist er das Thema und kann als bewusste
Änderung am Grundlook beurteilt werden, mit Vorher/Nachher-Bild.

Wenn er später kommt, gilt die Eigenschaft des Prototyps als Vorgabe: die
Verschiebung ist ein Hash **allein der Position**, damit doppelte Vertices an
einer gemeinsamen Ecke identisch wandern und die Kiste an den Nähten nicht
aufreisst. Prototyp-Stärken zur Erinnerung: 0.085 global, Dachkegel ×0.6,
Stämme ×1.6, Boden 0.3.

### E6 — Konturen teilen die Geometrie ihres Elternmeshes

Der Hull-Versatz passiert im Vertex-Shader
(`mv.xyz += n * uWidth * wob * (-mv.z) * 0.0032`), nicht in der Geometrie. Das
Kind-Mesh referenziert deshalb **dieselbe** `BufferGeometry` wie sein Elter.
Zwei Folgen, beide erwünscht:

1. Kein zusätzlicher Geometriespeicher, keine Disposal-Frage.
2. **Der Fenstertausch aus #102 löst sich fast von selbst.** `fensterAuf`
   (`js/game.js:374-378`) und `fensterZu` (`js/game.js:380-384`) tauschen heute
   `kern.geometry` und `panel.geometry` zwischen `kernZu`/`kernOffen` bzw.
   `panelZu`/`panelOffen` (gebaut in `js/game.js:362-364`). Es kommt je eine
   Zeile dazu, die die Kontur-Kinder auf dieselbe Geometrie setzt. Kein
   Rebuild, kein Zustand, der auseinanderlaufen kann.

Die Tiefenskalierung `(-mv.z)` im Versatz hält die Strichbreite auf dem
Bildschirm konstant — die bleibt erhalten und ist der Grund, warum die Kontur
beim Zoomen nicht fett wird.

### E7 — Konturen nur auf Struktur, nie auf Möbeln

Struktur heisst: Stockwerkskörper, Dach, Stämme, Wände. Nicht: `makeFurniture`.
Zwei Gründe, ein harter und ein weicher:

- **Hart:** `tools/verify_katalog.py:99-104` traversiert den Rückgabewert von
  `makeFurniture(id)` und verwirft **jedes** Material, dessen `type` nicht
  `'MeshLambertMaterial'` ist (Zeile 103, ausgewertet in Zeile 145). Ein
  `MeshBasicMaterial`-Hull unter einem Möbel liesse die Prüfung sofort rot
  werden. Die `MeshBasicMaterial`-Instanzen, die es heute schon gibt
  (`js/game.js:209` Mond, `548`, `576`, `603` Trefferflächen), liegen in
  `game.js` — die traversiert `verify_katalog.py` gar nicht. Es gibt also
  **keine** Allowlist, auf die man sich berufen könnte; es gibt nur einen
  Prüfpfad, der Möbel sieht und `game.js` nicht.
- **Weich:** Konturen verdoppeln Draw Calls. Ein eingerichteter Zehnstöcker hat
  weit mehr Möbelmeshes als Strukturmeshes.

Ebenfalls aus `tools/verify_katalog.py:104`: jedes `mt.map` an einem Möbel ist
verboten. **Die Papiertextur ist deshalb eine eigene Uniform (`uPaper`), nicht
`material.map`** — sonst fiele die Prüfung über jedes Möbel.

### E8 — Einhängepunkt im Fragment-Shader: nach `#include <opaque_fragment>`

Dort steht die beleuchtete Farbe fertig in `gl_FragColor`, aber Tonemapping,
Farbraum und Nebel sind noch nicht drüber. Randpigment und Papier gehören vor
den Nebel: sonst überzeichnet Papierkorn die Fernsicht, die `scene.fog`
(`js/game.js:201`) gerade weich macht.

**Vor der Umsetzung ist der Chunk-Name gegen die tatsächlich geladene
three-Version zu prüfen** (0.184, `index.html:13`) — three benennt
Shader-Chunks zwischen Versionen um, und ein `replace()`, dessen Suchstring
nicht vorkommt, ist ein stiller Nulleffekt: der Shader kompiliert, sieht aber
aus wie vorher. Der Plan enthält dafür einen eigenen Prüfschritt (T4.0).

### E9 — `localStorage`-Schlüssel `wipfelkratzer-stil`, ausserhalb der Stände

Die bestehenden Schlüssel sind **pro Stand** vergeben
(`js/staende.js:22-23`: `wipfelkratzer-stand-<id>`, `wipfelkratzer-fotos-<id>`).
Der Stil ist keine Eigenschaft eines Turms, sondern eine Vorliebe des Kindes —
er gehört über alle Stände hinweg an denselben Ort und darf nie in
`state` landen, das `save()` (`js/game.js:148`) serialisiert und
`js/standdatei.js` exportiert.

### E10 — Hintergrundfarbe fährt durch `applyNight`, nicht daneben

`applyNight` (`js/game.js:2477-2478`) schreibt `scene.background` und
`scene.fog.color` bei **jedem** Tween-Schritt aus `SKY.d`/`SKY.n`. Ein Stil, der
`scene.background` direkt setzt, würde beim nächsten Nachtwechsel still
überschrieben. Der Aquarell-Stil ergänzt deshalb ein zweites Farbpaar
(`SKY_AQ.d = 0xfdf4e0`, `SKY_AQ.n` als abgedunkelte Cremevariante) und
`applyNight` wählt das Paar nach `STYLE.aquarell.value`. Beim Stilwechsel wird
`applyNight(nightK)` einmal nachgerufen.

## Prototyp-Parameter (Zielvorgabe für die Treue)

Die Zahlen werden unverändert übernommen, damit das Ergebnis mit dem Prototyp
vergleichbar bleibt.

**Palette (nur für Tusche und Papier, nicht für die Spielfarben):**
Tusche `#6e4426`, Creme `#fdf4e0`, Creme dunkel `#f0e0bd`.

**Randpigment (Pigment Pooling) — wichtigster Einzeleffekt:**

```glsl
float rim = 1.0 - abs(dot(n, normalize(-vPv)));
col = mix(col, col * 0.56, pow(rim, 2.4) * uEdge);   // uEdge = 1.0
```

`n` ist die View-Space-Normale, `vPv` die View-Space-Position. In Lambert sind
das `vNormal` und `vViewPosition`; three führt `vViewPosition = -mvPosition.xyz`,
das Vorzeichen ist durch `abs()` ohnehin egal.

**Papierkorn (Screen Space):**

```glsl
vec2 puv = gl_FragCoord.xy / uRes * 1.7;
col = mix(col, col * paper, uGrain);                  // uGrain = 0.85
```

Papier-Canvas 512×512, `RepeatWrapping`: Grundwert je Pixel `232 + rand*23`;
2200 Faserstriche, α 0.05, Länge 3–17, zufällig schwarz oder weiss; 70 Blotches
α 0.035, Radius 14–84.

**Tuschekontur (Inverted Hull):**
`side: BackSide`, Farbe `#6e4426`, `uWidth = 1.25`,
`mv.xyz += n * uWidth * wob * (-mv.z) * 0.0032` mit
`wob = 0.55 + 0.9 * vnoise(position * 3.3)`.

**Passerversatz (Misregistration):** NDC-Versatz
`x = (2.2 / canvasW) * 2`, `y = (-1.6 / canvasH) * 2`, angewandt als
`p.xy += uOffset * p.w`.

**Nicht portiert (Referenz für die Folge-Issues):** unregelmässiger Wash
`w = vnoise(vObj*2.1)*0.55 + vnoise(vObj*6.5)*0.45`,
`col *= mix(1.0, 0.87 + 0.24*w, uWash)`.

Die GLSL-Hilfen `hash13` und `vnoise` werden aus dem Prototyp unverändert
übernommen und einmal als geteilte String-Konstante abgelegt.

## Wechselwirkungen mit den 14 frisch gemergten PRs

- **#102 (Fensteröffnungen)** — gelöst durch E6: je eine Zeile in `fensterAuf`
  (`js/game.js:374-378`) und `fensterZu` (`js/game.js:380-384`). Ohne diese
  Zeile stünde nach dem Betreten eines Stockwerks eine Kontur ohne Loch vor der
  gelochten Wand.
- **#98 (Tapete über Mesh-UVs)** — `tapeziereUV` (`js/models.js:782`)
  multipliziert die UVs der Wandpanels; Wandtexturen laufen über `repeat(1,1)`,
  nur Böden behalten `repeat.set(4, 3)` (`js/models.js:799`). **Keine
  Kollision:** das Papierkorn rechnet in `gl_FragCoord`, nicht in `vUv`. Der
  Patch hängt hinter `<map_fragment>`, das Korn liegt also über der schon
  tapezierten Fläche — genau richtig, das Papier ist die Bildebene, nicht die
  Wand.
- **#99/#100 (Möbelskalierung)** — `applyEntryScale` (`js/game.js:706-709`)
  skaliert den Gruppenknoten eines Möbels. Weil Konturen laut E7 **nicht** auf
  Möbel kommen, ist die Frage in Scheibe 1 gegenstandslos. Für das Folge-Issue
  «Konturen auch auf Möbeln» ist sie es nicht: ein Hull-Kind erbt die
  Gruppenskalierung, und weil der Versatz in View-Space-Einheiten rechnet,
  wächst die Strichbreite bei 2× mit — die Kontur wäre am gedehnten Sofa
  doppelt so fett wie am Stuhl daneben. Das gehört dort gelöst (Division durch
  den Skalierungsfaktor als zusätzliche Uniform), nicht hier.
- **#93 (Klick-Animationen)** — tweenen `mesh.scale` und `rotation` über die
  gemeinsame `tween()`-Schlange (`js/game.js:1355-1356`, angewandt z. B. in
  `js/game.js:2131`, `2275`, `2348`). Kind-Meshes folgen ihrem Elter
  automatisch, weil three die Weltmatrix vererbt. **Unproblematisch**, auch
  wenn später Konturen an Möbeln hängen: ein Hull ist ein gewöhnliches Kind.
- **Nacht/Jahreszeit** — `applyNight` (`js/game.js:2476-2490`) schreibt die
  Fensterfarben direkt auf `w.material.color`/`.emissive`. Das sind dieselben
  Lambert-Instanzen, der Patch sitzt darunter; kein Konflikt. Für
  `scene.background` siehe E10.

## Was das Feature nicht ändert

- Keine neue Materialklasse an einem Möbel. `material.type` bleibt überall
  `'MeshLambertMaterial'`.
- Keine neuen Materialinstanzen beim Umschalten. Die Anzahl, die
  `window.wipfelkratzer.matCount()` (`js/game.js:3574`) zählt, ist vor und nach
  dem Wechsel gleich — das Kontur-Material entsteht **einmal beim Start**,
  nicht beim Umschalten.
- Kein Eingriff in `state`, `save()` oder die Standdatei.

## Akzeptanzkriterien

**Maschinell prüfbar (Playwright, Vordergrund):**

- [ ] Der Toolbar-Knopf schaltet `window.wipfelkratzer.STYLE.aquarell.value`
      zwischen `0` und `1`; die Beschriftung wechselt zwischen «Aquarell» und
      «Bilderbuch».
- [ ] Nach dem Umschalten ist `matCount()` unverändert gegenüber vorher.
- [ ] Nach dem Umschalten hat **kein** Mesh unter `makeFurniture()` ein anderes
      `material.type` als `'MeshLambertMaterial'` und keines eine `map`.
- [ ] `python3 tools/verify_katalog.py` läuft unverändert grün durch.
- [ ] Umschalten hin und zurück erzeugt **keinen** Console-Error und keine
      Shader-Kompilierwarnung.
- [ ] Nach `aquarell = 1` → `0` sind `scene.background`, `scene.fog.color` und
      alle `MAT`-Farben identisch zum Ausgangswert (Hex-Vergleich, nicht Bild).
- [ ] Der Stil überlebt einen Reload: `localStorage['wipfelkratzer-stil']` ist
      gesetzt, und nach `page.reload()` steht dieselbe Uniform an.
- [ ] Ein exportierter Spielstand (`js/standdatei.js`) enthält den Schlüssel
      `stil` **nicht**; `JSON.parse(localStorage['wipfelkratzer-stand-…'])`
      ebenso wenig.
- [ ] Zehnstöckiger Turm, Aquarell aktiv: der Mittelwert über 60 Frames bleibt
      innerhalb von **+40 %** der Frame-Zeit desselben Turms im Bilderbuch-Stil.
      Gemessen wird gegen den eigenen Vorher-Wert im selben Lauf, nicht gegen
      eine absolute fps-Zahl — ein Headless-Renderer zeichnet unter 1 fps,
      absolute Schranken sind dort bedeutungslos (`CLAUDE.md`, «Animated
      cameras»).
- [ ] Besuchsmodus im Aquarell-Stil: nach `fensterAuf(k)` referenziert das
      Kontur-Kind der Vorderwand dieselbe Geometrie wie `kern`/`panel`
      (`s.geo.kernOffen`/`panelOffen`), nach `fensterZu(k)` wieder die
      geschlossene.

**Nur von einem Menschen prüfbar — ausdrücklich geschuldet:**

- [ ] **Sieht es aus wie ein Bilderbuch?** Kein Probe-Lauf kann das. Eine
      Playwright-Prüfung belegt «Uniform umgelegt, Materialtyp unverändert,
      `verify_katalog` grün, keine Fehler, Frame-Zeit im Budget» — sie belegt
      **nicht**, dass das Ergebnis schön ist, dass die Konturbreite stimmt,
      dass das Papierkorn nicht wie Bildrauschen wirkt oder dass das Randpigment
      die Modelle nicht matschig macht. Dieses Feature ist ein visuelles
      Experiment mit echtem Risiko, daneben zu liegen.
- [ ] Abnahme deshalb: **Screenshot-Paar** (derselbe Turm, beide Stile, gleiche
      Kamera) an den PR hängen, dazu eines aus dem Besuchsmodus. Der Mensch
      entscheidet über die drei Konstanten `uWidth`, `uEdge`, `uGrain` und
      darüber, ob die Scheibe überhaupt gemergt wird.
- [ ] Wirkt der Look auch nachts und im Winter? Nacht und Jahreszeit ändern
      Lamberts Licht, nicht den Patch — aber das Ergebnis ist Geschmacksfrage.

## Nicht in diesem Issue

- Schraffuren für Holzmaserung und Fell
- Unregelmässige Fensterformen
- Gemalter Hintergrund statt Hintergrundfarbe
- Die vier Folge-Issues aus E2 (Wash, Jitter, Backdrop, Möbelkonturen)
- Regler für Konturbreite, Pigmentstärke, Kornstärke
