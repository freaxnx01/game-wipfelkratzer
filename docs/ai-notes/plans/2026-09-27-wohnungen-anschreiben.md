# Wohnungen anschreiben — Implementierungsplan (Issue #103)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Spieler kann jeder Wohnung (Stockwerk `0 … state.floors`) einen
eigenen Namen geben — «Musikzimmer» —, der gespeichert wird und in
Einrichte-Leiste, Besuchsleiste und Bewohner-Schild erscheint.

**Architecture:** Ein Textfeld in der bestehenden Einrichte-Leiste schreibt in
ein neues Spielstandsfeld `state.roomNames` (Objekt Raumschlüssel → String,
gebaut wie `state.wallpaper`/`state.flooring`). Drei Anzeigestellen lesen es
über einen einzigen Helfer `raumName(k)`. Die Turmdatei nimmt das Feld über
dieselbe Positivliste mit wie alle anderen Raumfelder.

**Tech Stack:** Vanilla JS (ES-Module), three.js über Importmap, `localStorage`.
**Kein Build-Schritt, kein npm, kein Test-Runner.** Geprüft wird mit Playwright
über `tools/verify_raumnamen.py` — **immer im Vordergrund**, nie
`run_in_background` (siehe `CLAUDE.md`, «Tooling & Testing»).

**Spec:** [`docs/ai-notes/specs/2026-09-27-wohnungen-anschreiben-design.md`](../specs/2026-09-27-wohnungen-anschreiben-design.md)

## Global Constraints

- **Buildless.** Kein `package.json`, kein Bundler, kein `node_modules`, keine
  Framework-Importe. Nur `index.html`, `js/*.js`, `tools/*.py`.
- **Deutsch, echte Umlaute.** Alle sichtbaren Texte deutsch (`ä ö ü`, `ss`
  statt `ß`). Kein `i18n.js` — das Repo hat keines (Spec E9).
- **Obergrenze 24 Zeichen** für einen Wohnungsnamen — `maxlength="24"` am Feld
  **und** `slice(0, 24)` beim Übernehmen und beim Einlesen einer Datei.
- **Leerer Name = kein Eintrag.** `delete state.roomNames[k]`, nie `''`.
- **`DATEI_V` bleibt 2** (`js/standdatei.js:11`). Nicht erhöhen.
- **Spielertext nie als HTML.** Namen werden ausschliesslich über
  `textContent` gesetzt, nie in eine `innerHTML`-Vorlage interpoliert.
- **Nur die nummerierten Stockwerke.** Dachterrasse (`roof`) und Spielplatz
  (`garten`) bekommen kein Feld.
- **Prüfung im Vordergrund.** `python3 tools/verify_raumnamen.py` blockiert;
  grosszügiges Timeout statt Hintergrundlauf.
- **Commits:** Conventional Commits, deutsche Beschreibung im Body, Fussnote
  `Closes #103` erst im letzten Commit.

---

## Dateien im Überblick

| Datei | Rolle | Änderung |
|---|---|---|
| `index.html` | Markup + CSS der Einrichte-Leiste | `#edit-title` wird zu `#edit-nr` + `#edit-name` + `#edit-bewohner`; CSS für das Feld |
| `js/game.js` | Zustand, Leisten, Bewohner-Schild, Tastatur | `state.roomNames`, Helfer, drei Anzeigestellen, `keydown`-Frühausstieg, Debug-Hook |
| `js/standdatei.js` | Dateiformat & Prüfung fremder Dateien | `roomNames` in `bereinigeStand` |
| `tools/verify_raumnamen.py` | Playwright-Prüfung | neu |
| `CHANGELOG.md` | Spielertext | Eintrag unter `[Unreleased]` |

---

### Task 1: Prüfskript-Gerüst + Namensfeld in der Einrichte-Leiste

**Files:**
- Create: `tools/verify_raumnamen.py`
- Modify: `index.html:82-85` (CSS), `index.html:327-333` (Markup)
- Modify: `js/game.js:107` (Zustand), `js/game.js:144-149` (Helfer),
  `js/game.js:1147-1170` (`enterEdit`), `js/game.js:2287-2288` (`keydown`),
  `js/game.js:2810` (Debug-Hook)

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `state.roomNames` — Objekt, Schlüssel `'0' … String(MAXF)`, Werte Strings
    mit 1–24 Zeichen.
  - `const raumName = k => …` — liefert den Namen eines Raums oder `''`.
  - `function setzeRaumName(k, roh)` — trimmt, kappt auf 24, löscht bei leer,
    ruft `save()`. Gibt nichts zurück (Kommando).
  - DOM-Ids `#edit-nr`, `#edit-name`, `#edit-bewohner` (ersetzen `#edit-title`).
  - Debug-Hook-Felder `raumName`, `setzeRaumName`.

- [ ] **Step 1: Prüfskript mit den Checks für dieses Task schreiben (es muss rot sein)**

Neue Datei `tools/verify_raumnamen.py`:

```python
#!/usr/bin/env python3
"""Headless-Prüfung der Wohnungsnamen aus Issue #103.

Startet den statischen Server selbst und läuft komplett im Vordergrund —
siehe CLAUDE.md: "Run the verification in the foreground. Never
run_in_background." Der Server wird über den eigenen Prozess-Handle beendet;
bleibt doch einmal einer liegen, hilft `fuser -k 8241/tcp` — niemals
`pkill -f`.

    python3 tools/verify_raumnamen.py
"""
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 8241

failures = []


def check(ok, label, detail=""):
    print(("  OK   " if ok else "  FAIL ") + label + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(label + (f" [{detail}]" if detail else ""))


def wait_port(port, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.5):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def port_free(port):
    try:
        with socket.create_connection(("127.0.0.1", port), 0.4):
            return False
    except OSError:
        return True


def open_page(browser, url):
    """Frische Seite, Intro weggeklickt, Konsolenfehler gesammelt."""
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url, wait_until="networkidle")
    # Der Intro-Dialog gilt Playwright wegen seiner Einblend-Animation nie als
    # "stabil"; force=True klickt ihn trotzdem weg (wie in verify_game_nav.py).
    page.click("#btn-start", force=True)
    page.wait_for_timeout(700)
    return page, errors


def baue_ein_stockwerk(page):
    """Stockwerk 1 über den echten Knopf bauen — der Bau dauert ~1.4 s."""
    page.click("#btn-build")
    page.wait_for_timeout(1800)


def pruefe_feld(page):
    print("\n=== Namensfeld in der Einrichte-Leiste ===")
    baue_ein_stockwerk(page)
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)

    check(page.is_visible("#edit-name"), "Feld ist sichtbar")
    check(page.input_value("#edit-name") == "", "Feld ist anfangs leer")
    check(page.get_attribute("#edit-name", "placeholder") == "Wohnung anschreiben",
          "Platzhalter stimmt")
    check(page.get_attribute("#edit-name", "maxlength") == "24", "maxlength ist 24")
    check("1" in (page.inner_text("#edit-nr") or ""), "Nummer steht weiter da")

    page.fill("#edit-name", "Musikzimmer")
    page.wait_for_timeout(500)   # save() ist um 300 ms entprellt
    gespeichert = page.evaluate("() => wipfelkratzer.state.roomNames['1']")
    check(gespeichert == "Musikzimmer", "Name steht im Zustand", repr(gespeichert))

    page.fill("#edit-name", "   ")
    page.wait_for_timeout(500)
    leer = page.evaluate("() => '1' in wipfelkratzer.state.roomNames")
    check(leer is False, "Leerer Name löscht den Eintrag")

    page.fill("#edit-name", "Musikzimmer")
    page.wait_for_timeout(500)
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def pruefe_neuladen(page_factory):
    print("\n=== Name überlebt das Neuladen ===")
    page, errors = page_factory()
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)
    check(page.input_value("#edit-name") == "Musikzimmer",
          "Feld trägt den gespeicherten Namen", page.input_value("#edit-name"))
    page.evaluate("() => wipfelkratzer.exitEdit()")
    return page, errors


def pruefe_dach_und_spielplatz(page):
    print("\n=== Dach und Spielplatz haben kein Feld ===")
    page.evaluate("() => wipfelkratzer.enterEdit('roof')")
    page.wait_for_timeout(300)
    check(page.is_hidden("#edit-name"), "Auf dem Dach ist das Feld versteckt")
    check("Dachterrasse" in (page.inner_text("#edit-nr") or ""),
          "Dach-Aufschrift unverändert", page.inner_text("#edit-nr"))
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def pruefe_tastatur(page):
    print("\n=== Tasten im Feld steuern das Spiel nicht ===")
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)
    # Ein Möbel hinstellen und auswählen — nur dann greift der keydown-Handler.
    page.evaluate("() => { wipfelkratzer.addItem('stuhl'); }")
    page.wait_for_timeout(400)
    vorher = page.evaluate("() => { const e = wipfelkratzer.roomOf(1)[0]; return e ? e.x : null; }")
    page.click("#edit-name")
    page.keyboard.press("ArrowLeft")
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(300)
    nachher = page.evaluate("() => { const e = wipfelkratzer.roomOf(1)[0]; return e ? e.x : null; }")
    check(vorher is not None and vorher == nachher,
          "Pfeiltaste im Feld bewegt kein Möbel", f"{vorher} -> {nachher}")
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)


def main():
    if not port_free(PORT):
        print(f"Port {PORT} ist belegt — bitte freigeben (fuser -k {PORT}/tcp).")
        return 2
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{PORT}/"
    alle_fehler = []
    try:
        if not wait_port(PORT):
            print("Server kam nicht hoch.")
            return 2
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page, errors = open_page(browser, url)
            pruefe_feld(page)
            pruefe_dach_und_spielplatz(page)
            pruefe_tastatur(page)
            alle_fehler += errors
            page.close()

            page, errors = pruefe_neuladen(lambda: open_page(browser, url))
            alle_fehler += errors
            page.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)

    print("\n=== Konsole ===")
    check(not alle_fehler, "Konsole ohne Fehler", "; ".join(alle_fehler[:3]))

    print()
    if failures:
        print(f"{len(failures)} Prüfung(en) fehlgeschlagen:")
        for f in failures:
            print("  - " + f)
        return 1
    print("Alle Prüfungen bestanden.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Skript laufen lassen — es muss rot sein**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: `FAIL Feld ist sichtbar` und die folgenden Feld-Prüfungen scheitern
(es gibt `#edit-name` noch nicht), Rückgabewert 1. Sollte Playwright fehlen:
`pip install playwright && playwright install chromium`.

- [ ] **Step 3: Markup und CSS der Einrichte-Leiste umbauen**

`index.html:85` — die eine Regel für `#edit-title` ersetzen durch:

```css
  #edit-nr { font-size: 16px; font-weight: 700; }
  #edit-name { font: inherit; font-size: 15px; width: 13ch; min-height: 44px;
    padding: 4px 8px; border: 2px solid #d9c49a; border-radius: 8px; background: #fffdf6; }
  #edit-name::placeholder { color: #a79772; }
  #edit-bewohner { font-size: 13px; color: #6b5f45; }
  #edit-nr.allein { font-size: 16px; }
```

`index.html:327-333` — `#editbar` neu:

```html
<div id="editbar" class="panel">
  <span id="edit-nr"></span>
  <input id="edit-name" type="text" maxlength="24" placeholder="Wohnung anschreiben"
         title="Gib dieser Wohnung einen Namen" autocomplete="off">
  <span id="edit-bewohner"></span>
  <button id="btn-roomcopy" class="hidden">Raum kopieren</button>
  <button id="btn-roompaste" class="hidden">Raum einfügen</button>
  <button id="btn-tip">Tipp</button>
  <button id="btn-done" class="primary">Fertig</button>
</div>
```

- [ ] **Step 4: Zustand und Helfer in `js/game.js`**

Zeile 107 — `roomNames: {}` in das Zustandsliteral aufnehmen:

```js
let state = { floors: 0, rooms: {}, nuts: 0, bridge: false, garden: false, night: false, season: 'sommer', cutaway: false, fulfilled: {}, wallpaper: {}, flooring: {}, tenantPos: {}, roomNames: {}, maxFloors: 10, designs: [] };
```

Direkt nach `const roomOf = …` (heute `js/game.js:149`) die beiden Helfer
einsetzen:

```js
/* Selbst vergebene Wohnungsnamen (#103). Ein alter Spielstand bringt das Feld
   nicht mit — Object.assign (js/game.js:115) überschreibt dann mit undefined,
   deshalb hier einmal geradeziehen statt an jeder Lesestelle zu prüfen. */
if (!state.roomNames || typeof state.roomNames !== 'object' || Array.isArray(state.roomNames)) state.roomNames = {};
const RAUMNAME_MAX = 24;
const raumName = k => {
  const n = state.roomNames[k];
  return typeof n === 'string' ? n : '';
};
/* Leer heisst: kein Eintrag. Ein gespeichertes '' wäre ein Eintrag, den jede
   Abfrage zusätzlich prüfen müsste (#103). */
function setzeRaumName(k, roh) {
  const name = String(roh == null ? '' : roh).trim().slice(0, RAUMNAME_MAX);
  if (name) state.roomNames[k] = name;
  else delete state.roomNames[k];
  save();
}
```

- [ ] **Step 5: `enterEdit` auf die drei Teile umstellen**

`js/game.js:1147-1170` — die drei `$('edit-title')`-Zuweisungen ersetzen. Ein
Helfer setzt die Leiste, damit die Fallunterscheidung an einer Stelle steht:

```js
/* Die Aufschrift der Einrichte-Leiste hat drei Teile: feste Nummer,
   Namensfeld, Bewohner. Dach und Spielplatz haben nur einen festen Titel und
   kein Feld (#103). */
function setzeEditLeiste(k) {
  const nr = $('edit-nr'), feld = $('edit-name'), bew = $('edit-bewohner');
  if (k === 'garten' || k === 'roof') {
    nr.textContent = k === 'garten' ? 'Spielplatz einrichten' : 'Dachterrasse einrichten';
    nr.classList.add('allein');
    feld.classList.add('hidden'); bew.classList.add('hidden');
    return;
  }
  nr.textContent = `${flLabel(k)} ·`;
  nr.classList.remove('allein');
  feld.classList.remove('hidden');
  feld.value = raumName(k);
  const t = tenantOf(k);
  bew.textContent = tenantIn(k) ? (t.unit || t.name) : '';
  bew.classList.toggle('hidden', !tenantIn(k));
}
```

In `enterEdit` die drei Zuweisungen durch je einen Aufruf ersetzen:

- `js/game.js:1153` (`garten`) → `setzeEditLeiste('garten');`
- `js/game.js:1156` (`roof`) → `setzeEditLeiste('roof');`
- `js/game.js:1163-1164` (Stockwerk) → die beiden Zeilen mit `const t = …` und
  `$('edit-title').textContent = …` durch `setzeEditLeiste(k);` ersetzen.

Und das Feld einmalig verdrahten — neben den übrigen Knopf-Handlern
(z. B. direkt nach `$('btn-sign').onclick = …`, `js/game.js:1790`):

```js
/* Jeder Tastendruck speichert (entprellt über save(), js/game.js:144) —
   ein Kind, das die Leiste zuklappt, ohne "fertig" zu drücken, verliert
   seinen Namen sonst (#103). */
$('edit-name').oninput = e => { if (edit) setzeRaumName(edit.k, e.target.value); };
```

- [ ] **Step 6: Tastatur-Frühausstieg**

`js/game.js:2287-2288` — erste Zeile des `keydown`-Handlers ergänzen:

```js
addEventListener('keydown', e => {
  /* Wer im Namensfeld tippt, steuert nicht das Spiel: die Pfeiltasten
     verschieben sonst das ausgewählte Möbel statt den Textcursor (#103). */
  const ziel = e.target;
  if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA')) return;
  if (!edit || !selected) return;
```

- [ ] **Step 7: Debug-Hook ergänzen**

`js/game.js:2810 ff.` — im Objektliteral `window.wipfelkratzer` ergänzen:

```js
  raumName, setzeRaumName,
```

- [ ] **Step 8: Skript laufen lassen — jetzt grün**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: alle Prüfungen `OK`, `Alle Prüfungen bestanden.`, Rückgabewert 0.
Der Lauf braucht rund eine halbe Minute — **im Vordergrund abwarten**.

- [ ] **Step 9: Commit**

```bash
git add index.html js/game.js tools/verify_raumnamen.py
git commit -m "feat(wohnung): Namensfeld in der Einrichte-Leiste

Jede Wohnung kann einen eigenen Namen bekommen (max. 24 Zeichen). Der Name
liegt als state.roomNames im Spielstand und wird wie jede andere Änderung
entprellt gespeichert. Tasten im Feld steuern das Spiel nicht mehr mit."
```

---

### Task 2: Name in Besuchsleiste und Bewohner-Schild

**Files:**
- Modify: `js/game.js:1296` (`renderBesuchbar`), `js/game.js:1717-1725`
  (`renderResidents`)
- Modify: `tools/verify_raumnamen.py` (zwei neue Prüffunktionen)

**Interfaces:**
- Consumes: `raumName(k)` aus Task 1.
- Produces: keine neuen Bezeichner; nur Anzeige.

- [ ] **Step 1: Prüfungen ergänzen (rot)**

In `tools/verify_raumnamen.py` vor `main()` einfügen:

```python
def pruefe_besuch(page):
    print("\n=== Name in der Besuchsleiste ===")
    page.evaluate("() => wipfelkratzer.enterBesuch(1)")
    page.wait_for_timeout(500)
    titel = page.inner_text("#besuch-titel")
    check("Musikzimmer" in titel, "Besuchsleiste zeigt den Namen", titel)
    check("1" in titel, "Besuchsleiste zeigt weiter die Nummer", titel)
    page.evaluate("() => wipfelkratzer.exitBesuch()")
    page.wait_for_timeout(500)


def pruefe_schild(page):
    print("\n=== Name auf dem Bewohner-Schild ===")
    page.click("#btn-extras")
    page.wait_for_timeout(200)
    page.click("#btn-sign")
    page.wait_for_timeout(300)
    zeilen = page.inner_text("#resident-list")
    check("Musikzimmer" in zeilen, "Bewohner-Schild zeigt den Namen")
    page.click("#btn-resclose")
    page.wait_for_timeout(300)


def pruefe_kein_html(page):
    print("\n=== Ein Name, der wie HTML aussieht, bleibt Text ===")
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)
    boese = '<img src=x onerror="window.__xss=1">'
    page.fill("#edit-name", boese)
    page.wait_for_timeout(500)
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)
    page.click("#btn-extras")
    page.wait_for_timeout(200)
    page.click("#btn-sign")
    page.wait_for_timeout(400)
    check(page.evaluate("() => window.__xss === undefined"), "Kein Skript ausgeführt")
    check(page.evaluate("() => document.querySelectorAll('#resident-list img').length === 0"),
          "Kein <img> im Bewohner-Schild")
    check("onerror" in page.inner_text("#resident-list"), "Der Text steht wörtlich da")
    page.click("#btn-resclose")
    page.wait_for_timeout(200)
    # Wieder auf den gutartigen Namen zurück, damit spätere Prüfungen ihn finden.
    page.evaluate("() => wipfelkratzer.enterEdit(1)")
    page.wait_for_timeout(300)
    page.fill("#edit-name", "Musikzimmer")
    page.wait_for_timeout(500)
    page.evaluate("() => wipfelkratzer.exitEdit()")
    page.wait_for_timeout(300)
```

Und in `main()` nach `pruefe_feld(page)` einhängen:

```python
            pruefe_besuch(page)
            pruefe_schild(page)
            pruefe_kein_html(page)
```

Die Selektoren sind nachgeschlagen, nicht geraten: der Dialog ist
`#residents` mit der Liste `#resident-list` und dem Schliessen-Knopf
`#btn-resclose` (`index.html:369-375`), `#btn-extras` öffnet das Extras-Menü
(`index.html:308`). `addItem('stuhl')` wählt das neue Möbel am Ende selbst aus
(`js/game.js:1527`), deshalb greift der `keydown`-Handler danach.

- [ ] **Step 2: Skript laufen lassen — die drei neuen Blöcke müssen rot sein**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: `FAIL Besuchsleiste zeigt den Namen`, `FAIL Bewohner-Schild zeigt
den Namen`; die XSS-Prüfung ist noch nicht aussagekräftig, weil der Name
nirgends angezeigt wird.

- [ ] **Step 3: Besuchsleiste**

`js/game.js:1296` — die Zeile

```js
    : `${flLabel(k)} — ${tenantIn(k) ? (tenantOf(k).unit || tenantOf(k).name) : 'noch niemand'}`;
```

ersetzen durch:

```js
    : `${flLabel(k)} — ${raumName(k) || (tenantIn(k) ? (tenantOf(k).unit || tenantOf(k).name) : 'noch niemand')}`;
```

`textContent` wird hier schon benutzt (`js/game.js:1293`), also ist der Text
sicher.

- [ ] **Step 4: Bewohner-Schild**

`js/game.js:1717-1725` — `renderResidents` so umbauen, dass der Spielertext
über `textContent` an die Zeile kommt:

```js
function renderResidents() {
  const ul = $('resident-list'); ul.innerHTML = '';
  for (let i = MAXF; i >= 0; i--) {
    const li = document.createElement('li');
    const built = i <= state.floors;
    const nm = !built ? '<span class="free">noch nicht gebaut</span>' : tenantIn(i) ? `<b>${tenantOf(i).unit || tenantOf(i).name}</b>` : '<span class="free">zurzeit frei</span>';
    const hint = i === 0 ? '<span class="hint">Erdgeschoss, war schon da</span>' : '';
    li.innerHTML = `<span class="fl">${flLabel(i)}</span><span>${nm}${hint}</span>`;
    /* Der Wohnungsname kommt vom Kind und darf nie durch innerHTML gehen
       (#103) — er wird als Textknoten angehängt. */
    const eigen = built ? raumName(i) : '';
    if (eigen) {
      const span = document.createElement('span');
      span.className = 'raumname';
      span.textContent = ` · ${eigen}`;
      li.lastElementChild.appendChild(span);
    }
    ul.appendChild(li); }
}
```

Dazu in `index.html` bei den übrigen `#resident-list`-Regeln eine Zeile
ergänzen (Selektor an die bestehende Liste anpassen):

```css
  #resident-list .raumname { color: #6b5f45; }
```

- [ ] **Step 5: Skript laufen lassen — grün**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: alle Prüfungen `OK`, Rückgabewert 0. Besonders: `Kein Skript
ausgeführt`, `Kein <img> im Bewohner-Schild`, `Der Text steht wörtlich da`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/game.js tools/verify_raumnamen.py
git commit -m "feat(wohnung): Name in Besuchsleiste und Bewohner-Schild

Der selbst vergebene Name steht jetzt auch beim Hineingehen und auf dem
Bewohner-Schild. Er wird als Text gesetzt, nie als HTML — ein Name, der wie
ein Tag aussieht, bleibt harmlos."
```

---

### Task 3: Namen in der Turmdatei sichern und einlesen

**Files:**
- Modify: `js/standdatei.js:100-135` (`bereinigeStand`)
- Modify: `tools/verify_raumnamen.py` (Prüfung über `bereinigeStand`)

**Interfaces:**
- Consumes: `RAUM_KEYS`, `objekt()` aus `js/standdatei.js`.
- Produces: `bereinigeStand(roh).roomNames` — Objekt, nur bekannte
  Raumschlüssel, Strings mit 1–24 Zeichen.

- [ ] **Step 1: Prüfung ergänzen (rot)**

In `tools/verify_raumnamen.py` vor `main()`:

```python
# Die Dateiprüfung ist reine Logik — sie läuft im Browser über das Modul
# selbst, damit sie dieselbe Datei prüft, die das Spiel auch lädt.
DATEI_JS = """async () => {
  const m = await import('./js/standdatei.js');
  const roh = { maxFloors: 10, floors: 3, roomNames: {
    '1': '  Musikzimmer  ',
    '2': 'x'.repeat(40),
    '3': '',
    'kueche': 'Unbekannter Raum',
    'roof': 'Dachterrasse',
    '4': 42,
  } };
  const sauber = m.bereinigeStand(roh);
  return { v: m.DATEI_V, namen: sauber.roomNames };
}"""


def pruefe_datei(page):
    print("\n=== Turmdatei ===")
    out = page.evaluate(DATEI_JS)
    namen = out["namen"]
    check(out["v"] == 2, "DATEI_V ist unverändert 2", str(out["v"]))
    check(namen.get("1") == "Musikzimmer", "Name wird getrimmt", repr(namen.get("1")))
    check(namen.get("2") == "x" * 24, "Name wird auf 24 Zeichen gekappt",
          str(len(namen.get("2") or "")))
    check("3" not in namen, "Leerer Name fällt weg")
    check("kueche" not in namen, "Unbekannter Raumschlüssel fällt weg")
    check(namen.get("roof") == "Dachterrasse", "Bekannter Raumschlüssel roof bleibt")
    check("4" not in namen, "Nicht-String fällt weg")
```

In `main()` nach `pruefe_kein_html(page)` einhängen:

```python
            pruefe_datei(page)
```

- [ ] **Step 2: Skript laufen lassen — rot**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: `FAIL Name wird getrimmt` usw., weil `bereinigeStand` heute gar kein
`roomNames` zurückgibt (`namen` ist `undefined` → das Skript wirft; in dem Fall
gilt der Block als rot und Step 3 behebt es).

- [ ] **Step 3: `bereinigeStand` erweitern**

`js/standdatei.js:102` — `roomNames: {}` in das `out`-Literal aufnehmen:

```js
    rooms: {}, wallpaper: {}, flooring: {}, fulfilled: {}, tenantPos: {}, roomNames: {},
```

Und direkt nach der `flooring`-Zeile (`js/standdatei.js:127-128`) den Block
einsetzen:

```js
  /* Selbst vergebene Wohnungsnamen (#103). Freitext aus einer fremden Datei:
     nur Strings, getrimmt, gekappt wie im Spiel — und nie ein leerer Eintrag. */
  const namen = objekt(s.roomNames) || {};
  for (const k of Object.keys(namen)) {
    if (!RAUM_KEYS.has(k) || typeof namen[k] !== 'string') continue;
    const name = namen[k].trim().slice(0, MAX_RAUMNAME);
    if (name) out.roomNames[k] = name;
  }
```

Dazu oben bei den übrigen Grenzwerten (`js/standdatei.js:21-23`, neben
`MAX_TEXT`) die Konstante ergänzen:

```js
const MAX_RAUMNAME = 24;                /* wie RAUMNAME_MAX in js/game.js */
```

- [ ] **Step 4: Skript laufen lassen — grün**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: alle Prüfungen `OK`, Rückgabewert 0.

- [ ] **Step 5: Von Hand gegenprüfen (eine Minute, im Browser)**

```bash
python3 -m http.server 8000
```

`http://localhost:8000/` öffnen, Stockwerk bauen, anschreiben, unter «Meine
Türme» → «Sichern» → «Ohne Fotos» sichern, die Datei wieder einlesen: der Name
steht noch da. Danach den Server mit Ctrl-C beenden.

- [ ] **Step 6: Commit**

```bash
git add js/standdatei.js tools/verify_raumnamen.py
git commit -m "feat(stand): Wohnungsnamen in der Turmdatei

Die Namen werden mitgesichert und beim Einlesen über dieselbe Positivliste
geprüft wie Tapete und Boden — getrimmt, auf 24 Zeichen gekappt, unbekannte
Raumschlüssel fallen weg. DATEI_V bleibt bei 2, weil das Feld rein additiv
ist und ältere Versionen es still fallen lassen."
```

---

### Task 4: Changelog und Gesamtlauf

**Files:**
- Modify: `CHANGELOG.md:7` (`[Unreleased]`)

**Interfaces:**
- Consumes: nichts.
- Produces: nichts.

- [ ] **Step 1: Changelog-Eintrag in Spielersprache**

`CHANGELOG.md` unter `## [Unreleased]` einfügen:

```markdown
## [Unreleased]

### Added

- Du kannst Deinen Wohnungen jetzt eigene Namen geben: Tippe ein Stockwerk an
  und schreib «Musikzimmer», «Werkstatt» oder was Du magst ins Feld oben. Der
  Name steht danach auch beim Hineingehen und auf dem Bewohner-Schild und
  wird mit dem Turm gesichert (#103)
```

- [ ] **Step 2: Gesamtlauf im Vordergrund**

```bash
python3 tools/verify_raumnamen.py
```

Erwartet: `Alle Prüfungen bestanden.`, Rückgabewert 0, Konsole fehlerfrei.
**Nie `run_in_background`** — lieber ein grosszügiges Timeout setzen und
warten.

- [ ] **Step 3: Bestehende Prüfskripte gegenprüfen**

Die Einrichte-Leiste hat neue Kinder bekommen, und das Bewohner-Schild eine
neue Zeilenstruktur — die bestehenden Skripte müssen weiter grün sein:

```bash
python3 tools/verify_game_nav.py
python3 tools/verify_katalog.py
```

Erwartet: beide Rückgabewert 0. Schlägt eines fehl, ist das eine Regression
aus diesem Vorhaben und wird hier behoben, nicht wegdeklariert.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): Wohnungsnamen eintragen

Closes #103"
```

---

## Selbstprüfung des Plans (bereits durchgeführt)

- **Abdeckung der Spec:** E1 → Task 1 Step 5 (`setzeEditLeiste`, Dach/Spielplatz
  ohne Feld) und die Prüfung `pruefe_dach_und_spielplatz`. E2/E3/E6 → Task 1
  Steps 3–5. E4/E5 → Task 1 Step 4. E7 → Task 3 (kein `DATEI_V`-Bump, Prüfung
  `DATEI_V ist unverändert 2`). E8 → Task 2 Step 4 und `pruefe_kein_html`.
  E9 → keine Aufgabe, weil nichts zu tun ist (deutsche Literale). Das
  Prüfprogramm der Spec (9 Punkte) verteilt sich auf `pruefe_feld`,
  `pruefe_neuladen`, `pruefe_besuch`, `pruefe_schild`, `pruefe_kein_html`,
  `pruefe_tastatur`, `pruefe_datei` und die Konsolenprüfung.
- **Platzhalter:** keine — jeder Schritt trägt den Code, der eingesetzt wird.
  Alle DOM-Selektoren im Prüfskript sind gegen `index.html` geprüft
  (`#btn-extras`, `#btn-sign`, `#residents`, `#resident-list`,
  `#btn-resclose`, `#btn-build`, `#btn-start`).
- **Namenskonsistenz:** `raumName` / `setzeRaumName` / `RAUMNAME_MAX` in
  `js/game.js`, `MAX_RAUMNAME` in `js/standdatei.js` (dort mit Verweis auf das
  Gegenstück), `state.roomNames` überall gleich, DOM-Ids `#edit-nr`,
  `#edit-name`, `#edit-bewohner` in Markup, CSS, JS und Prüfskript identisch.
