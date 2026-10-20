global.THREE = require('../node_modules/three');
require('../src/sim.js'); require('../src/tracks.js');
RS.TRACKS.forEach(def => {
  const T = RS.buildTrack(def);
  const out = [];
  RS.CARS.forEach((ct, ci) => {
    const c = RS.newCar(T, 2, { name: 'x', color: 0, car: ci, skill: 0.97, baseLane: 0 });
    const dt = 1 / 120; let t = 0, lap = [], last = 0, done = -1, inp = {};
    while (t < 200 && lap.length < 2) {
      RS.aiInput(c, T, [c], dt, inp); RS.stepCar(c, inp, dt, T); t += dt;
      const d = Math.floor(c.prog / T.N);
      if (d > done) { done = d; if (d >= 1) { lap.push(t - last); } last = t; }
    }
    out.push(ct.id + ' ' + (lap[1] || lap[0] || 0).toFixed(1) + 's hits' + c.hitCount + ' grv' + c.gravelT.toFixed(1));
  });
  console.log(def.id.padEnd(8), out.join(' | '));
});
