// src/pages/Game.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaStore,
  FaMapMarkedAlt,
  FaWarehouse,
  FaMoneyBillWave,
  FaSpinner,
  FaClock,
  FaArrowRight,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useGame } from '../contexts/GameContext';
import {
  getGameState,
  getBoroughStores,
  advanceGameHour,
} from '../lib/gameActions';
import { supabase } from '../lib/supabase';

const Game = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { player, playerId } = useGame();

  // State management
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [boroughStores, setBoroughStores] = useState([]);
  const [loadingGameState, setLoadingGameState] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (playerId) {
      // Load game data using gameActions
      loadGameData();
    }
  }, [gameId, playerId]);

  const loadGameData = async () => {
    try {
      setLoadingGameState(true);

      // Get playerId from localStorage using gameId
      const storedPlayerId = localStorage.getItem(`player_${gameId}`);

      if (!storedPlayerId) {
        console.error('No player ID found in localStorage');
        toast.error('Could not find your player in this game');
        navigate('/');
        return;
      }

      console.log('Using player ID from localStorage:', storedPlayerId);

      // Now use our gameActions functions to get all the data we need
      const gameStateData = await getGameState(storedPlayerId, gameId);

      if (gameStateData && !gameStateData.error) {
        setGameState(gameStateData.game);
        setPlayerState(gameStateData.playerState);
        setBoroughStores(gameStateData.boroughStores);
      } else {
        console.error('Error loading game state:', gameStateData?.error);
        toast.error('Failed to load game data. Please try again.');
      }
    } catch (error) {
      console.error('Error in loadGameData:', error);
      toast.error('An unexpected error occurred loading game data.');
    } finally {
      setLoadingGameState(false);
    }
  };

  const handleEndTurn = async () => {
    try {
      setSubmitting(true);

      // Attempt to advance the game hour
      const advanced = await advanceGameHour(gameId);

      if (!advanced) {
        toast.error('Unable to advance game. The game may have ended.');
        setSubmitting(false);
        return;
      }

      // Refresh game data after advancing hour
      await loadGameData();
      toast.success('Turn completed! Game advanced to the next hour.');
    } catch (error) {
      console.error('Error ending turn:', error);
      toast.error('An error occurred while ending your turn.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToStore = (storeId) => {
    if (!playerState) {
      toast.error('Player information not loaded yet');
      return;
    }

    if (!playerState.current_borough_id) {
      toast.error('Unable to determine your current location');
      return;
    }

    navigate(`/store/${gameId}/${playerState.current_borough_id}/${storeId}`);
  };

  const goToTravel = () => {
    navigate(`/travel/${gameId}`);
  };

  // Format time to 12-hour format
  const formatTime = (hour) => {
    if (hour === null || hour === undefined) return 'N/A';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  };

  if (loadingGameState || !gameState || !playerState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl mx-auto text-blue-600 mb-3" />
          <p className="text-blue-900 font-semibold">Loading game data...</p>
        </div>
      </div>
    );
  }

  // Get current borough name
  const currentBoroughName = playerState.current_borough || 'Unknown Location';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Borough Header */}
      <div className="bg-blue-600 text-white p-6 shadow-md">
        <h1 className="text-2xl font-bold text-center">{currentBoroughName}</h1>
        <div className="text-sm text-center opacity-80 mt-1">
          Game Hour: {gameState.current_hour} / {gameState.max_hours}
        </div>
      </div>

      {/* Stores in Borough */}
      <div className="max-w-xl mx-auto p-4 mt-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Record Stores in {currentBoroughName}
        </h2>

        {boroughStores.length === 0 ? (
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No record stores in this borough.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {boroughStores.map((store) => (
              <div
                key={store.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
                onClick={() => goToStore(store.id)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-lg">{store.name}</h3>
                  <FaArrowRight className="text-blue-600" />
                </div>

                <div className="mt-2 text-sm text-gray-600 grid grid-cols-2 gap-2">
                  <div className="flex items-center">
                    <FaClock className="mr-2 text-gray-400" />
                    {formatTime(store.open_hour)} -{' '}
                    {formatTime(store.close_hour)}
                  </div>
                  <div>Specialty: {store.specialty_genre || 'Various'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={goToTravel}
              className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors shadow-sm"
            >
              <FaMapMarkedAlt className="text-3xl text-blue-600 mb-2" />
              <span className="font-medium">Travel</span>
              <span className="text-xs text-gray-600 mt-1">
                Visit other neighborhoods
              </span>
            </button>

            <button
              onClick={() =>
                goToStore(boroughStores.length > 0 ? boroughStores[0].id : null)
              }
              className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors shadow-sm"
              disabled={boroughStores.length === 0}
            >
              <FaStore className="text-3xl text-blue-600 mb-2" />
              <span className="font-medium">Store</span>
              <span className="text-xs text-gray-600 mt-1">
                Buy and sell records
              </span>
            </button>

            <button className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors shadow-sm">
              <FaWarehouse className="text-3xl text-blue-600 mb-2" />
              <span className="font-medium">Inventory</span>
              <span className="text-xs text-gray-600 mt-1">
                Manage your products
              </span>
            </button>

            <button className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors shadow-sm">
              <FaMoneyBillWave className="text-3xl text-blue-600 mb-2" />
              <span className="font-medium">Bank</span>
              <span className="text-xs text-gray-600 mt-1">
                Manage loans and cash
              </span>
            </button>
          </div>

          {/* End Turn Button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleEndTurn}
              disabled={submitting}
              className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2" /> Processing...
                </span>
              ) : (
                'End Turn'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
