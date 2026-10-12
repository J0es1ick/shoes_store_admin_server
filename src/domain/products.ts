import { AppError } from './errors';
import { StoreProduct } from './models';

export function requireProductVersion(
  product: StoreProduct,
  expected: unknown,
) {
  if (!Number.isSafeInteger(expected) || expected !== product.version)
    throw new AppError(
      'conflict',
      'Товар изменился. Обновите данные и повторите изменения.',
    );
}

export function validateStock(
  stock: unknown,
): asserts stock is Record<string, number> {
  if (
    !stock ||
    typeof stock !== 'object' ||
    Array.isArray(stock) ||
    !Object.keys(stock).length ||
    Object.keys(stock).length > 30 ||
    Object.entries(stock).some(
      ([size, qty]) =>
        !/^[\w .-]{1,20}$/.test(size) ||
        !Number.isInteger(qty) ||
        qty < 0 ||
        qty > 100000,
    )
  )
    throw new AppError('validation', 'Проверьте размеры и остатки.');
}
