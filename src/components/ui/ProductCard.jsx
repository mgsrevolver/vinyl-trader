import React from 'react';
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
}) => {
  if (!product) return null;

  const { id, name, artist, genre, year, condition, rarity, image_url } =
    product;
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
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragStart={() => setShowNextCard && setShowNextCard(true)}
          onDragEnd={(e, { offset }) => {
            setShowNextCard && setShowNextCard(false);
            const swipe =
              offset.x > 100 ? 'right' : offset.x < -100 ? 'left' : '';
            if (swipe === 'right') {
              onLike(id);
            } else if (swipe === 'left') {
              onSkip(id);
            }
          }}
        >
          {/* Skip indicator */}
          <motion.div
            className="swipe-indicator skip-indicator"
            style={{ opacity: leftIndicatorOpacity }}
          >
            <FaTimes size={30} />
          </motion.div>

          {/* Like indicator */}
          <motion.div
            className="swipe-indicator like-indicator"
            style={{ opacity: rightIndicatorOpacity }}
          >
            <FaCheck size={30} />
          </motion.div>

          {/* Card content */}
          <div className="product-card-image">
            {image_url ? (
              <img src={image_url} alt={name} className="product-image" />
            ) : (
              <div className="product-image-placeholder">{'{image_url}'}</div>
            )}
          </div>

          <div className="product-card-info">
            <div className="product-title-row">
              <div className="product-title">
                {name} - {artist}
              </div>
              <div className="product-genre-year">
                {genre} ({year})
              </div>
            </div>

            <div className="product-condition">Condition: {condition}</div>

            <div className="product-footer">
              <div className="product-rarity">
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

              <div className="product-price">
                ${parseFloat(displayPrice).toFixed(2)}
              </div>
            </div>

            {quantity !== undefined && (
              <div className="product-quantity">In stock: {quantity}</div>
            )}
          </div>

          {/* X/✓ Buttons */}
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
        // Non-swipeable version for sell mode
        <div className="product-card">
          <div className="product-card-image">
            {image_url ? (
              <img src={image_url} alt={name} className="product-image" />
            ) : (
              <div className="product-image-placeholder">{'{image_url}'}</div>
            )}
          </div>

          <div className="product-card-info">
            <div className="product-title-row">
              <div className="product-title">
                {name} - {artist}
              </div>
              <div className="product-genre-year">
                {genre} ({year})
              </div>
            </div>

            <div className="product-condition">Condition: {condition}</div>

            <div className="product-footer">
              <div className="product-rarity">
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

              <div className="product-price">
                ${parseFloat(displayPrice).toFixed(2)}
              </div>
            </div>

            {quantity !== undefined && (
              <div className="product-quantity">In stock: {quantity}</div>
            )}
          </div>

          {/* Buy/Sell button */}
          {showAction && (onBuy || onSell) && (
            <div className="product-action">
              {onBuy && (
                <button
                  onClick={() => onBuy(id, 1)}
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
        </div>
      )}
    </div>
  );
};

export default ProductCard;
