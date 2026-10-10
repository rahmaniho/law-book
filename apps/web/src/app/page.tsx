'use client';

import Link from 'next/link';
import { ArrowLeft, BookMarked, Calculator, ChevronLeft, FileCheck2, Gavel, Landmark, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { CategoryGrid, LawRowCard, SectionHeading, StatsStrip } from '@/components/bits';
import { Card, Skeleton } from '@/components/ui/primitives';
import { AppLogo } from '@/components/app-shell';
import { toFaDigits } from '@/lib/fa';
import { formatIsoToJalali } from '@/lib/format';

export default function HomePage() {
  const catalog = useApp((s) => s.catalog);
  const progress = useApp((s) => s.progress);

  if (!catalog) {
    return <div className="app-container flex flex-col gap-4 py-6"><Skeleton className="h-44 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  const featured = [...catalog.laws].sort((a, b) => (b.approvalSort ?? 0) - (a.approvalSort ?? 0)).slice(0, 4);
  const popular = ['civil-code', 'islamic-penal-code', 'labor-code', 'family-protection-law'].map((id) => catalog.laws.find((l) => l.id === id)).filter(Boolean) as typeof catalog.laws;

  return (
    <div className="app-container pb-8">
      <section className="editorial-hero mt-4 overflow-hidden rounded-[1.75rem] border bg-card p-5 shadow-card sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><div className="eyebrow">مرجع حقوقی ایران / نسخه آفلاین</div><h1 className="mt-5 max-w-[15rem] text-3xl font-bold leading-[1.35] tracking-tight sm:text-4xl">قانون را دقیق‌تر بخوانید.</h1></div>
          <AppLogo />
        </div>
        <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">جست‌وجو، مطالعه و نشانه‌گذاری قوانین و مقررات جمهوری اسلامی ایران؛ همیشه در دسترس، حتی بدون اینترنت.</p>
        <Link href="/search" className="mt-6 flex items-center gap-3 rounded-2xl border bg-background/75 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50"><Search size={18} className="text-primary" /><span className="flex-1">جست‌وجو در قوانین، مواد و کلیدواژه‌ها…</span><ArrowLeft size={16} /></Link>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-primary" /> منبع‌محور و قابل بررسی</span><span className="flex items-center gap-1.5"><Sparkles size={14} className="text-primary" /> به‌روزرسانی {formatIsoToJalali(catalog.releasedAt)}</span></div>
      </section>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric value={catalog.stats.fullTextCount ?? catalog.stats.lawCount} label="سند با متن" />
        <Metric value={catalog.stats.articleCount} label="ماده" />
        <Metric value={catalog.stats.categoryCount} label="دسته" />
      </div>

      <SectionHeading title="شروع سریع" subtitle="برای نیاز امروزتان یک مسیر انتخاب کنید" />
      <div className="grid grid-cols-2 gap-2.5">
        <QuickLink href="/laws" icon={<BookMarked size={18} />} title="مرور قوانین" />
        <QuickLink href="/search" icon={<Search size={18} />} title="جست‌وجوی پیشرفته" />
        <QuickLink href="/cases" icon={<Gavel size={18} />} title="آراء قضایی" />
        <QuickLink href="/calculator/inheritance" icon={<Calculator size={18} />} title="محاسبه‌گر ارث" />
        <QuickLink href="/calculator/diyyeh" icon={<Calculator size={18} />} title="محاسبه‌گر دیه" />
        <QuickLink href="/coverage" icon={<FileCheck2 size={18} />} title="پوشش داده‌ها" />
        <QuickLink href="/about" icon={<ShieldCheck size={18} />} title="منابع و اعتبار" />
      </div>

      <SectionHeading title="موضوعات حقوقی" subtitle="قوانین را بر اساس حوزه پیدا کنید" />
      <CategoryGrid categories={catalog.categories} />

      <SectionHeading title="قوانین منتخب" action={<Link href="/laws" className="flex items-center gap-1 text-[11px] font-medium text-primary">مشاهده همه <ChevronLeft size={13} /></Link>} />
      <div className="flex flex-col gap-2">{featured.map((law) => <LawRowCard key={law.id} law={law} />)}</div>

      <SectionHeading title="پرکاربردها" />
      <div className="flex flex-col gap-2">{popular.map((law) => <LawRowCard key={law.id} law={law} />)}</div>

      <Card className="mt-6 overflow-hidden"><div className="border-b bg-muted/35 p-4"><div className="eyebrow">درباره داده‌ها</div><p className="mt-2 text-xs leading-6 text-muted-foreground">نسخه {toFaDigits(catalog.version.split('+')[0])} از منابع رسمی گردآوری شده و برای استناد نهایی، مراجعه به متن رسمی توصیه می‌شود.</p></div><Link href="/about" className="flex items-center gap-3 p-4 text-xs font-medium"><Landmark size={16} className="text-primary" /><span className="flex-1">منابع رسمی و روش گردآوری</span><ChevronLeft size={16} className="text-muted-foreground" /></Link></Card>
      {progress.phase === 'downloading' ? <p className="mt-3 text-center text-[11px] text-primary">در حال به‌روزرسانی داده‌ها… {progress.lawTitle}</p> : null}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-2xl border bg-card px-3 py-3 text-center"><strong className="block text-lg font-bold text-primary">{toFaDigits(value)}</strong><span className="text-[11px] text-muted-foreground">{label}</span></div>; }
function QuickLink({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) { return <Link href={href} className="flex items-center gap-2 rounded-2xl border bg-card p-3.5 text-[12.5px] font-medium shadow-card transition-transform active:scale-[0.98]"><span className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</span>{title}</Link>; }
