import React from 'react';
import { BiChevronRight } from 'react-icons/bi';
import { useGame } from '../../contexts/GameContext';
import '../../App.css';

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
      <div className={`store-card-wrapper ${className}`} onClick={onClick}>
        {/* Pass isOpen to children as a prop */}
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { isOpen });
          }
          return child;
        })}

        {/* Arrow positioned on the right using the class from App.css */}
        <div className="store-card-chevron">
          <BiChevronRight />
        </div>
      </div>
    );
  }

  // Default card
  return (
    <div className={`card ${className}`} onClick={onClick}>
      {children}
    </div>
  );
};

export default Card;
