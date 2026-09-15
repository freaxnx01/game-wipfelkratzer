import * as THREE from 'three';

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
export const MAT = {
  plaster: L(0xf3e2bd), plasterIn: L(0xf8ecd0), wood: L(0xb9854e), woodD: L(0x8a5a2b),
  woodL: L(0xd8b078), leaf: L(0x77aa5c), leafD: L(0x568b49), red: L(0xc0432e),
  blue: L(0x3f6fb5), orange: L(0xe08a3c), cream: L(0xfdf4e0), white: L(0xf6f2e8),
  grey: L(0x9a8f86), dark: L(0x4a4038), water: L(0x5aa7c7), black: L(0x2b2b2b),
  gold: L(0xd9973f), glow: L(0xffd98a, { emissive: 0xffc257, emissiveIntensity: 0.85 }),
  fire: L(0xff9a3c, { emissive: 0xff7a20, emissiveIntensity: 1 }),
  terra: L(0xb56a45), green2: L(0x8fb96a), pink: L(0xe6a0b8),
};

/* Palette für einfärbbare Möbel. Jeder Eintrag verweist auf eine bestehende
   MAT-Instanz — es wird nie eine neue erzeugt und nie eine mutiert, sonst
   färbt sich der halbe Turm mit. */
export const FURN_COLORS = [
  { id: 'rot', name: 'Rot', mat: 'red' },
  { id: 'blau', name: 'Blau', mat: 'blue' },
  { id: 'orange', name: 'Orange', mat: 'orange' },
  { id: 'gruen', name: 'Grün', mat: 'green2' },
  { id: 'rosa', name: 'Rosa', mat: 'pink' },
  { id: 'creme', name: 'Creme', mat: 'cream' },
];
/* Möbel mit einer einfärbbaren Korpusfläche (Stoff/Korpuston, kein Holz,
   kein Beschlag, kein Effekt). Siehe Spec «Korpusregel». */
export const TINTABLE = new Set(['sofa', 'bett', 'etagenbett', 'teppich', 'lampe', 'badewanne', 'pflanze', 'liegestuhl']);
export const matOfColor = colorId => {
  const def = FURN_COLORS.find(c => c.id === colorId);
  return def ? MAT[def.mat] : null;
};

function mesh(geo, mat, x = 0, y = 0, z = 0, g) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; if (g) g.add(m); return m;
}
const box = (g, w, h, d, mat, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, g);
const cyl = (g, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, g);
const sph = (g, r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat, x, y, z, g); m.scale.set(sx, sy, sz); return m; };
const G = () => new THREE.Group();

/* ---------- Wipfkea: die gemeinsame Formsprache der Serie ----------
   Alles, was die Serienmöbel zusammenhält, steht hier. Eine Serie ist in
   diesem Spiel bewusst eine Form- und keine Farbfrage: die Farbwahl pro
   Möbel ist Issue #34, die Serie sind Brettstärke, rechte Winkel,
   sichtbare Dübel und Wangen statt Beine. Ein Serienmöbel greift nie
   direkt auf ein MAT zu, sondern immer über die Rollen unten. */
const WK_T = 0.06;           /* Brettstärke, in der ganzen Serie identisch */
const WK_LEG = 0.05;         /* Kantenmass der Vierkantbeine */
const WK_BOARD = MAT.woodD;  /* Braun: alles Tragende */
const WK_SOFT = MAT.pink;    /* Pink: Polster und Blenden */
const WK_DOWEL = MAT.woodL;  /* Hell: sichtbare Dübel und Rückwand */

/* Liegendes Brett (Boden, Tablar, Sitzfläche). */
const wkBoard = (g, w, d, mat, x, y, z) => box(g, w, WK_T, d, mat, x, y, z);
/* Stehende Wange (Seitenteil, Armlehne). */
const wkPanel = (g, h, d, mat, x, y, z) => box(g, WK_T, h, d, mat, x, y, z);
/* Sichtbarer Dübelkopf — das Erkennungszeichen der Serie.
   axis 'x' zeigt seitlich heraus, 'y' nach oben, 'z' nach vorn. */
function wkDowel(g, x, y, z, axis = 'z') {
  const d = cyl(g, 0.02, 0.02, 0.03, WK_DOWEL, x, y, z, 8);
  if (axis === 'z') d.rotation.x = Math.PI / 2;
  else if (axis === 'x') d.rotation.z = Math.PI / 2;
  return d;
}

/* ---------- Pool-Helfer: Nierenform nach der Buchseite ---------- */
/* Kontur (x, Tiefe) gegen den Uhrzeigersinn, beginnt an der Leiter-Spitze; die Delle
   bei x≈0 liegt hinten. Wird als geschlossener Spline geglättet. */
const POOL_OUTLINE = [[0.71, -0.02], [0.6, 0.3], [0.3, 0.45], [0, 0.24], [-0.32, 0.36], [-0.6, 0.21], [-0.7, -0.06], [-0.55, -0.3], [-0.23, -0.38], [0.19, -0.43], [0.56, -0.34]];
const POOL_TILE = L(0x7fc4dd), POOL_WAVE = L(0x9ccfe4), POOL_FROG = L(0x6fae4e);
function poolOutline() {
  const curve = new THREE.CatmullRomCurve3(POOL_OUTLINE.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return curve.getPoints(44).slice(0, -1).map(p => new THREE.Vector2(p.x, p.y));
}
/* Versetzt die Kontur um d nach innen (negativ: nach aussen) — gleichmässige Wandstärke statt Skalierung. */
function poolInset(points, d) {
  const n = points.length;
  return points.map((p, i) => { const a = points[(i + n - 1) % n], b = points[(i + 1) % n];
    const t = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    return new THREE.Vector2(p.x - t.y * d, p.y + t.x * d); });
}
/* Extrudiert eine Kontur (optional mit Loch) nach oben; Kontur-Tiefe zeigt nach -z. */
function poolSlab(g, outer, hole, depth, mat, y) {
  const shape = new THREE.Shape(outer); if (hole) shape.holes.push(new THREE.Path(hole));
  const m = mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), mat, 0, y, 0, g);
  m.rotation.x = -Math.PI / 2; return m;
}
/* Zwei Halbbögen ergeben eine liegende Welle «~» auf dem Wasser. */
function poolRipple(g, x, z, r, angle) {
  const s = G(); g.add(s); s.position.set(x, 0.006, z); s.rotation.y = angle;
  [-1, 1].forEach(d => mesh(new THREE.TorusGeometry(r, 0.011, 6, 12, Math.PI), POOL_WAVE, d * r, 0, 0, s).rotation.set(-Math.PI / 2, 0, d > 0 ? Math.PI : 0));
}
function poolFrogHead(f) {
  sph(f, 0.06, POOL_FROG, 0, 0.03, 0.09);
  [-0.035, 0.035].forEach(x => { sph(f, 0.026, POOL_FROG, x, 0.08, 0.1); sph(f, 0.015, MAT.white, x, 0.084, 0.118); sph(f, 0.007, MAT.black, x, 0.084, 0.13); });
}
function poolFrogSwimming(g, x, z, angle) {
  const f = G(); g.add(f); f.position.set(x, 0, z); f.rotation.y = angle;
  sph(f, 0.08, POOL_FROG, 0, 0, 0, 1.1, 0.55, 1.25);
  [-1, 1].forEach(s => sph(f, 0.03, POOL_FROG, s * 0.11, 0.01, 0.05, 1.7, 0.5, 0.8));
  poolFrogHead(f);
}
function poolFrogPeeking(g, x, z, angle) {
  const f = G(); g.add(f); f.position.set(x, -0.03, z); f.rotation.y = angle; poolFrogHead(f);
}

/* ---------- Terrassenhaus-Helfer: Schilfdach-Häuschen nach der Buchseite ---------- */
const HAUS_WALL = L(0xdf9d4f); /* eigene Instanz, kein wiederverwendeter MAT-Ton (Regel aus #34) */
/* Rundbogen-Öffnung als Pfad (Mittelpunkt cx, Unterkante cy, Breite w, Höhe h). */
function hausArch(cx, cy, w, h) {
  const r = w / 2, p = new THREE.Path();
  p.moveTo(cx - r, cy); p.lineTo(cx - r, cy + h - r); p.absarc(cx, cy + h - r, r, Math.PI, 0, true); p.lineTo(cx + r, cy); p.closePath();
  return p;
}
/* Wandscheibe: Kontur in der xy-Ebene, Dicke t nach +z; optional mit Bogenloch. */
function hausWall(g, pts, t, arch) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); if (arch) shape.holes.push(arch);
  return mesh(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }), HAUS_WALL, 0, 0, 0, g);
}
/* Eine Dachhälfte: dunkle Grundplatte, darauf Halmbündel als liegende Zylinder, die am First
   bündig beginnen und an der Traufe unterschiedlich weit herausstehen (ausgefranst). */
function hausRoofHalf(g, s, angle, len) {
  const half = G(); g.add(half); half.position.set(0, 1.34, s * 0.41); half.rotation.set(s * angle, s > 0 ? 0 : Math.PI, 0);
  box(half, 2.4, 0.08, len, MAT.leafD, 0, 0, 0);
  for (let i = 0; i < 17; i++) { const l = len - 0.02 + ((i * 7 + (s > 0 ? 0 : 3)) % 5) * 0.02;
    const b = cyl(half, 0.075, 0.075, l, i % 2 ? MAT.leaf : MAT.green2, -1.12 + i * 0.14, 0.115, (l - len) / 2, 8); b.rotation.x = Math.PI / 2; }
}

/* ---------------- Möbel ---------------- */
const FURN = {
  bett(body = MAT.red) { const g = G();
    box(g, 0.8, 0.22, 1.05, MAT.wood, 0, 0.16); box(g, 0.8, 0.34, 0.08, MAT.wood, 0, 0.3, -0.5);
    box(g, 0.72, 0.1, 0.95, MAT.cream, 0, 0.31); box(g, 0.5, 0.09, 0.26, MAT.white, 0, 0.38, -0.32);
    box(g, 0.74, 0.07, 0.55, body, 0, 0.35, 0.2);
    [-0.34, 0.34].forEach(x => [-0.46, 0.46].forEach(z => box(g, 0.07, 0.12, 0.07, MAT.woodD, x, 0.05, z)));
    return g; },
  /* Ohne gewählte Farbe behalten obere und untere Decke ihren Rot/Blau-Kontrast. */
  etagenbett(body) { const g = G();
    [0.2, 0.85].forEach(y => { box(g, 0.8, 0.14, 1.0, MAT.wood, 0, y); box(g, 0.72, 0.08, 0.9, MAT.cream, 0, y + 0.11); box(g, 0.7, 0.06, 0.4, body || (y > 0.5 ? MAT.blue : MAT.red), 0, y + 0.14, 0.2); });
    [-0.37, 0.37].forEach(x => [-0.47, 0.47].forEach(z => box(g, 0.07, 1.15, 0.07, MAT.woodD, x, 0.57, z)));
    for (let i = 0; i < 4; i++) box(g, 0.26, 0.04, 0.04, MAT.woodL, 0.45, 0.18 + i * 0.22, 0.3);
    box(g, 0.04, 0.75, 0.04, MAT.woodD, 0.45 - 0.13, 0.5, 0.3); box(g, 0.04, 0.75, 0.04, MAT.woodD, 0.58, 0.5, 0.3);
    return g; },
  tisch() { const g = G();
    cyl(g, 0.4, 0.4, 0.06, MAT.woodL, 0, 0.6); cyl(g, 0.05, 0.07, 0.58, MAT.woodD, 0, 0.3); cyl(g, 0.2, 0.24, 0.05, MAT.woodD, 0, 0.03);
    return g; },
  stuhl() { const g = G();
    box(g, 0.34, 0.05, 0.34, MAT.wood, 0, 0.34); box(g, 0.34, 0.42, 0.05, MAT.wood, 0, 0.57, -0.15);
    [-0.13, 0.13].forEach(x => [-0.13, 0.13].forEach(z => box(g, 0.05, 0.33, 0.05, MAT.woodD, x, 0.17, z)));
    return g; },
  sofa(body = MAT.red) { const g = G();
    box(g, 0.85, 0.26, 0.44, body, 0, 0.2); box(g, 0.85, 0.36, 0.12, body, 0, 0.48, -0.17);
    [-0.4, 0.4].forEach(x => box(g, 0.11, 0.4, 0.44, body, x, 0.3));
    box(g, 0.3, 0.09, 0.3, MAT.orange, -0.16, 0.37, 0.03); box(g, 0.3, 0.09, 0.3, MAT.cream, 0.16, 0.37, 0.03);
    return g; },
  schrank() { const g = G();
    box(g, 0.7, 1.25, 0.36, MAT.wood, 0, 0.66); box(g, 0.3, 1.1, 0.03, MAT.woodL, -0.165, 0.66, 0.185); box(g, 0.3, 1.1, 0.03, MAT.woodL, 0.165, 0.66, 0.185);
    sph(g, 0.03, MAT.woodD, -0.05, 0.66, 0.21); sph(g, 0.03, MAT.woodD, 0.05, 0.66, 0.21); box(g, 0.74, 0.08, 0.4, MAT.woodD, 0, 1.32);
    return g; },
  regal() { const g = G();
    [-0.4, 0.4].forEach(x => box(g, 0.05, 1.1, 0.3, MAT.wood, x, 0.55));
    [0.12, 0.48, 0.84].forEach((y, r) => { box(g, 0.85, 0.05, 0.3, MAT.wood, 0, y);
      const cols = [MAT.red, MAT.blue, MAT.leafD, MAT.orange, MAT.grey];
      for (let i = 0; i < 5; i++) box(g, 0.09, 0.24 - (i % 2) * 0.04, 0.2, cols[(i + r) % 5], -0.28 + i * 0.13, y + 0.15 - (i % 2) * 0.02, 0); });
    box(g, 0.85, 0.05, 0.3, MAT.wood, 0, 1.1);
    return g; },
  /* Wipfkea — Serie in Braun und Pink, siehe Spec «Wipfkea». Der
     body-Parameter folgt der Signatur aus Issue #34: ohne Argument sieht
     das Möbel genau so aus wie hier beschrieben. */
  wk_regal(body = WK_BOARD) { const g = G();
    const w = 0.8, d = 0.3, h = 1.2, inner = w - 2 * WK_T;
    [-1, 1].forEach(s => wkPanel(g, h, d, body, s * (w / 2 - WK_T / 2), h / 2, 0));
    const shelves = [0.05, 0.42, 0.79, 1.16];
    shelves.forEach(y => wkBoard(g, inner, d, body, 0, y, 0));
    box(g, inner, h, 0.02, WK_DOWEL, 0, h / 2, -d / 2 + 0.01);
    shelves.forEach(y => [-1, 1].forEach(s => wkDowel(g, s * (w / 2 + 0.005), y, d / 2 - 0.07, 'x')));
    return g; },
  wk_tisch(body = WK_BOARD) { const g = G();
    const w = 0.7, top = 0.46, legH = top - WK_T, off = w / 2 - 0.06;
    wkBoard(g, w, w, body, 0, top - WK_T / 2);
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
      box(g, WK_LEG, legH, WK_LEG, body, sx * off, legH / 2, sz * off);
      wkDowel(g, sx * off, top + 0.005, sz * off, 'y'); }));
    return g; },
  /* body ist hier das Kissen: die einzige bunte Fläche am Stuhl. */
  wk_stuhl(body = WK_SOFT) { const g = G();
    const w = 0.42, d = 0.42, seat = 0.38, inner = w - 2 * WK_T;
    [-1, 1].forEach(s => wkPanel(g, seat, d, WK_BOARD, s * (w / 2 - WK_T / 2), seat / 2, 0));
    wkBoard(g, inner, d, WK_BOARD, 0, seat - WK_T / 2);
    const back = box(g, w, 0.42, WK_T, WK_BOARD, 0, seat + 0.21, -d / 2 + WK_T / 2);
    back.rotation.x = -0.12;
    box(g, inner - 0.02, 0.05, d - 0.08, body, 0, seat + 0.025, 0.01);
    [-1, 1].forEach(s => [-0.14, 0.14].forEach(z =>
      wkDowel(g, s * (w / 2 + 0.005), seat - WK_T / 2, z, 'x')));
    return g; },
  /* body sind die vier Kissen — Sitz und Rücken. Das Gestell bleibt braun. */
  wk_sofa(body = WK_SOFT) { const g = G();
    const w = 0.86, d = 0.48, inner = w - 2 * WK_T;
    [-1, 1].forEach(s => wkPanel(g, 0.54, d, WK_BOARD, s * (w / 2 - WK_T / 2), 0.27, 0));
    box(g, inner, 0.44, WK_T, WK_BOARD, 0, 0.32, -d / 2 + WK_T / 2);
    wkBoard(g, inner, d - WK_T, WK_BOARD, 0, 0.28, 0.03);
    [-0.185, 0.185].forEach(x => box(g, 0.34, 0.12, 0.38, body, x, 0.37, 0.03));
    [-0.185, 0.185].forEach(x => box(g, 0.34, 0.26, 0.1, body, x, 0.53, -0.13));
    [-1, 1].forEach(s => [0.1, 0.28].forEach(y =>
      wkDowel(g, s * (w / 2 + 0.005), y, 0.16, 'x')));
    return g; },
  kommode() { const g = G();
    /* Korpus auf kurzen Füssen, drei Schubladen, Deckplatte als Ablage (SURFACES). */
    box(g, 0.86, 0.76, 0.40, MAT.wood, 0, 0.48);
    box(g, 0.94, 0.07, 0.46, MAT.woodL, 0, 0.89);
    [0.26, 0.50, 0.74].forEach(y => { box(g, 0.76, 0.20, 0.03, MAT.woodL, 0, y, 0.205);
      [-0.18, 0.18].forEach(x => sph(g, 0.035, MAT.woodD, x, y, 0.235)); });
    [-0.35, 0.35].forEach(x => [-0.15, 0.15].forEach(z => box(g, 0.09, 0.10, 0.09, MAT.woodD, x, 0.05, z)));
    return g; },
  teppich(body = MAT.red) { const g = G();
    const m1 = cyl(g, 0.52, 0.52, 0.025, body, 0, 0.012, 0, 28); m1.scale.z = 0.72;
    const m2 = cyl(g, 0.36, 0.36, 0.03, MAT.orange, 0, 0.014, 0, 28); m2.scale.z = 0.72;
    const m3 = cyl(g, 0.18, 0.18, 0.035, MAT.cream, 0, 0.016, 0, 24); m3.scale.z = 0.72;
    return g; },
  lampe(body = MAT.orange) { const g = G();
    cyl(g, 0.14, 0.18, 0.05, MAT.woodD, 0, 0.025); cyl(g, 0.025, 0.025, 0.85, MAT.wood, 0, 0.45);
    cyl(g, 0.12, 0.24, 0.24, body, 0, 0.95); sph(g, 0.06, MAT.glow, 0, 0.86);
    return g; },
  ofen() { const g = G();
    cyl(g, 0.25, 0.28, 0.62, MAT.dark, 0, 0.31); box(g, 0.2, 0.18, 0.04, MAT.fire, 0, 0.28, 0.26);
    cyl(g, 0.07, 0.07, 0.7, MAT.dark, 0, 0.9); cyl(g, 0.1, 0.07, 0.08, MAT.dark, 0, 1.25);
    [-0.12, 0.12].forEach(x => box(g, 0.06, 0.08, 0.06, MAT.black, x, 0.04, 0.18));
    return g; },
  badewanne(body = MAT.white) { const g = G();
    const t = cyl(g, 0.34, 0.26, 0.36, body, 0, 0.28, 0, 24); t.scale.x = 1.35;
    const w = cyl(g, 0.29, 0.29, 0.03, MAT.water, 0, 0.42, 0, 24); w.scale.x = 1.35;
    [-0.3, 0.3].forEach(x => [-0.18, 0.18].forEach(z => sph(g, 0.06, MAT.gold, x, 0.06, z)));
    cyl(g, 0.02, 0.02, 0.3, MAT.grey, 0.42, 0.55); sph(g, 0.045, MAT.grey, 0.42, 0.7);
    return g; },
  pflanze(body = MAT.terra) { const g = G();
    cyl(g, 0.14, 0.1, 0.2, body, 0, 0.1); cyl(g, 0.02, 0.03, 0.4, MAT.leafD, 0, 0.38);
    sph(g, 0.16, MAT.leaf, 0, 0.62); sph(g, 0.12, MAT.leafD, 0.13, 0.5); sph(g, 0.11, MAT.leaf, -0.12, 0.53);
    return g; },
  bild() { const g = G();
    [-0.2, 0.2].forEach(x => { const l = box(g, 0.04, 0.9, 0.04, MAT.wood, x, 0.45, 0.06); l.rotation.x = -0.12; });
    const l3 = box(g, 0.04, 0.85, 0.04, MAT.wood, 0, 0.43, -0.1); l3.rotation.x = 0.25;
    const fr = box(g, 0.56, 0.46, 0.04, MAT.gold, 0, 0.62, 0.1); fr.rotation.x = -0.12;
    const cv = box(g, 0.48, 0.38, 0.045, MAT.green2, 0, 0.62, 0.105); cv.rotation.x = -0.12;
    const fl = sph(g, 0.06, MAT.red, 0, 0.68, 0.14); fl.scale.z = 0.4; sph(g, 0.028, MAT.gold, 0, 0.68, 0.16);
    return g; },
  schaukelstuhl() { const g = G();
    box(g, 0.4, 0.05, 0.38, MAT.wood, 0, 0.32); box(g, 0.4, 0.5, 0.05, MAT.wood, 0, 0.55, -0.17).rotation.x = 0.15;
    [-0.16, 0.16].forEach(x => { [-0.14, 0.14].forEach(z => box(g, 0.045, 0.28, 0.045, MAT.woodD, x, 0.17, z));
      const r = mesh(new THREE.TorusGeometry(0.32, 0.028, 10, 24, 1.9), MAT.woodD, x, 0.34, 0, g);
      r.rotation.y = Math.PI / 2; r.rotation.z = Math.PI + 0.6; });
    return g; },
  hamsterrad() { const g = G();
    const w = G(); g.add(w); w.position.y = 0.52; g.userData.wheel = w;
    mesh(new THREE.TorusGeometry(0.38, 0.035, 12, 30), MAT.orange, 0, 0, 0, w);
    for (let i = 0; i < 5; i++) { const s = cyl(w, 0.02, 0.02, 0.74, MAT.woodL, 0, 0, 0); s.rotation.z = i * Math.PI / 5; }
    [-0.12, 0.12].forEach(z => { const a = cyl(g, 0.03, 0.04, 0.6, MAT.woodD, 0, 0.26, z); a.rotation.x = z > 0 ? -0.25 : 0.25; });
    return g; },
  klavier() { const g = G();
    box(g, 0.85, 0.72, 0.3, MAT.dark, 0, 0.44, -0.05); box(g, 0.8, 0.05, 0.2, MAT.white, 0, 0.46, 0.14);
    for (let i = 0; i < 7; i++) box(g, 0.05, 0.04, 0.1, MAT.black, -0.3 + i * 0.1, 0.5, 0.1);
    [-0.36, 0.36].forEach(x => box(g, 0.07, 0.2, 0.24, MAT.dark, x, 0.1, 0));
    return g; },
  /* Instrumente */
  harfe() { const g = G();
    /* Seitenprofil in der x-y-Ebene: Säule vorne senkrecht, Resonanzkörper schräg
       nach hinten-unten, Hals dazwischen, Saiten spannen als Fächer darüber.
       bar() spannt einen Quader von Punkt a nach Punkt b (beide [x, y]). */
    const bar = (a, b, w, d, mat, ext = 0) => { const dx = b[0] - a[0], dy = b[1] - a[1];
      const m = box(g, w, Math.hypot(dx, dy) + ext, d, mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
      m.rotation.z = -Math.atan2(dx, dy); return m; };
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    box(g, 0.44, 0.08, 0.28, MAT.woodD, 0, 0.04);
    cyl(g, 0.045, 0.05, 1.12, MAT.wood, 0.22, 0.64, 0, 10);
    bar([-0.18, 0.08], [0.05, 0.95], 0.15, 0.22, MAT.woodL, 0.06);
    bar([-0.16, 0.10], [0.06, 0.93], 0.03, 0.16, MAT.woodD);
    bar([0.06, 0.97], [0.22, 1.15], 0.10, 0.16, MAT.woodD, 0.05);
    sph(g, 0.06, MAT.gold, 0.22, 1.20, 0);
    for (let i = 0; i < 7; i++) { const t = i / 6;
      bar(lerp([-0.09, 0.36], [0.03, 0.82], t), lerp([0.07, 0.99], [0.21, 1.14], t), 0.014, 0.014, MAT.gold); }
    return g; },
  schlagzeug() { const g = G();
    /* Kompaktes Set: grosse Trommel liegend (Achse entlang z), Tom obenauf,
       Snare rechts und Becken links auf dünnen Ständern. Die Gesamtbreite
       bleibt unter der schmalsten Zellenbreite (~0.95, js/game.js:358-362). */
    cyl(g, 0.26, 0.26, 0.24, MAT.red, 0, 0.28, 0, 20).rotation.x = Math.PI / 2;
    [-0.12, 0.12].forEach(z => {
      cyl(g, 0.235, 0.235, 0.02, MAT.cream, 0, 0.28, z, 20).rotation.x = Math.PI / 2;
      mesh(new THREE.TorusGeometry(0.26, 0.016, 8, 20), MAT.gold, 0, 0.28, z, g); });
    [-0.19, 0.19].forEach(x => box(g, 0.05, 0.08, 0.3, MAT.black, x, 0.04, 0));
    cyl(g, 0.12, 0.12, 0.15, MAT.red, -0.02, 0.62, 0, 16);
    cyl(g, 0.125, 0.125, 0.02, MAT.cream, -0.02, 0.70, 0, 16);
    mesh(new THREE.TorusGeometry(0.125, 0.014, 8, 16), MAT.gold, -0.02, 0.70, 0, g).rotation.x = -Math.PI / 2;
    cyl(g, 0.14, 0.14, 0.11, MAT.white, 0.30, 0.44, 0.08, 16);
    cyl(g, 0.145, 0.145, 0.02, MAT.cream, 0.30, 0.50, 0.08, 16);
    for (let i = 0; i < 3; i++) { const a = i * 2.094;
      const l = cyl(g, 0.014, 0.014, 0.44, MAT.grey, 0.30 + Math.sin(a) * 0.06, 0.21, 0.08 + Math.cos(a) * 0.06, 6);
      l.rotation.set(Math.cos(a) * 0.26, 0, -Math.sin(a) * 0.26); }
    cyl(g, 0.015, 0.015, 0.64, MAT.grey, -0.30, 0.32, 0.05, 6);
    cyl(g, 0.15, 0.15, 0.012, MAT.gold, -0.30, 0.66, 0.05, 20).rotation.z = 0.22;
    sph(g, 0.035, MAT.gold, -0.30, 0.68, 0.05);
    [-0.07, 0.07].forEach(d => { const s = cyl(g, 0.012, 0.016, 0.32, MAT.woodL, 0.04 + d, 0.30, 0.20, 6);
      s.rotation.set(-1.15, 0, d * 3); });
    return g; },
  blockfloete() { const g = G();
    cyl(g, 0.07, 0.085, 0.025, MAT.woodL, 0, 0.012, 0, 12);
    cyl(g, 0.026, 0.026, 0.03, MAT.woodD, 0, 0.04, 0, 10);
    cyl(g, 0.017, 0.020, 0.30, MAT.cream, 0, 0.20, 0, 10);
    cyl(g, 0.024, 0.019, 0.05, MAT.woodD, 0, 0.37, 0, 10);
    for (let i = 0; i < 5; i++) sph(g, 0.008, MAT.black, 0, 0.14 + i * 0.042, 0.016);
    return g; },
  nusskiste() { const g = G();
    box(g, 0.6, 0.06, 0.45, MAT.woodL, 0, 0.03);
    [-0.28, 0.28].forEach(x => box(g, 0.05, 0.3, 0.45, MAT.wood, x, 0.17));
    [-0.21, 0.21].forEach(z => box(g, 0.6, 0.3, 0.05, MAT.wood, 0, 0.17, z));
    [[-0.12, 0.32, 0], [0.1, 0.32, 0.08], [0, 0.34, -0.09], [0.16, 0.3, -0.05], [-0.05, 0.38, 0.05]].forEach(p => sph(g, 0.075, MAT.woodD, p[0], p[1], p[2], 1, 1.2, 1));
    return g; },
  ball() { const g = G();
    /* Liegt einfach da — bewusst ohne Physik und ohne Spinner (Spec A2).
       Zwei leicht grössere, plattgedrückte Kugeln geben die Streifen. */
    const r = 0.20;
    sph(g, r, MAT.red, 0, r, 0);
    sph(g, r * 1.01, MAT.cream, 0, r, 0, 1, 0.26, 1);
    sph(g, r * 1.02, MAT.blue, 0, r, 0, 0.24, 1, 1);
    return g; },
  kuscheltier() { const g = G();
    /* Sitzender Teddy, nur aus Kugeln — warm und entsättigt, kein Fell-Shader. */
    const fell = L(0xc99a63);
    sph(g, 0.17, fell, 0, 0.18, 0, 1, 0.95, 0.9);
    sph(g, 0.13, fell, 0, 0.42, 0.01);
    [-0.09, 0.09].forEach(x => sph(g, 0.05, fell, x, 0.52, -0.01));
    sph(g, 0.06, MAT.cream, 0, 0.40, 0.10, 1, 0.8, 0.6);
    sph(g, 0.02, MAT.black, 0, 0.42, 0.14);
    [-0.05, 0.05].forEach(x => sph(g, 0.016, MAT.black, x, 0.46, 0.12));
    [-1, 1].forEach(s => { const a = sph(g, 0.055, fell, s * 0.14, 0.22, 0.06, 1, 1.4, 1); a.rotation.z = s * 0.5; });
    [-1, 1].forEach(s => sph(g, 0.07, MAT.woodD, s * 0.10, 0.08, 0.15, 1, 0.8, 1.4));
    box(g, 0.22, 0.05, 0.04, MAT.red, 0, 0.31, 0.08);
    return g; },
  tischkicker() { const g = G();
    /* Kasten auf vier Beinen, grünes Feld, vier Stangen quer (entlang z) mit je zwei Figuren. */
    box(g, 0.90, 0.16, 0.56, MAT.wood, 0, 0.68);
    box(g, 0.80, 0.04, 0.46, MAT.green2, 0, 0.77);
    box(g, 0.80, 0.012, 0.02, MAT.white, 0, 0.79);
    [-0.38, 0.38].forEach(x => box(g, 0.03, 0.10, 0.22, MAT.white, x, 0.82));
    [-0.40, 0.40].forEach(x => [-0.24, 0.24].forEach(z => box(g, 0.08, 0.60, 0.08, MAT.woodD, x, 0.30, z)));
    [[-0.28, MAT.red], [-0.09, MAT.blue], [0.09, MAT.red], [0.28, MAT.blue]].forEach(([x, m]) => {
      const rod = cyl(g, 0.015, 0.015, 0.78, MAT.grey, x, 0.86, 0, 8); rod.rotation.x = Math.PI / 2;
      [-0.14, 0.14].forEach(z => box(g, 0.06, 0.14, 0.05, m, x, 0.82, z));
      [-1, 1].forEach(s => { const k = cyl(g, 0.025, 0.025, 0.05, MAT.woodD, x, 0.86, s * 0.42, 8); k.rotation.x = Math.PI / 2; }); });
    sph(g, 0.03, MAT.white, 0.10, 0.80, 0.10);
    return g; },
  /* Deko */
  vase() { const g = G();
    cyl(g, 0.05, 0.035, 0.16, MAT.water, 0, 0.08, 0, 12);
    [[0xe6604d, -1], [0xf0c04d, 0], [0xe6a0b8, 1]].forEach(([c, a]) => {
      cyl(g, 0.006, 0.006, 0.14, MAT.leafD, a * 0.04, 0.2, 0, 6).rotation.z = a * 0.4;
      sph(g, 0.035, L(c), a * 0.08, 0.28 - Math.abs(a) * 0.03, 0); });
    return g; },
  teekanne() { const g = G();
    sph(g, 0.09, MAT.white, 0, 0.08, 0, 1, 0.85, 1);
    cyl(g, 0.016, 0.028, 0.09, MAT.white, 0.1, 0.1, 0, 8).rotation.z = -0.7;
    mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 14, Math.PI * 1.2), MAT.white, -0.09, 0.09, 0, g).rotation.z = Math.PI / 2 - 0.3;
    cyl(g, 0.04, 0.05, 0.02, MAT.white, 0, 0.15, 0, 10); sph(g, 0.018, MAT.blue, 0, 0.17, 0);
    return g; },
  kerze() { const g = G();
    cyl(g, 0.05, 0.06, 0.02, MAT.gold, 0, 0.01, 0, 12);
    cyl(g, 0.028, 0.028, 0.14, MAT.white, 0, 0.09, 0, 10);
    sph(g, 0.022, MAT.fire, 0, 0.18, 0, 1, 1.5, 1);
    return g; },
  buecher() { const g = G();
    [[MAT.red, 0], [MAT.blue, 0.3], [MAT.leafD, -0.2]].forEach(([m, r], i) => {
      const b = box(g, 0.22, 0.045, 0.16, m, 0, 0.025 + i * 0.048, 0); b.rotation.y = r; });
    return g; },
  nussschale() { const g = G();
    sph(g, 0.1, MAT.terra, 0, 0.045, 0, 1, 0.45, 1);
    [[-0.03, 0.02], [0.035, -0.01], [0, 0.035]].forEach(([x, z]) => sph(g, 0.032, MAT.woodD, x, 0.08, z));
    return g; },
  /* Wand */
  poster_wald() { const g = G();
    box(g, 0.66, 0.86, 0.04, MAT.wood, 0, 0, 0.02); box(g, 0.56, 0.76, 0.03, L(0xcfe3c2), 0, 0, 0.045);
    [[-0.15, -0.1, 0.16], [0.12, -0.04, 0.22], [0, -0.22, 0.12]].forEach(([x, y, r]) => { mesh(new THREE.ConeGeometry(r * 0.75, r * 2, 8), MAT.leafD, x, y, 0.07, g); });
    sph(g, 0.07, MAT.gold, 0.16, 0.25, 0.065, 1, 1, 0.3);
    return g; },
  poster_mond() { const g = G();
    box(g, 0.6, 0.6, 0.04, MAT.woodD, 0, 0, 0.02); box(g, 0.5, 0.5, 0.03, L(0x2c3f6e), 0, 0, 0.045);
    sph(g, 0.12, MAT.glow, 0.08, 0.08, 0.065, 1, 1, 0.3); sph(g, 0.11, L(0x2c3f6e), 0.14, 0.12, 0.075, 1, 1, 0.3);
    [[-0.15, 0.15], [-0.18, -0.1], [0.12, -0.16], [0.02, 0.2]].forEach(([x, y]) => sph(g, 0.018, MAT.white, x, y, 0.07));
    return g; },
  poster_willi() { const g = G();
    box(g, 0.56, 0.7, 0.04, MAT.gold, 0, 0, 0.02); box(g, 0.46, 0.6, 0.03, MAT.cream, 0, 0, 0.045);
    sph(g, 0.13, L(0x7a4e2a), 0, -0.08, 0.07, 1, 1.1, 0.35); sph(g, 0.09, L(0x7a4e2a), 0, 0.1, 0.08, 1, 1, 0.35);
    sph(g, 0.07, MAT.blue, 0, 0.17, 0.09, 1.1, 0.5, 0.35); box(g, 0.05, 0.05, 0.02, MAT.white, 0, 0.04, 0.1);
    return g; },
  uhr() { const g = G();
    cyl(g, 0.24, 0.24, 0.05, MAT.woodD, 0, 0, 0.025, 24).rotation.x = Math.PI / 2;
    cyl(g, 0.2, 0.2, 0.02, MAT.white, 0, 0, 0.055, 24).rotation.x = Math.PI / 2;
    box(g, 0.03, 0.13, 0.015, MAT.black, 0, 0.055, 0.07); box(g, 0.1, 0.03, 0.015, MAT.black, 0.04, 0, 0.07);
    sph(g, 0.02, MAT.red, 0, 0, 0.075);
    return g; },
  spiegel() { const g = G();
    const f = cyl(g, 0.26, 0.26, 0.05, MAT.gold, 0, 0, 0.025, 24); f.rotation.x = Math.PI / 2; f.scale.z = 1.35;
    const m = cyl(g, 0.21, 0.21, 0.02, L(0xd8ecf4), 0, 0, 0.055, 24); m.rotation.x = Math.PI / 2; m.scale.z = 1.35;
    return g; },
  fenster() { const g = G();
    box(g, 0.74, 0.94, 0.06, MAT.woodD, 0, 0, 0.03); box(g, 0.62, 0.82, 0.04, L(0xb8dcf0, { emissive: 0x9cc8e6, emissiveIntensity: 0.25 }), 0, 0, 0.05);
    box(g, 0.04, 0.82, 0.03, MAT.woodD, 0, 0, 0.075); box(g, 0.62, 0.04, 0.03, MAT.woodD, 0, 0.1, 0.075);
    box(g, 0.86, 0.06, 0.16, MAT.woodL, 0, -0.5, 0.08);
    [-0.34, 0.34].forEach(x => box(g, 0.14, 0.9, 0.05, MAT.red, x + (x > 0 ? 0.08 : -0.08), 0.02, 0.09));
    return g; },
  dartscheibe() { const g = G();
    /* Wandobjekt: liegt in der xy-Ebene, +z zeigt in den Raum (wie uhr/spiegel). */
    const ring = (r, h, mat, z) => { const m = cyl(g, r, r, h, mat, 0, 0, z, 24); m.rotation.x = Math.PI / 2; return m; };
    ring(0.30, 0.05, MAT.woodD, 0.025);
    ring(0.26, 0.03, MAT.cream, 0.05);
    ring(0.19, 0.02, MAT.dark, 0.065);
    ring(0.12, 0.02, MAT.red, 0.075);
    ring(0.05, 0.02, MAT.green2, 0.085);
    sph(g, 0.025, MAT.gold, 0, 0, 0.09);
    /* Drei Pfeile stecken schräg in der Scheibe. */
    [[-0.10, 0.08, -0.4], [0.13, -0.02, 0.3], [0.02, -0.14, 0.1]].forEach(([x, y, a]) => {
      const s = G(); g.add(s); s.position.set(x, y, 0.08); s.rotation.z = a; s.rotation.x = -0.3;
      const sh = cyl(s, 0.012, 0.012, 0.14, MAT.grey, 0, 0, 0.07, 8); sh.rotation.x = Math.PI / 2;
      const tp = cyl(s, 0.010, 0.020, 0.05, MAT.red, 0, 0, 0.16, 8); tp.rotation.x = Math.PI / 2;
      box(s, 0.006, 0.07, 0.07, MAT.orange, 0, 0, 0.185); });
    return g; },
  /* Dach */
  pool() { const g = G();
    const outer = poolOutline(), lining = poolInset(outer, 0.07), water = poolInset(outer, 0.11), rim = poolInset(outer, -0.04);
    poolSlab(g, outer, lining, 0.36, MAT.wood, 0); poolSlab(g, lining, water, 0.36, POOL_TILE, 0);
    poolSlab(g, water, null, 0.29, MAT.water, 0); poolSlab(g, rim, water, 0.06, MAT.woodL, 0.36);
    const surf = G(); g.add(surf); surf.position.y = 0.29;
    [[0.05, -0.05, 0.06, 0.15], [0.14, 0.22, 0.055, -0.2], [-0.15, 0.2, 0.05, 0.3], [0.4, -0.22, 0.04, 0.1]].forEach(([x, z, r, a]) => poolRipple(surf, x, z, r, a));
    poolFrogSwimming(surf, -0.36, -0.02, 0.9); poolFrogPeeking(surf, 0.4, 0.12, -0.4);
    const lad = G(); g.add(lad); lad.position.set(Math.max(...rim.map(p => p.x)) - 0.028, 0, 0);
    [-0.09, 0.09].forEach(z => cyl(lad, 0.022, 0.022, 0.75, MAT.grey, 0.05, 0.38, z));
    for (let i = 0; i < 3; i++) box(lad, 0.03, 0.03, 0.18, MAT.grey, 0.05, 0.18 + i * 0.2, 0);
    return g; },
  liegestuhl(body = MAT.red) { const g = G();
    /* Seitenprofil als Punkte [z, y]: Fussende F, Knick K, Kopfende T; Beine stehen bei GF/GB auf dem Boden.
       Alle Latten werden von Punkt zu Punkt gespannt, damit Gestell und Liegefläche sich wirklich berühren. */
    const F = [0.36, 0.23], K = [-0.04, 0.21], T = [-0.27, 0.48], GF = [0.26, 0.02], GB = [-0.36, 0.02];
    const pt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const bar = (a, b, x, mat, w = 0.04, t = 0.04, ext = t) => { const dz = b[0] - a[0], dy = b[1] - a[1];
      const m = box(g, w, t, Math.hypot(dz, dy) + ext, mat, x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2); m.rotation.x = Math.atan2(-dy, dz); return m; };
    const stripes = (a, b, first) => { for (let i = 0; i < 3; i++) bar(pt(a, b, i / 3), pt(a, b, (i + 1) / 3), 0, (i + first) % 2 ? MAT.white : body, 0.42, 0.03, -0.012); };
    [-0.235, 0.235].forEach(x => { bar(F, K, x, MAT.wood); bar(K, T, x, MAT.wood); bar(GF, F, x, MAT.woodD); bar(GB, T, x, MAT.woodD); bar(GB, K, x, MAT.woodD); });
    [F, T, GB].forEach(p => box(g, 0.51, 0.045, 0.045, MAT.woodD, 0, p[1], p[0]));
    stripes(F, K, 0); stripes(K, T, 1);
    const n = Math.hypot(T[0] - K[0], T[1] - K[1]);
    const pillow = bar(pt(K, T, 0.58), pt(K, T, 0.96), 0, MAT.cream, 0.3, 0.08, 0);
    pillow.position.z += (T[1] - K[1]) / n * 0.05; pillow.position.y -= (T[0] - K[0]) / n * 0.05;
    return g; },
  sonnenschirm() { const g = G();
    cyl(g, 0.2, 0.26, 0.08, MAT.woodD, 0, 0.04); cyl(g, 0.03, 0.03, 1.3, MAT.wood, 0, 0.7);
    cyl(g, 0.02, 0.62, 0.3, MAT.red, 0, 1.35, 0, 12); sph(g, 0.05, MAT.gold, 0, 1.52);
    return g; },
  lampion() { const g = G();
    [-0.4, 0.4].forEach(x => cyl(g, 0.025, 0.035, 1.1, MAT.wood, x, 0.55));
    box(g, 0.8, 0.015, 0.015, MAT.dark, 0, 1.05);
    [[-0.25, MAT.glow], [0, MAT.fire], [0.25, MAT.glow]].forEach(([x, m]) => sph(g, 0.09, m, x, 0.93, 0, 1, 1.15, 1));
    return g; },
  /* Nutzt poolFrogHead()/POOL_FROG für den Frosch in der Tür — wer diese Pool-Helfer
     umbaut, verändert auch dieses Modell. */
  terrassenhaus() { const g = G();
    /* Wandkörper 1.8 × 1.4; Traufwände vorn/hinten bis unter die Dachplatte (1.0), Giebelwände als Fünfeck.
       Der dunkle Innenblock macht Tür und Fenster zu echten Öffnungen ohne Scheiben. */
    box(g, 1.62, 1.0, 1.22, MAT.dark, 0, 0.5, 0);
    hausWall(g, [[-0.9, 0], [0.9, 0], [0.9, 1.0], [-0.9, 1.0]], 0.12, hausArch(0, 0, 0.44, 0.62)).position.z = 0.58;
    box(g, 1.8, 1.0, 0.12, HAUS_WALL, 0, 0.5, -0.64);
    const gable = [[-0.7, 0], [0.7, 0], [0.7, 1.0], [0, 1.72], [-0.7, 1.0]];
    [[1, hausArch(-0.1, 0.32, 0.28, 0.42)], [-1, null]].forEach(([s, arch]) => { const w = hausWall(g, gable, 0.12, arch); w.position.x = s * 0.9 - (s > 0 ? 0.12 : 0); w.rotation.y = Math.PI / 2; });
    box(g, 0.6, 0.05, 0.22, MAT.woodL, 0, 0.025, 0.78);
    /* Satteldach: First entlang x, Traufen vorn und hinten weit über die Tür hinaus. */
    const angle = Math.atan2(1.08, 1.0);
    [1, -1].forEach(s => hausRoofHalf(g, s, angle, 1.28));
    cyl(g, 0.17, 0.17, 2.4, MAT.leafD, 0, 1.84, 0, 10).rotation.z = Math.PI / 2;
    /* Ein Frosch lugt aus der Türöffnung. */
    const f = G(); g.add(f); f.position.set(0.1, 0.04, 0.6); f.rotation.y = -0.35;
    sph(f, 0.075, POOL_FROG, 0, 0.02, -0.06, 1.1, 0.75, 1.1); poolFrogHead(f);
    return g; },
  bar() { const g = G();
    /* Tresen mit Front nach +z, Rückbord mit Flaschen, zwei Hocker davor. */
    box(g, 1.50, 0.92, 0.50, MAT.wood, 0, 0.46, -0.25);
    box(g, 1.62, 0.08, 0.62, MAT.woodL, 0, 0.96, -0.25);
    box(g, 1.50, 0.05, 0.04, MAT.woodD, 0, 0.16, -0.02);
    [-0.45, 0.45].forEach(x => box(g, 0.50, 0.46, 0.03, MAT.woodD, x, 0.52, -0.005));
    [-0.62, 0.62].forEach(x => box(g, 0.07, 0.85, 0.22, MAT.woodD, x, 0.42, -0.62));
    [0.45, 0.78].forEach(y => box(g, 1.30, 0.05, 0.22, MAT.woodL, 0, y, -0.62));
    [[MAT.red, -0.30], [MAT.green2, -0.12], [MAT.blue, 0.06], [MAT.orange, 0.24]].forEach(([m, x]) => {
      cyl(g, 0.045, 0.05, 0.20, m, x, 0.58, -0.62, 10); cyl(g, 0.018, 0.018, 0.07, m, x, 0.71, -0.62, 8); });
    [-0.20, 0.10].forEach(x => cyl(g, 0.05, 0.035, 0.09, MAT.white, x, 0.86, -0.62, 10));
    [-0.42, 0.42].forEach(x => { cyl(g, 0.17, 0.17, 0.07, MAT.red, x, 0.66, 0.34, 14);
      cyl(g, 0.05, 0.06, 0.62, MAT.woodD, x, 0.31, 0.34, 10);
      cyl(g, 0.20, 0.20, 0.04, MAT.woodD, x, 0.02, 0.34, 14);
      const f = mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 14), MAT.grey, x, 0.22, 0.34, g); f.rotation.x = Math.PI / 2; });
    return g; },
};

export const CATALOG = [
  { id: 'bett', name: 'Bett', cat: 'mobel' }, { id: 'etagenbett', name: 'Etagenbett', cat: 'mobel' },
  { id: 'tisch', name: 'Tisch', cat: 'mobel' }, { id: 'stuhl', name: 'Stuhl', cat: 'mobel' },
  { id: 'sofa', name: 'Sofa', cat: 'mobel' }, { id: 'schrank', name: 'Schrank', cat: 'mobel' },
  { id: 'regal', name: 'Bücherregal', cat: 'mobel' },
  { id: 'kommode', name: 'Kommode', cat: 'mobel' },
  /* Wipfkea — die Serie steht geschlossen am Ende der Möbel, damit sie im
     Katalog als Gruppe lesbar ist. */
  { id: 'wk_regal', name: 'Wipfkea Regal', cat: 'mobel' },
  { id: 'wk_tisch', name: 'Wipfkea Tisch', cat: 'mobel' },
  { id: 'wk_stuhl', name: 'Wipfkea Stuhl', cat: 'mobel' },
  { id: 'wk_sofa',  name: 'Wipfkea Sofa',  cat: 'mobel' },
  { id: 'teppich', name: 'Teppich', cat: 'gemut' }, { id: 'lampe', name: 'Lampe', cat: 'gemut' },
  { id: 'ofen', name: 'Ofen', cat: 'gemut' }, { id: 'badewanne', name: 'Badewanne', cat: 'gemut' },
  { id: 'pflanze', name: 'Pflanze', cat: 'gemut' }, { id: 'bild', name: 'Blumenbild', cat: 'gemut' },
  { id: 'schaukelstuhl', name: 'Schaukelstuhl', cat: 'gemut' },
  { id: 'hamsterrad', name: 'Hamsterrad', cat: 'spass' }, { id: 'klavier', name: 'Klavier', cat: 'spass' },
  { id: 'nusskiste', name: 'Nusskiste', cat: 'spass' },
  { id: 'blockfloete', name: 'Blockflöte', cat: 'spass' }, { id: 'harfe', name: 'Harfe', cat: 'spass' },
  { id: 'schlagzeug', name: 'Schlagzeug', cat: 'spass' },
  { id: 'ball', name: 'Ball', cat: 'spass' }, { id: 'kuscheltier', name: 'Kuscheltier', cat: 'spass' },
  { id: 'tischkicker', name: 'Tischkicker', cat: 'spass' },
  { id: 'vase', name: 'Blumenvase', cat: 'deko' }, { id: 'teekanne', name: 'Teekanne', cat: 'deko' },
  { id: 'kerze', name: 'Kerze', cat: 'deko' }, { id: 'buecher', name: 'Bücherstapel', cat: 'deko' },
  { id: 'nussschale', name: 'Nussschale', cat: 'deko' },
  { id: 'poster_wald', name: 'Waldbild', cat: 'wand' }, { id: 'poster_mond', name: 'Mondposter', cat: 'wand' },
  { id: 'poster_willi', name: 'Willi-Poster', cat: 'wand' }, { id: 'uhr', name: 'Wanduhr', cat: 'wand' },
  { id: 'spiegel', name: 'Spiegel', cat: 'wand' }, { id: 'fenster', name: 'Fenster', cat: 'wand' },
  { id: 'dartscheibe', name: 'Dartscheibe', cat: 'wand' },
  { id: 'pool', name: 'Pool', cat: 'dach' }, { id: 'liegestuhl', name: 'Liegestuhl', cat: 'dach' },
  { id: 'sonnenschirm', name: 'Sonnenschirm', cat: 'dach' }, { id: 'lampion', name: 'Lampions', cat: 'dach' },
  { id: 'terrassenhaus', name: 'Häuschen', cat: 'dach' },
  { id: 'bar', name: 'Bar', cat: 'dach' },
];
export const CATS = [['mobel', 'Möbel'], ['gemut', 'Gemütlich'], ['deko', 'Deko'], ['wand', 'Wand'], ['spass', 'Spass'], ['farbe', 'Tapete'], ['boden', 'Boden'], ['dach', 'Dach']];
export const WALL_ITEMS = new Set(['poster_wald', 'poster_mond', 'poster_willi', 'uhr', 'spiegel', 'fenster', 'dartscheibe']);

/* ---------- Tapeten & Böden ---------- */
export const WALLS = [
  { id: 'creme', name: 'Creme', draw: c => fill(c, '#f8ecd0') },
  { id: 'himmel', name: 'Himmelblau', draw: c => fill(c, '#cfe0ee') },
  { id: 'rosa', name: 'Rosa', draw: c => fill(c, '#f3d4dc') },
  { id: 'mint', name: 'Mint', draw: c => fill(c, '#d6e8d0') },
  { id: 'sonne', name: 'Sonnengelb', draw: c => fill(c, '#f6e6a8') },
  { id: 'streifen', name: 'Streifen', draw: c => { fill(c, '#f8ecd0'); c.fillStyle = '#a9c4de'; for (let x = 0; x < 128; x += 32) c.fillRect(x, 0, 14, 128); } },
  { id: 'punkte', name: 'Punkte', draw: c => { fill(c, '#fdf4e0'); c.fillStyle = '#e6a0b8'; for (let y = 16; y < 128; y += 32) for (let x = 16; x < 128; x += 32) { c.beginPath(); c.arc(x + (y % 64 ? 16 : 0), y, 7, 0, 7); c.fill(); } } },
  { id: 'blumen', name: 'Blumen', draw: c => { fill(c, '#eef3e2'); for (let y = 20; y < 128; y += 40) for (let x = 20; x < 128; x += 40) { const ox = y % 80 ? 20 : 0;
    c.fillStyle = '#e6604d'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + ox + Math.cos(k * 1.257) * 7, y + Math.sin(k * 1.257) * 7, 5, 0, 7); c.fill(); }
    c.fillStyle = '#f0c04d'; c.beginPath(); c.arc(x + ox, y, 4, 0, 7); c.fill(); } } },
  { id: 'holzwand', name: 'Holzbretter', draw: c => { fill(c, '#d8b078'); c.fillStyle = '#b9854e'; for (let y = 0; y < 128; y += 32) c.fillRect(0, y, 128, 3); c.fillStyle = '#c9975e'; for (let y = 8; y < 128; y += 32) { c.fillRect(20, y, 30, 2); c.fillRect(70, y + 12, 40, 2); } } },
];
export const FLOORS = [
  { id: 'holz', name: 'Holzboden', draw: c => { fill(c, '#d8b078'); c.fillStyle = '#b9854e'; for (let y = 0; y < 128; y += 26) c.fillRect(0, y, 128, 3); c.fillStyle = '#c9975e'; for (let y = 6; y < 128; y += 26) { c.fillRect(10 + (y % 52 ? 50 : 0), y, 2, 18); } } },
  { id: 'teppich_rot', name: 'Teppich rot', draw: c => { fill(c, '#c0432e'); noise(c, '#a83a28'); } },
  { id: 'teppich_blau', name: 'Teppich blau', draw: c => { fill(c, '#3f6fb5'); noise(c, '#35609e'); } },
  { id: 'teppich_gruen', name: 'Teppich grün', draw: c => { fill(c, '#8fb96a'); noise(c, '#7ca85a'); } },
  { id: 'fliesen', name: 'Fliesen', draw: c => { fill(c, '#fdf4e0'); c.fillStyle = '#9dbfd3'; for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) if ((x + y) % 64 === 0) c.fillRect(x, y, 32, 32); } },
  { id: 'moos', name: 'Moos', draw: c => { fill(c, '#77aa5c'); noise(c, '#568b49'); } },
];
function fill(c, col) { c.fillStyle = col; c.fillRect(0, 0, 128, 128); }
function noise(c, col) { c.fillStyle = col; let s = 7; for (let i = 0; i < 260; i++) { s = (s * 9301 + 49297) % 233280; const x = (s / 233280) * 128; s = (s * 9301 + 49297) % 233280; const y = (s / 233280) * 128; c.fillRect(x, y, 3, 3); } }
const texCache = {};
export function lookCanvas(kind, id) {
  const def = (kind === 'wall' ? WALLS : FLOORS).find(l => l.id === id) || (kind === 'wall' ? WALLS : FLOORS)[0];
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; def.draw(cv.getContext('2d')); return cv;
}
export function lookTexture(kind, id) {
  const key = kind + ':' + id; if (texCache[key]) return texCache[key];
  const t = new THREE.CanvasTexture(lookCanvas(kind, id)); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'wall' ? 5 : 4, kind === 'wall' ? 1.6 : 3); t.colorSpace = THREE.SRGBColorSpace;
  texCache[key] = t; return t;
}
/* Ein nicht einfärbbares Möbel ignoriert colorId, eine unbekannte Farb-id fällt
   still auf die Standardfarbe zurück (alter Spielstand, geschrumpfte Palette). */
export function makeFurniture(id, colorId) {
  const body = TINTABLE.has(id) ? matOfColor(colorId) : null;
  const g = body ? FURN[id](body) : FURN[id]();
  g.userData.itemId = id; if (body) g.userData.color = colorId;
  return g;
}

/* ---------------- Tiere ---------------- */
const SPECIES = {
  maus:   { c: 0x9a8f86, belly: 0xcfc6bc, ear: 'round', tail: 'thin', s: 0.4 },
  haselmaus: { c: 0xb07d4a, belly: 0xe8d3b0, ear: 'round', tail: 'thin', s: 0.42 },
  hamster: { c: 0xd9973f, belly: 0xf5e6c8, ear: 'small', tail: 'none', s: 0.46, chubby: 1.18 },
  frosch: { c: 0x6fae4e, belly: 0xcfe6a8, ear: 'none', tail: 'none', s: 0.42, frog: true },
  eidechse: { c: 0x7fb069, belly: 0xd6e6b0, ear: 'none', tail: 'curve', s: 0.44, slim: 0.85 },
  maulwurf: { c: 0x4a4348, belly: 0x6e6570, ear: 'none', tail: 'thin', s: 0.4, nose: 0xe6a0b8 },
  siebenschlaefer: { c: 0x8d97a8, belly: 0xdfe3ea, ear: 'round', tail: 'bushy', s: 0.44 },
  wiesel: { c: 0x9c6a3f, belly: 0xf2e8d8, ear: 'small', tail: 'bushy', s: 0.44, slim: 0.8 },
  eichhoernchen: { c: 0xb5562a, belly: 0xf2e2c8, ear: 'tuft', tail: 'up', s: 0.42 },
};
export function makeAnimal(species) {
  const sp = SPECIES[species] || SPECIES.maus; const s = sp.s; const g = G();
  const fur = L(sp.c), bel = L(sp.belly);
  const chub = sp.chubby || 1, slim = sp.slim || 1;
  sph(g, s * 0.34, fur, 0, s * 0.36, 0, chub * slim, 1.12, chub * 0.9);
  sph(g, s * 0.26, bel, 0, s * 0.32, s * 0.14, chub * 0.8, 0.9, 0.6);
  const hy = s * 0.78;
  sph(g, s * 0.26, fur, 0, hy, s * 0.04);
  sph(g, s * 0.14, bel, 0, hy - s * 0.05, s * 0.2, 1, 0.8, 0.7);
  if (sp.nose) sph(g, s * 0.05, L(sp.nose), 0, hy - s * 0.02, s * 0.3);
  if (sp.frog) {
    [-0.11, 0.11].forEach(x => { sph(g, s * 0.09, fur, x * s / 0.4, hy + s * 0.2, s * 0.06);
      sph(g, s * 0.05, MAT.white, x * s / 0.4, hy + s * 0.22, s * 0.12); sph(g, s * 0.025, MAT.black, x * s / 0.4, hy + s * 0.22, s * 0.16); });
  } else {
    [-0.09, 0.09].forEach(x => sph(g, s * 0.032, MAT.black, x * s / 0.4, hy + s * 0.06, s * 0.22));
    if (sp.ear === 'round') [-0.1, 0.1].forEach(x => { sph(g, s * 0.1, fur, x * s / 0.4, hy + s * 0.2, 0, 1, 1, 0.5); sph(g, s * 0.06, L(0xe6b8a8), x * s / 0.4, hy + s * 0.2, s * 0.04, 1, 1, 0.4); });
    if (sp.ear === 'small') [-0.09, 0.09].forEach(x => sph(g, s * 0.07, fur, x * s / 0.4, hy + s * 0.19, 0, 1, 1, 0.5));
    if (sp.ear === 'tuft') [-0.1, 0.1].forEach(x => sph(g, s * 0.06, fur, x * s / 0.4, hy + s * 0.26, 0, 0.7, 1.8, 0.6));
  }
  if (sp.tail === 'thin') { const t = cyl(g, s * 0.03, s * 0.015, s * 0.5, fur, 0, s * 0.24, -s * 0.38); t.rotation.x = 1.1; }
  if (sp.tail === 'bushy') sph(g, s * 0.16, fur, 0, s * 0.3, -s * 0.38, 0.8, 1.4, 0.8);
  if (sp.tail === 'up') { sph(g, s * 0.16, fur, 0, s * 0.3, -s * 0.4, 0.9, 1.1, 0.9); sph(g, s * 0.17, fur, 0, s * 0.66, -s * 0.48, 0.9, 1.3, 0.8); sph(g, s * 0.13, fur, 0, s * 1.02, -s * 0.36, 0.8, 1, 0.8); }
  if (sp.tail === 'curve') { const t = mesh(new THREE.TorusGeometry(s * 0.22, s * 0.04, 8, 16, 2.4), fur, 0, s * 0.2, -s * 0.36, g); t.rotation.y = Math.PI / 2; }
  [-0.12, 0.12].forEach(x => sph(g, s * 0.09, fur, x * s / 0.4, s * 0.05, s * 0.08, 1, 0.7, 1.3));
  return g;
}
export const PAIR = { maus2: ['haselmaus', 'haselmaus'], frosch2: ['frosch', 'frosch'], hamster2: ['hamster', 'hamster'], kinder: ['maus', 'maus'], wieselwuhl: ['wiesel', 'maus'] };

export function makeWilli() {
  const g = G(); const fur = L(0x7a4e2a), furD = L(0x5f3c20);
  sph(g, 0.3, fur, 0, 0.34, 0, 1.05, 1.15, 0.9);
  box(g, 0.44, 0.34, 0.5, MAT.blue, 0, 0.28, 0.01);
  [-0.12, 0.12].forEach(x => box(g, 0.07, 0.3, 0.05, MAT.blue, x, 0.55, 0.24));
  sph(g, 0.23, fur, 0, 0.76, 0.02);
  sph(g, 0.13, L(0xc99a6a), 0, 0.68, 0.19, 1, 0.8, 0.7);
  box(g, 0.09, 0.09, 0.03, MAT.white, 0, 0.62, 0.27);
  sph(g, 0.035, MAT.black, -0.08, 0.8, 0.19); sph(g, 0.035, MAT.black, 0.08, 0.8, 0.19);
  sph(g, 0.05, MAT.dark, 0, 0.73, 0.28);
  const cap = sph(g, 0.2, MAT.blue, 0, 0.92, 0, 1.1, 0.6, 1.1);
  cyl(g, 0.16, 0.16, 0.03, MAT.blue, 0, 0.93, 0.18);
  [-0.07, 0.07].forEach(x => sph(g, 0.07, fur, x * 3, 0.9, -0.02, 1, 1, 0.5));
  const tail = box(g, 0.26, 0.06, 0.4, furD, 0, 0.1, -0.36); tail.rotation.x = 0.25;
  [-0.14, 0.14].forEach(x => sph(g, 0.1, furD, x, 0.05, 0.1, 1, 0.6, 1.4));
  const arm = G(); g.add(arm); arm.position.set(0.28, 0.45, 0.05); g.userData.arm = arm;
  sph(arm, 0.08, fur, 0, -0.06, 0.06, 1, 1.6, 1);
  const ham = G(); arm.add(ham); ham.position.set(0, -0.2, 0.12); ham.rotation.z = -0.5;
  cyl(ham, 0.025, 0.025, 0.3, MAT.woodL, 0, 0.05, 0); box(ham, 0.14, 0.08, 0.08, MAT.grey, 0, 0.2, 0);
  sph(g, 0.08, fur, -0.28, 0.4, 0.06, 1, 1.6, 1);
  return g;
}

export function makeTree(s = 1, seed = 0) {
  const g = G(); const j = (seed * 37) % 10 / 10;
  cyl(g, 0.14 * s, 0.2 * s, 1.6 * s, MAT.woodD, 0, 0.8 * s, 0, 10);
  const lf = L(new THREE.Color().setHSL(0.28 + j * 0.06, 0.42, 0.38 + j * 0.12));
  sph(g, 0.75 * s, lf, 0, 1.9 * s, 0, 1, 1.15, 1);
  sph(g, 0.5 * s, lf, 0.5 * s, 1.5 * s, 0.1 * s);
  sph(g, 0.45 * s, lf, -0.45 * s, 1.6 * s, -0.1 * s);
  return g;
}

export function makeTallTree(h, seed = 0) {
  const g = G(); const j = ((seed * 37) % 10) / 10;
  cyl(g, 0.22 + j * 0.12, 0.4 + j * 0.18, h * 0.78, MAT.woodD, 0, h * 0.39, 0, 10);
  const lf = L(new THREE.Color().setHSL(0.27 + j * 0.07, 0.4, 0.3 + j * 0.15));
  sph(g, h * 0.16, lf, 0, h * 0.86, 0, 1, 1.2, 1);
  sph(g, h * 0.12, lf, h * 0.1, h * 0.72, h * 0.03);
  sph(g, h * 0.11, lf, -h * 0.09, h * 0.76, -h * 0.04);
  sph(g, h * 0.09, lf, 0.02, h * 0.62, h * 0.08);
  return g;
}

export function makeMagpie() {
  const g = G();
  sph(g, 0.16, MAT.black, 0, 0, 0, 1.5, 0.9, 0.9);
  sph(g, 0.12, MAT.white, 0.02, -0.04, 0, 1.4, 0.8, 0.85);
  sph(g, 0.11, MAT.black, 0.24, 0.08, 0);
  mesh(new THREE.ConeGeometry(0.035, 0.14, 8), MAT.gold, 0.38, 0.07, 0, g).rotation.z = -Math.PI / 2;
  sph(g, 0.02, MAT.white, 0.3, 0.12, 0.06); sph(g, 0.02, MAT.white, 0.3, 0.12, -0.06);
  box(g, 0.4, 0.03, 0.12, L(0x2a3a55), -0.38, 0.02, 0).rotation.z = 0.15;
  const wings = [];
  [-1, 1].forEach(side => { const w = G(); g.add(w); w.position.set(0, 0.08, side * 0.08);
    const wm = box(w, 0.3, 0.025, 0.4, MAT.black, -0.02, 0, side * 0.2);
    box(w, 0.2, 0.028, 0.18, MAT.white, 0, 0.005, side * 0.14); wings.push(w); });
  const bucket = G(); g.add(bucket); bucket.position.set(0.1, -0.32, 0);
  cyl(bucket, 0.09, 0.07, 0.12, MAT.red, 0, 0, 0, 14);
  mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), MAT.grey, 0, 0.06, 0, bucket);
  cyl(g, 0.008, 0.008, 0.2, MAT.grey, 0.08, -0.18, 0);
  g.userData.wings = wings;
  return g;
}

export function makeSign(title) {
  const g = G();
  cyl(g, 0.06, 0.08, 1.5, MAT.woodD, 0, 0.75);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  const draw = () => { ctx.fillStyle = '#d8b078'; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, 498, 242);
    ctx.fillStyle = '#5b3a1f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 64px "Baloo 2", sans-serif'; ctx.fillText(title, 256, 100);
    ctx.font = '500 40px "Baloo 2", sans-serif'; ctx.fillText('Firma Biberzahn', 256, 178); tex.needsUpdate = true; };
  const tex = new THREE.CanvasTexture(cv);
  const board = mesh(new THREE.BoxGeometry(1.5, 0.75, 0.08), [MAT.woodD, MAT.woodD, MAT.woodD, MAT.woodD, new THREE.MeshLambertMaterial({ map: tex }), MAT.woodD], 0, 1.5, 0, g);
  draw(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  return g;
}

export function makeDam() {
  const g = G(); const up = new THREE.Vector3(0, 1, 0);
  sph(g, 1.05, L(0x8a6a42), 0, 0.12, 0, 1.35, 0.6, 1.05);
  for (let i = 0; i < 28; i++) {
    const a = i * 2.399, r = 0.35 + ((i * 29) % 10) / 12;
    const x = Math.cos(a) * r * 1.3, z = Math.sin(a) * r;
    const y = Math.max(0.1, 0.6 * (1 - (r / 1.4) * (r / 1.4)));
    const st = cyl(g, 0.03, 0.045, 0.8 + ((i * 7) % 5) * 0.18, MAT.woodD, x, y, z, 7);
    const dir = new THREE.Vector3(-Math.sin(a), 0.3 * (((i * 13) % 5) / 5 - 0.4), Math.cos(a)).normalize();
    st.quaternion.setFromUnitVectors(up, dir);
  }
  [[-1.25, 0.4, 0.2], [1.2, -0.35, 2.1], [0.3, 1.05, 4.4]].forEach(([x, z, a]) => {
    const lg = cyl(g, 0.09, 0.11, 1.6, MAT.wood, x, 0.11, z, 9);
    lg.quaternion.setFromUnitVectors(up, new THREE.Vector3(Math.cos(a), 0.06, Math.sin(a)).normalize());
  });
  return g;
}

export function makeBridge(len = 5) {
  const g = G(); const n = 11;
  for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = (t - 0.5) * len; const y = Math.sin(t * Math.PI) * 0.8;
    const p = box(g, len / n + 0.06, 0.08, 1.1, MAT.woodL, x, y, 0); p.rotation.z = -Math.cos(t * Math.PI) * 0.45;
    if (i % 2 === 0) [-0.5, 0.5].forEach(z => cyl(g, 0.035, 0.035, 0.5, MAT.woodD, x, y + 0.28, z)); }
  [-0.5, 0.5].forEach(z => { for (let i = 0; i < n - 1; i++) { const t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
    const x0 = (t0 - 0.5) * len, y0 = Math.sin(t0 * Math.PI) * 0.8 + 0.5, x1 = (t1 - 0.5) * len, y1 = Math.sin(t1 * Math.PI) * 0.8 + 0.5;
    const r = box(g, Math.hypot(x1 - x0, y1 - y0) + 0.05, 0.05, 0.05, MAT.wood, (x0 + x1) / 2, (y0 + y1) / 2, z);
    r.rotation.z = Math.atan2(y1 - y0, x1 - x0); } });
  return g;
}

export function makeGarden() {
  const g = G();
  const swing = G(); g.add(swing); swing.position.set(-2.2, 0, 0.5);
  [-0.6, 0.6].forEach(x => { const l = cyl(swing, 0.05, 0.06, 1.6, MAT.wood, x, 0.75, 0); l.rotation.z = x > 0 ? -0.15 : 0.15; });
  box(swing, 1.5, 0.07, 0.07, MAT.woodD, 0, 1.5, 0);
  [-0.15, 0.15].forEach(x => cyl(swing, 0.012, 0.012, 1.05, MAT.woodL, x, 0.95, 0));
  box(swing, 0.44, 0.05, 0.2, MAT.woodL, 0, 0.42, 0);
  const slide = G(); g.add(slide); slide.position.set(0.2, 0, 0.3); slide.rotation.y = -0.5;
  const ramp = box(slide, 0.5, 0.07, 2, L(0x7fb98a), 0, 0.55, 0); ramp.rotation.x = 0.55;
  [-0.22, 0.22].forEach(x => { box(slide, 0.05, 0.12, 2, MAT.leafD, x, 0.6, 0).rotation.x = 0.55; });
  [-0.18, 0.18].forEach(x => cyl(slide, 0.03, 0.03, 1.1, MAT.wood, x, 0.55, -1));
  for (let i = 0; i < 3; i++) box(slide, 0.34, 0.04, 0.04, MAT.woodL, 0, 0.25 + i * 0.3, -1);
  const sand = G(); g.add(sand); sand.position.set(2.2, 0, 0.6);
  [-0.65, 0.65].forEach(z => box(sand, 1.5, 0.14, 0.12, MAT.wood, 0, 0.07, z));
  [-0.7, 0.7].forEach(x => box(sand, 0.12, 0.14, 1.4, MAT.wood, x, 0.07, 0));
  box(sand, 1.3, 0.1, 1.2, L(0xead9a8), 0, 0.06, 0);
  sph(sand, 0.09, MAT.red, 0.3, 0.14, 0.2); cyl(sand, 0.05, 0.07, 0.1, MAT.blue, -0.25, 0.15, -0.1);
  const beet = G(); g.add(beet); beet.position.set(0.4, 0, 2.1); beet.rotation.y = 0.15;
  [-0.5, 0.5].forEach(z => { box(beet, 2, 0.1, 0.7, L(0x8a5f3c), 0, 0.05, z);
    for (let i = 0; i < 5; i++) sph(beet, 0.09, MAT.leafD, -0.8 + i * 0.4, 0.14, z, 1, 0.8, 1); });
  const fl = [0xe6604d, 0xe6a0b8, 0xf0c04d, 0xffffff, 0xb27fd4];
  for (let i = 0; i < 8; i++) { const x = -2.8 + i * 0.8, z = 1.9 + Math.sin(i * 2.7) * 0.5;
    cyl(g, 0.012, 0.012, 0.3, MAT.leafD, x, 0.15, z);
    sph(g, 0.07, L(fl[i % 5]), x, 0.32, z, 1, 0.6, 1); sph(g, 0.03, MAT.gold, x, 0.36, z); }
  return g;
}
