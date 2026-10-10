/**
 * محاسبه‌گر ارث بر پایه مقررات قانون مدنی (مواد ۸۶۲ تا ۹۴۹).
 *
 * ⚠️ محدوده پشتیبانی: طبقه اول (اولاد و والدین) و همسر، و حالت‌های ساده طبقه دوم
 * (اجداد و اخوه و اخوات). موارد پیچیده (تزاحم طبقات، کلاله، حجب پیچیده، وصیت و دین)
 * به‌صورت صریح «نیازمند بررسی کارشناسی» علامت‌گذاری می‌شوند و نتیجه‌ای برای آن‌ها ساخته نمی‌شود.
 */
import { toFaDigits } from '../fa';

export interface InheritanceInput {
  deceasedSex: 'male' | 'female';
  estate: number;
  spouse: boolean;
  wives?: number;
  children: { sons: number; daughters: number };
  grandchildren: { sons: number; daughters: number };
  father: boolean;
  mother: boolean;
  siblings: { fullBrothers: number; fullSisters: number; maternalBrothers: number; maternalSisters: number };
  paternalGrandparents: { grandfather: boolean; grandmother: boolean };
}

export interface ShareLine {
  heir: string;
  fraction: string;
  amount: number;
  basis: string;
}

export interface InheritanceResult {
  supported: boolean;
  notes: string[];
  shares: ShareLine[];
  total: number;
  remainder: number;
  warnings: string[];
}

const fa = (n: number) => toFaDigits(new Intl.NumberFormat('en-US').format(Math.round(n)));
const frac = (num: number, den: number) => `${toFaDigits(num)}/${toFaDigits(den)}`;

export const EMPTY_INHERITANCE_INPUT: InheritanceInput = {
  deceasedSex: 'male',
  estate: 0,
  spouse: false,
  wives: 1,
  children: { sons: 0, daughters: 0 },
  grandchildren: { sons: 0, daughters: 0 },
  father: false,
  mother: false,
  siblings: { fullBrothers: 0, fullSisters: 0, maternalBrothers: 0, maternalSisters: 0 },
  paternalGrandparents: { grandfather: false, grandmother: false },
};

export function computeInheritance(input: InheritanceInput): InheritanceResult {
  const notes: string[] = [];
  const warnings: string[] = [];
  const shares: ShareLine[] = [];
  const estate = Math.max(0, Number(input.estate) || 0);

  const hasChildren = input.children.sons + input.children.daughters > 0;
  const hasGrandchildren =
    !hasChildren && input.grandchildren.sons + input.grandchildren.daughters > 0;
  const hasDescendants = hasChildren || hasGrandchildren;

  if (estate <= 0) warnings.push('مبلغ ترکه را وارد کنید.');
  if (!input.spouse && !hasDescendants && !input.father && !input.mother &&
      input.siblings.fullBrothers + input.siblings.fullSisters + input.siblings.maternalBrothers + input.siblings.maternalSisters === 0 &&
      !input.paternalGrandparents.grandfather && !input.paternalGrandparents.grandmother) {
    warnings.push('حداقل یک وارث را انتخاب کنید.');
    return { supported: true, notes, shares, total: 0, remainder: 0, warnings };
  }

  let remaining = estate;
  const take = (heir: string, numerator: number, denominator: number, basis: string) => {
    const amount = (estate * numerator) / denominator;
    shares.push({ heir, fraction: frac(numerator, denominator), amount, basis });
    remaining -= amount;
    return amount;
  };

  /* ---------- ۱) سهم‌الارث همسر (ماده ۹۲۷ قانون مدنی) ---------- */
  if (input.spouse) {
    if (input.deceasedSex === 'male') {
      // زوجه: با اولاد یک‌هشتم، بدون اولاد یک‌چهارم (بین همسران به‌طور مساوی)
      const wives = Math.max(1, Math.min(4, input.wives || 1));
      if (hasDescendants) take('زوجه (همسر)', 1, 8 * wives, 'ماده ۹۲۷ قانون مدنی — زوجه با وجود اولاد یک‌هشتم');
      else take('زوجه (همسر)', 1, 4 * wives, 'ماده ۹۲۷ قانون مدنی — زوجه بدون اولاد یک‌چهارم');
    } else {
      // زوج: با اولاد یک‌چهارم، بدون اولاد یک‌دوم
      if (hasDescendants) take('زوج (همسر)', 1, 4, 'ماده ۹۲۷ قانون مدنی — زوج با وجود اولاد یک‌چهارم');
      else take('زوج (همسر)', 1, 2, 'ماده ۹۲۷ قانون مدنی — زوج بدون اولاد یک‌دوم');
    }
  }

  /* ---------- ۲) اولاد یا اولادِ اولاد (ماده ۹۰۷ و ۹۲۶ قانون مدنی) ---------- */
  if (hasDescendants) {
    // والدین: هر یک یک‌ششم (ماده ۹۰۸ قانون مدنی)
    if (input.father) take('پدر', 1, 6, 'ماده ۹۰۸ قانون مدنی — والدین با وجود اولاد یک‌ششم');
    if (input.mother) take('مادر', 1, 6, 'ماده ۹۰۸ قانون مدنی — والدین با وجود اولاد یک‌ششم');

    const boys = hasChildren ? input.children.sons : input.grandchildren.sons;
    const girls = hasChildren ? input.children.daughters : input.grandchildren.daughters;
    const label = hasChildren ? 'فرزند' : 'نوه (اولادِ اولاد)';
    const gap = remaining;
    if (boys + girls > 0 && gap > 0) {
      const units = boys * 2 + girls; // پسر دو برابر دختر (ماده ۹۰۷ قانون مدنی)
      if (boys > 0) {
        shares.push({
          heir: `${label} پسر (${fa(boys)} نفر)`,
          fraction: `${fa((boys * 2) / units)} سهم از باقی‌مانده`,
          amount: (gap * (boys * 2)) / units,
          basis: 'ماده ۹۰۷ قانون مدنی — پسر دو برابر دختر',
        });
      }
      if (girls > 0) {
        shares.push({
          heir: `${label} دختر (${fa(girls)} نفر)`,
          fraction: `${fa(girls / units)} سهم از باقی‌مانده`,
          amount: (gap * girls) / units,
          basis: 'ماده ۹۰۷ قانون مدنی — دختر نصف سهم پسر',
        });
      }
      remaining = 0;
    }
    notes.push('در فرض وجود اولاد، باقی‌مانده ترکه بین اولاد به نسبت پسر دو برابر دختر تقسیم می‌شود.');
  } else if (input.father || input.mother) {
    /* ---------- ۳) والدین بدون اولاد (مواد ۹۰۶ و ۹۰۹ قانون مدنی) ---------- */
    const hasSiblings =
      input.siblings.fullBrothers + input.siblings.fullSisters + input.siblings.maternalBrothers + input.siblings.maternalSisters > 0;

    if (input.father && input.mother) {
      if (hasSiblings) {
        take('مادر', 1, 6, 'ماده ۹۰۶ قانون مدنی — حجب نقصانی مادر با وجود اخوه');
        shares.push({
          heir: 'پدر',
          fraction: 'باقی‌مانده',
          amount: remaining,
          basis: 'ماده ۹۰۶ قانون مدنی — پدر، باقی ترکه را می‌برد',
        });
      } else {
        take('مادر', 1, 3, 'ماده ۹۰۶ قانون مدنی — مادر یک‌سوم');
        shares.push({
          heir: 'پدر',
          fraction: 'باقی‌مانده',
          amount: remaining,
          basis: 'ماده ۹۰۶ قانون مدنی — پدر دو سوم (باقی ترکه)',
        });
      }
      remaining = 0;
    } else if (input.mother) {
      const denom = hasSiblings ? 6 : 3;
      take('مادر', 1, denom, hasSiblings ? 'ماده ۹۰۶ قانون مدنی — مادر با حجب نقصانی یک‌ششم' : 'ماده ۹۰۶ قانون مدنی — مادر یک‌سوم');
      if (hasSiblings) distributeSiblings(input, shares, remaining, estate, notes);
      else notes.push('در نبود پدر و اولاد، باقی‌مانده ترکه به مادر ردّ می‌شود (قاعده ردّ).');
      remaining = 0;
    } else {
      shares.push({
        heir: 'پدر',
        fraction: 'باقی‌مانده',
        amount: remaining,
        basis: 'ماده ۹۰۶ قانون مدنی',
      });
      remaining = 0;
    }
  } else if (
    input.siblings.fullBrothers + input.siblings.fullSisters + input.siblings.maternalBrothers + input.siblings.maternalSisters > 0
  ) {
    /* ---------- ۴) اخوه و اخوات (مواد ۹۲۰ تا ۹۲۵ قانون مدنی) ---------- */
    distributeSiblings(input, shares, remaining, estate, notes);
    remaining = 0;
  } else if (input.paternalGrandparents.grandfather || input.paternalGrandparents.grandmother) {
    /* ---------- ۵) اجداد (طبقه دوم) ---------- */
    if (input.paternalGrandparents.grandfather && input.paternalGrandparents.grandmother) {
      shares.push({ heir: 'جدّ (پدری)', fraction: 'دو سوم', amount: (remaining * 2) / 3, basis: 'مواد ۹۲۲ تا ۹۲۶ قانون مدنی' });
      shares.push({ heir: 'جدّه (پدری)', fraction: 'یک سوم', amount: remaining / 3, basis: 'مواد ۹۲۲ تا ۹۲۶ قانون مدنی' });
    } else if (input.paternalGrandparents.grandfather) {
      shares.push({ heir: 'جدّ (پدری)', fraction: 'تمام باقی‌مانده', amount: remaining, basis: 'مواد ۹۲۲ تا ۹۲۶ قانون مدنی' });
    } else {
      shares.push({ heir: 'جدّه (پدری)', fraction: 'تمام باقی‌مانده', amount: remaining, basis: 'مواد ۹۲۲ تا ۹۲۶ قانون مدنی' });
    }
    remaining = 0;
  } else {
    return {
      supported: false,
      notes,
      shares,
      total: 0,
      remainder: estate,
      warnings: ['این ترکیب وارثان در محدوده پشتیبانی محاسبه‌گر نیست؛ محاسبه دقیق نیازمند بررسی کارشناسی است.'],
    };
  }

  const total = shares.reduce((s, x) => s + x.amount, 0);

  notes.push('سهم‌الارث همسر در همه طبقات ثابت است و با وجود وارث دیگر کاهش می‌یابد (ماده ۹۲۷ قانون مدنی).');
  notes.push('این محاسبه بر پایه فرض نبود وصیت و دین است؛ ابتدا دیون و وصیت (تا ثلث) از ترکه کسر می‌شود.');

  return { supported: true, notes, shares, total, remainder: Math.max(0, estate - total), warnings };
}

function distributeSiblings(
  input: InheritanceInput,
  shares: ShareLine[],
  remaining: number,
  estate: number,
  notes: string[],
) {
  const { fullBrothers, fullSisters, maternalBrothers, maternalSisters } = input.siblings;
  const maternal = maternalBrothers + maternalSisters;
  const totalSiblings = fullBrothers + fullSisters + maternal;

  if (maternal > 0) {
    // اخوه اُمّی: یک‌ششم در فرض یکی و یک‌سوم در فرض متعدد (ماده ۹۲۱ قانون مدنی) — به‌طور مساوی
    const denom = maternal === 1 ? 6 : 3;
    shares.push({
      heir: `برادر/خواهر مادری (${toFaDigits(maternal)} نفر)`,
      fraction: maternal === 1 ? 'یک‌ششم' : 'یک‌سوم',
      amount: (estate * 1) / denom,
      basis: 'ماده ۹۲۱ قانون مدنی — کلاله اُمّی',
    });
  }

  if (fullBrothers + fullSisters > 0) {
    // برادر و خواهر ابوینی/اَبَوی: برادر دو برابر خواهر (ماده ۹۲۰ قانون مدنی)
    const units = fullBrothers * 2 + fullSisters;
    const pool = Math.max(0, remaining - (maternal > 0 ? (estate * (maternal === 1 ? 1 / 6 : 1 / 3)) : 0));
    if (fullBrothers > 0) {
      shares.push({
        heir: `برادر ابوینی (${toFaDigits(fullBrothers)} نفر)`,
        fraction: `${toFaDigits((fullBrothers * 2) / units)} سهم`,
        amount: (pool * (fullBrothers * 2)) / units,
        basis: 'ماده ۹۲۰ قانون مدنی — برادر دو برابر خواهر',
      });
    }
    if (fullSisters > 0) {
      shares.push({
        heir: `خواهر ابوینی (${toFaDigits(fullSisters)} نفر)`,
        fraction: `${toFaDigits(fullSisters / units)} سهم`,
        amount: (pool * fullSisters) / units,
        basis: 'ماده ۹۲۰ قانون مدنی — خواهر نصف سهم برادر',
      });
    }
  }

  if (totalSiblings === 0) notes.push('وارثی از طبقه دوم یافت نشد.');
  else notes.push('اخوه اُمّی پیش از اخوه ابوینی سهم خود را می‌برند؛ اعمال حجب دقیق نیازمند بررسی پرونده است.');
}
