import { useState, useEffect } from 'react';
import { formatTimeInTimezone } from '../utils/partnerTime';

const TICK_MS = 60 * 1000;

/**
 * Live-updating partner local time string (e.g. "3:28 PM").
 * @param {string} partnerTimezone - IANA timezone from partner (e.g. partner.timezone)
 * @returns {string}
 */
export function usePartnerTime(partnerTimezone) {
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!partnerTimezone || typeof partnerTimezone !== 'string') {
      setTime('');
      return;
    }
    const update = () => setTime(formatTimeInTimezone(partnerTimezone));
    update();
    const id = setInterval(update, TICK_MS);
    return () => clearInterval(id);
  }, [partnerTimezone]);

  return time;
}
