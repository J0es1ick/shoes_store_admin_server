import { AppError } from '../../domain/errors';
import { deliveryPrice, restoreStock } from '../../domain/orders';
import { CheckoutInput } from '../inputs';
import { Security } from '../ports/security';
import { StoreRepository } from '../ports/store.repository';
export class OrdersService {
  constructor(
    private readonly repo: StoreRepository,
    private readonly security: Security,
  ) {}
  async orders(userId: string) {
    return (await this.repo.read()).orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async checkout(userId: string, input: CheckoutInput) {
    return this.repo.transaction((data) => {
      const previous = data.orders.find(
        (o) => o.userId === userId && o.requestId === input.requestId,
      );
      if (previous) return previous;
      if (input.delivery === 'courier' && input.address.trim().length < 10)
        throw new AppError(
          'validation',
          'Укажите город, улицу, дом и квартиру.',
        );
      const lines = new Map<
        string,
        { productId: string; size: string; quantity: number }
      >();
      for (const line of input.items) {
        const key = `${line.productId}:${line.size}`;
        const existing = lines.get(key);
        lines.set(key, {
          ...line,
          quantity: line.quantity + (existing?.quantity || 0),
        });
      }
      const items = [...lines.values()].map((line) => {
        const product = data.products.find(
          (p) => p.id === line.productId && p.active,
        );
        if (!product)
          throw new AppError(
            'conflict',
            'Один из товаров больше не доступен. Обновите корзину.',
          );
        if (
          line.quantity > 20 ||
          !Object.hasOwn(product.stock, line.size) ||
          product.stock[line.size] < line.quantity
        )
          throw new AppError(
            'conflict',
            `«${product.name}», размер ${line.size}: недостаточно товара. Измените количество.`,
          );
        product.stock[line.size] -= line.quantity;
        return {
          productId: product.id,
          name: product.name,
          image: product.images[0],
          size: line.size,
          quantity: line.quantity,
          price: product.price,
        };
      });
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const deliveryCost = deliveryPrice(subtotal, input.delivery);
      const order = {
        id: `ST-${this.security.id().slice(0, 8).toUpperCase()}`,
        userId,
        items,
        subtotal,
        deliveryCost,
        total: subtotal + deliveryCost,
        name: input.name.trim(),
        phone: input.phone.trim(),
        address:
          input.delivery === 'pickup'
            ? 'Самовывоз — адрес согласует менеджер'
            : input.address.trim(),
        comment: input.comment.trim(),
        delivery: input.delivery,
        payment: input.payment,
        status: 'new' as const,
        createdAt: new Date().toISOString(),
        requestId: input.requestId,
      };
      data.orders.push(order);
      return order;
    });
  }

  async cancelOrder(userId: string, id: string) {
    return this.repo.transaction((data) => {
      const order = data.orders.find((o) => o.id === id && o.userId === userId);
      if (!order) throw new AppError('not_found', 'Заказ не найден.');
      if (order.status !== 'new')
        throw new AppError(
          'conflict',
          'Отменить самостоятельно можно только новый заказ.',
        );
      restoreStock(data, order.items);
      order.status = 'cancelled';
      return order;
    });
  }
}
