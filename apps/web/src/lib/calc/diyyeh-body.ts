/**
 * جدول دیه اعضای بدن و محاسبهٔ تفصیلی دیه — بر پایهٔ «کتاب چهارم: دیات»
 * قانون مجازات اسلامی (مواد ۵۳۸ تا ۵۴۲ و ۵۵۲ تا ۶۶۰ مطابق متن مخزن در
 * data/sources/structured-laws/laws_islamic_penal_code_islamic_penal_code_book_4.json).
 *
 * نکته‌ها:
 *  - نسبت هر عضو به «دیه کامل» به‌صورت کسر [صورت، مخرج] نگه داشته شده تا خطای اعشاری نداشته باشد.
 *  - اعضای زوج (pair): اگر هر دو از بین بروند، طبق ماده ۵۴۲ «دیه کامل» ثابت است، نه دو برابر نصف.
 *  - قاعدهٔ زن (مواد ۵۵۲ و ۵۴۵ به بعد): دیه زن نصف دیه مرد است، مگر جنایت کمتر از ثلث دیه کامل باشد.
 *    این قاعده برای هر واحد آسیب جداگانه سنجیده می‌شود.
 *  - تعدد جنایت: آسیب‌های متوالی هرکدام دیهٔ جدا دارند (ماده ۵۳۸)؛ آسیب‌های همزمان فقط دیهٔ اشد (ماده ۵۳۹).
 *  - اعضایی که دیهٔ مقدر ندارند (ارش) در جمع محاسبه نمی‌شوند و در یادداشت‌ها اعلام می‌شوند.
 */

export type Fraction = readonly [num: number, den: number];

export type BodyGroupId = 'nafs' | 'head' | 'neck' | 'upper' | 'lower' | 'internal' | 'senses';

export interface BodyGroup {
  id: BodyGroupId;
  title: string;
  description: string;
}

export interface BodyItem {
  id: string;
  group: BodyGroupId;
  label: string;
  fraction: Fraction;
  /** اعضای زوج؛ اگر هر دو از بین بروند دیهٔ کامل ثابت است (ماده ۵۴۲) */
  pair?: boolean;
  /** حداکثر تعداد قابل‌انتخاب (مثلاً ده انگشت دست) */
  max: number;
  /** جنسیتی که این مورد فقط برای آن معنا دارد */
  onlyFor?: 'male' | 'female';
  article: string;
}

export const BODY_GROUPS: BodyGroup[] = [
  { id: 'nafs', title: 'دیه نفس', description: 'قتل انسان (دیه کامل)' },
  { id: 'head', title: 'سر و صورت', description: 'پلک، ابرو، چشم، گوش، بینی، لب، فک و دندان' },
  { id: 'neck', title: 'گردن و ستون فقرات', description: 'گردن، ستون فقرات، مهره‌های کمر و دنباله' },
  { id: 'upper', title: 'اندام فوقانی', description: 'بازو، آرنج، ساعد، دست و انگشتان دست' },
  { id: 'lower', title: 'اندام تحتانی', description: 'ران، زانو، ساق، پا و انگشتان پا' },
  { id: 'internal', title: 'اعضای داخلی و استخوان‌های قفسه و لگن', description: 'قلب، ریه، کلیه، کبد، دنده‌ها، لگن' },
  { id: 'senses', title: 'حواس و منافع', description: 'بینایی، شنوایی، بویایی، چشایی، صوت، عقل' },
];

export const BODY_ITEMS: BodyItem[] = [
  // ── دیه نفس ──
  { id: 'killing', group: 'nafs', label: 'قتل (دیهٔ نفس)', fraction: [1, 1], max: 1, article: 'ماده ۵۵۸ و مواد ۵۴۹ تا ۵۵۱' },

  // ── سر و صورت ──
  { id: 'eyelid', group: 'head', label: 'پلک (هر یک)', fraction: [1, 6], max: 4, article: 'ماده ۵۶۳' },
  { id: 'eyelashes', group: 'head', label: 'تمام مژه‌ها', fraction: [1, 10], max: 1, article: 'ماده ۵۶۴' },
  { id: 'eyebrow', group: 'head', label: 'ابرو (هر یک)', fraction: [1, 4], max: 2, article: 'ماده ۵۶۵' },
  { id: 'beard', group: 'head', label: 'تمام ریش', fraction: [1, 3], max: 1, article: 'ماده ۵۶۶' },
  { id: 'eye', group: 'head', label: 'چشم (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۶۷ و ماده ۵۴۲' },
  { id: 'nose', group: 'head', label: 'تمام بینی', fraction: [1, 1], max: 1, article: 'ماده ۵۶۹' },
  { id: 'nostril', group: 'head', label: 'سوراخ بینی (هر یک)', fraction: [1, 3], max: 2, article: 'ماده ۵۷۰' },
  { id: 'ear', group: 'head', label: 'گوش (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۷۲ و ماده ۵۴۲' },
  { id: 'lip', group: 'head', label: 'لب (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۷۴ و ماده ۵۴۲' },
  { id: 'jaw', group: 'head', label: 'فک (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۸۴ و ماده ۵۴۲' },
  { id: 'teeth-all', group: 'head', label: 'تمام دندان‌ها', fraction: [1, 1], max: 1, article: 'ماده ۵۷۵' },
  { id: 'tooth-front', group: 'head', label: 'دندان پیشین (هر یک)', fraction: [1, 20], max: 8, article: 'ماده ۵۷۶' },
  { id: 'tooth-canine', group: 'head', label: 'دندان نیش (هر یک)', fraction: [1, 40], max: 4, article: 'ماده ۵۷۷' },
  { id: 'tooth-molar', group: 'head', label: 'دندان آسیا (هر یک)', fraction: [1, 100], max: 20, article: 'ماده ۵۷۸' },
  { id: 'tongue', group: 'head', label: 'تمام زبان (قطع کامل)', fraction: [1, 1], max: 1, article: 'ماده ۵۷۹' },

  // ── گردن و ستون فقرات ──
  { id: 'neck', group: 'neck', label: 'گردن (شکستن و کج شدن)', fraction: [1, 1], max: 1, article: 'ماده ۵۸۲' },
  { id: 'spine', group: 'neck', label: 'ستون فقرات (شکستن و عدم بهبودی)', fraction: [1, 1], max: 1, article: 'ماده ۶۱۶' },
  { id: 'lumbar', group: 'neck', label: 'مهرهٔ کمر (هر یک)', fraction: [1, 50], max: 5, article: 'ماده ۶۱۷' },
  { id: 'coccyx', group: 'neck', label: 'استخوان دنبالچه', fraction: [1, 100], max: 1, article: 'ماده ۶۱۸' },

  // ── اندام فوقانی ──
  { id: 'arm', group: 'upper', label: 'بازو (هر یک)', fraction: [1, 4], pair: true, max: 2, article: 'ماده ۶۰۶ و ماده ۵۴۲' },
  { id: 'elbow', group: 'upper', label: 'آرنج (هر یک)', fraction: [1, 10], pair: true, max: 2, article: 'ماده ۶۰۷ و ماده ۵۴۲' },
  { id: 'forearm', group: 'upper', label: 'ساعد (هر یک)', fraction: [1, 6], pair: true, max: 2, article: 'ماده ۶۰۸ و ماده ۵۴۲' },
  { id: 'hand', group: 'upper', label: 'دست (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۸۷ و ماده ۵۴۲' },
  { id: 'wrist', group: 'upper', label: 'مچ دست (هر یک)', fraction: [1, 10], pair: true, max: 2, article: 'ماده ۶۰۹ و ماده ۵۴۲' },
  { id: 'palm', group: 'upper', label: 'کف دست (هر یک)', fraction: [1, 10], pair: true, max: 2, article: 'ماده ۶۱۰ و ماده ۵۴۲' },
  { id: 'finger', group: 'upper', label: 'انگشت اصلی دست (هر یک)', fraction: [1, 10], max: 10, article: 'ماده ۵۸۸ و ماده ۶۵۴' },
  { id: 'finger-phalanx', group: 'upper', label: 'بند انگشت دست (هر یک)', fraction: [1, 30], max: 20, article: 'ماده ۵۸۹' },
  { id: 'nail', group: 'upper', label: 'ناخن (هر یک، بدون رویش مجدد)', fraction: [1, 100], max: 10, article: 'ماده ۵۹۰ و ماده ۶۵۸' },

  // ── اندام تحتانی ──
  { id: 'thigh', group: 'lower', label: 'ران (هر یک)', fraction: [1, 4], pair: true, max: 2, article: 'ماده ۶۱۱ و ماده ۵۴۲' },
  { id: 'knee', group: 'lower', label: 'زانو (هر یک)', fraction: [1, 10], pair: true, max: 2, article: 'ماده ۶۱۲ و ماده ۵۴۲' },
  { id: 'shank', group: 'lower', label: 'ساق (هر یک)', fraction: [1, 6], pair: true, max: 2, article: 'ماده ۶۱۳ و ماده ۵۴۲' },
  { id: 'leg', group: 'lower', label: 'پا (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۹۱ و ماده ۵۴۲' },
  { id: 'ankle', group: 'lower', label: 'مچ پا (هر یک)', fraction: [1, 10], pair: true, max: 2, article: 'ماده ۶۱۴ و ماده ۵۴۲' },
  { id: 'heel', group: 'lower', label: 'پاشنه (هر یک)', fraction: [1, 10], pair: true, max: 2, article: 'ماده ۶۱۵ و ماده ۵۴۲' },
  { id: 'toe', group: 'lower', label: 'انگشت پا (هر یک)', fraction: [1, 10], max: 10, article: 'ماده ۵۹۲' },
  { id: 'toe-phalanx', group: 'lower', label: 'بند انگشت پا (هر یک)', fraction: [1, 30], max: 20, article: 'ماده ۵۹۳' },

  // ── اعضای داخلی و استخوان‌ها ──
  { id: 'heart', group: 'internal', label: 'قلب', fraction: [1, 1], max: 1, article: 'ماده ۶۰۲' },
  { id: 'lung', group: 'internal', label: 'شش (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۶۰۳ و ماده ۵۴۲' },
  { id: 'liver', group: 'internal', label: 'کبد', fraction: [1, 3], max: 1, article: 'ماده ۶۰۰' },
  { id: 'spleen', group: 'internal', label: 'طحال', fraction: [1, 3], max: 1, article: 'ماده ۵۹۹' },
  { id: 'kidney', group: 'internal', label: 'کلیه (هر یک)', fraction: [1, 2], pair: true, max: 2, article: 'ماده ۵۹۸ و ماده ۵۴۲' },
  { id: 'bladder', group: 'internal', label: 'مثانه', fraction: [1, 3], max: 1, article: 'ماده ۶۰۱' },
  { id: 'rib', group: 'internal', label: 'دنده (هر یک)', fraction: [1, 40], max: 24, article: 'ماده ۶۰۴' },
  { id: 'clavicle', group: 'internal', label: 'استخوان ترقوه (هر یک)', fraction: [1, 40], max: 2, article: 'ماده ۶۰۵' },
  { id: 'pelvis', group: 'internal', label: 'استخوان لگن (هر یک)', fraction: [1, 10], max: 2, article: 'ماده ۶۱۹' },
  { id: 'pubic', group: 'internal', label: 'استخوان شرمگاه (هر یک)', fraction: [1, 10], max: 2, article: 'ماده ۶۲۰' },
  { id: 'spinal-cord', group: 'internal', label: 'نخاع (قطع تمام آن)', fraction: [1, 1], max: 1, article: 'ماده ۵۹۴' },
  { id: 'testis', group: 'internal', label: 'بیضه (هر یک)', fraction: [1, 2], pair: true, max: 2, onlyFor: 'male', article: 'ماده ۵۹۵ و ماده ۵۴۲' },
  { id: 'penis', group: 'internal', label: 'آلت تناسلی مرد (قطع تمام آن)', fraction: [1, 1], max: 1, onlyFor: 'male', article: 'ماده ۵۹۶' },
  { id: 'breast', group: 'internal', label: 'پستان زن (هر یک)', fraction: [1, 2], pair: true, max: 2, onlyFor: 'female', article: 'ماده ۵۹۷ و ماده ۶۵۹' },

  // ── حواس و منافع ──
  { id: 'vision', group: 'senses', label: 'تمام بینایی (از بین رفتن کامل)', fraction: [1, 1], max: 1, article: 'ماده ۵۶۸' },
  { id: 'smell', group: 'senses', label: 'تمام حس بویایی', fraction: [1, 1], max: 1, article: 'ماده ۵۷۱' },
  { id: 'hearing', group: 'senses', label: 'تمام حس شنوایی', fraction: [1, 1], max: 1, article: 'ماده ۵۷۳' },
  { id: 'taste', group: 'senses', label: 'تمام حس چشایی', fraction: [1, 1], max: 1, article: 'ماده ۵۸۰' },
  { id: 'voice', group: 'senses', label: 'تمام صوت', fraction: [1, 1], max: 1, article: 'ماده ۵۸۱' },
  { id: 'intellect', group: 'senses', label: 'تمام عقل', fraction: [1, 1], max: 1, article: 'ماده ۶۲۱' },
];

export interface BodySelection {
  id: string;
  qty: number;
}

export interface DiyyahLineResult {
  item: BodyItem;
  qty: number;
  /** دیهٔ یک واحد قبل از اعمال قاعدهٔ زن (ریال) */
  unitBase: number;
  /** دیهٔ یک واحد پس از قاعدهٔ زن (ریال) */
  unitFinal: number;
  /** جمع این ردیف (ریال) */
  lineTotal: number;
  /** قاعدهٔ نصف برای زن روی این ردیف اعمال شد */
  halved: boolean;
  /** زوج هر دو عضو از بین رفته‌اند و دیهٔ کامل ثابت است */
  pairFull: boolean;
}

export interface DiyyahDetailedInput {
  /** دیهٔ کامل بر حسب ریال */
  fullRial: number;
  victimSex: 'male' | 'female';
  selections: BodySelection[];
  /** آسیب‌ها در یک واقعه و همزمان (ماده ۵۳۹): فقط دیهٔ اشد */
  simultaneous: boolean;
  /** قتل در ماه‌های حرام یا حرم (مواد ۵۵۵ و ۵۵۶): یک‌سوم افزوده */
  sacredPlaceOrMonth: boolean;
}

export interface DiyyahDetailedResult {
  lines: DiyyahLineResult[];
  /** جمع نهایی بر حسب ریال */
  total: number;
  notes: string[];
  errors: string[];
}

export const ITEM_BY_ID = new Map(BODY_ITEMS.map((i) => [i.id, i]));

/** دیهٔ یک واحد بدون قاعدهٔ جنسیت؛ برای زوج با هر دو عضو، دیهٔ کامل. */
function unitBaseFor(item: BodyItem, qty: number, full: number): { amount: number; pairFull: boolean } {
  const [n, d] = item.fraction;
  if (item.pair && qty >= 2) return { amount: full, pairFull: true };
  return { amount: (full * n) / d, pairFull: false };
}

export function computeDiyyahDetailed(input: DiyyahDetailedInput): DiyyahDetailedResult {
  const notes: string[] = [];
  const errors: string[] = [];
  const full = Math.max(0, Number(input.fullRial) || 0);
  const lines: DiyyahLineResult[] = [];

  if (full <= 0) errors.push('مبلغ دیه کامل سال جاری را وارد کنید.');

  for (const sel of input.selections) {
    const item = ITEM_BY_ID.get(sel.id);
    if (!item) continue;
    const qty = Math.floor(Number(sel.qty) || 0);
    if (qty <= 0) continue;
    if (item.onlyFor && item.onlyFor !== input.victimSex) continue;

    if (qty > item.max) {
      errors.push(`حداکثر تعداد «${item.label}» ${item.max} مورد است.`);
    }
    const count = Math.min(qty, item.max);

    const { amount: unitBase, pairFull } = unitBaseFor(item, count, full);
    // قاعدهٔ زن: برای هر واحد آسیب، اگر دیه‌اش کمتر از ثلث دیهٔ کامل باشد دیه زن و مرد برابر است.
    const halfApplies = input.victimSex === 'female' && unitBase >= full / 3;
    const unitFinal = halfApplies ? unitBase / 2 : unitBase;

    // برای زوج با یک عضو، واحد جداگانه است؛ برای قتل تعداد یک است.
    const lineUnits = pairFull ? 1 : count;
    const lineTotal = pairFull ? unitFinal : unitFinal * lineUnits;

    lines.push({ item, qty: count, unitBase, unitFinal, lineTotal, halved: halfApplies, pairFull });
  }

  let baseTotal: number;
  if (input.simultaneous && lines.length > 1) {
    baseTotal = Math.max(...lines.map((l) => l.lineTotal));
    notes.push('آسیب‌های همزمان در یک واقعه: طبق ماده ۵۳۹ فقط دیهٔ اشد پرداخت می‌شود.');
  } else {
    baseTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    if (lines.length > 1) notes.push('آسیب‌های متوالی یا جداگانه: طبق ماده ۵۳۸ دیهٔ هر آسیب جداگانه محاسبه و جمع شده است.');
  }

  let total = baseTotal;
  if (input.sacredPlaceOrMonth && lines.some((l) => l.item.id === 'killing')) {
    total += baseTotal / 3;
    notes.push('قتل در ماه‌های حرام یا حرم: یک‌سوم به دیه افزوده شده است (مواد ۵۵۵ و ۵۵۶).');
  }

  if (input.victimSex === 'female') {
    notes.push('دیه زن: در هر آسیب که دیه‌اش کمتر از ثلث دیهٔ کامل باشد، دیه زن و مرد برابر است؛ در غیر این صورت نصف (ماده ۵۵۲ و مواد ۵۴۴ تا ۵۴۵).');
  }
  notes.push('ماده ۵۵۹: با تراضی طرفین می‌توان به‌جای دیه نقدی، قیمت روز اجناس مقرر را پرداخت کرد.');
  notes.push('مبلغ محاسبه‌شده فقط دیه است؛ ارش، هزینه درمان و سایر خسارات در آن لحاظ نشده‌اند.');

  return { lines, total, notes, errors };
}
