/// <reference lib="webworker" />
/**
 * کارگر جست‌وجو (Web Worker)
 * ایندکس MiniSearch با نرمال‌سازی فارسی ساخته می‌شود و پرس‌وجوها در همین رشته اجرا می‌شوند
 * تا رابط کاربری هنگام جست‌وجو در ۶٬۰۰۰+ ماده هرگز قفل نشود.
 */
import MiniSearch from 'minisearch';
import { normalizeForSearch, parseQuery, tokenize } from '../lib/fa';
import type { ArticleRow } from '../lib/db';

/** امتیازِ تطابق ساختاری «ماده X قانون Y» — باید از هر امتیاز متنی بزرگ‌تر باشد */
const STRUCTURAL_SCORE = 100_000;

export interface WorkerArticle extends ArticleRow {}

interface InitMessage {
  type: 'init';
  articles: WorkerArticle[];
  cachedIndex?: string | null;
}
interface QueryMessage {
  type: 'query';
  id: number;
  q: string;
  filters?: {
    category?: string | null;
    lawId?: string | null;
    hierarchy?: string | null;
    status?: string | null;
    bookmarkedIds?: string[] | null;
  };
  limit?: number;
}

type InMessage = InitMessage | QueryMessage;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let mini: MiniSearch<WorkerArticle> | null = null;
const byId = new Map<string, WorkerArticle>();

function createIndex(): MiniSearch<WorkerArticle> {
  return new MiniSearch<WorkerArticle>({
    idField: 'id',
    fields: ['textNorm', 'titleNorm', 'keywordNorm'] as never[],
    storeFields: ['id'] as never[],
    tokenize: (text: string) => tokenize(text),
    processTerm: (term: string) => (term.length > 1 ? term : null),
    searchOptions: {
      boost: { titleNorm: 2.2, keywordNorm: 1.6, textNorm: 1 },
      fuzzy: 0.2,
      prefix: true,
      combineWith: 'AND',
    },
  });
}

function addAll(articles: WorkerArticle[]) {
  const docs = articles.map((a) => {
    byId.set(a.id, a);
    return {
      ...a,
      textNorm: normalizeForSearch(a.text),
      titleNorm: normalizeForSearch(`${a.lawTitle} ${a.numberFa} ${a.chapter ?? ''}`),
      keywordNorm: normalizeForSearch((a.keywords || []).join(' ')),
    };
  });
  mini!.addAll(docs as never[]);
}

function scoreResult(a: WorkerArticle, q: string, base: number) {
  const parsed = parseQuery(q);
  let score = base;
  if (parsed.article !== null && a.numberValue === parsed.article) score += 30;
  const lawHint = normalizeForSearch(parsed.lawHint);
  if (lawHint.length > 2) {
    const title = normalizeForSearch(`${a.lawTitle} ${a.lawId}`);
    if (title.includes(lawHint)) score += 12;
  }
  return score;
}

ctx.addEventListener('message', (event: MessageEvent<InMessage>) => {
  const msg = event.data;

  if (msg.type === 'init') {
    mini = createIndex();
    addAll(msg.articles);
    ctx.postMessage({ type: 'ready', count: byId.size, index: mini.toJSON() });
    return;
  }

  if (msg.type === 'query' && mini) {
    const { q, filters, limit = 40, id } = msg;
    const parsed = parseQuery(q);
    const started = performance.now();

    const rawQuery = normalizeForSearch(q);
    let hits: { id: string; score: number }[] = [];

    // ۱) تطابق مستقیم «ماده X قانون Y» و «ماده X»
    // تطابق ساختاری «ماده X قانون Y» — نگهبانِ lawHint جلوی نتیجهٔ نادرست را می‌گیرد
    if (parsed.article !== null) {
      const lawHint = normalizeForSearch(parsed.lawHint);
      for (const a of byId.values()) {
        if (a.numberValue !== parsed.article) continue;
        if (parsed.mokarrar && !a.mokarrar) continue;
        if (lawHint.length > 2) {
          const title = normalizeForSearch(`${a.lawTitle} ${a.lawId}`);
          if (!title.includes(lawHint)) continue;
        }
        // امتیازِ غالب: وقتی کارور صریحاً «ماده X قانون Y» جست‌وجو کرده، آن ماده باید اول باشد.
        // در تساوی، عنوانِ کوتاه‌تر (تطبیقِ نزدیک‌تر با نام قانون) مقدم است.
        const title = normalizeForSearch(`${a.lawTitle} ${a.lawId}`);
        hits.push({ id: a.id, score: STRUCTURAL_SCORE + Math.max(0, 200 - title.length) + (a.mokarrar ? 1 : 0) });
        if (hits.length > 120) break;
      }
    }

    // ۲) جست‌وجوی متنی با MiniSearch
    if (rawQuery.length > 1) {
      let found = (mini.search(rawQuery, { combineWith: 'AND' }) as unknown as { id: string; score: number }[]).slice(0, 200);
      if (!found.length) {
        found = (mini.search(rawQuery, { combineWith: 'OR' }) as unknown as { id: string; score: number }[]).slice(0, 200);
      }
      for (const f of found) {
        const a = byId.get(f.id);
        if (!a) continue;
        hits.push({ id: f.id, score: scoreResult(a, q, f.score) });
      }
    }

    // حذف تکراری‌ها، اعمال فیلترها
    const seen = new Set<string>();
    let results = [];
    for (const h of hits.sort((x, y) => y.score - x.score)) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const a = byId.get(h.id);
      if (!a) continue;
      if (filters?.category && a.category !== filters.category) continue;
      if (filters?.lawId && a.lawId !== filters.lawId) continue;
      if (filters?.hierarchy && a.hierarchy !== filters.hierarchy) continue;
      if (filters?.status && a.status !== filters.status) continue;
      if (filters?.bookmarkedIds && !filters.bookmarkedIds.includes(a.id)) continue;
      results.push({ article: a, score: h.score });
      if (results.length >= limit) break;
    }

    ctx.postMessage({
      type: 'results',
      id,
      elapsed: performance.now() - started,
      results,
      total: results.length,
    });
  }
});

export {};
