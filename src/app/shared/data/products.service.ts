import { Injectable, signal } from '@angular/core';
import { PRODUCTS_MOCK, ProductDetailsModel } from './products.mock';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private products = signal<ProductDetailsModel[]>(PRODUCTS_MOCK);

  getBySlug(slug: string): ProductDetailsModel | null {
    return this.products().find(p => p.slug === slug) ?? null;
  }

  async getById(id: string): Promise<ProductDetailsModel | null> {
    const found = PRODUCTS_MOCK.find(p => p.id === id);
    return found ?? null;
  }
}
