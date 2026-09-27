import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { Component, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, take } from 'rxjs';
import { BackNavigationService } from './back-navigation.service';

@Component({ template: '' })
class Page {}

describe('BackNavigationService', () => {
  let service: BackNavigationService;
  let router: Router;
  let location: SpyLocation;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(
          [
            { path: 'blocked', component: Page, canActivate: [() => false] },
            { path: '**', component: Page },
          ],
          withRouterConfig({ onSameUrlNavigation: 'reload' }),
        ),
        provideLocationMocks(),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location) as SpyLocation;
  });

  async function start(url: string, state: Record<string, unknown> = {}) {
    location.replaceState(url, '', state);
    service = TestBed.inject(BackNavigationService);
    router.setUpLocationChangeListener();
    await RouterTestingHarness.create(url);
  }

  async function navigateHistory(action: () => void) {
    const end = firstValueFrom(
      router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        take(1),
      ),
    );
    action();
    await end;
  }

  for (const page of [1, 2, 5, 17]) {
    it(`returns to the exact listing URL on page ${page}, then supports Forward`, async () => {
      const url = `/products?page=${page}&search=dark&sort=cijena_rastuce&stock=1&sale=1&minPrice=50&maxPrice=250&cf=%7B%22brand%22:%5B%22nike%22%5D%7D&af=%7B%22size%22:%5B%2242%22%5D%7D&campaign=test#results`;
      await start(url);
      const listing = router.url;
      await router.navigateByUrl('/product/a', { state: { product: { id: 'a' } } });
      expect(service.canGoBack()).toBeTrue();
      expect(location.getState()).toEqual(jasmine.objectContaining({ product: { id: 'a' } }));
      const entries = location.urlChanges.length;
      await navigateHistory(() => service.back());
      expect(router.url).toBe(listing);
      expect(service.canGoBack()).toBeFalse();
      await navigateHistory(() => location.forward());
      expect(router.url).toBe('/product/a');
      expect(service.canGoBack()).toBeTrue();
      expect(location.urlChanges.length).toBe(entries);
    });
  }

  it('goes from product B to A, then to the nested catalog', async () => {
    await start('/catalog/muskarci/obuca/patike?page=5');
    await router.navigateByUrl('/product/a');
    await router.navigateByUrl('/product/b');
    await navigateHistory(() => service.back());
    expect(router.url).toBe('/product/a');
    await navigateHistory(() => service.back());
    expect(router.url).toBe('/catalog/muskarci/obuca/patike?page=5');
  });

  it('replaces direct entries with the fallback instead of leaving the app', async () => {
    await start('/product/a', { navigationId: 99 });
    const back = spyOn(location, 'back');
    await navigateHistory(() => service.back());
    expect(router.url).toBe('/products');
    expect(back).not.toHaveBeenCalled();
    expect(location.urlChanges.at(-1)).toBe('replace: /products');
    expect(service.canNavigate('/products')).toBeFalse();
  });

  it('keeps a trusted native entry after refresh, without relying on navigationId', async () => {
    await start('/product/a', { beatovicBackV1: true, navigationId: 1 });
    expect(service.canGoBack()).toBeTrue();
    const back = spyOn(location, 'back');
    service.back();
    service.back();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('does not treat replacements, same-URL reloads or skipped URLs as new entries', async () => {
    await start('/products');
    await router.navigateByUrl('/product/a', { replaceUrl: true });
    expect(service.canGoBack()).toBeFalse();
    await router.navigateByUrl('/product/a');
    expect(service.canGoBack()).toBeFalse();
    await router.navigateByUrl('/product/b', { skipLocationChange: true });
    expect(service.canGoBack()).toBeFalse();
    await router.navigateByUrl('/product/c');
    expect(service.canGoBack()).toBeTrue();
    await router.navigateByUrl('/product/d', { replaceUrl: true });
    await navigateHistory(() => service.back());
    expect(router.url).toBe('/product/a');
  });

  it('does not count cancelled navigation or leave the button disabled', async () => {
    await start('/products?page=5');
    await router.navigateByUrl('/blocked');
    expect(service.pending()).toBeFalse();
    expect(service.canGoBack()).toBeFalse();
    await router.navigateByUrl('/product/a');
    await navigateHistory(() => service.back());
    expect(router.url).toBe('/products?page=5');
  });

  it('rejects unrelated application destinations and unsafe or missing fallbacks', async () => {
    await start('/admin/orders/123');
    await router.navigateByUrl('/product/a');
    expect(service.canGoBack()).toBeFalse();
    for (const fallback of [null, '//example.com', 'https://example.com', '/admin', '/missing']) {
      expect(service.canNavigate(fallback)).toBeFalse();
    }
    await navigateHistory(() => service.back('/cart'));
    expect(router.url).toBe('/cart');
  });

  it('does not read or mutate browser history during SSR', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideLocationMocks(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    location = TestBed.inject(Location) as SpyLocation;
    const read = spyOn(location, 'getState');
    const back = spyOn(location, 'back');
    service = TestBed.inject(BackNavigationService);
    service.back();
    expect(read).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
