/**
 * آزمون‌های تجزیه‌گرها — به‌ویژه بازگشتی‌بودنِ پیمایشِ `subdivisions`
 * در فایل‌های JSON ساختاریافته. پیش از رفع این مورد، موادی که در سطوح
 * تودرتوی تقسیمات بودند (مثل بخش → فصل → مبحث) اصلاً خوانده نمی‌شدند و
 * برای قانون امور حسبی ۳۰۴ ماده از ۳۷۸ ماده از دست می‌رفت.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseHubJson } from '../scripts/lib/parse.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const HUB = path.join(ROOT, 'data', 'sources', 'structured-laws');
const read = (f) => parseHubJson(fs.readFileSync(path.join(HUB, f), 'utf8'));

/** شمارشِ مستقل از تجزیه‌گر (برای اینکه آزمون، خودِ تجزیه‌گر را بازتولید نکند) */
function countDeep(file) {
  const data = JSON.parse(fs.readFileSync(path.join(HUB, file), 'utf8'));
  let n = 0;
  const walk = (divs) => {
    for (const dv of divs || []) {
      n += (dv.articles || []).filter((a) => (a.text || '').trim()).length;
      walk(dv.subdivisions || []);
    }
  };
  walk(data.divisions || []);
  return n;
}

test('تجزیه‌گر JSON به همهٔ سطوحِ subdivisions می‌رود', () => {
  for (const file of ['laws_batch3_hosbi_law.json', 'laws_batch3_customs_law.json']) {
    const expected = countDeep(file);
    const { articles } = read(file);
    assert.equal(
      articles.length,
      expected,
      `${file}: ${articles.length} ماده خوانده شد در حالی که ${expected} ماده در منبع است`,
    );
  }
});

test('قانون امور حسبی و گمرکی کامل خوانده می‌شوند', () => {
  const hosbi = read('laws_batch3_hosbi_law.json');
  const customs = read('laws_batch3_customs_law.json');
  assert.equal(hosbi.articles.length, 378, 'شمار مواد قانون امور حسبی نادرست است');
  assert.equal(customs.articles.length, 165, 'شمار مواد قانون امور گمرکی نادرست است');
  for (const a of [...hosbi.articles, ...customs.articles]) {
    assert.ok(a.text && a.text.length > 5, 'ماده‌ای با متن خالی تولید شده است');
  }
});

test('مسیرِ تقسیمات (path) در سطوح تودرتو درست انباشته می‌شود', () => {
  const { articles } = read('laws_batch3_customs_law.json');
  const nested = articles.filter((a) => a.path.length >= 2);
  assert.ok(nested.length > 0, 'هیچ ماده‌ای در سطح تودرتو یافت نشد');
  const sample = nested[0];
  assert.ok(sample.path.every((p) => typeof p === 'string' && p.trim()), 'مسیر نامعتبر است');
});

test('شمارهٔ ماده‌ها و مکررها درست استخراج می‌شود', () => {
  const { articles } = read('laws_batch3_military_service_law.json');
  const nums = articles.map((a) => a.number).filter((n) => typeof n === 'number');
  assert.ok(nums.includes(1), 'مادهٔ ۱ یافت نشد');
  assert.ok(nums.length >= 84, `تنها ${nums.length} مادهٔ شماره‌دار یافت شد`);
  // این سند مادهٔ مکرر دارد (۱۷ مکرر و …)
  assert.ok(
    articles.some((a) => a.mokarrar),
    'هیچ مادهٔ مکرری شناسایی نشد',
  );
});

test('هر سندِ ساخت‌یافتهٔ یکپارچه‌شده در فهرست، ماده دارد', async () => {
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'version.json'), 'utf8')).version;
  const catalog = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'data', 'v', version, 'catalog.json'), 'utf8'),
  );
  const hubLaws = catalog.laws.filter((l) => l.source?.kind === 'hub');
  assert.ok(hubLaws.length > 0, 'هیچ سندی با منبع ساخت‌یافته نیست');
  for (const law of hubLaws) {
    assert.ok(law.articleCount > 0, `${law.id}: سندِ ساخت‌یافته بدون ماده است`);
  }
});
