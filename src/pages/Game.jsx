// src/pages/Game.jsx
import { useState, useEffect, useRef } from 'react';
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
import React from 'react';

// Add this outside the component for memoization of store data
const storeCache = {};

const Game = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    player,
    playerId,
    refreshPlayerData,
    currentGame,
    getActionsRemaining,
    useActions,
    advanceGameHour,
    loading: contextLoading,
  } = useGame();

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

  // Create the lastBoroughId ref at the top level of the component
  const lastBoroughId = useRef(null);

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

  // CRITICAL: Add an immediate effect to respond to player data changes
  useEffect(() => {
    if (player) {
      // Aggressively set the borough name whenever player data changes
      if (player.boroughs?.name) {
        setCurrentBoroughName(player.boroughs.name);

        // CRITICAL: When borough changes, we should reload stores for that borough
        // BUT only if we haven't already loaded stores for this borough
        if (
          player.current_borough_id &&
          currentGame?.id &&
          lastBoroughId.current !== player.current_borough_id
        ) {
          lastBoroughId.current = player.current_borough_id;

          // Check cache first
          const cacheKey = `${player.current_borough_id}`;
          if (storeCache[cacheKey]) {
            setBoroughStores(storeCache[cacheKey]);
            return;
          }

          // Directly call getBoroughStores when we know the borough has changed
          const loadStoresForBorough = async () => {
            try {
              const { getBoroughStores } = await import('../lib/gameActions');
              const stores = await getBoroughStores(
                player.current_borough_id,
                currentGame.id
              );

              // Cache the stores
              storeCache[cacheKey] = stores;

              setBoroughStores(stores);
            } catch (error) {
              // Fallback to empty array to prevent UI issues
              setBoroughStores([]);
            }
          };

          loadStoresForBorough();
        }
      } else if (player.current_borough) {
        setCurrentBoroughName(player.current_borough);
      } else if (player.current_borough_id) {
        // Look up the borough name if needed
        getCurrentBoroughName(player.current_borough_id).then((name) => {
          setCurrentBoroughName(name);
        });
      }
    }
  }, [player, currentGame?.id]);

  const loadGameData = async (forceRefresh = false) => {
    try {
      setLoadingGameState(true);

      // Get the game and player information
      let playerId;

      // First try to get player ID from context
      if (player?.id) {
        playerId = player.id;

        // IMMEDIATELY SET BOROUGH NAME FROM CONTEXT if available - this is more reliable
        if (player.boroughs?.name) {
          setCurrentBoroughName(player.boroughs.name);

          // If we already have all the data we need from context, we can avoid the full getGameState call
          if (
            !forceRefresh &&
            currentGame &&
            player &&
            player.current_borough_id
          ) {
            // Just load the stores if needed
            const cacheKey = `${player.current_borough_id}`;
            if (storeCache[cacheKey]) {
              setBoroughStores(storeCache[cacheKey]);
              setLoadingGameState(false);
              return; // Skip the expensive getGameState call
            }
          }
        } else if (player.current_borough) {
          setCurrentBoroughName(player.current_borough);
        }
      } else {
        // Fall back to localStorage
        const storedPlayerId = localStorage.getItem(`player_${gameId}`);
        if (!storedPlayerId) {
          toast.error('Could not find your player in this game');
          navigate('/');
          return;
        }
        playerId = storedPlayerId;
      }

      // If we have a refresh flag, refresh the player data in context first
      if ((forceRefresh || location.state?.refresh) && refreshPlayerData) {
        await refreshPlayerData();
      }

      // Now use our gameActions functions to get all the data we need
      const gameStateData = await getGameState(playerId, gameId);

      if (gameStateData && !gameStateData.error) {
        setGameState(gameStateData.game);
        setPlayerState(gameStateData.playerState);
        setBoroughStores(gameStateData.boroughStores);

        // If we got stores, cache them
        if (
          gameStateData.boroughStores?.length > 0 &&
          gameStateData.playerState?.current_borough_id
        ) {
          const cacheKey = `${gameStateData.playerState.current_borough_id}`;
          storeCache[cacheKey] = gameStateData.boroughStores;
        }

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
            // Use default action values
            setPlayerActions({ actions_used: 0, actions_available: 4 });
          }
        }

        // Only update borough name if we didn't already set it from context
        if (!player?.boroughs?.name && !player?.current_borough) {
          // Update the current borough name - First check the context player data
          if (player && player.current_borough) {
            setCurrentBoroughName(player.current_borough);
          }
          // Then check the player state from gameActions
          else if (gameStateData.playerState?.current_borough) {
            setCurrentBoroughName(gameStateData.playerState.current_borough);
          }
          // If still not found, try to get borough name from the borough ID
          else if (gameStateData.playerState?.current_borough_id) {
            const currentBorough = await getCurrentBoroughName(
              gameStateData.playerState.current_borough_id
            );
            setCurrentBoroughName(currentBorough || 'Unknown Location');
          } else {
            setCurrentBoroughName('Unknown Location');
          }
        }
      } else {
        toast.error('Failed to load game data. Please try again.');
      }
    } catch (error) {
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

      if (error) {
        throw error;
      }
      return data?.name || 'Unknown Location';
    } catch (err) {
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
      toast.error('An error occurred while ending your turn.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToStore = async (storeId) => {
    // First try to use playerState, but fall back to player from context if needed
    const playerData = playerState || player;

    if (!playerData) {
      toast.error('Player information not loaded yet');
      return;
    }

    // Use current_borough_id from either playerState or player context
    const boroughId = playerData.current_borough_id;

    if (!boroughId) {
      toast.error('Unable to determine your current location');
      return;
    }

    // Store visit costs 1 action
    const actionsRemaining = getActionsRemaining();

    if (actionsRemaining >= 1) {
      // Use 1 action
      const { success } = await useActions(1);

      if (success) {
        // Navigate to store
        navigate(`/store/${gameId}/${boroughId}/${storeId}`);
      } else {
        toast.error('Failed to use action');
      }
    } else {
      // Not enough actions - ask to advance hour
      const shouldAdvance = window.confirm(
        `You don't have enough actions left. Would you like to advance to the next hour?`
      );

      if (shouldAdvance) {
        const { success } = await advanceGameHour();
        if (success) {
          // After advancing hour, use action and navigate
          await useActions(1);
          navigate(`/store/${gameId}/${boroughId}/${storeId}`);
        } else {
          toast.error("Couldn't advance to next hour");
        }
      }
    }
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

  const handleLeaveGame = () => {
    // Show confirmation dialog
    if (
      window.confirm(
        'Are you sure you want to leave? You will lose your progress.'
      )
    ) {
      // Navigate back to home
      navigate('/');
      toast('You have left the game');
    }
  };

  // If we're loading from context or don't have essential data, show loading screen
  if (contextLoading || !currentGame || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Loading game data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-xl mx-auto p-4 mt-4">
        {/* Header Row with Borough name and Travel */}
        <div className="header-row">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold font-records">
              {
                player?.boroughs?.name ||
                  player?.current_borough ||
                  currentBoroughName ||
                  'Downtown' /* Default to Downtown rather than Unknown Location */
              }
            </h1>
          </div>

          <button onClick={goToTravel} className="vinyl-travel-button">
            <FaMapMarkedAlt /> Move
          </button>
        </div>

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
            {boroughStores.map((store) => (
              <StoreCard
                key={store.id}
                store={{
                  ...store,
                  nameClass: 'font-records text-opacity-80',
                }}
                isOpen={true}
                formatTime={formatTime}
                onClick={() => goToStore(store.id)}
              />
            ))}
          </div>
        )}

        {/* End Turn Section - Force horizontal layout with inline styles */}
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '0',
            right: '0',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: '16px',
            maxWidth: '430px',
            margin: '0 auto',
            padding: '0 16px',
            zIndex: 50,
          }}
        >
          <Button
            variant="record"
            size="lg"
            fullWidth
            onClick={handleEndTurn}
            disabled={submitting}
            icon={submitting ? <FaSpinner className="animate-spin" /> : null}
            className="game-action-button"
          >
            {submitting ? 'Processing...' : 'End Turn'}
          </Button>

          <Button
            variant="record"
            size="lg"
            fullWidth
            onClick={handleLeaveGame}
            disabled={submitting}
            className="game-action-button"
          >
            Leave Game
          </Button>
        </div>

        {/* No longer needed - animation is part of Button component */}
        <style>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Game;
