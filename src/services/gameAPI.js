import { supabase } from '../lib/supabase';

// GAME MANAGEMENT
export const createGame = async (playerName) => {
  try {
    // Try to get the authenticated user ID
    const { data: userData } = await supabase.auth.getUser();
    let userId = userData?.user?.id;

    // If we don't have a userId from auth, use a generated one instead
    if (!userId) {
      console.log('No authenticated user ID found, using anonymous ID');

      // Try to get from localStorage
      userId = localStorage.getItem('deliWarsPlayerId');

      // If not in localStorage, generate a new one
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('deliWarsPlayerId', userId);
      }

      console.log('Using anonymous user ID:', userId);
    }

    // STEP 1: Create the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        name: `${playerName}'s Game`,
        created_by: userId,
        status: 'active',
        current_hour: 24,
        max_hours: 24,
      })
      .select()
      .single();

    if (gameError) {
      console.error('Error creating game:', gameError);
      return { success: false, error: gameError };
    }

    // STEP 2: Get Downtown borough
    const { data: downtown, error: boroughError } = await supabase
      .from('boroughs')
      .select('id')
      .eq('name', 'Downtown')
      .single();

    if (boroughError) {
      console.error('Error finding Downtown:', boroughError);
      return { success: false, error: boroughError };
    }

    // STEP 3: Create the player
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
      .select()
      .single();

    if (playerError) {
      console.error('Error creating player:', playerError);
      await supabase.from('games').delete().eq('id', game.id);
      return { success: false, error: playerError };
    }

    // STEP 4: Initialize game data in background
    supabase
      .rpc('initialize_game_data', { game_id: game.id })
      .then(() => console.log('Game data initialized'))
      .catch((err) => console.error('Error initializing game data:', err));

    return {
      success: true,
      gameId: game.id,
      playerId: player.id,
      game,
      player,
    };
  } catch (error) {
    console.error('Error in createGame:', error);
    return { success: false, error };
  }
};

export const joinGame = async (gameId, userId, playerName = null) => {
  try {
    // Ensure we have a valid userId
    if (!userId) {
      // Try to get from localStorage
      userId = localStorage.getItem('deliWarsPlayerId');

      // If not in localStorage, generate a new one
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('deliWarsPlayerId', userId);
      }

      console.log('Using generated user ID for joining:', userId);
    }

    // Get default starting borough
    let defaultBoroughId = null;
    const { data: borough } = await supabase
      .from('boroughs')
      .select('id')
      .limit(1)
      .single();

    if (borough) {
      defaultBoroughId = borough.id;
    }

    // Check if game exists
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;

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
      // Already in game, just return the player
      return {
        success: true,
        gameId,
        existing: true,
        game,
        player: existingPlayer,
        playerName: existingPlayer.username,
      };
    }

    // Use provided player name or generate one
    const username = playerName || 'Player';

    // Initialize player through the gameActions.js utility
    const { initializePlayer } = await import('../lib/gameActions');
    const newPlayerId = await initializePlayer(
      gameId,
      userId,
      defaultBoroughId
    );

    if (!newPlayerId) {
      throw new Error('Failed to initialize player');
    }

    // Fetch the created player data
    const { data: playerData, error: playerFetchError } = await supabase
      .from('players')
      .select('*')
      .eq('id', newPlayerId)
      .single();

    if (playerFetchError) throw playerFetchError;

    // Update username separately
    const { error: usernameError } = await supabase
      .from('players')
      .update({ username: username })
      .eq('id', newPlayerId);

    if (usernameError) console.warn('Failed to set username:', usernameError);

    return {
      success: true,
      gameId,
      game,
      player: playerData,
      playerName: username,
    };
  } catch (error) {
    console.error('Error joining game:', error);
    return { success: false, error };
  }
};

export const loadGame = async (gameId, playerIdToUse) => {
  try {
    // Ensure we have a valid playerIdToUse
    if (!playerIdToUse) {
      console.error('No player ID provided to loadGame');
      return { success: false, needsJoin: true, game: null };
    }

    // Load data in parallel for better performance
    const [gameResult, playerResult, allPlayersResult, inventoryResult] =
      await Promise.all([
        // Game data
        supabase.from('games').select('*').eq('id', gameId).single(),

        // Player data with borough information
        supabase
          .from('players')
          .select('*, boroughs:current_borough_id (id, name)')
          .eq('id', playerIdToUse)
          .single(),

        // All players in game
        supabase.from('players').select('*').eq('game_id', gameId),

        // Player inventory
        supabase
          .from('player_inventory')
          .select(`*, products:product_id (name, description)`)
          .eq('player_id', playerIdToUse),
      ]);

    if (playerResult.error) {
      console.error('Player not found with ID:', playerIdToUse);
      return { success: false, needsJoin: true, game: gameResult.data };
    }

    // Format player data
    const playerWithBorough = {
      ...playerResult.data,
      current_borough: playerResult.data.boroughs?.name || 'Unknown Location',
    };

    return {
      success: true,
      game: gameResult.data,
      player: playerWithBorough,
      allPlayers: allPlayersResult.data || [],
      inventory: inventoryResult.data || [],
    };
  } catch (error) {
    console.error('Error loading game:', error);
    return { success: false, error };
  }
};

export const startGame = async (gameId) => {
  try {
    // Update game status
    const { error } = await supabase
      .from('games')
      .update({
        status: 'active',
        current_hour: 24,
        started_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error starting game:', error);
    return false;
  }
};

export const endPlayerTurn = async (playerId, gameId) => {
  try {
    // Check if all players have completed their turns
    const { data: activePlayers, error: playersError } = await supabase
      .from('players')
      .select('id, turn_completed')
      .eq('game_id', gameId);

    if (playersError) throw playersError;

    // Mark this player's turn as completed
    const { error: updateError } = await supabase
      .from('players')
      .update({ turn_completed: true })
      .eq('id', playerId);

    if (updateError) throw updateError;

    // Check if all players have completed their turn
    const allCompleted = activePlayers.every(
      (p) => p.id === playerId || p.turn_completed === true
    );

    let nextHour = null;
    let gameOver = false;

    if (allCompleted) {
      // Get current game state
      const { data: gameData } = await supabase
        .from('games')
        .select('current_hour')
        .eq('id', gameId)
        .single();

      // Decrease hours remaining
      nextHour = gameData.current_hour - 1;
      gameOver = nextHour <= 0;

      // Update game status
      const { data: updatedGame, error: gameError } = await supabase
        .from('games')
        .update({
          current_hour: nextHour,
          current_player_id: null,
          status: gameOver ? 'completed' : 'active',
          ended_at: gameOver ? new Date().toISOString() : null,
        })
        .eq('id', gameId)
        .select()
        .single();

      if (gameError) throw gameError;

      // Reset all players' turn_completed flags
      const { error: resetError } = await supabase
        .from('players')
        .update({ turn_completed: false })
        .eq('game_id', gameId);

      if (resetError) throw resetError;
    }

    return {
      success: true,
      allCompleted,
      nextHour,
      gameOver,
    };
  } catch (error) {
    console.error('Error ending turn:', error);
    return { success: false, error };
  }
};

// PLAYER DATA
export const fetchPlayerWithBorough = async (playerId) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select(
        `
        *,
        boroughs:current_borough_id (id, name)
      `
      )
      .eq('id', playerId)
      .single();

    if (error) {
      console.error('Error fetching player data:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchPlayerWithBorough:', error);
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
          id,
          name,
          artist,
          genre,
          year,
          condition,
          rarity,
          description,
          image_url,
          base_price
        )
      `
      )
      .eq('player_id', playerId);

    if (error) {
      console.error('Error fetching player inventory:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchPlayerInventory:', error);
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

    if (error) {
      console.error('Error fetching inventory item:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getInventoryItem:', error);
    return null;
  }
};

export const updatePlayerActions = async (playerId, actionsUsed) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .update({
        actions_used_this_hour: actionsUsed,
      })
      .eq('id', playerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating actions used:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updatePlayerActions:', error);
    return null;
  }
};

export const setPlayerOverflow = async (playerId, overflow) => {
  try {
    const { error } = await supabase
      .from('players')
      .update({ actions_overflow: overflow })
      .eq('id', playerId);

    if (error) {
      console.error('Error setting player overflow:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in setPlayerOverflow:', error);
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

    if (error) {
      console.error('Error fetching game:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in fetchGame:', error);
    return null;
  }
};

export const advanceGameHour = async (gameId, newHour, playerId) => {
  try {
    // Update game hour
    const { error: gameError } = await supabase
      .from('games')
      .update({ current_hour: newHour })
      .eq('id', gameId);

    if (gameError) {
      console.error('Error advancing game hour:', gameError);
      return false;
    }

    // Get any overflow actions from previous hour
    const { data: playerData } = await supabase
      .from('players')
      .select('actions_overflow')
      .eq('id', playerId)
      .single();

    const overflowActions = playerData?.actions_overflow || 0;

    // Reset player's actions but apply overflow
    const { error: playerError } = await supabase
      .from('players')
      .update({
        actions_used_this_hour: overflowActions,
        actions_overflow: 0, // Reset overflow after applying it
      })
      .eq('id', playerId);

    if (playerError) {
      console.error('Error resetting player actions:', playerError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in advanceGameHour:', error);
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

    if (error) {
      console.error('Error getting travel info:', error);
      return null;
    }

    return data || { action_cost: 1, monetary_cost: 0 };
  } catch (error) {
    console.error('Error in getTravelInfo:', error);
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

    if (error) {
      console.error('Error updating player location:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in movePlayer:', error);
    return false;
  }
};
