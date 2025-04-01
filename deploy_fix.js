// deploy_fix.js
// This script can run in both Node.js and browser environments

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Node.js specific imports
if (!isBrowser) {
  const fs = require('fs');
  const { createClient } = require('@supabase/supabase-js');
  require('dotenv').config();
}

async function deployFix() {
  try {
    // Get the Supabase client
    let supabase;
    let sqlFix;

    if (isBrowser) {
      // Browser environment - get from global variable or import dynamically
      supabase = window.supabase;

      // In browser, we need to fetch the SQL file
      const response = await fetch('./fix_buy_record.sql');
      sqlFix = await response.text();

      console.log('Running in browser environment');
    } else {
      // Node.js environment
      const fs = require('fs');
      const { createClient } = require('@supabase/supabase-js');

      // Get Supabase credentials from env
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error(
          'Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file'
        );
        process.exit(1);
      }

      supabase = createClient(supabaseUrl, supabaseKey);
      sqlFix = fs.readFileSync('./fix_buy_record.sql', 'utf8');

      console.log('Running in Node.js environment');
    }

    console.log('Deploying SQL fix to Supabase...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlFix });

    if (error) {
      console.error('Error deploying SQL fix:', error);
      return;
    }

    console.log('SQL fix deployed successfully!');
    console.log('Data:', data);

    // Clear cache based on environment
    if (isBrowser) {
      console.log('Clearing browser caches...');
      localStorage.removeItem('deliWarsCache');

      // Clear any game-specific caches
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('deliWars')) {
          localStorage.removeItem(key);
        }
      });

      // Force reload the page to ensure fresh state
      window.location.reload();
    } else {
      console.log('Node.js environment - no browser caches to clear');
    }

    console.log('All done!');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Execute the function based on environment
if (isBrowser) {
  // In browser, we should call this function from a button or on page load
  window.deployFix = deployFix;
} else {
  // In Node.js, call immediately
  deployFix();
}

/*
INSTRUCTIONS:
1. For Node.js usage:
   - Make sure you have the following in your .env file:
     SUPABASE_URL=your_supabase_url
     SUPABASE_SERVICE_KEY=your_service_key
   - Install dependencies: npm install @supabase/supabase-js dotenv
   - Run: node deploy_fix.js

2. For browser usage:
   - Include this script in your HTML
   - Make sure window.supabase is available (initialized Supabase client)
   - Call deployFix() when needed or add a button to trigger it
*/
