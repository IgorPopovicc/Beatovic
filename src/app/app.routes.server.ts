import { RenderMode, type ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },

  { path: 'catalog/:gender/:category', renderMode: RenderMode.Server },
  { path: 'product/:id', renderMode: RenderMode.Server },

  { path: '**', renderMode: RenderMode.Server },
];
