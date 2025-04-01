-- This SQL file fixes both selling price issues:
-- 1. Updates the sell_record function to have better pricing mechanics
-- 2. Creates a helper function to get prices for the frontend

-- First, drop and recreate the simplified sell_record function
DROP FUNCTION IF EXISTS public.sell_record(uuid, uuid, uuid, uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.sell_record(
    p_player_id uuid,
    p_game_id uuid,
    p_store_id uuid,
    p_product_id uuid,
    p_quantity integer DEFAULT 1,
    p_inventory_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    v_player RECORD;
    v_inventory RECORD;
    v_store RECORD;
    v_borough RECORD;
    v_product RECORD;
    v_market_price NUMERIC(10,2);
    v_sell_price NUMERIC(10,2);
    v_total_value NUMERIC(10,2);
    v_current_hour INTEGER;
    v_condition_factor NUMERIC(5,2);
    v_original_purchase RECORD;
    v_is_same_store BOOLEAN;
BEGIN
    -- Get player and game info
    SELECT p.id, p.current_borough_id, g.current_hour
    INTO v_player
    FROM players p
    JOIN games g ON p.game_id = g.id
    WHERE p.id = p_player_id AND p.game_id = p_game_id;
    
    v_current_hour := v_player.current_hour;
    
    -- Get inventory record
    IF p_inventory_id IS NOT NULL THEN
        SELECT pi.id, pi.quantity, pi.purchase_price, pi.condition, pi.product_id
        INTO v_inventory
        FROM player_inventory pi
        WHERE pi.id = p_inventory_id AND pi.player_id = p_player_id;
        
        IF v_inventory.id IS NULL THEN
            RETURN FALSE;
        END IF;
        
        p_product_id := v_inventory.product_id;
    ELSE
        SELECT pi.id, pi.quantity, pi.purchase_price, pi.condition
        INTO v_inventory
        FROM player_inventory pi
        WHERE pi.player_id = p_player_id AND pi.product_id = p_product_id
        LIMIT 1;
        
        IF v_inventory.id IS NULL OR v_inventory.quantity < p_quantity THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Get store info
    SELECT id, price_multiplier, specialty_genre 
    INTO v_store
    FROM stores
    WHERE id = p_store_id;
    
    -- Get product info
    SELECT id, name, genre, base_price
    INTO v_product
    FROM products
    WHERE id = p_product_id;
    
    -- Get borough price modifier
    SELECT b.price_modifier
    INTO v_borough
    FROM boroughs b
    JOIN store_boroughs sb ON b.id = sb.borough_id
    WHERE sb.store_id = p_store_id;
    
    -- Check if selling to the same store as purchased
    SELECT store_id INTO v_original_purchase
    FROM transactions
    WHERE player_id = p_player_id 
      AND product_id = p_product_id
      AND transaction_type = 'buy'
    ORDER BY created_at DESC
    LIMIT 1;
    
    v_is_same_store := (v_original_purchase.store_id = p_store_id);
    
    -- Apply condition factor - HIGHER THAN BEFORE
    v_condition_factor := CASE
        WHEN v_inventory.condition = 'Mint' THEN 1.8   -- Was 1.5, now 1.8
        WHEN v_inventory.condition = 'Good' THEN 1.3   -- Was 1.0, now 1.3
        WHEN v_inventory.condition = 'Fair' THEN 1.0   -- Was 0.7, now 1.0
        ELSE 0.7                                      -- Was 0.5, now 0.7
    END;
    
    -- Get current market price if it exists
    SELECT current_price
    INTO v_market_price
    FROM market_inventory
    WHERE game_id = p_game_id 
      AND store_id = p_store_id 
      AND product_id = p_product_id
    ORDER BY current_price DESC
    LIMIT 1;
    
    -- BETTER PRICING MECHANICS

    -- 1. Base price - use purchase price if available, otherwise product base 
    IF v_inventory.purchase_price IS NOT NULL THEN
        v_sell_price := v_inventory.purchase_price;
    ELSIF v_market_price IS NOT NULL THEN
        v_sell_price := v_market_price;
    ELSE
        v_sell_price := v_product.base_price;
    END IF;
    
    -- 2. Apply basic sell discount - better than before (80% vs 75%)
    v_sell_price := v_sell_price * 0.8;
    
    -- 3. Add condition bonus
    v_sell_price := v_sell_price * v_condition_factor;
    
    -- 4. Apply genre specialty bonus (80% bonus vs 50%)
    IF v_store.specialty_genre = v_product.genre THEN
        v_sell_price := v_sell_price * 1.8;  -- Was 1.5, now 1.8
    END IF;
    
    -- 5. Apply demand bonus - prices fluctuate by hour
    -- Hours 12-18 have best prices (peak hours)
    IF v_current_hour BETWEEN 12 AND 18 THEN
        v_sell_price := v_sell_price * 1.2;
    END IF;
    
    -- 6. Apply borough price modifier
    IF v_borough.price_modifier IS NOT NULL THEN
        v_sell_price := v_sell_price * v_borough.price_modifier;
    END IF;
    
    -- 7. Round to 2 decimal places
    v_sell_price := ROUND(v_sell_price, 2);
    
    -- Calculate total value
    v_total_value := v_sell_price * (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END);
    
    -- UPDATE DATABASE
    
    -- 1. Update player inventory
    IF p_inventory_id IS NOT NULL THEN
        DELETE FROM player_inventory
        WHERE id = p_inventory_id AND player_id = p_player_id;
    ELSE
        UPDATE player_inventory
        SET quantity = quantity - p_quantity
        WHERE player_id = p_player_id AND product_id = p_product_id;
        
        -- Remove if quantity is 0
        DELETE FROM player_inventory
        WHERE player_id = p_player_id 
          AND product_id = p_product_id 
          AND quantity <= 0;
    END IF;
    
    -- 2. Update player cash
    UPDATE players
    SET cash = cash + v_total_value
    WHERE id = p_player_id AND game_id = p_game_id;
    
    -- 3. Update store inventory
    -- Check if store already has this product with same condition
    IF EXISTS (
        SELECT 1 FROM market_inventory 
        WHERE game_id = p_game_id 
          AND store_id = p_store_id 
          AND product_id = p_product_id
          AND condition = v_inventory.condition
    ) THEN
        -- Increase quantity
        UPDATE market_inventory
        SET quantity = quantity + (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END)
        WHERE game_id = p_game_id 
          AND store_id = p_store_id 
          AND product_id = p_product_id
          AND condition = v_inventory.condition;
    ELSE
        -- Add new inventory item
        INSERT INTO market_inventory (
            game_id, store_id, product_id, quantity, 
            current_price, condition, quality_rating, day_updated
        ) VALUES (
            p_game_id, p_store_id, p_product_id, 
            (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END),
            -- Stores will sell records they buy from you at a markup
            v_sell_price * 1.5, -- 50% markup, so players can buy and sell for profit
            v_inventory.condition,
            CASE 
              WHEN v_inventory.condition = 'Mint' THEN 0.9
              WHEN v_inventory.condition = 'Good' THEN 0.7
              WHEN v_inventory.condition = 'Fair' THEN 0.5
              ELSE 0.3
            END,
            v_current_hour
        );
    END IF;
    
    -- 4. Record transaction
    INSERT INTO transactions (
        game_id, player_id, product_id, 
        transaction_type, quantity, price, 
        store_id, hour
    ) VALUES (
        p_game_id, p_player_id, p_product_id,
        'sell', 
        (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END), 
        v_sell_price,
        p_store_id, v_current_hour
    );
    
    RETURN TRUE;
END;
$function$;

-- Second, create a new helper function to get accurate sell prices
-- (used by the frontend to show correct prices)
CREATE OR REPLACE FUNCTION public.get_sell_price(
    p_player_id uuid,
    p_store_id uuid,
    p_inventory_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
AS $function$
DECLARE
    v_game_id uuid;
    v_inventory RECORD;
    v_store RECORD;
    v_borough RECORD;
    v_product RECORD;
    v_current_hour INTEGER;
    v_price numeric;
BEGIN
    -- Get game ID and hour
    SELECT g.id, g.current_hour INTO v_game_id, v_current_hour
    FROM players p
    JOIN games g ON p.game_id = g.id
    WHERE p.id = p_player_id;
    
    -- Get inventory details
    SELECT pi.*, p.genre, p.base_price
    INTO v_inventory
    FROM player_inventory pi
    JOIN products p ON pi.product_id = p.id
    WHERE pi.id = p_inventory_id;
    
    -- Get store info
    SELECT s.*, b.price_modifier as borough_modifier
    INTO v_store
    FROM stores s
    JOIN store_boroughs sb ON s.id = sb.store_id
    JOIN boroughs b ON sb.borough_id = b.id
    WHERE s.id = p_store_id;
    
    -- Set base price factors
    v_price := COALESCE(v_inventory.purchase_price, v_product.base_price, 10);
    
    -- Apply condition multiplier
    v_price := v_price * CASE
      WHEN v_inventory.condition = 'Mint' THEN 1.8
      WHEN v_inventory.condition = 'Good' THEN 1.3
      WHEN v_inventory.condition = 'Fair' THEN 1.0
      ELSE 0.7
    END;
    
    -- Apply store specialty bonus (80% bonus for matching genre)
    IF v_store.specialty_genre = v_inventory.genre THEN
      v_price := v_price * 1.8;
    END IF;
    
    -- Apply borough modifier
    IF v_store.borough_modifier IS NOT NULL THEN
      v_price := v_price * v_store.borough_modifier;
    END IF;
    
    -- Apply peak hour bonus
    IF v_current_hour BETWEEN 12 AND 18 THEN
      v_price := v_price * 1.2;
    END IF;
    
    RETURN ROUND(v_price, 2);
END;
$function$;

-- Create a version that handles an array of inventory IDs
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
    v_price numeric;
BEGIN
    -- Process each inventory ID
    FOREACH v_inventory_id IN ARRAY p_inventory_ids
    LOOP
        -- Get price using the other function
        SELECT public.get_sell_price(p_player_id, p_store_id, v_inventory_id) INTO v_price;
        
        -- Add to result object
        v_result := jsonb_set(v_result, ARRAY[v_inventory_id::text], to_jsonb(v_price));
    END LOOP;
    
    RETURN v_result;
END;
$function$; 