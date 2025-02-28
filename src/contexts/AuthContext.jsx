import { createContext, useState, useEffect, useContext } from 'react';
import {
  supabase,
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  signInAnonymously,
  tryAnonymousSignIn,
} from '../lib/supabase';
import toast from 'react-hot-toast';
import { generatePlayerName } from '../lib/nameGenerator';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user on initial render
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          // Try to sign in with anonymous credentials if available
          const { data, error } = await tryAnonymousSignIn();
          if (!error && data?.user) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        toast.error(error.message);
        return { success: false, error };
      }

      toast.success('Logged in successfully!');
      return { success: true, data };
    } catch (error) {
      toast.error('An unexpected error occurred');
      return { success: false, error };
    }
  };

  // Register function
  const register = async (email, password, username) => {
    try {
      const { data, error } = await signUp(email, password, username);

      if (error) {
        toast.error(error.message);
        return { success: false, error };
      }

      toast.success(
        'Account created successfully! Please check your email to confirm your account.'
      );
      return { success: true, data };
    } catch (error) {
      toast.error('An unexpected error occurred');
      return { success: false, error };
    }
  };

  // Play instantly function
  const playInstantly = async () => {
    try {
      // Generate a username first so we can use it consistently
      const generatedUsername = generatePlayerName();

      const { data, error } = await signInAnonymously(generatedUsername);

      if (error) {
        console.error('Play instantly error:', error);
        toast.error('Unable to start instant play. Please try again.');
        return { success: false, error };
      }

      // Use the same username that was generated
      toast.success(`Welcome ${generatedUsername}! You can play instantly!`);
      return { success: true, data, username: generatedUsername };
    } catch (error) {
      console.error('Unexpected error during instant play:', error);
      toast.error('An unexpected error occurred');
      return { success: false, error };
    }
  };

  // Add a function to fetch user games that bypasses RLS issues
  const fetchUserGames = async (userId) => {
    if (!userId) return { activeGames: [], completedGames: [] };

    try {
      // First try to get the user's player records directly from the client
      const { data: playerRecords, error: playerError } = await supabase.rpc(
        'get_player_records_for_user',
        { user_id_param: userId }
      );

      if (playerError) {
        console.error('Error fetching player records:', playerError);
        return { activeGames: [], completedGames: [], error: playerError };
      }

      if (!playerRecords || playerRecords.length === 0) {
        return { activeGames: [], completedGames: [], noGames: true };
      }

      // Get the game data for each player record
      const { data: gameData, error: gameError } = await supabase.rpc(
        'get_games_for_user',
        { user_id_param: userId }
      );

      if (gameError) {
        console.error('Error fetching games:', gameError);
        return { activeGames: [], completedGames: [], error: gameError };
      }

      // Process the game data
      const activeGames = gameData.filter(
        (game) => game.status !== 'completed'
      );
      const completedGames = gameData.filter(
        (game) => game.status === 'completed'
      );

      return { activeGames, completedGames };
    } catch (error) {
      console.error('Error in fetchUserGames:', error);
      return { activeGames: [], completedGames: [], error };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const { error } = await signOut();

      if (error) {
        toast.error(error.message);
        return { success: false, error };
      }

      toast.success('Logged out successfully!');
      return { success: true };
    } catch (error) {
      toast.error('An unexpected error occurred');
      return { success: false, error };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    playInstantly,
    fetchUserGames,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
