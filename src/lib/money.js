export function formatMoney(amount, currency = 'S$') {
  const number = Number(amount || 0);
  const safe = Number.isFinite(number) ? number : 0;
  return `${currency} ${safe.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
