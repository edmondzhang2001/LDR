const DAY_MS = 24 * 60 * 60 * 1000;

function getDateParts(value) {
  if (typeof value === 'string') {
    const isoDate = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return {
        year: Number(isoDate[1]),
        month: Number(isoDate[2]),
        day: Number(isoDate[3]),
      };
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toUtcDayMs(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/**
 * Returns signed calendar-day difference (UTC day-based) from today to target date.
 * Positive means target date is in the future, 0 means today, negative means past.
 * @param {Date | string | number} targetDate
 * @param {number | Date} nowValue
 * @returns {number | null}
 */
export function getDayDifferenceFromToday(targetDate, nowValue = Date.now()) {
  const targetParts = getDateParts(targetDate);
  const nowParts = getDateParts(nowValue);
  if (!targetParts || !nowParts) return null;
  return Math.round((toUtcDayMs(targetParts) - toUtcDayMs(nowParts)) / DAY_MS);
}

/**
 * Calendar-based countdown for reunion dates.
 * @param {Date | string | number} startDate
 * @param {number | Date} nowValue
 * @returns {{ days: number, hours: number, minutes: number, isPast: boolean }}
 */
export function getCountdown(startDate, nowValue = Date.now()) {
  const diffDays = getDayDifferenceFromToday(startDate, nowValue);
  if (diffDays == null) {
    return { days: 0, hours: 0, minutes: 0, isPast: true };
  }

  return {
    days: Math.max(0, diffDays),
    hours: 0,
    minutes: 0,
    isPast: diffDays <= 0,
  };
}

/**
 * Day number within the visit. Returns 0 when reunion has not started yet.
 * @param {Date | string | number} startDate
 * @param {number | Date} nowValue
 * @returns {number}
 */
export function getVisitDay(startDate, nowValue = Date.now()) {
  const diffDays = getDayDifferenceFromToday(startDate, nowValue);
  if (diffDays == null || diffDays > 0) return 0;
  return Math.abs(diffDays) + 1;
}

/**
 * Format countdown for display, e.g. "14 Days".
 */
export function formatCountdown({ days }) {
  return `${days} Day${days !== 1 ? 's' : ''}`;
}
