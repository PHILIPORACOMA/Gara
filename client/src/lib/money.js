const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// formatPeso(1200) -> "₱1,200", formatPeso("1200.5") -> "₱1,200.50"
export function formatPeso(value) {
  return peso.format(Number(value) || 0);
}
