import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Footer } from './footer';
import { ContactFormApiService } from '../../../core/api/contact-form-api.service';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    const contactApi = jasmine.createSpyObj<ContactFormApiService>('ContactFormApiService', [
      'submitMessage',
    ]);
    contactApi.submitMessage.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        { provide: ContactFormApiService, useValue: contactApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('accepts email addresses up to the current API limit of 40 characters', () => {
    const email = 'very.long.customer.address@example.com';
    expect(email.length).toBeLessThanOrEqual(40);

    component.form.controls.email.setValue(email);

    expect(component.form.controls.email.errors?.['maxlength']).toBeUndefined();
  });
});
