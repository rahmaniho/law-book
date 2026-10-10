'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info, Minus, Plus, RotateCcw, Scale, TriangleAlert } from 'lucide-react';
import { Card, Input, Segmented, Switch } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { BODY_GROUPS, BODY_ITEMS, computeDiyyahDetailed, type BodySelection } from '@/lib/calc/diyyeh-body';
import { toFaDigits } from '@/lib/fa';
import { cn } from '@/lib/utils';

type Unit = 'toman' | 'rial';

const nf = new Intl.NumberFormat('en-US');
const fmt = (n: number) => toFaDigits(nf.format(Math.round(n)));
const fractionText = ([n, d]: readonly [number, number]) =>
  n === d ? 'دیه کامل' : `${toFaDigits(`${n}/${d}`)} دیه`;

export default function DiyyahPage() {
  const [unit, setUnit] = useState<Unit>('toman');
  const [fullRaw, setFullRaw] = useState('');
  const [victimSex, setVictimSex] = useState<'male' | 'female'>('male');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [simultaneous, setSimultaneous] = useState(false);
  const [sacred, setSacred] = useState(false);

  const fullInput = Number(fullRaw.replace(/[^\d]/g, '')) || 0;
  const fullRial = unit === 'toman' ? fullInput * 10 : fullInput;

  const selections: BodySelection[] = useMemo(
    () => Object.entries(qty).filter(([, v]) => v > 0).map(([id, q]) => ({ id, qty: q })),
    [qty],
  );

  const result = useMemo(
    () => computeDiyyahDetailed({ fullRial, victimSex, selections, simultaneous, sacredPlaceOrMonth: sacred }),
    [fullRial, victimSex, selections, simultaneous, sacred],
  );

  const setItemQty = (id: string, next: number, max: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, next)) }));
  };

  const perUnit = (r: number) => (unit === 'toman' ? r / 10 : r);
  const unitLabel = unit === 'toman' ? 'تومان' : 'ریال';
  const hasFull = fullInput > 0;
  const hasSelection = result.lines.length > 0;

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>
      <SectionHeading
        title="محاسبه‌گر دیه"
        subtitle="بر پایهٔ کتاب چهارم قانون مجازات اسلامی (دیات) و دیهٔ کامل سال جاری"
      />

      <Card className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-[11.5px] text-muted-foreground">واحد ورودی و نمایش</p>
          <Segmented
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'toman', label: 'تومان' },
              { value: 'rial', label: 'ریال' },
            ]}
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11.5px] text-muted-foreground">
            مبلغ دیهٔ کامل سال جاری ({unitLabel})
          </span>
          <Input
            inputMode="numeric"
            value={fullRaw}
            onChange={(e) => setFullRaw(e.target.value.replace(/[^\d]/g, ''))}
            placeholder={unit === 'toman' ? 'مثلاً ۱۰۰۰۰۰۰۰۰۰' : 'مثلاً ۱۰۰۰۰۰۰۰۰۰۰۰'}
          />
          <span className="mt-1 block text-[10.5px] leading-5 text-muted-foreground">
            نرخ دیه هر سال توسط قوهٔ قضاییه اعلام می‌شود؛ همان مبلغ رسمی را وارد کنید.
            {hasFull && unit === 'toman' ? ` (معادل ${fmt(fullRial)} ریال)` : ''}
          </span>
        </label>

        <div>
          <p className="mb-2 text-[11.5px] text-muted-foreground">جنسیت مجنی‌علیه (زن یا مرد)</p>
          <Segmented
            value={victimSex}
            onChange={setVictimSex}
            options={[
              { value: 'male', label: 'مرد' },
              { value: 'female', label: 'زن' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] leading-5">
            آسیب‌ها در یک واقعه و همزمان بوده‌اند
            <span className="block text-[10.5px] text-muted-foreground">فقط دیهٔ اشد محاسبه می‌شود (ماده ۵۳۹)</span>
          </span>
          <Switch checked={simultaneous} onChange={setSimultaneous} label="همزمان" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] leading-5">
            قتل در ماه حرام یا حرم
            <span className="block text-[10.5px] text-muted-foreground">یک‌سوم به دیهٔ قتل افزوده می‌شود (مواد ۵۵۵ و ۵۵۶)</span>
          </span>
          <Switch checked={sacred} onChange={setSacred} label="ماه حرام" />
        </div>
      </Card>

      <SectionHeading
        title="انتخاب عضو یا جنایت"
        subtitle="برای هر عضو، تعداد آسیب‌دیده را انتخاب کنید. دیهٔ هر مورد طبق ماده قانونی آن محاسبه می‌شود."
      />

      <div className="space-y-3">
        {BODY_GROUPS.map((g) => {
          const items = BODY_ITEMS.filter((i) => i.group === g.id && (!i.onlyFor || i.onlyFor === victimSex));
          if (items.length === 0) return null;
          const selectedCount = items.filter((i) => (qty[i.id] ?? 0) > 0).length;
          return (
            <details key={g.id} className="group rounded-2xl border bg-card shadow-card" open={g.id === 'nafs'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5">
                <span>
                  <span className="block text-[13px] font-semibold">{g.title}</span>
                  <span className="mt-0.5 block text-[10.5px] text-muted-foreground">{g.description}</span>
                </span>
                {selectedCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                    {toFaDigits(selectedCount)} مورد
                  </span>
                ) : null}
              </summary>
              <ul className="divide-y border-t">
                {items.map((item) => {
                  const q = qty[item.id] ?? 0;
                  return (
                    <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium leading-5">{item.label}</p>
                        <p className="text-[10px] leading-4 text-muted-foreground">
                          {fractionText(item.fraction)}
                          {item.pair ? ' • زوج (هر دو: دیهٔ کامل)' : ''} • {item.article}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5" dir="ltr">
                        <button
                          type="button"
                          aria-label={`کاهش ${item.label}`}
                          onClick={() => setItemQty(item.id, q - 1, item.max)}
                          disabled={q <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-[12px] font-semibold tabular-nums">{toFaDigits(q)}</span>
                        <button
                          type="button"
                          aria-label={`افزایش ${item.label}`}
                          onClick={() => setItemQty(item.id, q + 1, item.max)}
                          disabled={q >= item.max}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setQty({})}
          disabled={selections.length === 0}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground disabled:opacity-40"
        >
          <RotateCcw size={12} /> پاک کردن انتخاب‌ها
        </button>
      </div>

      <SectionHeading title="نتیجه" />
      <Card className="p-4">
        {result.errors.length > 0 ? (
          <div className="mb-3 space-y-1 rounded-xl bg-red-500/10 p-2.5 text-[11px] leading-5 text-red-700 dark:text-red-300">
            {result.errors.map((e, i) => (
              <p key={i} className="flex gap-2">
                <TriangleAlert size={12} className="mt-1 shrink-0" /> {e}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Scale size={20} />
          </span>
          <div>
            <p className="text-lg font-bold text-primary">
              {hasFull && hasSelection ? `${fmt(perUnit(result.total))} ${unitLabel}` : '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {!hasFull
                ? 'ابتدا مبلغ دیهٔ کامل را وارد کنید.'
                : !hasSelection
                  ? 'حداقل یک عضو یا جنایت را انتخاب کنید.'
                  : `${toFaDigits(result.lines.reduce((s, l) => s + l.qty, 0))} مورد • معادل ${fmt(result.total)} ریال`}
            </p>
          </div>
        </div>

        {hasSelection ? (
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-right font-medium">مورد</th>
                  <th className="px-2 py-1.5 text-center font-medium">تعداد</th>
                  <th className="px-2 py-1.5 text-left font-medium">جمع ({unitLabel})</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.lines.map((l) => (
                  <tr key={l.item.id}>
                    <td className="px-2 py-2 align-top">
                      <span className="block leading-5">{l.item.label}</span>
                      <span className="block text-[9.5px] leading-4 text-muted-foreground">
                        {l.pairFull ? 'هر دو عضو زوج: دیهٔ کامل (ماده ۵۴۲)' : fractionText(l.item.fraction)}
                        {l.halved ? ' • نصف برای زن' : ''} • {l.item.article}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center align-top tabular-nums">{toFaDigits(l.qty)}</td>
                    <td className="px-2 py-2 text-left align-top tabular-nums">{fmt(perUnit(l.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3">
          {result.notes.map((n, i) => (
            <p key={i} className="flex gap-2 text-[10.5px] leading-5 text-muted-foreground">
              <Info size={12} className="mt-0.5 shrink-0" /> {n}
            </p>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
          این ماشین‌حساب طبق متن مواد دیات مخزن محاسبه می‌کند و جایگزین نظر کارشناس یا پزشکی قانونی نیست. موارد دارای
          «ارش» (مانند شکستگی فک یا آسیب اعضای داخلی بدون دیهٔ مقدر) و جراحات غیرمقدر، با نظر کارشناس تعیین می‌شوند.
        </div>

        <Link
          href="/laws/islamic-penal-code"
          className={cn(
            'mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-input bg-background text-sm font-medium active:scale-[0.98]',
          )}
        >
          مشاهده مواد دیات در قانون مجازات اسلامی
        </Link>
      </Card>
    </div>
  );
}
