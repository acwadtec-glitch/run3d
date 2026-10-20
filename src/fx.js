/* ===== particles (smoke, sparks, dust) and audio ===== */
var PN = 600, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN), pAlpha = new Float32Array(PN);
var pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pMax = new Float32Array(PN), pS0 = new Float32Array(PN), pGrow = new Float32Array(PN), pA0 = new Float32Array(PN), pGrav = new Float32Array(PN);
var pHead = 0;
var pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('col', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
var pMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: texPuff }, scale: { value: 600 } }, transparent: true, depthWrite: false,
  vertexShader: 'attribute vec3 col; attribute float size; attribute float alpha; uniform float scale; varying vec3 vC; varying float vA; void main(){ vC = col; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }'
});
var points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);

function emit(x, y, z, vx, vy, vz, life, size, grow, alpha, r, g, b, grav) {
  var i = pHead; pHead = (pHead + 1) % PN;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  pLife[i] = pMax[i] = life; pS0[i] = size; pGrow[i] = grow; pA0[i] = alpha; pGrav[i] = grav || 0;
  pCol[i * 3] = r; pCol[i * 3 + 1] = g; pCol[i * 3 + 2] = b; pSize[i] = size; pAlpha[i] = alpha;
}
function updateParticles(dt) {
  for (var i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) { pAlpha[i] = 0; pSize[i] = 0; continue; }
    var k = pLife[i] / pMax[i], d = 1 - Math.min(1, 1.6 * dt);
    pVel[i * 3] *= d; pVel[i * 3 + 1] = pVel[i * 3 + 1] * d - pGrav[i] * dt; pVel[i * 3 + 2] *= d;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] = Math.max(0.03, pPos[i * 3 + 1] + pVel[i * 3 + 1] * dt); pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    pSize[i] = pS0[i] + pGrow[i] * (1 - k); pAlpha[i] = pA0[i] * k;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.size.needsUpdate = true; pGeo.attributes.alpha.needsUpdate = true;
}
function carFx(c, dt) {
  var fx = Math.sin(c.h), fz = Math.cos(c.h), a = Math.abs(c.off), gravel = a > RS.HW + RS.CURB_W;
  var vf = c.vx * fx + c.vz * fz;
  if ((c.slip > 5.5 && c.speed > 12) || (gravel && c.speed > 10)) {
    var n = Math.min(3, Math.ceil(dt * 90));
    for (var i = 0; i < n; i++) {
      var sd = Math.random() < 0.5 ? 1 : -1, bx = c.x - fx * 1.45 + fz * 0.84 * sd, bz = c.z - fz * 1.45 - fx * 0.84 * sd;
      if (gravel) emit(bx, 0.2, bz, (Math.random() - 0.5) * 3 - c.vx * 0.1, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3 - c.vz * 0.1, 0.9, 0.9, 2.6, 0.5, 0.72, 0.64, 0.5, 0);
      else emit(bx, 0.15, bz, (Math.random() - 0.5) * 2 - c.vx * 0.05, 0.8 + Math.random(), (Math.random() - 0.5) * 2 - c.vz * 0.05, 1.1, 0.8, 3.2, 0.34, 0.86, 0.86, 0.88, 0);
    }
  }
  if (c.hit > 0.35 && Math.random() < 0.7) {
    for (var s = 0; s < 4; s++) emit(c.x + (Math.random() - 0.5) * 2, 0.4, c.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 14, 2 + Math.random() * 5, (Math.random() - 0.5) * 14, 0.5, 0.18, -0.1, 1, 1, 0.72, 0.3, 14);
  }
  if (c.boosting && Math.random() < 0.6) emit(c.x - fx * 2.8, 0.45, c.z - fz * 2.8, -c.vx * 0.2, 0.2, -c.vz * 0.2, 0.28, 0.45, 0.7, 0.55, 0.45, 0.7, 1, 0);
}

/* ---- audio ---- */
var AU = { ctx: null, muted: false };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    var c = AU.ctx = new C();
    AU.master = c.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.55; AU.master.connect(c.destination);
    AU.o1 = c.createOscillator(); AU.o1.type = 'sawtooth';
    AU.o2 = c.createOscillator(); AU.o2.type = 'square';
    AU.o3 = c.createOscillator(); AU.o3.type = 'sine';
    var g2 = c.createGain(); g2.gain.value = 0.45;
    AU.f = c.createBiquadFilter(); AU.f.type = 'lowpass'; AU.f.frequency.value = 700; AU.f.Q.value = 2;
    AU.eg = c.createGain(); AU.eg.gain.value = 0;
    AU.o1.connect(AU.f); AU.o2.connect(g2); g2.connect(AU.f); AU.f.connect(AU.eg); AU.eg.connect(AU.master);
    AU.tg = c.createGain(); AU.tg.gain.value = 0; AU.o3.connect(AU.tg); AU.tg.connect(AU.master);
    AU.o1.start(); AU.o2.start(); AU.o3.start();
    var buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = buf;
    function loopNoise(freq, q) {
      var s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      var g = c.createGain(); g.gain.value = 0; s.connect(bp); bp.connect(g); g.connect(AU.master); s.start(); return { g: g, bp: bp };
    }
    AU.wind = loopNoise(500, 0.6); AU.tire = loopNoise(2300, 5);
  } catch (e) { AU.ctx = null; }
}
function audioUpdate(c, run) {
  if (!AU.ctx) return;
  var t = AU.ctx.currentTime;
  if (!run) { AU.eg.gain.setTargetAtTime(0, t, 0.1); AU.wind.g.gain.setTargetAtTime(0, t, 0.1); AU.tire.g.gain.setTargetAtTime(0, t, 0.1); AU.tg.gain.setTargetAtTime(0, t, 0.1); return; }
  var rpm = c.rpm, base = 42 + rpm * 190;
  AU.o1.frequency.setTargetAtTime(base, t, 0.04); AU.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04); AU.o3.frequency.setTargetAtTime(900 + rpm * 1500, t, 0.05);
  AU.f.frequency.setTargetAtTime(380 + rpm * 2300 + (c.boosting ? 600 : 0), t, 0.05);
  AU.eg.gain.setTargetAtTime(0.13 + rpm * 0.1 + (c.boosting ? 0.05 : 0), t, 0.05);
  AU.tg.gain.setTargetAtTime(c.boosting ? 0.012 : (rpm > 0.6 ? 0.004 : 0), t, 0.1);
  AU.wind.g.gain.setTargetAtTime(Math.pow(c.speed / 90, 2) * 0.35, t, 0.1); AU.wind.bp.frequency.setTargetAtTime(400 + c.speed * 9, t, 0.1);
  var sq = (c.slip > 4 && c.speed > 12) ? Math.min(1, (c.slip - 4) / 8) * 0.22 : 0;
  AU.tire.g.gain.setTargetAtTime(sq, t, 0.05);
}
function introSound() {
  if (!AU.ctx) return;
  var c = AU.ctx, t = c.currentTime + 0.03, m = AU.master;
  // engine rev: sawtooth sweep through a opening low-pass, with a second detuned voice
  [1, 1.5].forEach(function (k, i) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = i ? 'square' : 'sawtooth'; f.type = 'lowpass'; f.Q.value = 3;
    o.frequency.setValueAtTime(48 * k, t); o.frequency.exponentialRampToValueAtTime(190 * k, t + 0.9); o.frequency.exponentialRampToValueAtTime(95 * k, t + 1.15); o.frequency.exponentialRampToValueAtTime(260 * k, t + 1.9);
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3200, t + 1.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i ? 0.05 : 0.14, t + 0.25); g.gain.setValueAtTime(i ? 0.05 : 0.14, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    o.connect(f); f.connect(g); g.connect(m); o.start(t); o.stop(t + 2.4);
  });
  // whoosh: band-passed noise sweeping up
  if (AU.noise) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
    s.buffer = AU.noise; bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t + 0.2); bp.frequency.exponentialRampToValueAtTime(4200, t + 1.6);
    ng.gain.setValueAtTime(0.0001, t + 0.2); ng.gain.exponentialRampToValueAtTime(0.22, t + 1.3); ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    s.connect(bp); bp.connect(ng); ng.connect(m); s.start(t + 0.2); s.stop(t + 2.2);
  }
  // stinger: bright minor chord hit then a rising arpeggio
  [220, 261.63, 329.63, 440].forEach(function (fr, i) {
    var o = c.createOscillator(), g = c.createGain(), tt = t + 1.55 + i * 0.07;
    o.type = 'triangle'; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.16, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.4);
    o.connect(g); g.connect(m); o.start(tt); o.stop(tt + 1.5);
  });
  [659.25, 880, 1318.5].forEach(function (fr, i) {
    var o = c.createOscillator(), g = c.createGain(), tt = t + 1.95 + i * 0.1;
    o.type = 'sine'; o.frequency.value = fr;
    g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.12, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.9);
    o.connect(g); g.connect(m); o.start(tt); o.stop(tt + 1);
  });
  // sub thump
  var k = c.createOscillator(), kg = c.createGain();
  k.type = 'sine'; k.frequency.setValueAtTime(110, t + 1.55); k.frequency.exponentialRampToValueAtTime(38, t + 1.9);
  kg.gain.setValueAtTime(0.0001, t + 1.55); kg.gain.exponentialRampToValueAtTime(0.5, t + 1.57); kg.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
  k.connect(kg); kg.connect(m); k.start(t + 1.55); k.stop(t + 2.05);
}
function blip(freq, dur, type, vol) {
  if (!AU.ctx) return;
  var c = AU.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.02);
}
function crashSound(v) {
  if (!AU.ctx || !AU.noise) return;
  var c = AU.ctx, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(), t = c.currentTime;
  s.buffer = AU.noise; f.type = 'lowpass'; f.frequency.value = 900;
  g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t); s.stop(t + 0.45);
}
function setMuted(m) { AU.muted = m; if (AU.master) AU.master.gain.value = m ? 0 : 0.55; }
