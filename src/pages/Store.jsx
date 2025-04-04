import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaCoins,
  FaShoppingCart,
  FaShoppingBag,
  FaBolt,
  FaStar,
  FaCompactDisc,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import {
  getStoreInventory,
  buyRecord,
  sellRecord,
  getSellPrices,
} from '../lib/gameActions';
import ActionButton from '../components/ui/ActionButton';
import ProductCard from '../components/ui/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import SlimProductCard from '../components/ui/SlimProductCard';

const Store = () => {
  const { gameId, boroughId, storeId } = useParams();
  const navigate = useNavigate();
  const {
    player,
    playerInventory,
    refreshPlayerInventory,
    refreshPlayerData,
    loading: gameLoading,
  } = useGame();

  const [loading, setLoading] = useState(true);
  const [borough, setBorough] = useState(null);
  const [store, setStore] = useState(null);
  const [storeInventory, setStoreInventory] = useState([]);
  const [error, setError] = useState(null);
  const [buyMode, setBuyMode] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(null);
  const [swipeMode, setSwipeMode] = useState(false);
  const [swipedCards, setSwipedCards] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showNextCard, setShowNextCard] = useState(false);
  const [key, setKey] = useState(0);
  const [listView, setListView] = useState(true);
  const [inventoryStorePrices, setInventoryStorePrices] = useState({});

  // Add a ref to track when prices have been calculated
  const pricesCalculated = useRef(false);

  // Add a new state variable to track price stability
  const [priceStabilityKey, setPriceStabilityKey] = useState(Date.now());

  // Convert to useCallback to prevent recreation - MOVED THIS FUNCTION ABOVE THE USEEFFECT THAT REFERENCES IT
  const loadInventoryStorePrices = useCallback(async () => {
    if (!store || !playerInventory?.length) return;
    if (pricesCalculated.current) return;

    try {
      setLoading(true);
      console.log('Starting price calculation');

      // First, log the player inventory to see if purchase_price exists on the items
      console.log(
        'Player inventory items with purchase prices:',
        playerInventory.map((item) => ({
          id: item.id,
          purchase_price: item.purchase_price,
          condition: item.condition,
          product_name: item.products?.name,
        }))
      );

      // ULTRA SIMPLE APPROACH - One item at a time
      const prices = {};

      // Process one record at a time
      for (const item of playerInventory) {
        console.log(`Getting price for inventory item: ${item.id}`);

        // Double-check if purchase_price exists before making the call
        if (item.purchase_price === undefined || item.purchase_price === null) {
          console.warn(`Item ${item.id} is missing purchase_price!`, item);
        }

        const response = await supabase.rpc('get_sell_price', {
          p_player_id: player.id,
          p_store_id: store.id,
          p_inventory_id: item.id,
        });

        if (response.error) {
          console.error(`ERROR for ${item.id}:`, response.error);
        } else {
          console.log(`SUCCESS for ${item.id}: $${response.data}`);
          prices[item.id] = response.data;
        }
      }

      // If we got ANY prices, use them
      if (Object.keys(prices).length > 0) {
        console.log('SUCCESS: Using database prices:', prices);
        setInventoryStorePrices(prices);
      } else {
        console.log('FALLBACK: All database calls failed, using basic pricing');

        // Fall back to basic pricing - ensure purchase_price is used if available
        const basicPrices = {};
        playerInventory.forEach((item) => {
          // Log each item's purchase_price for debugging
          console.log(
            `Fallback pricing for ${item.id}: purchase_price=${item.purchase_price}, condition=${item.condition}`
          );

          // Default to 10 only if purchase_price is truly missing
          const basePriceToUse = parseFloat(item.purchase_price) || 10;

          basicPrices[item.id] =
            basePriceToUse *
            (item.condition === 'Mint'
              ? 1.5
              : item.condition === 'Good'
              ? 1.0
              : item.condition === 'Fair'
              ? 0.7
              : 0.5);
        });
        setInventoryStorePrices(basicPrices);
      }

      pricesCalculated.current = true;
    } catch (err) {
      console.error('CRITICAL ERROR:', err);
    } finally {
      setLoading(false);
    }
  }, [store?.id, player?.id, gameId, playerInventory, priceStabilityKey]);

  useEffect(() => {
    if (gameId && boroughId && storeId) {
      loadStoreData();
    } else {
      setError('Missing required parameters');
      setLoading(false);
    }
  }, [gameId, boroughId, storeId]);

  // When buying mode changes, reset the prices calculated flag
  useEffect(() => {
    pricesCalculated.current = false;
    if (!buyMode) {
      // Only generate a new stability key when switching TO sell mode
      // This keeps prices stable during the entire sell session
      setPriceStabilityKey(Date.now());
    }
  }, [buyMode]);

  // Optimize this effect to prevent multiple recalculations
  useEffect(() => {
    // Only load prices if we're in sell mode AND we haven't calculated yet
    if (
      !buyMode &&
      playerInventory?.length > 0 &&
      store &&
      !pricesCalculated.current
    ) {
      loadInventoryStorePrices();
    }
  }, [
    buyMode,
    playerInventory,
    store,
    priceStabilityKey,
    loadInventoryStorePrices,
  ]);

  const loadStoreData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use Promise.all to fetch data in parallel
      const [boroughResponse, storeResponse] = await Promise.all([
        // 1. Fetch the borough
        supabase.from('boroughs').select('*').eq('id', boroughId).single(),

        // 2. Fetch the specific store
        supabase
          .from('stores')
          .select('*')
          .eq('id', storeId)
          .eq('borough_id', boroughId)
          .single(),
      ]);

      if (boroughResponse.error) {
        setError('Could not load location information');
        return;
      }

      setBorough(boroughResponse.data);

      let currentStore;
      if (storeResponse.error) {
        // If we can't find the specific store, try to get any store in this borough
        const { data: anyStore, error: anyStoreError } = await supabase
          .from('stores')
          .select('*')
          .eq('borough_id', boroughId)
          .limit(1)
          .single();

        if (anyStoreError) {
          setError('No stores found in this location');
          return;
        }

        currentStore = anyStore;
        setStore(anyStore);
      } else {
        currentStore = storeResponse.data;
        setStore(storeResponse.data);
      }

      // 3. Load the store inventory using the store we found
      if (currentStore) {
        const inventoryResult = await getStoreInventory(
          currentStore.id,
          gameId
        );

        if (inventoryResult.error) {
          setError('Could not load store inventory');
          return;
        }

        // Process inventory items in a more efficient way
        const expandedInventory = [];

        inventoryResult.items.forEach((item) => {
          // For better performance, only expand items where quantity > 1
          if (item.quantity <= 1) {
            expandedInventory.push({
              ...item,
              displayId: `${item.id}-0`,
              id: item.id,
              originalQuantity: item.quantity,
              quantity: 1,
            });
          } else {
            // Create individual cards for each copy of the record with quantity > 1
            for (let i = 0; i < item.quantity; i++) {
              expandedInventory.push({
                ...item,
                displayId: `${item.id}-${i}`,
                id: item.id,
                originalQuantity: item.quantity,
                quantity: 1,
              });
            }
          }
        });

        setStoreInventory(expandedInventory);
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (productId, quantity = 1, inventoryId) => {
    if (!player) return;

    // Make sure storeId is available, or use store.id as fallback
    const currentStoreId = storeId || (store && store.id);

    if (!currentStoreId) {
      toast.error('Store information is missing');
      return;
    }

    try {
      // Find the record being purchased - ONLY by exact inventory ID
      let recordToBuy = storeInventory.find(
        (item) => item.id === inventoryId || item.displayId === inventoryId
      );

      // If we couldn't find the exact inventory item, don't fall back to product_id
      if (!recordToBuy) {
        toast.error('Exact record not found. Please try again.');
        return;
      }

      // Make sure we have the product ID from the record
      const productIdToUse = recordToBuy.product_id || productId;
      const recordPrice = recordToBuy.current_price;
      const recordCondition = recordToBuy.condition || 'Good';

      // Check if player has enough cash
      if (player.cash < recordPrice) {
        toast.error(
          `Not enough cash. This record costs $${recordPrice.toFixed(2)}.`
        );
        return;
      }

      // Check if player already owns this record with the same condition
      const alreadyOwnsWithSameCondition = playerInventory.some(
        (item) =>
          item.product_id === productIdToUse &&
          item.condition === recordCondition
      );

      if (alreadyOwnsWithSameCondition) {
        // Handle the duplicate condition case
        toast.error(
          `You already own this record in ${recordCondition} condition. Due to inventory system limitations, you can't own duplicates of the same record with the same condition. Try finding a different condition copy.`
        );
        return;
      }

      // Optimistically update UI before making the actual request
      setLoading(true);

      // IMPORTANT: Always buy with quantity=1 since the database function ignores quantity
      // and always inserts with quantity=1
      const result = await buyRecord(
        player.id,
        gameId,
        currentStoreId,
        productIdToUse,
        1 // Force quantity to 1
      );

      if (result.success) {
        toast.success(
          `Purchased "${
            recordToBuy.products?.name || 'Record'
          }" for $${recordPrice.toFixed(2)}`
        );

        // Optimistically update the store inventory
        const updatedInventory = storeInventory.filter(
          (item) => item.displayId !== recordToBuy.displayId
        );
        setStoreInventory(updatedInventory);

        // If in swipe mode, update the current index if needed
        if (!listView && currentIndex >= updatedInventory.length) {
          setCurrentIndex(Math.max(0, updatedInventory.length - 1));
        }

        // Refresh player inventory without reloading everything
        await refreshPlayerInventory();
      } else {
        // Special handling for the duplicate key error
        if (result.error?.code === '23505') {
          toast.error(
            `You already own this record in ${recordCondition} condition. Try a different condition.`
          );
        } else {
          toast.error(result.error?.message || 'Purchase failed');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (productId, quantity = 1, inventoryId) => {
    if (!player || !store) return;

    try {
      if (!inventoryId) {
        toast.error('Cannot sell: Missing inventory ID for this record');
        return;
      }

      // Find the inventory item
      const inventoryItem = playerInventory.find(
        (item) => item.id === inventoryId
      );
      if (!inventoryItem) {
        toast.error('Cannot find this record in your inventory');
        return;
      }

      // Set loading state
      setLoading(true);

      // Check where this item was originally purchased
      const { data: purchaseHistory } = await supabase
        .from('transactions')
        .select('*')
        .eq('player_id', player.id)
        .eq('product_id', productId)
        .eq('transaction_type', 'buy')
        .order('created_at', { ascending: false })
        .limit(1);

      const isSameStore = purchaseHistory?.[0]?.store_id === store.id;
      const originalPrice = purchaseHistory?.[0]?.price;

      // Check to make sure same-store selling is at a loss
      if (
        isSameStore &&
        originalPrice &&
        inventoryStorePrices[inventoryId] > originalPrice
      ) {
        toast.error('Cannot sell for more than you paid at the same store!');
        setLoading(false);
        return;
      }

      // Store the price before the record is sold for proper toast message
      const sellPrice = inventoryStorePrices[inventoryId];
      const recordName = inventoryItem.product_name || 'Record';

      const result = await sellRecord(
        player.id,
        gameId,
        store.id,
        productId,
        quantity,
        inventoryId
      );

      if (result.success) {
        // Show success message with the pre-calculated price
        toast.success(`${recordName} sold for $${sellPrice.toFixed(2)}!`);

        // Immediately update the player inventory state to remove the sold item
        if (refreshPlayerInventory) {
          await refreshPlayerInventory();
        }

        // IMPORTANT: Also refresh player data to update cash balance
        if (refreshPlayerData) {
          await refreshPlayerData();
        }
      } else {
        const errorMessage = result.error?.message || 'Failed to sell record';
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error('Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigate(`/game/${gameId}`);
  };

  const handleSkip = (id) => {
    setDirection('left');
    setTimeout(() => {
      setCurrentIndex((prev) => getNextCardIndex(prev));
      setKey((prev) => prev + 1);
      setDirection(null);
    }, 300);
  };

  const handleLike = (id) => {
    const currentItem = storeInventory[currentIndex];
    const productId = currentItem.products?.id || currentItem.product_id;

    // Make sure to use the actual ID, not the uniqueId with suffix
    const inventoryId = currentItem.id;

    handleBuy(productId, 1, inventoryId);

    setDirection('right');
    setTimeout(() => {
      setCurrentIndex((prev) => getNextCardIndex(prev));
      setKey((prev) => prev + 1);
      setDirection(null);
    }, 300);
  };

  const toggleViewMode = () => {
    setSwipeMode(!swipeMode);
    if (!swipeMode) {
      setCurrentIndex(0);
    }
  };

  const getNextCardIndex = (currentIdx) => {
    return (currentIdx + 1) % storeInventory.length;
  };

  const handleSwipe = (direction) => {
    const cardId =
      storeInventory[currentIndex]?.products?.id ||
      storeInventory[currentIndex]?.product_id;

    setSwipedCards([...swipedCards, cardId]);

    if (direction === 'right') {
      handleLike(cardId);
    } else {
      handleSkip(cardId);
    }

    setTimeout(() => {
      setCurrentIndex(getNextCardIndex(currentIndex));
    }, 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={goBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <FaArrowLeft className="inline mr-2" /> Back to Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-xl mx-auto p-4 mt-4">
        {/* Header Row with back button, store name and cash display */}
        <div className="header-row">
          <div className="flex items-center">
            <button onClick={goBack} className="vinyl-back-button">
              <FaArrowLeft />
            </button>
          </div>

          <h1 className="text-2xl font-bold font-records">
            {store?.name || 'Record Store'}
          </h1>
        </div>

        {/* Horizontal tab toggle - properly styled */}
        <div className="mode-toggle">
          <button
            onClick={() => setBuyMode(true)}
            className={`mode-toggle-button ${buyMode ? 'active' : ''}`}
          >
            <FaShoppingCart className="mode-toggle-icon" />
            Buy
          </button>

          <button
            onClick={() => setBuyMode(false)}
            className={`mode-toggle-button ${!buyMode ? 'active' : ''}`}
          >
            <FaShoppingBag className="mode-toggle-icon" />
            Sell
          </button>
        </div>

        {/* View toggle button - only show in buy mode */}
        {buyMode && (
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setListView(!listView)}
              className="vinyl-view-toggle"
            >
              {listView ? 'Card View' : 'List View'}
            </button>
          </div>
        )}

        {/* Inventory Display */}
        <div className="bg-white shadow-md mb-4 rounded-lg overflow-hidden">
          <div className="p-3">
            {buyMode ? (
              <div>
                {storeInventory.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-4">
                    No records available in this store
                  </p>
                ) : listView ? (
                  <div>
                    {storeInventory.map((item, index) => {
                      // Transform the storeInventory item to match what SlimProductCard expects
                      const transformedItem = {
                        id: item.id,
                        displayId:
                          item.displayId || `store-item-${index}-${item.id}`,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        // Pass the condition directly from the market_inventory item
                        condition: item.condition,
                        // Pass quality_rating if needed
                        quality_rating: item.quality_rating,
                        products: item.products,
                        // Ensure all price fields are properly passed
                        estimated_current_price: item.current_price,
                        current_price: item.current_price,
                      };

                      return (
                        <SlimProductCard
                          key={transformedItem.displayId}
                          item={transformedItem}
                          actionType="buy"
                          onAction={handleBuy}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="card-stack-container">
                    <div className="swipe-counter">
                      {currentIndex + 1} of {storeInventory.length}
                    </div>

                    {/* Next card - only visible during dragging */}
                    {showNextCard && (
                      <div className="next-card">
                        <ProductCard
                          product={{
                            id: storeInventory[getNextCardIndex(currentIndex)]
                              ?.product_id,
                            name:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.name || 'Unknown Record',
                            artist:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.artist || 'Unknown Artist',
                            genre:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.genre || 'Various',
                            year:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.year || 'N/A',
                            rarity:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.rarity || 0.5,
                            image_url:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.image_url || null,
                          }}
                          condition={
                            storeInventory[getNextCardIndex(currentIndex)]
                              ?.condition || 'Good'
                          }
                          price={
                            storeInventory[getNextCardIndex(currentIndex)]
                              ?.current_price
                          }
                          quantity={
                            storeInventory[getNextCardIndex(currentIndex)]
                              ?.quantity
                          }
                          showAction={false}
                        />
                      </div>
                    )}

                    {/* Current card - with key to force re-mount */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`card-${currentIndex}-${key}`}
                        className="current-card"
                        initial={{ scale: 0.95, opacity: 0.9 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          x:
                            direction === 'left'
                              ? -300
                              : direction === 'right'
                              ? 300
                              : 0,
                          opacity: 0,
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <ProductCard
                          key={`product-${currentIndex}-${key}`}
                          product={{
                            id: storeInventory[currentIndex]?.product_id,
                            name:
                              storeInventory[currentIndex]?.products?.name ||
                              'Unknown Record',
                            artist:
                              storeInventory[currentIndex]?.products?.artist ||
                              'Unknown Artist',
                            genre:
                              storeInventory[currentIndex]?.products?.genre ||
                              'Various',
                            year:
                              storeInventory[currentIndex]?.products?.year ||
                              'N/A',
                            rarity:
                              storeInventory[currentIndex]?.products?.rarity ||
                              0.5,
                            image_url:
                              storeInventory[currentIndex]?.products
                                ?.image_url || null,
                          }}
                          condition={
                            storeInventory[currentIndex]?.condition || 'Good'
                          }
                          price={storeInventory[currentIndex]?.current_price}
                          quantity={storeInventory[currentIndex]?.quantity}
                          onSkip={handleSkip}
                          onLike={handleLike}
                          setShowNextCard={setShowNextCard}
                          showAction={false}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {playerInventory.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-4">
                    Your inventory is empty
                  </p>
                ) : (
                  <div>
                    {playerInventory.flatMap((item, itemIndex) => {
                      // Debug the item structure to see if purchase_price exists
                      console.log(`Inventory item ${itemIndex}:`, {
                        id: item.id,
                        product_id: item.product_id,
                        product_name: item.products?.name,
                        purchase_price: item.purchase_price,
                        condition: item.condition,
                        store_price: inventoryStorePrices[item.id],
                      });

                      // Only create one card per inventory item, don't expand by quantity
                      const uniqueKey = `inventory-item-${itemIndex}-${item.id}`;

                      return (
                        <SlimProductCard
                          key={uniqueKey}
                          item={{
                            ...item,
                            displayId: uniqueKey, // For React key purposes
                            id: item.id, // Keep the original ID for database operations
                          }}
                          actionType="sell"
                          onAction={handleSell}
                          storePrice={inventoryStorePrices[item.id]}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Store;
