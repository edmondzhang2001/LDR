/**
 * Format current time in the given IANA timezone (e.g. "3:28 PM").
 * @param {string} timezone - IANA timezone string (e.g. "America/New_York")
 * @returns {string}
 */
export function formatTimeInTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return '';
  }
}
