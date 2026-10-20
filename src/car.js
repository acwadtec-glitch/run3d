/* ===== car model (original hypercar design, no logos) ===== */
var MAT = {
  carbon: new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.5, metalness: 0.4, envMap: envTex, envMapIntensity: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: 0.06, metalness: 0.9, envMap: envTex, envMapIntensity: 1.4, transparent: true, opacity: 0.58 }),
  led: new THREE.MeshBasicMaterial({ color: 0xe6f6ff }),
  blue: new THREE.MeshBasicMaterial({ color: 0x56c8ff }),
  rimMetal: new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.35, metalness: 0.85, envMap: envTex }),
  flame: new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
};
var texTread = ctex(64, 32, function (g, w, h) {
  g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#202226' : '#101113'; g.fillRect(i * 4, 0, 4, h); }
  g.fillStyle = '#2b2d31'; g.fillRect(0, h * 0.45, w, 2);
}, 1, 1);
var texRim = ctex(128, 128, function (g, w, h) {
  g.fillStyle = '#15181d'; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
  g.strokeStyle = '#7f8a97'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 59, 0, 7); g.stroke();
  g.fillStyle = '#272c33';
  for (var i = 0; i < 10; i++) {
    g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 5);
    g.beginPath(); g.moveTo(-6, -14); g.lineTo(6, -14); g.lineTo(10, -56); g.lineTo(-10, -56); g.closePath(); g.fill();
    g.strokeStyle = '#59616c'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  g.fillStyle = '#56c8ff'; g.beginPath(); g.arc(64, 64, 9, 0, 7); g.fill();
  g.fillStyle = '#0c0e11'; g.beginPath(); g.arc(64, 64, 4, 0, 7); g.fill();
}, 1, 1);
texRim.wrapS = texRim.wrapT = THREE.ClampToEdgeWrapping;
var texShadow = (function () {
  var c = document.createElement('canvas'); c.width = 64; c.height = 128; var g = c.getContext('2d');
  var gr = g.createRadialGradient(32, 64, 4, 32, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(32, 64); g.scale(0.52, 1); g.translate(-32, -64); g.fillStyle = gr; g.fillRect(-40, 0, 144, 128); g.restore();
  return new THREE.CanvasTexture(c);
})();
function numberTex(n) {
  return ctex(128, 128, function (g, w, h) {
    g.fillStyle = '#f4f6f8'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = '#0d1016'; g.font = '900 70px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 64, 70);
  }, 1, 1);
}
function sgn(v) { return v < 0 ? -1 : 1; }
function loft(secs, seg, mat) {
  secs = secs.slice().sort(function (a, b) { return a[0] - b[0]; });
  var pos = [], ind = [], n = secs.length, i, j;
  for (i = 0; i < n; i++) {
    var z = secs[i][0], hw = secs[i][1], yb = secs[i][2], yt = secs[i][3], yc = (yb + yt) / 2, hh = (yt - yb) / 2;
    for (j = 0; j < seg; j++) {
      var th = j / seg * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      pos.push(hw * sgn(c) * Math.pow(Math.abs(c), 0.55), yc + hh * sgn(s) * Math.pow(Math.abs(s), s > 0 ? 0.75 : 0.3), z);
    }
  }
  for (i = 0; i < n - 1; i++) for (j = 0; j < seg; j++) {
    var a = i * seg + j, b = i * seg + (j + 1) % seg, c2 = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
    ind.push(a, b, c2, b, d, c2);
  }
  var cF = pos.length / 3; pos.push(0, (secs[n - 1][2] + secs[n - 1][3]) / 2, secs[n - 1][0]);
  var cB = cF + 1; pos.push(0, (secs[0][2] + secs[0][3]) / 2, secs[0][0]);
  for (j = 0; j < seg; j++) {
    ind.push(cF, (n - 1) * seg + j, (n - 1) * seg + (j + 1) % seg);
    ind.push(cB, (j + 1) % seg, j);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function box(w, h, d, mat, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }

var BODY_SECS = [[2.50, 0.28, 0.15, 0.28], [2.35, 0.60, 0.12, 0.32], [2.10, 0.78, 0.10, 0.40], [1.80, 0.70, 0.10, 0.46], [1.55, 0.60, 0.12, 0.52], [1.25, 0.66, 0.12, 0.58],
  [0.85, 0.88, 0.10, 0.64], [0.30, 0.92, 0.10, 0.62], [-0.30, 0.92, 0.10, 0.62], [-0.80, 0.88, 0.12, 0.66], [-1.15, 0.70, 0.14, 0.72], [-1.45, 0.62, 0.16, 0.80],
  [-1.80, 0.70, 0.18, 0.80], [-2.15, 0.74, 0.22, 0.72], [-2.45, 0.55, 0.30, 0.58], [-2.55, 0.35, 0.34, 0.52]];
var CAN_SECS = [[0.95, 0.40, 0.58, 0.64], [0.60, 0.52, 0.58, 0.98], [0.10, 0.54, 0.58, 1.08], [-0.45, 0.50, 0.60, 1.04], [-0.95, 0.34, 0.62, 0.80]];

function makeWheel(r, w) {
  var pivot = new THREE.Group(), spin = new THREE.Group(); pivot.add(spin);
  var tg = new THREE.CylinderGeometry(r, r, w, 28, 1); tg.rotateZ(Math.PI / 2);
  var tm = new THREE.MeshStandardMaterial({ map: texTread, roughness: 0.92, metalness: 0 });
  var tire = new THREE.Mesh(tg, tm); tire.castShadow = true; spin.add(tire);
  var rg = new THREE.CircleGeometry(r * 0.74, 28), rmat = new THREE.MeshStandardMaterial({ map: texRim, roughness: 0.4, metalness: 0.7, envMap: envTex });
  var a = new THREE.Mesh(rg, rmat); a.rotation.y = Math.PI / 2; a.position.x = w / 2 + 0.003; spin.add(a);
  var b = new THREE.Mesh(rg, rmat); b.rotation.y = -Math.PI / 2; b.position.x = -w / 2 - 0.003; spin.add(b);
  return { pivot: pivot, spin: spin, r: r };
}

/* ---- car looks (4 types) and drivers (6 characters) ---- */
var LOOKS = [
  { sx: 1, sy: 1, sz: 1, rf: 0.36, rr: 0.38, wf: 0.32, wr: 0.40, wing: 'gt', fin: 'dorsal' },
  { sx: 0.95, sy: 1.03, sz: 0.9, rf: 0.35, rr: 0.40, wf: 0.30, wr: 0.42, wing: 'high', fin: 'hoop' },
  { sx: 1.07, sy: 0.9, sz: 1.07, rf: 0.37, rr: 0.40, wf: 0.34, wr: 0.44, wing: 'wide', fin: 'none' },
  { sx: 0.98, sy: 0.95, sz: 1.05, rf: 0.36, rr: 0.38, wf: 0.32, wr: 0.40, wing: 'split', fin: 'twin' }
];
var CAR_INFO = [
  { name: 'فانتوم GT', desc: 'متوازنة في كل حاجة' },
  { name: 'سبرينت', desc: 'خفيفة وسريعة في اللفّات' },
  { name: 'تيتان', desc: 'الأسرع في الطرق المستقيمة' },
  { name: 'فلاش', desc: 'نيترو بيشحن أسرع ويدوم أكتر' }
];
var DRIVERS = [
  { id: 'falcon', name: 'الصقر', tag: 'سرعة وحسم', helmet: '#d62839', stripe: '#f4f6f8', suit: '#1b1f27' },
  { id: 'wolf', name: 'الذئب', tag: 'هادي ومركّز', helmet: '#2e3a46', stripe: '#56c8ff', suit: '#0f1318' },
  { id: 'lion', name: 'الأسد', tag: 'جريء في الدخلات', helmet: '#f0a500', stripe: '#15171b', suit: '#2a1d05' },
  { id: 'storm', name: 'العاصفة', tag: 'بيحب السرعة العالية', helmet: '#6d3fe0', stripe: '#e8ecf1', suit: '#150f26' },
  { id: 'frost', name: 'الجليد', tag: 'أعصاب باردة', helmet: '#e8ecf1', stripe: '#1646d8', suit: '#18202c' },
  { id: 'viper', name: 'الأفعى', tag: 'سريع وخفيف', helmet: '#1f9d6b', stripe: '#0b0d10', suit: '#0d1a14' }
];
function drawHelmet(cv, D) {
  var g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  var bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgba(255,255,255,0.07)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  var cx = w / 2, cy = h * 0.45, rx = w * 0.29, ry = h * 0.33;
  g.fillStyle = D.suit; g.beginPath(); g.moveTo(cx - w * 0.44, h); g.quadraticCurveTo(cx - w * 0.42, h * 0.8, cx - w * 0.16, h * 0.77); g.lineTo(cx + w * 0.16, h * 0.77); g.quadraticCurveTo(cx + w * 0.42, h * 0.8, cx + w * 0.44, h); g.closePath(); g.fill();
  g.fillStyle = D.stripe; g.globalAlpha = 0.85; g.fillRect(cx - w * 0.44, h * 0.93, w * 0.88, h * 0.03); g.globalAlpha = 1;
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.clip();
  g.fillStyle = D.helmet; g.fillRect(0, 0, w, h);
  g.fillStyle = D.stripe; g.fillRect(cx - w * 0.04, 0, w * 0.08, cy - ry * 0.05);
  var sh = g.createRadialGradient(cx - rx * 0.4, cy - ry * 0.5, 2, cx, cy, rx * 1.2); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  g.restore();
  g.fillStyle = '#0a0e13'; g.beginPath();
  if (g.roundRect) g.roundRect(cx - rx * 0.86, cy - ry * 0.02, rx * 1.72, ry * 0.62, 8); else g.rect(cx - rx * 0.86, cy - ry * 0.02, rx * 1.72, ry * 0.62);
  g.fill();
  var vg = g.createLinearGradient(cx - rx, cy, cx + rx, cy + ry * 0.6); vg.addColorStop(0.15, 'rgba(120,180,230,0.0)'); vg.addColorStop(0.35, 'rgba(120,180,230,0.35)'); vg.addColorStop(0.5, 'rgba(120,180,230,0.0)');
  g.fillStyle = vg; g.fillRect(cx - rx * 0.86, cy - ry * 0.02, rx * 1.72, ry * 0.62);
  g.fillStyle = D.helmet; g.globalAlpha = 0.85; g.fillRect(cx - rx * 0.28, cy + ry * 0.66, rx * 0.56, ry * 0.2); g.globalAlpha = 1;
}
var _drvIcons = {};
function driverIcon(i) {
  if (!_drvIcons[i]) { var c = document.createElement('canvas'); c.width = c.height = 48; drawHelmet(c, DRIVERS[i] || DRIVERS[0]); _drvIcons[i] = c.toDataURL(); }
  return _drvIcons[i];
}
var _helmTex = {};
function helmetTex(D) {
  if (!_helmTex[D.id]) _helmTex[D.id] = ctex(128, 64, function (g, w, h) {
    g.fillStyle = D.helmet; g.fillRect(0, 0, w, h); g.fillStyle = D.stripe;
    g.fillRect(w * 0.25 - 6, 0, 12, h); g.fillRect(w * 0.75 - 6, 0, 12, h); g.fillRect(0, h * 0.8, w, 5);
  }, 1, 1);
  return _helmTex[D.id];
}
var visorMat = new THREE.MeshStandardMaterial({ color: 0x06090d, roughness: 0.12, metalness: 0.9, envMap: envTex, envMapIntensity: 1.3 });
function clearGroup(g) { while (g.children.length) { var o = g.children[0]; g.remove(o); o.traverse(function (m) { if (m.geometry) m.geometry.dispose(); }); } }

var _numTexC = {};
function fillBody(v, ti, di) {
  var L = LOOKS[ti] || LOOKS[0], D = DRIVERS[di] || DRIVERS[0], paint = v.paint, body = v.body, num = v.num;
  clearGroup(body);
  var shell = new THREE.Group(); shell.scale.set(L.sx, L.sy, L.sz); body.add(shell);
  var parts = [];
  function add(m, cast) { shell.add(m); if (cast !== false) m.castShadow = true; parts.push(m); return m; }

  add(loft(BODY_SECS, 22, paint));
  var FEND_F = [[2.15, 0.12, 0.40, 0.50], [1.95, 0.24, 0.46, 0.64], [1.55, 0.31, 0.50, 0.78], [1.10, 0.28, 0.52, 0.72], [0.78, 0.16, 0.54, 0.64]];
  var FEND_R = [[-0.85, 0.16, 0.56, 0.70], [-1.15, 0.28, 0.58, 0.88], [-1.5, 0.32, 0.62, 0.94], [-1.95, 0.28, 0.62, 0.86], [-2.32, 0.14, 0.58, 0.72]];
  [0.84, -0.84].forEach(function (x) {
    var a = loft(FEND_F, 16, paint); a.position.x = x; add(a);
    var b = loft(FEND_R, 16, paint); b.position.x = x; add(b);
  });
  add(loft(CAN_SECS, 18, MAT.glass));

  // fins
  if (L.fin === 'dorsal') {
    var sh = new THREE.Shape(); sh.moveTo(-0.7, 0.95); sh.lineTo(-1.2, 1.18); sh.lineTo(-2.35, 1.12); sh.lineTo(-2.35, 0.6); sh.lineTo(-0.7, 0.6); sh.closePath();
    var fg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }); fg.translate(0, 0, -0.025); fg.rotateY(-Math.PI / 2);
    add(new THREE.Mesh(fg, paint));
  } else if (L.fin === 'hoop') {
    add(box(0.06, 0.34, 0.06, MAT.carbon, 0.22, 1.22, -0.55)); add(box(0.06, 0.34, 0.06, MAT.carbon, -0.22, 1.22, -0.55)); add(box(0.5, 0.06, 0.08, MAT.carbon, 0, 1.4, -0.55));
    add(box(0.3, 0.22, 0.55, paint, 0, 0.92, -1.15));
  } else if (L.fin === 'twin') {
    [0.7, -0.7].forEach(function (x) { var f = box(0.04, 0.55, 1.5, paint, x, 1.2, -1.6); f.rotation.z = x > 0 ? -0.08 : 0.08; add(f); });
  }
  // wings
  if (L.wing === 'gt') {
    var wing = box(1.75, 0.04, 0.46, MAT.carbon, 0, 1.13, -2.32); wing.rotation.x = 0.1; add(wing);
    var flap = box(1.75, 0.03, 0.2, paint, 0, 1.2, -2.42); flap.rotation.x = 0.28; add(flap);
    add(box(0.04, 0.34, 0.74, MAT.carbon, 0.89, 1.04, -2.32)); add(box(0.04, 0.34, 0.74, MAT.carbon, -0.89, 1.04, -2.32));
    add(box(0.05, 0.46, 0.22, MAT.carbon, 0.32, 0.86, -2.26)); add(box(0.05, 0.46, 0.22, MAT.carbon, -0.32, 0.86, -2.26));
  } else if (L.wing === 'high') {
    var w1 = box(1.9, 0.045, 0.5, MAT.carbon, 0, 1.42, -2.3); w1.rotation.x = 0.12; add(w1);
    var f1 = box(1.9, 0.03, 0.22, paint, 0, 1.5, -2.42); f1.rotation.x = 0.3; add(f1);
    add(box(0.04, 0.52, 0.8, MAT.carbon, 0.95, 1.28, -2.3)); add(box(0.04, 0.52, 0.8, MAT.carbon, -0.95, 1.28, -2.3));
    add(box(0.05, 0.72, 0.2, MAT.carbon, 0.34, 1.04, -2.2)); add(box(0.05, 0.72, 0.2, MAT.carbon, -0.34, 1.04, -2.2));
  } else if (L.wing === 'wide') {
    var w2 = box(2.1, 0.05, 0.58, MAT.carbon, 0, 1.06, -2.35); w2.rotation.x = 0.06; add(w2);
    add(box(0.05, 0.38, 0.9, MAT.carbon, 1.05, 0.94, -2.35)); add(box(0.05, 0.38, 0.9, MAT.carbon, -1.05, 0.94, -2.35));
    add(box(0.05, 0.3, 0.2, MAT.carbon, 0.4, 0.88, -2.25)); add(box(0.05, 0.3, 0.2, MAT.carbon, -0.4, 0.88, -2.25));
    add(box(0.04, 0.12, 2.4, MAT.carbon, 0.95, 0.15, 0)); add(box(0.04, 0.12, 2.4, MAT.carbon, -0.95, 0.15, 0));
  } else {
    [0.5, -0.5].forEach(function (x) {
      var a = box(0.85, 0.04, 0.42, MAT.carbon, x, 1.18, -2.32); a.rotation.x = 0.1; add(a);
      var b = box(0.85, 0.03, 0.26, paint, x, 1.02, -2.52); b.rotation.x = 0.22; add(b);
    });
    add(box(0.04, 0.46, 0.8, MAT.carbon, 0.96, 1.05, -2.35)); add(box(0.04, 0.46, 0.8, MAT.carbon, -0.96, 1.05, -2.35));
    add(box(0.04, 0.46, 0.8, MAT.carbon, 0.06, 1.05, -2.35)); add(box(0.04, 0.46, 0.8, MAT.carbon, -0.06, 1.05, -2.35));
  }
  // splitter, diffuser, underbody, intakes, mirrors
  add(box(L.wing === 'wide' ? 2.0 : 1.72, 0.03, L.wing === 'wide' ? 0.65 : 0.55, MAT.carbon, 0, 0.1, 2.28));
  var dif = box(1.3, 0.03, 0.6, MAT.carbon, 0, 0.2, -2.38); dif.rotation.x = -0.22; add(dif);
  add(box(1.3, 0.05, 4.5, MAT.carbon, 0, 0.07, -0.1), false);
  add(box(0.04, 0.2, 0.55, MAT.carbon, 0.93, 0.4, 0.5)); add(box(0.04, 0.2, 0.55, MAT.carbon, -0.93, 0.4, 0.5));
  add(box(0.2, 0.07, 0.07, MAT.carbon, 0.6, 0.86, 0.78)); add(box(0.2, 0.07, 0.07, MAT.carbon, -0.6, 0.86, 0.78));
  // lights
  add(box(0.05, 0.17, 0.03, MAT.led, 0.62, 0.28, 2.27), false); add(box(0.05, 0.17, 0.03, MAT.led, -0.62, 0.28, 2.27), false);
  add(box(0.30, 0.016, 0.03, MAT.blue, 0.5, 0.375, 2.26), false); add(box(0.30, 0.016, 0.03, MAT.blue, -0.5, 0.375, 2.26), false);
  var tailMat = new THREE.MeshBasicMaterial({ color: 0x6b0c0c });
  add(box(1.05, 0.05, 0.03, tailMat, 0, 0.56, -2.555), false);
  add(box(0.04, 0.16, 0.03, tailMat, 0.55, 0.42, -2.56), false); add(box(0.04, 0.16, 0.03, tailMat, -0.55, 0.42, -2.56), false);

  // driver: helmet, visor, shoulders and seat visible through the canopy
  var hy = 0.88 * L.sy, helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), new THREE.MeshStandardMaterial({ map: helmetTex(D), roughness: 0.35, metalness: 0.2, envMap: envTex, envMapIntensity: 0.5 }));
  helm.scale.set(1, 1.04, 1.12); helm.position.set(0, hy, 0.04 * L.sz); helm.castShadow = true; body.add(helm);
  var vis = new THREE.Mesh(new THREE.SphereGeometry(0.147, 14, 8, Math.PI / 2 - 0.95, 1.9, 1.1, 0.6), visorMat); vis.scale.copy(helm.scale); vis.position.copy(helm.position); body.add(vis);
  var shoulders = box(0.4, 0.17, 0.18, new THREE.MeshStandardMaterial({ color: new THREE.Color(D.suit).convertSRGBToLinear(), roughness: 0.8 }), 0, 0.72 * L.sy, -0.14 * L.sz); body.add(shoulders);
  body.add(box(0.5, 0.42, 0.1, MAT.carbon, 0, 0.78 * L.sy, -0.36 * L.sz));

  // number decals
  var ntex = _numTexC[num] || (_numTexC[num] = numberTex(num));
  [1, -1].forEach(function (sd) {
    var d = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: ntex, transparent: true }));
    d.rotation.y = sd * Math.PI / 2; d.position.set(sd * 0.934 * L.sx, 0.4 * L.sy, 0.3 * L.sz); body.add(d);
  });
  var nd = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: ntex, transparent: true }));
  nd.rotation.order = 'YXZ'; nd.rotation.x = -Math.PI / 2; nd.position.set(0, 0.5 * L.sy, 1.78 * L.sz); body.add(nd);

  // wheels
  var wheels = [], wx = 0.84 * L.sx;
  [[wx, 1.55 * L.sz, L.rf, L.wf], [-wx, 1.55 * L.sz, L.rf, L.wf], [wx, -1.45 * L.sz, L.rr, L.wr], [-wx, -1.45 * L.sz, L.rr, L.wr]].forEach(function (w, i) {
    var wh = makeWheel(w[2], w[3]); wh.pivot.position.set(w[0], w[2], w[1]); wh.front = i < 2; body.add(wh.pivot); wheels.push(wh);
  });
  var flames = [];
  [0.32, -0.32].forEach(function (x) {
    var cg = new THREE.ConeGeometry(0.1, 0.95, 10); cg.translate(0, 0.475, 0); cg.rotateX(-Math.PI / 2);
    var f = new THREE.Mesh(cg, MAT.flame); f.position.set(x * L.sx, 0.42 * L.sy, -2.5 * L.sz); f.visible = false; body.add(f); flames.push(f);
  });
  v.shell = shell; v.wheels = wheels; v.flames = flames; v.tail = tailMat; v.parts = parts; v.type = ti; v.drv = di;
}

function makeCarView(colorHex, num) {
  var root = new THREE.Group(); root.rotation.order = 'YXZ';
  var body = new THREE.Group(); root.add(body);
  var paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colorHex).convertSRGBToLinear(), metalness: 0.5, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMap: envTex, envMapIntensity: 0.6 });
  var cs = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.2), new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, depthWrite: false }));
  cs.rotation.x = -Math.PI / 2; cs.position.set(0, 0.025, -0.05); root.add(cs);
  var v = {
    root: root, body: body, paint: paint, num: num, type: -1, drv: -1, wheels: [], flames: [], tail: null, parts: [],
    roll: 0, pitch: 0, lastVf: 0, ax: 0, bump: 0,
    setColor: function (hex) { paint.color.setHex(hex).convertSRGBToLinear(); },
    setLook: function (ti, di) { if (v.type !== ti || v.drv !== di) fillBody(v, ti, di); }
  };
  fillBody(v, 0, 0);
  return v;
}

function updateCarView(c, v, dt) {
  var fx = Math.sin(c.h), fz = Math.cos(c.h), vf = c.vx * fx + c.vz * fz;
  v.root.position.set(c.x, 0, c.z); v.root.rotation.y = c.h;
  var dv = dt > 0 ? (vf - v.lastVf) / dt : 0; v.lastVf = vf;
  v.ax += (clamp(dv, -60, 60) - v.ax) * Math.min(1, dt * 7);
  var alat = c.yaw * vf, k = Math.min(1, dt * 7);
  v.roll += (clamp(alat * 0.0014, -0.05, 0.05) - v.roll) * k;
  v.pitch += (clamp(-v.ax * 0.0011, -0.04, 0.04) - v.pitch) * k;
  v.bump += ((c.hit > 0.1 ? (Math.random() - 0.5) * 0.08 * c.hit : 0) - v.bump) * Math.min(1, dt * 20);
  v.body.rotation.z = v.roll; v.body.rotation.x = v.pitch; v.body.position.y = v.bump;
  var steerA = c.steer * 0.5;
  for (var i = 0; i < 4; i++) {
    var w = v.wheels[i]; w.spin.rotation.x += vf / w.r * dt;
    if (w.front) w.pivot.rotation.y = steerA;
  }
  v.tail.color.setHex(c.braking ? 0xff3a3a : 0x6b0c0c);
  for (var f = 0; f < 2; f++) {
    var fl = v.flames[f]; fl.visible = c.boosting;
    if (c.boosting) fl.scale.set(1, 1, 0.75 + Math.random() * 0.45);
  }
}
