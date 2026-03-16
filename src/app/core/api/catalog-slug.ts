function normalize(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function toSlug(apiValue: unknown): string {
  return normalize(apiValue).toLowerCase().replace(/_/g, '-');
}

export function fromSlug(slug: unknown): string {
  return normalize(slug).toUpperCase().replace(/-/g, '_');
}

export function toLabel(apiValue: unknown): string {
  const s = normalize(apiValue).toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';

  return s.charAt(0).toUpperCase() + s.slice(1);
}
