import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = fileURLToPath(new URL('..', import.meta.url));
const sourceDirectory = fileURLToPath(new URL('../src', import.meta.url));

async function findUnitTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? findUnitTests(join(directory, entry.name))
        : Promise.resolve([join(directory, entry.name)]),
    ),
  );

  return files
    .flat()
    .filter(
      (file) => file.endsWith('.spec.ts') && !file.endsWith('.mongo.spec.ts'),
    );
}

const testFiles = (await findUnitTests(sourceDirectory)).sort();

if (!testFiles.length) throw new Error('No se encontraron pruebas unitarias.');

const child = spawn(
  process.execPath,
  ['--require', 'ts-node/register', '--test', ...testFiles],
  {
    cwd: apiDirectory,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
