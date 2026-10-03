// Synthetic motion exercises the configured limit without modeling weapon accuracy.
export function simulatedSpread(style: number, limit: number, phase: number): number {
  const wave = Math.max(0, Math.min(1, phase));
  if ([0, 1, 7].includes(style)) return Math.round(limit * wave);
  if ([2, 5].includes(style)) return Math.round(12 * wave);
  return 0;
}
