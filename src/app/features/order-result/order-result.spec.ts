import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrderResultComponent } from './order-result';

describe('OrderResultComponent', () => {
  let component: OrderResultComponent;
  let fixture: ComponentFixture<OrderResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderResultComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
