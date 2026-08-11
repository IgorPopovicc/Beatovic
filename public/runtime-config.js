// Local-development placeholder. The Docker entrypoint replaces this file at every container
// start. On any non-local host, leave configuration absent so a production deployment that skips
// the entrypoint fails during Angular bootstrap instead of silently using fallback values.
(() => {
  const hostname = globalThis.location?.hostname ?? '';
  if (
    !globalThis.__APP_CONFIG__ &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')
  ) {
    globalThis.__APP_CONFIG__ = {
      apiBaseUrl: '/api',
      mediaProductBaseUrl: '/media/product',
      siteUrl: globalThis.location.origin,
      turnstileSiteKey: '',
    };
  }
})();
