import { resolveBasePath } from './config/base-path.mjs';

/** @type {import('next').NextConfig } */
const isVercel = process.env.VERCEL === '1';
// پیش‌فرض «/law-book» برای استقرار زیرمسیر است؛
// برای اجرای محلی در ریشه: NEXT_PUBLIC_BASE_PATH= VERCEL=1 npm run dev
const basePath = resolveBasePath();

const nextConfig = {
  // Static hosting needs a static export, while Vercel uses its native Next.js output.
  ...(isVercel ? {} : { output: 'export' }),
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),

  // مسیر basePath را به کد سمت کلاینت هم می‌رساند تا Service Worker،
  // manifest و آیکون‌ها همان زیرمسیری را بگیرند که خودِ صفحه دارد.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  images: {
    unoptimized: true,
  },

  trailingSlash: true,
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
