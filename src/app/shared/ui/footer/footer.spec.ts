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
      providers: [{ provide: ContactFormApiService, useValue: contactApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
