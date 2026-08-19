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
  displaySku?: string;
  shortDescription?: string;
  productDescription?: string;
  inStock?: boolean;
  sizes?: (number | string)[];
  gallery: ProductImage[];
  gender?: Gender;
  category?: string;
}
