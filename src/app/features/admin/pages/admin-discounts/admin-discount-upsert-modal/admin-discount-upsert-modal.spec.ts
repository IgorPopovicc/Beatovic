import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDiscountUpsertModal } from './admin-discount-upsert-modal';

describe('AdminDiscountUpsertModal', () => {
  let component: AdminDiscountUpsertModal;
  let fixture: ComponentFixture<AdminDiscountUpsertModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDiscountUpsertModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDiscountUpsertModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
