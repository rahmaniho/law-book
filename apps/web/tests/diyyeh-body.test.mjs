import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiyyahDetailed, BODY_ITEMS } from '../src/lib/calc/diyyeh-body';

const FULL = 1_200_000_000;
const base = { fullRial: FULL, victimSex: 'male', simultaneous: false, sacredPlaceOrMonth: false };

test('دیه اعضا: جدول یکتا و کسرهای معتبر', () => {
  const ids = BODY_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const i of BODY_ITEMS) assert.ok(i.fraction[0] > 0 && i.fraction[1] >= i.fraction[0] && i.max >= 1, i.id);
});

test('دیه اعضا: یک چشم نصف دیه کامل است (ماده ۵۶۷)', () => {
  const r = computeDiyyahDetailed({ ...base, selections: [{ id: 'eye', qty: 1 }] });
  assert.equal(r.total, FULL / 2);
});

test('دیه اعضا: هر دو عضو زوج = دیه کامل (ماده ۵۴۲)', () => {
  const r = computeDiyyahDetailed({ ...base, selections: [{ id: 'eye', qty: 2 }] });
  assert.equal(r.total, FULL);
  assert.equal(r.lines[0].pairFull, true);
});

test('دیه اعضا: آسیب متوالی جمع می‌شود، همزمان فقط اشد (مواد ۵۳۸ و ۵۳۹)', () => {
  const sel = [{ id: 'hand', qty: 1 }, { id: 'finger', qty: 2 }];
  const seq = computeDiyyahDetailed({ ...base, selections: sel });
  assert.equal(seq.total, FULL / 2 + (FULL / 10) * 2);
  const sim = computeDiyyahDetailed({ ...base, simultaneous: true, selections: sel });
  assert.equal(sim.total, FULL / 2);
});

test('دیه اعضا: زن در آسیب ≥ ثلث نصف، در آسیب < ثلث برابر مرد', () => {
  const female = { ...base, victimSex: 'female' };
  const hand = computeDiyyahDetailed({ ...female, selections: [{ id: 'hand', qty: 1 }] });
  assert.equal(hand.lines[0].halved, true);
  assert.equal(hand.total, FULL / 4);
  const finger = computeDiyyahDetailed({ ...female, selections: [{ id: 'finger', qty: 1 }] });
  assert.equal(finger.lines[0].halved, false);
  assert.equal(finger.total, FULL / 10);
});

test('دیه اعضا: قتل زن نصف دیه مرد؛ ماه حرام یک‌سوم افزوده', () => {
  const r = computeDiyyahDetailed({ ...base, victimSex: 'female', selections: [{ id: 'killing', qty: 1 }] });
  assert.equal(r.total, FULL / 2);
  const h = computeDiyyahDetailed({ ...base, sacredPlaceOrMonth: true, selections: [{ id: 'killing', qty: 1 }] });
  assert.equal(h.total, FULL + FULL / 3);
});

test('دیه اعضا: حداکثر تعداد رعایت می‌شود و موارد جنسیتی فیلتر می‌شوند', () => {
  const r = computeDiyyahDetailed({ ...base, selections: [{ id: 'eye', qty: 9 }, { id: 'breast', qty: 1 }] });
  assert.ok(r.errors.length > 0);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].qty, 2);
});

test('دیه اعضا: مبلغ صفر خطا می‌دهد', () => {
  const r = computeDiyyahDetailed({ ...base, fullRial: 0, selections: [{ id: 'eye', qty: 1 }] });
  assert.ok(r.errors.length > 0);
});
