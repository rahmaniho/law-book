import { createApp } from './app.ts';
import { readConfig } from './config.ts';

const config = readConfig();
const app = createApp();
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Sandbox API listening on port ${config.port}; payments disabled.`);
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => { await app.close(); });
}
