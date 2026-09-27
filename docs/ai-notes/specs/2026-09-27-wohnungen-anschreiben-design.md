# Spec — Wohnungen anschreiben können (Issue #103)

Repo: `game-wipfelkratzer`. Base: `main`, v0.11.1 (`version.js:3`). Buildless
Vanilla, three.js über Importmap. Kein Build-Schritt, kein Test-Runner — die
Prüfung ist ein Playwright-Skript unter `tools/` (siehe `CLAUDE.md`,
«Tooling & Testing»).

Quelle: Issue #103, aufgenommen über FlowHub am 27.09.2026. Der ganze
Wortlaut: «Wohnungen anschreiben können: z. B. Musikzimmer».

## Problem

Jede Wohnung im Turm heisst heute nach ihrer Nummer und ihren Bewohnern —
mehr gibt es nicht. Die Aufschrift der Einrichte-Leiste wird an genau einer
Stelle gebaut (`js/game.js:1164`):

```js
$('edit-title').textContent = `${flLabel(k)} — ${tenantIn(k) ? (t.unit || t.name) : 'Wohnung einrichten'}`;
```

`flLabel` ist `i === 0 ? 'E' : String(i)` (`js/game.js:40`), die Bewohner
kommen aus einer festen Liste bzw. werden ab Etage 10 gewürfelt
(`js/game.js:31-44`). Beides ist vorgegeben; das Kind, das die Wohnung
einrichtet, kann nichts daran ändern.

Wer im dritten Stock ein Klavier, einen Notenständer und einen Teppich
hinstellt, hat ein **Musikzimmer** gebaut — das Spiel nennt es weiter «3 —
Familie Eichhorn». Der Wunsch ist, dass der eigene Einfall einen Namen
bekommt und der Turm dadurch der eigene Turm wird.

Genau dieses Muster gibt es im Spiel schon eine Ebene höher: Türme werden in
der Übersicht «Meine Türme» über ein Textfeld benannt (`js/game.js:2506`,
`maxlength="40"`). Was für den ganzen Turm geht, fehlt für die einzelne
Wohnung.

## Was gebaut wird

Ein Textfeld in der Einrichte-Leiste. Man tippt ein Stockwerk an, richtet
ein wie bisher — und kann der Wohnung nebenbei einen Namen geben. Der Name
steht danach überall dort, wo das Spiel die Wohnung benennt: in der
Einrichte-Leiste, beim Hineingehen und auf dem Bewohner-Schild.

Der Name gehört zur Wohnung, nicht zur Familie: zieht später jemand ein,
bleibt «Musikzimmer» stehen.

## Entscheidungen

Im Schnellmodus ohne Rückfrage entschieden; die Begründungen stehen dabei,
damit sie widerlegbar sind.

- **E1 — Nur die nummerierten Stockwerke (`0 … state.floors`) sind
  anschreibbar.** Verworfen: Dachterrasse und Spielplatz mitnehmen. Beide
  sind zwar technisch Räume wie ein Stockwerk (`js/standdatei.js:30`,
  `RAUM_KEYS` enthält `roof` und `garten`), haben aber je genau einen festen
  Namen, den die Leiste ohne Nummer setzt (`js/game.js:1153`, `1156`) — es
  gibt nur eine Dachterrasse, sie zu benennen unterscheidet sie von nichts.
  Der Wortlaut des Issues sagt «Wohnungen». Das Datenfeld wird trotzdem so
  gebaut, dass `roof`/`garten` später ohne Formatwechsel dazukommen können
  (siehe E4).

- **E2 — Der Name ist ein Textfeld direkt in der Einrichte-Leiste, kein
  eigener Dialog und kein `prompt()`.** Verworfen: ein Knopf «Anschreiben»,
  der einen Dialog öffnet. Das Spiel benutzt für genau diese Aufgabe schon
  ein Inline-Textfeld (`js/game.js:2506`, Turmname in «Meine Türme»), und
  `prompt()` kommt im ganzen Spiel nicht vor. Ein Feld, das man sieht und
  antippt, ist für die Zielgruppe der kürzeste Weg; ein Dialog wäre ein
  zweiter Bildschirm für ein einzelnes Wort.

- **E3 — Das Feld ersetzt den Bewohnertext in der Aufschrift nicht, es steht
  daneben.** Die Leiste zeigt `E ·` bzw. `3 ·` als feste Nummer, dann das
  Eingabefeld (Platzhalter «Wohnung anschreiben»), dann — sofern jemand
  eingezogen ist — klein den Bewohnernamen. Verworfen: den Bewohnertext
  durch den eigenen Namen zu ersetzen. Wer eingezogen ist, ist die Auskunft,
  die das Spiel bisher an dieser Stelle gibt (`js/game.js:1164`); sie
  wegzunehmen wäre ein Verlust, den niemand bestellt hat.

- **E4 — Die Namen liegen als `state.roomNames` (Objekt, Schlüssel wie
  `state.rooms`) im Spielstand.** Verworfen: ein Feld `name` an jedem
  Möbeleintrag oder eine Liste parallel zu `state.rooms`. `state.wallpaper`,
  `state.flooring` und `state.tenantPos` sind bereits genau so gebaut —
  Objekt, Raumschlüssel als String, ein Wert pro Raum
  (`js/game.js:107`) — und `bereinigeStand` behandelt sie über dieselbe
  Schleife (`js/standdatei.js:115-135`). Ein vierter Eintrag desselben
  Musters kostet nichts Neues.

- **E5 — Ein leerer Name wird gelöscht, nicht als leerer String
  gespeichert.** Verworfen: `''` stehen lassen. Sonst wächst der Spielstand
  um einen Eintrag pro angetipptem Stockwerk, und jede Abfrage bräuchte
  zusätzlich einen Leertest. Gelöscht heisst: `delete state.roomNames[k]`.

- **E6 — Obergrenze 24 Zeichen, `maxlength` am Feld *und* beim Einlesen
  gekappt.** Verworfen: die 40 des Turmnamens (`js/game.js:2506`). Der
  Turmname steht in einer Karte mit eigener Zeile, dieser hier in einer
  Leiste mit `max-width: 92vw` neben drei Knöpfen (`index.html:83`,
  `327-333`). 24 Zeichen tragen «Musikzimmer», «Werkstatt von Willi» und
  «Omas Wohnzimmer» und sprengen die Leiste auf einem Telefon nicht.

- **E7 — Die Dateiversion `DATEI_V` bleibt bei 2.** Verworfen: auf 3
  erhöhen. `pruefeDatei` weist jede Datei mit `version > DATEI_V` ab
  (`js/standdatei.js:74`), eine Erhöhung würde also jede neu gesicherte
  Datei für die bereits veröffentlichte Version unlesbar machen — für ein
  rein additives, optionales Feld ein zu hoher Preis. Umgekehrt ist es
  gefahrlos: `bereinigeStand` baut aus einer Positivliste neu auf
  (`js/standdatei.js:86-90`), eine ältere Spielversion lässt `roomNames`
  also still fallen, statt daran zu scheitern.

- **E8 — Der Name wird überall als Text gesetzt, nie als HTML.** Die
  Bewohnerliste baut ihre Zeilen heute mit `innerHTML`
  (`js/game.js:1723`). Ein vom Kind eingetippter Name darf dort nicht
  hineininterpoliert werden; die Zeile wird für den Namensteil auf
  `textContent` umgestellt. Das ist keine Vorsichtsmassnahme «für den
  Fall», sondern die einzige Stelle im Spiel, an der Freitext des Spielers
  in `innerHTML` landen würde.

- **E9 — Keine Übersetzung, deutsche Literale wie im übrigen Spiel.**
  Verworfen: `i18n.js` nach der Konvention aus `CLAUDE.md` einführen. Das
  Repo enthält **kein** `i18n.js` und keinen einzigen `GG_LANG`-Zugriff
  (geprüft über `grep -rn "i18n\|GG_LANG" index.html js/`, kein Treffer);
  die gesamte Oberfläche ist einsprachig deutsch, bis hin zu den
  Möbelnamen. Das Spiel zweisprachig zu machen ist ein eigenes Vorhaben mit
  eigenem Issue — es an dieses Textfeld zu hängen wäre ein Umbau der ganzen
  Oberfläche unter falscher Überschrift. **Der vom Spieler eingetippte Name
  ist ohnehin Spielerdaten und wird auch in einem künftig zweisprachigen
  Spiel nie übersetzt**; zu übersetzen wären nur Platzhalter und Titel
  dieses Felds, und die folgen dann demselben Weg wie alle anderen
  Literale.

## Oberfläche

Die Einrichte-Leiste (`index.html:327-333`) bekommt zwischen Aufschrift und
den Knöpfen ein Textfeld:

```html
<div id="editbar" class="panel">
  <span id="edit-nr"></span>
  <input id="edit-name" maxlength="24" placeholder="Wohnung anschreiben"
         title="Gib dieser Wohnung einen Namen">
  <span id="edit-bewohner"></span>
  <button id="btn-roomcopy" class="hidden">Raum kopieren</button>
  …
</div>
```

`#edit-title` entfällt als ein Element und wird zu den drei Teilen `#edit-nr`
(«3 ·»), `#edit-name` (Feld) und `#edit-bewohner` («Familie Eichhorn», klein
und gedämpft). Auf Dachterrasse und Spielplatz bleibt es bei einer einzigen
Aufschrift: `#edit-nr` trägt dort den ganzen Text, Feld und Bewohnerteil sind
versteckt (E1).

Verhalten des Felds:

- `input` → Name übernehmen, `save()` (dieselbe 300-ms-Entprellung wie
  überall, `js/game.js:144`).
- Der Name wird beim Übernehmen `trim()`-t und auf 24 Zeichen gekappt; leer
  → Eintrag löschen (E5).
- Beim Verlassen der Wohnung (`exitEdit`) passiert nichts Zusätzliches; der
  Name ist bereits gespeichert.
- Tastatureingaben im Feld dürfen die Spielsteuerung nicht auslösen. Der
  globale `keydown`-Handler (`js/game.js:2287-2288`) steigt heute nur aus,
  wenn kein Stockwerk eingerichtet oder nichts ausgewählt ist — beim
  Einrichten mit ausgewähltem Möbel bewegen die Pfeiltasten also das Möbel,
  auch wenn der Fokus im Textfeld steht. Der Handler bekommt deshalb einen
  zusätzlichen Frühausstieg, wenn `event.target` ein `INPUT`/`TEXTAREA`
  ist.

## Wo der Name erscheint

| Ort | Heute | Neu |
|---|---|---|
| Einrichte-Leiste (`js/game.js:1164`) | `3 — Familie Eichhorn` | `3 ·` + Feld + `Familie Eichhorn` |
| Besuchsleiste (`js/game.js:1296`) | `3 — Familie Eichhorn` | `3 — Musikzimmer` wenn benannt, sonst wie bisher |
| Bewohner-Schild (`js/game.js:1723`) | `3  Familie Eichhorn` | zusätzlich `· Musikzimmer` hinter dem Bewohner |
| Wunschzettel (`js/game.js:1705`) | `3: … hätte gern …` | unverändert |
| Raum kopieren/einfügen (Toasts, `js/game.js:1360`, `1417`, `1426`) | «Wohnung 3» | unverändert |

Unverändert heisst hier bewusst unverändert: Wunschzettel und Toasts sind
kurze Sätze über eine Handlung, nicht Überschriften über einen Raum. Der Name
wandert **nicht** mit, wenn eine Wohnung kopiert und woanders eingefügt wird
(`js/game.js:1343-1417`) — kopiert wird die Einrichtung, und zwei
«Musikzimmer» im selben Turm wären eine Überraschung, die niemand ausgelöst
hat.

## Daten

```js
/* state (js/game.js:107) */
roomNames: {}            /* '0' … 'MAXF' -> String, 1..24 Zeichen, nie leer */
```

Beim Sichern in eine Datei (`js/standdatei.js`, `bereinigeStand`) wird
`roomNames` wie `wallpaper`/`flooring` behandelt:

- Schlüssel muss in `RAUM_KEYS` liegen, sonst überspringen.
- Wert muss ein String sein; `trim()`, auf 24 Zeichen kappen; leer →
  überspringen.
- Nichts anderes wird übernommen, kein fremder Schlüssel abgeschrieben.

Beim Laden eines alten Spielstands fehlt `roomNames` — das ist der
Normalfall, `Object.assign` über das Startobjekt (`js/game.js:115`) lässt
das leere Objekt stehen. Keine Migration nötig.

## Prüfung (statt Unit-Tests)

Buildless-Stack: es gibt keinen Test-Runner, die Prüfung ist ein
Playwright-Skript im Vordergrund (`CLAUDE.md`). Neu: `tools/verify_raumnamen.py`,
gebaut wie `tools/verify_game_nav.py` (eigener `http.server`, eigener
Prozess-Handle, kein `run_in_background`). Es prüft der Reihe nach:

1. Turm bauen, `window.wipfelkratzer.enterEdit(1)`, Feld ist sichtbar und
   leer, Platzhalter steht.
2. «Musikzimmer» tippen → `wipfelkratzer.state.roomNames['1'] === 'Musikzimmer'`.
3. Seite neu laden → Feld trägt beim erneuten `enterEdit(1)` wieder
   «Musikzimmer» (localStorage).
4. `enterBesuch(1)` → `#besuch-titel` enthält «Musikzimmer».
5. Bewohner-Schild öffnen → Zeile zu Stockwerk 1 enthält «Musikzimmer».
6. Feld leeren → `state.roomNames['1']` ist weg (nicht `''`), Aufschriften
   fallen auf den alten Text zurück.
7. Name `<img src=x onerror="window.__xss=1">` eintippen, Bewohner-Schild
   öffnen → `window.__xss` ist `undefined` und der Text steht wörtlich da.
8. Während der Fokus im Feld ist, Tasten tippen, die sonst das Spiel steuern
   → kein Möbel bewegt sich, keine Aktion feuert.
9. Konsole bleibt fehlerfrei.

## Akzeptanzkriterien

- In der Einrichte-Leiste eines Stockwerks steht ein Textfeld mit dem
  Platzhalter «Wohnung anschreiben».
- Ein eingetippter Name (bis 24 Zeichen) wird sofort gespeichert und
  überlebt einen Seiten-Neuladen.
- Der Name erscheint in der Besuchsleiste und auf dem Bewohner-Schild;
  Nummer und Bewohnername bleiben weiterhin sichtbar.
- Ein geleertes Feld entfernt den Namen wieder und stellt die alten
  Aufschriften her.
- Dachterrasse und Spielplatz zeigen kein Feld, ihre Aufschrift ist
  unverändert.
- Ein gesicherter Turm nimmt die Namen mit; eine eingelesene Datei setzt sie
  wieder — mit Kappung auf 24 Zeichen und ohne unbekannte Raumschlüssel.
- `DATEI_V` bleibt 2; eine ältere Datei ohne `roomNames` lädt unverändert.
- Ein Name, der wie HTML aussieht, wird als Text angezeigt und nicht
  ausgeführt.
- Tasten, die im Namensfeld getippt werden, steuern das Spiel nicht.
- `tools/verify_raumnamen.py` läuft im Vordergrund durch, Konsole
  fehlerfrei.
- `CHANGELOG.md` hat unter `[Unreleased]` einen Eintrag in Spielersprache.

## Nicht in diesem Vorhaben

- Dachterrasse und Spielplatz anschreiben (E1).
- Der Name als Schild im 3D-Turm (Textur/Sprite an der Fassade) — eigenes
  Vorhaben, eigener Aufwand.
- Vorschlagsliste («Musikzimmer», «Küche», …) beim Antippen des Felds.
- Zweisprachigkeit (E9).
