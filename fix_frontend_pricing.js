// fix_frontend_pricing.js
// This fixes the frontend pricing issue by removing the hard-coded price calculations

/*
The problem has been identified:

1. The frontend (Store.jsx) has hard-coded price calculation logic that overrides 
   the database values, making prices the same at every store in every borough:
   - Mint condition: 50% profit (1.5x multiplier)
   - Good condition: 0% profit (1.0x multiplier)
   - Fair condition: 30% loss (0.7x multiplier)
   - Poor condition: 50% loss (0.5x multiplier)

2. These frontend calculations are causing every store to have identical pricing
   regardless of the store's specialty genre, borough price modifiers, etc.

The solution has two parts:
1. Deploy the updated SQL function (simplified_sell_record.sql)
2. Update the frontend code to use the database values directly
*/

// --- STEPS TO FIX THE ISSUE ---

/*
1. First, deploy the SQL function from simplified_sell_record.sql to your database
   This enables the correct price calculations on the server side

2. Modify Store.jsx to use database prices instead of calculating them locally:

   A. Replace the loadInventoryStorePrices function (around line 60-170) with:
*/

const loadInventoryStorePrices = useCallback(async () => {
  if (!store || !playerInventory?.length) return;

  try {
    setLoading(true);

    // Get all inventory IDs to get prices for
    const inventoryIds = playerInventory.map((item) => item.id);

    // Call RPC function to get sell prices - CREATE THIS FUNCTION IN YOUR DATABASE
    const { data, error } = await supabase.rpc('get_sell_prices', {
      p_player_id: player.id,
      p_store_id: store.id,
      p_game_id: gameId,
      p_inventory_ids: inventoryIds,
    });

    if (error) {
      console.error('Error getting sell prices:', error);
      // Fallback to basic pricing if the RPC fails
      const basicPrices = {};
      playerInventory.forEach((item) => {
        basicPrices[item.id] =
          (item.purchase_price || 10) *
          (item.condition === 'Mint'
            ? 1.1
            : item.condition === 'Good'
            ? 0.9
            : item.condition === 'Fair'
            ? 0.7
            : 0.5);
      });
      setInventoryStorePrices(basicPrices);
    } else {
      // Use prices directly from the database
      setInventoryStorePrices(data);
    }

    pricesCalculated.current = true;
  } catch (err) {
    console.error('Failed to load pricing data:', err);
  } finally {
    setLoading(false);
  }
}, [store?.id, player?.id, gameId, playerInventory, priceStabilityKey]);

/*
3. Create this database function to calculate prices correctly:
*/

/*
CREATE OR REPLACE FUNCTION public.get_sell_prices(
  p_player_id uuid,
  p_store_id uuid,
  p_game_id uuid,
  p_inventory_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_inventory_id uuid;
  v_store_record RECORD;
  v_borough_record RECORD;
  v_inventory_record RECORD;
  v_product_record RECORD;
  v_price numeric;
  v_current_hour integer;
BEGIN
  -- Get store info
  SELECT s.*, b.price_modifier as borough_modifier
  INTO v_store_record
  FROM stores s
  JOIN store_boroughs sb ON s.id = sb.store_id
  JOIN boroughs b ON sb.borough_id = b.id
  WHERE s.id = p_store_id;
  
  -- Get game hour
  SELECT current_hour INTO v_current_hour
  FROM games
  WHERE id = p_game_id;
  
  -- Calculate price for each inventory item
  FOREACH v_inventory_id IN ARRAY p_inventory_ids
  LOOP
    -- Get inventory data
    SELECT pi.*, p.genre, p.base_price
    INTO v_inventory_record
    FROM player_inventory pi
    JOIN products p ON pi.product_id = p.id
    WHERE pi.id = v_inventory_id;
    
    -- Set base price factors
    v_price := COALESCE(v_inventory_record.purchase_price, v_inventory_record.base_price, 10);
    
    -- Apply condition multiplier
    v_price := v_price * CASE
      WHEN v_inventory_record.condition = 'Mint' THEN 1.8
      WHEN v_inventory_record.condition = 'Good' THEN 1.3
      WHEN v_inventory_record.condition = 'Fair' THEN 1.0
      ELSE 0.7
    END;
    
    -- Apply store specialty bonus (80% bonus for matching genre)
    IF v_store_record.specialty_genre = v_inventory_record.genre THEN
      v_price := v_price * 1.8;
    END IF;
    
    -- Apply borough modifier
    IF v_store_record.borough_modifier IS NOT NULL THEN
      v_price := v_price * v_store_record.borough_modifier;
    END IF;
    
    -- Apply peak hour bonus
    IF v_current_hour BETWEEN 12 AND 18 THEN
      v_price := v_price * 1.2;
    END IF;
    
    -- Store the result
    v_result := jsonb_set(v_result, ARRAY[v_inventory_id::text], to_jsonb(v_price));
  END LOOP;
  
  RETURN v_result;
END;
$function$;
*/

/*
4. After updating the database function and the frontend code, 
   the game will correctly display different prices at different stores
   based on:
   
   - Record condition (Mint, Good, Fair, Poor)
   - Store specialty genre
   - Borough price modifiers
   - Time of day
   
   This will make the game much more strategic and fun!
*/
