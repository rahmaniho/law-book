/**
 * تنها مرجعِ «basePath» برنامه.
 *
 * استقرار برنامه زیر یک زیرمسیر است و از همان مسیر سرو می‌شود
 * (مثلاً https://example.com/Lawbook/). هر چیزی که مسیرِ مطلقِ URL
 * می‌سازد — `manifest.webmanifest`، ثبت Service Worker، لینک آیکون‌ها و کشِ SW —
 * باید از همین تابع استفاده کند؛ وگرنه در استقرار زیرمسیر به ریشهٔ دامنه اشاره
 * می‌کند و ۴۰۴ می‌گیرد (دلیل اصلیِ نصب‌نشدن PWA).
 */

export const DEFAULT_BASE_PATH = '/law-book';

/** یکسان‌سازی شکل basePath: بدون اسلش انتهایی، یا رشتهٔ خالی برای ریشهٔ دامنه. */
export function normalizeBasePath(value) {
  if (value === undefined || value === null) return '';
  let v = String(value).trim();
  if (!v || v === '/') return '';
  if (!v.startsWith('/')) v = `/${v}`;
  v = v.replace(/\/+$/, '');
  return v === '/' ? '' : v;
}

/**
 * basePath مؤثر برای این بیلد.
 *  - `NEXT_PUBLIC_BASE_PATH=` (خالی)  → ریشهٔ دامنه
 *  - `NEXT_PUBLIC_BASE_PATH=/foo`     → همان مقدار
 *  - تنظیم‌نشده + `VERCEL=1`          → ریشهٔ دامنه (Vercel)
 *  - تنظیم‌نشده                       → پیش‌فرض استقرار زیرمسیر
 */
export function resolveBasePath(env = process.env) {
  const explicit = env.NEXT_PUBLIC_BASE_PATH;
  if (explicit !== undefined) return normalizeBasePath(explicit);
  if (env.VERCEL === '1') return '';
  return normalizeBasePath(DEFAULT_BASE_PATH);
}

/** چسباندن basePath به ابتدای یک مسیرِ مطلق (idempotent). */
export function withBase(basePath, urlPath) {
  const base = normalizeBasePath(basePath);
  if (!base) return urlPath;
  if (urlPath === base || urlPath.startsWith(`${base}/`)) return urlPath;
  return `${base}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
}
