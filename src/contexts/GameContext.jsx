// src/contexts/GameContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generatePlayerName, generateGameName } from '../lib/nameGenerator';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import {
  initializePlayer,
  createNewGame,
  initializeGameMarket,
  travelToBorough,
} from '../lib/gameActions';

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

  function generateUUID() {
    // This is RFC4122 version 4 compliant
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

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
      console.log('Using game-specific playerId:', gameSpecificPlayerId);
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
      console.log('Using stored playerId:', storedPlayerId);
      setPlayerId(storedPlayerId);
    } else {
      const newPlayerId = uuidv4();
      console.log('Creating new playerId:', newPlayerId);
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

      // STEP 1: Create the game directly
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          name: `${playerName}'s Game`,
          created_by: userId,
          status: 'active', // Set as active immediately
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
        // Clean up the game
        await supabase.from('games').delete().eq('id', game.id);
        return { success: false, error: playerError };
      }

      // STEP 4: Call stored procedures - but don't wait for them
      supabase
        .rpc('initialize_game_data', { game_id: game.id })
        .then(() => console.log('Game data initialized'))
        .catch((err) => console.error('Error initializing game data:', err));

      // IMPORTANT: Store the player ID in localStorage so Game.jsx can find it
      localStorage.setItem(`player_${game.id}`, player.id);
      localStorage.setItem('deliWarsCurrentGame', game.id);

      // Set player ID in state to match what we stored
      setPlayerId(player.id);

      // Immediately set current game and player to avoid UI loading issues
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

      // First get a default starting borough
      let defaultBoroughId = null;
      try {
        const { data: borough } = await supabase
          .from('boroughs')
          .select('id')
          .limit(1)
          .single();

        if (borough) {
          defaultBoroughId = borough.id;
          console.log('Using default borough for joining:', defaultBoroughId);
        }
      } catch (boroughErr) {
        console.error('Could not fetch a default borough:', boroughErr);
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
      const username = playerName || generatePlayerName();

      // Use the initializePlayer function to create the player with correct values
      const newPlayerId = await initializePlayer(
        gameId,
        playerId,
        defaultBoroughId
      );

      if (!newPlayerId) {
        throw new Error('Failed to initialize player');
      }

      // Now fetch the created player data
      const { data: playerData, error: playerFetchError } = await supabase
        .from('players')
        .select('*')
        .eq('id', newPlayerId)
        .single();

      if (playerFetchError) throw playerFetchError;

      // Update the username separately since initializePlayer doesn't set it
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
        console.log(
          'Updating playerId to game-specific ID:',
          gameSpecificPlayerId
        );
        setPlayerId(gameSpecificPlayerId);
      }

      if (!playerIdToUse) {
        console.error('No player ID available for this game');
        return { success: false, needsJoin: true };
      }

      // Load game data
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      // Load player data using playerIdToUse directly instead of user_id
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerIdToUse)
        .single();

      if (playerError) {
        console.error('Player not found with ID:', playerIdToUse);
        return { success: false, needsJoin: true, game };
      }

      // Load all players in game
      const { data: allPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId);

      // Load player inventory
      const { data: inventory } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          products:product_id (
            name,
            description
          )
        `
        )
        .eq('player_id', playerData.id);

      setCurrentGame(game);
      setPlayer(playerData);
      setPlayers(allPlayers || []);
      setPlayerInventory(inventory || []);

      localStorage.setItem('deliWarsCurrentGame', game.id);

      return { success: true, game, player: playerData };
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

  // Transaction functions (buy, sell)
  const buyProduct = async (productId, quantity, storeId, neighborhoodId) => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);

      // Get product from market inventory
      const { data: marketItem, error: marketError } = await supabase
        .from('market_inventory')
        .select('*')
        .eq('game_id', currentGame.id)
        .eq('neighborhood_id', neighborhoodId)
        .eq('product_id', productId)
        .eq('store_id', storeId)
        .single();

      if (marketError) throw marketError;

      if (!marketItem || marketItem.quantity < quantity) {
        throw new Error('Not enough inventory available');
      }

      const totalCost = marketItem.current_price * quantity;

      if (player.cash < totalCost) {
        throw new Error('Not enough cash');
      }

      // Check if player already has this product in inventory
      const { data: existingItem } = await supabase
        .from('player_inventory')
        .select('*')
        .eq('player_id', player.id)
        .eq('product_id', productId)
        .maybeSingle();

      // Start a transaction
      // 1. Update player cash
      const { data: updatedPlayer, error: playerError } = await supabase
        .from('players')
        .update({ cash: player.cash - totalCost })
        .eq('id', player.id)
        .select()
        .single();

      if (playerError) throw playerError;

      // 2. Update market inventory
      const { error: marketUpdateError } = await supabase
        .from('market_inventory')
        .update({ quantity: marketItem.quantity - quantity })
        .eq('id', marketItem.id);

      if (marketUpdateError) throw marketUpdateError;

      // 3. Update or insert player inventory
      if (existingItem) {
        // Update existing inventory item
        const { error: inventoryError } = await supabase
          .from('player_inventory')
          .update({
            quantity: existingItem.quantity + quantity,
            // Weighted average for purchase price
            purchase_price:
              (existingItem.purchase_price * existingItem.quantity +
                totalCost) /
              (existingItem.quantity + quantity),
          })
          .eq('id', existingItem.id);

        if (inventoryError) throw inventoryError;
      } else {
        // Create new inventory item
        const { error: inventoryError } = await supabase
          .from('player_inventory')
          .insert({
            player_id: player.id,
            product_id: productId,
            quantity: quantity,
            purchase_price: marketItem.current_price,
          });

        if (inventoryError) throw inventoryError;
      }

      // 4. Record transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          game_id: currentGame.id,
          player_id: player.id,
          product_id: productId,
          neighborhood_id: neighborhoodId,
          transaction_type: 'buy',
          quantity: quantity,
          price: marketItem.current_price,
          hour: currentGame.current_hour,
        });

      if (transactionError) throw transactionError;

      // Update local state
      setPlayer(updatedPlayer);

      // Reload inventory
      const { data: inventory } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          products:product_id (
            name,
            description
          )
        `
        )
        .eq('player_id', player.id);

      setPlayerInventory(inventory || []);

      toast.success(`Bought ${quantity} items for $${totalCost.toFixed(2)}`);
      return { success: true };
    } catch (error) {
      console.error('Error buying product:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  const sellProduct = async (inventoryItemId, quantity, neighborhoodId) => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);

      // Get inventory item
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          products:product_id (*)
        `
        )
        .eq('id', inventoryItemId)
        .single();

      if (inventoryError) throw inventoryError;

      if (!inventoryItem || inventoryItem.quantity < quantity) {
        throw new Error('Not enough items in inventory');
      }

      // Get current price in neighborhood
      const { data: marketItem, error: marketError } = await supabase
        .from('market_inventory')
        .select('*')
        .eq('game_id', currentGame.id)
        .eq('neighborhood_id', neighborhoodId)
        .eq('product_id', inventoryItem.product_id)
        .single();

      if (marketError) throw marketError;

      const salePrice = marketItem.current_price;
      const totalValue = salePrice * quantity;

      // Start a transaction
      // 1. Update player cash
      const { data: updatedPlayer, error: playerError } = await supabase
        .from('players')
        .update({ cash: player.cash + totalValue })
        .eq('id', player.id)
        .select()
        .single();

      if (playerError) throw playerError;

      // 2. Update market inventory
      const { error: marketUpdateError } = await supabase
        .from('market_inventory')
        .update({ quantity: marketItem.quantity + quantity })
        .eq('id', marketItem.id);

      if (marketUpdateError) throw marketUpdateError;

      // 3. Update player inventory
      if (inventoryItem.quantity === quantity) {
        // Remove item entirely
        const { error: removeError } = await supabase
          .from('player_inventory')
          .delete()
          .eq('id', inventoryItemId);

        if (removeError) throw removeError;
      } else {
        // Decrease quantity
        const { error: updateError } = await supabase
          .from('player_inventory')
          .update({ quantity: inventoryItem.quantity - quantity })
          .eq('id', inventoryItemId);

        if (updateError) throw updateError;
      }

      // 4. Record transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          game_id: currentGame.id,
          player_id: player.id,
          product_id: inventoryItem.product_id,
          neighborhood_id: neighborhoodId,
          transaction_type: 'sell',
          quantity: quantity,
          price: salePrice,
          hour: currentGame.current_hour,
        });

      if (transactionError) throw transactionError;

      // Update local state
      setPlayer(updatedPlayer);

      // Reload inventory
      const { data: inventory } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          products:product_id (
            name,
            description
          )
        `
        )
        .eq('player_id', player.id);

      setPlayerInventory(inventory || []);

      toast.success(`Sold ${quantity} items for $${totalValue.toFixed(2)}`);
      return { success: true };
    } catch (error) {
      console.error('Error selling product:', error);
      toast.error(`Error: ${error.message}`);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Add this function to refresh player data
  const refreshPlayerData = async () => {
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

      console.log('Got fresh player data:', data);

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
  };

  // Modify travelToNeighborhood to use the travelToBorough function
  const travelToNeighborhood = async (neighborhoodId, transportationId) => {
    if (!player || !currentGame) return { success: false };

    try {
      setLoading(true);

      console.log('Attempting travel to neighborhood:', neighborhoodId);

      // FIRST: Check the action cost for this travel
      // Get the current borough and transportation method
      const fromBoroughId = player.current_borough_id;

      // Get the borough distance record to determine action cost
      const { data: distanceData, error: distanceError } = await supabase
        .from('borough_distances')
        .select('*')
        .eq('from_borough_id', fromBoroughId)
        .eq('to_borough_id', neighborhoodId)
        .single();

      if (distanceError) {
        console.error('Error getting borough distance:', distanceError);
        throw new Error('Could not determine travel distance');
      }

      // Get the transportation method details
      const { data: transportData, error: transportError } = await supabase
        .from('transportation_methods')
        .select('*')
        .eq('id', transportationId)
        .single();

      if (transportError) {
        console.error('Error getting transportation details:', transportError);
        throw new Error('Could not determine transportation details');
      }

      // Get player's current actions
      const { data: actionsData, error: actionsError } = await supabase
        .from('player_actions')
        .select('*')
        .eq('player_id', player.id)
        .eq('game_id', currentGame.id)
        .eq('hour', currentGame.current_hour)
        .single();

      // If no actions data is found, create a new record or use default values
      let remainingActions = 0;
      let actionCost = 0;

      // Determine action cost first based on transportation type
      if (transportData.name.toLowerCase().includes('walk')) {
        actionCost = distanceData.walking_time;
      } else if (transportData.name.toLowerCase().includes('subway')) {
        actionCost = distanceData.subway_time;
      } else if (transportData.name.toLowerCase().includes('taxi')) {
        actionCost = distanceData.taxi_time;
      } else if (transportData.name.toLowerCase().includes('bike')) {
        actionCost = distanceData.bike_time;
      } else {
        // Default to walking time if can't determine
        actionCost = distanceData.walking_time;
      }

      // If we couldn't fetch player actions, try to create a new record
      if (actionsError || !actionsData) {
        console.log(
          'No player actions found, creating new record or using defaults'
        );

        try {
          // Try to create a new player_actions record
          const { data: newActionRecord, error: createError } = await supabase
            .from('player_actions')
            .insert({
              player_id: player.id,
              game_id: currentGame.id,
              hour: currentGame.current_hour,
              actions_used: 0,
              actions_available: 4,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating player actions record:', createError);
            // Use default values
            remainingActions = 4;
          } else if (newActionRecord) {
            remainingActions =
              newActionRecord.actions_available - newActionRecord.actions_used;
          } else {
            remainingActions = 4; // Fallback to default
          }
        } catch (err) {
          console.error('Error handling player actions:', err);
          remainingActions = 4; // Fallback to default
        }
      } else {
        // Calculate remaining actions from fetched data
        remainingActions =
          actionsData.actions_available - actionsData.actions_used;
      }

      // Check if enough actions are available
      if (remainingActions < actionCost) {
        // Ask user for confirmation that this will advance their turn
        if (
          window.confirm(
            `This trip requires ${actionCost} actions, but you only have ${remainingActions} remaining. Continue and advance to the next turn?`
          )
        ) {
          console.log('User confirmed to advance turn and continue travel');

          // Call endTurn first
          const endTurnResult = await endTurn();

          if (!endTurnResult.success) {
            console.error('Failed to end turn:', endTurnResult.error);
            throw new Error('Failed to advance to next turn');
          }

          console.log('Turn advanced successfully');

          // Brief delay to allow turn to advance
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Refresh game data to get new hour
          await fetchGameData();

          // Get the new hour
          const { data: updatedGame } = await supabase
            .from('games')
            .select('current_hour')
            .eq('id', currentGame.id)
            .single();

          if (updatedGame) {
            console.log('New game hour:', updatedGame.current_hour);

            // Ensure player_actions record exists for this new hour
            const { data: newHourActions, error: newActionsError } =
              await supabase
                .from('player_actions')
                .select('*')
                .eq('player_id', player.id)
                .eq('game_id', currentGame.id)
                .eq('hour', updatedGame.current_hour)
                .single();

            if (newActionsError || !newHourActions) {
              console.log('Creating fresh player_actions for new hour');

              // Create new player_actions for the new hour
              await supabase.from('player_actions').insert({
                player_id: player.id,
                game_id: currentGame.id,
                hour: updatedGame.current_hour,
                actions_used: 0,
                actions_available: 4,
              });
            }

            // Directly update player location on client-side instead of using the RPC
            console.log('Implementing client-side travel as fallback');

            try {
              // Get transportation cost from stored data
              let transportCost = 0;
              if (transportData.name.toLowerCase().includes('taxi')) {
                transportCost = distanceData.taxi_cost;
              } else if (
                !transportData.name.toLowerCase().includes('walk') &&
                !transportData.name.toLowerCase().includes('bike')
              ) {
                transportCost = transportData.base_cost;
              }

              // 1. Update player cash and location
              const { data: updatedPlayer, error: playerUpdateError } =
                await supabase
                  .from('players')
                  .update({
                    cash: player.cash - transportCost,
                    current_borough_id: neighborhoodId,
                  })
                  .eq('id', player.id)
                  .select()
                  .single();

              if (playerUpdateError) {
                throw playerUpdateError;
              }

              // 2. Record transportation (ignore if it fails with unique violation)
              try {
                await supabase.from('player_transportation').insert({
                  player_id: player.id,
                  transportation_id: transportationId,
                  unlocked_at: new Date().toISOString(),
                  active: true,
                });
              } catch (err) {
                console.log('Transportation record already exists, continuing');
              }

              // 3. Record transaction if needed
              if (transportCost > 0) {
                await supabase.from('transactions').insert({
                  game_id: currentGame.id,
                  player_id: player.id,
                  quantity: 1,
                  price: transportCost,
                  hour: updatedGame.current_hour,
                  transaction_type: 'transport',
                  neighborhood_id: neighborhoodId,
                });
              }

              // 4. Consume actions
              const { data: actionsData } = await supabase
                .from('player_actions')
                .select('*')
                .eq('player_id', player.id)
                .eq('game_id', currentGame.id)
                .eq('hour', updatedGame.current_hour)
                .single();

              if (actionsData) {
                await supabase
                  .from('player_actions')
                  .update({
                    actions_used: actionsData.actions_used + actionCost,
                  })
                  .eq('id', actionsData.id);
              }

              // Refresh player data
              await refreshPlayerData();
              await fetchGameData();

              return {
                success: true,
                hourAdvanced: true,
                newHour: updatedGame.current_hour,
                clientSide: true,
              };
            } catch (clientErr) {
              console.error(
                'Client-side travel implementation failed:',
                clientErr
              );
              throw new Error(
                'Client-side travel failed: ' + clientErr.message
              );
            }
          }
        } else {
          setLoading(false);
          return { success: false, error: new Error('Travel cancelled') };
        }
      }

      // Call the travel function from gameActions
      console.log('Calling travelToBorough with:', {
        playerId: player.id,
        gameId: currentGame.id,
        toBorough: neighborhoodId,
        transportId: transportationId,
      });

      // First ensure we have up-to-date player actions for the current hour
      const { data: currentActionsData, error: currentActionsError } =
        await supabase
          .from('player_actions')
          .select('*')
          .eq('player_id', player.id)
          .eq('game_id', currentGame.id)
          .eq('hour', currentGame.current_hour)
          .single();

      if (!currentActionsError && currentActionsData) {
        // Update actions_used directly in the database
        console.log('Manually updating action points before travel');
        const newActionsUsed = currentActionsData.actions_used + actionCost;

        await supabase
          .from('player_actions')
          .update({ actions_used: newActionsUsed })
          .eq('id', currentActionsData.id);
      }

      const result = await travelToBorough(
        player.id,
        currentGame.id,
        neighborhoodId,
        transportationId
      );

      console.log('travelToBorough result:', result);

      // Check if hour was advanced (can be detected by comparing game hour before and after)
      const { data: currentGameData } = await supabase
        .from('games')
        .select('current_hour')
        .eq('id', currentGame.id)
        .single();

      const hourAdvanced =
        currentGameData &&
        currentGameData.current_hour !== currentGame.current_hour;

      // Always refresh player data regardless of reported success/failure
      // since the constraint error might not have prevented travel
      const refreshSuccess = await refreshPlayerData();

      // Also refresh game data to get updated hour
      await fetchGameData();

      // After refreshing, check if we're now in the destination borough
      // This handles the case where travel succeeded despite unique constraint error
      if (refreshSuccess && player.current_borough_id === neighborhoodId) {
        console.log('Player location matches destination, travel succeeded');
        return {
          success: true,
          hourAdvanced,
          newHour: currentGameData?.current_hour,
        };
      }

      if (!result.success) {
        // Special handling for unique constraint errors
        if (
          result.error &&
          result.error.code === '23505' &&
          result.error.message &&
          result.error.message.includes(
            'player_transportation_player_id_transportation_id_key'
          )
        ) {
          console.log(
            'Got unique constraint error but travel may have completed'
          );

          // Refresh player data one more time with a slight delay
          await new Promise((resolve) => setTimeout(resolve, 300));
          await refreshPlayerData();

          // Check again if location updated
          if (player.current_borough_id === neighborhoodId) {
            console.log('After second refresh, travel appears successful');
            return {
              success: true,
              hourAdvanced,
              newHour: currentGameData?.current_hour,
            };
          }
        }

        console.error('Travel failed:', result.error);
        throw result.error || new Error('Travel failed');
      }

      return {
        success: true,
        hourAdvanced,
        newHour: currentGameData?.current_hour,
      };
    } catch (error) {
      console.error('Error traveling:', error);

      // Analyze and log details about the error
      console.log('Full error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        details: error.details,
      });

      // Provide more specific error message based on error type
      let errorMessage = 'Travel failed';
      if (error.message.includes('distance')) {
        errorMessage = 'Could not calculate travel distance';
      } else if (error.message.includes('actions')) {
        errorMessage = 'Not enough action points remaining';
      } else if (error.message.includes('transaction')) {
        errorMessage = 'Database error during travel';
      } else if (error.message.includes('turn')) {
        errorMessage = 'Failed to advance turn';
      }

      toast.error(errorMessage);
      return { success: false, error, errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Add this function to fetch game data
  const fetchGameData = async () => {
    if (!currentGame?.id || !player?.id) return;

    try {
      // Store previous game hour to detect changes
      const previousHour = currentGame.current_hour;

      // Fetch updated game data
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', currentGame.id)
        .single();

      if (gameError) {
        console.error('Error fetching game data:', gameError);
        return;
      }

      // Check if the hour changed
      const hourChanged = previousHour !== gameData.current_hour;

      // Fetch updated player data
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(
          `
          *,
          boroughs:current_borough_id (id, name)
        `
        )
        .eq('id', player.id)
        .single();

      if (playerError) {
        console.error('Error fetching player data:', playerError);
        return;
      }

      // Format player data to include current_borough as a string
      const playerWithBorough = {
        ...playerData,
        current_borough: playerData.boroughs?.name || 'Unknown Location',
      };

      // Fetch updated inventory
      const { data: inventory, error: inventoryError } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          products:product_id (
            name,
            description
          )
        `
        )
        .eq('player_id', player.id);

      if (inventoryError) {
        console.error('Error fetching inventory data:', inventoryError);
        return;
      }

      // Update all states with fresh data
      setCurrentGame(gameData);
      setPlayer(playerWithBorough);
      setPlayerInventory(inventory || []);

      return true;
    } catch (error) {
      console.error('Error in fetchGameData:', error);
      return false;
    }
  };

  // Modify endTurn function to update UI immediately
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
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
