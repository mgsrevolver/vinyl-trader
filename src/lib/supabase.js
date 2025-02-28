// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase URL and anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
};

export const signUp = async (email, password, username) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
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
 * @param {string} username The username to use for the anonymous user
 * @returns {Promise<Object>} The result of the sign-in attempt
 */
export const signInAnonymously = async (username) => {
  try {
    // Use Supabase's proper anonymous sign-in method
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) throw error;

    // Update the user's metadata to include the username
    if (data?.user) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { username: username },
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
 * @returns {Promise<Object>} The result of the sign-in attempt
 */
export const tryAnonymousSignIn = async () => {
  try {
    // Check if we have a session already
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session) {
      return { data: sessionData, error: null };
    }

    // No existing session, return null
    return { data: null, error: null };
  } catch (error) {
    console.error('Error trying anonymous sign-in:', error);
    return { data: null, error };
  }
};

// Game-related helpers will be added here as we develop
