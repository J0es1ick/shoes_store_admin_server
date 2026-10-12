import { StoreData, emptyStore } from '../../domain/models';
import { CheckoutInput } from '../inputs';
import { Security } from '../ports/security';
import { StoreRepository } from '../ports/store.repository';
import { OrdersService } from './orders.service';

class MemoryRepository extends StoreRepository {
  data: StoreData = emptyStore();
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
  id: () => '12345678-1234-4321-1234-123456789012',
  token: () => '',
  tokenHash: () => '',
  hashPassword: async () => '',
  verifyPassword: async () => false,
};
const checkout: CheckoutInput = {
  items: [{ productId: 'one', size: 'M', quantity: 1 }],
  name: 'Buyer',
  phone: '+79990000000',
  address: 'Example street, 1',
  comment: '',
  delivery: 'courier',
  payment: 'on_receipt',
  requestId: 'request-one',
};
let repo: MemoryRepository;
let orders: OrdersService;
beforeEach(() => {
  repo = new MemoryRepository();
  repo.data.products = [
    {
      id: 'one',
      name: 'Tee',
      brand: 'STEP',
      category: 'clothing',
      gender: 'unisex',
      price: 6000,
      oldPrice: null,
      description: 'Tee',
      material: 'Cotton',
      color: 'Sage',
      colorHex: '#a9d875',
      images: ['/media/test.png'],
      stock: { M: 2 },
      badge: '',
      active: true,
      createdAt: '2026-10-10',
    },
  ];
  orders = new OrdersService(repo, security);
});
test('checkout uses catalog prices and keeps an immutable order snapshot', async () => {
  const order = await orders.checkout('buyer', checkout);
  expect(order.total).toBe(6490);
  repo.data.products[0].price = 9000;
  expect((await orders.orders('buyer'))[0].items[0].price).toBe(6000);
  expect((await orders.checkout('buyer', checkout)).id).toBe(order.id);
  expect(repo.data.products[0].stock.M).toBe(1);
});
test('a failing second line rolls back the first stock change', async () => {
  await expect(
    orders.checkout('buyer', {
      ...checkout,
      items: [
        ...checkout.items,
        { productId: 'missing', size: 'M', quantity: 1 },
      ],
    }),
  ).rejects.toMatchObject({ kind: 'conflict' });
  expect(repo.data.products[0].stock.M).toBe(2);
  expect(repo.data.orders).toHaveLength(0);
});
test('customers cannot cancel another customer order or restore stock twice', async () => {
  const order = await orders.checkout('buyer', checkout);
  await expect(orders.cancelOrder('other', order.id)).rejects.toMatchObject({
    kind: 'not_found',
  });
  await orders.cancelOrder('buyer', order.id);
  await expect(orders.cancelOrder('buyer', order.id)).rejects.toMatchObject({
    kind: 'conflict',
  });
  expect(repo.data.products[0].stock.M).toBe(2);
});
