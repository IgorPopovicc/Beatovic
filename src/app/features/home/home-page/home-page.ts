import { Component, inject, OnInit } from '@angular/core';
import { HeroSlider } from '../../../shared/ui/hero-slider/hero-slider';
import { BrandsSlider } from '../../../shared/ui/brands-slider/brands-slider';
import { NewCollection } from '../../../shared/ui/new-collection/new-collection';
import { DiscountSlider } from '../../../shared/ui/discount-slider/discount-slider';
import { SalomonSpotlight } from '../../../shared/ui/salomon-spotlight/salomon-spotlight';
import { SeoService } from '../../../core/seo/seo.service';

@Component({
  selector: 'app-home-page',
  imports: [HeroSlider, BrandsSlider, NewCollection, DiscountSlider, SalomonSpotlight],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Planeta | Online Shop',
      description:
        'Planeta webshop: patike, odjeća i oprema sa brzom isporukom i sigurnom kupovinom.',
      path: '/',
      ogType: 'website',
    });

    this.seo.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Planeta',
      url: this.seo.absoluteUrl('/'),
      potentialAction: {
        '@type': 'SearchAction',
        target: `${this.seo.absoluteUrl('/catalog/muskarci/obuca')}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });
  }
}
