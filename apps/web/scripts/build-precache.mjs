/** Fingerprint the actual export, and precache all code/fonts needed by unvisited routes.
 * Only small shared shells are precached, NOT the 7,000+ legacy article pages or law data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'out');
if (process.env.VERCEL === '1') throw new Error('Offline precaching currently requires a static export.');
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const assets = (await Promise.all(['_next/static', 'icons'].map(dir => walk(path.join(out, dir)))))
  .flat().filter(file => /\.(js|css|woff2?|png|svg|ico)$/.test(file)).sort();
const shells = ['', 'laws', 'search', 'bookmarks', 'settings', 'about', 'offline', 'coverage', 'read', 'cases', 'calculator/diyyeh', 'calculator/inheritance'];
const required = shells.flatMap(dir => ['index.html', 'index.txt'].map(file => path.join(out, dir, file)));
const template = await fs.readFile(path.join(root, 'public/sw.js'), 'utf8');
const hash = createHash('sha256').update(template);
let bytes = 0;
for (const file of [...assets, ...required, path.join(out, 'manifest.webmanifest')]) {
  const body = await fs.readFile(file); // Fail the build on an incomplete export.
  hash.update(path.relative(out, file)).update(body);
  bytes += body.length;
}
const version = hash.digest('hex').slice(0, 20);
const urls = assets.map(file => '/' + path.relative(out, file).split(path.sep).join('/'));
const sw = template.replace("const VERSION = 'v3';", `const VERSION = '${version}';`)
  .replace('const PRECACHE_ASSETS = [];', `const PRECACHE_ASSETS = ${JSON.stringify(urls)};`);
await fs.writeFile(path.join(out, 'sw.js'), sw);
console.log(`Offline shell ${version}: ${assets.length} assets + ${required.length} shells, ${(bytes / 1024 / 1024).toFixed(2)} MiB (uncompressed)`);
