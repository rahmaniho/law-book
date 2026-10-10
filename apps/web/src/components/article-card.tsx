'use client';

import { articleHref } from '@/lib/reader-routes';

import Link from 'next/link';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Bookmark, Share2, Star } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toFaDigits } from '@/lib/fa';
import { shareArticle } from '@/lib/share';
import { haptic, useBookmark } from '@/lib/hooks';
import type { ArticleRow } from '@/lib/db';
import { Badge } from '@/components/ui/primitives';

/**
 * کارت ماده قانونی با کشیدن (Swipe):
 *   کشیدن به راست → نشان‌گذاری   |   کشیدن به چپ → اشتراک‌گذاری   |   لمس → متن کامل
 */
export function ArticleCard({
  article,
  highlight,
  compact = false,
}: {
  article: ArticleRow;
  highlight?: React.ReactNode;
  compact?: boolean;
}) {
  const x = useMotionValue(0);
  const bookmarkOpacity = useTransform(x, [0, 90], [0, 1]);
  const shareOpacity = useTransform(x, [-90, 0], [1, 0]);
  const { bookmarked, toggle } = useBookmark(article);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const onDragEnd = async (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x > 80) {
      const now = await toggle();
      flash(now ? 'نشان‌گذاری شد' : 'از نشان‌شده‌ها حذف شد');
    } else if (info.offset.x < -80) {
      haptic(10);
      const result = await shareArticle(article);
      if (result === 'copied') flash('متن ماده کپی شد');
      if (result === 'shared') flash('اشتراک‌گذاری شد');
    }
  };

  return (
    <div className="relative">
      {/* پس‌زمینه‌های عمل کشیدن */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-2xl bg-muted/60 px-5">
        <motion.span style={{ opacity: bookmarkOpacity }} className="flex items-center gap-1 text-xs font-medium text-primary">
          <Star size={16} className={cn(bookmarked && 'fill-current')} /> نشان‌گذاری
        </motion.span>
        <motion.span style={{ opacity: shareOpacity }} className="flex items-center gap-1 text-xs font-medium text-primary">
          <Share2 size={16} /> اشتراک‌گذاری
        </motion.span>
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={onDragEnd}
        style={{ x }}
        whileTap={{ scale: 0.995 }}
        className="relative"
      >
        <Link
          href={articleHref(article.id)}
          className="block rounded-2xl border bg-card p-4 shadow-card active:bg-accent/40"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-primary">{article.lawTitle}</p>
              {article.chapter ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{article.chapter}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {article.status !== 'لازم‌الاجرا' ? (
                <Badge tone={article.status === 'منسوخ' ? 'danger' : 'warning'}>{article.status}</Badge>
              ) : null}
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                ماده {article.numberFa}
              </span>
              {bookmarked ? <Star size={14} className="fill-primary text-primary" /> : null}
            </div>
          </div>

          <div className={cn('mt-3 text-sm leading-7 text-foreground/90', compact ? 'line-clamp-3' : 'line-clamp-6')}>
            {highlight ?? article.text}
          </div>

          {article.amendments.length ? (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {toFaDigits(article.amendments.length)} اصلاحیه ثبت‌شده
            </p>
          ) : null}
        </Link>
      </motion.div>

      {toast ? (
        <div className="pointer-events-none absolute inset-x-4 -bottom-2 z-10 rounded-xl bg-foreground/90 px-3 py-1.5 text-center text-[11px] text-background shadow animate-fade-in">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
