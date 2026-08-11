export interface ColorSwatch {
  colors: readonly [string] | readonly [string, string];
  background: string;
}

function normalizeHex(value: string): string | null {
  const trimmed = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^0x[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.slice(2).toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return null;
}

export function parseColorSwatch(value: string | null | undefined): ColorSwatch | null {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => normalizeHex(part));

  if ((parts.length !== 1 && parts.length !== 2) || parts.some((part) => part === null)) {
    return null;
  }

  const colors = parts as [string] | [string, string];
  return {
    colors,
    background:
      colors.length === 1
        ? colors[0]
        : `linear-gradient(135deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)`,
  };
}

export function colorSwatchLabel(value: string | null | undefined): string {
  const swatch = parseColorSwatch(value);
  if (!swatch) return String(value ?? '').trim();
  return `Boja ${swatch.colors.join(' / ')}`;
}
