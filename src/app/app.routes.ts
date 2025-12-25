import { Routes } from '@angular/router';
import { HomePage } from './features/home/home-page/home-page';
import { Products } from './features/products/products';
import { CartComponent } from './features/cart/cart';

import { adminOnlyGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  { path: '', component: HomePage, pathMatch: 'full' },
  { path: 'catalog/:gender/:category', component: Products },
  { path: 'cart', component: CartComponent },

  {
    path: 'product/:id',
    loadComponent: () =>
      import('./features/product-details/product-details').then(m => m.ProductDetails),
  },

  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin-login/admin-login').then(m => m.AdminLogin),
  },

  {
    path: 'admin',
    canMatch: [adminOnlyGuard],
    loadComponent: () =>
      import('./features/admin/admin-layout/admin-layout').then(m => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'panel' },

      {
        path: 'panel',
        loadComponent: () =>
          import('./features/admin/pages/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/admin/pages/admin-products/admin-products').then(m => m.AdminProducts),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/admin/pages/admin-orders/admin-orders').then(m => m.AdminOrders),
      },
      {
        path: 'discounts',
        loadComponent: () =>
          import('./features/admin/pages/admin-discounts/admin-discounts').then(m => m.AdminDiscounts),
      },
      {
        path: 'newsletter',
        loadComponent: () =>
          import('./features/admin/pages/admin-newsletter/admin-newsletter').then(m => m.AdminNewsletter),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
