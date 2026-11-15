import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { gzipSync } from 'zlib';
const dir = import.meta.dir;
// minify WGSL inside /*wgsl*/`...` literals
const wg = s => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\s*([^\w\s$])\s*/g, '$1').trim();
mkdirSync(dir + '/.tmp', { recursive: true });
for (const f of ['shaders.js', 'geo.js', 'main.js']) writeFileSync(dir + '/.tmp/' + f, readFileSync(dir + '/' + f, 'utf8').replace(/\/\*wgsl\*\/`([^`]*)`/g, (m, s) => '`' + (process.env.NOMIN ? s : wg(s)) + '`'));
const r = await Bun.build({ entrypoints: [dir + '/.tmp/main.js'], minify: !process.env.NOMIN, target: 'browser', format: 'esm' });
if (!r.success) { console.error(r.logs); process.exit(1) }
const js = (await r.outputs[0].text()).trim();
const html = `<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=apple-mobile-web-app-capable content=yes><meta name=mobile-web-app-capable content=yes><meta name=apple-mobile-web-app-status-bar-style content=black-translucent><meta name=theme-color content=#03294a><title>Coral Reef</title><style>html,body{margin:0;height:100%;background:#03294a;overflow:hidden}canvas{display:block;width:100vw;height:100vh;height:100dvh}pre{position:fixed;left:10px;top:10px;margin:0;color:#fff;font:12px ui-monospace,monospace;text-shadow:0 0 3px #000}#f{position:fixed;right:calc(14px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom));width:44px;height:44px;padding:10px;border:0;border-radius:12px;background:#0007;opacity:0;transition:opacity .4s;cursor:pointer;-webkit-tap-highlight-color:transparent}.a #f{opacity:.9}body:not(.a){cursor:none}</style><canvas id=c></canvas><pre id=h></pre><button id=f aria-label="Toggle fullscreen" title="Fullscreen (F)"><svg viewBox="0 0 24 24" fill=none stroke=#fff stroke-width=2.2 stroke-linecap=round stroke-linejoin=round><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button><script type=module>${js}</script>`;
writeFileSync(dir + '/../index.html', html);
console.log('index.html', html.length, 'bytes, gzip', gzipSync(html, { level: 9 }).length);
