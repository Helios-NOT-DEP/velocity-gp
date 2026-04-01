export function formatCurrency(n: number | string): string {
  if (typeof n !== 'number') return n;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
}
