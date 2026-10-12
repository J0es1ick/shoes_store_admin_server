// Import existing catalog as drafts. Original rows are never modified.
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
    const { rows } =
      await client.query(`SELECT p.product_id, p.name, p.description, p.current_price, b.brand_name, c.category_name,
      COALESCE((SELECT json_agg(trim(s.size)) FROM size s WHERE s.product_id=p.product_id), '[]'::json) AS sizes
      FROM product p LEFT JOIN brand b ON b.brand_id=p.brand_id LEFT JOIN category c ON c.category_id=p.category_id`);
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7351026)');
    let imported = 0;
    for (const row of rows) {
      if (
        !Number.isFinite(Number(row.current_price)) ||
        Number(row.current_price) <= 0
      )
        continue;
      const categoryName = String(row.category_name || '').toLowerCase();
      const category = /одеж|футбол|худи|shirt|cloth/.test(categoryName)
        ? 'clothing'
        : /аксесс|сумк|рюкзак|accessor/.test(categoryName)
          ? 'accessories'
          : /ботин|туфл|сапог|boot/.test(categoryName)
            ? 'shoes'
            : 'sneakers';
      const id = `legacy-${row.product_id}`;
      const product = {
        id,
        name: String(row.name).slice(0, 120),
        description: row.description || '',
        brand: row.brand_name || 'Без бренда',
        category,
        gender: 'unisex',
        price: Math.round(Number(row.current_price)),
        oldPrice: null,
        material: '',
        color: 'Уточняется',
        colorHex: '#b5bca8',
        images: ['/media/product-placeholder.svg'],
        stock: Object.fromEntries(
          (row.sizes.length ? row.sizes : ['ONE SIZE']).map((size) => [
            size,
            0,
          ]),
        ),
        badge: '',
        active: false,
        createdAt: new Date().toISOString(),
      };
      const result = await client.query(
        'INSERT INTO step_store_records(kind,id,payload) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO NOTHING',
        ['products', id, JSON.stringify(product)],
      );
      imported += result.rowCount;
    }
    await client.query('COMMIT');
    console.log(
      `Imported ${imported} catalog drafts. Add photos, verify prices and stock, then enable products in STEP admin. Existing catalog is unchanged.`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
