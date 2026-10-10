/**
 * ابزارهای متن فارسی (نسخه کلاینت) — هم‌رفتار با scripts/lib/fa.mjs
 * نرمال‌سازی، تبدیل ارقام، تحلیل عبارت جست‌وجو و استخراج کلیدواژه.
 */

export const ZWNJ = '\u200c';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const HARAKAT = /[\u064B-\u0652\u0670\u0640\u0654\u0655\u06D6-\u06ED]/g;

/** متن خام → متن نمایشی تمیز (نیم‌فاصله حفظ می‌شود) */
export function clean(raw: string | null | undefined): string {
  if (!raw) return '';
  let t = String(raw).normalize('NFC');
  t = t.replace(/\uFEFF/g, '');
  t = t.replace(HARAKAT, '');
  t = t.replace(/\u064A/g, '\u06CC');
  t = t.replace(/\u0643/g, '\u06A9');
  t = t.replace(/\u0629/g, '\u0647');
  t = t.replace(/[\u200b\u200e\u200f\u202a-\u202e]/g, '');
  t = t.replace(/\u00a0/g, ' ');
  t = t.replace(/ ?\u200c ?/g, ZWNJ);
  t = t.replace(/\u200c{2,}/g, ZWNJ);
  t = t.replace(/[ \t]{2,}/g, ' ');
  return t.trim();
}

export function toFaDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEnDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/** نرمال‌سازی برای جست‌وجو و ایندکس (نیم‌فاصله حذف می‌شود) */
export function normalizeForSearch(raw: string | null | undefined): string {
  if (!raw) return '';
  let t = toEnDigits(clean(raw));
  t = t.replace(/\u0649/g, '\u06CC');
  t = t.replace(/[أإآٱ]/g, 'ا');
  t = t.replace(/\u0624/g, 'و');
  t = t.replace(/\u0626/g, 'ی');
  t = t.replace(/\u0621/g, '');
  t = t.replace(/[\u200c]/g, '');
  t = t.replace(/می\s+/g, 'می');
  t = t.replace(/[«»"'`؛،:,\.\(\)\[\]\{\}\!\?\-\u00ab\u00bb\u201c\u201d\u2018\u2019]/g, ' ');
  // محدودهٔ کامل حروف فارسی/عربی (ی، ک، گ، چ، پ، ژ همگی بالاتر از U+064A هستند)
  t = t.replace(/[^\u0600-\u06FF0-9a-zA-Z ]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

export function tokenize(raw: string): string[] {
  return normalizeForSearch(raw).split(' ').filter(Boolean);
}

const STOPWORDS = new Set([
  'و', 'در', 'به', 'از', 'که', 'این', 'را', 'با', 'است', 'برای', 'آن', 'یک', 'خود', 'تا', 'بر',
  'هم', 'یا', 'شود', 'شده', 'می', 'نیز', 'های', 'ها', 'شد', 'بود', 'وی', 'او', 'هر', 'همه',
  'مورد', 'قانون', 'ماده', 'تبصره', 'بند', 'صورت', 'توسط', 'قرار', 'باشد', 'دارد', 'کرد',
]);

export function isStopword(w: string): boolean {
  return STOPWORDS.has(w);
}

const WORD_NUMBERS: Record<string, number> = {
  'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17,
  'هجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70,
  'هشتاد': 80, 'نود': 90, 'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400,
};

export function wordsToNumber(phrase: string): number | null {
  const parts = normalizeForSearch(phrase).split(' ').filter(Boolean);
  let total = 0;
  let found = false;
  for (const p of parts) {
    if (/^[0-9]+$/.test(p)) return Number(p);
    const v = WORD_NUMBERS[p];
    if (!v) return null;
    total += v;
    found = true;
  }
  return found ? total : null;
}

export interface ParsedQuery {
  raw: string;
  article: number | null;
  mokarrar: boolean;
  lawHint: string;
  terms: string[];
}

/** تحلیل عبارت جست‌وجو: «ماده ۱۰ قانون مدنی» → { article: 10, lawHint: 'مدنی' } */
export function parseQuery(raw: string): ParsedQuery {
  const q = clean(raw);
  const en = toEnDigits(q);
  const out: ParsedQuery = { raw: q, article: null, mokarrar: false, lawHint: '', terms: [] };

  const artMatch = en.match(/ماده\s*([0-9]+)\s*(مکرر)?/) || en.match(/^([0-9]+)\s*(مکرر)?$/);
  if (artMatch) {
    out.article = Number(artMatch[1]);
    out.mokarrar = Boolean(artMatch[2]);
  } else {
    const wordMatch = en.match(/ماده\s+([\u0600-\u06FF\s]{3,40})/);
    if (wordMatch) {
      const n = wordsToNumber(wordMatch[1].split('قانون')[0]);
      if (n) out.article = n;
    }
  }

  const lawMatch = q.match(/(?:قانون|آیین\s*نامه|لایحه)\s+([^\d]{2,40})/);
  if (lawMatch) out.lawHint = clean(lawMatch[1]).replace(/^های\s+/, '').trim();

  const stripped = normalizeForSearch(
    en
      .replace(/ماده\s*[0-9]+\s*(مکرر)?/g, ' ')
      .replace(/(?:قانون|آیین\s*نامه|لایحه)\s+/g, ' '),
  );
  out.terms = stripped.split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return out;
}

/** برجسته‌سازی عبارت جست‌وجو در متن (برای نتایج جست‌وجو) */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const terms = tokenize(query).filter((t) => t.length > 2);
  if (!terms.length) return [{ text, match: false }];
  const normalizedText = normalizeForSearch(text);
  const ranges: [number, number][] = [];
  // نگاشت ساده: به‌دلیل تفاوت طول متن نرمال‌شده، جست‌وجوی مستقیم حساس به نرمال‌سازی انجام می‌شود
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const idx = normalizedText.indexOf(term, from);
      if (idx === -1) break;
      ranges.push([idx, idx + term.length]);
      from = idx + term.length;
      if (ranges.length > 40) break;
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);

  const out: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    if (start > cursor) out.push({ text: normalizedText.slice(cursor, start), match: false });
    out.push({ text: normalizedText.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < normalizedText.length) out.push({ text: normalizedText.slice(cursor), match: false });
  return out;
}

/** بریدن متن پیرامون نخستین تطابق (برای پیش‌نمایش نتیجه) */
export function excerpt(text: string, query: string, radius = 90): string {
  const terms = tokenize(query).filter((t) => t.length > 2);
  const norm = normalizeForSearch(text);
  if (!terms.length) return norm.slice(0, radius * 2);
  let idx = -1;
  for (const t of terms) {
    const i = norm.indexOf(t);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return norm.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(norm.length, idx + radius);
  return `${start > 0 ? '…' : ''}${norm.slice(start, end)}${end < norm.length ? '…' : ''}`;
}
