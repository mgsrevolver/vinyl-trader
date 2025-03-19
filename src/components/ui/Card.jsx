import React from 'react';
import { BiChevronRight } from 'react-icons/bi';
import { useGame } from '../../contexts/GameContext';
import './CardReset.css'; // Import the CSS reset

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
    // Calculate if store is open if we have store data
    let isOpen = false;
    if (
      storeData &&
      typeof storeData.open_hour === 'number' &&
      typeof storeData.close_hour === 'number' &&
      currentGame?.current_hour
    ) {
      const currentHour = (24 - currentGame.current_hour) % 24;
      isOpen =
        currentHour >= storeData.open_hour &&
        currentHour < storeData.close_hour;
    }

    return (
      <div
        className={`store-card-wrapper border border-gray-200 rounded-md shadow-sm mb-4 relative cursor-pointer hover:shadow-md ${className}`}
        onClick={onClick}
        style={{
          backgroundColor: 'white',
          padding: '12px 40px 12px 12px',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Pass isOpen to children as a prop */}
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { isOpen });
          }
          return child;
        })}

        {/* Arrow positioned on the right */}
        <div
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
          style={{ fontSize: '24px' }}
        >
          <BiChevronRight />
        </div>
      </div>
    );
  }

  // Default card
  return (
    <div
      className={`card-wrapper bg-white rounded-md shadow-sm cursor-pointer ${className}`}
      onClick={onClick}
      style={{ marginBottom: '16px' }}
    >
      {children}
    </div>
  );
};

export default Card;
