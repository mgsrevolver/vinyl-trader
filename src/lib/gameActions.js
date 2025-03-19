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
 * @returns {Promise<{success: boolean, error: any}>} - Result object with success status and any error
 */
export const travelToBorough = async (
  playerId,
  gameId,
  toBoroughId,
  transportationId
) => {
  try {
    console.log('Calling travel_to_borough RPC with:', {
      playerId,
      gameId,
      toBoroughId,
      transportationId,
    });

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
      console.log('Player has no actions remaining, advancing game hour');

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

      console.log(`Advanced game to hour ${nextHour}`);

      // Create a new player_actions row for the next hour if needed
      try {
        const { data: newRow, error: insertError } = await supabase
          .from('player_actions')
          .insert({
            player_id: playerId,
            game_id: gameId,
            hour: nextHour,
            actions_used: 1, // Use 1 action for travel
            actions_available: 4,
          })
          .select();

        if (insertError) {
          console.log('Error inserting new player_actions row:', insertError);

          // If it's a unique constraint error, the row might already exist
          if (insertError.code === '23505') {
            console.log('Row already exists, updating instead');
            const { error: updateError } = await supabase
              .from('player_actions')
              .update({ actions_used: 1 })
              .eq('player_id', playerId)
              .eq('game_id', gameId)
              .eq('hour', nextHour);

            if (updateError) {
              console.error(
                'Error updating existing actions row:',
                updateError
              );
            }
          }
        } else {
          console.log('Created new player_actions row for hour', nextHour);
        }
      } catch (err) {
        console.error('Exception handling player_actions for next hour:', err);
      }
    } else {
      // Use an action for travel
      const { error: actionError } = await supabase
        .from('player_actions')
        .update({ actions_used: actionsData.actions_used + 1 })
        .eq('player_id', playerId)
        .eq('game_id', gameId)
        .eq('hour', currentHour);

      if (actionError) {
        console.error('Error using action for travel:', actionError);
      }
    }

    // First, delete any existing player_transportation record for this player and transportation
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

    // If error and it's the unique constraint error for player_transportation
    if (
      error &&
      error.code === '23505' &&
      error.message.includes(
        'player_transportation_player_id_transportation_id_key'
      )
    ) {
      console.log(
        'Got transportation constraint error, checking if travel was still successful'
      );

      // Check if player location was updated despite the error
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('current_borough_id')
        .eq('id', playerId)
        .single();

      if (!playerError && playerData.current_borough_id === toBoroughId) {
        console.log('Travel was successful despite constraint error');
        return { success: true };
      }

      return { success: false, error };
    } else if (error) {
      console.error('Error traveling to borough:', error);
      return { success: false, error };
    }

    console.log('Travel RPC response:', data);

    // The RPC returns true if successful
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
 * Get the game leaderboard with pagination
 * @param {string} gameId - UUID of the game
 * @param {number} page - Page number (starting from 1)
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Object>} - Game leaderboard with pagination info
 */
export const getGameLeaderboard = async (gameId, page = 1, pageSize = 10) => {
  try {
    // Calculate range
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('game_leaderboard')
      .select('*', { count: 'exact' })
      .eq('game_id', gameId)
      .order('profit', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error getting game leaderboard:', error);
      return {
        items: [],
        totalCount: 0,
        page: page,
        pageSize: pageSize,
        totalPages: 0,
        error: 'Failed to load leaderboard',
      };
    }

    const totalPages = Math.ceil(count / pageSize);

    return {
      items: data,
      totalCount: count,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages,
      error: null,
    };
  } catch (e) {
    console.error('Exception getting game leaderboard:', e);
    return {
      items: [],
      totalCount: 0,
      page: page,
      pageSize: pageSize,
      totalPages: 0,
      error: 'An unexpected error occurred',
    };
  }
};

/**
 * Create a new game
 * @param {string} userId - UUID of the user creating the game
 * @param {string} gameName - Name of the game
 * @returns {Promise<string>} - UUID of the created game
 */
export const createNewGame = async (userId, gameName) => {
  try {
    // First, create the game entry
    const { data, error } = await supabase
      .from('games')
      .insert({
        created_by: userId,
        name: gameName,
        status: 'waiting',
        current_hour: 1,
        max_hours: 24,
        started_at: new Date(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return null;
    }

    // Game created successfully
    return data.id;
  } catch (e) {
    console.error('Exception creating game:', e);
    return null;
  }
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

/**
 * Use player action points
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {number} hour - Current game hour
 * @param {number} actionCount - Number of action points to use
 * @returns {Promise<Object>} - Result of the action point consumption
 */
export const usePlayerAction = async (
  playerId,
  gameId,
  hour,
  actionCount = 1
) => {
  try {
    const { data, error } = await supabase.rpc('use_player_action', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_hour: hour,
      p_action_count: actionCount,
    });

    if (error) {
      console.error('Error using player action:', error);
      return {
        success: false,
        message: 'Not enough action points remaining.',
        remainingActions: null,
      };
    }

    // Get current actions remaining
    const { data: actions } = await supabase
      .from('player_actions')
      .select('actions_available, actions_used')
      .eq('player_id', playerId)
      .eq('game_id', gameId)
      .eq('hour', hour)
      .single();

    return {
      success: data,
      message: data ? 'Action completed!' : 'Not enough action points.',
      remainingActions: actions
        ? actions.actions_available - actions.actions_used
        : null,
    };
  } catch (e) {
    console.error('Exception using player action:', e);
    return {
      success: false,
      message: 'An unexpected error occurred.',
      remainingActions: null,
    };
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
    // Use Promise.all to make parallel requests
    const [playerState, inventory, transportOptions, game] = await Promise.all([
      getPlayerGameState(playerId),
      getPlayerInventory(playerId),
      getTransportationOptions(playerId),
      supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()
        .then(({ data }) => data),
    ]);

    // If player is in a borough, get the stores
    let boroughStores = [];
    if (playerState?.current_borough_id) {
      boroughStores = await getBoroughStores(playerState.current_borough_id);
    }

    return {
      playerState,
      inventory,
      transportOptions,
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

/**
 * Initialize a new player in a game
 * @param {string} gameId - UUID of the game
 * @param {string} userId - UUID of the user
 * @param {string} boroughId - UUID of the starting borough
 * @returns {Promise<string>} - UUID of the created player
 */
export const initializePlayer = async (gameId, userId, boroughId) => {
  try {
    // First verify that the borough exists
    const { data: boroughCheck, error: boroughError } = await supabase
      .from('boroughs') // Using boroughs instead of neighborhoods
      .select('id')
      .eq('id', boroughId)
      .single();

    if (boroughError || !boroughCheck) {
      console.error('Error verifying borough:', boroughError);
      // Try to get any valid borough instead
      const { data: anyBorough, error: anyBoroughError } = await supabase
        .from('boroughs')
        .select('id')
        .limit(1)
        .single();

      if (anyBoroughError || !anyBorough) {
        console.error('Could not find any valid borough:', anyBoroughError);
        return null;
      }

      // Use this borough instead
      boroughId = anyBorough.id;
    }

    // Create the player with the verified borough
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
    const { error: actionsError } = await supabase
      .from('player_actions')
      .insert({
        player_id: player.id,
        game_id: gameId,
        hour: 1, // Starting hour
        actions_used: 0,
        actions_available: 4,
      });

    if (actionsError) {
      console.error('Error initializing player actions:', actionsError);
      // We've already created the player, so return the ID even if actions init fails
    }

    console.log('Player created successfully with ID:', player.id);
    return player.id;
  } catch (e) {
    console.error('Exception creating player:', e);
    return null;
  }
};

/**
 * Initialize game market data
 * @param {string} gameId - UUID of the game
 * @returns {Promise<boolean>} - Success indicator
 */
export const initializeGameMarket = async (gameId) => {
  try {
    // Call the database stored procedure to initialize the market
    const { data, error } = await supabase.rpc('initialize_market_inventory', {
      game_id: gameId,
    });

    if (error) {
      console.error('Error initializing market inventory:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Exception initializing market:', e);
    return false;
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
 * Get the player's actions for the current hour
 * @param {string} playerId - UUID of the player
 * @param {string} gameId - UUID of the game
 * @param {number} currentHour - Current game hour
 * @returns {Promise<Object>} - Player's actions data
 */
export const getPlayerActions = async (playerId, gameId, currentHour) => {
  try {
    console.log('Fetching player actions for:', {
      playerId,
      gameId,
      currentHour,
    });

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

    // If no data found or empty array (no row for this hour), return default values
    if (!data || data.length === 0) {
      console.log(
        'No player_actions row found for current hour, using defaults'
      );

      // Try to create the actions row for this hour
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
          console.log('Created new player_actions row:', newRow);
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
