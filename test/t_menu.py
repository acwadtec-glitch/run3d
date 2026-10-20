import sys, json
sys.path.insert(0, '/home/claude/race/test')
from h import *
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 720})
    pg = mk(ctx, logs, 'a')
    pg.goto(URL); pg.wait_for_timeout(2500)
    pg.screenshot(path='/home/claude/race/test/n1_main.png')
    # name required
    pg.click('#mSolo'); pg.wait_for_timeout(300)
    print('err shown:', pg.evaluate("!document.getElementById('nameErr').hidden"))
    pg.fill('#inName', 'عمرو'); pg.click('#mSolo'); pg.wait_for_timeout(1200)
    print('screen:', pg.evaluate("__race.screen"))
    pg.screenshot(path='/home/claude/race/test/n2_setup.png')
    # pick desert track
    pg.click('#tabsS button[data-t="trk"]'); pg.click('#trackGrid .tk:nth-child(4)'); pg.wait_for_timeout(1500)
    print('track:', pg.evaluate("__race.cfg.track"), 'L', pg.evaluate("Math.round(__race.T.L)"))
    pg.screenshot(path='/home/claude/race/test/n3_desert.png')
    logs and print(logs[:10])
    b.close()
