import { StoreOrder, StoreProduct } from '../domain/models';
export interface Registration {
  name: string;
  email: string;
  password: string;
}
export interface ProfileInput {
  name: string;
  phone: string;
  address: string;
}
export type ProductInput = Omit<
  StoreProduct,
  'id' | 'createdAt' | 'version' | 'stock'
> & {
  stock?: StoreProduct['stock'];
  expectedVersion?: number;
};
export interface StockInput {
  stock: StoreProduct['stock'];
  expectedVersion: number;
}
export interface CheckoutInput extends ProfileInput {
  items: { productId: string; size: string; quantity: number }[];
  comment: string;
  delivery: StoreOrder['delivery'];
  payment: 'on_receipt';
  requestId: string;
}
