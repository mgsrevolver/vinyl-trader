// src/pages/Lobby.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';

const Lobby = () => {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId || !user) return;

    const fetchLobbyData = async () => {
      setIsLoading(true);

      // Get game data
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error('Error fetching game:', gameError);
        navigate('/dashboard');
        return;
      }

      if (gameData.status !== 'waiting') {
        setError('This game has already started');
        setIsLoading(false);
        return;
      }

      // Check if user is the creator
      setIsCreator(gameData.created_by === user.id);

      // Get players in lobby
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, user_id, username')
        .eq('game_id', gameId);

      if (playersError) {
        console.error('Error fetching players:', playersError);
      } else {
        setPlayers(playersData || []);
      }

      setIsLoading(false);
    };

    fetchLobbyData();

    // Subscribe to player changes
    const playersSubscription = supabase
      .channel(`game-${gameId}-players`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          fetchLobbyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playersSubscription);
    };
  }, [gameId, user, navigate]);

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join/${gameId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopySuccess('Link copied!');
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const handleStartGame = async () => {
    if (!isCreator || players.length < 1) return;

    const { error } = await supabase
      .from('games')
      .update({ status: 'active', current_day: 1 })
      .eq('id', gameId);

    if (error) {
      console.error('Error starting game:', error);
    } else {
      navigate(`/game/${gameId}`);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading lobby...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Game Lobby</h1>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Invite Players</h2>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/join/${gameId}`}
                className="flex-1 p-2 border rounded bg-gray-50"
              />
              <Button onClick={handleCopyLink}>Copy</Button>
            </div>
            {copySuccess && (
              <p className="text-green-600 text-sm">{copySuccess}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Share this link with friends to invite them to your game.
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">
              Players ({players.length}/4)
            </h2>
            <ul className="border rounded divide-y">
              {players.map((player) => (
                <li key={player.id} className="p-3 flex items-center">
                  <span className="flex-1">{player.username}</span>
                  {player.user_id === user.id && (
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      You
                    </span>
                  )}
                </li>
              ))}
              {Array.from({ length: 4 - players.length }).map((_, i) => (
                <li key={`empty-${i}`} className="p-3 text-gray-400">
                  Waiting for player...
                </li>
              ))}
            </ul>
          </div>

          {isCreator ? (
            <div className="flex justify-end">
              <Button
                onClick={handleStartGame}
                disabled={players.length < 1}
                className={
                  players.length < 1 ? 'opacity-50 cursor-not-allowed' : ''
                }
              >
                Start Game
              </Button>
            </div>
          ) : (
            <p className="text-center text-gray-600">
              Waiting for the game creator to start the game...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Lobby;
