import { supabase } from '../lib/supabase';

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

    // Check game and get default borough in parallel
    const [gameResult, boroughResult] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('boroughs').select('id').limit(1).single(),
    ]);

    if (gameResult.error) throw gameResult.error;
    const game = gameResult.data;

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
    const defaultBoroughId = boroughResult.data?.id;
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

    // Load data in parallel
    const [gameResult, playerResult, allPlayersResult, inventoryResult] =
      await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase
          .from('players')
          .select('*, boroughs:current_borough_id (id, name)')
          .eq('id', playerIdToUse)
          .single(),
        supabase.from('players').select('*').eq('game_id', gameId),
        supabase
          .from('player_inventory')
          .select(`*, products:product_id (name, description)`)
          .eq('player_id', playerIdToUse),
      ]);

    if (playerResult.error) {
      return { success: false, needsJoin: true, game: gameResult.data };
    }

    // Get borough name if missing
    let boroughName = playerResult.data.boroughs?.name;
    if (!boroughName && playerResult.data.current_borough_id) {
      try {
        const { data: borough } = await supabase
          .from('boroughs')
          .select('name')
          .eq('id', playerResult.data.current_borough_id)
          .single();

        boroughName = borough?.name;
      } catch (err) {
        // Continue with unknown
      }
    }

    // Format player data
    const playerWithBorough = {
      ...playerResult.data,
      current_borough:
        boroughName || playerResult.data.current_borough || 'Unknown Location',
    };

    return {
      success: true,
      game: gameResult.data,
      player: playerWithBorough,
      allPlayers: allPlayersResult.data || [],
      inventory: inventoryResult.data || [],
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
    const { data, error } = await supabase
      .from('players')
      .select('*, boroughs:current_borough_id (id, name)')
      .eq('id', playerId)
      .single();

    return error ? null : data;
  } catch {
    return null;
  }
};

export const fetchPlayerInventory = async (playerId) => {
  try {
    const { data, error } = await supabase
      .from('player_inventory')
      .select(
        `
        *,
        products:product_id (
          id, name, artist, genre, year, rarity, description, image_url, base_price
        )
      `
      )
      .eq('player_id', playerId);

    return error ? null : data;
  } catch {
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

    return !error;
  } catch {
    return false;
  }
};

// GAME DATA
export const fetchGame = async (gameId) => {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    return error ? null : data;
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

    return !playerError;
  } catch {
    return false;
  }
};

// TRAVEL
export const getTravelInfo = async (playerId, transportationId, boroughId) => {
  try {
    const { data, error } = await supabase
      .from('transportation_options')
      .select('action_cost, monetary_cost')
      .eq('player_id', playerId)
      .eq('transportation_id', transportationId)
      .eq('to_borough_id', boroughId)
      .maybeSingle();

    if (error) return null;
    return data || { action_cost: 1, monetary_cost: 0 };
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

    return !error;
  } catch {
    return false;
  }
};
