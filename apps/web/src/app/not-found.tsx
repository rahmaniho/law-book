import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="app-container flex min-h-[60vh] flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="text-4xl">⚖️</span>
      <h1 className="text-lg font-bold">صفحه یافت نشد</h1>
      <p className="max-w-xs text-[12.5px] leading-6 text-muted-foreground">
        ممکن است نشانی تغییر کرده باشد یا این بخش در نسخه فعلی وجود نداشته باشد.
      </p>
      <Link href="/" className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        بازگشت به خانه
      </Link>
    </main>
  );
}
