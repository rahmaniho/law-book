import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { readConfig } from '../src/config.ts';

test('defaults to sandbox and rejects live / misspelled modes', () => {
  assert.equal(readConfig({}).paymentMode, 'sandbox');
  for (const mode of ['live', 'production', '', 'Sandbox']) {
    assert.throws(() => createApp({ PAYMENT_MODE: mode }), /Only sandbox/);
  }
});
test('validates the listening port', () => {
  for (const port of ['abc', '0', '65536', '2.5']) assert.throws(() => readConfig({ PORT: port }), /PORT/);
});
test('health does not misrepresent payment readiness; payment calls fail closed', async () => {
  const app = createApp({});
  try {
    const health = await app.inject({ url: '/api/health' });
    assert.deepEqual(health.json(), { status: 'ok', paymentMode: 'sandbox', paymentsAvailable: false });
    const payment = await app.inject({ method: 'POST', url: '/api/payments', payload: { status: 'OK', amount: 1 } });
    assert.equal(payment.statusCode, 503);
    assert.equal(payment.json().code, 'PAYMENTS_NOT_CONFIGURED');
    const callback = await app.inject({ url: '/api/payments/callback?Status=OK' });
    assert.equal(callback.statusCode, 404);
  } finally { await app.close(); }
});
