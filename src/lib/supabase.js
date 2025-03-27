// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env file and make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
}

// Initialize Supabase with minimal config
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't persist session in Edge runtime
  },
});

// Add connection status check
export const checkConnection = async () => {
  try {
    const { error } = await supabase.from('games').select('id').limit(1);
    return !error;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
};

// Auth helpers
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const signUp = async (email, password, username) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return { error };
  }
};

// Function to generate a random username
const generateUsername = () => {
  const adjectives = [
    'Hungry',
    'Speedy',
    'Lucky',
    'Famous',
    'Tasty',
    'Spicy',
    'Fresh',
    'Savory',
    'Zesty',
    'Delicious',
  ];

  const nouns = [
    'Sandwich',
    'Hoagie',
    'Sub',
    'Deli',
    'Bagel',
    'Chef',
    'Pickle',
    'Panini',
    'Hero',
    'Wrap',
  ];

  const randomNum = Math.floor(Math.random() * 1000);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective}${noun}${randomNum}`;
};

/**
 * Sign in anonymously with a generated username
 */
export const signInAnonymously = async (username) => {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;

    if (data?.user) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { username },
      });
      if (updateError) console.error('Error updating username:', updateError);
    }

    return { data, error: null, username };
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    return { data: null, error, username: null };
  }
};

/**
 * Try to sign in with stored anonymous credentials
 */
export const tryAnonymousSignIn = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    return {
      data: sessionData?.session ? sessionData : null,
      error: null,
    };
  } catch (error) {
    console.error('Error trying anonymous sign-in:', error);
    return { data: null, error };
  }
};

// Game-related helpers will be added here as we develop
