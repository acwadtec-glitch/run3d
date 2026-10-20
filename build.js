/* Builds three outputs from src/:
 *   dist/page.html  - content for the Claude artifact (libraries from CDN)
 *   dist/test.html  - same, wrapped in a full document (for local tests)
 *   index.html      - standalone game for GitHub Pages / any web host (libraries from ./vendor, works offline)
 */
const fs = require('fs'), path = require('path');
const d = __dirname, rd = f => fs.readFileSync(path.join(d, 'src', f), 'utf8');
const code = ['sim.js', 'tracks.js', 'world.js', 'car.js', 'fx.js', 'net.js', 'game.js'].map(rd).join('\n');
const wrapped = "(function(){\n'use strict';\n" + code + "\n})();";
const tpl = rd('template.html').replace('/*@@SCRIPT@@*/', () => wrapped);
const CDN = { THREE: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', PEER: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js' };
const LOCAL = { THREE: 'vendor/three.min.js', PEER: 'vendor/peerjs.min.js' };
const fill = (t, m) => t.replace('@@THREE@@', m.THREE).replace('@@PEER@@', m.PEER);
const head = '<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>';
fs.mkdirSync(path.join(d, 'dist'), { recursive: true });
fs.writeFileSync(path.join(d, 'dist/page.html'), fill(tpl, CDN));
fs.writeFileSync(path.join(d, 'dist/test.html'), head + fill(tpl, CDN) + '</body></html>');
fs.writeFileSync(path.join(d, 'index.html'), head + fill(tpl, LOCAL) + '</body></html>');
console.log('built', (tpl.length / 1024).toFixed(0) + ' KB');
