import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCouponCreateModal } from './admin-coupon-create-modal';

describe('AdminCouponCreateModal', () => {
  let component: AdminCouponCreateModal;
  let fixture: ComponentFixture<AdminCouponCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
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
