// src/pages/Home.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaCompactDisc, FaRecordVinyl } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { generatePlayerName } from '../lib/nameGenerator';
import { useGame } from '../contexts/GameContext';
import GameJamBanner from '../components/game/JAmBanner';
import Button from '../components/ui/Button';

// Add keyframes for the spinning animation
const spinKeyframes = `
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`;

const Home = () => {
  const navigate = useNavigate();
  const { createGame, startGame } = useGame();
  const [loading, setLoading] = useState(false);

  const handlePlayNow = async () => {
    setLoading(true);

    try {
      // Generate a random player name
      const playerName = generatePlayerName();

      // Create and start a single player game
      const { success, gameId, error } = await createGame(playerName);

      if (success && gameId) {
        // Start the game silently
        await startGame(gameId);

        // Navigate to the game
        navigate(`/game/${gameId}`);
      } else {
        console.error('Failed to create game:', error);
        toast.error('Failed to create game');
      }
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Add the keyframes to the page */}
      <style>{spinKeyframes}</style>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
        <div className="w-full max-w-md">
          {/* Logo and Title - revised layout */}
          <div className="mb-4">
            <div className="flex" style={{ alignItems: 'center' }}>
              {/* Left: Title */}
              <div>
                <h1
                  style={{
                    fontSize: '40px',
                    fontWeight: 'bold',
                    margin: '0',
                    lineHeight: '1',
                    color: 'black',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span>VINYL</span>
                  <span>TRADER</span>
                </h1>
              </div>

              {/* Right: Record icon */}
              <div style={{ marginLeft: '20px' }}>
                <FaCompactDisc
                  style={{
                    color: '#f59e0b', // Yellow color (Tailwind's amber-500)
                    fontSize: '100px',
                    animation: 'spin 10s linear infinite',
                    filter: 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.4))',
                  }}
                />
              </div>
            </div>

            {/* Tagline - below both title and icon */}
            <p
              style={{
                fontSize: '16px',
                margin: '8px 0 0 0',
                color: 'black',
              }}
            >
              The ultimate record trading adventure
            </p>
          </div>

          {/* Play button */}
          <button
            onClick={handlePlayNow}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '12px 0',
              border: '1px solid #000',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: 'black',
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '24px',
              cursor: 'pointer',
            }}
          >
            <FaPlay style={{ marginRight: '8px' }} /> PLAY NOW
          </button>

          {/* Multiplayer Coming Soon */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            <p
              style={{
                fontWeight: 'bold',
                fontSize: '18px',
                marginBottom: '4px',
              }}
            >
              Multiplayer Coming Soon
            </p>
            <p style={{ fontSize: '14px' }}>
              Challenge friends to see who can build the most valuable record
              collection!
            </p>
          </div>

          {/* Game Description */}
          <div
            style={{
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '16px',
              }}
            >
              How to Play:
            </h2>
            <ul style={{ listStyleType: 'disc', paddingLeft: '24px' }}>
              <li style={{ marginBottom: '8px' }}>
                Travel to different neighborhoods to hunt for rare vinyl records
              </li>
              <li style={{ marginBottom: '8px' }}>
                Buy low, sell high - spot price trends and profit opportunities
              </li>
              <li style={{ marginBottom: '8px' }}>
                Discover hidden gems and build a valuable record collection
              </li>
              <li style={{ marginBottom: '8px' }}>
                Repay your loan and become the ultimate vinyl trading mogul!
              </li>
            </ul>
          </div>

          {/* Game Jam Footer */}
          <div
            style={{
              textAlign: 'right',
              marginTop: '16px',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <span
              role="img"
              aria-label="game controller"
              style={{ marginRight: '4px' }}
            >
              🎮
            </span>
            Vibe Jam 2025
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
