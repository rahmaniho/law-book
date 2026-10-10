'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  AlertTriangle, Database, Download, Gavel, Info, Loader2, Moon, RefreshCw, Smartphone, Sun, Trash2,
} from 'lucide-react';
import { clearLocalData, db, getMeta, META_KEYS, storageEstimate } from '@/lib/db';
import { syncData } from '@/lib/sync';
import { DEFAULT_READER, useApp } from '@/lib/store';
import { Button, Card, Segmented, Slider, Switch } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { formatBytes, formatIsoToJalali, formatNumberFa } from '@/lib/format';
import { toFaDigits } from '@/lib/fa';
import { haptic, useInstallPrompt } from '@/lib/hooks';
import { casesStatus, disableCases, downloadCases, resetCasesCache, type CasesStatus } from '@/lib/cases';
import type { Catalog } from '@/lib/types';

/** تعداد اسنادی که متن دارند (اسناد ارجاعی داده‌ای برای دریافت ندارند) */
function downloadableLawCount(catalog: Catalog) {
  return catalog.laws.filter((l) => l.articleCount > 0).length;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const reader = useApp((s) => s.reader);
  const updateReader = useApp((s) => s.updateReader);
  const resetReader = useApp((s) => s.resetReader);
  const catalog = useApp((s) => s.catalog);
  const setCatalog = useApp((s) => s.setCatalog);
  const setDataVersion = useApp((s) => s.setDataVersion);
  const progress = useApp((s) => s.progress);
  const setProgress = useApp((s) => s.setProgress);
  const { canInstall, promptInstall, installed } = useInstallPrompt();

  const [stats, setStats] = useState({ laws: 0, articles: 0, version: '', lastSync: 0, usage: 0 });
  const [cases, setCases] = useState<CasesStatus | null>(null);
  const [casesBusy, setCasesBusy] = useState(false);
  const [casesMessage, setCasesMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshCases = useCallback(async () => {
    setCases(await casesStatus());
  }, []);

  useEffect(() => {
    refreshCases();
  }, [refreshCases, catalog?.version]);

  const toggleCases = async () => {
    setCasesBusy(true);
    setCasesMessage(null);
    resetCasesCache();
    if (cases?.downloaded) {
      await disableCases();
    } else {
      const ok = await downloadCases();
      if (!ok) setCasesMessage('دریافت آراء انجام نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.');
    }
    setCasesBusy(false);
    await refreshCases();
  };

  const refreshStats = async () => {
    const [laws, articles, version, lastSync, est] = await Promise.all([
      db.laws.count(),
      db.articles.count(),
      getMeta<string>(META_KEYS.dataVersion),
      getMeta<number>(META_KEYS.lastSync),
      storageEstimate(),
    ]);
    setStats({ laws, articles, version: version ?? '', lastSync: lastSync ?? 0, usage: est.usage });
  };

  useEffect(() => {
    refreshStats();
  }, [progress.phase]);

  const checkUpdates = async () => {
    setBusy(true);
    setMessage(null);
    haptic(10);
    try {
      const result = await syncData({ force: true, onProgress: (p) => setProgress(p) });
      const cat = await getMeta<typeof catalog>(META_KEYS.catalog);
      if (cat) setCatalog(cat);
      setDataVersion(result.version);
      setMessage(
        result.updatedLaws > 0
          ? `به‌روزرسانی انجام شد: ${formatNumberFa(result.updatedLaws)} سند بازنگری شد.`
          : 'داده‌ها به‌روز است.',
      );
      await refreshStats();
    } catch {
      setMessage('به‌روزرسانی ناموفق بود. اتصال اینترنت را بررسی کنید.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-container pb-10">
      <SectionHeading title="نمایش" />
      <Card className="p-3.5">
        <p className="mb-2 text-[12.5px] font-medium">پوسته برنامه</p>
        <Segmented
          value={(theme as string) ?? 'system'}
          onChange={(v) => setTheme(v)}
          options={[
            { value: 'system', label: 'خودکار' },
            { value: 'light', label: 'روشن' },
            { value: 'dark', label: 'تاریک' },
          ]}
        />
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />} پیش‌فرض: هم‌راستا با تنظیمات گوشی
          </span>
        </div>
      </Card>

      <SectionHeading title="حالت مطالعه" subtitle="اندازه متن، فاصله خطوط و قلم" />
      <Card className="space-y-4 p-3.5">
        <div>
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span>اندازه متن</span>
            <span className="text-muted-foreground">{toFaDigits(reader.fontSize)}px</span>
          </div>
          <Slider value={reader.fontSize} min={14} max={26} onChange={(v) => updateReader({ fontSize: v })} label="اندازه متن" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span>فاصله خطوط</span>
            <span className="text-muted-foreground">{toFaDigits(reader.lineHeight.toFixed(1))}</span>
          </div>
          <Slider value={reader.lineHeight} min={1.4} max={2.6} step={0.1} onChange={(v) => updateReader({ lineHeight: v })} label="فاصله خطوط" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px]">چینش دوطرفه</span>
          <Switch checked={reader.justify} onChange={(v) => updateReader({ justify: v })} label="چینش دوطرفه" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px]">نمایش کلیدواژه‌ها</span>
          <Switch checked={reader.showKeywords} onChange={(v) => updateReader({ showKeywords: v })} label="کلیدواژه" />
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={resetReader}>
          بازگردانی به پیش‌فرض ({toFaDigits(DEFAULT_READER.fontSize)}px)
        </Button>
      </Card>

      <SectionHeading title="داده‌ها و حالت آفلاین" />
      <Card className="space-y-3 p-3.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">نسخه داده</span>
          <span className="font-medium">{stats.version ? toFaDigits(stats.version) : '—'}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">اسناد ذخیره‌شده</span>
          <span className="font-medium">
            {formatNumberFa(stats.laws)} قانون • {formatNumberFa(stats.articles)} ماده
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">آخرین همگام‌سازی</span>
          <span className="font-medium">{stats.lastSync ? formatIsoToJalali(stats.lastSync) : '—'}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">حجم استفاده‌شده</span>
          <span className="font-medium">{formatBytes(stats.usage)}</span>
        </div>

        {progress.phase === 'downloading' ? (
          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${progress.bytesTotal ? Math.round((progress.bytesDone / progress.bytesTotal) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              در حال دریافت {progress.lawTitle} — {formatNumberFa(progress.lawsDone)} از {formatNumberFa(progress.lawsTotal)}
            </p>
          </div>
        ) : null}

        <Button className="w-full gap-2" onClick={checkUpdates} disabled={busy}>
          <RefreshCw size={15} className={busy ? 'animate-spin' : undefined} />
          {busy ? 'در حال بررسی…' : 'بررسی و دریافت به‌روزرسانی'}
        </Button>

        {message ? <p className="text-[11px] text-primary">{message}</p> : null}

        {catalog && stats.laws < downloadableLawCount(catalog) ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-[11px] leading-5 text-amber-800 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {formatNumberFa(downloadableLawCount(catalog) - stats.laws)} سند هنوز روی این دستگاه ذخیره نشده است؛ برای استفاده کامل آفلاین،
            «بررسی و دریافت به‌روزرسانی» را بزنید.
          </p>
        ) : null}

        <Button
          variant="outline"
          className="w-full gap-2 text-destructive"
          onClick={async () => {
            await clearLocalData();
            setMessage('یادداشت‌ها، نشان‌ها و تاریخچه حذف شد (متن قوانین دست‌نخورده است).');
          }}
        >
          <Trash2 size={15} /> پاک کردن یادداشت‌ها، نشان‌ها و تاریخچه
        </Button>
      </Card>

      {cases?.available ? (
        <>
          <SectionHeading title="مجموعهٔ آراء قضایی" subtitle="دریافتِ اختیاری — جدا از متن قوانین" />
          <Card className="space-y-3 p-3.5">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <Gavel size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium">
                  {cases.downloaded
                    ? `${formatNumberFa(cases.count)} رأی روی این دستگاه`
                    : `${formatNumberFa(cases.count)} رأی آمادهٔ دریافت`}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  حجم {formatBytes(cases.bytes)} — برای مطالعهٔ رویهٔ قضایی؛ در همگام‌سازی عادی برنامه دانلود نمی‌شود.
                </p>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              variant={cases.downloaded ? 'outline' : 'default'}
              onClick={toggleCases}
              disabled={casesBusy}
            >
              {casesBusy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : cases.downloaded ? (
                <Trash2 size={15} />
              ) : (
                <Download size={15} />
              )}
              {casesBusy ? 'در حال انجام…' : cases.downloaded ? 'حذف از دستگاه' : 'دریافت مجموعهٔ آراء'}
            </Button>
            {casesMessage ? <p className="text-[11px] text-destructive">{casesMessage}</p> : null}
          </Card>
        </>
      ) : null}

      <SectionHeading title="نصب روی گوشی" />
      <Card className="flex items-center gap-3 p-3.5">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Smartphone size={18} />
        </span>
        <div className="flex-1">
          <p className="text-[12.5px] font-medium">
            {installed ? 'برنامه روی دستگاه نصب است' : 'نصب به‌عنوان اپلیکیشن (PWA)'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            اجرای تمام‌صفحه، دسترسی آفلاین و آیکون روی صفحه اصلی
          </p>
        </div>
        {canInstall ? (
          <Button size="sm" className="gap-1" onClick={promptInstall}>
            <Download size={14} /> نصب
          </Button>
        ) : null}
      </Card>

      <SectionHeading title="درباره و منابع" />
      <Card className="divide-y">
        <Row href="/about" icon={<Info size={16} />} title="درباره ما، اعتبار حقوقی و منابع رسمی" />
        <Row href="/coverage" icon={<Database size={16} />} title="گزارش پوشش قوانین و مواد ناموجود" />
        <Row href="/cases" icon={<Gavel size={16} />} title="آراء قضایی (رویهٔ قضایی)" />
      </Card>

      <p className="mt-6 text-center text-[10.5px] leading-5 text-muted-foreground">
        {catalog?.appName} — نسخه {toFaDigits(catalog?.appVersion ?? '1.0.0')}
        <br />
        جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه • توسعه: کارن سافت
      </p>
    </div>
  );
}

function Row({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3.5 active:bg-accent/40">
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-[12.5px]">{title}</span>
    </Link>
  );
}
