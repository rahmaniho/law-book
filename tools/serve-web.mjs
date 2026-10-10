/** Static-export test/preview server. Never serves repository sources or API secrets. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve(import.meta.dirname, '../apps/web/out');
const mime = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
export async function serveWeb(port = 0) {
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.webmanifest'), 'utf8'));
  const base = manifest.scope.replace(/\/$/, '');
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/' && base) { res.writeHead(302, { Location: base + '/' }); res.end(); return; }
      if (base && !pathname.startsWith(base + '/')) throw new Error('outside base');
      let file = path.resolve(out, '.' + pathname.slice(base.length));
      if (!file.startsWith(out + path.sep) && file !== out) throw new Error('outside export');
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(port, '0.0.0.0', resolve));
  return { server, base, origin: `http://127.0.0.1:${server.address().port}` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { base, server } = await serveWeb(Number(process.env.PORT ?? 3000));
  console.log(`Web preview on 0.0.0.0:${server.address().port}${base}/`);
}
