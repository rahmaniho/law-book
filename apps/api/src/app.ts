import Fastify from 'fastify';
import { readConfig } from './config.ts';

/** Scaffold only: no mock success, no financial state, no license issuance. */
export function createApp(env: NodeJS.ProcessEnv = process.env) {
  const config = readConfig(env);
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });
  app.get('/api/health', async () => ({
    status: 'ok', paymentMode: config.paymentMode, paymentsAvailable: false,
  }));
  app.post('/api/payments', async (_request, reply) => reply.code(503).send({
    code: 'PAYMENTS_NOT_CONFIGURED',
    message: 'Sandbox gateway, order storage and server-side verification are not implemented yet.',
  }));
  return app;
}
