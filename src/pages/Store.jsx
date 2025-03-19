import { useState, useEffect } from 'react';
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
    if (!player || !store) return;

    try {
      const result = await buyRecord(
        player.id,
        gameId,
        store.id,
        productId,
        quantity
      );

      if (result.success) {
        toast.success(result.message);
        // Refresh inventory
        loadStoreData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error buying record:', error);
      toast.error('Failed to complete purchase');
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

  const handleSkip = (productId) => {
    const productIndex = storeInventory.findIndex(
      (item) => (item.products?.id || item.product_id) === productId
    );

    if (productIndex === currentIndex) {
      setDirection('left');
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % storeInventory.length);
        setDirection(null);
      }, 300);
    }

    toast.info('Skipped record');
  };

  const handleLike = (productId) => {
    const product = storeInventory.find(
      (item) => (item.products?.id || item.product_id) === productId
    );

    if (product) {
      handleBuy(productId, 1);
    }

    setDirection('right');
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % storeInventory.length);
      setDirection(null);
    }, 300);

    toast.success('You liked this record!');
  };

  const toggleViewMode = () => {
    setSwipeMode(!swipeMode);
    if (!swipeMode) {
      setCurrentIndex(0);
    }
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

        {/* Inventory Display */}
        <div className="bg-white shadow-md mb-4 rounded-lg overflow-hidden">
          <div className="p-4">
            {buyMode ? (
              <div className="space-y-4">
                {storeInventory.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-4">
                    No records available in this store
                  </p>
                ) : (
                  <div className="swipe-container">
                    {storeInventory.length > 0 && (
                      <>
                        <div className="swipe-counter">
                          {currentIndex + 1} of {storeInventory.length}
                        </div>
                        <AnimatePresence>
                          <motion.div
                            key={storeInventory[currentIndex]?.id}
                            initial={{
                              x:
                                direction === 'left'
                                  ? -300
                                  : direction === 'right'
                                  ? 300
                                  : 0,
                              opacity: 0,
                            }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{
                              x:
                                direction === 'left'
                                  ? 300
                                  : direction === 'right'
                                  ? -300
                                  : 0,
                              opacity: 0,
                            }}
                            transition={{ duration: 0.3 }}
                            className="swipe-card-container"
                          >
                            <ProductCard
                              product={{
                                id:
                                  storeInventory[currentIndex].products?.id ||
                                  storeInventory[currentIndex].product_id,
                                name:
                                  storeInventory[currentIndex].products?.name ||
                                  'Unknown Record',
                                artist:
                                  storeInventory[currentIndex].products
                                    ?.artist || 'Unknown Artist',
                                genre:
                                  storeInventory[currentIndex].products
                                    ?.genre || 'Various',
                                year:
                                  storeInventory[currentIndex].products?.year ||
                                  'N/A',
                                condition:
                                  storeInventory[currentIndex].products
                                    ?.condition || 'Unknown',
                                rarity:
                                  storeInventory[currentIndex].products
                                    ?.rarity || 0.5,
                                description:
                                  storeInventory[currentIndex].products
                                    ?.description || '',
                              }}
                              price={storeInventory[currentIndex].current_price}
                              quantity={storeInventory[currentIndex].quantity}
                              onBuy={handleBuy}
                              onSkip={handleSkip}
                              onLike={handleLike}
                              actionLabel="Buy"
                              showAction={true}
                            />
                          </motion.div>
                        </AnimatePresence>
                      </>
                    )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {playerInventory.map((item) => (
                      <ProductCard
                        key={item.id}
                        product={{
                          id: item.product_id,
                          name: item.products?.name || 'Unknown Record',
                          artist: item.products?.artist || 'Unknown Artist',
                          genre: item.products?.genre || 'Various',
                          year: item.products?.year || 'N/A',
                          condition: item.products?.condition || 'Unknown',
                          rarity: item.products?.rarity || 0.5,
                          description: item.products?.description || '',
                        }}
                        price={
                          item.estimated_current_price || item.purchase_price
                        }
                        quantity={item.quantity}
                        onSell={handleSell}
                        purchasePrice={item.purchase_price}
                        estimatedValue={item.estimated_current_price}
                        actionLabel="Sell"
                        showAction={true}
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
