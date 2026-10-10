'use client';

import { articleHref, lawHref } from '@/lib/reader-routes';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, Info, Settings2 } from 'lucide-react';
import { loadArticle, loadLawArticles } from '@/lib/sync';
import { db } from '@/lib/db';
import type { ArticleRow } from '@/lib/db';
import { useApp } from '@/lib/store';
import { Badge, Button, Card, Skeleton } from '@/components/ui/primitives';
import { ArticleActions, KeywordChips, NoteEditor, ReaderSettingsSheet } from '@/components/bits';
import { readerStyle } from '@/lib/hooks';
import { toFaDigits } from '@/lib/fa';

export default function ArticlePage({ id }: { id?: string } = {}) {
  const params = useParams<{ articleId: string }>();
  const articleId = id ?? params?.articleId ?? '';
  const [article, setArticle] = useState<ArticleRow | null | undefined>(undefined);
  const [siblings, setSiblings] = useState<ArticleRow[]>([]);
  const [readerOpen, setReaderOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const reader = useApp((s) => s.reader);
  const catalog = useApp((s) => s.catalog);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const row = await loadArticle(articleId);
      if (!mounted) return;
      setArticle(row ?? null);
      if (row) {
        const list = await loadLawArticles(row.lawId);
        if (!mounted) return;
        setSiblings(list);
        const n = await db.notes.get(row.id);
        setNote(n?.text ?? null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [articleId]);

  const { prev, next, related } = useMemo(() => {
    const idx = siblings.findIndex((a) => a.id === articleId);
    const current = idx >= 0 ? siblings[idx] : null;
    return {
      prev: idx > 0 ? siblings[idx - 1] : null,
      next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null,
      related: current ? siblings.filter((a) => a.chapter === current.chapter && a.id !== current.id).slice(0, 4) : [],
    };
  }, [siblings, articleId]);

  if (article === undefined) {
    return (
      <div className="app-container space-y-3 py-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="app-container py-10 text-center">
        <p className="text-sm text-muted-foreground">این ماده در پایگاه‌داده محلی یافت نشد.</p>
        <Link href="/laws" className="mt-3 inline-block text-sm text-primary">
          مرور قوانین
        </Link>
      </div>
    );
  }

  const lawMeta = catalog?.laws.find((l) => l.id === article.lawId);
  const paragraphs = article.text.split('\n');

  return (
    <div className="app-container pb-10">
      <div className="flex items-center justify-between pt-3">
        <Link href={lawHref(article.lawId)} className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <ArrowRight size={13} /> {article.lawTitle}
        </Link>
        <Button variant="ghost" size="icon-sm" aria-label="تنظیمات خواندن" onClick={() => setReaderOpen(true)}>
          <Settings2 size={16} />
        </Button>
      </div>

      <Card className="mt-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">{article.chapter || lawMeta?.documentType}</p>
            <h1 className="mt-1 text-base font-bold">
              ماده {article.numberFa}
              {article.mokarrar ? ' (مکرر)' : ''}
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {article.status !== 'لازم‌الاجرا' ? (
              <Badge tone={article.status === 'منسوخ' ? 'danger' : 'warning'}>{article.status}</Badge>
            ) : (
              <Badge tone="success">لازم‌الاجرا</Badge>
            )}
            {article.amendments.length ? (
              <span className="text-[10px] text-muted-foreground">
                {toFaDigits(article.amendments.length)} اصلاحیه
              </span>
            ) : null}
          </div>
        </div>

        {/* متن ماده */}
        <article className="article-text mt-4 text-foreground/95" style={readerStyle(reader)}>
          {paragraphs.map((line, i) => {
            const isTabsoore = /^\s*(تبصره|‌تبصره)/.test(line);
            if (!line.trim()) return <br key={i} />;
            return isTabsoore ? (
              <p key={i} className="tabsoore">
                {line}
              </p>
            ) : (
              <p key={i}>{line}</p>
            );
          })}
        </article>

        {article.notes?.length ? (
          <div className="mt-3 space-y-2">
            {article.notes.map((n, i) => (
              <p key={i} className="flex gap-2 rounded-xl bg-muted/60 p-2.5 text-[11px] leading-5 text-muted-foreground">
                <Info size={13} className="mt-0.5 shrink-0" /> {n}
              </p>
            ))}
          </div>
        ) : null}

        {article.amendments.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.amendments.map((a, i) => (
              <Badge key={i} tone="muted">
                {a.kind} {a.date}
              </Badge>
            ))}
          </div>
        ) : null}

        {article.filledFrom ? (
          <p className="mt-2 text-[10.5px] text-muted-foreground">تکمیل‌شده از منبع پشتیبان: {article.filledFrom}</p>
        ) : null}

        {reader.showKeywords && article.keywords.length ? (
          <div className="mt-3">
            <KeywordChips keywords={article.keywords} />
          </div>
        ) : null}

        <div className="mt-4">
          <ArticleActions article={article} />
        </div>

        <div className="mt-2">
          <NoteEditor article={article} />
        </div>

        {note ? (
          <p className="mt-2 rounded-xl border border-dashed p-2.5 text-[11.5px] leading-6 text-muted-foreground">
            یادداشت شما: {note}
          </p>
        ) : null}
      </Card>

      {/* پیمایش ماده قبل/بعد */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {prev ? (
          <Link
            href={articleHref(prev.id)}
            className="flex items-center gap-2 rounded-2xl border bg-card p-3 text-[11.5px] shadow-card active:scale-[0.98]"
          >
            <ChevronRight size={15} className="text-primary" />
            <span className="truncate">ماده {prev.numberFa}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={articleHref(next.id)}
            className="flex items-center justify-end gap-2 rounded-2xl border bg-card p-3 text-[11.5px] shadow-card active:scale-[0.98]"
          >
            <span className="truncate">ماده {next.numberFa}</span>
            <ChevronLeft size={15} className="text-primary" />
          </Link>
        ) : null}
      </div>

      {related.length ? (
        <div className="mt-5">
          <h2 className="mb-2 text-[12.5px] font-bold">مواد مرتبط در همین فصل</h2>
          <div className="space-y-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={articleHref(r.id)}
                className="block rounded-2xl border bg-card p-3 shadow-card active:bg-accent/40"
              >
                <p className="text-[11px] font-medium text-primary">ماده {r.numberFa}</p>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-6 text-muted-foreground">{r.text}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-center text-[10.5px] leading-5 text-muted-foreground">
        مرجع رسمی تفسیر و اجرا، روزنامه رسمی و سامانه ملی قوانین است.
      </p>

      <ReaderSettingsSheet open={readerOpen} onClose={() => setReaderOpen(false)} />
    </div>
  );
}
