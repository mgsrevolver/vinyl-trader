import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import {
  initializePlayer,
  travelToBorough,
  buyRecord,
  sellRecord,
} from '../lib/gameActions';
import ConfirmationModal from '../components/ui/ConfirmationModal';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const navigate = useNavigate();
  const [currentGame, setCurrentGame] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playerInventory, setPlayerInventory] = useState([]);
  const [gameLoading, setGameLoading] = useState(false);
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationProps, setConfirmationProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });
  const [pendingAction, setPendingAction] = useState(null);

  // Generate or retrieve player ID
  useEffect(() => {
    // First check for game-specific player ID
    const currentGameId = localStorage.getItem('deliWarsCurrentGame');
    const gameSpecificPlayerId = currentGameId
      ? localStorage.getItem(`player_${currentGameId}`)
      : null;

    // If we have a game-specific player ID, use that
    if (
      gameSpecificPlayerId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        gameSpecificPlayerId
      )
    ) {
      setPlayerId(gameSpecificPlayerId);
      return;
    }

    // Otherwise use/create general player ID
    const storedPlayerId = localStorage.getItem('deliWarsPlayerId');

    if (
      storedPlayerId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        storedPlayerId
      )
    ) {
      setPlayerId(storedPlayerId);
    } else {
      const newPlayerId = uuidv4();
      localStorage.setItem('deliWarsPlayerId', newPlayerId);
      setPlayerId(newPlayerId);
    }
  }, []);

  // Create a new game
  const createGame = async (playerName) => {
    try {
      setLoading(true);

      // Get user ID
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        return { success: false, error: 'Authentication required' };
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

      // Store player ID in localStorage
      localStorage.setItem(`player_${game.id}`, player.id);
      localStorage.setItem('deliWarsCurrentGame', game.id);
      setPlayerId(player.id);

      // Set state
      setCurrentGame(game);
      setPlayer(player);

      return { success: true, gameId: game.id };
    } catch (error) {
      console.error('Error in createGame:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Join an existing game
  const joinGame = async (gameId, playerName = null) => {
    if (!playerId) return { success: false, error: new Error('No player ID') };
    if (!gameId)
      return { success: false, error: new Error('No game ID provided') };

    try {
      setLoading(true);

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
        .eq('user_id', playerId)
        .maybeSingle();

      if (existingPlayer) {
        // Already in game, just return the player
        setCurrentGame(game);
        setPlayer(existingPlayer);

        localStorage.setItem('deliWarsCurrentGame', game.id);
        localStorage.setItem('deliWarsPlayerName', existingPlayer.username);

        return { success: true, gameId, existing: true };
      }

      // Use provided player name or generate one
      const username = playerName || 'Player';

      // Initialize player
      const newPlayerId = await initializePlayer(
        gameId,
        playerId,
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

      setCurrentGame(game);
      setPlayer(playerData);

      localStorage.setItem('deliWarsCurrentGame', game.id);
      localStorage.setItem('deliWarsPlayerName', username);

      return { success: true, gameId };
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Load game data
  const loadGame = async (gameId) => {
    if (!gameId) return { success: false };

    try {
      setGameLoading(true);

      // Get game-specific player ID if available
      const gameSpecificPlayerId = localStorage.getItem(`player_${gameId}`);
      const playerIdToUse = gameSpecificPlayerId || playerId;

      // If we found a game-specific ID that's different, update state
      if (gameSpecificPlayerId && gameSpecificPlayerId !== playerId) {
        setPlayerId(gameSpecificPlayerId);
      }

      if (!playerIdToUse) {
        console.error('No player ID available for this game');
        return { success: false, needsJoin: true };
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

      // Update state
      setCurrentGame(gameResult.data);
      setPlayer(playerWithBorough);
      setPlayers(allPlayersResult.data || []);
      setPlayerInventory(inventoryResult.data || []);

      localStorage.setItem('deliWarsCurrentGame', gameId);

      return {
        success: true,
        game: gameResult.data,
        player: playerWithBorough,
      };
    } catch (error) {
      console.error('Error loading game:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setGameLoading(false);
    }
  };

  // Start game
  const startGame = async (gameId) => {
    if (!gameId) return { success: false };

    try {
      setLoading(true);

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

      // Update local state
      if (currentGame && currentGame.id === gameId) {
        setCurrentGame({
          ...currentGame,
          status: 'active',
          current_hour: 24,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Refresh player data
  const refreshPlayerData = useCallback(async () => {
    if (!player?.id) return false;

    try {
      // Fetch updated player data with borough information
      const { data, error } = await supabase
        .from('players')
        .select(
          `
          *,
          boroughs:current_borough_id (id, name)
        `
        )
        .eq('id', player.id)
        .single();

      if (error) {
        console.error('Error refreshing player data:', error);
        return false;
      }

      // Format the data to include current_borough as string
      const playerWithBorough = {
        ...data,
        current_borough: data.boroughs?.name || 'Unknown Location',
        current_borough_id: data.current_borough_id,
      };

      // Update player state
      setPlayer(playerWithBorough);

      return true;
    } catch (error) {
      console.error('Error in refreshPlayerData:', error);
      return false;
    }
  }, [player?.id]);

  // Replace the getPlayerActions function with this simpler version
  const getActionsRemaining = useCallback(() => {
    if (!player) return 0;
    const maxActionsPerHour = 4; // Could be moved to a game setting
    return maxActionsPerHour - (player.actions_used_this_hour || 0);
  }, [player]);

  // Replace your useAction function with this
  const useActions = async (actionCount) => {
    if (!player || !currentGame) return { success: false };

    const actionsRemaining = getActionsRemaining();
    if (actionsRemaining < actionCount) {
      return {
        success: false,
        message: `Not enough actions (need ${actionCount}, have ${actionsRemaining})`,
      };
    }

    // Update the player's actions used
    const { data, error } = await supabase
      .from('players')
      .update({
        actions_used_this_hour:
          (player.actions_used_this_hour || 0) + actionCount,
      })
      .eq('id', player.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating actions used:', error);
      return { success: false, error };
    }

    // Update local state
    setPlayer(data);
    return { success: true };
  };

  // Advance game hour function
  const advanceGameHour = async () => {
    if (!currentGame) return { success: false };

    // First update the game's current hour (DECREASING it because we're counting down)
    const newHour = currentGame.current_hour - 1;
    const { error: gameError } = await supabase
      .from('games')
      .update({ current_hour: newHour })
      .eq('id', currentGame.id);

    if (gameError) {
      console.error('Error advancing game hour:', gameError);
      return { success: false, error: gameError };
    }

    // Get any overflow actions from previous hour
    const { data: playerData } = await supabase
      .from('players')
      .select('actions_overflow')
      .eq('id', player.id)
      .single();

    const overflowActions = playerData?.actions_overflow || 0;

    // Reset player's actions but apply overflow
    const { error: playerError } = await supabase
      .from('players')
      .update({
        actions_used_this_hour: overflowActions,
        actions_overflow: 0, // Reset overflow after applying it
      })
      .eq('id', player.id);

    if (playerError) {
      console.error('Error resetting player actions:', playerError);
      return { success: false, error: playerError };
    }

    // Refresh the game and player data
    await refreshPlayerData();

    // Update local game state
    setCurrentGame({
      ...currentGame,
      current_hour: newHour,
    });

    return { success: true };
  };

  // Update your travelToNeighborhood function
  const travelToNeighborhood = async (neighborhoodId, transportationId) => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);

      // Get the action cost for this travel option
      const { data: transportOptions } = await supabase
        .from('transportation_options')
        .select('action_cost, monetary_cost')
        .eq('player_id', player.id)
        .eq('transportation_id', transportationId)
        .eq('to_borough_id', neighborhoodId)
        .maybeSingle();

      const actionCost = transportOptions?.action_cost || 1;
      const moneyCost = transportOptions?.monetary_cost || 0;

      // Check if player has enough money
      if (player.cash < moneyCost) {
        setLoading(false);
        return {
          success: false,
          message: `Not enough money. Travel costs $${moneyCost} but you only have $${player.cash}.`,
        };
      }

      // Handle action cost with the generic function
      const result = await attemptAction(actionCost, async () => {
        // Update player's location and money
        const { error: updateError } = await supabase
          .from('players')
          .update({
            current_borough_id: neighborhoodId,
            cash: player.cash - moneyCost,
          })
          .eq('id', player.id);

        if (updateError) {
          console.error('Error updating player location:', updateError);
          return { success: false, error: updateError };
        }

        // Record transaction if needed
        if (moneyCost > 0) {
          // Transaction logic here...
        }

        // Refresh player data
        await refreshPlayerData();
        return { success: true };
      });

      setLoading(false);
      return result;
    } catch (error) {
      console.error('Error traveling to borough:', error);
      setLoading(false);
      return { success: false, error };
    }
  };

  // Fetch game data
  const fetchGameData = useCallback(async () => {
    if (!currentGame?.id || !player?.id) return false;

    try {
      // Load data in parallel
      const [gameData, playerData, inventoryData] = await Promise.all([
        // Game data
        supabase.from('games').select('*').eq('id', currentGame.id).single(),

        // Player data with borough
        supabase
          .from('players')
          .select('*, boroughs:current_borough_id (id, name)')
          .eq('id', player.id)
          .single(),

        // Inventory data
        supabase
          .from('player_inventory')
          .select('*, products:product_id (name, description)')
          .eq('player_id', player.id),
      ]);

      if (gameData.error || playerData.error) {
        console.error(
          'Error fetching data:',
          gameData.error || playerData.error
        );
        return false;
      }

      // Format player data
      const playerWithBorough = {
        ...playerData.data,
        current_borough: playerData.data.boroughs?.name || 'Unknown Location',
      };

      // Update state
      setCurrentGame(gameData.data);
      setPlayer(playerWithBorough);
      setPlayerInventory(inventoryData.data || []);

      return true;
    } catch (error) {
      console.error('Error in fetchGameData:', error);
      return false;
    }
  }, [currentGame?.id, player?.id]);

  // End turn
  const endTurn = async () => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);

      // Check if all players have completed their turns
      const { data: activePlayers, error: playersError } = await supabase
        .from('players')
        .select('id, turn_completed')
        .eq('game_id', currentGame.id);

      if (playersError) throw playersError;

      // Mark this player's turn as completed
      const { error: updateError } = await supabase
        .from('players')
        .update({ turn_completed: true })
        .eq('id', player.id);

      if (updateError) throw updateError;

      // Check if all players have completed their turn
      const allCompleted = activePlayers.every(
        (p) => p.id === player.id || p.turn_completed === true
      );

      if (allCompleted) {
        // Decrease hours remaining
        const nextHour = currentGame.current_hour - 1;
        const gameOver = nextHour <= 0;

        // Update game status
        const { data: updatedGame, error: gameError } = await supabase
          .from('games')
          .update({
            current_hour: nextHour,
            current_player_id: null,
            status: gameOver ? 'completed' : 'active',
            ended_at: gameOver ? new Date().toISOString() : null,
          })
          .eq('id', currentGame.id)
          .select()
          .single();

        if (gameError) throw gameError;

        // Reset all players' turn_completed flags
        const { error: resetError } = await supabase
          .from('players')
          .update({ turn_completed: false })
          .eq('game_id', currentGame.id);

        if (resetError) throw resetError;

        // Update local state immediately
        setCurrentGame(updatedGame);

        if (gameOver) {
          toast.success('Game over! Final results are in.');
        } else {
          toast.success(`Time passing... ${nextHour} hours remaining`);
        }
      } else {
        toast.success('Turn completed, waiting for other players');
      }

      // Immediately fetch updated data to refresh UI
      await fetchGameData();

      return { success: true };
    } catch (error) {
      console.error('Error ending turn:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Check for stored game on mount
  useEffect(() => {
    const storedGameId = localStorage.getItem('deliWarsCurrentGame');
    if (storedGameId && playerId) {
      loadGame(storedGameId);
    }
  }, [playerId]);

  // Update buyProduct to use the attemptActionWithCost utility
  const buyProduct = async (productId, quantity, storeId, neighborhoodId) => {
    try {
      setLoading(true);

      if (!player || !currentGame) {
        return { success: false, error: new Error('Game or player not found') };
      }

      // Assume buying costs 1 action (adjust as needed)
      const actionCost = 1;

      return await attemptAction(actionCost, async () => {
        const result = await buyRecord(
          player.id,
          currentGame.id,
          storeId,
          productId,
          quantity
        );

        if (result.success) {
          await fetchGameData();
          toast.success('Purchase successful!');
        } else {
          toast.error(result.message || 'Purchase failed');
        }

        return result;
      });
    } catch (error) {
      console.error('Error in buyProduct:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Update sellProduct similarly
  const sellProduct = async (inventoryItemId, quantity, storeId) => {
    try {
      setLoading(true);

      if (!player || !currentGame) {
        return { success: false, error: new Error('Game or player not found') };
      }

      // First get the product ID from the inventory item
      const inventoryItem =
        playerInventory.find((item) => item.id === inventoryItemId) ||
        (
          await supabase
            .from('player_inventory')
            .select('product_id')
            .eq('id', inventoryItemId)
            .single()
        ).data;

      if (!inventoryItem) {
        return { success: false, error: new Error('Inventory item not found') };
      }

      // Use action economy system
      return await attemptAction(1, async () => {
        const result = await sellRecord(
          player.id,
          currentGame.id,
          storeId,
          inventoryItem.product_id,
          quantity
        );

        if (result) {
          await fetchGameData(); // Refresh data if successful
          toast.success('Sale successful!');
          return { success: true };
        } else {
          toast.error('Sale failed');
          return { success: false };
        }
      });
    } catch (error) {
      console.error('Error in sellProduct:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // THE CORE ACTION ECONOMY SYSTEM - KEEP THIS INTACT
  const attemptAction = async (actionCost, performAction) => {
    if (!player || !currentGame) return { success: false };

    const actionsRemaining = getActionsRemaining();

    // If player has enough actions, simply use them and perform the action
    if (actionsRemaining >= actionCost) {
      // Use actions
      const { success: actionsSuccess } = await useActions(actionCost);
      if (!actionsSuccess) {
        return { success: false, message: 'Failed to use actions' };
      }

      // Perform the action
      return await performAction();
    }
    // Not enough actions - need to handle overflow
    else {
      // Calculate overflow
      const overflow = actionCost - actionsRemaining;

      // Ask if player wants to advance hour
      const shouldAdvance = window.confirm(
        `You only have ${actionsRemaining} actions, but need ${actionCost}. ` +
          `Would you like to advance to the next hour? ` +
          `(${overflow} actions will be deducted from your next hour's actions)`
      );

      if (!shouldAdvance) {
        return { success: false, message: 'Action canceled' };
      }

      // Use whatever actions remain in this hour
      if (actionsRemaining > 0) {
        await useActions(actionsRemaining);
      }

      // Store overflow amount for next hour
      await supabase
        .from('players')
        .update({ actions_overflow: overflow })
        .eq('id', player.id);

      // Advance hour
      const { success } = await advanceGameHour();
      if (!success) {
        return { success: false, message: "Couldn't advance to next hour" };
      }

      // Now perform the action (it's already "paid for" with the overflow)
      return await performAction();
    }
  };

  // Add this function to your GameContext if it doesn't exist already
  const refreshPlayerInventory = async () => {
    if (!player?.id || !currentGame?.id) return;

    try {
      const { data, error } = await supabase
        .from('player_inventory_view')
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
        .eq('player_id', player.id)
        .eq('game_id', currentGame.id);

      if (error) throw error;
      setPlayerInventory(data || []);
    } catch (error) {
      console.error('Error refreshing player inventory:', error);
    }
  };

  return (
    <GameContext.Provider
      value={{
        currentGame,
        player,
        playerInventory,
        players,
        loading,
        gameLoading,
        createGame,
        joinGame,
        loadGame,
        startGame,
        buyProduct,
        sellProduct,
        travelToNeighborhood,
        endTurn,
        playerId,
        fetchGameData,
        refreshPlayerData,
        confirmationOpen,
        confirmationProps,
        pendingAction,
        getActionsRemaining,
        useActions,
        advanceGameHour,
        refreshPlayerInventory,
      }}
    >
      {children}
      <ConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        title={confirmationProps.title}
        message={confirmationProps.message}
        onConfirm={() => {
          if (confirmationProps.onConfirm) confirmationProps.onConfirm();
        }}
        confirmText={confirmationProps.confirmText}
        cancelText={confirmationProps.cancelText}
      />
    </GameContext.Provider>
  );
};

export default GameContext;
