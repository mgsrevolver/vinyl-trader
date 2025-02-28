import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FaPlus, FaDice, FaArrowRight, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { generatePlayerName, generateGameName } from '../lib/nameGenerator';

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [gameName, setGameName] = useState(generateGameName());
  const [username, setUsername] = useState('');

  // Initialize anonymous user on load
  useEffect(() => {
    const initUser = async () => {
      // Check if we already have a session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        // Get or set username
        if (session.user.user_metadata?.username) {
          setUsername(session.user.user_metadata.username);
        } else {
          const newUsername = generatePlayerName();
          setUsername(newUsername);
          await supabase.auth.updateUser({
            data: { username: newUsername },
          });
        }
      } else {
        // Create anonymous user
        try {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;

          setUser(data.user);

          // Set username for new user
          const newUsername = generatePlayerName();
          setUsername(newUsername);
          await supabase.auth.updateUser({
            data: { username: newUsername },
          });
        } catch (error) {
          console.error('Error signing in anonymously:', error);
          toast.error('Failed to create account. Please refresh the page.');
        }
      }

      setLoading(false);
    };

    initUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load games when user is available
  useEffect(() => {
    if (user) {
      loadGames();
    }
  }, [user]);

  const loadGames = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('players')
        .select('game:games(id, name, status, current_day, max_days)')
        .eq('user_id', user.id);

      if (error) throw error;

      const gamesList = data
        .map((player) => player.game)
        .filter((game) => game !== null);

      setGames(gamesList);
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const createGame = async () => {
    if (!user) return;

    try {
      // Create game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          created_by: user.id,
          status: 'waiting',
          current_day: 0,
          name: gameName || generateGameName(),
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // Add player
      const { error: playerError } = await supabase.from('players').insert({
        game_id: game.id,
        user_id: user.id,
        username: username,
        cash: 0,
        location: 'downtown',
      });

      if (playerError) throw playerError;

      setShowModal(false);
      navigate(`/lobby/${game.id}`);
    } catch (error) {
      console.error('Error creating game:', error);
      toast.error('Failed to create game');
    }
  };

  const joinGame = async () => {
    if (!gameCode.trim() || !user) return;

    try {
      // Check if game exists
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id, name, status')
        .eq('id', gameCode.trim())
        .single();

      if (gameError) {
        toast.error('Game not found');
        return;
      }

      if (game.status === 'completed') {
        toast.error('This game has already ended');
        return;
      }

      // Check if already in game
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('game_id', game.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingPlayer) {
        navigate(`/game/${game.id}`);
        return;
      }

      // Join game
      await supabase.from('players').insert({
        user_id: user.id,
        game_id: game.id,
        username: username,
        cash: 2000,
        loan_amount: 2000,
        location: 'Downtown',
      });

      setShowModal(false);
      navigate(`/game/${game.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Failed to join game');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-700">Deli Wars</h1>
          {username && (
            <div className="text-gray-600">Playing as: {username}</div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Your Games</h2>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center"
          >
            <FaPlus className="mr-2" /> New Game
          </button>
        </div>

        {/* Games list */}
        {games.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <p className="text-gray-600">You don't have any active games.</p>
            <p className="mt-2 text-gray-500">
              Start a new game or join an existing one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-1">{game.name}</h3>
                  <p className="text-gray-500 text-sm mb-3">
                    Day {game.current_day} of {game.max_days || 30}
                  </p>

                  <div className="flex justify-between items-center mt-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        game.status === 'waiting'
                          ? 'bg-yellow-100 text-yellow-800'
                          : game.status === 'completed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {game.status === 'waiting'
                        ? 'Waiting'
                        : game.status === 'completed'
                        ? 'Completed'
                        : 'In Progress'}
                    </span>

                    <Link
                      to={`/game/${game.id}`}
                      className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center"
                    >
                      Enter <FaArrowRight className="ml-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-xl font-bold">Start or Join a Game</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5">
              {/* Create Game */}
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Create New Game</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Game Name
                    </label>
                    <input
                      type="text"
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="My Awesome Deli Game"
                    />
                  </div>
                  <button
                    onClick={createGame}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  >
                    <FaPlus className="inline mr-2" /> Create Game
                  </button>
                </div>
              </div>

              {/* Join Game */}
              <div className="border-t pt-5">
                <h4 className="font-semibold mb-2">Join Existing Game</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Game Code
                    </label>
                    <input
                      type="text"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      placeholder="Enter game ID"
                    />
                  </div>
                  <button
                    onClick={joinGame}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  >
                    <FaDice className="inline mr-2" /> Join Game
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
