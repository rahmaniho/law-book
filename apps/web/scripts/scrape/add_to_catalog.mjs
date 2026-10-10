#!/usr/bin/env node
/**
 * افزودن یک فایل قانون تازه‌استخراج‌شده به catalog.json
 *
 * نمونه:
 *   node scripts/scrape/add_to_catalog.mjs \
 *     --id civil-service-law \
 *     --file q19.txt \
 *     --title "قانون مدیریت خدمات کشوری" \
 *     --short "خدمات کشوری" \
 *     --category edari \
 *     --hierarchy statute \
 *     --date "1386/07/08" \
 *     --summary "..." \
 *     --checklist civil-service
 *
 * سپس: npm run data:validate && npm run data:build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CATALOG = path.join(ROOT, 'data', 'curated', 'catalog.json');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const id = arg('id');
const file = arg('file');
if (!id || !file) {
  console.error('استفاده: node scripts/scrape/add_to_catalog.mjs --id <شناسه> --file <qNN.txt> [گزینه‌ها]');
  console.error('گزینه‌ها: --title --short --category --hierarchy --date --summary --keywords a,b --checklist x --source hub|corpus');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
if (catalog.laws.some((l) => l.id === id)) {
  console.error(`× مدخلی با شناسه «${id}» از قبل وجود دارد.`);
  process.exit(1);
}

const lawFile = path.join(ROOT, 'data', 'sources', 'lawcorpus', file);
if (!fs.existsSync(lawFile)) {
  console.error(`× فایل منبع پیدا نشد: ${lawFile}\n  ابتدا فایل استخراج‌شده را در data/sources/lawcorpus/ قرار دهید.`);
  process.exit(1);
}

const raw = fs.readFileSync(lawFile, 'utf8');
const articleCount = (raw.match(/^\s*ماده\s*[0-9۰-۹]+/gm) || []).length;
const date = arg('date');
const entry = {
  id,
  title: arg('title') || id,
  shortTitle: arg('short') || arg('title') || id,
  category: arg('category', 'sayer'),
  hierarchy: arg('hierarchy', 'statute'),
  documentType: arg('doctype', 'قانون'),
  approvalDate: date,
  approvalSort: date ? Number(date.replace(/\D/g, '').slice(0, 8)) || 0 : 0,
  status: 'لازم‌الاجرا',
  source: { kind: arg('source', 'corpus'), file },
  summary: arg('summary'),
  keywords: arg('keywords') ? arg('keywords').split(',').map((s) => s.trim()).filter(Boolean) : [],
  checklist: arg('checklist') ? [arg('checklist')] : [],
  note: arg('note'),
  articleRange: articleCount ? `1-${articleCount}` : '',
  updatedAt: new Date().toISOString().slice(0, 10),
  articleCount,
  chapters: [],
  gaps: { count: 0, items: [] },
  range: { from: 1, to: articleCount },
  hash: '',
};

catalog.laws.push(entry);
if (arg('checklist')) {
  const item = catalog.checklist.find((c) => c.id === arg('checklist'));
  if (item) {
    item.status = 'included';
    item.laws = [...new Set([...(item.laws || []), id])];
  }
}
catalog.stats.lawCount = catalog.laws.length;

fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`✓ «${entry.title}» با ${articleCount} ماده به catalog.json اضافه شد.`);
console.log('مرحله بعد: npm run data:validate && npm run data:build');
