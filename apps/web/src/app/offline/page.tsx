import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'حالت آفلاین',
};

/** صفحه پشتیبان آفلاین — توسط Service Worker برای ناوبری‌های بدون اتصال کش می‌شود */
export default function OfflinePage() {
  return (
    <main className="app-container flex min-h-[70vh] flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="text-4xl">📚</span>
      <h1 className="text-lg font-bold">اتصال اینترنت برقرار نیست</h1>
      <p className="max-w-sm text-[12.5px] leading-6 text-muted-foreground">
        نگران نباشید؛ قوانینی که پیش‌تر روی دستگاه ذخیره شده‌اند، همچنان قابل مطالعه و جست‌وجو هستند. پس از وصل‌شدن
        اینترنت، به‌روزرسانی‌ها به‌صورت خودکار دریافت می‌شود.
      </p>
      <div className="mt-2 flex gap-2">
        <Link href="/" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          خانه
        </Link>
        <Link href="/laws" className="rounded-xl border px-4 py-2 text-sm font-medium">
          فهرست قوانین
        </Link>
        <Link href="/bookmarks" className="rounded-xl border px-4 py-2 text-sm font-medium">
          نشان‌شده‌ها
        </Link>
      </div>
    </main>
  );
}
