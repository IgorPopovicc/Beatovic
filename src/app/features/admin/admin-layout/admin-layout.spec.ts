import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminLayout } from './admin-layout';

describe('AdminLayout', () => {
  let component: AdminLayout;
  let fixture: ComponentFixture<AdminLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [AdminLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the authorization warning without any IP text or placeholder', () => {
    const warning = (fixture.nativeElement as HTMLElement).querySelector('.security-warning');
    const text = warning?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    expect(text).toBe(
      'Upozorenje: Ova sekcija namijenjena je isključivo ovlašćenim administratorskim korisnicima.',
    );
    expect(text.toLowerCase()).not.toContain('ip');
  });
});
