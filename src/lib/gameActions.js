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
    // If no productId is provided, this will fail
    if (!productId) {
      return {
        success: false,
        error: {
          message: 'Missing required product ID',
        },
      };
    }

    // Call the buy_record function with the parameters it expects
    const { data, error } = await supabase.rpc('buy_record', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_product_id: productId,
      p_quantity: quantity,
      p_store_id: storeId,
      // The database function doesn't have an inventory_id parameter
    });

    if (error) {
      // Check for unique constraint violation
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

    // If we get a false response, it typically means insufficient funds or inventory
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
      error: {
        message: err.message || 'An unexpected error occurred',
      },
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
    // Check if inventoryId is provided
    if (!inventoryId) {
      return {
        success: false,
        error: {
          message: 'Missing inventory ID. Need to specify which copy to sell.',
        },
      };
    }

    // Call the database function to sell the record
    const { data, error } = await supabase.rpc('sell_record', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_store_id: storeId,
      p_product_id: productId,
      p_quantity: quantity,
      p_inventory_id: inventoryId,
    });

    if (error) {
      return { success: false, error: error };
    }

    return { success: true, data };
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
    if (!productIds || productIds.length === 0) {
      return {};
    }

    // Fetch all market prices for these products at this store
    const { data, error } = await supabase
      .from('market_inventory')
      .select('product_id, current_price')
      .eq('store_id', storeId)
      .eq('game_id', gameId)
      .in('product_id', productIds);

    if (error) {
      return {};
    }

    // Apply 75% margin - this is core business logic
    const STORE_MARGIN = 0.75;

    // Create a map of product ID to adjusted sell price
    const priceMap = {};
    data.forEach((item) => {
      priceMap[item.product_id] = item.current_price * STORE_MARGIN;
    });

    return priceMap;
  } catch (error) {
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
      return false;
    }

    // Check if the game has ended (current_hour is 0)
    if (game.current_hour <= 0) {
      return false;
    }

    // Decrement the hour (counts down from max_hours to 0)
    const { error: updateError } = await supabase
      .from('games')
      .update({ current_hour: game.current_hour - 1 })
      .eq('id', gameId);

    if (updateError) {
      return false;
    }

    return true;
  } catch (error) {
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
    // Get Downtown borough first
    const { data: downtown, error: downtownError } = await supabase
      .from('boroughs')
      .select('id, name')
      .eq('name', 'Downtown')
      .single();

    // If Downtown not found or boroughId provided, verify the borough exists
    let targetBoroughId = downtown?.id;
    if (!targetBoroughId && boroughId) {
      const { data: boroughCheck, error: boroughError } = await supabase
        .from('boroughs')
        .select('id')
        .eq('id', boroughId)
        .single();

      if (!boroughError && boroughCheck) {
        targetBoroughId = boroughId;
      }
    }

    // If still no valid borough, get any valid borough
    if (!targetBoroughId) {
      const { data: anyBorough, error: anyBoroughError } = await supabase
        .from('boroughs')
        .select('id')
        .limit(1)
        .single();

      if (anyBoroughError || !anyBorough) {
        return null;
      }

      targetBoroughId = anyBorough.id;
    }

    // Create the player with the determined borough
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

    if (playerError) {
      return null;
    }

    // Initialize player actions for the first hour
    await getPlayerActions(player.id, gameId, 1);

    return player.id;
  } catch (e) {
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
        condition,
        quality_rating,
        base_markup,
        product_id,
        products (
          id,
          name,
          artist,
          genre,
          year,
          rarity,
          description,
          image_url
        )
      `
      )
      .eq('store_id', storeId)
      .eq('game_id', gameId)
      .gt('quantity', 0);

    if (error) {
      return { items: [], loading: false, error: 'Failed to load inventory' };
    }

    return { items: data || [], loading: false, error: null };
  } catch (e) {
    return { items: [], loading: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Get the stores in a borough - OPTIMIZED VERSION
 * @param {string} boroughId - UUID of the borough
 * @param {string} gameId - UUID of the game (optional)
 * @returns {Promise<Array>} - Stores in the borough
 */
export const getBoroughStores = async (boroughId, gameId = null) => {
  try {
    // Simply get all stores in the borough without filtering by game inventory
    // This is the most reliable approach to ensure stores always show up
    const { data: allStores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, specialty_genre, open_hour, close_hour')
      .eq('borough_id', boroughId);

    if (storesError) {
      return [];
    }

    // As a sanity check - if gameId is provided, also log the market inventory for these stores
    if (gameId && allStores?.length > 0) {
      // Get store IDs for checking inventory
      const storeIds = allStores.map((store) => store.id);

      // Check if these stores have any inventory for this game (just for logging)
      const { data: inventory } = await supabase
        .from('market_inventory')
        .select('store_id, product_id')
        .eq('game_id', gameId)
        .in('store_id', storeIds);
    }

    return allStores || [];
  } catch (error) {
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
      return [];
    }

    // Cache the result
    cachedTransportMethods = data || [];
    transportCacheTime = now;

    return cachedTransportMethods;
  } catch (error) {
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
      return [];
    }

    // Cache the result
    cachedBoroughDistances = data || [];
    distancesCacheTime = now;

    return cachedBoroughDistances;
  } catch (error) {
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
    // Get player state from player_game_state view - it already includes borough name
    const { data: playerState, error: playerStateError } = await supabase
      .from('player_game_state')
      .select('*')
      .eq('player_id', playerId)
      .single();

    // If the view doesn't return data, try querying the players table directly
    if (!playerState) {
      const { data: directPlayerData, error: directError } = await supabase
        .from('players')
        .select('*, boroughs:current_borough_id (id, name)')
        .eq('id', playerId)
        .single();
    }

    // No need to format player state - it already has current_borough
    const formattedPlayerState = playerState || null;

    // Get player inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('player_inventory_view')
      .select('*')
      .eq('player_id', playerId);

    // Get transportation options
    const { data: transportOptions, error: transportError } = await supabase
      .from('transportation_options')
      .select('*')
      .eq('player_id', playerId);

    // Get game data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    // Get borough stores if player has a location
    let boroughStores = [];
    let boroughId = null;

    if (playerState?.current_borough_id) {
      boroughId = playerState.current_borough_id;
    } else {
      // Try to look up the player's location as a fallback
      const { data: fallbackPlayer } = await supabase
        .from('players')
        .select('current_borough_id')
        .eq('id', playerId)
        .single();

      if (fallbackPlayer?.current_borough_id) {
        boroughId = fallbackPlayer.current_borough_id;
      }
    }

    if (boroughId) {
      boroughStores = await getBoroughStores(boroughId, gameId);
    }

    const result = {
      playerState: formattedPlayerState,
      inventory: inventory || [],
      transportOptions: transportOptions || [],
      game,
      boroughStores,
      loading: false,
      error: null,
    };

    return result;
  } catch (e) {
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
