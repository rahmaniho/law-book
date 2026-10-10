export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const paymentMode = env.PAYMENT_MODE ?? 'sandbox';
  if (paymentMode !== 'sandbox') {
    throw new Error('Only sandbox mode is allowed. Live payments are not implemented.');
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return { paymentMode: 'sandbox' as const, port };
}
