# Spec: Alle Fotos auf einmal herunterladen

Issue: `freaxnx01/game-wipfelkratzer#33`
Datum: 2026-09-13

## Problem

Die Fotogalerie lädt heute nur **einzelne** Fotos herunter: `renderGallery()`
baut pro Foto eine `.photo-actions`-Leiste mit einem Knopf «Herunterladen»
(`js/game.js:1158`), dessen Handler ein `<a download>` mit der Data-URL des
Fotos erzeugt und klickt (`js/game.js:1161-1165`). Der Dateiname kommt aus
`photoFilename(p)` (`js/game.js:1150-1153`). Die Galerie hält bis zu 20 Fotos
(`js/game.js:1145`), also tippt man im Extremfall zwanzigmal.

Gewünscht ist **ein** Knopf, der alle Fotos auf einmal sichert — und zwar dort,
wo tatsächlich gespielt wird: auf dem iPad in Safari.

## Ausgangslage im Code (Belege)

- Fotos liegen als JPEG-Data-URLs im `localStorage` unter
  `wipfelkratzer-fotos`, erzeugt mit `toDataURL('image/jpeg', 0.72)` bei max.
  800 px Breite (`js/game.js:1137-1146`).
- Maximal 20 Fotos, neueste zuerst (`photos.unshift(...)`, `js/game.js:1144-1145`).
- Galerie-Markup: `#gallery` → `.panel` → `<h2>` + `#photo-grid` +
  `#btn-galclose` (`index.html:224-229`).
- Leerzustand: `renderGallery()` schreibt `<div class="empty">Noch keine Fotos…`
  und kehrt früh zurück (`js/game.js:1156`), gestylt über
  `#gallery .empty` (`index.html:107`).
- Es gibt bereits eine globale Utility-Klasse `.hidden { display: none !important; }`
  (`index.html:142`).
- Es gibt bereits einen Debug-/Testzugriff `window.wipfelkratzer = { … }` für
  Playwright-Checks (`js/game.js:1194`).
- Bibliotheken: ausschliesslich `three` (+ dessen Addons) über die Import-Map
  (`index.html:10-27`). Sonst keine. Der Stack-Overlay verbietet zusätzlich
  Framework-Importe, Bundler und `package.json`
  (`CLAUDE.md:796-812`, Abschnitt «Agent Guardrails (stack-specific)» /
  «Never generate»).
- Es gibt keinen Test-Runner; der Playtest im echten Browser (Playwright,
  **im Vordergrund**, niemals `run_in_background`) ist das Test-Gate
  (`CLAUDE.md:508-567`).

## Goals

- Ein einziger Knopf «Alle herunterladen» in der Fotogalerie sichert sämtliche
  Fotos in einem Vorgang.
- Auf dem iPad (Safari) führt der Knopf zu einem Weg, der **nicht** nach dem
  ersten Foto abbricht.
- Auf dem Desktop entsteht **eine** Datei, kein Schauer aus 20 Downloads.
- Bei leerer Galerie ist der Knopf nicht sichtbar.
- Keine neue Laufzeit-Abhängigkeit, keine Änderung an der Import-Map, kein
  Bundler, kein `package.json`.
- Der bestehende Einzel-Download pro Foto bleibt unverändert erhalten.

## Non-Goals

- Kein Umbau des Foto-Speichers (weiterhin Data-URLs im `localStorage`).
- Keine Kompression der JPEGs, keine zweite Auflösungsstufe, kein «Originale
  exportieren».
- Kein Export der Foto-Kommentare (`p.text`) als Textdatei — siehe A7.
- Kein Auswahlmodus («diese drei herunterladen»).
- Keine Änderung an `photoFilename()` selbst.
- Kein Cloud-/Share-Link, kein Server.

## Design

### Kernentscheidung: ZIP ja — aber selbst geschrieben, plus Web Share zuerst

Der Issue stellt die Frage «ZIP heisst neue Abhängigkeit — ist das die Linie
wert?». Antwort: **Die Linie bleibt, das ZIP kommt trotzdem.** Ein ZIP mit
`method = 0` (*stored*, unkomprimiert) ist reines Byte-Schieben — CRC32-Tabelle,
Local-File-Header, Central Directory, End-of-Central-Directory — und passt in
gut 50 Zeilen Vanilla-JS. Kompression würde bei bereits komprimierten JPEGs
ohnehin fast nichts bringen. Eine Bibliothek (JSZip, fflate) würde also ~90 KB
Fremdcode und einen CDN-Eintrag in die Import-Map holen, um Arbeit zu erledigen,
die das Spiel selbst in einer Datei erledigen kann. Siehe A1.

Zusätzlich gilt: Ein ZIP ist auf dem iPad der *zweitbeste* Weg. Ein Kind will
die Fotos in «Fotos» haben, nicht ein Archiv in «Dateien», das erst
aufgeklappt werden muss. Dafür gibt es einen Vanilla-Weg, den iOS Safari seit
Jahren kann: `navigator.share({ files })` (Web Share Level 2) öffnet das
System-Sheet mit allen Bildern auf einmal → «N Bilder sichern». Also:

1. **Wenn** `navigator.canShare({ files })` → teilen (iPad/iPhone/Android).
2. **Sonst** → ein ZIP, ein `<a download>` (Desktop-Chrome/Firefox).

Beide Wege bauen auf denselben Bytes auf, beide sind reines Vanilla-JS.

### Neue Datei `js/zip.js`

ES-Modul, keine Importe, exportiert genau eine Funktion:

```js
/* zip.js — minimaler ZIP-Schreiber, Methode 0 (stored).
   Bewusst ohne Bibliothek: JPEGs sind schon komprimiert, und der Stack
   hält die Zahl der Abhängigkeiten bei genau einer (three). */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosStamp(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/* entries: [{ name: string, data: Uint8Array, date?: Date }] → Blob */
export function zipStore(entries) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const size = e.data.length, crc = crc32(e.data);
    const { time, date } = dosStamp(e.date || new Date());
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);  // Local-File-Header-Signatur
    lv.setUint16(4, 20, true);          // benötigte Version 2.0
    lv.setUint16(6, 0, true);           // Flags
    lv.setUint16(8, 0, true);           // Methode 0 = stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);       // komprimiert
    lv.setUint32(22, size, true);       // unkomprimiert
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);          // Extra-Feld
    local.set(name, 30);
    parts.push(local, e.data);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);  // Central-Directory-Signatur
    cv.setUint16(4, 20, true);          // erzeugt von Version 2.0
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);     // Offset des Local-Headers
    cd.set(name, 46);
    central.push(cd);

    offset += local.length + size;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);    // End-of-Central-Directory
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
```

Dateinamen sind reines ASCII (`photoFilename()` erzeugt
`wipfelkratzer-YYYY-MM-DD-HHMMSS.jpg`, `js/game.js:1150-1153`), deshalb kein
UTF-8-Flag (Bit 11) nötig. Siehe A5.

### Neue Helfer in `js/game.js` (direkt bei den Foto-Funktionen)

```js
function dataUrlToBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* Zwei Fotos in derselben Sekunde ergeben denselben Namen — im Archiv bzw.
   im Share-Sheet muss jeder Name eindeutig sein. */
function uniquePhotoNames(list) {
  const seen = new Map();
  return list.map(p => {
    const base = photoFilename(p);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : base.replace(/\.jpg$/, `-${n}.jpg`);
  });
}

function photoZipFilename() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `wipfelkratzer-fotos-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}
```

### Der Knopf

Markup — `#btn-galclose` wandert in eine gemeinsame Aktionszeile
(`index.html:224-229` wird zu):

```html
<div id="gallery">
  <div class="panel">
    <h2>Fotogalerie</h2>
    <div id="photo-grid"></div>
    <div id="gallery-actions">
      <button id="btn-download-all">Alle herunterladen</button>
      <button id="btn-galclose" class="primary">Zu</button>
    </div>
  </div>
</div>
```

CSS neben `#gallery .empty` (`index.html:107`):

```css
#gallery-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
```

`renderGallery()` blendet den Knopf abhängig vom Bestand ein — **vor** dem
frühen Return des Leerzustands (`js/game.js:1155-1156`):

```js
$('btn-download-all').classList.toggle('hidden', !photos.length);
```

### Der Handler

```js
async function downloadAllPhotos() {
  if (!photos.length) return;
  const btn = $('btn-download-all');
  btn.disabled = true;
  try {
    const names = uniquePhotoNames(photos);
    const bytes = photos.map(p => dataUrlToBytes(p.url));
    const files = bytes.map((b, i) => new File([b], names[i], { type: 'image/jpeg' }));
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: 'Wipfelkratzer-Fotos' });
        toast(`${files.length} Fotos weitergegeben.`);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;  // abgebrochen: kein Ersatzweg
      }
    }
    const blob = zipStore(photos.map((p, i) => ({ name: names[i], data: bytes[i], date: new Date(p.t) })));
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = photoZipFilename();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
    toast(`${photos.length} Fotos als ZIP gespeichert.`);
  } finally {
    btn.disabled = false;
  }
}
$('btn-download-all').onclick = downloadAllPhotos;
```

`toast()` existiert bereits (`js/game.js:490`) und bleibt offen, bis man ihn
wegtippt — passt für eine Bestätigung, die ein Kind lesen soll.

### Testzugriff

Der bestehende Debug-Hook (`js/game.js:1194`) bekommt die reinen Funktionen
dazu, damit Playwright sie ohne UI prüfen kann:

```js
window.wipfelkratzer = { …, photoTools: { photoFilename, uniquePhotoNames, dataUrlToBytes, photoZipFilename } };
```

## Assumptions

- **A1** [med] **ZIP wird selbst geschrieben (`js/zip.js`, Methode 0/stored),
  keine ZIP-Bibliothek.** Verworfen: JSZip/fflate via Import-Map bzw. CDN.
  Begründung: Die Import-Map führt heute ausschliesslich `three` und dessen
  Addons (`index.html:10-27`), der Stack-Overlay untersagt neue
  Framework-/Bundler-Abhängigkeiten explizit (`CLAUDE.md:796-812`), und
  *stored*-ZIP über bereits komprimierte JPEGs
  (`toDataURL('image/jpeg', 0.72)`, `js/game.js:1144`) braucht keinen Deflate.
  Der Preis ist ~55 Zeilen eigener Code, den niemand sonst pflegt — das ist die
  bewusst gewählte Seite des Tauschs.
- **A2** [med] **Auf teilfähigen Geräten wird `navigator.share({files})`
  bevorzugt, das ZIP ist nur der Ersatzweg.** Verworfen: immer ZIP. Begründung:
  Gespielt wird laut Issue auf dem iPad; dort landen Fotos über das
  System-Sheet direkt in «Fotos», während ein ZIP erst in «Dateien»
  aufgeklappt werden müsste. Der Issue nennt genau diesen Abbruch-nach-dem-
  ersten-Download als Grund, den heutigen `<a download>`-Weg
  (`js/game.js:1161-1165`) nicht einfach zu wiederholen.
- **A3** [low] **Kein sequenzielles Auslösen von N `<a download>`.** Verworfen:
  Schleife über den bestehenden Handler mit `setTimeout`-Abstand. Begründung:
  genau das Verhalten, das der Issue als auf iPad-Safari unzuverlässig
  beschreibt; der bestehende Einzel-Handler bleibt unverändert
  (`js/game.js:1161-1165`).
- **A4** [low] **Der Knopf sitzt in einer neuen Zeile `#gallery-actions`
  zusammen mit «Zu», nicht pro Foto und nicht in der Kopfzeile.** Verworfen:
  Knopf neben `<h2>Fotogalerie</h2>`. Begründung: `#btn-galclose` steht heute
  allein am Fuss der Galerie (`index.html:228`); eine Aktionszeile am selben
  Ort hält die Tippziele beieinander und erbt die 48-px-Knopfhöhe der globalen
  `button`-Regel (`index.html:36`).
- **A5** [low] **Keine UTF-8-Flag-Behandlung im ZIP.** Verworfen: Bit 11 setzen
  und Namen als UTF-8 markieren. Begründung: `photoFilename()` erzeugt
  ausschliesslich `[a-z0-9-]`-Namen (`js/game.js:1150-1153`), Kommentare des
  Kindes (`p.text`) gehen nicht in Dateinamen ein.
- **A6** [low] **Doppelte Zeitstempel werden mit `-2`, `-3` … entschärft.**
  Verworfen: Namen unverändert übernehmen. Begründung: `photoFilename()` löst
  nur auf Sekunden auf (`js/game.js:1152`), zwei Fotos in derselben Sekunde
  sind mit einem Doppeltipp erreichbar; gleichnamige Einträge im selben Archiv
  sind zwar formal erlaubt, aber beim Entpacken verlustbehaftet.
- **A7** [med] **Die Foto-Kommentare (`p.text`) werden nicht mitexportiert.**
  Verworfen: zusätzliche `kommentare.txt` im Archiv. Begründung: Der Issue
  fordert «alle Fotos», nicht einen Galerie-Export; die Kommentare leben
  weiterhin in der Galerie (`js/game.js:1160`). Auf dem Share-Weg gäbe es
  ausserdem keinen sinnvollen Platz dafür — eine Textdatei im Foto-Share-Sheet
  wäre ein Fremdkörper.
- **A8** [low] **Bei abgebrochenem Share (`AbortError`) passiert nichts** —
  kein Ersatz-ZIP, kein Toast. Verworfen: nach Abbruch trotzdem das ZIP
  herunterladen. Begründung: Abbrechen ist eine Entscheidung des Benutzers;
  ein danach anspringender Download wäre eine Überraschung. Nur ein *echter*
  Fehler (kein `AbortError`) fällt auf das ZIP zurück.
- **A9** [low] **Version wird auf 0.6.0 gehoben** (`version.js` steht auf
  `0.5.0`, `version.js:3`). Verworfen: 0.5.1. Begründung: neues Feature, nicht
  Fehlerbehebung — SemVer-Regel des Stacks (`CLAUDE.md:98-110`, `462-497`).
- **A10** [low] **Verifiziert wird mit Playwright im Vordergrund, die
  Prüfskripte liegen im gitignorierten `.superpowers/`.** Verworfen: ein neues,
  eingechecktes `tests/`-Verzeichnis. Begründung: Der Stack ist buildless und
  hat bewusst keinen Test-Runner (`CLAUDE.md:508-513`), und `.gitignore` führt
  `.superpowers/` genau für diese Wegwerf-Prüfskripte
  (`.gitignore:3-6`). `run_in_background` ist verboten (`CLAUDE.md:552-567`).

## Consequences

- **Speicher, kurzzeitig.** 20 Fotos à 800 px JPEG q0.72 sind grob 60–120 KB
  pro Stück, also ~1–2,5 MB. Während `downloadAllPhotos()` läuft, existieren
  sie dreifach: als Base64-Data-URL im `photos`-Array (bleibt ohnehin, ~1,33×),
  als `Uint8Array`, und im ZIP-`Blob`. Spitze also grob 6–8 MB auf einem
  Tablet — vertretbar, aber nicht null. Die `Uint8Array`s werden bewusst
  **einmal** erzeugt und für Share *und* ZIP wiederverwendet, statt zweimal.
- **Kurzer Ruckler.** `atob` + CRC32 über ~2,5 MB laufen synchron auf dem
  Hauptthread, während die three.js-Schleife weiterläuft (`tick()`,
  `js/game.js:1206`). Zu erwarten sind einige zehn Millisekunden, also ein bis
  zwei ausgelassene Bilder. Kein Worker, keine Aufteilung in Häppchen — der
  Knopf ist `disabled`, solange es läuft.
- **Keine Kompression.** Das ZIP ist ungefähr so gross wie die Summe der
  JPEGs. Wer ein kleines Archiv erwartet, bekommt keines — das ist bei
  JPEG-Inhalt aber auch mit Deflate nicht anders.
- **Zwei Wege, zwei Ergebnisse.** Dasselbe Antippen liefert auf dem iPad ein
  Share-Sheet und auf dem Desktop eine ZIP-Datei. Das ist gewollt, heisst aber:
  eine Anleitung («tippe auf Alle herunterladen, dann Sichern») stimmt nie für
  beide Geräte gleichzeitig.
- **Das ZIP wird nur automatisiert auf Chromium geprüft.** Der Share-Weg lässt
  sich headless nur mit einem gestellten `navigator.share` prüfen; das echte
  iPad-Sheet bleibt ein manueller Schritt.
- **`js/zip.js` ist ab jetzt eigener Unterhalt.** Ein Fehler im
  Central-Directory fällt erst beim Entpacken auf — deshalb prüft der Test mit
  Pythons `zipfile` (Stdlib) gegen eine echte ZIP-Implementierung, nicht gegen
  sich selbst.
- **Dritte Datei unter `js/`.** Bisher `models.js` + `game.js`; `zip.js` kommt
  dazu und wird von `game.js` importiert — kein Eintrag in der Import-Map
  nötig, da relativer Pfad.

## Acceptance Criteria

- [ ] In der Fotogalerie gibt es genau einen Knopf «Alle herunterladen»
      (`#btn-download-all`), zusätzlich zum unveränderten Knopf «Zu».
- [ ] Bei leerer Galerie ist `#btn-download-all` nicht sichtbar (Klasse
      `hidden`); sobald mindestens ein Foto existiert, ist er sichtbar.
- [ ] Der Einzel-Download pro Foto (`.photo-actions .download`) funktioniert
      unverändert weiter.
- [ ] Auf einem Gerät **ohne** `navigator.canShare({files})` erzeugt ein Tipp
      genau **einen** Download: eine Datei
      `wipfelkratzer-fotos-YYYY-MM-DD.zip`.
- [ ] Dieses Archiv lässt sich mit einem fremden Entpacker (Prüfung: Pythons
      `zipfile`) fehlerfrei öffnen, `testzip()` meldet keinen CRC-Fehler.
- [ ] Das Archiv enthält genau so viele Einträge wie Fotos in der Galerie, alle
      mit Endung `.jpg`, und jeder Eintrag beginnt mit den JPEG-Magic-Bytes
      `FF D8 FF`.
- [ ] Zwei Fotos mit identischem Sekunden-Zeitstempel ergeben zwei
      unterschiedliche Einträge (`…-141530.jpg` und `…-141530-2.jpg`), keiner
      wird überschrieben.
- [ ] Auf einem Gerät **mit** `navigator.canShare({files})` wird
      `navigator.share` mit genau N `File`-Objekten (`type: 'image/jpeg'`)
      aufgerufen und **kein** ZIP heruntergeladen.
- [ ] Bricht der Benutzer das Share-Sheet ab (`AbortError`), passiert nichts:
      kein Download, kein Toast.
- [ ] Während der Vorgang läuft, ist `#btn-download-all` `disabled`; danach
      wieder bedienbar — auch wenn unterwegs ein Fehler auftrat.
- [ ] Die Konsole bleibt beim gesamten Ablauf fehlerfrei (keine uncaught
      errors, keine Warnungen).
- [ ] `index.html` lädt weiterhin keine Bibliothek ausser `three`: die
      Import-Map (`index.html:10-27`) ist unverändert, es gibt kein
      `package.json` und keinen neuen `<script src="https://…">`.
- [ ] `version.js` steht auf `0.6.0` und `CHANGELOG.md` hat einen Eintrag
      `feat(fotos)` mit Bezug auf #33.
