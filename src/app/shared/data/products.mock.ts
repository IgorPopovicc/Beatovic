import { ProductImage } from '../ui/product-card/product-card';

export type Gender = 'muskarci' | 'zene' | 'djeca';

export interface ProductDetailsModel {
  id: string;
  slug: string;

  name: string;
  subtitle?: string;

  price: number;
  oldPrice?: number | null;
  currency?: string;

  brand: string;
  sku?: string;

  shortDescription?: string;

  inStock?: boolean;
  sizes?: (number | string)[];

  gallery: ProductImage[];

  gender?: Gender;
  category?: string;
}

const IMG_1: ProductImage = {
  desktop: 'assets/images/products/test.webp',
  mobile: 'assets/images/products/test.webp',
  w: 960,
  h: 1280,
  alt: 'Slika proizvoda',
};

const IMG_2: ProductImage = {
  desktop: 'assets/images/products/test3.webp',
  mobile: 'assets/images/products/test3.webp',
  w: 960,
  h: 1280,
  alt: 'Slika proizvoda',
};

const IMG_3: ProductImage = {
  desktop: 'assets/images/products/test4.webp',
  mobile: 'assets/images/products/test4.webp',
  w: 960,
  h: 1280,
  alt: 'Slika proizvoda',
};

export const PRODUCTS_MOCK: ProductDetailsModel[] = [
  {
    id: '1',
    slug: 'nike-patike-defy-all-day',
    name: 'NIKE PATIKE DEFY ALL DAY ZA MUŠKARCE',
    subtitle: 'Tekstil, bijela boja',
    price: 17590,
    oldPrice: 19990,
    currency: 'RSD',
    brand: 'NIKE',
    sku: 'HM9594-003',
    inStock: true,
    sizes: [40, 41, 42, 43, 44, 45],
    shortDescription:
      'Udobne patike za svakodnevno nošenje, stabilna peta i lagan đon. Idealne za hodanje i lagani trening.',
    gallery: [
      IMG_1,
      IMG_2,
      IMG_1,
      IMG_3,
      IMG_1,
    ],
    gender: 'muskarci',
    category: 'obuca',
  },

  {
    id: '2',
    slug: 'kappa-patike-logo-marlon',
    name: 'KAPPA PATIKE LOGO MARLON',
    subtitle: 'Koža/tekstil, plava boja',
    price: 3499,
    oldPrice: 5499,
    currency: 'RSD',
    brand: 'KAPPA',
    sku: 'KAP-MLN-2025',
    inStock: true,
    sizes: [40, 41, 42, 43, 44, 45],
    shortDescription:
      'Klasičan lifestyle model sa udobnim uloškom i stabilnim đonom. Dobro se uklapa uz svakodnevne kombinacije.',
    gallery: [
      IMG_2,
      IMG_2,
      IMG_2,
      IMG_2,
    ],
    gender: 'muskarci',
    category: 'obuca',
  },

  {
    id: '3',
    slug: 'adidas-runner',
    name: 'ADIDAS RUNNER',
    subtitle: 'Tekstil, siva boja',
    price: 12990,
    oldPrice: 15990,
    currency: 'RSD',
    brand: 'ADIDAS',
    sku: 'ADI-RUN-778',
    inStock: true,
    sizes: [40, 41, 42, 43, 44],
    shortDescription:
      'Lagane patike sa prozračnim gornjištem i amortizacijom za duže šetnje i svakodnevnu upotrebu.',
    gallery: [
      IMG_3,
      IMG_1,
      IMG_3,
    ],
    gender: 'muskarci',
    category: 'obuca',
  },

  {
    id: '4',
    slug: 'new-balance-530',
    name: 'NEW BALANCE 530',
    subtitle: 'Koža/tekstil, crna boja',
    price: 18990,
    currency: 'RSD',
    brand: 'NEW BALANCE',
    sku: 'NB-530-BLK',
    inStock: true,
    sizes: [41, 42, 43, 44],
    shortDescription:
      'Retro runner estetika sa udobnim đonom. Stabilan i kvalitetan model za svakodnevno nošenje.',
    gallery: [
      IMG_1,
      IMG_1,
      IMG_1,
    ],
    gender: 'muskarci',
    category: 'obuca',
  },
];
