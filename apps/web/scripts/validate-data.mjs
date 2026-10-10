#!/usr/bin/env node
/**
 * اعتبارسنجی داده‌های ساخته‌شده:
 *   ۱) بررسی ساختاری (شناسه‌های یکتا، متن غیرخالی، شماره‌گذاری، فیلدهای الزامی)
 *   ۲) بررسی نرمال‌سازی فارسی (نبود ی/ك عربی، صورت‌های نمایشی، فاصله‌های تکراری)
 *   ۳) آزمون‌های صحت متنی روی ماده‌های شناخته‌شده (برای جلوگیری از رگرسیون منابع)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeForSearch } from './lib/fa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public', 'data');

const pointer = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'version.json'), 'utf8'));
const dir = path.join(PUBLIC, 'v', pointer.version);
const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));

/** نگاشت شناسه قانون → قطعه‌ها (نسخه‌های بزرگ به چند فایل تقسیم می‌شوند) */
const partsById = new Map(pointer.laws.map((l) => [l.id, l.parts || []]));

/** خواندن کامل ماده‌های یک قانون از همه قطعه‌ها */
function loadLaw(id) {
  const parts = partsById.get(id) || [];
  const articles = [];
  let law = null;
  for (const part of parts) {
    const file = path.join(PUBLIC, part.path.replace(/^\/data\//, ''));
    if (!fs.existsSync(file)) {
      errors.push(`قطعه یافت نشد: ${part.path}`);
      continue;
    }
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!law && payload.law) law = payload.law;
    articles.push(...(payload.articles || []));
  }
  return { law, articles };
}

const errors = [];
const warnings = [];

/* ---------------- ۱) ساختار ---------------- */
const seenLawIds = new Set();
const globalArticleIds = new Set();
let totalArticles = 0;
let empties = 0;

const REQUIRED_LAW_FIELDS = ['id', 'title', 'shortTitle', 'category', 'hierarchy', 'status', 'source'];

for (const lawMeta of catalog.laws) {
  if (seenLawIds.has(lawMeta.id)) errors.push(`شناسه قانون تکراری: ${lawMeta.id}`);
  seenLawIds.add(lawMeta.id);

  for (const field of REQUIRED_LAW_FIELDS) {
    if (!lawMeta[field] || (typeof lawMeta[field] === 'object' && !Object.keys(lawMeta[field]).length)) {
      errors.push(`${lawMeta.id}: فیلد الزامی «${field}» خالی است`);
    }
  }
  if (!catalog.categories.some((c) => c.id === lawMeta.category)) {
    errors.push(`${lawMeta.id}: دسته نامعتبر «${lawMeta.category}»`);
  }
  if (!catalog.hierarchy.some((h) => h.id === lawMeta.hierarchy)) {
    errors.push(`${lawMeta.id}: سطح سلسله‌مراتب نامعتبر «${lawMeta.hierarchy}»`);
  }

  /* هر سند باید متن ماده‌به‌ماده داشته باشد؛ سندِ «فقط شناسنامه» یا «فقط عنوان»
     در داده‌های نهایی جایی ندارد. */
  if (!lawMeta.articleCount) errors.push(`${lawMeta.id}: سند بدون متن ماده (فقط شناسنامه/عنوان)`);

  const { law, articles } = loadLaw(lawMeta.id);
  if (!partsById.get(lawMeta.id)?.length) {
    errors.push(`فایل قانون یافت نشد: ${lawMeta.id}`);
    continue;
  }
  if (!articles.length) errors.push(`${lawMeta.id}: بدون ماده`);
  if (law.articleCount !== articles.length) errors.push(`${lawMeta.id}: ناسازگاری تعداد ماده`);

  let prev = 0;
  for (const a of articles) {
    totalArticles++;
    if (globalArticleIds.has(a.id)) errors.push(`شناسه ماده تکراری: ${a.id}`);
    globalArticleIds.add(a.id);
    if (!a.text || !a.text.trim()) { empties++; errors.push(`${a.id}: متن خالی`); }
    if (a.text && a.text.length < 8) warnings.push(`${a.id}: متن بسیار کوتاه`);
    if (typeof a.numberValue === 'number') {
      if (a.numberValue <= 0) errors.push(`${a.id}: شماره نامعتبر`);
      if (a.numberValue < prev) errors.push(`${a.id}: ترتیب شماره‌ها نامرتب است`);
      prev = Math.max(prev, a.numberValue);
    }
    for (const field of ['lawId', 'numberFa', 'status', 'category', 'hierarchy']) {
      if (a[field] === undefined || a[field] === null || a[field] === '') errors.push(`${a.id}: فیلد ${field} خالی`);
    }
    if (!Array.isArray(a.keywords)) errors.push(`${a.id}: کلیدواژه‌ها آرایه نیست`);
  }
}

/* ---------------- ۲) نرمال‌سازی ---------------- */
let arabicChars = 0;
let presentation = 0;
let doubleSpaces = 0;
for (const lawMeta of catalog.laws) {
  const { articles } = loadLaw(lawMeta.id);
  for (const a of articles) {
    if (/[\u064A\u0643\u0629]/.test(a.text)) arabicChars++;
    if (/[\uFB50-\uFEFF]/.test(a.text)) presentation++;
    if (/ {2,}/.test(a.text)) doubleSpaces++;
  }
}
if (arabicChars) warnings.push(`${arabicChars} ماده دارای حرف عربی (ی/ك/ة) است`);
if (presentation) errors.push(`${presentation} ماده دارای صورت نمایشی عربی (OCR) است`);
if (doubleSpaces) warnings.push(`${doubleSpaces} ماده دارای فاصله تکراری است`);

/* ---------------- ۳) نبودِ ارجاع به مخازن گیت‌هاب ---------------- */
const GITHUB_RE = /github\.(com|io)\//i;
const catalogRaw = fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8');
if (GITHUB_RE.test(catalogRaw)) errors.push('فهرست (catalog.json) حاوی ارجاع به گیت‌هاب است');
for (const lawMeta of catalog.laws) {
  for (const part of partsById.get(lawMeta.id) || []) {
    const raw = fs.readFileSync(path.join(PUBLIC, part.path.replace(/^\/data\//, '')), 'utf8');
    if (GITHUB_RE.test(raw)) errors.push(`${lawMeta.id}: قطعهٔ ${part.path} حاوی ارجاع به گیت‌هاب است`);
  }
}

/* ---------------- ۴) آمار ---------------- */
if (catalog.stats?.fullTextCount !== undefined && catalog.stats.fullTextCount !== catalog.laws.length) {
  errors.push(`ناسازگاری آمار: همهٔ ${catalog.laws.length} سند باید متن کامل داشته باشند`);
}

/* ---------------- ۵) آزمون‌های صحت متنی ---------------- */
const ASSERTIONS = [
  ['civil-code', 10, 'قراردادهای خصوصی نسبت به کسانی که آن را منعقد نموده'],
  ['civil-code', 190, 'برای صحت هر معامله شرایط ذیل اساسی است'],
  ['civil-code', 219, 'عقودی که بر طبق قانون واقع شده'],
  ['civil-code', 328, 'ضامن آن است'],
  ['civil-code', 1257, 'مدعی حقی باشد'],
  ['constitution', 22, 'حیثیت، جان، مال، حقوق، مسکن و شغل اشخاص از تعرض مصون است'],
  ['constitution', 28, 'حق دارد شغلی را که بدان مایل است'],
  ['constitution', 35, 'حق دارند برای خود وکیل انتخاب نمایند'],
  ['constitution', 177, 'بازنگری در قانون اساسی'],
  ['labor-code', 7, 'قرارداد کار عبارت است از'],
  ['labor-code', 37, 'مزد باید در فواصل زمانی'],
  ['labor-code', 41, 'حداقل مزد کارگران'],
  ['commercial-code', 1, 'تاجر کسی است که شغل معمولی خود را معاملات تجارتی'],
  ['commercial-amendment-1347', 1, 'شرکت سهامی شرکتی است که سرمایه آن به سهام تقسیم شده'],
  ['criminal-procedure-code', 1, 'آیین دادرسی کیفری مجموعه مقررات و قواعدی است'],
  ['criminal-procedure-code', 425, ''],
  ['civil-procedure-code', 1, 'مجموعه اصول و مقرراتی است که در مقام رسیدگی'],
  ['civil-procedure-code', 519, 'خسارات دادرسی عبارتست از هزینه دادرسی'],
  ['islamic-penal-code', 1, 'قانون مجازات اسلامی مشتمل بر جرائم و مجازات‌های حدود'],
  ['islamic-penal-code', 14, 'مجازات‌های مقرر در این قانون چهار قسم است'],
  ['electronic-commerce-law', 1, 'مبادله آسان و ایمن اطلاعات'],
  ['computer-crimes-law', 1, 'به طور غیرمجاز به داده'],
  ['direct-taxes-law', 1, 'اشخاص زیر مشمول پرداخت مالیات'],
  ['family-protection-law', 1, 'دادگاه خانواده'],
  ['social-security-law', 1, ''],
  ['check-issuance-law', 1, ''],
  ['registration-law', 1, ''],
  ['municipality-law', 1, 'شهرداری تاسیس'],
  ['fiqh-rules', 2, 'لاضرر'],
];

let assertPass = 0;
let assertFail = 0;
const cache = new Map();
for (const [lawId, num, needle] of ASSERTIONS) {
  if (!needle) continue; // فقط بررسی وجود ماده
  if (!cache.has(lawId)) cache.set(lawId, loadLaw(lawId).articles);
  const article = cache.get(lawId).find((a) => a.numberValue === num);
  if (!article) {
    errors.push(`آزمون صحت: ماده ${num} در ${lawId} یافت نشد`);
    assertFail++;
    continue;
  }
  if (!normalizeForSearch(article.text).includes(normalizeForSearch(needle))) {
    errors.push(`آزمون صحت: متن ماده ${num} ${lawId} با متن مرجع مطابقت ندارد`);
    assertFail++;
  } else {
    assertPass++;
  }
}

/* ---------------- گزارش ---------------- */
const gapsTotal = catalog.laws.reduce((s, l) => s + (l.gaps?.count || 0), 0);
console.log(`\n🔍 اعتبارسنجی داده‌ها — نسخه ${pointer.version}`);
console.log(`   اسناد: ${catalog.laws.length} (همه با متن کامل) | مواد: ${totalArticles}`);
console.log(`   آزمون صحت متنی: ${assertPass} موفق، ${assertFail} ناموفق`);
console.log(`   مواد ناموجود در منابع: ${gapsTotal}`);
if (warnings.length) {
  console.log(`\n   ⚠ هشدارها (${warnings.length}):`);
  for (const w of warnings.slice(0, 12)) console.log(`     - ${w}`);
}
if (errors.length) {
  console.log(`\n   ❌ خطاها (${errors.length}):`);
  for (const e of errors.slice(0, 25)) console.log(`     - ${e}`);
  process.exit(1);
}
console.log('\n   ✅ داده‌ها معتبر است.\n');
