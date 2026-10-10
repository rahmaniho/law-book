#!/usr/bin/env python3
"""استخراج متن قوانین از «سامانه ملی قوانین و مقررات» (qavanin.ir) با Playwright.

چرا Playwright؟ صفحه‌های qavanin.ir با جاوااسکریپت رندر می‌شوند و با requests
ساده قابل خواندن نیستند.

نمونه‌ها:

    # جست‌وجو و ذخیره دو قانون
    python3 scripts/scrape/scrape_qavanin.py \
        --query "قانون مدیریت خدمات کشوری" \
        --query "قانون معادن" \
        --out data/sources/scraped --delay 4

    # نشانی مستقیم (اگر شناسه صفحه را می‌دانید)
    python3 scripts/scrape/scrape_qavanin.py --url "https://qavanin.ir/Law/TreeText/?IDS=123456"

    # حالت امن: فقط فهرست نتایج را چاپ کن
    python3 scripts/scrape/scrape_qavanin.py --query "قانون کار" --dry-run

خروجی: فایل‌های .txt در قالب corpus پروژه (سازگار با scripts/lib/parse.mjs).
پس از اجرا: فایل را در data/sources/lawcorpus/ بگذارید، مدخل آن را در
data/curated/catalog.json اضافه کنید و `npm run data:build` را اجرا کنید.

⚠️ پیش از اجرا:
  * robots.txt و شرایط استفاده قوانین را بررسی کنید.
  * باکسِ «احترام به نرخ درخواست» را رعایت کنید (پیش‌فرض: هر ۴ ثانیه یک درخواست).
  * اگر قصد دریافت انبوه دارید، ابتدا با پشتیبانی سامانه هماهنگ کنید.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from _common import (  # type: ignore[import-not-found]
    Article,
    Law,
    PoliteSession,
    Section,
    build_cli,
    clean,
    log,
    slugify_fa,
    to_fa_digits,
    write_corpus_file,
)

BASE = "https://qavanin.ir"
SEARCH_URL = BASE + "/Law/SearchLaw?PageNumber={page}&SortBy=DateDesc&SearchText={query}"
LIST_SELECTOR_CANDIDATES = [
    "table tbody tr",
    ".law-list .law-item",
    "a[href*='/Law/TreeText']",
]
CONTENT_SELECTOR_CANDIDATES = [
    "#lawTreeText",
    ".law-text",
    ".LawTextContainer",
    "div[id*='Law']",
    ".content",
    "main",
]
ARTICLE_BLOCK_CANDIDATES = ["div.row", "div.article", "p", "div"]


def parse_articles_from_blocks(blocks: list[str]) -> tuple[str, list[Section]]:
    """از بلوک‌های متنی استخراج‌شده، ماده‌ها و سرفصل‌ها را جدا می‌کند."""
    title = ""
    sections: list[Section] = []
    current = Section(title="")
    sections.append(current)
    current_article: Article | None = None
    seen_numbers: set[str] = set()

    art_re = re.compile(r"^\s*ماده\s*([0-9۰-۹٠-٩]+)\s*(مکرر|تکراری)?\s*[:\-–.]?\s*")
    sec_re = re.compile(r"^\s*(کتاب|باب|فصل|مبحث|بخش|گفتار|مقدمه)\b")
    tab_re = re.compile(r"^\s*(تبصره|‌تبصره)\s*[0-9۰-۹]*\s*[:\-–.]?\s*")

    for i, raw in enumerate(blocks):
        text = clean(raw)
        if not text:
            continue
        if not title and i < 3 and "ماده" not in text:
            title = text
            continue

        am = art_re.match(text)
        tm = tab_re.match(text)
        sm = sec_re.match(text)

        if am:
            num = am.group(1)
            body = text[am.end():].strip()
            current_article = Article(number=num, text=body, mokarrar=bool(am.group(2)))
            current.articles.append(current_article)
            seen_numbers.add(num)
        elif tm and current_article is not None:
            current_article.tabsoore.append(text[tm.end():].strip())
        elif sm and (len(text) < 120):
            current = Section(title=text)
            sections.append(current)
            current_article = None
        elif current_article is not None:
            current_article.text = f"{current_article.text}\n{text}".strip()
        elif current.title:
            current.title = f"{current.title} {text}".strip()
        else:
            current.title = text

    sections = [s for s in sections if s.articles or s.title]
    return title, sections


def collect_search_results(page, query: str, page_no: int) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for sel in LIST_SELECTOR_CANDIDATES[:2]:
        items = page.query_selector_all(sel)
        if not items:
            continue
        for it in items:
            link = it.query_selector("a[href*='/Law']") or it
            href = link.get_attribute("href") if hasattr(link, "get_attribute") else None
            label = (it.inner_text() or "").strip().split("\n")[0]
            if href:
                if href.startswith("/"):
                    href = BASE + href
                rows.append({"title": label, "url": href})
        if rows:
            break
    if not rows:
        links = page.query_selector_all("a[href*='/Law/TreeText'], a[href*='/Law/']")
        for a in links:
            label = (a.inner_text() or "").strip()
            href = a.get_attribute("href") or ""
            if label and href:
                rows.append({"title": label, "url": href if href.startswith("http") else BASE + href})
    return rows


def extract_law_page(page) -> tuple[str, list[Section], str]:
    """متن قانون را از صفحه بازشده بیرون می‌کشد (چند سلکتور پشتیبان)."""
    title = ""
    h = page.query_selector("h1, .page-title, .title")
    if h:
        title = clean(h.inner_text())
    if not title and page.title():
        title = clean(page.title()).split("|")[0].strip()

    container = None
    for sel in CONTENT_SELECTOR_CANDIDATES:
        container = page.query_selector(sel)
        if container and (container.inner_text() or "").strip():
            break
    if container is None:
        container = page.query_selector("body")

    blocks: list[str] = []
    for sel in ARTICLE_BLOCK_CANDIDATES:
        nodes = container.query_selector_all(sel) if container else []
        texts = [clean(n.inner_text()) for n in nodes]
        texts = [t for t in texts if t]
        if len(texts) >= 5 and any("ماده" in t for t in texts):
            blocks = texts
            break
    if not blocks:
        body = clean(container.inner_text() if container else "")
        blocks = [ln for ln in body.split("\n") if ln.strip()]

    return title, blocks, page.url


def main() -> int:
    ap = build_cli(__doc__ or "")
    ap.add_argument("--headful", action="store_true", help="نمایش مرورگر (برای اشکال‌زدایی)")
    ap.add_argument("--dump-html", action="store_true", help="ذخیره HTML خام هر صفحه در پوشه خروجی")
    ap.add_argument("--max-pages", type=int, default=3, help="حداکثر صفحه نتایج جست‌وجو برای هر عبارت")
    args = ap.parse_args()

    try:
        from playwright.sync_api import TimeoutError as PWTimeout
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright نصب نیست. اجرا کنید:\n"
            "  pip install -r scripts/scrape/requirements.txt\n"
            "  python -m playwright install chromium",
            file=sys.stderr,
        )
        return 2

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    session = PoliteSession(BASE, delay=args.delay)
    written = 0
    targets: list[dict[str, str]] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not args.headful)
        ctx = browser.new_context(locale="fa-IR", user_agent=session.user_agent)
        page = ctx.new_page()
        page.set_default_timeout(45_000)

        # ۱) جمع‌آوری هدف‌ها از جست‌وجو
        for q in args.query:
            if not session.robots_allowed(SEARCH_URL.format(page=1, query="test")):
                print(f"× robots.txt اجازه جست‌وجو نمی‌دهد: {q}", file=sys.stderr)
                continue
            for page_no in range(1, args.max_pages + 1):
                url = SEARCH_URL.format(page=page_no, query=re.sub(r"\s+", "+", q))
                log(args.verbose, f"… جست‌وجو: {url}")
                session.wait()
                try:
                    page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_timeout(1500)
                except PWTimeout:
                    log(args.verbose, "  ! تایم‌اوت در بارگذاری صفحه جست‌وجو")
                    break
                rows = collect_search_results(page, q, page_no)
                log(args.verbose, f"  {len(rows)} نتیجه")
                if not rows:
                    break
                targets.extend(rows)
                if args.limit and len(targets) >= args.limit:
                    break
            if args.limit and len(targets) >= args.limit:
                break

        targets.extend({"title": "", "url": u} for u in args.url)

        # حذف تکراری‌ها
        seen: set[str] = set()
        unique: list[dict[str, str]] = []
        for t in targets:
            if t["url"] not in seen:
                seen.add(t["url"])
                unique.append(t)

        if args.dry_run:
            for t in unique:
                print(f"- {t['title'] or '(بدون عنوان)'}\n  {t['url']}")
            print(f"\n{len(unique)} هدف پیدا شد (حالت dry-run؛ چیزی دانلود نشد).")
            return 0

        # ۲) استخراج هر قانون
        for t in unique:
            if args.limit and written >= args.limit:
                break
            url = t["url"]
            if not session.robots_allowed(url):
                print(f"× robots.txt: رد شد {url}", file=sys.stderr)
                continue
            log(args.verbose, f"… دریافت {url}")
            session.wait()
            try:
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(1200)
            except PWTimeout:
                print(f"× تایم‌اوت: {url}", file=sys.stderr)
                continue

            title, blocks, final_url = extract_law_page(page)
            if args.dump_html:
                raw = out_dir / f"{slugify_fa(title or 'law')}.html"
                raw.write_text(page.content(), encoding="utf-8")
                log(args.verbose, f"  HTML خام → {raw}")

            title2, sections = parse_articles_from_blocks(blocks)
            label = clean(t['title'] or title or title2 or "قانون")
            if not any(s.articles for s in sections):
                print(f"× ماده‌ای استخراج نشد (ساختار صفحه تغییر کرده؟): {url}", file=sys.stderr)
                continue

            if args.limit_articles:
                left = args.limit_articles
                trimmed: list[Section] = []
                for s in sections:
                    if left <= 0:
                        break
                    take = s.articles[:left]
                    left -= len(take)
                    trimmed.append(Section(title=s.title, articles=take))
                sections = trimmed

            law = Law(title=label, sections=sections, source_url=final_url)
            stem = args.slug or slugify_fa(label)
            out_file = out_dir / f"{stem}.txt"
            if out_file.exists() and not args.overwrite:
                print(f"= موجود است (با --overwrite بازنویسی کنید): {out_file}")
                continue
            write_corpus_file(law, out_file, header_comment=f"استخراج‌شده از qavanin.ir — {to_fa_digits(law.article_count)} ماده")
            written += 1
            print(f"✓ {out_file}  ({to_fa_digits(law.article_count)} ماده)")

        ctx.close()
        browser.close()

    print(f"\n{written} فایل در {out_dir} نوشته شد.")
    print("مرحله بعد: فایل‌ها را در data/sources/lawcorpus/ بگذارید و npm run data:build را اجرا کنید.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
