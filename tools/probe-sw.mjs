#!/usr/bin/env node
/**
 * probe-sw.mjs — بازتولید یافتهٔ «شکاف آفلاین» گزارش فاز اول.
 *
 * منطق واقعی `public/sw.js` پروژهٔ Lawbook را در یک context ایزولهٔ `vm` اجرا می‌کند
 * (همان روشی که آزمون‌های خود پروژه در `tests/pwa.test.mjs` به کار می‌برند) و برای
 * مجموعه‌ای از URLهای واقعی بررسی می‌کند که آیا Service Worker آن‌ها را رهگیری
 * (و در نتیجه کش) می‌کند یا نه.
 *
 * هر URL که رهگیری نشود، آفلاین از شبکه درخواست می‌شود و شکست می‌خورد.
 *
 * استفاده:
 *   node tools/probe-sw.mjs [مسیر sw.js] [آدرس استقرار]
 *
 * مثال:
 *   node tools/probe-sw.mjs ../Lawbook/public/sw.js https://rahmaniho.github.io/Lawbook/sw.js
 */
import fs from 'node:fs';
import vm from 'node:vm';

const swPath = process.argv[2] ?? '../Lawbook/public/sw.js';
const swUrl = process.argv[3] ?? 'https://rahmaniho.github.io/Lawbook/sw.js';

if (!fs.existsSync(swPath)) {
  console.error(`✗ فایل سرویس‌ورکر پیدا نشد: ${swPath}`);
  console.error('  مسیر را به‌عنوان آرگومان اول بدهید، مثلاً: node tools/probe-sw.mjs ../Lawbook/public/sw.js');
  process.exit(1);
}

const source = fs.readFileSync(swPath, 'utf8');
const origin = new URL(swUrl).origin;
const base = new URL('./', swUrl).pathname.replace(/\/+$/, '');

/** بارگذاری sw.js در یک sandbox با حداقل APIهای لازم */
function loadServiceWorker() {
  const listeners = new Map();
  const cache = {
    match: async () => undefined,
    put: async () => {},
    add: async () => {},
    addAll: async () => {},
  };

  class RequestStub {
    constructor(url) {
      this.url = String(url);
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
    Blob: class {},
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
  vm.runInContext(source, sandbox, { filename: 'sw.js' });
  return listeners;
}

const listeners = loadServiceWorker();
const onFetch = listeners.get('fetch');
if (!onFetch) {
  console.error('✗ هندلر fetch در سرویس‌ورکر ثبت نشده است.');
  process.exit(1);
}

/** آیا respondWith صدا زده می‌شود؟ یعنی SW این درخواست را در دست می‌گیرد. */
function isIntercepted(url, mode) {
  let intercepted = false;
  onFetch({
    request: { url, method: 'GET', mode },
    respondWith: () => {
      intercepted = true;
    },
  });
  return intercepted;
}

const u = (p) => `${origin}${base}${p}`;

const probes = [
  ['پوستهٔ پیش‌کش‌شده (navigate)', u('/laws/'), 'navigate', true],
  ['صفحهٔ ماده — بارگذاری کامل (navigate)', u('/article/civil-code-10/'), 'navigate', true],
  ['RSC payload صفحهٔ ماده — ناوبری کلاینتی', u('/article/civil-code-10/index.txt'), 'cors', true],
  ['RSC payload صفحهٔ قانون — ناوبری کلاینتی', u('/laws/civil-code/index.txt'), 'cors', true],
  ['دادهٔ نسخه‌دار قانون', u('/data/v/1.0.0+65fd6099/laws/civil-code.p0.json'), 'cors', true],
  ['اشاره‌گر نسخه', u('/data/version.json'), 'cors', true],
  ['چانک استاتیک Next.js', u('/_next/static/chunks/main.js'), 'no-cors', true],
  ['آیکون PWA', u('/icons/icon-512.png'), 'no-cors', true],
];

console.log(`\nسرویس‌ورکر: ${swPath}`);
console.log(`استقرار   : ${swUrl}`);
console.log(`basePath  : ${base || '(ریشهٔ دامنه)'}\n`);

let gaps = 0;
for (const [label, url, mode, shouldBeCached] of probes) {
  const hit = isIntercepted(url, mode);
  if (shouldBeCached && !hit) gaps += 1;
  const mark = hit ? '✅ رهگیری می‌شود ' : '❌ رهگیری نمی‌شود';
  console.log(`${mark} | ${label}`);
  console.log(`${' '.repeat(18)}| ${url}`);
}

console.log('');
if (gaps > 0) {
  console.log(`⚠️  ${gaps} منبع رهگیری نمی‌شود — این‌ها آفلاین در دسترس نخواهند بود.`);
  console.log('   جزئیات و راه‌حل: docs/PHASE-1-AUDIT.md بخش ۴');
  process.exitCode = 1;
} else {
  console.log('✅ همهٔ منابع بررسی‌شده توسط سرویس‌ورکر پوشش داده می‌شوند.');
}
