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
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, of } from 'rxjs';
import { catchError, startWith } from 'rxjs/operators';

import { CatalogApiService } from '../../../../../core/api/catalog-api.sevice';
import { AdminProductsApi } from '../../../../../core/admin-api/admin-products-api';
import { ApiCategoryValue } from '../../../../../core/api/catalog.models';
import {
  CreateProductRequest,
  UpdateProductRequest,
  Product,
  ProductCategory,
} from '../../../../../core/admin-api/admin-products.models';

type SelectOption = { id: string; value: string };

const CATEGORY_IDS = {
  BRAND: '3dc7d5bd-6761-4e87-878c-4b92604d1d6f',     // BREND
  CATEGORY: 'f66e4dcb-76af-487d-b7d3-a4b5205e86a3',  // KATEGORIJA
  GENDER: '7ee59a5d-afe1-4d70-a7ba-2f1f1aff6262',    // POL
} as const;

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
    productDescription: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(4)]),
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
    this.form.controls.brandValueId.valueChanges.pipe(startWith(this.form.controls.brandValueId.value)),
    { initialValue: this.form.controls.brandValueId.value },
  );

  private readonly categoryIdSig = toSignal(
    this.form.controls.categoryValueId.valueChanges.pipe(startWith(this.form.controls.categoryValueId.value)),
    { initialValue: this.form.controls.categoryValueId.value },
  );

  private readonly genderIdSig = toSignal(
    this.form.controls.genderValueId.valueChanges.pipe(startWith(this.form.controls.genderValueId.value)),
    { initialValue: this.form.controls.genderValueId.value },
  );

  readonly invalid = computed(() => this.formStatusSig() === 'INVALID' || this.submitting());

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
    this.prefillIfEdit();
    this.syncSkuState();
  }

  private prefillIfEdit(): void {
    if (!this.product) return;

    const cats = this.product.categories ?? [];
    this.originalCategories.set(cats);

    const brandId = cats.find((c) => c.categoryId === CATEGORY_IDS.BRAND)?.categoryValueId ?? null;
    const categoryId = cats.find((c) => c.categoryId === CATEGORY_IDS.CATEGORY)?.categoryValueId ?? null;
    const genderId = cats.find((c) => c.categoryId === CATEGORY_IDS.GENDER)?.categoryValueId ?? null;

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
      brands: this.catalogApi.getCategoryValues(CATEGORY_IDS.BRAND).pipe(catchError(() => of([] as ApiCategoryValue[]))),
      categories: this.catalogApi.getCategoryValues(CATEGORY_IDS.CATEGORY).pipe(catchError(() => of([] as ApiCategoryValue[]))),
      genders: this.catalogApi.getCategoryValues(CATEGORY_IDS.GENDER).pipe(catchError(() => of([] as ApiCategoryValue[]))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ brands, categories, genders }) => {
        this.brandOptions.set(brands.map((v) => ({ id: v.id, value: v.value })));
        this.categoryOptions.set(categories.map((v) => ({ id: v.id, value: v.value })));
        this.genderOptions.set(genders.map((v) => ({ id: v.id, value: v.value })));
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

    // ✅ Preserve all categories that are NOT BREND/KATEGORIJA/POL (e.g. SPORT, etc.)
    const preserved = (this.originalCategories() ?? []).filter(
      (c) =>
        c.categoryId !== CATEGORY_IDS.BRAND &&
        c.categoryId !== CATEGORY_IDS.CATEGORY &&
        c.categoryId !== CATEGORY_IDS.GENDER,
    );

    // ✅ Rebuild our three categories from form
    const rebuilt = [
      ...this.buildCategoryEntrySingle('BREND', CATEGORY_IDS.BRAND, v.brandValueId, this.brandOptions()),
      ...this.buildCategoryEntrySingle('KATEGORIJA', CATEGORY_IDS.CATEGORY, v.categoryValueId, this.categoryOptions()),
      ...this.buildCategoryEntrySingle('POL', CATEGORY_IDS.GENDER, v.genderValueId, this.genderOptions()),
    ];

    const categoriesPayload = [
      ...preserved.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        categoryValueId: c.categoryValueId,
        value: c.value,
      })),
      ...rebuilt,
    ];

    // CREATE (POST)
    if (!this.isEdit()) {
      const body: CreateProductRequest = {
        productName: v.productName.trim(),
        productDescription: v.productDescription.trim(),
        sku: v.sku.trim(),
        categories: categoriesPayload,
      };

      this.api.createProduct(body)
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

    // EDIT (PUT)
    const body: UpdateProductRequest = {
      id: this.product!.id,
      productName: v.productName.trim(),
      productDescription: v.productDescription.trim(),
      productSku: v.sku.trim(),
      categories: categoriesPayload,
    };

    this.api.updateProduct(body)
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
    categoryName: string,
    categoryId: string,
    selectedValueId: string | null,
    options: SelectOption[],
  ): Array<{ categoryId: string; categoryName: string; categoryValueId: string; value: string }> {
    if (!selectedValueId) return [];
    const label = this.findLabel(options, selectedValueId);
    if (!label) return [];
    return [{
      categoryId,
      categoryName,
      categoryValueId: selectedValueId,
      value: label,
    }];
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
