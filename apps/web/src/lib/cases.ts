'use client';

import { withBase } from './base-path';

/**
 * مجموعهٔ اختیاری «آراء قضایی».
 *
 * این مجموعه در همگام‌سازی پیش‌فرض دانلود نمی‌شود؛ کاربر آن را از صفحهٔ تنظیمات
 * فعال می‌کند تا حجم نصب اولیهٔ برنامه ثابت بماند. جست‌وجو روی فهرستِ
 * ازپیش‌نرمال‌شده انجام می‌شود (بدون ایندکس‌سازی سنگین) تا روی موبایل روان باشد.
 */
import { db, clearCases, getMeta, setMeta } from './db';
import type { CasesPointer, Verdict, VerdictIndexEntry } from './types';

const CASES_ENABLED = 'casesEnabled';
const CASES_VERSION = 'casesVersion';

export interface CasesStatus {
  /** آیا در این نسخه از داده‌ها مجموعه‌ای وجود دارد؟ */
  available: boolean;
  /** آیا کاربر آن را فعال کرده است؟ */
  enabled: boolean;
  /** آیا روی این دستگاه دانلود شده است؟ */
  downloaded: boolean;
  count: number;
  bytes: number;
  types: string[];
  version: string | null;
}

async function readPointer(): Promise<CasesPointer | null> {
  const pointer = await getMeta<{ cases?: CasesPointer }>('pointer');
  return pointer?.cases ?? null;
}

/** ثبت اشاره‌گر نسخه (در همگام‌سازی اصلی صدا زده می‌شود) */
export async function rememberPointer(pointer: { cases?: CasesPointer } | null): Promise<void> {
  await setMeta('pointer', pointer ? { cases: pointer.cases ?? null } : null);
}

export async function casesStatus(): Promise<CasesStatus> {
  const [pointer, enabled, downloadedVersion, count] = await Promise.all([
    readPointer(),
    getMeta<boolean>(CASES_ENABLED),
    getMeta<string>(CASES_VERSION),
    db.cases.count(),
  ]);
  return {
    available: Boolean(pointer),
    enabled: Boolean(enabled),
    downloaded: Boolean(pointer) && downloadedVersion === pointer?.version && count === pointer?.count,
    count,
    bytes: pointer?.bytes ?? 0,
    types: pointer?.types ?? [],
    version: downloadedVersion ?? null,
  };
}

export interface CasesProgress {
  phase: 'idle' | 'index' | 'downloading' | 'ready' | 'error';
  done: number;
  total: number;
  message?: string;
}

/**
 * دریافت مجموعهٔ آراء. فقط یک بار انجام می‌شود؛ تا زمانی که نسخهٔ داده
 * تغییر نکند، دوباره دانلود نمی‌شود.
 */
export async function downloadCases(
  onProgress?: (p: CasesProgress) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const pointer = await readPointer();
  if (!pointer) {
    onProgress?.({ phase: 'error', done: 0, total: 0, message: 'این نسخه شامل مجموعهٔ آراء نیست.' });
    return false;
  }
  const state: CasesProgress = { phase: 'idle', done: 0, total: pointer.parts.length + 1 };
  const report = (patch: Partial<CasesProgress>) => {
    Object.assign(state, patch);
    onProgress?.({ ...state });
  };

  try {
    report({ phase: 'index' });
    const res = await fetch(resolve(pointer.indexPath), { signal });
    if (!res.ok) throw new Error('دریافت فهرست آراء ناموفق بود');
    const indexPayload = (await res.json()) as { index: VerdictIndexEntry[] };
    await db.caseIndex.bulkPut(indexPayload.index ?? []);
    report({ done: state.done + 1 });

    report({ phase: 'downloading' });
    for (const part of pointer.parts) {
      if (signal?.aborted) throw new Error('لغو شد');
      const partRes = await fetch(resolve(part.path), { signal });
      if (!partRes.ok) throw new Error(`دریافت ${part.path} ناموفق بود`);
      const body = (await partRes.json()) as { items: Verdict[] };
      await db.cases.bulkPut(body.items ?? []);
      report({ done: state.done + 1 });
      // اجازه تنفس به رابط کاربری
      await new Promise((r) => setTimeout(r, 0));
    }

    await setMeta(CASES_ENABLED, true);
    await setMeta(CASES_VERSION, pointer.version);
    report({ phase: 'ready' });
    return true;
  } catch (err) {
    report({
      phase: 'error',
      message: err instanceof Error ? err.message : 'خطای ناشناخته در دریافت آراء',
    });
    return false;
  }
}

/** غیرفعال‌سازی و حذف کامل مجموعه از روی دستگاه */
export async function disableCases(): Promise<void> {
  await clearCases();
  await setMeta(CASES_ENABLED, false);
  await setMeta(CASES_VERSION, null);
}

/* ------------------------------ جست‌وجو ------------------------------ */

let indexCache: { version: string | null; rows: VerdictIndexEntry[] } | null = null;

async function loadIndex(): Promise<VerdictIndexEntry[]> {
  const version = await getMeta<string>(CASES_VERSION);
  if (indexCache && indexCache.version === version) return indexCache.rows;
  const rows = await db.caseIndex.toArray();
  indexCache = { version: version ?? null, rows };
  return rows;
}

/** پاک‌سازی حافظهٔ نهان جست‌وجو (پس از فعال/غیرفعال‌سازی) */
export function resetCasesCache(): void {
  indexCache = null;
}

export interface CaseSearchOptions {
  type?: string | null;
  limit?: number;
}

/**
 * جست‌وجوی سبک روی فهرست آراء: متن از پیش نرمال‌شده است، بنابراین
 * فقط یک پیمایش ساده انجام می‌شود و نیازی به ایندکس‌سازی نیست.
 */
export async function searchCases(query: string, options: CaseSearchOptions = {}) {
  const { type = null, limit = 400 } = options;
  const rows = await loadIndex();
  const q = normalize(query.trim());
  const out: VerdictIndexEntry[] = [];
  for (const row of rows) {
    if (type && row.type !== type) continue;
    if (q && !row.norm.includes(q)) continue;
    out.push(row);
    if (out.length >= limit) break;
  }
  out.sort((a, b) => b.dateSort - a.dateSort || a.title.localeCompare(b.title, 'fa'));
  return out;
}

export async function getVerdict(id: string): Promise<Verdict | undefined> {
  return db.cases.get(id);
}

function normalize(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670\u0640\u0654\u0655\u06D6-\u06ED]/g, '')
    .replace(/[\u0622\u0623\u0625\u0627]/g, 'ا')
    .replace(/\u0649/g, 'ی')
    .replace(/\u064A/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/\u0629/g, 'ه')
    .replace(/[\u200b-\u200f\u202a-\u202e\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolve(p: string) {
  return withBase(p.startsWith('/') ? p : `/${p}`);
}
