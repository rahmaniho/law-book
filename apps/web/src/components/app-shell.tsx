'use client';

import { articleHref } from '@/lib/reader-routes';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Home, Search, Settings, Star, X, WifiOff, Download, Sparkles,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { useDebounced, useInstallPrompt, useOnlineStatus } from '@/lib/hooks';
import { useSearch } from '@/lib/use-search';
import { toFaDigits } from '@/lib/fa';
import { cn } from '@/lib/utils';
import { cleanExcerpt } from '@/lib/format';
import { withBase } from '@/lib/base-path';
import type { ArticleRow } from '@/lib/db';

const TABS = [
  { href: '/', label: 'خانه', icon: Home },
  { href: '/laws', label: 'قوانین', icon: BookOpen },
  { href: '/search', label: 'جست‌وجو', icon: Search },
  { href: '/bookmarks', label: 'نشان‌ها', icon: Star },
  { href: '/settings', label: 'تنظیمات', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-xl pb-24 pt-2">{children}</main>
      <BottomNav pathname={pathname} />
      <InstallBanner />
      <OfflineIndicator />
    </>
  );
}

function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const debounced = useDebounced(query, 200);
  const { results, engineReady } = useSearch(focused && debounced.trim().length > 1 ? debounced : '', {
    limit: 6,
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const catalog = useApp((s) => s.catalog);
  const online = useOnlineStatus();

  /* ارتفاع واقعی نوار بالا در `--topbar-h` نوشته می‌شود تا نوارهای چسبندهٔ
     صفحات (فیلترها/جست‌وجو/فصل‌ها) دقیقاً زیر آن بچسبند. ارتفاع ثابت ۵۲px
     با safe-area-inset-top گوشی‌های ناچ‌دار و با تغییر ارتفاع نوار هم‌خوان
     نبود و نوارها زیر هدر پنهان می‌شدند. */
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--topbar-h', `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    setFocused(false);
    setQuery('');
  }, [pathname]);

  const isSearchPage = pathname === '/search';
  const showDropdown = focused && query.trim().length > 1 && !isSearchPage;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setFocused(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header ref={headerRef} className="glass sticky top-0 z-40 border-b no-print">
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2 safe-top" ref={boxRef}>
        <div className="relative flex-1">
          <form onSubmit={submit}>
            <div className="flex items-center gap-2 rounded-2xl border bg-background/80 px-3 py-2">
              <Search size={17} className="shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="جست‌وجو در قوانین، ماده، کلیدواژه…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                enterKeyHint="search"
                aria-label="جست‌وجو"
              />
              {query ? (
                <button type="button" aria-label="پاک کردن" onClick={() => setQuery('')} className="text-muted-foreground">
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </form>

          {showDropdown ? (
            <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border bg-popover shadow-lg overscroll-contain">
              {!engineReady ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">آماده‌سازی ایندکس جست‌وجو…</p>
              ) : results.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">نتیجه‌ای یافت نشد.</p>
              ) : (
                <ul className="divide-y">
                  {results.map(({ article }) => (
                    <li key={article.id}>
                      <Link
                        href={articleHref(article.id)}
                        className="block px-4 py-3 active:bg-accent"
                        onClick={() => setFocused(false)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-primary">{article.lawTitle}</span>
                          <span className="text-[11px] text-muted-foreground">ماده {article.numberFa}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {cleanExcerpt(article.text, 110)}
                        </p>
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      className="w-full px-4 py-2 text-center text-xs font-medium text-primary"
                      onClick={submit}
                    >
                      مشاهده همه نتایج
                    </button>
                  </li>
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {!online ? (
          <span
            title="حالت آفلاین"
            className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400"
          >
            <WifiOff size={13} />
          </span>
        ) : null}
        {catalog && pathname === '/' ? (
          <span className="hidden shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground xs:inline">
            نسخه {toFaDigits(catalog.version.split('+')[0])}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const bookmarks = useApp((s) => s.bookmarkedIds.size);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur no-print safe-bottom">
      <ul className="mx-auto flex max-w-xl items-stretch">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  'relative flex h-[60px] flex-col items-center justify-center gap-1 px-0.5 text-[11px] transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                  {tab.href === '/bookmarks' && bookmarks > 0 ? (
                    <span className="absolute -left-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground">
                      {toFaDigits(bookmarks)}
                    </span>
                  ) : null}
                </span>
                <span className={cn('w-full truncate text-center text-[10.5px] leading-tight', active && 'font-semibold')}>
                  {tab.label}
                </span>
                {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[var(--topbar-h)] z-30 mx-auto max-w-xl px-4 no-print">
      <div className="pointer-events-auto mt-1 flex items-center justify-center gap-2 rounded-full bg-amber-500/90 px-3 py-1 text-[11px] font-medium text-amber-950 shadow animate-fade-in">
        <WifiOff size={12} /> بدون اینترنت — نسخه ذخیره‌شده روی همین دستگاه نمایش داده می‌شود
      </div>
    </div>
  );
}

function InstallBanner() {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const online = useOnlineStatus();
  const ready = useApp((s) => s.ready);
  const isIos = useMemo(
    () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent),
    [],
  );

  useEffect(() => {
    if (localStorage.getItem('install-banner-dismissed') === '1') setDismissed(true);
  }, []);

  if (!ready || dismissed || installed) return null;
  if (!canInstall && !isIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-xl px-4 no-print">
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-lg animate-slide-up">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Sparkles size={18} />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold">نصب «کتابچه قانون» روی صفحه اصلی</p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
            {canInstall
              ? 'نصب برای دسترسی آفلاین و اجرای تمام‌صفحه'
              : 'در سافاری: دکمه اشتراک‌گذاری ← «افزودن به صفحه اصلی»'}
          </p>
        </div>
        {canInstall ? (
          <button
            onClick={promptInstall}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground active:scale-95"
          >
            <span className="flex items-center gap-1">
              <Download size={14} /> نصب
            </span>
          </button>
        ) : null}
        <button
          aria-label="بستن"
          className="text-muted-foreground"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('install-banner-dismissed', '1');
          }}
        >
          <X size={16} />
        </button>
      </div>
      {!online ? <span className="sr-only">آفلاین</span> : null}
    </div>
  );
}

export function ArticleRowSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="skeleton h-3 w-24" />
      <div className="mt-3 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-11/12" />
        <div className="skeleton h-3 w-9/12" />
      </div>
    </div>
  );
}

export function AppLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- خروجی استاتیک با basePath؛ بهینه‌سازی تصویر لازم نیست
    <img
      src={withBase('/icons/icon-192.png')}
      alt="کتابچه حقوق"
      width={size === 'sm' ? 36 : 48}
      height={size === 'sm' ? 36 : 48}
      className={cn('shrink-0 rounded-xl shadow-card', size === 'sm' ? 'h-9 w-9' : 'h-12 w-12')}
    />
  );
}

export type { ArticleRow };
