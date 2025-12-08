import { TRACKING_START_TIME, TRACKING_END_TIME, TRACKING_DATES } from '../config';

/**
 * Check if current date is one of the tracking dates
 * @returns {boolean} True if today is a tracking date
 */
function isTrackingDate() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  return TRACKING_DATES.some(
    (date) => date.month === currentMonth && date.day === currentDay
  );
}

/**
 * Check if current time is within the Santa tracking window
 * Only tracks on December 12 and 19, from 5pm-10pm
 * @returns {boolean} True if within tracking hours and on a tracking date
 */
export function isWithinTrackingHours() {
  // First check if today is a tracking date
  if (!isTrackingDate()) {
    return false;
  }

  // Then check if current time is within the time window
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 100 + minutes;

  return currentTime >= TRACKING_START_TIME && currentTime <= TRACKING_END_TIME;
}

/**
 * Get milliseconds until next tracking window starts
 * @returns {number} Milliseconds until tracking starts on the next tracking date
 */
export function getMillisecondsUntilTrackingStarts() {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  const startHours = Math.floor(TRACKING_START_TIME / 100);
  const startMinutes = TRACKING_START_TIME % 100;

  // Find the next tracking date
  const trackingDates = TRACKING_DATES.map((date) => {
    const trackingDate = new Date(currentYear, date.month, date.day, startHours, startMinutes, 0, 0);
    // If the date has passed this year, set it for next year
    if (trackingDate < now) {
      trackingDate.setFullYear(currentYear + 1);
    }
    return trackingDate;
  });

  // Sort to find the earliest upcoming tracking date
  trackingDates.sort((a, b) => a - b);
  const nextTrackingDate = trackingDates[0];

  return nextTrackingDate - now;
}
