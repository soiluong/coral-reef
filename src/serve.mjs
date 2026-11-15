import { writeFileSync, appendFileSync, readFileSync, mkdirSync } from 'fs';
const out = process.argv[2], root = import.meta.dir + '/..';
mkdirSync(out, { recursive: true });
Bun.serve({
  port: 8787, async fetch(r) {
    const u = new URL(r.url);
    if (r.method == 'POST') { const b = Buffer.from(await r.arrayBuffer()); if (u.pathname == '/shot') writeFileSync(out + '/' + u.searchParams.get('n') + '.png', b); else appendFileSync(out + u.pathname + '.txt', b + '\n'); return new Response('ok') }
    if (u.pathname != '/') return new Response('', { status: 404 });
    return new Response(readFileSync(root + '/index.html'), { headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } });
  }
});
