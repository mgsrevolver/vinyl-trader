import React from 'react';
import { useGame } from '../../contexts/GameContext';

const Card = ({
  children,
  className = '',
  onClick,
  variant = 'default',
  storeData = null, // Store hours data
}) => {
  const { currentGame } = useGame();

  // Store card variant
  if (variant === 'store') {
    // Check if we have the store data needed
    const hasStoreHours =
      storeData &&
      typeof storeData.open_hour === 'number' &&
      typeof storeData.close_hour === 'number';

    // Determine if store is open based on current game hour
    let isOpen = false;
    let currentHour = 0;

    if (hasStoreHours && currentGame?.current_hour) {
      // Convert 24-hour countdown to 12-hour format
      currentHour = (24 - currentGame.current_hour) % 24;

      // Check if current hour is within open hours
      isOpen =
        currentHour >= storeData.open_hour &&
        currentHour < storeData.close_hour;
    }

    return (
      <div
        className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer border border-gray-200 ${className}`}
        onClick={onClick}
        style={{
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
          transform: 'translateZ(0)', // Forces hardware acceleration for smoother transitions
        }}
      >
        <div className="p-4">
          {/* We'll let the children handle all content */}
          {children}

          {/* We pass isOpen to children via React.cloneElement if needed */}
          {hasStoreHours &&
            React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, { isOpen });
              }
              return child;
            })}
        </div>

        {/* Make it look more tappable with a bottom gray bar */}
        <div className="bg-gray-100 px-4 py-2 border-t border-gray-200 flex justify-end">
          <div className="text-gray-500 text-sm">Tap to view →</div>
        </div>
      </div>
    );
  }

  // Default card
  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer border border-gray-200 hover:shadow-lg ${className}`}
      onClick={onClick}
      style={{
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </div>
  );
};

export default Card;
