import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';

@Component({
  selector: 'app-coming-soon',
  imports: [NgOptimizedImage],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  private readonly config = inject(RuntimeConfigService);

  protected readonly storefrontHost = this.getStorefrontHost(this.config.siteUrl);

  private getStorefrontHost(siteUrl: string): string {
    try {
      return new URL(siteUrl).host.replace(/^www\./i, '');
    } catch {
      return siteUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    }
  }
}
