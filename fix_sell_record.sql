-- First drop both versions of the function
DROP FUNCTION IF EXISTS public.sell_record(uuid, uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.sell_record(uuid, uuid, uuid, uuid, integer, uuid);

-- Create a single unified version
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
    v_player_record RECORD;
    v_inventory_record RECORD;
    v_market_price NUMERIC(10,2);
    v_total_value NUMERIC(10,2);
    v_condition TEXT;
    v_sell_margin NUMERIC(10,2);
    v_current_hour INTEGER;
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
    
    -- Get current market price - use the DISPLAY price from market_inventory
    SELECT 
        current_price
    INTO v_market_price
    FROM 
        market_inventory
    WHERE 
        game_id = p_game_id 
        AND store_id = p_store_id 
        AND product_id = p_product_id
    LIMIT 1;
    
    -- If no market price found, calculate it using the product base price
    IF v_market_price IS NULL THEN
        SELECT 
            base_price * 
            CASE 
                WHEN v_inventory_record.condition = 'Mint' THEN 2.0
                WHEN v_inventory_record.condition = 'Good' THEN 1.1
                WHEN v_inventory_record.condition = 'Fair' THEN 0.9
                ELSE 0.8 -- Poor
            END
        INTO v_market_price
        FROM 
            products
        WHERE 
            id = p_product_id;
    END IF;
    
    -- Standard sell margin with adjustment for condition
    v_sell_margin := CASE
        WHEN v_inventory_record.condition = 'Mint' THEN 0.9
        WHEN v_inventory_record.condition = 'Poor' THEN 0.7
        ELSE 0.8
    END;
    
    -- Calculate total value using the market price directly
    IF p_inventory_id IS NOT NULL THEN
        v_total_value := v_market_price * v_sell_margin * 1; -- Always quantity 1 for specific inventory ID
    ELSE
        v_total_value := v_market_price * v_sell_margin * p_quantity;
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
            last_price_update = v_current_hour, -- Use last_price_update instead of day_updated
            day_updated = v_current_hour -- Include day_updated for backward compatibility
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
            v_market_price, 
            v_inventory_record.condition,
            CASE 
              WHEN v_inventory_record.condition = 'Mint' THEN 0.9
              WHEN v_inventory_record.condition = 'Good' THEN 0.7
              WHEN v_inventory_record.condition = 'Fair' THEN 0.5
              ELSE 0.3
            END,
            1.0,
            v_current_hour, -- Set last_price_update to current_hour
            v_current_hour  -- Set day_updated to current_hour for backward compatibility
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

COMMENT ON FUNCTION public.sell_record(uuid, uuid, uuid, uuid, integer, uuid) IS 'Sell record(s) to store. Can sell by inventory_id (specific item) or product_id+quantity (bulk).'; 