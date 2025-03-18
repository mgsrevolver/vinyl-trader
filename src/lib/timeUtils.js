/**
 * Converts game hours to a formatted time string
 * Game seems to start with current_hour = max_hours (24) at 11:00 PM
 * and counts down to 0 (representing 12:00 AM the next day)
 *
 * @param {number} currentHour - Current hour in the game (24 to 0)
 * @param {number} maxHours - Maximum hours in the game (typically 24)
 * @param {boolean} use12Hour - Whether to use 12-hour format (default: true)
 * @returns {string} Formatted time string (e.g., "11:00 PM")
 */
export const gameHourToTimeString = (
  currentHour,
  maxHours = 24,
  use12Hour = true
) => {
  // In this model, currentHour starts at maxHours (24) which is 11:00 PM
  // and counts down to 0 (12:00 AM)

  // Map hours: 24->11PM, 23->10PM, ..., 13->12PM, 12->11AM, ..., 1->12AM, 0->11PM
  let hourOfDay;

  if (currentHour === 0) {
    // Special case: hour 0 represents 12:00 AM at the end of the game
    hourOfDay = 0; // 12:00 AM
  } else {
    // For other hours, we map from hours remaining to clock time
    // 24->11PM, 23->10PM, ..., 13->12PM, 12->11AM, ..., 1->12AM
    hourOfDay = (23 - (currentHour - 1)) % 24;
  }

  if (use12Hour) {
    // Convert to 12-hour format
    const period = hourOfDay >= 12 ? 'PM' : 'AM';
    const hour12 = hourOfDay % 12;
    return `${hour12 === 0 ? 12 : hour12}:00 ${period}`;
  } else {
    // 24-hour format
    return `${hourOfDay.toString().padStart(2, '0')}:00`;
  }
};

/**
 * Get the day of the game based on current hour
 *
 * @param {number} currentHour - Current hour in the game
 * @param {number} maxHours - Maximum hours in the game
 * @returns {number} - Day number (1 or 2 for a game that spans midnight)
 */
export const getGameDay = (currentHour, maxHours = 24) => {
  // If we're in hour 0, it's the next day (day 2)
  return currentHour === 0 ? 2 : 1;
};

/**
 * Formats the game time as a full timestamp with day
 *
 * @param {number} currentHour - Current hour in the game
 * @param {number} maxHours - Maximum hours in the game
 * @returns {string} - Formatted string like "Day 1, 11:00 PM"
 */
export const formatGameTimestamp = (currentHour, maxHours = 24) => {
  const timeString = gameHourToTimeString(currentHour, maxHours);
  const day = getGameDay(currentHour, maxHours);

  return `Day ${day}, ${timeString}`;
};

/**
 * Calculate hours remaining in the game
 *
 * @param {number} currentHour - Current hour in the game
 * @param {number} maxHours - Maximum hours in the game
 * @returns {number} - Hours remaining
 */
export const getHoursRemaining = (currentHour, maxHours = 24) => {
  return currentHour; // Since the current hour is counting down, it represents hours remaining
};
