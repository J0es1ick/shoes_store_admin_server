require('dotenv').config();
const { Client } = require('pg');
async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS step_store_records (
      kind text NOT NULL CHECK (kind IN ('products','users','sessions','orders')),
      id text NOT NULL,
      payload jsonb NOT NULL,
      PRIMARY KEY(kind,id)
    )`);
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS step_store_user_email ON step_store_records ((payload->>'email')) WHERE kind='users'",
    );
    console.log(
      'STEP storefront schema is ready. Existing store tables were preserved.',
    );
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
