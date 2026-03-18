import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export type SeoPageConfig = {
  title: string;
  description: string;
  path?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'product' | 'article';
  image?: string | null;
  imageAlt?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  noindex?: boolean;
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly siteUrl = String(environment.siteUrl || '').replace(/\/+$/, '');
  private readonly structuredDataId = 'app-structured-data';
  private readonly defaultSocialImagePath = '/assets/images/logo/planets_main_logo.png';
  private readonly defaultSocialImageAlt = 'Planeta webshop logo';

  setPage(config: SeoPageConfig): void {
    const pageTitle = config.title.trim();
    const description = config.description.trim();
    const canonical = this.resolveCanonical(config);
    const robots = config.noindex ? 'noindex, nofollow' : 'index, follow';
    const ogType = config.ogType ?? 'website';

    this.title.setTitle(pageTitle);

    this.updateMetaByName('description', description);
    this.updateMetaByName('robots', robots);

    this.updateMetaByProperty('og:type', ogType);
    this.updateMetaByProperty('og:site_name', 'Planeta');
    this.updateMetaByProperty('og:title', pageTitle);
    this.updateMetaByProperty('og:description', description);
    this.updateMetaByProperty('og:url', canonical);
    this.updateMetaByProperty('og:locale', 'sr_BA');

    this.updateMetaByName('twitter:card', 'summary_large_image');
    this.updateMetaByName('twitter:title', pageTitle);
    this.updateMetaByName('twitter:description', description);
    this.updateMetaByName('twitter:url', canonical);

    const image = (config.image?.trim() || this.defaultSocialImagePath).trim();
    const imageAlt = (config.imageAlt?.trim() || this.defaultSocialImageAlt).trim();
    if (image) {
      const absoluteImage = this.absoluteUrl(image);
      this.updateMetaByProperty('og:image', absoluteImage);
      this.updateMetaByProperty('og:image:secure_url', absoluteImage);
      this.updateMetaByProperty('og:image:alt', imageAlt);
      this.updateMetaByProperty('og:image:type', this.detectMimeType(absoluteImage));
      this.updateMetaByName('twitter:image', absoluteImage);
      this.updateMetaByName('twitter:image:alt', imageAlt);

      const width = Number(config.imageWidth ?? 0);
      const height = Number(config.imageHeight ?? 0);

      if (width > 0) {
        this.updateMetaByProperty('og:image:width', String(width));
      } else {
        this.removeMetaByProperty('og:image:width');
      }

      if (height > 0) {
        this.updateMetaByProperty('og:image:height', String(height));
      } else {
        this.removeMetaByProperty('og:image:height');
      }
    } else {
      this.removeMetaByProperty('og:image');
      this.removeMetaByProperty('og:image:secure_url');
      this.removeMetaByProperty('og:image:alt');
      this.removeMetaByProperty('og:image:type');
      this.removeMetaByProperty('og:image:width');
      this.removeMetaByProperty('og:image:height');
      this.removeMetaByName('twitter:image');
      this.removeMetaByName('twitter:image:alt');
    }

    this.upsertCanonical(canonical);
  }

  setStructuredData(data: unknown): void {
    this.clearStructuredData();
    if (data === null || data === undefined) return;

    const script = this.document.createElement('script');
    script.id = this.structuredDataId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);

    this.document.head.appendChild(script);
  }

  clearStructuredData(): void {
    const existing = this.document.getElementById(this.structuredDataId);
    existing?.remove();
  }

  absoluteUrl(pathOrUrl?: string): string {
    const raw = (pathOrUrl ?? '').trim();
    if (!raw) return `${this.siteUrl}/`;
    if (/^https?:\/\//i.test(raw)) return raw;

    const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
    return `${this.siteUrl}${prefixed}`;
  }

  private resolveCanonical(config: SeoPageConfig): string {
    const candidate = config.canonicalUrl ?? config.path ?? '/';
    const absolute = this.absoluteUrl(candidate);

    const [withoutHash] = absolute.split('#');
    const [withoutQuery] = withoutHash.split('?');

    return withoutQuery.endsWith('/') ? withoutQuery : `${withoutQuery}`;
  }

  private upsertCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private updateMetaByName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private updateMetaByProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private removeMetaByName(name: string): void {
    this.meta.removeTag(`name="${name}"`);
  }

  private removeMetaByProperty(property: string): void {
    this.meta.removeTag(`property="${property}"`);
  }

  private detectMimeType(url: string): string {
    const path = url.toLowerCase().split('?')[0];
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/png';
  }
}
