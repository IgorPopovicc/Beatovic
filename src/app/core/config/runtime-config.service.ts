import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AppConfig {
  apiBaseUrl: string;
  mediaProductBaseUrl: string;
  siteUrl: string;
  turnstileSiteKey: string;
}

type RuntimeConfigInput = Partial<Record<keyof AppConfig, unknown>>;
type RuntimeGlobals = typeof globalThis & {
  __APP_CONFIG__?: RuntimeConfigInput;
  process?: { env?: Record<string, string | undefined> };
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfigInput;
  }
}

const DEVELOPMENT_CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  mediaProductBaseUrl: '/media/product',
  siteUrl: 'http://localhost:4200',
  turnstileSiteKey: '',
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeBaseUrl(name: keyof AppConfig, value: unknown, allowRelative: boolean): string {
  const normalized = text(value).replace(/\/+$/, '');
  if (!normalized) throw new Error(`Runtime configuration value ${name} is required.`);

  if (allowRelative && normalized.startsWith('/')) return normalized;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`Runtime configuration value ${name} must be a valid URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Runtime configuration value ${name} must use HTTP or HTTPS.`);
  }

  return normalized;
}

export function createAppConfig(input: RuntimeConfigInput, allowRelative = false): AppConfig {
  return Object.freeze({
    apiBaseUrl: normalizeBaseUrl('apiBaseUrl', input.apiBaseUrl, allowRelative),
    mediaProductBaseUrl: normalizeBaseUrl(
      'mediaProductBaseUrl',
      input.mediaProductBaseUrl,
      allowRelative,
    ),
    siteUrl: normalizeBaseUrl('siteUrl', input.siteUrl, allowRelative),
    turnstileSiteKey: text(input.turnstileSiteKey),
  });
}

function processConfig(globals: RuntimeGlobals): RuntimeConfigInput | null {
  const env = globals.process?.env;
  if (!env) return null;

  const hasRuntimeValue = [
    env['API_BASE_URL'],
    env['MEDIA_PRODUCT_BASE_URL'],
    env['SITE_URL'],
    env['TURNSTILE_SITE_KEY'],
  ].some((value) => text(value).length > 0);
  if (!hasRuntimeValue) return null;

  return {
    apiBaseUrl: env['API_BASE_URL'],
    mediaProductBaseUrl: env['MEDIA_PRODUCT_BASE_URL'],
    siteUrl: env['SITE_URL'],
    turnstileSiteKey: env['TURNSTILE_SITE_KEY'],
  };
}

export function resolveRuntimeConfig(): AppConfig {
  const globals = globalThis as RuntimeGlobals;
  const supplied = globals.__APP_CONFIG__ ?? processConfig(globals);
  if (supplied) return createAppConfig(supplied);

  const isProductionRuntime =
    environment.production && globals.process?.env?.['NODE_ENV'] === 'production';
  if (environment.production && typeof window !== 'undefined') {
    throw new Error('Runtime configuration was not loaded before Angular bootstrap.');
  }
  if (isProductionRuntime) {
    throw new Error('Container runtime configuration is missing.');
  }

  // Used only by ng serve, tests, and Angular's build-time prerender process. The production
  // container entrypoint validates and supplies all deployment values before the server starts.
  return createAppConfig(DEVELOPMENT_CONFIG, true);
}

function joinUrl(base: string, path: string): string {
  const normalizedPath = text(path);
  if (!normalizedPath) return base;
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${base.replace(/\/+$/, '')}/${normalizedPath.replace(/^\/+/, '')}`;
}

export function runtimeApiUrl(path: string): string {
  const base = resolveRuntimeConfig().apiBaseUrl;
  const normalizedPath = text(path).replace(/^\/+/, '');
  const withoutDuplicatedApi = /\/api$/i.test(base) && /^api(?:\/|$)/i.test(normalizedPath)
    ? normalizedPath.replace(/^api\/?/i, '')
    : normalizedPath;
  return joinUrl(base, withoutDuplicatedApi);
}

export function runtimeSiteUrl(path: string): string {
  return joinUrl(resolveRuntimeConfig().siteUrl, path);
}

export function isRuntimeApiUrl(url: string): boolean {
  const base = resolveRuntimeConfig().apiBaseUrl;
  const clean = text(url).split('?')[0].replace(/\/+$/, '');
  return clean === base || clean.startsWith(`${base}/`);
}

export function runtimeMediaUrl(pathOrUrl: unknown): string {
  const value = text(pathOrUrl);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(?:data:|blob:)/i.test(value) || /^\/?assets\//i.test(value)) return value;

  const clean = value
    .replace(/^\/+/, '')
    .replace(/^media\/product(?:\/+|$)/i, '')
    .replace(/^product(?:\/+|$)/i, '');
  if (!clean) return '';

  const [pathPart, ...queryParts] = clean.split('?');
  const encodedPath = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
  const query = queryParts.length ? `?${queryParts.join('?')}` : '';
  return joinUrl(resolveRuntimeConfig().mediaProductBaseUrl, `${encodedPath}${query}`);
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  readonly value = resolveRuntimeConfig();

  readonly apiBaseUrl = this.value.apiBaseUrl;
  readonly mediaProductBaseUrl = this.value.mediaProductBaseUrl;
  readonly siteUrl = this.value.siteUrl;
  readonly turnstileSiteKey = this.value.turnstileSiteKey;

  apiUrl(path: string): string {
    return runtimeApiUrl(path);
  }

  publicUrl(path: string): string {
    return runtimeSiteUrl(path);
  }

  isApiUrl(url: string): boolean {
    return isRuntimeApiUrl(url);
  }

  mediaUrl(pathOrUrl: unknown): string {
    return runtimeMediaUrl(pathOrUrl);
  }
}
