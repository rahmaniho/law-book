'use client';

import { Database, ExternalLink, Heart, Landmark, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Card } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { AppLogo } from '@/components/app-shell';
import { toFaDigits } from '@/lib/fa';
import { formatIsoToJalali } from '@/lib/format';

export default function AboutPage() {
  const catalog = useApp((s) => s.catalog);
  if (!catalog) return <div className="app-container py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="app-container pb-10">
      <Card className="mt-3 p-4 text-center">
        <div className="flex justify-center">
          <AppLogo />
        </div>
        <h1 className="mt-3 text-lg font-bold">{catalog.appName}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          قوانین و مقررات جمهوری اسلامی ایران — مرور، جست‌وجو و مطالعه آفلاین
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          نسخه برنامه {toFaDigits(catalog.appVersion)} • نسخه داده {toFaDigits(catalog.version.split('+')[0])} •{' '}
          {formatIsoToJalali(catalog.releasedAt)}
        </p>
      </Card>

      <SectionHeading title="اعتبار علمی و حقوقی" />
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Scale size={18} />
          </span>
          <div>
            <p className="text-[13px] font-semibold">{catalog.credits.legal.name}</p>
            <p className="mt-0.5 text-[11.5px] leading-6 text-muted-foreground">{catalog.credits.legal.role}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t pt-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Heart size={18} />
          </span>
          <div>
            <p className="text-[13px] font-semibold">{catalog.credits.developer.name}</p>
            <p className="mt-0.5 text-[11.5px] leading-6 text-muted-foreground">{catalog.credits.developer.role}</p>
            <a
              href={catalog.credits.developer.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary"
            >
              karen-soft.ir <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </Card>

      <SectionHeading title="سلب مسئولیت" />
      <Card className="flex gap-3 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-[12px] leading-6 text-muted-foreground">{catalog.disclaimer}</p>
      </Card>

      <SectionHeading title="حریم خصوصی" />
      <Card className="flex gap-3 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-[12px] leading-6 text-muted-foreground">{catalog.privacy}</p>
      </Card>

      <SectionHeading title="سلسله‌مراتب منابع حقوقی" />
      <Card className="space-y-2 p-4">
        <p className="text-[11.5px] leading-6 text-muted-foreground">{catalog.hierarchyNote}</p>
        <ol className="mt-2 space-y-1.5">
          {catalog.hierarchy.map((h) => (
            <li key={h.id} className="flex items-start gap-2 text-[12px]">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: h.color }}
              />
              <span>
                <span className="font-medium">{toFaDigits(h.order)}. {h.title}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{h.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <SectionHeading title="منابع رسمی" subtitle="برای استناد در مراجع قضایی و اداری" />
      <Card className="divide-y">
        {catalog.officialSources.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 p-3.5 active:bg-accent/40"
          >
            <Landmark size={16} className="mt-0.5 shrink-0 text-primary" />
            <span className="flex-1">
              <span className="block text-[12.5px] font-medium">{s.title}</span>
              <span className="mt-0.5 block text-[11px] leading-5 text-muted-foreground">{s.note}</span>
              <span className="mt-0.5 block text-[10.5px] text-primary" dir="ltr">
                {s.url}
              </span>
            </span>
            <ExternalLink size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </Card>

      <SectionHeading title="منابع داده و مجوزها" />
      <Card className="space-y-3 p-4">
        {catalog.dataSources.map((d) => (
          <div key={d.name} className="border-b pb-3 last:border-0 last:pb-0">
            <p className="flex items-center gap-1 text-[12.5px] font-medium">
              <Database size={13} /> {d.name}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              {d.note} — مجوز: {d.license}
            </p>
            <a href={d.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-[10.5px] text-primary" dir="ltr">
              {d.url}
            </a>
          </div>
        ))}
        <p className="text-[10.5px] leading-5 text-muted-foreground">
          متن قوانین جمهوری اسلامی ایران به‌عنوان سند رسمی، مشمول حمایت حقوق مالکیت فکری نیست؛ با این حال، پیش از انتشار
          تجاری، توصیه می‌شود مجوز بازنشر مجموعه‌های داده‌ای مورد استفاده با مشاور حقوقی بررسی شود.
        </p>
      </Card>

      <Card className="mt-5 flex items-center gap-3 p-4">
        <Sparkles size={18} className="text-primary" />
        <p className="text-[11.5px] leading-6 text-muted-foreground">
          این برنامه به‌صورت کامل روی دستگاه شما اجرا می‌شود؛ پس از نصب، برای مرور و جست‌وجوی قوانین نیازی به اینترنت
          ندارید.
        </p>
      </Card>
    </div>
  );
}
