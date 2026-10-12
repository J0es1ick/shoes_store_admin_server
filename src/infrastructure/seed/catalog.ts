import { StoreProduct } from '../../domain/models';

const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`;
export function seedProducts(): StoreProduct[] {
  const products = [
    {
      id: 'sage-runner',
      name: 'Everyday Runner',
      brand: 'STEP Studio',
      category: 'sneakers',
      gender: 'unisex',
      price: 8990,
      oldPrice: null,
      color: 'Шалфей / молочный',
      colorHex: '#8c9a7c',
      images: ['/media/step-hero.png'],
      badge: 'Новинка',
      material: 'Замша, текстиль. Подошва: EVA и резина.',
      description:
        'Твоя любимая пара для долгих прогулок. Мягкая замша, дышащая сетка и лёгкая амортизирующая подошва — чтобы никуда не спешить и везде успевать.',
    },
    {
      id: 'city-white',
      name: 'City Low',
      brand: 'STEP Studio',
      category: 'sneakers',
      gender: 'unisex',
      price: 6490,
      oldPrice: 7990,
      color: 'Молочный',
      colorHex: '#e7e4db',
      images: [photo('photo-1600269452121-4f2416e55c28')],
      badge: '−19%',
      material: 'Натуральная кожа. Подкладка: текстиль.',
      description:
        'Чистые линии и ничего лишнего. Универсальные кеды, которые подружатся с джинсами, костюмом и твоими планами на выходные.',
    },
    {
      id: 'terra-walk',
      name: 'Terra Walk',
      brand: 'North & Form',
      category: 'shoes',
      gender: 'men',
      price: 10990,
      oldPrice: null,
      color: 'Тёплый песок',
      colorHex: '#b58a62',
      images: [photo('photo-1549298916-b41d501d3772')],
      badge: 'Выбор STEP',
      material: 'Натуральная кожа, резиновая подошва.',
      description:
        'Фактурная кожа тёплого оттенка и комфортная посадка. Пара, которая с каждым днём становится только ближе.',
    },
    {
      id: 'cloud-run',
      name: 'Cloud Run',
      brand: 'Move',
      category: 'sneakers',
      gender: 'women',
      price: 7990,
      oldPrice: null,
      color: 'Коралловый',
      colorHex: '#d54b3f',
      images: [photo('photo-1542291026-7eec264c27ff')],
      badge: 'Новинка',
      material: 'Дышащий текстиль, амортизирующая подошва.',
      description:
        'Лёгкость в каждом шаге. Кроссовки для энергичного утра, спонтанных маршрутов и твоего собственного темпа.',
    },
    {
      id: 'weekend-hoodie',
      name: 'Weekend Hoodie',
      brand: 'STEP Studio',
      category: 'clothing',
      gender: 'unisex',
      price: 5490,
      oldPrice: null,
      color: 'Песочный',
      colorHex: '#c9b69b',
      images: [photo('photo-1556821840-3a63f95609a7')],
      badge: 'Мягкий хлопок',
      material: '80% хлопок, 20% полиэстер. Плотность 340 г/м².',
      description:
        'Объёмное худи с мягкой изнанкой. Расслабленный силуэт, большой капюшон и ощущение выходного дня — даже в понедельник.',
    },
    {
      id: 'essential-tee',
      name: 'Essential Tee',
      brand: 'North & Form',
      category: 'clothing',
      gender: 'unisex',
      price: 2490,
      oldPrice: 2990,
      color: 'Белый',
      colorHex: '#f5f3eb',
      images: [photo('photo-1521572163474-6864f9cf17ab')],
      badge: '−17%',
      material: '100% хлопок. Плотность 220 г/м².',
      description:
        'Правильная базовая футболка: плотный хлопок, свободная посадка и аккуратная горловина. Начало десятков любимых образов.',
    },
    {
      id: 'daily-pack',
      name: 'Daily Backpack',
      brand: 'North & Form',
      category: 'accessories',
      gender: 'unisex',
      price: 4990,
      oldPrice: null,
      color: 'Графит',
      colorHex: '#424747',
      images: [photo('photo-1553062407-98eeb64c6a62')],
      badge: '',
      material: 'Водоотталкивающий полиэстер. Объём 18 л.',
      description:
        'Всё нужное всегда рядом. Лаконичный городской рюкзак с мягкими лямками и отдельным карманом для ноутбука.',
    },
    {
      id: 'retro-court',
      name: 'Retro Court',
      brand: 'Move',
      category: 'sneakers',
      gender: 'men',
      price: 7490,
      oldPrice: 9990,
      color: 'Кремовый',
      colorHex: '#d9c6a6',
      images: [photo('photo-1600185365483-26d7a4cc7519')],
      badge: '−25%',
      material: 'Кожа и текстиль. Резиновая подошва.',
      description:
        'Немного винтажа в повседневном ритме. Классический силуэт, приятные материалы и поддержка на целый день.',
    },
  ];
  return products.map((p, index) => ({
    ...p,
    version: 0,
    active: true,
    createdAt: new Date(Date.UTC(2026, 9, 10 - index)).toISOString(),
    stock: Object.fromEntries(
      (p.category === 'clothing'
        ? ['XS', 'S', 'M', 'L', 'XL']
        : p.category === 'accessories'
          ? ['ONE SIZE']
          : ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45']
      ).map((s, i) => [s, i === 0 && p.category !== 'accessories' ? 0 : 8]),
    ),
  })) as StoreProduct[];
}
