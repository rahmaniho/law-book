'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowRight, BookText, Download, ExternalLink, Search, Settings2 } from 'lucide-react';
import { db } from '@/lib/db';
import { loadLawArticles } from '@/lib/sync';
import { useApp } from '@/lib/store';
import type { ArticleRow } from '@/lib/db';
import { Badge, Button, Card, Input, Skeleton } from '@/components/ui/primitives';
import { ArticleList, ReaderSettingsSheet } from '@/components/bits';
import { formatNumberFa } from '@/lib/format';
import { normalizeForSearch, toFaDigits } from '@/lib/fa';
import { cn } from '@/lib/utils';

export default function LawDetailPage({ id }: { id?: string } = {}) {
  const params = useParams<{ lawId: string }>();
  const lawId = id ?? params?.lawId ?? '';
  const catalog = useApp((s) => s.catalog);
  const law = catalog?.laws.find((l) => l.id === lawId);

  const [articles, setArticles] = useState<ArticleRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [downloaded, setDownloaded] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rows = await loadLawArticles(lawId);
      if (!mounted) return;
      setArticles(rows);
      const meta = await db.laws.get(lawId);
      setDownloaded(Boolean(meta));
    })();
    return () => {
      mounted = false;
    };
  }, [lawId]);

  const filtered = useMemo(() => {
    if (!articles) return [];
    const q = normalizeForSearch(query);
    return articles.filter((a) => {
      if (chapter && a.chapter !== chapter) return false;
      if (!q) return true;
      return (
        normalizeForSearch(a.text).includes(q) ||
        normalizeForSearch(a.numberFa).includes(q) ||
        String(a.numberValue ?? '') === q ||
        a.keywords.some((k) => k.includes(q))
      );
    });
  }, [articles, query, chapter]);

  if (!law) {
    return (
      <div className="app-container py-6">
        <Skeleton className="h-24 w-full" />
        <p className="mt-4 text-center text-sm text-muted-foreground">این قانون در فهرست یافت نشد.</p>
        <Link href="/laws" className="mt-4 block text-center text-sm text-primary">
          بازگشت به فهرست قوانین
        </Link>
      </div>
    );
  }

  return (
    <div className="app-container pb-8">
      <header className="pt-3">
        <Link href="/laws" className="mb-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <ArrowRight size={13} /> همه قوانین
        </Link>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold leading-6">{law.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge tone="muted">{law.documentType}</Badge>
                {law.approvalDate ? <span>مصوب {law.approvalDate}</span> : null}
                <span>• {formatNumberFa(law.articleCount)} ماده</span>
              </div>
            </div>
            <Button variant="outline" size="icon-sm" aria-label="تنظیمات خواندن" onClick={() => setReaderOpen(true)}>
              <Settings2 size={16} />
            </Button>
          </div>

          {law.summary ? (
            <p className="mt-3 text-[12.5px] leading-6 text-muted-foreground">{law.summary}</p>
          ) : null}

          {law.note ? (
            <p className="mt-2 rounded-xl bg-muted/60 p-2.5 text-[11px] leading-5 text-muted-foreground">{law.note}</p>
          ) : null}

          {law.movedTo ? (
            <div className="mt-2 flex gap-2 rounded-xl bg-amber-500/10 p-2.5 text-[11px] leading-5 text-amber-800 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{law.movedTo.note}</span>
            </div>
          ) : null}

          {law.gaps?.count ? (
            <div className="mt-2 flex gap-2 rounded-xl bg-muted p-2.5 text-[11px] leading-5 text-muted-foreground">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {formatNumberFa(law.gaps.count)} ماده در منابع آزاد موجود نبود
                {law.gaps.items.length ? ` (از جمله مواد ${law.gaps.items.slice(0, 8).map((n) => toFaDigits(n)).join('، ')})` : ''}.
                برای تکمیل، از سامانه ملی قوانین (qavanin.ir) استفاده کنید.
              </span>
            </div>
          ) : null}

          {law.filledFrom ? (
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              {formatNumberFa(law.filledFrom.numbers.length)} ماده از منبع پشتیبان ({law.filledFrom.label}) تکمیل شده است.
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download size={12} />{' '}
              {downloaded === false ? 'ذخیره نشده روی دستگاه' : 'ذخیره‌شده برای حالت آفلاین'}
            </span>
            {law.source?.url ? (
              <a href={law.source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary">
                منبع <ExternalLink size={11} />
              </a>
            ) : (
              <span className="flex items-center gap-1">
                <BookText size={12} /> {law.source?.name}
              </span>
            )}
          </div>
        </Card>
      </header>

      {/* جست‌وجو و فصل‌ها */}
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 mt-3 space-y-2 bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2">
          <Search size={16} className="text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو در مواد این قانون…"
            className="h-6 border-0 p-0 text-sm focus-visible:ring-0"
          />
          {query ? <span className="text-[11px] text-muted-foreground">{filtered.length}</span> : null}
        </div>

        {law.chapters.length > 1 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <ChapterChip active={!chapter} onClick={() => setChapter(null)}>
              همه فصل‌ها
            </ChapterChip>
            {law.chapters.map((c) => (
              <ChapterChip key={c.title} active={chapter === c.title} onClick={() => setChapter(c.title)}>
                {c.title}
              </ChapterChip>
            ))}
          </div>
        ) : null}
      </div>

      {articles === null ? (
        <div className="mt-3 space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-2">
          <ArticleList articles={filtered} emptyMessage="در این قانون، ماده‌ای با این عبارت یافت نشد." />
        </div>
      )}

      <ReaderSettingsSheet open={readerOpen} onClose={() => setReaderOpen(false)} />
    </div>
  );
}

function ChapterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] transition-colors',
        active ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
