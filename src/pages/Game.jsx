import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Game = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    if (!gameId || !user) return;

    const loadGameData = async () => {
      try {
        setLoading(true);

        // Load game data
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;
        setGame(gameData);

        // Load player data
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .single();

        if (playerError) {
          if (playerError.code === 'PGRST116') {
            // Player not found in this game, redirect to dashboard
            toast.error("You're not part of this game!");
            navigate('/dashboard');
            return;
          }
          throw playerError;
        }

        setPlayer(playerData);
      } catch (error) {
        console.error('Error loading game data:', error);
        toast.error(`Error: ${error.message}`);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading game...</p>
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
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-display font-bold text-primary-700 mt-1">
              {game?.name}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Day <span className="font-semibold">{game?.current_day}</span> of{' '}
              {game?.max_days}
            </div>

            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              ${player?.cash.toFixed(2)}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Game Dashboard</h2>
          <p className="text-gray-600">
            This is a placeholder for the main game interface. Your current
            location: {player?.location}
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Player Stats</h3>
              <div className="text-sm text-gray-600">
                <p>Cash: ${player?.cash.toFixed(2)}</p>
                <p>Loan: ${player?.loan_amount.toFixed(2)}</p>
                <p>Interest Rate: {player?.loan_interest_rate}%</p>
                <p>Inventory Capacity: {player?.inventory_capacity} units</p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Location</h3>
              <p className="text-sm text-gray-600">
                You are currently in {player?.location}
              </p>
              <button className="mt-3 btn btn-primary text-sm">
                Travel to Another Neighborhood
              </button>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Market</h3>
              <p className="text-sm text-gray-600">
                Visit the market to buy and sell products.
              </p>
              <Link
                to={`/market/${gameId}/placeholder`}
                className="mt-3 btn btn-primary text-sm block text-center"
              >
                Go to Market
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Game;
