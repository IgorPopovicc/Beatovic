import {
  ApplicationConfig,
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

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { backendFallbackInterceptor } from './core/system/backend-fallback.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
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
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, backendFallbackInterceptor])),
  ],
};
