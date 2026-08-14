import {
  createAppConfig,
  runtimeApiUrl,
  runtimeMediaUrl,
} from './runtime-config.service';

describe('runtime configuration', () => {
  it('normalizes base URLs without baking in a deployment hostname', () => {
    const config = createAppConfig({
      apiBaseUrl: 'https://test.example.com/context/api/',
      mediaProductBaseUrl: 'https://test.example.com/media/product/',
      siteUrl: 'https://test.example.com/',
      turnstileSiteKey: 'test-key',
    });

    expect(config.apiBaseUrl).toBe('https://test.example.com/context/api');
    expect(config.mediaProductBaseUrl).toBe('https://test.example.com/media/product');
    expect(config.siteUrl).toBe('https://test.example.com');
    expect(config.turnstileSiteKey).toBe('test-key');
  });

  it('rejects unsafe URL schemes', () => {
    expect(() =>
      createAppConfig({
        apiBaseUrl: 'javascript:alert(1)',
        mediaProductBaseUrl: 'https://example.com/media/product',
        siteUrl: 'https://example.com',
        turnstileSiteKey: 'key',
      }),
    ).toThrowError(/HTTP or HTTPS/);
  });

  it('joins API and relative media paths without duplicated path segments', () => {
    const original = window.__APP_CONFIG__;
    window.__APP_CONFIG__ = {
      apiBaseUrl: 'https://example.com/context/api',
      mediaProductBaseUrl: 'https://example.com/media/product',
      siteUrl: 'https://example.com',
      turnstileSiteKey: 'test-key',
    };

    expect(runtimeApiUrl('/products/search')).toBe(
      'https://example.com/context/api/products/search',
    );
    expect(runtimeApiUrl('/api/products/search')).toBe(
      'https://example.com/context/api/products/search',
    );
    expect(runtimeMediaUrl('/media/product/shoe front.webp')).toBe(
      'https://example.com/media/product/shoe%20front.webp',
    );
    expect(runtimeMediaUrl('https://cdn.example.com/shoe.webp')).toBe(
      'https://cdn.example.com/shoe.webp',
    );
    expect(runtimeMediaUrl('/media/product/no-image.jpg')).toBe('');
    expect(runtimeMediaUrl('/media/product/no-image-web.jpg?width=600')).toBe('');
    expect(runtimeMediaUrl('https://cdn.example.com/media/product/no-image-thumb.jpg')).toBe('');
    expect(runtimeMediaUrl('/media/product/no-image-custom.webp')).toBe('');

    window.__APP_CONFIG__ = original;
  });
});
