import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';

type Status = 'success' | 'error';

@Component({
  selector: 'app-order-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-result.html',
  styleUrl: './order-result.scss',
})
export class OrderResultComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly seo = inject(SeoService);

  private readonly navState = this.readNavigationState();

  status = computed<Status>(() => {
    const qp = (this.route.snapshot.queryParamMap.get('status') || '') as Status;
    return (this.navState.status || qp || 'error') === 'success' ? 'success' : 'error';
  });

  email = computed(() => String(this.navState.email || ''));
  error = computed(() => String(this.navState.error || ''));

  ngOnInit(): void {
    if (this.status() === 'success') {
      this.seo.setPage({
        title: 'Porudžbina uspješna | Planeta',
        description: 'Vaša porudžbina je uspješno primljena.',
        path: '/order-result',
        noindex: true,
      });
      return;
    }

    this.seo.setPage({
      title: 'Porudžbina nije uspješna | Planeta',
      description: 'Došlo je do greške prilikom slanja porudžbine.',
      path: '/order-result',
      noindex: true,
    });
  }

  private readNavigationState(): {
    status?: Status;
    email?: string;
    error?: string;
  } {
    if (!isPlatformBrowser(this.platformId) || typeof history === 'undefined') {
      return {};
    }

    return (history.state || {}) as {
      status?: Status;
      email?: string;
      error?: string;
    };
  }
}
