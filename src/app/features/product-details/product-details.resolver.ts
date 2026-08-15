import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductsApiService } from '../../core/api/products-api.service';
import { ProductDetailsModel } from '../../shared/data/products.models';
import { runtimeMediaUrl } from '../../core/config/runtime-config.service';
import { normalizeCurrencyCode } from '../../shared/utils/currency';
import { Variant } from '../../core/api/catalog.models';
import { ProductCard } from '../../shared/ui/product-card/product-card';

export type ProductDetailsResolved = ProductDetailsModel & {
  sizeQtyMap: Record<string, number>;
  sizeAttrElementIdMap: Record<string, string>;
  seoDescription: string;
  seoImage: { url: string; alt: string } | null;
  relatedProducts: ProductCard[];
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
  return runtimeMediaUrl(pathOrUrl);
}

function firstResolvedMedia(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const resolved = resolveMediaUrl(normalize(candidate));
    if (resolved) return resolved;
  }
  return '';
}

function pickBrand(dto: Variant): string {
  const categories = Array.isArray(dto?.categories) ? dto.categories : [];
  const fromCategory = categories.find((c) => normalizeKey(c?.categoryName) === 'BREND');
  return normalize(fromCategory?.displayValue ?? fromCategory?.value ?? dto?.brand ?? '') || 'Planeta';
}

function buildSizeMaps(dto: Variant): {
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

function buildGallery(dto: Variant, productName: string): ProductDetailsModel['gallery'] {
  const images = Array.isArray(dto?.images) ? dto.images : [];
  const displayed = images.find((img) => !!img?.displayed);
  const orderedImages = displayed
    ? [displayed, ...images.filter((image) => image.id !== displayed.id)]
    : images;

  const candidates = orderedImages.map((image) => ({
    web: firstResolvedMedia(image.webUrl, image.url, image.originalUrl),
    thumbnail: firstResolvedMedia(
      image.thumbnailUrl,
      image.webUrl,
      image.url,
      image.originalUrl,
    ),
    original: firstResolvedMedia(image.originalUrl, image.url, image.webUrl),
  }));

  candidates.push({
    web: firstResolvedMedia(dto.mainImageWebUrl, dto.mainImageUrl, dto.mainImageName),
    thumbnail: firstResolvedMedia(
      dto.mainImageThumbnailUrl,
      dto.mainImageWebUrl,
      dto.mainImageUrl,
      dto.mainImageName,
    ),
    original: firstResolvedMedia(dto.mainImageUrl, dto.mainImageName, dto.mainImageWebUrl),
  });

  const gallery: ProductDetailsModel['gallery'] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const web = resolveMediaUrl(normalize(candidate.web));
    if (!web || seen.has(web)) continue;
    seen.add(web);
    gallery.push({
      desktop: web,
      mobile: web,
      thumbnail: resolveMediaUrl(normalize(candidate.thumbnail)) || web,
      original: resolveMediaUrl(normalize(candidate.original)) || web,
      alt: productName,
      w: 1200,
      h: 1200,
    });
  }

  if (!gallery.length) {
    gallery.push({
      desktop: '',
      mobile: '',
      thumbnail: '',
      original: '',
      alt: productName,
      w: 1200,
      h: 1200,
    });
  }

  return gallery;
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

function buildRelatedProducts(dto: Variant): ProductCard[] {
  return (dto.relatedProducts ?? [])
    .map((related): ProductCard | null => {
      const id = normalize(related.variantId ?? related.id);
      const name = normalize(related.productName ?? related.name);
      if (!id || !name) return null;

      const sku = normalize(related.sku);
      const finalPrice = Number(related.finalPrice ?? related.price ?? related.originalPrice ?? 0);
      const originalPrice = Number(related.originalPrice ?? finalPrice);
      const image = firstResolvedMedia(
        related.mainImageWebUrl,
        related.mainImageUrl,
        related.mainImageThumbnailUrl,
        related.mainImageName,
      );

      return {
        id,
        slug: slugify(`${name}-${sku || id}`),
        name,
        subtitle: normalize(related.displaySku) || sku || undefined,
        price: Number.isFinite(finalPrice) ? finalPrice : 0,
        oldPrice:
          Number.isFinite(originalPrice) && originalPrice > finalPrice ? originalPrice : null,
        currency: normalizeCurrencyCode(related.currency),
        image: {
          desktop: image,
          mobile: image,
          alt: name,
          w: 800,
          h: 800,
        },
      };
    })
    .filter((related): related is ProductCard => related !== null);
}

function toResolvedProduct(dto: Variant, id: string): ProductDetailsResolved {
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
    displaySku: normalize(dto?.displaySku) || sku,
    price: finalPrice,
    oldPrice,
    currency: normalizeCurrencyCode(dto?.currency),
    brand,
    inStock,
    sizes,
    shortDescription: rawDescription || undefined,
    gallery,
    sizeQtyMap,
    sizeAttrElementIdMap,
    seoDescription,
    seoImage: pickSeoImage(gallery),
    relatedProducts: buildRelatedProducts(dto),
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
