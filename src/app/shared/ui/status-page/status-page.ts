import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type StatusTone = 'success' | 'warning' | 'error' | 'info';

@Component({
  selector: 'app-status-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './status-page.html',
  styleUrl: './status-page.scss',
})
export class StatusPageComponent {
  readonly badge = input('Planeta');
  readonly tone = input<StatusTone>('info');

  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly details = input<string | null>(null);

  readonly icon = input('i');

  readonly loading = input(false);
  readonly loadingText = input('Obrađujemo zahtjev...');

  readonly primaryCtaText = input<string | null>(null);
  readonly primaryCtaLink = input<string | null>(null);
  readonly secondaryCtaText = input<string | null>(null);
  readonly secondaryCtaLink = input<string | null>(null);
}
