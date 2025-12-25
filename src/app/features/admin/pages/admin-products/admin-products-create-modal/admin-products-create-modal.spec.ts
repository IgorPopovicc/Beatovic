import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminProductsCreateModal } from './admin-products-create-modal';

describe('AdminProductsCreateModal', () => {
  let component: AdminProductsCreateModal;
  let fixture: ComponentFixture<AdminProductsCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProductsCreateModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProductsCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
