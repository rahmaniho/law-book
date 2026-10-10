import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL(new URL('./_loader.mjs', import.meta.url).pathname).href);
