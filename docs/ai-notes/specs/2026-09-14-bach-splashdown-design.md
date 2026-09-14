# Spec — Auf den Bach tippen startet Splashdown und kehrt zurück (Issue #46)

Repo: `game-wipfelkratzer`. Base: `main`, v0.5.0 (`version.js:3`). Buildless
Vanilla: `index.html` + `js/game.js` + `js/models.js`, three.js r184 über
Importmap. Kein Build-Schritt, kein Test-Runner (`CLAUDE.md:508-516`).

Zweites Repo: `game-splashdown`, v0.1.0, eine einzige Datei
(`game-splashdown/index.html`, 918 Zeilen), three.js r160 über CDN.
Ausgeliefert unter `https://github.freaxnx01.ch/game-splashdown/`.

Quelle: Feedback-Triage 12.09.2026, Eintrag 18 — Block C.

## Problem

Der Bach ist das auffälligste Element der Umgebung neben dem Turm, aber er
tut nichts. Er besteht aus drei Bändern, die `ribbon()` (`js/game.js:87-99`)
erzeugt — Sand 5.6 breit, Wasser 3.6 breit, helle Mitte 1.5 breit
(`js/game.js:99-101`). `ribbon()` **gibt das Mesh zwar zurück, aber der
Rückgabewert wird an allen drei Aufrufstellen verworfen**; es gibt weder eine
Referenz noch ein `userData.type`.

Die Trefferprüfung läuft über eine feste Liste (`js/game.js:1023`):

```js
const hits = ray.intersectObjects([...hitboxes, sign, willi, dam, moki], true);
```

Der Bach steht dort nicht drin. Dass `makeDam` (`js/models.js:431`) und
`makeBridge` (`js/models.js:449`) am Bach stehen, ändert daran nichts: die
Biberburg hat ihre eigene Trefferfläche (`js/game.js:102`,
`userData.type = 'dam'`), die Brücke (`js/game.js:126`) gar keine.

Auf der anderen Seite: **Splashdown weiss nichts von einem Aufrufer.**
Ein `grep` über `game-splashdown/index.html` nach `document.referrer`,
`history` oder einer URL-Parameter-Auswertung findet nichts; die einzigen
Navigationsziele sind die festen Links in der `#game-nav`-Leiste
(`game-splashdown/index.html:890-896`), darunter «More Games…» auf
`https://github.freaxnx01.ch/games/`. Der Hinweg ist ein `<a href>`. Der
Rückweg ist die Arbeit.

Und ein Befund, der dem Issue-Text widerspricht: **der Wipfelkratzer speichert
nicht sofort.** `save()` (`js/game.js:37-42`) ist um 300 ms entprellt:

```js
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try {
  /* ... */ localStorage.setItem('wipfelkratzer-v1', JSON.stringify({ ...state, wallpaper }));
} catch (e) {} }, 300); };
```

Wer ein Möbel platziert und im selben Atemzug den Bach antippt, verlässt die
Seite **innerhalb** dieses Fensters — der `setTimeout` wird mit dem Dokument
verworfen, und die letzte Änderung ist weg. Das ist kein theoretisches Risiko:
`addItem()` (`js/game.js:711`), `removeItem()` (`js/game.js:718`) und jede
Möbelbewegung rufen genau dieses entprellte `save()`.

## Goals

- Ein Tipp auf das Wasser des Bachs führt nach einer Rückfrage zu Splashdown.
- **Vor dem Verlassen wird der Spielstand synchron geschrieben**, nicht
  entprellt (A2).
- Der Rückweg ist beschrieben und auf der Splashdown-Seite als Link vorhanden
  — über einen Parameter, den der Wipfelkratzer mitgibt (A4).
- **Der Wipfelkratzer-Teil ist allein lauffähig.** Solange das
  Splashdown-Issue nicht umgesetzt ist, ignoriert Splashdown den Parameter,
  und der Rückweg läuft über die Zurück-Taste bzw. «More Games…»
  (`game-splashdown/index.html:893`) — nichts ist kaputt (A5).
- Die Rückfrage schützt vor dem Fehltipp: ein Kind wird nicht ohne Vorwarnung
  aus seinem Turm gerissen (A3).
- Kein neuer `localStorage`-Schlüssel (A7).

## Non-goals

- **Keine Integration der beiden Spielstände.** Splashdowns Rekord bleibt
  Splashdowns Rekord; der Wipfelkratzer liest ihn nicht und zeigt ihn nicht.
- Keine Änderung an `makeDam`/`makeBridge` (`js/models.js:431, 449`), keine
  Änderung an der Biberburg-Interaktion (`js/game.js:1029`).
- Kein Wasser-Minispiel im Wipfelkratzer selbst.
- Keine weiteren Spiele am Bach. Genau ein Ziel: Splashdown.
- **Keine Änderung in `game-splashdown` innerhalb dieses Issues** — die gehört
  in ein eigenes Issue in jenem Repo (siehe «Abhängigkeit»).
- Kein `iframe`, kein Einbetten von Splashdown in den Wipfelkratzer (A6).
- Keine Änderung an der Foto-Galerie oder deren Schlüssel
  (`js/game.js:1137-1138`).

## Design

### 1. Der Bach bekommt eine Trefferfläche — das mittlere Wasserband

`ribbon()` (`js/game.js:87-99`) bleibt, wie sie ist; nur die Aufrufe merken
sich den Rückgabewert:

```js
ribbon(5.6, 0.02, new THREE.MeshLambertMaterial({ color: 0xc9b083 }));
/* Das breite Wasserband ist die Trefferfläche des Bachs (#46) — nicht das
   Sandufer darunter und nicht der helle Streifen darüber. */
const river = ribbon(3.6, 0.045, MAT.water);
river.userData.type = 'bach';
ribbon(1.5, 0.06, new THREE.MeshLambertMaterial({ color: 0x7fc4dd }));
```

und die Pickliste nimmt es auf (`js/game.js:1023`):

```js
const hits = ray.intersectObjects([...hitboxes, sign, willi, dam, moki, river], true);
```

Dazu ein Zweig in der bestehenden Schleife (`js/game.js:1024-1032`):

```js
if (u.type === 'bach') { askSplashdown(); return; }
```

Warum **das 3.6 breite** Band und nicht die anderen zwei:

- Der Sandstreifen (5.6) ist Ufer, kein Wasser — ein Tipp aufs Ufer soll
  nichts starten.
- Der helle Streifen (1.5, `js/game.js:101`) liegt darüber, ist aber **nicht**
  in der Pickliste und verdeckt deshalb nichts: `intersectObjects` prüft
  ausschliesslich die übergebenen Objekte. Der Tipp trifft in jedem Fall das
  breite Band darunter.

Dieselbe Mechanik schützt die Biberburg: `dam` steht körperlich über dem
Wasser (`js/game.js:102`), liegt in der Trefferliste vor dem Bach und gewinnt
deshalb nach Strahlentfernung sortiert — die Schleife nimmt den ersten Treffer
mit `userData.type` (`js/game.js:1024-1032`). Die Brücke (`js/game.js:126`)
steht in der Liste gar nicht und kann den Bach folglich nicht abschirmen; ein
Tipp durch die Brücke hindurch landet im Wasser (A9).

Im Einrichten-Modus passiert nichts: der `pointerup`-Handler verlässt den
`if (edit)`-Zweig nie (`js/game.js:998-1017`), die Bach-Prüfung liegt danach.

### 2. `saveNow()` — der synchrone Flush

Neben dem entprellten `save()` (`js/game.js:37-42`) entsteht ein zweiter
Einstieg, der **jetzt** schreibt. Beide teilen sich denselben Rumpf, damit die
Wallpaper-Bereinigung nicht zweimal existiert:

```js
let saveT = 0;
/* Schreibt den Spielstand sofort. save() entprellt um 300 ms — wer die Seite
   verlässt, verliert damit die letzte Änderung, weil der setTimeout mit dem
   Dokument stirbt. Vor jeder Navigation deshalb saveNow(). */
function saveNow() {
  clearTimeout(saveT); saveT = 0;
  try {
    const wallpaper = {};
    for (const k in state.wallpaper) { const wp = state.wallpaper[k]; if (wp && typeof wp === 'object' && Object.keys(wp).length) wallpaper[k] = wp; }
    localStorage.setItem('wipfelkratzer-v1', JSON.stringify({ ...state, wallpaper }));
  } catch (e) {}
}
const save = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); };
```

Zusätzlich als Netz für alle übrigen Wege aus der Seite (Zurück-Taste,
Tab schliessen, Wechsel zum Startbildschirm):

```js
addEventListener('pagehide', saveNow);
```

`pagehide` statt `beforeunload`: `beforeunload` ist auf mobilen Browsern
unzuverlässig und unterdrückt dort teils den bfcache — `pagehide` feuert auch
beim Wechsel in den bfcache und ist auf iOS Safari der einzige verlässliche
Haken.

### 3. Die Rückfrage

Ein Tipp auf das Wasser öffnet eine Tafel im bestehenden Stil der Dialoge
(`.panel`, wie `#intro` `index.html:236-244` und `#residents`):

```
Zum Bach hinunter?

Du kommst zu «Splashdown!» — dem Wasserrutschen-Rennen.
Dein Wipfelkratzer bleibt gespeichert und wartet auf Dich.

[ Ja, rutschen! ]   [ Lieber hier bleiben ]
```

Warum überhaupt eine Rückfrage: die Trefferfläche ist gross (das Wasserband
zieht sich über die ganze Szene) und liegt direkt neben der Biberburg, die
schon antippbar ist (`js/game.js:1029`). Ein Fehltipp würde ein Kind ohne
Vorwarnung aus seinem halbfertigen Turm in ein anderes Spiel werfen. Der
zusätzliche Tipp ist der Preis dafür, dass das nicht passiert (A3).

«Ja, rutschen!» ruft `saveNow()`, dann `sfx.splash()`, dann die Navigation.
«Lieber hier bleiben» schliesst die Tafel — und ist der Standard-Fokus.

### 4. Der Hinweg trägt den Rückweg mit

```js
/* Splashdown liegt unter derselben Domain in einem anderen Pfad. Der
   Rückweg wird als Parameter mitgegeben; Splashdown darf ihn heute noch
   ignorieren (siehe Spec, Abschnitt «Abhängigkeit»). */
const SPLASHDOWN_URL = 'https://github.freaxnx01.ch/game-splashdown/';
function gotoSplashdown() {
  saveNow();
  const back = new URL('.', location.href).href;      /* ohne Query/Hash */
  location.href = SPLASHDOWN_URL + '?zurueck=' + encodeURIComponent(back)
    + '&zurueck-name=' + encodeURIComponent('Wipfelkratzer');
}
```

Gleicher Tab, nicht `target="_blank"`: das Publikum sind Kinder auf einem
Tablet, und Tab-Verwaltung ist nichts, was ein Kind tut. Ein zweiter Tab wäre
für einen Erwachsenen die bequemste Lösung und für die Zielgruppe die
schlechteste (A6).

`new URL('.', location.href)` liefert das Verzeichnis der aktuellen Seite —
also `https://github.freaxnx01.ch/game-wipfelkratzer/` in Produktion und
`http://127.0.0.1:<port>/` beim lokalen Prüfen, ohne dass eine Adresse fest im
Code steht.

### 5. Der Rückweg in Splashdown — eigenes Issue, eigenes Repo

**Vertrag** (gehört als eigenes Issue nach `freaxnx01/game-splashdown`, dieses
Issue hängt daran):

> Splashdown liest beim Laden `?zurueck=<URL>` und optional
> `?zurueck-name=<Text>`. Ist der Parameter da **und** zeigt die URL auf
> dieselbe Herkunft (`location.origin`), erscheint in der bestehenden
> `#game-nav`-Leiste (`index.html:890-896`) ein zusätzlicher Eintrag
> «← Zurück zum &lt;Name&gt;» vor «More Games…». Fehlt der Parameter oder
> besteht er die Herkunftsprüfung nicht, ändert sich nichts.

Drei Punkte an diesem Vertrag sind nicht verhandelbar:

1. **Herkunftsprüfung ist Pflicht.** Ein `?zurueck`-Parameter, der ungeprüft
   in ein `href` wandert, ist eine offene Weiterleitung: jeder könnte einen
   Splashdown-Link verschicken, der einen fremden Link auf der Seite
   platziert. Erlaubt ist ausschliesslich `new URL(p, location.href).origin
   === location.origin`.
2. **Der Name wird als Text gesetzt** (`textContent`), nie als HTML, und auf
   eine Länge geklemmt (z. B. 24 Zeichen).
3. **Die `#game-nav`-Leiste ist der Ort.** Dort steht der Navigationskram
   schon heute — ein zweiter, eigener Zurück-Knopf mitten im Spielbild wäre
   ein neues Bedienelement für dieselbe Sache.

Bis dieses Issue umgesetzt ist, ist der Rückweg die Zurück-Taste des Browsers
und der bestehende «More Games…»-Link auf den Hub
(`game-splashdown/index.html:893`), von dem aus die Wipfelkratzer-Karte einen
Klick entfernt ist. Der Wipfelkratzer-Teil bleibt also auch allein sinnvoll
(A5).

### 6. Rückkehr in den Wipfelkratzer

Beim Zurückkommen lädt `index.html` neu und liest `wipfelkratzer-v1`
(`js/game.js:36`) — der Turm steht wieder, samt Stockwerken, Möbeln, Tapeten
und Fotos. Was **nicht** wiederkommt, weil es nie gespeichert wurde:

- Kamerastand und Blickrichtung (`js/game.js:54-57` setzen sie bei jedem Start
  neu),
- ein offener Einrichten-Modus,
- der Meldungsstapel,
- der Startbildschirm ist wieder da (`#intro`, `index.html:236`), das Kind
  tippt einmal auf «Los geht's!».

Das ist hinnehmbar, aber es ist eine sichtbare Unterbrechung — und es ist der
Grund, warum die Rückfrage aus Abschnitt 3 nicht wegoptimiert werden sollte.

### 7. Gemeinsamer `localStorage` — die Warnung, ausbuchstabiert

Beide Spiele liegen unter `https://github.freaxnx01.ch` in verschiedenen
Pfaden. Der `localStorage` gehört der **Herkunft**, nicht dem Pfad — die
beiden Spiele teilen ihn sich also vollständig. Bestandsaufnahme:

| Schlüssel | Wer | Beleg |
| --- | --- | --- |
| `wipfelkratzer-v1` | Wipfelkratzer, Spielstand | `js/game.js:36, 41, 896` |
| `wipfelkratzer-fotos` | Wipfelkratzer, Fotogalerie | `js/game.js:1137-1138` |
| `splashdown-best` | Splashdown, Rekord | `game-splashdown/index.html:593, 819` |

Die Namen kollidieren nicht, und dieses Issue legt **keinen** neuen Schlüssel
an (A7). Die reale Gefahr ist nicht der Name, sondern das **Kontingent**: die
Fotogalerie legt JPEGs als Data-URL ab und kann die ~5 MB der Herkunft allein
füllen — `savePhotos()` fängt das ab und meldet «Die Galerie ist voll»
(`js/game.js:1138`). Ist das Kontingent erschöpft, wirft auch Splashdowns
`localStorage.setItem('splashdown-best', …)`
(`game-splashdown/index.html:819`). Dort steht ein `try/catch` drumherum, also
stürzt nichts ab — Splashdown verliert still seinen Rekord. Das ist die
Konsequenz, die jeder kennen muss, der später einen weiteren Schlüssel
anlegen will: **jedes Spiel unter dieser Domain teilt sich ein Budget mit der
Fotogalerie des Wipfelkratzers.**

Empfehlung als Konvention, festgehalten für später: neue Schlüssel werden mit
dem Repo-Namen präfixiert (`wipfelkratzer-…`, `splashdown-…`), so wie es beide
Spiele heute schon tun.

## Abhängigkeit

Dieses Issue hängt an einem noch anzulegenden Issue in
`freaxnx01/game-splashdown`:

> **feat(nav): `?zurueck`-Parameter zeigt einen Rückweg in der Navigationsleiste**
>
> Splashdown wird künftig aus anderen Spielen heraus aufgerufen (zuerst aus
> `game-wipfelkratzer`, Issue #46). Der Aufrufer hängt `?zurueck=<URL>` und
> optional `?zurueck-name=<Text>` an. Splashdown soll daraus einen Eintrag
> «← Zurück zum &lt;Name&gt;» in `#game-nav` (`index.html:890-896`) bauen —
> **nur**, wenn die URL dieselbe Herkunft hat wie die Seite selbst
> (offene Weiterleitung sonst), der Name als `textContent` und auf 24 Zeichen
> geklemmt. Ohne Parameter ändert sich nichts.

Der Wipfelkratzer-Teil wird **nicht** zurückgehalten, bis das umgesetzt ist
(A5).

## Assumptions

- **A1** [high] Trefferfläche ist das mittlere, 3.6 breite Wasserband
  (`js/game.js:100`), nicht das Sandufer (5.6, `js/game.js:99`) und nicht der
  helle Streifen (1.5, `js/game.js:101`). Verworfen: eine eigene, unsichtbare
  Box über dem Bach — eine zweite Geometrie, die bei jeder Änderung an
  `riverZ` (`js/game.js:86`) nachgezogen werden müsste, während das Band
  ohnehin exakt dem Verlauf folgt.
- **A2** [high] Vor der Navigation wird mit `saveNow()` synchron geschrieben,
  plus `pagehide` als Netz. Verworfen: sich auf das bestehende `save()`
  verlassen — es ist um 300 ms entprellt (`js/game.js:37-42`), und der
  `setTimeout` stirbt mit dem Dokument. Die Annahme im Issue-Text
  («passiert ohnehin bei jeder Änderung») ist damit am Code widerlegt.
- **A3** [med] Der Tipp öffnet eine Rückfrage, statt sofort zu navigieren.
  Verworfen: direkt springen — die Trefferfläche zieht sich über die ganze
  Szene und liegt neben der antippbaren Biberburg (`js/game.js:1029`); ein
  Fehltipp risse ein Kind ohne Vorwarnung aus seinem Turm.
- **A4** [med] Der Rückweg wird als Query-Parameter `?zurueck` übergeben.
  Verworfen: (a) `document.referrer` in Splashdown auswerten — leer, sobald
  eine Referrer-Policy greift, und nicht steuerbar; (b) `history.back()` —
  scheitert, wenn Splashdown als erste Seite eines Tabs geöffnet wird;
  (c) ein gemeinsamer `localStorage`-Schlüssel als Rückkanal — legt genau die
  geteilte Ablage an, vor der das Issue warnt, und wird schal, wenn jemand
  Splashdown später direkt aufruft.
- **A5** [high] Der Wipfelkratzer-Teil wird ausgeliefert, bevor das
  Splashdown-Issue umgesetzt ist; Splashdown ignoriert unbekannte
  Query-Parameter heute vollständig (kein Parser vorhanden,
  `game-splashdown/index.html`). Verworfen: beide Repos gleichzeitig ändern —
  dieses Issue kann `game-splashdown` nicht mitliefern, und ein blockiertes
  Issue wäre für ein Kind kein Fortschritt.
- **A6** [med] Navigation im **selben** Tab. Verworfen: (a)
  `target="_blank"` — auf dem Tablet müsste ein Kind Tabs verwalten;
  (b) `<iframe>` — zwei WebGL-Kontexte gleichzeitig, doppelte Tonausgabe,
  und Splashdowns `#game-nav` läge im Rahmen gefangen.
- **A7** [med] Es entsteht **kein** neuer `localStorage`-Schlüssel.
  Verworfen: ein Schlüssel «kommt gerade von Splashdown zurück» für eine
  Willkommen-zurück-Meldung — mehr geteilter Speicher für eine Meldung, die
  niemand bestellt hat.
- **A8** [low] Der ganze Bachverlauf ist antippbar, auch weit ausserhalb der
  Turmumgebung (`riverZ` läuft von x = −60 bis 60, `js/game.js:88-89`).
  Verworfen: den Treffer auf |x| < 22 begrenzen — eine unsichtbare Grenze im
  Wasser, die genau dann irritiert, wenn ein Kind die Kamera gedreht hat.
- **A9** [low] Ein Tipp durch die Brücke hindurch (`js/game.js:126`) landet im
  Bach. Verworfen: die Brücke als Abschirmung in die Trefferliste aufnehmen —
  sie ist ein Weg über den Bach und kein Hindernis davor, und sie ist nur
  sichtbar, wenn `state.bridge` gesetzt ist.
- **A10** [low] Der Text der Tafel nennt Splashdown beim Namen und sagt
  ausdrücklich, dass der Turm gespeichert bleibt. Verworfen: ein knappes
  «Weiter?» — die Sorge, den Turm zu verlieren, ist genau die, die ein Kind
  vom Antippen abhält.
- **A11** [low] `pagehide` statt `beforeunload` als Netz. Verworfen:
  `beforeunload` — auf mobilen Browsern unzuverlässig und bfcache-feindlich.

## Consequences

- **Der Bach wird zum Ausgang aus dem Spiel.** Das ist neu: bisher führte
  nichts im 3D-Bild aus dem Wipfelkratzer heraus (die `#game-nav`-Leiste,
  `index.html:253-262`, steht ausserhalb der Szene).
- **Der Rückweg ist erst vollständig, wenn das Splashdown-Issue umgesetzt
  ist.** Bis dahin führt er über Zurück-Taste bzw. «More Games…» — das
  funktioniert, ist aber nicht der versprochene Knopf.
- **Der Rücksprung verliert Kamerastand, Einrichten-Modus und den
  Meldungsstapel**; der Startbildschirm erscheint erneut. Der Turm selbst
  bleibt vollständig erhalten.
- **`saveNow()` ist ein zweiter Schreibpfad.** Wer später am Spielstandformat
  arbeitet, muss beide Einstiege im Blick haben — sie teilen sich zwar den
  Rumpf, aber `save()` ist nicht mehr die einzige Tür.
- **`pagehide` schreibt auch ohne Navigation zum Bach**, etwa beim Wechseln
  des Tabs. Das ist ein zusätzlicher, seltener `localStorage`-Schreibvorgang.
- **Die Trefferliste der Interaktion wächst** (`js/game.js:1023`) und damit
  der Aufwand pro Tipp um ein Band mit 64 Segmenten (`js/game.js:88`). Ein
  Raycast pro Tipp, nicht pro Frame — nicht messbar.
- **Zwei Repos bleiben aneinander gekoppelt.** Ändert sich Splashdowns
  Adresse, bricht der Hinweg; ändert sich der Parametername, bricht der
  Rückweg. Beides steht künftig an genau einer Stelle je Repo.
- **Das Speicherkontingent ist geteilt.** Wer die Fotogalerie vollmacht,
  nimmt Splashdown die Fähigkeit, seinen Rekord zu sichern
  (`game-splashdown/index.html:819`).

## Acceptance Criteria

- [ ] Ein Tipp auf das blaue Wasser des Bachs öffnet eine Tafel mit der Frage,
      ob es zu Splashdown gehen soll.
- [ ] Ein Tipp auf das Sandufer neben dem Wasser öffnet die Tafel **nicht**.
- [ ] Ein Tipp auf Willis Biberburg zeigt weiterhin ihre Sprechblase
      (`js/game.js:1029`) und öffnet die Tafel nicht, obwohl die Burg im Bach
      steht.
- [ ] Im Einrichten-Modus löst ein Tipp in Richtung Bach die Tafel nicht aus.
- [ ] «Lieber hier bleiben» schliesst die Tafel; die Seite bleibt, wo sie war,
      und der Spielstand ist unverändert.
- [ ] «Ja, rutschen!» führt auf
      `https://github.freaxnx01.ch/game-splashdown/` mit den Parametern
      `zurueck` (die Wipfelkratzer-Adresse, URL-kodiert) und `zurueck-name`.
- [ ] **Ein Möbel platzieren und sofort — innerhalb von 300 ms — auf
      «Ja, rutschen!» tippen: der Spielstand im `localStorage` enthält das
      neue Möbel.** (Ohne `saveNow()` schlägt genau dieser Punkt fehl.)
- [ ] Nach der Rückkehr auf die Wipfelkratzer-Adresse steht der Turm mit allen
      Stockwerken, Möbeln und Tapeten wieder da.
- [ ] Es wird kein neuer `localStorage`-Schlüssel angelegt; nach dem
      vollständigen Ablauf enthält die Ablage genau `wipfelkratzer-v1`,
      `wipfelkratzer-fotos` (sofern Fotos existieren) und `splashdown-best`
      (sofern in Splashdown gespielt wurde).
- [ ] Der Wechsel des Browser-Tabs schreibt den Spielstand (`pagehide`), ohne
      dass eine Fehlermeldung in der Konsole erscheint.
- [ ] `version.js` ist unverändert; der Changelog-Eintrag steht unter
      `## [Unreleased]`.
- [ ] In `game-splashdown` wurde **nichts** geändert; der Vertrag für den
      Rückweg ist als eigenes Issue dort festgehalten und in diesem Repo
      dokumentiert.
- [ ] Die Seite lädt über den gesamten Ablauf mit null `pageerror`-Ereignissen.
