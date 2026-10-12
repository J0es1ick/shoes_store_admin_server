export type Role = 'customer' | 'admin';
export type Category = 'sneakers' | 'shoes' | 'clothing' | 'accessories';
export interface StoreProduct {
  id: string;
  name: string;
  brand: string;
  category: Category;
  gender: 'women' | 'men' | 'unisex';
  price: number;
  oldPrice: number | null;
  description: string;
  material: string;
  color: string;
  colorHex: string;
  images: string[];
  stock: Record<string, number>;
  badge: string;
  active: boolean;
  createdAt: string;
}
export interface StoreUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  phone: string;
  address: string;
  favorites: string[];
  createdAt: string;
}
export interface StoreSession {
  id: string;
  userId: string;
  expiresAt: string;
}
export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  size: string;
  quantity: number;
  price: number;
}
export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
export interface StoreOrder {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  name: string;
  phone: string;
  address: string;
  comment: string;
  delivery: 'courier' | 'pickup';
  payment: 'on_receipt';
  status: OrderStatus;
  createdAt: string;
  requestId: string;
}
export interface StoreData {
  products: StoreProduct[];
  users: StoreUser[];
  sessions: StoreSession[];
  orders: StoreOrder[];
}
export const publicUser = ({ passwordHash, ...user }: StoreUser) => user;
export const emptyStore = (): StoreData => ({
  products: [],
  users: [],
  sessions: [],
  orders: [],
});
