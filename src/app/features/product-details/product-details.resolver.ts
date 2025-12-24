// src/app/features/product-details/product-details.resolver.ts
import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProductsApiService } from '../../core/api/products-api.service';
import { environment } from '../../../environments/environment';

// Minimalno šta ti template očekuje.
// Možeš proširiti po potrebi.
export type ProductDetailsUI = {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  sku?: string;
  price: number;
  oldPrice?: number | null;
  currency?: string;
  brand: string;
  inStock: boolean;
  sizes?: Array<string | number>;
  shortDescription?: string;
  gallery: Array<{
    desktop: string;
    mobile: string;
    alt: string;
    w: number;
    h: number;
  }>;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const productDetailsResolver: ResolveFn<ProductDetailsUI | null> = (route) => {
  const api = inject(ProductsApiService);
  const id = route.paramMap.get('id');
  if (!id) return of(null);

  // Ovaj base mora biti APSOLUTAN za SEO/OG:
  const mediaBase = environment.mediaProductBaseUrl;
  const currency = 'RSD';

  return api.getVariantDetails(id).pipe(
    map((d: any) => {
      // images[] dolazi iz details endpoint-a
      const imgs = (d?.images ?? []) as Array<{ url: string; displayed?: boolean }>;
      const ordered = [
        ...imgs.filter(i => i.displayed),
        ...imgs.filter(i => !i.displayed),
      ];

      const gallery = (ordered.length ? ordered : []).map((i) => {
        const abs = i?.url ? (mediaBase + i.url) : 'assets/images/placeholder.png';
        return {
          desktop: abs,
          mobile: abs,
          alt: d?.productName ?? 'Proizvod',
          w: 1200,
          h: 1200,
        };
      });

      const finalPrice = Number(d?.finalPrice ?? d?.price ?? 0);
      const originalPrice = Number(d?.originalPrice ?? finalPrice);
      const hasDiscount = originalPrice > finalPrice;

      // Brand/sizes: prilagodi prema realnom shape-u koji ti BE vraća u details.
      // Ako details vraća categories/attributes, ovdje izvuci:
      const brand =
        d?.categories?.find((c: any) => String(c?.categoryName ?? '').toUpperCase() === 'BREND')?.value
        ?? d?.brand
        ?? '—';

      const sizes =
        (d?.attributes ?? [])
          .filter((a: any) => String(a?.attributeName ?? '').toUpperCase() === 'VELICINA')
          .map((a: any) => a?.value)
          .filter(Boolean)
        ?? [];

      const sku = d?.sku ?? d?.productSku ?? d?.variantSku;

      const slug = slugify(`${d?.productName ?? 'proizvod'}-${sku ?? id}`);

      return {
        id,
        slug,
        name: d?.productName ?? 'Proizvod',
        subtitle: d?.productSku ?? undefined,
        sku: sku ?? undefined,
        price: finalPrice,
        oldPrice: hasDiscount ? originalPrice : null,
        currency,
        brand,
        inStock: (Number(d?.quantity ?? 0) > 0),
        sizes,
        shortDescription: d?.shortDescription ?? d?.description ?? undefined,
        gallery,
      } satisfies ProductDetailsUI;
    }),
    catchError(() => of(null))
  );
};
