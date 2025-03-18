// src/pages/Lobby.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaUsers, FaCopy, FaPlay, FaArrowLeft } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import React from 'react';

const Lobby = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentGame, player, players, loadGame, startGame, playerId } =
    useGame();

  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState('');
  const [error, setError] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [isCreator, setIsCreator] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [attemptedLoad, setAttemptedLoad] = useState(false);
  const loadingStarted = useRef(false);

  useEffect(() => {
    // Skip if we've already attempted to load
    if (attemptedLoad) {
      return;
    }

    // Set attempted load state to true
    setAttemptedLoad(true);

    // Check our ref to make extra sure
    if (loadingStarted.current) {
      return;
    }

    loadingStarted.current = true;

    // Load initial game data
    const initLobby = async () => {
      if (!gameId || !playerId) {
        setError('Missing game ID or player ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        console.log(`Loading game ONCE ONLY: ${gameId}`);
        const result = await loadGame(gameId);

        if (!result.success) {
          if (result.needsJoin) {
            window.location.href = `/join/${gameId}`;
            return;
          }

          setError('Failed to load game data');
          return;
        }

        // Set creator status
        setIsCreator(result.game.created_by === playerId);

        // For now, don't start polling to see if that's the issue
        // startPolling();

        // Load players manually once
        fetchPlayers();
      } catch (err) {
        console.error('Error initializing lobby:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only run if we have the required IDs
    if (playerId && gameId) {
      initLobby();
    } else {
      setLoading(false);
    }

    // Clean up polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [gameId, playerId, attemptedLoad]);

  // Set up polling to refresh player list
  const startPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(fetchPlayers, 3000); // Poll every 3 seconds
    setPollingInterval(interval);

    console.log('Started polling with interval ID:', interval);
  };

  const fetchPlayers = async () => {
    if (!gameId) return;

    try {
      // Get players for this game
      const { data, error } = await supabase
        .from('players')
        .select('id, username, user_id')
        .eq('game_id', gameId);

      if (error) throw error;

      setLobbyPlayers(data || []);

      // Also check game status in case it started from another client
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('status')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      // If game started, navigate to game
      if (gameData.status === 'active') {
        navigate(`/game/${gameId}`);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
    }
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join/${gameId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopySuccess('Link copied!');
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const handleStartGame = async () => {
    if (!isCreator || lobbyPlayers.length < 1) return;

    const { success, error } = await startGame(gameId);

    if (success) {
      toast.success('Game started!');
      navigate(`/game/${gameId}`);
    } else {
      toast.error(`Failed to start game: ${error?.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-600 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4">
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

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
            <div className="flex items-center">
              <Link to="/" className="text-white hover:text-blue-100">
                <FaArrowLeft />
              </Link>
              <h1 className="text-xl font-bold ml-4">Game Lobby</h1>
            </div>
            {currentGame && (
              <div className="text-sm bg-blue-700 px-3 py-1 rounded-full">
                Game ID: {currentGame.id.substring(0, 8)}...
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center">
                <FaUsers className="mr-2" /> Players ({lobbyPlayers.length}/4)
              </h2>
              <ul className="bg-gray-50 border rounded-md divide-y">
                {lobbyPlayers.map((p) => (
                  <li key={p.id} className="p-3 flex items-center">
                    <span className="flex-1 font-medium">{p.username}</span>
                    {p.user_id === playerId && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                    {currentGame?.created_by === p.user_id && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full ml-2">
                        Host
                      </span>
                    )}
                  </li>
                ))}
                {Array.from({
                  length: Math.max(0, 4 - lobbyPlayers.length),
                }).map((_, i) => (
                  <li key={`empty-${i}`} className="p-3 text-gray-400 italic">
                    Waiting for player...
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Invite Friends</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/join/${gameId}`}
                  className="flex-1 p-2 border rounded-md bg-gray-50 text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <FaCopy className="mr-2" /> Copy
                </button>
              </div>
              {copySuccess && (
                <p className="text-green-600 text-sm mt-1">{copySuccess}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">
                Share this link with friends to invite them to your game. They
                can join instantly without signing up!
              </p>
            </div>

            <div className="mt-8 flex justify-end">
              {isCreator ? (
                <button
                  onClick={handleStartGame}
                  disabled={lobbyPlayers.length < 1}
                  className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center ${
                    lobbyPlayers.length < 1
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  <FaPlay className="mr-2" /> Start Game
                </button>
              ) : (
                <p className="text-gray-600 italic">
                  Waiting for the host to start the game...
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>
            Game will begin once the host starts it. Make sure all players have
            joined!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
