global.THREE = require('../node_modules/three');
require('../src/sim.js');
const T = RS.buildTrack();
console.log('length m', T.L.toFixed(0), 'N', T.N, 'ds', T.ds.toFixed(2));
let kmax = 0, vmin = 1e9; for (let i = 0; i < T.N; i++) { kmax = Math.max(kmax, T.S[i].k); vmin = Math.min(vmin, T.vp[i]); }
console.log('max curvature', kmax.toFixed(4), 'min radius', (1 / kmax).toFixed(0), 'min corner speed km/h', (vmin * 3.6).toFixed(0));
// check min distance between non-adjacent samples (self-proximity)
let mind = 1e9;
for (let i = 0; i < T.N; i++) for (let j = i + 60; j < T.N - 60 + 0; j++) {
  const a = T.S[i], b = T.S[j]; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < mind) mind = d;
}
console.log('closest non-adjacent approach (m):', mind.toFixed(0), '(need > ' + (2 * RS.WALL_D).toFixed(0) + ')');
console.log('start sample', T.S[0].x.toFixed(1), T.S[0].z.toFixed(1), 'heading', T.S[0].h.toFixed(2));

function run(label, skill, laps, playerLike) {
  const cars = [];
  for (let i = 0; i < 6; i++) cars.push(RS.newCar(T, i, { name: 'c' + i, color: 0, skill: skill * (0.97 + 0.03 * ((i * 7) % 5) / 4), baseLane: (i % 2 ? -2 : 2) }));
  const dt = 1 / 120; let t = 0; const inp = {};
  while (t < 400) {
    for (const c of cars) {
      RS.aiInput(c, T, cars, dt, inp);
      RS.stepCar(c, inp, dt, T);
    }
    RS.collideCars(cars);
    t += dt;
    for (const c of cars) {
      const done = Math.floor(c.prog / T.N);
      if (done > c.maxDone) { c.maxDone = done; if (done >= 1) { c.lapTimes.push(t - c.lapStart); c.lapStart = t; } if (done >= laps && !c.finished) { c.finished = true; c.finishT = t; } }
    }
    if (cars.every(c => c.finished)) break;
  }
  console.log('--', label, 'sim time', t.toFixed(1));
  cars.forEach((c, i) => console.log(' car' + i, 'fin', c.finished ? c.finishT.toFixed(1) : 'NO', 'laps', c.lapTimes.map(x => x.toFixed(1)).join('/'), 'wallHits', c.hitCount, 'gravel s', c.gravelT.toFixed(1)));
}
run('hard 0.98', 0.98, 3);
run('easy 0.80', 0.80, 3);

// naive player: full throttle, steer toward centerline, no braking -> must stay inside walls and not get stuck
{
  const c = RS.newCar(T, 3, { name: 'p', isPlayer: true, color: 0 });
  const dt = 1 / 120; let t = 0, maxv = 0;
  while (t < 60) {
    const s = T.S[(c.idx + 12) % T.N];
    const err = RS.wrap(Math.atan2(s.x - c.x, s.z - c.z) - c.h);
    RS.stepCar(c, { throttle: 1, brake: 0, steer: Math.max(-1, Math.min(1, err * 3)), hb: false, nitro: t > 10 }, dt, T);
    maxv = Math.max(maxv, c.speed); t += dt;
  }
  console.log('naive full-throttle 60s: prog laps', (c.prog / T.N).toFixed(2), 'max km/h', (maxv * 3.6).toFixed(0), 'hits', c.hitCount, 'gravel s', c.gravelT.toFixed(1));
}
