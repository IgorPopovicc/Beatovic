import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, inject, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  scrollTo(fragment: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const element = this.document.getElementById(fragment);
    element?.scrollIntoView({ behavior: 'smooth' });
  }
}
