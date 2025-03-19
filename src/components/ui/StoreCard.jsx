import React from 'react';
import { BiTimeFive, BiChevronRight } from 'react-icons/bi';
import '../../App.css';

const StoreCard = ({ store, isOpen, formatTime, onClick, className = '' }) => {
  return (
    <div className={`store-card-wrapper ${className}`} onClick={onClick}>
      <div>
        <h3 className="store-card-title">{store.name}</h3>

        <div className="store-card-hours">
          <BiTimeFive className="time-icon" />
          {formatTime(store.open_hour)} - {formatTime(store.close_hour)}{' '}
          <span className={isOpen ? 'status-open' : 'status-closed'}>
            ({isOpen ? 'OPEN' : 'CLOSED'})
          </span>
        </div>

        <div className="store-card-genre">
          Genre:{' '}
          <span className="genre-value">
            {store.specialty_genre || 'Various'}
          </span>
        </div>
      </div>

      {/* Chevron arrow - positioned absolute right */}
      <div className="store-card-chevron">
        <BiChevronRight />
      </div>
    </div>
  );
};

export default StoreCard;
