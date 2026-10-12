import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { configureHttp } from '../src/app/configure-http';
import { AuthService } from '../src/application/services/auth.service';
import { AccountService } from '../src/application/services/account.service';
import { AdminService } from '../src/application/services/admin.service';
import { CatalogService } from '../src/application/services/catalog.service';
import { OrdersService } from '../src/application/services/orders.service';
import { StoreRepository } from '../src/application/ports/store.repository';
import { Security } from '../src/application/ports/security';
import { emptyStore, StoreData } from '../src/domain/models';
import { ShopController } from '../src/presentation/http/shop.controller';
import { AppErrorFilter } from '../src/presentation/http/app-error.filter';
import { AuthGuard } from '../src/presentation/http/auth.guard';

class MemoryRepository extends StoreRepository {
  private data = emptyStore();
  async read() {
    return structuredClone(this.data);
  }
  async transaction<T>(operation: (data: StoreData) => T | Promise<T>) {
    const copy = structuredClone(this.data);
    const result = await operation(copy);
    this.data = copy;
    return result;
  }
}
const security: Security = {
  id: () => 'test-user',
  token: () => 'a'.repeat(64),
  tokenHash: (value) => value,
  hashPassword: async (value) => value,
  verifyPassword: async (value, hash) => value === hash,
};
describe('Authentication behind explicitly trusted proxies', () => {
  let app: INestApplication;
  const oldOrigin = process.env.STORE_ORIGIN;
  async function boot(trusted: string) {
    const repo = new MemoryRepository();
    const module = await Test.createTestingModule({
      controllers: [ShopController],
      providers: [
        { provide: AuthService, useValue: new AuthService(repo, security) },
        { provide: AccountService, useValue: new AccountService(repo) },
        { provide: AdminService, useValue: new AdminService(repo, security) },
        { provide: CatalogService, useValue: new CatalogService(repo) },
        { provide: OrdersService, useValue: new OrdersService(repo, security) },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: AppErrorFilter },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttp(app, trusted);
    delete process.env.STORE_ORIGIN;
    await app.init();
  }
  const login = (forwarded: string) =>
    request(app.getHttpServer())
      .post('/api/store/auth/login')
      .set('X-Forwarded-For', forwarded)
      .send({ email: 'missing@example.test', password: 'WrongPassword123!' });
  afterEach(async () => {
    if (app) await app.close();
    if (oldOrigin === undefined) delete process.env.STORE_ORIGIN;
    else process.env.STORE_ORIGIN = oldOrigin;
  });

  it('keeps the login budgets of different forwarded clients separate', async () => {
    await boot('127.0.0.1, ::1');
    for (let index = 0; index < 20; index++)
      await login('198.51.100.1').expect(401);
    await login('198.51.100.1').expect(429);
    await login('198.51.100.2').expect(401);
    await login('2001:db8::42').expect(401);
    // The nearest untrusted address controls identity, not a forged prefix.
    await login('203.0.113.99, 198.51.100.1').expect(429);
    await request(app.getHttpServer())
      .post('/api/store/auth/register')
      .set('X-Forwarded-For', '198.51.100.1')
      .send({
        name: 'Buyer',
        email: 'new@example.test',
        password: 'Customer123!',
      })
      .expect(429);
  });
  it.each(['', '192.0.2.10'])(
    'ignores forged forwarded headers from an untrusted socket (%s)',
    async (trusted) => {
      await boot(trusted);
      for (let index = 0; index < 20; index++)
        await login(`198.51.100.${index + 1}`).expect(401);
      await login('203.0.113.250')
        .set('X-Real-IP', '203.0.113.250')
        .expect(429);
    },
  );
  it('preserves legitimate registration, login, cookies and origin checks behind a proxy', async () => {
    await boot('127.0.0.1,::1');
    const send = (route: string) =>
      request(app.getHttpServer())
        .post(`/api/store/auth/${route}`)
        .set('X-Forwarded-For', '198.51.100.7')
        .set('Host', 'shop.example')
        .set('X-Forwarded-Proto', 'https')
        .set('Origin', 'https://shop.example');
    await send('register')
      .send({
        name: 'Buyer',
        email: 'buyer@example.test',
        password: 'Customer123!',
      })
      .expect(201);
    const logged = await send('login')
      .send({ email: 'buyer@example.test', password: 'Customer123!' })
      .expect(201);
    expect(logged.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(logged.headers['set-cookie'][0]).toContain('SameSite=Lax');
    await send('login')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'buyer@example.test', password: 'Customer123!' })
      .expect(403);
  });
  it('retains socket identity when no forwarded address is supplied', async () => {
    await boot('127.0.0.1,::1');
    for (let index = 0; index < 20; index++) await login('').expect(401);
    await login('').expect(429);
  });
  it.each([
    'true',
    '1',
    'loopback',
    '0.0.0.0/0',
    '127.0.0.1,',
    '127.0.0.1, garbage',
  ])('rejects unsafe or ambiguous proxy configuration: %s', async (config) => {
    await expect(boot(config)).rejects.toThrow('STORE_TRUSTED_PROXIES');
  });
});
