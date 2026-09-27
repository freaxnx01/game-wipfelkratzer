# Spec — «Sichern mit Fotos» klappt nicht (Issue #94)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #94, abgespalten von #91. Der Bericht ist eine Zeile:
«Sichern, mit Fotos: Sichern hat nicht geklappt». Keine Fehlermeldung, kein
Gerät, kein Screenshot — der Befund musste aus dem Code kommen.

## Was «Sichern» heute tut

Auf einer Turmkarte öffnet «Sichern» eine Zeile mit zwei Knöpfen,
«Mit Fotos (2.3 MB)» und «Ohne Fotos (18 KB)» (`js/game.js:2510-2515`). Ein
Tipp darauf sperrt den Knopf und ruft `exportiereStand(eintrag, mit)`
(`js/game.js:2696-2707`).

`exportiereStand` (`js/game.js:2558-2579`) baut die Datei und geht dann einen
von zwei Wegen:

1. **System-Sheet** — gibt es `navigator.canShare`/`navigator.share` und sagt
   `canShare({files})` ja, wird geteilt. Das ist der Weg auf dem iPad.
2. **Datei-Download** — sonst ein Blob hinter einem `<a download>`.

Der Unterschied zwischen «mit» und «ohne Fotos» ist allein die Grösse: die
Fotos liegen als Base64-Data-URLs in `localStorage` (`js/game.js:2387`) und
wandern unverändert in dieselbe JSON-Datei (`js/game.js:2543-2552`). Ohne
Fotos sind das ein paar Kilobyte, mit Fotos bis zu drei Megabyte.

## Drei Löcher, die alle dasselbe Symptom erzeugen

Der Bericht sagt «hat nicht geklappt», nicht «hat eine Fehlermeldung
gebracht». Genau das ist die Spur: der Sheet-Weg endet in mehreren Fällen
**ohne Datei und ohne Wort**.

**F1 — Ein gescheitertes Teilen ist eine Sackgasse.** Nach dem `catch` steht
ein unbedingtes `return` (`js/game.js:2569`). Schlägt `navigator.share` fehl,
wird der bereits fertig gebaute Blob weggeworfen, statt auf den
Datei-Download zurückzufallen. Das Kind sieht «Das Sichern hat nicht
geklappt.» — und hat nichts. Genau dieser Satz steht im Issue-Titel.

**F2 — `AbortError` wird stumm geschluckt** (`js/game.js:2568`). Gedacht war
das für den Abbruch im Sheet, und das ist richtig gedacht. iOS/iPadOS meldet
aber auch ein *technisches* Scheitern beim Teilen grosser Dateien als Abbruch
— und dann passiert sichtbar **gar nichts**: kein Sheet, kein Toast, keine
Datei. «Ohne Fotos» funktioniert im selben Moment, weil die kleine Datei
durchgeht. Das ist die Asymmetrie, die der Bericht beschreibt.

**F3 — Ein Fehler beim Bauen der Datei fällt ins Leere.** Der Handler hängt
nur ein `.finally()` an (`js/game.js:2704`), kein `.catch()`. Wirft
`standDatei`/`JSON.stringify`/`new Blob` bei drei Megabyte Fotos, wird die
Zeile eingeklappt, der Knopf wieder freigegeben — und niemand erfährt etwas.
Ein unbehandelter Promise-Fehler in der Konsole ist keine Rückmeldung für ein
Kind am Tablet.

## Entscheidungen

Quick-Mode, ohne Rückfrage entschieden — die Begründungen stehen hier, die
Kurzform als Assumptions am Issue.

- **E1 — Nach einem gescheiterten Teilen wird heruntergeladen.** Der Blob ist
  schon da; ihn wegzuwerfen ist reiner Verlust. Verworfen: nur eine bessere
  Fehlermeldung zu zeigen (erklärt dem Kind sein Problem, löst es nicht) und
  einen «Nochmal versuchen»-Knopf (zweite Bedienoberfläche für einen Fall,
  der sich automatisch heilen lässt).

- **E2 — Ein Abbruch wird an der Zeit erkannt, nicht am Fehlernamen.** Ein
  echter Abbruch setzt voraus, dass das Sheet offen war und jemand darin
  getippt hat — das dauert. Ein `AbortError` **innerhalb von 400 ms** kann
  kein menschlicher Abbruch sein; er wird wie jeder andere Fehler behandelt
  und fällt auf den Download zurück. Ein späterer gilt als Abbruch und bleibt
  wie heute folgenlos und stumm. Verworfen: jeden `AbortError` als Fehler zu
  behandeln (dann bekommt ein Kind, das den Sheet bewusst schliesst, trotzdem
  eine Datei — die ursprüngliche Überlegung in `js/game.js:2565-2566` ist
  richtig und bleibt) und eine Grössenschwelle, ab der das Sheet gar nicht
  erst versucht wird (die Schwelle wäre geraten, und auf einem iPad ist das
  Sheet der bequemere Weg, solange er trägt).

- **E3 — Der Handler bekommt ein `.catch()`, das den Grund nennt.** Ein
  Fehler beim Bauen der Datei endet in einem Toast statt im Nichts. Verworfen:
  `try/catch` innerhalb von `exportiereStand` an jeder einzelnen Stelle — ein
  `.catch()` am Aufrufer fängt alle drei Wege (Bauen, Teilen, Herunterladen)
  an einer Stelle.

- **E4 — Keine Grössenprüfung beim Sichern.** Naheliegend wäre, gegen
  `MAX_DATEI` (6 MB, `js/standdatei.js:13`) zu prüfen, damit nicht eine Datei
  entsteht, die sich später nicht mehr einlesen lässt. Gegen diese Prüfung
  spricht, dass sie nicht auslösen kann: die Fotos kommen aus `localStorage`,
  und dessen Kontingent liegt unter dem Limit — deshalb gibt es überhaupt den
  Toast «Die Galerie ist voll» (`js/game.js:2382`). Eine Fehlerbehandlung für
  einen unerreichbaren Fall wäre toter Code.

## Entwurf

### `exportiereStand` — ein Weg statt zwei Sackgassen

Der Ablauf bleibt «erst das Sheet, sonst die Datei»; neu ist, dass der zweite
Weg auch dann noch offen steht, wenn der erste unterwegs abbricht. Die
Sheet-Behandlung wird dazu in eine eigene kleine Funktion gezogen, die
beantwortet: **hat das Teilen den Turm untergebracht?**

```js
/* Ein Abbruch im Sheet ist kein Fehler — das Kind hat es sich anders
   überlegt. iOS meldet aber auch ein gescheitertes Teilen grosser Dateien
   als Abbruch (#94), und das darf nicht folgenlos bleiben. Unterschieden
   wird an der Zeit: wer wirklich abbricht, hatte das Sheet offen. */
const ABBRUCH_MIN_MS = 400;

async function teileStand(datei, titel) {
  const start = Date.now();
  try { await navigator.share({ files: [datei], title: titel }); return true; }
  catch (e) {
    const abgebrochen = e && e.name === 'AbortError'
      && Date.now() - start >= ABBRUCH_MIN_MS;
    return abgebrochen;
  }
}
```

`true` heisst «erledigt, nichts weiter tun» — geteilt oder bewusst
abgebrochen. `false` heisst «es ist nichts passiert», und dann läuft der
bestehende Download-Weg weiter, samt seinem Toast «Der Turm ist als Datei
gesichert.». Der Toast «Das Sichern hat nicht geklappt.» entfällt an dieser
Stelle: er beschrieb einen Zustand, den es nach dem Rückfall nicht mehr gibt.

### Der Aufrufer meldet, was schiefging

```js
exportiereStand(eintrag, mit)
  .catch(() => toast('Das Sichern hat nicht geklappt — versuche es ohne Fotos.'))
  .finally(() => { /* wie heute */ });
```

Der Hinweis nennt den einzigen Ausweg, den ein Kind selbst hat, und er ist
die einzige Stelle, an der «hat nicht geklappt» künftig noch auftaucht.

### Was unberührt bleibt

Das Dateiformat (`js/standdatei.js`), das Einlesen, die Galerie, das
ZIP der Fotos, die Grössenschätzung auf den Knöpfen
(`js/game.js:2583-2588`), `MAX_DATEI`, der Weg «Ohne Fotos». Keine neuen
Knöpfe, keine neue Einstellung, keine Formatänderung.

## Akzeptanzkriterien

- [ ] Ohne `navigator.share` (Desktop-Browser) lädt «Mit Fotos» wie bisher
      eine Datei herunter; sie enthält die Fotos und lässt sich mit
      «Turm einlesen» wieder einlesen.
- [ ] Scheitert `navigator.share` mit einem technischen Fehler (z. B.
      `NotAllowedError`), entsteht trotzdem die Datei — das Sichern endet
      nie ohne Ergebnis.
- [ ] Ein `AbortError` **sofort** nach dem Aufruf (unter 400 ms) gilt als
      technisches Scheitern und führt zum Download.
- [ ] Ein `AbortError` **nach** einer sichtbaren Weile (über 400 ms) gilt als
      Abbruch durch das Kind: keine Datei, kein Fehlertoast.
- [ ] Ein erfolgreiches Teilen lädt **keine** zusätzliche Datei herunter.
- [ ] Wirft das Bauen der Datei, erscheint ein Toast, der das Sichern ohne
      Fotos vorschlägt; der Knopf ist danach wieder bedienbar und die
      Sichern-Zeile eingeklappt.
- [ ] «Ohne Fotos» verhält sich unverändert.
- [ ] Kein Test-Framework, kein Bundler, keine `package.json`, kein neues
      `window`-Objekt ausser den bestehenden Debug-Haken.
- [ ] Die Konsole bleibt fehlerfrei.

## Prüfung

Buildless — Playwright im Vordergrund gegen `python3 -m http.server`, nie im
Hintergrund. Chromium kennt `navigator.share` für Dateien nicht, also läuft
dort von Haus aus der Download-Weg; die Sheet-Fälle werden über ein
`page.add_init_script` gesetzt, das `navigator.canShare`/`navigator.share`
durch eine Attrappe mit der gewünschten Verzögerung und dem gewünschten
Fehlernamen ersetzt. Beobachtet wird mit `page.expect_download()` und am
Toast-Text in `#toast-stack .toast-msg` — beides echte Benutzerspuren, keine
internen Aufrufe.

Fotos setzt die Sonde über `localStorage` mit einem echten kleinen
JPEG-Data-URL, damit der Round-Trip durch `bereinigeFotos`
(`js/standdatei.js:189`) auch wirklich etwas durchlässt.

Der manuelle Playtest bleibt das Gate: die eigentliche Fehlerumgebung ist
Safari auf dem iPad, und die kann keine Sonde nachstellen. Er gehört als
offener Posten in die PR-Beschreibung.
