'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ArticlePage from '../article/[articleId]/article-page-client';
import LawDetailPage from '../laws/[lawId]/law-detail-client';

export default function Reader() {
  const params = useSearchParams();
  const article = params.get('article');
  const law = params.get('law');
  // Remount on ID change so state from a previous article is never displayed.
  if (article) return <ArticlePage key={`article:${article}`} id={article} />;
  if (law) return <LawDetailPage key={`law:${law}`} id={law} />;
  return <div className="app-container py-6"><p>ماده یا قانون مشخص نشده است.</p><Link href="/laws/">مرور قوانین</Link></div>;
}
