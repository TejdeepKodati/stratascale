export function formatUsd(value: number): string {
  const abs = Math.abs(Math.round(value));
  const formatted = abs.toLocaleString('en-US');
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatCompactUsd(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}
