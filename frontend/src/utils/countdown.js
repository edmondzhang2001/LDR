/**
 * Calculate the difference between now and a future or past start date.
 * @param {Date | string | number} startDate - Reunion start date
 * @returns {{ days: number, hours: number, minutes: number, isPast: boolean }}
 */
export function getCountdown(startDate) {
  const start = typeof startDate === 'number' ? startDate : new Date(startDate).getTime();
  const now = Date.now();
  const diffMs = start - now;
  const isPast = diffMs <= 0;

  const totalMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const remainderMinutes = totalMinutes % (60 * 24);
  const hours = Math.floor(remainderMinutes / 60);
  const minutes = remainderMinutes % 60;

  return { days, hours, minutes, isPast };
}

/**
 * Format countdown for display, e.g. "14 Days 12 Hrs" or "0 Days 2 Hrs 30 Min".
 */
export function formatCountdown({ days, hours, minutes }) {
  const parts = [];
  if (days > 0) parts.push(`${days} Day${days !== 1 ? 's' : ''}`);
  parts.push(`${hours} Hr${hours !== 1 ? 's' : ''}`);
  if (days === 0) parts.push(`${minutes} Min`);
  return parts.join(' ');
}
