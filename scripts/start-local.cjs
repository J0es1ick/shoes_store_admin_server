process.env.STORE_STORAGE = 'file';
process.env.STORE_SEED = 'true';
process.env.STORE_PORT = process.env.STORE_PORT || '5200';
process.env.STORE_ORIGIN = process.env.STORE_ORIGIN || 'http://127.0.0.1:5180';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const dataFile = process.env.STORE_DATA_FILE || '.local/store.json';
const data = fs.existsSync(dataFile)
  ? JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  : { users: [] };
if (
  !data.users.some((user) => user.role === 'admin') &&
  !process.env.STORE_ADMIN_EMAIL
) {
  process.env.STORE_ADMIN_EMAIL = 'admin@step.local';
  process.env.STORE_ADMIN_PASSWORD = crypto
    .randomBytes(18)
    .toString('base64url');
  fs.mkdirSync('.local', { recursive: true });
  fs.writeFileSync(
    '.local/admin-credentials.txt',
    `Local STEP administrator only\nEmail: ${process.env.STORE_ADMIN_EMAIL}\nPassword: ${process.env.STORE_ADMIN_PASSWORD}\n`,
    { mode: 0o600 },
  );
  console.log(
    `Local administrator credentials: ${path.resolve('.local/admin-credentials.txt')}`,
  );
}
require('../dist/main.js');
