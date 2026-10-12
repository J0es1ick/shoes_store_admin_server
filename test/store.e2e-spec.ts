import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { configureHttp } from '../src/app/configure-http';
import { StoreRepository } from '../src/application/ports/store.repository';
import { environment } from '../src/infrastructure/config/environment';
import { FileStoreRepository } from '../src/infrastructure/persistence/file-store.repository';
import { emptyStore, StoreProduct } from '../src/domain/models';
import { PostgresStoreRepository } from '../src/infrastructure/persistence/postgres-store.repository';
import { seedProducts } from '../src/infrastructure/seed/catalog';

const testedProduct = (products: StoreProduct[]) =>
  products.find((product) => product.id === 'sage-runner')!;

@Controller('legacy')
class LegacyController {
  @Get() list() {
    return ['private'];
  }
}

describe('STEP storefront HTTP contracts', () => {
  let app: INestApplication;
  let repo: StoreRepository;
  let folder: string;
  let customer: ReturnType<typeof request.agent>;
  let other: ReturnType<typeof request.agent>;
  let admin: ReturnType<typeof request.agent>;
  const checkout = (overrides = {}) => ({
    items: [{ productId: 'sage-runner', size: '40', quantity: 1 }],
    name: 'Тестовый покупатель',
    phone: '+7 999 000-00-00',
    address: 'Тестовый город, улица Тестовая, дом 1',
    comment: '',
    delivery: 'courier',
    payment: 'on_receipt',
    requestId: randomUUID(),
    ...overrides,
  });

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'step-test-'));
    process.env.STORE_STORAGE =
      process.env.TEST_POSTGRES === 'true' ? 'postgres' : 'file';
    process.env.STORE_DATA_FILE = join(folder, 'store.json');
    process.env.STORE_SEED = 'true';
    process.env.STORE_ORIGIN = 'http://127.0.0.1:5180';
    process.env.STORE_ADMIN_EMAIL = 'admin@example.test';
    process.env.STORE_ADMIN_PASSWORD = 'TestAdminOnly123!';
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [LegacyController],
    }).compile();
    if (process.env.TEST_POSTGRES === 'true') {
      if (!/test/i.test(process.env.DB_NAME || ''))
        throw new Error('Use an isolated test database.');
      await module.get(StoreRepository).transaction((data) => {
        Object.assign(data, emptyStore());
      });
    }
    app = module.createNestApplication();
    configureHttp(app, '');
    await app.init();
    repo = app.get(StoreRepository);
    customer = request.agent(app.getHttpServer());
    other = request.agent(app.getHttpServer());
    admin = request.agent(app.getHttpServer());
    await customer
      .post('/api/store/auth/register')
      .send({
        name: 'Покупатель',
        email: 'buyer@example.test',
        password: 'Customer123!',
      })
      .expect(201);
    await other
      .post('/api/store/auth/register')
      .send({
        name: 'Другой',
        email: 'other@example.test',
        password: 'Customer123!',
      })
      .expect(201);
    await admin
      .post('/api/store/auth/login')
      .send({ email: 'admin@example.test', password: 'TestAdminOnly123!' })
      .expect(201);
  }, 30000);
  beforeEach(async () => {
    await repo.transaction((data) => {
      data.products = seedProducts();
      data.orders = [];
    });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (folder) await rm(folder, { recursive: true, force: true });
  });

  it('serves the public catalog without personal data', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/store/products')
      .expect(200);
    expect(response.body).toHaveLength(8);
    expect(testedProduct(response.body).stock['40']).toBe(8);
    expect(JSON.stringify(response.body)).not.toContain('password');
  });
  it('uses httpOnly sessions and never returns a password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/store/auth/login')
      .send({ email: 'buyer@example.test', password: 'Customer123!' })
      .expect(201);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.role).toBe('customer');
    expect(
      (await repo.read()).users.find((u) => u.email === 'buyer@example.test')!
        .passwordHash,
    ).not.toContain('Customer123!');
  });
  it('rejects invalid credentials, duplicate email and role injection', async () => {
    await request(app.getHttpServer())
      .post('/api/store/auth/login')
      .send({ email: 'buyer@example.test', password: 'Wrong123!' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/store/auth/register')
      .send({
        name: 'Test',
        email: 'BUYER@example.test',
        password: 'Customer123!',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/store/auth/register')
      .send({
        name: 'Test',
        email: 'new@example.test',
        password: 'Customer123!',
        role: 'admin',
      })
      .expect(400);
    await customer
      .patch('/api/store/profile')
      .send({ name: 'Test', phone: '', address: '', role: 'admin' })
      .expect(400);
  });
  it('enforces admin authorization on both new and unannotated legacy routes', async () => {
    await request(app.getHttpServer()).get('/api/store/admin').expect(401);
    await customer.get('/api/store/admin').expect(403);
    await customer.get('/api/legacy').expect(403);
    await admin.get('/api/legacy').expect(200);
    const response = await admin.get('/api/store/admin').expect(200);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });
  it('rejects cross-origin state changes', async () => {
    await customer
      .patch('/api/store/profile')
      .set('Origin', 'https://untrusted.example')
      .send({ name: 'Changed', phone: '', address: '' })
      .expect(403);
  });
  it('persists profiles and favorites', async () => {
    await customer
      .patch('/api/store/profile')
      .send({
        name: 'Новое имя',
        phone: '+7 999 000-00-00',
        address: 'Тестовый адрес',
      })
      .expect(200);
    await customer
      .patch('/api/store/favorites/sage-runner')
      .send({ saved: true })
      .expect(200);
    const me = await customer.get('/api/store/auth/me').expect(200);
    expect(me.body.name).toBe('Новое имя');
    expect(me.body.favorites).toContain('sage-runner');
  });
  it('calculates totals from the catalog, charges delivery and decrements stock', async () => {
    const response = await customer
      .post('/api/store/orders')
      .send(checkout())
      .expect(201);
    expect(response.body.total).toBe(9480);
    expect(response.body.deliveryCost).toBe(490);
    expect(response.body.status).toBe('new');
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(7);
    await customer
      .post('/api/store/orders')
      .send(checkout({ total: 1 }))
      .expect(400);
  });
  it('offers free pickup and free delivery above the threshold', async () => {
    const pickup = await customer
      .post('/api/store/orders')
      .send(checkout({ delivery: 'pickup', address: '' }))
      .expect(201);
    expect(pickup.body.total).toBe(8990);
    const courier = await customer
      .post('/api/store/orders')
      .send(
        checkout({
          items: [{ productId: 'sage-runner', size: '41', quantity: 2 }],
        }),
      )
      .expect(201);
    expect(courier.body.deliveryCost).toBe(0);
    expect(courier.body.total).toBe(17980);
  });
  it('is idempotent and keeps another customer’s orders private', async () => {
    const input = checkout();
    const first = await customer
      .post('/api/store/orders')
      .send(input)
      .expect(201);
    const second = await customer
      .post('/api/store/orders')
      .send(input)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    expect((await customer.get('/api/store/orders')).body).toHaveLength(1);
    expect((await other.get('/api/store/orders')).body).toHaveLength(0);
    await other.post(`/api/store/orders/${first.body.id}/cancel`).expect(404);
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(7);
  });
  it('validates sizes, quantities, address and performs atomic rollback', async () => {
    await customer
      .post('/api/store/orders')
      .send(
        checkout({
          items: [{ productId: 'sage-runner', size: 'XX', quantity: 1 }],
        }),
      )
      .expect(409);
    await customer
      .post('/api/store/orders')
      .send(
        checkout({
          items: [{ productId: 'sage-runner', size: '40', quantity: -1 }],
        }),
      )
      .expect(400);
    await customer
      .post('/api/store/orders')
      .send(checkout({ address: ' ' }))
      .expect(400);
    await customer
      .post('/api/store/orders')
      .send(
        checkout({
          items: [
            { productId: 'sage-runner', size: '40', quantity: 1 },
            { productId: 'city-white', size: '36', quantity: 1 },
          ],
        }),
      )
      .expect(409);
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(8);
    expect(testedProduct((await repo.read()).products).version).toBe(0);
    expect((await repo.read()).orders).toHaveLength(0);
  });
  it('does not oversell under concurrent checkout requests or duplicate cart lines', async () => {
    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        customer.post('/api/store/orders').send(
          checkout({
            items: [{ productId: 'sage-runner', size: '40', quantity: 3 }],
          }),
        ),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(2);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(1);
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(2);
    await customer
      .post('/api/store/orders')
      .send(
        checkout({
          items: [
            { productId: 'sage-runner', size: '40', quantity: 2 },
            { productId: 'sage-runner', size: '40', quantity: 2 },
          ],
        }),
      )
      .expect(409);
  });
  it('restores inventory once on cancellation and enforces status progression', async () => {
    const order = await customer
      .post('/api/store/orders')
      .send(checkout())
      .expect(201);
    await customer
      .post(`/api/store/orders/${order.body.id}/cancel`)
      .expect(201);
    await customer
      .post(`/api/store/orders/${order.body.id}/cancel`)
      .expect(409);
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(8);
    await admin
      .patch(`/api/store/admin/orders/${order.body.id}`)
      .send({ status: 'confirmed' })
      .expect(409);
  });
  it('allows admins to edit and archive products while preserving orders', async () => {
    const order = await customer
      .post('/api/store/orders')
      .send(checkout())
      .expect(201);
    const { id, createdAt, version, stock, ...details } = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    const input = { ...details, expectedVersion: version };
    input.price = 9990;
    await customer
      .patch(`/api/store/admin/products/${id}`)
      .send(input)
      .expect(403);
    await admin
      .patch(`/api/store/admin/products/${id}`)
      .send(input)
      .expect(200);
    await admin.delete(`/api/store/admin/products/${id}`).expect(200);
    await request(app.getHttpServer())
      .get(`/api/store/products/${id}`)
      .expect(404);
    expect(
      (await customer.get('/api/store/orders')).body[0].items[0].price,
    ).toBe(8990);
    await admin
      .patch(`/api/store/admin/orders/${order.body.id}`)
      .send({ status: 'confirmed' })
      .expect(200);
    await admin
      .patch(`/api/store/admin/orders/${order.body.id}`)
      .send({ status: 'delivered' })
      .expect(409);
    await admin
      .patch(`/api/store/admin/orders/${order.body.id}`)
      .send({ status: 'shipped' })
      .expect(200);
    await admin
      .patch(`/api/store/admin/orders/${order.body.id}`)
      .send({ status: 'delivered' })
      .expect(200);
  });
  it('rejects the original stale product form instead of restoring sold inventory', async () => {
    const opened = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    const { id, createdAt, version, ...input } = opened;
    await customer.post('/api/store/orders').send(checkout()).expect(201);
    await admin
      .patch(`/api/store/admin/products/${id}`)
      .send({ ...input, name: 'Renamed after checkout' })
      .expect(409);
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(7);
    expect((await repo.read()).orders).toHaveLength(1);
  });
  it('checks product versions atomically and edits details separately from inventory', async () => {
    const { id, createdAt, version, stock, ...details } = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    await customer.post('/api/store/orders').send(checkout()).expect(201);
    await admin
      .patch(`/api/store/admin/products/${id}`)
      .send({ ...details, name: 'Stale name', expectedVersion: version })
      .expect(409);
    const current = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    expect(current.stock['40']).toBe(7);
    expect(current.version).toBe(version + 1);
    await admin
      .patch(`/api/store/admin/products/${id}`)
      .send({ ...details, stock, expectedVersion: current.version })
      .expect(400);
    const saved = await admin
      .patch(`/api/store/admin/products/${id}`)
      .send({
        ...details,
        name: 'Fresh name',
        expectedVersion: current.version,
      })
      .expect(200);
    expect(saved.body.stock['40']).toBe(7);
    expect(saved.body.version).toBe(current.version + 1);
    const stockInput = {
      stock: { ...saved.body.stock, '40': 10 },
      expectedVersion: saved.body.version,
    };
    await customer
      .patch(`/api/store/admin/products/${id}/stock`)
      .send(stockInput)
      .expect(403);
    const adjusted = await admin
      .patch(`/api/store/admin/products/${id}/stock`)
      .send(stockInput)
      .expect(200);
    expect(adjusted.body.stock['40']).toBe(10);
    expect(adjusted.body.version).toBe(saved.body.version + 1);
    await admin
      .patch(`/api/store/admin/products/${id}/stock`)
      .send(stockInput)
      .expect(409);
    await admin
      .patch(`/api/store/admin/products/${id}/stock`)
      .send({ stock, expectedVersion: null })
      .expect(400);
    expect(testedProduct((await repo.read()).products).stock['40']).toBe(10);
  });
  it('invalidates product forms on cancellation and archival even when inventory returns to its previous value', async () => {
    const { id, createdAt, version, stock, ...details } = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    const order = await customer
      .post('/api/store/orders')
      .send(checkout())
      .expect(201);
    await customer
      .post(`/api/store/orders/${order.body.id}/cancel`)
      .expect(201);
    await admin
      .patch(`/api/store/admin/products/${id}`)
      .send({ ...details, expectedVersion: version })
      .expect(409);
    const current = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    expect(current.stock).toEqual(stock);
    expect(current.version).toBe(version + 2);
    await admin.delete(`/api/store/admin/products/${id}`).expect(200);
    await admin
      .patch(`/api/store/admin/products/${id}`)
      .send({ ...details, expectedVersion: current.version })
      .expect(409);
    expect(testedProduct((await repo.read()).products).active).toBe(false);
  });
  it('allows only one of two administrators to save the same product version', async () => {
    const { id, createdAt, version, stock, ...details } = testedProduct(
      (await admin.get('/api/store/admin')).body.products,
    );
    const results = await Promise.all(
      ['First edit', 'Second edit'].map((name) =>
        admin
          .patch(`/api/store/admin/products/${id}`)
          .send({ ...details, name, expectedVersion: version }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(testedProduct((await repo.read()).products).stock).toEqual(stock);
    expect(testedProduct((await repo.read()).products).version).toBe(
      version + 1,
    );
  });
  it('persists data across repository restart', async () => {
    await repo.transaction((data) => {
      Reflect.deleteProperty(testedProduct(data.products), 'version');
    });
    const secondRepository =
      process.env.TEST_POSTGRES === 'true'
        ? new PostgresStoreRepository(environment().database)
        : new FileStoreRepository(process.env.STORE_DATA_FILE!);
    await secondRepository.onModuleInit();
    expect(
      testedProduct((await secondRepository.read()).products).version,
    ).toBe(0);
    expect((await secondRepository.read()).users.length).toBeGreaterThanOrEqual(
      3,
    );
    await secondRepository.onModuleDestroy();
  });
  it('revokes the session on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/store/auth/login')
      .send({ email: 'buyer@example.test', password: 'Customer123!' })
      .expect(201);
    await agent.post('/api/store/auth/logout').expect(201);
    expect((await agent.get('/api/store/auth/me')).body).toBeNull();
    await agent.get('/api/store/orders').expect(401);
  });
});
