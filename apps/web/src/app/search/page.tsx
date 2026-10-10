'use client';

import { lawHref } from '@/lib/reader-routes';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, Filter, Search as SearchIcon, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { useSearch } from '@/lib/use-search';
import { addHistory, clearHistory, db } from '@/lib/db';
import type { ArticleRow } from '@/lib/db';
import { ArticleCard } from '@/components/article-card';
import { FilterSheet } from '@/components/bits';
import { Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { toFaDigits } from '@/lib/fa';
import { formatNumberFa } from '@/lib/format';
import type { SearchHistoryItem } from '@/lib/types';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="app-container py-6"><Skeleton className="h-10 w-full" /></div>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const catalog = useApp((s) => s.catalog);
  const initial = params.get('q') ?? '';
  const [raw, setRaw] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  const { results, elapsed, loading, engineReady } = useSearch(query, {
    filters: {
      category: filters.category ?? null,
      hierarchy: filters.hierarchy ?? null,
      lawId: filters.lawId ?? null,
      status: filters.status ?? null,
    },
    limit: 80,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(raw);
      if (raw.trim().length > 1) addHistory(raw.trim());
    }, 200);
    return () => clearTimeout(t);
  }, [raw]);

  useEffect(() => {
    db.history.orderBy('createdAt').reverse().limit(12).toArray().then(setHistory);
  }, [query]);

  useEffect(() => {
    router.replace(query ? `/search?q=${encodeURIComponent(query)}` : '/search', { scroll: false });
  }, [query, router]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  return (
    <div className="app-container pb-8">
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
            <SearchIcon size={16} className="text-muted-foreground" />
            <input
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="ماده ۱۰ قانون مدنی، مهریه، طلاق…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              enterKeyHint="search"
            />
            {raw ? (
              <button aria-label="پاک کردن" onClick={() => setRaw('')} className="text-muted-foreground">
                <X size={15} />
              </button>
            ) : null}
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className="relative rounded-2xl border p-2.5 text-muted-foreground"
            aria-label="فیلترها"
          >
            <Filter size={16} />
            {activeFilterCount ? (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                {toFaDigits(activeFilterCount)}
              </span>
            ) : null}
          </button>
        </div>

        {query.trim().length > 1 ? (
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {loading ? 'در حال جست‌وجو…' : `${formatNumberFa(results.length)} نتیجه در ${formatNumberFa(Math.round(elapsed))} میلی‌ثانیه`}
            </span>
            {!engineReady ? <span>آماده‌سازی ایندکس…</span> : null}
          </div>
        ) : null}
      </div>

      {/* پیشنهادها و تاریخچه */}
      {query.trim().length < 2 ? (
        <div className="mt-4 space-y-5">
          {history.length ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-1 text-[12.5px] font-bold">
                  <Clock size={14} /> جست‌وجوهای اخیر
                </h2>
                <button
                  className="text-[11px] text-muted-foreground"
                  onClick={async () => {
                    await clearHistory();
                    setHistory([]);
                  }}
                >
                  پاک کردن تاریخچه
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setRaw(h.q)}
                    className="rounded-full border px-3 py-1.5 text-[11.5px] text-muted-foreground"
                  >
                    {h.q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="mb-2 text-[12.5px] font-bold">جست‌وجوهای پرکاربرد</h2>
            <div className="flex flex-wrap gap-2">
              {['مهریه', 'طلاق توافقی', 'قصاص نفس', 'قرارداد کار', 'چک بلامحل', 'خسارت تأخیر تأدیه', 'ارث زوجه', 'حداقل مزد'].map((s) => (
                <button
                  key={s}
                  onClick={() => setRaw(s)}
                  className="rounded-full border px-3 py-1.5 text-[11.5px] text-muted-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[12.5px] font-bold">جست‌وجو بر اساس شماره ماده</h2>
            <div className="flex flex-wrap gap-2">
              {['ماده ۱۰ قانون مدنی', 'ماده ۱۹۰ قانون مدنی', 'اصل ۲۲', 'ماده ۷ قانون کار'].map((s) => (
                <button
                  key={s}
                  onClick={() => setRaw(s)}
                  className="rounded-full border px-3 py-1.5 text-[11.5px] text-muted-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* نتایج */}
      <div className="mt-2 space-y-2.5 pb-4">
        {loading && !results.length ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : null}

        {results.map(({ article }) => (
          <ResultCard key={article.id} article={article} query={query} />
        ))}

        {!loading && query.trim().length > 1 && results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={20} />}
            title="نتیجه‌ای یافت نشد"
            description="املای عبارت را بررسی کنید یا از شماره ماده استفاده کنید (نمونه: «ماده ۱۰ قانون مدنی»)."
            action={
              <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}>
                تغییر فیلترها
              </Button>
            }
          />
        ) : null}
      </div>

      {catalog ? (
        <FilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          categories={catalog.categories}
          hierarchies={catalog.hierarchy}
          laws={catalog.laws
            .filter((l) => l.articleCount > 0)
            .map((l) => ({ id: l.id, shortTitle: l.shortTitle }))}
          value={filters}
          onChange={(v) => setFilters(v as Record<string, string | null>)}
        />
      ) : null}
    </div>
  );
}

function ResultCard({ article, query }: { article: ArticleRow; query: string }) {
  const terms = useMemo(
    () => query.split(/\s+/).filter((t) => t.length > 2 && !/^(ماده|قانون|اصل)$/.test(t)),
    [query],
  );
  const highlighted = useMemo(() => {
    if (!terms.length) return article.text;
    const parts: React.ReactNode[] = [];
    let rest = article.text;
    let key = 0;
    for (const term of terms) {
      const idx = rest.indexOf(term);
      if (idx === -1) continue;
      parts.push(rest.slice(0, idx));
      parts.push(
        <mark key={key++} className="rounded bg-primary/20 px-0.5 text-inherit">
          {rest.slice(idx, idx + term.length)}
        </mark>,
      );
      rest = rest.slice(idx + term.length);
    }
    parts.push(rest);
    return parts;
  }, [article.text, terms]);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 px-1">
        <Badge tone="muted">{article.hierarchy === 'constitution' ? 'قانون اساسی' : 'قانون'}</Badge>
        {article.status !== 'لازم‌الاجرا' ? <Badge tone="warning">{article.status}</Badge> : null}
      </div>
      <ArticleCard article={article} highlight={<>{highlighted}</>} compact />
      <Link
        href={lawHref(article.lawId)}
        className="mt-1 block px-1 text-[10.5px] text-muted-foreground underline-offset-2"
      >
        مشاهده همه مواد {article.lawTitle}
      </Link>
    </div>
  );
}
