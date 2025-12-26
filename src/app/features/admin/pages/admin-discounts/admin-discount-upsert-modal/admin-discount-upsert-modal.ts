import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { startWith } from 'rxjs/operators';
import {AdminDiscountsApi} from '../../../../../core/admin-api/admin-discount-api';
import {
  CreateDiscountRequest,
  DiscountListItem,
  DiscountType, UpdateDiscountRequest
} from '../../../../../core/admin-api/admin-discount.model';

type SelectOption<T extends string> = { id: T; label: string };

function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDatetimeToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

@Component({
  selector: 'app-admin-discount-upsert-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-discount-upsert-modal.html',
  styleUrl: './admin-discount-upsert-modal.scss',
})
export class AdminDiscountUpsertModal {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminDiscountsApi);

  @Input() discount: DiscountListItem | null = null; // null => create, else edit
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly submitting = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isEdit = computed(() => !!this.discount?.id);

  readonly typeOptions = signal<SelectOption<DiscountType>[]>([
    { id: 'PERCENTAGE', label: 'PERCENTAGE (%)' },
    { id: 'FIXED_AMOUNT', label: 'FIXED_AMOUNT (RSD)' },
  ]);

  // dropdown state
  readonly typeOpen = signal(false);

  readonly form = this.fb.group({
    type: this.fb.control<DiscountType | null>(null, [Validators.required]),
    value: this.fb.nonNullable.control<number>(1, [Validators.required, Validators.min(1)]),

    // use datetime-local strings
    startDateLocal: this.fb.nonNullable.control('', [Validators.required]),
    endDateLocal: this.fb.nonNullable.control('', [Validators.required]),

    description: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(4)]),
  });

  // --- signals for reactive updates (no stale button state) ---
  private readonly statusSig = toSignal(this.form.statusChanges.pipe(startWith(this.form.status)), {
    initialValue: this.form.status,
  });

  private readonly typeSig = toSignal(
    this.form.controls.type.valueChanges.pipe(startWith(this.form.controls.type.value)),
    { initialValue: this.form.controls.type.value },
  );

  private readonly startSig = toSignal(
    this.form.controls.startDateLocal.valueChanges.pipe(startWith(this.form.controls.startDateLocal.value)),
    { initialValue: this.form.controls.startDateLocal.value },
  );

  private readonly endSig = toSignal(
    this.form.controls.endDateLocal.valueChanges.pipe(startWith(this.form.controls.endDateLocal.value)),
    { initialValue: this.form.controls.endDateLocal.value },
  );

  readonly isPercentage = computed(() => this.typeSig() === 'PERCENTAGE');

  // start < end (datetime-local format is lexicographically comparable)
  readonly rangeValid = computed(() => {
    const s = (this.startSig() ?? '').trim();
    const e = (this.endSig() ?? '').trim();
    if (!s || !e) return false;
    return s < e; // strict
  });

  readonly showRangeError = computed(() => {
    const s = (this.startSig() ?? '').trim();
    const e = (this.endSig() ?? '').trim();
    return !!s && !!e && !this.rangeValid();
  });

  readonly invalid = computed(() => {
    return this.statusSig() === 'INVALID' || this.submitting() || !this.rangeValid();
  });

  ngOnInit(): void {
    if (this.discount) {
      this.form.patchValue({
        type: this.discount.type,
        value: this.discount.value,
        startDateLocal: toLocalDatetimeValue(this.discount.startDate),
        endDateLocal: toLocalDatetimeValue(this.discount.endDate),
        description: this.discount.description ?? '',
      });
    } else {
      this.form.patchValue({
        type: 'PERCENTAGE',
        value: 10,
      });
    }

    // Apply value validators based on initial type
    this.applyValueValidators(this.form.controls.type.value);

    // Re-apply on type change and revalidate immediately (so button toggles instantly)
    this.form.controls.type.valueChanges.subscribe((t) => {
      this.applyValueValidators(t);
      this.form.controls.value.updateValueAndValidity({ emitEvent: true });
    });
  }

  private applyValueValidators(type: DiscountType | null): void {
    const c = this.form.controls.value;

    const base = [Validators.required, Validators.min(1)];
    if (type === 'PERCENTAGE') {
      c.setValidators([...base, Validators.max(100)]);
    } else {
      c.setValidators(base); // FIXED_AMOUNT: no max
    }
  }

  // ---------- UI helpers ----------
  selectedTypeLabel(): string {
    const t = this.form.controls.type.value;
    return this.typeOptions().find((x) => x.id === t)?.label ?? 'Izaberi tip';
  }

  toggleDropdown(): void {
    this.typeOpen.update((v) => !v);
  }

  selectType(type: DiscountType): void {
    const c = this.form.controls.type;
    c.setValue(type);
    c.markAsDirty();
    c.markAsTouched();
    c.updateValueAndValidity({ emitEvent: true });
    this.typeOpen.set(false);
  }

  close(): void {
    this.closed.emit();
  }

  onOverlayMouseDown(): void {
    this.close();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.typeOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.typeOpen()) {
      this.typeOpen.set(false);
      return;
    }
    this.close();
  }

  // ---------- submit ----------
  submit(): void {
    if (this.invalid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();

    const base: CreateDiscountRequest = {
      type: v.type!,
      value: Number(v.value),
      startDate: localDatetimeToIso(v.startDateLocal),
      endDate: localDatetimeToIso(v.endDateLocal),
      description: v.description.trim(),
      variantIds: [],
    };

    const req$ = this.isEdit()
      ? this.api.update({ ...(base as UpdateDiscountRequest), id: this.discount!.id })
      : this.api.create(base);

    req$
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.saved.emit();
          this.close();
        },
        error: (err) => {
          const msg =
            err?.status === 401 || err?.status === 403
              ? 'Nemate dozvolu (provjeri admin token / role).'
              : 'Greška pri čuvanju popusta. Pokušajte ponovo.';
          this.error.set(msg);
        },
      });
  }
}
