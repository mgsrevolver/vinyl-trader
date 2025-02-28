/**
 * Utility for generating random deli-themed player names
 */

// First name parts (deli-themed adjectives)
const firstParts = [
  'Sandwich',
  'Deli',
  'Hoagie',
  'Sub',
  'Pastrami',
  'Bagel',
  'Reuben',
  'Pickle',
  'Mustard',
  'Cheese',
  'Salami',
  'Corned',
  'Beef',
  'Turkey',
  'Ham',
  'Grilled',
  'Fresh',
  'Spicy',
  'Savory',
  'Tasty',
];

// Second name parts (deli-themed titles)
const secondParts = [
  'Master',
  'King',
  'Queen',
  'Hero',
  'Specialist',
  'Pro',
  'Baron',
  'Ruler',
  'Prince',
  'Princess',
  'Chef',
  'Artisan',
  'Wizard',
  'Guru',
  'Mogul',
  'Tycoon',
  'Dealer',
  'Vendor',
  'Merchant',
  'Boss',
];

/**
 * Generates a random deli-themed player name
 * @param {boolean} includeNumber Whether to append a random number to the name
 * @returns {string} A randomly generated player name
 */
export const generatePlayerName = (includeNumber = true) => {
  const first = firstParts[Math.floor(Math.random() * firstParts.length)];
  const second = secondParts[Math.floor(Math.random() * secondParts.length)];

  if (includeNumber) {
    return `${first}${second}${Math.floor(Math.random() * 100)}`;
  }

  return `${first}${second}`;
};

/**
 * Generates a random deli-themed game name
 * @returns {string} A randomly generated game name
 */
export const generateGameName = () => {
  const adjectives = [
    'Epic',
    'Ultimate',
    'Grand',
    'Mighty',
    'Supreme',
    'Delicious',
    'Tasty',
    'Savory',
    'Gourmet',
    'Artisanal',
  ];

  const nouns = [
    'Deli Wars',
    'Sandwich Battle',
    'Hoagie Showdown',
    'Sub Competition',
    'Pastrami Challenge',
    'Bagel Brawl',
    'Reuben Rivalry',
    'Pickle Pursuit',
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj} ${noun}`;
};

export default {
  generatePlayerName,
  generateGameName,
};
