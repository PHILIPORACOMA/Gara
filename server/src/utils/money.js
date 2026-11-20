// Money helpers. The database stores PHP as DECIMAL(10,2); all arithmetic is done in
// integer centavos to avoid floating point drift, then converted back for storage.

// Accepts a number, a numeric string, or a Prisma Decimal.
export function toCentavos(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError(`Invalid money value: ${value}`);
  return Math.round(n * 100);
}

export function fromCentavos(centavos) {
  return Math.round(centavos) / 100;
}

// pct% of an amount in centavos, rounded to the nearest centavo.
export function percentOfCentavos(centavos, pct) {
  return Math.round((centavos * Number(pct)) / 100);
}
