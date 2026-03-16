import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminVariantUpdateModal } from './admin-variant-update-modal';

describe('AdminVariantUpdateModal', () => {
  let component: AdminVariantUpdateModal;
  let fixture: ComponentFixture<AdminVariantUpdateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminVariantUpdateModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminVariantUpdateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
