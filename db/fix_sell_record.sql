-- Fix for the sell_record function to properly handle condition-based pricing
CREATE OR REPLACE FUNCTION public.sell_record(
    p_player_id uuid, 
    p_game_id uuid, 
    p_store_id uuid, 
    p_product_id uuid, 
    p_quantity integer DEFAULT 1, 
    p_inventory_id uuid DEFAULT NULL::uuid
) RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    v_player_record RECORD;
    v_inventory_record RECORD;
    v_market_price NUMERIC(10,2);
    v_base_price NUMERIC(10,2);
    v_total_value NUMERIC(10,2);
    v_condition TEXT;
    v_store_price NUMERIC(10,2);
    v_current_hour INTEGER;
    v_condition_factor NUMERIC(5,2);
    v_store_condition_factor NUMERIC(5,2);
    v_borough_price_modifier NUMERIC(5,2);
    v_min_better_condition_price NUMERIC(10,2);
    v_same_condition_price NUMERIC(10,2);
    v_store_markup NUMERIC(5,2);
    v_ceiling_price NUMERIC(10,2);
    v_floor_price NUMERIC(10,2);
BEGIN
    -- Get player data and current hour
    SELECT 
        p.id, p.current_borough_id, g.current_hour
    INTO v_player_record
    FROM 
        players p
    JOIN 
        games g ON p.game_id = g.id
    WHERE 
        p.id = p_player_id AND p.game_id = p_game_id;
    
    -- Store current hour for later use
    v_current_hour := v_player_record.current_hour;
    
    -- Handle the case where we have a specific inventory ID
    IF p_inventory_id IS NOT NULL THEN
        -- Get the specific inventory item
        SELECT 
            pi.quantity, pi.purchase_price, pi.condition, pi.product_id
        INTO v_inventory_record
        FROM 
            player_inventory pi
        WHERE 
            pi.id = p_inventory_id AND pi.player_id = p_player_id;
        
        -- If no inventory record found, return false
        IF v_inventory_record.product_id IS NULL THEN
            RETURN FALSE;
        END IF;
        
        -- Set product_id from inventory if it was NULL or different
        p_product_id := v_inventory_record.product_id;
    ELSE
        -- Get inventory based on product_id
        SELECT 
            pi.quantity, pi.purchase_price, pi.condition
        INTO v_inventory_record
        FROM 
            player_inventory pi
        WHERE 
            pi.player_id = p_player_id 
            AND pi.product_id = p_product_id;
        
        -- Check if player has enough inventory
        IF v_inventory_record.quantity IS NULL OR v_inventory_record.quantity < p_quantity THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Get the base price for this product
    SELECT base_price INTO v_base_price
    FROM products
    WHERE id = p_product_id;
    
    -- Get the store's markup
    SELECT price_multiplier INTO v_store_markup
    FROM stores
    WHERE id = p_store_id;
    
    -- Default to 1.0 if not found
    IF v_store_markup IS NULL THEN
        v_store_markup := 1.0;
    END IF;
    
    -- Get the borough price modifier
    SELECT price_modifier INTO v_borough_price_modifier
    FROM boroughs b
    JOIN store_boroughs sb ON b.id = sb.borough_id
    WHERE sb.store_id = p_store_id;
    
    -- Default to 1.0 if not found
    IF v_borough_price_modifier IS NULL THEN
        v_borough_price_modifier := 1.0;
    END IF;
    
    -- Determine condition factor for the player's record
    v_condition_factor := CASE
        WHEN v_inventory_record.condition = 'Mint' THEN 1.5
        WHEN v_inventory_record.condition = 'Good' THEN 1.0
        WHEN v_inventory_record.condition = 'Fair' THEN 0.7
        ELSE 0.5 -- Poor
    END;
    
    -- First try to get the store's selling price for this record in ANY condition
    SELECT 
        current_price, condition
    INTO v_market_price, v_condition
    FROM 
        market_inventory
    WHERE 
        game_id = p_game_id 
        AND store_id = p_store_id 
        AND product_id = p_product_id
    ORDER BY current_price DESC
    LIMIT 1;
    
    -- PRICE FLOOR: Check if store already sells this exact record in the same condition
    -- If so, we should pay at least 75% of the selling price
    SELECT current_price INTO v_same_condition_price
    FROM market_inventory
    WHERE 
        game_id = p_game_id 
        AND store_id = p_store_id 
        AND product_id = p_product_id
        AND condition = v_inventory_record.condition;
    
    -- PRICE CEILING: Find the minimum price of any BETTER condition version of this record
    -- This sets our ceiling price - we should never pay more than what we sell a better condition for
    SELECT MIN(current_price) INTO v_min_better_condition_price
    FROM market_inventory
    WHERE 
        game_id = p_game_id 
        AND store_id = p_store_id 
        AND product_id = p_product_id
        AND (
            (v_inventory_record.condition = 'Poor' AND condition IN ('Fair', 'Good', 'Mint')) OR
            (v_inventory_record.condition = 'Fair' AND condition IN ('Good', 'Mint')) OR
            (v_inventory_record.condition = 'Good' AND condition = 'Mint')
        );
    
    -- Calculate sell price based on:
    -- 1. Base price of the record
    -- 2. Condition of the player's record
    -- 3. If store has the record, use its price for reference with adjustments
    IF v_market_price IS NOT NULL THEN
        -- Store has the record - calculate price relative to store's price
        
        -- Get condition factor for the store's record
        v_store_condition_factor := CASE
            WHEN v_condition = 'Mint' THEN 1.5
            WHEN v_condition = 'Good' THEN 1.0
            WHEN v_condition = 'Fair' THEN 0.7
            ELSE 0.5 -- Poor
        END;
        
        -- Calculate the "fair" base price by removing condition effect
        v_store_price := v_market_price / v_store_condition_factor;
        
        -- Apply player's condition and store buy discount (stores buy at 70-80% of value)
        -- Also normalize for borough and store markup effects
        v_total_value := (v_store_price * v_condition_factor * 0.75) / (v_borough_price_modifier * v_store_markup);
    ELSE
        -- Store doesn't have this record - use base price with condition modifier
        v_total_value := (v_base_price * v_condition_factor) * 0.75;
    END IF;
    
    -- Calculate total value
    IF p_inventory_id IS NOT NULL THEN
        v_total_value := v_total_value * 1; -- Always quantity 1 for specific inventory ID
    ELSE
        v_total_value := v_total_value * p_quantity;
    END IF;
    
    -- CRITICAL: Apply ceiling price if a better condition exists
    -- We should never pay more per copy than our sell price for a better condition
    IF v_min_better_condition_price IS NOT NULL THEN
        -- Apply a 80% buy discount to the better condition price as our ceiling
        v_ceiling_price := v_min_better_condition_price * 0.8;
        
        -- If our calculated value exceeds the ceiling, cap it
        IF (v_total_value / p_quantity) > v_ceiling_price THEN
            v_total_value := v_ceiling_price * p_quantity;
        END IF;
    END IF;
    
    -- IMPORTANT: Apply floor price if store already sells this exact condition
    -- We should pay at least 75% of what we sell it for
    IF v_same_condition_price IS NOT NULL THEN
        v_floor_price := v_same_condition_price * 0.75;
        
        -- If our calculated value is below the floor, raise it
        IF (v_total_value / p_quantity) < v_floor_price THEN
            v_total_value := v_floor_price * p_quantity;
        END IF;
    END IF;
    
    -- Update inventory based on whether we're using inventory_id or not
    IF p_inventory_id IS NOT NULL THEN
        -- Delete the specific inventory item by ID
        DELETE FROM player_inventory
        WHERE id = p_inventory_id AND player_id = p_player_id;
    ELSE
        -- Update player inventory quantity
        UPDATE player_inventory
        SET quantity = quantity - p_quantity
        WHERE player_id = p_player_id AND product_id = p_product_id;
        
        -- Remove inventory entry if quantity is 0
        DELETE FROM player_inventory
        WHERE player_id = p_player_id 
          AND product_id = p_product_id 
          AND quantity <= 0;
    END IF;
    
    -- Update player cash
    UPDATE players
    SET cash = cash + v_total_value
    WHERE id = p_player_id AND game_id = p_game_id;
    
    -- Update store inventory
    -- Check if store already has this product with the same condition
    IF EXISTS (
        SELECT 1 FROM market_inventory 
        WHERE game_id = p_game_id 
          AND store_id = p_store_id 
          AND product_id = p_product_id
          AND condition = v_inventory_record.condition
    ) THEN
        -- Increase existing inventory quantity
        UPDATE market_inventory
        SET quantity = quantity + (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END),
            last_price_update = v_current_hour,
            day_updated = v_current_hour
        WHERE game_id = p_game_id 
          AND store_id = p_store_id 
          AND product_id = p_product_id
          AND condition = v_inventory_record.condition;
    ELSE
        -- Add as new inventory item with player's condition
        INSERT INTO market_inventory (
            game_id, store_id, product_id, quantity, 
            current_price, condition, quality_rating, base_markup,
            last_price_update, day_updated
        ) VALUES (
            p_game_id, p_store_id, p_product_id, 
            (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END),
            v_market_price, -- Use existing market price as reference
            v_inventory_record.condition,
            CASE 
              WHEN v_inventory_record.condition = 'Mint' THEN 0.9
              WHEN v_inventory_record.condition = 'Good' THEN 0.7
              WHEN v_inventory_record.condition = 'Fair' THEN 0.5
              ELSE 0.3
            END,
            1.0,
            v_current_hour,
            v_current_hour
        );
    END IF;
    
    -- Create transaction record
    INSERT INTO transactions (
        game_id, player_id, product_id, 
        transaction_type, quantity, price, 
        store_id, hour
    ) VALUES (
        p_game_id, p_player_id, p_product_id,
        'sell', 
        (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END), 
        v_total_value / (CASE WHEN p_inventory_id IS NOT NULL THEN 1 ELSE p_quantity END),
        p_store_id, v_current_hour
    );
    
    RETURN TRUE;
END;
$function$; 