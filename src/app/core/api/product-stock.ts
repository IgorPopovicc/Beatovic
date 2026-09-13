import { Variant } from './catalog.models';

export function hasProductStock(variant: Variant): boolean {
  return (variant.attributes ?? []).some((attribute) =>
    attribute.attributeName.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase() === 'VELICINA' &&
    typeof attribute.quantity === 'number' && Number.isFinite(attribute.quantity) && attribute.quantity > 0,
  );
}
