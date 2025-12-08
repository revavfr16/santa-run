import { TRACKING_START_TIME, TRACKING_END_TIME } from '../config';

/**
 * Check if current time is within the Santa tracking window
 * @returns {boolean} True if within tracking hours
 */
export function isWithinTrackingHours() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 100 + minutes;

  return currentTime >= TRACKING_START_TIME && currentTime <= TRACKING_END_TIME;
}

/**
 * Get milliseconds until next tracking window starts
 * @returns {number} Milliseconds until tracking starts today or tomorrow
 */
export function getMillisecondsUntilTrackingStarts() {
  const now = new Date();
  const targetTime = new Date();

  const startHours = Math.floor(TRACKING_START_TIME / 100);
  const startMinutes = TRACKING_START_TIME % 100;

  targetTime.setHours(startHours, startMinutes, 0, 0);

  if (now > targetTime) {
    // If past start time today, set for tomorrow
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime - now;
}
