import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaWarehouse, FaClock, FaBolt } from 'react-icons/fa';
import { useGame } from '../../contexts/GameContext';
import { gameHourToTimeString, getHoursRemaining } from '../../lib/timeUtils';
import { supabase } from '../../lib/supabase';
import { getPlayerActions } from '../../lib/gameActions';
import toast from 'react-hot-toast';

const GameHeader = () => {
  const { currentGame, player, playerInventory, fetchGameData } = useGame();
  const [actionsRemaining, setActionsRemaining] = useState(4); // Default to 4 actions
  const previousHourRef = useRef(null);

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

  // Function to fetch actions remaining
  const fetchActionsRemaining = async () => {
    if (!player?.id || !currentGame?.id) return;

    try {
      // Use the getPlayerActions function from gameActions.js instead of direct query
      const actionsData = await getPlayerActions(
        player.id,
        currentGame.id,
        currentGame.current_hour
      );

      if (actionsData) {
        const remaining =
          actionsData.actions_available - actionsData.actions_used;
        console.log('Updated actions remaining:', remaining);
        setActionsRemaining(remaining);
      }
    } catch (error) {
      console.error('Error in fetchActionsRemaining:', error);
      // Don't update state on error, keep previous value
    }
  };

  // Add effect to fetch actions remaining
  useEffect(() => {
    fetchActionsRemaining();

    // Set up an interval to refresh actions less frequently to avoid too many errors
    const actionsInterval = setInterval(() => {
      fetchActionsRemaining();
    }, 10000); // Check every 10 seconds instead of 5

    return () => clearInterval(actionsInterval);
  }, [player?.id, currentGame?.id, currentGame?.current_hour]);

  // Add effect to detect hour changes
  useEffect(() => {
    // If we have a previous hour and it changed
    if (
      previousHourRef.current !== null &&
      currentGame?.current_hour &&
      previousHourRef.current !== currentGame.current_hour
    ) {
      // Show a toast notification about the hour change
      toast.success(
        `Hour advanced! ${getHoursRemaining(
          currentGame.current_hour
        )} hours remaining`
      );
    }

    // Update the ref with current hour
    if (currentGame?.current_hour) {
      previousHourRef.current = currentGame.current_hour;
    }
  }, [currentGame?.current_hour]);

  // Add effect to refetch actions when location changes
  useEffect(() => {
    if (player?.current_borough_id) {
      // Only log if we have debug enabled
      // console.log('Borough changed, updating actions');
      fetchActionsRemaining();
    }
  }, [player?.current_borough_id]);

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
    <div className="status-bar top-bar">
      <div className="status-content">
        {/* Clock - first item */}
        <div className="status-stat">
          <FaClock />
          <span>
            {timeDisplay.replace(':00', '')} ({hoursRemaining} hrs left)
          </span>
        </div>

        {/* Cash - second item */}
        <div className="status-stat">
          <FaCoins />
          <span>{formatMoney(player.cash)}</span>
        </div>

        {/* Inventory - third item */}
        <div className="status-stat">
          <FaWarehouse />
          <span>
            {inventoryCount}/{player.inventory_capacity}
          </span>
        </div>

        {/* Actions Remaining - fourth item */}
        <div className="status-stat">
          <FaBolt />
          <span>{actionsRemaining} actions</span>
        </div>
      </div>
    </div>
  );
};

export default GameHeader;
