import { cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const web = resolve(import.meta.dirname, '../..');
const standalone = join(web, '.next/standalone/apps/web');
cpSync(join(web, '.next/static'), join(standalone, '.next/static'), {
  recursive: true,
});
cpSync(join(web, 'public'), join(standalone, 'public'), { recursive: true });
process.env.PORT = '3100';
process.env.HOSTNAME = 'localhost';
await import(pathToFileURL(join(standalone, 'server.js')).href);
