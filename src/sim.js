/* ===== sim: track, car physics, AI (no rendering) ===== */
var RS = {};
RS.HW = 8.5;            // half road width (m)
RS.CURB_W = 1.6;
RS.RUNOFF = 8;
RS.WALL_D = RS.HW + RS.CURB_W + RS.RUNOFF;
RS.VTOP = 86;           // m/s  (~310 km/h)
RS.PTS = [[-200,0],[150,0],[420,-10],[600,60],[700,200],[680,340],[560,420],[430,380],[380,280],[300,230],[200,280],[150,400],[60,480],[-80,470],[-200,400],[-300,300],[-330,160],[-300,50]];

RS.wrap = function (a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

RS.buildTrack = function (def) {
  def = def || { pts: RS.PTS, start: [0, 0] };
  var hx = def.start[0], hz = def.start[1];
  var pts = def.pts.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); });
  var curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  var L = curve.getLength(), i;
  var t0 = 0, bd = 1e18;
  for (i = 0; i < 4000; i++) {
    var t = i / 4000, p = curve.getPointAt(t), d = (p.x - hx) * (p.x - hx) + (p.z - hz) * (p.z - hz);
    if (d < bd) { bd = d; t0 = t; }
  }
  var N = 720, ds = L / N, S = [];
  for (i = 0; i < N; i++) {
    var tt = (t0 + i / N) % 1, pp = curve.getPointAt(tt), tg = curve.getTangentAt(tt);
    var tx = tg.x, tz = tg.z, m = Math.hypot(tx, tz); tx /= m; tz /= m;
    S.push({ x: pp.x, z: pp.z, tx: tx, tz: tz, nx: tz, nz: -tx, h: Math.atan2(tx, tz), s: i * ds, k: 0 });
  }
  // curvature
  var k0 = [];
  for (i = 0; i < N; i++) {
    var a = S[(i - 2 + N) % N], b = S[(i + 2) % N];
    var ang = Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
    k0.push(Math.abs(ang) / (4 * ds));
  }
  for (i = 0; i < N; i++) {
    var sum = 0;
    for (var j = -3; j <= 3; j++) sum += k0[(i + j + N) % N];
    S[i].k = sum / 7;
  }
  // speed profile for AI
  var aLat = 36, aBrk = 28, vp = new Float32Array(N);
  for (i = 0; i < N; i++) vp[i] = Math.min(RS.VTOP * 0.97, Math.sqrt(aLat / Math.max(S[i].k, 0.0012)));
  for (var pass = 0; pass < 3; pass++) {
    for (i = N * 2 - 1; i >= 0; i--) {
      var A = i % N, B = (i + 1) % N, lim = Math.sqrt(vp[B] * vp[B] + 2 * aBrk * ds);
      if (vp[A] > lim) vp[A] = lim;
    }
  }
  return { S: S, N: N, L: L, ds: ds, vp: vp, curve: curve, t0: t0 };
};

RS.nearest = function (T, x, z, hint) {
  var S = T.S, N = T.N, bi = 0, bd = 1e18, i, dx, dz, d;
  if (hint < 0) {
    for (i = 0; i < N; i++) { dx = x - S[i].x; dz = z - S[i].z; d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  } else {
    for (var k = -30; k <= 30; k++) {
      i = (hint + k + N) % N; dx = x - S[i].x; dz = z - S[i].z; d = dx * dx + dz * dz;
      if (d < bd) { bd = d; bi = i; }
    }
  }
  var s = S[bi];
  return { i: bi, off: (x - s.x) * s.nx + (z - s.z) * s.nz };
};

/* car types: top-speed, acceleration and grip multipliers, plus nitro recharge/drain */
RS.CARS = [
  { id: 'gt', power: 1, acc: 1, grip: 1, nUp: 1, nDn: 1 },
  { id: 'sprint', power: 0.955, acc: 1.1, grip: 1.07, nUp: 1, nDn: 1 },
  { id: 'titan', power: 1.05, acc: 0.95, grip: 0.95, nUp: 1, nDn: 1 },
  { id: 'flash', power: 1, acc: 1.03, grip: 1.02, nUp: 1.5, nDn: 0.7 }
];

RS.newCar = function (T, slot, o) {
  var ct = RS.CARS[o.car || 0] || RS.CARS[0];
  var row = Math.floor(slot / 2), col = slot % 2;
  var m = 12 + row * 11, back = Math.round(m / T.ds);
  var idx = (T.N - back) % T.N, s = T.S[idx], lat = col === 0 ? 3.4 : -3.4;
  return {
    name: o.name, isPlayer: !!o.isPlayer, color: o.color,
    x: s.x + s.nx * lat, z: s.z + s.nz * lat, h: s.h, vx: 0, vz: 0,
    steer: 0, yaw: 0, slip: 0, hit: 0, roll: 0, wheelRot: 0,
    idx: idx, idxPrev: idx, off: lat, prog: idx - T.N, maxDone: -1,
    car: o.car || 0, power: ct.power, accK: ct.acc, gripK: ct.grip, nUp: ct.nUp, nDn: ct.nDn, skill: o.skill || 0.9, baseLane: o.baseLane || 0, lane: lat, react: o.react || 0,
    nitro: 0.6, boosting: false, braking: false,
    lapStart: 0, lapTimes: [], bestLap: Infinity, finished: false, finishT: 0,
    rpm: 0.2, gear: 1, speed: 0, wrongT: 0, stuckT: 0, hitCount: 0, gravelT: 0
  };
};

RS.stepCar = function (c, inp, dt, T) {
  var sp0 = c.vx * Math.sin(c.h) + c.vz * Math.cos(c.h);
  var gk = c.gripK || 1, aMax = (44 + 0.0016 * sp0 * sp0) * gk;
  var wmax = Math.min(1.7, aMax / Math.max(Math.abs(sp0), 6));
  var rate = 1 - Math.exp(-dt * (Math.abs(inp.steer) < 0.01 ? 9 : 6.5));
  c.steer += (inp.steer - c.steer) * rate;
  var w = c.steer * wmax * Math.min(1, Math.abs(sp0) / 7) * (sp0 < 0 ? -1 : 1) * (inp.hb ? 1.3 : 1);
  c.yaw = w; c.h += w * dt;

  var fx = Math.sin(c.h), fz = Math.cos(c.h), lx = fz, lz = -fx;
  var vf = c.vx * fx + c.vz * fz, vl = c.vx * lx + c.vz * lz;
  var a = Math.abs(c.off);
  var gravel = a > RS.HW + RS.CURB_W, curb = !gravel && a > RS.HW;
  var boost = !!inp.nitro && c.nitro > 0.02 && inp.throttle > 0;
  var vmax = RS.VTOP * c.power * (boost ? 1.13 : 1);

  c.braking = false;
  if (inp.throttle > 0) {
    var r = Math.min(1, Math.max(0, vf / vmax));
    var acc = vf < 0 ? 26 : 21 * (c.accK || 1) * (1 - Math.pow(r, 1.5));
    if (boost) acc += 15 * (1 - r);
    vf += acc * inp.throttle * dt;
  } else if (inp.brake > 0) {
    if (vf > 0.5) { vf = Math.max(0, vf - 40 * inp.brake * dt); c.braking = true; }
    else vf = Math.max(-16, vf - 13 * inp.brake * dt);
  } else {
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.2 * dt);
  }
  vf -= vf * Math.abs(vf) * 0.00016 * dt;
  if (inp.hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 12 * dt);
  if (gravel) { vf *= Math.exp(-1.5 * dt); if (vf > 32) vf -= (vf - 32) * Math.min(1, 3 * dt); c.gravelT += dt; }
  else if (curb) vf *= Math.exp(-0.15 * dt);
  if (vf > vmax) vf -= (vf - vmax) * Math.min(1, 2 * dt);

  var grip = (inp.hb ? 1.6 : (gravel ? 3.2 : 8.5)) * gk;
  c.slip = Math.abs(vl);
  vl *= Math.exp(-grip * dt);
  c.vx = fx * vf + lx * vl; c.vz = fz * vf + lz * vl;
  c.x += c.vx * dt; c.z += c.vz * dt;

  if (boost) c.nitro = Math.max(0, c.nitro - 0.2 * (c.nDn || 1) * dt);
  else c.nitro = Math.min(1, c.nitro + (c.slip > 3 && Math.abs(vf) > 18 ? 0.14 : 0.03) * (c.nUp || 1) * dt);
  c.boosting = boost;
  c.speed = Math.hypot(c.vx, c.vz);

  var n = RS.nearest(T, c.x, c.z, c.idx);
  c.idxPrev = c.idx; c.idx = n.i; c.off = n.off;

  // walls
  c.hit = Math.max(0, c.hit - dt * 3);
  var lim = RS.WALL_D - 1.3, ao = Math.abs(n.off);
  if (ao > lim) {
    var sg = n.off >= 0 ? 1 : -1, s = T.S[n.i], ox = s.nx * sg, oz = s.nz * sg, ex = ao - lim;
    c.x -= ox * ex; c.z -= oz * ex;
    var vo = c.vx * ox + c.vz * oz;
    if (vo > 0) {
      c.vx -= ox * vo * 1.25; c.vz -= oz * vo * 1.25;
      var imp = Math.min(1, vo / 22), f = 1 - 0.3 * imp;
      c.vx *= f; c.vz *= f;
      if (imp > 0.12 && c.hit < 0.3) c.hitCount++;
      c.hit = Math.max(c.hit, imp);
    }
    var fwd = c.vx * s.tx + c.vz * s.tz;
    var th = fwd >= 0 ? s.h : s.h + Math.PI;
    c.h += RS.wrap(th - c.h) * Math.min(1, dt * 6);
  }

  var d = c.idx - c.idxPrev;
  if (d > T.N / 2) d -= T.N; else if (d < -T.N / 2) d += T.N;
  c.prog += d;
  var sm = T.S[c.idx], along = c.vx * sm.tx + c.vz * sm.tz;
  c.wrongT = along < -4 ? c.wrongT + dt : 0;
};

RS.respawn = function (c, T) {
  var n = RS.nearest(T, c.x, c.z, -1), s = T.S[n.i];
  var off = Math.max(-RS.HW + 2.5, Math.min(RS.HW - 2.5, n.off));
  c.x = s.x + s.nx * off; c.z = s.z + s.nz * off; c.h = s.h;
  c.vx = s.tx * 10; c.vz = s.tz * 10; c.steer = 0; c.slip = 0; c.hit = 0;
  var d = n.i - c.idx;
  if (d > T.N / 2) d -= T.N; else if (d < -T.N / 2) d += T.N;
  c.prog += d; c.idx = n.i; c.idxPrev = n.i; c.off = off; c.lane = off; c.wrongT = 0; c.stuckT = 0;
};

RS.collideCars = function (cars) {
  for (var i = 0; i < cars.length; i++) for (var j = i + 1; j < cars.length; j++) {
    var A = cars[i], B = cars[j];
    if (A.gone || B.gone) continue;
    var dx = B.x - A.x, dz = B.z - A.z;
    if (dx * dx + dz * dz > 36) continue;
    for (var oa = -1; oa <= 1; oa += 2) for (var ob = -1; ob <= 1; ob += 2) {
      var pax = A.x + Math.sin(A.h) * oa * 1.25, paz = A.z + Math.cos(A.h) * oa * 1.25;
      var pbx = B.x + Math.sin(B.h) * ob * 1.25, pbz = B.z + Math.cos(B.h) * ob * 1.25;
      var ddx = pbx - pax, ddz = pbz - paz, d2 = ddx * ddx + ddz * ddz, rr = 2.0;
      if (d2 < rr * rr && d2 > 1e-6) {
        var d = Math.sqrt(d2), nx = ddx / d, nz = ddz / d, pen = rr - d;
        A.x -= nx * pen * 0.5; A.z -= nz * pen * 0.5; B.x += nx * pen * 0.5; B.z += nz * pen * 0.5;
        var vn = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
        if (vn < 0) {
          var j2 = -vn * 0.55;
          A.vx -= nx * j2; A.vz -= nz * j2; B.vx += nx * j2; B.vz += nz * j2;
          var im = Math.min(1, -vn / 15);
          A.hit = Math.max(A.hit, im); B.hit = Math.max(B.hit, im);
        }
      }
    }
  }
};

RS.aiInput = function (c, T, cars, dt, out) {
  var S = T.S, N = T.N, sp = Math.hypot(c.vx, c.vz);
  var fx = Math.sin(c.h), fz = Math.cos(c.h), lane = c.baseLane;
  for (var q = 0; q < cars.length; q++) {
    var o = cars[q]; if (o === c) continue;
    var dx = o.x - c.x, dz = o.z - c.z, fw = dx * fx + dz * fz;
    if (fw > 1 && fw < 30) {
      var lt = dx * fz - dz * fx;
      if (Math.abs(lt) < 3.2) { lane = Math.max(-6, Math.min(6, c.off + (lt >= 0 ? -4.5 : 4.5))); break; }
    }
  }
  c.lane += (lane - c.lane) * Math.min(1, dt * 2.2);
  var look = Math.max(10, sp * 0.5 + 8);
  var tg = S[(c.idx + Math.round(look / T.ds)) % N];
  var tx = tg.x + tg.nx * c.lane, tz = tg.z + tg.nz * c.lane;
  var err = RS.wrap(Math.atan2(tx - c.x, tz - c.z) - c.h);
  out.steer = Math.max(-1, Math.min(1, err * 2.6));
  var bi = (c.idx + Math.round((sp * 0.8 + 10) / T.ds)) % N;
  var vv = Math.min(T.vp[c.idx], T.vp[bi]), cap = RS.VTOP * 0.97, vt = (vv >= cap - 0.1 ? cap * c.power : vv * Math.sqrt(c.gripK || 1)) * c.skill;
  if (sp < vt - 0.5) { out.throttle = 1; out.brake = 0; }
  else if (sp > vt + 2) { out.throttle = 0; out.brake = Math.min(1, (sp - vt) * 0.12); }
  else { out.throttle = 0.35; out.brake = 0; }
  out.hb = false;
  out.nitro = c.nitro > 0.5 && sp > 40 && Math.abs(err) < 0.05 && vt > RS.VTOP * 0.85;
  return out;
};

if (typeof globalThis !== 'undefined') globalThis.RS = RS;
