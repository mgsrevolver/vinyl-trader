import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '../../contexts/GameContext';
import { FaCoins, FaWarehouse, FaBolt, FaClock, FaSync } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { clearSupabaseCache } from '../../lib/supabase';

// Custom hook to force rerenders
const useForceUpdate = () => {
  const [, setTick] = useState(0);
  return useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);
};

// Simple header component that shows game stats
const GameHeader = () => {
  const {
    player,
    getActionsRemaining,
    loading,
    playerInventory,
    refreshPlayerData,
    refreshPlayerInventory,
  } = useGame();
  const [actionsRemaining, setActionsRemaining] = useState(4);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const { gameId } = useParams();
  const forceUpdate = useForceUpdate();

  // Force refresh every 1 second to catch any state changes
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
      forceUpdate(); // Force rerender independent of state

      // Always refresh data on every tick
      if (refreshPlayerData) {
        refreshPlayerData().catch((err) =>
          console.error('Failed to refresh player data:', err)
        );
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [refreshPlayerData, forceUpdate]);

  // Add an immediate refresh when component mounts
  useEffect(() => {
    // Initial refresh on mount
    if (refreshPlayerData) {
      refreshPlayerData();
    }
  }, [refreshPlayerData]);

  // Update actions remaining when player changes
  useEffect(() => {
    if (player) {
      setActionsRemaining(getActionsRemaining ? getActionsRemaining() : 4);
    }
  }, [player, getActionsRemaining, lastRefresh]);

  // Manual refresh function
  const handleRefresh = async (e) => {
    e.stopPropagation(); // Don't trigger the inventory navigation

    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Clear all caches
      clearSupabaseCache();

      // Refresh data
      if (refreshPlayerData) await refreshPlayerData();
      if (refreshPlayerInventory) await refreshPlayerInventory();

      // Force UI update
      forceUpdate();
    } catch (err) {
      console.error('Manual refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Make sure we have a valid cash value - never show $0 if player isn't loaded yet
  const displayCash = player ? (player.cash || 0).toFixed(2) : '...';

  // Handle navigation to inventory
  const goToInventory = () => {
    if (gameId) {
      navigate(`/game/${gameId}/inventory`);
    }
  };

  // Display inventory count from playerInventory if available
  const inventoryCount = playerInventory
    ? playerInventory.reduce((sum, item) => sum + (item.quantity || 0), 0)
    : player?.inventory_count || 0;

  return (
    <div
      className="status-bar top-bar"
      onClick={goToInventory}
      style={{ cursor: 'pointer' }}
    >
      <div className="status-content">
        <div className="status-stat">
          <FaCoins />
          <span>${displayCash}</span>
        </div>

        <div className="status-stat">
          <FaWarehouse />
          <span>
            {inventoryCount}/{player?.inventory_capacity || 10}
          </span>
        </div>

        <div className="status-stat">
          <FaBolt />
          <span>{actionsRemaining} actions</span>
        </div>

        <div className="status-stat">
          <FaClock />
          <span>
            {player?.current_hour || 12}PM ({player?.current_hour || 24}h)
          </span>
        </div>

        <button
          onClick={handleRefresh}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            padding: '4px',
            cursor: 'pointer',
            position: 'absolute',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Refresh data"
        >
          <FaSync
            className={isRefreshing ? 'animate-spin' : ''}
            style={{ opacity: isRefreshing ? 0.7 : 1 }}
          />
        </button>
      </div>
    </div>
  );
};

export default GameHeader;
