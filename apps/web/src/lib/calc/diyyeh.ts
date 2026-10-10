/**
 * محاسبه‌گر دیه — بر پایه «دیه کامل» سال جاری که مرجع قضایی اعلام می‌کند.
 * ⚠️ نرخ دیه هر سال توسط قوه قضائیه اعلام می‌شود؛ کاربر باید مبلغ سال موردنظر را وارد کند.
 */
import { toFaDigits } from '../fa';

export interface DiyyahPreset {
  id: string;
  label: string;
  num: number;
  den: number;
  basis: string;
}

/** کسری‌های پرکاربرد دیه */
export const DIYAH_PRESETS: DiyyahPreset[] = [
  { id: 'full', label: 'دیه کامل', num: 1, den: 1, basis: 'ماده ۵۴۶ قانون مجازات اسلامی' },
  { id: 'half', label: 'نصف دیه', num: 1, den: 2, basis: 'مواد ۵۶۳ به بعد قانون مجازات اسلامی' },
  { id: 'third', label: 'یک‌سوم دیه', num: 1, den: 3, basis: 'مواد ۵۶۳ به بعد قانون مجازات اسلامی' },
  { id: 'quarter', label: 'یک‌چهارم دیه', num: 1, den: 4, basis: 'مواد ۵۶۳ به بعد قانون مجازات اسلامی' },
  { id: 'tenth', label: 'یک‌دهم دیه', num: 1, den: 10, basis: 'هر انگشت دست یا پا یک‌دهم دیه کامل' },
  { id: 'twentieth', label: 'یک‌بیستم دیه', num: 1, den: 20, basis: 'هر بند انگشت (ماده ۶۴۴ قانون مجازات اسلامی)' },
  { id: 'fifth', label: 'یک‌پنجم دیه', num: 1, den: 5, basis: 'نمونه: شکستن برخی استخوان‌ها' },
];

export interface DiyyahInput {
  fullDiyyah: number;
  num: number;
  den: number;
  victimSex: 'male' | 'female';
  /** جنایت کمتر از ثلث دیه کامل باشد */
  injuryBelowThird: boolean;
}

export interface DiyyahResult {
  amount: number;
  baseAmount: number;
  appliedHalfRule: boolean;
  notes: string[];
}

export function computeDiyyah(input: DiyyahInput): DiyyahResult {
  const notes: string[] = [];
  const full = Math.max(0, Number(input.fullDiyyah) || 0);
  const baseAmount = (full * input.num) / input.den;
  let amount = baseAmount;
  let appliedHalfRule = false;

  const isFullHomicide = input.num === 1 && input.den === 1;

  if (input.victimSex === 'female') {
    if (isFullHomicide || !input.injuryBelowThird) {
      amount = baseAmount / 2;
      appliedHalfRule = true;
      notes.push('دیه زن در جنایات معادل یا بیشتر از ثلث دیه کامل، نصف دیه مرد است (مواد ۵۴۴ و ۵۴۵ قانون مجازات اسلامی).');
    } else {
      notes.push('در جنایات کمتر از ثلث دیه کامل، دیه زن و مرد یکسان است (ماده ۵۴۵ قانون مجازات اسلامی).');
    }
  }

  if (baseAmount >= full && input.den !== 1) {
    notes.push('توجه: کسر انتخاب‌شده از دیه کامل بیشتر نمی‌تواند باشد.');
  }

  notes.push('مبلغ محاسبه‌شده «دیه» است و شامل ارش، هزینه درمان و خسارات دیگر نمی‌شود.');

  return { amount, baseAmount, appliedHalfRule, notes };
}

export function formatToman(value: number): string {
  return `${toFaDigits(new Intl.NumberFormat('en-US').format(Math.round(value)))} ریال`;
}

export function formatTomanUnit(value: number, unit: 'rial' | 'toman' = 'toman'): string {
  const v = unit === 'toman' ? value / 10 : value;
  return `${toFaDigits(new Intl.NumberFormat('en-US').format(Math.round(v)))} ${unit === 'toman' ? 'تومان' : 'ریال'}`;
}
