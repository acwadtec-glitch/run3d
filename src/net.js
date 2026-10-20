/* ===== online rooms: PeerJS (real internet) with a BroadcastChannel fallback (tabs of one browser) ===== */
var NET = { role: null, code: '', me: '', kind: '', tr: null, players: [], track: 'classic', laps: 3, lastSend: 0, order: [], inRace: false };
var NETUI = { status: function () { }, lobby: function () { }, started: function () { }, error: function () { }, left: function () { }, gone: function () { }, state: function () { }, toLobby: function () { } };
var CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() { var s = ''; for (var i = 0; i < 5; i++) s += CODE_CH.charAt(Math.floor(Math.random() * CODE_CH.length)); return s; }
function cleanName(n) { n = String(n || '').replace(/[<>&]/g, '').trim().slice(0, 14); return n || 'لاعب'; }

function peerTransport(role, code, H) {
  var peer, conns = {}, dead = false;
  try { peer = new Peer(role === 'host' ? 'hala310-' + code : undefined, { debug: 0 }); }
  catch (e) { setTimeout(function () { H.onError('init'); }, 0); return { send: function () { }, broadcast: function () { }, close: function () { } }; }
  function hook(conn) {
    conn.on('data', function (d) { if (!dead) H.onData(conn.peer, d); });
    conn.on('close', function () { delete conns[conn.peer]; if (!dead) H.onPeerLeave(conn.peer); });
    conn.on('error', function () { });
  }
  if (role === 'host') {
    peer.on('open', function () { H.onOpen(); });
    peer.on('connection', function (conn) { conn.on('open', function () { conns[conn.peer] = conn; hook(conn); H.onPeer(conn.peer); }); });
  } else {
    peer.on('open', function () {
      var c = peer.connect('hala310-' + code, { reliable: true, serialization: 'json' });
      c.on('open', function () { conns.host = c; hook(c); H.onOpen(); });
    });
  }
  peer.on('error', function (e) { H.onError(e && e.type ? e.type : 'error'); });
  return {
    send: function (to, msg) { var c = to === 'host' ? conns.host : conns[to]; if (c && c.open) { try { c.send(msg); } catch (e) { } } },
    broadcast: function (msg, except) { for (var id in conns) if (id !== except && conns[id].open) { try { conns[id].send(msg); } catch (e) { } } },
    close: function () { dead = true; try { peer.destroy(); } catch (e) { } }
  };
}

function bcTransport(role, code, H) {
  var ch;
  try { ch = new BroadcastChannel('hala310-' + code); } catch (e) { setTimeout(function () { H.onError('nobc'); }, 0); return { send: function () { }, broadcast: function () { }, close: function () { } }; }
  var myId = role === 'host' ? 'host' : 'g' + Math.random().toString(36).slice(2, 8), peers = {}, opened = false;
  ch.onmessage = function (ev) {
    var m = ev.data; if (!m || m.from === myId) return;
    if (m.to !== '*' && m.to !== myId) return;
    if (role === 'host') {
      if (m.k === 'join') { peers[m.from] = 1; ch.postMessage({ from: 'host', to: m.from, k: 'ok' }); H.onPeer(m.from); }
      else if (m.k === 'leave') { delete peers[m.from]; H.onPeerLeave(m.from); }
      else if (m.k === 'd') H.onData(m.from, m.d);
    } else {
      if (m.k === 'ok') { if (!opened) { opened = true; H.onOpen(); } }
      else if (m.k === 'd') H.onData('host', m.d);
      else if (m.k === 'bye') H.onPeerLeave('host');
    }
  };
  setTimeout(function () { if (role === 'host') H.onOpen(); else ch.postMessage({ from: myId, to: 'host', k: 'join' }); }, 0);
  return {
    send: function (to, msg) { ch.postMessage({ from: myId, to: to === 'host' ? 'host' : to, k: 'd', d: msg }); },
    broadcast: function (msg, except) { for (var id in peers) if (id !== except) ch.postMessage({ from: 'host', to: id, k: 'd', d: msg }); },
    close: function () { try { ch.postMessage({ from: myId, to: role === 'host' ? '*' : 'host', k: role === 'host' ? 'bye' : 'leave' }); ch.close(); } catch (e) { } }
  };
}

function netReset() {
  if (NET.tr) { try { NET.tr.close(); } catch (e) { } }
  NET.tr = null; NET.role = null; NET.players = []; NET.me = ''; NET.kind = ''; NET.order = []; NET.inRace = false;
}
function hasPeerLib() { return typeof Peer === 'function'; }
function colorFree(col, exceptId) { return NET.players.every(function (p) { return p.id === exceptId || p.color !== col; }); }
function freeColor(want) {
  if (colorFree(want)) return want;
  for (var i = 0; i < PCOLORS.length; i++) if (colorFree(PCOLORS[i])) return PCOLORS[i];
  return want;
}

/* ---- host side ---- */
function freeDrv(want, exceptId) {
  want = (want | 0) % DRIVERS.length;
  for (var k = 0; k < DRIVERS.length; k++) { var d = (want + k) % DRIVERS.length; if (NET.players.every(function (p) { return p.id === exceptId || p.drv !== d; })) return d; }
  return want;
}
function drvFree(d, exceptId) { return NET.players.every(function (p) { return p.id === exceptId || p.drv !== d; }); }
function cleanCar(c) { c = c | 0; return c >= 0 && c < LOOKS.length ? c : 0; }
function netCreate(name, color, car, drv) {
  netReset(); NET.role = 'host'; NET.code = genCode(); NET.me = 'host';
  NET.players = [{ id: 'host', name: cleanName(name), color: color, car: cleanCar(car), drv: (drv | 0) % DRIVERS.length }];
  NET.track = cfg.track; NET.laps = cfg.laps;
  tryHost(hasPeerLib() ? 'peer' : 'bc', 0);
}
function tryHost(kind, attempt) {
  var done = false, tr = null, tm;
  var H = {
    onOpen: function () { if (done) return; done = true; clearTimeout(tm); NET.tr = tr; NET.kind = kind; NETUI.lobby(); },
    onPeer: function () { },
    onData: function (id, m) { hostData(id, m); },
    onPeerLeave: function (id) { hostLeave(id); },
    onError: function (err) {
      if (done) return; done = true; clearTimeout(tm); try { tr && tr.close(); } catch (e) { }
      if (err === 'unavailable-id' && attempt < 3) { NET.code = genCode(); tryHost(kind, attempt + 1); }
      else if (kind === 'peer') { NETUI.status('الإنترنت مش متاح هنا، بنعمل غرفة محلية (لنفس المتصفح)'); tryHost('bc', 0); }
      else NETUI.error('تعذر إنشاء الغرفة');
    }
  };
  tm = setTimeout(function () { H.onError('timeout'); }, 7000);
  tr = (kind === 'peer' ? peerTransport : bcTransport)('host', NET.code, H);
}
function hostBroadcastLobby() {
  NET.tr && NET.tr.broadcast({ t: 'lobby', players: NET.players, track: NET.track, laps: NET.laps });
  NETUI.lobby();
}
function hostData(id, m) {
  if (!m || !NET.tr) return;
  var p;
  if (m.t === 'hello') {
    if (NET.inRace || NET.players.length >= 6) { NET.tr.send(id, { t: 'busy' }); return; }
    NET.players.push({ id: id, name: cleanName(m.name), color: freeColor(m.color), car: cleanCar(m.car), drv: freeDrv(m.drv) });
    NET.tr.send(id, { t: 'welcome', id: id }); hostBroadcastLobby();
  } else if (m.t === 'color') {
    p = NET.players.filter(function (x) { return x.id === id; })[0];
    if (p && colorFree(m.color, id)) { p.color = m.color; hostBroadcastLobby(); }
  } else if (m.t === 'pick') {
    p = NET.players.filter(function (x) { return x.id === id; })[0];
    if (p) { p.car = cleanCar(m.car); if (drvFree(m.drv | 0, id) && (m.drv | 0) >= 0 && (m.drv | 0) < DRIVERS.length) p.drv = m.drv | 0; hostBroadcastLobby(); }
  } else if (m.t === 's') { NETUI.state(m); NET.tr.broadcast(m, id); }
  else if (m.t === 'leave') hostLeave(id);
}
function hostLeave(id) {
  var before = NET.players.length;
  NET.players = NET.players.filter(function (p) { return p.id !== id; });
  if (NET.players.length === before) return;
  if (NET.inRace) { NETUI.gone(id); NET.tr && NET.tr.broadcast({ t: 'gone', id: id }); }
  else hostBroadcastLobby();
}
function netHostStart() {
  if (NET.role !== 'host' || NET.players.length < 2) return;
  var order = NET.players.slice();
  for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
  NET.inRace = true;
  var msg = { t: 'start', track: NET.track, laps: NET.laps, order: order };
  NET.tr.broadcast(msg); NETUI.started(msg);
}
function netBackToLobby() {
  NET.inRace = false; NET.order = [];
  if (NET.role === 'host' && NET.tr) NET.tr.broadcast({ t: 'toLobby' });
}
function netSetColor(col) {
  if (NET.role === 'host') { var me = NET.players[0]; if (colorFree(col, 'host')) { me.color = col; hostBroadcastLobby(); } }
  else if (NET.tr) NET.tr.send('host', { t: 'color', color: col });
}
function netSetPick(car, drv) {
  if (NET.role === 'host') { var me = NET.players[0]; me.car = cleanCar(car); if (drvFree(drv, 'host')) me.drv = drv; hostBroadcastLobby(); }
  else if (NET.tr) NET.tr.send('host', { t: 'pick', car: car, drv: drv });
}
function netSetTrackLaps(track, laps) { if (NET.role !== 'host') return; if (track) NET.track = track; if (laps) NET.laps = laps; hostBroadcastLobby(); }

/* ---- guest side ---- */
function netJoin(code, name, color, car, drv) {
  netReset(); NET.role = 'guest'; NET.code = code;
  tryJoin(hasPeerLib() ? 'peer' : 'bc', name, color, car, drv);
}
function tryJoin(kind, name, color, car, drv) {
  var settled = false, tr = null, tm;
  function fail() {
    if (settled) return; settled = true; clearTimeout(tm); try { tr && tr.close(); } catch (e) { } NET.tr = null;
    if (kind === 'peer') { NETUI.status('بندوّر على الغرفة...'); tryJoin('bc', name, color, car, drv); }
    else NETUI.error('الغرفة مش موجودة، راجع الرمز');
  }
  var H = {
    onOpen: function () {
      clearTimeout(tm); NET.tr = tr; NET.kind = kind;
      tr.send('host', { t: 'hello', name: cleanName(name), color: color, car: car, drv: drv });
      tm = setTimeout(fail, 3500);
    },
    onPeer: function () { },
    onData: function (id, m) { if (m && m.t === 'welcome') { settled = true; clearTimeout(tm); NET.me = m.id; } guestData(m); },
    onPeerLeave: function () { if (settled) { netReset(); NETUI.left('المضيف خرج من الغرفة'); } else fail(); },
    onError: function () { fail(); }
  };
  tm = setTimeout(fail, kind === 'peer' ? 9000 : 2000);
  tr = (kind === 'peer' ? peerTransport : bcTransport)('guest', NET.code, H);
}
function guestData(m) {
  if (!m) return;
  if (m.t === 'lobby') { NET.players = m.players; NET.track = m.track; NET.laps = m.laps; NETUI.lobby(); }
  else if (m.t === 'busy') { netReset(); NETUI.error('الغرفة مش متاحة دلوقتي (ممتلئة أو السباق بدأ)'); }
  else if (m.t === 'start') { NET.inRace = true; NETUI.started(m); }
  else if (m.t === 's') NETUI.state(m);
  else if (m.t === 'gone') NETUI.gone(m.id);
  else if (m.t === 'toLobby') { NET.inRace = false; NET.order = []; NETUI.toLobby(); }
}
function netSendState(m) {
  if (!NET.tr) return;
  if (NET.role === 'host') NET.tr.broadcast(m); else NET.tr.send('host', m);
}
function netLeave() { netReset(); }
window.addEventListener('pagehide', function () { netReset(); });
