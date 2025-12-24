export function toSlug(apiValue: string): string {
  return apiValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

export function fromSlug(slug: string): string {
  return slug
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
}

export function toLabel(apiValue: string): string {
  const s = apiValue
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return s.charAt(0).toUpperCase() + s.slice(1);
}
