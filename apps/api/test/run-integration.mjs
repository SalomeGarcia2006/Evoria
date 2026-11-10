import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const apiDirectory = fileURLToPath(new URL('..', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../../..', import.meta.url));
const composeFile = 'compose.alertas-test.yaml';
const testMongoUri =
  'mongodb://127.0.0.1:27129/?replicaSet=evoriaAlertTest&directConnection=true';

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd ?? repositoryDirectory,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(
        new Error(
          `${command} ${arguments_.join(' ')} terminó con ${signal ?? code}.`,
        ),
      );
    });
  });
}

try {
  await run('docker', [
    'compose',
    '-f',
    composeFile,
    'up',
    '--detach',
    '--wait',
  ]);
  await run(
    process.execPath,
    [
      '--require',
      'ts-node/register',
      '--test',
      'src/core.http.mongo.spec.ts',
      'src/auth/auth-flow.http.mongo.spec.ts',
      'src/auth/protected-routes.http.mongo.spec.ts',
      'src/tenants/tenant-context.http.mongo.spec.ts',
      'src/profiles/profiles-users.http.mongo.spec.ts',
      'src/events/operations.http.mongo.spec.ts',
      'src/budgets/budgets-dashboard.http.mongo.spec.ts',
      'src/alerts/replica-feasibility.mongo.spec.ts',
      'src/alerts/alerts.mongo.spec.ts',
      'src/alerts/alerts.http.mongo.spec.ts',
      'src/alerts/transactions.mongo.spec.ts',
    ],
    {
      cwd: apiDirectory,
      env: { EVORIA_TEST_MONGO_URI: testMongoUri },
    },
  );
} finally {
  await run('docker', [
    'compose',
    '-f',
    composeFile,
    'down',
    '--volumes',
    '--remove-orphans',
  ]).catch(() => undefined);
}
