import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { AdminProductsApi } from '../../../../../core/admin-api/admin-products-api';
import { AdminAttributesApi } from '../../../../../core/admin-api/admin-attributes-api';
import { AdminDiscountsApi } from '../../../../../core/admin-api/admin-discount-api';

import {
  AttributeDTO,
  AttributeValueDTO,
  DiscountDTO,
  ProductAttribute,
  ProductImage,
  ProductVariant,
  UpdateProductVariantDTO,
} from '../../../../../core/admin-api/admin-products.models';

import { environment } from '../../../../../../environments/environment';

type FileItem = { _id: string; file: File };

type SizeMeta = {
  id: string;
  value: string;
  qty: number;
  attributeId: string;
  attributeName: string;
  attributeValueId: string;
};

@Component({
  selector: 'app-admin-variant-update-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-variant-update-modal.html',
  styleUrl: './admin-variant-update-modal.scss',
})
export class AdminVariantUpdateModal {
  private readonly fb = inject(FormBuilder);
  private readonly productsApi = inject(AdminProductsApi);
  private readonly attrApi = inject(AdminAttributesApi);
  private readonly discountsApi = inject(AdminDiscountsApi);

  private readonly _variantId = signal<string | null>(null);

  @Input({ required: true })
  set variantId(v: string) {
    this._variantId.set(v);
  }
  get variantId(): string {
    return this._variantId() ?? '';
  }

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<ProductVariant>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly details = signal<ProductVariant | null>(null);

  // ATTRS (ISTO KAO CREATE)
  readonly formLoading = signal(false);
  readonly attributes = signal<AttributeDTO[]>([]);
  readonly colorAttr = signal<AttributeDTO | null>(null);
  readonly sizeAttr = signal<AttributeDTO | null>(null);
  readonly colorOptions = signal<AttributeValueDTO[]>([]);
  readonly sizeOptions = signal<AttributeValueDTO[]>([]);

  // DISCOUNTS
  readonly discountsLoading = signal(false);
  readonly discountsError = signal<string | null>(null);
  readonly discounts = signal<DiscountDTO[]>([]);
  readonly discountsOpen = signal(false);
  readonly selectedDiscountIds = signal<Set<string>>(new Set());

  // IMAGES
  readonly existingImages = signal<ProductImage[]>([]);
  readonly imageIdsToRemove = signal<Set<string>>(new Set());

  // FILES
  readonly files = signal<FileItem[]>([]);
  readonly fileError = signal<string | null>(null);

  // DROPDOWNS
  readonly colorsOpen = signal(false);
  readonly addSizeOpen = signal(false);

  // SELECTED
  readonly selectedColorValueId = signal<string>('');
  readonly selectedSizes = signal<Record<string, SizeMeta>>({});
  readonly selectedAddSizeValueId = signal<string>('');

  readonly form = this.fb.group({
    price: this.fb.nonNullable.control<number>(0, [Validators.required, Validators.min(0)]),
    isNew: this.fb.nonNullable.control<boolean>(false),
    isOutlet: this.fb.nonNullable.control<boolean>(false),
    displayImageName: this.fb.nonNullable.control<string>(''),
  });

  readonly sku = computed(() => this.details()?.sku ?? '');

  constructor() {
    effect(() => {
      const id = this._variantId();
      if (!id) return;
      this.bootstrap(id);
    });
  }

  // ======= BOJA HELPERS =======
  private normalizeHexToCss(v: string | null | undefined): string | null {
    const s = (v ?? '').trim();
    if (!s) return null;
    if (/^0x[0-9a-fA-F]{6}$/.test(s)) return `#${s.slice(2)}`.toUpperCase();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
    if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`.toUpperCase();
    return null;
  }

  private colorNameFromCssHex(cssHex: string): string {
    const map: Record<string, string> = {
      '#000000': 'Crna',
      '#FFFFFF': 'Bijela',
      '#FF0000': 'Crvena',
      '#00FF00': 'Zelena',
      '#0000FF': 'Plava',
      '#FFFF00': 'Žuta',
      '#FFA500': 'Narandžasta',
      '#800080': 'Ljubičasta',
      '#808080': 'Siva',
      '#A52A2A': 'Braon',
      '#FFC0CB': 'Roze',
    };
    return map[cssHex] ?? `Boja ${cssHex}`;
  }

  colorLabel(raw: string): string {
    const css = this.normalizeHexToCss(raw);
    if (css) return this.colorNameFromCssHex(css);
    return raw;
  }

  colorSwatch(raw: string): string {
    return this.normalizeHexToCss(raw) ?? '#ffffff';
  }

  // ======= LABELI ZA TEMPLATE =======
  readonly selectedColorLabel = computed(() => {
    const id = this.selectedColorValueId();
    if (!id) return 'Izaberi boju';
    const raw = this.colorOptions().find((x) => x.id === id)?.value ?? 'Izabrano';
    return this.colorLabel(raw);
  });

  readonly selectedColorSwatch = computed(() => {
    const id = this.selectedColorValueId();
    if (!id) return '#ffffff';
    const raw = this.colorOptions().find((x) => x.id === id)?.value ?? '';
    return this.colorSwatch(raw);
  });

  addSizePickedLabel(): string {
    const id = this.selectedAddSizeValueId();
    if (!id) return 'Izaberi veličinu';
    const raw = this.sizeOptions().find((x) => x.id === id)?.value ?? 'Izabrano';
    return raw;
  }

  // ======= BOOTSTRAP (DETAILS + ATTRS + DISCOUNTS) =======
  private bootstrap(variantId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.formLoading.set(true);
    this.discountsLoading.set(true);
    this.discountsError.set(null);

    forkJoin({
      details: this.productsApi.getVariantDetails(variantId).pipe(
        catchError((err) => {
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri učitavanju detalja modela.';
          this.error.set(msg);
          return of(null as ProductVariant | null);
        }),
      ),

      // ISTO KAO CREATE: getAttributes -> find BOJA/VELICINA -> getAttributeValues
      attrsPack: this.attrApi.getAttributes().pipe(
        catchError(() => of([] as AttributeDTO[])),
        switchMap((attrs) => {
          this.attributes.set(attrs ?? []);
          const color = (attrs ?? []).find((a) => a.name?.toUpperCase() === 'BOJA') ?? null;
          const size = (attrs ?? []).find((a) => a.name?.toUpperCase() === 'VELICINA') ?? null;
          this.colorAttr.set(color);
          this.sizeAttr.set(size);

          if (!color?.id || !size?.id) {
            return of({ colors: [] as AttributeValueDTO[], sizes: [] as AttributeValueDTO[] });
          }

          return forkJoin({
            colors: this.attrApi.getAttributeValues(color.id).pipe(catchError(() => of([] as AttributeValueDTO[]))),
            sizes: this.attrApi.getAttributeValues(size.id).pipe(catchError(() => of([] as AttributeValueDTO[]))),
          });
        }),
      ),

      discounts: this.discountsApi.getActiveDiscounts().pipe(
        catchError((err) => {
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu da učitate popuste.'
              : 'Greška pri učitavanju popusta.';
          this.discountsError.set(msg);
          return of([] as DiscountDTO[]);
        }),
      ),
    })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.formLoading.set(false);
          this.discountsLoading.set(false);
        }),
      )
      .subscribe(({ details, attrsPack, discounts }) => {
        this.colorOptions.set(attrsPack?.colors ?? []);
        this.sizeOptions.set(attrsPack?.sizes ?? []);

        this.discounts.set(discounts ?? []);

        if (!details) return;

        this.details.set(details);

        const imgs = (details.images ?? []).map((img) => ({
          ...img,
          url: this.toFullMediaUrl(img.url),
        }));
        this.existingImages.set(imgs);

        this.imageIdsToRemove.set(new Set());
        this.files.set([]);
        this.fileError.set(null);

        this.form.reset({
          price: Number(details.originalPrice ?? 0),
          isNew: !!details.new,
          isOutlet: !!details.outlet,
          displayImageName: '',
        });

        this.hydrateFromVariant(details);

        this.selectedAddSizeValueId.set('');
        this.closeAllDropdowns();
      });
  }

  private hydrateFromVariant(details: ProductVariant): void {
    // color
    const color = (details.attributes ?? []).find((a) => (a.attributeName ?? '').toUpperCase() === 'BOJA');
    if (color?.attributeValueId) {
      this.selectedColorValueId.set(color.attributeValueId);
    } else {
      this.selectedColorValueId.set('');
    }

    // sizes
    const sizeAttr = this.sizeAttr();
    const sizeMap: Record<string, SizeMeta> = {};

    for (const a of details.attributes ?? []) {
      if ((a.attributeName ?? '').toUpperCase() !== 'VELICINA') continue;

      const valueId = a.attributeValueId;
      const label = this.sizeOptions().find((x) => x.id === valueId)?.value ?? a.value ?? '';

      sizeMap[valueId] = {
        id: a.id ?? crypto.randomUUID(),
        value: label,
        qty: Number((a as any).quantity ?? 0),
        attributeId: (a as any).attributeId ?? sizeAttr?.id ?? '',
        attributeName: a.attributeName ?? 'VELICINA',
        attributeValueId: valueId,
      };
    }

    this.selectedSizes.set(sizeMap);

    // discounts (ako ih ima na details-u)
    const pre = new Set<string>();
    for (const ad of (details.activeDiscounts ?? []) as any[]) {
      if (ad?.id) pre.add(ad.id);
    }
    this.selectedDiscountIds.set(pre);
  }

  private toFullMediaUrl(url: string): string {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `${environment.mediaProductBaseUrl}${url}`;
  }

  // ======= DROPDOWNS =======
  toggleColorsDropdown(): void {
    this.colorsOpen.update((v) => !v);
  }
  selectColor(valueId: string): void {
    this.selectedColorValueId.set(valueId);
    this.colorsOpen.set(false);
  }

  toggleAddSizeDropdown(): void {
    this.addSizeOpen.update((v) => !v);
  }
  pickSizeToAdd(valueId: string): void {
    this.selectedAddSizeValueId.set(valueId);
    this.addSizeOpen.set(false);
  }

  confirmAddPickedSize(): void {
    const valueId = this.selectedAddSizeValueId();
    if (!valueId) return;

    const current = { ...this.selectedSizes() };
    if (current[valueId]) return;

    const sizeAttr = this.sizeAttr();
    const label = this.sizeOptions().find((x) => x.id === valueId)?.value ?? '';

    current[valueId] = {
      id: crypto.randomUUID(),
      value: label,
      qty: 0,
      attributeId: sizeAttr?.id ?? '',
      attributeName: sizeAttr?.name ?? 'VELICINA',
      attributeValueId: valueId,
    };

    this.selectedSizes.set(current);
    this.selectedAddSizeValueId.set('');
  }

  removeSize(sizeValueId: string): void {
    const current = { ...this.selectedSizes() };
    if (!current[sizeValueId]) return;
    delete current[sizeValueId];
    this.selectedSizes.set(current);
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

  // ======= VALIDACIJA SIZE =======
  readonly sizesInvalid = computed(() => {
    const entries = Object.entries(this.selectedSizes());
    if (entries.length === 0) return true;
    for (const [, v] of entries) {
      if (!Number.isFinite(v.qty) || v.qty < 0) return true;
    }
    return false;
  });

  readonly invalid = computed(() => this.saving() || this.form.invalid || this.sizesInvalid());

  // ======= EXISTING IMAGES REMOVE =======
  toggleRemoveImage(imageId: string): void {
    const set = new Set(this.imageIdsToRemove());
    if (set.has(imageId)) set.delete(imageId);
    else set.add(imageId);
    this.imageIdsToRemove.set(set);
  }

  isImageMarkedForRemoval(imageId: string): boolean {
    return this.imageIdsToRemove().has(imageId);
  }

  // ======= FILES =======
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

    const currentDisplay = this.form.controls.displayImageName.value;
    if (currentDisplay && !this.newImageNameOptions().includes(currentDisplay)) {
      this.form.controls.displayImageName.setValue('');
    }

    input.value = '';
  }

  removeFile(id: string): void {
    const updated = this.files().filter((x) => x._id !== id);
    this.files.set(updated);

    const currentDisplay = this.form.controls.displayImageName.value;
    if (currentDisplay && !updated.some((x) => x.file.name === currentDisplay)) {
      this.form.controls.displayImageName.setValue('');
    }
  }

  readonly newImageNameOptions = computed(() => this.files().map((x) => x.file.name));

  setDisplayImageName(name: string): void {
    this.form.controls.displayImageName.setValue(name);
  }

  clearDisplayImageName(): void {
    this.form.controls.displayImageName.setValue('');
  }

  // ======= DISCOUNTS =======
  toggleDiscountsDropdown(): void {
    this.discountsOpen.update((v) => !v);
  }

  isDiscountSelected(id: string): boolean {
    return this.selectedDiscountIds().has(id);
  }

  toggleDiscount(id: string, checked: boolean): void {
    const next = new Set(this.selectedDiscountIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedDiscountIds.set(next);
  }

  clearDiscounts(): void {
    this.selectedDiscountIds.set(new Set<string>());
    this.discountsOpen.set(false);
  }

  selectedDiscountLabel(): string {
    const all = this.discounts();
    const ids = Array.from(this.selectedDiscountIds());
    if (ids.length === 0) return 'Bez popusta';

    const labels = ids
      .map((id) => all.find((d) => d.id === id))
      .filter(Boolean)
      .map((d) => this.discountLabel(d!));

    return labels.length ? labels.join(', ') : `${ids.length} izabrano`;
  }

  discountLabel(d: DiscountDTO): string {
    const value = d.type === 'PERCENTAGE' ? `${Number(d.value)}%` : `${Number(d.value)} RSD`;
    const s = this.formatDateTime(d.startDate);
    const e = this.formatDateTime(d.endDate);
    return `${value} — ${d.description} (${s} → ${e})`;
  }

  formatDateTime(iso: string): string {
    if (!iso) return '-';
    try {
      return new Intl.DateTimeFormat('sr-RS', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  // ======= SUBMIT =======
  submit(): void {
    this.error.set(null);

    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }

    const d = this.details();
    const colorAttr = this.colorAttr();
    const sizeAttr = this.sizeAttr();

    if (!d?.id) {
      this.error.set('Nedostaje ID varijante.');
      return;
    }
    if (!colorAttr?.id || !sizeAttr?.id) {
      this.error.set('Nedostaju atributi BOJA/VELICINA (provjeri getAttributes).');
      return;
    }

    const colorValueId = this.selectedColorValueId();
    if (!colorValueId) {
      this.error.set('Boja je obavezna.');
      return;
    }

    const v = this.form.getRawValue();

    const rawColorValue = this.colorOptions().find((x) => x.id === colorValueId)?.value ?? '';

    const attrs: ProductAttribute[] = [
      {
        id: crypto.randomUUID(),
        attributeId: colorAttr.id,
        attributeName: colorAttr.name,
        attributeValueId: colorValueId,
        value: rawColorValue,
        quantity: 0,
      } as any,
      ...Object.values(this.selectedSizes()).map((m) => ({
        id: m.id || crypto.randomUUID(),
        attributeId: sizeAttr.id,
        attributeName: sizeAttr.name,
        attributeValueId: m.attributeValueId,
        value: m.value,
        quantity: m.qty,
      })) as any,
    ];

    const dto: UpdateProductVariantDTO = {
      id: d.id,
      price: Number(v.price),
      isNew: !!v.isNew,
      isOutlet: !!v.isOutlet,
      attributes: attrs as any,
    };

    (dto as any).discountIds = Array.from(this.selectedDiscountIds());

    const removeIds = Array.from(this.imageIdsToRemove());
    if (removeIds.length > 0) (dto as any).imageIdsToRemove = removeIds;

    const displayName = (v.displayImageName ?? '').trim();
    if (displayName && this.newImageNameOptions().includes(displayName)) {
      (dto as any).displayImageName = displayName;
    }

    const imagesToAdd = this.files().map((x) => x.file);

    this.saving.set(true);

    this.productsApi.updateVariantMultipart(dto, imagesToAdd).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (updatedVariant) => {
        this.updated.emit(updatedVariant);
        this.close();
      },
      error: (err) => {
        const msg =
          err?.status === 400
            ? 'Validacija nije prošla. Provjerite polja i pokušajte ponovo.'
            : err?.status === 415
              ? 'Unsupported Media Type. Ne postavljaj ručno Content-Type; mora FormData.'
              : err?.status === 401 || err?.status === 403
                ? 'Nemate dozvolu (provjeri admin token / role).'
                : 'Greška pri update-u modela. Pokušajte ponovo.';
        this.error.set(msg);
      },
    });
  }

  close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  closeAllDropdowns(): void {
    this.discountsOpen.set(false);
    this.colorsOpen.set(false);
    this.addSizeOpen.set(false);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.closeAllDropdowns();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }
}
