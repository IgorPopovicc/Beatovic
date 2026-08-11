const fs = require('node:fs');
const path = require('node:path');

const required = [
  'API_BASE_URL',
  'MEDIA_PRODUCT_BASE_URL',
  'SITE_URL',
  'TURNSTILE_SITE_KEY',
];

for (const name of required) {
  if (!String(process.env[name] || '').trim()) {
    console.error(`Missing required container environment variable: ${name}`);
    process.exit(1);
  }
}

const normalizeUrl = (name) => {
  const value = String(process.env[name]).trim().replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error(`Container environment variable ${name} must be a valid URL.`);
    process.exit(1);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.error(`Container environment variable ${name} must use HTTP or HTTPS.`);
    process.exit(1);
  }
  return value;
};

const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Container environment variable PORT must be a valid TCP port.');
  process.exit(1);
}

const config = {
  apiBaseUrl: normalizeUrl('API_BASE_URL'),
  mediaProductBaseUrl: normalizeUrl('MEDIA_PRODUCT_BASE_URL'),
  siteUrl: normalizeUrl('SITE_URL'),
  turnstileSiteKey: String(process.env.TURNSTILE_SITE_KEY).trim(),
};

const serialized = JSON.stringify(config)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
const target = path.resolve(__dirname, '../dist/Beatovic/browser/runtime-config.js');
fs.writeFileSync(target, `globalThis.__APP_CONFIG__ = Object.freeze(${serialized});\n`, 'utf8');
console.log(`Runtime configuration generated for ${config.siteUrl} on port ${port}.`);
