'use client';

/**
 * مجموعهٔ اختیاری «آراء قضایی»: جست‌وجو و مطالعهٔ رویهٔ قضایی.
 * این مجموعه به‌طور پیش‌فرض روی دستگاه نیست و فقط با انتخاب کاربر دریافت می‌شود.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Download, Gavel, Loader2, Search, Trash2, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { SectionHeading } from '@/components/bits';
import { Badge, Button, Card, EmptyState, Input, Sheet, Skeleton } from '@/components/ui/primitives';
import { casesStatus, downloadCases, disableCases, resetCasesCache, searchCases, getVerdict, type CasesStatus } from '@/lib/cases';
import type { Verdict, VerdictIndexEntry } from '@/lib/types';
import { formatBytes, formatNumberFa } from '@/lib/format';
import { toFaDigits } from '@/lib/fa';
import { cn } from '@/lib/utils';

const PAGE = 25;

export default function CasesPage() {
  const catalog = useApp((s) => s.catalog);
  const [status, setStatus] = useState<CasesStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [rows, setRows] = useState<VerdictIndexEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Verdict | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await casesStatus());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, catalog?.version]);

  const runSearch = useCallback(async () => {
    if (!status?.enabled) return;
    setSearching(true);
    try {
      const result = await searchCases(query, { type, limit: 600 });
      setRows(result);
      setLimit(PAGE);
    } finally {
      setSearching(false);
    }
  }, [query, type, status?.enabled]);

  useEffect(() => {
    const t = setTimeout(runSearch, 180);
    return () => clearTimeout(t);
  }, [runSearch]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    resetCasesCache();
    const ok = await downloadCases((p) => {
      setPhase(p.phase === 'index' ? 'دریافت فهرست آراء…' : `دریافت آراء… ${toFaDigits(p.done)} از ${toFaDigits(p.total)}`);
    });
    setBusy(false);
    setPhase('');
    if (!ok) setMessage('دریافت آراء انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
    await refresh();
  };

  const disable = async () => {
    setBusy(true);
    resetCasesCache();
    await disableCases();
    setRows([]);
    setBusy(false);
    await refresh();
  };

  if (!status) {
    return (
      <div className="app-container space-y-3 py-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!status.available && !catalog) {
    return (
      <div className="app-container pb-8">
        <Card className="mt-3 p-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Gavel size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-bold leading-6">آراء قضایی</h1>
              <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
                برای نمایش این بخش، ابتدا باید داده‌های برنامه یک بار همگام‌سازی شوند. از صفحهٔ اصلی یا تنظیمات،
                همگام‌سازی را انجام دهید.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-container pb-8">
      <Card className="mt-3 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Gavel size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-6">آراء قضایی</h1>
            <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">
              {status.available
                ? `مجموعهٔ ${formatNumberFa(status.count)} رأی (حقوقی، کیفری و اداری) برای مطالعهٔ رویهٔ قضایی — دریافتِ اختیاری`
                : 'این نسخه از داده‌ها شامل مجموعهٔ آراء نیست.'}
            </p>
          </div>
        </div>

        {status.available ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
            <Badge tone={status.downloaded ? 'success' : 'muted'}>
              {status.downloaded ? 'روی دستگاه' : 'دریافت‌نشده'}
            </Badge>
            <span className="flex items-center gap-1">
              <Database size={12} /> {formatBytes(status.bytes)}
            </span>
            {status.types.length ? <span>انواع: {status.types.join('، ')}</span> : null}
          </div>
        ) : null}

        {status.available ? (
          <div className="mt-3 flex gap-2">
            {status.downloaded ? (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={disable} disabled={busy}>
                <Trash2 size={14} /> حذف از دستگاه
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={enable} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {busy ? 'در حال دریافت…' : 'فعال‌سازی و دریافت'}
              </Button>
            )}
          </div>
        ) : null}

        {busy && phase ? <p className="mt-2 text-[11px] text-primary">{phase}</p> : null}
        {message ? <p className="mt-2 text-[11px] text-destructive">{message}</p> : null}
      </Card>

      {status.available && !status.downloaded ? (
        <div className="mt-4">
          <EmptyState
            icon={<Gavel size={22} />}
            title="مجموعهٔ آراء روی دستگاه نیست"
            description="برای جست‌وجو در آراء، ابتدا آن را یک بار دریافت کنید. این مجموعه جدا از متن قوانین است و حجم نصب اولیه را تغییر نمی‌دهد."
          />
        </div>
      ) : null}

      {status.available && status.downloaded ? (
        <>
          <div className="sticky top-[var(--topbar-h)] z-20 -mx-4 mt-3 bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
                <Search size={16} className="text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="موضوع رأی، شماره، کلیدواژه…"
                  className="h-6 border-0 p-0 text-sm focus-visible:ring-0"
                  aria-label="جست‌وجو در آراء"
                />
                {query ? (
                  <button type="button" aria-label="پاک کردن" onClick={() => setQuery('')} className="text-muted-foreground">
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <span className="rounded-2xl border px-3 py-2 text-[11px] text-muted-foreground">
                {formatNumberFa(rows.length)}
              </span>
            </div>

            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              <Chip active={!type} onClick={() => setType(null)}>
                همه
              </Chip>
              {status.types.map((t) => (
                <Chip key={t} active={type === t} onClick={() => setType(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          {searching && !rows.length ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : null}

          {!searching && rows.length === 0 ? (
            <EmptyState
              icon={<Search size={20} />}
              title="رأیی یافت نشد"
              description="عبارت دیگری را امتحان کنید یا فیلتر نوع را تغییر دهید."
            />
          ) : null}

          {rows.length ? (
            <>
              <SectionHeading title={`${formatNumberFa(rows.length)} رأی`} subtitle="مرتب‌شده بر اساس تاریخ" />
              <Card className="divide-y">
                {rows.slice(0, limit).map((row) => (
                  <button
                    key={row.id}
                    onClick={async () => setOpen((await getVerdict(row.id)) ?? null)}
                    className="block w-full p-3.5 text-right active:bg-accent/40"
                  >
                    <p className="text-[12.5px] font-medium leading-6">{row.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <Badge tone="outline">{row.type}</Badge>
                      {row.number ? <span>شماره {toFaDigits(row.number)}</span> : null}
                      {row.date ? <span>• {row.date}</span> : null}
                      {row.truncated ? <span>• متن برش‌خورده</span> : null}
                    </div>
                  </button>
                ))}
              </Card>
              {limit < rows.length ? (
                <Button variant="outline" className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE)}>
                  نمایش بیشتر ({formatNumberFa(Math.min(PAGE, rows.length - limit))} مورد دیگر)
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <p className="mt-5 text-center text-[10.5px] leading-5 text-muted-foreground">
        آراء قضایی صرفاً جنبهٔ مطالعاتی دارند و برای استناد باید با متن رسمی آراء مراجع قضایی تطبیق داده شوند.
      </p>

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.title}>
        {open ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <Badge tone="outline">{open.type}</Badge>
              {open.number ? <span>شماره {toFaDigits(open.number)}</span> : null}
              {open.date ? <span>• {open.date}</span> : null}
            </div>
            <div className="max-h-[62vh] overflow-y-auto whitespace-pre-wrap text-[13px] leading-8">
              {open.text}
            </div>
            {open.truncated ? (
              <p className="mt-3 rounded-xl bg-muted p-2.5 text-[10.5px] leading-5 text-muted-foreground">
                متن این رأی برای صرفه‌جویی در حجم برش خورده است ({formatNumberFa(open.chars)} نویسه در منبع).
                برای مطالعهٔ کامل به منبع رسمی مراجعه کنید.
              </p>
            ) : null}
            <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(null)}>
              بستن
            </Button>
          </div>
        ) : null}
      </Sheet>
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
