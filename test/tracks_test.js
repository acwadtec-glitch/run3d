global.THREE = require('../node_modules/three');
require('../src/sim.js'); require('../src/tracks.js');
for (const def of RS.TRACKS) {
  const T = RS.buildTrack(def);
  let kmax = 0, vmin = 1e9; for (let i = 0; i < T.N; i++) { kmax = Math.max(kmax, T.S[i].k); vmin = Math.min(vmin, T.vp[i]); }
  let mind = 1e9;
  for (let i = 0; i < T.N; i++) for (let j = i + 1; j < T.N; j++) { let dj = Math.min(j - i, T.N - (j - i)); if (dj < 40) continue; const a = T.S[i], b = T.S[j]; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < mind) mind = d; }
  // straightness around start: max heading change within +-90m
  const k90 = Math.round(90 / T.ds); let dh = 0; for (let i = -k90; i <= k90; i++) dh = Math.max(dh, Math.abs(RS.wrap(T.S[(i + T.N) % T.N].h - T.S[0].h)));
  console.log(`\n${def.id}: L=${T.L.toFixed(0)}m  minR=${(1 / kmax).toFixed(0)}m  slowest=${(vmin * 3.6).toFixed(0)}km/h  closest=${mind.toFixed(0)}m(need>${(2 * RS.WALL_D + 4).toFixed(0)})  startHeadingDrift=${dh.toFixed(3)}`);
  const cars = []; for (let i = 0; i < 6; i++) cars.push(RS.newCar(T, i, { name: 'c' + i, color: 0, skill: 0.95 * (0.97 + 0.03 * ((i * 7) % 5) / 4), baseLane: i % 2 ? -2 : 2 }));
  const dt = 1 / 120; let t = 0; const inp = {};
  while (t < 300) {
    for (const c of cars) { RS.aiInput(c, T, cars, dt, inp); RS.stepCar(c, inp, dt, T); }
    RS.collideCars(cars); t += dt;
    for (const c of cars) { const done = Math.floor(c.prog / T.N); if (done > c.maxDone) { c.maxDone = done; if (done === 0) c.lapStart = t; else { c.lapTimes.push(t - c.lapStart); c.lapStart = t; if (done >= 2) c.finished = true; } } }
    if (cars.every(c => c.finished)) break;
  }
  console.log('  laps:', cars.map(c => c.lapTimes.map(x => x.toFixed(1)).join('/') + ' hits' + c.hitCount + ' grv' + c.gravelT.toFixed(1)).join(' | '));
}
