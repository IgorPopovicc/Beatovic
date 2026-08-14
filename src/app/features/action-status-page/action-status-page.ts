import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { StatusPageComponent, StatusTone } from '../../shared/ui/status-page/status-page';

export interface ActionStatusPageConfig {
  badge: string;
  tone: StatusTone;
  icon: string;
  title: string;
  message: string;
  details?: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
}

@Component({
  selector: 'app-action-status-page',
  standalone: true,
  imports: [StatusPageComponent],
  template: `
    <app-status-page
      [badge]="config.badge"
      [tone]="config.tone"
      [icon]="config.icon"
      [title]="config.title"
      [message]="config.message"
      [details]="config.details ?? null"
      [primaryCtaText]="config.primaryCtaText"
      [primaryCtaLink]="config.primaryCtaLink"
      [secondaryCtaText]="config.secondaryCtaText ?? null"
      [secondaryCtaLink]="config.secondaryCtaLink ?? null"
    />
  `,
})
export class ActionStatusPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  readonly config = this.route.snapshot.data['statusPage'] as ActionStatusPageConfig;

  ngOnInit(): void {
    this.seo.setPage({
      title: `${this.config.title} | Planeta`,
      description: this.config.message,
      path: `/${this.route.snapshot.url.map((segment) => segment.path).join('/')}`,
      noindex: true,
    });
  }
}
