import { AppError } from '../../domain/errors';
import { OrderStatus, publicUser } from '../../domain/models';
import { allowedStatuses, restoreStock } from '../../domain/orders';
import { ProductInput } from '../inputs';
import { Security } from '../ports/security';
import { StoreRepository } from '../ports/store.repository';
export class AdminService {
  constructor(
    private readonly repo: StoreRepository,
    private readonly security: Security,
  ) {}
  async adminData() {
    const data = await this.repo.read();
    return {
      products: data.products,
      orders: data.orders.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      customers: data.users.map(publicUser),
    };
  }

  async saveProduct(input: ProductInput, id?: string) {
    for (const image of input.images)
      if (!/^https:\/\//.test(image) && !/^\/media\/[\w./-]+$/.test(image))
        throw new AppError(
          'validation',
          'Фото должно быть HTTPS-ссылкой или файлом /media/.',
        );
    if (
      !Object.keys(input.stock).length ||
      Object.keys(input.stock).length > 30 ||
      Object.entries(input.stock).some(
        ([size, qty]) =>
          !/^[\w .-]{1,20}$/.test(size) ||
          !Number.isInteger(qty) ||
          qty < 0 ||
          qty > 100000,
      )
    )
      throw new AppError('validation', 'Проверьте размеры и остатки.');
    if (input.oldPrice && input.oldPrice <= input.price)
      throw new AppError(
        'validation',
        'Старая цена должна быть больше текущей.',
      );
    return this.repo.transaction((data) => {
      let product = id ? data.products.find((p) => p.id === id) : undefined;
      if (id && !product) throw new AppError('not_found', 'Товар не найден.');
      if (product) Object.assign(product, input);
      else {
        product = {
          ...input,
          id: this.security.id(),
          createdAt: new Date().toISOString(),
        };
        data.products.push(product);
      }
      return product;
    });
  }

  async archiveProduct(id: string) {
    return this.repo.transaction((data) => {
      const product = data.products.find((p) => p.id === id);
      if (!product) throw new AppError('not_found', 'Товар не найден.');
      product.active = false;
      return product;
    });
  }

  async orderStatus(id: string, status: OrderStatus) {
    return this.repo.transaction((data) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) throw new AppError('not_found', 'Заказ не найден.');
      if (order.status === status) return order;
      if (!allowedStatuses[order.status].includes(status))
        throw new AppError('conflict', 'Недопустимый переход статуса заказа.');
      if (status === 'cancelled') restoreStock(data, order.items);
      order.status = status;
      return order;
    });
  }
}
