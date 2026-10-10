'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { db, getMeta, META_KEYS, setMeta, toggleBookmark } from './db';
import { DEFAULT_READER, useApp } from './store';
import type { Article, ReaderSettings } from './types';

/** وضعیت اتصال شبکه (برای نشانگر آفلاین) */
export function useOnlineStatus() {
  const online = useApp((s) => s.online);
  const setOnline = useApp((s) => s.setOnline);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [setOnline]);
  return online;
}

export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** لرزش کوتاه (حس نیتیو) روی دستگاه‌های پشتیبان */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* بی‌اثر */
    }
  }
}

/** کشیدن به پایین برای به‌روزرسانی */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 70) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      const el = containerRef.current;
      if (!el || el.scrollTop > 4) return;
      startY.current = e.touches[0].clientY;
    },
    [],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      setPull(Math.min(delta * 0.55, 110));
    },
    [],
  );

  const onTouchEnd = useCallback(async () => {
    if (pull > threshold && !refreshing) {
      setRefreshing(true);
      haptic(12);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
    setPull(0);
    startY.current = null;
  }, [onRefresh, pull, refreshing, threshold]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { containerRef, pull, refreshing };
}

/** تنظیمات خواندن — بارگذاری و ذخیره در IndexedDB */
export function useReaderSettings() {
  const reader = useApp((s) => s.reader);
  const updateReader = useApp((s) => s.updateReader);

  useEffect(() => {
    let mounted = true;
    getMeta<ReaderSettings>(META_KEYS.reader).then((saved) => {
      if (mounted && saved) updateReader(saved);
    });
    return () => {
      mounted = false;
    };
  }, [updateReader]);

  useEffect(() => {
    setMeta(META_KEYS.reader, reader).catch(() => undefined);
  }, [reader]);

  return reader;
}

/** نشان‌گذاری با به‌روزرسانی خوش‌بینانه */
export function useBookmark(article: Article) {
  const ids = useApp((s) => s.bookmarkedIds);
  const setIds = useApp((s) => s.setBookmarkedIds);
  const bookmarked = ids.has(article.id);

  const toggle = useCallback(async () => {
    const now = await toggleBookmark(article);
    haptic(now ? [10, 30, 10] : 10);
    const fresh = new Set(useApp.getState().bookmarkedIds);
    if (now) fresh.add(article.id);
    else fresh.delete(article.id);
    setIds([...fresh]);
    return now;
  }, [article, setIds]);

  return { bookmarked, toggle };
}

/** شمارنده‌های محلی (نشان‌شده‌ها/یادداشت‌ها) */
export function useLocalCounts() {
  const [counts, setCounts] = useState({ bookmarks: 0, notes: 0, history: 0 });
  const refresh = useCallback(async () => {
    const [bookmarks, notes, history] = await Promise.all([
      db.bookmarks.count(),
      db.notes.count(),
      db.history.count(),
    ]);
    setCounts({ bookmarks, notes, history });
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);
  return { ...counts, refresh };
}

/** رخداد نصب PWA (beforeinstallprompt) */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return null;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    return choice.outcome;
  }, [event]);

  return { canInstall: Boolean(event), installed, promptInstall };
}

export function readerStyle(reader: ReaderSettings): React.CSSProperties {
  return {
    fontSize: `${reader.fontSize}px`,
    lineHeight: reader.lineHeight,
    textAlign: reader.justify ? 'justify' : 'right',
    fontFamily: reader.fontFamily === 'serif' ? 'var(--font-serif-fa)' : undefined,
  };
}

export { DEFAULT_READER };
