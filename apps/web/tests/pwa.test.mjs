/**
 * آزمون‌های PWA و سازگاری basePath.
 *
 * این‌ها همان چیزهایی را بررسی می‌کنند که باعث می‌شد برنامه در استقرار زیرمسیر
 * نصب نشود: manifest با مسیرهای ریشهٔ دامنه، ثبت Service Worker روی `/sw.js`،
 * و مسیرهای مطلقِ داخل خودِ Service Worker.
 *
 * سرویس‌ورکر واقعاً در یک context مجزا اجرا می‌شود و آدرس‌هایی که کش می‌کند
 * یا رهگیری می‌کند از رفتارش بیرون کشیده می‌شود (نه از متن فایل).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

import { normalizeBasePath, resolveBasePath, withBase, DEFAULT_BASE_PATH } from '../config/base-path.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/* ------------------------------------------------------------------ *
 * config/base-path.mjs
 * ------------------------------------------------------------------ */

test('normalizeBasePath شکل‌های مختلف را یکسان می‌کند', () => {
  assert.equal(normalizeBasePath('/Lawbook'), '/Lawbook');
  assert.equal(normalizeBasePath('/Lawbook/'), '/Lawbook');
  assert.equal(normalizeBasePath('Lawbook'), '/Lawbook');
  assert.equal(normalizeBasePath('/'), '');
  assert.equal(normalizeBasePath(''), '');
  assert.equal(normalizeBasePath(undefined), '');
});

test('resolveBasePath پیش‌فرض استقرار زیرمسیر و حالت‌های صریح را درست انتخاب می‌کند', () => {
  assert.equal(resolveBasePath({}), DEFAULT_BASE_PATH, 'بدون هیچ env باید پیش‌فرض استقرار زیرمسیر باشد');
  assert.equal(resolveBasePath({ NEXT_PUBLIC_BASE_PATH: '' }), '', 'رشتهٔ خالی یعنی ریشهٔ دامنه');
  assert.equal(resolveBasePath({ NEXT_PUBLIC_BASE_PATH: '/foo' }), '/foo');
  assert.equal(resolveBasePath({ VERCEL: '1' }), '', 'روی Vercel پیش‌فرض اعمال نمی‌شود');
});

test('withBase مسیر مطلق را به basePath می‌چسباند و idempotent است', () => {
  assert.equal(withBase('/Lawbook', '/manifest.webmanifest'), '/Lawbook/manifest.webmanifest');
  assert.equal(withBase('/Lawbook', '/Lawbook/manifest.webmanifest'), '/Lawbook/manifest.webmanifest');
  assert.equal(withBase('', '/manifest.webmanifest'), '/manifest.webmanifest');
});

/* ------------------------------------------------------------------ *
 * next.config.mjs
 * ------------------------------------------------------------------ */

const nextConfig = (await import('../next.config.mjs')).default;

test('next.config basePath و env سمت کلاینت را هم‌راستا نگه می‌دارد', () => {
  const expected = resolveBasePath();
  assert.equal(nextConfig.basePath ?? '', expected);
  assert.equal(
    nextConfig.env?.NEXT_PUBLIC_BASE_PATH,
    expected,
    'بدون این، Service Worker و manifest در کلاینت به ریشهٔ دامنه اشاره می‌کنند',
  );
  assert.equal(nextConfig.trailingSlash, true);
});

/* ------------------------------------------------------------------ *
 * manifest ساخته‌شده
 * ------------------------------------------------------------------ */

const basePath = resolveBasePath();
const manifest = read(path.join(PUBLIC, 'manifest.webmanifest'));
/** مسیرِ داخل manifest → مسیرِ فایل روی دیسک */
const toFile = (url) => path.join(PUBLIC, url.replace(`${basePath}/`, '').replace(/^\//, ''));

test('manifest start_url / scope / id داخل scope سرویس‌ورکر هستند', () => {
  const expected = `${basePath}/`;
  assert.equal(manifest.start_url, expected);
  assert.equal(manifest.scope, expected);
  assert.equal(manifest.id, expected);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.dir, 'rtl');
});

test('همهٔ آیکون‌های manifest با basePath شروع می‌شوند و فایلشان وجود دارد', () => {
  assert.ok(manifest.icons.length >= 3, 'باید چند آیکون داشته باشد');
  for (const icon of manifest.icons) {
    if (basePath) {
      assert.ok(
        icon.src.startsWith(`${basePath}/`),
        `آیکون ${icon.src} خارج از basePath است و ۴۰۴ می‌شود`,
      );
    }
    assert.ok(fs.existsSync(toFile(icon.src)), `فایل آیکون یافت نشد: ${icon.src}`);
  }
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), 'آیکون ۱۹۲ برای نصب لازم است');
  assert.ok(sizes.includes('512x512'), 'آیکون ۵۱۲ برای نصب لازم است');
  assert.ok(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'آیکون maskable برای آیکون تطبیقی اندروید لازم است',
  );
});

test('میان‌برهای manifest هم زیر basePath هستند', () => {
  for (const shortcut of manifest.shortcuts) {
    if (basePath) {
      assert.ok(shortcut.url.startsWith(`${basePath}/`), `میان‌بر ${shortcut.url} خارج از basePath است`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * src/lib/base-path.ts — اجرای واقعی ماژولِ سمت کلاینت
 * ------------------------------------------------------------------ */

/** ماژول TS را در فرآیند جدا با env دلخواه اجرا می‌کند و خروجی‌اش را می‌گیرد */
function runBasePathModule(basePathEnv) {
  const env = { ...process.env };
  if (basePathEnv === undefined) delete env.NEXT_PUBLIC_BASE_PATH;
  else env.NEXT_PUBLIC_BASE_PATH = basePathEnv;
  const script =
    `import('file://${path.join(ROOT, 'src/lib/base-path.ts').replace(/\\/g, '/')}')` +
    `.then((m) => console.log(JSON.stringify({ BASE_PATH: m.BASE_PATH, sw: m.swUrl(), manifest: m.withBase('/manifest.webmanifest') })))`;
  const out = execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--import', './tests/_loader-register.mjs', '-e', script],
    { cwd: ROOT, env, encoding: 'utf8' },
  );
  return JSON.parse(out.trim().split('\n').pop());
}

test('ماژول base-path مسیر SW و manifest را زیر basePath می‌سازد', () => {
  assert.deepEqual(runBasePathModule('/Lawbook'), {
    BASE_PATH: '/Lawbook',
    sw: '/Lawbook/sw.js',
    manifest: '/Lawbook/manifest.webmanifest',
  });
});

test('ماژول base-path در استقرار روی ریشهٔ دامنه مسیر مطلق ساده می‌سازد', () => {
  assert.deepEqual(runBasePathModule(''), {
    BASE_PATH: '',
    sw: '/sw.js',
    manifest: '/manifest.webmanifest',
  });
});

test('بیلد تولیدی، basePath را درون باندلِ کلاینت جای‌گذاری می‌کند', async (t) => {
  const chunks = path.join(ROOT, 'out/_next/static/chunks');
  if (!fs.existsSync(chunks)) {
    t.skip('خروجی بیلد موجود نیست — ابتدا `npm run build` اجرا شود');
    return;
  }
  const expected = resolveBasePath();
  if (!expected) {
    t.skip('basePath این بیلد خالی است');
    return;
  }
  // Shared imports may be split out of layout by webpack; inspect all emitted chunks.
  const layoutChunk = walk(chunks).filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  // next.config.mjs مقدار را از راه `env` به DefinePlugin می‌دهد؛ اگر این
  // جای‌گذاری انجام نشود، BASE_PATH در مرورگر خالی می‌ماند و SW روی
  // `/sw.js` ثبت می‌شود (۴۰۴ در استقرار زیرمسیر).
  assert.ok(
    layoutChunk.includes(JSON.stringify(expected)),
    `basePath=${expected} درون باندل کلاینت جای‌گذاری نشده است`,
  );
});

/* ------------------------------------------------------------------ *
 * public/sw.js — اجرای واقعی در context مجزا
 * ------------------------------------------------------------------ */

function loadServiceWorker(swUrl) {
  const listeners = new Map();
  const cachedRequests = [];

  const cache = {
    async add(request) {
      cachedRequests.push(String(request.url));
    },
    async match() {
      return undefined;
    },
    async put() {
      return undefined;
    },
  };

  class RequestStub {
    constructor(input, init = {}) {
      this.url = String(input);
      this.method = init.method || 'GET';
      this.mode = init.mode || 'cors';
    }
  }
  class ResponseStub {
    constructor(body = '', init = {}) {
      this.body = body;
      this.init = init;
      this.ok = true;
    }
    clone() {
      return this;
    }
    static error() {
      const r = new ResponseStub();
      r.ok = false;
      return r;
    }
  }

  const sandbox = {
    console,
    URL,
    Request: RequestStub,
    Response: ResponseStub,
    fetch: async () => new ResponseStub(''),
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    Promise,
    setTimeout,
    Math,
    JSON,
    Object,
    Array,
    String,
  };
  sandbox.self = {
    location: new URL(swUrl),
    registration: { navigationPreload: null, sync: null, periodicSync: null },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, fn) => listeners.set(type, fn),
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8'), sandbox, { filename: 'sw.js' });
  return { listeners, cachedRequests };
}

async function runInstall(sw) {
  const install = sw.listeners.get('install');
  assert.ok(install, 'هندلر install ثبت نشده است');
  let pending;
  install({ waitUntil: (p) => (pending = p) });
  await pending;
}

/** true اگر رهگیری شده باشد (یعنی respondWith صدا زده شده) */
function isIntercepted(sw, url, mode = 'navigate') {
  const fetchListener = sw.listeners.get('fetch');
  let intercepted = false;
  fetchListener({
    request: { url, method: 'GET', mode },
    respondWith: () => {
      intercepted = true;
    },
  });
  return intercepted;
}

test('sw.js زیر basePath پوسته را با همان پیشوند کش می‌کند', async () => {
  const sw = loadServiceWorker('https://example.com/Lawbook/sw.js');
  await runInstall(sw);
  assert.deepEqual(sw.cachedRequests, [
    '/Lawbook/',
    '/Lawbook/laws/',
    '/Lawbook/search/',
    '/Lawbook/bookmarks/',
    '/Lawbook/settings/',
    '/Lawbook/about/',
    '/Lawbook/offline/',
    '/Lawbook/coverage/',
    '/Lawbook/read/',
    '/Lawbook/cases/',
    '/Lawbook/calculator/diyyeh/',
    '/Lawbook/calculator/inheritance/',
    '/Lawbook/index.txt',
    '/Lawbook/laws/index.txt',
    '/Lawbook/search/index.txt',
    '/Lawbook/bookmarks/index.txt',
    '/Lawbook/settings/index.txt',
    '/Lawbook/about/index.txt',
    '/Lawbook/offline/index.txt',
    '/Lawbook/coverage/index.txt',
    '/Lawbook/read/index.txt',
    '/Lawbook/cases/index.txt',
    '/Lawbook/calculator/diyyeh/index.txt',
    '/Lawbook/calculator/inheritance/index.txt',
    '/Lawbook/manifest.webmanifest',
  ]);
});

test('sw.js در استقرار روی ریشهٔ دامنه هم درست کار می‌کند', async () => {
  const sw = loadServiceWorker('https://example.com/sw.js');
  await runInstall(sw);
  assert.deepEqual(sw.cachedRequests, [
    '/',
    '/laws/',
    '/search/',
    '/bookmarks/',
    '/settings/',
    '/about/',
    '/offline/',
    '/coverage/',
    '/read/',
    '/cases/',
    '/calculator/diyyeh/',
    '/calculator/inheritance/',
    '/index.txt',
    '/laws/index.txt',
    '/search/index.txt',
    '/bookmarks/index.txt',
    '/settings/index.txt',
    '/about/index.txt',
    '/offline/index.txt',
    '/coverage/index.txt',
    '/read/index.txt',
    '/cases/index.txt',
    '/calculator/diyyeh/index.txt',
    '/calculator/inheritance/index.txt',
    '/manifest.webmanifest',
  ]);
});

test('sw.js ناوبری و داده‌های نسخه‌دار زیر basePath را رهگیری می‌کند', () => {
  const sw = loadServiceWorker('https://example.com/Lawbook/sw.js');
  assert.ok(isIntercepted(sw, 'https://example.com/Lawbook/laws/civil-code/'), 'ناوبری باید رهگیری شود');
  assert.ok(
    isIntercepted(sw, 'https://example.com/Lawbook/data/v/1.0.0+abc/catalog.json', 'cors'),
    'دادهٔ نسخه‌دار باید رهگیری شود',
  );
  assert.ok(
    isIntercepted(sw, 'https://example.com/Lawbook/_next/static/css/a.css', 'no-cors'),
    'دارایی‌های ایستا باید رهگیری شوند',
  );
});

test('sw.js خودش را رهگیری نمی‌کند تا نسخهٔ کهنه قفل نشود', () => {
  const sw = loadServiceWorker('https://example.com/Lawbook/sw.js');
  assert.equal(isIntercepted(sw, 'https://example.com/Lawbook/sw.js', 'no-cors'), false);
});

test('sw.js درخواست‌های دامنهٔ دیگر را رهگیری نمی‌کند', () => {
  const sw = loadServiceWorker('https://example.com/Lawbook/sw.js');
  assert.equal(isIntercepted(sw, 'https://cdn.example.com/lib.js', 'no-cors'), false);
  assert.equal(isIntercepted(sw, 'https://other.example.org/Lawbook/', 'navigate'), false);
});

/* ------------------------------------------------------------------ *
 * نگهبان‌های بازگشتی روی منبع
 * ------------------------------------------------------------------ */

const registerSrc = fs.readFileSync(path.join(ROOT, 'src/components/pwa-register.tsx'), 'utf8');

test('ثبت Service Worker از مسیر basePath-آگاه استفاده می‌کند', () => {
  assert.match(registerSrc, /serviceWorker\.register\(swUrl\(\)\)/, 'ثبت SW باید از swUrl() استفاده کند');
  assert.doesNotMatch(registerSrc, /register\(['"]\/sw\.js['"]/, 'ثبت SW با مسیر مطلقِ ریشه در استقرار زیرمسیر ۴۰۴ می‌شود');
  assert.doesNotMatch(registerSrc, /scope:\s*['"]\/['"]/, 'scope گسترده‌تر از پوشهٔ SW بدون هدر مخصوص رد می‌شود');
});

const layoutSrc = fs.readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8');

test('لینک manifest در layout با basePath ساخته می‌شود', () => {
  assert.match(layoutSrc, /manifest:\s*withBase\('\/manifest\.webmanifest'\)/);
  assert.doesNotMatch(layoutSrc, /manifest:\s*'\/manifest\.webmanifest'/);
  assert.match(layoutSrc, /apple:\s*\[/, 'آیکون apple-touch باید لینک شود تا نصب iOS آیکون داشته باشد');
});

/* ------------------------------------------------------------------ *
 * نگهبان‌های اسکرول
 * ------------------------------------------------------------------ */

const globalsCss = fs.readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');

test('body دیگر با overflow-x:hidden به کانتینر اسکرول تبدیل نمی‌شود', () => {
  // این ترکیب باعث می‌شد overflow-y به auto تبدیل شود و position:sticky از کار بیفتد
  assert.doesNotMatch(globalsCss, /html,\s*\n?\s*body\s*\{[^}]*overflow-x:\s*hidden/, 'قاعدهٔ مشترک html+body برگشته است');
  const bodyBlocks = globalsCss.match(/body\s*\{[^}]*\}/g) ?? [];
  for (const block of bodyBlocks) {
    assert.doesNotMatch(block, /overflow-x:\s*hidden/, 'overflow-x:hidden روی body چسبندگی را می‌شکند');
  }
  assert.match(globalsCss, /body\s*\{[^}]*overflow-x:\s*clip/, 'body باید با overflow-x:clip بسته شود');
  assert.match(globalsCss, /--topbar-h:/, 'متغیر ارتفاع نوار بالا باید تعریف شده باشد');
});

test('هیچ صفحه‌ای offset چسبندگی را با عدد ثابت ۵۲px نمی‌نویسد', () => {
  const offenders = [];
  for (const file of walk(path.join(ROOT, 'src'))) {
    if (!file.endsWith('.tsx')) continue;
    if (fs.readFileSync(file, 'utf8').includes('top-[52px]')) offenders.push(path.relative(ROOT, file));
  }
  assert.deepEqual(offenders, [], 'offset چسبندگی باید از var(--topbar-h) بیاید');
});

test('فهرست ماده‌ها کانتینر اسکرول تودرتو با ارتفاع ثابت نمی‌سازد', () => {
  // توضیحات فارسیِ داخل کامنت‌ها نام راه‌حل قبلی را ذکر می‌کنند؛ فقط «کد» بررسی می‌شود
  const bits = fs.readFileSync(path.join(ROOT, 'src/components/bits.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bits, /<FixedSizeList/, 'FixedSizeList کانتینر اسکرول تودرتو می‌سازد');
  assert.doesNotMatch(bits, /react-window/);
  assert.doesNotMatch(bits, /window\.innerHeight/, 'ارتفاع مبتنی بر innerHeight روی موبایل می‌پرد');
  assert.match(bits, /export function ArticleList\(/);
  assert.match(bits, /IntersectionObserver/, 'رندر تدریجی باید با IntersectionObserver انجام شود');
});

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
