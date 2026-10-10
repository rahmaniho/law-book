'use client';

import { withBase } from './base-path';

/**
 * همگام‌سازی داده‌های قوانین با نسخه منتشرشده.
 * - فهرست نسخه (version.json) کوچک است و با no-store خوانده می‌شود.
 * - هر قانون به بخش‌های ~۳۰۰ ماده‌ای شکسته شده و فقط بخش‌های تغییر‌یافته دانلود می‌شوند.
 * - همه داده‌ها در IndexedDB ذخیره می‌شود تا برنامه کاملاً آفلاین کار کند.
 */
import { db, META_KEYS, getMeta, setMeta, type ArticleRow, type LawRow } from './db';
import { rememberPointer } from './cases';
import type { Catalog, DataPointer, LawPointer, SyncProgress } from './types';

const POINTER_URL = '/data/version.json';

/**
 * مسیر داده‌ها با توجه به basePath برنامه.
 * مسیر از تنظیم مشترک basePath بیلد گرفته می‌شود؛
 * در اجرای محلی می‌توان با NEXT_PUBLIC_BASE_PATH آن را تغییر داد (مثلاً ریشه با مقدار خالی).
 */
function resolveDataPath(path: string) {
  return withBase(path.startsWith('/') ? path : `/${path}`);
}

export interface SyncOptions {
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: SyncProgress) => void;
}

export interface SyncResult {
  version: string;
  updatedLaws: number;
  totalArticles: number;
  ready: boolean;
  offline: boolean;
}

function progressReporter(pointer: DataPointer | null, onProgress?: (p: SyncProgress) => void) {
  const state: SyncProgress = {
    phase: 'checking',
    lawsDone: 0,
    lawsTotal: pointer?.laws.length ?? 0,
    articlesDone: 0,
    articlesTotal: pointer?.stats.articleCount ?? 0,
    bytesDone: 0,
    bytesTotal: pointer?.laws.reduce((s, l) => s + l.bytes, 0) ?? 0,
  };
  return {
    state,
    set(patch: Partial<SyncProgress>) {
      Object.assign(state, patch);
      onProgress?.({ ...state });
    },
  };
}

export async function fetchPointer(): Promise<DataPointer | null> {
  try {
    const res = await fetch(resolveDataPath(POINTER_URL), { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as DataPointer;
  } catch {
    return null;
  }
}

/** دانلود یک بخش از یک قانون با گزارش پیشرفت */
async function fetchPart(
  part: { path: string; bytes: number },
  onBytes: (n: number) => void,
  signal?: AbortSignal,
): Promise<ArticleRow[]> {
  const res = await fetch(resolveDataPath(part.path), { signal });
  if (!res.ok) throw new Error(`خطا در دریافت ${part.path}`);
  if (!res.body) {
    const json = (await res.json()) as { articles: ArticleRow[] };
    onBytes(part.bytes);
    return json.articles;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onBytes(value.byteLength);
    }
  }
  const blob = new Blob(chunks as BlobPart[]);
  const json = JSON.parse(await blob.text()) as { articles: ArticleRow[] };
  return json.articles;
}

export async function syncData(options: SyncOptions = {}): Promise<SyncResult> {
  const { force, onProgress, signal } = options;
  const rep = progressReporter(null, onProgress);
  const cachedVersion = await getMeta<string>(META_KEYS.dataVersion);

  const pointer = await fetchPointer();
  await rememberPointer(pointer);
  if (!pointer) {
    rep.set({ phase: 'error', message: 'فهرست نسخه در دسترس نیست (آفلاین؟)' });
    const laws = await db.laws.count();
    return { version: cachedVersion ?? '0.0.0', updatedLaws: 0, totalArticles: 0, ready: laws > 0, offline: true };
  }

  const reporter = progressReporter(pointer, onProgress);
  const isFresh = !force && cachedVersion === pointer.version;
  const storedCount = await db.laws.count();

  // فهرست قوانین (کاتالوگ) فقط با تغییر نسخه بازخوانی می‌شود
  let catalog = await getMeta<Catalog>(META_KEYS.catalog);
  if (!catalog || catalog.version !== pointer.version || force) {
    reporter.set({ phase: 'catalog' });
    const res = await fetch(resolveDataPath(pointer.catalogPath), { signal, cache: force ? 'no-store' : 'default' });
    if (!res.ok) throw new Error('دریافت فهرست قوانین ناموفق بود');
    catalog = (await res.json()) as Catalog;
    await setMeta(META_KEYS.catalog, catalog);
  }
  if (isFresh && storedCount === pointer.laws.length) {
    reporter.set({ phase: 'ready', lawsDone: storedCount, articlesDone: pointer.stats.articleCount, bytesDone: reporter.state.bytesTotal });
    await setMeta(META_KEYS.lastSync, Date.now());
    return { version: pointer.version, updatedLaws: 0, totalArticles: pointer.stats.articleCount, ready: true, offline: false };
  }

  let updatedLaws = 0;
  let articles = 0;
  let completed = true;

  for (const law of pointer.laws) {
    if (signal?.aborted) {
      completed = false;
      break;
    }
    const stored = await db.laws.get(law.id);
    if (!force && stored?.hash === law.hash) {
      articles += stored.articleCount;
      reporter.set({
        lawsDone: reporter.state.lawsDone + 1,
        articlesDone: reporter.state.articlesDone + law.count,
        bytesDone: Math.min(reporter.state.bytesTotal, reporter.state.bytesDone + law.bytes),
      });
      continue;
    }
    reporter.set({ phase: 'downloading', lawId: law.id, lawTitle: law.title });

    const collected: ArticleRow[] = [];
    let lawBytes = 0;
    for (const part of law.parts) {
      try {
        const rows = await fetchPart(part, (n) => {
          lawBytes += n;
          reporter.set({ bytesDone: Math.min(reporter.state.bytesTotal, reporter.state.bytesDone + n) });
        }, signal);
        collected.push(...rows);
      } catch (err) {
        if (signal?.aborted) break;
        reporter.set({ phase: 'error', message: `خطا در دریافت «${law.title}» — اتصال اینترنت را بررسی کنید.` });
        throw err;
      }
    }
    if (signal?.aborted) {
      completed = false;
      break;
    }

    await db.transaction('rw', db.articles, db.laws, async () => {
      await db.articles.where('lawId').equals(law.id).delete();
      await db.articles.bulkPut(collected);
      const row: LawRow = {
        id: law.id,
        title: law.title,
        shortTitle: law.title,
        category: law.category,
        hierarchy: law.hierarchy,
        articleCount: collected.length,
        hash: law.hash,
        downloadedAt: Date.now(),
      };
      await db.laws.put(row);
    });

    updatedLaws++;
    articles += collected.length;
    reporter.set({
      lawsDone: reporter.state.lawsDone + 1,
      articlesDone: reporter.state.articlesDone + collected.length,
    });
    // اجازه تنفس به رابط کاربری
    await new Promise((r) => setTimeout(r, 0));
  }

  if (!completed) {
    reporter.set({ phase: 'error', message: 'به‌روزرسانی لغو شد.' });
    return {
      version: cachedVersion ?? pointer.version,
      updatedLaws,
      totalArticles: articles,
      ready: storedCount + updatedLaws === pointer.laws.length,
      offline: false,
    };
  }

  await setMeta(META_KEYS.dataVersion, pointer.version);
  await setMeta(META_KEYS.lastSync, Date.now());
  reporter.set({ phase: 'ready', message: `نسخه ${pointer.version}` });

  return {
    version: pointer.version,
    updatedLaws,
    totalArticles: articles,
    ready: true,
    offline: false,
  };
}

/** بارگذاری ماده‌های یک قانون از پایگاه‌داده محلی */
export async function loadLawArticles(lawId: string): Promise<ArticleRow[]> {
  const rows = await db.articles.where('lawId').equals(lawId).toArray();
  return rows.sort(
    (a, b) => (a.numberValue ?? 0) - (b.numberValue ?? 0) || String(a.number).localeCompare(String(b.number), 'fa'),
  );
}

export async function loadArticle(articleId: string): Promise<ArticleRow | undefined> {
  return db.articles.get(articleId);
}

export async function localStats(): Promise<{ laws: number; articles: number; version: string | null }> {
  const [laws, articles, version] = await Promise.all([
    db.laws.count(),
    db.articles.count(),
    getMeta<string>(META_KEYS.dataVersion),
  ]);
  return { laws, articles, version };
}

export function pointerToLawMeta(pointer: LawPointer) {
  return {
    id: pointer.id,
    title: pointer.title,
    category: pointer.category,
    hierarchy: pointer.hierarchy,
    articleCount: pointer.count,
  };
}
