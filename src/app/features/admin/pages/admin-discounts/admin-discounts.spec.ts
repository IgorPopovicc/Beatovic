import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDiscounts } from './admin-discounts';

describe('AdminDiscounts', () => {
  let component: AdminDiscounts;
  let fixture: ComponentFixture<AdminDiscounts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [AdminDiscounts],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDiscounts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
