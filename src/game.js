/* ===== game: modes, players, race flow, HUD, cameras, loop ===== */
var PCOLORS = [0x2a2f36, 0xc8102e, 0xe8ecf1, 0x1646d8, 0xf0a500];
var PCOLOR_NAMES = ['رمادي فحمي', 'أحمر', 'لؤلؤي', 'أزرق', 'كهرماني'];
var AICOLS = [0xc8102e, 0xe8ecf1, 0x1646d8, 0xf0a500, 0x0f9d8a, 0x2a2f36];
var AINAMES = ['كريم', 'عمر', 'يوسف', 'حسن', 'مازن'], AILANE = [2, -2, 4, -4, 0], AIFAC = [1, 0.985, 0.99, 0.975, 0.97];
var DIFF = { easy: 0.8, med: 0.89, hard: 0.975 };
var ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
var CAR_NUMS = [11, 3, 23, 44, 88, 7], AICAR = [1, 2, 3, 0, 2];
var IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

/* ---- saved settings ---- */
var STORE = 'hala310-prof', REC_KEY = 'hala310-best';
function loadProf() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
var prof = loadProf();
var cfg = {
  mode: 'solo', track: prof.track || 'classic', laps: prof.laps || 3, diff: prof.diff || 'med', ai: 5, aiLocal: prof.ai != null ? prof.ai : 2,
  c1: prof.c1 || 0, c2: prof.c2 != null ? prof.c2 : 1, n1: prof.n1 || '', n2: prof.n2 || '',
  car1: prof.car1 | 0, car2: prof.car2 != null ? prof.car2 | 0 : 1, d1: prof.d1 | 0, d2: prof.d2 != null ? prof.d2 | 0 : 1
};
['car1', 'car2'].forEach(function (k) { if (!(cfg[k] >= 0 && cfg[k] < RS.CARS.length)) cfg[k] = 0; });
['d1', 'd2'].forEach(function (k) { if (!(cfg[k] >= 0 && cfg[k] < DRIVERS.length)) cfg[k] = 0; });
if (cfg.d1 === cfg.d2) cfg.d2 = (cfg.d1 + 1) % DRIVERS.length;
function saveProf() { try { localStorage.setItem(STORE, JSON.stringify({ n1: cfg.n1, n2: cfg.n2, c1: cfg.c1, c2: cfg.c2, track: cfg.track, laps: cfg.laps, diff: cfg.diff, ai: cfg.aiLocal, car1: cfg.car1, car2: cfg.car2, d1: cfg.d1, d2: cfg.d2 })); } catch (e) { } }
function loadRecord() { try { var v = parseFloat(localStorage.getItem(REC_KEY)); return isFinite(v) && v > 0 ? v : 0; } catch (e) { return 0; } }
function saveRecord(t) { try { localStorage.setItem(REC_KEY, String(t)); } catch (e) { } }
var record = loadRecord();

var state = { phase: 'menu', cam: 0, t: 0, cd: 0, auto: false, finishAt: 0, lastLit: 0, prevPhase: 'racing' };
var cars = [], humans = [], player = null, ranking = [], views = [], screen = 'sMain';
var el = {}; ['hud', 'hud2', 'menu', 'pause', 'result', 'tower', 'pos', 'lap', 'ltime', 'lbest', 'llast', 'spd', 'gear', 'rpm', 'nit', 'msg', 'wrong', 'map', 'vig', 'touch', 'resBody', 'resTitle', 'resSub', 'hint', 'orient', 'toast', 'splitline', 'speedo', 'lapbox'].forEach(function (id) { el[id] = $(id); });
var cache = {};
function setT(key, node, txt) { if (cache[key] !== txt) { cache[key] = txt; node.textContent = txt; } }
function toast(txt, ms) { el.toast.textContent = txt; el.toast.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(function () { el.toast.className = ''; }, ms || 2600); }

/* ---- tracks ---- */
RS.TRACKS.forEach(function (d) { TRACK_CACHE[d.id] = RS.buildTrack(d); });
var mapCtx = el.map.getContext('2d'), mapOff = document.createElement('canvas'), MAPW = 220, MAPH = 120, MAPPAD = 10, mapSc = 1, mapMinX = 0, mapMinZ = 0;
function buildMap() {
  var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  S.forEach(function (s) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); });
  mapSc = Math.min((MAPW - MAPPAD * 2) / (maxX - minX), (MAPH - MAPPAD * 2) / (maxZ - minZ));
  mapMinX = minX - (MAPW / mapSc - (maxX - minX)) / 2; mapMinZ = minZ - (MAPH / mapSc - (maxZ - minZ)) / 2;
  var dpr = 2; el.map.width = MAPW * dpr; el.map.height = MAPH * dpr; mapOff.width = MAPW * dpr; mapOff.height = MAPH * dpr;
  var g = mapOff.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
  function path() { g.beginPath(); S.forEach(function (s, i) { var x = (s.x - mapMinX) * mapSc, y = (s.z - mapMinZ) * mapSc; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); }
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9; path(); g.stroke();
  g.strokeStyle = '#aab6c4'; g.lineWidth = 5; path(); g.stroke();
  var s0 = S[0], x0 = (s0.x - mapMinX) * mapSc, y0 = (s0.z - mapMinZ) * mapSc;
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 - s0.nx * 6, y0 - s0.nz * 6); g.lineTo(x0 + s0.nx * 6, y0 + s0.nz * 6); g.stroke();
}
function setTrack(id) { var before = curTrackId; loadTrack(id); if (before !== curTrackId) buildMap(); cfg.track = curTrackId; }
function drawMap() {
  var dpr = 2; mapCtx.setTransform(1, 0, 0, 1, 0, 0); mapCtx.clearRect(0, 0, el.map.width, el.map.height); mapCtx.drawImage(mapOff, 0, 0);
  mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (var i = cars.length - 1; i >= 0; i--) {
    var c = cars[i]; if (c.gone) continue;
    var x = (c.x - mapMinX) * mapSc, y = (c.z - mapMinZ) * mapSc, loc = c.localIdx != null;
    mapCtx.beginPath(); mapCtx.arc(x, y, loc ? 5 : 3.4, 0, 7);
    mapCtx.fillStyle = '#' + ('000000' + c.color.toString(16)).slice(-6); mapCtx.fill();
    mapCtx.lineWidth = loc ? 2 : 1; mapCtx.strokeStyle = loc ? '#56c8ff' : 'rgba(0,0,0,0.7)'; mapCtx.stroke();
  }
}

/* ---- views ---- */
for (var vi = 0; vi < 6; vi++) { var vw = makeCarView(AICOLS[vi], CAR_NUMS[vi]); scene.add(vw.root); views.push(vw); }

/* ---- plan and setup of a race ---- */
function makePlan() {
  var plan = [], i;
  if (cfg.mode === 'online') {
    var list = NET.order.length ? NET.order : NET.players;
    list.forEach(function (p) { plan.push(p.id === NET.me ? { kind: 'human', local: 0, name: cfg.n1 || p.name, color: p.color, id: p.id, car: p.car | 0, drv: p.drv | 0 } : { kind: 'remote', name: p.name, color: p.color, id: p.id, car: p.car | 0, drv: p.drv | 0 }); });
    return plan;
  }
  var n1 = cfg.n1 || 'لاعب 1', n2 = cfg.n2 || 'لاعب 2';
  if (cfg.mode === 'local') {
    for (i = 0; i < cfg.aiLocal; i++) plan.push({ kind: 'ai' });
    plan.push({ kind: 'human', local: 0, name: n1, color: PCOLORS[cfg.c1], car: cfg.car1, drv: cfg.d1 });
    plan.push({ kind: 'human', local: 1, name: n2, color: PCOLORS[cfg.c2], car: cfg.car2, drv: cfg.d2 });
    return plan;
  }
  for (i = 0; i < 5; i++) plan.push({ kind: 'ai' });
  plan.splice(4, 0, { kind: 'human', local: 0, name: n1, color: PCOLORS[cfg.c1], car: cfg.car1, drv: cfg.d1 });
  return plan;
}
function setupRace(plan) {
  var base = DIFF[cfg.diff], aiN = 0, taken = plan.filter(function (e) { return e.kind !== 'ai'; }).map(function (e) { return e.color; });
  var aiCols = AICOLS.filter(function (c) { return taken.indexOf(c) < 0; });
  var takenD = plan.filter(function (e) { return e.kind !== 'ai'; }).map(function (e) { return e.drv; });
  var aiDrv = DRIVERS.map(function (d, i) { return i; }).filter(function (i) { return takenD.indexOf(i) < 0; });
  cars = []; humans = [];
  plan.forEach(function (e, slot) {
    var c;
    if (e.kind === 'ai') {
      c = RS.newCar(T, slot, { name: AINAMES[aiN % 5], color: aiCols[aiN % aiCols.length], skill: base * AIFAC[aiN % 5], baseLane: AILANE[aiN % 5], car: AICAR[aiN % 5] }); c.drv = aiDrv[aiN % aiDrv.length]; aiN++;
    } else {
      c = RS.newCar(T, slot, { name: e.name, isPlayer: e.kind === 'human', color: e.color, car: e.car | 0 }); c.drv = e.drv | 0;
      if (e.kind === 'human') { c.localIdx = e.local; humans[e.local] = c; } else c.remote = true;
      c.netId = e.id;
    }
    c.slot = slot; c.rpm = 0.2; c.hit = 0; cars.push(c);
    views[slot].setColor(c.color); views[slot].setLook(c.car | 0, c.drv | 0); views[slot].root.visible = true; updateCarView(c, views[slot], 0.0001);
  });
  for (var i = plan.length; i < 6; i++) views[i].root.visible = false;
  player = humans[0] || null; state.t = 0; ranking = cars.slice();
}
function refreshPreview() { setupRace(makePlan()); rigs[0].init = false; }

/* ---- input ---- */
var KS = [{ left: 0, right: 0, up: 0, down: 0, hb: 0, nitro: 0 }, { left: 0, right: 0, up: 0, down: 0, hb: 0, nitro: 0 }];
var TOUCH = { left: 0, right: 0, up: 0, down: 0, nitro: 0 }, PADS = [{}, {}];
var MAP_SOLO = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'hb', ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro' };
var MAP_P1 = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Space: 'hb', ShiftLeft: 'nitro' };
var MAP_P2 = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'hb', ShiftRight: 'nitro', Numpad0: 'nitro' };
function clearKeys() { KS.forEach(function (k) { for (var n in k) k[n] = 0; }); }
function keyHandler(down) {
  return function (e) {
    var a, b;
    if (cfg.mode === 'local' && humans.length === 2) { a = MAP_P1[e.code]; b = MAP_P2[e.code]; if (a) KS[0][a] = down ? 1 : 0; if (b) KS[1][b] = down ? 1 : 0; if ((a || b) && down && state.phase !== 'menu') e.preventDefault(); }
    else { a = MAP_SOLO[e.code]; if (a) { KS[0][a] = down ? 1 : 0; if (down && state.phase !== 'menu' && !isTyping()) e.preventDefault(); } }
    if (!down) return;
    if (isTyping()) return;
    if (e.repeat) return;
    if (e.code === 'KeyC' && (state.phase === 'racing' || state.phase === 'countdown')) cycleCam();
    if (e.code === 'KeyR' && state.phase === 'racing') humans.forEach(function (h) { if (cfg.mode !== 'local' || h.localIdx === 0) respawnHuman(h); });
    if (e.code === 'KeyT' && state.phase === 'racing' && cfg.mode === 'local') respawnHuman(humans[1]);
    if ((e.code === 'KeyP' || e.code === 'Escape') && (state.phase === 'racing' || state.phase === 'countdown' || state.phase === 'paused')) togglePause();
    if (e.code === 'KeyM') toggleMute();
  };
}
function isTyping() { var a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
window.addEventListener('keydown', function (e) { if (isTyping() && e.code !== 'Escape') { if (e.code === 'Enter') e.target.blur(); return; } keyHandler(true)(e); });
window.addEventListener('keyup', keyHandler(false));
window.addEventListener('blur', function () { clearKeys(); if (state.phase === 'racing' && cfg.mode !== 'online') togglePause(); });
document.addEventListener('visibilitychange', function () { if (document.hidden && state.phase === 'racing' && cfg.mode !== 'online') togglePause(); });

function bindTouch(id, key) {
  var b = $(id); if (!b) return;
  function on(e) { TOUCH[key] = 1; b.classList.add('on'); e.preventDefault(); }
  function off(e) { TOUCH[key] = 0; b.classList.remove('on'); e.preventDefault(); }
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}
bindTouch('tL', 'left'); bindTouch('tR', 'right'); bindTouch('tG', 'up'); bindTouch('tB', 'down'); bindTouch('tN', 'nitro');
function pollPads() {
  PADS[0] = {}; PADS[1] = {};
  try {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [], k = 0;
    for (var i = 0; i < pads.length && k < 2; i++) {
      var p = pads[i]; if (!p || !p.connected) continue;
      var ax = p.axes[0] || 0;
      PADS[k] = { steer: Math.abs(ax) > 0.12 ? -ax : 0, throttle: p.buttons[7] ? p.buttons[7].value : 0, brake: p.buttons[6] ? p.buttons[6].value : 0, nitro: (p.buttons[0] && p.buttons[0].pressed) || (p.buttons[5] && p.buttons[5].pressed), hb: p.buttons[2] && p.buttons[2].pressed };
      k++;
    }
  } catch (e) { }
}
var INPS = [{ steer: 0, throttle: 0, brake: 0, hb: false, nitro: false }, { steer: 0, throttle: 0, brake: 0, hb: false, nitro: false }], AIINP = { steer: 0, throttle: 0, brake: 0, hb: false, nitro: false };
function humanInput(i) {
  var k = KS[i], p = PADS[i] || {}, t = i === 0 ? TOUCH : {}, o = INPS[i];
  o.steer = clamp((k.left || t.left ? 1 : 0) - (k.right || t.right ? 1 : 0) + (p.steer || 0), -1, 1);
  o.throttle = k.up || t.up ? 1 : (p.throttle || 0);
  o.brake = k.down || t.down ? 1 : (p.brake || 0);
  o.hb = !!(k.hb || p.hb); o.nitro = !!(k.nitro || t.nitro || p.nitro);
  return o;
}

/* ---- formatting ---- */
function fmt(t) { if (!isFinite(t) || t <= 0) return '--:--.--'; var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
function hexc(c) { return '#' + ('000000' + c.color.toString(16)).slice(-6); }
var rpmSegs = [], RPMN = 28;
(function () { var h = ''; for (var i = 0; i < RPMN; i++) h += '<i></i>'; el.rpm.innerHTML = h; rpmSegs = el.rpm.children; })();
var showMsgTimer = 0;
function showMsg(txt, kind, dur) { el.msg.textContent = txt; el.msg.className = 'show ' + (kind || ''); showMsgTimer = dur || 1.6; }

/* ---- split-screen panels ---- */
var PH = [];
(function () {
  var h = '';
  for (var i = 0; i < 2; i++) h += '<div class="ph" id="ph' + i + '"><div class="phtop"><b class="phname"></b><span class="phpos"></span><span class="phlap"></span></div><div class="phwrong">اتجاه خاطئ</div><div class="phbot"><span class="phspd">0</span><small>كم/س</small><span class="phgear">N</span><div class="phnit"></div></div></div>';
  el.hud2.innerHTML = h;
  for (var j = 0; j < 2; j++) { var p = $('ph' + j); PH.push({ box: p, name: p.querySelector('.phname'), pos: p.querySelector('.phpos'), lap: p.querySelector('.phlap'), spd: p.querySelector('.phspd'), gear: p.querySelector('.phgear'), nit: p.querySelector('.phnit'), wrong: p.querySelector('.phwrong') }); }
})();

/* ---- ranking ---- */
function rankCars() {
  var list = [];
  for (var i = 0; i < cars.length; i++) {
    var c = cars[i]; if (c.gone) continue;
    if (c.remote) c.score = c.finished ? 1e9 - c.finishT : (c.net ? c.net.sc : -1e9);
    else { var s = S[c.idx], f = clamp(((c.x - s.x) * s.tx + (c.z - s.z) * s.tz) / ds, -0.5, 0.5); c.score = c.finished ? 1e9 - c.finishT : c.prog + f; }
    list.push(c);
  }
  ranking = list.sort(function (a, b) { return b.score - a.score; });
}
function towerUpdate() {
  var h = '', lead = ranking[0];
  for (var i = 0; i < ranking.length; i++) {
    var c = ranking[i], gap = '';
    if (i === 0) gap = c.finished ? '' : 'L' + clamp(Math.floor(c.prog / N) + 1, 1, cfg.laps);
    else if (c.finished) gap = '‎+' + (c.finishT - lead.finishT).toFixed(1);
    else if (lead.finished) gap = '';
    else gap = '‎+' + Math.max(0, (lead.score - c.score) * ds / Math.max(35, c.speed)).toFixed(1);
    h += '<div class="row' + (c.localIdx != null ? ' me' : '') + '"><b>' + (i + 1) + '</b><i style="background:' + hexc(c) + '"></i><span>' + c.name + '</span><em>' + gap + '</em></div>';
  }
  if (cache.tower !== h) { cache.tower = h; el.tower.innerHTML = h; }
}

/* ---- race flow ---- */
function slotIndexOf(c) { return c.slot; }
function beginRace() {
  audioInit();
  setupRace(makePlan());
  state.phase = 'countdown'; state.cd = 0; state.lastLit = 0; state.auto = false;
  gLights.forEach(function (m) { m.color.setHex(0x330606); });
  el.menu.hidden = true; el.result.hidden = true; el.pause.hidden = true; el.hud.hidden = false;
  var split = humans.length === 2;
  el.hud2.hidden = !split; $('mapwrap').hidden = split; el.speedo.hidden = split; el.lapbox.hidden = split; el.tower.hidden = split; el.splitline.hidden = !split; $('hint').hidden = split;
  $('app').classList.toggle('split', split);
  el.touch.hidden = !IS_TOUCH || split; el.orient.hidden = true;
  camera.clearViewOffset();
  rigs.forEach(function (r) { r.init = false; });
  el.msg.className = ''; el.wrong.className = '';
  showMsg('استعد', 'dim', 2.4);
  cache = {}; el.hint.className = 'show'; setTimeout(function () { el.hint.className = ''; }, 9000);
  clearKeys(); layoutSplit();
}
function startRace() {
  if (!cfg.n1) { return flashName(); }
  if (cfg.mode === 'local' && !cfg.n2) { var i2 = $('inName2'); i2.focus(); i2.classList.add('bad'); return; }
  cfg.ai = cfg.mode === 'local' ? cfg.aiLocal : 5;
  saveProf(); beginRace();
}
function toMenu(screenId) {
  state.phase = 'menu'; el.hud.hidden = true; el.touch.hidden = true; el.result.hidden = true; el.pause.hidden = true; el.menu.hidden = false;
  gLights.forEach(function (m) { m.color.setHex(0x330606); });
  $('app').classList.remove('split'); el.splitline.hidden = true; el.vig.style.opacity = 0;
  showScreen(screenId || 'sMain'); AU.ctx && audioUpdate(player, false);
  el.msg.className = ''; el.wrong.className = '';
}
function togglePause() {
  if (cfg.mode === 'online') return;
  if (state.phase === 'paused') { state.phase = state.prevPhase; el.pause.hidden = true; }
  else { state.prevPhase = state.phase; state.phase = 'paused'; el.pause.hidden = false; audioUpdate(player, false); clearKeys(); }
}
function respawnHuman(h) { if (!h || h.finished) return; RS.respawn(h, T); showMsg('رجعناك للمسار', 'dim', 1.2); }
function cycleCam() { state.cam = (state.cam + 1) % 3; rigs.forEach(function (r) { r.init = false; }); showMsg(['كاميرا قريبة', 'كاميرا بعيدة', 'كاميرا السقف'][state.cam], 'dim', 0.9); }
function toggleMute() { setMuted(!AU.muted); $('bMute').classList.toggle('off', AU.muted); $('mMute').classList.toggle('off', AU.muted); }

function showRecord() { var n = $('record'); if (!n) return; n.hidden = !record; n.textContent = record ? 'رقمك القياسي في اللفة ' + fmt(record) : ''; }
function onLapDone(c, lapNo, lapTime) {
  c.lapTimes.push(lapTime);
  var isBest = lapTime < c.bestLap; if (isBest) c.bestLap = lapTime;
  if (c.localIdx === 0) {
    if (!record || lapTime < record) { var had = !!record; record = lapTime; saveRecord(record); if (had && humans.length === 1) setTimeout(function () { showMsg('رقم قياسي جديد', 'good', 2); }, 400); }
  }
  if (c.localIdx === 0 && humans.length === 1) {
    if (lapNo < cfg.laps) {
      showMsg('اللفة ' + lapNo + '  ' + fmt(lapTime), isBest ? 'good' : '', 2.2);
      if (lapNo === cfg.laps - 1) setTimeout(function () { if (state.phase === 'racing') showMsg('اللفة الأخيرة', 'warn', 1.8); }, 2300);
    }
    blip(880, 0.12, 'sine', 0.2);
  }
}
function updateGear(c, dt) {
  var sp = c.speed, G = [0, 18, 33, 47, 60, 72, 82, 100], g = 1; while (g < 7 && sp > G[g]) g++;
  c.gear = g; var lo = G[g - 1], hi = G[g];
  c.rpm += ((0.32 + 0.68 * clamp((sp - lo) / (hi - lo), 0, 1)) * (sp < 0.5 ? 0.6 : 1) - c.rpm) * Math.min(1, dt * 14);
}
function raceStep(dt) {
  var i, c, inp, meanProg = 0;
  pollPads();
  for (i = 0; i < humans.length; i++) meanProg += humans[i].prog; meanProg = humans.length ? meanProg / humans.length : 0;
  for (i = 0; i < cars.length; i++) {
    c = cars[i]; if (c.remote || c.gone) continue;
    if (c.localIdx != null && !state.auto && !c.finished) inp = humanInput(c.localIdx);
    else {
      var saved = c.skill;
      if (c.localIdx != null) c.skill = 0.9;
      else if (c.finished) c.skill = 0.6;
      else if (cfg.diff !== 'hard') c.skill = saved * (1 + clamp((meanProg - c.prog) * ds / 500, -0.045, 0.045));
      inp = RS.aiInput(c, T, cars, dt, AIINP); c.skill = saved;
    }
    var hitBefore = c.hit;
    RS.stepCar(c, inp, dt, T);
    if (c.localIdx === 0 && c.hit > 0.3 && hitBefore <= 0.3) crashSound(c.hit);
  }
  RS.collideCars(cars);
  state.t += dt;
  for (i = 0; i < cars.length; i++) {
    c = cars[i]; if (c.remote || c.gone) continue;
    var done = Math.floor(c.prog / N);
    if (done > c.maxDone) {
      c.maxDone = done;
      if (done === 0) c.lapStart = state.t;
      else {
        var lt = state.t - c.lapStart; c.lapStart = state.t; onLapDone(c, done, lt);
        if (done >= cfg.laps && !c.finished) {
          c.finished = true; c.finishT = state.t;
          if (c.localIdx === 0) { blip(660, 0.5, 'triangle', 0.25); setTimeout(function () { blip(990, 0.7, 'triangle', 0.25); }, 220); }
          if (humans.length && humans.every(function (h) { return h.finished; })) { state.finishAt = state.t; state.phase = 'finished'; }
        }
      }
    }
    updateGear(c, dt);
    if (c.localIdx != null && !state.auto && !c.finished) {
      var k = KS[c.localIdx], t = c.localIdx === 0 ? TOUCH : {};
      if (c.speed < 2.5 && !(k.up || t.up)) c.stuckT += dt; else c.stuckT = 0;
      if (c.stuckT > 7) { respawnHuman(c); c.stuckT = 0; }
    }
  }
}
function updateRemote(c, dt, now) {
  var n = c.net; c.hit = Math.max(0, c.hit - dt * 3);
  if (!n) return;
  var age = Math.min(0.3, (now - c.netT) / 1000), k = 1 - Math.exp(-dt * 14);
  c.x += (n.x + n.vx * age - c.x) * k; c.z += (n.z + n.vz * age - c.z) * k; c.h += RS.wrap(n.h + n.yw * age - c.h) * k;
  c.vx = n.vx; c.vz = n.vz; c.speed = Math.hypot(c.vx, c.vz); c.steer = n.st; c.yaw = n.yw; c.slip = n.sl; c.braking = !!n.br; c.boosting = !!n.bo;
  c.finished = !!n.fn; c.finishT = n.ft || 0; c.lapTimes = n.lt || []; c.bestLap = n.bl || Infinity; c.prog = n.pg; c.nitro = n.ni;
  var nr = RS.nearest(T, c.x, c.z, c.idx); c.idx = nr.i; c.off = nr.off;
  updateGear(c, dt);
}
function netTick(now) {
  if (!NET.tr || now - NET.lastSend < 50 || !humans[0]) return; NET.lastSend = now;
  var c = humans[0];
  netSendState({ t: 's', i: NET.me, x: +c.x.toFixed(2), z: +c.z.toFixed(2), h: +c.h.toFixed(3), vx: +c.vx.toFixed(2), vz: +c.vz.toFixed(2), st: +c.steer.toFixed(2), yw: +c.yaw.toFixed(3), sl: +c.slip.toFixed(1), br: c.braking ? 1 : 0, bo: c.boosting ? 1 : 0, sc: +(c.score || 0).toFixed(2), pg: +c.prog.toFixed(1), fn: c.finished ? 1 : 0, ft: +c.finishT.toFixed(3), lt: c.lapTimes, bl: isFinite(c.bestLap) ? c.bestLap : 0, ni: +c.nitro.toFixed(2) });
}

/* ---- results ---- */
function showResults() {
  rankCars();
  var h = '', lead = ranking[0], me = humans[0], pos = ranking.indexOf(me) + 1;
  if (cfg.mode === 'local') {
    el.resTitle.textContent = 'الفائز ' + lead.name; el.resTitle.className = 'gold';
    el.resSub.textContent = humans.map(function (x) { return x.name + ' ' + fmt(x.finishT); }).join('   ·   ');
  } else {
    el.resTitle.textContent = pos === 1 ? 'فزت بالسباق' : 'المركز ' + ORD[pos - 1]; el.resTitle.className = pos === 1 ? 'gold' : pos <= 3 ? 'accent' : '';
    el.resSub.textContent = 'الزمن الكلي ' + fmt(me.finishT) + '  ·  أسرع لفة ' + fmt(me.bestLap);
  }
  ranking.forEach(function (c, i) {
    h += '<tr class="' + (c.localIdx != null ? 'me' : '') + '"><td>' + (i + 1) + '</td><td><i style="background:' + hexc(c) + '"></i><img class="dic" alt="" src="' + driverIcon(c.drv | 0) + '">' + c.name + '</td><td>' +
      (c.finished ? (i === 0 ? fmt(c.finishT) : '‎+' + (c.finishT - lead.finishT).toFixed(2)) : 'لسه بيسابق') + '</td><td>' + fmt(c.bestLap) + '</td></tr>';
  });
  el.resBody.innerHTML = h; el.result.hidden = false;
  $('bAgain').hidden = cfg.mode === 'online'; $('bLobbyR').hidden = cfg.mode !== 'online';
}

/* ---- cameras ---- */
var camera2 = new THREE.PerspectiveCamera(62, 1, 0.3, 6000);
function mkRig(cam) { return { cam: cam, yaw: 0, init: false, pos: new THREE.Vector3(), look: new THREE.Vector3() }; }
var rigs = [mkRig(camera), mkRig(camera2)], menuAng = 0.6;
function menuView() { return state.phase === 'menu'; }
function applyViewOffset() {
  var w = window.innerWidth, h = window.innerHeight;
  if (menuView() && w > 560 && w > h) camera.setViewOffset(w, h, w * (w > 820 ? 0.17 : 0.24), 0, w, h);
  else if (menuView() && w <= h) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
  else camera.clearViewOffset();
}
window.__onResizeHook = function () { applyViewOffset(); layoutSplit(); };
function updateRig(rig, c, dt, first) {
  var cam = rig.cam, sp = c.speed, fov = 60;
  if (menuView()) {
    if (!first) return;
    menuAng += dt * 0.22;
    var r = window.innerWidth < 820 ? 10.5 : 8.6;
    cam.position.set(c.x + Math.sin(c.h + menuAng) * r, 2.3 + Math.sin(menuAng * 0.7) * 0.5, c.z + Math.cos(c.h + menuAng) * r);
    cam.lookAt(c.x, 0.55, c.z); cam.fov = 44; cam.updateProjectionMatrix(); return;
  }
  var shake = (Math.pow(sp / 86, 3) * 0.03 + c.hit * 0.25) * (state.cam === 2 ? 0.5 : 1);
  if (state.cam === 2) {
    var fx = Math.sin(c.h), fz = Math.cos(c.h);
    cam.position.set(c.x + fx * 0.15 + (Math.random() - 0.5) * shake, 1.28 + (Math.random() - 0.5) * shake, c.z + fz * 0.15);
    cam.lookAt(c.x + fx * 20 + c.vx * 0.05, 0.85, c.z + fz * 20 + c.vz * 0.05);
    fov = 74 + sp / 86 * 10;
  } else {
    var d0 = state.cam === 0 ? 7.4 : 11.2, h0 = state.cam === 0 ? 2.5 : 3.8;
    if (!rig.init) { rig.yaw = c.h; rig.init = true; }
    rig.yaw += RS.wrap(c.h - rig.yaw) * (1 - Math.exp(-dt * 5.5));
    var d = d0 + sp * 0.014, sy = Math.sin(rig.yaw), cy = Math.cos(rig.yaw);
    cam.position.set(c.x - sy * d + (Math.random() - 0.5) * shake, h0 + sp * 0.006 + (Math.random() - 0.5) * shake, c.z - cy * d);
    rig.look.set(c.x + sy * 9, 1.15, c.z + cy * 9); cam.lookAt(rig.look);
    fov = 62 + sp / 86 * 12 + (c.boosting ? 7 : 0);
  }
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 5); cam.updateProjectionMatrix();
}
var VPS = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }];
function layoutSplit() {
  var w = window.innerWidth, h = window.innerHeight, wide = w >= h * 1.05;
  if (wide) { VPS[0] = { x: 0, y: 0, w: w / 2, h: h }; VPS[1] = { x: w / 2, y: 0, w: w / 2, h: h }; }
  else { VPS[0] = { x: 0, y: h / 2, w: w, h: h / 2 }; VPS[1] = { x: 0, y: 0, w: w, h: h / 2 }; }
  el.splitline.className = wide ? 'v' : 'h';
  el.hud2.className = wide ? 'wide' : 'tall';
}

/* ---- HUD update ---- */
function updateHud(dt) {
  if (humans.length === 2) {
    for (var i = 0; i < 2; i++) {
      var c = humans[i], P = PH[i], done = Math.floor(c.prog / N);
      setT('n' + i, P.name, c.name); setT('p' + i, P.pos, (ranking.indexOf(c) + 1) + '/' + ranking.length);
      setT('l' + i, P.lap, 'لفة ' + clamp(done + 1, 1, cfg.laps) + '/' + cfg.laps);
      setT('s' + i, P.spd, String(Math.round(c.speed * 3.6)));
      setT('g' + i, P.gear, c.speed < 0.8 ? 'N' : String(c.gear));
      var nv = Math.round(c.nitro * 100); if (cache['v' + i] !== nv) { cache['v' + i] = nv; P.nit.style.setProperty('--v', nv + '%'); }
      P.nit.classList.toggle('boost', c.boosting);
      var wr = c.wrongT > 1.2 && state.phase === 'racing'; if (cache['w' + i] !== wr) { cache['w' + i] = wr; P.wrong.className = 'phwrong' + (wr ? ' show' : ''); }
    }
    var mv = Math.max(humans[0].speed, humans[1].speed);
    el.vig.style.opacity = clamp((mv - 55) / 40, 0, 1) * 0.35;
  } else {
    var c0 = player, pos = ranking.indexOf(c0) + 1, d0 = Math.floor(c0.prog / N), lapNo = clamp(d0 + 1, 1, cfg.laps);
    setT('pos', el.pos, pos + '/' + ranking.length); setT('lap', el.lap, lapNo + '/' + cfg.laps);
    var cur = state.phase === 'countdown' ? 0 : (d0 < 0 ? 0 : state.t - c0.lapStart);
    if (c0.finished) cur = c0.lapTimes.length ? c0.lapTimes[c0.lapTimes.length - 1] : 0;
    setT('ltime', el.ltime, cur > 0 ? fmt(cur) : '0:00.00'); setT('lbest', el.lbest, fmt(c0.bestLap));
    setT('llast', el.llast, c0.lapTimes.length ? fmt(c0.lapTimes[c0.lapTimes.length - 1]) : '--:--.--');
    setT('spd', el.spd, String(Math.round(c0.speed * 3.6)));
    setT('gear', el.gear, c0.speed < 0.8 && c0.vx * Math.sin(c0.h) + c0.vz * Math.cos(c0.h) <= 0.1 ? 'N' : String(c0.gear));
    var lit = Math.round(c0.rpm * RPMN);
    if (cache.rpmlit !== lit) { cache.rpmlit = lit; for (var q = 0; q < RPMN; q++) rpmSegs[q].className = q < lit ? (q > RPMN * 0.86 ? 'r' : q > RPMN * 0.68 ? 'y' : 'w') : ''; }
    var nit = Math.round(c0.nitro * 100); if (cache.nit !== nit) { cache.nit = nit; el.nit.style.setProperty('--v', nit + '%'); }
    el.nit.classList.toggle('boost', c0.boosting);
    var wr0 = c0.wrongT > 1.2 && state.phase === 'racing'; if (cache.wr !== wr0) { cache.wr = wr0; el.wrong.className = wr0 ? 'show' : ''; }
    el.vig.style.opacity = clamp((c0.speed - 55) / 40, 0, 1) * 0.55 + (c0.boosting ? 0.25 : 0);
  }
  if (showMsgTimer > 0) { showMsgTimer -= dt; if (showMsgTimer <= 0) el.msg.className = ''; }
  drawMap();
}

/* ---- main loop ---- */
var last = performance.now(), acc = 0, towerT = 0, frames = 0, ftSum = 0, STEP = 1 / 120;
function renderPass(rig, c, vp, full) {
  var cam = rig.cam;
  if (full) { renderer.setScissorTest(false); renderer.setViewport(0, 0, window.innerWidth, window.innerHeight); cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix(); }
  else { renderer.setScissorTest(true); renderer.setViewport(vp.x, vp.y, vp.w, vp.h); renderer.setScissor(vp.x, vp.y, vp.w, vp.h); cam.aspect = vp.w / vp.h; cam.updateProjectionMatrix(); }
  var fx = c.x, fz = c.z;
  sun.target.position.set(Math.round(fx), 0, Math.round(fz));
  sun.position.set(Math.round(fx) + SUN_DIR.x * 150, SUN_DIR.y * 150, Math.round(fz) + SUN_DIR.z * 150);
  sun.target.updateMatrixWorld();
  sky.position.copy(cam.position);
  pMat.uniforms.scale.value = (full ? window.innerHeight : vp.h) * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
  renderer.render(scene, cam);
}
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(0.1, (now - last) / 1000); last = now;
  ftSum += dt; frames++;
  if (frames === 90) { var avg = ftSum / frames; if (avg > 0.024 && PR > 0.8) { PR = Math.max(0.75, PR - 0.25); renderer.setPixelRatio(PR); onResize(); } else if (avg > 0.034 && renderer.shadowMap.enabled && PR <= 0.8) { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); } frames = 0; ftSum = 0; }

  var ph = state.phase;
  if (ph === 'countdown') {
    state.cd += dt;
    var lit = Math.min(5, Math.floor(state.cd / 0.7));
    if (lit !== state.lastLit) { for (var i = 0; i < 5; i++) gLights[i].color.setHex(i < lit ? 0xff2418 : 0x330606); if (lit > 0) blip(520, 0.16, 'square', 0.16); state.lastLit = lit; }
    if (state.cd >= 4.2) { gLights.forEach(function (m) { m.color.setHex(0x330606); }); state.phase = 'racing'; showMsg('انطلق!', 'good', 1.2); blip(1040, 0.5, 'square', 0.2); }
  } else if (ph === 'racing' || ph === 'finished') {
    acc += dt; var n = 0;
    while (acc >= STEP && n < 8) { raceStep(STEP); acc -= STEP; n++; }
    if (acc > STEP) acc = 0;
    if (state.phase === 'finished' && el.result.hidden && state.t - state.finishAt > 1.6) { showResults(); towerT = 0; }
    if (state.phase === 'finished' && !el.result.hidden) { towerT += dt; if (towerT > 0.5) { towerT = 0; showResults(); } }
  } else { acc = 0; }

  for (var k = 0; k < cars.length; k++) {
    var c = cars[k];
    if (c.remote && ph !== 'menu' && ph !== 'paused') updateRemote(c, dt, now);
    updateCarView(c, views[c.slot], ph === 'paused' ? 0.0001 : dt);
    if (ph === 'racing' || ph === 'finished') carFx(c, dt);
  }
  if (ph !== 'paused') updateParticles(dt);
  if (ph === 'racing' || ph === 'finished' || ph === 'countdown') {
    rankCars();
    if (!state._tw || now - state._tw > 250) { state._tw = now; towerUpdate(); }
    updateHud(dt); audioUpdate(player, true);
    if (NET.tr && cfg.mode === 'online') netTick(now);
  } else if (ph === 'paused') audioUpdate(player, false);

  if (!player) return;
  if (humans.length === 2 && ph !== 'menu') {
    updateRig(rigs[0], humans[0], dt, true); updateRig(rigs[1], humans[1], dt, false);
    renderPass(rigs[0], humans[0], VPS[0], false); renderPass(rigs[1], humans[1], VPS[1], false);
    renderer.setScissorTest(false);
  } else {
    updateRig(rigs[0], player, dt, true);
    renderPass(rigs[0], player, null, true);
  }
}

/* ---- menu wiring ---- */
var SCREENS = ['sMain', 'sSetup', 'sOnline', 'sLobby'];
function showScreen(id) {
  screen = id; SCREENS.forEach(function (x) { $(x).hidden = x !== id; });
  if (id === 'sMain' || id === 'sOnline') cfg.mode = 'solo';
  if (id !== 'sLobby') refreshPreview();
  applyViewOffset();
}
function flashName() { var i = $('inName'); i.classList.add('bad'); $('nameErr').hidden = false; i.focus(); }
function buildSwatches(box, getSel, onPick, disabled) {
  var h = '';
  PCOLORS.forEach(function (c, i) { h += '<button class="sw' + (getSel() === i ? ' sel' : '') + (disabled && disabled(i) ? ' dis' : '') + '" data-i="' + i + '" aria-label="' + PCOLOR_NAMES[i] + '" style="--c:#' + ('000000' + c.toString(16)).slice(-6) + '"></button>'; });
  box.innerHTML = h;
  box.onclick = function (e) { var b = e.target.closest('.sw'); if (!b || b.classList.contains('dis')) return; onPick(+b.dataset.i); };
}
function drawPreview(cv, Tt) {
  var g = cv.getContext('2d'), w = cv.width, h = cv.height, pad = 12, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  Tt.S.forEach(function (s) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z); });
  var sc = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxZ - minZ)), ox = (w - (maxX - minX) * sc) / 2, oz = (h - (maxZ - minZ) * sc) / 2;
  function P(s) { return [ox + (s.x - minX) * sc, oz + (s.z - minZ) * sc]; }
  g.clearRect(0, 0, w, h); g.lineJoin = 'round'; g.lineCap = 'round';
  function path() { g.beginPath(); Tt.S.forEach(function (s, i) { var p = P(s); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); }
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 9; path(); g.stroke(); g.strokeStyle = '#b9c5d3'; g.lineWidth = 5; path(); g.stroke();
  var s0 = Tt.S[0], p0 = P(s0); g.strokeStyle = '#56c8ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(p0[0] - s0.nx * 8, p0[1] - s0.nz * 8); g.lineTo(p0[0] + s0.nx * 8, p0[1] + s0.nz * 8); g.stroke();
}
function renderTracks(box, sel, onPick) {
  box.innerHTML = '';
  RS.TRACKS.forEach(function (def) {
    var Tt = TRACK_CACHE[def.id], b = document.createElement('button');
    b.className = 'tk' + (def.id === sel ? ' sel' : ''); b.dataset.id = def.id;
    b.innerHTML = '<canvas width="200" height="112"></canvas><b>' + def.name + '</b><small>' + (Tt.L / 1000).toFixed(1) + ' كم · ' + def.desc + '</small>';
    drawPreview(b.firstChild, Tt);
    b.addEventListener('click', function () { Array.prototype.forEach.call(box.children, function (x) { x.classList.toggle('sel', x === b); }); onPick(def.id); });
    box.appendChild(b);
  });
}
function setSeg(id, v) { Array.prototype.forEach.call($(id).children, function (x) { x.classList.toggle('sel', x.dataset.v === String(v)); }); }
function bindSeg(id, fn) { $(id).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; setSeg(id, b.dataset.v); fn(b.dataset.v); }); }

function pct(v) { return clamp(Math.round(v), 8, 100); }
function carStats(i) {
  var C = RS.CARS[i];
  return [['السرعة', pct(50 + (C.power - 1) * 400)], ['التسارع', pct(50 + (C.acc - 1) * 400)], ['التماسك', pct(50 + (C.grip - 1) * 400)], ['النيترو', pct(50 + (C.nUp / C.nDn - 1) * 50)]];
}
function buildCarCards(box, getSel, onPick) {
  var h = '';
  RS.CARS.forEach(function (C, i) {
    var st = carStats(i).map(function (r) { return '<div class="st"><span>' + r[0] + '</span><i style="--w:' + r[1] + '%"></i></div>'; }).join('');
    h += '<button class="cc' + (getSel() === i ? ' sel' : '') + '" data-i="' + i + '"><b>' + CAR_INFO[i].name + '</b><small>' + CAR_INFO[i].desc + '</small>' + st + '</button>';
  });
  box.innerHTML = h;
  box.onclick = function (e) { var b = e.target.closest('.cc'); if (b) onPick(+b.dataset.i); };
}
function buildDrvCards(box, getSel, onPick, disabled) {
  var h = '';
  DRIVERS.forEach(function (D, i) {
    h += '<button class="dc' + (getSel() === i ? ' sel' : '') + (disabled && disabled(i) ? ' dis' : '') + '" data-i="' + i + '"><img alt="" src="' + driverIcon(i) + '"><b>' + D.name + '</b><small>' + D.tag + '</small></button>';
  });
  box.innerHTML = h;
  box.onclick = function (e) { var b = e.target.closest('.dc'); if (!b || b.classList.contains('dis')) return; onPick(+b.dataset.i); };
}
var curTab = 'car';
function setTab(t) {
  curTab = t;
  Array.prototype.forEach.call($('tabsS').children, function (b) { b.classList.toggle('sel', b.dataset.t === t); });
  ['car', 'drv', 'trk', 'race'].forEach(function (k) { $('pane_' + k).hidden = k !== t; });
  $('sSetup').scrollTop = 0;
}
function updateSummary() {
  var tn = getTrackDef(cfg.track).name, s = CAR_INFO[cfg.car1].name + ' · ' + DRIVERS[cfg.d1].name + ' · ' + tn;
  if (cfg.mode === 'local') s = CAR_INFO[cfg.car1].name + ' + ' + CAR_INFO[cfg.car2].name + ' · ' + tn;
  $('sumLine').textContent = s;
}
function openSetup(mode) {
  cfg.mode = mode;
  $('setupTitle').textContent = mode === 'local' ? 'لاعبين على جهاز واحد' : 'ضد الكمبيوتر';
  $('p2box').hidden = mode !== 'local'; $('p2drv').hidden = mode !== 'local'; $('aiBox').hidden = mode !== 'local'; $('diffBox').hidden = mode === 'local' && cfg.aiLocal === 0;
  $('inName2').value = cfg.n2; $('keysLocal').hidden = mode !== 'local';
  $('who1').hidden = mode !== 'local'; $('who1d').hidden = mode !== 'local';
  if (mode === 'local' && cfg.d1 === cfg.d2) cfg.d2 = (cfg.d1 + 1) % DRIVERS.length;
  renderTracks($('trackGrid'), cfg.track, function (id) { setTrack(id); refreshPreview(); updateSummary(); });
  setSeg('segLaps', cfg.laps); setSeg('segDiff', cfg.diff); setSeg('segAI', cfg.aiLocal);
  openColors(); setTrack(cfg.track); showScreen('sSetup'); setTab('car'); refreshPreview();
}
function openColors() {
  var mode = cfg.mode;
  buildSwatches($('swatches'), function () { return cfg.c1; }, function (i) { if (mode === 'local' && i === cfg.c2) return; cfg.c1 = i; openColors(); refreshPreview(); }, function (i) { return mode === 'local' && i === cfg.c2; });
  buildSwatches($('swatches2'), function () { return cfg.c2; }, function (i) { if (i === cfg.c1) return; cfg.c2 = i; openColors(); refreshPreview(); }, function (i) { return i === cfg.c1; });
  $('colName').textContent = PCOLOR_NAMES[cfg.c1];
  buildCarCards($('carBox1'), function () { return cfg.car1; }, function (i) { cfg.car1 = i; openColors(); refreshPreview(); });
  buildCarCards($('carBox2'), function () { return cfg.car2; }, function (i) { cfg.car2 = i; openColors(); refreshPreview(); });
  buildDrvCards($('drvBox1'), function () { return cfg.d1; }, function (i) { cfg.d1 = i; openColors(); refreshPreview(); }, function (i) { return mode === 'local' && i === cfg.d2; });
  buildDrvCards($('drvBox2'), function () { return cfg.d2; }, function (i) { cfg.d2 = i; openColors(); refreshPreview(); }, function (i) { return i === cfg.d1; });
  updateSummary();
}

/* ---- online screens ---- */
function netStatus(txt, bad) { var n = $('netStatus'); n.textContent = txt; n.className = bad ? 'bad' : ''; n.hidden = !txt; }
NETUI.status = function (t) { netStatus(t, false); };
NETUI.error = function (t) { netStatus(t, true); $('bCreate').disabled = false; $('bJoin').disabled = false; };
NETUI.left = function (t) { toMenu('sMain'); toast(t, 3200); };
NETUI.lobby = function () {
  cfg.mode = 'online';
  if (screen !== 'sLobby' || el.menu.hidden) { if (state.phase !== 'menu') { state.phase = 'menu'; } el.menu.hidden = false; el.hud.hidden = true; el.touch.hidden = true; el.result.hidden = true; showScreen('sLobby'); $('bCreate').disabled = false; $('bJoin').disabled = false; netStatus('', false); }
  renderLobby();
};
function renderLobby() {
  var host = NET.role === 'host', mine = NET.players.filter(function (p) { return p.id === NET.me; })[0];
  $('roomCode').textContent = NET.code;
  var h = ''; NET.players.forEach(function (p) { h += '<li class="' + (p.id === NET.me ? 'me' : '') + '"><i style="background:#' + ('000000' + p.color.toString(16)).slice(-6) + '"></i><span><img class="dic" alt="" src="' + driverIcon(p.drv | 0) + '">' + p.name + ' <small>' + CAR_INFO[p.car | 0].name + '</small></span>' + (p.id === 'host' ? '<em>المضيف</em>' : '') + '</li>'; });
  $('plist').innerHTML = h; $('pcount').textContent = NET.players.length + '/6';
  $('netNote').hidden = NET.kind !== 'bc';
  var cidx = mine ? PCOLORS.indexOf(mine.color) : cfg.c1;
  buildSwatches($('swatchesL'), function () { return cidx; }, function (i) { netSetColor(PCOLORS[i]); }, function (i) { return !colorFree(PCOLORS[i], NET.me); });
  var mycar = mine ? mine.car | 0 : cfg.car1, mydrv = mine ? mine.drv | 0 : cfg.d1;
  buildCarCards($('carBoxL'), function () { return mycar; }, function (i) { netSetPick(i, mydrv); });
  buildDrvCards($('drvBoxL'), function () { return mydrv; }, function (i) { netSetPick(mycar, i); }, function (i) { return !drvFree(i, NET.me); });
  if (mine) { cfg.car1 = mycar; cfg.d1 = mydrv; }
  $('lobbyHost').hidden = !host; $('lobbyGuest').hidden = host; $('bGo').hidden = !host; $('bGo').disabled = NET.players.length < 2;
  var def = getTrackDef(NET.track);
  if (host) { renderTracks($('trackGridL'), NET.track, function (id) { netSetTrackLaps(id, 0); }); setSeg('segLapsL', NET.laps); }
  else $('guestInfo').textContent = 'المضمار: ' + def.name + ' · ' + NET.laps + (NET.laps === 1 ? ' لفة' : ' لفات');
  cfg.laps = NET.laps; setTrack(NET.track); refreshPreview();
}
NETUI.started = function (m) {
  cfg.mode = 'online'; cfg.laps = m.laps; setTrack(m.track); NET.order = m.order; NET.inRace = true; beginRace();
};
NETUI.state = function (m) {
  for (var i = 0; i < cars.length; i++) if (cars[i].netId === m.i && cars[i].remote) { cars[i].net = m; cars[i].netT = performance.now(); return; }
};
NETUI.gone = function (id) {
  for (var i = 0; i < cars.length; i++) if (cars[i].netId === id) { cars[i].gone = true; views[cars[i].slot].root.visible = false; toast(cars[i].name + ' خرج من السباق'); }
};
NETUI.toLobby = function () { if (cfg.mode !== 'online') return; state.phase = 'menu'; NETUI.lobby(); };

function buildMenu() {
  $('inName').value = cfg.n1;
  $('inName').addEventListener('input', function (e) { cfg.n1 = e.target.value.trim().slice(0, 14); e.target.classList.remove('bad'); $('nameErr').hidden = true; saveProf(); });
  $('inName2').addEventListener('input', function (e) { cfg.n2 = e.target.value.trim().slice(0, 14); e.target.classList.remove('bad'); saveProf(); });
  if (window.matchMedia && !matchMedia('(any-pointer: fine)').matches) { $('mLocal').disabled = true; $('mLocal').querySelector('small').textContent = 'محتاج كيبورد، مش متاح على الموبايل'; }
  $('mSolo').addEventListener('click', function () { audioInit(); if (!cfg.n1) return flashName(); openSetup('solo'); });
  $('mLocal').addEventListener('click', function () { audioInit(); if (!cfg.n1) return flashName(); openSetup('local'); });
  $('mOnline').addEventListener('click', function () { audioInit(); if (!cfg.n1) return flashName(); netStatus('', false); $('inCode').value = ''; showScreen('sOnline'); });
  $('bBackS').addEventListener('click', function () { showScreen('sMain'); });
  $('bBackO').addEventListener('click', function () { netLeave(); showScreen('sMain'); });
  $('bLeave').addEventListener('click', function () { netLeave(); showScreen('sMain'); });
  bindSeg('segLaps', function (v) { cfg.laps = +v; });
  bindSeg('segDiff', function (v) { cfg.diff = v; });
  bindSeg('segAI', function (v) { cfg.aiLocal = +v; $('diffBox').hidden = cfg.aiLocal === 0; });
  bindSeg('segLapsL', function (v) { netSetTrackLaps(0, +v); });
  $('bStart').addEventListener('click', startRace);
  $('tabsS').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setTab(b.dataset.t); });
  $('bCreate').addEventListener('click', function () { $('bCreate').disabled = true; netStatus('جاري إنشاء الغرفة...', false); netCreate(cfg.n1, PCOLORS[cfg.c1], cfg.car1, cfg.d1); });
  $('bJoin').addEventListener('click', function () {
    var code = $('inCode').value.trim().toUpperCase();
    if (code.length < 4) { netStatus('اكتب رمز الغرفة', true); return; }
    $('bJoin').disabled = true; netStatus('بندخل الغرفة...', false); netJoin(code, cfg.n1, PCOLORS[cfg.c1], cfg.car1, cfg.d1);
  });
  $('inCode').addEventListener('input', function (e) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('inCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('bJoin').click(); });
  $('bGo').addEventListener('click', function () { netHostStart(); });
  $('bCopy').addEventListener('click', function () {
    var t = NET.code, ok = function () { toast('اتنسخ الرمز ' + t); };
    try { navigator.clipboard.writeText(t).then(ok, function () { toast('الرمز: ' + t); }); } catch (e) { toast('الرمز: ' + t); }
  });
  $('bResume').addEventListener('click', togglePause);
  $('bRestartP').addEventListener('click', startRace); $('bMenuP').addEventListener('click', function () { toMenu('sMain'); });
  $('bAgain').addEventListener('click', startRace);
  $('bMenuR').addEventListener('click', function () { if (cfg.mode === 'online') netLeave(); toMenu('sMain'); });
  $('bLobbyR').addEventListener('click', function () { if (NET.role === 'host') netBackToLobby(); else NET.order = []; NET.inRace = false; state.phase = 'menu'; NETUI.lobby(); });
  $('bPause').addEventListener('click', function () { if (state.phase === 'racing' || state.phase === 'countdown') togglePause(); });
  $('bMute').addEventListener('click', toggleMute); $('mMute').addEventListener('click', function () { audioInit(); toggleMute(); });
  $('bCam').addEventListener('click', cycleCam);
}

/* ---- init ---- */
setTrack(cfg.track); buildMap();
buildMenu(); showRecord(); onResize(); refreshPreview(); applyViewOffset();
el.orient.hidden = !(IS_TOUCH && window.innerHeight > window.innerWidth); $('app').classList.toggle('is-touch', !!IS_TOUCH);
window.addEventListener('resize', function () { applyViewOffset(); el.orient.hidden = !(IS_TOUCH && window.innerHeight > window.innerWidth && state.phase === 'menu'); });
window.__race = {
  step: function (sec) { var n = Math.round(sec / STEP); for (var i = 0; i < n; i++) raceStep(STEP); }, skipCountdown: function () { state.cd = 4.19; },
  state: state, cfg: cfg, NET: NET, get cars() { return cars; }, get humans() { return humans; }, get player() { return player; }, get T() { return T; }, KS: KS,
  begin: beginRace, setTrack: setTrack, openSetup: openSetup, setTab: setTab, refreshPreview: refreshPreview, get views() { return views; }, camera: camera, scene: scene, renderer: renderer, get screen() { return screen; }
};
requestAnimationFrame(function (t) { last = t; frame(t); });
