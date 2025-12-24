import { Routes } from '@angular/router';
import { HomePage } from './features/home/home-page/home-page';
import { Products } from './features/products/products';
import { CartComponent } from './features/cart/cart';

export const routes: Routes = [
  { path: '', component: HomePage, pathMatch: 'full' },
  { path: 'catalog/:gender/:category', component: Products },
  { path: 'cart', component: CartComponent },

  {
    path: 'product/:id',
    loadComponent: () =>
      import('./features/product-details/product-details').then(m => m.ProductDetails),
  },

  { path: '**', redirectTo: '' },
];
