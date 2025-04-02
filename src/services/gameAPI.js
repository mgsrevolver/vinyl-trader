import { supabase, supabaseNoCache, clearSupabaseCache } from '../lib/supabase';

// Cache for frequently accessed data
const gameDataCache = {
  games: {},
  players: {},
  playerInventory: {},
  boroughs: null,
  travelInfo: {},
};

// Cache timeout (2 minutes)
const CACHE_TIMEOUT = 2 * 60 * 1000;

// GAME MANAGEMENT
export const createGame = async (playerName) => {
  try {
    // Get or create user ID
    const { data: userData } = await supabase.auth.getUser();
    let userId = userData?.user?.id || localStorage.getItem('deliWarsPlayerId');

    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('deliWarsPlayerId', userId);
    }

    // Create game and get Downtown borough in parallel
    const [gameResult, boroughResult] = await Promise.all([
      supabase
        .from('games')
        .insert({
          name: `${playerName}'s Game`,
          created_by: userId,
          status: 'waiting',
          current_hour: 24,
          max_hours: 24,
        })
        .select()
        .single(),

      supabase
        .from('boroughs')
        .select('id, name')
        .eq('name', 'Downtown')
        .single(),
    ]);

    if (gameResult.error) return { success: false, error: gameResult.error };
    if (boroughResult.error)
      return { success: false, error: boroughResult.error };

    const game = gameResult.data;
    const downtown = boroughResult.data;

    // Create player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        user_id: userId,
        game_id: game.id,
        username: playerName,
        current_borough_id: downtown.id,
        cash: 100,
        loan_amount: 100,
        inventory_capacity: 10,
      })
      .select('*, boroughs:current_borough_id (id, name)')
      .single();

    if (playerError) {
      await supabase.from('games').delete().eq('id', game.id);
      return { success: false, error: playerError };
    }

    const playerWithBorough = {
      ...player,
      current_borough: player.boroughs?.name || 'Unknown Location',
    };

    // Initialize game data with timeout
    const initResult = await initializeWithTimeout(game.id);

    // Set game to active
    await supabase
      .from('games')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', game.id);

    // Get final game state
    const { data: finalGame } = await supabase
      .from('games')
      .select('*')
      .eq('id', game.id)
      .single();

    return {
      success: true,
      gameId: game.id,
      playerId: player.id,
      game: finalGame || game,
      player: playerWithBorough,
      partialInit: initResult?.partialInit,
    };
  } catch (error) {
    return { success: false, error };
  }
};

// Helper for game initialization with timeout
const initializeWithTimeout = async (gameId, timeout = 15000) => {
  let timeoutId;
  try {
    const initPromise = supabase.rpc('initialize_game_data', {
      game_id: gameId,
    });
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Game initialization timed out')),
        timeout
      );
    });

    const result = await Promise.race([initPromise, timeoutPromise]);
    return result;
  } catch (error) {
    return { partialInit: true };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const joinGame = async (gameId, userId, playerName = null) => {
  try {
    // Get or create user ID
    if (!userId) {
      userId = localStorage.getItem('deliWarsPlayerId');
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('deliWarsPlayerId', userId);
      }
    }

    // Check if we have a cached game
    const cachedGame = gameDataCache.games[gameId];
    let game = null;

    if (cachedGame && Date.now() - cachedGame.timestamp < CACHE_TIMEOUT) {
      game = cachedGame.data;
    }

    // Fetch only what we need
    const fetchPromises = [];
    if (!game) {
      fetchPromises.push(
        supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()
          .then((result) => {
            if (!result.error) {
              game = result.data;
              gameDataCache.games[gameId] = {
                data: game,
                timestamp: Date.now(),
              };
            }
          })
      );
    }

    // Get default borough (only if we need it for a new player)
    let defaultBoroughId = null;
    if (
      !gameDataCache.boroughs ||
      Date.now() - gameDataCache.boroughs.timestamp > CACHE_TIMEOUT
    ) {
      fetchPromises.push(
        supabase
          .from('boroughs')
          .select('id')
          .limit(1)
          .single()
          .then((result) => {
            if (!result.error) {
              defaultBoroughId = result.data.id;
              gameDataCache.boroughs = {
                data: result.data,
                timestamp: Date.now(),
              };
            }
          })
      );
    } else if (gameDataCache.boroughs?.data) {
      defaultBoroughId = gameDataCache.boroughs.data.id;
    }

    // Run fetches in parallel
    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises);
    }

    if (!game) {
      throw new Error('Failed to load game data');
    }

    if (game.status === 'completed') {
      throw new Error('This game has already ended');
    }

    // Check if player is already in the game
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPlayer) {
      return {
        success: true,
        gameId,
        existing: true,
        game,
        player: existingPlayer,
        playerName: existingPlayer.username,
      };
    }

    // Create new player
    const username = playerName || 'Player';

    const { initializePlayer } = await import('../lib/gameActions');
    const newPlayerId = await initializePlayer(
      gameId,
      userId,
      defaultBoroughId
    );

    if (!newPlayerId) {
      throw new Error('Failed to initialize player');
    }

    // Get player data and update username
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('id', newPlayerId)
      .single();

    await supabase
      .from('players')
      .update({ username: username })
      .eq('id', newPlayerId);

    return {
      success: true,
      gameId,
      game,
      player: playerData,
      playerName: username,
    };
  } catch (error) {
    return { success: false, error };
  }
};

export const loadGame = async (gameId, playerIdToUse) => {
  try {
    if (!playerIdToUse) {
      return { success: false, needsJoin: true, game: null };
    }

    const now = Date.now();
    const fetchPromises = [];
    const results = {
      game: null,
      player: null,
      allPlayers: null,
      inventory: null,
    };

    // Check if we have cached data
    const cachedGame = gameDataCache.games[gameId];
    const cachedPlayer = gameDataCache.players[playerIdToUse];
    const cachedInventory = gameDataCache.playerInventory[playerIdToUse];

    // Only fetch what we need
    if (!cachedGame || now - cachedGame.timestamp > CACHE_TIMEOUT) {
      fetchPromises.push(
        supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()
          .then((result) => {
            if (!result.error) {
              results.game = result.data;
              gameDataCache.games[gameId] = {
                data: result.data,
                timestamp: now,
              };
            }
          })
      );
    } else {
      results.game = cachedGame.data;
    }

    if (!cachedPlayer || now - cachedPlayer.timestamp > CACHE_TIMEOUT) {
      fetchPromises.push(
        supabase
          .from('players')
          .select('*, boroughs:current_borough_id (id, name)')
          .eq('id', playerIdToUse)
          .single()
          .then((result) => {
            if (!result.error) {
              results.player = result.data;
              gameDataCache.players[playerIdToUse] = {
                data: result.data,
                timestamp: now,
              };
            }
          })
      );
    } else {
      results.player = cachedPlayer.data;
    }

    // Always fetch all players (to ensure we have latest status)
    fetchPromises.push(
      supabase
        .from('players')
        .select('id, username, cash, current_borough_id, turn_completed')
        .eq('game_id', gameId)
        .then((result) => {
          if (!result.error) {
            results.allPlayers = result.data;
          }
        })
    );

    if (!cachedInventory || now - cachedInventory.timestamp > CACHE_TIMEOUT) {
      fetchPromises.push(
        supabase
          .from('player_inventory')
          .select(
            `*, products:product_id (name, description, genre, artist, year)`
          )
          .eq('player_id', playerIdToUse)
          .then((result) => {
            if (!result.error) {
              results.inventory = result.data;
              gameDataCache.playerInventory[playerIdToUse] = {
                data: result.data,
                timestamp: now,
              };
            }
          })
      );
    } else {
      results.inventory = cachedInventory.data;
    }

    // Run all fetches in parallel
    await Promise.all(fetchPromises);

    // Check if we have the data we need
    if (!results.player) {
      return { success: false, needsJoin: true, game: results.game };
    }

    // Get borough name if missing
    let boroughName = results.player.boroughs?.name;
    if (!boroughName && results.player.current_borough_id) {
      try {
        if (gameDataCache.boroughs && gameDataCache.boroughs.data) {
          // Use cached borough data if available
          const borough = gameDataCache.boroughs.data.find(
            (b) => b.id === results.player.current_borough_id
          );
          if (borough) {
            boroughName = borough.name;
          }
        } else {
          // Fetch borough data if needed
          const { data: borough } = await supabase
            .from('boroughs')
            .select('name')
            .eq('id', results.player.current_borough_id)
            .single();
          boroughName = borough?.name;
        }
      } catch (err) {
        // Continue with unknown
      }
    }

    // Format player data
    const playerWithBorough = {
      ...results.player,
      current_borough:
        boroughName || results.player.current_borough || 'Unknown Location',
    };

    return {
      success: true,
      game: results.game,
      player: playerWithBorough,
      allPlayers: results.allPlayers || [],
      inventory: results.inventory || [],
    };
  } catch (error) {
    return { success: false, error };
  }
};

export const startGame = async (gameId) => {
  try {
    const { error } = await supabase
      .from('games')
      .update({
        status: 'active',
        current_hour: 24,
        started_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    // Clear cache for this game as it's now active
    if (gameDataCache.games[gameId]) {
      delete gameDataCache.games[gameId];
    }

    return !error;
  } catch {
    return false;
  }
};

export const endPlayerTurn = async (playerId, gameId) => {
  try {
    // Get players and mark current player's turn complete in parallel
    const [playersResult, markResult] = await Promise.all([
      supabase
        .from('players')
        .select('id, turn_completed')
        .eq('game_id', gameId),
      supabase
        .from('players')
        .update({ turn_completed: true })
        .eq('id', playerId),
    ]);

    if (playersResult.error || markResult.error)
      throw new Error('Failed to process turn');

    // Check if all players done
    const allCompleted = playersResult.data.every(
      (p) => p.id === playerId || p.turn_completed === true
    );

    if (!allCompleted) {
      return { success: true, allCompleted: false };
    }

    // Update game if all players done
    const { data: gameData } = await supabase
      .from('games')
      .select('current_hour')
      .eq('id', gameId)
      .single();

    const nextHour = gameData.current_hour - 1;
    const gameOver = nextHour <= 0;

    // Update game and reset player turns
    await Promise.all([
      supabase
        .from('games')
        .update({
          current_hour: nextHour,
          current_player_id: null,
          status: gameOver ? 'completed' : 'active',
          ended_at: gameOver ? new Date().toISOString() : null,
        })
        .eq('id', gameId),

      supabase
        .from('players')
        .update({ turn_completed: false })
        .eq('game_id', gameId),
    ]);

    // Clear cached game data since it's been updated
    if (gameDataCache.games[gameId]) {
      delete gameDataCache.games[gameId];
    }

    // Clear player cache for all players in this game
    Object.keys(gameDataCache.players).forEach((key) => {
      if (gameDataCache.players[key].data?.game_id === gameId) {
        delete gameDataCache.players[key];
      }
    });

    return {
      success: true,
      allCompleted: true,
      nextHour,
      gameOver,
    };
  } catch (error) {
    return { success: false, error };
  }
};

// PLAYER DATA
export const fetchPlayerWithBorough = async (playerId) => {
  try {
    // Clear cache to ensure fresh data
    if (gameDataCache.players[playerId]) {
      delete gameDataCache.players[playerId];
    }

    // Clear supabase cache too for good measure
    clearSupabaseCache();

    // Use no-cache client explicitly for player data
    const { data, error } = await supabaseNoCache
      .from('players')
      .select('*, boroughs:current_borough_id (id, name)')
      .eq('id', playerId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Store fresh data in local cache
    gameDataCache.players[playerId] = {
      data,
      timestamp: Date.now(),
    };

    return data;
  } catch (err) {
    return null;
  }
};

export const fetchPlayerInventory = async (playerId) => {
  try {
    // Get fresh data from the database each time, without relying on cache
    const { data, error } = await supabase
      .from('player_inventory')
      .select(
        `id, 
        player_id, 
        product_id, 
        quantity, 
        purchase_price, 
        condition, 
        quality_rating,
        products:product_id (
          id, name, artist, genre, year, rarity, description, image_url, base_price
        )`
      )
      .eq('player_id', playerId);

    if (error) {
      return null;
    }

    // Update cache with fresh data
    gameDataCache.playerInventory[playerId] = {
      data,
      timestamp: Date.now(),
    };

    return data;
  } catch (err) {
    return null;
  }
};

export const getInventoryItem = async (inventoryItemId) => {
  try {
    const { data, error } = await supabase
      .from('player_inventory')
      .select('product_id')
      .eq('id', inventoryItemId)
      .single();

    return error ? null : data;
  } catch {
    return null;
  }
};

export const updatePlayerActions = async (playerId, actionsUsed) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .update({ actions_used_this_hour: actionsUsed })
      .eq('id', playerId)
      .select()
      .single();

    // Update player in cache if it exists
    if (!error && data && gameDataCache.players[playerId]) {
      gameDataCache.players[playerId].data = {
        ...gameDataCache.players[playerId].data,
        actions_used_this_hour: actionsUsed,
      };
    }

    return error ? null : data;
  } catch {
    return null;
  }
};

export const setPlayerOverflow = async (playerId, overflow) => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ actions_overflow: overflow })
      .eq('id', playerId);

    // Update player in cache if it exists
    if (!error && gameDataCache.players[playerId]) {
      gameDataCache.players[playerId].data = {
        ...gameDataCache.players[playerId].data,
        actions_overflow: overflow,
      };
    }

    return !error;
  } catch {
    return false;
  }
};

// GAME DATA
export const fetchGame = async (gameId) => {
  try {
    // Check cache first
    const now = Date.now();
    const cached = gameDataCache.games[gameId];

    if (cached && now - cached.timestamp < CACHE_TIMEOUT) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) return null;

    // Cache the results
    gameDataCache.games[gameId] = {
      data,
      timestamp: now,
    };

    return data;
  } catch {
    return null;
  }
};

export const advanceGameHour = async (gameId, newHour, playerId) => {
  try {
    // Run operations in parallel
    const [gameResult, playerResult] = await Promise.all([
      // Update game hour
      supabase.from('games').update({ current_hour: newHour }).eq('id', gameId),

      // Get player overflow
      supabase
        .from('players')
        .select('actions_overflow')
        .eq('id', playerId)
        .single(),
    ]);

    if (gameResult.error) return false;

    // Apply overflow
    const overflowActions = playerResult.data?.actions_overflow || 0;
    const { error: playerError } = await supabase
      .from('players')
      .update({
        actions_used_this_hour: overflowActions,
        actions_overflow: 0,
      })
      .eq('id', playerId);

    // Clear cached game data since it's been updated
    if (gameDataCache.games[gameId]) {
      delete gameDataCache.games[gameId];
    }

    // Update player in cache if it exists
    if (!playerError && gameDataCache.players[playerId]) {
      gameDataCache.players[playerId].data = {
        ...gameDataCache.players[playerId].data,
        actions_used_this_hour: overflowActions,
        actions_overflow: 0,
      };
    }

    return !playerError;
  } catch {
    return false;
  }
};

// TRAVEL
export const getTravelInfo = async (playerId, transportationId, boroughId) => {
  try {
    // Check cache first with a composite key
    const cacheKey = `${playerId}-${transportationId}-${boroughId}`;
    const now = Date.now();
    const cached = gameDataCache.travelInfo[cacheKey];

    if (cached && now - cached.timestamp < CACHE_TIMEOUT) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('transportation_options')
      .select('action_cost, monetary_cost')
      .eq('player_id', playerId)
      .eq('transportation_id', transportationId)
      .eq('to_borough_id', boroughId)
      .maybeSingle();

    if (error) return null;

    const result = data || { action_cost: 1, monetary_cost: 0 };

    // Cache the results
    gameDataCache.travelInfo[cacheKey] = {
      data: result,
      timestamp: now,
    };

    return result;
  } catch {
    return null;
  }
};

export const movePlayer = async (playerId, boroughId, newCash) => {
  try {
    const { error } = await supabase
      .from('players')
      .update({
        current_borough_id: boroughId,
        cash: newCash,
      })
      .eq('id', playerId);

    // Update player in cache if it exists
    if (!error && gameDataCache.players[playerId]) {
      gameDataCache.players[playerId].data = {
        ...gameDataCache.players[playerId].data,
        current_borough_id: boroughId,
        cash: newCash,
      };
    }

    return !error;
  } catch {
    return false;
  }
};

// Helper to clear all caches - useful when debugging or when something goes wrong
export const clearCaches = () => {
  gameDataCache.games = {};
  gameDataCache.players = {};
  gameDataCache.playerInventory = {};
  gameDataCache.boroughs = null;
  gameDataCache.travelInfo = {};
  return true;
};
