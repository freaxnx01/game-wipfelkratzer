import * as THREE from 'three';

/* Der Aquarell-Stil ist eine einzige Uniform (#90). Alles, was ihn
   ausmacht, liest sie — die gepatchten Lambert-Materialien ebenso wie
   die Konturen. Umschalten heisst deshalb: eine Zahl setzen. Kein
   Rebuild, keine neue Materialinstanz, kein Nachladen. */
export const STYLE = {
  aquarell: { value: 0 },
  res: { value: new THREE.Vector2(1, 1) },
  paper: { value: null },
  offset: { value: new THREE.Vector2(0, 0) },
  /* Die drei Stärken als Uniforms statt als Zahlen im Shader-Text — sie
     mussten für die Kamera dieses Spiels neu eingestellt werden, und wer
     sie später nachjustiert, soll dafür keinen Shader anfassen müssen.

     Warum nicht die Prototyp-Werte (1.25 / 1.0 / 0.85): die Tiefen-
     skalierung im Hull-Vertexshader hält die Strichbreite über die
     Entfernung konstant, aber nicht über das Sichtfeld. Der Prototyp
     rendert mit fov 27 aus 12.5 Einheiten, das Spiel mit **fov 48**
     (js/game.js:186) aus rund 24 — die halbe Bildhöhe an der Zielebene
     ist damit 10.7 statt 3.0 Einheiten, und derselbe Versatz liefert
     knapp ein Fünftel der Strichbreite auf dem Schirm. Bei 1.25 war die
     Kontur im Spiel schlicht unsichtbar. 5.0 ist am Turm gemessen; ab
     etwa 8.0 reisst die Wobble-Funktion den Strich in schwebende
     Fetzen. */
  edge: { value: 1.6 },
  grain: { value: 1.0 },
  width: { value: 5.0 },
};

/* Papier wird gemalt, nicht geladen — das Spiel ist buildless und holt
   zur Laufzeit nichts nach. 512² reicht, weil die Textur im Screen
   Space gekachelt wird und niemand die Kachel als Muster liest. */
export function makePaper() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 232 + Math.random() * 23;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  /* Fasern: kurze Striche, hell und dunkel gemischt — das ist der
     Unterschied zwischen «Rauschen» und «Papier». */
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const a = Math.random() * Math.PI, len = 3 + Math.random() * 14;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.035)'; ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 14 + Math.random() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
STYLE.paper.value = makePaper();

/* Aus dem Prototyp unverändert übernommen, damit das Ergebnis mit ihm
   vergleichbar bleibt. */
export const GLSL_NOISE = /* glsl */`
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
             mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}`;

/* Der Passerversatz ist in Pixeln gedacht und muss deshalb bei jedem
   Resize neu in NDC umgerechnet werden. */
export function syncStyleRes(w, h) {
  STYLE.res.value.set(w, h);
  STYLE.offset.value.set((2.2 / w) * 2, (-1.6 / h) * 2);
}

const STIL_KEY = 'wipfelkratzer-stil';
/* Der Stil ist eine Vorliebe des Kindes, kein Teil eines Turms — er liegt
   deshalb ausserhalb der Stand-Schlüssel (js/staende.js:22-23) und wird
   nie in state geschrieben, das save() serialisiert. */
export function ladeStil() {
  try { return localStorage.getItem(STIL_KEY) === 'aquarell' ? 1 : 0; } catch (e) { return 0; }
}
export function speichereStil(v) {
  try { localStorage.setItem(STIL_KEY, v ? 'aquarell' : 'bilderbuch'); } catch (e) {}
}

/* Einhängepunkt #include <opaque_fragment> — gegen three 0.184 geprüft
   (js/models.js:1, index.html:13): dort steht die beleuchtete Farbe
   fertig in gl_FragColor, aber Tonemapping, Farbraum und Nebel sind noch
   nicht drüber. Randpigment und Papier gehören vor den Nebel, sonst
   überzeichnet das Korn die Fernsicht. */
const MARKE = '#include <opaque_fragment>';

export function patchLambert(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAquarell = STYLE.aquarell;
    shader.uniforms.uRes = STYLE.res;
    shader.uniforms.uPaper = STYLE.paper;
    shader.uniforms.uEdge = STYLE.edge;
    shader.uniforms.uGrain = STYLE.grain;

    const patch = MARKE + /* glsl */`
      if (uAquarell > 0.5) {
        vec3 col = gl_FragColor.rgb;
        vec3 nn = normalize(vNormal);
        /* Randpigment: an der Silhouette sammelt sich Farbe. Unabhängig
           vom Licht — deshalb abs(), das Vorzeichen von vViewPosition
           spielt keine Rolle. */
        float rim = 1.0 - abs(dot(nn, normalize(vViewPosition)));
        col = mix(col, col * 0.56, pow(rim, 2.4) * uEdge);
        /* Papierkorn im Screen Space. In UV gerechnet läse es sich als
           Material statt als Papier — der Bogen liegt VOR der Szene. */
        vec2 puv = gl_FragCoord.xy / uRes * 1.7;
        vec3 paper = texture2D(uPaper, puv).rgb;
        col = mix(col, col * paper, uGrain);
        gl_FragColor.rgb = col;
      }`;
    if (!shader.fragmentShader.includes(MARKE)) {
      console.error('Stil-Patch: Shader-Chunk', MARKE, 'nicht gefunden — Aquarell-Stil bleibt wirkungslos');
      return;
    }
    shader.fragmentShader =
      'uniform float uAquarell;\nuniform vec2 uRes;\nuniform sampler2D uPaper;\nuniform float uEdge;\nuniform float uGrain;\n'
      + shader.fragmentShader.replace(MARKE, patch);
  };
  /* Ohne eigenen Cache-Key teilen sich beide Stile ein Programm und der
     erste kompilierte gewinnt. Mit ihm kompiliert three genau zweimal,
     einmal pro Stil — danach ist Umschalten ein Programmwechsel, kein
     Kompilat. */
  mat.customProgramCacheKey = () => 'stil' + STYLE.aquarell.value;
  mat.userData.stilPatch = true;
  return mat;
}

/* Inverted Hull: dasselbe Mesh noch einmal, nach aussen gestülpt und von
   innen betrachtet. Der Versatz passiert im Vertex-Shader, nicht in der
   Geometrie — das Kind teilt deshalb die Geometrie seines Elters. Genau
   das löst den Fenstertausch aus #102: wer dort geometry umhängt, hängt
   die Kontur mit um (eine Zeile), statt sie neu zu bauen. */
let hullMat = null;
export function hullMaterial() {
  if (hullMat) return hullMat;
  hullMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uWidth: STYLE.width, uOffset: STYLE.offset, uInk: { value: new THREE.Color(0x6e4426) } },
    vertexShader: GLSL_NOISE + /* glsl */`
      uniform float uWidth; uniform vec2 uOffset;
      void main(){
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        /* Die Tiefenskalierung (-mv.z) hält die Strichbreite auf dem
           Bildschirm konstant — sonst wird die Kontur beim Zoomen fett. */
        float wob = 0.55 + 0.9 * vnoise(position * 3.3);
        mv.xyz += n * uWidth * wob * (-mv.z) * 0.0032;
        vec4 p = projectionMatrix * mv;
        p.xy += uOffset * p.w;     /* Passerversatz */
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uInk;
      void main(){ gl_FragColor = vec4(uInk, 1.0); }`,
  });
  return hullMat;
}

/* Nur auf Struktur aufrufen, nie unter makeFurniture(): verify_katalog.py
   verwirft dort jedes Material, das kein MeshLambertMaterial ist
   (tools/verify_katalog.py:103). */
export function addHull(mesh) {
  const h = new THREE.Mesh(mesh.geometry, hullMaterial());
  h.name = 'kontur'; h.castShadow = false; h.receiveShadow = false;
  h.visible = !!STYLE.aquarell.value; h.userData.kontur = true;
  mesh.add(h);
  return h;
}
export function hullOf(mesh) { return mesh.children.find(c => c.userData && c.userData.kontur) || null; }
