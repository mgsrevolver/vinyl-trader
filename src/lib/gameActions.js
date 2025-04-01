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
 * @param {string} inventoryId - UUID of the specific inventory item to buy
 * @returns {Promise<Object>} - Result of the operation
 */
export const buyRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity = 1,
  inventoryId
) => {
  try {
    if (!productId) {
      return {
        success: false,
        error: { message: 'Missing required product ID' },
      };
    }

    const { data, error } = await supabase.rpc('buy_record', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_product_id: productId,
      p_quantity: quantity,
      p_store_id: storeId,
    });

    if (error) {
      // Special handling for unique constraint error
      if (
        error.code === '23505' &&
        error.details?.includes(
          'player_inventory_player_id_product_id_condition_key'
        )
      ) {
        return {
          success: false,
          error: {
            code: '23505',
            message:
              'You already own this record with this condition. Due to inventory system limitations, you can own only one copy of a record in each condition.',
          },
        };
      }

      return {
        success: false,
        error: {
          code: error.code,
          message: error.message || 'Transaction failed',
        },
      };
    }

    // False response means insufficient funds or inventory
    if (data === false) {
      return {
        success: false,
        error: {
          message:
            'Purchase failed. You may not have enough funds or the item is out of stock.',
        },
      };
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: { message: err.message || 'An unexpected error occurred' },
    };
  }
};

/**
 * Sell a record to a store
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {string} storeId - UUID of the store
 * @param {string} productId - UUID of the product (record)
 * @param {number} quantity - Number of records to sell
 * @param {string} inventoryId - UUID of the specific inventory item
 * @returns {Promise<Object>} - Result object with success status
 */
export const sellRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity = 1,
  inventoryId
) => {
  try {
    if (!inventoryId) {
      return {
        success: false,
        error: {
          message: 'Missing inventory ID. Need to specify which copy to sell.',
        },
      };
    }

    const { data, error } = await supabase.rpc('sell_record', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_store_id: storeId,
      p_product_id: productId,
      p_quantity: quantity,
      p_inventory_id: inventoryId,
    });

    return error ? { success: false, error } : { success: true, data };
  } catch (err) {
    return { success: false, error: { message: err.message } };
  }
};

/**
 * Get sell prices with store margin applied
 * @param {string} storeId - UUID of the store
 * @param {string} gameId - UUID of the game
 * @param {string[]} productIds - Array of product IDs
 * @returns {Promise<Object>} - Map of product IDs to sell prices
 */
export const getSellPrices = async (storeId, gameId, productIds) => {
  try {
    if (!productIds?.length) return {};

    const { data, error } = await supabase
      .from('market_inventory')
      .select('product_id, current_price')
      .eq('store_id', storeId)
      .eq('game_id', gameId)
      .in('product_id', productIds);

    if (error) return {};

    // Apply 75% margin
    const STORE_MARGIN = 0.75;
    const priceMap = {};
    data.forEach((item) => {
      priceMap[item.product_id] = item.current_price * STORE_MARGIN;
    });

    return priceMap;
  } catch {
    return {};
  }
};

/**
 * Get the player's actions for the current hour
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {number} currentHour - Current game hour
 * @returns {Promise<Object>} - Player's actions data
 */
export const getPlayerActions = async (playerId, gameId, currentHour) => {
  try {
    const { data, error } = await supabase
      .from('player_actions')
      .select('*')
      .eq('player_id', playerId)
      .eq('game_id', gameId)
      .eq('hour', currentHour)
      .limit(1);

    if (error || !data?.length) {
      // Create a new player_actions row if needed
      try {
        const { data: newRow } = await supabase
          .from('player_actions')
          .insert({
            player_id: playerId,
            game_id: gameId,
            hour: currentHour,
            actions_used: 0,
            actions_available: 4,
          })
          .select()
          .single();

        return newRow || { actions_used: 0, actions_available: 4 };
      } catch {
        return { actions_used: 0, actions_available: 4 };
      }
    }

    return data[0];
  } catch {
    return { actions_used: 0, actions_available: 4 };
  }
};

/**
 * Advance the game to the next hour
 * @param {string} gameId - UUID of the game
 * @returns {Promise<boolean>} - True if successful
 */
export const advanceGameHour = async (gameId) => {
  try {
    const { data: game, error: getError } = await supabase
      .from('games')
      .select('current_hour, max_hours')
      .eq('id', gameId)
      .single();

    if (getError || game.current_hour <= 0) return false;

    // Decrement the hour
    const { error: updateError } = await supabase
      .from('games')
      .update({ current_hour: game.current_hour - 1 })
      .eq('id', gameId);

    return !updateError;
  } catch {
    return false;
  }
};

/**
 * Travel to another borough - SIMPLIFIED VERSION
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {string} toBoroughId - UUID of the destination borough
 * @param {string} transportationId - UUID of the transportation method
 * @returns {Promise<{success: boolean, error: any}>} - Result object with success status and any error
 */
export const travelToBorough = async (
  playerId,
  gameId,
  toBoroughId,
  transportationId
) => {
  try {
    // Update the player's location
    const { error: locationError } = await supabase
      .from('players')
      .update({ current_borough_id: toBoroughId })
      .eq('id', playerId);

    return locationError
      ? { success: false, error: locationError }
      : { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
};

/**
 * Initialize a new player in a game
 * @param {string} gameId - UUID of the game
 * @param {string} userId - UUID of the user
 * @param {string} boroughId - UUID of the starting borough
 * @returns {Promise<string>} - UUID of the created player
 */
export const initializePlayer = async (gameId, userId, boroughId) => {
  try {
    // If no specific borough provided, find a default one
    let targetBoroughId = boroughId;

    if (!targetBoroughId) {
      // Try to get Downtown first
      const { data: downtown } = await supabase
        .from('boroughs')
        .select('id')
        .eq('name', 'Downtown')
        .single();

      if (downtown) {
        targetBoroughId = downtown.id;
      } else {
        // Fall back to any borough
        const { data: anyBorough } = await supabase
          .from('boroughs')
          .select('id')
          .limit(1)
          .single();

        if (!anyBorough) return null;
        targetBoroughId = anyBorough.id;
      }
    }

    // Create the player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        game_id: gameId,
        user_id: userId,
        cash: 100.0,
        loan_amount: 100.0,
        loan_interest_rate: 50.0,
        inventory_capacity: 10,
        carrier_type: 'Backpack',
        current_borough_id: targetBoroughId,
      })
      .select('id')
      .single();

    if (playerError) return null;

    // Initialize player actions for the first hour
    await getPlayerActions(player.id, gameId, 1);

    return player.id;
  } catch {
    return null;
  }
};

/**
 * Get the store inventory
 * @param {string} storeId - UUID of the store
 * @param {string} gameId - UUID of the game
 * @returns {Promise<Object>} - Store inventory
 */
export const getStoreInventory = async (storeId, gameId) => {
  try {
    const { data, error } = await supabase
      .from('market_inventory')
      .select(
        `
        id, quantity, current_price, condition, quality_rating, base_markup, product_id,
        products (id, name, artist, genre, year, rarity, description, image_url)
      `
      )
      .eq('store_id', storeId)
      .eq('game_id', gameId)
      .gt('quantity', 0);

    if (error) {
      return { items: [], loading: false, error: 'Failed to load inventory' };
    }

    return { items: data || [], loading: false, error: null };
  } catch {
    return { items: [], loading: false, error: 'An unexpected error occurred' };
  }
};

// Caches for frequently used data
const storeCache = {};
const transportCache = { data: null, timestamp: 0 };
const distanceCache = { data: null, timestamp: 0 };

/**
 * Get the stores in a borough - OPTIMIZED VERSION
 * @param {string} boroughId - UUID of the borough
 * @param {string} gameId - UUID of the game (optional)
 * @returns {Promise<Array>} - Stores in the borough
 */
export const getBoroughStores = async (boroughId, gameId = null) => {
  // Check cache first
  const cacheKey = `${boroughId}`;
  if (storeCache[cacheKey]) return storeCache[cacheKey];

  try {
    const { data: allStores, error } = await supabase
      .from('stores')
      .select('id, name, specialty_genre, open_hour, close_hour')
      .eq('borough_id', boroughId);

    if (error) return [];

    // Cache the result
    storeCache[cacheKey] = allStores || [];

    return allStores || [];
  } catch {
    return [];
  }
};

/**
 * Get all transportation methods - OPTIMIZED VERSION
 */
export const getTransportationMethods = async () => {
  const now = Date.now();
  const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

  // Return cached data if valid
  if (transportCache.data && now - transportCache.timestamp < CACHE_TIME) {
    return transportCache.data;
  }

  try {
    const { data, error } = await supabase
      .from('transportation_methods')
      .select('*')
      .order('speed_factor', { ascending: true });

    if (error) return [];

    // Update cache
    transportCache.data = data || [];
    transportCache.timestamp = now;

    return transportCache.data;
  } catch {
    return [];
  }
};

/**
 * Get all borough distances - OPTIMIZED VERSION
 */
export const getBoroughDistances = async () => {
  const now = Date.now();
  const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

  // Return cached data if valid
  if (distanceCache.data && now - distanceCache.timestamp < CACHE_TIME) {
    return distanceCache.data;
  }

  try {
    const { data, error } = await supabase
      .from('borough_distances')
      .select('*');

    if (error) return [];

    // Update cache
    distanceCache.data = data || [];
    distanceCache.timestamp = now;

    return distanceCache.data;
  } catch {
    return [];
  }
};

/**
 * Get the complete game state for a player
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @returns {Promise<Object>} - Complete game state
 */
export const getGameState = async (playerId, gameId) => {
  try {
    // Get data in parallel for better performance
    const [playerStateResult, inventoryResult, transportResult, gameResult] =
      await Promise.all([
        // Get player state
        supabase
          .from('player_game_state')
          .select('*')
          .eq('player_id', playerId)
          .single(),
        // Get inventory
        supabase
          .from('player_inventory_view')
          .select('*')
          .eq('player_id', playerId),
        // Get transportation
        supabase
          .from('transportation_options')
          .select('*')
          .eq('player_id', playerId),
        // Get game
        supabase.from('games').select('*').eq('id', gameId).single(),
      ]);

    const playerState = playerStateResult.data;
    let boroughStores = [];

    // Get player's current borough ID, from either player_game_state or direct query
    let boroughId = playerState?.current_borough_id;

    if (!boroughId) {
      const { data: fallbackPlayer } = await supabase
        .from('players')
        .select('current_borough_id')
        .eq('id', playerId)
        .single();

      boroughId = fallbackPlayer?.current_borough_id;
    }

    // Get the stores for player's current borough
    if (boroughId) {
      boroughStores = await getBoroughStores(boroughId, gameId);
    }

    return {
      playerState: playerState || null,
      inventory: inventoryResult.data || [],
      transportOptions: transportResult.data || [],
      game: gameResult.data,
      boroughStores,
      loading: false,
      error: null,
    };
  } catch {
    return {
      playerState: null,
      inventory: [],
      transportOptions: [],
      game: null,
      boroughStores: [],
      loading: false,
      error: 'Failed to load game state',
    };
  }
};
