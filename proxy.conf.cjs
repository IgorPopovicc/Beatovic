'use strict';

function configuredUrl(name, fallback) {
  const raw = String(process.env[name] || fallback).trim();
  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`${name} must not contain a query string or fragment.`);
  }

  return parsed;
}

function proxyRoute(upstream, publicBasePath) {
  const upstreamBasePath = upstream.pathname.replace(/\/+$/, '');

  return {
    target: upstream.origin,
    changeOrigin: true,
    secure: String(process.env.DEV_PROXY_TLS_VERIFY || 'true').toLowerCase() !== 'false',
    rewrite: (path) => `${upstreamBasePath}${path.slice(publicBasePath.length)}`,
  };
}

const api = configuredUrl('DEV_API_BASE_URL', 'http://127.0.0.1:8080/api');
const media = configuredUrl(
  'DEV_MEDIA_PRODUCT_BASE_URL',
  'http://127.0.0.1:8080/media/product',
);

module.exports = {
  '/api': proxyRoute(api, '/api'),
  '/media/product': proxyRoute(media, '/media/product'),
};
