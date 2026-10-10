import { Suspense } from 'react';
import Reader from './reader';

export const metadata = { title: 'مطالعه قانون | کتابچه قانون ایران' };

export default function Page() {
  return <Suspense fallback={<p className="app-container py-6">در حال آماده‌سازی متن…</p>}><Reader /></Suspense>;
}
