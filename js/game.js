import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAT, SEASONS, LEAVES, CATALOG, CATS, WALL_ITEMS, WALLS, FLOORS, FURN_COLORS, TINTABLE,
  BUILD_SHAPES, BUILD_WIDTHS, BUILD_MAX, BUILD_MAX_H, DESIGN_MAX, normalizeBuild,
  makeCustomFurniture, lookCanvas, lookTexture, makeFurniture, makeAnimal, makeWilli,
  makeTree, makeTallTree, makeMagpie, makeSign, makeDam, makeBridge } from './models.js';
import { zipStore } from './zip.js';
import * as staende from './staende.js';
import { baueDatei, dateiName, pruefeDatei, MAX_DATEI } from './standdatei.js';

/* ---------- Konstanten ---------- */
const PLAT_Y = 2.2, E_H = 2.4, FLOOR_H = 2.0;
const H = i => i === 0 ? E_H : FLOOR_H;
const floorY = i => i === 0 ? PLAT_Y : PLAT_Y + E_H + (i - 1) * FLOOR_H;
const topY = () => PLAT_Y + E_H + state.floors * FLOOR_H;
const ROOF_W = 6.6, ROOF_D = 4.8;
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const POOL_TRIPS = 3;
const poolFill = en => en.fill === undefined ? 1
  : Math.max(0, Math.min(POOL_TRIPS, en.fill | 0)) / POOL_TRIPS;
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
/* Ab Etage 10 gibt es keine handgeschriebenen Bewohner mehr. Sie werden aus
   vier Töpfen zusammengesetzt und mit demselben Hash ausgewürfelt, der schon
   Etagenversatz und Baumpositionen bestimmt (rnd, #47). Damit liefert
   dieselbe Etage bei jedem Laden dieselbe Familie, ohne dass etwas
   gespeichert werden muss. */
const SURNAMES = ['Tannenzapfen', 'Moosbart', 'Farnkraut', 'Beerenbusch', 'Haselstrauch',
  'Ahornblatt', 'Kiefernzweig', 'Wurzelholz', 'Rindenstück', 'Eichelhut',
  'Brombeer', 'Löwenzahn', 'Klee', 'Birkenrinde', 'Fichtennadel',
  'Wiesenschaum', 'Waldmeister', 'Sauerklee', 'Heidelbeer', 'Buchenkeim'];
const FIRSTNAMES = ['Fritzi', 'Mira', 'Bosco', 'Lenni', 'Paula', 'Tuula', 'Nando',
  'Smilla', 'Kuno', 'Ronja', 'Emil', 'Frida', 'Otto', 'Nelli', 'Karlo', 'Juna'];
const TENANT_SPECIES = ['maus', 'haselmaus', 'hamster', 'frosch', 'eidechse',
  'maulwurf', 'siebenschlaefer', 'wiesel', 'eichhoernchen'];
/* Wunsch samt Akkusativform, damit der Satz stimmt. Nur Gegenstände, die in
   einer Wohnung stehen können — nichts aus der Kategorie «dach». */
const TENANT_WISHES = [
  { id: 'bett', txt: 'ein kuschliges Bett' },
  { id: 'etagenbett', txt: 'ein Etagenbett' },
  { id: 'sofa', txt: 'ein weiches Sofa' },
  { id: 'tisch', txt: 'einen grossen Tisch' },
  { id: 'schrank', txt: 'einen Schrank' },
  { id: 'regal', txt: 'ein Bücherregal' },
  { id: 'ofen', txt: 'einen warmen Ofen' },
  { id: 'teppich', txt: 'einen weichen Teppich' },
  { id: 'lampe', txt: 'eine Lampe' },
  { id: 'badewanne', txt: 'eine Badewanne' },
  { id: 'pflanze', txt: 'eine Pflanze' },
  { id: 'bild', txt: 'ein Blumenbild' },
  { id: 'schaukelstuhl', txt: 'einen Schaukelstuhl' },
  { id: 'klavier', txt: 'ein Klavier' },
  { id: 'hamsterrad', txt: 'ein Hamsterrad' },
  { id: 'nusskiste', txt: 'eine Nusskiste' },
];
/* Haushaltsform: wie der Name gebaut wird, wie viele Tiere einziehen und ob
   der Wunschsatz im Singular oder Plural steht. */
const HOUSEHOLDS = [
  { make: (f, s) => `Familie ${s}`, n: 2, plural: true },
  { make: (f, s) => `Oma und Opa ${s}`, n: 2, plural: true },
  { make: (f, s) => `${f} ${s}`, n: 1, plural: false },
  { make: (f, s) => `Die Geschwister ${s}`, n: 2, plural: true },
];
const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
function madeTenant(i) {
  const hh = pick(HOUSEHOLDS, rnd(i * 3 + 501));
  const name = hh.make(pick(FIRSTNAMES, rnd(i * 3 + 502)), pick(SURNAMES, rnd(i * 3 + 503)));
  const sp = pick(TENANT_SPECIES, rnd(i * 3 + 504));
  const w = pick(TENANT_WISHES, rnd(i * 3 + 505));
  return { name, animals: Array.from({ length: hh.n }, () => sp), wish: w.id,
    wtext: `${name} ${hh.plural ? 'wünschen' : 'wünscht'} sich ${w.txt}.` };
}
/* Etage 0 und die oberste Etage sind gesetzt: unten der Kindergarten, oben die
   Frösche, deren Wunsch (roofWish) auf die Dachterrasse zeigt und an dem der
   Party-Knopf hängt. Dazwischen so viele handgeschriebene wie da sind, danach
   erzeugte. */
const TENANT_CACHE = {};
function tenantOf(i) {
  if (TENANT_CACHE[i]) return TENANT_CACHE[i];
  const t = i === MAXF ? TENANTS[TENANTS.length - 1]
    : i < TENANTS.length - 1 ? TENANTS[i]
    : madeTenant(i);
  TENANT_CACHE[i] = t; return t;
}

/* ---------- Zustand ---------- */
/* tenantPos: von Hand gesetzte Tierplätze pro Stockwerk; fehlt der Eintrag,
   platziert tenantSpot automatisch (#14). */
let state = { floors: 0, rooms: {}, nuts: 0, bridge: false, garden: false, night: false, season: 'sommer', cutaway: false, fulfilled: {}, wallpaper: {}, flooring: {}, tenantPos: {}, maxFloors: 10, designs: [] };
/* Welcher Turm gerade gespielt wird, entscheidet die Slot-Ebene. Ein Wechsel
   lädt die Seite neu, deshalb genügt es, den Eintrag einmal beim Start zu holen. */
const STAND = staende.aktiverStand();
/* Nur ein leerer Turm zeigt die Höhenwahl (#47) — sobald der Slot einen
   Spielstand hat, auch einen mit floors: 0 direkt nach der Wahl, bleibt die
   Höhe wie gewählt und der Startbildschirm zeigt nur noch «Los geht's!». */
let hasSave = false;
try { const s = localStorage.getItem(STAND.standKey); if (s) { state = Object.assign(state, JSON.parse(s)); hasSave = true; } } catch (e) {}
/* Turmhöhe: einmal pro Spielstand gewählt, danach konstant (#47). Ein
   fremder oder fehlender Wert fällt auf den klassischen Zehner-Turm zurück. */
const TOWER_CHOICES = [10, 20, 50];
const MAXF = TOWER_CHOICES.includes(state.maxFloors) ? state.maxFloors : 10;
state.maxFloors = MAXF;

/* Der Turm verjüngt sich vom Erdgeschoss bis zur obersten Etage immer auf
   dasselbe Endmass — egal ob er zehn, zwanzig oder fünfzig Stockwerke hoch
   ist. Bei MAXF = 10 ergeben die Schritte exakt die früheren Festwerte 0.3
   und 0.12. */
const W_TOP = 4.9, D_TOP = 3.92;
const W_STEP = (7.6 - W_TOP) / (MAXF - 1), D_STEP = (5.0 - D_TOP) / (MAXF - 1);
const W = i => i === 0 ? 8.6 : 7.6 - (i - 1) * W_STEP;
const D = i => i === 0 ? 5.6 : 5.0 - (i - 1) * D_STEP;

/* Die Szene war auf einen Zehner-Turm eingerichtet. Kamera, Nebel, Sterne und
   Mond wachsen mit derselben Höhe mit. Bei MAXF = 10 ist HSCALE = 1 und alle
   abgeleiteten Werte bleiben exakt die alten. */
const TOWER_TOP = PLAT_Y + E_H + MAXF * FLOOR_H;
const REF_TOP = PLAT_Y + E_H + 10 * FLOOR_H;
const HSCALE = Math.max(1, TOWER_TOP / REF_TOP);

let saveT = 0;
const schreibeStand = () => { try {
  const wallpaper = {};
  for (const k in state.wallpaper) { const wp = state.wallpaper[k]; if (wp && typeof wp === 'object' && Object.keys(wp).length) wallpaper[k] = wp; }
  localStorage.setItem(STAND.standKey, JSON.stringify({ ...state, wallpaper }));
} catch (e) {} };
const save = () => { clearTimeout(saveT); saveT = setTimeout(schreibeStand, 300); };
/* Netz für Wege aus der Seite, die keine eigene Navigation sind — Zurück-Taste,
   Tab schliessen, Wechsel in den bfcache. pagehide statt beforeunload: Letzteres
   ist auf mobilen Browsern unzuverlässig und bfcache-feindlich (#46). */
addEventListener('pagehide', schreibeStand);
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
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 200 * HSCALE);
camera.position.set(13, PLAT_Y + 7, 18);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, PLAT_Y + 2.8, 0);
controls.enableDamping = true; controls.dampingFactor = 0.09; controls.enablePan = false;
controls.minDistance = 4; controls.maxDistance = 44 * HSCALE; controls.maxPolarAngle = 1.52; controls.minPolarAngle = 0.12;

const hemi = new THREE.HemisphereLight(0xfff4da, 0x9dbb7a, 1.05); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffe8c0, 1.15); dir.position.set(14, 22, 10);
dir.castShadow = true; dir.shadow.mapSize.set(1024, 1024);
Object.assign(dir.shadow.camera, { left: -20, right: 20, top: 32, bottom: -6, far: 90 });
scene.add(dir);

const SKY = { d: new THREE.Color(0xcfe3c2), n: new THREE.Color(0x18294e) };
const HEMI = { d: new THREE.Color(0xfff4da), n: new THREE.Color(0x2a3a66) };
const GRND = { d: new THREE.Color(0x9dbb7a), n: new THREE.Color(0x1c2a3a) };
scene.background = SKY.d.clone();
scene.fog = new THREE.Fog(SKY.d.clone(), 45 * HSCALE, 110 * HSCALE);

/* Sterne + Mond */
const starGeo = new THREE.BufferGeometry();
{ const p = []; for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 30) * HSCALE, y = (8 + Math.random() * 45) * HSCALE; p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const starMat = new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.35, transparent: true, opacity: 0 });
const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0 });
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6 * HSCALE, 20, 14), moonMat); moon.position.set(-24 * HSCALE, 30 * HSCALE, -30 * HSCALE); scene.add(moon);

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
/* Eigene Instanzen statt MAT.water: der Bach friert im Winter zu, das
   Badewasser, die Teekanne und der Dachpool aber nicht (#50). Die Startfarben
   sind identisch mit heute. */
const riverSandMat = new THREE.MeshLambertMaterial({ color: 0xc9b083 });
const riverWaterMat = new THREE.MeshLambertMaterial({ color: 0x5aa7c7 });
const riverFoamMat = new THREE.MeshLambertMaterial({ color: 0x7fc4dd });
ribbon(5.6, 0.02, riverSandMat);
/* Das breite Wasserband ist die Trefferfläche des Bachs (#46) — nicht das
   Sandufer darunter und nicht der helle Streifen darüber, der zwar höher
   liegt, aber nicht in der Pickliste steht und deshalb nichts abschirmt. */
const river = ribbon(3.6, 0.045, riverWaterMat);
river.userData.type = 'bach';
ribbon(1.5, 0.06, riverFoamMat);
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
const MAGPIE_DUR = { holen: 3.2, schoepfen: 1.0, bringen: 3.6, giessen: 1.2 };
const SCOOP = { x: -3.4, y: 0.75, cruiseY: 3.2 };
let magPhase = 'kreis', magT = 0, magCurve = null, magFrom = null, magTarget = null;
let magOffset = 0, magToast = false, magPoured = false;
const bridge = makeBridge(5.6); bridge.position.set(8.7, 0.08, riverZ(8.7)); bridge.rotation.y = Math.PI / 2; bridge.visible = state.bridge; scene.add(bridge);

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

/* Eine Etagengruppe entsteht erst, wenn sie gebraucht wird — beim Bauen oder
   beim Laden eines Spielstands, der sie schon enthält. Bei fünfzig
   Stockwerken bliebe ein Turm, der beim Start alle auf einmal anlegt, sonst
   kein Selbstläufer (#47). */
function makeFloor(i) {
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
  /* Über dem Ausschnitt der Schattenkamera (top: 32) landet ohnehin nichts
     mehr in der Schattenkarte — dort spart der Verzicht auf castShadow den
     zweiten Zeichendurchgang. */
  if (floorY(i) > 30) g.traverse(o => { o.castShadow = false; });
  towerG.add(g); floorGroups[i] = g;
  itemMeshes[i] = []; tenantMeshes[i] = []; tenantGroups[i] = null;
  return g;
}
function floorGroup(i) { return floorGroups[i] || makeFloor(i); }
makeFloor(0);
itemMeshes.roof = [];

/* Spielplatz. Die Gruppe steht bewusst unrotiert: die Spielfläche ist dadurch
   achsenparallel und direkt mit riverZ(), der baumfreien Lichtung (Radius 5.5
   um (-8, 2), siehe Baumschleifen oben) und dem Turmsockel vergleichbar. Die
   alte Gruppendrehung von 0.5 steckt jetzt in den Startwerten der Objekte
   (GARDEN_DEFAULT, weiter unten). */
const GARDEN_POS = new THREE.Vector3(-8, 0, 2);
const GARDEN_W = 5.4, GARDEN_D = 5.0;
const gartenG = new THREE.Group();
gartenG.position.copy(GARDEN_POS); gartenG.visible = state.garden;
gartenG.userData.type = 'garten'; scene.add(gartenG);
/* Unsichtbarer Antipp-Körper über der ganzen Fläche — dasselbe Muster wie die
   Etagen- und Dach-Hitboxen. */
{ const gh = new THREE.Mesh(new THREE.BoxGeometry(GARDEN_W, 1.6, GARDEN_D),
    new THREE.MeshBasicMaterial({ visible: false }));
  gh.position.y = 0.8; gh.userData = { type: 'garten' }; gartenG.add(gh); hitboxes.push(gh); }
/* Holzkante, die beim Einrichten zeigt, wie weit der Spielplatz reicht. */
const gardenEdge = new THREE.Group(); gardenEdge.visible = false; gartenG.add(gardenEdge);
[[GARDEN_W, 0.06, 0, GARDEN_D / 2], [GARDEN_W, 0.06, 0, -GARDEN_D / 2],
 [0.06, GARDEN_D, GARDEN_W / 2, 0], [0.06, GARDEN_D, -GARDEN_W / 2, 0]]
  .forEach(([bw, bd, px, pz]) => {
    const e = mesh(new THREE.BoxGeometry(bw, 0.06, bd), MAT.woodL, px, 0.03, pz, gardenEdge);
    e.castShadow = false; });
itemMeshes.garten = [];

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
const dims = k => k === 'roof' ? { w: ROOF_W - 0.7, d: ROOF_D - 0.9 }
  : k === 'garten' ? { w: GARDEN_W - 0.7, d: GARDEN_D - 0.9 }
  : { w: W(k) - 0.7, d: D(k) - 1.0 };
const colsOf = k => Math.max(3, Math.floor(dims(k).w / 0.95));
function cellPos(k, cell) { const { w, d } = dims(k); const cols = colsOf(k);
  const col = cell % cols, row = Math.floor(cell / cols);
  return { x: -w / 2 + (col + 0.5) * (w / cols), z: -d / 2 + (row + 0.5) * (d / 2) }; }
function parentOf(k) { return k === 'roof' ? roofG : k === 'garten' ? gartenG : floorGroup(k); }
function baseY(k) { return k === 'roof' ? ROOF_DECK_T : k === 'garten' ? 0 : 0.155; }

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
/* Farbe pro Möbel. Alte Stände haben hier nichts — das ist gültig und heisst
   «Standardfarbe». Ein unbekannter Wert oder eine Farbe an einem nicht
   einfärbbaren Möbel wird still entfernt (wie die Tapeten-Migration). */
function normalizeColor(en) {
  if (!en.color) return;
  if (!TINTABLE.has(en.id) || !FURN_COLORS.some(c => c.id === en.color)) { delete en.color; migrated = true; }
}
/* Eigenbauten prüfen, bevor sie gebaut werden. Ein Bauplan ist Fremdeingabe:
   von Hand verändert, aus einer älteren Version, aus einer entfernten Form.
   Ungültige Einträge verschwinden still, gekürzte werden ersetzt — und der
   bereinigte Stand wird wie bei der Tapeten-Migration einmalig
   zurückgeschrieben. */
function sanitizeRoom(key) {
  const arr = roomOf(key);
  for (let i = arr.length - 1; i >= 0; i--) {
    const en = arr[i]; if (en.id !== 'eigenbau') continue;
    const b = normalizeBuild(en.build);
    if (!b) { arr.splice(i, 1); migrated = true; continue; }
    if (JSON.stringify(b) !== JSON.stringify(en.build)) { en.build = b; migrated = true; }
  }
}
/* Gespeicherte Entwürfe durch dieselbe Prüfung schicken. */
function sanitizeDesigns() {
  if (!Array.isArray(state.designs)) { state.designs = []; return; }
  const before = JSON.stringify(state.designs);
  state.designs = state.designs
    .map(d => { const b = normalizeBuild(d); return b ? { name: String(d.name || 'Eigenbau'), parts: b.parts } : null; })
    .filter(Boolean).slice(0, DESIGN_MAX);
  if (JSON.stringify(state.designs) !== before) migrated = true;
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
    if (!floorGroups[i]) continue;
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
const SURFACES = ['tisch', 'regal', 'schrank', 'klavier', 'nusskiste', 'kommode', 'wk_regal', 'wk_tisch'];
function clampEntry(k, m, en) {
  if (WALL_ITEMS.has(en.id)) {
    en.wall = en.wall || 'back';
    const pl = wallPlacement(k, en.wall), hh = H(k);
    en.x = Math.max(-pl.half, Math.min(pl.half, en.x));
    en.y = Math.max(0.45, Math.min(hh - 0.55, en.y ?? 1.1));
    en.rot = pl.rot;
    const pos = { x: 0, z: 0 }; pos[pl.fixedAxis] = pl.fixed; pos[pl.freeAxis] = en.x; en.z = pos.z;
    m.position.set(pos.x, en.y, pos.z); m.rotation.y = pl.rot; return; }
  if (k === 'garten') {
    /* Draussen gibt es keine Wände. Begrenzt wird die Lichtung selbst: das
       Rechteck ist so gewählt, dass es ausserhalb des Wassers (riverZ minus
       Wasserhalbbreite), innerhalb der baumfreien Lichtung (Radius 5.5 um
       (-8, 2)) und neben dem Turmsockel liegt (siehe GARDEN_W/GARDEN_D oben).
       Die Box3 einiger Objekte (z.B. der Rutsche) liegt nicht symmetrisch um
       ihren Ursprung — deshalb wird mit dem Abstand von der Position zu den
       Kanten gerechnet statt mit einer halben Breite/Tiefe. gartenG ist nie
       gedreht, darum ist der Weltversatz zu GARDEN_POS gleich dem lokalen.
       Vor dem ersten Rendern (z.B. beim Laden) ist gartenG.matrixWorld noch
       nicht mit GARDEN_POS verrechnet — Box3.setFromObject aktualisiert nur
       die Matrix von m selbst, nicht die seiner Vorfahren. */
    m.updateWorldMatrix(true, false);
    const bbG = new THREE.Box3().setFromObject(m);
    const offMinX = bbG.min.x - GARDEN_POS.x - en.x, offMaxX = bbG.max.x - GARDEN_POS.x - en.x;
    const offMinZ = bbG.min.z - GARDEN_POS.z - en.z, offMaxZ = bbG.max.z - GARDEN_POS.z - en.z;
    const loX = Math.min(-GARDEN_W / 2 - offMinX, GARDEN_W / 2 - offMaxX);
    const hiX = Math.max(-GARDEN_W / 2 - offMinX, GARDEN_W / 2 - offMaxX);
    const loZ = Math.min(-GARDEN_D / 2 - offMinZ, GARDEN_D / 2 - offMaxZ);
    const hiZ = Math.max(-GARDEN_D / 2 - offMinZ, GARDEN_D / 2 - offMaxZ);
    en.x = Math.max(loX, Math.min(hiX, en.x));
    en.z = Math.max(loZ, Math.min(hiZ, en.z));
    en.y = 0;
    m.position.set(en.x, 0, en.z);
    return;
  }
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
/* ---------- Kollision zwischen Möbeln und Tieren (Issue #40) ---------- */
/* Flache Dinge sind begehbar: ein Tier darf auf dem Teppich stehen
   (js/models.js:101-105, Höhe ~0.035). */
const SOLID_H = 0.12;
function solidBoxes(k, exclude) {
  const out = [];
  itemMeshes[k].forEach(m => {
    if (m === exclude) return;
    const id = m.userData.pick.entry.id;
    if (DECO.has(id) || WALL_ITEMS.has(id)) return;
    const bb = new THREE.Box3().setFromObject(m);
    if (bb.max.y - bb.min.y < SOLID_H) return;
    out.push(bb);
  });
  return out;
}
/* Berühren ist erlaubt: PAD verkleinert beide Boxen leicht, damit ein Tier
   dicht an der Sofakante stehen darf. Rein x/z, weil die Wackel-Animation
   position.y jeden Frame verändert (Render-Schleife) — eine y-Bedingung
   würde flackern. */
const COLL_PAD = 0.04;
const overlapsXZ = (a, b) =>
  a.min.x + COLL_PAD < b.max.x - COLL_PAD && a.max.x - COLL_PAD > b.min.x + COLL_PAD &&
  a.min.z + COLL_PAD < b.max.z - COLL_PAD && a.max.z - COLL_PAD > b.min.z + COLL_PAD;
/* Steckt das Tier an seinem aktuellen Platz in einem Möbel? */
function tenantBlocked(pick) {
  const ab = new THREE.Box3().setFromObject(pick.mesh);
  return solidBoxes(pick.k).some(bb => overlapsXZ(ab, bb));
}
/* Mesh aus dem entry neu setzen. Bei einem Tier bleibt position.y in der
   Hoheit der Wackel-Animation (Render-Schleife). */
function replaceMesh(pick) {
  const en = pick.entry;
  if (pick.tenant) { pick.mesh.position.x = en.x; pick.mesh.position.z = en.z; }
  else pick.mesh.position.set(en.x, en.y ?? baseY(pick.k), en.z);
  pick.mesh.rotation.y = en.rot ?? 0;
  clampEntry(pick.k, pick.mesh, en);
  if (selHelper && selected === pick) selHelper.update();
}
/* Der Ablehnungspfad meldet sich nicht mehr selbst: wer die Geste kennt,
   entscheidet, ob und wie oft gemeldet wird. Ein gezogenes Objekt stösst
   pro Mausbewegung an und würde sonst 60× pro Sekunde klopfen (#64). */
let blockGrund = null;
function meldeBlockade() {
  sfx.knock();
  if (blockGrund) toast(blockGrund);
  blockGrund = null;
}
/* Führt eine Bewegung aus und räumt danach die Kollisionen auf.
   Rückgabe: true, wenn der Zug Bestand hat. */
function applyMove(pick, mutate) {
  const en = pick.entry;
  const snap = { x: en.x, z: en.z, y: en.y, rot: en.rot, wall: en.wall };
  mutate();
  const ok = pick.tenant ? resolveTenantMove(pick) : resolveItemMove(pick);
  if (!ok) { Object.assign(en, snap); replaceMesh(pick); }
  return ok;
}
function resolveTenantMove(pick) { return !tenantBlocked(pick); }
/* ---------- Schaltbare Objekte (Issue #41) ---------- */
/* Der Zustand ist ein einziges Feld `on` am Eintrag in state.rooms. Fehlt es,
   greift DEFAULT_ON — und DEFAULT_ON bildet exakt das Aussehen ab, das die
   Modelle vor dieser Änderung hatten. Ein alter Spielstand sieht damit gleich
   aus wie vorher und wird beim Laden NICHT umgeschrieben (anders als bei der
   Tapete, wallpaperOf oben — dort änderte sich die Form des Werts, hier fehlt
   nur ein Feld mit wohldefinierter Vorgabe). */
const DEFAULT_ON = { lampe: true, badewanne: true, fenster: false };
const isOn = en => en.on === undefined ? !!DEFAULT_ON[en.id] : en.on;

const BULB_ON = 0xffd98a, BULB_OFF = 0xcfc0a4, SHADE_ON = 0x3a2408;
function applyLampe(m, on, q) {
  const bulb = m.userData.bulb, shade = m.userData.shade;
  if (!bulb) return;
  const f = on ? q : 1 - q;   /* 0 = aus, 1 = an */
  bulb.material.color.setHex(f > 0.5 ? BULB_ON : BULB_OFF);
  /* Bei Nacht deutlich heller als bei Tag — das ist der Ersatz für eine
     echte Lichtquelle pro Lampe (Spec A5). */
  bulb.material.emissiveIntensity = f * (0.5 + 0.5 * nightK);
  if (shade) shade.material.emissive.setHex(f > 0.5 ? SHADE_ON : 0x000000);
}
function applyWanne(m, on, q) {
  const w = m.userData.water; if (!w) return;
  const f = on ? q : 1 - q;
  w.scale.y = 0.05 + 0.95 * f;
  w.position.y = 0.115 + 0.305 * f;
  w.visible = f > 0.02;
}
const SASH_OPEN = -0.45;
function applyFenster(m, on, q) {
  const s = m.userData.sash; if (!s) return;
  s.rotation.x = SASH_OPEN * (on ? q : 1 - q);
}

/* Registry der Objekte, die etwas tun.
   - Eintrag MIT `apply` trägt einen Zustand (Feld `on` im Spielstand).
   - Eintrag OHNE `apply`, nur mit `label` + `sound`, ist ein reiner Auslöser.
     Das ist der Fall, den die Instrumente aus Issue #36 brauchen: Tipp -> Ton,
     kein Zustand, kein save(). Ein Instrument kostet dann genau eine Zeile
     hier plus einen sfx-Effekt. */
const ACTIONS = {
  lampe:     { doOn: 'Licht an',     doOff: 'Licht aus',    apply: applyLampe,   sound: () => sfx.click() },
  fenster:   { doOn: 'Fenster auf',  doOff: 'Fenster zu',   apply: applyFenster, sound: () => sfx.creak() },
  badewanne: { doOn: 'Wanne füllen', doOff: 'Wanne leeren', apply: applyWanne,   sound: on => on ? sfx.fill() : sfx.drain() },
};
const actionLabel = en => { const a = ACTIONS[en.id]; if (!a) return null;
  return a.label || (isOn(en) ? a.doOff : a.doOn); };
/* animate === false: Endzustand sofort setzen (beim Aufbau aus dem Spielstand). */
function applyItemState(m, animate) {
  const en = m.userData.pick.entry, a = ACTIONS[en.id];
  if (!a || !a.apply) return;
  const on = isOn(en);
  if (animate === false) { a.apply(m, on, 1); return; }
  tween(0.7, q => a.apply(m, on, q));
}

function placeItemMesh(k, entry) {
  normalizeColor(entry);
  if (entry.x === undefined) { const p = cellPos(k, entry.cell || 0); entry.x = p.x; entry.z = p.z; entry.rot = (entry.rot || 0) * Math.PI / 2; }
  /* Zwei Wege zu einem Möbel-Mesh: Katalog-id oder Bauplan (Schreinerei). */
  const m = entry.id === 'eigenbau' ? makeCustomFurniture(entry.build) : makeFurniture(entry.id, entry.color);
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
  if (m.userData.setFill) m.userData.setFill(poolFill(entry));
  applyItemState(m, false);
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
/* Dasselbe für die Besuchsleiste: sie steht auf derselben Höhe wie #selbar, und
   ohne diese Zahl legen sich die Meldungen darüber (#44). */
(() => { const bb = $('besuchbar');
  const sync = () => document.documentElement.style.setProperty('--besuchbar-h', bb.offsetHeight + 'px');
  new ResizeObserver(sync).observe(bb); sync(); })();
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
  beschrifteExtras();
}

/* ---------- Katalog ---------- */
let thumbs = {}; const animalThumbs = {}; let williThumb = '', damThumb = '', mokiThumb = '';
/* Ein einziger, dauerhafter Vorschau-Renderer. Er wird nicht verworfen
   (früher r2.dispose()), weil die Schreinerei zur Laufzeit Bilder braucht —
   bei jedem Tipp eines. Browser begrenzen die Zahl gleichzeitiger
   WebGL-Kontexte hart, also genau einer für alle Vorschaubilder. */
let thumbR = null, thumbS = null, thumbC = null;
function snapshot(o, fx, fy, fz) {
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ alpha: true, antialias: true }); thumbR.setSize(160, 160);
    thumbS = new THREE.Scene();
    thumbS.add(new THREE.HemisphereLight(0xfff4da, 0xbfae90, 1.4));
    const d2 = new THREE.DirectionalLight(0xffffff, 1.6); d2.position.set(2, 4, 3); thumbS.add(d2);
    thumbC = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
  }
  thumbS.add(o);
  const bb = new THREE.Box3().setFromObject(o);
  const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
  const md = Math.max(size.x, size.y, size.z) || 1;
  thumbC.position.set(ctr.x + md * fx, ctr.y + md * fy, ctr.z + md * fz); thumbC.lookAt(ctr);
  thumbR.render(thumbS, thumbC);
  const url = thumbR.domElement.toDataURL(); thumbS.remove(o); return url;
}
/* Vorschaubild eines Bauplans, gecacht über den Bauplan selbst: in der
   Werkstatt ändert sich pro Tipp genau ein Feld, und der Cache trägt die
   vorherigen Zustände ohne Neurendern. */
const designThumbs = new Map();
function designThumb(build) {
  const key = JSON.stringify(build.parts || []);
  if (!designThumbs.has(key)) designThumbs.set(key, snapshot(makeCustomFurniture(build), 1.15, 0.85, 1.35));
  return designThumbs.get(key);
}
function makeThumbs() {
  CATALOG.forEach(it => { thumbs[it.id] = snapshot(makeFurniture(it.id), 1.15, 0.85, 1.35); });
  /* Ein Bild pro Tierkombination statt pro Etage — bei fünfzig Stockwerken
     kommen dieselben paar Tierarten mehrfach vor, das spart WebGL-Rendergänge
     beim Start (#47). */
  const thumbByKey = {};
  for (let i = 0; i <= MAXF; i++) { const t = tenantOf(i);
    const key = t.animals.join('+');
    if (!thumbByKey[key]) { const o = new THREE.Group();
      t.animals.forEach((sp, n) => { const a = makeAnimal(sp);
        a.position.x = (n - (t.animals.length - 1) / 2) * 0.52; a.rotation.y = (n - 0.5) * -0.5; o.add(a); });
      thumbByKey[key] = snapshot(o, 0.4, 0.55, 1.5); }
    animalThumbs[i] = thumbByKey[key]; }
  { const wg = makeWilli(); williThumb = snapshot(wg, 0.5, 0.7, 1.4); }
  { const dg = makeDam(); damThumb = snapshot(dg, 0.8, 0.8, 1.2); }
  { const mg = makeAnimal('eichhoernchen'); mokiThumb = snapshot(mg, 0.4, 0.55, 1.5); }
}
function renderCatalog() {
  const roof = edit && edit.k === 'roof';
  const garten = edit && edit.k === 'garten';
  const tabs = $('catalog-tabs'); tabs.innerHTML = '';
  const avail = CATS.filter(([id]) => garten ? id === 'garten' : roof ? id === 'dach' : (id !== 'dach' && id !== 'garten'));
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
  if (catTab === 'eigenbau') {
    const neu = document.createElement('div'); neu.className = 'item look';
    neu.innerHTML = `<i class="none"></i><span>Neu bauen</span>`;
    neu.onclick = openWorkshop; wrap.appendChild(neu);
    state.designs.forEach((d, i) => {
      const el = document.createElement('div'); el.className = 'item design';
      el.innerHTML = `<img src="${designThumb(d)}" alt=""><span>${d.name}</span>`
        + `<button class="del" aria-label="${d.name} löschen">×</button>`;
      el.onclick = e => { if (e.target.closest('button.del')) deleteDesign(i); else addItem('eigenbau', d); };
      wrap.appendChild(el); });
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
/* Löschen braucht zwei Tipps. Gelöscht wird nur der Entwurf; bereits
   aufgestellte Möbel tragen ihren eigenen Bauplan und bleiben stehen. */
let delArmed = -1, delArmedAt = 0;
function deleteDesign(i) {
  if (delArmed === i && Date.now() - delArmedAt < 4000) {
    state.designs.splice(i, 1); delArmed = -1; sfx.knock(); save(); renderCatalog(); return; }
  delArmed = i; delArmedAt = Date.now();
  toast(`«${state.designs[i].name}» wirklich löschen? Tippe nochmal auf das ×. Schon aufgestellte Möbel bleiben stehen.`);
}

/* ---------- Werkstatt ----------
   Der Entwurf lebt hier als lokaler Bauplan; erst «Fertig» schreibt ihn in
   state.designs. Das aktive Teil ist der Index im Stapel, auf den die drei
   Knopfreihen wirken. */
let wsBuild = null, wsActive = 0;
function openWorkshop() {
  if (state.designs.length >= DESIGN_MAX) {
    toast(`Die Werkstatt ist voll — es passen ${DESIGN_MAX} Entwürfe hinein. Lösche zuerst einen (× auf der Kachel).`);
    return; }
  wsBuild = { parts: [{ shape: 'klotz', width: 'mittel', color: FURN_COLORS[0].id }] };
  wsActive = 0;
  $('workshop').classList.add('open');
  renderWorkshop();
}
function closeWorkshop() { $('workshop').classList.remove('open'); wsBuild = null; }
/* Höhe des Stapels — entscheidet, ob noch ein Teil dazu darf. */
const wsHeight = b => b.parts.reduce((h, p) => h + BUILD_SHAPES.find(s => s.id === p.shape).h, 0);
function renderWorkshop() {
  const part = wsBuild.parts[wsActive];
  $('ws-preview').src = designThumb(wsBuild);
  const stack = $('ws-stack'); stack.innerHTML = '';
  wsBuild.parts.forEach((p, i) => {
    const sh = BUILD_SHAPES.find(s => s.id === p.shape), wd = BUILD_WIDTHS.find(w => w.id === p.width);
    const col = FURN_COLORS.find(c => c.id === p.color);
    const b = document.createElement('button');
    b.textContent = `${i + 1}. ${sh.name} · ${wd.name} · ${col.name}`;
    if (i === wsActive) b.className = 'on';
    b.onclick = () => { wsActive = i; renderWorkshop(); };
    stack.appendChild(b); });
  const row = (id, list, cur, pick, dot) => {
    const el = $(id); el.innerHTML = '';
    list.forEach(o => { const b = document.createElement('button');
      if (dot) { b.className = 'ws-dot'; b.style.background = '#' + MAT[o.mat].color.getHexString();
        b.setAttribute('aria-label', o.name); b.title = o.name; }
      else b.textContent = o.name;
      if (o.id === cur) b.className = (b.className ? b.className + ' ' : '') + 'on';
      b.onclick = () => { pick(o.id); renderWorkshop(); };
      el.appendChild(b); }); };
  row('ws-shape', BUILD_SHAPES, part.shape, id => { part.shape = id; }, false);
  row('ws-width', BUILD_WIDTHS, part.width, id => { part.width = id; }, false);
  row('ws-color', FURN_COLORS, part.color, id => { part.color = id; }, true);
  const smallest = Math.min(...BUILD_SHAPES.map(s => s.h));
  $('ws-add').disabled = wsBuild.parts.length >= BUILD_MAX || wsHeight(wsBuild) + smallest > BUILD_MAX_H;
  $('ws-del').disabled = wsBuild.parts.length <= 1;
}
$('ws-add').onclick = () => {
  const p = wsBuild.parts[wsActive];
  /* Ein neues Teil ist eine Kopie des aktiven — passt es nicht mehr unter den
     Höhendeckel, wird die flachste Form genommen. */
  const sh = BUILD_SHAPES.find(s => s.id === p.shape);
  const fits = wsHeight(wsBuild) + sh.h <= BUILD_MAX_H;
  const flat = BUILD_SHAPES.reduce((a, s) => s.h < a.h ? s : a);
  wsBuild.parts.push({ shape: fits ? p.shape : flat.id, width: p.width, color: p.color });
  wsActive = wsBuild.parts.length - 1; sfx.pop(); renderWorkshop();
};
$('ws-del').onclick = () => {
  if (wsBuild.parts.length <= 1) return;
  wsBuild.parts.splice(wsActive, 1);
  wsActive = Math.min(wsActive, wsBuild.parts.length - 1); sfx.knock(); renderWorkshop();
};
$('ws-cancel').onclick = closeWorkshop;
$('ws-ok').onclick = () => {
  const b = normalizeBuild(wsBuild);
  if (!b) { closeWorkshop(); return; }
  /* Der Name zählt hoch und füllt Lücken, die das Löschen hinterlässt. */
  let n = 1; const taken = new Set(state.designs.map(d => d.name));
  while (taken.has(`Eigenbau ${n}`)) n++;
  state.designs.push({ name: `Eigenbau ${n}`, parts: b.parts });
  closeWorkshop(); sfx.chime(); save(); renderCatalog();
};
$('workshop').onclick = e => { if (e.target === $('workshop')) closeWorkshop(); };

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
  /* Von innen gilt das Gegenteil von aussen: die Wand muss stehen, sonst sieht
     man in einen offenen Setzkasten statt in ein Zimmer. state.cutaway selbst
     bleibt unangetastet, damit die Aussenansicht nach dem Besuch unverändert
     ist (#44). */
  for (let j = 0; j <= MAXF; j++) if (floorGroups[j])
    floorGroups[j].userData.front.visible = besuch ? true : (!state.cutaway && !(edit && edit.k === j));
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
  if (k === 'garten') {
    /* Blick von Süden über die Fläche, Abstand aus dem tatsächlichen Blickfeld —
       dieselbe Rechnung wie drinnen (fitDistance), damit im Hochformat nichts
       aus dem Bild fällt. */
    const dist = GARDEN_D / 2 + fitDistance(GARDEN_W / 2 + 0.6, 1.8) + 1.0;
    return { eye: new THREE.Vector3(GARDEN_POS.x, 4.2, GARDEN_POS.z + dist),
             tgt: new THREE.Vector3(GARDEN_POS.x, 0.6, GARDEN_POS.z) };
  }
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
  /* Einrichten und Besuch schliessen sich aus — sonst schrieben beide
     gleichzeitig an Kamera und Sichtbarkeit (#44). */
  if (edit || besuch) return;
  edit = { k };
  camSave = { p: camera.position.clone(), t: controls.target.clone() };
  const { eye, tgt } = editCamFor(k);
  if (k === 'garten') {
    moveCam(eye, tgt);
    gardenEdge.visible = true;
    $('edit-title').textContent = 'Spielplatz einrichten';
  } else if (k === 'roof') {
    moveCam(eye, tgt);
    $('edit-title').textContent = 'Dachterrasse einrichten';
  } else {
    for (let j = k + 1; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].visible = false;
    roofG.visible = false;
    applyFronts();
    floorGroups[k].userData.ceil.visible = false;
    moveCam(eye, tgt);
    const t = tenantOf(k);
    $('edit-title').textContent = `${flLabel(k)} — ${tenantIn(k) ? (t.unit || t.name) : 'Wohnung einrichten'}`;
  }
  $('editbar').classList.add('on');
  wallTarget = 'alle';
  $('catalog').classList.add('open'); renderCatalog(); highlightWalls();
  updateRoomClipButtons();
  updateHUD(); sfx.whoosh();
}
function exitEdit() {
  if (!edit) return;
  gardenEdge.visible = false;
  if (edit.k !== 'roof' && edit.k !== 'garten') { for (let j = 1; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].visible = j <= state.floors; }
  for (let j = 0; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].userData.ceil.visible = true;
  updateRoof();
  deselect();
  moveCam(camSave.p, camSave.t);
  edit = null;
  wallTarget = 'alle'; highlightWalls();
  applyFronts();
  updateRoomClipButtons();
  $('editbar').classList.remove('on');
  $('catalog').classList.remove('open');
  updateHUD();
}

/* ---------- Besuchsmodus (#44) ---------- */
/* Standpunkte statt Laufen: die Kamera steht in Augenhöhe im Raum, das
   Blickziel liegt in dessen Mitte. Gedreht wird um dieses Ziel, was sich
   von innen wie Umsehen anfühlt — ohne Kollision, Schwerkraft oder ein
   zweites Steuerungssystem. */
const AUGE = 1.5;
let besuch = null, besuchSave = null;

function besuchCamFor(k) {
  if (k === 'garten') {
    return { eye: new THREE.Vector3(GARDEN_POS.x, AUGE, GARDEN_POS.z + GARDEN_D / 2 - 0.6),
             tgt: new THREE.Vector3(GARDEN_POS.x, AUGE, GARDEN_POS.z) };
  }
  if (k === 'roof') {
    const y = topY() + AUGE;
    return { eye: new THREE.Vector3(0, y, ROOF_D / 2 - 0.6), tgt: new THREE.Vector3(0, y, 0) };
  }
  const y = floorY(k) + AUGE;
  const x = floorGroups[k] ? floorGroups[k].position.x : 0;
  return { eye: new THREE.Vector3(x, y, -dims(k).d / 2 + 0.5), tgt: new THREE.Vector3(x, y, 0) };
}

/* OrbitControls neigt die Kamera nicht, es dreht sie um das Blickziel: wer nach
   oben schaut, hebt sie mit. Bei 1.5 m Augenhöhe in einem 2 m hohen Zimmer
   stösst sie darum schon nach wenigen Grad durch die Decke — feste Polargrenzen
   können das nicht leisten, weil Raumhöhe und Bahnradius von Stockwerk zu
   Stockwerk verschieden sind. Draussen, auf Dach und Spielplatz, gibt es keine
   Decke; dort bleibt der grosszügige Bereich. */
const BESUCH_LUFT = 0.15;
const BESUCH_POLAR_FREI = { minP: 0.35, maxP: 2.4 };
function besuchPolar(k, bahn) {
  if (typeof k !== 'number') return BESUCH_POLAR_FREI;
  const nachOben = Math.max(0, H(k) - AUGE - BESUCH_LUFT);
  const nachUnten = Math.max(0, AUGE - BESUCH_LUFT);
  return { minP: Math.acos(Math.min(1, nachOben / bahn)),
           maxP: Math.acos(-Math.min(1, nachUnten / bahn)) };
}

function stelleBesuchKamera(k) {
  const { eye, tgt } = besuchCamFor(k);
  const { minP, maxP } = besuchPolar(k, eye.distanceTo(tgt));
  controls.minPolarAngle = minP;
  controls.maxPolarAngle = maxP;
  moveCam(eye, tgt);
}

function enterBesuch(k) {
  if (edit || besuch) return;
  besuch = { k };
  camSave = { p: camera.position.clone(), t: controls.target.clone() };
  /* Die heutigen Grenzen sind für die Aussenansicht gemacht: minDistance 4 bei
     rund 1.5 m Abstand im Raum würde die Kamera beim ersten update() durch die
     Wand nach aussen schieben (js/game.js:164). Gesichert statt neu
     hingeschrieben — ein zweiter Ort mit denselben Zahlen läuft auseinander. */
  besuchSave = { min: controls.minDistance, max: controls.maxDistance,
                 minP: controls.minPolarAngle, maxP: controls.maxPolarAngle,
                 zoom: controls.enableZoom };
  controls.minDistance = 0.4;
  controls.maxDistance = 6;
  controls.enableZoom = false;
  stelleBesuchKamera(k);
  /* Die Decke ist die Lichtquelle des Raums — mit ihr wird es dunkel und trüb.
     Dieselbe bewusste Unehrlichkeit, die enterEdit schon trifft. Höhere
     Stockwerke bleiben dagegen stehen: beim Blick aus dem Fenster fehlte sonst
     der halbe Turm. */
  if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
  applyFronts();
  renderBesuchbar();
  sfx.whoosh();
}

function exitBesuch() {
  if (!besuch) return;
  Object.assign(controls, { minDistance: besuchSave.min, maxDistance: besuchSave.max,
    minPolarAngle: besuchSave.minP, maxPolarAngle: besuchSave.maxP,
    enableZoom: besuchSave.zoom });
  besuch = null; besuchSave = null;
  /* Erst jetzt, mit besuch === null, stellt applyFronts den Aussenzustand
     her — vorher hielte es alle Wände sichtbar. */
  for (let j = 0; j <= MAXF; j++) if (floorGroups[j]) floorGroups[j].userData.ceil.visible = true;
  applyFronts();
  moveCam(camSave.p, camSave.t);
  renderBesuchbar();
  sfx.whoosh();
}

/* Gesperrt statt versteckt: ein Knopf, der verschwindet, verwirrt mehr als
   einer, der grau ist (#44). Nur «Draussen» fehlt ganz, solange es keinen
   Spielplatz gibt — dort wäre auch grau eine Lüge. */
function renderBesuchbar() {
  $('besuchbar').classList.toggle('on', !!besuch);
  if (!besuch) return;
  const k = besuch.k;
  const zahl = typeof k === 'number';
  $('besuch-titel').textContent = k === 'roof' ? 'Dachterrasse'
    : k === 'garten' ? 'Spielplatz'
    : `${flLabel(k)} — ${tenantIn(k) ? (tenantOf(k).unit || tenantOf(k).name) : 'noch niemand'}`;
  $('btn-besuch-runter').disabled = !zahl || k <= 0;
  $('btn-besuch-hoch').disabled = !zahl || k >= state.floors;
  $('btn-besuch-dach').disabled = k === 'roof';
  $('btn-besuch-garten').classList.toggle('hidden', !state.garden);
  $('btn-besuch-garten').disabled = k === 'garten';
}

/* Der Wechsel ist ein neuer Standpunkt, kein neuer Besuch: camSave und die
   gesicherten Grenzen bleiben, damit «Schluss» auch nach fünf Wechseln
   dorthin zurückführt, wo man angefangen hat. */
function wechsleBesuch(k) {
  if (!besuch) return;
  besuch.k = k;
  if (typeof k === 'number' && floorGroups[k]) floorGroups[k].userData.ceil.visible = false;
  stelleBesuchKamera(k);
  renderBesuchbar();
  sfx.pop();
}

/* Beginnt beim untersten gebauten Stockwerk — das Erdgeschoss ist immer da,
   auch in einem frisch begonnenen Turm. */
$('btn-besuch').onclick = () => { if (besuch) exitBesuch(); else enterBesuch(0); };
$('btn-besuch-runter').onclick = () => { if (besuch && typeof besuch.k === 'number' && besuch.k > 0) wechsleBesuch(besuch.k - 1); };
$('btn-besuch-hoch').onclick = () => { if (besuch && typeof besuch.k === 'number' && besuch.k < state.floors) wechsleBesuch(besuch.k + 1); };
$('btn-besuch-dach').onclick = () => wechsleBesuch('roof');
$('btn-besuch-garten').onclick = () => { if (state.garden) wechsleBesuch('garten'); };
$('btn-besuch-zu').onclick = exitBesuch;

function deselect() { if (selHelper) { scene.remove(selHelper); selHelper = null; } selected = null;
  $('colorpick').classList.remove('open'); $('selbar').classList.remove('on'); }
function select(pick) { deselect(); selected = pick;
  selHelper = new THREE.BoxHelper(pick.mesh, 0xc0432e); scene.add(selHelper);
  const wall = WALL_ITEMS.has(pick.entry.id);
  $('btn-move').classList.toggle('hidden', wall);
  $('btn-rot').classList.toggle('hidden', wall);
  $('wallpad').classList.toggle('hidden', !wall);
  $('btn-color').classList.toggle('hidden', !TINTABLE.has(pick.entry.id));
  renderColorPick();
  /* Ein Bewohner lässt sich nicht wegwerfen (#39). */
  $('btn-del').classList.toggle('hidden', !!pick.tenant);
  updateActionBtn();
  $('selbar').classList.add('on'); }

/* ---------- Raum kopieren ----------
   Die Zwischenablage hält eine tiefe Kopie der Quellwohnung: Möbelliste,
   Tapete (vier Wände) und Bodenbelag. Sie lebt nur in dieser Sitzung und
   wird nicht gespeichert — ein über Tage gemerkter Raum, dessen Quelle
   längst umgeräumt ist, wäre mehr Überraschung als Hilfe. */
let clip = null;
const deepCopy = v => JSON.parse(JSON.stringify(v));
function updateRoomClipButtons() {
  const normal = !!edit && edit.k !== 'roof' && edit.k !== 'garten';
  $('btn-roomcopy').classList.toggle('hidden', !normal);
  $('btn-roompaste').classList.toggle('hidden', !(normal && clip && clip.from !== edit.k));
}
function copyRoom() {
  if (!edit || edit.k === 'roof' || edit.k === 'garten') return;
  const k = edit.k;
  clip = { from: k, items: deepCopy(roomOf(k)),
    wallpaper: deepCopy(wallpaperOf(k)), flooring: state.flooring[k] || null };
  updateRoomClipButtons(); sfx.pop();
  toast(`Wohnung ${flLabel(k)} gemerkt — geh auf ein anderes Stockwerk und tippe auf «Raum einfügen».`);
}
$('btn-roomcopy').onclick = copyRoom;

/* Eingefügt wird in zwei Durchgängen: erst die Möbel, dann die Deko. Nur so
   sieht surfaceYAt beim Ablegen der Vase den Tisch, auf dem sie stand.
   clampEntry rechnet jeden Eintrag auf die Masse der ZIELetage um — obere
   Stockwerke sind schmaler als untere (siehe W/D). */
function pasteEntries(k, items) {
  const maxCell = colsOf(k) * 2 - 1;
  const order = [...items.filter(e => !DECO.has(e.id)), ...items.filter(e => DECO.has(e.id))];
  const placed = [];
  order.forEach(src => {
    const en = deepCopy(src);
    en.cell = Math.max(0, Math.min(maxCell, en.cell || 0));
    if (DECO.has(en.id)) en.y = surfaceYAt(k, en.x, en.z);
    else if (!WALL_ITEMS.has(en.id)) en.y = baseY(k);
    roomOf(k).push(en);
    const m = placeItemMesh(k, en);
    clampEntry(k, m, en);
    placed.push(en.id);
  });
  return placed;
}
/* Leeren mit derselben Mechanik wie removeItem: Liste, Szenengraph und
   itemMeshes müssen zusammen aufgeräumt werden, sonst bleiben Möbel
   sichtbar stehen, die es im Spielstand nicht mehr gibt. */
function clearRoom(k) {
  itemMeshes[k].slice().forEach(m => parentOf(k).remove(m));
  itemMeshes[k].length = 0;
  roomOf(k).length = 0;
}
function doPaste(k, replace) {
  if (replace) clearRoom(k);
  const ids = pasteEntries(k, clip.items);
  /* Tapete liegt pro Wand, der Bodenbelag als einzelne Id — beides getrennt
     von der Möbelliste. Wer «den Raum» kopiert, meint sie mit. */
  state.wallpaper[k] = deepCopy(clip.wallpaper);
  if (clip.flooring) state.flooring[k] = clip.flooring;
  else delete state.flooring[k];
  applyLook(k);
  /* Bewohner werden nicht mitkopiert — die Tiere hängen an tenantGroups[i]
     und gehören zur Wohnung, nicht zur Einrichtung. Was die Kopie auslöst,
     ist der Einzug der Familie, die auf DIESE Etage gehört, und die
     Erfüllung ihres Wunsches, falls er mitgekommen ist. Auf Etage k kann
     immer nur der Wunsch von tenantOf(k) selbst erfüllt werden (checkWishes
     prüft wishKey gegen where===k, und where ist nur für die eigene Etage k
     gleich k). Dieser eine Treffer muss VOR checkTenant geprüft werden:
     pasteEntries hat alle Einträge schon in roomOf(k) — ruft man stattdessen
     erst mit einer nicht passenden id auf, sieht deren renderWishes() den
     Wunschgegenstand schon im Raum liegen und markiert ihn über wishOpen
     still als erfüllt, ohne die drei Haselnüsse zu zahlen. */
  const t = tenantOf(k);
  if (!t.roofWish) { const wishId = ids.find(id => wishKey(id) === t.wish); if (wishId) checkWishes(wishId, k); }
  checkTenant(k);
  renderWishes(); renderResidents();
  deselect(); sfx.pop(); save(); updateHUD();
  toast(`Die Wohnung von Stockwerk ${flLabel(clip.from)} ist eingezogen!`);
}
let pasteTarget = null;
function pasteRoom() {
  if (!edit || edit.k === 'roof' || edit.k === 'garten' || !clip || clip.from === edit.k) return;
  const k = edit.k;
  if (!roomOf(k).length) { doPaste(k, false); return; }
  pasteTarget = k;
  $('pasteask-text').textContent =
    `In Stockwerk ${flLabel(k)} stehen schon ${roomOf(k).length} Sachen. Soll die kopierte Wohnung dazukommen oder alles ersetzen?`;
  $('pasteask').classList.add('open');
}
$('btn-roompaste').onclick = pasteRoom;
function closePasteAsk() { $('pasteask').classList.remove('open'); pasteTarget = null; }
$('paste-cancel').onclick = closePasteAsk;
$('pasteask').onclick = e => { if (e.target === $('pasteask')) closePasteAsk(); };
$('paste-add').onclick = () => { const k = pasteTarget; closePasteAsk(); if (k !== null) doPaste(k, false); };
$('paste-replace').onclick = () => { const k = pasteTarget; closePasteAsk(); if (k !== null) doPaste(k, true); };

/* Die Reihe zeigt «Standard» plus die Palette; die Punkte tragen den Farbwert
   der MAT-Instanz, damit kein zweiter Ort eine Farbe festlegt. */
function renderColorPick() {
  const el = $('colorpick'); el.innerHTML = '';
  if (!selected) return;
  const cur = selected.entry.color || 'standard';
  const mk = (id, label, hex) => { const b = document.createElement('button');
    b.dataset.color = id; b.title = label; b.setAttribute('aria-label', label);
    if (hex) b.style.background = hex; else b.textContent = '↺';
    if (id === cur) b.className = 'on';
    b.onclick = () => setItemColor(id === 'standard' ? null : id);
    el.appendChild(b); };
  mk('standard', 'Standardfarbe', null);
  FURN_COLORS.forEach(c => mk(c.id, c.name, '#' + MAT[c.mat].color.getHexString()));
}
function setItemColor(colorId) {
  if (!selected) return;
  const en = selected.entry;
  if (colorId) en.color = colorId; else delete en.color;
  select(rebuildItemMesh(selected));
  $('colorpick').classList.add('open'); renderColorPick();
  sfx.pop(); save();
}

/* Der Aktionsknopf sagt, was der nächste Druck TUT — nicht, wie der Zustand
   gerade heisst. Er erscheint nur für Objekte, die in ACTIONS stehen. */
function updateActionBtn() {
  const b = $('btn-action');
  const label = selected ? actionLabel(selected.entry) : null;
  b.classList.toggle('hidden', !label);
  if (label) b.textContent = label;
}
/* Antippen bleibt mit Auswählen belegt (js/game.js:1003-1005) — geschaltet
   wird über diesen Knopf. Ein Eintrag ohne `apply` (Instrumente, Issue #36)
   spielt nur seinen Ton und schreibt nichts in den Spielstand. */
function toggleAction() {
  if (!selected) return;
  const en = selected.entry, a = ACTIONS[en.id];
  if (!a) return;
  if (!a.apply) { a.sound(true); return; }
  const next = !isOn(en);
  en.on = next;
  a.sound(next);
  const mesh = selected.mesh;
  tween(0.7, q => a.apply(mesh, next, q));
  updateActionBtn();
  /* Die Fassade hängt an den Lampenzuständen (applyNight) — ohne dieses
     Nachziehen hinkte sie bis zum nächsten Tag/Nacht-Wechsel hinterher. */
  if (en.id === 'lampe') applyNight(nightK);
  save();
}
$('btn-action').onclick = toggleAction;

function addItem(id, build) {
  if (!edit) return;
  const k = edit.k;
  const cell = freeCell(k);
  if (cell < 0 && !DECO.has(id) && !WALL_ITEMS.has(id)) { toast('Die Wohnung ist schon ganz voll!'); return; }
  const p = cellPos(k, Math.max(cell, 0));
  const entry = { id, cell: Math.max(cell, 0), x: p.x, z: p.z, rot: 0 };
  /* Der Bauplan wird kopiert, nicht verwiesen: ein späteres Ändern oder
     Löschen des Entwurfs lässt aufgestellte Möbel unberührt. */
  if (id === 'eigenbau') entry.build = JSON.parse(JSON.stringify(normalizeBuild(build) || { parts: [] }));
  if (id === 'pool') entry.fill = 0;
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
  if (!resolveItemMove(m.userData.pick)) {
    const arr = roomOf(k); const idx = arr.indexOf(entry); if (idx >= 0) arr.splice(idx, 1);
    parentOf(k).remove(m);
    const mi = itemMeshes[k].indexOf(m); if (mi >= 0) itemMeshes[k].splice(mi, 1);
    meldeBlockade(); save(); return;
  }
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
/* Umfärben heisst: Mesh wegwerfen und über placeItemMesh neu bauen. Das ist
   der einzige Pfad, der Elternknoten, itemMeshes, spinners und userData.pick
   korrekt verdrahtet — ein zweiter, halber Pfad wäre die Fehlerquelle. */
function rebuildItemMesh(pick) {
  const { k, entry, mesh } = pick;
  parentOf(k).remove(mesh);
  const mi = itemMeshes[k].indexOf(mesh); if (mi >= 0) itemMeshes[k].splice(mi, 1);
  if (mesh.userData.wheel) { const si = spinners.indexOf(mesh.userData.wheel); if (si >= 0) spinners.splice(si, 1); }
  const m = placeItemMesh(k, entry);
  clampEntry(k, m, entry);
  return m.userData.pick;
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
/* Ausweichkandidaten: erst ein feiner Ring um den bisherigen Platz (das
   Tier soll sichtbar nur zur Seite rutschen), danach das Freiraum-Raster
   aus #14/#39. Jeder Kandidat läuft durch clampEntry, deshalb kann das
   Ausweichen nie in eine Wand führen. */
const NUDGE_DIRS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
  const a = i * Math.PI / 4; return { dx: Math.cos(a), dz: Math.sin(a) }; });
const NUDGE_STEPS = [0.18, 0.36, 0.54, 0.72];
function nudgeTenant(pick) {
  const en = pick.entry, from = { x: en.x, z: en.z };
  const cands = [];
  NUDGE_STEPS.forEach(r => NUDGE_DIRS.forEach(d =>
    cands.push({ x: from.x + d.dx * r, z: from.z + d.dz * r })));
  tenantSpots(pick.k).forEach(s => cands.push({ x: s.x, z: s.z }));
  for (const c of cands) {
    en.x = c.x; en.z = c.z;
    clampEntry(pick.k, pick.mesh, en);
    if (tenantBlocked(pick)) continue;
    const to = { x: en.x, z: en.z };
    en.x = from.x; en.z = from.z;
    tween(0.25, q => { pick.mesh.position.x = from.x + (to.x - from.x) * q;
                       pick.mesh.position.z = from.z + (to.z - from.z) * q;
                       if (selHelper && selected === pick) selHelper.update(); },
          () => { en.x = to.x; en.z = to.z; });
    en.x = to.x; en.z = to.z;
    setTenantPos(pick.tenant.floor, pick.tenant.idx, en);
    return true;
  }
  en.x = from.x; en.z = from.z;
  replaceMesh(pick);
  return false;
}
/* Ein Möbelzug lässt betroffene Tiere ausweichen. Kann eines nicht
   ausweichen, wird der ganze Zug zurückgenommen — lieber gesperrt als
   ein Tier in der Wand. */
function resolveItemMove(pick) {
  if (pick.k === 'roof' || !tenantMeshes[pick.k]) return true;
  const moved = [];
  for (const a of tenantMeshes[pick.k]) {
    const ap = a.userData.pick;
    if (!tenantBlocked(ap)) continue;
    const snap = { x: ap.entry.x, z: ap.entry.z };
    if (nudgeTenant(ap)) { moved.push({ ap, snap }); continue; }
    moved.forEach(m => { m.ap.entry.x = m.snap.x; m.ap.entry.z = m.snap.z; replaceMesh(m.ap); });
    blockGrund = `Hier ist kein Platz — ${TENANTS[pick.k].name} steht im Weg!`;
    return false;
  }
  return true;
}
function spawnTenant(i, silent) {
  if (tenantGroups[i]) return;
  const t = tenantOf(i); const g = new THREE.Group();
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
  floorGroup(i).add(g); tenantGroups[i] = g;
  /* tenantSpot ist eine Platzierungsheuristik, keine Kollisionsprüfung: in
     einer vollen Wohnung liefert sie trotzdem einen Punkt. Wer ohne
     gespeicherten Platz einzieht, wird darum einmal freigeräumt. Ein von
     Hand gesetzter Platz (state.tenantPos, #39) bleibt unangetastet. */
  if (!saved) tenantMeshes[i].forEach(a => {
    const ap = a.userData.pick; if (tenantBlocked(ap)) nudgeTenant(ap); });
  if (!silent) { toast(`${t.name} — eingezogen!`); sfx.chime();
    g.scale.setScalar(0.01); tween(0.5, q => g.scale.setScalar(0.01 + 0.99 * q)); }
  renderWishes(); renderResidents(); updateHUD();
}
function checkTenant(k) { if (typeof k === 'number' && tenantIn(k) && !tenantGroups[k]) spawnTenant(k); }
/* Ein Serienmöbel zählt bei Wünschen wie sein klassisches Gegenstück:
   'wk_sofa' erfüllt den Sofa-Wunsch. Die Wipfkea-ids sind genau dafür als
   'wk_' + klassische id gebaut (siehe Spec «Wipfkea»). Wer ein Serienstück
   ergänzt, muss diese Namensregel einhalten. */
const wishKey = id => id.startsWith('wk_') ? id.slice(3) : id;
function wishOpen(i) {
  if (!tenantIn(i) || state.fulfilled[i]) return false;
  const t = tenantOf(i); const where = t.roofWish ? 'roof' : i;
  if (roomOf(where).some(e => wishKey(e.id) === t.wish)) { state.fulfilled[i] = true; return false; }
  return true;
}
function checkWishes(placedId, k) {
  for (let i = 0; i <= MAXF; i++) { const t = tenantOf(i);
    if (!tenantIn(i) || state.fulfilled[i]) continue;
    const where = t.roofWish ? 'roof' : i;
    if (where === k && t.wish === wishKey(placedId)) {
      state.fulfilled[i] = true; state.nuts += 3;
      toast('Wunsch erfüllt! +3 Haselnüsse'); sfx.chime(true);
      save(); } }
  renderWishes(); updateHUD();
}
/* Bei zehn Etagen passt jeder offene Wunsch knapp aufs Panel; bei fünfzig
   nicht mehr — das Panel ist fest positioniert, ohne Scrollbereich (#47). */
const WISH_MAX = 5;
function renderWishes() {
  const box = $('wishes'); box.innerHTML = '';
  const open = [];
  for (let i = 0; i <= MAXF; i++) if (wishOpen(i)) open.push(i);
  open.slice(0, WISH_MAX).forEach(i => {
    const t = tenantOf(i);
    const d = document.createElement('div'); d.className = 'wish panel';
    d.innerHTML = `<b>${flLabel(i)}:</b> ${t.wtext}`;
    d.onclick = () => { if (edit) exitEdit(); setTimeout(() => enterEdit(t.roofWish ? 'roof' : i), 60); $('extras-menu').classList.remove('open'); };
    box.appendChild(d);
  });
  if (open.length > WISH_MAX) {
    const rest = open.length - WISH_MAX;
    const d = document.createElement('div'); d.className = 'wish panel more';
    d.textContent = `… und ${rest} weitere ${rest === 1 ? 'Wunsch' : 'Wünsche'} weiter oben.`;
    box.appendChild(d);
  }
}
function renderResidents() {
  const ul = $('resident-list'); ul.innerHTML = '';
  for (let i = MAXF; i >= 0; i--) {
    const li = document.createElement('li');
    const built = i <= state.floors;
    const nm = !built ? '<span class="free">noch nicht gebaut</span>' : tenantIn(i) ? `<b>${tenantOf(i).unit || tenantOf(i).name}</b>` : '<span class="free">zurzeit frei</span>';
    const hint = i === 0 ? '<span class="hint">Erdgeschoss, war schon da</span>' : '';
    li.innerHTML = `<span class="fl">${flLabel(i)}</span><span>${nm}${hint}</span>`;
    ul.appendChild(li); }
}

/* ---------- Bauen ---------- */
let buildingUntil = 0;
function buildFloor() {
  if (state.floors >= MAXF || edit) return;
  state.floors++;
  const i = state.floors, g = floorGroup(i);
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
/* Was die Welt kostet (#83). Möbel bleiben gratis: Nüsse verdient man nur
   durch Aufstellen des Wunschmöbels (checkWishes), ein Preis darauf wäre eine
   Sackgasse, weil ein Kind ohne Nüsse dann keine verdienen könnte. Bezahlt
   wird, was die Welt verändert, und davon gibt es genau zwei. */
const EXTRA_PREIS = { bridge: 9, garden: 15 };

/* Zieht den Preis ab, oder erklärt, wie viele Nüsse fehlen. Ein zu teures
   Extra ändert gar nichts — kein Zustand, kein save(). Der Knopf bleibt
   bedienbar: ein graues Feld sagt einem Kind nichts, ein Tipp, der die
   Spielregel erklärt, bringt sie ihm bei. */
function bezahle(key) {
  const preis = EXTRA_PREIS[key];
  if (state.nuts >= preis) { state.nuts -= preis; return true; }
  const fehlt = preis - state.nuts;
  toast(`Dafür brauchst Du noch ${fehlt} ${fehlt === 1 ? 'Haselnuss' : 'Haselnüsse'} — erfülle noch einen Wunsch!`);
  sfx.knock();
  return false;
}

/* Der Preis steht auf dem Knopf, solange das Extra fehlt. Danach der gewohnte
   Text — bezahlt wird nur einmal. */
function beschrifteExtras() {
  $('btn-bridge').textContent = state.bridge
    ? 'Brücke bauen' : `Brücke bauen — ${EXTRA_PREIS.bridge} 🌰`;
  $('btn-garden').textContent = state.garden
    ? 'Garten & Spielplatz' : `Garten & Spielplatz — ${EXTRA_PREIS.garden} 🌰`;
}

$('btn-bridge').onclick = () => { $('extras-menu').classList.remove('open');
  if (state.bridge) { toast('Die Brücke steht schon!'); return; }
  if (!bezahle('bridge')) return;
  state.bridge = true; bridge.visible = true; bridge.scale.setScalar(0.01);
  tween(0.6, q => bridge.scale.setScalar(0.01 + 0.99 * q));
  sfx.knock(); toast('Willi baut eine Brücke über den Fluss!'); updateHUD(); save(); };
$('btn-garden').onclick = () => { $('extras-menu').classList.remove('open');
  if (state.garden) { enterEdit('garten'); return; }
  state.garden = true;
  state.rooms.garten = GARDEN_DEFAULT.map(e => ({ ...e }));
  roomOf('garten').forEach(e => { const m = placeItemMesh('garten', e); clampEntry('garten', m, e); });
  gartenG.visible = true; gartenG.scale.setScalar(0.01);
  tween(0.6, q => gartenG.scale.setScalar(0.01 + 0.99 * q));
  sfx.pop(); toast('Spielplatz, Beete und Blumen — fertig!'); save();
  enterEdit('garten'); };
$('btn-sign').onclick = () => { $('extras-menu').classList.remove('open'); renderResidents(); $('residents').classList.add('open'); };
function renderAnimals() {
  const grid = $('animal-grid'); grid.innerHTML = '';
  for (let i = 0; i <= MAXF; i++) { const t = tenantOf(i);
    const d = document.createElement('div'); d.className = 'acard';
    const status = tenantIn(i) ? '<span class="in">Eingezogen!</span>' : '<small>wartet noch auf die Wohnung</small>';
    d.innerHTML = `<img src="${animalThumbs[i] || ''}" alt=""><b>${t.name}</b><small>Stock ${flLabel(i)}</small>${status}`;
    grid.appendChild(d); }
  const d = document.createElement('div'); d.className = 'acard';
  d.innerHTML = `<img src="${mokiThumb}" alt=""><b>Móki das Eichhörnchen</b><small>flitzt ums Haus</small><span class="in">Besucher</span>`;
  grid.appendChild(d);
}
$('btn-animals').onclick = () => { $('extras-menu').classList.remove('open'); renderAnimals(); $('animals').classList.add('open'); };
$('btn-aniclose').onclick = () => $('animals').classList.remove('open');
$('animals').onclick = e => { if (e.target === $('animals')) $('animals').classList.remove('open'); };
$('btn-resclose').onclick = () => $('residents').classList.remove('open');
$('residents').onclick = e => { if (e.target === $('residents')) $('residents').classList.remove('open'); };

/* ---------- Bach -> Splashdown (#46) ----------
   Splashdown ist ein eigenes Spiel unter derselben Domain, in einem anderen
   Pfad. Der Rückweg wird als Query-Parameter mitgegeben; Splashdown darf ihn
   heute noch ignorieren — dann führt der Rückweg über die Zurück-Taste und
   den «More Games…»-Link (siehe Spec, Abschnitt «Abhängigkeit»). */
const SPLASHDOWN_URL = 'https://github.freaxnx01.ch/game-splashdown/';
function askSplashdown() { $('splash-ask').classList.add('open'); sfx.pop(); }
function gotoSplashdown() {
  schreibeStand();   /* NICHT save() — das ist um 300 ms entprellt und stirbt mit dem Dokument */
  sfx.splash();
  const back = new URL('.', location.href).href;
  location.href = SPLASHDOWN_URL + '?zurueck=' + encodeURIComponent(back)
    + '&zurueck-name=' + encodeURIComponent('Wipfelkratzer');
}
$('btn-splash-go').onclick = gotoSplashdown;
$('btn-splash-stay').onclick = () => { $('splash-ask').classList.remove('open'); sfx.pop(); };
$('splash-ask').onclick = e => { if (e.target === $('splash-ask')) $('splash-ask').classList.remove('open'); };

/* Party */
let party = false; const dancers = [];
$('btn-party').onclick = () => { $('extras-menu').classList.remove('open'); party ? endParty() : startParty(); };
function startParty() {
  party = true; $('btn-party').textContent = 'Party beenden';
  setNight(true); partyG.visible = true;
  let n = 0;
  for (let i = 0; i <= MAXF; i++) { if (!tenantIn(i)) continue;
    tenantOf(i).animals.forEach(sp => { const a = makeAnimal(sp);
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
/* Issue #41: Bei Nacht verrät die Fassade, ob in der Wohnung Licht brennt.
   Eine Wohnung OHNE Lampe verhält sich weiter wie bisher — sonst wären alle
   bestehenden Spielstände über Nacht schwarz. */
function floorLampState(i) {
  const lamps = roomOf(i).filter(e => e.id === 'lampe');
  return { has: lamps.length > 0, any: lamps.some(isOn) };
}
function applyNight(k) {
  nightK = k;
  scene.background.lerpColors(SKY.d, SKY.n, k); scene.fog.color.copy(scene.background);
  hemi.color.lerpColors(HEMI.d, HEMI.n, k); hemi.groundColor.lerpColors(GRND.d, GRND.n, k);
  hemi.intensity = 1.05 - 0.62 * k; dir.intensity = 1.15 - 1.0 * k;
  starMat.opacity = k * 0.9; moonMat.opacity = k;
  for (let i = 0; i <= MAXF; i++) { if (!floorGroups[i]) continue; const ls = floorLampState(i);
    const lit = k > 0.5 && tenantIn(i) && (!ls.has || ls.any);
    floorGroups[i].userData.wins.forEach(w => { w.material.color.set(lit ? 0xffd98a : 0x6b4526);
      w.material.emissive.set(lit ? 0xffc257 : 0x000000); w.material.emissiveIntensity = lit ? 0.9 : 0; }); }
  /* Birnen folgen der Tageszeit — applyLampe rechnet mit nightK. */
  for (let i = 0; i <= MAXF; i++) (itemMeshes[i] || []).forEach(m => {
    if (m.userData.pick.entry.id === 'lampe') applyLampe(m, isOn(m.userData.pick.entry), 1); });
  $('btn-night').textContent = k > 0.5 ? 'Tag' : 'Nacht';
}
function setNight(on) {
  state.night = on; save();
  const from = nightK, to = on ? 1 : 0;
  tween(1.2, q => applyNight(from + (to - from) * q));
}
$('btn-night').onclick = () => { if (party && state.night) { toast('Bei der Party bleibt es Nacht!'); return; } setNight(!state.night); };

/* Jahreszeit (#50). Gemischt wird zwischen zwei Tabelleneinträgen, genau wie
   applyNight zwischen Tag und Nacht mischt. Die Arbeitsteilung ist dabei die
   Regel, die nicht gebrochen werden darf: die Jahreszeit schreibt nur die
   Tag-Endpunkte SKY.d und GRND.d, das Mischen auf Himmel, Nebel und
   Hemisphärenlicht bleibt bei applyNight. Sonst überschreiben sich die beiden
   Überblendungen gegenseitig, sobald sie gleichzeitig laufen. */
const SEASON_TEXT = {
  fruehling: 'Jetzt ist Frühling — alles wird frisch und hellgrün.',
  sommer: 'Jetzt ist Sommer — der Wald steht sattgrün.',
  herbst: 'Jetzt ist Herbst — die Blätter werden bunt.',
  winter: 'Jetzt ist Winter — Schnee liegt auf dem Wald.',
};
const seasonIndex = id => { const i = SEASONS.findIndex(s => s.id === id); return i < 0 ? SEASONS.findIndex(s => s.id === 'sommer') : i; };
let seasonFrom = seasonIndex(state.season), seasonTo = seasonFrom, seasonK = 1;
const cA = new THREE.Color(), cB = new THREE.Color();
const lerpHex = (out, a, b, q) => out.lerpColors(cA.setHex(a), cB.setHex(b), q);
function applySeason(q) {
  seasonK = q;
  const a = SEASONS[seasonFrom], b = SEASONS[seasonTo];
  lerpHex(SKY.d, a.sky, b.sky, q);
  lerpHex(GRND.d, a.hemiGround, b.hemiGround, q);
  lerpHex(ground.material.color, a.ground, b.ground, q);
  lerpHex(riverSandMat.color, a.sand, b.sand, q);
  lerpHex(riverWaterMat.color, a.water, b.water, q);
  lerpHex(riverFoamMat.color, a.foam, b.foam, q);
  const dh = a.leaf.dh + (b.leaf.dh - a.leaf.dh) * q;
  const ks = a.leaf.ks + (b.leaf.ks - a.leaf.ks) * q;
  const dl = a.leaf.dl + (b.leaf.dl - a.leaf.dl) * q;
  LEAVES.forEach(e => e.mat.color.setHSL(e.h + dh, Math.min(1, e.s * ks), Math.min(1, e.l + dl)));
  applyNight(nightK);
  $('btn-season').textContent = (q < 0.5 ? a : b).name;
}
function setSeason(idx) {
  seasonFrom = seasonTo; seasonTo = idx;
  const from = seasonK;     /* laufende Überblendung sauber abholen */
  state.season = SEASONS[idx].id; save();
  tween(1.4, q => applySeason(from + (1 - from) * q));
  toast(SEASON_TEXT[SEASONS[idx].id]);
  sfx.whoosh();
}
/* Bewusst ohne Sperre während der Dachparty — anders als bei Tag/Nacht gibt es
   keinen Grund, die Jahreszeit festzuhalten. */
$('btn-season').onclick = () => setSeason((seasonTo + 1) % SEASONS.length);
$('btn-cutaway').onclick = () => { state.cutaway = !state.cutaway; applyFronts(); sfx.whoosh(); save();
  if (state.cutaway) toast('Blick in alle Wohnungen — wie im Buch!'); };

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
  /* Lichtschalter: kurzer, trockener Klick aus zwei Rauschstössen. */
  click() { if (!AC) return; const t = AC.currentTime;
    noiseBurst(t, 0.03, 5200, 1800, 0.18); tone(196, t, 0.06, 'square', 0.08); },
  /* Fenster: tiefes Holzknarzen, das in der Tonhöhe wandert. */
  creak() { if (!AC) return; const t = AC.currentTime;
    const o = tone(150, t, 0.45, 'sawtooth', 0.07);
    if (o) o.frequency.exponentialRampToValueAtTime(96, t + 0.4);
    noiseBurst(t + 0.05, 0.3, 900, 320, 0.05); },
  /* Wasser läuft ein: rauschen, das heller wird, dazu ein steigender Ton. */
  fill() { if (!AC) return; const t = AC.currentTime;
    noiseBurst(t, 0.9, 700, 3000, 0.13);
    const o = tone(280, t, 0.85, 'sine', 0.05);
    if (o) o.frequency.exponentialRampToValueAtTime(520, t + 0.8); },
  /* Wasser läuft ab: dasselbe rückwärts, mit Gluckern. */
  drain() { if (!AC) return; const t = AC.currentTime;
    noiseBurst(t, 0.9, 2600, 420, 0.12);
    [0, 0.22, 0.46, 0.68].forEach((d, i) => tone(220 - i * 32, t + d, 0.12, 'sine', 0.07)); },
};
$('btn-music').onclick = () => { musicOn = !musicOn; $('btn-music').textContent = musicOn ? 'Musik aus' : 'Musik an'; };

function tenantTalk(i) {
  const t = tenantOf(i);
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
  if (k === 'garten') { toast('Tippe ein Spielplatz-Objekt an, dann kannst du es verschieben, drehen oder wegräumen.'); return; }
  if (k === 'roof') { toast(state.floors === MAXF && wishOpen(MAXF) ? 'Die Frösche warten auf einen Pool!' : 'Lampions, Sonnenschirm und Liegestuhl machen die Dachterrasse fein.'); return; }
  if (!tenantIn(k)) { toast(`Noch ${Math.max(0, 3 - roomOf(k).length)} Sachen einrichten, dann zieht ${tenantOf(k).name} ein!`); return; }
  if (wishOpen(k)) { toast(tenantOf(k).wtext); return; }
  toast(TIPS[tipI++ % TIPS.length]); };

/* ---------- Interaktion ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
/* Wand im 3D antippen (Möbel haben Vorrang, unsichtbare Wände zählen nicht) */
const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
function pickWall() {
  if (!edit || edit.k === 'roof' || edit.k === 'garten') return null;
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
  const hits = ray.intersectObjects([...hitboxes, sign, willi, dam, moki, river], true);
  for (const h of hits) {
    let o = h.object; while (o && !(o.userData && o.userData.type)) o = o.parent;
    if (!o) continue; const u = o.userData;
    if (u.type === 'sign') { renderResidents(); $('residents').classList.add('open'); return; }
    if (u.type === 'willi') { williTalk(); return; }
    if (u.type === 'dam') { damTalk(); return; }
    if (u.type === 'moki') { mokiTalk(); return; }
    if (u.type === 'bach') { askSplashdown(); return; }
    if (u.type === 'roof') { enterEdit('roof'); return; }
    if (u.type === 'garten') { if (state.garden) { enterEdit('garten'); return; } continue; }
    if (u.type === 'floor') { if (u.floor <= state.floors) { enterEdit(u.floor); return; } continue; }
  }
});

/* ---------- Objekt ziehen (#64) ---------- */
/* Nur das bereits ausgewählte Objekt lässt sich ziehen, und nur wenn der
   Zug auf ihm beginnt — sonst bliebe in einer vollen Wohnung keine
   Fläche mehr übrig, um die Kamera zu drehen. Gilt für Maus und Finger. */
let ziehen = null;
const zugEbene = new THREE.Plane();
const zugVersatz = new THREE.Vector3();
const zugPunkt = new THREE.Vector3();

function zeigerStrahl(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
}

/* Liegt der Zeiger auf dem ausgewählten Objekt? Liefert den Weltpunkt
   des Treffers oder null. */
function trifftAuswahl(e) {
  if (!edit || !selected) return null;
  zeigerStrahl(e);
  const hits = ray.intersectObject(selected.mesh, true);
  return hits.length ? hits[0].point.clone() : null;
}

/* Reihenfolge-Falle: OrbitControls hängt seinen eigenen pointerdown schon beim
   Aufbau der Szene an renderer.domElement, also vor diesem hier — es hat den
   Zug bereits begonnen, wenn controls.enabled = false gesetzt wird. Genau
   deshalb ist `enabled` das Mittel und nicht stopPropagation():
   OrbitControls.onPointerMove prüft `enabled` bei jeder Bewegung und steigt
   aus, die Kamera bewegt sich also keinen Pixel. */
renderer.domElement.addEventListener('pointerdown', e => {
  const treffer = trifftAuswahl(e);
  if (!treffer) return;
  const en = selected.entry;
  const normale = new THREE.Vector3(0, 1, 0);
  ziehen = { id: e.pointerId, blockiert: false, wand: null, wandStart: null };
  if (WALL_ITEMS.has(en.id)) {
    /* Wandobjekte laufen nicht über eine Bodenebene: en.x führt entlang der
       Wand, en.y die Höhe. Die Zugebene ist deshalb die Wand selbst. */
    const pl = wallPlacement(selected.k, en.wall || 'back');
    normale.set(0, 0, 0); normale[pl.fixedAxis] = 1;
    ziehen.wand = pl; ziehen.wandStart = treffer.clone();
  } else {
    selected.mesh.getWorldPosition(zugPunkt);
    zugVersatz.copy(treffer).sub(zugPunkt);
  }
  zugEbene.setFromNormalAndCoplanarPoint(normale, treffer);
  controls.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});

renderer.domElement.addEventListener('pointermove', e => {
  if (!ziehen || e.pointerId !== ziehen.id || !selected) return;
  zeigerStrahl(e);
  if (!ray.ray.intersectPlane(zugEbene, zugPunkt)) return;
  const en = selected.entry;
  /* en.x/en.y/en.z sind lokal zur Elterngruppe — gartenG trägt GARDEN_POS,
     die Stockwerksgruppen ihre Höhe. */
  const eltern = parentOf(selected.k);
  if (ziehen.wand) { zieheWandobjekt(eltern); return; }
  zugPunkt.sub(zugVersatz);
  const lokal = eltern.worldToLocal(zugPunkt.clone());
  if (!applyMove(selected, () => { en.x = lokal.x; en.z = lokal.z;
    clampEntry(selected.k, selected.mesh, en); })) {
    if (!ziehen.blockiert) { ziehen.blockiert = true; meldeBlockade(); }
    return; }
  ziehen.blockiert = false;
  /* Bei einem Tier gehört position.y allein der Wackel-Animation (#39). */
  if (selected.tenant) { setTenantPos(selected.tenant.floor, selected.tenant.idx, en); }
  else { en.y = DECO.has(en.id) ? surfaceYAt(selected.k, en.x, en.z, selected.mesh) : baseY(selected.k);
         selected.mesh.position.y = en.y; }
  selHelper.update();
});

/* Der Zug wird als Weg entlang der Wand und in der Höhe gelesen und über
   moveWallItem geführt, das en.x/en.y kennt und clampEntry, selHelper und
   save selbst ruft. zugPunkt liegt bereits auf der Wandebene. Der Startpunkt
   wird nach jedem Schritt nachgezogen, damit die Wege relativ bleiben — sonst
   liefe das Objekt nach einem Anschlag an clampEntry aus dem Tritt. */
function zieheWandobjekt(eltern) {
  const pl = ziehen.wand;
  const lokal = eltern.worldToLocal(zugPunkt.clone());
  const start = eltern.worldToLocal(ziehen.wandStart.clone());
  ziehen.wandStart = zugPunkt.clone();
  moveWallItem(selected, lokal[pl.freeAxis] - start[pl.freeAxis], lokal.y - start.y);
}

function zugEnde(e) {
  if (!ziehen || (e && e.pointerId !== ziehen.id)) return;
  if (e) { try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {} }
  ziehen = null;
  controls.enabled = true;
  save();
}
renderer.domElement.addEventListener('pointerup', zugEnde);
renderer.domElement.addEventListener('pointercancel', zugEnde);

/* Das Rad dreht nur über dem ausgewählten Objekt — dieselbe Bedingung wie
   beim Ziehen. Überall sonst zoomt OrbitControls unverändert (#64).
   Der Handler hängt am Fenster im Capture-Lauf, nicht an der Leinwand:
   OrbitControls hat seinen eigenen wheel-Handler schon beim Aufbau der Szene
   an renderer.domElement gehängt und hätte längst gezoomt, bevor ein später
   registrierter Handler dort überhaupt an die Reihe käme — preventDefault
   unterbindet nur die Voreinstellung des Browsers, keinen zweiten Handler.
   Capture auf einem Vorfahren läuft davor und schneidet den Weg mit
   stopPropagation ab. */
addEventListener('wheel', e => {
  if (e.target !== renderer.domElement) return;   /* im Katalog bleibt Scrollen Scrollen */
  if (!trifftAuswahl(e)) return;
  const en = selected.entry;
  if (WALL_ITEMS.has(en.id)) return;   /* Wandobjekte richtet die Wand aus */
  e.preventDefault(); e.stopPropagation();
  /* Math.sign statt deltaY: Mäuse, Trackpads und deltaMode 0/1/2 liefern
     völlig verschiedene Beträge — eine Kerbe soll eine Rasterung sein. */
  if (!applyMove(selected, () => { en.rot += Math.sign(e.deltaY) * Math.PI / 12;
    selected.mesh.rotation.y = en.rot;
    clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
  if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, en); else save();
  selHelper.update();
}, { capture: true, passive: false });

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
    if (!applyMove(selected, () => { en.x = far.x; en.z = far.z; clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
    setTenantPos(selected.tenant.floor, selected.tenant.idx, en);
    selHelper.update(); sfx.pop(); return; }
  const c = freeCell(selected.k, selected.entry.cell + 1);
  if (c < 0) { toast('Kein Platz frei!'); return; }
  const en = selected.entry;
  if (!applyMove(selected, () => { en.cell = c; const p = cellPos(selected.k, c);
    en.x = p.x; en.z = p.z; en.y = DECO.has(en.id) ? surfaceYAt(selected.k, p.x, p.z, selected.mesh) : baseY(selected.k);
    selected.mesh.position.set(en.x, en.y, en.z);
    clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
  selHelper.update(); sfx.pop(); save(); };
$('btn-rot').onclick = () => { if (!selected || WALL_ITEMS.has(selected.entry.id)) return;
  const en = selected.entry;
  if (!applyMove(selected, () => { en.rot += Math.PI / 2;
    selected.mesh.rotation.y = en.rot;
    clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
  if (selected.tenant) setTenantPos(selected.tenant.floor, selected.tenant.idx, en); else save();
  selHelper.update(); sfx.pop(); };
$('btn-color').onclick = () => { if (!selected || !TINTABLE.has(selected.entry.id)) return;
  $('colorpick').classList.toggle('open'); renderColorPick(); };
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
    if (!applyMove(selected, () => { en.x += st[0]; en.z += st[1];
      clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
    /* Bei einem Tier gehört position.y allein der Wackel-Animation (#39). */
    if (selected.tenant) { setTenantPos(selected.tenant.floor, selected.tenant.idx, en); }
    else { en.y = DECO.has(en.id) ? surfaceYAt(selected.k, en.x, en.z, selected.mesh) : baseY(selected.k);
           selected.mesh.position.y = en.y; save(); }
    selHelper.update(); return; }
  if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault();
    if (!applyMove(selected, () => { en.rot += (e.key === 'PageUp' ? 1 : -1) * Math.PI / 12;
      selected.mesh.rotation.y = en.rot;
      clampEntry(selected.k, selected.mesh, en); })) { meldeBlockade(); return; }
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
try { photos = JSON.parse(localStorage.getItem(STAND.fotoKey) || '[]'); } catch (e) {}
if (!Array.isArray(photos)) photos = [];
function savePhotos() { try { localStorage.setItem(STAND.fotoKey, JSON.stringify(photos)); } catch (e) { toast('Die Galerie ist voll — lösche ein paar Fotos.'); } }
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
/* Vorschaubild für die Turm-Übersicht: klein und sparsam, weil es im Index
   liegt und der Index bei jedem Wechsel geschrieben wird. Bewusst nicht im
   save()-Pfad — der läuft bei jedem Handgriff. */
function standBild() {
  renderer.render(scene, camera);
  const src = renderer.domElement, s = Math.min(1, 240 / src.width);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * s));
  c.height = Math.max(1, Math.round(src.height * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.5);
}
function merkeStandBild() { try { staende.merkeBild(STAND.id, standBild()); } catch (e) {} }
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

/* ---------- Turm-Übersicht ---------- */
function renderStaende() {
  const idx = staende.ladeIndex(), grid = $('stand-grid');
  grid.classList.add('waldkarte');
  grid.innerHTML = '';
  /* Vier Plätze, fest: MAX_STAENDE ist 4. Belegte tragen ihre Karte, freie
     einen Bauplatz — die Anordnung ist reine Darstellung, die Reihenfolge
     kommt weiter aus dem Index. */
  for (let i = 0; i < staende.MAX_STAENDE; i++) {
    const platz = document.createElement('div');
    platz.className = 'lichtung';
    const e = idx.staende[i];
    if (e) {
      const info = staende.standInfo(e), hier = e.id === idx.aktiv;
      const gr = exportGroesse(e);
      const d = document.createElement('div');
      d.className = 'standkarte' + (hier ? ' aktiv' : '');
      d.dataset.id = e.id;
      const bild = e.bild
        ? `<img class="stand-bild" src="${e.bild}" alt="">`
        : '<div class="stand-bild leer"></div>';
      d.innerHTML = `${bild}
        <input class="stand-name" maxlength="40" value="${String(e.name).replace(/"/g, '&quot;')}">
        <div class="stand-info">${info.floors} Stockwerke · ${info.möbel} Möbel</div>
        <div class="zeile">${hier ? '<span class="stand-hier">Hier bist du</span>'
          : '<button class="stand-hin primary">Weiterbauen</button>'}
          <button class="stand-save">Sichern</button>
          <button class="stand-weg danger">Löschen</button></div>
        <div class="stand-save-zeile hidden">
          <button class="stand-save-mit">Mit Fotos (${gr.mit})</button>
          <button class="stand-save-ohne">Ohne Fotos (${gr.ohne})</button>
        </div>`;
      platz.appendChild(d);
    } else {
      const b = document.createElement('button');
      b.className = 'bauplatz';
      b.textContent = 'Hier ist Platz für einen Turm';
      platz.appendChild(b);
    }
    grid.appendChild(platz);
  }
  /* Drei Orte neben den Lichtungen. Sie hängen im selben Container, aber
     ausserhalb jeder .standkarte — die bestehenden Handler steigen bei ihnen
     über ihr closest('.standkarte') von selbst aus. */
  [['ort-schreinerei', 'Schreinerei'],
   ['ort-wipfkea', 'Wipfkea'],
   ['ort-aussicht', 'Aussicht']].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.id = id; b.className = 'ort ' + id.slice(4); b.textContent = label;
    grid.appendChild(b);
  });
  const voll = idx.staende.length >= staende.MAX_STAENDE;
  $('btn-stand-neu').disabled = voll;
  $('stand-voll').classList.toggle('hidden', !voll);
}
/* ---------- Turm sichern ---------- */
/* Liest den Turm aus seinen Schlüsseln — auch einen, der gerade nicht gespielt
   wird. Beim aktiven Turm vorher schreiben: save() ist um 300 ms entprellt
   (js/game.js:143), sonst fehlten der Datei die letzten Handgriffe. */
function standDatei(eintrag, mitFotos) {
  if (eintrag.id === STAND.id) schreibeStand();
  let stand = {}, fotos = null;
  try { stand = JSON.parse(localStorage.getItem(eintrag.standKey) || '{}'); } catch (e) { stand = {}; }
  if (mitFotos) {
    try { fotos = JSON.parse(localStorage.getItem(eintrag.fotoKey) || '[]'); } catch (e) { fotos = []; }
    if (!Array.isArray(fotos)) fotos = [];
  }
  const datei = baueDatei({ name: eintrag.name, bild: eintrag.bild, stand, fotos });
  return { text: JSON.stringify(datei), name: dateiName(eintrag.name) };
}

/* Zwei Wege: Tablets bekommen das System-Sheet, alles andere eine Datei.
   Ein Blob statt einer Data-URL, weil iOS-Safari grosse Data-URLs in einem
   neuen Tab öffnet statt sie zu sichern. */
async function exportiereStand(eintrag, mitFotos) {
  const { text, name } = standDatei(eintrag, mitFotos);
  const blob = new Blob([text], { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.share) {
      const f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare({ files: [f] })) {
        /* Ein Abbruch im Sheet ist kein Fehler — das Kind hat es sich anders
           überlegt, und ein zusätzlicher Download wäre erst recht verwirrend. */
        try { await navigator.share({ files: [f], title: eintrag.name }); }
        catch (e) { if (e && e.name !== 'AbortError') toast('Das Sichern hat nicht geklappt.'); }
        return;
      }
    }
  } catch (e) {}
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Der Turm ist als Datei gesichert.');
}

/* Für die Beschriftung: wie gross wird die Datei ungefähr? Die Länge der
   Zeichenkette genügt als Schätzung — JSON ist hier reines ASCII. */
const lesbar = n => n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
function exportGroesse(eintrag) {
  const laenge = k => { try { return (localStorage.getItem(k) || '').length; } catch (e) { return 0; } };
  const stand = laenge(eintrag.standKey) + 400;
  return { ohne: lesbar(stand), mit: lesbar(stand + laenge(eintrag.fotoKey)) };
}

/* ---------- Turm einlesen ---------- */
/* Ein Import geht immer in einen freien Platz — überschrieben wird nie.
   Schlägt das Schreiben fehl (voller Speicher), wird der eben angelegte Turm
   wieder entfernt, damit keine Ruine stehen bleibt. */
function importiereText(text) {
  const geprüft = pruefeDatei(text);
  if (!geprüft.ok) { toast(geprüft.grund); return { ok: false, grund: geprüft.grund }; }
  const d = geprüft.datei;
  const idx = staende.ladeIndex();
  const name = idx.staende.some(e => e.name === d.name) ? d.name + ' (eingelesen)' : d.name;
  const eintrag = staende.neuerStand(name);
  if (!eintrag) {
    const grund = 'Es sind schon vier Türme da — lösche zuerst einen.';
    toast(grund); return { ok: false, grund };
  }
  let ok = true;
  try { localStorage.setItem(eintrag.standKey, JSON.stringify(d.stand)); } catch (e) { ok = false; }
  if (ok && d.fotos) { try { localStorage.setItem(eintrag.fotoKey, JSON.stringify(d.fotos)); } catch (e) { ok = false; } }
  if (!ok) {
    staende.loescheStand(eintrag.id);
    const grund = 'Der Speicher ist voll — lösche ein paar Fotos oder einen Turm.';
    toast(grund); renderStaende(); return { ok: false, grund };
  }
  if (d.bild) staende.merkeBild(eintrag.id, d.bild);
  renderStaende();
  toast('«' + name + '» ist da. Tippe auf «Weiterbauen», um hinzugehen.');
  return { ok: true, eintrag };
}

/* Auf dem Tablet gibt es kein Ziehen von Dateien — der Dateidialog ist der
   einzige Weg, der auf iPad und Rechner gleich funktioniert. */
function importiereDatei(file) {
  if (!file) return;
  if (file.size > MAX_DATEI) { toast('Diese Datei ist zu gross.'); return; }
  const leser = new FileReader();
  leser.onload = () => importiereText(String(leser.result || ''));
  leser.onerror = () => toast('Diese Datei liess sich nicht lesen.');
  leser.readAsText(file);
}
$('btn-stand-import').onclick = () => $('stand-datei').click();
$('stand-datei').onchange = ev => {
  importiereDatei(ev.target.files && ev.target.files[0]);
  ev.target.value = '';   /* sonst löst dieselbe Datei kein zweites Mal aus */
};

function oeffneStaende() {
  merkeStandBild();
  renderStaende();
  $('staende').classList.add('open');
}
$('btn-staende').onclick = () => { $('extras-menu').classList.remove('open'); oeffneStaende(); };
$('btn-intro-staende').onclick = oeffneStaende;
$('btn-standclose').onclick = () => $('staende').classList.remove('open');
$('staende').onclick = e => { if (e.target === $('staende')) $('staende').classList.remove('open'); };

/* Ein Wechsel lädt die Seite neu: die Szene wird beim Start einmalig aus state
   aufgebaut, einen Abbau-Pfad gibt es nicht. Vorher noch schnell den
   aktuellen Stand sichern — save() ist entprellt. */
function wechsleZu(id) {
  schreibeStand();
  merkeStandBild();
  if (!staende.wähleStand(id)) { toast('Dieser Turm ist nicht mehr da.'); renderStaende(); return; }
  location.reload();
}
function legeTurmAn() {
  const e = staende.neuerStand();
  if (!e) { toast('Mehr als vier Türme passen nicht — lösche zuerst einen.'); renderStaende(); return; }
  wechsleZu(e.id);
}
$('btn-stand-neu').onclick = legeTurmAn;
/* Ein leerer Bauplatz auf der Karte tut dasselbe wie «Neuer Turm» — der Knopf
   bleibt, weil er auf der Schmalansicht schneller zu treffen ist. */
$('stand-grid').addEventListener('click', ev => {
  if (ev.target.classList.contains('bauplatz')) { legeTurmAn(); return; }
  /* Die Werkstatt braucht keine Wohnung: openWorkshop baut an wsBuild und legt
     fertige Entwürfe in state.designs. Von der Karte aus ist sie deshalb ein
     echter Ort, kein Schaufenster. */
  if (ev.target.id === 'ort-schreinerei') { openWorkshop(); return; }
  if (ev.target.id === 'ort-wipfkea') { zeigeSchaufenster(); return; }
  if (ev.target.id === 'ort-aussicht') {
    toast('Hier soll einmal eine Aussichtsplattform stehen — die gibt es noch nicht.');
  }
});

/* Schaufenster: die Wipfkea-Serie zum Anschauen. Platzieren braucht eine
   Wohnung und wäre von der Karte aus sinnlos — deshalb gibt es hier bewusst
   keinen Platzieren-Knopf. */
function zeigeSchaufenster() {
  const wrap = $('schaufenster-items'); wrap.innerHTML = '';
  CATALOG.filter(it => it.id.startsWith('wk_')).forEach(it => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = `<img src="${thumbs[it.id] || ''}" alt=""><span>${it.name}</span>`;
    wrap.appendChild(d);
  });
  $('schaufenster').classList.add('open');
}
$('btn-schaufenster-zu').onclick = () => $('schaufenster').classList.remove('open');
$('schaufenster').onclick = e => { if (e.target === $('schaufenster')) $('schaufenster').classList.remove('open'); };
$('stand-grid').addEventListener('click', ev => {
  const karte = ev.target.closest('.standkarte'); if (!karte) return;
  if (ev.target.classList.contains('stand-save')) {
    karte.querySelector('.stand-save-zeile').classList.toggle('hidden');
    return;
  }
  if (ev.target.classList.contains('stand-save-mit') || ev.target.classList.contains('stand-save-ohne')) {
    const mit = ev.target.classList.contains('stand-save-mit');
    const eintrag = staende.ladeIndex().staende.find(x => x.id === karte.dataset.id);
    if (!eintrag) { renderStaende(); return; }
    /* Der Knopf bleibt gesperrt, solange die Datei entsteht — mit zwanzig
       Fotos dauert das einen Moment, und ein zweiter Tipp gäbe eine zweite
       Datei. */
    const knopf = ev.target; knopf.disabled = true;
    exportiereStand(eintrag, mit).finally(() => {
      knopf.disabled = false;
      karte.querySelector('.stand-save-zeile').classList.add('hidden');
    });
    return;
  }
  if (ev.target.classList.contains('stand-hin')) wechsleZu(karte.dataset.id);
});
$('stand-grid').addEventListener('change', ev => {
  const karte = ev.target.closest('.standkarte'); if (!karte) return;
  if (ev.target.classList.contains('stand-name')) {
    staende.benenneUm(karte.dataset.id, ev.target.value);
    renderStaende();
  }
});
$('stand-grid').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.classList.contains('stand-name')) ev.target.blur();
});
/* Löschen trifft genau einen Turm — und braucht wie beim alten Reset das
   zweite Antippen. Danach ist auch die Galerie dieses Turms weg, was der
   alte Reset vergessen hatte. */
let wegArmed = { id: '', t: 0 };
$('stand-grid').addEventListener('click', ev => {
  const karte = ev.target.closest('.standkarte'); if (!karte) return;
  if (!ev.target.classList.contains('stand-weg')) return;
  const id = karte.dataset.id;
  if (wegArmed.id === id && Date.now() - wegArmed.t < 4000) {
    wegArmed = { id: '', t: 0 };
    const bleibt = staende.loescheStand(id);
    if (id === STAND.id) { location.reload(); return; }
    renderStaende();
    toast('Der Turm ist weg. Du baust an «' + bleibt.name + '» weiter.');
    return;
  }
  wegArmed = { id, t: Date.now() };
  ev.target.textContent = 'Wirklich löschen?';
  setTimeout(() => {
    if (wegArmed.id !== id) return;
    wegArmed = { id: '', t: 0 };
    renderStaende();
  }, 4000);
});

$('btn-start').onclick = () => { initAudio(); $('intro').classList.add('hidden'); };
/* Die Turmhöhe steckt in jedem Mass der Szene, die beim Laden des Moduls
   schon steht. Deshalb wird die Wahl geschrieben und die Seite neu geladen,
   statt die Szene zur Laufzeit umzubauen (#47). */
if (!hasSave) $('tower-pick').classList.remove('hidden');
TOWER_CHOICES.forEach(n => { $(`pick-${n}`).onclick = () => {
  if (n === MAXF) { initAudio(); $('intro').classList.add('hidden'); return; }
  state.maxFloors = n;
  try { localStorage.setItem(STAND.standKey, JSON.stringify(state)); } catch (e) {}
  location.reload();
}; });

/* Die sieben Objekte des bisherigen Ensembles, umgerechnet auf die unrotierte
   Gruppe: alte Gruppenkoordinate mit R_y(0.5) gedreht, Drehung um 0.5 erhöht.
   Die Blumen rücken dabei ein Stück vom Bach weg — in der alten Reihe stand
   die äusserste Blume bei (-9.55, 5.01) und damit im Wasser. */
const GARDEN_DEFAULT = [
  { id: 'schaukel',   cell: 0, x: -1.70, z:  1.50, y: 0, rot: 0.50 },
  { id: 'rutsche',    cell: 1, x:  0.30, z:  0.15, y: 0, rot: 0.00 },
  { id: 'sandkasten', cell: 2, x:  1.90, z: -0.50, y: 0, rot: 0.50 },
  { id: 'hochbeet',   cell: 3, x:  1.35, z:  1.60, y: 0, rot: 0.65 },
  { id: 'blumen',     cell: 4, x: -0.75, z:  2.00, y: 0, rot: 0.50 },
  { id: 'blumen',     cell: 5, x:  1.05, z:  1.05, y: 0, rot: 0.20 },
  { id: 'blumen',     cell: 6, x:  2.25, z:  0.35, y: 0, rot: 0.80 },
];
/* Alte Spielstände kennen nur den Boolean state.garden. Steht der Spielplatz,
   wird das Ensemble einmalig in einzelne Objekte übersetzt — danach ist
   state.rooms.garten die Wahrheit, auch wenn es leer ist: alles weggeräumt zu
   haben ist ein gültiger Zustand und darf nicht neu bestückt werden. Deshalb
   Array.isArray und nicht der Wahrheitswert (Vorbild: Tapeten-Migration). */
function migrateGarden() {
  if (Array.isArray(state.rooms.garten)) return;
  state.rooms.garten = state.garden ? GARDEN_DEFAULT.map(e => ({ ...e })) : [];
  migrated = true;
}

/* Jahreszeit. Alte Stände haben hier nichts — das ist gültig und heisst Sommer.
   Ein unbekannter Wert wird still auf Sommer zurückgesetzt und der bereinigte
   Stand einmalig zurückgeschrieben (Vorbild: Tapeten-Migration). */
function migrateSeason() {
  if (SEASONS.some(s => s.id === state.season)) return;
  state.season = 'sommer'; migrated = true;
}

/* ---------- Laden ---------- */
migrateGarden();
migrateSeason();
sanitizeDesigns();
/* Gebaute Etagen zuerst anlegen — placeItemMesh/spawnTenant greifen direkt
   auf floorGroups[i] zu und dürfen die Gruppe nicht selbst nachziehen (#47). */
for (let i = 1; i <= state.floors; i++) floorGroup(i);
Object.keys(state.rooms).forEach(k => {
  const key = (k === 'roof' || k === 'garten') ? k : parseInt(k, 10);
  sanitizeRoom(key);
  roomOf(key).forEach(e => {
    const m = placeItemMesh(key, e);
    if (key === 'roof' || key === 'garten') clampEntry(key, m, e);
  });
});
for (let i = 0; i <= MAXF; i++) if (tenantIn(i)) spawnTenant(i, true);
for (let i = 0; i <= MAXF; i++) if (floorGroups[i]) applyLook(i);
if (migrated) save();
/* Debug-/Testzugriff auf die Szene (Playwright-Checks) */
window.wipfelkratzer = { THREE, state, floorGroups, roofG, roofStairG, roofGapG, gartenG, gardenEdge, scene, camera, controls, WALL_KEYS, FURN_COLORS, TINTABLE,
  GARDEN: { pos: GARDEN_POS, w: GARDEN_W, d: GARDEN_D }, riverZ, river, placeItemMesh, clampEntry, removeItem,
  MAT, SEASONS, LEAVES, setSeason, setNight, ground,
  riverMats: { sand: riverSandMat, water: riverWaterMat, foam: riverFoamMat },
  leafColors: () => LEAVES.map(e => e.mat.color.getHexString()),
  /* Laufende Überblendungen. Ein Test kann so abwarten, bis ein Wechsel fertig
     ist, statt auf eine Bildrate zu wetten. */
  tweenCount: () => tweens.length,
  MAXF, tenantOf, topY, floorGroup, catalogIds: CATALOG.map(c => c.id),
  EXTRA_PREIS, updateHUD,
  matCount() { const s = new Set(); scene.traverse(o => { if (o.material) s.add(o.material.uuid); }); return s.size; },
  get wallTarget() { return wallTarget; }, enterEdit, exitEdit, dims, cellPos, wallPlacement, get edit() { return edit; },
  enterBesuch, exitBesuch, besuchCamFor, get besuch() { return besuch; }, floorYOf: floorY,
  itemMeshes, tenantMeshes, tenantGroups, tenantSpot, tenantSpots, setTenantPos, select, deselect, get selected() { return selected; },
  ACTIONS, isOn, addItem, solidBoxes, overlapsXZ, tenantBlocked, applyMove, meldeBlockade, roomOf, get clip() { return clip; },
  ziehtGerade: () => !!ziehen, zugBlockiert: () => !!(ziehen && ziehen.blockiert),
  poolEntries: () => roomOf('roof').filter(e => e.id === 'pool'),
  get magpiePhase() { return magPhase; }, MAGPIE_DUR, magpie,
  photoTools: { photoFilename, uniquePhotoNames, dataUrlToBytes, photoZipFilename },
  staende, stand: STAND, speichern: schreibeStand, speichernFotos: savePhotos, get fotos() { return photos; },
  standBild, merkeStandBild, renderStaende, standDatei, exportiereStand, importiereText,
  /* Debug-Trefferprobe für Playwright-Checks (#46): denselben Strahl und dieselbe
     Objektliste wie der pointerup-Handler nehmen, ohne eine Aktion auszulösen. */
  pickAt(nx, ny) {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hs = ray.intersectObjects([...hitboxes, sign, willi, dam, moki, river], true);
    for (const h of hs) { let o = h.object; while (o && !(o.userData && o.userData.type)) o = o.parent;
      if (o) return o.userData.type; }
    return null;
  },
  askSplashdown, SPLASHDOWN_URL };
/* Setzt die Jahreszeit ohne Überblendung (seasonFrom === seasonTo) und ruft am
   Ende applyNight(nightK) — das ersetzt den früheren Erstaufruf von applyNight. */
applySeason(1);
applyFronts();
makeThumbs();
renderWishes(); renderResidents(); updateHUD();

/* Elses flight logic (#45) */
function thirstyPool() {
  for (const en of roomOf('roof'))
    if (en.id === 'pool' && poolFill(en) < 1) return en;
  return null;
}
function poolMeshOf(en) {
  return itemMeshes.roof.find(m => m.userData.pick && m.userData.pick.entry === en) || null;
}
const poolAir = m => { roofG.updateWorldMatrix(true, false);
  const v = new THREE.Vector3(); m.getWorldPosition(v); v.y += 1.1; return v; };
const scoopAir = () => new THREE.Vector3(SCOOP.x, SCOOP.cruiseY, riverZ(SCOOP.x));
const scoopLow = () => new THREE.Vector3(SCOOP.x, SCOOP.y, riverZ(SCOOP.x));
function magArc(a, b, lift) {
  const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + lift;
  return new THREE.CatmullRomCurve3([a.clone(), mid, b.clone()], false, 'catmullrom', 0.5);
}
function magpieEnter(phase) {
  magPhase = phase; magT = 0;
  const here = magpie.position.clone();
  if (phase === 'holen') { magCurve = magArc(here, scoopAir(), 1.6); if (!magToast) { magToast = true; toast('Else holt Wasser für den Pool!'); } }
  if (phase === 'schoepfen') magCurve = magArc(scoopAir(), scoopLow(), 0.15);
  if (phase === 'bringen') {
    const en = thirstyPool(), m = en && poolMeshOf(en);
    magTarget = en; magCurve = m ? magArc(scoopLow(), poolAir(m), 2.4) : null;
    if (!magCurve) { magPhase = 'kreis'; magOffset = Math.atan2(here.z, here.x) - clock.elapsedTime * 0.3; }
  }
  if (phase === 'kreis') magOffset = Math.atan2(here.z, here.x) - clock.elapsedTime * 0.3;
}
function magpieAdvance() {
  if (magPhase === 'holen') { magpieEnter('schoepfen'); return; }
  if (magPhase === 'schoepfen') {
    magInner.userData.bucketWater.visible = true;
    sfx.whoosh();
    magpieEnter('bringen'); return;
  }
  if (magPhase === 'bringen') {
    if (!magTarget || roomOf('roof').indexOf(magTarget) < 0) { magpieEnter('kreis'); return; }
    magpieEnter('giessen'); return;
  }
  if (magPhase === 'giessen') {
    magInner.userData.bucket.rotation.z = 0;
    magInner.userData.bucketWater.visible = false;
    magpieEnter(thirstyPool() ? 'holen' : 'kreis'); return;
  }
  magpieEnter('kreis');
}
function pourBucket() {
  const en = magTarget;
  magInner.userData.bucketWater.visible = false;
  sfx.splash();
  if (!en || roomOf('roof').indexOf(en) < 0) return;
  en.fill = Math.min(POOL_TRIPS, (en.fill | 0) + 1);
  const m = poolMeshOf(en);
  if (m && m.userData.setFill) m.userData.setFill(poolFill(en));
  if (en.fill >= POOL_TRIPS) { toast('Der Pool ist voll — Piet und Jan können baden!'); sfx.chime(true); magToast = false; }
  save();
}

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt;
    let k = Math.min(tw.t / tw.dur, 1); k = k * k * (3 - 2 * k);
    tw.step(k); if (tw.t >= tw.dur) { tweens.splice(i, 1); if (tw.done) tw.done(); } }
  if (magPhase === 'kreis') {
    const mr = 10 + state.floors * 0.4, ma = t * 0.3 + magOffset;
    const mh = topY() + 2.6 + Math.sin(t * 0.7) * 0.4;
    const nx = Math.cos(ma + 0.08) * mr, nz = Math.sin(ma + 0.08) * mr;
    magpie.position.set(Math.cos(ma) * mr, mh, Math.sin(ma) * mr);
    magpie.lookAt(nx, mh, nz);
    if (thirstyPool()) magpieEnter('holen');
  } else {
    magT += dt;
    const dur = MAGPIE_DUR[magPhase] || 1;
    let k = Math.min(magT / dur, 1); k = k * k * (3 - 2 * k);
    if (magCurve) {
      const p = magCurve.getPointAt(k), q = magCurve.getPointAt(Math.min(k + 0.02, 1));
      magpie.position.copy(p);
      if (p.distanceToSquared(q) > 1e-6) magpie.lookAt(q);
    }
    if (magPhase === 'giessen') {
      const bk = magInner.userData.bucket;
      bk.rotation.z = -2.2 * Math.sin(k * Math.PI);
      if (!magPoured && k >= 0.5) { magPoured = true; pourBucket(); }
    } else magPoured = false;
    if (magT >= dur) magpieAdvance();
  }
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
