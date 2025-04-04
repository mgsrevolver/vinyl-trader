import React, { useState, useRef } from 'react';
import { FaStar, FaTimes, FaCheck } from 'react-icons/fa';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const ProductCard = ({
  product,
  price,
  quantity,
  onBuy,
  onSell,
  actionLabel,
  showAction = true,
  purchasePrice,
  estimatedValue,
  onSkip,
  onLike,
  setShowNextCard,
  condition,
}) => {
  if (!product) return null;

  const { id, name, artist, genre, year, rarity, image_url } = product;
  const displayPrice = price || product.base_price || 0;

  // Calculate rarity stars (1-5 based on rarity value)
  const rarityStars = Math.max(1, Math.min(5, Math.round(rarity * 5))) || 3;

  // Motion values for drag effect
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);

  // Indicator opacity based on drag direction
  const leftIndicatorOpacity = useTransform(x, [-100, -20, 0], [1, 0.5, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 20, 100], [0, 0.5, 1]);

  // Only add swipe functionality when handlers are provided
  const isSwipeable = onSkip && onLike;

  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef(null);
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [exitDirection, setExitDirection] = useState(null);

  // Determine condition color
  const getConditionColor = (cond) => {
    switch (cond) {
      case 'Mint':
      case 'Near Mint':
        return '#10b981'; // Green
      case 'Very Good Plus':
      case 'Very Good':
        return '#3b82f6'; // Blue
      case 'Good':
        return '#f59e0b'; // Yellow
      case 'Fair':
        return '#f97316'; // Orange
      case 'Poor':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <div className="product-card-wrapper">
      {isSwipeable ? (
        <motion.div
          className="product-card swipeable-card"
          style={{
            x,
            rotate,
            zIndex: 10,
          }}
          key={`motion-${id}`}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragStart={() => setShowNextCard && setShowNextCard(true)}
          onDragEnd={(e, { offset }) => {
            setShowNextCard && setShowNextCard(false);
            const swipe =
              offset.x > 100 ? 'right' : offset.x < -100 ? 'left' : '';
            if (swipe === 'right') {
              onLike && onLike(id);
            } else if (swipe === 'left') {
              onSkip && onSkip(id);
            }
          }}
        >
          {/* Swipe indicators */}
          <motion.div
            className="swipe-indicator-large skip-indicator-large"
            style={{ opacity: leftIndicatorOpacity }}
          >
            <FaTimes size={60} />
          </motion.div>

          <motion.div
            className="swipe-indicator-large like-indicator-large"
            style={{ opacity: rightIndicatorOpacity }}
          >
            <FaCheck size={60} />
          </motion.div>

          {/* Card content - following wireframe layout */}
          <div className="product-card-image">
            {image_url ? (
              <img src={image_url} alt={name} className="product-image" />
            ) : (
              <div className="product-image-placeholder">{'{image_url}'}</div>
            )}
          </div>

          <div className="product-card-info">
            {/* Title and artist on top line */}
            <div className="product-title">
              {name} - {artist}
            </div>

            {/* Genre and year on second line */}
            <div className="product-genre-year">
              {genre} ({year})
            </div>

            {/* Condition and stock info together */}
            <div className="product-details">
              <div
                className="product-condition"
                style={{ color: getConditionColor(condition) }}
              >
                Condition: {condition}
              </div>
              {quantity !== undefined && (
                <div className="product-stock">In Stock: {quantity}</div>
              )}
            </div>

            {/* Rarity and price at bottom */}
            <div className="product-footer">
              <div className="product-rarity" style={{ marginBottom: '50px' }}>
                {[...Array(5)].map((_, i) => (
                  <FaStar
                    key={i}
                    size={14}
                    className={
                      i < rarityStars ? 'star-active' : 'star-inactive'
                    }
                  />
                ))}
              </div>
              <div className="product-price" style={{ marginBottom: '50px' }}>
                ${Math.round(parseFloat(displayPrice))}
              </div>
            </div>
          </div>

          {/* Buy/Sell button - positioned properly as a sibling, not child element */}
          {showAction && (onBuy || onSell) && (
            <div
              className="product-action"
              style={{ top: '45%', bottom: 'auto', zIndex: 10 }}
            >
              {onBuy && (
                <button
                  onClick={() => onBuy(id, 1, item?.id)}
                  disabled={quantity < 1}
                  className="product-action-button"
                >
                  {actionLabel || 'Buy'}
                </button>
              )}

              {onSell && (
                <button
                  onClick={() => onSell(id, 1)}
                  className="product-action-button product-sell-button"
                >
                  {actionLabel || 'Sell'}
                </button>
              )}
            </div>
          )}

          {/* Swipe X/✓ Buttons */}
          <div className="swipe-buttons">
            <button
              className="swipe-button skip-button"
              onClick={() => onSkip(id)}
              aria-label="Skip"
            >
              <FaTimes size={24} />
            </button>

            <button
              className="swipe-button like-button"
              onClick={() => onLike(id)}
              aria-label="Like"
            >
              <FaCheck size={24} />
            </button>
          </div>
        </motion.div>
      ) : (
        // Non-swipeable version - also update to match wireframe
        <div className="product-card">
          <div className="product-card-image">
            {image_url ? (
              <img src={image_url} alt={name} className="product-image" />
            ) : (
              <div className="product-image-placeholder">{'{image_url}'}</div>
            )}
          </div>

          <div className="product-card-info">
            {/* Title and artist on top line */}
            <div className="product-title">
              {name} - {artist}
            </div>

            {/* Genre and year on second line */}
            <div className="product-genre-year">
              {genre} ({year})
            </div>

            {/* Condition and stock info together */}
            <div className="product-details">
              <div
                className="product-condition"
                style={{ color: getConditionColor(condition) }}
              >
                Condition: {condition}
              </div>
              {quantity !== undefined && (
                <div className="product-stock">In Stock: {quantity}</div>
              )}
            </div>

            {/* Rarity and price at bottom */}
            <div className="product-footer">
              <div className="product-rarity" style={{ marginBottom: '50px' }}>
                {[...Array(5)].map((_, i) => (
                  <FaStar
                    key={i}
                    size={14}
                    className={
                      i < rarityStars ? 'star-active' : 'star-inactive'
                    }
                  />
                ))}
              </div>
              <div className="product-price" style={{ marginBottom: '50px' }}>
                ${Math.round(parseFloat(displayPrice))}
              </div>
            </div>
          </div>

          {/* Swipe X/✓ Buttons */}
          <div className="swipe-buttons">
            <button
              className="swipe-button skip-button"
              onClick={() => onSkip(id)}
              aria-label="Skip"
            >
              <FaTimes size={24} />
            </button>

            <button
              className="swipe-button like-button"
              onClick={() => onLike(id)}
              aria-label="Like"
            >
              <FaCheck size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCard;
