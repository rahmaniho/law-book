'use client';

/**
 * پایگاه‌داده محلی (IndexedDB با Dexie).
 * همه‌چیز محلی است: یادداشت‌ها، نشان‌گذاری‌ها و تاریخچه هیچ‌گاه به سرور فرستاده نمی‌شود.
 */
import Dexie, { type Table } from 'dexie';
import type { Article, Bookmark, Catalog, Note, SearchHistoryItem, Verdict, VerdictIndexEntry } from './types';

export interface ArticleRow extends Article {
  /** متن نرمال‌شده برای جست‌وجو (در زمان ایندکس‌گذاری استفاده می‌شود) */
  norm?: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class GhanounDatabase extends Dexie {
  laws!: Table<LawRow, string>;
  articles!: Table<ArticleRow, string>;
  bookmarks!: Table<Bookmark, string>;
  notes!: Table<Note, string>;
  history!: Table<SearchHistoryItem, number>;
  meta!: Table<MetaRow, string>;
  /** مجموعهٔ اختیاری آراء قضایی */
  cases!: Table<Verdict, string>;
  caseIndex!: Table<VerdictIndexEntry, string>;

  constructor() {
    super('GhanounDB');
    this.version(1).stores({
      laws: 'id, category, hierarchy, approvalSort',
      articles: 'id, lawId, numberValue, category, hierarchy, status, *keywords',
      bookmarks: 'articleId, lawId, createdAt',
      notes: 'articleId, lawId, updatedAt',
      history: '++id, q, createdAt',
      meta: 'key',
    });
    // نسخهٔ ۲: افزودن جداول مجموعهٔ اختیاری آراء قضایی
    this.version(2).stores({
      cases: 'id, type, dateSort',
      caseIndex: 'id, type, dateSort',
    });
  }
}

export interface LawRow {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  hierarchy: string;
  articleCount: number;
  hash: string;
  downloadedAt: number;
}

export const db = new GhanounDatabase();

/* ------------------------------ کلیدواژه‌های متادیتا ------------------------------ */
export const META_KEYS = {
  catalog: 'catalog',
  dataVersion: 'dataVersion',
  searchIndex: 'searchIndex',
  reader: 'readerSettings',
  theme: 'themePreference',
  lastSync: 'lastSyncAt',
  pointer: 'pointer',
} as const;

export async function getMeta<T>(key: string): Promise<T | null> {
  const row = await db.meta.get(key);
  return (row?.value as T) ?? null;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getCatalog(): Promise<Catalog | null> {
  return getMeta<Catalog>(META_KEYS.catalog);
}

export async function lawHash(id: string): Promise<string | null> {
  const law = await db.laws.get(id);
  return law?.hash ?? null;
}

/* ------------------------------ نشان‌گذاری‌ها و یادداشت‌ها ------------------------------ */
export async function toggleBookmark(article: Article): Promise<boolean> {
  const existing = await db.bookmarks.get(article.id);
  if (existing) {
    await db.bookmarks.delete(article.id);
    return false;
  }
  await db.bookmarks.put({
    articleId: article.id,
    lawId: article.lawId,
    articleNumberFa: article.numberFa,
    lawTitle: article.lawTitle,
    excerpt: article.text.slice(0, 220),
    createdAt: Date.now(),
  });
  return true;
}

export async function isBookmarked(articleId: string): Promise<boolean> {
  return Boolean(await db.bookmarks.get(articleId));
}

export async function saveNote(articleId: string, lawId: string, text: string): Promise<void> {
  if (!text.trim()) {
    await db.notes.delete(articleId);
    return;
  }
  await db.notes.put({ articleId, lawId, text: text.trim(), updatedAt: Date.now() });
}

export async function addHistory(q: string): Promise<void> {
  const query = q.trim();
  if (query.length < 2) return;
  const last = await db.history.orderBy('createdAt').last();
  if (last?.q === query) return;
  await db.history.add({ q: query, createdAt: Date.now() });
  const count = await db.history.count();
  if (count > 60) {
    const oldest = await db.history.orderBy('createdAt').limit(count - 50).toArray();
    await db.history.bulkDelete(oldest.map((h) => h.id!).filter(Boolean));
  }
}

export async function clearHistory(): Promise<void> {
  await db.history.clear();
}

export async function clearLocalData(): Promise<void> {
  await db.bookmarks.clear();
  await db.notes.clear();
  await db.history.clear();
}

/* ------------------------------ آراء قضایی ------------------------------ */
export async function countCases(): Promise<number> {
  return db.cases.count();
}

export async function clearCases(): Promise<void> {
  await db.cases.clear();
  await db.caseIndex.clear();
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}
