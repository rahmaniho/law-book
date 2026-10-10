#!/usr/bin/env node
/**
 * تطبیق «فهرست» با داده‌های ساخته‌شده.
 *
 *   node scripts/verify-registry.mjs
 *
 * خروجی:
 *   ✅ موجود    — سند در نسخهٔ ساخته‌شدهٔ برنامه هست (متن کامل دارد)
 *   ❌ ناموجود  — عنوان در فهرست هست ولی در برنامه نیست
 *
 * فقط اسنادی که متن ماده‌به‌ماده دارند در برنامه می‌آیند؛
 * هیچ چیزی را تغییر نمی‌دهد؛ فقط گزارش می‌دهد.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ *
 * فهرست ورودی (عناوین اسنادی که باید با متن کامل در برنامه باشند)
 * ------------------------------------------------------------------ */

const EXPECTED_LAWS = [
  // موازین شرع و قواعد فقهی
  'موازین شرع (قواعد فقهی بنیادین)',
  // قانون اساسی
  'قانون اساسی جمهوری اسلامی ایران',
  // حقوق مدنی
  'قانون مدنی',
  'قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی',
  'قانون اجرای احکام مدنی',
  'قانون نحوه اجرای محکومیت‌های مالی',
  'قانون ثبت اسناد و املاک',
  'قانون روابط موجر و مستأجر',
  'قانون تملک آپارتمان‌ها',
  'قانون مسئولیت مدنی',
  // حقوق کیفری
  'قانون مجازات اسلامی',
  'قانون آیین دادرسی کیفری',
  'قانون جرایم رایانه‌ای',
  'قانون اصلاح قانون مبارزه با مواد مخدر و الحاق موادی به آن',
  'قانون مبارزه با پول‌شویی',
  'قانون رسیدگی به تخلفات رانندگی',
  'قانون کاهش مجازات حبس تعزیری',
  'قانون تشدید مجازات مرتکبین ارتشاء، اختلاس و کلاهبرداری',
  // حقوق تجارت
  'قانون تجارت',
  'لایحه اصلاحی قانون تجارت (شرکت‌های تجارتی)',
  'قانون تجارت الکترونیکی',
  'قانون صدور چک',
  'قانون حمایت از حقوق مصرف‌کنندگان',
  'قانون امور گمرکی',
  // حقوق کار و تأمین اجتماعی
  'قانون کار جمهوری اسلامی ایران',
  'قانون تأمین اجتماعی',
  'قانون نظام صنفی کشور',
  // حقوق مالی و مالیاتی
  'قانون مالیات‌های مستقیم',
  'قانون مالیات بر ارزش افزوده',
  'قانون وصول برخی از درآمدهای دولت و مصرف آن در موارد معین',
  // حقوق اداری
  'قانون تشکیلات و آیین دادرسی دیوان عدالت اداری',
  'قانون رسیدگی به تخلفات اداری',
  'قانون نظارت بر رفتار قضات',
  'لایحه قانونی استقلال کانون وکلای دادگستری',
  'قانون شهرداری',
  // آیین دادرسی و محاکم
  'قانون شوراهای حل اختلاف',
  'قانون تشکیل دادگاه‌های عمومی و انقلاب',
  // بیمه
  'قانون بیمه',
  'قانون بیمه اجباری خسارات واردشده به شخص ثالث در اثر حوادث ناشی از وسایل نقلیه',
  // حقوق خانواده
  'قانون حمایت خانواده',
  'قانون حمایت از خانواده و جوانی جمعیت',
  // مالکیت فکری
  'قانون حمایت از حقوق مؤلفان، مصنفان و هنرمندان',
  'قانون حمایت از حقوق پدیدآورندگان نرم‌افزارهای رایانه‌ای',
  // خدمت وظیفه عمومی و امور حسبی
  'قانون خدمت وظیفه عمومی',
  'قانون الحاق موادی به قانون خدمت وظیفه عمومی',
  'قانون امور حسبی',
];

/* ------------------------------------------------------------------ *
 * نرمال‌سازی و تطبیق
 * ------------------------------------------------------------------ */
const STOPWORDS = new Set(['از', 'و', 'در', 'به', 'با', 'بر', 'برای', 'ال', 'الی', 'تا']);

function normalize(text) {
  return String(text)
    .replace(/[\u064B-\u0652\u0670\u0640\u0654\u0655\u06D6-\u06ED]/g, '')
    .replace(/\u064A/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u200b-\u200f\u202a-\u202e\uFEFF]/g, '')
    .replace(/[()（）\[\]\/\\.,،؛;:؟?!«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function words(text) {
  return new Set(normalize(text).split(' ').filter((w) => w && !STOPWORDS.has(w)));
}

function subsetOf(a, b) {
  for (const w of a) if (!b.has(w)) return false;
  return true;
}

/** تطبیق یک عنوان با فهرست اشیاء موجود */
function findMatch(title, records, getTitle) {
  const n = normalize(title);
  const w = words(title);

  for (const rec of records) {
    if (normalize(getTitle(rec)) === n) return { rec, rule: 'عنوان دقیق' };
  }
  for (const rec of records) {
    const rn = normalize(getTitle(rec));
    if (rn.includes(n) || n.includes(rn)) return { rec, rule: 'تطبیق زیررشته‌ای' };
  }
  for (const rec of records) {
    const rw = words(getTitle(rec));
    if (subsetOf(w, rw) || subsetOf(rw, w)) return { rec, rule: 'تطبیق واژگانی' };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * اجرا
 * ------------------------------------------------------------------ */
const pointer = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/version.json'), 'utf8'));
const catalog = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/data/v', pointer.version, 'catalog.json'), 'utf8'),
);

const laws = catalog.laws;

let okLaws = 0;
const missingLaws = [];
const lawRows = [];

for (const title of EXPECTED_LAWS) {
  const hit = findMatch(title, laws, (l) => l.title);
  if (!hit) {
    missingLaws.push(title);
    continue;
  }
  okLaws++;
  lawRows.push({ title, id: hit.rec.id, rule: hit.rule });
}

/* گزارش */
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n🧾 تطبیق فهرست با داده‌های ساخته‌شده (نسخه ${pointer.version})\n`);
console.log(`   ${EXPECTED_LAWS.length} عنوان در فهرست / ${laws.length} سند با متن کامل در برنامه`);
console.log(`   ✅ موجود: ${okLaws} | ❌ ناموجود: ${missingLaws.length}\n`);
const rowsToPrint = process.env.ALL === '1' ? lawRows : lawRows.filter((r) => r.rule !== 'عنوان دقیق');
for (const r of rowsToPrint) {
  console.log(`   ${pad(r.rule, 18)} ${pad(r.id, 46)} ${r.title}`);
}
console.log('');
if (missingLaws.length) {
  console.log('   ❌ موارد ناموجود در برنامه:');
  for (const m of missingLaws) console.log(`     - ${m}`);
  console.log('');
}

console.log(missingLaws.length ? `   ❌ ${missingLaws.length} مورد تطبیق نیافت.\n` : '   ✅ همه موارد فهرست در برنامه یافت شد.\n');
process.exit(missingLaws.length ? 1 : 0);
