/**
 * بارکن سبک برای اجرای تست‌ها: آدرس‌های نسبیِ بدون پسوند را به فایل‌های
 * TypeScript در src/ می‌رساند و Node وظیفهٔ حذف نوع‌ها را انجام می‌دهد.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
      const candidate = path.join(base, `${specifier}${ext}`);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    const asIndex = path.join(base, specifier, 'index.ts');
    if (existsSync(asIndex)) return nextResolve(pathToFileURL(asIndex).href, context);
  }
  return nextResolve(specifier, context);
}
