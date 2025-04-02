import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import {
  FaDollarSign,
  FaWarehouse,
  FaBolt,
  FaClock,
  FaRecordVinyl,
  FaCompactDisc,
} from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { clearSupabaseCache } from '../../lib/supabase';
import { gameHourToTimeString } from '../../lib/timeUtils';

// Custom hook to force rerenders
const useForceUpdate = () => {
  const [, setTick] = useState(0);
  return useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);
};

// 80s-inspired vinyl header component
const GameHeader = () => {
  const {
    player,
    currentGame,
    getActionsRemaining,
    loading,
    playerInventory,
    refreshPlayerData,
    refreshPlayerInventory,
  } = useGame();
  const [actionsRemaining, setActionsRemaining] = useState(4);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [displayTime, setDisplayTime] = useState('12PM');
  const prevHourRef = useRef(null);
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

  // Update time display when game hour changes
  useEffect(() => {
    if (currentGame?.current_hour) {
      // Check if hour has changed
      if (prevHourRef.current !== currentGame.current_hour) {
        console.log(`Hour updated in UI: ${currentGame.current_hour}`);
        prevHourRef.current = currentGame.current_hour;

        // Update the displayed time
        const timeString = gameHourToTimeString(currentGame.current_hour);
        setDisplayTime(timeString);
      }
    }
  }, [currentGame?.current_hour]);

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

  // Format the hour display - simplify to just show time
  const hourDisplay = displayTime;

  return (
    <div className="vinyl-header" onClick={goToInventory}>
      <div className="vinyl-groove"></div>
      <div className="vinyl-content">
        <div className="vinyl-stat">
          <div className="vinyl-icon-wrapper cash-icon">
            <FaDollarSign />
          </div>
          <div className="vinyl-stat-value">${displayCash}</div>
        </div>

        <div className="vinyl-stat">
          <div className="vinyl-icon-wrapper inventory-icon">
            <FaRecordVinyl className="spinning-record" />
          </div>
          <div className="vinyl-stat-value">
            {inventoryCount}/{player?.inventory_capacity || 10}
          </div>
        </div>

        <div className="vinyl-stat">
          <div className="vinyl-icon-wrapper action-icon">
            <FaBolt />
          </div>
          <div className="vinyl-stat-value">
            <span className="hide-on-small">{actionsRemaining} actions</span>
          </div>
        </div>

        <div className="vinyl-stat time-stat">
          <div className="vinyl-stat-value time-display">{hourDisplay}</div>
        </div>
      </div>
      <div className="vinyl-groove"></div>
    </div>
  );
};

export default GameHeader;
