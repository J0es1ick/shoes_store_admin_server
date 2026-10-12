import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { resolve } from 'node:path';
import { Security } from '../application/ports/security';
import { StoreRepository } from '../application/ports/store.repository';
import { AccountService } from '../application/services/account.service';
import { AdminService } from '../application/services/admin.service';
import { AuthService } from '../application/services/auth.service';
import { CatalogService } from '../application/services/catalog.service';
import { OrdersService } from '../application/services/orders.service';
import { environment } from '../infrastructure/config/environment';
import { FileStoreRepository } from '../infrastructure/persistence/file-store.repository';
import { PostgresStoreRepository } from '../infrastructure/persistence/postgres-store.repository';
import { NodeSecurity } from '../infrastructure/security/node-security';
import { InitializeStore } from '../infrastructure/seed/initialize-store';
import { AppErrorFilter } from '../presentation/http/app-error.filter';
import { AuthGuard } from '../presentation/http/auth.guard';
import { ShopController } from '../presentation/http/shop.controller';

/** Composition root: framework wiring and concrete adapters meet only here. */
@Module({
  controllers: [ShopController],
  providers: [
    {
      provide: StoreRepository,
      useFactory: () => {
        const config = environment();
        if (config.fileStorage && process.env.NODE_ENV === 'production')
          throw new Error(
            'Use PostgreSQL for deployment; file storage is for local development.',
          );
        return config.fileStorage
          ? new FileStoreRepository(resolve(config.dataFile))
          : new PostgresStoreRepository(config.database);
      },
    },
    { provide: Security, useClass: NodeSecurity },
    {
      provide: AuthService,
      useFactory: (repo: StoreRepository, security: Security) =>
        new AuthService(repo, security),
      inject: [StoreRepository, Security],
    },
    {
      provide: CatalogService,
      useFactory: (repo: StoreRepository) => new CatalogService(repo),
      inject: [StoreRepository],
    },
    {
      provide: AccountService,
      useFactory: (repo: StoreRepository) => new AccountService(repo),
      inject: [StoreRepository],
    },
    {
      provide: OrdersService,
      useFactory: (repo: StoreRepository, security: Security) =>
        new OrdersService(repo, security),
      inject: [StoreRepository, Security],
    },
    {
      provide: AdminService,
      useFactory: (repo: StoreRepository, security: Security) =>
        new AdminService(repo, security),
      inject: [StoreRepository, Security],
    },
    {
      provide: InitializeStore,
      useFactory: (repo: StoreRepository, security: Security) =>
        new InitializeStore(repo, security),
      inject: [StoreRepository, Security],
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AppErrorFilter },
  ],
  exports: [StoreRepository],
})
export class AppModule {}
