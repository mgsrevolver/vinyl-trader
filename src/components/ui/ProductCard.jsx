import React from 'react';
import { FaStar, FaTimes, FaCheck } from 'react-icons/fa';

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
}) => {
  if (!product) return null;

  const { id, name, artist, genre, year, condition, rarity, image_url } =
    product;
  const displayPrice = price || product.base_price || 0;

  // Calculate rarity stars (1-5 based on rarity value)
  const rarityStars = Math.max(1, Math.min(5, Math.round(rarity * 5))) || 3;

  return (
    <div className="product-card">
      {/* Image area - slightly reduced height */}
      <div className="product-card-image">
        {image_url ? (
          <img src={image_url} alt={name} className="product-image" />
        ) : (
          <div className="product-image-placeholder">{'{image_url}'}</div>
        )}
      </div>

      {/* Card info section - more compact */}
      <div className="product-card-info">
        {/* Title and artist - truncated if needed */}
        <div className="product-title-row">
          <div className="product-title">
            {name} - {artist}
          </div>
          <div className="product-genre-year">
            {genre} ({year})
          </div>
        </div>

        {/* Condition */}
        <div className="product-condition">Condition: {condition}</div>

        {/* Rarity and Price */}
        <div className="product-footer">
          <div className="product-rarity">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={14} // Smaller stars
                className={i < rarityStars ? 'star-active' : 'star-inactive'}
              />
            ))}
          </div>

          <div className="product-price">
            ${parseFloat(displayPrice).toFixed(2)}
          </div>
        </div>

        {/* In stock count */}
        {quantity !== undefined && (
          <div className="product-quantity">In stock: {quantity}</div>
        )}
      </div>

      {/* Swipe buttons */}
      {(onSkip || onLike) && (
        <div className="swipe-buttons">
          <button
            className="swipe-button skip-button"
            onClick={() => onSkip && onSkip(id)}
            aria-label="Skip"
          >
            <FaTimes size={24} />
          </button>

          <button
            className="swipe-button like-button"
            onClick={() => onLike && onLike(id)}
            aria-label="Like"
          >
            <FaCheck size={24} />
          </button>
        </div>
      )}

      {/* Buy/Sell button if needed */}
      {showAction && (onBuy || onSell) && !onLike && !onSkip && (
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
  );
};

export default ProductCard;
