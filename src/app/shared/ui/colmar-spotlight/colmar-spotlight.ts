import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-colmar-spotlight',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './colmar-spotlight.html',
  styleUrl: './colmar-spotlight.scss',
})
export class ColmarSpotlight {
  readonly config = {
    eyebrow: 'COLMAR PERFORMANCE',
    headline: 'Premium stil za grad i planinu',
    description:
      'Tehnički detalji, čiste linije i italijanski dizajn za dane koji počinju u gradu, a završavaju izvan njega.',
    ctaLabel: 'Istraži Colmar kolekciju',
    ctaLink: ['/products'],
    ctaQueryParams: { search: 'colmar' },
    campaignImage: 'assets/images/home/colmar-performance-campaign.jpg',
  } as const;
}
