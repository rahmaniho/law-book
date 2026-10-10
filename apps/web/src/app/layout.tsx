import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { DataBootstrap } from '@/components/data-bootstrap';
import { ServiceWorkerRegistrar } from '@/components/pwa-register';
import { withBase } from '@/lib/base-path';

const vazirmatn = localFont({
  src: [
    { path: '../../../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'Tahoma', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'کتابچه قانون ایران',
    template: '%s | کتابچه قانون',
  },
  description:
    'قوانین و مقررات جمهوری اسلامی ایران؛ جست‌وجوی سریع و آفلاین در مواد قانونی. جمع‌آوری و تدوین: وکیل پایه یک دادگستری لیلا آبکه — توسعه: کارن سافت.',
  applicationName: 'کتابچه قانون',
  // Next.js فیلد manifest/icons را با basePath ترکیب نمی‌کند؛
  // بدون این کار در استقرار زیرمسیر به ریشهٔ دامنه اشاره می‌شد و ۴۰۴ می‌گرفت.
  manifest: withBase('/manifest.webmanifest'),
  icons: {
    icon: [
      { url: withBase('/icons/favicon-32.png'), sizes: '32x32', type: 'image/png' },
      { url: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: withBase('/icons/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'کتابچه قانون',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  authors: [{ name: 'کارن سافت', url: 'https://karen-soft.ir' }],
  keywords: ['قانون', 'قوانین ایران', 'مواد قانونی', 'کتابچه قانون', 'وکیل', 'حقوق'],
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f766e' },
    { media: '(prefers-color-scheme: dark)', color: '#042f2e' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans`}>
        <ThemeProvider>
          <DataBootstrap>
            <AppShell>{children}</AppShell>
          </DataBootstrap>
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
