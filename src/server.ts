import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeConfig } from './app/core/config/runtime-config.service';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = join(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/runtime-config.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(join(browserDistFolder, 'runtime-config.js'));
});

app.get('/robots.txt', (_req, res) => {
  const { siteUrl } = resolveRuntimeConfig();
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order-result\nDisallow: /newsletter/\nDisallow: /order/\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
});

let sitemapCache: { xml: string; expiresAt: number } | null = null;

app.get('/sitemap.xml', async (_req, res) => {
  if (sitemapCache && sitemapCache.expiresAt > Date.now()) {
    res.type('application/xml').send(sitemapCache.xml);
    return;
  }

  const { siteUrl, apiBaseUrl } = resolveRuntimeConfig();
  const paths = new Set(['/', '/products', '/brands', '/politika-privatnosti']);

  try {
    const categoriesResponse = await fetch(`${apiBaseUrl}/categories`);
    if (categoriesResponse.ok) {
      const categories = (await categoriesResponse.json()) as Array<{ id?: string; name?: string }>;
      const byName = (name: string) =>
        categories.find((category) => String(category.name ?? '').toUpperCase() === name)?.id;
      const polId = byName('POL');
      const categoryId = byName('KATEGORIJA');

      if (polId && categoryId) {
        const [gendersResponse, categoryValuesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/categories/${encodeURIComponent(polId)}/values?onlyRoot=true`),
          fetch(`${apiBaseUrl}/categories/${encodeURIComponent(categoryId)}/values?onlyRoot=true`),
        ]);
        if (gendersResponse.ok && categoryValuesResponse.ok) {
          const genders = (await gendersResponse.json()) as Array<{ value?: string }>;
          const categoryValues = (await categoryValuesResponse.json()) as Array<{ value?: string }>;
          const publicGenders = new Set(['MUSKARCI', 'ZENE', 'DECA', 'BEBE']);
          const primaryCategories = new Set(['OBUCA', 'ODECA', 'AKSESOARI']);
          const slug = (value: string) => value.trim().toLowerCase().replace(/_/g, '-');

          for (const category of categoryValues) {
            const value = String(category.value ?? '').trim().toUpperCase();
            if (value) paths.add(`/catalog/${slug(value)}`);
          }
          for (const gender of genders) {
            const genderValue = String(gender.value ?? '').trim().toUpperCase();
            if (!publicGenders.has(genderValue)) continue;
            for (const category of categoryValues) {
              const categoryValue = String(category.value ?? '').trim().toUpperCase();
              if (primaryCategories.has(categoryValue)) {
                paths.add(`/catalog/${slug(genderValue)}/${slug(categoryValue)}`);
              }
            }
          }
        }
      }
    }

    const productsResponse = await fetch(`${apiBaseUrl}/products/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 0, pageSize: 1000, sortBy: 'NAME', sortOrder: 'ASC' }),
    });
    if (productsResponse.ok) {
      const productPage = (await productsResponse.json()) as { variants?: Array<{ id?: string }> };
      for (const variant of productPage.variants ?? []) {
        const id = String(variant.id ?? '').trim();
        if (id) paths.add(`/product/${encodeURIComponent(id)}`);
      }
    }
  } catch (error) {
    console.warn('[sitemap] Dynamic catalog entries are temporarily unavailable.', error);
  }

  const escapeXml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const urls = Array.from(paths)
    .map((path) => `  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  sitemapCache = { xml, expiresAt: Date.now() + 60 * 60 * 1000 };
  res.type('application/xml').send(xml);
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
