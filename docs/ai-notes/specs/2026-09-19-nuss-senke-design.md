# Spec — Die Nüsse bekommen einen Zweck (Issue #83)

Repo: `game-wipfelkratzer`. Base: `main`, v0.10.0 (`version.js:3`). Buildless
Vanilla, three.js r184 über Importmap. Kein Build-Schritt, kein Test-Runner.

Quelle: Issue #83, aufgefallen beim Entwurf der Waldkarte (#51).

## Problem

`state.nuts` wächst um 3, sobald ein Bewohner seinen Wunsch erfüllt bekommt
(`js/game.js:1659`), und steht im HUD (`js/game.js:878`, `index.html:299`).
**Ausgegeben wird sie nirgends** — eine Suche nach `state.nuts` im ganzen Repo
liefert genau diese zwei Stellen.

Die Nuss ist damit ein Punktestand ohne Senke. Das Spiel sagt einem Kind
«Wunsch erfüllt! +3 Haselnüsse» und löst das Versprechen nie ein.

## Die Rechnung, die den Entwurf bestimmt

Nicht Geschmack, sondern Arithmetik schliesst die naheliegende Lösung aus.

**Das Einkommen ist winzig.** Jedes Stockwerk hat genau einen Bewohner mit
genau einem Wunsch zu 3 Nüssen (`js/game.js:26-40`, `madeTenant`). Ein
Zehner-Turm bringt über die gesamte Spielzeit **33 Nüsse** (Erdgeschoss plus
zehn Etagen), ein Fünfziger 153.

**Die Ausgaben wären riesig.** Ein Tier zieht erst ein, wenn **drei** Objekte
in der Wohnung stehen (`js/game.js:149`). Ein voller Zehner-Turm braucht also
mindestens **33 Möbel** — bei 66 Katalogeinträgen. Möbel einzeln zu bezahlen
ergibt ein Einkommen von genau einem Möbel pro Wohnung, während drei nötig
sind, bevor überhaupt jemand einzieht.

**Und es entstünde eine Sackgasse.** Nüsse kommen ausschliesslich daher, dass
man **das gewünschte Möbel aufstellt** (`checkWishes`, `js/game.js:1655-1661`).
Kostete dieses Möbel etwas, könnte ein Kind ohne Nüsse keine Nüsse verdienen.
Das allein genügt, um jede Form von «Möbel kosten etwas» zu verwerfen.

Was bleibt, sind **wenige, einmalige** Dinge in der Grössenordnung des
Einkommens.

## Entscheidungen

Vom Besitzer am 19.09.2026 entschieden:

- **E1 — Die grossen Extras kosten, die Möbel bleiben gratis.** Verworfen:
  eine Katalog-Kategorie hinter einer Nusszahl (nimmt einem bestehenden
  Spielstand etwas weg, das heute offen ist) und reine Meilenstein-Belohnungen
  ohne Währung (löst das Versprechen ein, beantwortet «wofür sind sie da» aber
  nicht).

- **E2 — Brücke 9, Garten & Spielplatz 15.** Die Brücke ist damit nach dem
  dritten erfüllten Wunsch erreichbar, der Spielplatz nach dem achten;
  zusammen 24 von 33 Nüssen im Zehner-Turm. Verworfen: 6/9 (beides zu früh da,
  der Rest liegt wieder ohne Zweck herum) und 15/24 (zusammen 39 — mehr als
  ein Zehner-Turm hergibt, erzwingt eine Entscheidung; falsche Art Spannung für
  ein Spiel ohne Verlieren und ohne Zeitdruck).

- **E3 — Der Knopf wird nicht gesperrt.** Wer zu wenig Nüsse hat, tippt und
  bekommt erklärt, wie viele noch fehlen. Ein graues Feld sagt einem Kind
  nichts; ein Antippen, das die Spielregel erklärt, bringt sie ihm bei.

## Entwurf

### Die Preise

Eine Datenzeile neben den Extras-Handlern:

```js
/* Möbel bleiben gratis — Nüsse verdient man nur durch Aufstellen des
   Wunschmöbels, ein Preis darauf wäre eine Sackgasse (#83). Bezahlt wird,
   was die Welt verändert. */
const EXTRA_PREIS = { bridge: 9, garden: 15 };
```

### Die beiden Käufe

`#btn-bridge` (`index.html:318`) und `#btn-garden` (`index.html:319`) tragen
den Preis im Text, solange das Extra noch nicht gekauft ist:
«Brücke bauen — 9 🌰». Ist es vorhanden, steht dort wie heute der
Folgetext (`Garten & Spielplatz` führt dann direkt ins Einrichten).

Beim Tippen auf ein noch nicht gekauftes Extra:

- **Genug Nüsse:** `state.nuts -= preis`, danach unverändert der bestehende
  Ablauf — `state.bridge = true` samt Aufbau-Animation bzw. `state.garden`
  mit `GARDEN_DEFAULT` —, dann `updateHUD()` und `save()`.
- **Zu wenig:** es passiert **nichts** ausser einem Hinweis, der die fehlende
  Zahl nennt: «Dafür brauchst Du noch 4 Haselnüsse — erfülle noch einen
  Wunsch!» Kein Zustand ändert sich, kein `save()`.

### Bestehende Spielstände

Wer ein Extra schon hat, behält es: `state.bridge`/`state.garden` sind
gesetzt, die Handler steigen wie heute vorher aus. Keine nachträgliche
Rechnung, keine Rückerstattung. Angesparte Nüsse bleiben erhalten und lassen
sich sofort ausgeben. Wer die Brücke noch nicht hat, muss sie künftig
verdienen — das ist die beabsichtigte Änderung und der einzige Fall, in dem
ein bestehender Stand etwas anders erlebt als vorher.

### Was unberührt bleibt

Die 3 Nüsse pro erfülltem Wunsch, der gesamte Katalog, die Dachparty (das
Finale verkauft man nicht), der «Bewohner-Schild»-Knopf (nur eine Liste), die
Dachterrasse, der Pool als Katalogobjekt. Keine neuen Inhalte, keine neue
Kategorie, keine Änderung am Spielstand-Format — `state.nuts` existiert
bereits.

## Akzeptanzkriterien

- [ ] Solange die Brücke fehlt, steht ihr Preis auf dem Knopf; dasselbe für
      den Spielplatz.
- [ ] Mit zu wenigen Nüssen ändert ein Tipp **nichts**: `state.bridge` bleibt
      `false`, `state.nuts` unverändert, kein Bauwerk erscheint — es kommt nur
      ein Hinweis, der die fehlende Anzahl nennt.
- [ ] Mit genug Nüssen zieht der Kauf den Preis ab, das Bauwerk entsteht wie
      bisher, und das HUD zeigt den neuen Stand.
- [ ] Die Brücke kostet 9, der Spielplatz 15.
- [ ] Ein Spielstand, der ein Extra schon besitzt, wird dafür **nicht**
      belastet; der Knopf verhält sich wie heute.
- [ ] Nach einem Kauf überlebt der Nussstand einen Neuladen.
- [ ] Die Dachparty bleibt kostenlos.
- [ ] Ein Möbel aufzustellen kostet **nichts** — der Katalog ist unverändert
      offen.
- [ ] Kein Test-Framework, kein Bundler, keine `package.json`.
- [ ] Die Konsole bleibt fehlerfrei.

## Prüfung

Buildless — Playwright im Vordergrund gegen `python3 -m http.server`. Der
Nussstand lässt sich über den Debug-Hook setzen (`state.nuts`), die Käufe
laufen über die echten Knöpfe im Extras-Menü, nicht über direkte
Funktionsaufrufe. Die Sonden sind nicht committet.

Der manuelle In-Browser-Playtest bleibt das eigentliche Gate und wird als
offener Posten in der PR-Beschreibung geführt. Bei einer Spielbalance-Frage
zählt er doppelt: ob sich 9 und 15 für ein Kind richtig anfühlen, sagt keine
Sonde.
