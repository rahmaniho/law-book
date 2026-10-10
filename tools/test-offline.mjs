/** Real Chromium + Service Worker + IndexedDB. No mocked app data or network responses.
 * @sparticuz/chromium provides the browser via npm for Linux CI (no external CDN).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import bundledChromium from '@sparticuz/chromium';
import { serveWeb } from './serve-web.mjs';

const { server, base, origin } = await serveWeb();
let browser, nativeLibs;
try {
  const env = { ...process.env };
  if (!process.env.CHROMIUM_PATH && process.platform === 'linux') {
    // Minimal Linux sandboxes may lack NSS/NSPR. Use the browser package's own
    // bundled native libraries, without apt or an additional network download.
    nativeLibs = fs.mkdtempSync(path.join(os.tmpdir(), 'lawbook-browser-libs-'));
    const archive = new URL('../bin/al2023.tar.br', import.meta.resolve('@sparticuz/chromium'));
    const tar = path.join(nativeLibs, 'libs.tar');
    fs.writeFileSync(tar, brotliDecompressSync(fs.readFileSync(archive)));
    execFileSync('tar', ['-xf', tar, '-C', nativeLibs]);
    env.LD_LIBRARY_PATH = [path.join(nativeLibs, 'lib'), env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  }
  browser = await chromium.launch({ env, executablePath: process.env.CHROMIUM_PATH || await bundledChromium.executablePath(), args: bundledChromium.args.filter(arg => !['--disable-web-security', '--allow-running-insecure-content', '--single-process', '--disable-site-isolation-trials'].includes(arg)), headless: true });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'allow' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + base + '/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('GhanounDB'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      try {
        return await new Promise(resolve => { const r = db.transaction('meta').objectStore('meta').get('dataVersion'); r.onsuccess = () => resolve(Boolean(r.result?.value)); });
      } finally { db.close(); }
    }, null, { timeout: 120000 });
    // Start a fresh page: no in-memory Next Router cache. Disable the HTTP cache too.
    await page.close();
    const offline = await context.newPage();
    offline.on('pageerror', e => errors.push(e.message));
    const cdp = await context.newCDPSession(offline);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await context.setOffline(true);
    const rscFromSW = [];
    offline.on('response', r => { if (r.url().includes('/read/index.txt') && r.fromServiceWorker()) rscFromSW.push(r.url()); });
    await offline.goto(origin + base + '/laws/');
    await offline.getByLabel('جست‌وجو در عنوان قوانین').fill('مدنی');
    await offline.locator(`a[href="${base}/read/?law=civil-code"]`).first().click();
    await offline.waitForURL('**/read/?law=civil-code');
    await offline.locator(`a[href="${base}/read/?article=civil-code-1"]`).first().click();
    await offline.waitForURL('**/read/?article=civil-code-1');
    await offline.getByRole('heading', { name: 'ماده ۱', exact: true }).waitFor();
    assert.ok((await offline.locator('body').innerText()).includes('رئیس جمهور'), 'actual law text must be rendered from IndexedDB');
    await offline.getByRole('button', { name: 'نشان‌کردن', exact: true }).click();
    await offline.getByRole('button', { name: 'نشان‌شده', exact: true }).waitFor();
    await offline.goto(origin + base + '/bookmarks/');
    await offline.locator(`a[href="${base}/read/?article=civil-code-1"]`).first().click();
    await offline.getByRole('heading', { name: 'ماده ۱', exact: true }).waitFor();
    await offline.reload();
    await offline.getByRole('heading', { name: 'ماده ۱', exact: true }).waitFor();
    await offline.goto(origin + base + '/read/?article=civil-code-10');
    await offline.getByRole('heading', { name: 'ماده ۱۰', exact: true }).waitFor();
    assert.ok((await offline.locator('body').innerText()).includes('قراردادهای خصوصی'));
    await offline.goto(origin + base + '/article/civil-code-11/');
    await offline.waitForURL('**/read/?article=civil-code-11');
    await offline.getByRole('heading', { name: 'ماده ۱۱', exact: true }).waitFor();
    await offline.goto(origin + base + '/calculator/inheritance/');
    await offline.getByRole('heading', { name: 'محاسبه‌گر ارث', exact: true }).waitFor();
    await offline.getByPlaceholder('مثلاً 1000000000').fill('1000000000');
    await offline.goto(origin + base + '/search/');
    await offline.getByPlaceholder('ماده ۱۰ قانون مدنی، مهریه، طلاق…').fill('قراردادهای خصوصی');
    await offline.locator(`a[href="${base}/read/?article=civil-code-10"]`).first().click();
    await offline.getByRole('heading', { name: 'ماده ۱۰', exact: true }).waitFor();
    assert.ok(rscFromSW.length > 0, 'client-side navigation must consume precached RSC responses');
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log(`PASS ${mobile ? 'mobile viewport' : 'desktop'}: fresh offline law/article, RSC, reload, unseen article, legacy deep link, bookmarks, calculator, local search`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (nativeLibs) fs.rmSync(nativeLibs, { recursive: true, force: true });
  await new Promise(resolve => server.close(resolve));
}
