#!/usr/bin/env node
/**
 * ساخت داده‌های «کتابچه قانون».
 *
 *   data/curated/*.json  +  data/sources/**  →  public/data/v<version>/**
 *
 * خروجی:
 *   public/data/version.json                 ← اشاره‌گر نسخه + هش هر قانون (برای به‌روزرسانی دلتا)
 *   public/data/v<version>/catalog.json      ← فهرست قوانین، دسته‌ها، سلسله‌مراتب، چک‌لیست
 *   public/data/v<version>/laws/<id>.json    ← مواد هر قانون
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseLawText, parseHubJson, parseConstitutionYaml, normalizeArticle,
  writeJson, ensureDir, sha256,
} from './lib/parse.mjs';
import { clean, toFaDigits, dateToSort, parseDocHeader } from './lib/fa.mjs';
import { buildCases } from './build-cases.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CURATED = path.join(ROOT, 'data', 'curated');
const SOURCES = path.join(ROOT, 'data', 'sources');
const PUBLIC = path.join(ROOT, 'public');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readText = (p) => fs.readFileSync(p, 'utf8');

/* ---------------------------------------------------------------- *
 * ساخت یک سند قانون از منبع مربوطه
 * ---------------------------------------------------------------- */
function buildFromCorpus(law) {
  const file = path.join(SOURCES, 'lawcorpus', law.source.file);
  if (!fs.existsSync(file)) throw new Error(`منبع یافت نشد: ${file}`);
  const { meta, articles } = parseLawText(readText(file));
  return { meta, articles, sourceName: 'مجموعه متون قوانین (پاک‌سازی‌شده)' };
}

function buildFromHub(law) {
  const file = path.join(SOURCES, 'structured-laws', law.source.file);
  if (!fs.existsSync(file)) throw new Error(`منبع یافت نشد: ${file}`);
  const { meta, articles } = parseHubJson(readText(file));
  return { meta, articles, sourceName: 'متون ساختاریافتهٔ قوانین' };
}

function buildConstitution(law) {
  const yamlFile = path.join(SOURCES, 'constitution', 'constitution.yaml');
  let articles = [];
  if (fs.existsSync(yamlFile)) {
    articles = parseConstitutionYaml(readText(yamlFile)).articles;
  }
  if (articles.length < 170) {
    // پشتیبان: متن قانون اساسی از مجموعه متون پاک‌سازی‌شده
    const raw = readText(path.join(SOURCES, 'lawcorpus', 'q0.txt')).replace(/\r\n/g, '\n');
    const lines = clean(raw).split('\n');
    articles = [];
    let current = null;
    const flush = () => {
      if (current) {
        current.text = current.buf.join('\n').trim();
        delete current.buf;
        if (current.text) articles.push(current);
      }
      current = null;
    };
    let section = '';
    for (const line of lines) {
      const sec = line.match(/^\s*❯+\s*(.+)$/);
      if (sec) { flush(); section = clean(sec[1]); continue; }
      const art = line.match(/^\s*اصل\s*([0-9۰-۹]+)\s*$/);
      if (art) {
        flush();
        current = { number: Number(toFaDigits(art[1]).replace(/[^0-9]/g, '')), mokarrar: false, path: section ? [section] : [], buf: [] };
        continue;
      }
      if (current) current.buf.push(line);
    }
    flush();
  }
  return {
    meta: { title: 'قانون اساسی جمهوری اسلامی ایران', note: 'مصوب ۱۳۵۸/۰۹/۱۲ با اصلاحات ۱۳۶۸', articleRange: 'مقدمه و اصول ۱ تا ۱۷۷' },
    articles,
    sourceName: 'متن قانون اساسی',
  };
}

function buildFromCurated(law) {
  const file = path.join(CURATED, law.source.file);
  const data = readJson(file);
  const articles = data.rules.map((r) => ({
    number: r.number,
    mokarrar: false,
    path: ['قواعد فقهی بنیادین'],
    label: r.title,
    text: [
      r.statement,
      `مفهوم و کاربرد: ${r.meaning}`,
      `مستند: ${r.basis}`,
      r.applications?.length ? `موارد کاربرد: ${r.applications.join('؛ ')}` : '',
      r.caution ? `نکته: ${r.caution}` : '',
    ].filter(Boolean).join('\n'),
    _rule: r,
  }));
  return {
    meta: { title: data.title, note: data.note, articleRange: `۱ تا ${data.rules.length}` },
    articles,
    sourceName: 'تدوین کارن سافت — با بازبینی حقوقی',
  };
}

/* ---------------------------------------------------------------- *
 * آمار و تحلیل
 * ---------------------------------------------------------------- */
function analyze(articles) {
  const nums = articles.map((a) => a.numberValue).filter((n) => typeof n === 'number');
  const set = new Set(nums);
  const max = nums.length ? Math.max(...nums) : 0;
  const missing = [];
  for (let i = 1; i <= max; i++) if (!set.has(i)) missing.push(i);
  const mokarrar = articles.filter((a) => a.mokarrar).length;
  return { max, missing, mokarrar, count: articles.length };
}

function chapterSummary(articles) {
  const out = [];
  for (const a of articles) {
    const title = (a.path || []).join(' › ') || 'بدون فصل‌بندی';
    const last = out[out.length - 1];
    if (last && last.title === title) {
      last.to = a.numberFa;
      last.count++;
    } else {
      out.push({ title, from: a.numberFa, to: a.numberFa, count: 1 });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- *
 * اجرا
 * ---------------------------------------------------------------- */
function main() {
  const catalog = readJson(path.join(CURATED, 'catalog.json'));
  const appInfo = readJson(path.join(CURATED, 'app-info.json'));

  /* فقط اسنادی که متن ماده‌به‌ماده دارند وارد برنامه می‌شوند؛
     سندِ «فقط شناسنامه» یا «فقط عنوان» در داده‌های نهایی جایی ندارد. */
  const allLawDefs = catalog.laws;

  const lawsMeta = [];
  const lawFiles = {};
  const report = [];

  for (const lawDef of allLawDefs) {
    let built;
    switch (lawDef.source.kind) {
      case 'corpus': built = buildFromCorpus(lawDef); break;
      case 'hub': built = buildFromHub(lawDef); break;
      case 'constitution': built = buildConstitution(lawDef); break;
      case 'curated': built = buildFromCurated(lawDef); break;
      default: throw new Error(`نوع منبع نامعتبر: ${lawDef.source.kind}`);
    }

    const title = lawDef.title || built.meta.title;
    const approval = lawDef.approvalDate || built.meta.approval || '';
    const lawRecord = {
      id: lawDef.id,
      title,
      shortTitle: lawDef.shortTitle || title,
      category: lawDef.category,
      hierarchy: lawDef.hierarchy,
      documentType: lawDef.documentType || 'قانون',
      approvalDate: approval ? toFaDigits(approval) : '',
      approvalSort: lawDef.approvalSort || dateToSort(approval),
      status: lawDef.status || 'لازم‌الاجرا',
      summary: lawDef.summary || '',
      keywords: lawDef.keywords || [],
      checklist: lawDef.checklist || [],
      source: { ...lawDef.source, name: lawDef.source.name || built.sourceName },
      note: built.meta.note || '',
      articleRange: built.meta.articleRange || '',
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    let articles = built.articles.map((a) => normalizeArticle(lawRecord, a, title));

    // تکمیل مواد ناموجود از منبع پشتیبان (در صورت تعریف در کاتالوگ)
    const filled = [];
    if (lawDef.fillFrom) {
      const stats0 = analyze(articles);
      if (stats0.missing.length) {
        const alt = lawDef.fillFrom.kind === 'corpus' ? buildFromCorpus({ source: lawDef.fillFrom })
          : buildFromHub({ source: lawDef.fillFrom });
        const present = new Set(articles.map((a) => a.numberValue));
        for (const m of stats0.missing) {
          const candidate = alt.articles.find((a) => Number(a.number) === m && !a.mokarrar);
          if (!candidate) continue;
          const art = normalizeArticle(lawRecord, candidate, title);
          art.filledFrom = lawDef.fillFrom.label;
          articles.push(art);
          filled.push(m);
          present.add(m);
        }
        articles.sort((a, b) => (a.numberValue ?? 0) - (b.numberValue ?? 0) || String(a.number).localeCompare(String(b.number)));
      }
    }

    /* مادهٔ بدون متن (فقط عنوان/شماره) حذف می‌شود؛ هر ماده‌ای که در برنامه
       می‌آید باید متن داشته باشد. */
    articles = articles.filter((a) => (a.text || '').trim().length > 0);
    if (!articles.length) {
      throw new Error(`قانون «${title}» (${lawDef.id}) پس از پاک‌سازی بدون مادهٔ متنی است؛ منبع آن را بررسی کنید.`);
    }

    const stats = analyze(articles);

    // مواد «منتقل‌شده» به سند دیگر (مثل مواد ۲۱ تا ۹۳ قانون تجارت) به‌عنوان خلأ محاسبه نمی‌شود
    let missing = stats.missing;
    let movedTo = null;
    if (lawDef.gapPolicy?.movedTo) {
      const ranges = Object.values(lawDef.gapPolicy.movedTo).flat();
      missing = missing.filter((n) => !ranges.some(([a, b]) => n >= a && n <= b));
      movedTo = lawDef.gapPolicy;
    }

    lawRecord.articleCount = articles.length;
    lawRecord.chapters = chapterSummary(articles);
    lawRecord.gaps = { count: missing.length, items: missing.slice(0, 40) };
    lawRecord.movedTo = movedTo;
    if (filled.length) lawRecord.filledFrom = { label: lawDef.fillFrom.label, numbers: filled };
    lawRecord.range = { from: 1, to: stats.max };

    const payload = JSON.stringify({ law: lawRecord, articles });
    const hash = sha256(payload).slice(0, 12);

    lawFiles[lawRecord.id] = { payload, hash, count: articles.length };
    lawsMeta.push({ ...lawRecord, hash });

    report.push({
      id: lawRecord.id,
      title,
      count: articles.length,
      missing: missing.length,
      moved: movedTo ? 1 : 0,
      max: stats.max,
    });
  }

  const totalArticles = lawsMeta.reduce((s, l) => s + l.articleCount, 0);

  const clientCatalog = {
    version: '',
    appVersion: appInfo.appVersion,
    releasedAt: new Date().toISOString().slice(0, 10),
    releasedAtFa: toFaDigits(appInfo.releasedAt || ''),
    appName: appInfo.appName,
    shortName: appInfo.shortName,
    credits: appInfo.credits,
    disclaimer: appInfo.disclaimer,
    privacy: appInfo.privacy,
    officialSources: appInfo.officialSources,
    hierarchyNote: appInfo.hierarchyNote,
    dataSources: appInfo.dataSources,
    categories: catalog.categories,
    hierarchy: catalog.hierarchy,
    checklist: catalog.checklist,
    laws: lawsMeta,
    stats: {
      lawCount: lawsMeta.length,
      articleCount: totalArticles,
      categoryCount: catalog.categories.length,
      /** اسنادی که متن ماده‌به‌ماده دارند */
      fullTextCount: lawsMeta.filter((l) => l.articleCount > 0).length,
    },
  };

  /* نسخهٔ داده: نسخهٔ معنایی + هش محتوای قوانین + هش محتوای فهرست (کاتالوگ).
     هشِ فهرست هم لازم است؛ وگرنه حذف/افزودن سند، دسته یا چک‌لیست، نسخه را
     عوض نمی‌کند و کلاینتی که فهرست قدیمی را در IndexedDB دارد، هرگز فهرست
     تازه را نمی‌گیرد (مثلاً مدخل‌های حذف‌شده در نوار جست‌وجو می‌مانند). */
  const catalogHash = sha256(JSON.stringify(clientCatalog)).slice(0, 8);
  const aggregateHash = sha256(
    [...Object.entries(lawFiles).map(([k, v]) => `${k}:${v.hash}`).sort(), `catalog:${catalogHash}`].join('|'),
  ).slice(0, 8);
  const version = `${appInfo.dataVersion}+${aggregateHash}`;
  clientCatalog.version = version;

  const versionDir = path.join(PUBLIC, 'data', 'v', version);
  const casesDir = path.join(versionDir, 'cases');

  /* مجموعهٔ آراء از یک منبعِ حجیمِ «اختیاری» ساخته می‌شود
     (data/sources/cases/case.csv).
     اگر آن منبع روی این دستگاه نباشد، نباید دادهٔ آرائی که پیش‌تر ساخته و در
     مخزن ثبت شده از بین برود — وگرنه هر بار اجرای `data:build` (از جمله در
     خط تولید) ۱۹۹۸ رأی را بی‌صدا حذف می‌کند. پس پوشهٔ cases پیش از
     بازسازی کنار گذاشته می‌شود و در صورت نیاز سر جایش برمی‌گردد؛ با تغییر نسخهٔ
     داده، مجموعهٔ آراء نسخهٔ پیشین با مسیرهای نسخهٔ جدید بازگردانده می‌شود. */
  const stashedCasesDir = path.join(PUBLIC, 'data', 'v', `.cases-stash-${version}`);
  fs.rmSync(stashedCasesDir, { recursive: true, force: true });
  if (fs.existsSync(casesDir)) fs.renameSync(casesDir, stashedCasesDir);
  const previousPointerPath = path.join(PUBLIC, 'data', 'version.json');
  const previousPointer = fs.existsSync(previousPointerPath) ? readJson(previousPointerPath) : null;
  const previousCasesPointer =
    previousPointer && previousPointer.version === version ? previousPointer.cases : undefined;

  // پوشه نسخه از صفر ساخته می‌شود تا فایل‌های قدیمی (مثلاً قالب پیش از قطعه‌بندی) باقی نمانند
  fs.rmSync(versionDir, { recursive: true, force: true });
  ensureDir(path.join(versionDir, 'laws'));

  writeJson(path.join(versionDir, 'catalog.json'), clientCatalog);

  /* هر قانون به بخش‌های حداکثر ~۳۰۰ ماده / ۳۵۰ کیلوبایت شکسته می‌شود
     تا بارگذاری اولیه و به‌روزرسانی دلتا روی موبایل سبک بماند. */
  const CHUNK_ARTICLES = 300;
  const pointerLaws = [];
  for (const meta of lawsMeta) {
    const file = lawFiles[meta.id];
    const parsed = JSON.parse(file.payload);
    const parts = [];
    const chunks = [];
    for (let i = 0; i < parsed.articles.length; i += CHUNK_ARTICLES) {
      chunks.push(parsed.articles.slice(i, i + CHUNK_ARTICLES));
    }
    if (!chunks.length) chunks.push([]);
    chunks.forEach((articles, index) => {
      const partName = `${meta.id}.p${index}.json`;
      const body = JSON.stringify({ law: index === 0 ? parsed.law : undefined, articles });
      fs.writeFileSync(path.join(versionDir, 'laws', partName), body, 'utf8');
      parts.push({
        path: `/data/v/${version}/laws/${partName}`,
        bytes: Buffer.byteLength(body),
        count: articles.length,
      });
    });
    pointerLaws.push({
      id: meta.id,
      hash: file.hash,
      bytes: parts.reduce((s, p) => s + p.bytes, 0),
      count: file.count,
      title: meta.shortTitle,
      category: meta.category,
      hierarchy: meta.hierarchy,
      parts,
    });
  }

  const pointer = {
    version,
    releasedAt: new Date().toISOString().slice(0, 10),
    catalogPath: `/data/v/${version}/catalog.json`,
    laws: pointerLaws,
    stats: { lawCount: lawsMeta.length, articleCount: totalArticles },
  };

  /* مجموعهٔ اختیاری آراء قضایی (منبع حجیم؛ فقط در صورت وجود فایل ساخته می‌شود) */
  const versionsDir = path.join(PUBLIC, 'data', 'v');
  const cases = buildCases({ versionDir, version });
  if (cases) {
    pointer.cases = cases.pointer;
    fs.rmSync(stashedCasesDir, { recursive: true, force: true });
  } else if (fs.existsSync(stashedCasesDir)) {
    /* منبع خام نبود: همان پوشهٔ کنارگذاشته‌شدهٔ همین نسخه را نگه می‌داریم */
    fs.renameSync(stashedCasesDir, casesDir);
    if (previousCasesPointer) pointer.cases = previousCasesPointer;
    console.log('   ⓘ مجموعهٔ آراءِ ثبت‌شده در مخزن حفظ شد (منبع خامِ اختیاری در دسترس نبود)');
  } else {
    fs.rmSync(stashedCasesDir, { recursive: true, force: true });
    /* نسخهٔ داده عوض شده و منبع خام هم در دسترس نیست؛ مجموعهٔ آراءِ ساختِ
       پیشین از پوشهٔ نسخهٔ قبلی به نسخهٔ جدید منتقل می‌شود تا دادهٔ سنگینِ
       ثبت‌شده در مخزن از دست نرود (فقط مسیرهای اشاره‌گر به‌روز می‌شوند). */
    const previousVersionDir = fs
      .readdirSync(versionsDir)
      .filter((d) => d !== version && !d.startsWith('.') && fs.existsSync(path.join(versionsDir, d, 'cases')))
      .sort()
      .pop();
    if (previousVersionDir) {
      const oldCasesDir = path.join(versionsDir, previousVersionDir, 'cases');
      fs.cpSync(oldCasesDir, casesDir, { recursive: true });
      const oldPointerPath = path.join(oldCasesDir, 'index.json');
      const oldIndex = fs.existsSync(oldPointerPath) ? readJson(oldPointerPath) : null;
      const oldParts = [];
      for (const name of fs.readdirSync(oldCasesDir).filter((n) => /^c\d+\.json$/.test(n)).sort((a, b) => Number(a.slice(1, -5)) - Number(b.slice(1, -5)))) {
        const body = fs.readFileSync(path.join(oldCasesDir, name), 'utf8');
        oldParts.push({
          path: `/data/v/${version}/cases/${name}`,
          bytes: Buffer.byteLength(body),
          count: (JSON.parse(body).items || []).length,
        });
      }
      if (oldIndex && oldParts.length) {
        /* نام منبع در فایل فهرست آراء بازنویسی می‌شود تا ارجاعی به مخزن در داده نماند */
        const indexBody = JSON.stringify({ ...oldIndex, version, source: 'مجموعهٔ آراء قضایی', count: oldParts.reduce((s, p) => s + p.count, 0) });
        fs.writeFileSync(path.join(casesDir, 'index.json'), indexBody, 'utf8');
        pointer.cases = {
          version,
          source: 'مجموعهٔ آراء قضایی',
          count: oldParts.reduce((s, p) => s + p.count, 0),
          bytes: oldParts.reduce((s, p) => s + p.bytes, 0) + Buffer.byteLength(indexBody),
          indexPath: `/data/v/${version}/cases/index.json`,
          indexBytes: Buffer.byteLength(indexBody),
          parts: oldParts,
          types: [...new Set(oldIndex.index.map((row) => row.type))].sort(),
        };
        console.log(`   ⓘ مجموعهٔ آراءِ نسخهٔ پیشین (${toFaDigits(pointer.cases.count)} رأی) به نسخهٔ جدید منتقل شد`);
      }
    }
  }

  writeJson(path.join(PUBLIC, 'data', 'version.json'), pointer);

  /* پاک‌سازی نسخه‌های قدیمی (فقط ۲ نسخه آخر نگه داشته می‌شود).
     مجموعهٔ آراءِ نسخهٔ پیشین همیشه حذف می‌شود — حجیم است و دریافتِ آن اختیاری است. */
  const all = fs.readdirSync(versionsDir).filter((d) => d !== version && !d.startsWith('.')).sort();
  for (const old of all) {
    fs.rmSync(path.join(versionsDir, old, 'cases'), { recursive: true, force: true });
  }
  for (const old of all.slice(0, Math.max(0, all.length - 1))) {
    fs.rmSync(path.join(versionsDir, old), { recursive: true, force: true });
  }

  /* گزارش */
  console.log(`\n📚 کتابچه قانون — ساخت داده‌ها\n   نسخه: ${version}`);
  console.log(`   ${lawsMeta.length} سند حقوقی با متن کامل`);
  console.log(`   ${toFaDigits(totalArticles)} ماده\n`);
  const pad = (s, n) => String(s).padEnd(n);
  for (const r of report) {
    const gap = r.missing ? ` ⚠ ${r.missing} ماده ناموجود در منبع`
      : r.moved ? ' ↪ مواد ۲۱–۹۳ در لایحه اصلاحی ۱۳۴۷'
      : '';
    console.log(`   ${pad(r.id, 46)} ${pad(r.count, 6)} ماده${gap}`);
  }
  const withGaps = report.filter((r) => r.missing > 0);
  if (withGaps.length) {
    console.log(`\n   ⚠ ${withGaps.length} قانون دارای ماده ناموجود در منبع است (در «گزارش پوشش» برنامه نمایش داده می‌شود).`);
  }
  console.log(`\n   خروجی: public/data/version.json و public/data/v/${version}/\n`);
}

main();
