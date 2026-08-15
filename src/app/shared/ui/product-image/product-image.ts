import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { runtimeMediaUrl } from '../../../core/config/runtime-config.service';

export type ProductImageVariant = 'thumbnail' | 'card' | 'large';

@Component({
  selector: 'app-product-image',
  standalone: true,
  templateUrl: './product-image.html',
  styleUrl: './product-image.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductImageComponent implements OnChanges {
  @Input() src: string | null | undefined = '';
  @Input() mobileSrc: string | null | undefined = '';
  @Input() alt = 'Proizvod';
  @Input() variant: ProductImageVariant = 'card';
  @Input() width = 800;
  @Input() height = 800;
  @Input() sizes = '100vw';
  @Input() priority = false;

  protected resolvedSrc = '';
  protected resolvedMobileSrc = '';
  protected failed = false;

  protected get hasImage(): boolean {
    return !!this.resolvedSrc && !this.failed;
  }

  protected get hasDistinctMobileImage(): boolean {
    return (
      this.hasImage &&
      !!this.resolvedMobileSrc &&
      this.resolvedMobileSrc !== this.resolvedSrc
    );
  }

  protected get accessibleFallbackLabel(): string {
    const productName = String(this.alt ?? '').trim();
    return productName
      ? `Slika proizvoda ${productName} trenutno nije dostupna`
      : 'Slika proizvoda trenutno nije dostupna';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['src'] && !changes['mobileSrc']) return;

    const desktop = runtimeMediaUrl(this.src);
    const mobile = runtimeMediaUrl(this.mobileSrc);
    this.resolvedSrc = desktop || mobile;
    this.resolvedMobileSrc = mobile || desktop;
    this.failed = false;
  }

  protected onImageError(): void {
    if (this.failed) return;
    this.failed = true;
  }
}
