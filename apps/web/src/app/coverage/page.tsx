'use client';

import { lawHref } from '@/lib/reader-routes';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Database, FileWarning } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Badge, Card } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { formatNumberFa } from '@/lib/format';
import { toFaDigits } from '@/lib/fa';

export default function CoveragePage() {
  const catalog = useApp((s) => s.catalog);
  const progress = useApp((s) => s.progress);
  if (!catalog) return <div className="app-container py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  const included = catalog.checklist.filter((c) => c.status === 'included');
  const pending = catalog.checklist.filter((c) => c.status !== 'included');
  const lawsWithGaps = catalog.laws.filter((l) => l.gaps?.count);
  const totalGaps = lawsWithGaps.reduce((s, l) => s + l.gaps.count, 0);

  return (
    <div className="app-container pb-10">
      <SectionHeading
        title="گزارش پوشش قوانین"
        subtitle="شفافیت کامل درباره آنچه در این نسخه گنجانده شده و آنچه باقی مانده است"
      />

      <Card className="grid grid-cols-3 gap-2 p-3.5 text-center">
        <Stat value={formatNumberFa(catalog.stats.fullTextCount ?? catalog.laws.length)} label="سند با متن کامل" />
        <Stat value={formatNumberFa(catalog.stats.articleCount)} label="ماده" />
        <Stat value={formatNumberFa(totalGaps)} label="ماده ناموجود" tone={totalGaps ? 'warn' : undefined} />
      </Card>

      <p className="mt-2 text-center text-[10.5px] leading-5 text-muted-foreground">
        همهٔ {formatNumberFa(catalog.laws.length)} سند این نسخه متن ماده‌به‌ماده دارند؛ مجموعهٔ اختیاری «آراء قضایی» نیز در
        بخش جداگانه‌ای فهرست شده است.
      </p>

      <SectionHeading title={`گنجانده‌شده (${toFaDigits(included.length)} مورد)`} />
      <Card className="divide-y">
        {included.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium leading-6">{item.label}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.laws.map((lawId) => {
                  const law = catalog.laws.find((l) => l.id === lawId);
                  if (!law) return null;
                  return (
                    <Link
                      key={lawId}
                      href={lawHref(lawId)}
                      className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] text-muted-foreground"
                    >
                      {law.shortTitle} ({formatNumberFa(law.articleCount)})
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </Card>

      <SectionHeading
        title={`در انتظار ورود داده (${toFaDigits(pending.length)} مورد)`}
        subtitle="ساختار نمایش آماده است؛ متن باید از منابع رسمی افزوده شود"
      />
      <Card className="divide-y">
        {pending.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3.5">
            <Clock size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[12.5px] font-medium leading-6">{item.label}</p>
              {item.note ? (
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{item.note}</p>
              ) : null}
            </div>
          </div>
        ))}
      </Card>

      {lawsWithGaps.length ? (
        <>
          <SectionHeading title="مواد ناموجود در منابع آزاد" subtitle="این مواد باید از سامانه ملی قوانین تکمیل شوند" />
          <Card className="divide-y">
            {lawsWithGaps.map((law) => (
              <div key={law.id} className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={lawHref(law.id)} className="text-[12.5px] font-medium text-primary">
                    {law.shortTitle}
                  </Link>
                  <Badge tone="warning">{formatNumberFa(law.gaps.count)} ماده</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  شماره‌های ناموجود: {law.gaps.items.slice(0, 12).map((n) => toFaDigits(n)).join('، ')}
                  {law.gaps.count > 12 ? ' …' : ''}
                </p>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeading title="چگونه داده‌ها تکمیل می‌شوند؟" />
      <Card className="space-y-2 p-4 text-[11.5px] leading-6 text-muted-foreground">
        <p className="flex gap-2">
          <Database size={15} className="mt-0.5 shrink-0 text-primary" />
          اسکریپت‌های استخراج (Playwright/BeautifulSoup) در پوشه <code className="rounded bg-muted px-1">scripts/scrape</code> همراه
          این پروژه ارائه شده است؛ با اجرای آن‌ها می‌توان متن کامل قوانین را از سامانه ملی قوانین و روزنامه رسمی دریافت و
          به قالب این برنامه افزود.
        </p>
        <p className="flex gap-2">
          <FileWarning size={15} className="mt-0.5 shrink-0 text-primary" />
          راهنمای گام‌به‌گام افزودن قانون جدید در <code className="rounded bg-muted px-1">docs/UPDATE-DATA.md</code> آمده است.
        </p>
        <p className="flex gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-primary" />
          برای استناد رسمی، همیشه به روزنامه رسمی و سامانه ملی قوانین مراجعه کنید.
        </p>
      </Card>

      <p className="mt-5 text-center text-[10.5px] text-muted-foreground">
        نسخه داده {toFaDigits(catalog.version)} •{' '}
        {progress.phase === 'ready' ? 'همگام‌سازی موفق' : progress.phase}
      </p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'warn' }) {
  return (
    <div>
      <p className={`text-base font-bold ${tone === 'warn' ? 'text-amber-600' : 'text-primary'}`}>{value}</p>
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
    </div>
  );
}
