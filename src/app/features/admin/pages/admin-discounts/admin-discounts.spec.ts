import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDiscounts } from './admin-discounts';

describe('AdminDiscounts', () => {
  let component: AdminDiscounts;
  let fixture: ComponentFixture<AdminDiscounts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDiscounts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDiscounts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
