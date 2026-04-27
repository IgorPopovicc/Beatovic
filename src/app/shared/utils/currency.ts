export const APP_CURRENCY_CODE = 'BAM';
export const APP_CURRENCY_LABEL = 'KM';
export const APP_LOCALE = 'bs';

export function normalizeCurrencyCode(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (!normalized || normalized === 'RSD' || normalized === 'DIN' || normalized === 'DIN.') {
    return APP_CURRENCY_CODE;
  }

  if (normalized === APP_CURRENCY_LABEL) {
    return APP_CURRENCY_CODE;
  }

  return normalized;
}

export function currencyDisplayLabel(value: unknown): string {
  return normalizeCurrencyCode(value) === APP_CURRENCY_CODE
    ? APP_CURRENCY_LABEL
    : normalizeCurrencyCode(value);
}
