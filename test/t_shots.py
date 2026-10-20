import sys
sys.path.insert(0, '/home/claude/race/test')
from h import *
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for tag, w, h, mob in (('d', 1280, 720, False), ('m', 400, 800, True)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=mob, is_mobile=mob)
        pg = mk(ctx, logs, tag)
        pg.goto(URL); pg.wait_for_timeout(2500)
        pg.fill('#inName', 'عمرو')
        pg.screenshot(path=f'/home/claude/race/test/s_{tag}_1_main.png')
        pg.click('#mOnline'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'/home/claude/race/test/s_{tag}_2_online.png')
        pg.click('#bCreate'); pg.wait_for_function("__race.screen === 'sLobby'", timeout=30000); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'/home/claude/race/test/s_{tag}_3_lobby.png')
        pg.click('#bLeave'); pg.wait_for_timeout(500)
        pg.click('#mLocal'); pg.wait_for_timeout(1000)
        pg.screenshot(path=f'/home/claude/race/test/s_{tag}_4_local.png')
        ctx.close()
    for l in logs:
        if 'ERR_FAILED' not in l[2]: print(l)
    b.close()
