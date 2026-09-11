# Willi baut den Wipfelkratzer

Ein 3D-Bauspiel im Browser für Kinder — inspiriert vom Pixi-Büechli
*«Willi baut»*. Hilf Willi Biber, Stock für Stock einen Holzturm mitten im Wald
hochzuziehen, richte jede Wohnung ein und erfülle den Tieren, die einziehen,
ihre Wünsche.

**Spielen:** <https://github.freaxnx01.ch/game-wipfelkratzer/>

## Spielidee

- **Bauen** — bis zu 10 Stockwerke; jedes wächst mit Hammerschlägen aus der Plattform.
- **Einrichten** — Möbel und Deko aus dem Katalog, mit Pfeiltasten schieben,
  mit Bild↑/Bild↓ drehen.
- **Bewohner** — ab drei Möbeln zieht eine Tierfamilie ein und äussert einen Wunsch.
- **Haselnüsse** — erfüllte Wünsche geben je 3 Haselnüsse.
- **Dach** — ab 10 Stockwerken lässt sich die Dachterrasse mit Pool einrichten
  und eine Dachparty feiern.
- **Extras** — Tag/Nacht, Wände weg (Querschnitt wie im Bilderbuch), Brücke,
  Garten & Spielplatz.

Der Spielstand wird automatisch im `localStorage` gespeichert.

## Technik

Buildless: statisches HTML + ES-Module, keine Abhängigkeiten ausser
[three.js](https://threejs.org) r184 (via Importmap von unpkg, mit SRI-Hashes).
Kein Build-Schritt, kein Backend, keine Asset-Dateien — alle Modelle sind aus
Primitiven gebaut (`js/models.js`), Musik und Sounds sind mit der Web Audio API
synthetisiert.

```
index.html      Seite, UI-Panels, Importmap
js/models.js    Geometrie: Möbel, Tiere, Bäume, Willi, Brücke, Garten
js/game.js      Spiellogik, Szene, Kamera, Audio, Persistenz
```

Lokal starten (ES-Module brauchen einen Server, `file://` genügt nicht):

```sh
python3 -m http.server 8000   # → http://localhost:8000/
```

## Dokumentation

- [`docs/design-handoff.md`](docs/design-handoff.md) — die vollständige
  Design-Spezifikation (Szene, Farben, Interaktionen, Audio)
- [`TODO.md`](TODO.md) — Ideen und offene Punkte
- [`CHANGELOG.md`](CHANGELOG.md)

## Lizenz

[MIT](LICENSE)
