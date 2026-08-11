import { colorSwatchLabel, parseColorSwatch } from './color-swatch';

describe('color swatch parsing', () => {
  it('accepts a single hex color', () => {
    expect(parseColorSwatch(' #000000 ')?.background).toBe('#000000');
  });

  it('renders two colors as a validated split gradient', () => {
    expect(parseColorSwatch('#000000, #ffffff')?.background).toBe(
      'linear-gradient(135deg, #000000 0 50%, #FFFFFF 50% 100%)',
    );
  });

  it('falls back to text for malformed values', () => {
    expect(parseColorSwatch('red; background:url(x)')).toBeNull();
    expect(colorSwatchLabel('Plava')).toBe('Plava');
  });
});
