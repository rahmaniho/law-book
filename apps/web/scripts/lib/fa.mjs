/**
 * ابزارهای متن فارسی — نرمال‌سازی، تبدیل اعداد، استخراج کلیدواژه و تشخیص نسخ/اصلاح.
 * این ماژول در مرحله Build و همچنین (نسخه‌ی همسانِ کلاینت در src/lib/fa.ts) استفاده می‌شود.
 */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** اعراب و علائم ترکیبی عربی */
const HARAKAT = /[\u064B-\u0652\u0670\u0640\u0654\u0655\u06D6-\u06ED]/g;

/** صورت‌های نمایشی عربی (Arabic Presentation Forms) که در متن‌های OCR دیده می‌شود */
const PRESENTATION_MAP = new Map([
  ['\uFEF1', 'ی'], ['\uFEF2', 'ی'], ['\uFEF3', 'ی'], ['\uFEF4', 'ی'],
  ['\uFEDF', 'ل'], ['\uFEE0', 'ل'], ['\uFEE1', 'ل'], ['\uFEE2', 'ل'],
  ['\uFE8D', 'ا'], ['\uFE8E', 'ا'], ['\uFE8F', 'ب'], ['\uFE90', 'ب'],
  ['\uFE91', 'ب'], ['\uFE92', 'ب'], ['\uFE93', 'ة'], ['\uFE94', 'ة'],
  ['\uFE95', 'ت'], ['\uFE96', 'ت'], ['\uFE97', 'ت'], ['\uFE98', 'ت'],
  ['\uFE99', 'ث'], ['\uFE9A', 'ث'], ['\uFE9B', 'ث'], ['\uFE9C', 'ث'],
  ['\uFE9D', 'ج'], ['\uFE9E', 'ج'], ['\uFE9F', 'ج'], ['\uFEA0', 'ج'],
  ['\uFEA1', 'ح'], ['\uFEA2', 'ح'], ['\uFEA3', 'ح'], ['\uFEA4', 'ح'],
  ['\uFEA5', 'خ'], ['\uFEA6', 'خ'], ['\uFEA7', 'خ'], ['\uFEA8', 'خ'],
  ['\uFEA9', 'د'], ['\uFEAA', 'د'], ['\uFEAB', 'ذ'], ['\uFEAC', 'ذ'],
  ['\uFEAD', 'ر'], ['\uFEAE', 'ر'], ['\uFEAF', 'ز'], ['\uFEB0', 'ز'],
  ['\uFEB1', 'س'], ['\uFEB2', 'س'], ['\uFEB3', 'س'], ['\uFEB4', 'س'],
  ['\uFEB5', 'ش'], ['\uFEB6', 'ش'], ['\uFEB7', 'ش'], ['\uFEB8', 'ش'],
  ['\uFEB9', 'ص'], ['\uFEBA', 'ص'], ['\uFEBB', 'ص'], ['\uFEBC', 'ص'],
  ['\uFEBD', 'ض'], ['\uFEBE', 'ض'], ['\uFEBF', 'ض'], ['\uFEC0', 'ض'],
  ['\uFEC1', 'ط'], ['\uFEC2', 'ط'], ['\uFEC3', 'ط'], ['\uFEC4', 'ط'],
  ['\uFEC5', 'ظ'], ['\uFEC6', 'ظ'], ['\uFEC7', 'ظ'], ['\uFEC8', 'ظ'],
  ['\uFEC9', 'ع'], ['\uFECA', 'ع'], ['\uFECB', 'ع'], ['\uFECC', 'ع'],
  ['\uFECD', 'غ'], ['\uFECE', 'غ'], ['\uFECF', 'غ'], ['\uFED0', 'غ'],
  ['\uFED1', 'ف'], ['\uFED2', 'ف'], ['\uFED3', 'ف'], ['\uFED4', 'ف'],
  ['\uFED5', 'ق'], ['\uFED6', 'ق'], ['\uFED7', 'ق'], ['\uFED8', 'ق'],
  ['\uFED9', 'ک'], ['\uFEDA', 'ک'], ['\uFEDB', 'ک'], ['\uFEDC', 'ک'],
  ['\uFEDD', 'ل'], ['\uFEDE', 'ل'],
  ['\uFEE5', 'ن'], ['\uFEE6', 'ن'], ['\uFEE7', 'ن'], ['\uFEE8', 'ن'],
  ['\uFEE9', 'ه'], ['\uFEEA', 'ه'], ['\uFEEB', 'ه'], ['\uFEEC', 'ه'],
  ['\uFEED', 'و'], ['\uFEEE', 'و'],
]);

export const ZWNJ = '\u200c';

/** متن خام → متن نمایشی تمیز (بدون تغییر ارقام) */
export function clean(raw) {
  if (!raw) return '';
  let t = String(raw);
  for (const [from, to] of PRESENTATION_MAP) t = t.split(from).join(to);
  t = t.replace(/\uFEFF/g, '');
  t = t.normalize('NFC');
  t = t.replace(HARAKAT, '');
  t = t.replace(/\u064A/g, '\u06CC'); // ي عربی → ی فارسی
  t = t.replace(/\u0643/g, '\u06A9'); // ك عربی → ک فارسی
  t = t.replace(/\u0629/g, '\u0647'); // ة → ه
  t = t.replace(/[\u200b\u200e\u200f\u202a-\u202e]/g, '');
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\u00a0/g, ' ');
  t = t.replace(/ ?\u200c ?/g, ZWNJ);
  t = t.replace(/\u200c{2,}/g, ZWNJ);
  t = t.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  t = t.replace(/^\s+|\s+$/g, '');
  return t;
}

/** ارقام لاتین → فارسی */
export function toFaDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** ارقام فارسی/عربی → لاتین */
export function toEnDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/**
 * متن نرمال‌شده برای ایندکس و جست‌وجو.
 * ارقام به لاتین تبدیل و «ی/ک» یکسان‌سازی می‌شود تا جست‌وجوی «قانون مدنی» با «قانون مدنى» هم نتیجه بدهد.
 */
export function normalizeForSearch(raw) {
  let t = clean(raw);
  t = toEnDigits(t);
  t = t.replace(/\u0649/g, '\u06CC'); // ى → ی
  t = t.replace(/[أإآٱ]/g, 'ا');
  t = t.replace(/\u0624/g, 'و');
  t = t.replace(/\u0626/g, 'ی');
  t = t.replace(/\u0621/g, '');
  // نیم‌فاصله حذف می‌شود تا «مجازات‌های» و «مجازاتهای» یکسان جست‌وجو شوند
  t = t.replace(/[\u200c]/g, '');
  t = t.replace(/می\s+/g, 'می');
  t = t.replace(/[«»"'`؛،:,\.\(\)\[\]\{\}\!\?\-\u00ab\u00bb\u201c\u201d\u2018\u2019]/g, ' ');
  // محدودهٔ کامل حروف فارسی/عربی (ی، ک، گ، چ، پ، ژ همگی بالاتر از U+064A هستند)
  t = t.replace(/[^\u0600-\u06FF0-9a-zA-Z ]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/** چندکلمه‌ای‌های پرکاربرد که نباید به‌عنوان کلیدواژه ذخیره شوند */
const STOPWORDS = new Set([
  'و', 'در', 'به', 'از', 'که', 'این', 'را', 'با', 'است', 'برای', 'آن', 'یک', 'خود', 'تا', 'بر',
  'هم', 'یا', 'شود', 'شده', 'می', 'نیز', 'های', 'ها', 'شد', 'بود', 'وی', 'او', 'هر', 'همه',
  'مورد', 'قانون', 'ماده', 'تبصره', 'بند', 'صورت', 'توسط', 'قرار', 'باشد', 'دارد', 'کرد',
  'می‌شود', 'می‌باشد', 'اعم', 'حال', 'نسبت', 'دیگر', 'دیگری', 'چند', 'بین', 'بدون', 'مانند',
]);

/** استخراج کلیدواژه‌های معنادار از متن ماده (بدون تکرار، حداکثر ۱۰ مورد) */
export function extractKeywords(raw, limit = 10) {
  const norm = normalizeForSearch(raw);
  const words = norm.split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^[0-9]+$/.test(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([w]) => w);
}

const NOW_LABEL = 'لازم‌الاجرا';

/**
 * تشخیص وضعیت اعتبار ماده از متن و یادداشت‌های آن.
 * @returns {{status: string, notes: string[]}}
 */
export function detectStatus(text, notes = []) {
  const joined = [text, ...notes].join(' \n ');
  const out = [...notes];
  let status = NOW_LABEL;

  const removed = /(حذف شده است|حذف گردیده|ملغی شده است|منسوخ(?:ه)? (?:است|شده)|نسخ شده است|به موجب.*?نسخ)/;
  const amendment = /(اصلاحی|اصلاح شده|الحاقی|اصلاحیه)/;

  if (removed.test(joined)) {
    status = 'منسوخ';
  } else if (amendment.test(joined)) {
    status = 'اصلاحی';
  }
  return { status, notes: out };
}

/** استخراج تاریخ‌های اصلاح/الحاق از متن، مثل «(اصلاحی ۱۳۷۰/۸/۱۴)» */
export function extractAmendments(text) {
  if (!text) return [];
  const out = [];
  const t = toEnDigits(text);
  const re = /\((?:اصلاحی|الحاقی|اصلاح)\s*([0-9]{2,4}(?:[\/.\-][0-9]{1,2}){0,2})\)/g;
  let m;
  while ((m = re.exec(t))) out.push({ kind: 'اصلاحی', date: toFaDigits(m[1]) });
  const re2 = /(?:اصلاحی|الحاقی)\s*(?:مصوب\s*)?([0-9]{4}[\/.\-][0-9]{1,2}[\/.\-][0-9]{1,2})/g;
  while ((m = re2.exec(t))) out.push({ kind: 'اصلاحی', date: toFaDigits(m[1]) });
  const seen = new Set();
  return out.filter((a) => {
    const k = a.date + a.kind;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** تبدیل تاریخ شمسی متنی «۱۳۹۲/۱۲/۰۴» به عدد مرتب‌سازی ۱۳۹۲۱٢۰۴ */
export function dateToSort(dateFa) {
  if (!dateFa) return 0;
  const nums = toEnDigits(dateFa).match(/\d{2,4}/g);
  if (!nums || !nums.length) return 0;
  const [y, m = '1', d = '1'] = nums;
  return Number(`${y.padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`);
}

/** استخراج عنوان و تاریخ تصویب از سرآمد فایل‌های متنی قوانین */
export function parseDocHeader(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = clean(lines[0] || '').replace(/^﻿/, '');
  let approval = '';
  for (const line of lines.slice(1, 5)) {
    const m = line.match(/مصوب\s+([0-9۰-۹]{2,4}(?:[\/.\-][0-9۰-۹]{1,2}){0,2})/);
    if (m) {
      approval = toFaDigits(m[1]);
      break;
    }
    if (/^مصوب/.test(line)) {
      approval = clean(line.replace(/^مصوب\s*/, '').slice(0, 80));
      break;
    }
  }
  const subtitle = clean(lines.find((l) => /^مصوب/.test(l)) || '');
  return { title, approval, subtitle };
}

/** شکستن متن به توکن‌های جست‌وجو */
export function tokenize(raw) {
  return normalizeForSearch(raw).split(' ').filter(Boolean);
}

/**
 * تبدیل عبارت‌های عددی فارسی به رقم: «ماده دهم» → 10
 * فقط برای اعداد پرکاربرد ۱ تا ۱۰۰ استفاده می‌شود.
 */
const WORD_NUMBERS = new Map(Object.entries({
  'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17,
  'هجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
  'هشتاد': 80, 'نود': 90, 'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400,
}));

export function wordsToNumber(phrase) {
  const parts = normalizeForSearch(phrase).split(' ').filter(Boolean);
  let total = 0;
  let found = false;
  for (const p of parts) {
    if (/^[0-9]+$/.test(p)) return Number(p);
    const v = WORD_NUMBERS.get(p);
    if (!v) return null;
    total += v;
    found = true;
  }
  return found ? total : null;
}

/**
 * تحلیل عبارت جست‌وجو برای تشخیص «شماره ماده» و «نام قانون».
 * نمونه: «ماده ۱۰ قانون مدنی» → {article: 10, lawHint: 'مدنی'}
 */
export function parseQuery(raw) {
  const q = clean(raw);
  const en = toEnDigits(q);
  const out = { raw: q, article: null, articleMokarrar: false, lawHint: '', terms: [] };

  const artMatch = en.match(/ماده\s*[‌]?\s*([0-9]+)\s*(مکرر)?/) || en.match(/^([0-9]+)\s*(مکرر)?$/);
  if (artMatch) {
    out.article = Number(artMatch[1]);
    out.articleMokarrar = Boolean(artMatch[2]);
  }
  const wordMatch = en.match(/ماده\s+([\u0600-\u06FF\s]{3,40})/);
  if (!out.article && wordMatch) {
    const n = wordsToNumber(wordMatch[1].split('قانون')[0]);
    if (n) out.article = n;
  }
  const lawMatch = q.match(/(?:قانون|آیین\s*نامه|لایحه)\s+([^\d]{2,40})/);
  if (lawMatch) out.lawHint = clean(lawMatch[1]).trim();

  const stripped = normalizeForSearch(
    en.replace(/ماده\s*[‌]?\s*[0-9]+\s*(مکرر)?/g, ' ')
      .replace(/(?:قانون|آیین\s*نامه|لایحه)\s+/g, ' ')
  );
  out.terms = stripped.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return out;
}
