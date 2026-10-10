/**
 * تستِ یکپارچگیِ جست‌وجو: ایندکس MiniSearch دقیقاً با همان پیکربندیِ
 * `src/lib/search-client.ts` روی داده‌های واقعی ساخته می‌شود تا معلوم شود
 * جست‌وجو برای واژه‌های دارای حروف فارسیِ «ی، ک، گ، چ، پ، ژ» هم درست کار
 * می‌کند و مسیرِ «ماده ۱۰ قانون مدنی» نتیجهٔ درست می‌دهد.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import MiniSearch from 'minisearch';

import { normalizeForSearch, tokenize, parseQuery } from '../src/lib/fa';

const ROOT = path.resolve(import.meta.dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'version.json'), 'utf8')).version;
const lawsDir = path.join(ROOT, 'public', 'data', 'v', version, 'laws');

function loadArticles() {
  const out = [];
  for (const file of fs.readdirSync(lawsDir)) {
    if (!file.endsWith('.json')) continue;
    const body = JSON.parse(fs.readFileSync(path.join(lawsDir, file), 'utf8'));
    out.push(...(Array.isArray(body) ? body : body.articles ?? []));
  }
  return out;
}

const articles = loadArticles();

function buildIndex(docs) {
  const index = new MiniSearch({
    idField: 'id',
    fields: ['textNorm', 'titleNorm', 'keywordNorm'],
    storeFields: ['id'],
    tokenize: (text) => tokenize(text),
    processTerm: (term) => (term.length > 1 ? term : null),
    searchOptions: { boost: { titleNorm: 2.2, keywordNorm: 1.6, textNorm: 1 }, fuzzy: 0.2, prefix: true },
  });
  index.addAll(
    docs.map((a) => ({
      ...a,
      textNorm: normalizeForSearch(a.text),
      titleNorm: normalizeForSearch(`${a.lawTitle} ${a.numberFa} ${a.chapter ?? ''}`),
      keywordNorm: normalizeForSearch((a.keywords || []).join(' ')),
    })),
  );
  return index;
}

/** بازتولیدِ رفتار `localSearch` در search-client.ts */
/** امتیازِ تطابق ساختاری «ماده X قانون Y» — هم‌ارز با search-client.ts */
const STRUCTURAL_SCORE = 100_000;

function search(q, limit = 40) {
  const index = buildIndex(articles);
  const parsed = parseQuery(q);
  const normQ = normalizeForSearch(q);
  const scored = new Map();
  const structural = new Set();
  const byId = new Map(articles.map((a) => [a.id, a]));

  if (parsed.article !== null) {
    const lawHint = normalizeForSearch(parsed.lawHint);
    for (const a of articles) {
      if (a.numberValue !== parsed.article) continue;
      if (lawHint.length > 2 && !normalizeForSearch(`${a.lawTitle} ${a.lawId}`).includes(lawHint)) continue;
      if (lawHint.length > 2) {
        const title = normalizeForSearch(`${a.lawTitle} ${a.lawId}`);
        structural.add(a.id);
        scored.set(a.id, STRUCTURAL_SCORE + Math.max(0, 200 - title.length));
      }
    }
  }

  let hits = index.search(normQ, { combineWith: 'AND' });
  if (!hits.length) hits = index.search(normQ, { combineWith: 'OR' });
  for (const h of hits.slice(0, 200)) {
    if (structural.has(h.id)) continue;
    scored.set(h.id, (scored.get(h.id) ?? 0) + h.score);
  }

  const rank = (id) => (structural.has(id) ? 1 : 0);
  return [...scored.entries()]
    .sort((a, b) => rank(b[0]) - rank(a[0]) || b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => byId.get(id))
    .filter(Boolean);
}

test('داده‌های جست‌وجو بارگذاری می‌شوند', () => {
  assert.ok(articles.length > 1000, `تنها ${articles.length} ماده بارگذاری شد`);
  for (const a of articles.slice(0, 50)) {
    assert.ok(a.id && a.lawId && a.text, `مادهٔ ناقص: ${a.id}`);
  }
});

test('جست‌وجو برای واژه‌های دارای حروف فارسیِ بالاتر از U+064A نتیجه می‌دهد', () => {
  // این واژه‌ها پیش از اصلاح نرمال‌سازی، حروف «ی/ک/گ/چ/پ/ژ» خود را از دست می‌دادند
  const cases = [
    ['چک', 'چ'],
    ['دیه', 'ی'],
    ['ارث', null],
    ['گمرک', 'گ'],
    ['ورشکستگی', 'ک'],
    ['استخدام', null],
  ];
  for (const [query, letter] of cases) {
    const results = search(query, 5);
    assert.ok(results.length > 0, `جست‌وجوی «${query}» هیچ نتیجه‌ای نداشت`);
    if (letter) {
      const hit = results.find((a) => normalizeForSearch(a.text).includes(normalizeForSearch(query)));
      assert.ok(hit, `هیچ نتیجه‌ای برای «${query}» شامل واژهٔ کامل نیست (حرف «${letter}» حذف شده؟)`);
    }
  }
});

test('مسیرِ «ماده N قانون …» مادهٔ درست را می‌یابد', () => {
  const parsed = parseQuery('ماده ۱ قانون مدنی');
  assert.equal(parsed.article, 1);
  assert.ok(parsed.lawHint.includes('مدنی'));

  const results = search('ماده ۱ قانون مدنی', 20);
  const top = results[0];
  assert.ok(top, 'جست‌وجوی «ماده ۱ قانون مدنی» نتیجه‌ای نداشت');
  assert.equal(top.lawId, 'civil-code', `نخستین نتیجه باید قانون مدنی باشد، نه ${top.lawId}`);
  assert.equal(top.numberValue, 1, `شماره ماده باید ۱ باشد، نه ${top.numberValue}`);
});

test('بریدهٔ نتیجه (excerpt) متنِ خوانا دارد', async () => {
  const { excerpt } = await import('../src/lib/fa');
  const sample = articles.find((a) => a.text.includes('دیه')) ?? articles[0];
  const out = excerpt(sample.text, 'دیه', 60);
  assert.ok(out.includes('دیه'), 'بریده باید شامل واژهٔ جست‌وجو باشد');
  assert.ok(!/\s{3,}/.test(out), 'بریده دارای فاصلهٔ تکراری است');
});
