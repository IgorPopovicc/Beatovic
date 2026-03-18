import { Routes } from '@angular/router';
import { adminOnlyGuard } from './core/auth/admin.guard';
import { adminLoginRedirectGuard } from './core/auth/admin-login.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page/home-page').then((m) => m.HomePage),
    data: {
      seo: {
        title: 'Planeta webshop | Patike, odjeća i oprema online',
        description:
          'Planeta webshop nudi patike, odjeću i sportsku opremu uz sigurnu kupovinu, brzu isporuku i aktuelne akcije.',
      },
    },
  },
  { path: 'catalog', redirectTo: 'catalog/muskarci/obuca', pathMatch: 'full' },
  {
    path: 'catalog/:gender/:category',
    loadComponent: () => import('./features/products/products').then((m) => m.Products),
    data: {
      seo: {
        title: 'Katalog | Planeta',
        description: 'Pregled proizvoda i filtera po kategorijama u Planeta webshopu.',
      },
    },
  },
  {
    path: 'brands',
    loadComponent: () => import('./features/brands/brands-page').then((m) => m.BrandsPage),
    data: {
      seo: {
        title: 'Brendovi | Planeta',
        description: 'Pregled brendova dostupnih u Planeta webshopu.',
      },
    },
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart').then((m) => m.CartComponent),
    data: {
      seo: {
        title: 'Korpa | Planeta',
        description: 'Pregled izabranih proizvoda u korpi.',
        noindex: true,
      },
    },
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./features/product-details/product-details').then((m) => m.ProductDetails),
    data: {
      seo: {
        title: 'Proizvod | Planeta',
        description: 'Detalji proizvoda u Planeta webshopu.',
        ogType: 'product',
      },
    },
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/checkout/checkout').then((m) => m.CheckoutComponent),
    data: {
      seo: {
        title: 'Naplata | Planeta',
        description: 'Unesite podatke za porudžbinu i završite kupovinu.',
        noindex: true,
      },
    },
  },
  {
    path: 'order-result',
    loadComponent: () =>
      import('./features/order-result/order-result').then((m) => m.OrderResultComponent),
    data: {
      seo: {
        title: 'Status porudžbine | Planeta',
        description: 'Status vaše porudžbine.',
        noindex: true,
      },
    },
  },
  {
    path: 'newsletter/unsubscribe',
    loadComponent: () =>
      import('./features/newsletter-unsubscribe/newsletter-unsubscribe-page').then(
        (m) => m.NewsletterUnsubscribePageComponent,
      ),
    data: {
      seo: {
        title: 'Odjava sa newsletter-a | Planeta',
        description: 'Status odjave sa newsletter liste.',
        noindex: true,
      },
    },
  },
  {
    path: 'newsletter/unsubscribe/:token',
    loadComponent: () =>
      import('./features/newsletter-unsubscribe/newsletter-unsubscribe-page').then(
        (m) => m.NewsletterUnsubscribePageComponent,
      ),
    data: {
      seo: {
        title: 'Odjava sa newsletter-a | Planeta',
        description: 'Status odjave sa newsletter liste.',
        noindex: true,
      },
    },
  },
  {
    path: 'order/verify',
    loadComponent: () =>
      import('./features/order-email-verification/order-email-verification-page').then(
        (m) => m.OrderEmailVerificationPageComponent,
      ),
    data: {
      seo: {
        title: 'Potvrda porudžbine | Planeta',
        description: 'Status potvrde porudžbine putem email-a.',
        noindex: true,
      },
    },
  },
  {
    path: 'order/verify/:token',
    loadComponent: () =>
      import('./features/order-email-verification/order-email-verification-page').then(
        (m) => m.OrderEmailVerificationPageComponent,
      ),
    data: {
      seo: {
        title: 'Potvrda porudžbine | Planeta',
        description: 'Status potvrde porudžbine putem email-a.',
        noindex: true,
      },
    },
  },
  { path: 'orders/verify', redirectTo: 'order/verify', pathMatch: 'full' },
  { path: 'orders/verify/:token', redirectTo: 'order/verify/:token' },
  { path: 'order-confirmation', redirectTo: 'order/verify', pathMatch: 'full' },
  { path: 'order-confirmation/:token', redirectTo: 'order/verify/:token' },
  { path: 'confirm-order', redirectTo: 'order/verify', pathMatch: 'full' },
  { path: 'confirm-order/:token', redirectTo: 'order/verify/:token' },
  {
    path: 'admin',
    pathMatch: 'full',
    canMatch: [adminLoginRedirectGuard],
    loadComponent: () => import('./features/admin-login/admin-login').then((m) => m.AdminLogin),
    data: {
      seo: {
        title: 'Admin prijava | Planeta',
        description: 'Prijava za administratore sistema.',
        noindex: true,
      },
    },
  },
  {
    path: 'admin',
    canMatch: [adminOnlyGuard],
    loadComponent: () =>
      import('./features/admin/admin-layout/admin-layout').then((m) => m.AdminLayout),
    data: {
      seo: {
        title: 'Admin | Planeta',
        description: 'Administratorski panel.',
        noindex: true,
      },
    },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'panel' },
      {
        path: 'panel',
        loadComponent: () =>
          import('./features/admin/pages/admin-dashboard/admin-dashboard').then(
            (m) => m.AdminDashboard,
          ),
        data: {
          seo: {
            title: 'Admin Dashboard | Planeta',
            description: 'Administratorski pregled sistema.',
            noindex: true,
          },
        },
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/admin/pages/admin-products/admin-products').then(
            (m) => m.AdminProducts,
          ),
        data: {
          seo: {
            title: 'Admin Proizvodi | Planeta',
            description: 'Upravljanje proizvodima i modelima.',
            noindex: true,
          },
        },
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/admin/pages/admin-orders/admin-orders').then((m) => m.AdminOrders),
        data: {
          seo: {
            title: 'Admin Narudžbine | Planeta',
            description: 'Upravljanje narudžbinama.',
            noindex: true,
          },
        },
      },
      {
        path: 'discounts',
        loadComponent: () =>
          import('./features/admin/pages/admin-discounts/admin-discounts').then(
            (m) => m.AdminDiscounts,
          ),
        data: {
          seo: {
            title: 'Admin Popusti | Planeta',
            description: 'Upravljanje popustima.',
            noindex: true,
          },
        },
      },
      {
        path: 'newsletter',
        loadComponent: () =>
          import('./features/admin/pages/admin-newsletter/admin-newsletter').then(
            (m) => m.AdminNewsletter,
          ),
        data: {
          seo: {
            title: 'Admin Newsletter | Planeta',
            description: 'Upravljanje newsletter sadržajem.',
            noindex: true,
          },
        },
      },
    ],
  },
  {
    path: '404',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFoundComponent),
    data: {
      seo: {
        title: 'Stranica nije pronađena | Planeta',
        description: 'Tražena stranica ne postoji ili je premještena.',
        noindex: true,
      },
    },
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFoundComponent),
    data: {
      seo: {
        title: 'Stranica nije pronađena | Planeta',
        description: 'Tražena stranica ne postoji ili je premještena.',
        noindex: true,
      },
    },
  },
];
