import sys, json
sys.path.insert(0, '/home/claude/race/test')
from h import *
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    # ---- solo on the forest track
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = mk(ctx, logs, 'solo')
    pg.goto(URL); pg.wait_for_timeout(2000)
    pg.fill('#inName', 'عمرو'); pg.click('#mSolo'); pg.wait_for_timeout(500)
    pg.click('#tabsS button[data-t="trk"]'); pg.click('#trackGrid .tk:nth-child(3)'); pg.wait_for_timeout(800)
    pg.click('#bStart'); pg.wait_for_timeout(600)
    pg.evaluate("__race.skipCountdown()"); pg.wait_for_timeout(2500)
    pg.evaluate("__race.state.auto=true; __race.step(14)"); pg.wait_for_timeout(2500)
    pg.screenshot(path='/home/claude/race/test/r1_forest.png')
    print('solo', json.dumps(pg.evaluate("({phase:__race.state.phase, track:__race.cfg.track, name:__race.player.name, n:__race.cars.length, spd:Math.round(__race.player.speed*3.6)})")))
    ctx.close()
    # ---- local two players on the oval
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = mk(ctx, logs, 'local')
    pg.goto(URL); pg.wait_for_timeout(2000)
    pg.fill('#inName', 'عمرو'); pg.click('#mLocal'); pg.wait_for_timeout(500)
    pg.click('#bStart'); pg.wait_for_timeout(300)
    print('p2 name required:', pg.evaluate("document.getElementById('inName2').classList.contains('bad')"))
    pg.fill('#inName2', 'سالم'); pg.click('#tabsS button[data-t="trk"]'); pg.click('#trackGrid .tk:nth-child(2)'); pg.wait_for_timeout(800)
    pg.click('#bStart'); pg.wait_for_timeout(600)
    pg.evaluate("__race.skipCountdown()"); pg.wait_for_timeout(2500)
    # P1 holds W, P2 holds ArrowUp
    pg.keyboard.down('KeyW'); pg.keyboard.down('ArrowUp'); pg.keyboard.down('ArrowLeft')
    pg.evaluate("__race.step(2.5)"); pg.wait_for_timeout(2500)
    pg.screenshot(path='/home/claude/race/test/r2_local.png')
    print('local', json.dumps(pg.evaluate("({phase:__race.state.phase, humans:__race.humans.map(h=>[h.name, Math.round(h.speed*3.6), +h.h.toFixed(2)]), n:__race.cars.length})")))
    pg.keyboard.up('KeyW'); pg.keyboard.up('ArrowUp'); pg.keyboard.up('ArrowLeft')
    ctx.close()
    for l in logs: 
        if 'ERR_FAILED' not in l[2]: print(l)
    b.close()
