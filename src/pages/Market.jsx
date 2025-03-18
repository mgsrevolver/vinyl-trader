// src/pages/Market.jsx
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaShoppingCart,
  FaBoxOpen,
  FaPlus,
  FaMinus,
  FaSpinner,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import { getBoroughStores, getStoreInventory } from '../lib/gameActions';

const Market = () => {
  const { gameId, neighborhoodId, storeName } = useParams();
  const navigate = useNavigate();
  const {
    currentGame,
    player,
    playerInventory,
    loadGame,
    buyProduct,
    sellProduct,
    loading,
  } = useGame();

  const [marketItems, setMarketItems] = useState([]);
  const [activeTab, setActiveTab] = useState('buy'); // 'buy' or 'sell'
  const [marketLoading, setMarketLoading] = useState(true);
  const [neighborhood, setNeighborhood] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState({});
  const [sellQuantity, setSellQuantity] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gameId || !neighborhoodId) {
      navigate(`/game/${gameId}`);
      return;
    }

    const initMarket = async () => {
      try {
        setMarketLoading(true);

        // 1. Fetch the borough (not neighborhood) data
        const { data: borough, error: boroughError } = await supabase
          .from('boroughs') // Use boroughs instead of neighborhoods
          .select('*')
          .eq('id', neighborhoodId) // Use whatever parameter name your component has
          .single();

        if (boroughError) {
          console.error('Error fetching borough:', boroughError);
          setError('Failed to load location data');
          return;
        }

        setNeighborhood(borough); // Store in state (even if named neighborhood)

        // 2. Fetch the stores in this borough using getBoroughStores from gameActions
        const storeData = await getBoroughStores(neighborhoodId);

        if (!storeData || storeData.length === 0) {
          setError('No stores found in this location');
          return;
        }

        setStores(storeData);

        // If you need a specific store:
        const selectedStore = storeData.find(
          (store) =>
            store.name === decodeURIComponent(storeName) ||
            store.id === neighborhoodId // Or whatever identifier you use
        );

        if (selectedStore) {
          setSelectedStore(selectedStore);

          // 3. Load store inventory using getStoreInventory from gameActions
          const { items, error } = await getStoreInventory(
            selectedStore.id,
            gameId
          );

          if (error) {
            console.error('Error loading inventory:', error);
            setError('Failed to load store inventory');
            return;
          }

          setMarketItems(items);
        }
      } catch (error) {
        console.error('Error initializing market:', error);
        setError('An unexpected error occurred');
      } finally {
        setMarketLoading(false);
      }
    };

    initMarket();
  }, [gameId, neighborhoodId, loadGame, navigate]);

  // When a store is selected, load its inventory
  useEffect(() => {
    if (selectedStore) {
      fetchMarketInventory(selectedStore.id);
    }
  }, [selectedStore]);

  const fetchMarketInventory = async (storeId) => {
    try {
      setMarketLoading(true);

      // Get market inventory for this game, neighborhood and store
      const { data, error } = await supabase
        .from('market_inventory')
        .select(
          `
          id,
          quantity,
          current_price,
          products:product_id (
            id,
            name,
            description,
            base_price,
            space_required
          )
        `
        )
        .eq('game_id', gameId)
        .eq('neighborhood_id', neighborhoodId)
        .eq('store_id', storeId);

      if (error) throw error;

      // Initialize purchase quantities
      const quantities = {};
      data.forEach((item) => {
        quantities[item.id] = 0;
      });
      setPurchaseQuantity(quantities);

      // Initialize sell quantities
      const sellQty = {};
      playerInventory.forEach((item) => {
        sellQty[item.id] = 0;
      });
      setSellQuantity(sellQty);

      setMarketItems(data);
    } catch (err) {
      console.error('Error fetching market inventory:', err);
      toast.error('Failed to load market inventory');
    } finally {
      setMarketLoading(false);
    }
  };

  const handleBuy = async (item) => {
    if (!item || purchaseQuantity[item.id] <= 0) return;

    const qty = purchaseQuantity[item.id];
    const result = await buyProduct(
      item.products.id,
      qty,
      selectedStore.id,
      neighborhoodId
    );

    if (result.success) {
      // Reset quantity after purchase
      setPurchaseQuantity({
        ...purchaseQuantity,
        [item.id]: 0,
      });

      // Refresh market data
      fetchMarketInventory(selectedStore.id);
    }
  };

  const handleSell = async (inventoryItem) => {
    if (!inventoryItem || sellQuantity[inventoryItem.id] <= 0) return;

    const qty = sellQuantity[inventoryItem.id];
    const result = await sellProduct(inventoryItem.id, qty, neighborhoodId);

    if (result.success) {
      // Reset quantity after sale
      setSellQuantity({
        ...sellQuantity,
        [inventoryItem.id]: 0,
      });

      // Refresh market data
      fetchMarketInventory(selectedStore.id);
    }
  };

  const incrementPurchase = (itemId) => {
    const item = marketItems.find((i) => i.id === itemId);
    if (!item) return;

    // Check if we have enough money
    const newQty = (purchaseQuantity[itemId] || 0) + 1;
    const totalCost = newQty * item.current_price;

    if (totalCost > player.cash) {
      toast.error("You don't have enough money for that");
      return;
    }

    // Check if there's enough quantity available
    if (newQty > item.quantity) {
      toast.error('Not enough stock available');
      return;
    }

    setPurchaseQuantity({
      ...purchaseQuantity,
      [itemId]: newQty,
    });
  };

  const decrementPurchase = (itemId) => {
    const currentQty = purchaseQuantity[itemId] || 0;
    if (currentQty <= 0) return;

    setPurchaseQuantity({
      ...purchaseQuantity,
      [itemId]: currentQty - 1,
    });
  };

  const incrementSell = (itemId) => {
    const item = playerInventory.find((i) => i.id === itemId);
    if (!item) return;

    const newQty = (sellQuantity[itemId] || 0) + 1;

    // Check if we have enough quantity to sell
    if (newQty > item.quantity) {
      toast.error("You don't have enough of this item");
      return;
    }

    setSellQuantity({
      ...sellQuantity,
      [itemId]: newQty,
    });
  };

  const decrementSell = (itemId) => {
    const currentQty = sellQuantity[itemId] || 0;
    if (currentQty <= 0) return;

    setSellQuantity({
      ...sellQuantity,
      [itemId]: currentQty - 1,
    });
  };

  const formatMoney = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  if (!player || !currentGame) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Loading game data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Game Jam Banner */}
      <a
        target="_blank"
        href="https://jam.pieter.com"
        style={{
          fontFamily: "'system-ui', sans-serif",
          position: 'fixed',
          bottom: '-1px',
          right: '-1px',
          padding: '7px',
          fontSize: '14px',
          fontWeight: 'bold',
          background: '#fff',
          color: '#000',
          textDecoration: 'none',
          zIndex: 10,
          borderTopLeftRadius: '12px',
          border: '1px solid #fff',
        }}
      >
        🕹️ Vibe Jam 2025
      </a>

      {/* Header */}
      <header className="bg-white shadow-md p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center">
            <Link
              to={`/game/${gameId}`}
              className="mr-4 text-blue-600 hover:text-blue-800"
            >
              <FaArrowLeft />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-blue-700">
                {neighborhood?.name || 'Market'} -{' '}
                {decodeURIComponent(storeName)}
              </h1>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  Day {currentGame.current_day}/{currentGame.max_days}
                </span>
                <span className="mx-2">•</span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  {formatMoney(player.cash)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-4 mt-4">
        {/* Store selector */}
        {stores.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="font-medium mb-2">Select a Store:</h2>
            <div className="flex flex-wrap gap-2">
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                  className={`px-3 py-2 rounded-md text-sm ${
                    selectedStore?.id === store.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {store.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('buy')}
              className={`flex-1 py-3 font-medium ${
                activeTab === 'buy'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FaShoppingCart className="inline mr-2" /> Buy Products
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`flex-1 py-3 font-medium ${
                activeTab === 'sell'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FaBoxOpen className="inline mr-2" /> Sell Inventory
            </button>
          </div>

          {/* Buy Tab */}
          {activeTab === 'buy' && (
            <div className="p-4">
              <h2 className="text-lg font-medium mb-4">Available Products</h2>

              {marketLoading ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="animate-spin text-blue-600 text-2xl" />
                </div>
              ) : marketItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No products available in this market.
                </div>
              ) : (
                <div className="space-y-4">
                  {marketItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                        <div className="mb-3 sm:mb-0">
                          <h3 className="font-medium">{item.products.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.products.description}
                          </p>
                          <div className="mt-1 flex items-center space-x-3 text-sm">
                            <span className="text-blue-700 font-medium">
                              {formatMoney(item.current_price)} each
                            </span>
                            <span className="text-gray-600">
                              Available: {item.quantity}
                            </span>
                            <span className="text-gray-600">
                              Space: {item.products.space_required}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <div className="flex items-center border rounded-l-md">
                            <button
                              onClick={() => decrementPurchase(item.id)}
                              className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-l-md"
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className="px-3 py-2 bg-white min-w-[40px] text-center">
                              {purchaseQuantity[item.id] || 0}
                            </span>
                            <button
                              onClick={() => incrementPurchase(item.id)}
                              className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={
                              loading || (purchaseQuantity[item.id] || 0) === 0
                            }
                            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading ? (
                              <FaSpinner className="animate-spin" />
                            ) : (
                              'Buy'
                            )}
                          </button>
                        </div>
                      </div>

                      {(purchaseQuantity[item.id] || 0) > 0 && (
                        <div className="mt-3 text-right text-sm">
                          Total:{' '}
                          {formatMoney(
                            item.current_price * purchaseQuantity[item.id]
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sell Tab */}
          {activeTab === 'sell' && (
            <div className="p-4">
              <h2 className="text-lg font-medium mb-4">Your Inventory</h2>

              {marketLoading ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="animate-spin text-blue-600 text-2xl" />
                </div>
              ) : playerInventory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Your inventory is empty.
                </div>
              ) : (
                <div className="space-y-4">
                  {playerInventory.map((item) => {
                    // Find current market price for this product
                    const marketItem = marketItems.find(
                      (m) => m.products.id === item.product_id
                    );
                    const currentPrice = marketItem?.current_price || 0;

                    return (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                          <div className="mb-3 sm:mb-0">
                            <h3 className="font-medium">
                              {item.products?.name || 'Unknown Product'}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {item.products?.description ||
                                'No description available'}
                            </p>
                            <div className="mt-1 flex items-center space-x-3 text-sm">
                              <span className="text-blue-700 font-medium">
                                Current price: {formatMoney(currentPrice)}
                              </span>
                              <span className="text-gray-600">
                                You paid: {formatMoney(item.purchase_price)}
                              </span>
                              <span
                                className={`font-medium ${
                                  currentPrice > item.purchase_price
                                    ? 'text-green-700'
                                    : currentPrice < item.purchase_price
                                    ? 'text-red-700'
                                    : 'text-gray-700'
                                }`}
                              >
                                {currentPrice > item.purchase_price
                                  ? `Profit: ${formatMoney(
                                      currentPrice - item.purchase_price
                                    )}`
                                  : currentPrice < item.purchase_price
                                  ? `Loss: ${formatMoney(
                                      item.purchase_price - currentPrice
                                    )}`
                                  : 'Break even'}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              Quantity: {item.quantity}
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className="flex items-center border rounded-l-md">
                              <button
                                onClick={() => decrementSell(item.id)}
                                className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-l-md"
                              >
                                <FaMinus size={12} />
                              </button>
                              <span className="px-3 py-2 bg-white min-w-[40px] text-center">
                                {sellQuantity[item.id] || 0}
                              </span>
                              <button
                                onClick={() => incrementSell(item.id)}
                                className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                <FaPlus size={12} />
                              </button>
                            </div>
                            <button
                              onClick={() => handleSell(item)}
                              disabled={
                                loading ||
                                (sellQuantity[item.id] || 0) === 0 ||
                                !marketItem
                              }
                              className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? (
                                <FaSpinner className="animate-spin" />
                              ) : (
                                'Sell'
                              )}
                            </button>
                          </div>
                        </div>

                        {(sellQuantity[item.id] || 0) > 0 && (
                          <div className="mt-3 text-right text-sm">
                            Total:{' '}
                            {formatMoney(currentPrice * sellQuantity[item.id])}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Market;
