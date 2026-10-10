import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * تشخیص نسخهٔ جاری داده‌ها برای تولید صفحات ایستا.
 *
 * مرجع معتبر، اشاره‌گر `public/data/version.json` است (همان فایلی که برنامه در
 * مرورگر می‌خواند). انتخاب نسخه بر اساس مرتب‌سازی نام پوشه‌ها معتبر نیست،
 * زیرا نام نسخه شامل هش محتواست و ترتیب حروف‌الفبا با ترتیب ساخت یکی نیست.
 */
export async function currentDataVersion(): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'version.json'), 'utf8');
    const pointer = JSON.parse(raw) as { version?: string };
    if (pointer.version) return pointer.version;
  } catch {
    /* ادامه: مسیر پشتیبان */
  }
  try {
    const files = await fs.readdir(path.join(process.cwd(), 'public', 'data', 'v'));
    return files.sort().at(-1) ?? null;
  } catch {
    return null;
  }
}

export async function readVersionedJson<T>(relativePath: string): Promise<T | null> {
  const version = await currentDataVersion();
  if (!version) return null;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'public', 'data', 'v', version, relativePath),
      'utf8',
    );
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
