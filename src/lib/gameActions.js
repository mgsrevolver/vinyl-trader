// src/lib/gameActions.js
import { supabase } from './supabase';

/**
 * Game action utilities for NYC Vinyl Trader
 * These functions call the database stored procedures to perform game actions
 */

/**
 * Buy a record from a store
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {string} storeId - UUID of the store
 * @param {string} productId - UUID of the product (record)
 * @param {number} quantity - Number of records to buy
 * @returns {Promise<boolean>} - True if successful
 */
export const buyRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity
) => {
  const { data, error } = await supabase.rpc('buy_record', {
    p_player_id: playerId,
    p_game_id: gameId,
    p_store_id: storeId,
    p_product_id: productId,
    p_quantity: quantity,
  });

  if (error) {
    console.error('Error buying record:', error);
    return false;
  }

  return data;
};

/**
 * Sell a record to a store
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {string} storeId - UUID of the store
 * @param {string} productId - UUID of the product (record)
 * @param {number} quantity - Number of records to sell
 * @returns {Promise<boolean>} - True if successful
 */
export const sellRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity
) => {
  const { data, error } = await supabase.rpc('sell_record', {
    p_player_id: playerId,
    p_game_id: gameId,
    p_store_id: storeId,
    p_product_id: productId,
    p_quantity: quantity,
  });

  if (error) {
    console.error('Error selling record:', error);
    return false;
  }

  return data;
};

/**
 * Travel to another borough
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {string} toBoroughId - UUID of the destination borough
 * @param {string} transportationId - UUID of the transportation method
 * @returns {Promise<boolean>} - True if successful
 */
export const travelToBorough = async (
  playerId,
  gameId,
  toBoroughId,
  transportationId
) => {
  const { data, error } = await supabase.rpc('travel_to_borough', {
    p_player_id: playerId,
    p_game_id: gameId,
    p_to_borough_id: toBoroughId,
    p_transportation_id: transportationId,
  });

  if (error) {
    console.error('Error traveling to borough:', error);
    return false;
  }

  return data;
};

/**
 * Upgrade player's record carrier
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {string} carrierName - Name of the carrier to upgrade to
 * @returns {Promise<boolean>} - True if successful
 */
export const upgradeCarrier = async (playerId, gameId, carrierName) => {
  const { data, error } = await supabase.rpc('upgrade_carrier', {
    p_player_id: playerId,
    p_game_id: gameId,
    p_carrier_name: carrierName,
  });

  if (error) {
    console.error('Error upgrading carrier:', error);
    return false;
  }

  return data;
};

/**
 * Advance the game to the next hour
 * @param {string} gameId - UUID of the game
 * @returns {Promise<boolean>} - True if successful
 */
export const advanceGameHour = async (gameId) => {
  const { data: game, error: getError } = await supabase
    .from('games')
    .select('current_hour, max_hours')
    .eq('id', gameId)
    .single();

  if (getError) {
    console.error('Error getting game state:', getError);
    return false;
  }

  if (game.current_hour >= game.max_hours) {
    console.error('Game has already ended');
    return false;
  }

  const { error: updateError } = await supabase
    .from('games')
    .update({ current_hour: game.current_hour + 1 })
    .eq('id', gameId);

  if (updateError) {
    console.error('Error advancing game hour:', updateError);
    return false;
  }

  return true;
};

/**
 * Get the player's game state
 * @param {string} playerId - UUID of the player
 * @returns {Promise<Object>} - Player's game state
 */
export const getPlayerGameState = async (playerId) => {
  const { data, error } = await supabase
    .from('player_game_state')
    .select('*')
    .eq('player_id', playerId)
    .single();

  if (error) {
    console.error('Error getting player game state:', error);
    return null;
  }

  return data;
};

/**
 * Get the player's inventory
 * @param {string} playerId - UUID of the player
 * @returns {Promise<Array>} - Player's inventory
 */
export const getPlayerInventory = async (playerId) => {
  const { data, error } = await supabase
    .from('player_inventory_view')
    .select('*')
    .eq('player_id', playerId);

  if (error) {
    console.error('Error getting player inventory:', error);
    return [];
  }

  return data;
};

/**
 * Get the available transportation options for a player
 * @param {string} playerId - UUID of the player
 * @returns {Promise<Array>} - Available transportation options
 */
export const getTransportationOptions = async (playerId) => {
  const { data, error } = await supabase
    .from('transportation_options')
    .select('*')
    .eq('player_id', playerId);

  if (error) {
    console.error('Error getting transportation options:', error);
    return [];
  }

  return data;
};

/**
 * Get the store inventory
 * @param {string} storeId - UUID of the store
 * @param {string} gameId - UUID of the game
 * @returns {Promise<Array>} - Store inventory
 */
export const getStoreInventory = async (storeId, gameId) => {
  const { data, error } = await supabase
    .from('market_inventory')
    .select(
      `
      id,
      quantity,
      current_price,
      products (
        id,
        name,
        artist,
        genre,
        year,
        condition,
        rarity,
        description
      )
    `
    )
    .eq('store_id', storeId)
    .eq('game_id', gameId)
    .gt('quantity', 0);

  if (error) {
    console.error('Error getting store inventory:', error);
    return [];
  }

  return data;
};

/**
 * Get the stores in a borough
 * @param {string} boroughId - UUID of the borough
 * @returns {Promise<Array>} - Stores in the borough
 */
export const getBoroughStores = async (boroughId) => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('borough_id', boroughId);

  if (error) {
    console.error('Error getting borough stores:', error);
    return [];
  }

  return data;
};

/**
 * Get the game leaderboard
 * @param {string} gameId - UUID of the game
 * @returns {Promise<Array>} - Game leaderboard
 */
export const getGameLeaderboard = async (gameId) => {
  const { data, error } = await supabase
    .from('game_leaderboard')
    .select('*')
    .eq('game_id', gameId)
    .order('profit', { ascending: false });

  if (error) {
    console.error('Error getting game leaderboard:', error);
    return [];
  }

  return data;
};

/**
 * Initialize a new player in a game
 * @param {string} gameId - UUID of the game
 * @param {string} userId - UUID of the user
 * @param {string} boroughId - UUID of the starting borough
 * @returns {Promise<string>} - UUID of the created player
 */
export const initializePlayer = async (gameId, userId, boroughId) => {
  // Create the player
  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      user_id: userId,
      cash: 100.0, // Starting cash
      loan_amount: 100.0, // Starting loan
      loan_interest_rate: 50.0, // 50% interest
      inventory_capacity: 10, // Starting capacity
      carrier_type: 'Backpack', // Starting carrier
      current_borough_id: boroughId, // Starting location
    })
    .select('id')
    .single();

  if (playerError) {
    console.error('Error creating player:', playerError);
    return null;
  }

  // Initialize player actions for the first hour
  const { error: actionsError } = await supabase.from('player_actions').insert({
    player_id: player.id,
    game_id: gameId,
    hour: 1, // Starting hour
    actions_used: 0,
    actions_available: 4,
  });

  if (actionsError) {
    console.error('Error initializing player actions:', actionsError);
    return null;
  }

  return player.id;
};

/**
 * Create a new game
 * @param {string} userId - UUID of the user creating the game
 * @param {string} gameName - Name of the game
 * @returns {Promise<string>} - UUID of the created game
 */
export const createNewGame = async (userId, gameName) => {
  const { data, error } = await supabase
    .from('games')
    .insert({
      created_by: userId,
      started_at: new Date(),
      current_hour: 1,
      max_hours: 24,
      name: gameName,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating game:', error);
    return null;
  }

  return data.id;
};

/**
 * End a game
 * @param {string} gameId - UUID of the game
 * @returns {Promise<boolean>} - True if successful
 */
export const endGame = async (gameId) => {
  const { error } = await supabase
    .from('games')
    .update({
      ended_at: new Date(),
      current_hour: 24, // Force to max hours
    })
    .eq('id', gameId);

  if (error) {
    console.error('Error ending game:', error);
    return false;
  }

  return true;
};
