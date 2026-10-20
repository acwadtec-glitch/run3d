import sys
sys.path.insert(0,'/home/claude/race/test')
from h import *
from playwright.sync_api import sync_playwright
def run(W,H,tag,mobile):
    logs=[]
    with sync_playwright() as p:
        b=p.chromium.launch(args=ARGS)
        ctx=b.new_context(viewport={'width':W,'height':H},has_touch=mobile,is_mobile=mobile)
        pg=mk(ctx,logs,tag); pg.goto(URL); pg.wait_for_timeout(2500)
        pg.fill('#inName','عمرو')
        pg.evaluate("document.getElementById('mSolo').click()"); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'test/u_{tag}_car.png')
        pg.evaluate("document.querySelector('#carBox1 .cc:nth-child(3)').click()"); pg.evaluate("document.querySelector('#tabsS button[data-t=drv]').click()")
        pg.evaluate("document.querySelector('#drvBox1 .dc:nth-child(3)').click()"); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'test/u_{tag}_drv.png')
        pg.evaluate("document.querySelector('#tabsS button[data-t=trk]').click()"); pg.wait_for_timeout(400)
        pg.screenshot(path=f'test/u_{tag}_trk.png')
        print(tag,[l for l in logs if l[1]=='pageerror'])
        b.close()
run(1280,720,'d',False); run(390,780,'m',True)
