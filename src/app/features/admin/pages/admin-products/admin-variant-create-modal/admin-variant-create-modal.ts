import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
  tap,
  catchError,
  forkJoin,
} from 'rxjs';

import { AdminProductsApi } from '../../../../../core/admin-api/admin-products-api';
import {
  AttributeDTO,
  AttributeValueDTO,
  CreateProductVariantDTO,
  Product,
  ProductVariant,
} from '../../../../../core/admin-api/admin-products.models';
import { AdminAttributesApi } from '../../../../../core/admin-api/admin-attributes-api';

type DropdownKey = 'color';

type FileItem = { _id: string; file: File };

@Component({
  selector: 'app-admin-variant-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-variant-create-modal.html',
  styleUrl: './admin-variant-create-modal.scss',
})
export class AdminVariantCreateModal {
  private readonly fb = inject(FormBuilder);
  private readonly productsApi = inject(AdminProductsApi);
  private readonly attrApi = inject(AdminAttributesApi);

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  readonly productSearch = new FormControl<string>('', { nonNullable: true });

  readonly productLoading = signal(false);
  readonly productError = signal<string | null>(null);
  readonly productResults = signal<Product[]>([]);

  readonly selectedProduct = signal<Product | null>(null);

  readonly variantsLoading = signal(false);
  readonly variantsError = signal<string | null>(null);
  readonly variants = signal<ProductVariant[]>([]);

  readonly createFormOpen = signal(false);

  readonly formLoading = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly colorOpen = signal(false);

  readonly attributes = signal<AttributeDTO[]>([]);
  readonly colorAttr = signal<AttributeDTO | null>(null);
  readonly sizeAttr = signal<AttributeDTO | null>(null);

  readonly colorOptions = signal<AttributeValueDTO[]>([]);
  readonly sizeOptions = signal<AttributeValueDTO[]>([]);

  readonly selectedSizes = signal<Record<string, { value: string; qty: number }>>({});

  readonly files = signal<FileItem[]>([]);
  readonly fileError = signal<string | null>(null);

  readonly productQuery = toSignal(
    this.productSearch.valueChanges.pipe(
      startWith(this.productSearch.value),
      map((v) => (v ?? '').trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  readonly canProductSearch = computed(() => this.productQuery().length >= 3);
  readonly hasProductResults = computed(() => this.productResults().length > 0);

  readonly form = this.fb.group({
    sku: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    price: this.fb.nonNullable.control<number>(0, [Validators.required, Validators.min(0)]),
    isNew: this.fb.nonNullable.control<boolean>(true),
    isOutlet: this.fb.nonNullable.control<boolean>(false),

    colorValueId: this.fb.control<string | null>(null, [Validators.required]),
    displayImageName: this.fb.nonNullable.control<string>(''),
  });

  private readonly formStatusSig = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status },
  );

  readonly invalid = computed(
    () =>
      this.submitting() ||
      !this.selectedProduct()?.id ||
      this.formStatusSig() === 'INVALID' ||
      this.sizesInvalid() ||
      this.files().length === 0,
  );

  readonly selectedColorLabel = computed(() => {
    const id = this.form.controls.colorValueId.value;
    if (!id) return null;

    const found = this.colorOptions().find((x) => x.id === id);
    const raw = found?.value ?? null;

    return raw ? this.colorLabel(raw) : null;
  });

  ngOnInit(): void {
    this.bindProductSearch();
    this.loadAttributes();
  }

  private bindProductSearch(): void {
    this.productSearch.valueChanges
      .pipe(
        startWith(this.productSearch.value),
        map((v) => (v ?? '').trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.productError.set(null);

          if (q.length < 3) {
            this.productResults.set([]);
            return of(null);
          }

          this.productLoading.set(true);

          return this.productsApi.searchProduct(q).pipe(
            tap((list) => {
              this.productResults.set(list ?? []);
            }),
            catchError((err) => {
              const msg =
                err?.status === 401 || err?.status === 403
                  ? 'Nemate dozvolu (provjeri admin token / role).'
                  : 'Greška pri pretrazi proizvoda.';
              this.productError.set(msg);
              this.productResults.set([]);
              return of(null);
            }),
            finalize(() => this.productLoading.set(false)),
          );
        }),
      )
      .subscribe();
  }

  private loadAttributes(): void {
    this.formLoading.set(true);

    this.attrApi
      .getAttributes()
      .pipe(
        catchError(() => of([] as AttributeDTO[])),
        switchMap((attrs) => {
          this.attributes.set(attrs ?? []);
          const color = (attrs ?? []).find((a) => this.isAttribute(a, 'BOJA')) ?? null;
          const size = (attrs ?? []).find((a) => this.isAttribute(a, 'VELICINA')) ?? null;
          this.colorAttr.set(color);
          this.sizeAttr.set(size);

          return forkJoin({
            colors: color?.id
              ? this.attrApi
                  .getAttributeValues(color.id)
                  .pipe(catchError(() => of([] as AttributeValueDTO[])))
              : of([] as AttributeValueDTO[]),
            sizes: size?.id
              ? this.attrApi
                  .getAttributeValues(size.id)
                  .pipe(catchError(() => of([] as AttributeValueDTO[])))
              : of([] as AttributeValueDTO[]),
          });
        }),
        finalize(() => this.formLoading.set(false)),
      )
      .subscribe(({ colors, sizes }) => {
        this.colorOptions.set(colors ?? []);
        this.sizeOptions.set(sizes ?? []);
      });
  }

  selectProduct(p: Product): void {
    this.selectedProduct.set(p);
    this.createFormOpen.set(false);
    this.submitError.set(null);

    this.files.set([]);
    this.fileError.set(null);
    this.selectedSizes.set({});
    this.form.reset({
      sku: '',
      price: 0,
      isNew: true,
      isOutlet: false,
      colorValueId: null,
      displayImageName: '',
    });

    this.loadVariants(p.id);
  }

  private loadVariants(productId: string): void {
    this.variantsLoading.set(true);
    this.variantsError.set(null);
    this.variants.set([]);

    this.productsApi
      .getVariantsByProductId(productId)
      .pipe(finalize(() => this.variantsLoading.set(false)))
      .subscribe({
        next: (list) => {
          this.variants.set(list ?? []);
        },
        error: (err) => {
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri učitavanju modela za proizvod.';
          this.variantsError.set(msg);
        },
      });
  }

  openCreateForm(): void {
    if (!this.selectedProduct()?.id) return;
    this.createFormOpen.set(true);
    this.submitError.set(null);
  }

  closeCreateForm(): void {
    if (this.submitting()) return;
    this.createFormOpen.set(false);
    this.submitError.set(null);
    this.closeAllDropdowns();
  }

  toggleDropdown(key: DropdownKey): void {
    if (key !== 'color') this.colorOpen.set(false);
    if (key === 'color') this.colorOpen.update((v) => !v);
  }

  selectColor(id: string): void {
    this.form.controls.colorValueId.setValue(id);
    this.form.controls.colorValueId.markAsTouched();
    this.form.controls.colorValueId.markAsDirty();
    this.form.controls.colorValueId.updateValueAndValidity({ emitEvent: true });
    this.colorOpen.set(false);
  }

  isSizeSelected(sizeValueId: string): boolean {
    return !!this.selectedSizes()[sizeValueId];
  }

  toggleSize(sizeValueId: string, valueLabel: string, checked: boolean): void {
    const current = { ...this.selectedSizes() };
    if (checked) {
      if (!current[sizeValueId]) current[sizeValueId] = { value: valueLabel, qty: 0 };
    } else {
      delete current[sizeValueId];
    }
    this.selectedSizes.set(current);
  }

  getSizeQty(sizeValueId: string): number {
    return this.selectedSizes()[sizeValueId]?.qty ?? 0;
  }

  setSizeQty(sizeValueId: string, raw: string): void {
    const qty = Number(raw);
    const current = { ...this.selectedSizes() };
    if (!current[sizeValueId]) return;
    current[sizeValueId] = {
      ...current[sizeValueId],
      qty: Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0,
    };
    this.selectedSizes.set(current);
  }

  sizesInvalid(): boolean {
    const entries = Object.entries(this.selectedSizes());
    if (entries.length === 0) return true;
    for (const [, v] of entries) {
      if (v.qty < 0 || !Number.isFinite(v.qty)) return true;
    }
    return false;
  }

  onFilesSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files;
    if (!list || list.length === 0) return;

    const accepted = new Set(['image/webp', 'image/jpeg']);
    const out: FileItem[] = [...this.files()];
    let rejected = 0;

    for (const f of Array.from(list)) {
      const typeOk = accepted.has(f.type);
      const extOk = /\.(webp|jpg|jpeg)$/i.test(f.name);
      if (!typeOk && !extOk) {
        rejected++;
        continue;
      }
      out.push({ _id: crypto.randomUUID(), file: f });
    }

    this.files.set(out);
    this.fileError.set(rejected > 0 ? 'Neke slike nisu dodate (dozvoljeno: webp/jpg/jpeg).' : null);

    input.value = '';
  }

  removeFile(id: string): void {
    this.files.set(this.files().filter((x) => x._id !== id));
  }

  submit(): void {
    this.submitError.set(null);

    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }

    const product = this.selectedProduct();
    const colorAttr = this.colorAttr();
    const sizeAttr = this.sizeAttr();

    if (!product?.id || !colorAttr?.id || !sizeAttr?.id) {
      this.submitError.set('Nedostaju podaci o atributima (BOJA/VELICINA).');
      return;
    }

    const v = this.form.getRawValue();

    const colorValueId = v.colorValueId!;
    const colorValue = this.colorOptions().find((x) => x.id === colorValueId)?.value ?? '';

    const sizeEntries = Object.entries(this.selectedSizes());

    const attributes = [
      {
        id: crypto.randomUUID(),
        attributeId: colorAttr.id,
        attributeName: colorAttr.name,
        attributeValueId: colorValueId,
        value: colorValue,
        quantity: 0,
      },
      ...sizeEntries.map(([sizeValueId, meta]) => ({
        id: crypto.randomUUID(),
        attributeId: sizeAttr.id,
        attributeName: sizeAttr.name,
        attributeValueId: sizeValueId,
        value: this.sizeOptionRawValue(sizeValueId) || meta.value,
        quantity: meta.qty,
      })),
    ];

    const dto: CreateProductVariantDTO = {
      productId: product.id,
      sku: v.sku.trim(),
      price: Number(v.price),
      isNew: !!v.isNew,
      isOutlet: !!v.isOutlet,
      attributes,
      displayImageName: (v.displayImageName ?? '').trim() || undefined,
    };

    const images = this.files().map((x) => x.file);

    this.submitting.set(true);

    this.productsApi
      .createVariantMultipart(dto, images)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (createdVariant) => {
          const updated = [createdVariant, ...this.variants()];
          this.variants.set(updated);

          this.createFormOpen.set(false);

          this.files.set([]);
          this.selectedSizes.set({});
          this.form.reset({
            sku: '',
            price: 0,
            isNew: true,
            isOutlet: false,
            colorValueId: null,
            displayImageName: '',
          });

          this.created.emit();
        },
        error: (err) => {
          const msg =
            err?.status === 400
              ? 'Validacija nije prošla. Provjerite polja i pokušajte ponovo.'
              : err?.status === 401 || err?.status === 403
                ? 'Nemate dozvolu (provjeri admin token / role).'
                : 'Greška pri snimanju modela. Pokušajte ponovo.';
          this.submitError.set(msg);
        },
      });
  }

  formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('sr-RS', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  onOverlayMouseDown(): void {
    this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  closeAllDropdowns(): void {
    this.colorOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllDropdowns();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.colorOpen()) {
      this.closeAllDropdowns();
      return;
    }
    this.close();
  }

  isHexColor(v: string | null | undefined): boolean {
    if (!v) return false;
    const s = v.trim();
    return /^#?[0-9a-fA-F]{6}$/.test(s) || /^0x[0-9a-fA-F]{6}$/.test(s);
  }

  toCssHex(v: string): string | null {
    const s = v.trim();
    if (/^0x[0-9a-fA-F]{6}$/.test(s)) return `#${s.slice(2)}`;
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
    return null;
  }

  colorLabel(v: string): string {
    // Ako je hex, prikazi npr: "Boja #00FF00"
    const css = this.toCssHex(v);
    if (css) return `Boja ${css.toUpperCase()}`;
    // Inace naziv iz baze (npr. "Plava")
    return v;
  }

  optionLabel(option: AttributeValueDTO): string {
    return String(option.displayValue ?? option.value ?? '').trim();
  }

  private sizeOptionRawValue(valueId: string): string {
    return String(this.sizeOptions().find((x) => x.id === valueId)?.value ?? '').trim();
  }

  private isAttribute(attr: AttributeDTO | null | undefined, target: string): boolean {
    const normTarget = this.normalizeKey(target);
    return [attr?.name, attr?.displayValue].some((value) => this.normalizeKey(value) === normTarget);
  }

  private normalizeKey(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toUpperCase()
      .trim();
  }
}
