const loadInventoryStorePrices = useCallback(async () => {
  if (!store || !playerInventory?.length) return;

  // Skip if we've already calculated prices
  if (pricesCalculated.current) return;

  try {
    setLoading(true);

    // Get all inventory IDs to get prices for
    const inventoryIds = playerInventory.map((item) => item.id);

    // --------- NEW CODE: Use the get_sell_prices function from the database --------
    // This ensures prices reflect store specialty, borough prices, etc.
    const { data, error } = await supabase.rpc('get_sell_prices', {
      p_player_id: player.id,
      p_store_id: store.id,
      p_game_id: gameId,
      p_inventory_ids: inventoryIds,
    });

    if (error) {
      console.error('Error getting sell prices:', error);

      // Fall back to simplified pricing if the RPC call fails
      const basicPrices = {};
      playerInventory.forEach((item) => {
        // Use more favorable pricing in the fallback
        basicPrices[item.id] =
          (item.purchase_price || 10) *
          (item.condition === 'Mint'
            ? 1.5
            : item.condition === 'Good'
            ? 1.0
            : item.condition === 'Fair'
            ? 0.7
            : 0.5);
      });
      setInventoryStorePrices(basicPrices);
    } else {
      // Use prices from the database
      setInventoryStorePrices(data);
    }
    // --------- END NEW CODE ---------

    pricesCalculated.current = true;
  } catch (error) {
    // Error handling is silent but we'll log it
    console.error('Price calculation error:', error);
  } finally {
    setLoading(false);
  }
}, [store?.id, player?.id, gameId, playerInventory, priceStabilityKey]);
