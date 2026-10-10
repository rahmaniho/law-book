"""ابزارهای مشترک اسکریپت‌های استخراج متن قوانین.

خروجی همه اسکریپت‌ها یک فایل متنی با قالب «corpus» این پروژه است؛ یعنی:

    نام قانون
    مصوب ۱۴۰۲/۰۶/۲۲

    ❯ باب اول — کلیات
    ماده ۱
    متن ماده ...
    تبصره ۱ — متن تبصره ...

    ماده ۲
    ...

این قالب همان چیزی است که `scripts/lib/parse.mjs` می‌خواند؛ بنابراین پس از
اجرای اسکریپت، فقط کافی است فایل خروجی را در `data/sources/lawcorpus/` بگذارید،
در `data/curated/catalog.json` یک مدخل جدید اضافه کنید و `npm run data:build`
را اجرا کنید.

⚠️ توجه حقوقی: متن قوانین ایران سند رسمی و فاقد حمایت حقوق مؤلف است، اما
   *پایگاه‌داده‌های ویرایش‌شده* ممکن است شرایط استفاده داشته باشند. پیش از
   بازنشر انبوه، شرایط هر منبع را بررسی کنید. همچنین محدودیت‌های robots.txt و
   نرخ درخواست را رعایت کنید.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
import unicodedata
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator, Sequence
from urllib.parse import urljoin, urlparse

# ---------------------------------------------------------------- نرمال‌سازی

_PRESENTATION = {
    "\u0640": "",  # کشیده (تطویل)
    "\u200f": "",  # RTL mark
    "\u200e": "",  # LTR mark
    "\ufeff": "",
}
_MAP = {
    "ي": "ی",
    "ى": "ی",
    "ﻯ": "ی",
    "ﻰ": "ی",
    "ك": "ک",
    "ﻙ": "ک",
    "ﻚ": "ک",
    "ة": "ه",
    "ۀ": "ه",
    "ٔ": "",
    "ء": "ء",
}
_DIGITS_FA = "۰۱۲۳۴۵۶۷۸۹"
_DIGITS_AR = "٠١٢٣٤٥٦٧٨٩"


def clean(text: str) -> str:
    """پاک‌سازی متن فارسی: حروف عربی، فاصله‌های عجیب، نویسه‌های کنترلی."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    for bad, good in _PRESENTATION.items():
        text = text.replace(bad, good)
    for bad, good in _MAP.items():
        text = text.replace(bad, good)
    text = re.sub(r"[\u200b\u200c\u200d]", " ", text)  # نیم‌فاصله → فاصله (فقط برای تطبیق)
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip()


def normalize_digits(text: str) -> str:
    """ارقام فارسی/عربی → ارقام لاتین (برای شماره‌گذاری مواد)."""
    out = []
    for ch in text:
        if ch in _DIGITS_FA:
            out.append(str(_DIGITS_FA.index(ch)))
        elif ch in _DIGITS_AR:
            out.append(str(_DIGITS_AR.index(ch)))
        else:
            out.append(ch)
    return "".join(out)


ARTICLE_RE = re.compile(r"^\s*ماده\s*([0-9۰-۹٠-٩]+)\s*(مکرر|تکراری)?\s*[:\-–.]?\s*(.*)$")
SECTION_RE = re.compile(r"^\s*(کتاب|باب|فصل|مبحث|بخش|گفتار|مقدمه)\b[^\n]*$")
TABSOORE_RE = re.compile(r"^\s*(تبصره|‌تبصره)\s*[0-9۰-۹]*\s*[:\-–.]?\s*(.*)$")
DATE_RE = re.compile(r"مصوب\s*([0-9۰-۹]{4}[/\-][0-9۰-۹]{1,2}[/\-][0-9۰-۹]{1,2})")


def to_fa_digits(text: str) -> str:
    return "".join(_DIGITS_FA[int(c)] if c.isdigit() else c for c in str(text))


# ---------------------------------------------------------------- مدل داده


@dataclass
class Article:
    number: str
    text: str
    mokarrar: bool = False
    tabsoore: list[str] = field(default_factory=list)


@dataclass
class Section:
    title: str
    articles: list[Article] = field(default_factory=list)


@dataclass
class Law:
    title: str
    approval_date: str = ""
    sections: list[Section] = field(default_factory=list)
    source_url: str = ""
    notes: list[str] = field(default_factory=list)

    @property
    def article_count(self) -> int:
        return sum(len(s.articles) for s in self.sections)


# ---------------------------------------------------------------- قالب خروجی


def write_corpus_file(law: Law, path: Path, *, header_comment: str = "") -> Path:
    """نوشتن قانون در قالب متنی corpus (سازگار با scripts/lib/parse.mjs)."""
    lines: list[str] = []
    if header_comment:
        lines.append(f"# {header_comment}")
    lines.append(law.title.strip())
    if law.approval_date:
        lines.append(f"مصوب {law.approval_date}")
    if law.source_url:
        lines.append(f"منبع: {law.source_url}")
    lines.append("")

    for section in law.sections:
        if section.title:
            lines.append(f"❯ {section.title.strip()}")
            lines.append("")
        for art in section.articles:
            num = normalize_digits(str(art.number))
            suffix = " مکرر" if art.mokarrar else ""
            lines.append(f"ماده {num}{suffix}")
            body = clean(art.text)
            if body:
                lines.extend(body.split("\n"))
            for i, tab in enumerate(art.tabsoore, start=1):
                prefix = f"تبصره {i}" if len(art.tabsoore) > 1 else "تبصره"
                lines.append(f"{prefix} — {clean(tab)}")
            lines.append("")

    path.parent.mkdir(parents=True, exist_ok=True)
    text = "\r\n".join(line.rstrip() for line in lines).strip() + "\r\n"
    path.write_text(text, encoding="utf-8")
    return path


def parse_corpus_file(path: Path) -> Law:
    """خواندن یک فایل corpus (برای ادغام یا بازبینی)."""
    raw = path.read_text(encoding="utf-8")
    lines = [ln.strip() for ln in raw.replace("\r\n", "\n").split("\n")]
    law_title = lines[0] if lines else path.stem
    approval = ""
    law = Law(title=clean(law_title))
    current_section = Section(title="")
    law.sections.append(current_section)
    current_article: Article | None = None

    for line in lines[1:]:
        if not line or line.startswith("#"):
            continue
        m = DATE_RE.search(line)
        if m and not approval:
            approval = normalize_digits(m.group(1)).replace("-", "/")
            law.approval_date = approval
            continue
        if line.startswith("منبع:"):
            law.source_url = line.split(":", 1)[1].strip()
            continue
        if line.startswith("❯"):
            current_section = Section(title=line.lstrip("❯ ").strip())
            law.sections.append(current_section)
            continue
        am = ARTICLE_RE.match(line)
        if am and (am.group(2) or not am.group(3) or len(am.group(3)) < 60):
            current_article = Article(
                number=normalize_digits(am.group(1)),
                text=am.group(3).strip(),
                mokarrar=bool(am.group(2)),
            )
            current_section.articles.append(current_article)
            continue
        tm = TABSOORE_RE.match(line)
        if tm and current_article is not None:
            current_article.tabsoore.append(tm.group(2).strip())
            continue
        if current_article is not None:
            current_article.text = f"{current_article.text}\n{line}".strip()
        else:
            current_section.title = f"{current_section.title} {line}".strip()

    law.sections = [s for s in law.sections if s.articles or s.title]
    return law


# ---------------------------------------------------------------- شبکه


class PoliteSession:
    """نشست HTTP با رعایت robots.txt و فاصله‌گذاری بین درخواست‌ها."""

    def __init__(self, base_url: str, *, delay: float = 3.0, user_agent: str | None = None):
        self.base_url = base_url
        self.delay = delay
        self.user_agent = user_agent or (
            "KetabcheGhanounBot/1.0 (+https://karen-soft.ir; research & offline reference; contact: karen-soft.ir)"
        )
        self._last = 0.0
        self._robots: urllib.robotparser.RobotFileParser | None = None

    def robots_allowed(self, url: str, *, timeout: int = 10) -> bool:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        if self._robots is None:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(robots_url)
            try:
                import urllib.request

                req = urllib.request.Request(robots_url, headers={"User-Agent": self.user_agent})
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    rp.parse(resp.read().decode("utf-8", "ignore").splitlines())
            except Exception:
                rp.allow_all = False  # در نبود robots.txt محتاطانه: فقط مسیرهای عمومی
                rp.disallow_all = False
                rp._rules = []  # noqa: SLF001
            self._robots = rp
        try:
            return self._robots.can_fetch(self.user_agent, url)
        except Exception:
            return False

    def wait(self) -> None:
        elapsed = time.time() - self._last
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last = time.time()

    def get(self, url: str, *, timeout: int = 30) -> tuple[int, str]:
        """درخواست GET با urllib (بدون وابستگی اجباری به requests)."""
        import urllib.error
        import urllib.request

        if not self.robots_allowed(url):
            raise PermissionError(f"robots.txt اجازه دسترسی به {url} را نمی‌دهد")
        self.wait()
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent, "Accept-Language": "fa,en"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.status, resp.read().decode(charset, "ignore")
        except urllib.error.HTTPError as e:  # noqa: PERF203
            return e.code, ""


# ---------------------------------------------------------------- CLI کمکی


def build_cli(description: str) -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", "-o", type=Path, default=Path("data/sources/scraped"), help="پوشه خروجی (پیش‌فرض: data/sources/scraped)")
    ap.add_argument("--delay", type=float, default=3.0, help="فاصله بین درخواست‌ها به ثانیه (پیش‌فرض ۳)")
    ap.add_argument("--limit", type=int, default=0, help="حداکثر تعداد قانون (۰ = بی‌نهایت)")
    ap.add_argument("--limit-articles", type=int, default=0, help="حداکثر تعداد ماده در هر قانون (۰ = همه)")
    ap.add_argument("--url", action="append", default=[], help="نشانی مستقیم صفحه قانون (قابل تکرار)")
    ap.add_argument("--query", "-q", action="append", default=[], help="عبارت جست‌وجو (قابل تکرار)")
    ap.add_argument("--slug", default="", help="نام فایل خروجی (پیش‌فرض از عنوان ساخته می‌شود)")
    ap.add_argument("--overwrite", action="store_true", help="بازنویسی فایل‌های موجود")
    ap.add_argument("--dry-run", action="store_true", help="فقط فهرست را نشان بده، چیزی دانلود نکن")
    ap.add_argument("--verbose", "-v", action="store_true")
    return ap


def slugify_fa(text: str) -> str:
    out = normalize_digits(clean(text)).lower()
    out = re.sub(r"[^\w\u0600-\u06FF\s-]", "", out, flags=re.UNICODE)
    out = re.sub(r"[\s_]+", "-", out).strip("-")
    return out or "law"


def log(verbose: bool, *args: object) -> None:
    if verbose:
        print(*args, file=sys.stderr, flush=True)


def timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


__all__ = [
    "Article",
    "Law",
    "PoliteSession",
    "Section",
    "ARTICLE_RE",
    "DATE_RE",
    "SECTION_RE",
    "TABSOORE_RE",
    "build_cli",
    "clean",
    "log",
    "normalize_digits",
    "parse_corpus_file",
    "slugify_fa",
    "timestamp",
    "to_fa_digits",
    "write_corpus_file",
]
