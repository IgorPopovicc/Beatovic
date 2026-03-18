import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductsApiService } from '../../core/api/products-api.service';
import { ProductDetailsModel } from '../../shared/data/products.mock';
import { environment } from '../../../environments/environment';

const PRODUCT_PLACEHOLDER = 'assets/images/products/test.webp';

export type ProductDetailsResolved = ProductDetailsModel & {
  sizeQtyMap: Record<string, number>;
  sizeAttrElementIdMap: Record<string, string>;
  seoDescription: string;
  seoImage: { url: string; alt: string } | null;
};

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

function truncate(value: string, max = 190): string {
  const text = normalize(value);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function resolveMediaUrl(pathOrUrl: string): string {
  const value = normalize(pathOrUrl);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const base = normalize(environment.mediaProductBaseUrl).replace(/\/$/, '');
  if (!base) return value;

  const clean = value
    .replace(/^\/+/, '')
    .replace(/^media\/product\/+/i, '')
    .replace(/^product\/+/i, '');
  if (!clean) return '';

  const [pathPart, searchPart = ''] = clean.split('?');
  const encodedPath = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');

  return `${base}/${encodedPath}${searchPart ? `?${searchPart}` : ''}`;
}

function pickBrand(dto: any): string {
  const categories = Array.isArray(dto?.categories) ? dto.categories : [];
  const fromCategory = categories.find((c: any) => normalizeKey(c?.categoryName) === 'BREND');
  return normalize(fromCategory?.displayValue ?? fromCategory?.value ?? dto?.brand ?? '') || 'Planeta';
}

function buildSizeMaps(dto: any): {
  sizeQtyMap: Record<string, number>;
  sizeAttrElementIdMap: Record<string, string>;
  sizes: string[];
} {
  const sizeQtyMap: Record<string, number> = {};
  const sizeAttrElementIdMap: Record<string, string> = {};
  const attributes = Array.isArray(dto?.attributes) ? dto.attributes : [];

  for (const attr of attributes) {
    if (normalizeKey(attr?.attributeName) !== 'VELICINA') continue;

    const sizeValue = normalize(attr?.displayValue ?? attr?.value);
    if (!sizeValue) continue;

    sizeQtyMap[sizeValue] = Number(attr?.quantity ?? 0);
    const attributeElementId = normalize(attr?.id);
    if (attributeElementId) {
      sizeAttrElementIdMap[sizeValue] = attributeElementId;
    }
  }

  const smartSizeCompare = (a: string, b: string): number => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = !Number.isNaN(na);
    const bNum = !Number.isNaN(nb);

    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  };

  const sizes = Object.keys(sizeQtyMap).sort(smartSizeCompare);
  return { sizeQtyMap, sizeAttrElementIdMap, sizes };
}

function buildGallery(dto: any, productName: string): ProductDetailsModel['gallery'] {
  const images = Array.isArray(dto?.images) ? dto.images : [];
  const displayed = images.find((img: any) => !!img?.displayed);

  const candidatePaths: string[] = [];

  if (displayed?.url) {
    candidatePaths.push(String(displayed.url));
  }
  for (const img of images) {
    if (!img?.url) continue;
    candidatePaths.push(String(img.url));
  }

  candidatePaths.push(normalize(dto?.mainImageName));
  candidatePaths.push(normalize(dto?.mainImageUrl));

  const uniqueUrls: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidatePaths) {
    const resolved = resolveMediaUrl(candidate);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    uniqueUrls.push(resolved);
  }

  if (!uniqueUrls.length) {
    uniqueUrls.push(PRODUCT_PLACEHOLDER);
  }

  return uniqueUrls.map((url) => ({
    desktop: url,
    mobile: url,
    alt: productName,
    w: 1200,
    h: 1200,
  }));
}

function pickSeoImage(gallery: ProductDetailsModel['gallery']): { url: string; alt: string } | null {
  const first = gallery[0];
  if (!first) return null;

  const url = normalize(first.desktop || first.mobile);
  if (!/^https?:\/\//i.test(url)) return null;

  return {
    url,
    alt: normalize(first.alt) || 'Planeta proizvod',
  };
}

function toResolvedProduct(dto: any, id: string): ProductDetailsResolved {
  const name = normalize(dto?.productName ?? dto?.name) || 'Proizvod';
  const sku = normalize(dto?.sku ?? dto?.productSku ?? dto?.variantSku) || undefined;
  const brand = pickBrand(dto);

  const finalPrice = Number(dto?.finalPrice ?? dto?.price ?? dto?.originalPrice ?? 0);
  const originalPrice = Number(dto?.originalPrice ?? finalPrice);
  const oldPrice = originalPrice > finalPrice ? originalPrice : null;

  const { sizeQtyMap, sizeAttrElementIdMap, sizes } = buildSizeMaps(dto);
  const inStockFromSizes = Object.values(sizeQtyMap).some((qty) => qty > 0);
  const inStockFromVariant = Number(dto?.quantity ?? 0) > 0;
  const inStock = sizes.length > 0 ? inStockFromSizes : inStockFromVariant;

  const gallery = buildGallery(dto, name);

  const rawDescription = normalize(dto?.shortDescription ?? dto?.description);
  const seoDescription =
    truncate(rawDescription, 190) ||
    `Detalji proizvoda ${name} u Planeta webshopu. Pogledajte cijenu i dostupne veličine.`;

  return {
    id,
    slug: slugify(`${name}-${sku || id}`),
    name,
    subtitle: normalize(dto?.productSku ?? dto?.subtitle) || undefined,
    sku,
    price: finalPrice,
    oldPrice,
    currency: normalize(dto?.currency) || 'RSD',
    brand,
    inStock,
    sizes,
    shortDescription: rawDescription || undefined,
    gallery,
    sizeQtyMap,
    sizeAttrElementIdMap,
    seoDescription,
    seoImage: pickSeoImage(gallery),
  };
}

export const productDetailsResolver: ResolveFn<ProductDetailsResolved | null> = (route) => {
  const api = inject(ProductsApiService);
  const id = normalize(route.paramMap.get('id'));
  if (!id) return of(null);

  return api.getVariantDetails(id).pipe(
    map((dto) => {
      if (!dto) return null;
      return toResolvedProduct(dto, id);
    }),
    catchError(() => of(null)),
  );
};
