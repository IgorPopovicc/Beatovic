import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminProductCreateModal } from './admin-products-create-modal';
import { CatalogApiService } from '../../../../../core/api/catalog-api.sevice';

describe('AdminProductCreateModal', () => {
  let component: AdminProductCreateModal;
  let fixture: ComponentFixture<AdminProductCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideZonelessChangeDetection(),
        {
          provide: CatalogApiService,
          useValue: {
            getCategoryValuesByName: (name: string) =>
              of({
                categoryId: `${name.toLowerCase()}-category`,
                values: [{ id: `${name.toLowerCase()}-value`, value: name }],
              }),
          },
        },
      ],
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
