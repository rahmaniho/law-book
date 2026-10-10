'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, RefreshCw, WifiOff } from 'lucide-react';
import { getCatalog, META_KEYS, getMeta } from '@/lib/db';
import { syncData } from '@/lib/sync';
import { useApp } from '@/lib/store';
import { formatBytes, formatNumberFa } from '@/lib/format';
import { DEFAULT_READER } from '@/lib/store';
import type { ReaderSettings } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { withBase } from '@/lib/base-path';
import { useOnlineStatus, useReaderSettings } from '@/lib/hooks';

/** بارگذاری اولیه داده‌ها + نمایش اسپلش با اعتبار حقوقی و توسعه‌دهنده */
export function DataBootstrap({ children }: { children: React.ReactNode }) {
  const ready = useApp((s) => s.ready);
  const progress = useApp((s) => s.progress);
  const catalog = useApp((s) => s.catalog);
  const online = useOnlineStatus();
  useReaderSettings();

  const [booted, setBooted] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const setCatalog = useApp((s) => s.setCatalog);
  const setReady = useApp((s) => s.setReady);
  const setProgress = useApp((s) => s.setProgress);
  const setDataVersion = useApp((s) => s.setDataVersion);

  const bootstrap = useCallback(
    async (force = false) => {
      setFailed(false);
      const cached = await getCatalog();
      if (cached) {
        setCatalog(cached);
        setDataVersion(cached.version);
        setReady(true);
      }
      const result = await syncData({
        force,
        onProgress: (p) => setProgress(p),
      });
      if (result.ready) {
        const cat = await getCatalog();
        setCatalog(cat);
        setDataVersion(result.version);
        setReady(true);
      } else if (!cached) {
        setFailed(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bootstrap().finally(() => setBooted(true));
  }, [bootstrap]);

  // هم‌راستاسازی تنظیمات خواندن از پایگاه‌داده محلی
  useEffect(() => {
    getMeta<ReaderSettings>(META_KEYS.reader).then((saved) => {
      if (saved) useApp.getState().updateReader(saved);
      else useApp.getState().updateReader(DEFAULT_READER);
    });
  }, []);

  if (!ready) {
    return (
      <SplashScreen
        progress={progress}
        online={online}
        failed={failed}
        onRetry={() => bootstrap(true)}
        booted={booted}
      />
    );
  }

  return <>{children}</>;
}

function SplashScreen({
  progress,
  online,
  failed,
  onRetry,
  booted,
}: {
  progress: ReturnType<typeof useApp.getState>['progress'];
  online: boolean;
  failed: boolean;
  onRetry: () => void;
  booted: boolean;
}) {
  const percent =
    progress.bytesTotal > 0 ? Math.min(100, Math.round((progress.bytesDone / progress.bytesTotal) * 100)) : 8;

  return (
    <main className="flex min-h-app flex-col items-center justify-between px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase('/icons/icon-512.png')}
          alt="کتابچه حقوق"
          width={96}
          height={96}
          className="splash-logo h-24 w-24 rounded-[1.6rem] shadow-card"
        />
        <div>
          <h1 className="text-2xl font-bold">کتابچه قانون ایران</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
            {failed
              ? 'برای دریافت نخستین نسخه قوانین، اتصال اینترنت لازم است.'
              : 'در حال آماده‌سازی قوانین و جست‌وجوی آفلاین…'}
          </p>
        </div>

        {!failed ? (
          <div className="w-full max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {progress.phase === 'catalog' ? 'دریافت فهرست…' : null}
                {progress.phase === 'downloading' && progress.lawTitle ? progress.lawTitle : null}
                {progress.phase === 'ready' ? 'آماده است' : null}
              </span>
              <span>
                {progress.lawsTotal > 0
                  ? `${formatNumberFa(progress.lawsDone)} از ${formatNumberFa(progress.lawsTotal)} قانون`
                  : null}
              </span>
            </div>
            {progress.bytesTotal > 0 ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {formatBytes(progress.bytesDone)} از {formatBytes(progress.bytesTotal)}
              </p>
            ) : null}
            {progress.phase === 'error' && progress.message ? (
              <p className="mt-3 text-xs text-destructive">{progress.message}</p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!online ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff size={14} /> اتصال اینترنت قطع است
              </p>
            ) : null}
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw size={16} /> تلاش دوباره
            </Button>
          </div>
        )}
      </div>

      <footer className="mt-8 space-y-1 text-center text-[11px] leading-5 text-muted-foreground">
        <p className="flex items-center justify-center gap-1">
          <Database size={12} /> جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه
        </p>
        <p>
          توسعه نرم‌افزار:{' '}
          <a className="font-medium text-primary" href="https://karen-soft.ir" target="_blank" rel="noreferrer">
            کارن سافت — karen-soft.ir
          </a>
        </p>
        <p className="pt-2 opacity-70">مرجع رسمی: روزنامه رسمی و سامانه ملی قوانین (qavanin.ir)</p>
        {booted && progress.phase === 'idle' ? <p className="opacity-60">آماده‌سازی…</p> : null}
      </footer>
    </main>
  );
}
