import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogApiService } from '../../../core/api/catalog-api.sevice';

@Component({
  selector: 'app-brands-slider',
  imports: [RouterLink],
  templateUrl: './brands-slider.html',
  styleUrl: './brands-slider.scss',
})
export class BrandsSlider implements OnInit {
  private readonly catalogApi = inject(CatalogApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly brands = signal<Array<{ id: string; name: string }>>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly layout = input<'marquee' | 'grid'>('marquee');

  ngOnInit(): void {
    this.catalogApi
      .getCategoryValuesByName('BREND')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const seen = new Set<string>();
          const brands = (result?.values ?? [])
            .map((value) => ({
              id: value.id,
              name: String(value.displayValue ?? value.value ?? '').trim(),
            }))
            .filter((brand) => {
              const key = brand.name.toLocaleUpperCase('bs-BA');
              if (!brand.name || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          this.brands.set(brands);
          this.error.set(result ? null : 'Kategorija brendova nije dostupna.');
          this.loading.set(false);
        },
        error: () => {
          this.brands.set([]);
          this.error.set('Brendove trenutno nije moguće učitati.');
          this.loading.set(false);
        },
      });
  }
}
