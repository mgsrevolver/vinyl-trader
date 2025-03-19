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
        <div
          style={{
            display: 'flex',
            width: '100%',
            marginBottom: '16px',
            marginTop: '16px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #d1d5db',
          }}
        >
          <button
            onClick={() => setBuyMode(true)}
            style={{
              flex: 1,
              backgroundColor: buyMode ? '#f59e0b' : '#e5e7eb',
              color: buyMode ? 'black' : '#6b7280',
              padding: '12px 16px',
              fontWeight: buyMode ? 600 : 500,
              fontSize: '16px',
              border: 'none',
              borderRight: '1px solid #d1d5db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <FaShoppingCart style={{ marginRight: '8px' }} />
            Buy
          </button>

          <button
            onClick={() => setBuyMode(false)}
            style={{
              flex: 1,
              backgroundColor: !buyMode ? '#f59e0b' : '#e5e7eb',
              color: !buyMode ? 'black' : '#6b7280',
              padding: '12px 16px',
              fontWeight: !buyMode ? 600 : 500,
              fontSize: '16px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <FaShoppingBag style={{ marginRight: '8px' }} />
            Sell
          </button>
        </div>

        {/* Inventory Display */}
        <div className="bg-white shadow-md mb-4 rounded-lg">
          <div className="p-4">
            {buyMode ? (
              <div className="space-y-4">
                {storeInventory.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-4">
                    No records available in this store
                  </p>
                ) : (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(1, 1fr)',
                      gap: '16px',
                    }}
                  >
                    {storeInventory.map((item) => {
                      console.log('Rendering item:', item); // Debug log
                      return (
                        <ProductCard
                          key={item.id}
                          product={{
                            id: item.products?.id || item.product_id,
                            name: item.products?.name || 'Unknown Record',
                            artist: item.products?.artist || 'Unknown Artist',
                            genre: item.products?.genre || 'Various',
                            year: item.products?.year || 'N/A',
                            condition: item.products?.condition || 'Unknown',
                            rarity: item.products?.rarity || 0.5,
                            description: item.products?.description || '',
                          }}
                          price={item.current_price}
                          quantity={item.quantity}
                          onBuy={handleBuy}
                          actionLabel="Buy"
                          showAction={true}
                        />
                      );
                    })}
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
