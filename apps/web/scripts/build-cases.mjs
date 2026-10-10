#!/usr/bin/env node
/**
 * ساخت مجموعهٔ «آراء قضایی» از فایل data/sources/cases/case.csv.
 *
 * خروجی درون پوشهٔ نسخه:
 *   cases/index.json   فهرست قابل‌جست‌وجو (شناسه، عنوان، شماره، تاریخ، نوع و متن نرمال‌شده)
 *   cases/c0.json …    متن کامل رأی‌ها در قطعه‌های ۲۰۰تایی
 *
 * این مجموعه «اختیاری» است: در همگام‌سازی پیش‌فرض برنامه دانلود نمی‌شود و
 * فقط با فعال‌سازی کاربر دریافت می‌گردد تا حجم نصب اولیه ثابت بماند.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from './lib/csv.mjs';
import { clean, normalizeForSearch, toFaDigits, dateToSort } from './lib/fa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** بیشینهٔ متن ذخیره‌شده برای هر رأی (نویسه) */
const TEXT_CAP = 2500;
/** بیشینهٔ متن نرمال‌شده برای جست‌وجو (نویسه) */
const NORM_CAP = 900;
/** تعداد رأی در هر قطعه */
const CHUNK = 200;

const SOURCE_NAME = 'مجموعهٔ آراء قضایی';

/**
 * @param {{ versionDir: string, version: string }} opts
 * @returns {{pointer: object, count: number} | null}
 */
export function buildCases({ versionDir, version }) {
  const csvPath = path.join(ROOT, 'data', 'sources', 'cases', 'case.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('   ⓘ فایل خام مجموعهٔ آراء قضایی (data/sources/cases/case.csv) در این دستگاه نیست؛ دادهٔ ساخته‌شدهٔ پیشین حفظ می‌شود.');
    return null;
  }

  const rows = parseCsvObjects(fs.readFileSync(csvPath, 'utf8'));
  const seen = new Set();
  const verdicts = [];

  rows.forEach((row, idx) => {
    const rawText = clean(row.text || '');
    if (rawText.length < 40) return; // ردیف‌های تهی یا بی‌متن
    const rawTitle = clean(row.title || '').replace(/\s+/g, ' ').trim();
    const number = toFaDigits((row.number || '').replace(/\s+/g, ''));
    const type = clean(row.type || '').trim() || 'نامشخص';
    const date = toFaDigits((row.date || '').replace(/\s+/g, ' ').trim());

    let id = number ? `v-${number}` : `v-${String(idx).padStart(5, '0')}`;
    if (seen.has(id)) id = `${id}-${idx}`;
    seen.add(id);

    const truncated = rawText.length > TEXT_CAP;
    const text = truncated ? `${rawText.slice(0, TEXT_CAP).trimEnd()}…` : rawText;
    const normSource = `${rawTitle} ${number} ${rawText.slice(0, 600)}`;
    const norm = normalizeForSearch(normSource).slice(0, NORM_CAP);

    verdicts.push({
      id,
      title: rawTitle || `رأی ${toFaDigits(idx + 1)}`,
      number,
      date,
      dateSort: dateToSort(date.replace(/\s*\/\s*/g, '/')) || 0,
      type,
      chars: rawText.length,
      truncated,
      text,
      norm,
    });
  });

  if (!verdicts.length) return null;

  const casesDir = path.join(versionDir, 'cases');
  fs.rmSync(casesDir, { recursive: true, force: true });
  fs.mkdirSync(casesDir, { recursive: true });

  /* فهرست قابل‌جست‌وجو */
  const index = verdicts.map((v) => ({
    id: v.id,
    title: v.title,
    number: v.number,
    date: v.date,
    dateSort: v.dateSort,
    type: v.type,
    chars: v.chars,
    truncated: v.truncated,
    norm: v.norm,
  }));
  const indexPath = `/data/v/${version}/cases/index.json`;
  const indexBody = JSON.stringify({ version, source: SOURCE_NAME, count: index.length, index });
  fs.writeFileSync(path.join(casesDir, 'index.json'), indexBody, 'utf8');

  /* قطعه‌های متن کامل */
  const parts = [];
  for (let i = 0; i < verdicts.length; i += CHUNK) {
    const slice = verdicts.slice(i, i + CHUNK);
    const name = `c${parts.length}.json`;
    const body = JSON.stringify({ version, items: slice });
    fs.writeFileSync(path.join(casesDir, name), body, 'utf8');
    parts.push({
      path: `/data/v/${version}/cases/${name}`,
      bytes: Buffer.byteLength(body),
      count: slice.length,
    });
  }

  const bytes = parts.reduce((s, p) => s + p.bytes, 0) + Buffer.byteLength(indexBody);
  const pointer = {
    version,
    source: SOURCE_NAME,
    count: verdicts.length,
    bytes,
    indexPath,
    indexBytes: Buffer.byteLength(indexBody),
    parts,
    types: [...new Set(verdicts.map((v) => v.type))].sort(),
  };

  console.log(
    `   آراء قضایی: ${toFaDigits(verdicts.length)} رأی در ${toFaDigits(parts.length)} قطعه (${(bytes / 1024 / 1024).toFixed(1)} مگابایت — دریافتِ اختیاری)`,
  );
  return { pointer, count: verdicts.length };
}

/** اجرای مستقل (برای بررسی خروجی بدون ساخت کل داده‌ها) */
if (process.argv[1] && process.argv[1].endsWith('build-cases.mjs')) {
  const version = process.argv[2] || 'standalone';
  const versionDir = path.join(ROOT, 'public', 'data', 'v', version);
  const result = buildCases({ versionDir, version });
  if (!result) process.exit(0);
  console.log('\n   ✅ ساخت مجموعهٔ آراء انجام شد.\n');
}
