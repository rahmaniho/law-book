'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Filter, Search } from 'lucide-react';
import { useApp } from '@/lib/store';
import { LawRowCard, SectionHeading } from '@/components/bits';
import { Button, EmptyState, Input, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { normalizeForSearch } from '@/lib/fa';
import { formatNumberFa } from '@/lib/format';

/** تعداد نمایش در هر بار (برای روان‌ماندن فهرست‌های طولانی) */
const PAGE = 40;

type Availability = 'all' | 'full';

const AVAILABILITY_FILTERS: { id: Availability; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'full', label: 'دارای متن' },
];

export default function LawsPage() {
  return (
    <Suspense fallback={<LawsSkeleton />}>
      <LawsInner />
    </Suspense>
  );
}

function LawsSkeleton() {
  return (
    <div className="app-container space-y-3 py-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function LawsInner() {
  const catalog = useApp((s) => s.catalog);
  const params = useSearchParams();
  const initialCategory = params.get('category');
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [availability, setAvailability] = useState<Availability>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const laws = useMemo(() => {
    if (!catalog) return [];
    const q = normalizeForSearch(query);
    return catalog.laws
      .filter((l) => (category ? l.category === category : true))
      .filter((l) => {
        if (availability === 'full') return l.articleCount > 0;
        return true;
      })
      .filter((l) =>
        q ? normalizeForSearch(`${l.title} ${l.shortTitle} ${(l.keywords ?? []).join(' ')}`).includes(q) : true,
      )
      .sort((a, b) => (b.approvalSort ?? 0) - (a.approvalSort ?? 0) || a.title.localeCompare(b.title, 'fa'));
  }, [catalog, category, availability, query]);

  // با تغییر فیلترها، شمار نمایش از نو شروع می‌شود
  useEffect(() => {
    setLimit(PAGE);
  }, [category, availability, query]);

  if (!catalog) {
    return <LawsSkeleton />;
  }

  const visible = laws.slice(0, limit);

  return (
    <div className="app-container pb-8">
      <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
            <Search size={16} className="text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="نام قانون…"
              className="h-6 border-0 p-0 text-sm focus-visible:ring-0"
              aria-label="جست‌وجو در عنوان قوانین"
            />
          </div>
          <span className="flex items-center gap-1 rounded-2xl border px-3 py-2 text-[11px] text-muted-foreground">
            <Filter size={14} /> {formatNumberFa(laws.length)}
          </span>
        </div>

        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {AVAILABILITY_FILTERS.map((f) => (
            <Chip key={f.id} active={availability === f.id} onClick={() => setAvailability(f.id)}>
              {f.label}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-border" />
          <Chip active={!category} onClick={() => setCategory(null)}>
            همه موضوعات
          </Chip>
          {catalog.categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.title}
            </Chip>
          ))}
        </div>
      </div>

      {laws.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="قانونی یافت نشد" description="عبارت دیگری را امتحان کنید." />
      ) : (
        <>
          <SectionHeading
            title={`${formatNumberFa(laws.length)} سند حقوقی`}
            subtitle="مرتب‌شده بر اساس تاریخ تصویب"
          />
          <div className="space-y-2">
            {visible.map((law) => (
              <LawRowCard key={law.id} law={law} />
            ))}
          </div>
          {limit < laws.length ? (
            <Button variant="outline" className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE)}>
              نمایش بیشتر ({formatNumberFa(Math.min(PAGE, laws.length - limit))} مورد دیگر)
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] transition-colors',
        active ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
