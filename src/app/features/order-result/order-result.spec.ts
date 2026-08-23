import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrderResultComponent } from './order-result';

describe('OrderResultComponent', () => {
  let component: OrderResultComponent;
  let fixture: ComponentFixture<OrderResultComponent>;

  beforeEach(async () => {
    window.history.replaceState(
      {
        status: 'success',
        email: 'kupac@example.com',
        response: { orderNumber: 'ORD-2026-000123' },
      },
      '',
    );

    await TestBed.configureTestingModule({
      imports: [OrderResultComponent],
      providers: [provideHttpClient(), provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the received-order message without requesting email verification', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Vaša narudžba je uspješno primljena');
    expect(text).toContain('ORD-2026-000123');
    expect(text).toContain('kupac@example.com');
    expect(text).not.toContain('60 minuta');
    expect(text).not.toContain('linkom za potvrdu');
  });
});
