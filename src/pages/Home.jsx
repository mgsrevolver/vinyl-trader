// src/pages/Home.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaCompactDisc, FaRecordVinyl } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { generatePlayerName } from '../lib/nameGenerator';
import { useGame } from '../contexts/GameContext';
import GameJamBanner from '../components/game/JamBanner';
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

// Add button texture keyframes
const buttonTextureKeyframes = `
@keyframes subtle-shift {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 0%; }
  100% { background-position: 0% 0%; }
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
        toast.error('Failed to create game');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{ marginTop: '-55px' }}
    >
      {/* Add the keyframes to the page */}
      <style>{spinKeyframes}</style>
      <style>{buttonTextureKeyframes}</style>

      <main className="flex-1 flex flex-col items-center justify-start px-8 pb-4">
        <div className="w-full" style={{ maxWidth: '500px' }}>
          {/* Logo and Title - improved layout */}
          <div
            className="mb-10"
            style={{ marginTop: '28px', position: 'relative' }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '180px',
              }}
            >
              {/* Record icon positioned in the background */}
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-15px',
                  zIndex: 1,
                }}
              >
                <FaCompactDisc
                  style={{
                    color: '#f59e0b',
                    fontSize: '160px',
                    animation: 'spin 10s linear infinite',
                    filter: 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.4))',
                  }}
                />
              </div>

              {/* Title positioned in the foreground */}
              <h1
                style={{
                  fontSize: '70px',
                  fontWeight: 'bold',
                  margin: '0',
                  lineHeight: '0.9',
                  color: 'black',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  zIndex: 2,
                  width: '100%',
                }}
              >
                <span>VINYL</span>
                <span>TRADER</span>
              </h1>
            </div>
          </div>

          {/* Play button - updated with silvery gradient */}
          <button
            onClick={handlePlayNow}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '16px 0',
              border: '2px solid #333',
              borderRadius: '50px',
              background:
                'linear-gradient(145deg, #e6e6e6, #d9d9d9, #a0a0a0, #c0c0c0)',
              backgroundSize: '200% 200%',
              animation: 'subtle-shift 8s ease infinite',
              color: 'black',
              fontSize: '22px',
              fontWeight: 'bold',
              marginBottom: '32px',
              cursor: 'pointer',
              textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.2)',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow =
                'inset 0 1px 0 rgba(255,255,255,0.6), 0 5px 10px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.2)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow =
                'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FaPlay
              style={{
                marginRight: '10px',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
              }}
            />{' '}
            PLAY NOW
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
