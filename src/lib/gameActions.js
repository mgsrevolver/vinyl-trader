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
