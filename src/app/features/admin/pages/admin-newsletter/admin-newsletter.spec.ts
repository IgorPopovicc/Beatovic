import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminNewsletter } from './admin-newsletter';
import { AdminNewsletterApi } from '../../../../core/admin-api/admin-newsletter-api';

describe('AdminNewsletter', () => {
  let component: AdminNewsletter;
  let fixture: ComponentFixture<AdminNewsletter>;
  let api: jasmine.SpyObj<AdminNewsletterApi>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminNewsletterApi>('AdminNewsletterApi', [
      'getActiveSubscriptions',
    ]);
    api.getActiveSubscriptions.and.returnValue(
      of({
        content: [], totalElements: 0, totalPages: 0, number: 0, size: 20,
        numberOfElements: 0, first: true, last: true, empty: true,
      }),
    );
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        { provide: AdminNewsletterApi, useValue: api },
      ],
      imports: [AdminNewsletter],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNewsletter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submits q search without a native form reload', () => {
    api.getActiveSubscriptions.calls.reset();
    component.search.setValue('gmail');

    component.onSearch();

    expect(api.getActiveSubscriptions).toHaveBeenCalledOnceWith({
      page: 0,
      size: 20,
      sort: 'subscribedAt,desc',
      q: 'gmail',
    });
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(form.getAttribute('action')).toBeNull();
  });
});
