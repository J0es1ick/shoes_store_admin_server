import { AppError } from '../../domain/errors';
import { StoreRepository } from '../ports/store.repository';
export class CatalogService {
  constructor(private readonly repo: StoreRepository) {}
  async catalog() {
    return (await this.repo.read()).products
      .filter((p) => p.active)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async product(id: string) {
    const product = (await this.catalog()).find((p) => p.id === id);
    if (!product) throw new AppError('not_found', 'Товар не найден.');
    return product;
  }
}
