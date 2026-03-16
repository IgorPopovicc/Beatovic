import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { BrandsSlider } from '../../shared/ui/brands-slider/brands-slider';

@Component({
  selector: 'app-brands-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BrandsSlider],
  templateUrl: './brands-page.html',
  styleUrl: './brands-page.scss',
})
export class BrandsPage implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Brendovi | Planeta',
      description: 'Pregled sportskih i lifestyle brendova dostupnih u Planeta webshopu.',
      path: '/brands',
      ogType: 'website',
    });
  }
}
