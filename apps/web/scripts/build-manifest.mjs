#!/usr/bin/env node
/**
 * ساخت `public/manifest.webmanifest` با مسیرهای سازگار با basePath.
 *
 * چرا لازم است؟ Next.js فیلد `metadata.manifest` را با basePath ترکیب نمی‌کند و
 * خودِ manifest هم یک فایل ایستا در `public/` است. اگر `start_url`، `scope` و
 * `icons` به‌صورت مطلق از ریشهٔ دامنه نوشته شوند، در استقرار زیرمسیر
 * همهٔ آن‌ها ۴۰۴ یا خارج از scope
 * می‌شوند و کروم دکمهٔ «نصب» را هرگز فعال نمی‌کند.
 *
 * این اسکریپت idempotent است و در `npm run data:build` صدا زده می‌شود.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBasePath, withBase } from '../config/base-path.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'manifest.webmanifest');

const basePath = resolveBasePath();
/** مسیرِ مطلقِ سازگار با basePath — همیشه با اسلش شروع می‌شود */
const u = (p) => withBase(basePath, p);

const manifest = {
  name: 'کتابچه قانون ایران',
  short_name: 'کتابچه قانون',
  description:
    'قوانین و مقررات جمهوری اسلامی ایران؛ مرور و جست‌وجوی سریع و آفلاین در مواد قانونی. جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه — توسعه: کارن سافت.',
  // start_url / scope / id باید داخل scope سرویس‌ورکر باشند، وگرنه نصب رد می‌شود.
  start_url: u('/'),
  scope: u('/'),
  id: u('/'),
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  orientation: 'portrait',
  background_color: '#ffffff',
  theme_color: '#0f766e',
  lang: 'fa',
  dir: 'rtl',
  categories: ['books', 'education', 'reference', 'government'],
  icons: [
    { src: u('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: u('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: u('/icons/maskable-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: u('/icons/maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: u('/icons/apple-touch-icon.png'), sizes: '180x180', type: 'image/png', purpose: 'any' },
  ],
  shortcuts: [
    {
      name: 'جست‌وجو در قوانین',
      short_name: 'جست‌وجو',
      url: u('/search/'),
      icons: [{ src: u('/icons/icon-192.png'), sizes: '192x192' }],
    },
    {
      name: 'قانون مدنی',
      short_name: 'قانون مدنی',
      url: u('/read/?law=civil-code'),
    },
    {
      name: 'نشان‌شده‌ها',
      short_name: 'نشان‌ها',
      url: u('/bookmarks/'),
    },
  ],
  prefer_related_applications: false,
};

const body = `${JSON.stringify(manifest, null, 2)}\n`;
if (fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === body) {
  console.log(`manifest: بدون تغییر (basePath=${basePath || '/'})`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body, 'utf8');
  console.log(`manifest: public/manifest.webmanifest ساخته شد (basePath=${basePath || '/'})`);
}
