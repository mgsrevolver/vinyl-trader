import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const GameContext = createContext();

export function useGame() {
  return useContext(GameContext);
}

export function GameProvider({ children, gameId }) {
  const { user } = useAuth();
  const [game, setGame] = useState(null);
  const [player, setPlayer] = useState(null);
  const [playerInventory, setPlayerInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentNeighborhood, setCurrentNeighborhood] = useState(null);
  const [marketInventory, setMarketInventory] = useState([]);

  // Load game data when component mounts or gameId changes
  useEffect(() => {
    if (!gameId || !user) return;

    const loadGameData = async () => {
      setLoading(true);
      try {
        // Load game data
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;
        setGame(gameData);

        // Load player data
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .single();

        if (playerError && playerError.code !== 'PGRST116') {
          // PGRST116 is "no rows returned" - this is fine if player hasn't joined yet
          throw playerError;
        }

        if (playerData) {
          setPlayer(playerData);

          // Load player's inventory
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('player_inventory')
            .select(
              `
              *,
              product:products(*)
            `
            )
            .eq('player_id', playerData.id);

          if (inventoryError) throw inventoryError;
          setPlayerInventory(inventoryData);

          // Load neighborhood data
          const { data: neighborhoodData, error: neighborhoodError } =
            await supabase
              .from('neighborhoods')
              .select('*')
              .eq('name', playerData.location)
              .single();

          if (neighborhoodError) throw neighborhoodError;
          setCurrentNeighborhood(neighborhoodData);

          // Load market inventory for current neighborhood
          await loadMarketInventory(gameId, neighborhoodData.id);
        }
      } catch (err) {
        console.error('Error loading game data:', err);
        setError(err.message);
        toast.error(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadGameData();

    // Set up real-time subscription for game updates
    const gameSubscription = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame(payload.new);
        }
      )
      .subscribe();

    // Set up subscription for player updates if player exists
    let playerSubscription;
    if (player) {
      playerSubscription = supabase
        .channel(`player:${player.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'players',
            filter: `id=eq.${player.id}`,
          },
          (payload) => {
            setPlayer(payload.new);
          }
        )
        .subscribe();
    }

    return () => {
      gameSubscription.unsubscribe();
      if (playerSubscription) {
        playerSubscription.unsubscribe();
      }
    };
  }, [gameId, user, player?.id]);

  // Function to load market inventory for a neighborhood
  const loadMarketInventory = async (gameId, neighborhoodId) => {
    try {
      const { data, error } = await supabase
        .from('market_inventory')
        .select(
          `
          *,
          product:products(*)
        `
        )
        .eq('game_id', gameId)
        .eq('neighborhood_id', neighborhoodId);

      if (error) throw error;
      setMarketInventory(data);
    } catch (err) {
      console.error('Error loading market inventory:', err);
      toast.error(`Error loading market: ${err.message}`);
    }
  };

  // Function to travel to a new neighborhood
  const travelToNeighborhood = async (neighborhoodId) => {
    if (!player) return { success: false, error: 'Player not found' };

    try {
      // Get neighborhood data
      const { data: neighborhoodData, error: neighborhoodError } =
        await supabase
          .from('neighborhoods')
          .select('*')
          .eq('id', neighborhoodId)
          .single();

      if (neighborhoodError) throw neighborhoodError;

      // Update player location and deduct a day
      const { data, error } = await supabase
        .from('players')
        .update({
          location: neighborhoodData.name,
        })
        .eq('id', player.id)
        .select()
        .single();

      if (error) throw error;

      // Add travel transaction
      await supabase.from('transactions').insert({
        game_id: gameId,
        player_id: player.id,
        transaction_type: 'travel',
        neighborhood_id: neighborhoodId,
        day: game.current_day,
      });

      // Update game day if this player is the current player
      if (game.current_player_id === user.id) {
        await supabase
          .from('games')
          .update({
            current_day: game.current_day + 1,
            current_player_id: null, // This would be replaced with next player logic
          })
          .eq('id', gameId);
      }

      setPlayer(data);
      setCurrentNeighborhood(neighborhoodData);

      // Load market inventory for new neighborhood
      await loadMarketInventory(gameId, neighborhoodId);

      toast.success(`Traveled to ${neighborhoodData.name}`);
      return { success: true, data };
    } catch (err) {
      console.error('Error traveling:', err);
      toast.error(`Travel failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // Function to buy products
  const buyProduct = async (productId, quantity, price) => {
    if (!player || !currentNeighborhood) {
      return { success: false, error: 'Player or neighborhood not found' };
    }

    try {
      // Check if player has enough money
      const totalCost = price * quantity;
      if (player.cash < totalCost) {
        throw new Error('Not enough cash');
      }

      // Check if player has enough inventory space
      const product = marketInventory.find(
        (item) => item.product.id === productId
      )?.product;
      if (!product) throw new Error('Product not found');

      const spaceRequired = product.space_required * quantity;
      const usedSpace = playerInventory.reduce((total, item) => {
        return total + item.product.space_required * item.quantity;
      }, 0);

      if (usedSpace + spaceRequired > player.inventory_capacity) {
        throw new Error('Not enough inventory space');
      }

      // Update player's cash
      const { data: updatedPlayer, error: playerError } = await supabase
        .from('players')
        .update({ cash: player.cash - totalCost })
        .eq('id', player.id)
        .select()
        .single();

      if (playerError) throw playerError;

      // Check if player already has this product
      const existingInventory = playerInventory.find(
        (item) => item.product.id === productId
      );

      if (existingInventory) {
        // Update existing inventory
        const { error: inventoryError } = await supabase
          .from('player_inventory')
          .update({
            quantity: existingInventory.quantity + quantity,
            updated_at: new Date(),
          })
          .eq('id', existingInventory.id);

        if (inventoryError) throw inventoryError;
      } else {
        // Add new inventory item
        const { error: inventoryError } = await supabase
          .from('player_inventory')
          .insert({
            player_id: player.id,
            product_id: productId,
            quantity: quantity,
            purchase_price: price,
          });

        if (inventoryError) throw inventoryError;
      }

      // Update market inventory
      const marketItem = marketInventory.find(
        (item) => item.product.id === productId
      );
      if (marketItem) {
        const { error: marketError } = await supabase
          .from('market_inventory')
          .update({
            quantity: marketItem.quantity - quantity,
            updated_at: new Date(),
          })
          .eq('id', marketItem.id);

        if (marketError) throw marketError;
      }

      // Record transaction
      await supabase.from('transactions').insert({
        game_id: gameId,
        player_id: player.id,
        product_id: productId,
        neighborhood_id: currentNeighborhood.id,
        transaction_type: 'buy',
        quantity: quantity,
        price: price,
        day: game.current_day,
      });

      // Refresh player inventory
      const { data: newInventory, error: newInventoryError } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          product:products(*)
        `
        )
        .eq('player_id', player.id);

      if (newInventoryError) throw newInventoryError;

      setPlayer(updatedPlayer);
      setPlayerInventory(newInventory);

      // Refresh market inventory
      await loadMarketInventory(gameId, currentNeighborhood.id);

      toast.success(`Bought ${quantity} ${product.name}`);
      return { success: true };
    } catch (err) {
      console.error('Error buying product:', err);
      toast.error(`Purchase failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // Function to sell products
  const sellProduct = async (productId, quantity, price) => {
    if (!player || !currentNeighborhood) {
      return { success: false, error: 'Player or neighborhood not found' };
    }

    try {
      // Find product in player's inventory
      const inventoryItem = playerInventory.find(
        (item) => item.product.id === productId
      );
      if (!inventoryItem || inventoryItem.quantity < quantity) {
        throw new Error('Not enough products in inventory');
      }

      const totalEarnings = price * quantity;

      // Update player's cash
      const { data: updatedPlayer, error: playerError } = await supabase
        .from('players')
        .update({ cash: player.cash + totalEarnings })
        .eq('id', player.id)
        .select()
        .single();

      if (playerError) throw playerError;

      // Update player inventory
      if (inventoryItem.quantity === quantity) {
        // Remove item if all are sold
        const { error: inventoryError } = await supabase
          .from('player_inventory')
          .delete()
          .eq('id', inventoryItem.id);

        if (inventoryError) throw inventoryError;
      } else {
        // Update quantity if some remain
        const { error: inventoryError } = await supabase
          .from('player_inventory')
          .update({
            quantity: inventoryItem.quantity - quantity,
            updated_at: new Date(),
          })
          .eq('id', inventoryItem.id);

        if (inventoryError) throw inventoryError;
      }

      // Update market inventory
      const marketItem = marketInventory.find(
        (item) => item.product.id === productId
      );
      if (marketItem) {
        const { error: marketError } = await supabase
          .from('market_inventory')
          .update({
            quantity: marketItem.quantity + quantity,
            updated_at: new Date(),
          })
          .eq('id', marketItem.id);

        if (marketError) throw marketError;
      } else {
        // Add to market if not present
        const { error: marketError } = await supabase
          .from('market_inventory')
          .insert({
            game_id: gameId,
            neighborhood_id: currentNeighborhood.id,
            product_id: productId,
            quantity: quantity,
            current_price: price,
            day_updated: game.current_day,
          });

        if (marketError) throw marketError;
      }

      // Record transaction
      await supabase.from('transactions').insert({
        game_id: gameId,
        player_id: player.id,
        product_id: productId,
        neighborhood_id: currentNeighborhood.id,
        transaction_type: 'sell',
        quantity: quantity,
        price: price,
        day: game.current_day,
      });

      // Refresh player inventory
      const { data: newInventory, error: newInventoryError } = await supabase
        .from('player_inventory')
        .select(
          `
          *,
          product:products(*)
        `
        )
        .eq('player_id', player.id);

      if (newInventoryError) throw newInventoryError;

      setPlayer(updatedPlayer);
      setPlayerInventory(newInventory);

      // Refresh market inventory
      await loadMarketInventory(gameId, currentNeighborhood.id);

      toast.success(
        `Sold ${quantity} ${
          inventoryItem.product.name
        } for ${totalEarnings.toFixed(2)}`
      );
      return { success: true };
    } catch (err) {
      console.error('Error selling product:', err);
      toast.error(`Sale failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // Function to create a new game
  const createGame = async (gameName, maxDays = 30) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      // Create new game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          name: gameName,
          max_days: maxDays,
          created_by: user.id,
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // Create player for game creator
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          user_id: user.id,
          game_id: gameData.id,
          cash: 2000.0, // Starting cash after loan
          loan_amount: 2000.0, // Starting loan
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Initialize market inventory for each neighborhood
      const { data: neighborhoods, error: neighborhoodError } = await supabase
        .from('neighborhoods')
        .select('*');

      if (neighborhoodError) throw neighborhoodError;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;

      // Create initial market inventory for each neighborhood
      for (const neighborhood of neighborhoods) {
        for (const product of products) {
          // Calculate a random price variation
          const priceVariation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
          const initialPrice = product.base_price * priceVariation;
          const initialQuantity = Math.floor(10 + Math.random() * 20); // 10-30

          await supabase.from('market_inventory').insert({
            game_id: gameData.id,
            neighborhood_id: neighborhood.id,
            product_id: product.id,
            quantity: initialQuantity,
            current_price: initialPrice,
            day_updated: 1,
          });
        }
      }

      toast.success(`Game "${gameName}" created successfully!`);
      return { success: true, gameId: gameData.id };
    } catch (err) {
      console.error('Error creating game:', err);
      toast.error(`Game creation failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  // Function to join an existing game
  const joinGame = async (gameId) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      // Check if player already exists in this game
      const { data: existingPlayer, error: existingPlayerError } =
        await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .maybeSingle();

      if (existingPlayerError) throw existingPlayerError;

      if (existingPlayer) {
        return {
          success: true,
          playerId: existingPlayer.id,
          alreadyJoined: true,
        };
      }

      // Create new player for this game
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          user_id: user.id,
          game_id: gameId,
          cash: 2000.0, // Starting cash after loan
          loan_amount: 2000.0, // Starting loan
        })
        .select()
        .single();

      if (playerError) throw playerError;

      toast.success('Joined game successfully!');
      return { success: true, playerId: playerData.id };
    } catch (err) {
      console.error('Error joining game:', err);
      toast.error(`Failed to join game: ${err.message}`);
      return { success: false, error: err.message };
    }
  };

  const value = {
    game,
    player,
    loading,
    error,
    playerInventory,
    currentNeighborhood,
    marketInventory,
    travelToNeighborhood,
    buyProduct,
    sellProduct,
    createGame,
    joinGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
