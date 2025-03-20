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
    console.log('Buying record with params:', {
      playerId,
      gameId,
      storeId,
      productId,
      quantity,
      inventoryId,
    });

    // If no productId is provided, this will fail
    if (!productId) {
      console.error('Missing required productId for buy_record');
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
      console.error('Error buying record:', error);
      return {
        success: false,
        error: {
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
    console.error('Error buying record:', err);
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
 * @returns {Promise<Object>} - Result object with success status
 */
export const sellRecord = async (
  playerId,
  gameId,
  storeId,
  productId,
  quantity = 1
) => {
  try {
    console.log('Selling record with params:', {
      playerId,
      gameId,
      storeId,
      productId,
      quantity,
    });

    // First, get product details for debugging
    const { data: productData } = await supabase
      .from('products')
      .select('name, base_price')
      .eq('id', productId)
      .single();

    console.log('Product base details:', productData);

    // Get player inventory item to see purchase price
    const { data: inventoryData } = await supabase
      .from('player_inventory')
      .select('purchase_price, condition')
      .eq('player_id', playerId)
      .eq('product_id', productId)
      .single();

    console.log('Player inventory details:', inventoryData);

    // First, fetch the current market price with margin applied
    const { data: marketData, error: marketError } = await supabase
      .from('market_inventory')
      .select('current_price, condition')
      .eq('game_id', gameId)
      .eq('store_id', storeId)
      .eq('product_id', productId);

    if (marketError) {
      console.error('Error fetching market price:', marketError);
      return { success: false, error: marketError };
    }

    // Handle case when market data is empty or has multiple records
    if (!marketData || marketData.length === 0) {
      console.error('No market data found for this product');
      return {
        success: false,
        error: { message: 'No market data found for this product' },
      };
    }

    console.log('Market data (all entries):', marketData);

    // Use the first result if there are multiple
    const currentPrice = marketData[0].current_price;

    // Apply store margin (75%) - this is core business logic
    const STORE_MARGIN = 0.75;
    const sellPrice = currentPrice * STORE_MARGIN;

    // Check what the database sell_record function will actually calculate
    const { data: dbMarginData } = await supabase.rpc('calculate_sell_margin', {
      condition: inventoryData?.condition || 'Good',
    });

    console.log('Database margin calculation:', {
      condition: inventoryData?.condition || 'Good',
      frontendMargin: STORE_MARGIN,
      databaseMargin: dbMarginData,
      frontendSellPrice: sellPrice,
      databaseEstimatedSellPrice: currentPrice * dbMarginData,
    });

    console.log('Selling at price:', {
      originalPrice: currentPrice,
      sellPrice: sellPrice,
      margin: STORE_MARGIN,
    });

    // Call the database function to sell the record
    const { data, error } = await supabase.rpc('sell_record', {
      p_player_id: playerId,
      p_game_id: gameId,
      p_store_id: storeId,
      p_product_id: productId,
      p_quantity: quantity,
    });

    if (error) {
      console.error('Error selling record:', error);
      return { success: false, error: error };
    }

    // Update player's cash to reflect the correct margin
    if (data) {
      // After successful sale, ensure player receives the correct amount
      // This is a workaround since we can't modify the database function
      const priceDifference = currentPrice - sellPrice;

      if (priceDifference > 0) {
        // First, get the current cash value
        const { data: playerData, error: fetchError } = await supabase
          .from('players')
          .select('cash')
          .eq('id', playerId)
          .single();

        if (fetchError) {
          console.error('Error fetching player cash:', fetchError);
        } else {
          // Then update with the calculated new value
          const newCash = playerData.cash - priceDifference * quantity;

          const { error: cashError } = await supabase
            .from('players')
            .update({ cash: newCash })
            .eq('id', playerId);

          if (cashError) {
            console.error('Error adjusting player cash for margin:', cashError);
            // Not returning error as the sale was completed, this is just an adjustment
          }
        }
      }
    }

    return { success: true, data };
  } catch (err) {
    console.error('Error selling record:', err);
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
      console.error('Error fetching sell prices:', error);
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
    console.error('Error in getSellPrices:', error);
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
