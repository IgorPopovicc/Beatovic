import { Routes } from '@angular/router';
import { adminOnlyGuard } from './core/auth/admin.guard';
import { adminLoginRedirectGuard } from './core/auth/admin-login.guard';
import { productDetailsResolver } from './features/product-details/product-details.resolver';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page/home-page').then((m) => m.HomePage),
    data: {
      structuredDataManaged: true,
      seo: {
        title: 'Planeta webshop | Patike, odjeća i oprema online',
        description:
          'Planeta webshop nudi patike, odjeću i sportsku opremu uz sigurnu kupovinu, brzu isporuku i aktuelne akcije.',
      },
    },
  },
  { path: 'catalog', redirectTo: 'catalog/muskarci/obuca', pathMatch: 'full' },
  {
    path: 'products',
    loadComponent: () => import('./features/products/products').then((m) => m.Products),
    data: {
      structuredDataManaged: true,
      seo: {
        title: 'Proizvodi | Planeta',
        description: 'Pregled svih proizvoda i filtera u Planeta webshopu.',
      },
    },
  },
  { path: 'products/:gender/:category', redirectTo: 'catalog/:gender/:category' },
  {
    path: 'catalog/:section',
    loadComponent: () => import('./features/products/products').then((m) => m.Products),
    data: {
      structuredDataManaged: true,
      seo: {
        title: 'Kategorija | Planeta',
        description: 'Pregled proizvoda po kategoriji u Planeta webshopu.',
      },
    },
  },
  {
    path: 'catalog/:gender/:category',
    loadComponent: () => import('./features/products/products').then((m) => m.Products),
    data: {
      structuredDataManaged: true,
      seo: {
        title: 'Katalog | Planeta',
        description: 'Pregled proizvoda i filtera po kategorijama u Planeta webshopu.',
      },
    },
  },
  {
    path: 'catalog/:gender/:category/:subcategory',
    loadComponent: () => import('./features/products/products').then((m) => m.Products),
    data: {
      structuredDataManaged: true,
      seo: {
        title: 'Potkategorija | Planeta',
        description: 'Pregled proizvoda po potkategoriji u Planeta webshopu.',
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
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    resolve: {
      product: productDetailsResolver,
    },
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
        description: 'Unesite podatke za narudžbu i završite kupovinu.',
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
        title: 'Status narudžbe | Planeta',
        description: 'Status vaše narudžbe.',
        noindex: true,
      },
    },
  },
  {
    path: 'politika-privatnosti',
    loadComponent: () =>
      import('./features/privacy-policy/privacy-policy').then((m) => m.PrivacyPolicyComponent),
    data: {
      seo: {
        title: 'Politika privatnosti | Planeta',
        description: 'Informacije o obradi podataka u Planeta webshopu.',
      },
    },
  },
  {
    path: 'newsletter/subscribe',
    loadComponent: () =>
      import('./features/newsletter-subscribe-status/newsletter-subscribe-status-page').then(
        (m) => m.NewsletterSubscribeStatusPageComponent,
      ),
    data: { outcome: 'success', seo: { noindex: true } },
  },
  {
    path: 'newsletter/confirmed',
    loadComponent: () =>
      import('./features/action-status-page/action-status-page').then(
        (m) => m.ActionStatusPageComponent,
      ),
    data: {
      statusPage: {
        badge: 'Newsletter', tone: 'success', icon: '✓', title: 'Prijava je potvrđena',
        message: 'Vaša e-mail adresa je uspješno potvrđena i prijava na newsletter je aktivna.',
        primaryCtaText: 'Nazad na početnu', primaryCtaLink: '/',
      },
      seo: { noindex: true },
    },
  },
  {
    path: 'newsletter/invalid',
    loadComponent: () =>
      import('./features/action-status-page/action-status-page').then(
        (m) => m.ActionStatusPageComponent,
      ),
    data: {
      statusPage: {
        badge: 'Newsletter', tone: 'error', icon: '!', title: 'Link nije važeći',
        message: 'Link za potvrdu newsletter prijave je nevažeći ili je istekao.',
        primaryCtaText: 'Nova prijava', primaryCtaLink: '/',
      },
      seo: { noindex: true },
    },
  },
  {
    path: 'newsletter/unsubscribed',
    loadComponent: () =>
      import('./features/action-status-page/action-status-page').then(
        (m) => m.ActionStatusPageComponent,
      ),
    data: {
      statusPage: {
        badge: 'Newsletter', tone: 'success', icon: '✓', title: 'Uspješno ste odjavljeni',
        message: 'Vaša e-mail adresa više neće primati Planeta newsletter poruke.',
        primaryCtaText: 'Nazad na početnu', primaryCtaLink: '/',
      },
      seo: { noindex: true },
    },
  },
  { path: 'newsletter/subscribe-success', redirectTo: 'newsletter/subscribe', pathMatch: 'full' },
  { path: 'newsletter/subscribe-confirmed', redirectTo: 'newsletter/subscribe', pathMatch: 'full' },
  {
    path: 'newsletter/subscribe-failed',
    loadComponent: () =>
      import('./features/newsletter-subscribe-status/newsletter-subscribe-status-page').then(
        (m) => m.NewsletterSubscribeStatusPageComponent,
      ),
    data: { outcome: 'failure', seo: { noindex: true } },
  },
  { path: 'newsletter/subscribe-error', redirectTo: 'newsletter/subscribe-failed', pathMatch: 'full' },
  {
    path: 'newsletter/unsubscribe-failed',
    loadComponent: () =>
      import('./features/action-status-page/action-status-page').then(
        (m) => m.ActionStatusPageComponent,
      ),
    data: {
      statusPage: {
        badge: 'Newsletter', tone: 'error', icon: '!', title: 'Odjava nije uspjela',
        message: 'Link za odjavu nije važeći ili odjava trenutno nije dostupna.',
        primaryCtaText: 'Nazad na početnu', primaryCtaLink: '/',
      },
      seo: { noindex: true },
    },
  },
  { path: 'newsletter/unsubscribe-error', redirectTo: 'newsletter/unsubscribe-failed', pathMatch: 'full' },
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
    path: 'order/verification-failed',
    loadComponent: () =>
      import('./features/order-verification-failed/order-verification-failed-page').then(
        (m) => m.OrderVerificationFailedPageComponent,
      ),
    data: {
      seo: {
        title: 'Potvrda nije uspjela | Planeta',
        description: 'Potvrda narudžbe nije uspjela.',
        noindex: true,
      },
    },
  },
  ...[
    {
      path: 'order/confirmation/success', tone: 'success', icon: '✓',
      title: 'Narudžba je potvrđena',
      message: 'Hvala. Vaša narudžba je potvrđena i proslijeđena na obradu.',
    },
    {
      path: 'order/confirmation/already-confirmed', tone: 'info', icon: 'i',
      title: 'Narudžba je već potvrđena',
      message: 'Ova narudžba je već ranije potvrđena. Nije potrebna dodatna radnja.',
    },
    {
      path: 'order/confirmation/expired', tone: 'warning', icon: '!',
      title: 'Link je istekao',
      message: 'Rok od 60 minuta za potvrdu narudžbe je istekao.',
    },
    {
      path: 'order/confirmation/already-delivered', tone: 'info', icon: 'i',
      title: 'Narudžba je već isporučena',
      message: 'Ova narudžba je već evidentirana kao isporučena.',
    },
    {
      path: 'order/confirmation/rejected', tone: 'warning', icon: '!',
      title: 'Narudžba je odbijena',
      message: 'Potvrda nije prihvaćena i narudžba neće biti proslijeđena na obradu.',
    },
    {
      path: 'order/confirmation/error', tone: 'error', icon: '!',
      title: 'Potvrda nije uspjela',
      message: 'Došlo je do greške pri potvrdi narudžbe. Pokušajte ponovo ili nas kontaktirajte.',
    },
  ].map(({ path, tone, icon, title, message }) => ({
    path,
    loadComponent: () =>
      import('./features/action-status-page/action-status-page').then(
        (m) => m.ActionStatusPageComponent,
      ),
    data: {
      statusPage: {
        badge: 'Narudžba', tone, icon, title, message,
        primaryCtaText: 'Nazad na početnu', primaryCtaLink: '/',
        secondaryCtaText: 'Nastavi kupovinu', secondaryCtaLink: '/products',
      },
      seo: { noindex: true },
    },
  })),
  { path: 'orders/verify-failed', redirectTo: 'order/verification-failed', pathMatch: 'full' },
  {
    path: 'order/verify',
    loadComponent: () =>
      import('./features/order-email-verification/order-email-verification-page').then(
        (m) => m.OrderEmailVerificationPageComponent,
      ),
    data: {
      seo: {
        title: 'Potvrda narudžbe | Planeta',
        description: 'Status potvrde narudžbe putem email-a.',
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
        title: 'Potvrda narudžbe | Planeta',
        description: 'Status potvrde narudžbe putem email-a.',
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
        path: 'orders/:orderId',
        loadComponent: () =>
          import('./features/admin/pages/admin-orders/admin-orders').then((m) => m.AdminOrders),
        data: {
          seo: {
            title: 'Detalji narudžbe | Planeta',
            description: 'Administratorski detalji izabrane narudžbe.',
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
            title: 'Admin Narudžbe | Planeta',
            description: 'Upravljanje narudžbama.',
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
      {
        path: 'contact',
        loadComponent: () =>
          import('./features/admin/pages/admin-contact/admin-contact').then((m) => m.AdminContact),
        data: {
          seo: {
            title: 'Admin Kontakt | Planeta',
            description: 'Pregled kontakt poruka korisnika.',
            noindex: true,
          },
        },
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./features/admin/pages/admin-coupons/admin-coupons').then(
            (m) => m.AdminCoupons,
          ),
        data: {
          seo: {
            title: 'Admin Kuponi | Planeta',
            description: 'Upravljanje kuponima.',
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
