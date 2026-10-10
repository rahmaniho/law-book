#!/usr/bin/env node
/**
 * تولید همهٔ آیکون‌ها (PWA، apple-touch، maskable، فاویکون) از لوگوی اصلی برنامه.
 *
 * منبع حقیقت: public/icons/logo-source.png (لوگوی اصلی «کتابچه حقوق»؛ دست‌نخورده)
 * اجرا: npm run icons:gen
 *
 * - گوشه‌های بیرونیِ تیره (پس‌زمینهٔ بیرون از جعبهٔ گرد) شفاف می‌شوند.
 * - نسخه‌های opaque (apple-touch و maskable) روی رنگ سرمهٔ لوگو تخت می‌شوند،
 *   چون iOS و سیستم‌های maskable شفافیت را سیاه نمایش می‌دهند.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'icons');
const SOURCE = path.join(OUT, 'logo-source.png');

/** رنگ زمینهٔ سرمه‌ای لوگو (نمونه‌برداری از مرکز پس‌زمینه) */
const BG = { r: 29, g: 43, b: 69, alpha: 1 };

if (!fs.existsSync(SOURCE)) {
  console.error(`✗ لوگوی منبع پیدا نشد: ${SOURCE}`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

/** نسخهٔ RGBA با گوشه‌های بیرونی شفاف (flood-fill از چهار گوشه روی پیکسل‌های تقریباً سیاه). */
async function transparentLogo() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const out = Buffer.from(data);
  const seen = new Uint8Array(W * H);
  const stack = [0, W - 1, (H - 1) * W, W * H - 1];
  const isDark = (i) => out[i] < 40 && out[i + 1] < 40 && out[i + 2] < 40;
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!isDark(i)) continue;
    out[i + 3] = 0;
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

async function write(name, pipeline) {
  const file = path.join(OUT, name);
  await pipeline.png({ compressionLevel: 9 }).toFile(file);
  const meta = await sharp(file).metadata();
  console.log(`✓ ${name} (${meta.width}×${meta.height})`);
}

const logo = await transparentLogo();

// any: لوگوی گرد و شفاف
await write('icon-192.png', sharp(logo).resize(192, 192));
await write('icon-512.png', sharp(logo).resize(512, 512));
await write('favicon-32.png', sharp(logo).resize(32, 32));

// maskable: زمینهٔ کامل سرمه‌ای، لوگو در ناحیهٔ امن ۸۰٪ مرکزی
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const innerPng = await sharp(logo).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } }).composite([
    { input: innerPng, gravity: 'centre' },
  ]);
}
await write('maskable-192.png', await maskable(192));
await write('maskable-512.png', await maskable(512));

// apple-touch: opaque و تخت، iOS خودش گوشه‌ها را گرد می‌کند
await write(
  'apple-touch-icon.png',
  sharp({ create: { width: 180, height: 180, channels: 4, background: BG } }).composite([
    { input: await sharp(logo).resize(180, 180).png().toBuffer(), gravity: 'centre' },
  ]),
);

// favicon.ico: نسخهٔ PNG ۳۲ پیکسلی کنار همین فایل (مرورگرهای مدرن PNG داخل ico را می‌پذیرند)
fs.copyFileSync(path.join(OUT, 'favicon-32.png'), path.join(ROOT, 'public', 'favicon.ico'));
console.log('✓ favicon.ico');
