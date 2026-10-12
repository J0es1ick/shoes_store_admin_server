import { OrderStatus, StoreData } from './models';
export const deliveryPrice = (
  subtotal: number,
  delivery: 'courier' | 'pickup',
) => (delivery === 'pickup' || subtotal >= 10000 ? 0 : 490);
export const allowedStatuses: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export function restoreStock(
  data: StoreData,
  items: { productId: string; size: string; quantity: number }[],
) {
  for (const item of items) {
    const product = data.products.find((p) => p.id === item.productId);
    if (product) {
      product.stock[item.size] =
        (product.stock[item.size] || 0) + item.quantity;
      product.version++;
    }
  }
}
