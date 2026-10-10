/**
 * تجزیه‌گر منابع داده‌ی «کتابچه قانون»:
 *  ۱) فایل‌های متنی پاک‌سازی‌شده‌ی قوانین (q*.txt) با ساختار سرآمد/❯/ماده
 *  ۲) فایل‌های JSON ساختاریافته (متون قوانین) با ساختار divisions → articles
 *  ۳) قانون اساسی از فایل YAML (Principles ۱ تا ۱۷۷)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  clean, toFaDigits, toEnDigits, extractKeywords, detectStatus, extractAmendments,
  parseDocHeader, dateToSort,
} from './fa.mjs';

/* ------------------------------------------------------------------ *
 * ۱) تجزیه‌گر متن قانون (q*.txt)
 * ------------------------------------------------------------------ */

const SECTION_LEVELS = [
  ['کتاب', 1], ['باب', 2], ['فصل', 3], ['مبحث', 4], ['بخش', 5], ['گفتار', 6],
];

function sectionLevelOf(title) {
  const t = title.replace(/^[❯\s]+/, '').trim();
  for (const [key, level] of SECTION_LEVELS) {
    if (new RegExp(`^${key}\\b|^${key}\\s`).test(t)) return level;
  }
  return 3; // پیش‌فرض: فصل
}

/** آیا این خط یک سرآغاز ماده است؟ */
function matchArticleLine(line) {
  const m = line.match(/^\s*\u200c?\u200c?\s*ماده\s*([0-9۰-۹]+)\s*(مکرر|تکراری)?\s*[:\-–.]?\s*(.*)$/);
  if (!m) return null;
  const num = Number(toEnDigits(m[1]));
  if (!Number.isFinite(num) || num <= 0) return null;
  return { num, mokarrar: Boolean(m[2]), rest: (m[3] || '').trim() };
}

/**
 * تجزیه یک سند قانون متنی.
 * @param {string} raw متن کامل فایل
 * @returns {{meta: object, articles: object[]}}
 */
export function parseLawText(raw) {
  const text = clean(raw.replace(/\r\n/g, '\n').replace(/\u200c?\u200cماده/g, 'ماده'));
  const { title, approval, subtitle } = parseDocHeader(text);
  const lines = text.split('\n');

  const articles = [];
  let sections = [];
  let current = null;
  let lastNum = 0;

  const flush = () => {
    if (!current) return;
    current.text = current.textLines.join('\n').trim();
    delete current.textLines;
    if (current.text) articles.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u200c/g, '\u200c');
    if (!line.trim()) {
      if (current) current.textLines.push('');
      continue;
    }
    // سرآغاز شرح ساختار
    const sectionMatch = line.match(/^\s*❯+\s*(.+?)\s*$/);
    if (sectionMatch) {
      flush();
      const secTitle = clean(sectionMatch[1]);
      const level = sectionLevelOf(secTitle);
      sections = sections.slice(0, level - 1);
      sections[level - 1] = secTitle;
      continue;
    }
    const art = matchArticleLine(line);
    if (art && art.num > lastNum && art.num <= lastNum + 40) {
      flush();
      lastNum = art.num;
      current = {
        number: art.num,
        mokarrar: art.mokarrar,
        path: sections.filter(Boolean),
        textLines: art.rest ? [art.rest] : [],
      };
      continue;
    }
    if (current) current.textLines.push(line);
  }
  flush();

  return { meta: { title, approval, subtitle }, articles };
}

/** جداکردن بخش لایحه اصلاحی از فایل تجارت (دو قانون در یک فایل) */
export function splitAtMarker(raw, marker) {
  const idx = raw.indexOf(marker);
  if (idx === -1) return { main: raw, rest: '', found: false };
  return { main: raw.slice(0, idx), rest: raw.slice(idx), found: true };
}

/* ------------------------------------------------------------------ *
 * ۲) تجزیه‌گر JSON ساختاریافته
 * ------------------------------------------------------------------ */
export function parseHubJson(raw) {
  const data = JSON.parse(raw);
  const meta = {
    title: clean(data.file_title || ''),
    note: clean(data.note || ''),
    articleRange: clean(data.article_range || ''),
  };
  const articles = [];

  /** استخراج شمارهٔ ماده از مقدارِ عددی یا رشته‌ایِ منبع */
  const parseNumber = (rawNum) => {
    let num = null;
    let mokarrar = false;
    let label = '';
    if (typeof rawNum === 'number') num = rawNum;
    else if (typeof rawNum === 'string') {
      const s = clean(rawNum);
      const digits = toEnDigits(s);
      const m = digits.match(/^([0-9]+)\s*(مکرر|تکراری)?$/);
      if (m) {
        num = Number(m[1]);
        mokarrar = Boolean(m[2]);
      } else {
        label = s;
      }
    }
    return { num, mokarrar, label };
  };

  /**
   * پیمایشِ بازگشتی: ماده‌ها می‌توانند در هر سطحی از درختِ تقسیمات باشند
   * (بخش → فصل → مبحث → …). پیش از این فقط سطحِ اول خوانده می‌شد و برای
   * برخی اسناد (مثل قانون امور حسبی و قانون امور گمرکی) بیشترِ مواد از دست می‌رفت.
   */
  const walk = (divisions, path) => {
    for (const div of divisions || []) {
      const nextPath = div.type && div.title ? [...path, clean(div.title)] : path;
      for (const a of div.articles || []) {
        const { num, mokarrar, label } = parseNumber(a.article_number);
        const body = clean(a.text || '');
        if (!body) continue;
        articles.push({ number: num, mokarrar, label, path: nextPath, text: body });
      }
      walk(div.subdivisions || [], nextPath);
    }
  };

  walk(data.divisions || [], []);
  return { meta, articles };
}

/* ------------------------------------------------------------------ *
 * ۳) تجزیه‌گر قانون اساسی (YAML)
 * ------------------------------------------------------------------ */
export function parseConstitutionYaml(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const articles = [];
  const chapters = new Map();
  const warnings = [];
  let currentChapter = '';
  let currentNumber = null;
  let buffer = [];
  let lastAccepted = 0;

  const flushArticle = () => {
    if (currentNumber === null) return;
    let body = buffer.join('\n')
      .replace(/^\s*text:\s*>?-?\s*/m, '')
      .split('\n')
      .map((l) => l.replace(/^\s{6,}/, ''))
      .join('\n');
    body = clean(body);
    if (body) {
      let number = Number(currentNumber);
      // اصلاح خطای ترتیب در منبع: اگر شماره‌ای تکراری/نزولی باشد، شماره بعدی در نظر گرفته می‌شود
      if (number <= lastAccepted) {
        const corrected = lastAccepted + 1;
        warnings.push(`اصل ${number} (شماره تکراری در منبع) به اصل ${corrected} نگاشت شد.`);
        number = corrected;
      }
      lastAccepted = number;
      articles.push({
        number,
        mokarrar: false,
        path: [currentChapter].filter(Boolean),
        text: body,
      });
    }
    buffer = [];
    currentNumber = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const chDef = line.match(/^-\s*&(ch\d+)\s*:\s*(.+)$/);
    if (chDef) {
      chapters.set(chDef[1], clean(chDef[2]));
      continue;
    }
    const chRef = line.match(/^\s*chapter:\s*\*?(ch\d+)/);
    if (chRef && chapters.has(chRef[1])) {
      flushArticle();
      currentChapter = chapters.get(chRef[1]);
      continue;
    }
    const idx = line.match(/^\s*index:\s*([0-9۰-۹]+)\s*$/);
    if (idx) {
      flushArticle();
      currentNumber = Number(toEnDigits(idx[1]));
      continue;
    }
    if (currentNumber !== null) {
      if (/^\s*(history|text):/.test(line) && !/^\s*text:/.test(line)) continue;
      buffer.push(line);
    }
  }
  flushArticle();
  return {
    meta: {
      title: 'قانون اساسی جمهوری اسلامی ایران',
      note: 'مصوب ۱۳۵۸/۰۹/۱۲ مجلس خبرگان قانون اساسی با اصلاحات ۱۳۶۸',
      articleRange: 'مقدمه و اصول ۱ تا ۱۷۷',
      warnings,
    },
    articles,
  };
}

/* ------------------------------------------------------------------ *
 * ابزارهای مشترک
 * ------------------------------------------------------------------ */
export function slugify(number, mokarrar) {
  return mokarrar ? `${number}-mokarrar` : String(number);
}

/** یکدست‌سازی خروجی همه تجزیه‌گرها به قالب استاندارد «کتابچه قانون» */
export function normalizeArticle(law, art, lawTitle) {
  const text = art.text;
  const amendments = extractAmendments(text);
  const { status, notes } = detectStatus(text);
  const id = `${law.id}-${slugify(art.number ?? art.label ?? 'na', art.mokarrar)}`;
  const numberFa = art.label ? art.label : toFaDigits(art.number) + (art.mokarrar ? ' مکرر' : '');
  return {
    id,
    lawId: law.id,
    number: art.label || Number(art.number),
    numberFa,
    numberValue: typeof art.number === 'number' ? art.number : null,
    mokarrar: Boolean(art.mokarrar),
    path: art.path || [],
    chapter: (art.path || []).join(' › '),
    text,
    notes,
    amendments,
    status,
    keywords: extractKeywords(text, 8),
    lawTitle,
    category: law.category,
    hierarchy: law.hierarchy,
  };
}

export function lawDates(approval) {
  return { approvalDate: approval ? toFaDigits(approval) : '', approvalSort: dateToSort(approval) };
}

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function readFileMaybe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file, data, pretty = false) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, pretty ? 1 : 0), 'utf8');
}
