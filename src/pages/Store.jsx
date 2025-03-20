import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (gameId && boroughId && storeId) {
      loadStoreData();
    } else {
      setError('Missing required parameters');
      setLoading(false);
    }
  }, [gameId, boroughId, storeId]);

  useEffect(() => {
    if (!buyMode && playerInventory?.length > 0 && store) {
      loadInventoryStorePrices();
    }
  }, [buyMode, playerInventory, store]);

  const loadStoreData = async () => {
    try {
      setLoading(true);
      console.log('Loading store data with:', { gameId, boroughId, storeId });

      // 1. Fetch the borough
      const { data: boroughData, error: boroughError } = await supabase
        .from('boroughs')
        .select('*')
        .eq('id', boroughId)
        .single();

      if (boroughError) {
        console.error('Error fetching borough:', boroughError);
        setError('Could not load location information');
        return;
      }

      setBorough(boroughData);
      console.log('Borough loaded:', boroughData);

      // 2. Fetch the specific store
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .eq('borough_id', boroughId)
        .single();

      if (storeError) {
        console.error('Error fetching store:', storeError);

        // If we can't find the specific store, try to get any store in this borough
        const { data: anyStore, error: anyStoreError } = await supabase
          .from('stores')
          .select('*')
          .eq('borough_id', boroughId)
          .limit(1)
          .single();

        if (anyStoreError) {
          console.error('Error fetching any store in borough:', anyStoreError);
          setError('No stores found in this location');
          return;
        }

        setStore(anyStore);
        console.log('Using alternative store:', anyStore);
      } else {
        setStore(storeData);
        console.log('Store loaded:', storeData);
      }

      // 3. Load the store inventory using the store we found
      const currentStore = storeData || store;
      if (currentStore) {
        const inventoryResult = await getStoreInventory(
          currentStore.id,
          gameId
        );

        if (inventoryResult.error) {
          console.error('Error loading inventory:', inventoryResult.error);
          setError('Could not load store inventory');
          return;
        }

        // Explode inventory items with quantity > 1 into individual items
        let expandedInventory = [];

        (inventoryResult.items || []).forEach((item) => {
          // Create individual cards for each copy of the record
          for (let i = 0; i < item.quantity; i++) {
            expandedInventory.push({
              ...item,
              // Give each copy a unique ID by appending index
              uniqueId: `${item.id}-${i}`,
              // Set quantity to 1 since we're treating each as a separate item
              quantity: 1,
            });
          }
        });

        setStoreInventory(expandedInventory);
        console.log('Store inventory loaded:', expandedInventory);
      }
    } catch (error) {
      console.error('Error loading store data:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryStorePrices = async () => {
    if (!store || !playerInventory?.length) return;

    // Get all product IDs from player inventory
    const productIds = playerInventory.map((item) => item.product_id);

    try {
      // Use the getSellPrices function from gameActions.js
      const priceMap = await getSellPrices(store.id, gameId, productIds);

      setInventoryStorePrices(priceMap);
      console.log('Store sell prices loaded:', priceMap);
    } catch (error) {
      console.error('Error fetching store prices:', error);
    }
  };

  const handleBuy = async (productId, quantity = 1) => {
    if (!player) return;

    // Make sure storeId is available, or use store.id as fallback
    const currentStoreId = storeId || (store && store.id);

    if (!currentStoreId) {
      toast.error('Store information is missing');
      return;
    }

    try {
      // Find the record being purchased to get its price
      const recordToBuy = storeInventory.find(
        (item) =>
          item.products?.id === productId || item.product_id === productId
      );

      if (!recordToBuy) {
        toast.error('Record not found in store inventory');
        return;
      }

      const recordPrice = recordToBuy.current_price;

      // Check if player has enough cash
      if (player.cash < recordPrice) {
        toast.error(`Not enough cash. You need $${Math.round(recordPrice)}.`);
        return;
      }

      console.log('Buying product:', {
        productId,
        quantity,
        storeId: currentStoreId,
      });

      const result = await buyRecord(
        player.id,
        gameId,
        currentStoreId,
        productId,
        quantity
      );

      if (result.success) {
        toast.success('Purchase successful!');
        // Refresh both store AND player inventory
        await loadStoreData();

        // Make sure we refresh the player inventory
        if (refreshPlayerInventory) {
          await refreshPlayerInventory();
        }
      } else {
        const errorMessage =
          result.error?.message || 'Unable to complete purchase';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error buying record:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleSell = async (productId, quantity = 1) => {
    if (!player || !store) return;

    try {
      const result = await sellRecord(
        player.id,
        gameId,
        store.id,
        productId,
        quantity
      );

      if (result.success) {
        toast.success('Record sold successfully!');
        // Refresh both store AND player inventory
        await loadStoreData();

        // Make sure we refresh the player inventory
        if (refreshPlayerInventory) {
          await refreshPlayerInventory();
        }
      } else {
        const errorMessage = result.error?.message || 'Failed to sell record';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error selling record:', error);
      toast.error('Failed to complete sale');
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
    const productId =
      storeInventory[currentIndex]?.products?.id ||
      storeInventory[currentIndex]?.product_id;

    handleBuy(productId, 1);

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
            <button onClick={goBack} className="travel-button">
              <FaArrowLeft className="mr-2" /> Back
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
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md flex items-center"
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
                    {storeInventory.map((item) => {
                      // Transform the storeInventory item to match what SlimProductCard expects
                      const transformedItem = {
                        id: item.uniqueId || item.id,
                        product_id: item.products?.id,
                        quantity: 1, // Force quantity to 1
                        // Pass the condition directly from the market_inventory item
                        condition: item.condition,
                        // Pass quality_rating if needed
                        quality_rating: item.quality_rating,
                        products: {
                          id: item.products?.id,
                          name: item.products?.name || 'Unknown Record',
                          artist: item.products?.artist || 'Unknown Artist',
                          genre: item.products?.genre || 'Various',
                          year: item.products?.year || 'N/A',
                          // Don't pass product.condition here since we're using item.condition
                          rarity: item.products?.rarity || 0.5,
                          description: item.products?.description || '',
                          image_url: item.products?.image_url || null,
                        },
                        estimated_current_price: item.current_price,
                      };

                      return (
                        <SlimProductCard
                          key={item.uniqueId || item.id}
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
                            id:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.id ||
                              storeInventory[getNextCardIndex(currentIndex)]
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
                            id:
                              storeInventory[currentIndex]?.products?.id ||
                              storeInventory[currentIndex]?.product_id,
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
                    {playerInventory.flatMap((item) => {
                      // Create an array of individual items for each quantity
                      return Array.from({ length: item.quantity }, (_, i) => {
                        const individualItem = {
                          ...item,
                          uniqueId: `${item.id}-${i}`,
                          quantity: 1, // Force quantity to 1
                        };

                        return (
                          <SlimProductCard
                            key={individualItem.uniqueId}
                            item={individualItem}
                            actionType="sell"
                            onAction={handleSell}
                            storePrice={inventoryStorePrices[item.product_id]}
                          />
                        );
                      });
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
