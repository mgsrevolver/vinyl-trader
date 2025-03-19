import React, { useState, useEffect } from 'react';
import { FaClock, FaChevronRight, FaBolt } from 'react-icons/fa';
import '../../App.css';
import { useGame } from '../../contexts/GameContext';

const StoreCard = ({ store, isOpen, formatTime, onClick, className = '' }) => {
  const { getActionsRemaining } = useGame();
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Generate and check for store image when component mounts
    if (store?.name) {
      checkStoreImage(store.name);
    }
  }, [store?.name]);

  // Generate kebab-case image path from store name
  const generateImagePath = (storeName) => {
    if (!storeName) return null;

    const kebabName = storeName
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-'); // Replace spaces with dashes

    return `/storefronts/${kebabName}.jpg`;
  };

  // Check if image exists
  const checkStoreImage = async (storeName) => {
    const imagePath = generateImagePath(storeName);

    try {
      const response = await fetch(imagePath, { method: 'HEAD' });
      if (response.ok) {
        setBackgroundImage(imagePath);
      } else {
        setBackgroundImage(null);
      }
    } catch (error) {
      console.log('Image not found:', imagePath);
      setBackgroundImage(null);
    }
  };

  const handleClick = (e) => {
    setIsAnimating(true);
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 1000);
    onClick && onClick(e);
  };

  return (
    <div
      className={`store-card-wrapper ${className} ${
        backgroundImage ? 'has-store-bg' : ''
      }`}
      onClick={handleClick}
      style={{ border: '2px solid #4e341a' }}
    >
      {backgroundImage && (
        <div
          className="store-card-bg-image"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        ></div>
      )}

      <div className="store-card-content">
        <div className="store-card-title">
          <span className={store.nameClass || ''}>{store.name}</span>
        </div>

        <div className="store-card-hours">
          <FaClock className="time-icon" />
          {formatTime(store.open_hour)} - {formatTime(store.close_hour)}
          <span className={isOpen ? 'status-open' : 'status-closed'}>
            ({isOpen ? 'OPEN' : 'CLOSED'})
          </span>
        </div>

        <div className="store-card-genre">
          Genre:{' '}
          <span className={`genre-value ${store.genreClass || ''}`}>
            {store.specialty_genre || 'Various'}
          </span>
        </div>
      </div>

      <div
        className="store-card-actions"
        style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          className={`action-cost ${isAnimating ? 'action-cost-animate' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            color: '#000',
            fontSize: '14px',
            transition: 'color 0.3s ease',
          }}
        >
          <FaBolt /> 1
        </div>
        <FaChevronRight style={{ fontSize: '28px', color: '#9ca3af' }} />
      </div>
    </div>
  );
};

export default StoreCard;
