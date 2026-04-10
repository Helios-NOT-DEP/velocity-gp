export function formatCurrency(n: number | string): string {
  if (typeof n !== 'number') return n;
  // Uses runtime locale for formatting while standardizing currency to USD.
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
}
