-- Drop existing function
DROP FUNCTION IF EXISTS public.buy_record(uuid, uuid, uuid, uuid, integer, uuid);

-- Create updated function
CREATE OR REPLACE FUNCTION public.buy_record(
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
    v_market_item RECORD;
    v_total_price NUMERIC(10,2);
    v_space_required INTEGER;
    v_available_space INTEGER;
    v_used_space INTEGER;
    v_current_hour INTEGER;
BEGIN
    -- Get player data
    SELECT 
        p.id, p.cash, p.inventory_capacity, p.current_borough_id, g.current_hour
    INTO v_player
    FROM 
        players p
    JOIN
        games g ON p.game_id = g.id
    WHERE 
        p.id = p_player_id AND p.game_id = p_game_id;
    
    -- Store current hour for later reference
    v_current_hour := v_player.current_hour;
    
    -- Get product data from market inventory
    SELECT 
        id, current_price, quantity, condition, quality_rating
    INTO v_market_item
    FROM 
        market_inventory
    WHERE 
        store_id = p_store_id 
        AND game_id = p_game_id 
        AND product_id = p_product_id
    LIMIT 1; -- In case there are multiple matching records
    
    -- Calculate total price
    v_total_price := v_market_item.current_price * p_quantity;
    
    -- Get space required for this product
    SELECT space_required * p_quantity INTO v_space_required
    FROM products
    WHERE id = p_product_id;
    
    -- Calculate used space
    SELECT COALESCE(SUM(pi.quantity * pr.space_required), 0)
    INTO v_used_space
    FROM player_inventory pi
    JOIN products pr ON pi.product_id = pr.id
    WHERE pi.player_id = p_player_id;
    
    -- Calculate available space
    v_available_space := v_player.inventory_capacity - v_used_space;

    -- Check if we have enough cash
    IF v_player.cash < v_total_price THEN
        RETURN FALSE;
    END IF;
    
    -- Check if we have enough inventory space
    IF v_available_space < v_space_required THEN
        RETURN FALSE;
    END IF;
    
    -- Check if the store has enough quantity
    IF v_market_item.quantity < p_quantity THEN
        RETURN FALSE;
    END IF;
    
    -- Reduce player's cash
    UPDATE players
    SET cash = cash - v_total_price
    WHERE id = p_player_id AND game_id = p_game_id;
    
    -- CHANGED: Always insert as a new inventory entry (no quantity updates)
    -- This allows multiple copies of the same record with the same condition
    INSERT INTO player_inventory (
        player_id, product_id, quantity, purchase_price, 
        condition, quality_rating, created_at, updated_at
    ) VALUES (
        p_player_id, p_product_id, 1, v_market_item.current_price,
        v_market_item.condition, v_market_item.quality_rating,
        NOW(), NOW()
    );
    
    -- Reduce store's inventory
    UPDATE market_inventory
    SET quantity = quantity - p_quantity,
        day_updated = v_current_hour -- Include day_updated for backward compatibility
    WHERE id = v_market_item.id;
    
    -- Remove entry if quantity reaches 0
    DELETE FROM market_inventory
    WHERE id = v_market_item.id AND quantity <= 0;
    
    -- Record transaction
    INSERT INTO transactions (
        game_id, player_id, product_id, transaction_type, 
        quantity, price, store_id, hour
    ) VALUES (
        p_game_id, p_player_id, p_product_id, 'buy', 
        p_quantity, v_market_item.current_price, p_store_id,
        v_current_hour
    );
    
    RETURN TRUE;
END;
$function$;

COMMENT ON FUNCTION public.buy_record(uuid, uuid, uuid, uuid, integer, uuid) IS 'Buy record(s) from a store with proper inventory management'; 