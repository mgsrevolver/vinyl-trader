// src/pages/Home.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaDice, FaPlay, FaUser, FaUsers } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { generatePlayerName } from '../lib/nameGenerator';
import { useGame } from '../contexts/GameContext';
import GameJamBanner from '../components/game/JAmBanner';

const Home = () => {
  const navigate = useNavigate();
  const { createGame, joinGame, loading, startGame, loadGame } = useGame();

  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [loadingButton, setLoadingButton] = useState(null);

  // Generate a random name on initial load
  useEffect(() => {
    setPlayerName(generatePlayerName());
  }, []);

  const handleSinglePlayerGame = async () => {
    setLoadingButton('singlePlayer');
    console.log('Single player button clicked'); // Debug log

    try {
      // Use either custom name or generated name
      const name =
        isCustomName && playerName.trim()
          ? playerName.trim()
          : generatePlayerName();

      console.log('Creating game for player:', name); // Debug log

      // Create the game - no alerts, no toasts
      const { success, gameId, error } = await createGame(name);

      console.log('Game creation result:', { success, gameId, error }); // Debug log

      if (success && gameId) {
        // Start it silently
        console.log('Starting game:', gameId); // Debug log
        const startResult = await startGame(gameId);
        console.log('Start game result:', startResult); // Debug log

        // Navigate to the game page
        console.log('Navigating to:', `/game/${gameId}`); // Debug log

        // Use both methods to ensure navigation works
        navigate(`/game/${gameId}`);

        // As a fallback, use window.location after a short delay
        setTimeout(() => {
          window.location.href = `/game/${gameId}`;
        }, 500);
      } else {
        console.error('Failed to create game:', error);
        toast.error('Failed to create game');
      }
    } catch (error) {
      console.error('Error in handleSinglePlayerGame:', error);
      toast.error('An error occurred');
    } finally {
      setLoadingButton(null);
    }
  };

  const handleCreateMultiplayerGame = async () => {
    setLoadingButton('createMultiplayer');

    try {
      // Use either custom name or generated name
      const name =
        isCustomName && playerName.trim()
          ? playerName.trim()
          : generatePlayerName();

      const { success, gameId, error } = await createGame(name);

      if (success) {
        toast.success('Game created! Entering lobby...');

        // Use navigate for more consistent routing
        setTimeout(() => {
          navigate(`/lobby/${gameId}`);
        }, 300);
      } else {
        toast.error('Failed to create game');
        console.error(error);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingButton(null);
    }
  };

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      toast.error('Please enter a game code');
      return;
    }

    setLoadingButton('joinMultiplayer');

    try {
      // Use either custom name or generated name
      const name =
        isCustomName && playerName.trim()
          ? playerName.trim()
          : generatePlayerName();

      const { success, gameId, error } = await joinGame(gameCode.trim(), name);

      if (success) {
        toast.success('Joined game successfully!');
        navigate(`/lobby/${gameId}`);
      } else {
        toast.error(`Failed to join: ${error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingButton(null);
    }
  };

  const generateNewName = () => {
    setPlayerName(generatePlayerName());
    setIsCustomName(false);
  };

  const handlePlayerNameChange = (e) => {
    setPlayerName(e.target.value);
    setIsCustomName(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col">
      <GameJamBanner />

      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-700 text-center">
            Deli Wars
          </h1>
          <p className="text-center text-gray-600 mt-2">
            Buy low, sell high, and become the ultimate deli mogul!
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Play as:</h2>
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

          {/* Single Player Section */}
          <div className="mb-6 border-b pb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <FaUser className="mr-2" /> Single Player
            </h3>
            <button
              onClick={handleSinglePlayerGame}
              disabled={loadingButton !== null}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              id="play-now-button"
              type="button"
            >
              {loadingButton === 'singlePlayer' ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <FaPlay className="mr-2" /> Play Now
                </span>
              )}
            </button>
          </div>

          {/* Multiplayer Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <FaUsers className="mr-2" /> Multiplayer
            </h3>

            <div className="space-y-4">
              <button
                onClick={handleCreateMultiplayerGame}
                disabled={loadingButton !== null}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingButton === 'createMultiplayer' ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating Game...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <FaPlus className="mr-2" /> Create Game
                  </span>
                )}
              </button>

              <div className="text-center text-gray-500">- or -</div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter game code"
                />
                <button
                  onClick={handleJoinGame}
                  disabled={loadingButton !== null || !gameCode.trim()}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loadingButton === 'joinMultiplayer' ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Joining Game...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <FaDice className="mr-2" /> Join Game
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            <h3 className="font-semibold">How to Play:</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Buy low, sell high across different neighborhoods</li>
              <li>Manage your inventory of artisanal foods and drinks</li>
              <li>Travel to different neighborhoods to find the best deals</li>
              <li>Compete with other players to earn the most profit</li>
              <li>Repay your loan and become the ultimate deli mogul!</li>
            </ul>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            <p>No login required. Just play!</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
