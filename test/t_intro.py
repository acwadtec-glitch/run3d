import sys
sys.path.insert(0,'/home/claude/race/test')
from h import *
from playwright.sync_api import sync_playwright
for W,H,tag,mob in [(1280,720,'d',False),(390,780,'m',True)]:
    logs=[]
    with sync_playwright() as p:
        b=p.chromium.launch(args=ARGS+['--autoplay-policy=no-user-gesture-required'])
        ctx=b.new_context(viewport={'width':W,'height':H},has_touch=mob,is_mobile=mob)
        pg=mk(ctx,logs,tag); pg.goto('http://localhost:8765/test.html'); pg.wait_for_timeout(2600)
        pg.screenshot(path=f'test/i_{tag}_1.png')
        pg.evaluate("document.getElementById('bIntro').click()"); pg.wait_for_timeout(700)
        print('ctx', pg.evaluate("(()=>{return __race.introDone})()"))
        pg.wait_for_timeout(1400); pg.screenshot(path=f'test/i_{tag}_2.png')
        pg.wait_for_timeout(1500)
        print(tag,'intro hidden',pg.evaluate("document.getElementById('intro').hidden"),[l for l in logs if l[1]=='pageerror'])
        b.close()
