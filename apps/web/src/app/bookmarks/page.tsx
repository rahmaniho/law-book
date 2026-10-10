'use client';

import { articleHref } from '@/lib/reader-routes';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookmarkX, Clock, NotebookPen, Star, Trash2 } from 'lucide-react';
import { db, clearHistory, toggleBookmark, saveNote } from '@/lib/db';
import { loadArticle } from '@/lib/sync';
import { Button, Card, EmptyState, Segmented, Skeleton, Textarea } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { formatNumberFa, relativeTime } from '@/lib/format';
import { toFaDigits } from '@/lib/fa';
import type { ArticleRow } from '@/lib/db';

type Tab = 'bookmarks' | 'notes' | 'history';

export default function BookmarksPage() {
  const [tab, setTab] = useState<Tab>('bookmarks');
  const bookmarks = useLiveQuery(() => db.bookmarks.orderBy('createdAt').reverse().toArray(), [], undefined);
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), [], undefined);
  const history = useLiveQuery(() => db.history.orderBy('createdAt').reverse().limit(50).toArray(), [], undefined);

  return (
    <div className="app-container pb-8">
      <div className="pt-3">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'bookmarks', label: `نشان‌شده‌ها${bookmarks ? ` (${toFaDigits(bookmarks.length)})` : ''}` },
            { value: 'notes', label: `یادداشت‌ها${notes ? ` (${toFaDigits(notes.length)})` : ''}` },
            { value: 'history', label: 'تاریخچه' },
          ]}
        />
      </div>

      {tab === 'bookmarks' ? (
        <div className="mt-4 space-y-2">
          {bookmarks === undefined ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : bookmarks.length === 0 ? (
            <EmptyState
              icon={<Star size={22} />}
              title="هنوز ماده‌ای نشان نکرده‌اید"
              description="برای نشان‌گذاری، کارت ماده را به راست بکشید یا در صفحه ماده روی «نشان‌کردن» بزنید."
            />
          ) : (
            bookmarks.map((b) => (
              <Card key={b.articleId} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={articleHref(b.articleId)} className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-primary">{b.lawTitle}</p>
                    <p className="mt-0.5 text-[13px] font-semibold">ماده {b.articleNumberFa}</p>
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-6 text-muted-foreground">{b.excerpt}</p>
                  </Link>
                  <button
                    aria-label="حذف نشان"
                    className="shrink-0 text-muted-foreground"
                    onClick={async () => {
                      const article = await loadArticle(b.articleId);
                      if (article) await toggleBookmark(article as ArticleRow);
                      else await db.bookmarks.delete(b.articleId);
                    }}
                  >
                    <BookmarkX size={16} />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{relativeTime(b.createdAt)}</p>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div className="mt-4 space-y-2">
          {notes === undefined ? (
            [...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          ) : notes.length === 0 ? (
            <EmptyState icon={<NotebookPen size={22} />} title="یادداشتی ثبت نشده" description="در صفحه هر ماده می‌توانید یادداشت شخصی بنویسید." />
          ) : (
            notes.map((n) => <NoteCard key={n.articleId} articleId={n.articleId} lawId={n.lawId} initial={n.text} updatedAt={n.updatedAt} />)
          )}
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="mt-4">
          {history === undefined ? (
            <Skeleton className="h-24 w-full" />
          ) : history.length === 0 ? (
            <EmptyState icon={<Clock size={22} />} title="تاریخچه‌ای نیست" description="جست‌وجوهای شما به‌صورت محلی ذخیره می‌شود." />
          ) : (
            <>
              <SectionHeading
                title={`${formatNumberFa(history.length)} جست‌وجوی اخیر`}
                action={
                  <Button variant="ghost" size="sm" onClick={() => clearHistory()} className="gap-1 text-[11px] text-muted-foreground">
                    <Trash2 size={13} /> پاک کردن
                  </Button>
                }
              />
              <div className="space-y-1.5">
                {history.map((h) => (
                  <Link
                    key={h.id}
                    href={`/search?q=${encodeURIComponent(h.q)}`}
                    className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5 text-[12.5px] active:bg-accent/40"
                  >
                    <span className="truncate">{h.q}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(h.createdAt)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NoteCard({
  articleId,
  lawId,
  initial,
  updatedAt,
}: {
  articleId: string;
  lawId: string;
  initial: string;
  updatedAt: number;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <Card className="p-3.5">
      <Link href={articleHref(articleId)} className="text-[11px] text-primary">
        مشاهده ماده
      </Link>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-2 text-[12.5px]" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{relativeTime(updatedAt)}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              await saveNote(articleId, lawId, '');
              setText('');
            }}
          >
            حذف
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await saveNote(articleId, lawId, text);
              setSaved(true);
              setTimeout(() => setSaved(false), 1200);
            }}
          >
            {saved ? 'ذخیره شد' : 'ذخیره'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
