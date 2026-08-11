import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminVariantCreateModal } from './admin-variant-create-modal';

describe('AdminVariantCreateModal', () => {
  let component: AdminVariantCreateModal;
  let fixture: ComponentFixture<AdminVariantCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideZonelessChangeDetection()],
      imports: [AdminVariantCreateModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminVariantCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
