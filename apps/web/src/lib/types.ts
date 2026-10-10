/** انواع مشترک «کتابچه قانون» — هم‌راستا با اسکریپت ساخت داده (scripts/lib/parse.mjs) */

export type HierarchyId =
  | 'fiqh'
  | 'constitution'
  | 'statute'
  | 'regulation'
  | 'council'
  | 'precedent'
  | 'advisory'
  | 'treaty';

export type ArticleStatus = 'لازم‌الاجرا' | 'اصلاحی' | 'منسوخ';

export interface Category {
  id: string;
  title: string;
  icon: string;
  color: string;
  order: number;
  description: string;
}

export interface HierarchyLevel {
  id: HierarchyId;
  title: string;
  order: number;
  color: string;
  description: string;
}

export interface Amendment {
  kind: string;
  date: string;
}

export interface Article {
  id: string;
  lawId: string;
  number: number | string;
  numberFa: string;
  numberValue: number | null;
  mokarrar: boolean;
  path: string[];
  chapter: string;
  text: string;
  notes: string[];
  amendments: Amendment[];
  status: ArticleStatus;
  keywords: string[];
  lawTitle: string;
  category: string;
  hierarchy: HierarchyId;
  /** در صورت تکمیل از منبع پشتیبان */
  filledFrom?: string;
}

export interface LawChapter {
  title: string;
  from: string;
  to: string;
  count: number;
}

export interface LawMeta {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  hierarchy: HierarchyId;
  documentType: string;
  approvalDate: string;
  approvalSort: number;
  status: ArticleStatus;
  summary: string;
  keywords: string[];
  checklist: string[];
  source: { kind: string; file?: string; name?: string; url?: string };
  note: string;
  articleRange: string;
  updatedAt: string;
  articleCount: number;
  chapters: LawChapter[];
  gaps: { count: number; items: number[] };
  movedTo?: { movedTo: Record<string, number[][]>; note: string } | null;
  filledFrom?: { label: string; numbers: number[] };
  range: { from: number; to: number };
  hash: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'included' | 'pending';
  laws: string[];
  note?: string;
}

/** یک رأی قضایی (مجموعهٔ اختیاری آراء) */
export interface Verdict {
  id: string;
  title: string;
  number: string;
  date: string;
  dateSort: number;
  type: string;
  /** طول متن کامل در منبع (برای آگاهی از برش‌خوردگی) */
  chars: number;
  truncated: boolean;
  text: string;
  /** متن نرمال‌شده برای جست‌وجو (در زمان ساخت تولید می‌شود) */
  norm: string;
}

/** مدخل فهرست آراء (بدون متن کامل) */
export interface VerdictIndexEntry {
  id: string;
  title: string;
  number: string;
  date: string;
  dateSort: number;
  type: string;
  chars: number;
  truncated: boolean;
  norm: string;
}

export interface CasesPointer {
  version: string;
  source: string;
  count: number;
  bytes: number;
  indexPath: string;
  indexBytes: number;
  parts: LawPointerPart[];
  types: string[];
}

export interface CreditPerson {
  name: string;
  role: string;
  short: string;
  url?: string;
}

export interface Catalog {
  version: string;
  appVersion: string;
  releasedAt: string;
  releasedAtFa: string;
  appName: string;
  shortName: string;
  credits: { legal: CreditPerson; developer: CreditPerson };
  disclaimer: string;
  privacy: string;
  officialSources: { title: string; url: string; note: string }[];
  hierarchyNote: string;
  dataSources: { name: string; license: string; url: string; note: string }[];
  categories: Category[];
  hierarchy: HierarchyLevel[];
  checklist: ChecklistItem[];
  laws: LawMeta[];
  stats: {
    lawCount: number;
    articleCount: number;
    categoryCount: number;
    fullTextCount: number;
  };
}

export interface LawPointerPart {
  path: string;
  bytes: number;
  count: number;
}

export interface LawPointer {
  id: string;
  hash: string;
  bytes: number;
  count: number;
  title: string;
  category: string;
  hierarchy: HierarchyId;
  parts: LawPointerPart[];
}

export interface DataPointer {
  version: string;
  releasedAt: string;
  catalogPath: string;
  laws: LawPointer[];
  stats: { lawCount: number; articleCount: number };
  /** مجموعهٔ اختیاری آراء قضایی — فقط در صورت ساخت داده وجود دارد */
  cases?: CasesPointer;
}

export interface Bookmark {
  articleId: string;
  lawId: string;
  createdAt: number;
  articleNumberFa: string;
  lawTitle: string;
  excerpt: string;
}

export interface Note {
  articleId: string;
  lawId: string;
  text: string;
  updatedAt: number;
}

export interface SearchHistoryItem {
  id?: number;
  q: string;
  createdAt: number;
}

export interface SyncProgress {
  phase: 'idle' | 'checking' | 'catalog' | 'downloading' | 'indexing' | 'ready' | 'error';
  lawId?: string;
  lawTitle?: string;
  lawsDone: number;
  lawsTotal: number;
  articlesDone: number;
  articlesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  message?: string;
}

export interface ReaderSettings {
  fontSize: number; // px
  lineHeight: number;
  fontFamily: 'sans' | 'serif';
  justify: boolean;
  showKeywords: boolean;
}

export type SortMode = 'relevance' | 'law' | 'number' | 'newest';
