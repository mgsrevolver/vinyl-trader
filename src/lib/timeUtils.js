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
export const gameHourToTimeString = (gameHour) => {
  // Game starts at hour 24 (midnight) and counts down to 0 (midnight the next day)
  // Convert this to a standard 12-hour AM/PM format

  // Map game hour 24->0 to real-world hour 0->24
  const realWorldHour = 24 - gameHour;

  // Convert to 12-hour format with AM/PM
  let hour = realWorldHour % 12;
  if (hour === 0) hour = 12; // 0 should be 12 in 12-hour format
  const ampm = realWorldHour < 12 ? 'AM' : 'PM';

  return `${hour} ${ampm}`;
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
export const getHoursRemaining = (gameHour) => {
  // Game starts at hour 24 and goes to 0
  // So hours remaining is simply the current game hour
  return gameHour;
};
