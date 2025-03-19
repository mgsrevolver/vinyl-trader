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
 * @returns {Promise<Object>} - Result of the operation
 */
export const buyRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity
) => {
  try {
    const { data, error } = await supabase.rpc('buy_record', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_store_id: storeId,
      p_product_id: productId,
      p_quantity: quantity,
    });

    console.log('Buy record response:', { data, error }); // For debugging

    if (error) {
      console.error('Error buying record:', error);
      return {
        success: false,
        message: error.message || 'Unable to buy record. Please try again.',
      };
    }

    // Handle the new response format
    if (data && typeof data === 'object') {
      return {
        success: data.success,
        message: data.message,
      };
    }

    // Fallback for boolean response (until DB is updated)
    return {
      success: !!data,
      message: data
        ? 'Record purchased successfully!'
        : 'Unable to complete purchase. Check your funds and inventory space.',
    };
  } catch (e) {
    console.error('Exception buying record:', e);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
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
 * @returns {Promise<boolean>} - True if successful
 */
export const sellRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity
) => {
  try {
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
  } catch (e) {
    console.error('Exception in sellRecord:', e);
    return false;
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

    if (error || !data || data.length === 0) {
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

    if (getError) {
      console.error('Error getting game state:', getError);
      return false;
    }

    // Check if the game has ended (current_hour is 0)
    if (game.current_hour <= 0) {
      console.error('Game has already ended');
      return false;
    }

    // Decrement the hour (counts down from max_hours to 0)
    const { error: updateError } = await supabase
      .from('games')
      .update({ current_hour: game.current_hour - 1 })
      .eq('id', gameId);

    if (updateError) {
      console.error('Error advancing game hour:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in advanceGameHour:', error);
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
    // Skip all action cost calculations - GameContext already does this
    // Simply update the player's location
    const { error: locationError } = await supabase
      .from('players')
      .update({ current_borough_id: toBoroughId })
      .eq('id', playerId);

    if (locationError) {
      return { success: false, error: locationError };
    }

    return { success: true };
  } catch (err) {
    console.error('Travel error:', err);
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
    // Verify the borough exists
    const { data: boroughCheck, error: boroughError } = await supabase
      .from('boroughs')
      .select('id')
      .eq('id', boroughId)
      .single();

    // If borough doesn't exist, get any valid borough
    if (boroughError || !boroughCheck) {
      const { data: anyBorough, error: anyBoroughError } = await supabase
        .from('boroughs')
        .select('id')
        .limit(1)
        .single();

      if (anyBoroughError || !anyBorough) {
        return null;
      }

      boroughId = anyBorough.id;
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
        current_borough_id: boroughId,
      })
      .select('id')
      .single();

    if (playerError) {
      console.error('Error creating player:', playerError);
      return null;
    }

    // Initialize player actions for the first hour
    await getPlayerActions(player.id, gameId, 1);

    return player.id;
  } catch (e) {
    console.error('Exception creating player:', e);
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
      return { items: [], loading: false, error: 'Failed to load inventory' };
    }

    return { items: data || [], loading: false, error: null };
  } catch (e) {
    console.error('Exception getting store inventory:', e);
    return { items: [], loading: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Get the stores in a borough - OPTIMIZED VERSION
 * @param {string} boroughId - UUID of the borough
 * @returns {Promise<Array>} - Stores in the borough
 */
export const getBoroughStores = async (boroughId) => {
  try {
    // Optimized query - get only needed fields and use a more direct approach
    const { data, error } = await supabase
      .from('stores')
      .select('id, name, specialty_genre, open_hour, close_hour')
      .eq('borough_id', boroughId);

    if (error) {
      console.error('Error fetching borough stores:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getBoroughStores:', error);
    return [];
  }
};

/**
 * Get all transportation methods - OPTIMIZED VERSION
 * Cache the result since it rarely changes
 */
let cachedTransportMethods = null;
let transportCacheTime = 0;

export const getTransportationMethods = async () => {
  // Return cached data if available and not too old (10 minutes)
  const now = Date.now();
  if (cachedTransportMethods && now - transportCacheTime < 600000) {
    return cachedTransportMethods;
  }

  try {
    const { data, error } = await supabase
      .from('transportation_methods')
      .select('*')
      .order('speed_factor', { ascending: true });

    if (error) {
      console.error('Error getting transportation methods:', error);
      return [];
    }

    // Cache the result
    cachedTransportMethods = data || [];
    transportCacheTime = now;

    return cachedTransportMethods;
  } catch (error) {
    console.error('Error in getTransportationMethods:', error);
    return [];
  }
};

/**
 * Get all borough distances - OPTIMIZED VERSION
 * Cache the result since it rarely changes
 */
let cachedBoroughDistances = null;
let distancesCacheTime = 0;

export const getBoroughDistances = async () => {
  // Return cached data if available and not too old (10 minutes)
  const now = Date.now();
  if (cachedBoroughDistances && now - distancesCacheTime < 600000) {
    return cachedBoroughDistances;
  }

  try {
    const { data, error } = await supabase
      .from('borough_distances')
      .select('*');

    if (error) {
      console.error('Error getting borough distances:', error);
      return [];
    }

    // Cache the result
    cachedBoroughDistances = data || [];
    distancesCacheTime = now;

    return cachedBoroughDistances;
  } catch (error) {
    console.error('Error in getBoroughDistances:', error);
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
    // Get player state from player_game_state view
    const { data: playerState, error: playerStateError } = await supabase
      .from('player_game_state')
      .select('*')
      .eq('player_id', playerId)
      .single();

    if (playerStateError) {
      console.error('Error getting player state:', playerStateError);
    }

    // Get player inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('player_inventory_view')
      .select('*')
      .eq('player_id', playerId);

    if (inventoryError) {
      console.error('Error getting player inventory:', inventoryError);
    }

    // Get transportation options
    const { data: transportOptions, error: transportError } = await supabase
      .from('transportation_options')
      .select('*')
      .eq('player_id', playerId);

    if (transportError) {
      console.error('Error getting transportation options:', transportError);
    }

    // Get game data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) {
      console.error('Error getting game data:', gameError);
    }

    // Get borough stores if player has a location
    let boroughStores = [];
    if (playerState?.current_borough_id) {
      boroughStores = await getBoroughStores(playerState.current_borough_id);
    }

    return {
      playerState,
      inventory: inventory || [],
      transportOptions: transportOptions || [],
      game,
      boroughStores,
      loading: false,
      error: null,
    };
  } catch (e) {
    console.error('Error getting game state:', e);
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
