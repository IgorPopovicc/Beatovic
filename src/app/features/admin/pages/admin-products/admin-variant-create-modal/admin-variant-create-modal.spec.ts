import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminVariantCreateModal } from './admin-variant-create-modal';

describe('AdminVariantCreateModal', () => {
  let component: AdminVariantCreateModal;
  let fixture: ComponentFixture<AdminVariantCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminVariantCreateModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminVariantCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
