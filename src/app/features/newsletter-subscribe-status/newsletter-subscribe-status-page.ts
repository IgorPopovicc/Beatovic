import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { StatusPageComponent } from '../../shared/ui/status-page/status-page';

@Component({
  selector: 'app-newsletter-subscribe-status-page',
  standalone: true,
  imports: [StatusPageComponent],
  templateUrl: './newsletter-subscribe-status-page.html',
  styleUrl: './newsletter-subscribe-status-page.scss',
})
export class NewsletterSubscribeStatusPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  readonly successful = computed(() => {
    const status = String(this.route.snapshot.queryParamMap.get('status') ?? '')
      .trim()
      .toLowerCase();
    if (['failed', 'error', 'invalid', 'expired'].includes(status)) return false;
    return this.route.snapshot.data['outcome'] !== 'failure';
  });

  constructor() {
    effect(() => {
      const successful = this.successful();
      this.seo.setPage({
        title: successful ? 'Newsletter prijava potvrđena | Planeta' : 'Potvrda nije uspjela | Planeta',
        description: successful
          ? 'Vaša newsletter prijava je uspješno potvrđena.'
          : 'Newsletter prijava nije mogla biti potvrđena.',
        path: successful ? '/newsletter/subscribe' : '/newsletter/subscribe-failed',
        noindex: true,
      });
    });
  }
}
