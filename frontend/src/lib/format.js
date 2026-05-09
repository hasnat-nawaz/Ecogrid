// Pakistani Rupee formatter — used everywhere money is shown.
const fmtPKR = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
});

export function rs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Rs 0.00';
  return fmtPKR.format(n).replace('PKR', 'Rs').replace('Rs ', 'Rs ');
}

export function kwh(value, digits = 2) {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(digits)} kWh`;
}

export function shortDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
