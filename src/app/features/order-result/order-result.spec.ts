import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderResult } from './order-result';

describe('OrderResult', () => {
  let component: OrderResult;
  let fixture: ComponentFixture<OrderResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderResult],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderResult);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
