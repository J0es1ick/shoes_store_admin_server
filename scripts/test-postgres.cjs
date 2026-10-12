const { spawnSync } = require('node:child_process');
require('dotenv').config();
if (!/test/i.test(process.env.DB_NAME || '')) {
  throw new Error('Use an isolated test database whose DB_NAME contains test.');
}
// Intended for the isolated test database supplied by CI or an explicit local caller.
const result = spawnSync(
  process.execPath,
  [
    require.resolve('jest/bin/jest'),
    '--config',
    'test/jest-e2e.json',
    '--runInBand',
  ],
  { stdio: 'inherit', env: { ...process.env, TEST_POSTGRES: 'true' } },
);
process.exit(result.status === null ? 1 : result.status);
