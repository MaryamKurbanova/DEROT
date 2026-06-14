/** Home Screen Time tile — e.g. 5h 2min, 45min, 2h */
export function formatScreenTimeDisplay(totalMinutes: number): string {
  const total = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}min`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}min`;
}
