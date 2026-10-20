import sys, json
sys.path.insert(0, '/home/claude/race/test')
from h import *
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1000, 'height': 560})
    pg = mk(ctx, logs, 'x')
    pg.goto(URL); pg.wait_for_timeout(2000)
    pg.fill('#inName', 'عمرو'); pg.click('#mLocal'); pg.fill('#inName2', 'سالم')
    pg.click('#tabsS button[data-t="trk"]'); pg.click('#segLaps button[data-v="1"]'); pg.click('#tabsS button[data-t="race"]'); pg.click('#segAI button[data-v="2"]'); pg.click('#bStart'); pg.wait_for_timeout(500)
    pg.evaluate("__race.skipCountdown()"); pg.wait_for_timeout(2200)
    pg.evaluate("__race.state.auto=true; __race.step(75)"); pg.wait_for_timeout(5000)
    print(json.dumps(pg.evaluate("({phase:__race.state.phase, fin:__race.cars.map(c=>[c.name, c.finished? +c.finishT.toFixed(1):null])})"), ensure_ascii=False))
    pg.screenshot(path='/home/claude/race/test/f1_local_result.png')
    pg.click('#bAgain'); pg.wait_for_timeout(1500)
    print('restart phase', pg.evaluate("__race.state.phase"), 'cars', pg.evaluate("__race.cars.length"))
    pg.click('#bPause') if False else None
    for l in logs:
        if 'ERR_FAILED' not in l[2]: print(l)
    b.close()
