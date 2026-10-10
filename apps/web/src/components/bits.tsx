'use client';

import { lawHref } from '@/lib/reader-routes';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark, Copy, Share2, Star, Type, AlignRight, AlignJustify, Check, ChevronLeft, SlidersHorizontal, NotebookPen,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Segmented, Sheet, Skeleton, Slider, Switch, Textarea } from '@/components/ui/primitives';
import { ArticleCard } from '@/components/article-card';
import { cn } from '@/lib/utils';
import { toFaDigits } from '@/lib/fa';
import { copyText, shareArticle } from '@/lib/share';
import { haptic, readerStyle, useBookmark } from '@/lib/hooks';
import { DEFAULT_READER, useApp } from '@/lib/store';
import { db } from '@/lib/db';
import type { ArticleRow } from '@/lib/db';
import type { Article, Category, LawMeta } from '@/lib/types';
import { formatNumberFa } from '@/lib/format';

export function SectionHeading({
  title,
  action,
  subtitle,
}: {
  title: string;
  action?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 mt-6 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/laws?category=${c.id}`}
          className="group flex flex-col justify-between rounded-2xl border bg-card p-3.5 shadow-card active:scale-[0.98]"
        >
          <span
            className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-base"
            style={{ backgroundColor: `${c.color}1a`, color: c.color }}
          >
            ●
          </span>
          <span className="text-[13px] font-semibold leading-5">{c.title}</span>
          <span className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-muted-foreground">{c.description}</span>
        </Link>
      ))}
    </div>
  );
}

export function LawRowCard({ law, href }: { law: LawMeta; href?: string }) {
  return (
    <Link
      href={href ?? lawHref(law.id)}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card active:bg-accent/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold leading-6">{law.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatNumberFa(law.articleCount)} ماده</span>
          {law.approvalDate ? <span>• مصوب {law.approvalDate}</span> : null}
          {law.status !== 'لازم‌الاجرا' ? <Badge tone="danger">{law.status}</Badge> : null}
          {law.gaps?.count ? <Badge tone="warning">{formatNumberFa(law.gaps.count)} ماده ناموجود</Badge> : null}
        </div>
      </div>
      <ChevronLeft size={18} className="shrink-0 text-muted-foreground" />
    </Link>
  );
}

/* -------------------------- کارت ماده با متن برجسته -------------------------- */
export function ArticleItem({ article }: { article: ArticleRow }) {
  return (
    <div className="article-chunk px-1 py-1.5">
      <ArticleCard article={article} />
    </div>
  );
}

/** تعداد ماده‌هایی که در هر مرحله رندر می‌شود */
const ARTICLE_CHUNK = 40;

/**
 * فهرست ماده‌ها (عملکرد روان برای قوانین با بیش از هزار ماده).
 *
 * پیش‌تر اینجا `FixedSizeList` با ارتفاع `window.innerHeight - 210` استفاده
 * می‌شد؛ یعنی یک کانتینر اسکرول تودرتو در میان صفحه. روی موبایل نتیجه‌اش این
 * بود که اسکرول لمسی بین صفحه و فهرست گیر می‌کرد، با جمع‌شدن نوار آدرس
 * مرورگر ارتفاع فهرست می‌پرید، و هر ماده در قالب ثابت ۱۸۶px بریده می‌شد.
 *
 * حالا ماده‌ها در جریان طبیعیِ خودِ صفحه رندر می‌شوند (یک اسکرول‌کننده، همان
 * document) و فقط «تعداد» گره‌ها با نزدیک‌شدن کاربر به انتهای فهرست زیاد
 * می‌شود؛ `content-visibility` هم هزینهٔ رندر موارد بیرون از دید را حذف می‌کند.
 */
export function ArticleList({
  articles,
  emptyMessage = 'ماده‌ای یافت نشد.',
}: {
  articles: ArticleRow[];
  emptyMessage?: string;
}) {
  const [limit, setLimit] = useState(ARTICLE_CHUNK);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* با تغییر فیلتر/جست‌وجو (هویت آرایه عوض می‌شود) فهرست از اول رندر شود */
  useEffect(() => {
    setLimit(ARTICLE_CHUNK);
  }, [articles]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || limit >= articles.length) return;
    if (typeof IntersectionObserver === 'undefined') {
      setLimit(articles.length);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((current) => Math.min(current + ARTICLE_CHUNK, articles.length));
        }
      },
      { rootMargin: '1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [limit, articles.length]);

  if (!articles.length) {
    return (
      <EmptyState
        icon={<SlidersHorizontal size={22} />}
        title="نتیجه‌ای نیست"
        description={emptyMessage}
      />
    );
  }

  const hasMore = limit < articles.length;

  return (
    <div>
      {articles.slice(0, limit).map((article) => (
        <ArticleItem key={article.id} article={article} />
      ))}
      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <Skeleton className="h-3 w-24" />
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------- دکمه‌های عملیات ماده -------------------------- */
export function ArticleActions({ article }: { article: ArticleRow }) {
  const { bookmarked, toggle } = useBookmark(article);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={bookmarked ? 'default' : 'outline'}
        size="sm"
        className="flex-1"
        onClick={() => toggle()}
      >
        <Star size={15} className={cn(bookmarked && 'fill-current')} />
        {bookmarked ? 'نشان‌شده' : 'نشان‌کردن'}
      </Button>
      <Button variant="outline" size="sm" className="flex-1" onClick={() => shareArticle(article)}>
        <Share2 size={15} /> اشتراک
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="کپی متن"
        onClick={async () => {
          const ok = await copyText(`${article.lawTitle} — ماده ${article.numberFa}\n\n${article.text}`);
          setCopied(ok);
          haptic(8);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </Button>
    </div>
  );
}

/* -------------------------- یادداشت شخصی -------------------------- */
export function NoteEditor({ article }: { article: Article }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    db.notes.get(article.id).then((n) => setText(n?.text ?? ''));
  }, [article.id]);

  const save = async () => {
    await db.notes.put({ articleId: article.id, lawId: article.lawId, text: text.trim(), updatedAt: Date.now() });
    setSaved(true);
    setOpen(false);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <NotebookPen size={15} /> {text ? 'ویرایش یادداشت' : 'افزودن یادداشت شخصی'}
        {saved ? <Check size={14} className="text-emerald-600" /> : null}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="یادداشت شخصی">
        <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
          یادداشت شما فقط روی همین دستگاه ذخیره می‌شود و ارسال نمی‌گردد.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="نکته، ارجاع یا یادآوری پرونده…"
          rows={6}
        />
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={save}>
            ذخیره
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            انصراف
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/* -------------------------- تنظیمات خواندن -------------------------- */
export function ReaderSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reader = useApp((s) => s.reader);
  const update = useApp((s) => s.updateReader);
  const reset = useApp((s) => s.resetReader);

  return (
    <Sheet open={open} onClose={onClose} title="حالت مطالعه">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium">
              <Type size={14} /> اندازه متن
            </span>
            <span className="text-muted-foreground">{toFaDigits(reader.fontSize)}px</span>
          </div>
          <Slider value={reader.fontSize} min={14} max={26} step={1} onChange={(v) => update({ fontSize: v })} label="اندازه متن" />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium">فاصله خطوط</span>
            <span className="text-muted-foreground">{toFaDigits(reader.lineHeight.toFixed(1))}</span>
          </div>
          <Slider
            value={reader.lineHeight}
            min={1.4}
            max={2.6}
            step={0.1}
            onChange={(v) => update({ lineHeight: v })}
            label="فاصله خطوط"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">چینش دوطرفه (justify)</span>
          <Switch checked={reader.justify} onChange={(v) => update({ justify: v })} label="چینش دوطرفه" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">نمایش کلیدواژه‌ها زیر هر ماده</span>
          <Switch checked={reader.showKeywords} onChange={(v) => update({ showKeywords: v })} label="نمایش کلیدواژه" />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium">قلم متن</p>
          <Segmented
            value={reader.fontFamily}
            onChange={(v) => update({ fontFamily: v })}
            options={[
              { value: 'sans', label: 'وزیرمتن' },
              { value: 'serif', label: 'سریف' },
            ]}
          />
        </div>

        <div
          className="rounded-2xl border bg-muted/40 p-3 text-[13px]"
          style={readerStyle(reader)}
        >
          نمونه متن: «قراردادهای خصوصی نسبت به کسانی که آن را منعقد نموده‌اند در صورتی که مخالف صریح قانون نباشد نافذ است.»
        </div>

        <Button variant="ghost" className="w-full" onClick={reset}>
          بازگردانی به تنظیمات پیش‌فرض
        </Button>
      </div>
    </Sheet>
  );
}

/* -------------------------- پوسته فیلترها -------------------------- */
export function FilterSheet({
  open,
  onClose,
  categories,
  hierarchies,
  laws,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  categories: { id: string; title: string }[];
  hierarchies: { id: string; title: string }[];
  laws?: { id: string; shortTitle: string }[];
  value: { category?: string | null; hierarchy?: string | null; lawId?: string | null; status?: string | null };
  onChange: (v: { category?: string | null; hierarchy?: string | null; lawId?: string | null; status?: string | null }) => void;
}) {
  const Chip = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="فیلترها">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-bold">دسته موضوعی</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!value.category} onClick={() => onChange({ ...value, category: null })}>
              همه
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={value.category === c.id} onClick={() => onChange({ ...value, category: c.id })}>
                {c.title}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold">سطح سند</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!value.hierarchy} onClick={() => onChange({ ...value, hierarchy: null })}>
              همه
            </Chip>
            {hierarchies.map((h) => (
              <Chip key={h.id} active={value.hierarchy === h.id} onClick={() => onChange({ ...value, hierarchy: h.id })}>
                {h.title}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold">وضعیت اعتبار</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!value.status} onClick={() => onChange({ ...value, status: null })}>
              همه
            </Chip>
            {['لازم‌الاجرا', 'اصلاحی', 'منسوخ'].map((s) => (
              <Chip key={s} active={value.status === s} onClick={() => onChange({ ...value, status: s })}>
                {s}
              </Chip>
            ))}
          </div>
        </div>

        {laws?.length ? (
          <div>
            <p className="mb-2 text-xs font-bold">قانون</p>
            <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto">
              <Chip active={!value.lawId} onClick={() => onChange({ ...value, lawId: null })}>
                همه
              </Chip>
              {laws.map((l) => (
                <Chip key={l.id} active={value.lawId === l.id} onClick={() => onChange({ ...value, lawId: l.id })}>
                  {l.shortTitle}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              onClose();
            }}
          >
            اعمال فیلتر
          </Button>
          <Button variant="outline" onClick={() => onChange({})}>
            پاک کردن
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function StatsStrip({ stats }: { stats: { lawCount: number; articleCount: number } }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Card className="p-3 text-center">
        <p className="text-lg font-bold text-primary">{formatNumberFa(stats.lawCount)}</p>
        <p className="text-[11px] text-muted-foreground">قانون و سند حقوقی</p>
      </Card>
      <Card className="p-3 text-center">
        <p className="text-lg font-bold text-primary">{formatNumberFa(stats.articleCount)}</p>
        <p className="text-[11px] text-muted-foreground">ماده قانونی</p>
      </Card>
    </div>
  );
}

export function KeywordChips({ keywords }: { keywords: string[] }) {
  if (!keywords?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.slice(0, 10).map((k) => (
        <Link
          key={k}
          href={`/search?q=${encodeURIComponent(k)}`}
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          {k}
        </Link>
      ))}
    </div>
  );
}

export function useReaderMatches(query: string, articles: ArticleRow[]) {
  return useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.trim();
    return articles.filter((a) => `${a.numberFa} ${a.text} ${a.chapter}`.includes(q));
  }, [query, articles]);
}

export { AlignJustify, AlignRight, Bookmark };
