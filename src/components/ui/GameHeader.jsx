import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaWarehouse, FaClock } from 'react-icons/fa';
import { useGame } from '../../contexts/GameContext';
import { gameHourToTimeString, getHoursRemaining } from '../../lib/timeUtils';

const GameHeader = () => {
  const { currentGame, player, playerInventory, fetchGameData } = useGame();

  // Add an effect to refresh data periodically
  useEffect(() => {
    // Initial fetch when component mounts
    fetchGameData && fetchGameData();

    // Set up an interval to refresh data
    const intervalId = setInterval(() => {
      fetchGameData && fetchGameData();
    }, 5000); // Check every 5 seconds

    // Clean up interval when component unmounts
    return () => clearInterval(intervalId);
  }, [fetchGameData]);

  // Listen for changes in currentGame.current_hour and update immediately
  useEffect(() => {
    // This effect will run whenever currentGame.current_hour changes
    // We don't need to do anything here, as React will re-render automatically
    // when the currentGame state in context changes
  }, [currentGame?.current_hour]);

  // Format money as whole dollars only
  const formatMoney = (amount) => {
    return `$${Math.round(parseFloat(amount || 0))}`;
  };

  // Calculate total inventory
  const inventoryCount =
    playerInventory?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  if (!currentGame || !player) return null;

  // Get the formatted time and hours remaining
  const timeDisplay = gameHourToTimeString(currentGame.current_hour);
  const hoursRemaining = getHoursRemaining(currentGame.current_hour);

  return (
    <div className="status-bar">
      <div className="status-content">
        {/* Clock */}
        <div className="status-stat">
          <FaClock />
          <span>
            {timeDisplay.replace(':00', '')} ({hoursRemaining} hrs left)
          </span>
        </div>

        {/* Cash - simplified to whole dollars */}
        <div className="status-stat">
          <FaCoins />
          <span>{formatMoney(player.cash)}</span>
        </div>

        {/* Inventory */}
        <div className="status-stat">
          <FaWarehouse />
          <span>
            {inventoryCount}/{player.inventory_capacity}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameHeader;
