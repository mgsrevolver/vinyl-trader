import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaWarehouse, FaClock, FaBolt } from 'react-icons/fa';
import { useGame } from '../../contexts/GameContext';
import { gameHourToTimeString, getHoursRemaining } from '../../lib/timeUtils';
import { supabase } from '../../lib/supabase';

const GameHeader = () => {
  const { currentGame, player, playerInventory, fetchGameData } = useGame();
  const [actionsRemaining, setActionsRemaining] = useState(4); // Default to 4 actions

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

  // Add effect to fetch actions remaining
  useEffect(() => {
    const fetchActionsRemaining = async () => {
      if (!player?.id || !currentGame?.id) return;

      try {
        const { data, error } = await supabase
          .from('player_actions')
          .select('actions_available, actions_used')
          .eq('player_id', player.id)
          .eq('game_id', currentGame.id)
          .eq('hour', currentGame.current_hour)
          .single();

        if (error) {
          console.error('Error fetching actions:', error);
          return;
        }

        if (data) {
          const remaining = data.actions_available - data.actions_used;
          setActionsRemaining(remaining);
        }
      } catch (error) {
        console.error('Error in fetchActionsRemaining:', error);
      }
    };

    fetchActionsRemaining();
  }, [player?.id, currentGame?.id, currentGame?.current_hour]);

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
