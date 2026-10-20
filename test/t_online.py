import sys, json, time
sys.path.insert(0, '/home/claude/race/test')
from h import *
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 480, 'height': 270})
    A = mk(ctx, logs, 'host', use_peer=True); B = mk(ctx, logs, 'guest', use_peer=True)
    A.goto(URL, timeout=90000, wait_until='domcontentloaded'); B.goto(URL, timeout=90000, wait_until='domcontentloaded'); A.wait_for_timeout(4000)
    A.fill('#inName', 'مضيف'); A.click('#mOnline'); A.click('#bCreate')
    t0 = time.time()
    A.wait_for_function("__race.screen === 'sLobby'", timeout=30000)
    print('host lobby after %.1fs, kind=%s' % (time.time() - t0, A.evaluate("__race.NET.kind")))
    code = A.evaluate("__race.NET.code"); print('code', code)
    B.fill('#inName', 'ضيف'); B.click('#mOnline'); B.fill('#inCode', code); B.click('#bJoin')
    t0 = time.time()
    B.wait_for_function("__race.screen === 'sLobby'", timeout=40000)
    print('guest lobby after %.1fs, kind=%s' % (time.time() - t0, B.evaluate("__race.NET.kind")))
    A.wait_for_timeout(800)
    print('host sees players:', A.evaluate("__race.NET.players.map(p=>p.name+':'+p.color.toString(16))"))
    print('guest sees players:', B.evaluate("__race.NET.players.map(p=>p.name+':'+p.color.toString(16))"), 'me=', B.evaluate("__race.NET.me"))
    A.screenshot(path='/home/claude/race/test/o1_host_lobby.png'); B.screenshot(path='/home/claude/race/test/o2_guest_lobby.png')
    # host picks oval + 1 lap
    A.evaluate("document.querySelector('#trackGridL .tk:nth-child(2)').click()"); A.evaluate("document.querySelector('#segLapsL button[data-v=\"1\"]').click()")
    B.wait_for_function("__race.NET.track === 'oval' && __race.NET.laps === 1", timeout=10000)
    print('guest info:', B.evaluate("document.getElementById('guestInfo').textContent"))
    # guest picks another colour
    B.evaluate("document.querySelector('#swatchesL .sw:nth-child(4)').click()"); A.wait_for_timeout(1200)
    print('colors now:', A.evaluate("__race.NET.players.map(p=>p.color.toString(16))"))
    A.click('#bGo')
    A.wait_for_function("__race.state.phase === 'countdown'", timeout=10000); B.wait_for_function("__race.state.phase === 'countdown'", timeout=10000)
    print('both counting down; track', A.evaluate("__race.cfg.track"), B.evaluate("__race.cfg.track"), 'order A', A.evaluate("__race.cars.map(c=>c.name+(c.remote?'(r)':''))"), 'order B', B.evaluate("__race.cars.map(c=>c.name+(c.remote?'(r)':''))"))
    A.evaluate("__race.skipCountdown()"); B.evaluate("__race.skipCountdown()"); A.wait_for_timeout(2500)
    A.evaluate("__race.KS[0].up=1; __race.step(3.0)"); A.wait_for_timeout(4000)
    ra = A.evaluate("(()=>{const c=__race.player; return [c.x, c.z, Math.round(c.speed*3.6)]})()")
    rb = B.evaluate("(()=>{const c=__race.cars.find(c=>c.remote); return c? [c.x, c.z, Math.round(c.speed*3.6), !!c.net]:null})()")
    print('host car', ra, ' as seen on guest', rb)
    B.screenshot(path='/home/claude/race/test/o3_guest_race.png')
    # guest leaves -> host notified
    B.evaluate("window.dispatchEvent(new Event('pagehide'))"); A.wait_for_timeout(1500)
    print('host cars after leave:', A.evaluate("__race.cars.map(c=>c.name+(c.gone?'(gone)':''))"))
    for l in logs:
        if 'ERR_FAILED' not in l[2]: print(l)
    b.close()
