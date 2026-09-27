# Design — Zweisprachig de/en über das gemeinsame `i18n.js` (Issue #107)

**Status:** validiert (Quick-Mode, ohne Rückfragen)
**Issue:** https://github.com/freaxnx01/game-wipfelkratzer/issues/107
**Datum:** 2026-09-27

> **Hinweis zu Zeilennummern.** Dieser Entwurf entstand, während rund zehn
> `ai-implement`-Läufe parallel auf `main` schreiben. Alle `datei:zeile`-Belege
> stammen vom Stand `ebd1d33` und **können verschoben sein**. Jede Zeilenangabe
> vor dem Anfassen mit `grep` auf das genannte Symbol nachprüfen — die Symbole
> (`flLabel`, `setNight`, `updateActionBtn`, …) sind der eigentliche Anker,
> nicht die Zahl.

## Das Problem

Das Spiel ist durchgehend einsprachig deutsch. `CLAUDE.md` verlangt im
Abschnitt „Localization (i18n)" für Spiele mit nennenswertem UI-Text `de`
**und** `en`, ausgeliefert über das gemeinsame `i18n.js`. Der Carve-out für
„pure-arcade games with negligible on-screen text" greift hier nicht:
Wipfelkratzer hat eine Menüleiste, ein Extras-Menü, acht Dialoge, einen
Katalog, 47 Toast-Meldungen und Sprechblasen für Willi, die Biberburg, Móki
und jedes Tier im Turm.

Belegt am Stand `ebd1d33`:

- `i18n.js` existiert im Repo nicht; kein Treffer für `GG_LANG`, `ggSetLang`
  oder `gg-langchange` ausserhalb von `docs/`.
- `index.html:488` lädt nur `./version.js`; die Zeile
  `<script src="./i18n.js"></script>` daneben fehlt.
- `index.html:2` steht auf `<html lang="de">`, fest verdrahtet.

Dazu kommt der repo-übergreifende Effekt: alle `game-*`-Spiele liegen unter
derselben Origin `github.freaxnx01.ch`, teilen sich also den
`localStorage`-Schlüssel `gg-lang`. Wer in einem anderen Spiel `EN` gewählt
hat, bekommt hier heute trotzdem Deutsch — das Spiel ignoriert eine Wahl, die
längst getroffen ist.

## Zwei Vorabklärungen aus dem Issue

**1. Gibt es eine `#game-nav`-Leiste?** Ja, `index.html:489-499` — statisches
Markup mit Versions-Badge, „More Games…", „Source", „Feedback" und dem
GitHub-Star-Button.

**2. Ist sie Framework-verwaltet?** Nein. Wipfelkratzer ist **kein**
dc-tool-Spiel: kein `data-dc-script`, kein `type="text/x-dc"`, kein
`support.js`, kein React. Gerendert wird mit three.js r184 als ES-Modul
(`index.html:486`, `js/game.js`), three fasst nur das `<canvas>` in
`#scene` an und nie das DOM darum herum. Damit gilt der **Normalfall** der
Konvention: `i18n.js` wird wortgleich übernommen, und `injectToggle()` darf
den Knopf selbst in `#game-nav` einhängen. Der Sonderweg „statischer
EN/DE-Knopf im Markup" aus dem Abschnitt „Framework-managed `#game-nav`" ist
hier ausdrücklich **nicht** nötig.

## Der Zuschnitt — was in diesem Issue steckt und was nicht

Der Umfang einer vollständigen Übersetzung liegt bei grob 250 Zeichenketten,
verteilt über vier Dateien. Das in einem Zug zu machen wäre ein Diff, den
niemand mehr prüfen kann, und ein Rückbau bei einem Fehler träfe das ganze
Spiel. Deshalb liefert **dieses** Issue die Tragschicht plus eine erste,
in sich abgeschlossene Scheibe; der Rest folgt als eigene Issues.

### In diesem Issue (#107)

**T — Tragschicht**

- `i18n.js` wortgleich aus `CLAUDE.md` übernehmen, in `index.html` direkt nach
  `version.js` laden.
- Neues ES-Modul `js/strings.js` mit der Tabelle `EN` und der Funktion `t()`.
- Ein Applier, der das statische Markup übersetzt, und ein
  `gg-langchange`-Listener, der ihn plus die JS-gesetzten Beschriftungen neu
  anwirft — ohne Reload.
- `<html lang>` und `document.title` folgen der Sprache.

**S1 — Erste Scheibe: die Bedienoberfläche („Chrome")**

Alle sichtbaren Texte in `index.html` **ausser** `#game-nav`, plus genau die
JS-Beschriftungen, die zu denselben Knöpfen gehören:

| Gruppe | Ort | ca. |
|---|---|---|
| Intro-Bildschirm | `index.html:465-479` | 10 |
| HUD (Titel, Nüsse, Stockwerk-Zähler) | `index.html:297-300` | 3 |
| Hauptleiste | `index.html:305-315` | 9 |
| Extras-Menü | `index.html:317-325` | 7 |
| Einrichte-Leiste | `index.html:327-333` | 4 |
| Besuchsleiste | `index.html:335-343` | 6 |
| Auswahlleiste (inkl. `aria-label`) | `index.html:345-358` | 9 |
| Dialog-Überschriften und -Knöpfe (Katalog, Bewohner, Einfügen, Bach, Tiere, Galerie, Schreinerei, Türme, Wipfkea) | `index.html:361-460` | ~28 |
| Toast-Sammelknopf | `index.html:462` | 1 |
| Umschalt-Beschriftungen im JS: `btn-build`, `btn-cutaway`, `btn-night`, `btn-music` | `js/game.js:897,1116,1871,2000` | 8 |
| Jahreszeit-Namen (Beschriftung von `btn-season`) | `js/models.js:28-48` | 4 |
| Etagenkürzel `flLabel` (`E` → `G`) | `js/game.js:40` | 1 |
| Einrichte-Leisten-Titel (`edit-title` bzw. `setzeEditLeiste`) | `js/game.js:1147-1170` | 3 |

Zusammen rund **95** Zeichenketten. Das ist die Menge, die ein Kind vom
Startbildschirm bis zum ersten eingerichteten Raum sieht, und sie hängt fast
vollständig an einer Datei.

### Ausdrücklich später (je ein eigenes Issue)

- **S2 — Meldungen und Tipps.** Die 47 `toast(...)`-Aufrufe und das
  `TIPS`-Array (`js/game.js:2011-2016`) samt der Tipp-Logik
  (`js/game.js:2017-2024`). Viele davon sind Vorlagen mit eingesetzten Werten
  (`js/game.js:1025`, `1360`, `2021`) und brauchen eine Platzhalterform — das
  ist eigene Arbeit, nicht nur Vokabular.
- **S3 — Katalog und Materialien.** `CATALOG`, `CATS`, `FURN_COLORS`,
  `BUILD_SHAPES`, `BUILD_WIDTHS`, `WALLS`, `FLOORS` in `js/models.js`
  (~66 `name:`-Felder) und die `ACTIONS`-Beschriftungen für `#btn-action`
  (`js/game.js:1462-1467`).
- **S4 — Tiere und Dialoge.** `PHRASES`, `DAM_TEXTS`, `MOKI_TEXTS`, die
  Aussichts-Erzählungen, `TENANTS`, `TENANT_WISHES`, `HOUSEHOLDS`,
  `FIRSTNAMES`/`SURNAMES` und `tenantTalk()`. Hier steckt die
  Grammatikfrage (Singular/Plural im Wunschsatz, `js/game.js:88`), also der
  unangenehmste Teil — bewusst zuletzt.
- **S5 — Türme, Spielstände, Export.** `js/staende.js`, `js/standdatei.js`,
  Dateinamen und Fehlermeldungen beim Import.
- **Kein** Sprachwechsel im Spielstand. `gg-lang` ist eine
  Browser-Einstellung, kein Teil eines Turms.
- **Keine** Übersetzung von `#game-nav` („More Games…", „Source",
  „Feedback") — das ist Konventionstext und schon englisch.
- **Keine** dritte Sprache, keine Regionsformate, keine Pluralbibliothek.

### Nie

**Vom Spieler eingegebene Texte werden nicht übersetzt.** Das sind
Spielerdaten: die Raumnamen aus #103 (`state.roomNames`), importierte
Turmnamen aus `js/staende.js`, die Namen selbstgebauter Möbel
(`state.designs[].name`, `js/game.js:1025`). Sie gehen gar nicht erst durch
`t()`, sondern werden weiterhin direkt eingesetzt.

## Die Lösung

### 1. `i18n.js` — wortgleich, nichts eigenes

Die Datei aus `CLAUDE.md` wird **unverändert** übernommen, inklusive
`btn.blur()` (das Spiel hat Tastaturbedienung: Pfeiltasten, `PageUp`/
`PageDown`, `Delete` in `js/game.js:2295-2307` — ein fokussierter Knopf wäre
genau die Falle, vor der die Konvention warnt). Geladen wird sie als
klassisches Skript direkt neben `version.js`:

```html
<script src="./version.js"></script>
<script src="./i18n.js"></script>
```

Beide stehen **vor** `#game-nav` im Markup, also ist `document.readyState`
zu dem Zeitpunkt `loading`, und `injectToggle()` läuft auf `DOMContentLoaded`
— die Leiste existiert dann. `js/game.js` ist ein Modul und damit ohnehin
aufgeschoben, `window.GG_LANG` steht also fest, bevor eine Zeile Spiellogik
läuft.

### 2. `js/strings.js` — nur Englisch in der Tabelle

Der springende Punkt: **Deutsch steht schon im Spiel.** Eine zweite deutsche
Kopie in einer `STRINGS.de`-Tabelle wäre eine Dublette, die bei jeder
Textänderung auseinanderläuft — und in einem Repo, in dem gerade zehn Läufe
parallel Texte anfassen, läuft sie garantiert auseinander.

Deshalb kehrt dieser Entwurf das Muster aus `CLAUDE.md` um, ohne seine
Schnittstelle (`t(key)`, `gg-langchange`, `gg-lang`) zu ändern:

- Für **statisches Markup** ist Deutsch das, was im HTML steht. Der Applier
  liest es beim Start einmal aus dem DOM und merkt es sich als `de`-Wert.
- Für **JS-erzeugte Texte** trägt die Tabelle beide Sprachen, weil es kein
  DOM gibt, aus dem man Deutsch lesen könnte.
- `t(key)` fällt auf **Deutsch** zurück, nicht auf Englisch — die
  Ursprungssprache dieses Spiels ist Deutsch. Ein Schlüssel ohne
  `en`-Eintrag zeigt also den deutschen Satz, nie den rohen Schlüssel.

```js
/* js/strings.js — Deutsch ist der Text im Spiel; hier steht nur Englisch. */
export const EN = {
  'toolbar.catalog': 'Furnish',
  'toolbar.extras': 'Extras',
  /* … */
};

const DE = {};                       /* vom Applier beim Start befüllt */
export function rememberDe(key, text) { if (!(key in DE)) DE[key] = text; }

export function t(key, vars) {
  const roh = (window.GG_LANG === 'en' ? EN[key] : DE[key]) ?? DE[key] ?? EN[key] ?? key;
  return vars ? roh.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? '')) : roh;
}
```

Die Platzhalterform `{n}` ist bereits eingebaut, obwohl S1 sie nur an drei
Stellen braucht (HUD-Zähler, Bauknopf, Einrichte-Titel). S2 lebt praktisch
nur davon — sie jetzt festzulegen erspart der nächsten Scheibe eine
Schnittstellenänderung.

### 3. Der Applier für statisches Markup

Vier Attribute, mehr nicht:

| Attribut | wirkt auf |
|---|---|
| `data-i18n` | `textContent` |
| `data-i18n-title` | `title` |
| `data-i18n-aria` | `aria-label` |
| `data-i18n-placeholder` | `placeholder` |

```js
const ZIELE = [['data-i18n', null], ['data-i18n-title', 'title'],
               ['data-i18n-aria', 'aria-label'], ['data-i18n-placeholder', 'placeholder']];

export function applyStatic(wurzel = document) {
  for (const [attr, ziel] of ZIELE)
    for (const el of wurzel.querySelectorAll(`[${attr}]`)) {
      const key = el.getAttribute(attr);
      rememberDe(key, ziel ? el.getAttribute(ziel) : el.textContent);
      const wert = t(key);
      if (ziel) el.setAttribute(ziel, wert); else el.textContent = wert;
    }
}
```

**Bedingung an die Auszeichnung:** ein `data-i18n` darf nur an Elementen
hängen, deren Inhalt das Spiel **nicht** selbst überschreibt, und deren Inhalt
ein einzelner Textknoten ist. Elemente mit eingebetteten `<span>`s —
`#nutrow` (`index.html:299`) und `#floorinfo` (`index.html:300`) — bekommen
**kein** `data-i18n`; ihre Wortstellung ist im Englischen anders
(„Ground floor + 0 of 10 storeys"), sie werden deshalb als Vorlage neu
aufgebaut:

```js
$('floorinfo').textContent = t('hud.floors', { n: state.floors, max: MAXF });
/* de: 'Erdgeschoss + {n} von {max} Stockwerken'  en: 'Ground floor + {n} of {max} storeys' */
```

Weil `de` für Vorlagen nicht aus dem DOM lesbar ist, stehen diese wenigen
Schlüssel **mit beiden** Sprachen in `js/strings.js` — dafür gibt es neben
`EN` ein kleines `DE_VORLAGEN`, das `rememberDe` beim Start einspeist. Es
bleibt der einzige Ort mit deutschem Text in der Tabelle.

### 4. Neu zeichnen beim Sprachwechsel

```js
window.addEventListener('gg-langchange', () => {
  document.documentElement.lang = window.GG_LANG;
  document.title = t('app.title');
  applyStatic();
  refreshChrome();     /* Bauknopf, Wände weg, Tag/Nacht, Musik, Jahreszeit,
                          HUD-Zähler, Einrichte-Titel, Besuchstitel */
});
```

`refreshChrome()` ruft die vorhandenen Aktualisierer auf (die Zeile
`js/game.js:897`, `js/game.js:1116`, `js/game.js:1871`, `js/game.js:2000`,
`js/game.js:1910`) — es entsteht keine zweite Render-Wahrheit. Offene Dialoge
werden von `applyStatic()` miterfasst, weil sie im DOM stehen und nur per
Klasse versteckt sind.

### 5. `#btn-season` und `flLabel`

Die Jahreszeit-Namen stehen in `js/models.js:28-48` als `name:`-Feld. Statt
das Feld anzufassen (das wäre S3), bekommt `SEASONS` ein zusätzliches
`key: 'season.spring'` usw.; `js/game.js:1910` schreibt dann
`t(SEASONS[i].key)`. `name` bleibt als deutscher Wert stehen und wird über
`rememberDe` eingespeist — das ist genau die Brücke, die S3 später für den
ganzen Katalog wiederverwendet.

`flLabel` (`js/game.js:40`) liefert `'E'` für das Erdgeschoss. Englisch ist
das `'G'`; die Zahlen bleiben Zahlen.

## Verhältnis zu #103 (in Arbeit)

#103 („Wohnungen anschreiben können") trägt das Label `ai-implement` und
läuft **gerade**. Es fasst genau die Stelle an, die S1 auch braucht:

- Es ersetzt die drei `$('edit-title').textContent`-Zuweisungen
  (`js/game.js:1147-1170`) durch eine Funktion `setzeEditLeiste(k)`.
- Es fügt ein `<input id="edit-name" placeholder="Wohnung anschreiben">` und
  die Titel `'Spielplatz einrichten'` / `'Dachterrasse einrichten'` ein.

Daraus folgt für #107 **kein** Konflikt, sondern eine Reihenfolge:

1. Der Zeichenkettensatz von S1 ist **nicht eingefroren**. Die Umsetzung von
   #107 rebased vor Task 1 auf `origin/main` und nimmt als Bestand, was dann
   dort steht.
2. Ist #103 dann gelandet, lokalisiert #107 `setzeEditLeiste()` statt der drei
   alten Zuweisungen und ergänzt `en`-Einträge für `edit.placeholder`
   („Name this flat"), `edit.garden` und `edit.roof`.
3. Ist #103 dann **noch nicht** gelandet, lokalisiert #107 die drei alten
   Zuweisungen. Das Nachziehen ist dann Sache von #103 — deshalb hält die
   Umsetzung genau dafür eine Zeile im PR-Text fest.
4. **Der Raumname selbst wird nie übersetzt** (siehe „Nie" oben) — nur sein
   Platzhalter und die Titel drumherum.

Allgemein gilt: jede Scheibe nach S1 findet zusätzliche deutsche Literale
vor, die inzwischen dazugekommen sind. Das ist kein Fehler des Plans, sondern
der Normalfall in diesem Repo. Der Fallback auf Deutsch sorgt dafür, dass ein
noch nicht übersetzter Text im EN-Modus als deutscher Satz erscheint statt
als roher Schlüssel — die Zwischenstände sind also gemischtsprachig, aber nie
kaputt.

## Akzeptanzkriterien

1. `i18n.js` liegt wortgleich (Konvention aus `CLAUDE.md`, inkl. `btn.blur()`)
   im Repo-Wurzelverzeichnis und wird in `index.html` direkt nach
   `version.js` geladen.
2. In der Leiste `#game-nav` erscheint ein Knopf `#gg-lang-toggle`, der
   `DE` bzw. `EN` zeigt und beim Klick umschaltet.
3. Ein Klick auf den Knopf übersetzt die Bedienoberfläche aus S1 **ohne
   Reload**: Intro (falls offen), HUD, Hauptleiste, Extras-Menü,
   Einrichte-, Besuchs- und Auswahlleiste, alle Dialog-Überschriften und
   -Knöpfe, der Toast-Sammelknopf.
4. Die Wahl überlebt einen Reload (`localStorage`-Schlüssel `gg-lang`) und
   wird beim ersten Start aus einem bereits gesetzten `gg-lang` bzw. aus
   `navigator.language` übernommen.
5. `document.documentElement.lang` und `document.title` folgen der Sprache.
6. Die JS-gesetzten Umschaltbeschriftungen stimmen in beiden Sprachen:
   `btn-build` (bauend / „Fertig gebaut!"), `btn-cutaway`, `btn-night`,
   `btn-music`, `btn-season`; `flLabel(0)` ist `E` bzw. `G`.
7. Der Stockwerk-Zähler `#floorinfo` und die Nuss-Anzeige `#nutrow` stehen in
   beiden Sprachen in korrekter Wortstellung.
8. Noch nicht übersetzte Bereiche (Toasts, Katalog, Tierdialoge) zeigen im
   EN-Modus weiterhin **deutschen** Text — nie einen rohen Schlüssel.
9. Vom Spieler eingegebene Texte (Raumnamen, Turmnamen, Namen eigener
   Möbelentwürfe) bleiben in beiden Sprachen unverändert.
10. Die Konsole bleibt beim Laden und beim Umschalten frei von `pageerror`.
11. Nach einem Sprachwechsel läuft die Tastaturbedienung normal weiter: ein
    `Enter` oder `Space` direkt nach dem Klick schaltet die Sprache **nicht**
    zurück (`btn.blur()`).
12. `version.js` wird nicht angefasst; kein `package.json`, kein Bundler,
    keine neue Abhängigkeit.

## Verifikation

Buildless-Stack: es gibt keinen Test-Runner. Geprüft wird mit **headless
Playwright im Vordergrund**, nie `run_in_background` — eine
Wegwerf-Sonde unter `.superpowers/` (per `.gitignore` ausgeschlossen), nach
dem Muster von `tools/verify_game_nav.py`. Chromium mit
`--use-gl=swiftshader --enable-unsafe-swiftshader`; erwartete Warnungen
(`THREE.Clock`, `PCFSoftShadowMap`, `GL Driver Message`, 404 auf
`favicon.png`) werden ignoriert, geprüft wird auf `pageerror`.

## Folgen

- Die Oberfläche ist nach #107 **gemischtsprachig**, wenn `EN` gewählt ist:
  Menüs englisch, Toasts und Katalog deutsch. Das ist der Preis der
  Etappierung und in AK 8 bewusst festgeschrieben.
- Ein in einem anderen `game-*`-Spiel gesetztes `gg-lang: en` schlägt ab
  sofort auf Wipfelkratzer durch — für manche Spieler ändert sich die
  Sprache also, ohne dass sie hier etwas angeklickt haben.
- `#game-nav` wird um Trenner und Knopf breiter. Die Leiste ist
  `position: fixed` unten rechts (`index.html:489`); auf schmalen Geräten
  rückt sie näher an die Werkzeugleiste, deren Abstand
  `tools/verify_game_nav.py` aus #32 prüft — dieses Skript gehört nach der
  Änderung einmal gegengelaufen.
- `js/strings.js` ist ab jetzt der Ort, an den jede spätere Scheibe anbaut;
  jedes neue UI-Literal im Repo braucht künftig einen `en`-Eintrag.
- Englische Wörter sind oft länger als deutsche, aber nicht immer — die
  Hauptleiste hat neun Knöpfe und bricht schon heute auf schmalen Geräten um;
  die Verifikation prüft deshalb in beiden Sprachen, dass die Leiste die
  Navileiste nicht überlappt.
