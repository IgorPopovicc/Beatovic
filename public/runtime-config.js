// Local-development placeholder. The Docker entrypoint replaces this file at every container
// start. On any non-local host, leave configuration absent so a production deployment that skips
// the entrypoint fails during Angular bootstrap instead of silently using fallback values.
(() => {
  const hostname = globalThis.location?.hostname ?? '';
  const origin = globalThis.location?.origin ?? '';
  if (
    !globalThis.__APP_CONFIG__ &&
    origin &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')
  ) {
    globalThis.__APP_CONFIG__ = {
      apiBaseUrl: `${origin}/api`,
      mediaProductBaseUrl: `${origin}/media/product`,
      siteUrl: origin,
      turnstileSiteKey: '',
    };
  }
})();
