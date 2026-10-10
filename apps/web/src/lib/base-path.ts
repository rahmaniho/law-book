/**
 * مسیر basePath در سمت کلاینت.
 *
 * مقدار `NEXT_PUBLIC_BASE_PATH` در `next.config.mjs` از `config/base-path.mjs`
 * محاسبه و درون باندل inlining می‌شود؛ بنابراین اینجا همیشه همان زیرمسیری را
 * داریم که خودِ Next.js برای assetها استفاده کرده است.
 */

function normalize(value: string | undefined | null): string {
  if (!value || value === '/') return '';
  let v = String(value).trim();
  if (!v.startsWith('/')) v = `/${v}`;
  v = v.replace(/\/+$/, '');
  return v === '/' ? '' : v;
}

/** basePath مؤثر این بیلد؛ برای استقرار در ریشهٔ دامنه رشتهٔ خالی است. */
export const BASE_PATH: string = normalize(process.env.NEXT_PUBLIC_BASE_PATH);

/** چسباندن basePath به ابتدای یک مسیر مطلق (idempotent). */
export function withBase(urlPath: string): string {
  if (!BASE_PATH) return urlPath;
  if (urlPath === BASE_PATH || urlPath.startsWith(`${BASE_PATH}/`)) return urlPath;
  return `${BASE_PATH}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
}

/** آدرس سرویس‌ورکر — scope آن به‌طور خودکار همان پوشهٔ basePath می‌شود. */
export function swUrl(): string {
  return withBase('/sw.js');
}
