/**
 * تست‌های واحدِ منطقِ خالص برنامه: ابزارهای متن فارسی، قالب‌بندی،
 * محاسبه‌گر ارث و محاسبه‌گر دیه.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clean,
  toFaDigits,
  toEnDigits,
  normalizeForSearch,
  tokenize,
  isStopword,
  wordsToNumber,
  parseQuery,
  highlightParts,
  excerpt,
} from '../src/lib/fa';
import { formatBytes, formatNumberFa, formatIsoToJalali, relativeTime, cleanExcerpt } from '../src/lib/format';
import { computeInheritance, EMPTY_INHERITANCE_INPUT } from '../src/lib/calc/inheritance';
import { computeDiyyah, formatToman, formatTomanUnit, DIYAH_PRESETS } from '../src/lib/calc/diyyeh';

/* ------------------------------- متن فارسی ------------------------------- */

test('تبدیل ارقام فارسی/انگلیسی', () => {
  assert.equal(toFaDigits(1403), '۱۴۰۳');
  assert.equal(toFaDigits('ماده 1234'), 'ماده ۱۲۳۴');
  assert.equal(toEnDigits('۱۴۰۳/۰۱/۰۲'), '1403/01/02');
  assert.equal(toFaDigits(null), '');
});

test('نرمال‌سازی متن: حذف حرکات، یکسان‌سازی ی/ک و فاصله‌ها', () => {
  assert.equal(clean('قانون   مدنی'), 'قانون مدنی');
  assert.equal(clean('مَجلس'), 'مجلس');
  assert.equal(clean('علیـه'), clean('علیه'));
  assert.equal(clean('ماده‌ی ۱'), 'ماده‌ی ۱');
  assert.equal(clean(null), '');
});

test('نرمال‌سازیِ جست‌وجو و توکن‌سازی', () => {
  assert.equal(normalizeForSearch('  قانون   مدنی  '), normalizeForSearch('قانون مدنی'));
  // حروف فارسیِ بالاتر از U+064A (ی، ک، گ، چ، پ، ژ) باید حفظ شوند
  for (const [input, expected] of [
    ['مدنی', 'مدنی'],
    ['دیه', 'دیه'],
    ['چک', 'چک'],
    ['گمرک', 'گمرک'],
    ['پول', 'پول'],
    ['ژلاتین', 'ژلاتین'],
  ]) {
    assert.equal(normalizeForSearch(input), expected, `نرمال‌سازی «${input}» نادرست است`);
  }
  // نیم‌فاصله حذف می‌شود تا «مجازات‌های» و «مجازاتهای» یکسان باشند
  assert.equal(normalizeForSearch('مجازات‌های'), normalizeForSearch('مجازاتهای'));
  const tokens = tokenize('ماده ۱۰ قانون مدنی');
  assert.ok(tokens.includes('قانون'));
  assert.ok(tokens.includes('مدنی'));
  assert.equal(isStopword('و'), true);
  assert.equal(isStopword('مدنی'), false);
  assert.equal(isStopword('ورشکستگی'), false);
  assert.deepEqual(tokenize(''), []);
});

test('تبدیل عدد حروفی به رقم', () => {
  assert.equal(wordsToNumber('ده'), 10);
  assert.equal(wordsToNumber('بیست'), 20);
  assert.equal(wordsToNumber('۱۲'), 12);
  assert.equal(wordsToNumber('نامعلوم'), null);
  assert.equal(wordsToNumber(''), null);
});

test('تحلیل عبارت جست‌وجو', () => {
  const withArticle = parseQuery('ماده ۱۰ قانون مدنی');
  assert.equal(withArticle.article, 10, 'شماره ماده استخراج نشد');
  assert.ok(withArticle.lawHint.includes('مدنی'), 'نام قانون استخراج نشد');
  assert.ok(withArticle.terms.length > 0);

  const mokarrar = parseQuery('ماده ۵ مکرر');
  assert.equal(mokarrar.article, 5);
  assert.equal(mokarrar.mokarrar, true);

  const plain = parseQuery('ارث');
  assert.equal(plain.article, null);
});

test('برجسته‌سازی و برش متن', () => {
  const parts = highlightParts('قانون مدنی ایران', 'مدنی');
  assert.ok(parts.some((p) => p.match), 'بخش منطبق یافت نشد');
  const ex = excerpt('الف '.repeat(200), 'الف', 40);
  assert.ok(ex.length > 0 && ex.length < 200);
});

/* ------------------------------- قالب‌بندی ------------------------------- */

test('قالب‌بندی اعداد و حجم', () => {
  assert.equal(formatNumberFa(0), '۰');
  assert.equal(formatNumberFa(6618).replace(/[^۰-۹]/g, ''), '۶۶۱۸');
  assert.match(formatBytes(2048), /کیلوبایت/);
  assert.match(formatBytes(5 * 1024 * 1024), /مگابایت/);
});

test('تاریخ شمسی و زمان نسبی', () => {
  assert.match(formatIsoToJalali('2024-03-20'), /۱۴[۰-۹]{2}/);
  assert.match(relativeTime(Date.now() - 60 * 1000), /دقیقه|لحظات|اکنون/);
  assert.match(relativeTime(0), /./);
});

test('تمیز کردن برش متن', () => {
  assert.equal(cleanExcerpt('  متن   آزمایشی  '), 'متن آزمایشی');
  const long = 'الف'.repeat(500);
  assert.ok(cleanExcerpt(long, 50).length <= 60);
});

/* ------------------------------ محاسبه‌گر ارث ------------------------------ */

const heir = (result, name) => result.shares.find((s) => s.heir.includes(name));

test('ارث: بدون وارث پیام می‌دهد و خروجی صفر است', () => {
  const r = computeInheritance({ ...EMPTY_INHERITANCE_INPUT, estate: 100 });
  assert.equal(r.total, 0);
  assert.ok(r.warnings.length, 'هشدار ثبت نشده است');
});

test('ارث: زوج با وجود فرزند یک‌چهارم می‌برد', () => {
  const r = computeInheritance({
    ...EMPTY_INHERITANCE_INPUT,
    deceasedSex: 'female',
    estate: 1200,
    spouse: true,
    children: { sons: 1, daughters: 0 },
  });
  assert.ok(r.supported);
  assert.equal(heir(r, 'زوج').amount, 300); // ۱/۴
  const son = r.shares.find((s) => s.heir.includes('پسر'));
  assert.equal(son.amount, 900); // باقی‌مانده
  assert.equal(r.total, 1200);
});

test('ارث: زوجه با وجود فرزند یک‌هشتم می‌برد', () => {
  const r = computeInheritance({
    ...EMPTY_INHERITANCE_INPUT,
    deceasedSex: 'male',
    estate: 800,
    spouse: true,
    children: { sons: 0, daughters: 1 },
  });
  assert.equal(heir(r, 'زوجه').amount, 100); // ۱/۸
  assert.equal(r.total, 800);
});

test('ارث: پسر دو برابر دختر', () => {
  const r = computeInheritance({
    ...EMPTY_INHERITANCE_INPUT,
    estate: 900,
    children: { sons: 1, daughters: 1 },
  });
  const son = r.shares.find((s) => s.heir.includes('پسر'));
  const daughter = r.shares.find((s) => s.heir.includes('دختر'));
  assert.equal(son.amount, 600);
  assert.equal(daughter.amount, 300);
  assert.equal(r.total, 900);
});

test('ارث: پدر و مادر با وجود فرزند هر کدام یک‌ششم', () => {
  const r = computeInheritance({
    ...EMPTY_INHERITANCE_INPUT,
    estate: 1200,
    father: true,
    mother: true,
    children: { sons: 1, daughters: 0 },
  });
  assert.equal(heir(r, 'پدر').amount, 200);
  assert.equal(heir(r, 'مادر').amount, 200);
  assert.equal(r.total, 1200);
});

test('ارث: چندهمسری سهم زوجه را تقسیم می‌کند', () => {
  const r = computeInheritance({
    ...EMPTY_INHERITANCE_INPUT,
    deceasedSex: 'male',
    estate: 800,
    spouse: true,
    wives: 2,
    children: { sons: 1, daughters: 0 },
  });
  assert.equal(heir(r, 'زوجه').amount, 50); // ۱/۱۶ برای هر همسر
});

test('ارث: ترکیبِ خارج از محدوده «نیازمند بررسی کارشناسی» است', () => {
  const r = computeInheritance({
    ...EMPTY_INHERITANCE_INPUT,
    estate: 1000,
    spouse: true,
  });
  // همسر به‌تنهایی: سهم فرضی دارد و باقی‌مانده‌ای نیست — نتیجه باید سازگار باشد
  assert.ok(Array.isArray(r.shares));
  assert.ok(r.total <= 1000);
});

/* ------------------------------ محاسبه‌گر دیه ------------------------------ */

test('دیه: کسرهای پیش‌فرض درست‌اند', () => {
  const full = 1_600_000_000;
  const fullResult = computeDiyyah({ fullDiyyah: full, num: 1, den: 1, victimSex: 'male', injuryBelowThird: false });
  assert.equal(fullResult.amount, full);

  const half = computeDiyyah({ fullDiyyah: full, num: 1, den: 2, victimSex: 'male', injuryBelowThird: false });
  assert.equal(half.amount, full / 2);
});

test('دیه: قاعدهٔ نصف در جنایتِ معادل یا بیش از ثلث برای زن', () => {
  const full = 1_200_000_000;
  const female = computeDiyyah({ fullDiyyah: full, num: 1, den: 1, victimSex: 'female', injuryBelowThird: false });
  assert.equal(female.amount, full / 2);
  assert.equal(female.appliedHalfRule, true);

  const belowThird = computeDiyyah({ fullDiyyah: full, num: 1, den: 10, victimSex: 'female', injuryBelowThird: true });
  assert.equal(belowThird.amount, full / 10);
  assert.equal(belowThird.appliedHalfRule, false);
});

test('دیه: پیش‌فرض‌ها یکتا و معتبرند', () => {
  const ids = DIYAH_PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of DIYAH_PRESETS) {
    assert.ok(p.den > 0 && p.num > 0);
    const r = computeDiyyah({ fullDiyyah: 1_000, num: p.num, den: p.den, victimSex: 'male', injuryBelowThird: false });
    assert.ok(r.amount > 0);
  }
});

test('دیه: قالب‌بندی مبلغ', () => {
  assert.match(formatToman(1000), /ریال/);
  assert.match(formatTomanUnit(1000, 'toman'), /تومان/);
  assert.equal(formatTomanUnit(1000, 'toman').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^0-9]/g, ''), '100');
});
