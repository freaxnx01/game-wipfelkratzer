/* Slot-Ebene über dem Spielstand.
   Ein Index verweist auf bis zu vier Stände; jeder Stand hat einen eigenen
   Schlüssel für den Inhalt und einen für seine Fotos. Der Index schaut nie in
   einen Stand hinein — was drinsteht, geht nur das Spiel etwas an.
   Stand 1 eines Altbestands behält bewusst die alten Schlüssel: so muss beim
   Umstieg kein einziges Byte umkopiert werden (der Speicher ist knapp). */
export const INDEX_KEY = 'wipfelkratzer-staende';
export const LEGACY_STAND = 'wipfelkratzer-v1';
export const LEGACY_FOTOS = 'wipfelkratzer-fotos';
export const MAX_STAENDE = 4;
const INDEX_V = 2;

const lies = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const schreib = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const weg = k => { try { localStorage.removeItem(k); } catch (e) {} };

const neueId = () => 's' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

function frischerEintrag(name, legacy) {
  const id = legacy ? 's1' : neueId();
  return { id, name: name || 'Mein Wipfelkratzer',
    standKey: legacy ? LEGACY_STAND : 'wipfelkratzer-stand-' + id,
    fotoKey: legacy ? LEGACY_FOTOS : 'wipfelkratzer-fotos-' + id,
    bild: null, angelegt: Date.now(), zuletzt: Date.now() };
}

function gueltig(e) {
  return !!e && typeof e === 'object' && typeof e.id === 'string' && e.id
    && typeof e.standKey === 'string' && e.standKey
    && typeof e.fotoKey === 'string' && e.fotoKey;
}

/* Liest den Index. Wirft nie: ist er kaputt, fremd oder gar nicht da, entsteht
   ein Index mit genau einem Stand auf den Altschlüsseln — derselbe Pfad für
   «alter Einzelstand» und «frische Installation». */
export function ladeIndex() {
  let idx = null;
  try { idx = JSON.parse(lies(INDEX_KEY) || 'null'); } catch (e) { idx = null; }
  if (!idx || typeof idx !== 'object' || Array.isArray(idx) || !Array.isArray(idx.staende)) idx = null;
  if (idx) {
    idx.staende = idx.staende.filter(gueltig).slice(0, MAX_STAENDE);
    idx.staende.forEach(e => { if (typeof e.name !== 'string' || !e.name) e.name = 'Wipfelkratzer'; });
    if (!idx.staende.length) idx = null;
  }
  if (!idx) idx = { v: INDEX_V, aktiv: '', staende: [frischerEintrag(null, true)] };
  idx.v = INDEX_V;
  if (!idx.staende.some(e => e.id === idx.aktiv)) idx.aktiv = idx.staende[0].id;
  return idx;
}

export function schreibeIndex(idx) { return schreib(INDEX_KEY, JSON.stringify(idx)); }

export function aktiverStand() {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === idx.aktiv) || idx.staende[0];
  if (lies(INDEX_KEY) === null) schreibeIndex(idx);
  return e;
}

export function wähleStand(id) {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === id);
  if (!e) return false;
  idx.aktiv = id; e.zuletzt = Date.now();
  return schreibeIndex(idx);
}

/* Legt einen Stand an — immer mit eigenen Schlüsseln, nie auf den Altschlüsseln.
   Gibt null zurück, wenn kein Platz mehr ist oder der Index nicht schreibbar
   war; dann ist auch nichts halb angelegt. */
export function neuerStand(name) {
  const idx = ladeIndex();
  if (idx.staende.length >= MAX_STAENDE) return null;
  const e = frischerEintrag(name || vorschlagsName(idx), false);
  idx.staende.push(e);
  if (!schreibeIndex(idx)) return null;
  return e;
}

function vorschlagsName(idx) {
  const basis = 'Neuer Turm';
  if (!idx.staende.some(e => e.name === basis)) return basis;
  for (let n = 2; ; n++) { const k = basis + ' ' + n; if (!idx.staende.some(e => e.name === k)) return k; }
}

export function benenneUm(id, name) {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === id);
  if (!e) return false;
  e.name = String(name || '').trim().slice(0, 40) || 'Wipfelkratzer';
  return schreibeIndex(idx);
}

/* Löscht Stand-Inhalt und Galerie und den Eintrag. War es der letzte, entsteht
   sofort ein frischer leerer Stand — das Spiel ist nie standlos. */
export function loescheStand(id) {
  const idx = ladeIndex();
  const i = idx.staende.findIndex(x => x.id === id);
  if (i < 0) return aktiverStand();
  const e = idx.staende[i];
  weg(e.standKey); weg(e.fotoKey);
  idx.staende.splice(i, 1);
  if (!idx.staende.length) idx.staende.push(frischerEintrag(null, true));
  if (!idx.staende.some(x => x.id === idx.aktiv)) idx.aktiv = idx.staende[0].id;
  schreibeIndex(idx);
  return idx.staende.find(x => x.id === idx.aktiv);
}

export function merkeBild(id, dataUrl) {
  const idx = ladeIndex();
  const e = idx.staende.find(x => x.id === id);
  if (!e) return false;
  e.bild = dataUrl; e.zuletzt = Date.now();
  return schreibeIndex(idx);
}

/* Für die Karten in der Übersicht: Stockwerke und Möbelzahl, ohne den Stand ins
   Spiel zu laden. Ein unlesbarer Stand gilt als leer, nicht als Fehler. */
export function standInfo(e) {
  let s = null;
  try { s = JSON.parse(lies(e.standKey) || 'null'); } catch (err) { s = null; }
  if (!s || typeof s !== 'object') return { floors: 0, möbel: 0 };
  let möbel = 0;
  const r = s.rooms && typeof s.rooms === 'object' ? s.rooms : {};
  for (const k in r) if (Array.isArray(r[k])) möbel += r[k].length;
  return { floors: Number(s.floors) || 0, möbel };
}
