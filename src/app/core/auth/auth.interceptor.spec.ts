import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { forkJoin } from 'rxjs';
import { runtimeApiUrl } from '../config/runtime-config.service';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('auth interceptor refresh flow', () => {
  let auth: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('ps_access_token');
    localStorage.removeItem('ps_refresh_token');
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), 
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.removeItem('ps_access_token');
    localStorage.removeItem('ps_refresh_token');
  });

  it('uses one refresh request for simultaneous 401 responses and retries both requests', () => {
    auth.login('admin', 'password').subscribe();
    httpTesting
      .expectOne(runtimeApiUrl('/auth/admin-panel/login'))
      .flush({ accessToken: 'access-one', refreshToken: 'refresh-one' });

    const firstUrl = runtimeApiUrl(`/orders/admin/by-number/ORD-1`);
    const secondUrl = runtimeApiUrl(`/orders/admin/by-number/ORD-2`);
    let completed = false;

    const http = TestBed.inject(HttpClient);
    forkJoin([http.get(firstUrl), http.get(secondUrl)]).subscribe(() => (completed = true));

    const first = httpTesting.expectOne(firstUrl);
    const second = httpTesting.expectOne(secondUrl);
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-one');
    expect(second.request.headers.get('Authorization')).toBe('Bearer access-one');
    first.flush('expired', { status: 401, statusText: 'Unauthorized' });
    second.flush('expired', { status: 401, statusText: 'Unauthorized' });

    const refresh = httpTesting.expectOne(runtimeApiUrl(`/auth/refresh-token`));
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-one' });
    refresh.flush({ accessToken: 'access-two', refreshToken: 'refresh-two' });

    const retriedFirst = httpTesting.expectOne(firstUrl);
    const retriedSecond = httpTesting.expectOne(secondUrl);
    expect(retriedFirst.request.headers.get('Authorization')).toBe('Bearer access-two');
    expect(retriedSecond.request.headers.get('Authorization')).toBe('Bearer access-two');
    retriedFirst.flush({});
    retriedSecond.flush({});
    expect(completed).toBeTrue();
  });

  it('clears the session when refresh fails without recursively refreshing', () => {
    auth.login('admin', 'password').subscribe();
    httpTesting
      .expectOne(runtimeApiUrl('/auth/admin-panel/login'))
      .flush({ accessToken: 'access-one', refreshToken: 'refresh-one' });
    spyOn(auth, 'logout').and.callThrough();

    const url = runtimeApiUrl(`/orders/admin/by-number/ORD-1`);
    let receivedError = false;
    TestBed.inject(HttpClient)
      .get(url)
      .subscribe({ error: () => (receivedError = true) });

    httpTesting
      .expectOne(url)
      .flush('expired', { status: 401, statusText: 'Unauthorized' });
    httpTesting
      .expectOne(runtimeApiUrl(`/auth/refresh-token`))
      .flush('expired refresh', { status: 401, statusText: 'Unauthorized' });

    expect(receivedError).toBeTrue();
    expect(auth.logout).toHaveBeenCalled();
    expect(auth.accessToken()).toBeNull();
    httpTesting.expectNone(runtimeApiUrl(`/auth/refresh-token`));
  });
});
