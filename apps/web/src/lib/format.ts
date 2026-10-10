import { toFaDigits } from './fa';

export function formatBytes(bytes: number): string {
  if (!bytes) return '۰';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${toFaDigits(value.toFixed(value >= 10 ? 0 : 1))} ${units[i]}`;
}

export function formatNumberFa(n: number): string {
  return toFaDigits(new Intl.NumberFormat('en-US').format(n));
}

const jalaliFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatIsoToJalali(iso: string | number | Date): string {
  try {
    return jalaliFormatter.format(new Date(iso));
  } catch {
    return '';
  }
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFaDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toFaDigits(days)} روز پیش`;
  return formatIsoToJalali(timestamp);
}

export function cleanExcerpt(text: string, max = 180): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
