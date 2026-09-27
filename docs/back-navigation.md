# Storefront back navigation

The application uses Angular 20 standalone components, Angular Router, SSR/hydration,
RxJS and signals. Its customer-facing product detail route is `/product/:id`, not
`/products/:slug`. Listings use `/products` and `/catalog/...`. There are no beat,
sample, bundle, artist or article detail routes in this repository.

## Placement and appearance

`BackButtonComponent` is used above the product gallery (including the unavailable
product state), in both existing checkout Back positions, and above the privacy
policy. Fallbacks are `/products`, `/cart`, and `/`, respectively. Top-level pages,
admin pages, email action pages and completed-order pages do not receive a new button.

The component inherits Poppins, uses existing SCSS color tokens, a white surface,
12px radius and inline SVG, consistent with the storefront. No icon package or
other dependency was added. Its native button provides keyboard activation, a
screen-reader label, a decorative hidden icon, a visible focus ring, a minimum
44px touch target, hover/pressed/disabled states and reduced-motion support.
Checkout disables it while submitting. Without history and a valid fallback it
renders no button; pending navigation also disables it.

## History and fallback

`BackNavigationService` is instantiated by the application shell before initial
routing. On each successful browser navigation, it adds one boolean,
`beatovicBackV1`, to the current native `history.state` using `Location.replaceState`.
Angular's state and the existing product-card state are retained. The marker says
whether the immediately preceding entry is a known storefront destination. There
is no separate history stack, URL cache, localStorage/sessionStorage state, or
filter-specific Back logic.

- Known preceding storefront entry: `Location.back()` traverses actual history.
- Direct URL, external entry or new tab without a trusted preceding entry:
  `Router.navigateByUrl(fallback, { replaceUrl: true })` stays inside the store.
- Product A → product B returns to A.
- Browser Back/Forward uses the marker on the restored entry.
- Refresh reads the current marker before initial routing overwrites router state.
- Replacements, same-URL reloads, skipped URL changes and cancelled navigation do
  not become extra Back destinations.
- Rapid repeated activation is ignored while navigation is pending.
- Admin, transaction results, email actions and unknown routes are not accepted as
  preceding storefront destinations. External fallback URLs are rejected.
- SSR never reads or writes browser history.

When adding another storefront route, review the service's storefront URL predicate
and supply a real route as the reusable component's fallback.

## Listing state and scroll

The existing `Products` component already serializes and restores its request state
through the URL. It remains the only source of listing state:

- `page` (one-based URL, zero-based API), `search` / legacy `q`, `sort`;
- `stock`, `sale`, `minPrice`, `maxPrice`;
- `cf` and `af`: generic category/attribute maps, including brand, size and color;
- route-derived gender/category/subcategory filters.

The existing sort choices are recommended priority, name ascending/descending and
price ascending/descending. Genre, BPM, mood and “Newest” are not current storefront
controls. No synthetic filter or sort option was introduced. Returning through
native history retains the entire query and fragment, including unrelated query
parameters; the existing `queryParamsHandling: 'merge'` also preserves them when
changing controls.

Router scroll restoration changed from `top` to `enabled`. Since listing responses
are asynchronous, `Products` reapplies the router-provided position after the loaded
content renders. A subsequent navigation cancels a pending restoration. Pagination
still intentionally scrolls to the top. Router scroll coordinates are in memory:
a full document reload preserves the history destination and URL state, but exact
pixel restoration across reload is not guaranteed. No product/list data cache was
added, so ordinary API reloads still reflect current stock and catalog contents.

The existing navbar closes its search/menu overlays on navigation. The listing's
mobile filter drawer is transient and closes when the listing is recreated; drawer
and modal interactions do not add history entries.

## Files

Created:

- `src/app/core/navigation/back-navigation.service.ts`
- `src/app/core/navigation/back-navigation.service.spec.ts`
- `src/app/shared/ui/back-button/back-button.ts`
- `src/app/shared/ui/back-button/back-button.html`
- `src/app/shared/ui/back-button/back-button.scss`
- `src/app/shared/ui/back-button/back-button.spec.ts`
- `scripts/check-back-navigation.cjs`
- `docs/back-navigation.md`

Modified:

- `src/app/app.ts`, `src/app/app.config.ts`
- `src/app/features/product-details/product-details.ts`, `product-details.html`
- `src/app/features/checkout/checkout.ts`, `checkout.html`, `checkout.scss`
- `src/app/features/privacy-policy/privacy-policy.ts`, `privacy-policy.html`
- `src/app/features/products/products.ts`, `products.spec.ts`

## Verification

Use Node 20.19+ (the package declares Node 20):

```sh
npm test -- --watch=false --browsers=ChromeHeadless
npm run build:prod
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.spec.json
```

The complete Karma suite contains 180 passing tests, including 13 added regression
tests for native history, fallback, arbitrary listing pages and query parameters,
refresh markers, Forward, replacements, cancellation, SSR, accessible button states
and delayed scroll restoration. The production build and both TypeScript checks
pass. There is no configured lint target. Existing component-style budget warnings
and the outdated baseline-browser-mapping data warning remain.

For repeatable browser verification, use an already available Playwright installation:

```sh
PLAYWRIGHT_PATH=/absolute/path/to/playwright node scripts/check-back-navigation.cjs
```

This script serves the production browser output on a temporary local port and uses
deterministic intercepted catalog responses; it does not touch live orders or backend
data. It checks 1440, 1024, 768, 390 and 320px viewports, with touch emulation on the
three smaller widths. Scenarios include page 1/2/5, filtered page 3/5 with search and
sorting, nested catalog routes, product A/B, refresh, a new tab with an opener, an
external previous page, keyboard activation/focus, browser Back/Forward, unchanged
history length, exact API request restoration, actual sort/filter/page controls,
unknown query preservation, async scroll, filter drawer and checkout/privacy fallback.
Screenshots and the machine-readable report are written to ignored
`tmp/back-navigation/`. This is Chromium automation, not a physical-device or live
backend test; SSR is covered by the unit guard test and production server compilation.

API references: [Angular Location](https://angular.dev/api/common/Location) and
[Angular router scrolling](https://angular.dev/api/router/InMemoryScrollingOptions).
