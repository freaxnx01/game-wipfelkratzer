# Spec — Maus-Objekte verschieben und Mausrad-Objekt drehen (Issue #64)

Repo: `game-wipfelkratzer`. Base: `main`, v0.7.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js` + `js/staende.js`,
three.js r184 über Importmap (`index.html:13-16`). Kein Build-Schritt, kein
Test-Runner (`CLAUDE.md` — «Tooling & Testing»).

Quelle: Issue #64, vom Besitzer am 16.09.2026 angelegt, Text vollständig:
«Maus-Objekte verschieben und Mausrad-Objekt drehen».

## Problem

Ein ausgewähltes Objekt lässt sich heute nur über Tastatur und Knöpfe bewegen:
Pfeiltasten verschieben um feste 0.12, Bild↑/Bild↓ drehen um π/12
(`js/game.js:1742-1762`), dazu die Knöpfe `#btn-move` und `#btn-rot`, die auf
die nächste freie Zelle springen bzw. um denselben Schritt drehen. Das ist
präzise, aber umständlich — die naheliegende Geste, das Objekt einfach dorthin
zu ziehen, wo es hin soll, gibt es nicht.

Die Maus ist heute vollständig von `OrbitControls` belegt: Ziehen dreht die
Kamera, das Rad zoomt (`js/game.js:153-155`). Beide Gesten müssen der neuen
Bedienung punktgenau abgerungen werden, ohne die Kamerabedienung sonst
anzutasten — das ist der eigentliche Inhalt dieser Spec.

## Ausgangslage im Code

1. **Tippen und Ziehen sind bereits unterschieden.** Der `pointerup`-Handler
   (`js/game.js:1648-1649`) verwirft alles, was weiter als 8 px gewandert ist
   oder länger als 400 ms gedauert hat. Ein Zug löst deshalb schon heute kein
   Auswählen oder Abwählen aus; die neue Geste muss diese Schwelle nicht
   anfassen.

2. **Bewegen läuft immer durch `applyMove`** (`js/game.js:678-684`). Die
   Funktion sichert `x/z/y/rot/wall`, ruft den Mutator, prüft
   (`resolveItemMove` bzw. `resolveTenantMove`) und setzt bei Ablehnung alles
   zurück. Jeder neue Bewegungsweg muss denselben Pfad nehmen, sonst umgeht er
   die Kollisionsprüfung aus #40.

3. **Der Ablehnungspfad meldet sich selbst — an zwei Stellen.**
   `applyMove` spielt `sfx.knock()` (`js/game.js:683`), und tiefer drin meldet
   `resolveItemMove` zusätzlich einen Toast, wenn ein Tier im Weg steht
   (`js/game.js:1338`). Bei Tastendruck ist das genau richtig: eine Geste, eine
   Rückmeldung. Bei einem gezogenen Objekt fällt pro Mausbewegung ein
   Ablehnungsversuch an — also bis zu 60 Klopfgeräusche und 60 Toasts pro
   Sekunde, solange man gegen ein Hindernis drückt.

4. **Wandobjekte haben ein eigenes Koordinatensystem.** `moveWallItem`
   (`js/game.js:1732-1737`) führt `en.x` entlang der Wand und `en.y` in der
   Höhe; `clampEntry` rechnet daraus über `wallPlacement` die Weltposition
   (`js/game.js:591-599`). Eine Bodenebene ist für sie sinnlos.

5. **Tiere sind seit #39 platzierbar** und hängen an `setTenantPos`
   (`js/game.js:1288`), mit eigener Prüfung `resolveTenantMove`
   (`js/game.js:686`). `position.y` gehört bei ihnen der Wackel-Animation und
   darf nicht aus einer Zielposition gesetzt werden.

## Entscheidungen

Vier Fragen, vom Besitzer am 17.09.2026 entschieden:

- **E1 — Maus *und* Finger.** Die Geste gilt für jeden Zeigertyp, nicht nur
  für `pointerType === 'mouse'`. Auf dem Tablet ist Ziehen damit der direkte
  Weg; das Mausrad hat dort ohnehin kein Gegenstück, Drehen bleibt der
  `#btn-rot`-Knopf.

- **E2 — Erst auswählen, dann ziehen.** Ein Zug verschiebt **nur das bereits
  ausgewählte Objekt**, und nur wenn er auf ihm beginnt. Ein Zug irgendwo
  sonst — auch auf einem anderen Möbel — dreht die Kamera wie bisher.
  Verworfen: «Zug auf jedem Objekt verschiebt». Grund: in einer vollen Wohnung
  bliebe für das Kamera-Drehen kaum Fläche übrig, und ein Kind verschiebt
  sonst beim Hinschauen etwas. Der `BoxHelper` aus `select`
  (`js/game.js:1126-1127`) macht die Bedingung sichtbar, statt sie raten zu
  lassen.

- **E3 — Rad dreht nur über dem ausgewählten Objekt.** Dieselbe Bedingung wie
  beim Ziehen — eine Regel, zwei Gesten. Überall sonst zoomt das Rad
  unverändert. Verworfen: «immer, solange etwas ausgewählt ist» (Zoomen wäre
  im Einrichtungsmodus nur nach Abwählen möglich) und «Umschalt+Rad zoomt»
  (Modifier-Tasten sind für die Zielgruppe die schlechteste Variante).

- **E4 — Am Hindernis hängenbleiben, Rückmeldung einmalig.** Jeder Zugschritt
  läuft durch `applyMove`; ein abgelehnter Schritt wird verworfen, das Objekt
  bleibt stehen und gleitet am Hindernis entlang, wenn man seitlich
  weiterzieht. Klopfen und Toast kommen **einmal** beim Anstossen, nicht
  erneut, solange der Zug blockiert bleibt. Verworfen: freies Ziehen mit
  Prüfung erst beim Loslassen — ein Zug, der sich am Ende auflöst, ist für ein
  Kind die frustrierendste der drei Varianten.

## Entwurf

### Ort

Kein neues Modul. Die Geste braucht `selected`, `applyMove`, `clampEntry`,
`moveWallItem`, `setTenantPos`, `save`, `controls`, `ray`/`ptr` — allesamt
Modulinterna von `game.js`. Ein `js/drag.js` müsste sie sich über Parameter
oder globale Referenzen zurückholen und würde die Kapselung verschlechtern,
nicht verbessern. Der Code kommt als eigener Abschnitt direkt hinter den
bestehenden Zeigerblock (`js/game.js:1646-1700`).

### Rückmeldung aus dem Ablehnungspfad herausziehen

Voraussetzung für E4, und die einzige Änderung an bestehendem Code. Heute
meldet der Ablehnungspfad selbst (Punkt 3 oben) — eine Hülle um `applyMove`
könnte das Klopfen abfangen, käme aber an den Toast in `resolveItemMove` nicht
heran.

Deshalb: `resolveItemMove` **meldet nicht mehr selbst**, sondern hinterlegt den
Grund, und `applyMove` klopft nicht mehr selbst. Beides wandert in eine kleine
`meldeBlockade()`, die der Aufrufer auslöst:

```js
let blockGrund = null;                 // vom Ablehnungspfad gesetzt
function meldeBlockade() {
  sfx.knock();
  if (blockGrund) toast(blockGrund);
  blockGrund = null;
}
```

- `applyMove` liefert wie bisher `true`/`false`, setzt aber keine Töne mehr ab.
- `resolveItemMove` setzt `blockGrund = \`Hier ist kein Platz — ${…} steht im Weg!\``
  statt zu toasten.
- Die drei bestehenden Aufrufer (Pfeiltasten, Bild↑/↓, `#btn-move`) rufen
  `meldeBlockade()`, wenn `applyMove` `false` liefert — Verhalten unverändert.
- Der Zug ruft sie nur an der **steigenden Flanke**: war der vorige Schritt
  frei und dieser ist blockiert, einmal melden; danach schweigen, bis der Zug
  wieder frei ist.

Das ist Command-Query-Trennung an der Stelle, wo sie hier zählt: `applyMove`
führt aus und liefert das Ergebnis, das Melden ist Sache dessen, der die Geste
kennt. Kein Flag-Argument — die Stack-Regeln verbieten sie, und es wäre hier
auch genau der falsche Schnitt.

### Ziehen

Drei Zustandsvariablen im Drag-Abschnitt, kein neuer globaler Zustand:
`ziehen` (der laufende Zug oder `null`), `zugEbene` (`THREE.Plane`),
`zugVersatz` (`THREE.Vector3`).

**`pointerdown`** — nur wenn `edit && selected`. Strahl gegen
`selected.mesh`; kein Treffer → nichts tun, `OrbitControls` bekommt das
Ereignis wie bisher. Treffer →

- `controls.enabled = false`
- Ebene aufspannen: für Bodenobjekte waagrecht auf Höhe des Treffpunkts
  (`setFromNormalAndCoplanarPoint` mit `(0,1,0)`), für Wandobjekte
  (`WALL_ITEMS.has(en.id)`) die Wandebene aus `wallPlacement(k, en.wall)`
- `zugVersatz` = Treffpunkt − aktuelle Objektposition, damit das Objekt nicht
  unter den Zeiger springt
- `setPointerCapture(e.pointerId)`, damit der Zug nicht abreisst, wenn der
  Zeiger das Objekt verlässt — der entscheidende Punkt, weil das Objekt dem
  Zeiger nie exakt folgt, sobald es an einem Hindernis hängt

**`pointermove`** — Strahl gegen `zugEbene`, Zielpunkt minus `zugVersatz`,
dann je nach Art des Objekts:

- **Bodenobjekt:** `applyMove(selected, () => { en.x = ziel.x; en.z = ziel.z;
  clampEntry(…); })`, danach `en.y` wie im Tastaturpfad neu setzen
  (`DECO.has(en.id) ? surfaceYAt(…) : baseY(k)`, `js/game.js:1751-1752`)
- **Wandobjekt:** Deltas gegen die Wandebene durch `moveWallItem`, das
  `en.x`/`en.y` führt und `clampEntry` selbst aufruft
- **Tier:** wie Bodenobjekt, aber Abschluss über
  `setTenantPos(selected.tenant.floor, selected.tenant.idx, en)` statt `save()`
  — `position.y` bleibt der Animation überlassen

Danach `selHelper.update()`. Gespeichert wird **nicht** pro Schritt: `save()`
ist ohnehin um 300 ms entprellt (`js/game.js:139`), und der Zug schreibt am
Ende genau einmal.

**`pointerup` / `pointercancel`** — `controls.enabled = true`,
`releasePointerCapture`, `save()`, `ziehen = null`.

### Drehen mit dem Rad

`wheel`-Handler auf `renderer.domElement` mit `{ passive: false }`. Bedingung
identisch zum Ziehen: `edit && selected` und der Strahl trifft `selected.mesh`.
Dann

```js
applyMove(selected, () => { en.rot += Math.sign(e.deltaY) * Math.PI / 12;
  selected.mesh.rotation.y = en.rot; clampEntry(selected.k, selected.mesh, en); });
```

— derselbe Schritt wie Bild↑/↓ — und anschliessend `e.preventDefault()`, damit
`OrbitControls` nicht zusätzlich zoomt. Ohne Treffer **kein**
`preventDefault()`: der Zoom bleibt exakt wie heute.

`Math.sign(e.deltaY)` statt `e.deltaY` direkt: Mäuse, Trackpads und Browser
liefern völlig verschiedene Beträge (`deltaMode` 0/1/2), und ein
rastendes Rad soll genau eine Rasterung pro Kerbe drehen, nicht
gerätespezifisch mal drei.

Wandobjekte werden **nicht** gedreht: ihre Rotation ist durch die Wand
bestimmt, `clampEntry` setzt `en.rot = pl.rot` (`js/game.js:597`). Der Handler
steigt bei `WALL_ITEMS.has(en.id)` aus, wie es `#btn-rot` schon tut
(`js/game.js:1719`).

## Was unverändert bleibt

- Ausserhalb des Einrichtungsmodus: jeder Zug dreht die Kamera, jedes Rad
  zoomt. `edit` ist die erste Bedingung beider Handler.
- Die 8-px-Schwelle in `pointerup` (`js/game.js:1649`) — ein Zug löst weiterhin
  kein Auswählen/Abwählen aus.
- Pfeiltasten, Bild↑/↓, `#btn-move`, `#btn-rot`, `#wallpad`: unverändert. Auf
  dem Tablet bleiben sie der Weg zum Drehen.
- `applyMove`s Rückgabewert und Rücksetzverhalten. Nur die Rückmeldung wandert
  heraus.

## Akzeptanzkriterien

- [ ] Im Einrichtungsmodus verschiebt ein Zug, der auf dem **ausgewählten**
      Objekt beginnt, dieses Objekt; `en.x`/`en.z` ändern sich, die
      Kameraposition nicht.
- [ ] Ein Zug, der auf einem **nicht ausgewählten** Objekt oder auf leerer
      Fläche beginnt, dreht die Kamera; `en.x`/`en.z` des ausgewählten Objekts
      bleiben unverändert.
- [ ] Ausserhalb des Einrichtungsmodus dreht jeder Zug die Kamera.
- [ ] Das Rad über dem ausgewählten Objekt ändert `en.rot` um π/12 pro Kerbe
      und **nicht** die Kameradistanz.
- [ ] Das Rad neben dem ausgewählten Objekt ändert die Kameradistanz und
      **nicht** `en.rot`.
- [ ] Ein Zug gegen ein Hindernis lässt das Objekt am Hindernis stehen;
      seitliches Weiterziehen lässt es daran entlanggleiten.
- [ ] Beim Anstossen kommt genau **eine** Rückmeldung (Klopfen, bei einem Tier
      zusätzlich ein Toast), keine weitere, solange der Zug blockiert bleibt.
- [ ] Ein Zug auf einem Wandobjekt bewegt es entlang der Wand und in der Höhe;
      es löst sich nicht von der Wand.
- [ ] Ein Zug auf einem Tier verschiebt es und überlebt einen Neuladen
      (`state.tenantPos`).
- [ ] Der Zug reisst nicht ab, wenn der Zeiger das Objekt verlässt
      (`setPointerCapture`).
- [ ] Nach jedem Zug steht der Spielstand im `localStorage`.
- [ ] Tastatur- und Knopfbedienung verhalten sich unverändert, inklusive
      Klopfen und Toast bei Blockade.
- [ ] Kein Test-Framework, kein Bundler, keine `package.json` wird hinzugefügt.
- [ ] Die Konsole bleibt beim Laden und während der Gesten leer.

## Prüfung

Buildless — die Prüfung sind Playwright-Sonden im Vordergrund, nach dem Muster
der Pläne zu #45/#46/#50, gegen `python3 -m http.server` auf einem eigenen
Port. Gesten werden über `page.mouse.move/down/up` und `page.mouse.wheel`
gefahren, der Zustand über `window.wipfelkratzer` gelesen — `state`,
`selected`, `camera`, `applyMove` sind dort bereits exportiert
(`js/game.js:2058-2069`). Die Sonden sind nicht committet (`.superpowers/` ist
ignoriert).

Der manuelle In-Browser-Playtest bleibt das eigentliche Gate und wird als
offener Posten in der PR-Beschreibung geführt, nicht als erledigt behauptet.
