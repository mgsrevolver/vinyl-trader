import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FaPlus, FaDice, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { generatePlayerName, generateGameName } from '../lib/nameGenerator';

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Welcome to Deli Wars
          </h2>

          <div className="space-y-4">
            <button
              onClick={() => setShowModal(true)}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center justify-center"
            >
              <FaPlus className="mr-2" /> Create New Game
            </button>

            <div className="text-center text-gray-500">- or -</div>

            <div className="space-y-2">
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm p-3"
                placeholder="Enter game code"
              />
              <button
                onClick={joinGame}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center justify-center"
              >
                <FaDice className="mr-2" /> Join Game
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Create Game Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-xl font-bold">Create New Game</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
