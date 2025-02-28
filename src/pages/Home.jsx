import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  FaPlus,
  FaDice,
  FaArrowRight,
  FaSignOutAlt,
  FaTimes,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { generatePlayerName, generateGameName } from '../lib/nameGenerator';

const Home = () => {
  const { user, logout, playInstantly } = useAuth();
  const navigate = useNavigate();

  const [activeGames, setActiveGames] = useState([]);
  const [completedGames, setCompletedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [gameName, setGameName] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadGames();

      // Set username from user metadata
      if (user.user_metadata && user.user_metadata.username) {
        setUsername(user.user_metadata.username);
      }
    } else {
      // Auto-create anonymous user if not logged in
      handlePlayInstantly();
    }

    // Set up realtime subscription for game updates
    const gamesSubscription = supabase
      .channel('public:games')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        () => {
          // Reload games on any game table change
          if (user) loadGames();
        }
      )
      .subscribe();

    return () => {
      gamesSubscription.unsubscribe();
    };
  }, [user]);

  const handlePlayInstantly = async () => {
    if (user) return; // Skip if already logged in

    setAuthLoading(true);
    try {
      const { success } = await playInstantly();
      if (success) {
        // User created, games will load in the useEffect
      }
    } catch (error) {
      console.error('Error creating anonymous user:', error);
      toast.error('Failed to create anonymous user');
    } finally {
      setAuthLoading(false);
    }
  };

  const loadGames = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch user's games
      const { data: userGames, error } = await supabase
        .from('players')
        .select(
          `
          game:games(
            id,
            name,
            status,
            current_day,
            max_days
          )
        `
        )
        .eq('user_id', user.id);

      if (error) throw error;

      // Process the games data
      const games = userGames
        .map((player) => player.game)
        .filter((game) => game !== null);

      // Separate active and completed games
      const active = games.filter((game) => game.status !== 'completed');
      const completed = games.filter((game) => game.status === 'completed');

      setActiveGames(active);
      setCompletedGames(completed);
    } catch (error) {
      console.error('Error loading games:', error);
      toast.error(`Error loading games: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewGameModal = () => {
    setGameName(generateGameName());
    setShowNewGameModal(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreateGame = async () => {
    if (!user) return;

    try {
      setCreateLoading(true);

      // Use the gameName from the form, or create a default name if empty
      const gameNameToUse = gameName.trim() || generateGameName();

      // Create a new game with the name field included
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          created_by: user.id,
          status: 'waiting',
          current_day: 0,
          name: gameNameToUse,
        })
        .select()
        .single();

      if (gameError) {
        console.error('Error creating game:', gameError);
        toast.error(`Error creating game: ${gameError.message}`);
        return;
      }

      // Add creator as the first player
      const { error: playerError } = await supabase.from('players').insert({
        game_id: gameData.id,
        user_id: user.id,
        username: user.user_metadata?.username || generatePlayerName(),
        cash: 0,
        location: 'downtown',
      });

      if (playerError) {
        console.error('Error adding player:', playerError);
        toast.error(`Error adding player: ${playerError.message}`);
        return;
      }

      // Close the modal and redirect to lobby
      setShowNewGameModal(false);
      navigate(`/lobby/${gameData.id}`);
    } catch (error) {
      console.error('Unexpected error in game creation:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      toast.error('Please enter a game code');
      return;
    }

    try {
      setJoinLoading(true);

      // Check if game exists
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('id, name, status')
        .eq('id', gameCode.trim())
        .single();

      if (gameError) {
        if (gameError.code === 'PGRST116') {
          toast.error('Game not found. Please check the code and try again.');
        } else {
          throw gameError;
        }
        return;
      }

      if (gameData.status === 'completed') {
        toast.error('This game has already been completed.');
        return;
      }

      // Check if player is already in the game
      const { data: existingPlayer, error: playerCheckError } = await supabase
        .from('players')
        .select('id')
        .eq('game_id', gameData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (playerCheckError) throw playerCheckError;

      if (existingPlayer) {
        toast.success('You are already part of this game!');
        navigate(`/game/${gameData.id}`);
        return;
      }

      // Join the game
      const { error: joinError } = await supabase.from('players').insert({
        user_id: user.id,
        game_id: gameData.id,
        cash: 2000,
        loan_amount: 2000,
        location: 'Downtown',
      });

      if (joinError) throw joinError;

      toast.success(`Joined game "${gameData.name}" successfully!`);
      setGameCode('');
      setShowNewGameModal(false);

      // Navigate to the game
      navigate(`/game/${gameData.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error(`Error joining game: ${error.message}`);
    } finally {
      setJoinLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-display font-bold text-primary-700">
            Deli Wars
          </h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                Welcome, {username || user?.email || 'Player'}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <FaSignOutAlt className="mr-1" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-display font-bold text-gray-900">
            Your Games
          </h1>
          <button
            onClick={handleOpenNewGameModal}
            className="btn btn-primary flex items-center"
          >
            <FaPlus className="mr-2" /> New Game
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading your games...</p>
          </div>
        ) : (
          <>
            {/* Active Games */}
            <div className="mb-10">
              <h2 className="text-xl font-display font-semibold text-gray-800 mb-4">
                Active Games
              </h2>

              {activeGames.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow text-center">
                  <p className="text-gray-600">
                    You don't have any active games.
                  </p>
                  <p className="mt-2 text-gray-500">
                    Start a new game or join an existing one!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeGames.map((game) => (
                    <div
                      key={game.id}
                      className="bg-white rounded-lg shadow overflow-hidden"
                    >
                      <div className="p-5">
                        <h3 className="font-display font-bold text-lg mb-1">
                          {game.name}
                        </h3>
                        <p className="text-gray-500 text-sm mb-3">
                          Day {game.current_day} of {game.max_days}
                        </p>

                        <div className="flex justify-between items-center mt-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              game.status === 'waiting'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {game.status === 'waiting'
                              ? 'Waiting'
                              : 'In Progress'}
                          </span>

                          <Link
                            to={`/game/${game.id}`}
                            className="btn btn-primary py-1 flex items-center"
                          >
                            Enter Game <FaArrowRight className="ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed Games */}
            {completedGames.length > 0 && (
              <div>
                <h2 className="text-xl font-display font-semibold text-gray-800 mb-4">
                  Completed Games
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedGames.map((game) => (
                    <div
                      key={game.id}
                      className="bg-white rounded-lg shadow overflow-hidden opacity-80"
                    >
                      <div className="p-5">
                        <h3 className="font-display font-bold text-lg mb-1">
                          {game.name}
                        </h3>
                        <p className="text-gray-500 text-sm mb-3">
                          Completed after {game.current_day} days
                        </p>

                        <div className="flex justify-between items-center mt-4">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Completed
                          </span>

                          <Link
                            to={`/game/${game.id}`}
                            className="btn btn-secondary py-1 flex items-center"
                          >
                            View Results <FaArrowRight className="ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* New Game Modal */}
      {showNewGameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-xl font-display font-bold">
                Start or Join a Game
              </h3>
              <button
                onClick={() => setShowNewGameModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-6">
                <h4 className="font-display font-semibold mb-2">
                  Create New Game
                </h4>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="gameName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Game Name
                    </label>
                    <input
                      type="text"
                      id="gameName"
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="mt-1 input block w-full"
                      placeholder="My Awesome Deli Game"
                    />
                  </div>
                  <button
                    onClick={handleCreateGame}
                    disabled={createLoading}
                    className={`w-full btn btn-primary ${
                      createLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {createLoading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                        Creating...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <FaPlus className="mr-2" /> Create Game
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t pt-5">
                <h4 className="font-display font-semibold mb-2">
                  Join Existing Game
                </h4>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="gameCode"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Game Code
                    </label>
                    <input
                      type="text"
                      id="gameCode"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value)}
                      className="mt-1 input block w-full"
                      placeholder="Enter game ID"
                    />
                  </div>
                  <button
                    onClick={handleJoinGame}
                    disabled={joinLoading}
                    className={`w-full btn btn-primary ${
                      joinLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {joinLoading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                        Joining...
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
