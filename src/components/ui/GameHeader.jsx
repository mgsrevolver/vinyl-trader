import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaCoins, FaWarehouse, FaClock, FaBolt } from 'react-icons/fa';
import { useGame } from '../../contexts/GameContext';
import { gameHourToTimeString, getHoursRemaining } from '../../lib/timeUtils';
import toast from 'react-hot-toast';

const GameHeader = () => {
  const {
    currentGame,
    player,
    playerInventory,
    fetchGameData,
    getActionsRemaining, // New function we'll add to GameContext
  } = useGame();
  const previousHourRef = useRef(null);
  const [isActionAnimating, setIsActionAnimating] = useState(false);
  const [isHourAnimating, setIsHourAnimating] = useState(false);
  const previousActionsRef = useRef(null);
  const [floatingTexts, setFloatingTexts] = useState([]);

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

  // Update the hour change effect
  useEffect(() => {
    if (
      previousHourRef.current !== null &&
      currentGame?.current_hour &&
      previousHourRef.current !== currentGame.current_hour
    ) {
      // Just trigger animation, remove toast
      setIsHourAnimating(true);
      setTimeout(() => setIsHourAnimating(false), 1000);
    }

    if (currentGame?.current_hour) {
      previousHourRef.current = currentGame.current_hour;
    }
  }, [currentGame?.current_hour]);

  // Add effect to detect actions changes and create floating text
  useEffect(() => {
    const currentActions = getActionsRemaining ? getActionsRemaining() : 4;

    if (
      previousActionsRef.current !== null &&
      previousActionsRef.current > currentActions // Only show animation when actions decrease
    ) {
      setIsActionAnimating(true);

      // Add a new floating text with unique ID
      const newFloat = {
        id: Date.now(),
        value: -1,
      };
      setFloatingTexts((prev) => [...prev, newFloat]);

      // Update timeout to match new animation duration (1200ms instead of 800ms)
      const timeoutId = setTimeout(() => {
        setFloatingTexts((prev) =>
          prev.filter((item) => item.id !== newFloat.id)
        );
      }, 1200);

      setTimeout(() => setIsActionAnimating(false), 1000);
    }

    previousActionsRef.current = currentActions;
  }, [getActionsRemaining]);

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

  // Get actions remaining directly from the context
  const actionsRemaining = getActionsRemaining ? getActionsRemaining() : 4;

  // Only create inventory link if we have a game ID
  const inventoryLink = currentGame?.id
    ? `/game/${currentGame.id}/inventory`
    : '';

  return (
    <Link
      to={inventoryLink}
      className="status-bar top-bar"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      <div className="status-content">
        {/* Clock - with animation */}
        <div
          className={`status-stat ${isHourAnimating ? 'action-change' : ''}`}
        >
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

        {/* Actions Remaining - with floating animation */}
        <div
          className={`status-stat ${isActionAnimating ? 'action-change' : ''}`}
          style={{ position: 'relative' }}
        >
          <FaBolt />
          <span>{actionsRemaining} actions</span>

          {/* Floating texts container */}
          {floatingTexts.map((float) => (
            <div key={float.id} className="floating-action">
              <FaBolt className="floating-bolt" />
              {float.value}
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
};

export default GameHeader;
