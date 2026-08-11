import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Output,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { CatalogApiService } from '../../../../../core/api/catalog-api.sevice';
import { AdminProductsApi } from '../../../../../core/admin-api/admin-products-api';
import {
  CreateProductRequest,
  UpdateProductRequest,
  Product,
  ProductCategory,
} from '../../../../../core/admin-api/admin-products.models';

type SelectOption = { id: string; value: string };

interface ManagedCategoryIds {
  brand: string;
  category: string;
  gender: string;
}

type DropdownKey = 'brand' | 'category' | 'gender';

@Component({
  selector: 'app-admin-product-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-products-create-modal.html',
  styleUrl: './admin-products-create-modal.scss',
})
export class AdminProductCreateModal {
  private readonly fb = inject(FormBuilder);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly api = inject(AdminProductsApi);

  // ✅ Ako je prosleđen product -> EDIT (PUT) + prefill
  @Input() product: Product | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>(); // zadrži naziv da ne puca parent

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly brandOptions = signal<SelectOption[]>([]);
  readonly categoryOptions = signal<SelectOption[]>([]);
  readonly genderOptions = signal<SelectOption[]>([]);
  private readonly categoryIds = signal<ManagedCategoryIds | null>(null);

  // dropdown open states
  readonly brandOpen = signal(false);
  readonly categoryOpen = signal(false);
  readonly genderOpen = signal(false);

  // ✅ čuvamo originalne kategorije (npr. SPORT...) da ih ne obrišemo na PUT-u
  private readonly originalCategories = signal<ProductCategory[]>([]);

  readonly isEdit = computed(() => !!this.product?.id);

  // FORM (category is SINGLE)
  readonly form = this.fb.group({
    productName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    productDescription: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(4),
    ]),
    sku: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),

    brandValueId: this.fb.control<string | null>(null, [Validators.required]),
    categoryValueId: this.fb.control<string | null>(null, [Validators.required]),
    genderValueId: this.fb.control<string | null>(null, [Validators.required]),
  });

  // --- Bridge Reactive Forms -> Signals (da computed radi stabilno) ---
  private readonly formStatusSig = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status },
  );

  private readonly brandIdSig = toSignal(
    this.form.controls.brandValueId.valueChanges.pipe(
      startWith(this.form.controls.brandValueId.value),
    ),
    { initialValue: this.form.controls.brandValueId.value },
  );

  private readonly categoryIdSig = toSignal(
    this.form.controls.categoryValueId.valueChanges.pipe(
      startWith(this.form.controls.categoryValueId.value),
    ),
    { initialValue: this.form.controls.categoryValueId.value },
  );

  private readonly genderIdSig = toSignal(
    this.form.controls.genderValueId.valueChanges.pipe(
      startWith(this.form.controls.genderValueId.value),
    ),
    { initialValue: this.form.controls.genderValueId.value },
  );

  readonly invalid = computed(
    () =>
      this.formStatusSig() === 'INVALID' ||
      this.loading() ||
      this.submitting() ||
      !this.categoryIds(),
  );

  // labels (za prikaz u triggeru)
  readonly selectedBrandLabel = computed(() =>
    this.findLabel(this.brandOptions(), this.brandIdSig()),
  );

  readonly selectedCategoryLabel = computed(() =>
    this.findLabel(this.categoryOptions(), this.categoryIdSig()),
  );

  readonly selectedGenderLabel = computed(() =>
    this.findLabel(this.genderOptions(), this.genderIdSig()),
  );

  ngOnInit(): void {
    this.loadOptions();
    this.syncSkuState();
  }

  private prefillIfEdit(): void {
    if (!this.product) return;
    const ids = this.categoryIds();
    if (!ids) return;

    const cats = this.product.categories ?? [];
    this.originalCategories.set(cats);

    const brandId = cats.find((c) => c.categoryId === ids.brand)?.categoryValueId ?? null;
    const categoryId =
      cats.find((c) => c.categoryId === ids.category)?.categoryValueId ?? null;
    const genderId =
      cats.find((c) => c.categoryId === ids.gender)?.categoryValueId ?? null;

    this.form.patchValue({
      productName: this.product.productName ?? '',
      productDescription: this.product.productDescription ?? '',
      sku: this.product.productSku ?? '',
      brandValueId: brandId,
      categoryValueId: categoryId,
      genderValueId: genderId,
    });
  }

  private loadOptions(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      brands: this.catalogApi.getCategoryValuesByName('BREND'),
      categories: this.catalogApi.getCategoryValuesByName('KATEGORIJA'),
      genders: this.catalogApi.getCategoryValuesByName('POL'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ brands, categories, genders }) => {
          if (!brands || !categories || !genders) {
            this.error.set('Backend nije vratio sve potrebne kategorije proizvoda.');
            return;
          }

          this.categoryIds.set({
            brand: brands.categoryId,
            category: categories.categoryId,
            gender: genders.categoryId,
          });
          this.brandOptions.set(
            brands.values.map((v) => ({ id: v.id, value: v.displayValue ?? v.value })),
          );
          this.categoryOptions.set(
            categories.values.map((v) => ({ id: v.id, value: v.displayValue ?? v.value })),
          );
          this.genderOptions.set(
            genders.values.map((v) => ({ id: v.id, value: v.displayValue ?? v.value })),
          );
          this.prefillIfEdit();
        },
        error: () => {
          this.categoryIds.set(null);
          this.error.set('Kategorije proizvoda trenutno nije moguće učitati.');
        },
      });
  }

  // overlay click closes modal
  onOverlayMouseDown(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  // global click closes dropdowns (internal clicks stopPropagation u template-u)
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllDropdowns();
  }

  closeAllDropdowns(): void {
    this.brandOpen.set(false);
    this.categoryOpen.set(false);
    this.genderOpen.set(false);
  }

  toggleDropdown(key: DropdownKey): void {
    if (key !== 'brand') this.brandOpen.set(false);
    if (key !== 'category') this.categoryOpen.set(false);
    if (key !== 'gender') this.genderOpen.set(false);

    if (key === 'brand') this.brandOpen.update((v) => !v);
    if (key === 'category') this.categoryOpen.update((v) => !v);
    if (key === 'gender') this.genderOpen.update((v) => !v);
  }

  // SINGLE select (brand / gender)
  selectSingle(controlName: 'brandValueId' | 'genderValueId', id: string): void {
    const c = this.form.controls[controlName];
    c.setValue(id);
    c.markAsDirty();
    c.markAsTouched();
    c.updateValueAndValidity({ emitEvent: true });

    if (controlName === 'brandValueId') this.brandOpen.set(false);
    if (controlName === 'genderValueId') this.genderOpen.set(false);
  }

  // SINGLE select (category)
  selectSingleCategory(id: string): void {
    const c = this.form.controls.categoryValueId;
    c.setValue(id);
    c.markAsDirty();
    c.markAsTouched();
    c.updateValueAndValidity({ emitEvent: true });
    this.categoryOpen.set(false);
  }

  submit(): void {
    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();

    const selectedCategories = this.buildSelectedCategoryEntries(v);

    // CREATE (POST)
    if (!this.isEdit()) {
      const body: CreateProductRequest = {
        productName: v.productName.trim(),
        productDescription: v.productDescription.trim(),
        sku: v.sku.trim(),
        categories: selectedCategories,
      };

      this.api
        .createProduct(body)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.created.emit();
            this.close();
          },
          error: () => {
            this.error.set('Greška pri kreiranju proizvoda. Pokušajte ponovo.');
          },
        });

      return;
    }

    // EDIT (PUT) uses diff contract:
    // - categoriesToAdd
    // - productCategoryIdsToRemove
    const ids = this.categoryIds();
    if (!ids) {
      this.submitting.set(false);
      this.error.set('Kategorije proizvoda nisu učitane.');
      return;
    }

    const existingManaged = (this.originalCategories() ?? []).filter(
      (c) =>
        c.categoryId === ids.brand ||
        c.categoryId === ids.category ||
        c.categoryId === ids.gender,
    );

    const categoriesToAdd = selectedCategories.filter(
      (sel) =>
        !existingManaged.some(
          (existing) =>
            existing.categoryId === sel.categoryId &&
            existing.categoryValueId === sel.categoryValueId,
        ),
    );

    const productCategoryIdsToRemove = existingManaged
      .filter(
        (existing) =>
          !selectedCategories.some(
            (sel) =>
              sel.categoryId === existing.categoryId &&
              sel.categoryValueId === existing.categoryValueId,
          ),
      )
      .map((existing) => String(existing.id ?? '').trim())
      .filter((id) => !!id);

    const body: UpdateProductRequest = {
      id: this.product!.id,
      productName: v.productName.trim(),
      productDescription: v.productDescription.trim(),
    };

    if (categoriesToAdd.length > 0) {
      body.categoriesToAdd = categoriesToAdd;
    }
    if (productCategoryIdsToRemove.length > 0) {
      body.productCategoryIdsToRemove = productCategoryIdsToRemove;
    }

    this.api
      .updateProduct(body)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.created.emit();
          this.close();
        },
        error: () => {
          this.error.set('Greška pri izmjeni proizvoda. Pokušajte ponovo.');
        },
      });
  }

  private buildCategoryEntrySingle(
    categoryId: string,
    selectedValueId: string | null,
  ): Array<{ categoryId: string; categoryValueId: string }> {
    if (!selectedValueId) return [];
    return [
      {
        categoryId,
        categoryValueId: selectedValueId,
      },
    ];
  }

  private buildSelectedCategoryEntries(v: {
    brandValueId: string | null;
    categoryValueId: string | null;
    genderValueId: string | null;
  }): Array<{ categoryId: string; categoryValueId: string }> {
    const ids = this.categoryIds();
    if (!ids) return [];
    return [
      ...this.buildCategoryEntrySingle(ids.brand, v.brandValueId),
      ...this.buildCategoryEntrySingle(ids.category, v.categoryValueId),
      ...this.buildCategoryEntrySingle(ids.gender, v.genderValueId),
    ];
  }

  private findLabel(options: SelectOption[], id: string | null | undefined): string | null {
    if (!id) return null;
    const found = options.find((o) => o.id === id);
    return found?.value ?? null;
  }

  // ESC closes dropdowns first; if none open, closes modal
  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.brandOpen() || this.categoryOpen() || this.genderOpen()) {
      this.closeAllDropdowns();
      return;
    }
    this.close();
  }

  private syncSkuState(): void {
    const skuCtrl = this.form.controls.sku;

    if (this.isEdit()) {
      skuCtrl.disable({ emitEvent: false });
    } else {
      skuCtrl.enable({ emitEvent: false });
    }
  }
}
