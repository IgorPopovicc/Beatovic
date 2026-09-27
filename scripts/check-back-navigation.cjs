// Run after npm run build:prod. Uses an existing Playwright installation; no app dependency.
// PLAYWRIGHT_PATH=/absolute/path/to/playwright node scripts/check-back-navigation.cjs
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist/Beatovic/browser');
const output = path.resolve(__dirname, '../tmp/back-navigation');
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(`${root}/`) && file !== root) {
      res.writeHead(403).end();
      return;
    }
    if (!path.extname(file)) file = path.join(root, 'index.csr.html');
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
const variant = (id) => ({
  id,
  productName: `Model ${id}`,
  sku: id,
  finalPrice: 120,
  originalPrice: 150,
  currency: 'BAM',
  brand: 'Planeta',
  productDescription: 'Opis proizvoda',
  images: [
    {
      id: 'image',
      displayed: true,
      webUrl: '/assets/images/products/no-image.svg',
      thumbnailUrl: '/assets/images/products/no-image.svg',
    },
  ],
  attributes: [
    {
      id: `size-${id}`,
      attributeId: 'size',
      attributeName: 'VELICINA',
      attributeValueId: '42',
      value: '42',
      quantity: 5,
    },
  ],
  relatedProducts: id === 'a' ? [{ id: 'b' }] : [],
});
const facets = (name, id, value) => ({ name, id, values: [{ id: value, value, count: 500 }] });
const query = new URLSearchParams({
  search: 'dark',
  page: '3',
  sort: 'cijena_rastuce',
  stock: '1',
  sale: '1',
  minPrice: '50',
  maxPrice: '250',
  cf: JSON.stringify({ brand: ['nike'] }),
  af: JSON.stringify({ size: ['42'], color: ['black'] }),
  campaign: 'preserve-me',
});
let browser;
(async () => {
  await fs.mkdir(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const report = [];
  for (const width of [1440, 1024, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width <= 768,
    });
    const searches = [];
    const errors = [];
    await context.addInitScript(() =>
      localStorage.setItem(
        'planeta_cookie_consent_v1',
        JSON.stringify({ version: 1, necessary: true, decidedAt: new Date().toISOString() }),
      ),
    );
    await context.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      let body = [];
      if (url.pathname.endsWith('/products/search')) {
        const request = route.request().postDataJSON();
        searches.push(request);
        await new Promise((resolve) => setTimeout(resolve, 100));
        body = {
          variants: Array.from({ length: 24 }, (_, i) => variant(i === 0 ? 'a' : `item-${i}`)),
          totalResults: 500,
          availableCategories: [facets('BREND', 'brand', 'nike')],
          availableAttributes: [facets('VELICINA', 'size', '42'), facets('BOJA', 'color', 'black')],
        };
      } else if (url.pathname.endsWith('/categories')) {
        body = [
          { id: 'gender', name: 'POL' },
          { id: 'category', name: 'KATEGORIJA' },
          { id: 'brand', name: 'BREND' },
        ];
      } else if (url.pathname.endsWith('/categories/gender/values')) {
        body = [{ id: 'men', value: 'MUSKARCI' }];
      } else if (url.pathname.endsWith('/categories/category/values')) {
        body = [{ id: 'footwear', value: 'OBUCA', hasChildren: true }];
      } else if (url.pathname.endsWith('/categories/values/footwear/children')) {
        body = [{ id: 'sneakers', value: 'PATIKE' }];
      } else if (/\/variants\/[^/]+\/details$/.test(url.pathname)) {
        body = variant(url.pathname.split('/').at(-2));
      }
      await route.fulfill({ json: body });
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const back = page.locator('app-back-button button').first();
    const listingReady = async () => page.locator('.page-number.active').waitFor();
    const clickProduct = async () => {
      await page.locator('app-products .card-link').first().click();
      await back.waitFor();
      await page.waitForFunction(() => history.state?.beatovicBackV1 === true);
    };
    const assertURL = async (url) => page.waitForURL(base + url);
    const activateBack = async () => {
      if (width <= 768) await back.tap();
      else await back.click();
    };
    for (const url of [
      '/products',
      '/products?page=2',
      '/products?page=5',
      `/products?${query}`,
      `/products?${String(query).replace('page=3', 'page=5')}`,
      '/catalog/muskarci/obuca/patike?page=5',
    ]) {
      await page.goto(base + url);
      await listingReady();
      const expected = page.url();
      const request = searches.at(-1);
      const entries = await page.evaluate(() => history.length);
      await clickProduct();
      assert.equal(await page.evaluate(() => history.length), entries + 1);
      const box = await back.boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44 && box.x >= 0 && box.x + box.width <= width);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await activateBack();
      await page.waitForURL(expected);
      await listingReady();
      assert.deepEqual(searches.at(-1), request);
      assert.equal(await page.evaluate(() => history.length), entries + 1);
      await page.goForward();
      await assertURL('/product/a');
      await back.waitFor();
      await page.goBack();
      await page.waitForURL(expected);
      await listingReady();
    }
    // Product A -> B -> Back, refresh of B, and a new tab with an opener.
    await clickProduct();
    await page.locator('.related .card-link').first().click();
    await assertURL('/product/b');
    await page.reload();
    await back.waitFor();
    await activateBack();
    await assertURL('/product/a');
    await back.waitFor();
    await page.locator('#startup-splash').waitFor({ state: 'detached' });
    await page.screenshot({ path: path.join(output, `product-${width}.png`), fullPage: false });
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('/product/b', '_blank')),
    ]);
    await popup.locator('app-back-button button').click();
    await popup.waitForURL(base + '/products');
    await popup.close();

    // Genuine direct entry after an external page must use a replacing fallback.
    const direct = await context.newPage();
    await direct.goto('data:text/html,<p>External page</p>');
    await direct.goto(base + '/product/a');
    const directBack = direct.locator('app-back-button button');
    await directBack.waitFor();
    const entries = await direct.evaluate(() => history.length);
    await directBack.focus();
    await direct.keyboard.press('Tab');
    await direct.keyboard.press('Shift+Tab');
    assert.equal(await directBack.evaluate((el) => el.matches(':focus-visible')), true);
    await direct.keyboard.press('Enter');
    await direct.waitForURL(base + '/products');
    assert.equal(await direct.evaluate(() => history.length), entries);
    await direct.close();

    // A slow listing response must not discard the router's saved scroll position.
    await page.goto(base + '/products?page=5');
    await listingReady();
    await page.locator('#startup-splash').waitFor({ state: 'detached' });
    await page.evaluate(() => document.fonts.ready);
    const link = page.locator('app-products .card-link').nth(8);
    await link.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.addEventListener(
        'click',
        () => {
          window.__clickedScrollY = scrollY;
        },
        { once: true, capture: true },
      );
    });
    await link.click();
    const y = await page.evaluate(() => window.__clickedScrollY);
    await back.waitFor();
    await activateBack();
    await listingReady();
    try {
      await page.waitForFunction((expected) => Math.abs(scrollY - expected) < 4, y, {
        timeout: 3000,
      });
    } catch (error) {
      console.log('SCROLL', { width, expected: y, actual: await page.evaluate(() => scrollY) });
      throw error;
    }

    // Filter drawer stays transient and closes when its listing is recreated.
    if (width <= 768) {
      await page.locator('.filters-btn').click();
      await page.locator('.filters.open').waitFor();
      await page.getByRole('button', { name: 'Zatvori filtere' }).click();
      await clickProduct();
      await activateBack();
      await listingReady();
      assert.equal(
        await page.locator('.filters').evaluate((el) => el.classList.contains('open')),
        false,
      );
    }
    // Real filter/sort/page controls must preserve unknown query parameters as well.
    if (width === 1440) {
      await page.goto(base + '/products?campaign=preserve-me');
      await listingReady();
      await page.locator('.sort-select:visible').selectOption('cijena_opadajuce');
      await page.waitForURL(/sort=cijena_opadajuce/);
      await page.locator('.brand-list input').first().check();
      await page.waitForURL(/cf=/);
      await page.getByRole('button', { name: 'Idi na stranicu 5', exact: true }).click();
      await page.waitForURL(/page=5/);
      await page.waitForFunction(
        () => document.querySelector('.page-number.active')?.textContent.trim() === '5',
      );
      const expected = page.url();
      const entries = await page.evaluate(() => history.length);
      await clickProduct();
      await activateBack();
      await page.waitForURL(expected);
      await listingReady();
      assert.equal(new URL(page.url()).searchParams.get('campaign'), 'preserve-me');
      assert.equal(searches.at(-1).page, 4);
      assert.equal(searches.at(-1).sortOrder, 'DESC');
      assert.deepEqual(searches.at(-1).categoryFilters, { brand: ['nike'] });
      assert.equal(await page.evaluate(() => history.length), entries + 1);
    }
    // The shared component also serves checkout and informational detail pages.
    await page.goto(base + '/checkout');
    await back.click();
    await assertURL('/cart');
    await page.goto(base + '/politika-privatnosti');
    await back.click();
    await assertURL('/');
    assert.deepEqual(errors, []);
    report.push({ width, touch: width <= 768, passed: true });
    console.log(
      `PASS: ${width}px, listing state, history, refresh, new tab, fallback, keyboard, scroll${width <= 768 ? ', touch, drawer' : ''}`,
    );
    await context.close();
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.close();
  });
