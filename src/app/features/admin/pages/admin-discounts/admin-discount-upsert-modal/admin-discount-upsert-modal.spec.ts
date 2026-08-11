import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDiscountUpsertModal } from './admin-discount-upsert-modal';

describe('AdminDiscountUpsertModal', () => {
  let component: AdminDiscountUpsertModal;
  let fixture: ComponentFixture<AdminDiscountUpsertModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [AdminDiscountUpsertModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDiscountUpsertModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
