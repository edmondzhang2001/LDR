/**
 * Format a date (Date, ISO string, or ms) as a relative time string.
 * @param {Date | string | number} date
 * @returns {string} e.g. "Just now", "5m ago", "2h ago"
 */
export function formatRelativeTime(date) {
  if (date == null) return '';
  const ts = typeof date === 'number' ? date : new Date(date).getTime();
  if (Number.isNaN(ts)) return '';
  const now = Date.now();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return '1 day ago';
  if (diffDay < 7) return `${diffDay} days ago`;
  return 'Earlier';
}
