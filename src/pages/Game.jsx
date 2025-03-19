// src/pages/Game.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FaMapMarkedAlt,
  FaSpinner,
  FaRecordVinyl,
  FaStore,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useGame } from '../contexts/GameContext';
import {
  getGameState,
  advanceGameHour,
  getPlayerActions,
} from '../lib/gameActions';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import StoreCard from '../components/ui/StoreCard';

const Game = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { player, playerId, refreshPlayerData, currentGame } = useGame();

  // State management
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [boroughStores, setBoroughStores] = useState([]);
  const [loadingGameState, setLoadingGameState] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentBoroughName, setCurrentBoroughName] =
    useState('Unknown Location');
  const [playerActions, setPlayerActions] = useState({
    actions_used: 0,
    actions_available: 4,
  });

  useEffect(() => {
    if (playerId) {
      // Check if we need to refresh data after returning from travel
      const needsRefresh = location.state?.refresh || false;

      // Load game data using gameActions
      loadGameData(needsRefresh);

      // If we just came from travel, show a toast notification
      if (location.state?.fromTravel) {
        toast.success(`You're now in ${location.state.destinationName}`);
        // Clear the state to prevent showing the toast again on manual refresh
        navigate(location.pathname, { replace: true });
      }
    }
  }, [gameId, playerId, location]);

  const loadGameData = async (forceRefresh = false) => {
    try {
      setLoadingGameState(true);

      // Get the game and player information
      let playerId;

      // First try to get player ID from context
      if (player?.id) {
        playerId = player.id;
        console.log('Using player ID from context:', playerId);
      } else {
        // Fall back to localStorage
        const storedPlayerId = localStorage.getItem(`player_${gameId}`);
        if (!storedPlayerId) {
          console.error('No player ID found in localStorage');
          toast.error('Could not find your player in this game');
          navigate('/');
          return;
        }
        playerId = storedPlayerId;
        console.log('Using player ID from localStorage:', playerId);
      }

      // If we have a refresh flag, refresh the player data in context first
      if ((forceRefresh || location.state?.refresh) && refreshPlayerData) {
        console.log('Forcing player data refresh');
        await refreshPlayerData();
      }

      // Now use our gameActions functions to get all the data we need
      const gameStateData = await getGameState(playerId, gameId);

      if (gameStateData && !gameStateData.error) {
        setGameState(gameStateData.game);
        setPlayerState(gameStateData.playerState);
        setBoroughStores(gameStateData.boroughStores);

        // Fetch player actions for the current hour
        if (gameStateData.game && gameStateData.game.current_hour) {
          try {
            const actionsData = await getPlayerActions(
              playerId,
              gameId,
              gameStateData.game.current_hour
            );

            if (actionsData) {
              setPlayerActions(actionsData);
            }
          } catch (actionError) {
            console.warn('Could not fetch player actions:', actionError);
            // Use default action values
            setPlayerActions({ actions_used: 0, actions_available: 4 });
          }
        }

        // Update the current borough name - First check the context player data
        if (player && player.current_borough) {
          console.log(
            'Setting borough name from context:',
            player.current_borough
          );
          setCurrentBoroughName(player.current_borough);
        }
        // Then check the player state from gameActions
        else if (
          gameStateData.playerState &&
          gameStateData.playerState.current_borough
        ) {
          console.log(
            'Setting borough name from playerState:',
            gameStateData.playerState.current_borough
          );
          setCurrentBoroughName(gameStateData.playerState.current_borough);
        }
        // If still not found, try to get borough name from the borough ID
        else if (gameStateData.playerState?.current_borough_id) {
          const currentBorough = await getCurrentBoroughName(
            gameStateData.playerState.current_borough_id
          );
          console.log('Setting borough name via lookup:', currentBorough);
          setCurrentBoroughName(currentBorough || 'Unknown Location');
        } else {
          console.log('No borough information found');
          setCurrentBoroughName('Unknown Location');
        }
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

  // Helper function to get borough name if it's not in the player state
  const getCurrentBoroughName = async (boroughId) => {
    if (!boroughId) return 'Unknown Location';

    try {
      const { data, error } = await supabase
        .from('boroughs')
        .select('name')
        .eq('id', boroughId)
        .single();

      if (error) throw error;
      return data?.name || 'Unknown Location';
    } catch (err) {
      console.error('Error fetching borough name:', err);
      return 'Unknown Location';
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-xl mx-auto p-4 mt-4">
        {/* Header Row with Downtown and Travel */}
        <div className="header-row">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold">Downtown</h1>
          </div>

          <button onClick={goToTravel} className="travel-button">
            <FaMapMarkedAlt className="mr-2" /> Travel
          </button>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Record Stores
        </h2>

        {boroughStores.length === 0 ? (
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <FaStore className="mx-auto text-gray-400 text-4xl mb-2" />
            <p className="text-gray-500">No record stores in this borough.</p>
            <p className="text-sm text-gray-400 mt-2">
              Try traveling to another borough
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {boroughStores.map((store) => {
              // Calculate if store is open
              const currentHour = currentGame
                ? (24 - currentGame.current_hour) % 24
                : 0;
              const isOpen =
                currentHour >= store.open_hour &&
                currentHour < store.close_hour;

              return (
                <StoreCard
                  key={store.id}
                  store={store}
                  isOpen={isOpen}
                  formatTime={formatTime}
                  onClick={() => goToStore(store.id)}
                />
              );
            })}
          </div>
        )}

        {/* End Turn Section */}
        <div className="mt-12 flex flex-col items-center">
          <div className="text-center mb-6"></div>

          <Button
            onClick={handleEndTurn}
            disabled={submitting}
            variant="primary"
            size="lg"
            fullWidth
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin mr-2" /> Processing...
              </>
            ) : (
              'End Turn'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Game;
