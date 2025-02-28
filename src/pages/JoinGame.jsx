// src/pages/JoinGame.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const JoinGame = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameDetails, setGameDetails] = useState(null);

  useEffect(() => {
    if (!gameId || !user) return;

    const checkGame = async () => {
      setIsLoading(true);
      setError(null);

      // Check if game exists and is in lobby state
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        setError('Game not found');
        setIsLoading(false);
        return;
      }

      if (game.status !== 'waiting') {
        setError('This game has already started');
        setIsLoading(false);
        return;
      }

      // Check if player is already in this game
      const { data: existingPlayer, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .single();

      if (existingPlayer) {
        // Already joined, redirect to lobby
        navigate(`/lobby/${gameId}`);
        return;
      }

      setGameDetails(game);
      setIsLoading(false);
    };

    checkGame();
  }, [gameId, user, navigate]);

  const handleJoinGame = async () => {
    if (!gameId || !user || !gameDetails) return;

    setIsLoading(true);

    // Get player count to ensure max 4 players
    const { data: playersCount, error: countError } = await supabase
      .from('players')
      .select('id', { count: 'exact' })
      .eq('game_id', gameId);

    if (countError) {
      setError('Error checking player count');
      setIsLoading(false);
      return;
    }

    if (playersCount.length >= 4) {
      setError('Game is full (maximum 4 players)');
      setIsLoading(false);
      return;
    }

    // Add player to game
    const { error: joinError } = await supabase.from('players').insert({
      game_id: gameId,
      user_id: user.id,
      username:
        user.user_metadata?.username ||
        `Player${Math.floor(Math.random() * 1000)}`,
      cash: 0, // Initial values will be set when game starts
      location: 'downtown', // Default starting location
      inventory: [],
      loans: [],
    });

    if (joinError) {
      setError('Error joining game');
      console.error(joinError);
      setIsLoading(false);
    } else {
      navigate(`/lobby/${gameId}`);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Join Game</h1>

          {error ? (
            <div className="mb-6">
              <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
                {error}
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-6">
                You've been invited to join a game of Deli Wars! Click below to
                join the lobby.
              </p>

              <div className="flex justify-end">
                <Button onClick={handleJoinGame}>Join Game</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default JoinGame;
