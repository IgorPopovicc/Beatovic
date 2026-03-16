import { environment } from '../../../../environments/environment';
import { Variant } from '../../../core/api/catalog.models';
import { ProductCard } from './product-card';

const IMAGE_FALLBACK = 'assets/images/products/test.webp';

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: unknown): string {
  return normalize(value)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function imageUrlFromVariant(v: Variant): string {
  const displayed = v.images?.find((i) => i.displayed) ?? v.images?.[0];
  const imgFile = normalize(displayed?.url ?? v.mainImageName ?? v.mainImageUrl);
  if (!imgFile) return IMAGE_FALLBACK;
  if (/^https?:\/\//i.test(imgFile)) return imgFile;

  const base = normalize(environment.mediaProductBaseUrl).replace(/\/$/, '');
  const clean = imgFile.replace(/^\/+/, '');
  return base ? `${base}/${clean}` : imgFile;
}

export function mapVariantToProductCard(v: Variant, options?: { priority?: boolean }): ProductCard {
  const variantId = normalize(v.id ?? v.productId);
  const name = normalize(v.productName) || 'Proizvod';

  const finalPrice = Number(v.finalPrice ?? v.originalPrice ?? 0);
  const originalPrice = Number(v.originalPrice ?? finalPrice);
  const hasDiscount = originalPrice > finalPrice;

  const identity = normalize(v.sku ?? v.productSku ?? variantId);

  const imageUrl = imageUrlFromVariant(v);

  return {
    id: variantId,
    slug: slugify(`${name}-${identity || 'variant'}`),
    name,
    subtitle: normalize(v.productSku) || undefined,
    price: finalPrice,
    oldPrice: hasDiscount ? originalPrice : null,
    currency: 'RSD',
    discountLabel: undefined,
    image: {
      desktop: imageUrl,
      mobile: imageUrl,
      alt: name,
      w: 1200,
      h: 1200,
    },
    priority: options?.priority === true,
  };
}

export function pickCategoryValue(v: Variant, categoryName: string): string {
  const target = normalizeKey(categoryName);
  if (!target) return '';

  const found = (v.categories ?? []).find((c) => normalizeKey(c.categoryName) === target);
  return normalize(found?.displayValue ?? found?.value);
}

export function variantMatchesBrand(v: Variant, brandName: string): boolean {
  const target = normalizeKey(brandName);
  if (!target) return false;

  const fromCategory = normalizeKey(pickCategoryValue(v, 'BREND'));
  if (fromCategory.includes(target)) return true;

  return normalizeKey(v.productName).includes(target);
}

export function variantLooksLikeFootwear(v: Variant): boolean {
  const categoryValue = normalizeKey(pickCategoryValue(v, 'KATEGORIJA'));
  if (!categoryValue) return false;

  return (
    categoryValue.includes('OBUCA') ||
    categoryValue.includes('PATIKE') ||
    categoryValue.includes('CIPELE') ||
    categoryValue.includes('SANDALE')
  );
}
