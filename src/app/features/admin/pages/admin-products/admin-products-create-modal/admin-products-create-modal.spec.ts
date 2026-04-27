import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminProductCreateModal } from './admin-products-create-modal';

describe('AdminProductCreateModal', () => {
  let component: AdminProductCreateModal;
  let fixture: ComponentFixture<AdminProductCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProductCreateModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProductCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
