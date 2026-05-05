import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SeoService } from './seo.service';
import { ProductDetailsResolved } from '../../features/product-details/product-details.resolver';
import { normalizeCurrencyCode } from '../../shared/utils/currency';

type RouteSeoData = {
  title: string;
  description: string;
  noindex?: boolean;
  ogType?: 'website' | 'product' | 'article';
  image?: string | null;
  imageAlt?: string | null;
};

@Injectable({ providedIn: 'root' })
export class RouteSeoService {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  private readonly defaultTitle = 'Planeta webshop | Patike, odjeća i oprema online';
  private readonly defaultDescription =
    'Planeta webshop nudi patike, odjeću i sportsku opremu uz sigurnu kupovinu, brzu isporuku i aktuelne akcije.';

  constructor() {
    this.refresh();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    this.applyFromRoute();
  }

  private applyFromRoute(): void {
    const leaf = this.deepest(this.router.routerState.snapshot.root);
    const path = this.router.url.split('?')[0] || '/';
    const resolvedProduct = leaf.data['product'] as ProductDetailsResolved | null | undefined;

    if (resolvedProduct !== undefined) {
      this.applyProductSeo(path, resolvedProduct);
      return;
    }

    const seoData = leaf.data['seo'] as RouteSeoData | undefined;

    if (!seoData) {
      this.seo.setPage({
        title: this.defaultTitle,
        description: this.defaultDescription,
        path,
        ogType: 'website',
      });
      this.seo.clearStructuredData();
      return;
    }

    this.seo.setPage({
      title: seoData.title,
      description: seoData.description,
      noindex: seoData.noindex,
      ogType: seoData.ogType ?? 'website',
      image: seoData.image ?? null,
      imageAlt: seoData.imageAlt ?? null,
      path,
    });

    const managedByComponent = leaf.data['structuredDataManaged'] === true;
    if (!managedByComponent) {
      this.seo.clearStructuredData();
    }
  }

  private applyProductSeo(path: string, product: ProductDetailsResolved | null): void {
    if (!product) {
      this.seo.setPage({
        title: 'Proizvod nije dostupan | Planeta',
        description: 'Traženi proizvod nije dostupan ili ne postoji.',
        path,
        ogType: 'website',
        noindex: true,
      });
      this.seo.clearStructuredData();
      return;
    }

    const description = (product.seoDescription || product.shortDescription || product.name).trim();
    const primaryImage = product.gallery?.[0] ?? null;
    const imageCandidate =
      product.seoImage?.url ?? primaryImage?.desktop ?? primaryImage?.mobile ?? null;
    const isProductPlaceholder =
      String(imageCandidate ?? '')
        .toLowerCase()
        .includes('/assets/images/products/test.webp') ||
      String(imageCandidate ?? '')
        .toLowerCase()
        .includes('assets/images/products/test.webp');
    const absoluteImage =
      imageCandidate && !isProductPlaceholder ? this.seo.absoluteUrl(imageCandidate) : null;
    const imageAlt = (product.seoImage?.alt || primaryImage?.alt || product.name).trim();

    this.seo.setPage({
      title: `${product.name} | Planeta`,
      description,
      path,
      ogType: 'product',
      image: absoluteImage,
      imageAlt,
      imageWidth: Number(primaryImage?.w ?? 0) || null,
      imageHeight: Number(primaryImage?.h ?? 0) || null,
    });

    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Product',
      url: this.seo.absoluteUrl(path),
      name: product.name,
      description,
      image: absoluteImage
        ? [absoluteImage]
        : [this.seo.absoluteUrl('/planeta-share.png')],
      sku: product.sku ?? product.id,
      brand: {
        '@type': 'Brand',
        name: product.brand || 'Planeta',
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: normalizeCurrencyCode(product.currency),
        price: Number(product.price || 0).toFixed(2),
        availability: product.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        url: this.seo.absoluteUrl(path),
      },
    });
  }

  private deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
}
