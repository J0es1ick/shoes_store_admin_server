import { Security } from '../../application/ports/security';
import { StoreRepository } from '../../application/ports/store.repository';
import { seedProducts } from './catalog';
export class InitializeStore {
  constructor(
    private readonly repo: StoreRepository,
    private readonly security: Security,
  ) {}
  async onModuleInit() {
    if (process.env.STORE_SEED === 'true') {
      await this.repo.transaction((data) => {
        if (!data.products.length) data.products = seedProducts();
      });
    }
    const email = process.env.STORE_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.STORE_ADMIN_PASSWORD;
    if (email && password) {
      if (password.length < 12)
        throw new Error(
          'STORE_ADMIN_PASSWORD must contain at least 12 characters.',
        );
      const passwordHash = await this.security.hashPassword(password);
      await this.repo.transaction((data) => {
        // Never promote an existing customer by matching an environment email.
        if (!data.users.some((user) => user.email === email))
          data.users.push({
            id: this.security.id(),
            email,
            name: 'Администратор',
            passwordHash,
            role: 'admin',
            phone: '',
            address: '',
            favorites: [],
            createdAt: new Date().toISOString(),
          });
      });
    }
  }
}
