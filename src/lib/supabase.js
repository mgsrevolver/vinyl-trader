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

// Play instantly with an anonymous session
export const signInAnonymously = async () => {
  try {
    // First test if we can make any auth request
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session check failed:', sessionError);
      return { error: sessionError };
    }

    console.log('Session check successful, attempting anonymous sign-in');

    // Generate a random username
    const username = generateUsername();

    // Use Supabase's signInAnonymously method
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error('Anonymous sign-in error:', error);
      return { error };
    }

    console.log('Anonymous sign-in successful:', data);

    return { data, username };
  } catch (error) {
    console.error('Anonymous sign-in exception:', error);
    return { error };
  }
};

// Check if user has anonymous credentials and try to sign in with them
export const tryAnonymousSignIn = async () => {
  const storedAuth = localStorage.getItem('anonymousAuth');

  if (storedAuth) {
    try {
      const { email, password } = JSON.parse(storedAuth);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { data, error };
    } catch (error) {
      console.error(
        'Error signing in with stored anonymous credentials:',
        error
      );
      // If there's an error, remove the stored credentials
      localStorage.removeItem('anonymousAuth');
      return { error };
    }
  }

  return { data: null, error: null };
};

// Game-related helpers will be added here as we develop
