import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Market = () => {
  const { gameId, neighborhoodId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);
  const [neighborhood, setNeighborhood] = useState(null);
  const [products, setProducts] = useState([]);
  const [playerInventory, setPlayerInventory] = useState([]);

  useEffect(() => {
    if (!gameId || !user) return;

    const loadMarketData = async () => {
      try {
        setLoading(true);

        // Load player data
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .single();

        if (playerError) {
          if (playerError.code === 'PGRST116') {
            toast.error("You're not part of this game!");
            navigate('/dashboard');
            return;
          }
          throw playerError;
        }

        setPlayer(playerData);

        // Load neighborhood data
        // In a real implementation, you'd get the actual neighborhood from the DB
        setNeighborhood({
          id: neighborhoodId,
          name: playerData.location,
          description: 'A vibrant neighborhood with a variety of goods.',
        });

        // Load market products (placeholder data for now)
        // In a real implementation, you'd get this from market_inventory table
        setProducts([
          {
            id: '1',
            name: 'Artisanal Cheddar',
            price: 15.99,
            quantity: 10,
            description: 'A sharp, locally-sourced cheddar cheese',
          },
          {
            id: '2',
            name: 'Prosciutto di Parma',
            price: 32.5,
            quantity: 5,
            description: 'Aged Italian ham, thinly sliced',
          },
          {
            id: '3',
            name: 'Craft IPA',
            price: 8.99,
            quantity: 20,
            description: 'Special batch from a local brewery',
          },
        ]);

        // Load player inventory (placeholder)
        // In a real implementation, you'd get this from player_inventory table
        setPlayerInventory([
          {
            id: '101',
            product_id: '5',
            product_name: 'Sourdough Bread',
            quantity: 3,
            purchase_price: 4.5,
          },
        ]);
      } catch (error) {
        console.error('Error loading market data:', error);
        toast.error(`Error: ${error.message}`);
        navigate(`/game/${gameId}`);
      } finally {
        setLoading(false);
      }
    };

    loadMarketData();
  }, [gameId, neighborhoodId, user, navigate]);

  const handleBuy = (product) => {
    toast.success(`Buying ${product.name} is not implemented yet`);
    // In a real implementation, this would call the buyProduct function from GameContext
  };

  const handleSell = (inventoryItem) => {
    toast.success(
      `Selling ${inventoryItem.product_name} is not implemented yet`
    );
    // In a real implementation, this would call the sellProduct function from GameContext
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <Link
              to={`/game/${gameId}`}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Game
            </Link>
            <h1 className="text-2xl font-display font-bold text-primary-700 mt-1">
              {neighborhood?.name} Market
            </h1>
          </div>
          <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            ${player?.cash.toFixed(2)}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Products for sale */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Products for Sale</h2>
            {products.length === 0 ? (
              <p className="text-gray-600">
                No products available in this market.
              </p>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-sm text-gray-600">
                        {product.description}
                      </p>
                      <div className="mt-1 flex space-x-4 text-sm">
                        <span className="text-gray-700">
                          Price: ${product.price.toFixed(2)}
                        </span>
                        <span className="text-gray-700">
                          Available: {product.quantity}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBuy(product)}
                      className="btn btn-primary py-1 text-sm"
                    >
                      Buy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player's inventory */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Your Inventory</h2>
            {playerInventory.length === 0 ? (
              <p className="text-gray-600">Your inventory is empty.</p>
            ) : (
              <div className="space-y-4">
                {playerInventory.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 flex justify-between items-center"
                  >
                    <div>
                      <h3 className="font-medium">{item.product_name}</h3>
                      <div className="mt-1 flex space-x-4 text-sm">
                        <span className="text-gray-700">
                          Quantity: {item.quantity}
                        </span>
                        <span className="text-gray-700">
                          Paid: ${item.purchase_price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSell(item)}
                      className="btn btn-primary py-1 text-sm"
                    >
                      Sell
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Market;
