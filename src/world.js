/* ===== core: renderer, sky, lights, textures, track meshes, scenery ===== */
var T, S, N, ds, BB = null;
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var $ = function (id) { return document.getElementById(id); };
var seed = 20261019, gLights = [];
function rand() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

var canvas = $('gl'), renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) { $('nogl').hidden = false; return; }
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var PR = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(PR);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6000);
var SUN_DIR = new THREE.Vector3(0.62, 0.36, 0.69).normalize();
scene.fog = new THREE.Fog(0xcfae8c, 300, 2800);

/* ---- sky ---- */
function makeSkyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec3 vP; uniform vec3 sunDir;',
      'void main(){',
      ' vec3 d = normalize(vP); float h = d.y;',
      ' vec3 zen = vec3(0.07,0.20,0.55); vec3 mid = vec3(0.36,0.55,0.82); vec3 hor = vec3(0.92,0.70,0.50);',
      ' vec3 col = mix(hor, mid, smoothstep(0.0,0.22,h));',
      ' col = mix(col, zen, smoothstep(0.18,0.85,h));',
      ' float sd = max(dot(d, sunDir), 0.0);',
      ' col += vec3(1.0,0.58,0.26) * pow(sd, 6.0) * 0.30;',
      ' col += vec3(1.0,0.82,0.55) * pow(sd, 60.0) * 0.8;',
      ' col += vec3(1.0,0.95,0.85) * smoothstep(0.9993, 0.9998, sd) * 6.0;',
      ' col = mix(col, hor * 0.8, smoothstep(0.0, -0.12, h));',
      ' gl_FragColor = vec4(col, 1.0);',
      ' #include <tonemapping_fragment>',
      ' #include <encodings_fragment>',
      '}'
    ].join('\n')
  });
}
var sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), makeSkyMat());
sky.renderOrder = -10; scene.add(sky);

/* ---- lights ---- */
var hemi = new THREE.HemisphereLight(0xa9c8f2, 0x6b5a3c, 0.6); scene.add(hemi);
var sun = new THREE.DirectionalLight(0xffd7a3, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
var sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 360;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25;
scene.add(sun); scene.add(sun.target);

/* ---- environment reflections for the cars ---- */
var envTex;
(function () {
  var es = new THREE.Scene();
  var ms = makeSkyMat(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), ms));
  function panel(w, h, p, rx, ry, k) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.88).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(p[0], p[1], p[2]); m.rotation.set(rx, ry, 0); es.add(m);
  }
  panel(40, 14, [0, 38, 0], Math.PI / 2, 0, 1.8);
  panel(14, 10, [SUN_DIR.x * 40, SUN_DIR.y * 40 + 4, SUN_DIR.z * 40], 0, Math.atan2(SUN_DIR.x, SUN_DIR.z) + Math.PI, 5.0);
  panel(18, 6, [-38, 12, -10], 0, Math.PI / 2, 0.9);
  var pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(es, 0.0, 0.1, 200).texture;
})();

/* ---- texture helpers ---- */
var ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function ctex(w, h, draw, rx, ry) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rx) t.repeat.set(rx, ry || rx);
  t.anisotropy = ANISO; t.encoding = THREE.sRGBEncoding;
  return t;
}
function speckle(g, w, h, n, lo, hi, a0, a1, big) {
  for (var i = 0; i < n; i++) {
    var l = (lo + rand() * (hi - lo)) | 0;
    g.fillStyle = 'rgba(' + l + ',' + l + ',' + (l + 3) + ',' + (a0 + rand() * (a1 - a0)) + ')';
    g.fillRect(rand() * w, rand() * h, 1 + rand() * big, 1 + rand() * big);
  }
}
var texAsphalt = ctex(512, 512, function (g, w, h) {
  g.fillStyle = '#3d4045'; g.fillRect(0, 0, w, h);
  var gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.37, 'rgba(0,0,0,0.20)');
  gr.addColorStop(0.44, 'rgba(0,0,0,0)'); gr.addColorStop(0.56, 'rgba(0,0,0,0)'); gr.addColorStop(0.63, 'rgba(0,0,0,0.20)');
  gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 30000, 40, 110, 0.08, 0.28, 2);
  g.fillStyle = 'rgba(236,239,242,0.93)';
  g.fillRect(w * 0.022, 0, w * 0.013, h); g.fillRect(w * 0.965, 0, w * 0.013, h);
});
texAsphalt.wrapS = THREE.ClampToEdgeWrapping;
var texGrass = ctex(512, 512, function (g, w, h) {
  g.fillStyle = '#58783a'; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 9000; i++) {
    var v = rand();
    g.fillStyle = v < 0.5 ? 'rgba(40,70,26,' + (0.1 + rand() * 0.25) + ')' : 'rgba(120,150,70,' + (0.08 + rand() * 0.2) + ')';
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 2 + rand() * 5);
  }
}, 500, 500);
var texGravel = ctex(256, 256, function (g, w, h) {
  g.fillStyle = '#b3a283'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 9000, 90, 230, 0.2, 0.55, 2.5);
});
var texCurb = ctex(64, 64, function (g, w, h) {
  g.fillStyle = '#d02828'; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#f1f1f1'; g.fillRect(0, h / 2, w, h / 2);
  speckle(g, w, h, 300, 60, 160, 0.05, 0.15, 1.5);
});
var texBarrier = ctex(1024, 128, function (g, w, h) {
  g.fillStyle = '#d4d7dc'; g.fillRect(0, 0, w, h);
  var cols = ['#0d47a1', '#c62828', '#16181d', '#e08e00'], names = ['VELOCE', 'NOVA', 'TURBO-X', 'APEX'];
  for (var k = 0; k < 4; k++) {
    g.fillStyle = cols[k]; g.fillRect(k * 256 + 8, 26, 240, 82);
    g.fillStyle = '#fff'; g.font = '800 46px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(names[k], k * 256 + 128, 69);
  }
  for (var j = 0; j < 32; j++) { g.fillStyle = j % 2 ? '#d02828' : '#f4f4f4'; g.fillRect(j * 32, 0, 32, 14); }
  speckle(g, w, h, 1500, 90, 170, 0.05, 0.12, 2);
});
var texCrowd = ctex(256, 128, function (g, w, h) {
  g.fillStyle = '#23272e'; g.fillRect(0, 0, w, h);
  var pal = ['#d9433c', '#f1f1ee', '#3a6fd1', '#f0b429', '#2fa37a', '#8e5bd0', '#e8e0cf'];
  for (var i = 0; i < 2600; i++) { g.fillStyle = pal[(rand() * pal.length) | 0]; g.fillRect(rand() * w, rand() * h, 2, 3); }
});
var texPit = ctex(512, 128, function (g, w, h) {
  g.fillStyle = '#e4e7ea'; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 8; i++) { g.fillStyle = '#1b2430'; g.fillRect(i * 64 + 6, 30, 52, 70); g.fillStyle = 'rgba(120,170,220,0.35)'; g.fillRect(i * 64 + 6, 30, 52, 22); }
  g.fillStyle = '#c62828'; g.fillRect(0, 108, w, 8);
});
var texChecker = ctex(224, 16, function (g, w, h) {
  for (var x = 0; x < 28; x++) for (var y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#101010' : '#f5f5f5'; g.fillRect(x * 8, y * 8, 8, 8); }
});
texChecker.magFilter = THREE.NearestFilter; texChecker.wrapS = texChecker.wrapT = THREE.ClampToEdgeWrapping;
var texSlot = ctex(64, 128, function (g, w, h) {
  g.strokeStyle = 'rgba(245,245,245,0.9)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(6, 4); g.lineTo(6, h - 4); g.lineTo(w - 6, h - 4); g.lineTo(w - 6, 4); g.stroke();
  g.beginPath(); g.moveTo(6, 4); g.lineTo(w * 0.35, 4); g.moveTo(w - 6, 4); g.lineTo(w * 0.65, 4); g.stroke();
});
texSlot.wrapS = texSlot.wrapT = THREE.ClampToEdgeWrapping;
var texBanner = ctex(1024, 160, function (g, w, h) {
  g.fillStyle = '#0d1016'; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 64; i++) { g.fillStyle = i % 2 ? '#f1f1f1' : '#14171d'; g.fillRect(i * 16, 0, 16, 14); g.fillStyle = i % 2 ? '#14171d' : '#f1f1f1'; g.fillRect(i * 16, h - 14, 16, 14); }
  g.fillStyle = '#f4f6f8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 64px Arial Black, Arial, sans-serif'; g.fillText('START / FINISH', w * 0.36, h / 2 + 2);
  g.direction = 'rtl'; g.fillStyle = '#56c8ff'; g.font = '700 58px Tajawal, Arial, sans-serif'; g.fillText('البداية والنهاية', w * 0.79, h / 2 + 2);
});
var texSign = function (txt, bg) {
  return ctex(512, 192, function (g, w, h) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = '#fff'; g.font = '800 92px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 - 6);
  });
};
var texPuff = (function () {
  var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
  var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

/* ---- clouds ---- */
(function () {
  var c = document.createElement('canvas'); c.width = 256; c.height = 96; var g = c.getContext('2d');
  for (var i = 0; i < 26; i++) {
    var x = 40 + rand() * 176, y = 40 + rand() * 24, r = 16 + rand() * 26;
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,244,232,0.55)'); gr.addColorStop(1, 'rgba(255,244,232,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 96);
  }
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  for (var k = 0; k < 16; k++) {
    var a = rand() * Math.PI * 2, el = 0.12 + rand() * 0.35, R = 3000;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true, depthWrite: false, opacity: 0.55 + rand() * 0.3 }));
    sp.position.set(Math.cos(a) * R * Math.cos(el), Math.sin(el) * R, Math.sin(a) * R * Math.cos(el));
    sp.scale.set(900 + rand() * 900, 320 + rand() * 240, 1); scene.add(sp);
  }
})();

/* ---- ground ---- */
var ground = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ map: texGrass, roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(200, -0.1, 240); ground.receiveShadow = true; scene.add(ground);

/* ---- render samples (finer than the sim samples) ---- */
var M = 1800, R = [], G = null, TH = null;
function buildSamples() {
  R = [];
  for (var i = 0; i < M; i++) {
    var tt = (T.t0 + i / M) % 1, p = T.curve.getPointAt(tt), tg = T.curve.getTangentAt(tt), m = Math.hypot(tg.x, tg.z);
    var tx = tg.x / m, tz = tg.z / m;
    R.push({ x: p.x, z: p.z, tx: tx, tz: tz, nx: tz, nz: -tx, s: i * T.L / M, k: S[Math.floor(i * N / M)].k });
  }
}
function texLen(len) { return T.L / Math.max(1, Math.round(T.L / len)); }

function ribbon(a, b, y, vLen, filter) {
  var pos = [], uv = [], ind = [], nor = [];
  for (var i = 0; i < M; i++) {
    if (filter && !filter(i)) continue;
    var p = R[i], q = R[(i + 1) % M], s0 = p.s, s1 = i + 1 === M ? T.L : q.s, base = pos.length / 3;
    pos.push(p.x + p.nx * a, y, p.z + p.nz * a, p.x + p.nx * b, y, p.z + p.nz * b, q.x + q.nx * a, y, q.z + q.nz * a, q.x + q.nx * b, y, q.z + q.nz * b);
    uv.push(0, s0 / vLen, 1, s0 / vLen, 0, s1 / vLen, 1, s1 / vLen);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    ind.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}
function wallStrip(off, h, vLen, side) {
  var pos = [], uv = [], ind = [], nor = [];
  for (var i = 0; i < M; i++) {
    var p = R[i], q = R[(i + 1) % M], s0 = p.s, s1 = i + 1 === M ? T.L : q.s, base = pos.length / 3;
    pos.push(p.x + p.nx * off, 0, p.z + p.nz * off, p.x + p.nx * off, h, p.z + p.nz * off, q.x + q.nx * off, 0, q.z + q.nz * off, q.x + q.nx * off, h, q.z + q.nz * off);
    uv.push(s0 / vLen, 0, s0 / vLen, 1, s1 / vLen, 0, s1 / vLen, 1);
    var nx = -p.nx * side, nz = -p.nz * side;
    for (var k = 0; k < 4; k++) nor.push(nx, 0, nz);
    ind.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}

function buildTrackMeshes() {
  var road = new THREE.Mesh(ribbon(-RS.HW, RS.HW, 0.0, texLen(17), null), new THREE.MeshStandardMaterial({ map: texAsphalt, roughness: 0.86, metalness: 0 }));
  road.receiveShadow = true; G.add(road);

  var flag = new Uint8Array(M), i, j;
  for (i = 0; i < M; i++) if (R[i].k > 0.0032) flag[i] = 1;
  var f2 = new Uint8Array(M);
  for (i = 0; i < M; i++) if (flag[i]) for (j = -12; j <= 12; j++) f2[(i + j + M) % M] = 1;
  var curbMat = new THREE.MeshStandardMaterial({ map: texCurb, roughness: 0.7 });
  var plainMat = new THREE.MeshStandardMaterial({ color: 0x8d9196, roughness: 0.9 });
  [[RS.HW, RS.HW + RS.CURB_W], [-RS.HW - RS.CURB_W, -RS.HW]].forEach(function (ab) {
    var c1 = new THREE.Mesh(ribbon(ab[0], ab[1], 0.012, texLen(3.2), function (k) { return f2[k]; }), curbMat);
    var c2 = new THREE.Mesh(ribbon(ab[0], ab[1], 0.008, 10, function (k) { return !f2[k]; }), plainMat);
    c1.receiveShadow = c2.receiveShadow = true; G.add(c1); G.add(c2);
  });
  var gravelMat = new THREE.MeshStandardMaterial({ map: texGravel, roughness: 1 });
  [[RS.HW + RS.CURB_W, RS.WALL_D], [-RS.WALL_D, -RS.HW - RS.CURB_W]].forEach(function (ab) {
    var gm = new THREE.Mesh(ribbon(ab[0], ab[1], 0.004, 24, null), gravelMat);
    gm.receiveShadow = true; G.add(gm);
  });
  var wallMat = new THREE.MeshStandardMaterial({ map: texBarrier, roughness: 0.8, side: THREE.DoubleSide });
  var capMat = new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.8 });
  [1, -1].forEach(function (side) {
    G.add(new THREE.Mesh(wallStrip(side * RS.WALL_D, 1.15, texLen(24) * 1.0, side), wallMat));
    var a = side * RS.WALL_D - 0.25, b = side * RS.WALL_D + 0.25;
    var cap = new THREE.Mesh(ribbon(Math.min(a, b), Math.max(a, b), 1.15, 10, null), capMat); G.add(cap);
  });
}

/* ---- start line, grid, gantry ---- */
function slotPos(slot) {
  var row = Math.floor(slot / 2), col = slot % 2, m = 12 + row * 11, back = Math.round(m / ds);
  var idx = (N - back) % N, s = S[idx], lat = col === 0 ? 3.4 : -3.4;
  return { x: s.x + s.nx * lat, z: s.z + s.nz * lat, h: s.h };
}
function buildStart() {
  gLights.length = 0;
  var s0 = S[0];
  var line = new THREE.Mesh(new THREE.PlaneGeometry(RS.HW * 2, 1.2), new THREE.MeshBasicMaterial({ map: texChecker }));
  line.rotation.x = -Math.PI / 2; line.rotation.z = Math.PI / 2 - s0.h + Math.PI / 2; // orient later
  line.rotation.set(-Math.PI / 2, 0, 0); line.rotation.order = 'YXZ'; line.rotation.y = s0.h;
  line.position.set(s0.x, 0.02, s0.z); G.add(line);
  for (var k = 0; k < 12; k++) {
    var p = slotPos(k);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 5.4), new THREE.MeshBasicMaterial({ map: texSlot, transparent: true, depthWrite: false }));
    m.rotation.order = 'YXZ'; m.rotation.x = -Math.PI / 2; m.rotation.y = p.h; m.position.set(p.x, 0.02, p.z); G.add(m);
  }
  var g = new THREE.Group(); g.position.set(s0.x, 0, s0.z); g.rotation.y = s0.h; G.add(g);
  var steel = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.5, metalness: 0.6 });
  var half = RS.HW + RS.CURB_W + 1.4;
  [-half, half].forEach(function (x) { var pl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9, 1.1), steel); pl.position.set(x, 4.5, 0); pl.castShadow = true; g.add(pl); });
  var beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1.1, 1.0, 1.1), steel); beam.position.set(0, 8.7, 0); beam.castShadow = true; g.add(beam);
  var ban = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 - 1.2, 2.6), new THREE.MeshBasicMaterial({ map: texBanner, side: THREE.DoubleSide }));
  ban.position.set(0, 6.9, 0); ban.rotation.y = Math.PI; g.add(ban);
  var box = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.6 }));
  box.position.set(0, 5.1, 0.0); g.add(box);
  for (var i = 0; i < 5; i++) {
    var mat = new THREE.MeshBasicMaterial({ color: 0x330606 });
    var l1 = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), mat);
    l1.position.set(-3.6 + i * 1.8, 5.1, 0.36); g.add(l1);
    var l2 = l1.clone(); l2.material = mat; l2.position.z = -0.36; l2.rotation.y = Math.PI; g.add(l2);
    gLights.push(mat);
  }
}

/* ---- grandstands, pit building, billboards ---- */
function buildStands() {
  var s0 = S[0];
  function frame(offLat, idxShift) {
    var g = new THREE.Group(), i = (N + idxShift) % N, s = S[i];
    g.position.set(s.x + s.nx * offLat, 0, s.z + s.nz * offLat); g.rotation.y = s.h; G.add(g); return g;
  }
  var side = 1, off = RS.WALL_D + 5;
  var g = frame(off, -2); // main grandstand
  var concrete = new THREE.MeshStandardMaterial({ color: 0x9a9fa6, roughness: 0.9 });
  var crowd = new THREE.MeshStandardMaterial({ map: texCrowd, roughness: 1 });
  texCrowd.repeat.set(10, 1);
  for (var t = 0; t < 6; t++) {
    var step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2 + t * 1.2, 150), concrete);
    step.position.set(t * 3.2 + 1.6, (1.2 + t * 1.2) / 2, 0); step.receiveShadow = true; step.castShadow = true; g.add(step);
    var cr = new THREE.Mesh(new THREE.PlaneGeometry(150, 1.1), crowd);
    cr.rotation.y = -Math.PI / 2; cr.position.set(t * 3.2 + 0.02, 1.2 + t * 1.2 + 0.55, 0); g.add(cr);
  }
  var roof = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 156), new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.6 }));
  roof.position.set(10, 12.5, 0); roof.rotation.z = 0.06; roof.castShadow = true; g.add(roof);
  for (var p = -3; p <= 3; p++) { var post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 0.5), concrete); post.position.set(19, 6, p * 24); g.add(post); }
  // pit building on the opposite side
  var pg = frame(-(RS.WALL_D + 6), -2);
  var pit = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 170), new THREE.MeshStandardMaterial({ map: texPit, roughness: 0.7 }));
  texPit.repeat.set(1, 1); pit.position.set(-4.5, 3, 0); pit.castShadow = true; pit.receiveShadow = true; pg.add(pit);
  var pr = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 172), new THREE.MeshStandardMaterial({ color: 0x20252c, roughness: 0.6 }));
  pr.position.set(-4.5, 6.2, 0); pg.add(pr);
  // billboards
  var names = [['NOVA', '#0d47a1'], ['VELOCE', '#b71c1c'], ['TURBO-X', '#1b1d23'], ['APEX', '#e08e00'], ['FULCRUM', '#0f766e'], ['NOVA', '#6a1b9a']];
  var idxs = [90, 200, 330, 450, 560, 650];
  idxs.forEach(function (ix, n) {
    var s = S[ix % N], sd = n % 2 ? -1 : 1, o = sd * (RS.WALL_D + 7);
    var bg = new THREE.Group(); bg.position.set(s.x + s.nx * o, 0, s.z + s.nz * o); bg.rotation.y = s.h + (sd > 0 ? Math.PI / 2 : -Math.PI / 2) * 0 ; G.add(bg);
    bg.rotation.y = s.h;
    var board = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.6, 12), new THREE.MeshBasicMaterial({ color: 0x20242b }));
    var face = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.2), new THREE.MeshBasicMaterial({ map: texSign(names[n][0], names[n][1]) }));
    face.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; face.position.set(sd > 0 ? -0.22 : 0.22, 0, 0);
    var grp = new THREE.Group(); grp.add(board); grp.add(face); grp.position.y = 5; bg.add(grp);
    [-4.5, 4.5].forEach(function (z) { var leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), concrete); leg.position.set(0, 2.5, z); bg.add(leg); });
  });
}

/* ---- trees and hills ---- */
function buildNature() {
  var cand = [], i, k;
  var minD = RS.WALL_D + 9;
  function farFromTrack(x, z, d) {
    for (var j = 0; j < N; j += 2) { var dx = x - S[j].x, dz = z - S[j].z; if (dx * dx + dz * dz < d * d) return false; }
    return true;
  }
  var count = 0;
  while (cand.length < TH.trees && count++ < 9000 + TH.trees * 5) {
    var x = BB.x0 - 350 + rand() * (BB.x1 - BB.x0 + 700), z = BB.z0 - 350 + rand() * (BB.z1 - BB.z0 + 700);
    if (!farFromTrack(x, z, minD + rand() * 55)) continue;
    cand.push([x, z, 0.8 + rand() * 0.9, rand()]);
  }
  var trunkG = new THREE.CylinderGeometry(0.28, 0.4, 2.6, 6); trunkG.translate(0, 1.3, 0);
  var pineG = new THREE.ConeGeometry(2.3, 7, 7); pineG.translate(0, 6, 0);
  var roundG = new THREE.IcosahedronGeometry(2.6, 0); roundG.translate(0, 4.6, 0);
  var pines = cand.filter(function (c) { return c[3] < TH.pine; }), rounds = cand.filter(function (c) { return c[3] >= TH.pine; });
  var trunkM = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x5a4330 }), cand.length);
  var pineM = new THREE.InstancedMesh(pineG, new THREE.MeshLambertMaterial({ color: 0xffffff }), pines.length);
  var roundM = new THREE.InstancedMesh(roundG, new THREE.MeshLambertMaterial({ color: 0xffffff }), rounds.length);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3(), pos3 = new THREE.Vector3(), col = new THREE.Color();
  var up = new THREE.Vector3(0, 1, 0);
  cand.forEach(function (c, n) {
    q.setFromAxisAngle(up, c[3] * 20); sc3.set(c[2], c[2], c[2]); pos3.set(c[0], 0, c[1]);
    m4.compose(pos3, q, sc3); trunkM.setMatrixAt(n, m4);
  });
  pines.forEach(function (c, n) {
    q.setFromAxisAngle(up, c[3] * 20); sc3.set(c[2], c[2] * (0.9 + c[3] * 0.4), c[2]); pos3.set(c[0], 0, c[1]);
    m4.compose(pos3, q, sc3); pineM.setMatrixAt(n, m4); col.setHSL(0.32 + c[3] * 0.05, 0.45, 0.16 + c[3] * 0.08); pineM.setColorAt(n, col);
  });
  rounds.forEach(function (c, n) {
    q.setFromAxisAngle(up, c[3] * 20); sc3.set(c[2], c[2], c[2]); pos3.set(c[0], 0, c[1]);
    m4.compose(pos3, q, sc3); roundM.setMatrixAt(n, m4); col.setHSL(0.24 + c[3] * 0.08, 0.42, 0.24 + c[3] * 0.1); roundM.setColorAt(n, col);
  });
  G.add(trunkM); G.add(pineM); G.add(roundM);
  var hillM = new THREE.MeshLambertMaterial({ color: TH.hill });
  for (k = 0; k < 26; k++) {
    var a = (k / 26) * Math.PI * 2 + rand() * 0.2, r = 2300 + rand() * 700;
    var h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hillM);
    h.scale.set(380 + rand() * 420, 120 + rand() * 260, 380 + rand() * 420);
    h.position.set(BB.cx + Math.cos(a) * r, 10, BB.cz + Math.sin(a) * r); G.add(h);
  }
  if (TH.rocks) {
    var rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), TH.rocks), rn = 0, tries = 0;
    while (rn < TH.rocks && tries++ < TH.rocks * 12) {
      var rx = BB.x0 - 300 + rand() * (BB.x1 - BB.x0 + 600), rz = BB.z0 - 300 + rand() * (BB.z1 - BB.z0 + 600);
      if (!farFromTrack(rx, rz, minD + 3 + rand() * 40)) continue;
      var rs = 1.2 + rand() * rand() * 7; sc3.set(rs * (1 + rand()), rs * (0.5 + rand() * 0.6), rs * (1 + rand())); pos3.set(rx, rs * 0.25, rz);
      q.setFromAxisAngle(up, rand() * 6); m4.compose(pos3, q, sc3); rockM.setMatrixAt(rn, m4); col.setHSL(0.08 + rand() * 0.04, 0.35, 0.34 + rand() * 0.16); rockM.setColorAt(rn, col); rn++;
    }
    rockM.count = rn; G.add(rockM);
  }
}


/* ---- themes and track switching ---- */
var THEMES = {
  meadow: { ground: 0xffffff, sand: false, fog: 0xcfae8c, sun: 0xffd7a3, trees: 700, pine: 0.55, hill: 0x6b7b58, rocks: 0 },
  plain: { ground: 0xf0efc8, sand: false, fog: 0xd8bf9a, sun: 0xffddb0, trees: 150, pine: 0.3, hill: 0x8d916b, rocks: 40 },
  forest: { ground: 0x9fbf8c, sand: false, fog: 0xa8b293, sun: 0xffe2bd, trees: 1800, pine: 0.7, hill: 0x4a6446, rocks: 0 },
  desert: { ground: 0xffffff, sand: true, fog: 0xe3b98a, sun: 0xffc98a, trees: 0, pine: 0.5, hill: 0xb68a58, rocks: 180 }
};
var texSand = ctex(512, 512, function (g, w, h) {
  g.fillStyle = '#d7bd85'; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 9000; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(150,110,60,' + (0.06 + rand() * 0.16) + ')' : 'rgba(250,230,175,' + (0.08 + rand() * 0.2) + ')'; g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3); }
}, 500, 500);
function applyTheme() {
  ground.material.map = TH.sand ? texSand : texGrass; ground.material.color.setHex(TH.ground); ground.material.needsUpdate = true;
  scene.fog.color.setHex(TH.fog); sun.color.setHex(TH.sun);
}
var TRACK_CACHE = {}, curTrackId = null;
function disposeGroup(g) {
  g.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
  });
}
function getTrackDef(id) { return RS.TRACKS.filter(function (t) { return t.id === id; })[0] || RS.TRACKS[0]; }
function loadTrack(id) {
  var def = getTrackDef(id);
  if (curTrackId === def.id) return def;
  curTrackId = def.id;
  T = TRACK_CACHE[def.id] || (TRACK_CACHE[def.id] = RS.buildTrack(def)); S = T.S; N = T.N; ds = T.ds;
  if (G) { scene.remove(G); disposeGroup(G); }
  G = new THREE.Group(); scene.add(G);
  TH = THEMES[def.theme] || THEMES.meadow; seed = 777 + def.id.length * 131;
  var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  S.forEach(function (s) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); });
  BB = { x0: x0, x1: x1, z0: z0, z1: z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
  ground.position.set(BB.cx, -0.1, BB.cz);
  applyTheme(); buildSamples(); buildTrackMeshes(); buildStart(); buildStands(); buildNature();
  return def;
}

window.addEventListener('resize', onResize);
function onResize() {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (window.__onResizeHook) window.__onResizeHook(w, h);
}
