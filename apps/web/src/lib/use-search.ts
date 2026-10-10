'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db } from './db';
import type { ArticleRow } from './db';
import { initSearchEngine, runSearch, type SearchFilters, type SearchResultItem } from './search-client';
import { useDebounced } from './hooks';
import { useApp } from './store';

let enginePreparedFor: string | null = null;

/** آماده‌سازی موتور جست‌وجو پس از آماده‌شدن داده‌ها */
export function useSearchEngine() {
  const ready = useApp((s) => s.ready);
  const dataVersion = useApp((s) => s.dataVersion);
  const [indexing, setIndexing] = useState(false);
  const [ready2, setReady2] = useState(Boolean(enginePreparedFor));
  const articlesRef = useRef<ArticleRow[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (enginePreparedFor && enginePreparedFor === dataVersion) {
      setReady2(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setIndexing(true);
      const articles = await db.articles.toArray();
      articlesRef.current = articles;
      await initSearchEngine(articles);
      if (!cancelled) {
        enginePreparedFor = dataVersion;
        setIndexing(false);
        setReady2(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, dataVersion]);

  return { ready: ready2, indexing };
}

export interface UseSearchOptions {
  filters?: SearchFilters;
  limit?: number;
  debounce?: number;
  autoRun?: boolean;
}

export function useSearch(query: string, options: UseSearchOptions = {}) {
  const { filters, limit = 40, debounce = 200, autoRun = true } = options;
  const debounced = useDebounced(query, debounce);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engine = useSearchEngine();
  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  const run = useCallback(
    async (q: string, signal?: { cancelled: boolean }) => {
      if (!q.trim()) {
        setResults([]);
        setElapsed(0);
        return;
      }
      setLoading(true);
      try {
        const articles = await db.articles.toArray();
        const res = await runSearch(articles, q, filters, limit);
        if (signal?.cancelled) return;
        setResults(res.results);
        setElapsed(res.elapsed);
        useApp.getState().setSearching(false, res.elapsed);
      } catch (err) {
        if (!signal?.cancelled) setError((err as Error).message);
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey, limit],
  );

  useEffect(() => {
    if (!autoRun) return;
    const signal = { cancelled: false };
    run(debounced, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [debounced, run, autoRun]);

  return { results, elapsed, loading, error, engineReady: engine.ready, indexing: engine.indexing, run };
}
