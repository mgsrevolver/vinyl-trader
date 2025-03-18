// src/pages/Game.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaStore,
  FaMapMarkedAlt,
  FaWarehouse,
  FaCoins,
  FaMoneyBillWave,
  FaSpinner,
  FaUsers,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';

const Game = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const {
    currentGame,
    player,
    players,
    loading,
    gameLoading,
    loadGame,
    playerInventory,
    endTurn,
  } = useGame();

  const [neighborhoods, setNeighborhoods] = useState([]);
  const [neighborhoodsLoading, setNeighborhoodsLoading] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const initAttempted = useRef(false);

  useEffect(() => {
    // Load the game once with no fanfare
    loadGame(gameId);

    // Load neighborhoods
    supabase
      .from('neighborhoods')
      .select('*')
      .then(({ data }) => {
        setNeighborhoods(data || []);
      });
  }, []); // Empty dependency array, runs only once

  const handleEndTurn = async () => {
    const { success, error } = await endTurn();

    if (!success) {
      toast.error(`Failed to end turn: ${error?.message || 'Unknown error'}`);
    }
  };

  const goToMarket = (neighborhoodId, storeName) => {
    navigate(
      `/market/${gameId}/${neighborhoodId}/${encodeURIComponent(storeName)}`
    );
  };

  const goToTravel = () => {
    navigate(`/travel/${gameId}`);
  };

  const formatMoney = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const isSinglePlayerMode = players && players.length <= 1;

  if (gameLoading || !player || !currentGame) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Game Jam Banner */}
      <a
        target="_blank"
        href="https://jam.pieter.com"
        style={{
          fontFamily: "'system-ui', sans-serif",
          position: 'fixed',
          bottom: '-1px',
          right: '-1px',
          padding: '7px',
          fontSize: '14px',
          fontWeight: 'bold',
          background: '#fff',
          color: '#000',
          textDecoration: 'none',
          zIndex: 10,
          borderTopLeftRadius: '12px',
          border: '1px solid #fff',
        }}
      >
        🕹️ Vibe Jam 2025
      </a>

      {/* Header */}
      <header className="bg-white shadow-md p-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-blue-700">
              {currentGame.name}
            </h1>
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {currentGame.current_hour} hours remaining
              </span>
              <span className="mx-2">•</span>
              <span>Location: {player.location}</span>
              {isSinglePlayerMode && (
                <>
                  <span className="mx-2">•</span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    Single Player
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            {/* Only show Players button in multiplayer */}
            {!isSinglePlayerMode && (
              <button
                onClick={() => setShowPlayersModal(true)}
                className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200"
              >
                <FaUsers className="mr-1" /> Players
              </button>
            )}

            <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-md">
              <FaCoins className="mr-1" /> {formatMoney(player.cash)}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-4 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Player Stats */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-blue-600 text-white p-3">
              <h2 className="font-bold">Your Status</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cash:</span>
                  <span className="font-medium text-green-700">
                    {formatMoney(player.cash)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Loan:</span>
                  <span className="font-medium text-red-600">
                    {formatMoney(player.loan_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Interest Rate:</span>
                  <span className="font-medium">
                    {player.loan_interest_rate}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Inventory:</span>
                  <span className="font-medium">
                    {playerInventory.reduce(
                      (acc, item) => acc + item.quantity,
                      0
                    )}
                    /{player.inventory_capacity}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Net Worth:</span>
                  <span className="font-medium text-blue-700">
                    {formatMoney(
                      player.cash -
                        player.loan_amount +
                        playerInventory.reduce(
                          (acc, item) =>
                            acc + item.purchase_price * item.quantity,
                          0
                        )
                    )}
                  </span>
                </div>
              </div>

              {/* Simple Inventory Preview */}
              <div className="mt-4">
                <h3 className="font-medium mb-2 text-gray-700">
                  Inventory ({playerInventory.length} items)
                </h3>
                <div className="bg-gray-50 p-2 rounded-md max-h-32 overflow-y-auto">
                  {playerInventory.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      Your inventory is empty
                    </p>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {playerInventory.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span>
                            {item.products?.name || 'Unknown Product'}
                          </span>
                          <span>{item.quantity}x</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden md:col-span-2">
            <div className="bg-blue-600 text-white p-3">
              <h2 className="font-bold">Actions</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={goToTravel}
                  className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors"
                >
                  <FaMapMarkedAlt className="text-3xl text-blue-600 mb-2" />
                  <span className="font-medium">Travel</span>
                  <span className="text-sm text-gray-600 mt-1">
                    Visit other neighborhoods
                  </span>
                </button>

                <button
                  onClick={() => goToMarket(player.location, 'Local Market')}
                  className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors"
                >
                  <FaStore className="text-3xl text-blue-600 mb-2" />
                  <span className="font-medium">Market</span>
                  <span className="text-sm text-gray-600 mt-1">
                    Buy and sell products
                  </span>
                </button>

                <button className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors">
                  <FaWarehouse className="text-3xl text-blue-600 mb-2" />
                  <span className="font-medium">Inventory</span>
                  <span className="text-sm text-gray-600 mt-1">
                    Manage your products
                  </span>
                </button>

                <button className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 p-6 rounded-lg transition-colors">
                  <FaMoneyBillWave className="text-3xl text-blue-600 mb-2" />
                  <span className="font-medium">Bank</span>
                  <span className="text-sm text-gray-600 mt-1">
                    Manage loans and cash
                  </span>
                </button>
              </div>

              <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between">
                  <div className="mb-3 sm:mb-0">
                    <h3 className="font-medium text-gray-800">Current Turn</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Take your actions and end your turn to advance the game.
                      <br />
                      <span className="font-semibold">
                        {currentGame.current_hour} hours remaining
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={handleEndTurn}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <FaSpinner className="animate-spin mr-2" />{' '}
                        Processing...
                      </span>
                    ) : (
                      'End Turn'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Players Modal - Only load this in multiplayer mode */}
      {!isSinglePlayerMode && showPlayersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Players in Game</h3>
              <button
                onClick={() => setShowPlayersModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {players.length === 0 ? (
                <p className="text-gray-500 italic">No other players found</p>
              ) : (
                <ul className="divide-y">
                  {players.map((p) => (
                    <li
                      key={p.id}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{p.username}</span>
                        {p.user_id === player.user_id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            You
                          </span>
                        )}
                        <div className="text-sm text-gray-600">
                          Location: {p.location}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-green-600">
                        {formatMoney(p.cash)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
