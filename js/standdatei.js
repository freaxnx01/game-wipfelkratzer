/* Das Dateiformat für einen gesicherten Turm — und die Prüfung fremder Dateien.
   Eine eingelesene Datei ist eine Eingabe, keine Quelle der Wahrheit: der Stand
   wird nicht gemerged, sondern aus einer Positivliste neu aufgebaut. Was die
   Liste nicht kennt, fällt still weg — lieber ein Turm ohne Sessel als ein
   weisses Bild.
   Die erlaubten Werte kommen alle aus models.js, damit ein neues Möbel oder
   eine neue Tapete nicht zusätzlich hier nachgetragen werden muss. */
import { CATALOG, WALL_ITEMS, WALLS, FLOORS, FURN_COLORS, SEASONS,
  DESIGN_MAX, normalizeBuild } from './models.js';

export const DATEI_TYP = 'wipfelkratzer-stand';
export const DATEI_V = 2;               /* 2 = Tapete pro Wand, 1 = Tapete als String */
export const MAX_DATEI = 6 * 1024 * 1024;
/* Wählbare Turmhöhen wie TOWER_CHOICES (js/game.js:117). Absichtlich gespiegelt
   statt importiert: game.js importiert dieses Modul, nicht umgekehrt. Weicht die
   Liste eines Tages ab, ist das folgenlos — game.js prüft maxFloors beim Laden
   ein zweites Mal und fällt sonst auf den Zehner-Turm zurück (js/game.js:117). */
const HOEHEN = [10, 20, 50];
const MAXF = Math.max(...HOEHEN);
const WALL_KEYS = ['back', 'left', 'right', 'front'];   /* wie js/game.js:21 */
const MAX_FOTOS = 20;                   /* wie js/game.js:2135 */
const MAX_TEXT = 500;
const MAX_MOEBEL = 80;                  /* pro Raum; grosszügig über allem, was hineinpasst */

const MOEBEL = new Set(CATALOG.map(c => c.id));
const TAPETEN = new Set(WALLS.map(w => w.id));
const BOEDEN = new Set(FLOORS.map(f => f.id));
const FARBEN = new Set(FURN_COLORS.map(c => c.id));
const JAHRESZEITEN = new Set(SEASONS.map(s => s.id));
/* Dach und Spielplatz sind Räume wie die Stockwerke (js/game.js:517). */
const RAUM_KEYS = new Set(['roof', 'garten', ...Array.from({ length: MAXF + 1 }, (_, i) => String(i))]);

const zahl = (v, min, max, vor) => {
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
  if (!Number.isFinite(n)) return vor;
  return Math.min(max, Math.max(min, n));
};
const ganz = (v, min, max, vor) => { const n = zahl(v, min, max, NaN); return Number.isFinite(n) ? Math.round(n) : vor; };
const objekt = v => v && typeof v === 'object' && !Array.isArray(v) ? v : null;

export function baueDatei({ name, bild, stand, fotos }) {
  return {
    typ: DATEI_TYP,
    version: DATEI_V,
    spiel: (typeof window !== 'undefined' && window.GAME_VERSION) || '',
    erstellt: new Date().toISOString(),
    name: String(name || 'Wipfelkratzer').slice(0, 40),
    bild: typeof bild === 'string' && bild.startsWith('data:image/') ? bild : null,
    stand: stand || {},
    fotos: Array.isArray(fotos) ? fotos : null,
  };
}

/* iOS filtert den Dateidialog nach Typ — deshalb .json und nicht eine eigene
   Endung, die in «Dateien» ausgegraut wäre. */
export function dateiName(name, datum) {
  const d = datum || new Date(), pad = n => String(n).padStart(2, '0');
  const teil = String(name || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'turm';
  return `wipfelkratzer-${teil}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function pruefeDatei(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, grund: 'Diese Datei ist leer.' };
  if (text.length > MAX_DATEI) return { ok: false, grund: 'Diese Datei ist zu gross.' };
  let roh = null;
  try { roh = JSON.parse(text); } catch (e) { return { ok: false, grund: 'Diese Datei versteht Willi nicht.' }; }
  if (!objekt(roh)) return { ok: false, grund: 'Diese Datei versteht Willi nicht.' };
  if (roh.typ !== DATEI_TYP) return { ok: false, grund: 'Das ist kein gesicherter Wipfelkratzer.' };
  const v = Number(roh.version);
  if (!Number.isFinite(v) || v < 1) return { ok: false, grund: 'Das ist kein gesicherter Wipfelkratzer.' };
  if (v > DATEI_V) return { ok: false, grund: 'Diese Datei kommt aus einer neueren Version des Spiels.' };
  if (!objekt(roh.stand)) return { ok: false, grund: 'In dieser Datei steckt kein Turm.' };
  return { ok: true, datei: {
    version: v,
    spiel: typeof roh.spiel === 'string' ? roh.spiel.slice(0, 20) : '',
    name: (typeof roh.name === 'string' ? roh.name.trim().slice(0, 40) : '') || 'Eingelesener Turm',
    bild: typeof roh.bild === 'string' && roh.bild.startsWith('data:image/') ? roh.bild.slice(0, 200000) : null,
    stand: bereinigeStand(roh.stand),
    fotos: roh.fotos == null ? null : bereinigeFotos(roh.fotos),
  } };
}

/* Positivliste: nur bekannte Felder, nur bekannte Möbel, nur endliche Zahlen.
   Es wird durchweg ein frisches Objektliteral aufgebaut und nie ein fremder
   Schlüssel übernommen — ein `__proto__` aus der Datei ist damit nur eine
   eigene Eigenschaft, die niemand abschreibt. */
export function bereinigeStand(roh) {
  const s = objekt(roh) || {};
  /* Eine unbekannte Turmhöhe wird zum Zehner-Turm, genau wie beim Laden
     (js/game.js:117) — und nicht etwa auf die grösste Höhe hochgezogen. */
  const gewuenscht = ganz(s.maxFloors, 0, 9999, 0);
  const maxFloors = HOEHEN.includes(gewuenscht) ? gewuenscht : 10;
  const out = {
    floors: ganz(s.floors, 0, maxFloors, 0),
    maxFloors,
    nuts: ganz(s.nuts, 0, 999999, 0),
    season: JAHRESZEITEN.has(s.season) ? s.season : 'sommer',
    bridge: !!s.bridge, garden: !!s.garden, night: !!s.night, cutaway: !!s.cutaway,
    rooms: {}, wallpaper: {}, flooring: {}, fulfilled: {}, tenantPos: {},
    designs: bereinigeDesigns(s.designs),
  };
  const raeume = objekt(s.rooms) || {};
  for (const k of Object.keys(raeume)) {
    if (!RAUM_KEYS.has(k) || !Array.isArray(raeume[k])) continue;
    const liste = [];
    for (const e of raeume[k].slice(0, MAX_MOEBEL)) {
      const eintrag = bereinigeMoebel(e);
      if (eintrag) liste.push(eintrag);
    }
    if (liste.length) out.rooms[k] = liste;
  }
  const tap = objekt(s.wallpaper) || {};
  for (const k of Object.keys(tap)) {
    if (!RAUM_KEYS.has(k)) continue;
    const wp = tap[k];
    /* Generation 1: ein String für die ganze Wohnung. Bleibt ein String — die
       bestehende Migration macht daraus beim Laden vier Wände (js/game.js:536-539). */
    if (typeof wp === 'string') { if (TAPETEN.has(wp)) out.wallpaper[k] = wp; continue; }
    if (!objekt(wp)) continue;
    const sauber = {};
    for (const w of WALL_KEYS) if (TAPETEN.has(wp[w])) sauber[w] = wp[w];
    if (Object.keys(sauber).length) out.wallpaper[k] = sauber;
  }
  const bod = objekt(s.flooring) || {};
  for (const k of Object.keys(bod)) if (RAUM_KEYS.has(k) && BOEDEN.has(bod[k])) out.flooring[k] = bod[k];
  const erf = objekt(s.fulfilled) || {};
  for (const k of Object.keys(erf)) if (RAUM_KEYS.has(k) && erf[k]) out.fulfilled[k] = true;
  const plaetze = objekt(s.tenantPos) || {};
  for (const k of Object.keys(plaetze)) {
    if (!RAUM_KEYS.has(k) || !Array.isArray(plaetze[k])) continue;
    const liste = plaetze[k].slice(0, 8).map(bereinigePlatz);
    if (liste.every(Boolean) && liste.length) out.tenantPos[k] = liste;
  }
  return out;
}

/* Ein Möbeleintrag hat die Form { id, cell, x, y, z, rot, wall?, color?, build?, fill? }
   (js/game.js:1325, js/game.js:775). Eigenbau-Möbel führen ihren Bauplan mit
   sich; er geht durch dieselbe Prüfung wie beim Laden (js/game.js:556-561). */
function bereinigeMoebel(e) {
  if (!objekt(e)) return null;
  const eigenbau = e.id === 'eigenbau';
  if (!eigenbau && !MOEBEL.has(e.id)) return null;
  const eintrag = {
    id: e.id,
    cell: ganz(e.cell, 0, 999, 0),
    x: zahl(e.x, -50, 50, NaN),
    y: zahl(e.y, -50, 50, 0),
    z: zahl(e.z, -50, 50, NaN),
    rot: zahl(e.rot, -100, 100, 0),
  };
  if (!Number.isFinite(eintrag.x) || !Number.isFinite(eintrag.z)) return null;
  if (eigenbau) {
    const bau = normalizeBuild(e.build);
    if (!bau) return null;
    eintrag.build = bau;
  }
  if (WALL_ITEMS.has(e.id)) {
    if (e.wall !== undefined && !WALL_KEYS.includes(e.wall)) return null;
    eintrag.wall = WALL_KEYS.includes(e.wall) ? e.wall : 'back';
  }
  if (FARBEN.has(e.color)) eintrag.color = e.color;
  if (e.fill !== undefined) eintrag.fill = ganz(e.fill, 0, 9, 0);
  return eintrag;
}

/* Von Hand gesetzter Tierplatz: { x, z, rot } (js/game.js:1417-1422). */
function bereinigePlatz(p) {
  if (!objekt(p)) return null;
  const x = zahl(p.x, -50, 50, NaN), z = zahl(p.z, -50, 50, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z, rot: zahl(p.rot, -100, 100, 0) };
}

/* Entwürfe aus der Schreinerei — dieselbe Bereinigung wie beim Laden
   (js/game.js:564-570). */
function bereinigeDesigns(roh) {
  if (!Array.isArray(roh)) return [];
  return roh
    .map(d => { const bau = normalizeBuild(d); return bau ? { name: String(d.name || 'Eigenbau').slice(0, 40), parts: bau.parts } : null; })
    .filter(Boolean).slice(0, DESIGN_MAX);
}

/* Fotos landen als src in der Galerie (js/game.js:2184) — nur echte
   Bild-Data-URLs kommen durch. */
export function bereinigeFotos(roh) {
  if (!Array.isArray(roh)) return [];
  const out = [];
  for (const f of roh) {
    if (out.length >= MAX_FOTOS) break;
    if (!objekt(f) || typeof f.url !== 'string') continue;
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f.url)) continue;
    const t = Number(f.t);
    if (!Number.isFinite(t)) continue;
    out.push({ url: f.url, text: typeof f.text === 'string' ? f.text.slice(0, MAX_TEXT) : '', t });
  }
  return out;
}
