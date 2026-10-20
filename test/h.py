import json
from playwright.sync_api import sync_playwright
three = open('/home/claude/race/node_modules/three/build/three.min.js').read()
peer = open('/home/claude/race/node_modules/peerjs/dist/peerjs.min.js').read()
URL = 'http://localhost:8765/test.html#nointro'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def mk(ctx, logs, tag, use_peer=False):
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append((tag, m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append((tag, 'pageerror', str(e))))
    def route(r):
        u = r.request.url
        if 'three.min.js' in u: r.fulfill(status=200, content_type='application/javascript', body=three)
        elif 'peerjs.min.js' in u:
            if use_peer: r.fulfill(status=200, content_type='application/javascript', body=peer)
            else: r.abort()
        elif u.startswith('http://localhost'): r.continue_()
        else: r.abort()
    pg.route('**/*', route)
    return pg
