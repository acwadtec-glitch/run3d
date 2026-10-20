/* ===== car model (original hypercar design, no logos) ===== */
var MAT = {
  carbon: new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.5, metalness: 0.4, envMap: envTex, envMapIntensity: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x05080c, roughness: 0.06, metalness: 0.95, envMap: envTex, envMapIntensity: 1.5 }),
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

function makeCarView(colorHex, num) {
  var root = new THREE.Group(); root.rotation.order = 'YXZ';
  var body = new THREE.Group(); root.add(body);
  var paint = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colorHex).convertSRGBToLinear(), metalness: 0.5, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMap: envTex, envMapIntensity: 0.6 });
  var parts = [];
  function add(m, cast) { body.add(m); if (cast !== false) m.castShadow = true; parts.push(m); return m; }

  add(loft(BODY_SECS, 22, paint));
  // blended fenders over the wheels
  var FEND_F = [[2.15, 0.12, 0.40, 0.50], [1.95, 0.24, 0.46, 0.64], [1.55, 0.31, 0.50, 0.78], [1.10, 0.28, 0.52, 0.72], [0.78, 0.16, 0.54, 0.64]];
  var FEND_R = [[-0.85, 0.16, 0.56, 0.70], [-1.15, 0.28, 0.58, 0.88], [-1.5, 0.32, 0.62, 0.94], [-1.95, 0.28, 0.62, 0.86], [-2.32, 0.14, 0.58, 0.72]];
  [0.84, -0.84].forEach(function (x) {
    var a = loft(FEND_F, 16, paint); a.position.x = x; add(a);
    var b = loft(FEND_R, 16, paint); b.position.x = x; add(b);
  });
  add(loft(CAN_SECS, 18, MAT.glass));
  // dorsal fin
  var sh = new THREE.Shape(); sh.moveTo(-0.7, 0.95); sh.lineTo(-1.2, 1.18); sh.lineTo(-2.35, 1.12); sh.lineTo(-2.35, 0.6); sh.lineTo(-0.7, 0.6); sh.closePath();
  var fg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }); fg.translate(0, 0, -0.025); fg.rotateY(-Math.PI / 2);
  add(new THREE.Mesh(fg, paint));
  // rear wing
  var wing = box(1.75, 0.04, 0.46, MAT.carbon, 0, 1.13, -2.32); wing.rotation.x = 0.1; add(wing);
  var flap = box(1.75, 0.03, 0.2, paint, 0, 1.2, -2.42); flap.rotation.x = 0.28; add(flap);
  add(box(0.04, 0.34, 0.74, MAT.carbon, 0.89, 1.04, -2.32)); add(box(0.04, 0.34, 0.74, MAT.carbon, -0.89, 1.04, -2.32));
  add(box(0.05, 0.46, 0.22, MAT.carbon, 0.32, 0.86, -2.26)); add(box(0.05, 0.46, 0.22, MAT.carbon, -0.32, 0.86, -2.26));
  // splitter, diffuser, underbody, intakes, mirrors
  add(box(1.72, 0.03, 0.55, MAT.carbon, 0, 0.1, 2.28));
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
  // number decals
  var ntex = numberTex(num);
  [1, -1].forEach(function (sd) {
    var d = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: ntex, transparent: true }));
    d.rotation.y = sd * Math.PI / 2; d.position.set(sd * 0.934, 0.4, 0.3); body.add(d);
  });
  var nd = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: ntex, transparent: true }));
  nd.rotation.x = -Math.PI / 2; nd.rotation.z = 0; nd.position.set(0, 0.5, 1.78); nd.rotation.order = 'YXZ'; body.add(nd);
  // wheels
  var wheels = [];
  [[0.84, 1.55, 0.36, 0.32], [-0.84, 1.55, 0.36, 0.32], [0.84, -1.45, 0.38, 0.40], [-0.84, -1.45, 0.38, 0.40]].forEach(function (w, i) {
    var wh = makeWheel(w[2], w[3]); wh.pivot.position.set(w[0], w[2], w[1]); wh.front = i < 2; body.add(wh.pivot); wheels.push(wh);
  });
  // exhaust flames
  var flames = [];
  [0.32, -0.32].forEach(function (x) {
    var cg = new THREE.ConeGeometry(0.1, 0.95, 10); cg.translate(0, 0.475, 0); cg.rotateX(-Math.PI / 2);
    var f = new THREE.Mesh(cg, MAT.flame); f.position.set(x, 0.42, -2.5); f.visible = false; body.add(f); flames.push(f);
  });
  // contact shadow
  var cs = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 6.2), new THREE.MeshBasicMaterial({ map: texShadow, transparent: true, depthWrite: false }));
  cs.rotation.x = -Math.PI / 2; cs.position.set(0, 0.025, -0.05); root.add(cs);

  return {
    root: root, body: body, paint: paint, wheels: wheels, flames: flames, tail: tailMat, parts: parts,
    roll: 0, pitch: 0, lastVf: 0, ax: 0, bump: 0,
    setColor: function (hex) { paint.color.setHex(hex).convertSRGBToLinear(); }
  };
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
