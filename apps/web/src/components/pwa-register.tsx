'use client';

import { useEffect } from 'react';
import { swUrl } from '@/lib/base-path';

/**
 * ثبت Service Worker و درخواست همگام‌سازی پس‌زمینه.
 *
 * مسیر SW از basePath ساخته می‌شود (در استقرار زیرمسیر یعنی `/Lawbook/sw.js`).
 * scope به‌عمد تنظیم نمی‌شود: مقدار پیش‌فرض همان پوشهٔ فایل SW است، یعنی دقیقاً
 * همان scope که در manifest آمده — تنظیم scope گسترده‌تر بدون هدر
 * `Service-Worker-Allowed` از سوی مرورگر رد می‌شود.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(swUrl());
        // بررسی به‌روزرسانی هر ۳۰ دقیقه
        updateTimer = setInterval(() => reg.update().catch(() => undefined), 30 * 60 * 1000);
      } catch (error) {
        // ثبت SW در محیط‌های محدود (مثلاً بدون HTTPS) ناموفق است؛
        // برنامه بدون آن هم کار می‌کند، ولی نباید بی‌صدا رد شود.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[pwa] ثبت Service Worker ناموفق بود:', swUrl(), error);
        }
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      window.removeEventListener('load', register);
      if (updateTimer) clearInterval(updateTimer);
    };
  }, []);

  return null;
}
