'use client';

import { create } from 'zustand';
import type { Catalog, DataPointer, ReaderSettings, SyncProgress } from './types';

export const DEFAULT_READER: ReaderSettings = {
  fontSize: 17,
  lineHeight: 1.9,
  fontFamily: 'sans',
  justify: true,
  showKeywords: false,
};

interface AppState {
  /* داده */
  catalog: Catalog | null;
  pointer: DataPointer | null;
  dataVersion: string | null;
  progress: SyncProgress;
  ready: boolean;
  online: boolean;
  searching: boolean;
  searchElapsed: number;
  bookmarkedIds: Set<string>;

  /* تنظیمات خواندن */
  reader: ReaderSettings;

  /* اکشن‌ها */
  setCatalog: (c: Catalog | null) => void;
  setDataVersion: (v: string | null) => void;
  setPointer: (p: DataPointer | null) => void;
  setProgress: (p: Partial<SyncProgress>) => void;
  setReady: (v: boolean) => void;
  setOnline: (v: boolean) => void;
  setSearching: (v: boolean, elapsed?: number) => void;
  setBookmarkedIds: (ids: string[]) => void;
  updateReader: (patch: Partial<ReaderSettings>) => void;
  resetReader: () => void;
}

export const useApp = create<AppState>((set) => ({
  catalog: null,
  pointer: null,
  dataVersion: null,
  progress: {
    phase: 'idle',
    lawsDone: 0,
    lawsTotal: 0,
    articlesDone: 0,
    articlesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
  },
  ready: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  searching: false,
  searchElapsed: 0,
  bookmarkedIds: new Set<string>(),
  reader: DEFAULT_READER,

  setCatalog: (catalog) => set({ catalog }),
  setDataVersion: (dataVersion) => set({ dataVersion }),
  setPointer: (pointer) => set({ pointer }),
  setProgress: (patch) => set((s) => ({ progress: { ...s.progress, ...patch } })),
  setReady: (ready) => set({ ready }),
  setOnline: (online) => set({ online }),
  setSearching: (searching, elapsed = 0) => set({ searching, searchElapsed: elapsed }),
  setBookmarkedIds: (ids) => set({ bookmarkedIds: new Set(ids) }),
  updateReader: (patch) => set((s) => ({ reader: { ...s.reader, ...patch } })),
  resetReader: () => set({ reader: DEFAULT_READER }),
}));
