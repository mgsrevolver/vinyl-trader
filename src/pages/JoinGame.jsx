// src/pages/JoinGame.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaUserPlus, FaDice, FaSpinner } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import { generatePlayerName } from '../lib/nameGenerator';

const JoinGame = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { joinGame, loadGame, playerId } = useGame();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [game, setGame] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);

  // Generate a random name on initial load
  useEffect(() => {
    setPlayerName(generatePlayerName());
  }, []);

  useEffect(() => {
    const checkGame = async () => {
      if (!gameId || !playerId) return;

      try {
        setLoading(true);
        setError('');

        // Try loading the game first to see if already joined
        const result = await loadGame(gameId);

        if (result.success) {
          // Already part of this game, redirect to lobby or game
          navigate(
            result.game.status === 'waiting'
              ? `/lobby/${gameId}`
              : `/game/${gameId}`
          );
          return;
        }

        // Check if game exists
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameError) {
          if (gameError.code === 'PGRST116') {
            setError('Game not found. The invite link may be invalid.');
          } else {
            setError(`Error loading game: ${gameError.message}`);
          }
          return;
        }

        if (gameData.status === 'completed') {
          setError('This game has already ended.');
          return;
        }

        if (gameData.status === 'active') {
          setError('This game has already started.');
          return;
        }

        // Count existing players
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('id', { count: 'exact' })
          .eq('game_id', gameId);

        if (playersError) {
          setError(`Error loading players: ${playersError.message}`);
          return;
        }

        if (players.length >= 4) {
          setError('This game is already full (maximum 4 players).');
          return;
        }

        setGame(gameData);
        setPlayerCount(players.length);
      } catch (err) {
        console.error('Error checking game:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    checkGame();
  }, [gameId, loadGame, navigate, playerId]);

  const handlePlayerNameChange = (e) => {
    setPlayerName(e.target.value);
    setIsCustomName(true);
  };

  const generateNewName = () => {
    setPlayerName(generatePlayerName());
    setIsCustomName(false);
  };

  const handleJoinGame = async () => {
    if (!gameId || !playerId || joining) return;

    try {
      setJoining(true);

      // Use either custom name or generated name
      const name =
        isCustomName && playerName.trim()
          ? playerName.trim()
          : generatePlayerName();

      const { success, error } = await joinGame(gameId, name);

      if (success) {
        toast.success('Joined game successfully!');
        navigate(`/lobby/${gameId}`);
      } else {
        toast.error(`Failed to join: ${error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error joining game:', err);
      toast.error('Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Checking game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Cannot Join Game</h1>
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 p-4 flex items-center justify-center">
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

      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-block bg-blue-100 p-4 rounded-full text-blue-600 text-3xl mb-4">
            <FaUserPlus />
          </div>
          <h1 className="text-2xl font-bold">Join Game</h1>
          <p className="text-gray-600 mt-2">
            You've been invited to play Deli Wars!
          </p>
        </div>

        {game && (
          <div className="mb-6 bg-blue-50 p-4 rounded-md">
            <h2 className="font-semibold">Game Details:</h2>
            <p className="text-sm text-gray-700 mt-1">
              <span className="font-medium">Game Name:</span> {game.name}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Players:</span> {playerCount}/4
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name:
          </label>
          <div className="flex">
            <input
              type="text"
              value={playerName}
              onChange={handlePlayerNameChange}
              className="flex-1 p-3 border border-gray-300 rounded-l-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your name"
            />
            <button
              onClick={generateNewName}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300"
              title="Generate a new random name"
            >
              🎲
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Link
            to="/"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            onClick={handleJoinGame}
            disabled={joining}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joining ? (
              <>
                <FaSpinner className="animate-spin mr-2" /> Joining...
              </>
            ) : (
              <>
                <FaDice className="mr-2" /> Join Game
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinGame;
