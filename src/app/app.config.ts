import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeBs from '@angular/common/locales/bs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { backendFallbackInterceptor } from './core/system/backend-fallback.interceptor';
import { APP_CURRENCY_CODE, APP_LOCALE } from './shared/utils/currency';
import { turnstileInterceptor } from './core/security/turnstile.interceptor';

registerLocaleData(localeBs);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: APP_LOCALE },
    { provide: DEFAULT_CURRENCY_CODE, useValue: APP_CURRENCY_CODE },
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      withRouterConfig({
        onSameUrlNavigation: 'reload',
      }),
    ),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: true,
        filter: (req) => {
          if (req.method === 'POST') {
            return req.url.endsWith('/products/search');
          }
          return req.method === 'GET' || req.method === 'HEAD';
        },
      }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([turnstileInterceptor, authInterceptor, backendFallbackInterceptor]),
    ),
  ],
};
