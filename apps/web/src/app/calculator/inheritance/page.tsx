'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Info, RotateCcw } from 'lucide-react';
import { Button, Card, Input, Segmented, Switch } from '@/components/ui/primitives';
import { SectionHeading } from '@/components/bits';
import { computeInheritance, EMPTY_INHERITANCE_INPUT, type InheritanceInput } from '@/lib/calc/inheritance';
import { formatTomanUnit } from '@/lib/calc/diyyeh';
import { toFaDigits } from '@/lib/fa';
import { useApp } from '@/lib/store';

export default function InheritancePage() {
  const [input, setInput] = useState<InheritanceInput>({ ...EMPTY_INHERITANCE_INPUT, estate: 0 });
  const reader = useApp((s) => s.reader);
  const result = useMemo(() => computeInheritance(input), [input]);
  const set = <K extends keyof InheritanceInput>(key: K, value: InheritanceInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="app-container pb-10">
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <ArrowRight size={13} /> خانه
      </Link>
      <SectionHeading
        title="محاسبه‌گر ارث"
        subtitle="بر پایه مواد ۸۶۲ تا ۹۴۹ قانون مدنی — نتیجه‌ای برای برآورد اولیه"
      />

      <Card className="space-y-3.5 p-4">
        <Field label="جنسیت متوفی">
          <Segmented
            value={input.deceasedSex}
            onChange={(v) => set('deceasedSex', v)}
            options={[
              { value: 'male', label: 'مرد' },
              { value: 'female', label: 'زن' },
            ]}
          />
        </Field>

        <Field label="ارزش کل ترکه (تومان)">
          <Input
            inputMode="numeric"
            value={input.estate ? String(input.estate) : ''}
            onChange={(e) => set('estate', Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
            placeholder="مثلاً 1000000000"
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[12.5px]">همسر زنده است</span>
          <Switch checked={input.spouse} onChange={(v) => set('spouse', v)} label="همسر" />
        </div>

        {input.spouse && input.deceasedSex === 'male' ? (
          <Field label="تعداد همسران (حداکثر ۴)">
            <Segmented
              value={String(Math.min(4, input.wives || 1))}
              onChange={(v) => set('wives', Number(v))}
              options={[
                { value: '1', label: '۱' },
                { value: '2', label: '۲' },
                { value: '3', label: '۳' },
                { value: '4', label: '۴' },
              ]}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="پسر">
            <NumberInput value={input.children.sons} onChange={(v) => set('children', { ...input.children, sons: v })} />
          </Field>
          <Field label="دختر">
            <NumberInput value={input.children.daughters} onChange={(v) => set('children', { ...input.children, daughters: v })} />
          </Field>
        </div>

        {input.children.sons + input.children.daughters === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="نوه پسر (در نبود فرزند)">
              <NumberInput
                value={input.grandchildren.sons}
                onChange={(v) => set('grandchildren', { ...input.grandchildren, sons: v })}
              />
            </Field>
            <Field label="نوه دختر">
              <NumberInput
                value={input.grandchildren.daughters}
                onChange={(v) => set('grandchildren', { ...input.grandchildren, daughters: v })}
              />
            </Field>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="text-[12.5px]">پدر زنده است</span>
          <Switch checked={input.father} onChange={(v) => set('father', v)} label="پدر" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px]">مادر زنده است</span>
          <Switch checked={input.mother} onChange={(v) => set('mother', v)} label="مادر" />
        </div>

        {/* طبقه دوم */}
        {input.children.sons + input.children.daughters === 0 &&
        input.grandchildren.sons + input.grandchildren.daughters === 0 &&
        !input.father &&
        !input.mother ? (
          <div className="space-y-3 border-t pt-3">
            <p className="text-[12px] font-medium">طبقه دوم (برادر و خواهر)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="برادر ابوینی">
                <NumberInput
                  value={input.siblings.fullBrothers}
                  onChange={(v) => set('siblings', { ...input.siblings, fullBrothers: v })}
                />
              </Field>
              <Field label="خواهر ابوینی">
                <NumberInput
                  value={input.siblings.fullSisters}
                  onChange={(v) => set('siblings', { ...input.siblings, fullSisters: v })}
                />
              </Field>
              <Field label="برادر مادری">
                <NumberInput
                  value={input.siblings.maternalBrothers}
                  onChange={(v) => set('siblings', { ...input.siblings, maternalBrothers: v })}
                />
              </Field>
              <Field label="خواهر مادری">
                <NumberInput
                  value={input.siblings.maternalSisters}
                  onChange={(v) => set('siblings', { ...input.siblings, maternalSisters: v })}
                />
              </Field>
            </div>
          </div>
        ) : null}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setInput({ ...EMPTY_INHERITANCE_INPUT, estate: 0 })}
        >
          <RotateCcw size={15} /> پاک کردن فرم
        </Button>
      </Card>

      {/* نتیجه */}
      <SectionHeading title="نتیجه محاسبه" />
      <Card className="p-4">
        {!result.supported ? (
          <p className="text-[12px] leading-6 text-amber-700 dark:text-amber-400">{result.warnings.join(' ')}</p>
        ) : (
          <>
            <ul className="divide-y">
              {result.shares.map((s, i) => (
                <li key={i} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium">{s.heir}</span>
                    <span className="text-[12px] text-primary">{formatTomanUnit(s.amount)}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    سهم: {s.fraction} — مستند: {s.basis}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-[12.5px] font-semibold">
              <span>جمع سهم‌ها</span>
              <span className="text-primary">{formatTomanUnit(result.total)}</span>
            </div>
            {result.remainder > 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                باقی‌مانده: {formatTomanUnit(result.remainder)} (در فرض ردّ یا تعیین تکلیف سایر طبقات)
              </p>
            ) : null}
          </>
        )}

        <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-3">
          {result.notes.map((n, i) => (
            <p key={i} className="flex gap-2 text-[10.5px] leading-5 text-muted-foreground">
              <Info size={12} className="mt-0.5 shrink-0" /> {n}
            </p>
          ))}
        </div>

        <p className="mt-3 flex gap-2 rounded-xl bg-amber-500/10 p-2.5 text-[10.5px] leading-5 text-amber-800 dark:text-amber-300">
          <Calculator size={13} className="mt-0.5 shrink-0" />
          این محاسبه‌گر «برآورد اولیه» است و مواردی مانند وصیت، دین، حجب پیچیده، حمل و کلاله را به‌طور کامل پوشش نمی‌دهد.
          برای تقسیم رسمی، به{' '}
          <Link href="/laws/civil-code" className="underline">
            مواد قانون مدنی
          </Link>{' '}
          و نظر کارشناس مراجعه کنید.
        </p>
      </Card>

      <p className="mt-4 text-center text-[10.5px] text-muted-foreground">
        اندازه متن فعلی: {toFaDigits(reader.fontSize)}px — از تنظیمات قابل تغییر است.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5">
      <button
        className="h-7 w-7 rounded-lg bg-muted text-base leading-none"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="کاهش"
        type="button"
      >
        −
      </button>
      <span className="flex-1 text-center text-[13px] font-medium">{toFaDigits(value)}</span>
      <button
        className="h-7 w-7 rounded-lg bg-muted text-base leading-none"
        onClick={() => onChange(Math.min(20, value + 1))}
        aria-label="افزایش"
        type="button"
      >
        +
      </button>
    </div>
  );
}
