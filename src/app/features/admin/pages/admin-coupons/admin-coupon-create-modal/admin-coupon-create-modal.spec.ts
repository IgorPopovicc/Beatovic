import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCouponCreateModal } from './admin-coupon-create-modal';

describe('AdminCouponCreateModal', () => {
  let component: AdminCouponCreateModal;
  let fixture: ComponentFixture<AdminCouponCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [AdminCouponCreateModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCouponCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
