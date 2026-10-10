/**
 * تست‌های یکپارچگی داده‌های تولیدشده (خروجی scripts/build-data.mjs).
 *
 * این تست‌ها روی فایل‌های `public/data` اجرا می‌شوند — یعنی همان چیزی که
 * برنامه در زمان اجرا مصرف می‌کند. هرگونه ناسازگاریِ آمار، شناسه، قطعه‌ها
 * یا مجموعهٔ آراء در اینجا باید شکار شود.
 *
 * قواعدِ اصلیِ برنامه:
 *   - همهٔ اسناد باید متن ماده‌به‌ماده داشته باشند (بدون سندِ «فقط شناسنامه» یا «فقط عنوان»)
 *   - همهٔ ماده‌ها باید متن داشته باشند (بدون مادهٔ فقط‌عنوان)
 *   - هیچ ارجاعی به گیت‌هاب در داده‌های منتشرشده نباشد
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const inPublic = (urlPath) => path.join(PUBLIC, urlPath.replace(/^\//, ''));

const pointerPath = path.join(PUBLIC, 'data', 'version.json');

test('فایل version.json وجود دارد و ساختار پایه درست است', () => {
  assert.ok(fs.existsSync(pointerPath), 'public/data/version.json ساخته نشده است');
  const pointer = read(pointerPath);
  assert.ok(pointer.version, 'نسخه ثبت نشده است');
  assert.ok(pointer.releasedAt, 'تاریخ انتشار ثبت نشده است');
  assert.ok(pointer.catalogPath, 'مسیر فهرست ثبت نشده است');
  assert.ok(Array.isArray(pointer.laws) && pointer.laws.length, 'فهرست قطعه‌های قوانین خالی است');
  assert.ok(fs.existsSync(inPublic(pointer.catalogPath)), 'فایل فهرست یافت نشد');
});

const pointer = fs.existsSync(pointerPath) ? read(pointerPath) : null;
const versionDir = pointer ? path.join(PUBLIC, 'data', 'v', pointer.version) : null;
const catalog = versionDir ? read(path.join(versionDir, 'catalog.json')) : null;

test('فهرست (catalog) بخش‌های اصلی را دارد', () => {
  assert.ok(catalog, 'فهرست بارگذاری نشد');
  for (const key of ['categories', 'hierarchy', 'laws', 'stats']) {
    assert.ok(catalog[key], `بخش «${key}» در فهرست نیست`);
  }
  assert.equal(catalog.version ?? pointer.version, pointer.version);
});

test('شناسهٔ قوانین یکتاست', () => {
  const ids = catalog.laws.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'شناسهٔ تکراری در قوانین وجود دارد');
});

test('همهٔ اسناد متن کامل دارند (بدون سندِ «فقط شناسنامه» یا «فقط عنوان»)', () => {
  const withoutText = catalog.laws.filter((l) => (l.articleCount ?? 0) === 0);
  assert.equal(withoutText.length, 0, `اسناد بدون متن ماده: ${withoutText.map((l) => l.id).join(', ')}`);
  assert.equal(catalog.stats.fullTextCount, catalog.laws.length, 'همهٔ اسناد باید متن کامل داشته باشند');
});

test('آمار فهرست با محتوای واقعی هم‌خوان است', () => {
  const s = catalog.stats;
  assert.equal(s.lawCount, catalog.laws.length, 'شمار کل اسناد ناسازگار است');
  assert.equal(s.fullTextCount, catalog.laws.length, 'شمار اسناد با متن ناسازگار است');
  assert.equal(s.categoryCount, catalog.categories.length, 'شمار دسته‌ها ناسازگار است');

  const sumArticles = catalog.laws.reduce((n, l) => n + (l.articleCount ?? 0), 0);
  assert.equal(s.articleCount, sumArticles, 'شمار کل ماده‌ها ناسازگار است');
});

test('نسخهٔ داده، هشِ محتوای قوانین و فهرست (کاتالوگ) است', () => {
  /* نسخه باید با تغییر «فهرست» (حذف/افزودن سند، دسته، چک‌لیست) هم عوض شود؛
     وگرنه کلاینتی که فهرست قدیمی را کش کرده، فهرست تازه را نمی‌گیرد. */
  const catalogForHash = { ...catalog, version: '' };
  const catalogHash = sha(JSON.stringify(catalogForHash)).slice(0, 8);
  const aggregateHash = sha(
    [...catalog.laws.map((l) => `${l.id}:${l.hash}`).sort(), `catalog:${catalogHash}`].join('|'),
  ).slice(0, 8);
  assert.equal(
    pointer.version,
    `${pointer.version.split('+')[0]}+${aggregateHash}`,
    'نسخهٔ داده با هش محتوای قوانین و فهرست هم‌خوان نیست',
  );
  assert.equal(pointer.version, catalog.version, 'نسخهٔ اشاره‌گر و فهرست باید یکی باشد');
});

test('دسته و سلسله‌مراتب هر سند معتبر است', () => {
  const cats = new Set(catalog.categories.map((c) => c.id));
  const hiers = new Set(catalog.hierarchy.map((h) => h.id));
  for (const law of catalog.laws) {
    assert.ok(cats.has(law.category), `${law.id}: دستهٔ نامعتبر «${law.category}»`);
    assert.ok(hiers.has(law.hierarchy), `${law.id}: سلسله‌مراتب نامعتبر «${law.hierarchy}»`);
    assert.ok(law.title?.trim(), `${law.id}: عنوان خالی است`);
  }
});

test('قطعه‌های ماده‌ها با آمار و شناسه‌ها هم‌خوان است', () => {
  const byId = new Map(pointer.laws.map((l) => [l.id, l]));
  const seenArticleIds = new Set();
  let total = 0;
  for (const law of catalog.laws) {
    const meta = byId.get(law.id);
    assert.ok(meta, `${law.id}: قطعه‌ای در version.json ثبت نشده است`);
    let count = 0;
    for (const part of meta.parts) {
      const file = inPublic(part.path);
      assert.ok(fs.existsSync(file), `${law.id}: فایل قطعه یافت نشد (${part.path})`);
      const body = read(file);
      const articles = Array.isArray(body) ? body : body.articles ?? [];
      for (const a of articles) {
        assert.equal(a.lawId, law.id, `مادهٔ ${a.id} متعلق به ${a.lawId} است نه ${law.id}`);
        assert.ok(!seenArticleIds.has(a.id), `شناسهٔ مادهٔ تکراری: ${a.id}`);
        seenArticleIds.add(a.id);
        count++;
      }
    }
    assert.equal(count, meta.count, `${law.id}: شمار ماده‌های قطعه با برآورد هم‌خوان نیست`);
    assert.equal(count, law.articleCount, `${law.id}: شمار ماده‌های قطعه با فهرست هم‌خوان نیست`);
    total += count;
  }
  assert.equal(total, catalog.stats.articleCount, 'جمع ماده‌های قطعه‌ها با آمار هم‌خوان نیست');
});

test('همهٔ ماده‌ها متن دارند (بدون مادهٔ «فقط عنوان»)', () => {
  for (const law of catalog.laws) {
    const meta = pointer.laws.find((l) => l.id === law.id);
    assert.ok(meta, `${law.id}: در version.json ثبت نشده است`);
    for (const part of meta.parts) {
      const body = read(inPublic(part.path));
      const articles = Array.isArray(body) ? body : body.articles ?? [];
      for (const a of articles) {
        assert.ok(a.text?.trim(), `مادهٔ ${a.id} متن ندارد (فقط عنوان/شماره)`);
      }
    }
  }
});

test('هیچ ارجاعی به گیت‌هاب در داده‌های منتشرشده نیست', () => {
  const GITHUB_RE = /github\.(com|io)\//i;
  const catalogRaw = fs.readFileSync(path.join(versionDir, 'catalog.json'), 'utf8');
  assert.ok(!GITHUB_RE.test(catalogRaw), 'catalog.json حاوی ارجاع به گیت‌هاب است');
  const pointerRaw = fs.readFileSync(pointerPath, 'utf8');
  assert.ok(!GITHUB_RE.test(pointerRaw), 'version.json حاوی ارجاع به گیت‌هاب است');
  for (const law of pointer.laws) {
    for (const part of law.parts) {
      const raw = fs.readFileSync(inPublic(part.path), 'utf8');
      assert.ok(!GITHUB_RE.test(raw), `${part.path} حاوی ارجاع به گیت‌هاب است`);
    }
  }
  if (pointer.cases) {
    const casesFiles = [pointer.cases.indexPath, ...pointer.cases.parts.map((p) => p.path)];
    for (const p of casesFiles) {
      const raw = fs.readFileSync(inPublic(p), 'utf8');
      assert.ok(!GITHUB_RE.test(raw), `${p} حاوی ارجاع به گیت‌هاب است`);
    }
  }
});

test('مجموعهٔ آراء قضایی (در صورت وجود) با اشاره‌گر هم‌خوان است', () => {
  const cp = pointer.cases;
  if (!cp) {
    return; // نسخه شامل آراء نیست
  }
  assert.ok(cp.count > 0, 'شمار آراء ثبت نشده است');
  assert.ok(Array.isArray(cp.parts) && cp.parts.length, 'قطعه‌ای برای آراء ثبت نشده است');

  const indexPath = inPublic(cp.indexPath);
  assert.ok(fs.existsSync(indexPath), 'فایل فهرست آراء یافت نشد');
  const index = read(indexPath).index;
  assert.equal(index.length, cp.count, 'شمار مدخل‌های فهرست آراء با اشاره‌گر هم‌خوان نیست');

  const ids = new Set();
  for (const row of index) {
    assert.ok(!ids.has(row.id), `شناسهٔ رأی تکراری: ${row.id}`);
    ids.add(row.id);
    assert.ok(row.title?.trim(), `رأی ${row.id}: عنوان ندارد`);
    assert.ok(row.norm?.trim(), `رأی ${row.id}: متن جست‌وجو ندارد`);
    assert.ok(cp.types.includes(row.type), `رأی ${row.id}: نوع نامعتبر «${row.type}»`);
    assert.equal(typeof row.dateSort, 'number', `رأی ${row.id}: تاریخ مرتب‌سازی نامعتبر است`);
  }

  let count = 0;
  let bytes = cp.indexBytes;
  for (const part of cp.parts) {
    const file = inPublic(part.path);
    assert.ok(fs.existsSync(file), `قطعهٔ آراء یافت نشد: ${part.path}`);
    const body = read(file);
    assert.equal(body.items.length, part.count, `قطعهٔ ${part.path}: شمار رأی‌ها هم‌خوان نیست`);
    for (const item of body.items) {
      assert.ok(ids.has(item.id), `رأی ${item.id} در فهرست نیست`);
      assert.ok(item.text?.length >= 40, `رأی ${item.id}: متن بسیار کوتاه است`);
      assert.ok(item.norm?.trim(), `رأی ${item.id}: متن جست‌وجو ندارد`);
      assert.ok(['اداری', 'حقوقی', 'کیفری'].includes(item.type), `رأی ${item.id}: نوع نامعتبر`);
    }
    count += body.items.length;
    bytes += part.bytes;
  }
  assert.equal(count, cp.count, 'جمع رأی‌های قطعه‌ها با اشاره‌گر هم‌خوان نیست');
  assert.equal(bytes, cp.bytes, 'حجم اعلام‌شدهٔ مجموعه با قطعه‌ها هم‌خوان نیست');
});
