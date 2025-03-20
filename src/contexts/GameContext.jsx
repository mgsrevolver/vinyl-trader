import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
import * as gameAPI from '../services/gameAPI';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const navigate = useNavigate();
  // Core state
  const [currentGame, setCurrentGame] = useState(null);
  const [player, setPlayer] = useState(null);
  const [playerInventory, setPlayerInventory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
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

  // Check for stored game on mount
  useEffect(() => {
    const storedGameId = localStorage.getItem('deliWarsCurrentGame');
    if (storedGameId && playerId) {
      loadGame(storedGameId);
    }
  }, [playerId]);

  // Unified data fetching
  const fetchGameData = useCallback(async () => {
    if (!currentGame?.id || !player?.id) return false;

    try {
      const [gameData, playerData, inventoryData] = await Promise.all([
        gameAPI.fetchGame(currentGame.id),
        gameAPI.fetchPlayerWithBorough(player.id),
        gameAPI.fetchPlayerInventory(player.id),
      ]);

      if (!gameData || !playerData) {
        console.error('Error fetching data');
        return false;
      }

      // Format player data
      const playerWithBorough = {
        ...playerData,
        current_borough: playerData.boroughs?.name || 'Unknown Location',
      };

      // Update state
      setCurrentGame(gameData);
      setPlayer(playerWithBorough);
      setPlayerInventory(inventoryData || []);

      return true;
    } catch (error) {
      console.error('Error in fetchGameData:', error);
      return false;
    }
  }, [currentGame?.id, player?.id]);

  // Refresh player data
  const refreshPlayerData = useCallback(async () => {
    if (!player?.id) return false;

    try {
      const data = await gameAPI.fetchPlayerWithBorough(player.id);
      if (!data) return false;

      // Format the data
      const playerWithBorough = {
        ...data,
        current_borough: data.boroughs?.name || 'Unknown Location',
        current_borough_id: data.current_borough_id,
      };

      setPlayer(playerWithBorough);
      return true;
    } catch (error) {
      console.error('Error in refreshPlayerData:', error);
      return false;
    }
  }, [player?.id]);

  // Refresh player inventory
  const refreshPlayerInventory = useCallback(async () => {
    if (!player?.id) return false;

    try {
      const inventory = await gameAPI.fetchPlayerInventory(player.id);
      setPlayerInventory(inventory || []);
      return true;
    } catch (error) {
      console.error('Error refreshing player inventory:', error);
      return false;
    }
  }, [player?.id]);

  // Action economy helpers
  const getActionsRemaining = useCallback(() => {
    if (!player) return 0;
    const maxActionsPerHour = 4; // Could be moved to a game setting
    return maxActionsPerHour - (player.actions_used_this_hour || 0);
  }, [player]);

  const useActions = useCallback(
    async (actionCount) => {
      if (!player || !currentGame) return { success: false };

      const actionsRemaining = getActionsRemaining();
      if (actionsRemaining < actionCount) {
        return {
          success: false,
          message: `Not enough actions (need ${actionCount}, have ${actionsRemaining})`,
        };
      }

      // Update the player's actions used
      const data = await gameAPI.updatePlayerActions(
        player.id,
        (player.actions_used_this_hour || 0) + actionCount
      );

      if (!data) {
        return { success: false, error: 'Failed to update actions' };
      }

      // Update local state
      setPlayer(data);
      return { success: true };
    },
    [player, currentGame, getActionsRemaining]
  );

  // Advance game hour
  const advanceGameHour = useCallback(async () => {
    if (!currentGame || !player?.id) return { success: false };

    const newHour = currentGame.current_hour - 1;
    const success = await gameAPI.advanceGameHour(
      currentGame.id,
      newHour,
      player.id
    );

    if (!success) {
      return { success: false };
    }

    // Refresh data
    await refreshPlayerData();

    // Update local game state
    setCurrentGame((prev) => ({
      ...prev,
      current_hour: newHour,
    }));

    return { success: true };
  }, [currentGame, player?.id, refreshPlayerData]);

  // Core action economy system
  const attemptAction = useCallback(
    async (actionCost, performAction) => {
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
      // Not enough actions - handle overflow
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
        await gameAPI.setPlayerOverflow(player.id, overflow);

        // Advance hour
        const { success } = await advanceGameHour();
        if (!success) {
          return { success: false, message: "Couldn't advance to next hour" };
        }

        // Now perform the action (it's already "paid for" with the overflow)
        return await performAction();
      }
    },
    [player, currentGame, getActionsRemaining, useActions, advanceGameHour]
  );

  // Create game
  const createGame = async (playerName) => {
    try {
      setLoading(true);
      const result = await gameAPI.createGame(playerName);

      if (!result.success) {
        return result;
      }

      // Store IDs
      localStorage.setItem(`player_${result.gameId}`, result.playerId);
      localStorage.setItem('deliWarsCurrentGame', result.gameId);
      setPlayerId(result.playerId);

      // Set state
      setCurrentGame(result.game);
      setPlayer(result.player);

      return result;
    } catch (error) {
      console.error('Error in createGame:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Join game
  const joinGame = async (gameId, playerName = null) => {
    if (!playerId) return { success: false, error: new Error('No player ID') };
    if (!gameId)
      return { success: false, error: new Error('No game ID provided') };

    try {
      setLoading(true);
      const result = await gameAPI.joinGame(gameId, playerId, playerName);

      if (!result.success) {
        toast.error(result.error?.message || 'Failed to join game');
        return result;
      }

      // Store info
      localStorage.setItem('deliWarsCurrentGame', gameId);
      if (result.playerName) {
        localStorage.setItem('deliWarsPlayerName', result.playerName);
      }

      // Update state
      setCurrentGame(result.game);
      setPlayer(result.player);

      return result;
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

      const result = await gameAPI.loadGame(gameId, playerIdToUse);

      if (result.needsJoin) {
        return result;
      }

      if (!result.success) {
        toast.error('Error loading game');
        return result;
      }

      // Update state
      setCurrentGame(result.game);
      setPlayer(result.player);
      setPlayers(result.allPlayers || []);
      setPlayerInventory(result.inventory || []);

      localStorage.setItem('deliWarsCurrentGame', gameId);

      return result;
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
      const success = await gameAPI.startGame(gameId);

      if (!success) {
        toast.error('Failed to start game');
        return { success: false };
      }

      // Update local state
      if (currentGame && currentGame.id === gameId) {
        setCurrentGame((prev) => ({
          ...prev,
          status: 'active',
          current_hour: 24,
        }));
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

  // Travel to neighborhood
  const travelToNeighborhood = async (neighborhoodId, transportationId) => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);

      // Get travel costs
      const travelInfo = await gameAPI.getTravelInfo(
        player.id,
        transportationId,
        neighborhoodId
      );

      if (!travelInfo) {
        setLoading(false);
        return { success: false, message: "Couldn't get travel information" };
      }

      // Check if player has enough money
      if (player.cash < travelInfo.monetary_cost) {
        setLoading(false);
        return {
          success: false,
          message: `Not enough money. Travel costs $${travelInfo.monetary_cost} but you only have $${player.cash}.`,
        };
      }

      // Handle action cost with the generic function
      return await attemptAction(travelInfo.action_cost, async () => {
        const success = await gameAPI.movePlayer(
          player.id,
          neighborhoodId,
          player.cash - travelInfo.monetary_cost
        );

        if (!success) {
          return { success: false, message: 'Failed to travel' };
        }

        // Refresh player data
        await refreshPlayerData();
        return { success: true };
      });
    } catch (error) {
      console.error('Error traveling to borough:', error);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Buy product
  const buyProduct = async (productId, quantity, storeId, neighborhoodId) => {
    try {
      setLoading(true);

      if (!player || !currentGame) {
        return { success: false, error: new Error('Game or player not found') };
      }

      // Assume buying costs 1 action
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

  // Sell product
  const sellProduct = async (inventoryItemId, quantity, storeId) => {
    try {
      setLoading(true);

      if (!player || !currentGame) {
        return { success: false, error: new Error('Game or player not found') };
      }

      // Find the product ID
      const inventoryItem =
        playerInventory.find((item) => item.id === inventoryItemId) ||
        (await gameAPI.getInventoryItem(inventoryItemId));

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

  // End turn
  const endTurn = async () => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);
      const result = await gameAPI.endPlayerTurn(player.id, currentGame.id);

      if (!result.success) {
        toast.error('Failed to end turn');
        return result;
      }

      if (result.allCompleted) {
        // Game state was updated on server
        if (result.gameOver) {
          toast.success('Game over! Final results are in.');
        } else {
          toast.success(`Time passing... ${result.nextHour} hours remaining`);
        }
      } else {
        toast.success('Turn completed, waiting for other players');
      }

      // Refresh data
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

  // Calculate total inventory
  const inventoryCount =
    playerInventory?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  if (!currentGame || !player) return null;

  // Calculate net worth (cash + inventory value - loan)
  const getNetWorth = useCallback(() => {
    if (!player) return 0;

    // Calculate total inventory value
    const totalInventoryValue = playerInventory.reduce((sum, item) => {
      return (
        sum +
        (item.estimated_current_price || item.purchase_price || 0) *
          (item.quantity || 0)
      );
    }, 0);

    // Get player cash and loan amounts
    const cashAmount = player.cash || 0;
    const loanAmount = player.loan_amount || 0;

    // Calculate net worth
    return cashAmount + totalInventoryValue - loanAmount;
  }, [player, playerInventory]);

  // Get total inventory value for display purposes
  const getInventoryValue = useCallback(() => {
    if (!playerInventory || playerInventory.length === 0) return 0;

    return playerInventory.reduce((sum, item) => {
      return (
        sum +
        (item.estimated_current_price || item.purchase_price || 0) *
          (item.quantity || 0)
      );
    }, 0);
  }, [playerInventory]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
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
      getNetWorth,
      getInventoryValue,
    }),
    [
      currentGame,
      player,
      playerInventory,
      players,
      loading,
      gameLoading,
      playerId,
      confirmationOpen,
      confirmationProps,
      pendingAction,
      getActionsRemaining,
      useActions,
      advanceGameHour,
      refreshPlayerData,
      fetchGameData,
      refreshPlayerInventory,
      getNetWorth,
      getInventoryValue,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>
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
