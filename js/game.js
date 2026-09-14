import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAT, CATALOG, CATS, WALL_ITEMS, WALLS, FLOORS, lookCanvas, lookTexture, makeFurniture, makeAnimal, makeWilli, makeTree, makeTallTree, makeMagpie, makeSign, makeDam, makeBridge, makeGarden } from './models.js';
import { zipStore } from './zip.js';

/* ---------- Konstanten ---------- */
const PLAT_Y = 2.2, E_H = 2.4, FLOOR_H = 2.0, MAXF = 10;
const W = i => i === 0 ? 8.6 : 7.6 - (i - 1) * 0.3;
const D = i => i === 0 ? 5.6 : 5.0 - (i - 1) * 0.12;
const H = i => i === 0 ? E_H : FLOOR_H;
const floorY = i => i === 0 ? PLAT_Y : PLAT_Y + E_H + (i - 1) * FLOOR_H;
const topY = () => PLAT_Y + E_H + state.floors * FLOOR_H;
const ROOF_W = 6.6, ROOF_D = 4.8;
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/* Wände: Gesamtdicke wie bisher (0.12) = Kern (aussen, immer Putz) + Luft + Innenpanel (tapezierbar) */
const WALL_KEYS = ['back', 'left', 'right', 'front'];
const WALL_LABELS = { back: 'Hinten', left: 'Links', right: 'Rechts', front: 'Vorne' };
const WALL_T = 0.12, WALL_CORE = 0.09, WALL_PANEL = 0.02;

const TENANTS = [
  { name: 'Die Kindergarten-Mäuse', unit: 'Kindergarten und Partyraum', animals: ['maus', 'maus'], wish: 'klavier', wtext: 'Die Kindergarten-Mäuse wünschen sich ein Klavier.' },
  { name: 'Hausmeister Eidechsen-Charly', animals: ['eidechse'], wish: 'ofen', wtext: 'Eidechsen-Charly wünscht sich einen warmen Ofen.' },
  { name: 'Oma und Opa Haselmaus', animals: ['haselmaus', 'haselmaus'], wish: 'schaukelstuhl', wtext: 'Oma und Opa möchten einen Schaukelstuhl.' },
  { name: 'Die Feriengäste', unit: 'Ferienwohnung für Hausmäuse', animals: ['maus'], wish: 'etagenbett', wtext: 'Die Feriengäste hätten gern ein Etagenbett.' },
  { name: 'Familie Siebenschläfer', animals: ['siebenschlaefer', 'siebenschlaefer'], wish: 'bett', wtext: 'Familie Siebenschläfer wünscht sich ein kuschliges Bett.' },
  { name: 'Jimmy Wiesel und Jule Wühlmaus', animals: ['wiesel', 'maus'], wish: 'sofa', wtext: 'Jimmy und Jule wünschen sich ein Sofa.' },
  { name: 'Lisa Feldmaus', animals: ['maus'], wish: 'bild', wtext: 'Lisa wünscht sich ein Blumenbild.' },
  { name: 'Enrico Maulwurf', animals: ['maulwurf'], wish: 'teppich', wtext: 'Enrico wünscht sich einen weichen Teppich.' },
  { name: 'Familie Feldhamster', animals: ['hamster', 'hamster'], wish: 'hamsterrad', wtext: 'Familie Feldhamster wünscht sich ein Hamsterrad.' },
  { name: 'Rita und Claas Haselmaus', animals: ['haselmaus', 'haselmaus'], wish: 'nusskiste', wtext: 'Rita und Claas wünschen sich eine Nusskiste.' },
  { name: 'Piet und Jan Waldfrosch', animals: ['frosch', 'frosch'], wish: 'pool', roofWish: true, wtext: 'Piet und Jan wünschen sich einen Pool auf dem Dach!' },
];
const flLabel = i => i === 0 ? 'E' : String(i);

/* ---------- Zustand ---------- */
/* tenantPos: von Hand gesetzte Tierplätze pro Stockwerk; fehlt der Eintrag,
   platziert tenantSpot automatisch (#14). */
let state = { floors: 0, rooms: {}, nuts: 0, bridge: false, garden: false, night: false, cutaway: false, fulfilled: {}, wallpaper: {}, flooring: {}, tenantPos: {} };
try { const s = localStorage.getItem('wipfelkratzer-v1'); if (s) state = Object.assign(state, JSON.parse(s)); } catch (e) {}
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try {
  const wallpaper = {};
  for (const k in state.wallpaper) { const wp = state.wallpaper[k]; if (wp && typeof wp === 'object' && Object.keys(wp).length) wallpaper[k] = wp; }
  localStorage.setItem('wipfelkratzer-v1', JSON.stringify({ ...state, wallpaper }));
} catch (e) {} }, 300); };
const roomOf = k => (state.rooms[k] || (state.rooms[k] = []));
const tenantIn = i => i <= state.floors && roomOf(i).length >= 3;

/* ---------- Szene ---------- */
const holder = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
holder.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 200);
camera.position.set(13, PLAT_Y + 7, 18);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, PLAT_Y + 2.8, 0);
controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enablePan = false;
controls.minDistance = 4; controls.maxDistance = 44; controls.maxPolarAngle = 1.52; controls.minPolarAngle = 0.12;

const hemi = new THREE.HemisphereLight(0xfff4da, 0x9dbb7a, 1.05); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffe8c0, 1.15); dir.position.set(14, 22, 10);
dir.castShadow = true; dir.shadow.mapSize.set(1024, 1024);
Object.assign(dir.shadow.camera, { left: -20, right: 20, top: 32, bottom: -6, far: 90 });
scene.add(dir);

const SKY = { d: new THREE.Color(0xcfe3c2), n: new THREE.Color(0x18294e) };
const HEMI = { d: new THREE.Color(0xfff4da), n: new THREE.Color(0x2a3a66) };
const GRND = { d: new THREE.Color(0x9dbb7a), n: new THREE.Color(0x1c2a3a) };
scene.background = SKY.d.clone();
scene.fog = new THREE.Fog(SKY.d.clone(), 45, 110);

/* Sterne + Mond */
const starGeo = new THREE.BufferGeometry();
{ const p = []; for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 30, y = 8 + Math.random() * 45; p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.35, transparent: true, opacity: 0 });
const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0 });
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), moonMat); moon.position.set(-24, 30, -30); scene.add(moon);

/* ---------- Umgebung ---------- */
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const ground = mesh(new THREE.CircleGeometry(70, 40), new THREE.MeshLambertMaterial({ color: 0x8fbb6e }), 0, 0, 0);
ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
const riverZ = x => 9 + Math.sin(x * 0.18) * 2.4;
function ribbon(width, y, mat) {
  const pts = [], idx = [], N = 64;
  for (let i = 0; i <= N; i++) { const x = -60 + i * (120 / N), z = riverZ(x);
    const sl = Math.atan(0.18 * 2.4 * Math.cos(x * 0.18));
    const px = Math.sin(sl), pz = Math.cos(sl);
    pts.push(x - px * width / 2, y, z - pz * width / 2, x + px * width / 2, y, z + pz * width / 2); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
}
ribbon(5.6, 0.02, new THREE.MeshLambertMaterial({ color: 0xc9b083 }));
ribbon(3.6, 0.045, MAT.water);
ribbon(1.5, 0.06, new THREE.MeshLambertMaterial({ color: 0x7fc4dd }));
const dam = makeDam(); dam.position.set(-7, 0, riverZ(-7) - 1.2); dam.rotation.y = 0.6; dam.userData.type = 'dam'; scene.add(dam);
for (let i = 0; i < 60; i++) {
  const a = rnd(i) * Math.PI * 2, r = 17 + rnd(i + 40) * 26;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.abs(z - riverZ(x)) < 4.5) continue; if (Math.hypot(x + 8, z - 2) < 5.5) continue;
  if (z > 3 && Math.abs(x) < 16) continue;
  const h = 11 + rnd(i + 60) * 13;
  const t = makeTallTree(h, i); t.position.set(x, 0, z); t.rotation.y = rnd(i + 7) * 6;
  if (r > 27) t.traverse(o => { o.castShadow = false; });
  scene.add(t);
}
for (let i = 100; i < 122; i++) {
  const a = rnd(i) * Math.PI * 2, r = 13 + rnd(i + 40) * 12;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.abs(z - riverZ(x)) < 4.5) continue; if (Math.hypot(x + 8, z - 2) < 5.5) continue;
  if (z > 3 && Math.abs(x) < 16) continue;
  const t = makeTree(1.1 + rnd(i + 80) * 1.5, i); t.position.set(x, 0, z); t.rotation.y = rnd(i + 7) * 6; scene.add(t);
}
const sign = makeSign('Wipfelkratzer'); sign.position.set(4.8, 0, 5.6); sign.rotation.y = 0.45; sign.userData.type = 'sign'; scene.add(sign);
const willi = makeWilli(); willi.position.set(-3.8, 0, 4.8); willi.rotation.y = 0.5; willi.scale.setScalar(1.25); willi.userData.type = 'willi'; scene.add(willi);
const moki = makeAnimal('eichhoernchen'); moki.scale.setScalar(1.3); moki.position.set(6, 0, 6); moki.userData.type = 'moki'; scene.add(moki);
const MOKI_WP = [new THREE.Vector3(6, 0, 6), new THREE.Vector3(-6.5, 0, 6.5), new THREE.Vector3(-7.5, 0, -5), new THREE.Vector3(7.5, 0, -5.5)];
let mokiI = 0, mokiWait = 1.5;
const magpie = new THREE.Group(); const magInner = makeMagpie(); magInner.rotation.y = -Math.PI / 2; magpie.add(magInner); scene.add(magpie);
const bridge = makeBridge(5.6); bridge.position.set(8.7, 0.08, riverZ(8.7)); bridge.rotation.y = Math.PI / 2; bridge.visible = state.bridge; scene.add(bridge);
const garden = makeGarden(); garden.position.set(-8, 0, 2); garden.rotation.y = 0.5; garden.visible = state.garden; scene.add(garden);

/* Plattform + Stämme */
{ const g = new THREE.Group(); scene.add(g);
  mesh(new THREE.BoxGeometry(9.8, 0.34, 6.8), MAT.wood, 0, PLAT_Y - 0.17, 0, g);
  [[-4, -2.4], [4, -2.4], [-4, 2.4], [4, 2.4], [0, 0]].forEach(([x, z]) => {
    mesh(new THREE.CylinderGeometry(0.5, 0.7, PLAT_Y, 12), MAT.woodD, x, PLAT_Y / 2 - 0.1, z, g); });
  const lad = new THREE.Group(); g.add(lad); lad.position.set(3.4, PLAT_Y / 2 + 0.1, 3.85); lad.rotation.x = -0.3;
  [-0.22, 0.22].forEach(x => mesh(new THREE.CylinderGeometry(0.045, 0.045, PLAT_Y + 0.5, 8), MAT.wood, x, 0, 0, lad));
  for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.44, 0.05, 0.05), MAT.woodL, 0, -1 + i * 0.5, 0, lad);
}

/* ---------- Turm ---------- */
function makeArchGeo(w, h) { const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); }
const matWin = new THREE.MeshLambertMaterial({ color: 0x6b4526 });

/* ---------- Aussentreppe ----------
   Jede Etage trägt einen eigenen Zufalls-Versatz und -Drehwinkel. Ein Lauf
   verbindet zwei Etagen und liegt damit zwischen zwei verschiedenen lokalen
   Koordinatensystemen. Deshalb werden beide Anschlusspunkte zuerst in EIN
   gemeinsames Bezugssystem (towerG) gerechnet und erst danach in das System
   der Etage gebracht, an der der Lauf hängt. */
const floorPose = i => ({ x: (rnd(i) - 0.5) * 0.12, y: floorY(i), ry: (rnd(i + 20) - 0.5) * 0.05 });
const toTower = (i, v) => { const p = floorPose(i), c = Math.cos(p.ry), s = Math.sin(p.ry);
  return new THREE.Vector3(v.x * c + v.z * s + p.x, v.y + p.y, -v.x * s + v.z * c); };
const fromTower = (i, v) => { const p = floorPose(i), c = Math.cos(p.ry), s = Math.sin(p.ry);
  const x = v.x - p.x, z = v.z; return new THREE.Vector3(x * c - z * s, v.y - p.y, x * s + z * c); };
const winCount = w => w > 6.6 ? 4 : w > 5.2 ? 3 : 2;
/* Türposition — identisch zu der, an der die Tür/der Torbogen gebaut wird. */
const doorX = i => { const w = W(i), nw = winCount(w), st = w / (nw + 0.6);
  return (i === 0 ? Math.floor(nw / 2) - (nw - 1) / 2 : (nw - 1) / 2) * st; };
const riseTo = j => floorY(j) - floorY(j - 1);
const DECK_T = 0.12, DECK_Y = 0.15, DECK_W = 1.0, TREAD_T = 0.1;
const deckZIn = i => D(i) / 2 - 0.10;              /* Innenkante, leicht in der Wand */
const padDepth = i => i === 0 ? 0.62 : 1.25;       /* E: die Plattform trägt schon, nur Schwelle */
const armX = i => W(i) / 2 + 0.72;                 /* Laufsteg längs der Etage */
/* Letzter Lauf: von der obersten Etage hinauf auf die Dachterrasse. Er benutzt
   dieselben Bauteile wie alle anderen Läufe, liegt aber mit seiner Spur knapp
   ausserhalb der Dachkante (sonst stäke er im Terrassenboden und in Etage MAXF)
   und endet auf einem Ankunftspodest, das bündig an den Belag anschliesst. */
const ROOF_DECK_T = 0.18;                                   /* Dicke des Terrassenbelags */
const ROOF_RISE = FLOOR_H + 0.02 + ROOF_DECK_T - DECK_Y;    /* Podest Etage MAXF -> Terrassenoberkante */
const ROOF_RUN = 1.5 * ROOF_RISE;                           /* dieselbe Neigung wie die übrigen Läufe */
const ROOF_TRACK = ROOF_W / 2 + DECK_W / 2;                 /* Laufspur, streift die Dachkante */
const ROOF_PAD_D = 1.0;                                     /* Tiefe des Ankunftspodests */
const ROOF_PAD_Z1 = ROOF_D / 2, ROOF_PAD_Z0 = ROOF_PAD_Z1 - ROOF_PAD_D;
const inRoofGap = z => z > ROOF_PAD_Z0 - 0.3;               /* Brüstungspfosten im Durchgang */
const ROOF_GAP_X0 = ROOF_W / 2 - 0.9;                       /* Streifenbreite der Öffnung, für Möbel-Platzierung */
const flightX = i => i === MAXF ? ROOF_TRACK : armX(i) + 0.45;  /* Spur des Laufs, der von i nach oben führt */
const padX1 = i => (i > 0 ? flightX(i - 1) : flightX(i)) + DECK_W / 2;
const padX0 = i => Math.min(doorX(i) - 0.62, armX(i) - DECK_W / 2);
const stairRun = i => 1.5 * riseTo(i + 1);
/* Treppenfuss am hinteren Ende des Laufstegs; auf MAXF richtet er sich nach dem Dachpodest. */
const armZBack = i => i === MAXF ? ROOF_PAD_Z0 - ROOF_RUN : deckZIn(i) - stairRun(i);

/* Podest vor der Tür + Laufsteg + Wendepodest, alles im System der eigenen Etage. */
function buildDeck(i, stairs) {
  const x0 = padX0(i), x1 = padX1(i), zi = deckZIn(i), zo = zi + padDepth(i), cy = DECK_Y - DECK_T / 2;
  const pad = mesh(new THREE.BoxGeometry(x1 - x0, DECK_T, zo - zi), MAT.woodL, (x0 + x1) / 2, cy, (zi + zo) / 2, stairs);
  pad.userData.part = 'pad'; stairs.userData.pad = pad;
  {
    const ax = armX(i), zb = armZBack(i) - 0.45;
    mesh(new THREE.BoxGeometry(DECK_W, DECK_T, zi - zb), MAT.woodL, ax, cy, (zb + zi) / 2, stairs).userData.part = 'deck';
    /* Wendepodest spannt immer über Laufsteg UND Laufspur, egal welche weiter aussen liegt. */
    const tx0 = Math.min(ax, flightX(i)) - DECK_W / 2, tx1 = Math.max(ax, flightX(i)) + DECK_W / 2;
    mesh(new THREE.BoxGeometry(tx1 - tx0, DECK_T, 1.0), MAT.woodL, (tx0 + tx1) / 2, cy, zb + 0.5, stairs).userData.part = 'deck';
    const rz0 = armZBack(i) + 1.0, rlen = zi - rz0;   /* Geländer endet vor dem Treppenfuss */
    if (rlen > 0.6) {
      mesh(new THREE.BoxGeometry(0.06, 0.06, rlen), MAT.woodD, ax + DECK_W / 2 - 0.03, DECK_Y + 0.58, (rz0 + zi) / 2, stairs);
      for (let k = 0; k <= 2; k++)
        mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), MAT.wood, ax + DECK_W / 2 - 0.03, DECK_Y + 0.3, rz0 + k * rlen / 2, stairs);
    }
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), MAT.woodD, tx1 - 0.12, cy - 0.36, zb + 0.12, stairs);
  }
  if (i > 0) {   /* Im Erdgeschoss würde ein Geländer den Aufstieg von der Plattform verstellen. */
    mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 0.06), MAT.woodD, (x0 + x1) / 2, DECK_Y + 0.58, zo - 0.04, stairs);
    const np = Math.max(2, Math.round((x1 - x0) / 1.1));
    for (let k = 0; k <= np; k++)
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), MAT.wood, x0 + k * (x1 - x0) / np, DECK_Y + 0.3, zo - 0.04, stairs);
    [[x0 + 0.12, zo - 0.12], [x1 - 0.12, zo - 0.12]].forEach(([px, pz]) =>
      mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), MAT.woodD, px, cy - 0.36, pz, stairs));
  }
  mesh(new THREE.BoxGeometry(0.06, 0.06, zo - zi), MAT.woodD, x1 - 0.04, DECK_Y + 0.58, (zi + zo) / 2, stairs);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), MAT.wood, x1 - 0.04, DECK_Y + 0.3, zi + 0.12, stairs);
}

/* Ein Lauf zwischen zwei Anschlusspunkten, beide im System von `parent`. */
function makeFlight(foot, top, parent) {
  const d = top.clone().sub(foot);
  const horiz = Math.hypot(d.x, d.z), rise = d.y, L = Math.hypot(horiz, rise);
  const fl = new THREE.Group(); fl.position.copy(foot); fl.rotation.y = Math.atan2(d.x, d.z);
  parent.add(fl);
  const n = Math.max(8, Math.round(rise / 0.2)), step = rise / n, going = horiz / n;
  /* Die oberste Stufe liegt genau auf Podesthöhe und stösst an dessen Innenkante. */
  for (let k = 0; k < n; k++) {
    mesh(new THREE.BoxGeometry(DECK_W, TREAD_T, going + 0.06), MAT.woodL, 0, (k + 1) * step - TREAD_T / 2, (k + 0.5) * going, fl)
      .userData.part = 'tread';
    if (k % 2 === 1)
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), MAT.wood, DECK_W / 2 - 0.02, (k + 1) * step + 0.3, (k + 0.5) * going, fl);
  }
  const sl = -Math.atan2(rise, horiz);
  [-1, 1].forEach(s => { const m = mesh(new THREE.BoxGeometry(0.08, 0.2, L), MAT.woodD, s * (DECK_W / 2 - 0.04), rise / 2 - 0.12, horiz / 2, fl); m.rotation.x = sl; m.userData.part = 'stringer'; });
  const rail = mesh(new THREE.BoxGeometry(0.06, 0.06, L + 0.1), MAT.woodD, DECK_W / 2 - 0.02, rise / 2 + 0.62, horiz / 2, fl); rail.rotation.x = sl;
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.64, 6), MAT.wood, DECK_W / 2 - 0.02, 0.32, 0.06, fl);
  return fl;
}

/* Lauf von Etage i-1 hinauf zu Etage i; hängt an Etage i, damit er mit ihr sichtbar wird. */
function buildFlight(i, stairs) {
  const foot = fromTower(i, toTower(i - 1, new THREE.Vector3(flightX(i - 1), DECK_Y, armZBack(i - 1))));
  const top = new THREE.Vector3(padX1(i) - DECK_W / 2, DECK_Y, deckZIn(i));
  stairs.userData.flight = makeFlight(foot, top, stairs);
}

const floorGroups = [], hitboxes = [], itemMeshes = {}, tenantMeshes = {}, tenantGroups = {}, critters = [], spinners = [];
const towerG = new THREE.Group(); scene.add(towerG);

for (let i = 0; i <= MAXF; i++) {
  const g = new THREE.Group(); const pose = floorPose(i);
  g.position.set(pose.x, pose.y, 0); g.rotation.y = pose.ry;
  const w = W(i), d = D(i), h = H(i);
  const floorMat = MAT.woodL.clone();
  /* Pro Wand eine eigene Innenschale: die tragende Wand bleibt aussen immer Putz,
     nur das dünne Innenpanel bekommt die Tapete. */
  const wallMats = {}, wallPanels = {};
  WALL_KEYS.forEach(key => { wallMats[key] = MAT.plasterIn.clone(); });
  g.userData.wallMats = wallMats; g.userData.wallPanels = wallPanels; g.userData.floorMat = floorMat;
  const panel = (key, geo, x, y, z, parent) => {
    const m = mesh(geo, wallMats[key], x, y, z, parent);
    m.castShadow = false; m.userData.wallKey = key; wallPanels[key] = m; return m;
  };
  mesh(new THREE.BoxGeometry(w + 0.12, 0.14, d + 0.12), MAT.woodL, 0, 0.07, 0, g);
  mesh(new THREE.BoxGeometry(w - 0.24, 0.02, d - 0.24), floorMat, 0, 0.145, 0, g).castShadow = false;
  /* Rückwand: Kern (aussen sichtbar) + Innenpanel — die Innenfläche bleibt bei -d/2 + 0.12,
     also 0.005 hinter wallPlacement(k,'back').fixed, damit Wandobjekte sauber davor hängen. */
  mesh(new THREE.BoxGeometry(w - 0.24, h, WALL_CORE), MAT.plaster, 0, h / 2, -d / 2 + WALL_CORE / 2, g);
  panel('back', new THREE.BoxGeometry(w - 0.24, h, WALL_PANEL), 0, h / 2, -d / 2 + WALL_T - WALL_PANEL / 2, g);
  [-1, 1].forEach(s => {
    mesh(new THREE.BoxGeometry(WALL_CORE, h, d), MAT.plaster, s * (w / 2 - WALL_CORE / 2), h / 2, 0, g);
    panel(s > 0 ? 'right' : 'left', new THREE.BoxGeometry(WALL_PANEL, h, d), s * (w / 2 - WALL_T + WALL_PANEL / 2), h / 2, 0, g);
  });
  g.userData.ceil = mesh(new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3), MAT.plasterIn, 0, h - 0.13, 0, g); g.userData.ceil.castShadow = false;
  const front = new THREE.Group(); front.position.z = d / 2 - 0.06; g.add(front); g.userData.front = front;
  mesh(new THREE.BoxGeometry(w - 0.24, h, WALL_CORE), MAT.plaster, 0, h / 2, 0.06 - WALL_CORE / 2, front);
  panel('front', new THREE.BoxGeometry(w - 0.24, h, WALL_PANEL), 0, h / 2, 0.06 - WALL_T + WALL_PANEL / 2, front);
  g.userData.wins = [];
  const nw = winCount(w);
  for (let k = 0; k < nw; k++) {
    const x = (k - (nw - 1) / 2) * (w / (nw + 0.6));
    if (i === 0 && k === Math.floor(nw / 2)) { mesh(makeArchGeo(1.1, 1.8), matWin, x - 0, 0, 0.08, front); continue; }
    if (i > 0 && k === nw - 1) continue;
    const win = mesh(makeArchGeo(0.5, 0.8), matWin.clone(), x, h * 0.24, 0.08, front);
    g.userData.wins.push(win);
  }
  const stairs = new THREE.Group(); g.add(stairs); g.userData.stairs = stairs;
  if (i > 0) {
    const dx = doorX(i);
    mesh(makeArchGeo(0.7, 1.35), MAT.woodD, dx, 0, 0.08, front);
    mesh(new THREE.BoxGeometry(0.62, 1.22, 0.04), MAT.wood, dx, 0.61, 0.13, front);
    [-0.2, 0, 0.2].forEach(px => mesh(new THREE.BoxGeometry(0.03, 1.2, 0.02), MAT.woodD, dx + px, 0.61, 0.155, front));
    mesh(new THREE.SphereGeometry(0.04, 10, 8), MAT.gold, dx - 0.22, 0.62, 0.17, front);
    buildFlight(i, stairs);
  }
  buildDeck(i, stairs);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    mesh(new THREE.CylinderGeometry(0.09, 0.11, h + 0.2, 10), MAT.woodD, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), g));
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h, d + 0.3), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = h / 2; hit.userData = { type: 'floor', floor: i }; g.add(hit); hitboxes.push(hit);
  g.visible = i === 0 || i <= state.floors;
  towerG.add(g); floorGroups.push(g);
  itemMeshes[i] = []; tenantMeshes[i] = []; tenantGroups[i] = null;
}
itemMeshes.roof = [];

/* Dachterrasse */
const roofG = new THREE.Group(); towerG.add(roofG);
{ mesh(new THREE.BoxGeometry(ROOF_W, ROOF_DECK_T, ROOF_D), MAT.woodL, 0, ROOF_DECK_T / 2, 0, roofG);
  const n = 8;
  for (let k = 0; k <= n; k++) { const x = -ROOF_W / 2 + k * ROOF_W / n;
    [-1, 1].forEach(s => mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), MAT.wood, x, 0.45, s * (ROOF_D / 2 - 0.04), roofG)); }
  /* Die +X-Brüstung lässt zwischen ROOF_PAD_Z0 und der Ecke den Treppendurchgang frei. */
  for (let k = 0; k <= 5; k++) { const z = -ROOF_D / 2 + k * ROOF_D / 5;
    [-1, 1].forEach(s => { if (s > 0 && inRoofGap(z)) return;
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), MAT.wood, s * (ROOF_W / 2 - 0.04), 0.45, z, roofG); }); }
  [-1, 1].forEach(s => { mesh(new THREE.BoxGeometry(ROOF_W, 0.06, 0.07), MAT.woodD, 0, 0.72, s * (ROOF_D / 2 - 0.04), roofG);
    const z1 = s > 0 ? ROOF_PAD_Z0 : ROOF_D / 2, len = z1 + ROOF_D / 2;
    mesh(new THREE.BoxGeometry(0.07, 0.06, len), MAT.woodD, s * (ROOF_W / 2 - 0.04), 0.72, (z1 - ROOF_D / 2) / 2, roofG); });
  const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), MAT.woodD, ROOF_W / 2 - 0.2, 1.2, -ROOF_D / 2 + 0.2, roofG);
  const flag = mesh(new THREE.ConeGeometry(0.22, 0.5, 4), MAT.red, ROOF_W / 2 - 0.2, 1.62, -ROOF_D / 2 + 0.2, roofG);
  flag.rotation.z = -Math.PI / 2; flag.scale.z = 0.1;
  const rhit = new THREE.Mesh(new THREE.BoxGeometry(ROOF_W, 1.4, ROOF_D), new THREE.MeshBasicMaterial({ visible: false }));
  rhit.position.y = 0.7; rhit.userData = { type: 'roof' }; roofG.add(rhit); hitboxes.push(rhit);
}
const partyG = new THREE.Group(); roofG.add(partyG); partyG.visible = false;
{ for (let k = 0; k < 7; k++) { const m = mesh(new THREE.SphereGeometry(0.09, 12, 10), MAT.glow, -ROOF_W / 2 + 0.4 + k * (ROOF_W - 0.8) / 6, 0.85 + Math.sin(k * 2) * 0.06, ROOF_D / 2 - 0.04, partyG); m.castShadow = false; } }
/* Aufgang zur Dachterrasse: letzter Lauf + Ankunftspodest. Hängt an roofG, ist also
   automatisch mit dem Dach sichtbar — erscheint aber erst, wenn Etage MAXF steht. */
const roofStairG = new THREE.Group(); roofG.add(roofStairG);
/* Solange die Treppe fehlt, schliesst dieses Stück die Brüstung an der Durchgangsstelle. */
const roofGapG = new THREE.Group(); roofG.add(roofGapG);
{
  const roofY = PLAT_Y + E_H + MAXF * FLOOR_H + 0.02;   /* roofG-Höhe, sobald alle Etagen stehen */
  const ft = toTower(MAXF, new THREE.Vector3(flightX(MAXF), DECK_Y, armZBack(MAXF)));
  makeFlight(new THREE.Vector3(ft.x, ft.y - roofY, ft.z),
             new THREE.Vector3(ROOF_TRACK, ROOF_DECK_T, ROOF_PAD_Z0), roofStairG);
  /* Ankunftspodest — Oberkante bündig mit dem Terrassenbelag, stösst an dessen Kante. */
  const px0 = ROOF_W / 2, px1 = ROOF_TRACK + DECK_W / 2, cy = ROOF_DECK_T - DECK_T / 2, pzm = (ROOF_PAD_Z0 + ROOF_PAD_Z1) / 2;
  mesh(new THREE.BoxGeometry(px1 - px0, DECK_T, ROOF_PAD_D), MAT.woodL, (px0 + px1) / 2, cy, pzm, roofStairG).userData.part = 'roofpad';
  [ROOF_PAD_Z0 + 0.12, ROOF_PAD_Z1 - 0.12].forEach(pz =>
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), MAT.woodD, px1 - 0.12, cy - 0.36, pz, roofStairG));
  /* Geländer des Podests in der Sprache der Terrassenbrüstung: aussen und vorne zu, zur Treppe hin offen. */
  const post = (x, z) => mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), MAT.wood, x, 0.45, z, roofStairG);
  mesh(new THREE.BoxGeometry(0.07, 0.06, ROOF_PAD_D), MAT.woodD, px1 - 0.04, 0.72, pzm, roofStairG);
  mesh(new THREE.BoxGeometry(px1 - px0, 0.06, 0.07), MAT.woodD, (px0 + px1) / 2, 0.72, ROOF_PAD_Z1 - 0.04, roofStairG);
  [ROOF_PAD_Z0 + 0.06, pzm, ROOF_PAD_Z1 - 0.06].forEach(pz => post(px1 - 0.04, pz));
  [px0 + 0.5, px1 - 0.5].forEach(px => post(px, ROOF_PAD_Z1 - 0.04));
  /* Endpfosten: hier hören Terrassenbrüstung und Podestgeländer sauber auf. */
  [[ROOF_W / 2 - 0.04, ROOF_PAD_Z0], [px1 - 0.04, ROOF_PAD_Z0]].forEach(([px, pz]) =>
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), MAT.woodD, px, 0.4, pz, roofStairG));
  /* Lückenfüller für den Zustand ohne Treppe. */
  mesh(new THREE.BoxGeometry(0.07, 0.06, ROOF_PAD_D), MAT.woodD, ROOF_W / 2 - 0.04, 0.72, pzm, roofGapG);
  for (let k = 0; k <= 5; k++) { const z = -ROOF_D / 2 + k * ROOF_D / 5;
    if (inRoofGap(z)) mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), MAT.wood, ROOF_W / 2 - 0.04, 0.45, z, roofGapG); }
}
function updateRoof() { roofG.visible = true; roofG.position.y = topY() + 0.02;
  roofStairG.visible = state.floors >= MAXF; roofGapG.visible = !roofStairG.visible; }
updateRoof();

/* ---------- Zellen & Möbel ---------- */
const dims = k => k === 'roof' ? { w: ROOF_W - 0.7, d: ROOF_D - 0.9 } : { w: W(k) - 0.7, d: D(k) - 1.0 };
const colsOf = k => Math.max(3, Math.floor(dims(k).w / 0.95));
function cellPos(k, cell) { const { w, d } = dims(k); const cols = colsOf(k);
  const col = cell % cols, row = Math.floor(cell / cols);
  return { x: -w / 2 + (col + 0.5) * (w / cols), z: -d / 2 + (row + 0.5) * (d / 2) }; }
function parentOf(k) { return k === 'roof' ? roofG : floorGroups[k]; }
function baseY(k) { return k === 'roof' ? ROOF_DECK_T : 0.155; }

const DECO = new Set(['vase', 'teekanne', 'kerze', 'buecher', 'nussschale', 'blockfloete']);
/* Wandplatzierung für alle vier Wände, symmetrisch zur bisherigen Rückwand-Formel
   -D(k)/2 + 0.125 / rot=0 (dieselben Konstanten wie die Wandpanels selbst, siehe
   deren Aufbau weiter oben). */
const WALL_FACE_ROT = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
function wallPlacement(k, wallKey) {
  if (wallKey === 'left' || wallKey === 'right') {
    return { fixedAxis: 'x', fixed: wallKey === 'right' ? W(k) / 2 - 0.125 : -W(k) / 2 + 0.125,
      freeAxis: 'z', half: D(k) / 2 - 0.55, rot: WALL_FACE_ROT[wallKey] };
  }
  return { fixedAxis: 'z', fixed: wallKey === 'front' ? D(k) / 2 - 0.125 : -D(k) / 2 + 0.125,
    freeAxis: 'x', half: W(k) / 2 - 0.55, rot: WALL_FACE_ROT[wallKey] };
}
let migrated = false;
/* Tapete pro Wand. Alte Speicherstände haben hier einen einzelnen String für die
   ganze Wohnung — der wandert still auf alle vier Wände. */
function wallpaperOf(k) {
  let wp = state.wallpaper[k];
  if (typeof wp === 'string') { const id = wp; wp = {}; WALL_KEYS.forEach(key => { wp[key] = id; }); state.wallpaper[k] = wp; migrated = true; }
  else if (!wp || typeof wp !== 'object') { wp = state.wallpaper[k] = {}; }
  return wp;
}
function applyLook(k) {
  if (k === 'roof') return; const g = floorGroups[k];
  const wp = wallpaperOf(k), fl = state.flooring[k];
  WALL_KEYS.forEach(key => { const id = wp[key], m = g.userData.wallMats[key];
    m.map = id ? lookTexture('wall', id) : null; m.color.set(id ? 0xffffff : 0xf8ecd0); m.needsUpdate = true; });
  g.userData.floorMat.map = fl ? lookTexture('floor', fl) : null; g.userData.floorMat.color.set(fl ? 0xffffff : 0xd8b078); g.userData.floorMat.needsUpdate = true;
}
/* Welche Wand wird gerade tapeziert? 'alle' ist der schnellste Weg und die Vorgabe. */
let wallTarget = 'alle';
function highlightWalls() {
  for (let i = 0; i <= MAXF; i++) {
    const mats = floorGroups[i].userData.wallMats;
    const lit = edit && edit.k === i && catTab === 'farbe';
    WALL_KEYS.forEach(key => { const on = lit && (wallTarget === 'alle' || wallTarget === key);
      mats[key].emissive.setHex(on ? 0x5c4722 : 0x000000); mats[key].needsUpdate = true; });
  }
}
function setWallTarget(key) { wallTarget = key; highlightWalls(); renderCatalog(); }
function setLook(kind, id) {
  if (!edit || edit.k === 'roof') return;
  if (kind === 'floor') state.flooring[edit.k] = id;
  else { const wp = wallpaperOf(edit.k);
    if (wallTarget === 'alle') WALL_KEYS.forEach(key => { wp[key] = id; }); else wp[wallTarget] = id; }
  applyLook(edit.k); highlightWalls(); sfx.pop(); save();
  if (!id) toast(kind === 'wall' ? 'Tapete ist weg — wieder wie frisch verputzt.' : 'Der Bodenbelag ist weg.');
}
const bounds = k => k === 'roof' ? { x: ROOF_W / 2 - 0.3, z: ROOF_D / 2 - 0.3 } : { x: W(k) / 2 - 0.3, z: D(k) / 2 - 0.3 };
function surfaceYAt(k, x, z, exclude) {
  const parent = parentOf(k); parent.updateWorldMatrix(true, false);
  const wp = parent.localToWorld(new THREE.Vector3(x, 0, z));
  let top = null; const bb = new THREE.Box3();
  itemMeshes[k].forEach(m => { if (m === exclude || DECO.has(m.userData.pick.entry.id) || WALL_ITEMS.has(m.userData.pick.entry.id)) return;
    bb.setFromObject(m);
    if (wp.x > bb.min.x - 0.06 && wp.x < bb.max.x + 0.06 && wp.z > bb.min.z - 0.06 && wp.z < bb.max.z + 0.06) {
      const ly = parent.worldToLocal(new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z)).y;
      if (ly < 1.8 && (top === null || ly > top)) top = ly; } });
  return top === null ? baseY(k) : top + 0.005;
}
const SURFACES = ['tisch', 'regal', 'schrank', 'klavier', 'nusskiste'];
function clampEntry(k, m, en) {
  if (WALL_ITEMS.has(en.id)) {
    en.wall = en.wall || 'back';
    const pl = wallPlacement(k, en.wall), hh = H(k);
    en.x = Math.max(-pl.half, Math.min(pl.half, en.x));
    en.y = Math.max(0.45, Math.min(hh - 0.55, en.y ?? 1.1));
    en.rot = pl.rot;
    const pos = { x: 0, z: 0 }; pos[pl.fixedAxis] = pl.fixed; pos[pl.freeAxis] = en.x; en.z = pos.z;
    m.position.set(pos.x, en.y, pos.z); m.rotation.y = pl.rot; return; }
  const limX = k === 'roof' ? ROOF_W / 2 - 0.1 : W(k) / 2 - 0.13;
  const limZ = k === 'roof' ? ROOF_D / 2 - 0.1 : D(k) / 2 - 0.13;
  const bb = new THREE.Box3().setFromObject(m);
  const hx = Math.min((bb.max.x - bb.min.x) / 2, limX), hz = Math.min((bb.max.z - bb.min.z) / 2, limZ);
  en.x = Math.max(-(limX - hx), Math.min(limX - hx, en.x));
  en.z = Math.max(-(limZ - hz), Math.min(limZ - hz, en.z));
  if (k === 'roof' && en.x + hx > ROOF_GAP_X0 && inRoofGap(en.z + hz)) {
    en.z = Math.min(en.z, (ROOF_PAD_Z0 - 0.3) - hz);
  }
  m.position.set(en.x, en.y ?? baseY(k), en.z);
}
function placeItemMesh(k, entry) {
  if (entry.x === undefined) { const p = cellPos(k, entry.cell || 0); entry.x = p.x; entry.z = p.z; entry.rot = (entry.rot || 0) * Math.PI / 2; }
  const m = makeFurniture(entry.id);
  if (WALL_ITEMS.has(entry.id)) {
    /* entry.x ist die Position entlang der Wand (siehe wallPlacement); die feste Achse
       (Wandebene) wird aus entry.wall/k neu bestimmt, nicht mitgespeichert. */
    const pl = wallPlacement(k, entry.wall || 'back');
    const pos = { x: 0, z: 0 }; pos[pl.fixedAxis] = pl.fixed; pos[pl.freeAxis] = entry.x;
    m.position.set(pos.x, entry.y ?? baseY(k), pos.z);
    m.rotation.y = pl.rot;
  } else {
    m.position.set(entry.x, entry.y ?? baseY(k), entry.z);
    m.rotation.y = entry.rot;
  }
  m.userData.pick = { k, entry, mesh: m };
  parentOf(k).add(m); itemMeshes[k].push(m);
  if (m.userData.wheel) spinners.push(m.userData.wheel);
  return m;
}
function freeCell(k, from = 0) { const total = colsOf(k) * 2;
  const used = new Set(roomOf(k).filter(e => !DECO.has(e.id) && !WALL_ITEMS.has(e.id)).map(e => e.cell));
  for (let n = 0; n < total; n++) { const c = (from + n) % total; if (!used.has(c)) return c; } return -1; }

/* ---------- UI-Refs ---------- */
const $ = id => document.getElementById(id);
/* #selbar's bottom offset tracks #toolbar's real rendered height (it wraps to two
   rows on narrow viewports), so the two never overlap and #selbar never has to
   guess the toolbar's height. Beobachtet wird ausdrücklich die Border-Box: die
   Werkzeugleiste hält den Navileisten-Streifen als Innenabstand frei, und auf der
   Content-Box feuert der Beobachter bei dessen Änderung nicht — --toolbar-h bliebe
   stehen und das Extras-Menü rutschte in die Leiste hinein. */
(() => { const tb = $('toolbar');
  const sync = () => document.documentElement.style.setProperty('--toolbar-h', tb.offsetHeight + 'px');
  new ResizeObserver(sync).observe(tb, { box: 'border-box' }); sync(); })();
/* #catalog's bottom offset also tracks #selbar's real rendered height, so the
   catalog drawer never covers the selection bar either. */
(() => { const sb = $('selbar');
  const sync = () => document.documentElement.style.setProperty('--selbar-h', sb.offsetHeight + 'px');
  new ResizeObserver(sync).observe(sb); sync(); })();
/* --nav-h ist der Streifen am unteren Bildrand, den die Navileiste #game-nav aus
   der ai-instructions-Vorlage belegt (index.html, Ende der Datei): Höhe plus
   eigener Bodenabstand in einer Zahl, damit keine Zahl aus deren Inline-Style
   hier abgeschrieben wird — die Höhe schwankt je nach Umbruch zwischen 37 und
   48 Pixeln. #toolbar hält diesen Streifen frei; ohne Navileiste bleibt die
   Variable ungesetzt und der CSS-Fallback 0px stellt das frühere Layout her.
   Die Vorlage selbst wird nicht angefasst, sonst überschreibt sie der nächste
   Sync (Issue #32). */
(() => { const nav = $('game-nav'); if (!nav) return;
  const sync = () => {
    if (!nav.isConnected) { document.documentElement.style.removeProperty('--nav-h'); return; }
    document.documentElement.style.setProperty('--nav-h',
      Math.max(0, Math.round(window.innerHeight - nav.getBoundingClientRect().top)) + 'px');
  };
  new ResizeObserver(sync).observe(nav);
  new ResizeObserver(sync).observe(document.documentElement);
  addEventListener('resize', sync); sync(); })();
/* Toasts verschwinden nie von selbst — ein Kind soll fertig lesen können. Sie
   stapeln sich stattdessen und werden einzeln (× oder Tipp auf den Toast) oder
   alle zusammen weggetippt. TOAST_MAX_VISIBLE begrenzt den Stapel, damit eine
   ignorierte Serie den Bildschirm nicht zustellt. */
const TOAST_MAX_VISIBLE = 5;
const toastStackEl = $('toast-stack'), toastClearEl = $('toast-clear-all');
let toasts = [], toastSeq = 0;
function toast(msg) {
  toasts.push({ id: ++toastSeq, msg });
  if (toasts.length > TOAST_MAX_VISIBLE) toasts.shift();
  renderToasts();
}
function dismissToast(id) { toasts = toasts.filter(t => t.id !== id); renderToasts(); }
function dismissAllToasts() { toasts = []; renderToasts(); }
function makeToastItem(t) {
  const el = document.createElement('div');
  el.className = 'toast-item panel'; el.dataset.id = t.id;
  const msg = document.createElement('span'); msg.className = 'toast-msg'; msg.textContent = t.msg;
  const close = document.createElement('button');
  close.className = 'toast-close'; close.type = 'button'; close.textContent = '×';
  close.setAttribute('aria-label', 'Schliessen');
  el.append(msg, close);
  el.onclick = () => dismissToast(t.id);
  return el;
}
/* Nur Zu- und Abgänge anfassen: ein neuer Toast soll die schon offenen nicht
   neu einblenden lassen. #toast-stack ist column-reverse, das erste Kind sitzt
   also unten bei der Werkzeugleiste: «Alle schliessen» bleibt dort stehen und
   ist auch bei vollem, gescrolltem Stapel erreichbar, der neueste Toast kommt
   direkt darüber. */
function renderToasts() {
  const open = new Set(toasts.map(t => t.id));
  for (const el of toastStackEl.querySelectorAll('.toast-item'))
    if (!open.has(Number(el.dataset.id))) el.remove();
  for (const t of toasts)
    if (!toastStackEl.querySelector(`.toast-item[data-id="${t.id}"]`)) toastClearEl.after(makeToastItem(t));
  toastClearEl.classList.toggle('hidden', toasts.length < 2);
}
toastClearEl.onclick = dismissAllToasts;
function updateHUD() { $('nuts').textContent = state.nuts; $('floors').textContent = state.floors;
  $('floors-max').textContent = MAXF;
  $('btn-build').textContent = state.floors >= MAXF ? 'Fertig gebaut!' : `Stockwerk bauen (${state.floors + 1}/${MAXF})`;
  $('btn-build').disabled = state.floors >= MAXF || !!edit;
  $('btn-party').classList.toggle('hidden', !(state.floors === MAXF && tenantIn(MAXF)));
}

/* ---------- Katalog ---------- */
let thumbs = {}; const animalThumbs = {}; let williThumb = '', damThumb = '', mokiThumb = '';
function makeThumbs() {
  const r2 = new THREE.WebGLRenderer({ alpha: true, antialias: true }); r2.setSize(160, 160);
  const s2 = new THREE.Scene();
  s2.add(new THREE.HemisphereLight(0xfff4da, 0xbfae90, 1.4));
  const d2 = new THREE.DirectionalLight(0xffffff, 1.6); d2.position.set(2, 4, 3); s2.add(d2);
  const c2 = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
  const snap = (o, fx, fy, fz) => { s2.add(o);
    const bb = new THREE.Box3().setFromObject(o); const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    const md = Math.max(size.x, size.y, size.z);
    c2.position.set(ctr.x + md * fx, ctr.y + md * fy, ctr.z + md * fz); c2.lookAt(ctr);
    r2.render(s2, c2); const url = r2.domElement.toDataURL(); s2.remove(o); return url; };
  CATALOG.forEach(it => { thumbs[it.id] = snap(makeFurniture(it.id), 1.15, 0.85, 1.35); });
  TENANTS.forEach((t, i) => { const o = new THREE.Group();
    t.animals.forEach((sp, n) => { const a = makeAnimal(sp);
      a.position.x = (n - (t.animals.length - 1) / 2) * 0.52; a.rotation.y = (n - 0.5) * -0.5; o.add(a); });
    animalThumbs[i] = snap(o, 0.4, 0.55, 1.5); });
  { const wg = makeWilli(); williThumb = snap(wg, 0.5, 0.7, 1.4); }
  { const dg = makeDam(); damThumb = snap(dg, 0.8, 0.8, 1.2); }
  { const mg = makeAnimal('eichhoernchen'); mokiThumb = snap(mg, 0.4, 0.55, 1.5); }
  r2.dispose();
}
function renderCatalog() {
  const roof = edit && edit.k === 'roof';
  const tabs = $('catalog-tabs'); tabs.innerHTML = '';
  const avail = CATS.filter(([id]) => roof ? id === 'dach' : id !== 'dach');
  if (!avail.some(([id]) => id === catTab)) catTab = avail[0][0];
  avail.forEach(([id, label]) => { const b = document.createElement('button');
    b.textContent = label; b.className = id === catTab ? 'on' : '';
    b.onclick = () => { catTab = id; highlightWalls(); renderCatalog(); }; tabs.appendChild(b); });
  const wrap = $('catalog-items'); wrap.innerHTML = '';
  if (catTab === 'farbe' || catTab === 'boden') {
    const kind = catTab === 'farbe' ? 'wall' : 'floor';
    if (kind === 'wall') {
      const pick = document.createElement('div'); pick.id = 'wallpick';
      const hint = document.createElement('p'); hint.className = 'hint';
      hint.textContent = 'Welche Wand? Du kannst sie auch direkt antippen.';
      pick.appendChild(hint);
      [['alle', 'Alle Wände'], ...WALL_KEYS.map(key => [key, WALL_LABELS[key]])].forEach(([key, label]) => {
        const b = document.createElement('button');
        b.textContent = label; b.dataset.wall = key;
        if (key === wallTarget) b.className = 'on';
        b.onclick = () => setWallTarget(key);
        pick.appendChild(b); });
      wrap.appendChild(pick);
    }
    const none = document.createElement('div'); none.className = 'item look remove';
    none.innerHTML = `<i class="none"></i><span>Entfernen</span>`;
    none.onclick = () => setLook(kind, null); wrap.appendChild(none);
    (kind === 'wall' ? WALLS : FLOORS).forEach(l => { const d = document.createElement('div'); d.className = 'item look';
      d.innerHTML = `<img src="${lookCanvas(kind, l.id).toDataURL()}" alt=""><span>${l.name}</span>`;
      d.onclick = () => setLook(kind, l.id); wrap.appendChild(d); });
    return;
  }
  if (catTab === 'wand') {
    const pick = document.createElement('div'); pick.id = 'wallpick';
    const hint = document.createElement('p'); hint.className = 'hint';
    hint.textContent = 'Welche Wand? Du kannst sie auch direkt antippen.';
    pick.appendChild(hint);
    const active = wallTarget === 'alle' ? 'back' : wallTarget;
    WALL_KEYS.forEach(key => {
      const b = document.createElement('button');
      b.textContent = WALL_LABELS[key]; b.dataset.wall = key;
      if (key === active) b.className = 'on';
      b.onclick = () => { setWallTarget(key);
        if (key === 'front') toast('Diese Wand siehst du erst richtig, wenn du fertig bist.'); };
      pick.appendChild(b); });
    wrap.appendChild(pick);
  }
  CATALOG.filter(it => it.cat === catTab).forEach(it => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = `<img src="${thumbs[it.id] || ''}" alt=""><span>${it.name}</span>`;
    d.onclick = () => addItem(it.id); wrap.appendChild(d); });
}
let catTab = 'mobel';

/* ---------- Einrichten ---------- */
let edit = null, selected = null, selHelper = null;
let camSave = null;
const tweens = [];
function tween(dur, step, done) { tweens.push({ t: 0, dur, step, done }); }
function moveCam(pos, tgt, dur = 0.9) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  tween(dur, k => { camera.position.lerpVectors(p0, pos, k); controls.target.lerpVectors(t0, tgt, k); });
}
function applyFronts() {
  for (let j = 0; j <= MAXF; j++) floorGroups[j].userData.front.visible = !state.cutaway && !(edit && edit.k === j);
  $('btn-cutaway').textContent = state.cutaway ? 'Wände hin' : 'Wände weg';
}
function fitDistance(halfWidth, halfHeight) {
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distH = halfWidth / Math.tan(hFov / 2);
  const distV = halfHeight / Math.tan(vFov / 2);
  return Math.max(distH, distV);
}
function editCamFor(k) {
  if (k === 'roof') {
    const y = topY() + 0.9;
    const dist = ROOF_D / 2 + fitDistance(dims('roof').w / 2 + 0.4, 1.4) + 1.0;
    return { eye: new THREE.Vector3(0, y + 3.2, dist), tgt: new THREE.Vector3(0, y, 0) };
  }
  const cy = floorY(k) + H(k) / 2;
  const dist = D(k) / 2 + fitDistance(dims(k).w / 2 + 0.4, H(k) / 2 + 0.4) + 1.0;
  return { eye: new THREE.Vector3(floorGroups[k].position.x, cy + 0.5, dist), tgt: new THREE.Vector3(floorGroups[k].position.x, cy, 0) };
}
function enterEdit(k) {
  if (edit) return;
  edit = { k };
  camSave = { p: camera.position.clone(), t: controls.target.clone() };
  const { eye, tgt } = editCamFor(k);
  if (k === 'roof') {
    moveCam(eye, tgt);
    $('edit-title').textContent = 'Dachterrasse einrichten';
  } else {
    for (let j = k + 1; j <= MAXF; j++) floorGroups[j].visible = false;
    roofG.visible = false;
    applyFronts();
    floorGroups[k].userData.ceil.visible = false;
    moveCam(eye, tgt);
    const t = TENANTS[k];
    $('edit-title').textContent = `${flLabel(k)} — ${tenantIn(k) ? (t.unit || t.name) : 'Wohnung einrichten'}`;
  }
  $('editbar').classList.add('on');
  wallTarget = 'alle';
  $('catalog').classList.add('open'); renderCatalog(); highlightWalls();
  updateHUD(); sfx.whoosh();
}
function exitEdit() {
  if (!edit) return;
  if (edit.k !== 'roof') { for (let j = 1; j <= MAXF; j++) floorGroups[j].visible = j <= state.floors; }
  for (let j = 0; j <= MAXF; j++) floorGroups[j].userData.ceil.visible = true;
  updateRoof();
  deselect();
  moveCam(camSave.p, camSave.t);
  edit = null;
  wallTarget = 'alle'; highlightWalls();
  applyFronts();
  $('editbar').classList.remove('on');
  $('catalog').classList.remove('open');
  updateHUD();
}
function deselect() { if (selHelper) { scene.remove(selHelper); selHelper = null; } selected = null; $('selbar').classList.remove('on'); }
function select(pick) { deselect(); selected = pick;
  selHelper = new THREE.BoxHelper(pick.mesh, 0xc0432e); scene.add(selHelper);
  const wall = WALL_ITEMS.has(pick.entry.id);
  $('btn-move').classList.toggle('hidden', wall);
  $('btn-rot').classList.toggle('hidden', wall);
  $('wallpad').classList.toggle('hidden', !wall);
  /* Ein Bewohner lässt sich nicht wegwerfen (#39). */
  $('btn-del').classList.toggle('hidden', !!pick.tenant);
  $('selbar').classList.add('on'); }

function addItem(id) {
  if (!edit) return;
  const k = edit.k;
  const cell = freeCell(k);
  if (cell < 0 && !DECO.has(id) && !WALL_ITEMS.has(id)) { toast('Die Wohnung ist schon ganz voll!'); return; }
  const p = cellPos(k, Math.max(cell, 0));
  const entry = { id, cell: Math.max(cell, 0), x: p.x, z: p.z, rot: 0 };
  if (WALL_ITEMS.has(id)) {
    entry.wall = wallTarget === 'alle' ? 'back' : wallTarget;
    entry.y = id === 'fenster' ? 1.05 : 1.2;
    const pl = wallPlacement(k, entry.wall);
    const wallLen = pl.freeAxis === 'x' ? W(k) : D(k);
    const taken = roomOf(k).filter(e => WALL_ITEMS.has(e.id) && (e.wall || 'back') === entry.wall).map(e => e.x);
    const hw = wallLen / 2 - 0.6; let best = 0, bd = -1;
    for (let x = -hw; x <= hw; x += 0.4) { const dmin = taken.length ? Math.min(...taken.map(t => Math.abs(t - x))) : 99; if (dmin > bd) { bd = dmin; best = x; } }
    entry.x = best; }
  if (DECO.has(id)) {
    let surf = null;
    if (selected && selected.k === k && SURFACES.includes(selected.entry.id)) surf = selected.mesh;
    else surf = itemMeshes[k].find(m => SURFACES.includes(m.userData.pick.entry.id));
    if (surf) { entry.x = surf.position.x + (Math.random() - 0.5) * 0.15; entry.z = surf.position.z + (Math.random() - 0.5) * 0.15; }
  }
  entry.y = WALL_ITEMS.has(id) ? entry.y : DECO.has(id) ? surfaceYAt(k, entry.x, entry.z) : baseY(k);
  roomOf(k).push(entry);
  const m = placeItemMesh(k, entry);
  clampEntry(k, m, entry);
  m.scale.setScalar(0.01);
  tween(0.35, q => { m.scale.setScalar(0.01 + 0.99 * q); if (selHelper) selHelper.update(); });
  select(m.userData.pick);
  sfx.pop();
  checkTenant(k); checkWishes(id, k);
  save(); updateHUD();
}
function removeItem(pick) {
  const arr = roomOf(pick.k); const idx = arr.indexOf(pick.entry);
  if (idx >= 0) arr.splice(idx, 1);
  parentOf(pick.k).remove(pick.mesh);
  const mi = itemMeshes[pick.k].indexOf(pick.mesh); if (mi >= 0) itemMeshes[pick.k].splice(mi, 1);
  deselect(); sfx.knock(); save(); renderWishes();
}

/* ---------- Bewohner & Wünsche ---------- */
/* Plätze im Raum für Tiere: 5x3-Punktraster, bewertet mit dem Abstand zum
   nächsten Möbelstück (Box3, wie in surfaceYAt), absteigend sortiert.
   Kandidaten werden dafür ins Weltkoordinatensystem übersetzt, weil
   floorGroups[k] neben der Verschiebung auch eine kleine Zufallsrotation trägt
   (siehe floorPose) und Box3.setFromObject Weltkoordinaten liefert. */
function tenantSpots(k) {
  const boxes = itemMeshes[k].filter(m => {
    const id = m.userData.pick.entry.id;
    return !DECO.has(id) && !WALL_ITEMS.has(id);
  }).map(m => new THREE.Box3().setFromObject(m));
  const { w, d } = dims(k), parent = parentOf(k); parent.updateWorldMatrix(true, false);
  const cols = 5, rows = 3, out = [];
  /* Ohne Möbel bleibt die Raummitte der beste Platz (Verhalten aus #14); das
     Raster dahinter liefert trotzdem Ausweichpunkte für «Verschieben». */
  if (!boxes.length) out.push({ x: 0, z: 0, score: Infinity });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + (c + 0.5) * w / cols, z = -d / 2 + (r + 0.5) * d / rows;
    const wp = parent.localToWorld(new THREE.Vector3(x, 0, z));
    let minDist = Infinity;
    boxes.forEach(bb => {
      const dx = Math.max(bb.min.x - wp.x, 0, wp.x - bb.max.x);
      const dz = Math.max(bb.min.z - wp.z, 0, wp.z - bb.max.z);
      const dist = Math.hypot(dx, dz);
      if (dist < minDist) minDist = dist;
    });
    out.push({ x, z, score: minDist });
  }
  return out.sort((a, b) => b.score - a.score);
}
/* Freieste Stelle im Raum (Verhalten aus #14): der bestbewertete Kandidat. */
const tenantSpot = k => { const s = tenantSpots(k)[0]; return { x: s.x, z: s.z }; };
/* Von Hand gesetzter Platz schaltet die Automatik für die ganze Wohnung ab:
   der Mitbewohner würde sonst beim nächsten Laden zu einem neu berechneten
   tenantSpot springen, womöglich in das eben gestellte Tier hinein (#39, A3). */
function setTenantPos(i, n, en) {
  const arr = state.tenantPos[i] || (state.tenantPos[i] = []);
  tenantMeshes[i].forEach((m, j) => { if (!arr[j]) { const e = m.userData.pick.entry;
    arr[j] = { x: +e.x.toFixed(3), z: +e.z.toFixed(3), rot: +e.rot.toFixed(3) }; } });
  arr[n] = { x: +en.x.toFixed(3), z: +en.z.toFixed(3), rot: +en.rot.toFixed(3) };
  en.manual = true; save();
}
function spawnTenant(i, silent) {
  if (tenantGroups[i]) return;
  const t = TENANTS[i]; const g = new THREE.Group();
  g.userData = { type: 'tenant', floor: i };
  const saved = state.tenantPos[i];
  const spot = saved ? null : tenantSpot(i);
  tenantMeshes[i] = [];
  t.animals.forEach((sp, n) => { const a = makeAnimal(sp);
    const man = saved && saved[n];
    /* Tier-entry trägt bewusst kein id-Feld: DECO.has/WALL_ITEMS.has liefern
       für undefined false, damit verhält sich ein Tier überall wie ein
       gewöhnliches Bodenmöbel. */
    const entry = man
      ? { x: man.x, z: man.z, rot: man.rot, manual: true }
      : { x: spot.x + (n - (t.animals.length - 1) / 2) * 0.55, z: spot.z,
          rot: (n - 0.5) * 0.5, manual: false };
    a.position.set(entry.x, baseY(i), entry.z);
    a.rotation.y = entry.rot;
    a.userData.pick = { k: i, entry, mesh: a, tenant: { floor: i, idx: n } };
    g.add(a); tenantMeshes[i].push(a); critters.push({ g: a, ph: i * 2 + n, base: baseY(i) }); });
  floorGroups[i].add(g); tenantGroups[i] = g;
  if (!silent) { toast(`${t.name} — eingezogen!`); sfx.chime();
    g.scale.setScalar(0.01); tween(0.5, q => g.scale.setScalar(0.01 + 0.99 * q)); }
  renderWishes(); renderResidents(); updateHUD();
}
function checkTenant(k) { if (k !== 'roof' && tenantIn(k) && !tenantGroups[k]) spawnTenant(k); }
function wishOpen(i) {
  if (!tenantIn(i) || state.fulfilled[i]) return false;
  const t = TENANTS[i]; const where = t.roofWish ? 'roof' : i;
  if (roomOf(where).some(e => e.id === t.wish)) { state.fulfilled[i] = true; return false; }
  return true;
}
function checkWishes(placedId, k) {
  for (let i = 0; i <= MAXF; i++) { const t = TENANTS[i];
    if (!tenantIn(i) || state.fulfilled[i]) continue;
    const where = t.roofWish ? 'roof' : i;
    if (where === k && t.wish === placedId) {
      state.fulfilled[i] = true; state.nuts += 3;
      toast('Wunsch erfüllt! +3 Haselnüsse'); sfx.chime(true);
      if (placedId === 'pool') sfx.splash();
      save(); } }
  renderWishes(); updateHUD();
}
function renderWishes() {
  const box = $('wishes'); box.innerHTML = '';
  for (let i = 0; i <= MAXF; i++) { if (!wishOpen(i)) continue;
    const t = TENANTS[i];
    const d = document.createElement('div'); d.className = 'wish panel';
    d.innerHTML = `<b>${flLabel(i)}:</b> ${t.wtext}`;
    d.onclick = () => { if (edit) exitEdit(); setTimeout(() => enterEdit(t.roofWish ? 'roof' : i), 60); $('extras-menu').classList.remove('open'); };
    box.appendChild(d); }
}
function renderResidents() {
  const ul = $('resident-list'); ul.innerHTML = '';
  for (let i = MAXF; i >= 0; i--) {
    const li = document.createElement('li');
    const built = i <= state.floors;
    const nm = !built ? '<span class="free">noch nicht gebaut</span>' : tenantIn(i) ? `<b>${TENANTS[i].unit || TENANTS[i].name}</b>` : '<span class="free">zurzeit frei</span>';
    const hint = i === 0 ? '<span class="hint">Erdgeschoss, war schon da</span>' : '';
    li.innerHTML = `<span class="fl">${flLabel(i)}</span><span>${nm}${hint}</span>`;
    ul.appendChild(li); }
}

/* ---------- Bauen ---------- */
let buildingUntil = 0;
function buildFloor() {
  if (state.floors >= MAXF || edit) return;
  state.floors++;
  const i = state.floors, g = floorGroups[i];
  g.visible = true; g.scale.y = 0.01;
  tween(0.7, q => { g.scale.y = 0.01 + 0.99 * q; });
  buildingUntil = clock.elapsedTime + 1.4;
  sfx.knock(); setTimeout(() => sfx.knock(), 240); setTimeout(() => sfx.knock(), 500);
  updateRoof(); updateHUD(); renderResidents(); save();
  const ny = PLAT_Y + (E_H + state.floors * FLOOR_H) * 0.55;
  if (!edit) { const t = controls.target.clone(); t.y = ny;
    const p = camera.position.clone(); p.y += 0.6; p.multiplyScalar(1.03); moveCam(p, t, 0.7); }
  if (i === MAXF) { toast('Der Wipfelkratzer ist fertig! Schau aufs Dach!'); sfx.chime(true); }
  else toast(`Willi hämmert fleissig — Stockwerk ${i} steht!`);
}

/* ---------- Extras ---------- */
$('btn-bridge').onclick = () => { $('extras-menu').classList.remove('open');
  if (state.bridge) { toast('Die Brücke steht schon!'); return; }
  state.bridge = true; bridge.visible = true; bridge.scale.setScalar(0.01);
  tween(0.6, q => bridge.scale.setScalar(0.01 + 0.99 * q));
  sfx.knock(); toast('Willi baut eine Brücke über den Fluss!'); save(); };
$('btn-garden').onclick = () => { $('extras-menu').classList.remove('open');
  if (state.garden) { toast('Garten und Spielplatz sind schon da!'); return; }
  state.garden = true; garden.visible = true; garden.scale.setScalar(0.01);
  tween(0.6, q => garden.scale.setScalar(0.01 + 0.99 * q));
  sfx.pop(); toast('Spielplatz, Beete und Blumen — fertig!'); save(); };
$('btn-sign').onclick = () => { $('extras-menu').classList.remove('open'); renderResidents(); $('residents').classList.add('open'); };
function renderAnimals() {
  const grid = $('animal-grid'); grid.innerHTML = '';
  TENANTS.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'acard';
    const status = tenantIn(i) ? '<span class="in">Eingezogen!</span>' : '<small>wartet noch auf die Wohnung</small>';
    d.innerHTML = `<img src="${animalThumbs[i] || ''}" alt=""><b>${t.name}</b><small>Stock ${flLabel(i)}</small>${status}`;
    grid.appendChild(d); });
  const d = document.createElement('div'); d.className = 'acard';
  d.innerHTML = `<img src="${mokiThumb}" alt=""><b>Móki das Eichhörnchen</b><small>flitzt ums Haus</small><span class="in">Besucher</span>`;
  grid.appendChild(d);
}
$('btn-animals').onclick = () => { $('extras-menu').classList.remove('open'); renderAnimals(); $('animals').classList.add('open'); };
$('btn-aniclose').onclick = () => $('animals').classList.remove('open');
$('animals').onclick = e => { if (e.target === $('animals')) $('animals').classList.remove('open'); };
$('btn-resclose').onclick = () => $('residents').classList.remove('open');
$('residents').onclick = e => { if (e.target === $('residents')) $('residents').classList.remove('open'); };

/* Party */
let party = false; const dancers = [];
$('btn-party').onclick = () => { $('extras-menu').classList.remove('open'); party ? endParty() : startParty(); };
function startParty() {
  party = true; $('btn-party').textContent = 'Party beenden';
  setNight(true); partyG.visible = true;
  let n = 0;
  for (let i = 0; i <= MAXF; i++) { if (!tenantIn(i)) continue;
    TENANTS[i].animals.forEach(sp => { const a = makeAnimal(sp);
      const ang = n * 1.1, r = 0.6 + (n % 3) * 0.45;
      a.position.set(Math.cos(ang) * r, 0.18, Math.sin(ang) * r * 0.6);
      a.rotation.y = Math.random() * 6; roofG.add(a); dancers.push({ g: a, ph: n }); n++; }); }
  switchSong('party'); sfx.chime(true);
  moveCam(new THREE.Vector3(6, topY() + 4, 9), new THREE.Vector3(0, topY() + 0.8, 0), 1.2);
  toast('Froschkonzert und grosse Party auf dem Dach!');
}
function endParty() {
  party = false; $('btn-party').textContent = 'Dachparty feiern!';
  partyG.visible = false;
  dancers.forEach(d => roofG.remove(d.g)); dancers.length = 0;
  switchSong('day');
}

/* Tag/Nacht */
let nightK = state.night ? 1 : 0;
function applyNight(k) {
  nightK = k;
  scene.background.lerpColors(SKY.d, SKY.n, k); scene.fog.color.copy(scene.background);
  hemi.color.lerpColors(HEMI.d, HEMI.n, k); hemi.groundColor.lerpColors(GRND.d, GRND.n, k);
  hemi.intensity = 1.05 - 0.62 * k; dir.intensity = 1.15 - 1.0 * k;
  starMat.opacity = k * 0.9; moonMat.opacity = k;
  for (let i = 0; i <= MAXF; i++) { const lit = k > 0.5 && tenantIn(i);
    floorGroups[i].userData.wins.forEach(w => { w.material.color.set(lit ? 0xffd98a : 0x6b4526);
      w.material.emissive.set(lit ? 0xffc257 : 0x000000); w.material.emissiveIntensity = lit ? 0.9 : 0; }); }
  $('btn-night').textContent = k > 0.5 ? 'Tag' : 'Nacht';
}
function setNight(on) {
  state.night = on; save();
  const from = nightK, to = on ? 1 : 0;
  tween(1.2, q => applyNight(from + (to - from) * q));
}
$('btn-night').onclick = () => { if (party && state.night) { toast('Bei der Party bleibt es Nacht!'); return; } setNight(!state.night); };
$('btn-cutaway').onclick = () => { state.cutaway = !state.cutaway; applyFronts(); sfx.whoosh(); save();
  if (state.cutaway) toast('Blick in alle Wohnungen — wie im Buch!'); };

/* Reset */
let resetArmed = 0;
$('btn-reset').onclick = () => {
  if (Date.now() - resetArmed < 4000) { try { localStorage.removeItem('wipfelkratzer-v1'); } catch (e) {} location.reload(); }
  else { resetArmed = Date.now(); $('btn-reset').textContent = 'Wirklich alles löschen?';
    setTimeout(() => { $('btn-reset').textContent = 'Neu anfangen'; resetArmed = 0; }, 4000); } };

/* ---------- Audio ---------- */
let AC = null, master, musGain, musicOn = true, seqPos = 0, nextNote = 0;
let curSong = 'day';
const midi2f = m => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = {
  day: { beat: 0.42, type: 'triangle', g: 0.09,
    mel: [67, 0, 71, 74, 0, 71, 79, 0, 76, 74, 0, 71, 67, 0, 64, 62, 0, 64, 67, 0, 71, 74, 0, 79],
    bass: [43, 0, 0, 48, 0, 0, 50, 0, 0, 43, 0, 0] },
  party: { beat: 0.21, type: 'square', g: 0.045,
    mel: [67, 69, 71, 0, 74, 71, 69, 67, 64, 67, 69, 0, 71, 69, 67, 64, 62, 64, 67, 0, 71, 74, 71, 67],
    bass: [38, 45, 38, 45, 43, 50, 43, 50] },
};
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
  master = AC.createGain(); master.gain.value = 0.55; master.connect(lp); lp.connect(AC.destination);
  musGain = AC.createGain(); musGain.gain.value = 0.4; musGain.connect(master);
  nextNote = AC.currentTime + 0.2;
  setInterval(() => { if (!AC) return;
    while (nextNote < AC.currentTime + 0.5) { schedBeat(seqPos, nextNote); seqPos++; nextNote += SONGS[curSong].beat; } }, 140);
}
function tone(f, t, dur, type = 'sine', g = 0.12, dest) {
  if (!AC) return; const o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); gn.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function noiseBurst(t, dur, f0, f1, g = 0.2) {
  if (!AC) return; const len = Math.ceil(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gn = AC.createGain(); gn.gain.value = g;
  src.connect(f); f.connect(gn); gn.connect(master); src.start(t);
}
function schedBeat(i, t) {
  const s = SONGS[curSong];
  const m = s.mel[i % s.mel.length];
  if (m && musicOn) tone(midi2f(m), t, s.beat * 1.9, s.type, s.g, musGain);
  if (curSong === 'day') { if (i % 3 === 0 && musicOn) tone(midi2f(s.bass[(i / 3 | 0) % s.bass.length] || 43), t, 0.55, 'sine', 0.1, musGain); }
  else if (musicOn) tone(midi2f(s.bass[i % s.bass.length]), t, 0.18, 'triangle', 0.09, musGain);
}
function switchSong(name) { curSong = name; }
const sfx = {
  pop() { if (!AC) return; const t = AC.currentTime; const o = tone(320, t, 0.14, 'sine', 0.18); if (o) o.frequency.exponentialRampToValueAtTime(680, t + 0.1); },
  knock() { if (!AC) return; const t = AC.currentTime; tone(88, t, 0.13, 'triangle', 0.3); noiseBurst(t, 0.06, 2400, 500, 0.12); },
  chime(big) { if (!AC) return; const t = AC.currentTime;
    [880, 1108, 1318, big ? 1760 : 0].forEach((f, i) => f && tone(f, t + i * 0.09, 0.5, 'triangle', 0.1)); },
  splash() { if (!AC) return; noiseBurst(AC.currentTime, 0.5, 2800, 260, 0.22); },
  whoosh() { if (!AC) return; noiseBurst(AC.currentTime, 0.28, 500, 2400, 0.07); },
  shutter() { if (!AC) return; const t = AC.currentTime; noiseBurst(t, 0.04, 6000, 1500, 0.3); noiseBurst(t + 0.07, 0.05, 3000, 800, 0.25); },
};
$('btn-music').onclick = () => { musicOn = !musicOn; $('btn-music').textContent = musicOn ? 'Musik aus' : 'Musik an'; };

function tenantTalk(i) {
  const t = TENANTS[i];
  bubbleTarget = tenantGroups[i]; bubbleH = 1.0;
  const status = state.fulfilled[i] ? 'ist glücklich und zufrieden!' : wishOpen(i) ? t.wtext : 'fühlt sich schon richtig wohl.';
  bubbleEl.innerHTML = `<img src="${animalThumbs[i] || ''}" alt=""><span><b>${t.name}</b><br>${status}</span>`;
  bubbleEl.classList.add('show');
  bubbleUntil = clock.elapsedTime + 4.5;
  sfx.pop();
}
const TIPS = [
  'Ein Teppich und eine Lampe machen es richtig gemütlich.',
  'Deko wie Vase oder Teekanne kannst du auf Tisch, Regal oder Schrank stellen — wähle zuerst das Möbel aus!',
  'Mit den Pfeiltasten schiebst du Möbel ganz an die Wand.',
  'Mit Bild-hoch und Bild-runter drehst du Möbel fein.',
];
let tipI = 0;
$('btn-tip').onclick = () => { if (!edit) return;
  const k = edit.k;
  if (k === 'roof') { toast(state.floors === MAXF && wishOpen(MAXF) ? 'Die Frösche warten auf einen Pool!' : 'Lampions, Sonnenschirm und Liegestuhl machen die Dachterrasse fein.'); return; }
  if (!tenantIn(k)) { toast(`Noch ${Math.max(0, 3 - roomOf(k).length)} Sachen einrichten, dann zieht ${TENANTS[k].name} ein!`); return; }
  if (wishOpen(k)) { toast(TENANTS[k].wtext); return; }
  toast(TIPS[tipI++ % TIPS.length]); };

/* ---------- Interaktion ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
/* Wand im 3D antippen (Möbel haben Vorrang, unsichtbare Wände zählen nicht) */
const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
function pickWall() {
  if (!edit || edit.k === 'roof') return null;
  const panels = WALL_KEYS.map(key => floorGroups[edit.k].userData.wallPanels[key]).filter(shown);
  const hits = ray.intersectObjects(panels, false);
  return hits.length ? hits[0].object.userData.wallKey : null;
}
let downX = 0, downY = 0, downT = 0;
renderer.domElement.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; downT = Date.now(); });
renderer.domElement.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8 || Date.now() - downT > 400) return;
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  if (edit) {
    /* Ein Tipp auf ein Tier wählt es aus UND lässt es reden (#39). */
    if (edit.k !== 'roof' && tenantMeshes[edit.k] && tenantMeshes[edit.k].length) {
      const th = ray.intersectObjects(tenantMeshes[edit.k], true);
      if (th.length) { let o = th[0].object; while (o && !(o.userData && o.userData.pick)) o = o.parent;
        if (o) { select(o.userData.pick); tenantTalk(edit.k); return; } }
    }
    const hits = ray.intersectObjects(itemMeshes[edit.k], true);
    if (hits.length) { let o = hits[0].object; while (o && !(o.userData && o.userData.pick)) o = o.parent;
      if (o) { select(o.userData.pick); sfx.pop(); return; } }
    const wallKey = pickWall();
    if (wallKey) { deselect();
      if (catTab === 'farbe') { setWallTarget(wallKey);
        $('catalog').classList.add('open'); sfx.pop();
        toast(`Wand «${WALL_LABELS[wallKey]}» ausgewählt — jetzt eine Tapete antippen.`);
      } else if (catTab === 'wand') { setWallTarget(wallKey);
        $('catalog').classList.add('open'); sfx.pop();
        toast(`Wand «${WALL_LABELS[wallKey]}» ausgewählt — jetzt ein Objekt antippen.`);
      } else { wallTarget = wallKey; }
      return; }
    deselect(); return;
  }
  if (state.cutaway) {
    const tg = []; for (let i = 0; i <= MAXF; i++) if (tenantGroups[i]) tg.push(tenantGroups[i]);
    const th = ray.intersectObjects(tg, true);
    if (th.length) { let o = th[0].object; while (o && !(o.userData && o.userData.type === 'tenant')) o = o.parent;
      if (o) { tenantTalk(o.userData.floor); return; } }
  }
  const hits = ray.intersectObjects([...hitboxes, sign, willi, dam, moki], true);
  for (const h of hits) {
    let o = h.object; while (o && !(o.userData && o.userData.type)) o = o.parent;
    if (!o) continue; const u = o.userData;
    if (u.type === 'sign') { renderResidents(); $('residents').classList.add('open'); return; }
    if (u.type === 'willi') { williTalk(); return; }
    if (u.type === 'dam') { damTalk(); return; }
    if (u.type === 'moki') { mokiTalk(); return; }
    if (u.type === 'roof') { enterEdit('roof'); return; }
    if (u.type === 'floor') { if (u.floor <= state.floors) { enterEdit(u.floor); return; } continue; }
  }
});

$('btn-build').onclick = buildFloor;
$('btn-done').onclick = exitEdit;
$('btn-catalog').onclick = () => {
  if (!edit) { toast('Tippe zuerst auf ein Stockwerk des Turms!'); return; }
  $('catalog').classList.toggle('open'); };
$('btn-catclose').onclick = () => $('catalog').classList.remove('open');
$('btn-extras').onclick = () => $('extras-menu').classList.toggle('open');
$('btn-move').onclick = () => { if (!selected || WALL_ITEMS.has(selected.entry.id)) return;
  /* Tiere kennen keine Möbelzelle — sie springen auf den nächstbesten Punkt
     des Tier-Rasters, der weit genug vom jetzigen Platz entfernt ist (#39). */
  if (selected.tenant) { const en = selected.entry;
    const cands = tenantSpots(selected.k);
    const far = cands.find(c => Math.hypot(c.x - en.x, c.z - en.z) > 0.4) || cands[0];
    en.x = far.x; en.z = far.z;
    clampEntry(selected.k, selected.mesh, en);
    setTenantPos(selected.tenant.floor, selected.tenant.idx, en);
    selHelper.update(); sfx.pop(); return; }
  const c = freeCell(selected.k, selected.entry.cell + 1);
  if (c < 0) { toast('Kein Platz frei!'); return; }
  const en = selected.entry; en.cell = c; const p = cellPos(selected.k, c);
  en.x = p.x; en.z = p.z; en.y = DECO.has(en.id) ? surfaceYAt(selected.k, p.x, p.z, selected.mesh) : baseY(selected.k);
  selected.mesh.position.set(en.x, en.y, en.z);
  selHelper.update(); sfx.pop(); save(); };
$('btn-rot').onclick = () => { if (!selected || WALL_ITEMS.has(selected.entry.id)) return;
  selected.entry.rot += Math.PI / 2;
  selected.mesh.rotation.y = selected.entry.rot;
  clampEntry(selected.k, selected.mesh, selected.entry);
  if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, selected.entry); else save();
  selHelper.update(); sfx.pop(); };
$('btn-del').onclick = () => { if (selected && !selected.tenant) removeItem(selected); };

/* Wandobjekt verschieben: dx entlang der Wand, dy in der Höhe — von Tastatur und Touch-Pad geteilt */
const WALL_STEP = 0.12;
function moveWallItem(pick, dx, dy) {
  const en = pick.entry;
  en.x += dx; en.y = (en.y ?? 1.1) + dy;
  clampEntry(pick.k, pick.mesh, en);
  selHelper.update(); sfx.pop(); save();
}
[['btn-wall-left', -WALL_STEP, 0], ['btn-wall-right', WALL_STEP, 0], ['btn-wall-up', 0, WALL_STEP], ['btn-wall-down', 0, -WALL_STEP]]
  .forEach(([id, dx, dy]) => { $(id).onclick = () => { if (selected && WALL_ITEMS.has(selected.entry.id)) moveWallItem(selected, dx, dy); }; });

/* Tastatur: Pfeile verschieben, Bild-Tasten drehen */
addEventListener('keydown', e => {
  if (!edit || !selected) return;
  const st = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
  const en = selected.entry;
  if (st) { e.preventDefault();
    if (WALL_ITEMS.has(en.id)) { moveWallItem(selected, st[0], -st[1]); return; }
    en.x += st[0]; en.z += st[1];
    clampEntry(selected.k, selected.mesh, en);
    /* Bei einem Tier gehört position.y allein der Wackel-Animation (#39). */
    if (selected.tenant) { setTenantPos(selected.tenant.floor, selected.tenant.idx, en); }
    else { en.y = DECO.has(en.id) ? surfaceYAt(selected.k, en.x, en.z, selected.mesh) : baseY(selected.k);
           selected.mesh.position.y = en.y; save(); }
    selHelper.update(); return; }
  if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault();
    en.rot += (e.key === 'PageUp' ? 1 : -1) * Math.PI / 12;
    selected.mesh.rotation.y = en.rot;
    clampEntry(selected.k, selected.mesh, en);
    if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, en); else save();
    selHelper.update(); return; }
  if (e.key === 'Delete' && !selected.tenant) { e.preventDefault(); removeItem(selected); }
});

/* Mit Willi reden */
const PHRASES = [
  'Ich baue einen Wipfelkratzer — mit Wohnungen für kleine Tiere!',
  'Stock für Stock, bis wir an den Wipfeln kratzen!',
  'Mit Seilen aus Schilf und Gras zurre ich alles fest.',
  'Frau Biber übernimmt den Innenausbau — richtet ihr mit?',
  'Als Nächstes baue ich eine Brücke über den Fluss!',
  'Zur Einweihung gibt es ein Froschkonzert auf dem Dach!',
];
let phraseI = 0, bubbleUntil = 0, bubbleTarget = null, bubbleH = 1.6;
const bubbleEl = $('bubble');
function williTalk() {
  bubbleTarget = willi; bubbleH = 1.6;
  bubbleEl.innerHTML = `<img src="${williThumb}" alt="Willi"><span>${PHRASES[phraseI++ % PHRASES.length]}</span>`;
  bubbleEl.classList.add('show');
  bubbleUntil = clock.elapsedTime + 4;
  buildingUntil = clock.elapsedTime + 1.3;
  sfx.chime();
}
const DAM_TEXTS = [
  'Das ist Willis Biberburg! Viele Wochen hat er daran gearbeitet — alles ist perfekt.',
  'Der Fluss ist gestaut, der Eingang liegt unter Wasser — und drinnen ist alles warm und gemütlich.',
  'Hier wohnt Willi mit Frau Biber. Aber bauen macht ihm am meisten Spass!',
];
let damI = 0;
function damTalk() {
  bubbleTarget = dam; bubbleH = 1.4;
  bubbleEl.innerHTML = `<img src="${damThumb}" alt="Biberburg"><span>${DAM_TEXTS[damI++ % DAM_TEXTS.length]}</span>`;
  bubbleEl.classList.add('show');
  bubbleUntil = clock.elapsedTime + 5;
  sfx.splash();
}
const MOKI_TEXTS = [
  'Ich bin Móki! Ich flitze schneller als Else fliegen kann!',
  'Hast du Haselnüsse? Ich sammle sie für den Winter.',
  'Von ganz oben auf dem Wipfelkratzer sieht man den ganzen Wald!',
  'Psst — nachts leuchten die Fenster so schön.',
];
let mokiI2 = 0;
function mokiTalk() {
  bubbleTarget = moki; bubbleH = 1.1; mokiWait = Math.max(mokiWait, 4);
  bubbleEl.innerHTML = `<img src="${mokiThumb}" alt="Móki"><span><b>Móki</b><br>${MOKI_TEXTS[mokiI2++ % MOKI_TEXTS.length]}</span>`;
  bubbleEl.classList.add('show');
  bubbleUntil = clock.elapsedTime + 4.5;
  sfx.pop();
}

/* ---------- Fotos ---------- */
let photos = [];
try { photos = JSON.parse(localStorage.getItem('wipfelkratzer-fotos') || '[]'); } catch (e) {}
function savePhotos() { try { localStorage.setItem('wipfelkratzer-fotos', JSON.stringify(photos)); } catch (e) { toast('Die Galerie ist voll — lösche ein paar Fotos.'); } }
function takePhoto() {
  renderer.render(scene, camera);
  const src = renderer.domElement, s = Math.min(1, 800 / src.width);
  const c = document.createElement('canvas'); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  photos.unshift({ url: c.toDataURL('image/jpeg', 0.72), text: '', t: Date.now() });
  if (photos.length > 20) photos.length = 20;
  savePhotos();
  const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  sfx.shutter(); toast('Klick! Foto ist in der Galerie.');
}
function photoFilename(p) {
  const dt = new Date(p.t), pad = n => String(n).padStart(2, '0');
  return `wipfelkratzer-${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}.jpg`;
}
function dataUrlToBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* Zwei Fotos in derselben Sekunde ergeben denselben Namen — im Archiv und im
   Share-Sheet muss jeder Name eindeutig sein. */
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
function renderGallery() {
  const grid = $('photo-grid'); grid.innerHTML = '';
  $('btn-download-all').classList.toggle('hidden', !photos.length);
  if (!photos.length) { grid.innerHTML = '<div class="empty">Noch keine Fotos. Drücke unten auf «Foto»!</div>'; return; }
  photos.forEach((p, i) => { const d = document.createElement('div'); d.className = 'photo';
    const dt = new Date(p.t);
    d.innerHTML = `<img src="${p.url}" alt=""><textarea placeholder="Was ist auf dem Foto?">${p.text.replace(/</g, '&lt;')}</textarea><small>${dt.toLocaleDateString('de-CH')} ${dt.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</small><div class="photo-actions"><button class="download">Herunterladen</button><button class="danger">Löschen</button></div>`;
    d.querySelector('textarea').oninput = e => { p.text = e.target.value; savePhotos(); };
    d.querySelector('.download').onclick = () => {
      const a = document.createElement('a');
      a.href = p.url; a.download = photoFilename(p);
      document.body.appendChild(a); a.click(); a.remove();
    };
    d.querySelector('.danger').onclick = () => { photos.splice(i, 1); savePhotos(); renderGallery(); };
    grid.appendChild(d); });
}
async function downloadAllPhotos() {
  if (!photos.length) return;
  const btn = $('btn-download-all');
  btn.disabled = true;
  try {
    const names = uniquePhotoNames(photos);
    const bytes = photos.map(p => dataUrlToBytes(p.url));
    const files = bytes.map((b, i) => new File([b], names[i], { type: 'image/jpeg' }));
    /* iPad/Android: das System-Sheet legt alle Bilder auf einmal in «Fotos» —
       dort gehören sie hin, nicht als Archiv nach «Dateien». */
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
$('btn-photo').onclick = takePhoto;
$('btn-gallery').onclick = () => { $('extras-menu').classList.remove('open'); renderGallery(); $('gallery').classList.add('open'); };
$('btn-galclose').onclick = () => $('gallery').classList.remove('open');
$('gallery').onclick = e => { if (e.target === $('gallery')) $('gallery').classList.remove('open'); };

$('btn-start').onclick = () => { initAudio(); $('intro').classList.add('hidden'); };

/* ---------- Laden ---------- */
Object.keys(state.rooms).forEach(k => {
  const key = k === 'roof' ? 'roof' : parseInt(k, 10);
  roomOf(key).forEach(e => {
    const m = placeItemMesh(key, e);
    if (key === 'roof') clampEntry('roof', m, e);
  });
});
for (let i = 0; i <= MAXF; i++) if (tenantIn(i)) spawnTenant(i, true);
for (let i = 0; i <= MAXF; i++) applyLook(i);
if (migrated) save();
/* Debug-/Testzugriff auf die Szene (Playwright-Checks) */
window.wipfelkratzer = { THREE, state, floorGroups, roofG, roofStairG, roofGapG, scene, camera, controls, WALL_KEYS, get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; },
  itemMeshes, tenantMeshes, tenantGroups, tenantSpot, tenantSpots, setTenantPos, select, deselect, get selected() { return selected; },
  photoTools: { photoFilename, uniquePhotoNames, dataUrlToBytes, photoZipFilename } };
applyNight(state.night ? 1 : 0);
applyFronts();
makeThumbs();
renderWishes(); renderResidents(); updateHUD();

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt;
    let k = Math.min(tw.t / tw.dur, 1); k = k * k * (3 - 2 * k);
    tw.step(k); if (tw.t >= tw.dur) { tweens.splice(i, 1); if (tw.done) tw.done(); } }
  const mr = 10 + state.floors * 0.4, ma = t * 0.3;
  const mh = topY() + 2.6 + Math.sin(t * 0.7) * 0.4;
  const nx = Math.cos(ma + 0.08) * mr, nz = Math.sin(ma + 0.08) * mr;
  magpie.position.set(Math.cos(ma) * mr, mh, Math.sin(ma) * mr);
  magpie.lookAt(nx, mh, nz);
  magInner.userData.wings.forEach((w, i) => w.rotation.x = Math.sin(t * 9 + i) * 0.55);
  critters.forEach(c => { c.g.position.y = c.base + Math.abs(Math.sin(t * 2.2 + c.ph)) * 0.03; });
  /* Der Auswahlrahmen misst sich nur auf update() neu — beim wackelnden Tier
     stünde er sonst daneben. */
  if (selHelper && selected && selected.tenant) selHelper.update();
  dancers.forEach(d => { d.g.position.y = 0.18 + Math.abs(Math.sin(t * 4.5 + d.ph)) * 0.22;
    d.g.rotation.y += dt * (0.8 + (d.ph % 3) * 0.5); });
  spinners.forEach(w => w.rotation.z += dt * 2.4);
  willi.position.y = Math.abs(Math.sin(t * 1.6)) * 0.03;
  { const tgt = MOKI_WP[mokiI]; const dxm = tgt.x - moki.position.x, dzm = tgt.z - moki.position.z, dist = Math.hypot(dxm, dzm);
    if (mokiWait > 0) { mokiWait -= dt; moki.position.y = 0; if (mokiWait <= 0) mokiI = (mokiI + 1) % MOKI_WP.length; }
    else if (dist < 0.1) { mokiWait = 1.5 + Math.random() * 2.5; moki.rotation.y = Math.atan2(-moki.position.x, -moki.position.z); }
    else { const sp = Math.min(dist, 2.6 * dt); moki.position.x += dxm / dist * sp; moki.position.z += dzm / dist * sp;
      moki.rotation.y = Math.atan2(dxm, dzm); moki.position.y = Math.abs(Math.sin(t * 11)) * 0.14; } }
  const arm = willi.userData.arm;
  arm.rotation.z = t < buildingUntil ? Math.sin(t * 16) * 0.7 - 0.3 : Math.sin(t * 1.6) * 0.06;
  if (bubbleEl.classList.contains('show')) {
    if (t > bubbleUntil) bubbleEl.classList.remove('show');
    else { const v = new THREE.Vector3(); (bubbleTarget || willi).getWorldPosition(v); v.y += bubbleH; v.project(camera);
      bubbleEl.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
      bubbleEl.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px'; }
  }
  if (party) partyG.children.forEach((c, i) => { c.material === MAT.glow && (c.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.18)); });
  controls.update();
  renderer.render(scene, camera);
}
tick();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  if (edit) { const { eye, tgt } = editCamFor(edit.k); camera.position.copy(eye); controls.target.copy(tgt); } });
