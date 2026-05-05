import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function normalizeTextForMatching(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function valueInListValidator(allowedValues: readonly string[]): ValidatorFn {
  const normalizedAllowed = new Set(allowedValues.map((value) => normalizeTextForMatching(value)));

  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (!raw) return null;

    return normalizedAllowed.has(normalizeTextForMatching(raw))
      ? null
      : { valueNotAllowed: true };
  };
}
