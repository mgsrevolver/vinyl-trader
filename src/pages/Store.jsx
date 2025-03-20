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
import { getStoreInventory, buyRecord, sellRecord } from '../lib/gameActions';
import ActionButton from '../components/ui/ActionButton';
import ProductCard from '../components/ui/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import SlimProductCard from '../components/ui/SlimProductCard';

const Store = () => {
  const { gameId, boroughId, storeId } = useParams();
  const navigate = useNavigate();
  const { player, playerInventory, loading: gameLoading } = useGame();

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
  const [listView, setListView] = useState(false);

  useEffect(() => {
    if (gameId && boroughId && storeId) {
      loadStoreData();
    } else {
      setError('Missing required parameters');
      setLoading(false);
    }
  }, [gameId, boroughId, storeId]);

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

        setStoreInventory(inventoryResult.items || []);
        console.log('Store inventory loaded:', inventoryResult.items);
      }
    } catch (error) {
      console.error('Error loading store data:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
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
        loadStoreData();
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

      if (result) {
        toast.success('Record sold successfully!');
        // Refresh inventory
        loadStoreData();
      } else {
        toast.error('Failed to sell record');
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
                        id: item.id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        products: {
                          id: item.product_id,
                          name: item.products?.name || 'Unknown Record',
                          artist: item.products?.artist || 'Unknown Artist',
                          genre: item.products?.genre || 'Various',
                          year: item.products?.year || 'N/A',
                          condition: item.products?.condition || 'Unknown',
                          rarity: item.products?.rarity || 0.5,
                          description: item.products?.description || '',
                          image_url: item.products?.image_url || null,
                        },
                        estimated_current_price: item.current_price,
                      };

                      return (
                        <SlimProductCard
                          key={item.id}
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
                            condition:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.condition || 'Unknown',
                            rarity:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.rarity || 0.5,
                            image_url:
                              storeInventory[getNextCardIndex(currentIndex)]
                                ?.products?.image_url || null,
                          }}
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
                            condition:
                              storeInventory[currentIndex]?.products
                                ?.condition || 'Unknown',
                            rarity:
                              storeInventory[currentIndex]?.products?.rarity ||
                              0.5,
                            image_url:
                              storeInventory[currentIndex]?.products
                                ?.image_url || null,
                          }}
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
                    {playerInventory.map((item) => (
                      <SlimProductCard
                        key={item.id}
                        item={item}
                        actionType="sell"
                        onAction={handleSell}
                      />
                    ))}
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
