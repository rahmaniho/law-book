#!/usr/bin/env python3
"""استخراج متن قوانین از «مرکز پژوهش‌های مجلس» (rc.majlis.ir) — بدون نیاز به مرورگر.

این اسکریپت با requests + BeautifulSoup کار می‌کند و برای صفحه‌هایی مناسب است
که متن قانون را به‌صورت HTML سمت سرور تحویل می‌دهند (بسیاری از صفحه‌های
rc.majlis.ir و نیز روزنامه رسمی در این دسته‌اند).

نمونه:

    python3 scripts/scrape/scrape_rc_majlis.py \
        --url "https://rc.majlis.ir/fa/law/show/135019" \
        --out data/sources/scraped

    # جست‌وجو در سایت مرکز پژوهش‌ها
    python3 scripts/scrape/scrape_rc_majlis.py --query "قانون تجارت" --dry-run

خروجی: فایل .txt در قالب corpus پروژه.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import quote, urljoin

from _common import (  # type: ignore[import-not-found]
    Article,
    Law,
    PoliteSession,
    Section,
    build_cli,
    clean,
    log,
    normalize_digits,
    slugify_fa,
    to_fa_digits,
    write_corpus_file,
)

BASE = "https://rc.majlis.ir"
SEARCH = BASE + "/fa/search?q={q}&type=law&page={page}"
NEXT_DATA = re.compile(r'"articleText"\s*:\s*"(.*?)"\s*,\s*"', re.S)


def require(module: str):
    try:
        return __import__(module)
    except ImportError:
        print(
            f"وابستگی «{module}» نصب نیست. اجرا کنید:\n  pip install -r scripts/scrape/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(2)


def html_to_text(html: str) -> str:
    bs = require("bs4")
    soup = bs.BeautifulSoup(html, "html.parser")
    for bad in soup(["script", "style", "noscript", "nav", "header", "footer", "form"]):
        bad.decompose()
    main = (
        soup.select_one("#lawText")
        or soup.select_one(".law-text")
        or soup.select_one(".content")
        or soup.select_one("article")
        or soup.body
        or soup
    )
    return main.get_text("\n")


def split_articles(text: str) -> tuple[str, list[Section]]:
    art_re = re.compile(r"^\s*ماده\s*([0-9۰-۹٠-٩]+)\s*(مکرر|تکراری)?\s*[:\-–.]?\s*")
    sec_re = re.compile(r"^\s*(کتاب|باب|فصل|مبحث|بخش|گفتار|مقدمه)\b")
    tab_re = re.compile(r"^\s*(تبصره|‌تبصره)\s*[0-9۰-۹]*\s*[:\-–.]?\s*")

    title = ""
    sections: list[Section] = []
    current = Section(title="")
    sections.append(current)
    cur_art: Article | None = None

    for raw in text.split("\n"):
        line = clean(raw)
        if not line:
            continue
        if not title and "ماده" not in line and len(line) < 160:
            title = line
            continue
        am, tm, sm = art_re.match(line), tab_re.match(line), sec_re.match(line)
        if am:
            cur_art = Article(number=am.group(1), text=line[am.end():].strip(), mokarrar=bool(am.group(2)))
            current.articles.append(cur_art)
        elif tm and cur_art is not None:
            cur_art.tabsoore.append(line[tm.end():].strip())
        elif sm and len(line) < 120:
            current = Section(title=line)
            sections.append(current)
            cur_art = None
        elif cur_art is not None:
            cur_art.text = f"{cur_art.text}\n{line}".strip()
        elif not current.title:
            current.title = line

    return title, [s for s in sections if s.articles or s.title]


def find_law_links(html: str, base: str) -> list[dict[str, str]]:
    bs = require("bs4")
    soup = bs.BeautifulSoup(html, "html.parser")
    out: list[dict[str, str]] = []
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if re.search(r"/fa/law/(show|print|mobile)/", href):
            label = clean(a.get_text(" "))
            out.append({"title": label, "url": urljoin(base, href)})
    return out


def main() -> int:
    ap = build_cli(__doc__ or "")
    ap.add_argument("--max-pages", type=int, default=2, help="حداکثر صفحه نتایج جست‌وجو (پیش‌فرض ۲)")
    args = ap.parse_args()

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    session = PoliteSession(BASE, delay=args.delay)
    written = 0

    targets = [{"title": "", "url": u} for u in args.url]

    for q in args.query:
        for page in range(1, args.max_pages + 1):
            url = SEARCH.format(q=quote(q), page=page)
            if not session.robots_allowed(url):
                print(f"× robots.txt اجازه نمی‌دهد: {url}", file=sys.stderr)
                continue
            log(args.verbose, f"… جست‌وجو {url}")
            status, html = session.get(url)
            if status != 200:
                print(f"× خطای {status}: {url}", file=sys.stderr)
                continue
            rows = find_law_links(html, BASE)
            log(args.verbose, f"  {len(rows)} نتیجه")
            if not rows:
                break
            targets.extend(rows)
            if args.limit and len(targets) >= args.limit:
                break

    seen: set[str] = set()
    unique = [t for t in targets if not (t["url"] in seen or seen.add(t["url"]))]

    if args.dry_run:
        for t in unique:
            print(f"- {t['title'] or '(بدون عنوان)'}\n  {t['url']}")
        print(f"\n{len(unique)} هدف (dry-run).")
        return 0

    for t in unique:
        if args.limit and written >= args.limit:
            break
        status, html = session.get(t["url"])
        if status != 200:
            print(f"× خطای {status}: {t['url']}", file=sys.stderr)
            continue
        text = html_to_text(html)
        title, sections = split_articles(text)
        label = clean(t["title"] or title or "قانون")
        if not any(s.articles for s in sections):
            print(f"× ماده‌ای استخراج نشد: {t['url']}", file=sys.stderr)
            continue
        if args.limit_articles:
            left = args.limit_articles
            trimmed = []
            for s in sections:
                if left <= 0:
                    break
                take = s.articles[:left]
                left -= len(take)
                trimmed.append(Section(title=s.title, articles=take))
            sections = trimmed
        law = Law(title=label, sections=sections, source_url=t["url"])
        stem = args.slug or slugify_fa(label)
        out_file = out_dir / f"{stem}.txt"
        if out_file.exists() and not args.overwrite:
            print(f"= موجود است: {out_file}")
            continue
        write_corpus_file(law, out_file, header_comment=f"استخراج‌شده از rc.majlis.ir — {to_fa_digits(law.article_count)} ماده")
        written += 1
        print(f"✓ {out_file} ({to_fa_digits(law.article_count)} ماده)")

    print(f"\n{written} فایل در {out_dir} نوشته شد.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
