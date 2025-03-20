// albumCoverUpdater.js
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fetch from 'node-fetch';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the root .env.local file
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const LASTFM_API_KEY = process.env.VITE_LASTFM_API_KEY;

// Debug logging (remove in production)
console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Found' : 'Not found');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Found' : 'Not found');
console.log('LASTFM_API_KEY:', LASTFM_API_KEY ? 'Found' : 'Not found');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !LASTFM_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

async function fetchAlbumCover(artist, album) {
  try {
    const url = `${BASE_URL}?method=album.getinfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(
      artist
    )}&album=${encodeURIComponent(album)}&format=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error(`Error fetching ${album} by ${artist}: ${data.message}`);
      return null;
    }

    // Extract the largest image
    const images = data.album.image;
    const largeImage = images.find((img) => img.size === 'extralarge')?.[
      '#text'
    ];

    return largeImage || null;
  } catch (error) {
    console.error(`Error fetching ${album} by ${artist}:`, error);
    return null;
  }
}

async function updateAlbumCovers() {
  // Get all albums without image_url
  const { data: albums, error } = await supabase
    .from('products')
    .select('id, name, artist')
    .is('image_url', null);

  if (error) {
    console.error('Error fetching albums:', error);
    return;
  }

  console.log(`Found ${albums.length} albums without cover art`);

  // Add delay between API calls to avoid rate limiting
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Update each album
  for (const album of albums) {
    console.log(`Processing: ${album.name} by ${album.artist}`);

    const coverUrl = await fetchAlbumCover(album.artist, album.name);

    if (coverUrl) {
      // Update the database with the cover URL
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: coverUrl })
        .eq('id', album.id);

      if (updateError) {
        console.error(`Error updating ${album.name}:`, updateError);
      } else {
        console.log(`Updated cover for ${album.name} - URL: ${coverUrl}`);
      }
    } else {
      console.log(`No cover found for ${album.name}`);
    }

    // Add a delay to avoid hitting API rate limits
    await delay(300);
  }

  console.log('Album cover update completed!');
}

// Run the function
updateAlbumCovers().catch(console.error);
