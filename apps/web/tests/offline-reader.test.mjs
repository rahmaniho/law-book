import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { articleHref, lawHref } from '../src/lib/reader-routes.ts';

const source = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker(base, extraAssets = []) {
  const origin = 'https://example.test';
  const stores = new Map();
  const listeners = new Map();
  const fetched = [];
  let offline = false, failPath, skipped = false;
  const key = r => new URL(typeof r === 'string' ? r : r.url, origin).href;
  async function network(r) {
    const url = key(r); fetched.push(url);
    if (offline || new URL(url).pathname === failPath) throw new Error('offline / failed fetch');
    const isRsc = new URL(url).pathname.endsWith('.txt');
    return new Response(isRsc ? 'RSC shell' : 'HTML or asset', { headers: { 'Content-Type': isRsc ? 'text/plain' : 'text/html' } });
  }
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(r) { return store.get(key(r))?.clone(); },
        async put(r, res) { store.set(key(r), res.clone()); },
        async add(r) { const res = await network(r); if (!res.ok) throw new Error('bad status'); store.set(key(r), res.clone()); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const ctx = {
    URL, Response, console, caches, fetch: network,
    Request: class extends Request { constructor(r, init) { super(key(r), init); } },
    self: {
      location: new URL(`${origin}${base}/sw.js`),
      registration: {}, clients: { claim: async () => {} },
      skipWaiting: async () => { skipped = true; },
      addEventListener: (type, fn) => listeners.set(type, fn),
    },
  };
  vm.runInNewContext(source.replace('const PRECACHE_ASSETS = [];', `const PRECACHE_ASSETS = ${JSON.stringify(extraAssets)};`), ctx);
  return {
    stores, fetched, caches,
    setOffline() { offline = true; },
    failAt(path) { failPath = path; },
    get skipped() { return skipped; },
    async lifecycle(type) { let promise; listeners.get(type)({ waitUntil(p) { promise = p; } }); await promise; },
    async request(path, mode = 'cors', method = 'GET') {
      let response;
      listeners.get('fetch')({ request: { url: new URL(path, origin).href, mode, method }, respondWith(p) { response = p; } });
      return response;
    },
  };
}

for (const base of ['', '/law-book', '/Lawbook']) {
  test(`${base || '/'}: unvisited article & law use precached HTML and RSC, even with different queries`, async () => {
    const w = worker(base, ['/_next/static/chunks/reader.js']);
    await w.lifecycle('install');
    const requestsAtInstall = w.fetched.length;
    w.setOffline();
    for (const query of ['article=not-visited-1', 'article=not-visited-2', 'law=civil-code']) {
      const html = await w.request(`${base}/read/?${query}`, 'navigate');
      assert.equal(await html.text(), 'HTML or asset');
      const rsc = await w.request(`${base}/read/index.txt?${query}&_rsc=random-token`);
      assert.equal(await rsc.text(), 'RSC shell');
      assert.equal(rsc.headers.get('content-type'), 'text/plain');
    }
    const asset = await w.request(`${base}/_next/static/chunks/reader.js`);
    assert.equal(asset.status, 200);
    assert.equal(w.fetched.length, requestsAtInstall, 'no network needed for the reader shell');
    assert.equal(w.skipped, false, 'updates must not replace an open app mid-session');
  });
  test(`${base || '/'}: old deep links redirect offline to the common reader`, async () => {
    const w = worker(base); await w.lifecycle('install'); w.setOffline();
    for (const [kind, parameter] of [['article', 'article'], ['laws', 'law']]) {
      const res = await w.request(`${base}/${kind}/civil-code-10/`, 'navigate');
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), `https://example.test${base}/read/?${parameter}=civil-code-10`);
    }
  });
}

test('RSC runtime cache strips only query keys, never mixes HTML with RSC', async () => {
  const w = worker('/law-book');
  const online = await w.request('/law-book/article/x/index.txt?_rsc=a');
  assert.equal(await online.text(), 'RSC shell');
  w.setOffline();
  const cached = await w.request('/law-book/article/x/index.txt?_rsc=b');
  assert.equal(await cached.text(), 'RSC shell');
  const unknown = await w.request('/law-book/article/y/index.txt?_rsc=b');
  assert.equal(unknown.type, 'error', 'must not pretend unknown RSC content is available');
});

test('incomplete shell download rejects install rather than activating a broken worker', async () => {
  const w = worker('/law-book'); w.failAt('/law-book/read/index.txt');
  await assert.rejects(w.lifecycle('install'));
  assert.equal(w.skipped, false);
});

test('activation only removes own outdated shells; immutable law data and other apps survive', async () => {
  const w = worker('/law-book');
  for (const name of ['other-app', 'ghanoun-/Lawbook/-shell-old', 'ghanoun-/law-book/-shell-old', 'ghanoun-/law-book/-data-v1']) await w.caches.open(name);
  await w.lifecycle('install'); await w.lifecycle('activate');
  assert.ok(w.stores.has('other-app'));
  assert.ok(w.stores.has('ghanoun-/Lawbook/-shell-old'));
  assert.ok(w.stores.has('ghanoun-/law-book/-data-v1'));
  assert.equal(w.stores.has('ghanoun-/law-book/-shell-old'), false);
});

test('non-GET, external and out-of-base requests bypass the worker', async () => {
  const w = worker('/law-book');
  assert.equal(await w.request('/law-book/read/', 'cors', 'POST'), undefined);
  assert.equal(await w.request('https://other.test/law-book/read/'), undefined);
  assert.equal(await w.request('/another/index.txt'), undefined);
  assert.equal(await w.request('/law-book/sw.js'), undefined);
});

test('reader links encode IDs and preserve the shared route', () => {
  assert.equal(articleHref('a/b?c'), '/read/?article=a%2Fb%3Fc');
  assert.equal(lawHref('a b'), '/read/?law=a%20b');
});
