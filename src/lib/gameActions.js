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

    if (error) {
      console.error('Error buying record:', error);
      return {
        success: false,
        message: 'Unable to buy record. Please try again.',
      };
    }

    return {
      success: data,
      message: data
        ? 'Record purchased successfully!'
        : 'Unable to complete purchase.',
    };
  } catch (e) {
    console.error('Exception buying record:', e);
    return { success: false, message: 'An unexpected error occurred.' };
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
    // Use limit(1) instead of maybeSingle to avoid errors when multiple rows exist
    const { data, error } = await supabase
      .from('player_actions')
      .select('*')
      .eq('player_id', playerId)
      .eq('game_id', gameId)
      .eq('hour', currentHour)
      .limit(1);

    if (error) {
      console.error('Error getting player actions:', error);
      return { actions_used: 0, actions_available: 4 }; // Default values
    }

    // If no data found or empty array (no row for this hour), create a new row
    if (!data || data.length === 0) {
      try {
        const { data: newRow, error: insertError } = await supabase
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

        if (!insertError && newRow) {
          return newRow;
        }
      } catch (insertErr) {
        console.error('Could not create player_actions row:', insertErr);
      }

      // Return default values if insert failed
      return { actions_used: 0, actions_available: 4 };
    }

    // Return the first row when multiple exist
    return data[0];
  } catch (err) {
    console.error('Error in getPlayerActions:', err);
    return { actions_used: 0, actions_available: 4 }; // Default values
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
 * Travel to another borough
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
    // Check if the player has actions remaining
    const { data: game } = await supabase
      .from('games')
      .select('current_hour')
      .eq('id', gameId)
      .single();

    const currentHour = game?.current_hour || 24;

    // Get player actions for current hour
    const actionsData = await getPlayerActions(playerId, gameId, currentHour);
    const actionsRemaining =
      actionsData.actions_available - actionsData.actions_used;

    // If no actions remaining, advance the game hour
    if (actionsRemaining <= 0) {
      // Advance to next hour
      const nextHour = currentHour - 1;
      if (nextHour <= 0) {
        return {
          success: false,
          error: new Error('Game has ended, no more hours remaining'),
        };
      }

      // Update the game's current hour
      const { error: updateError } = await supabase
        .from('games')
        .update({ current_hour: nextHour })
        .eq('id', gameId);

      if (updateError) {
        console.error('Error advancing game hour:', updateError);
        return { success: false, error: updateError };
      }

      // Create a new player_actions row for the next hour
      await getPlayerActions(playerId, gameId, nextHour);
    }

    // Delete any existing player_transportation record for this player and transportation
    await supabase
      .from('player_transportation')
      .delete()
      .match({ player_id: playerId, transportation_id: transportationId });

    // Call the travel RPC
    const { data, error } = await supabase.rpc('travel_to_borough', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_to_borough_id: toBoroughId,
      p_transportation_id: transportationId,
    });

    // Handle constraint error for player_transportation
    if (
      error &&
      error.code === '23505' &&
      error.message.includes(
        'player_transportation_player_id_transportation_id_key'
      )
    ) {
      // Check if player location was updated despite the error
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('current_borough_id')
        .eq('id', playerId)
        .single();

      if (!playerError && playerData.current_borough_id === toBoroughId) {
        return { success: true };
      }

      return { success: false, error };
    } else if (error) {
      console.error('Error traveling to borough:', error);
      return { success: false, error };
    }

    return {
      success: data === true,
      error: data === false ? new Error('Travel failed') : null,
    };
  } catch (err) {
    console.error('Exception in travelToBorough:', err);
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
 * Get the stores in a borough
 * @param {string} boroughId - UUID of the borough
 * @returns {Promise<Array>} - Stores in the borough
 */
export const getBoroughStores = async (boroughId) => {
  try {
    // Try to get stores directly related through borough_id
    const { data: directStores, error: directError } = await supabase
      .from('stores')
      .select('*')
      .eq('borough_id', boroughId);

    // Then check the store_boroughs junction table
    const { data: junctionData, error: junctionError } = await supabase
      .from('store_boroughs')
      .select('store_id')
      .eq('borough_id', boroughId);

    if (junctionError && directError) {
      return [];
    }

    // If no junction relationships found and direct query succeeded, return directStores
    if ((!junctionData || !junctionData.length) && !directError) {
      return directStores || [];
    }

    // If no direct stores and no junction relationships, return empty array
    if (
      (!directStores || !directStores.length) &&
      (!junctionData || !junctionData.length)
    ) {
      return [];
    }

    // Extract store IDs from the junction table
    const storeIds = junctionData
      ? junctionData.map((item) => item.store_id)
      : [];

    // Get the actual store data for these IDs if any exist
    if (storeIds.length > 0) {
      const { data: junctionStores, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .in('id', storeIds);

      if (storesError) {
        return directStores || [];
      }

      // Combine stores from both sources (avoiding duplicates by ID)
      if (directStores && directStores.length > 0) {
        const existingIds = new Set(junctionStores.map((store) => store.id));
        return [
          ...junctionStores,
          ...directStores.filter((store) => !existingIds.has(store.id)),
        ];
      }

      return junctionStores || [];
    }

    return directStores || [];
  } catch (error) {
    console.error('Exception in getBoroughStores:', error);
    return [];
  }
};

/**
 * Get all transportation methods
 * @returns {Promise<Array>} - Available transportation methods
 */
export const getTransportationMethods = async () => {
  const { data, error } = await supabase
    .from('transportation_methods')
    .select('*')
    .order('speed_factor', { ascending: true });

  if (error) {
    console.error('Error getting transportation methods:', error);
    return [];
  }

  return data || [];
};

/**
 * Get all borough distances
 * @returns {Promise<Array>} - Borough distances
 */
export const getBoroughDistances = async () => {
  const { data, error } = await supabase.from('borough_distances').select('*');

  if (error) {
    console.error('Error getting borough distances:', error);
    return [];
  }

  return data || [];
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
