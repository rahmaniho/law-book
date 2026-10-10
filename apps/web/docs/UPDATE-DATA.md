# افزودن یا به‌روزرسانی قانون

سه مسیر برای تکمیل داده‌ها وجود دارد. هر سه مسیر در نهایت به یک چرخه می‌رسند:

```
منبع → data/sources/lawcorpus/<file>.txt → data/curated/catalog.json → npm run data:build → npm run data:validate
```

---

## مسیر ۱ (توصیه‌شده برای قوانین کامل): استخراج از سامانه ملی قوانین

```bash
pip install -r scripts/scrape/requirements.txt
python -m playwright install chromium

# ابتدا فقط فهرست نتایج را ببینید
python3 scripts/scrape/scrape_qavanin.py --query "قانون معادن" --dry-run

# سپس دریافت با فاصله‌گذاری محترمانه
python3 scripts/scrape/scrape_qavanin.py --query "قانون معادن" \
    --out data/sources/scraped --delay 4

# انتقال به منابع و افزودن به فهرست
cp data/sources/scraped/*.txt data/sources/lawcorpus/
node scripts/scrape/add_to_catalog.mjs \
    --id mining-law --file <نام-فایل>.txt \
    --title "قانون معادن" --short "معادن" \
    --category sayer --hierarchy statute \
    --date "1377/11/23" --checklist mining
```

> اسکریپت‌ها `robots.txt` را رعایت می‌کنند و در صورت منع متوقف می‌شوند. فاصله پیش‌فرض
> درخواست‌ها را کم نکنید. برای دریافت انبوه، ابتدا با پشتیبانی سامانه هماهنگ کنید.

## مسیر ۲: استخراج از مرکز پژوهش‌های مجلس (بدون مرورگر)

```bash
python3 scripts/scrape/scrape_rc_majlis.py --url "https://rc.majlis.ir/fa/law/show/…" \
    --out data/sources/scraped
```

## مسیر ۳ (دستی): آماده‌کردن فایل متنی

اگر متن را از منبع دیگری (مثلاً PDF روزنامه رسمی) دارید، فایل را با این قالب بسازید:

```
قانون نمونه
مصوب ۱۴۰۰/۰۱/۰۱

❯ فصل اول — کلیات
ماده ۱
متن ماده…
تبصره ۱ — متن تبصره…

ماده ۲
…
```

نکته‌ها:

- شماره ماده‌ها می‌تواند فارسی یا لاتین باشد.
- سطرهای `❯` سرفصل ساختار (کتاب/باب/فصل/مبحث/بخش/گفتار) هستند.
- «تبصره»ها به مادهٔ قبلی خود می‌چسبند.
- `ماده X مکرر` را با پسوند «مکرر» بنویسید.

سپس فایل را در `data/sources/lawcorpus/` بگذارید و با `add_to_catalog.mjs` (یا ویرایش دستی)
مدخل آن را به `data/curated/catalog.json` اضافه کنید.

---

## نمونه مدخل catalog.json

```json
{
  "id": "mining-law",
  "title": "قانون معادن",
  "shortTitle": "معادن",
  "category": "sayer",
  "hierarchy": "statute",
  "documentType": "قانون",
  "approvalDate": "۱۳۷۷/۱۱/۲۳",
  "approvalSort": 13771123,
  "source": { "kind": "corpus", "file": "mining-law.txt" },
  "summary": "…",
  "keywords": ["معدن", "پروانه اکتشاف", "بهره‌برداری"],
  "checklist": ["mining"],
  "fillFrom": { "kind": "hub", "file": "laws_…json", "label": "منبع پشتیبان" },
  "gapPolicy": { "movedTo": { "note": "مواد منتقل‌شده به سند دیگر", "ranges": [[21, 93]] } }
}
```

- `source.kind`: `corpus` (فایل متنی)، `hub` (JSON ساخت‌یافته)، `constitution`، `curated`.
  هر سند باید متن ماده‌به‌ماده داشته باشد؛ مادهٔ بدون متن در ساخت داده حذف می‌شود.
- `fillFrom`: برای تکمیل ماده‌های ناموجود از منبع دوم استفاده می‌شود.
- `gapPolicy.movedTo`: موادی که به سند دیگری منتقل شده‌اند و نباید «ناموجود» شمرده شوند.
- `checklist`: اگر قانونی از چک‌لیست پوشش را تأمین می‌کند، شناسه آن را اینجا بگذارید تا
  صفحهٔ «گزارش پوشش» به‌روز شود.

پس از افزودن:

```bash
npm run data:build       # ساخت نسخه جدید داده + هش‌ها
npm run data:validate    # بررسی ساختار/نرمال‌سازی/۲۵ آزمون صحت
```

سپس برنامه را با یک مرور یک‌باره (روی گوشی یا شبیه‌ساز) بازبینی کنید و در صورت امکان،
متن چند ماده را با روزنامه رسمی مقابله کنید.

## به‌روزرسانی قانون موجود

۱. فایل منبع را اصلاح یا جایگزین کنید (متن ماده‌ها یا افزودن ماده جدید).
۲. اگر تاریخ تصویب/اصلاحیه تغییر کرده، مدخل `catalog.json` را به‌روز کنید.
۳. `npm run data:build && npm run data:validate`.
۴. نسخه داده تغییر می‌کند و کاربران فقط **قانون تغییریافته** را دریافت می‌کنند (همگام‌سازی دلتا بر پایه هش).

## افزودن آیین‌نامه و مقررات (سطح «مقررات دولتی»)

برای تفکیک در جست‌وجو، مقدار `hierarchy` را `regulation` بگذارید و در `documentType`
مثلاً «آیین‌نامه» یا «تصویب‌نامه» بنویسید. اگر متن از پایگاه‌های دولتی گرفته می‌شود،
مجوز بازنشر و شرایط استفاده آن پایگاه را بررسی کنید.

## افزودن آرای وحدت رویه و نظریات مشورتی

این اسناد در `catalog.json` با `hierarchy: "precedent"` یا `hierarchy: "advisory"` ثبت می‌شوند.
هر رأی/نظر می‌تواند یک «ماده» با شماره پرونده/تاریخ باشد. برای هر مورد، شماره رأی، تاریخ صدور
و مرجع صادرکننده را در `summary` و `keywords` بیاورید تا جست‌وجو دقیق کار کند.
