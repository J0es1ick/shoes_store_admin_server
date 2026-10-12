import 'dotenv/config';

export const environment = () => ({
  fileStorage: process.env.STORE_STORAGE === 'file',
  dataFile: process.env.STORE_DATA_FILE || '.local/store.json',
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'shoes_store',
  },
});
