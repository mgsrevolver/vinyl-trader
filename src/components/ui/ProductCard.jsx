import React from 'react';
import { FaStar } from 'react-icons/fa';

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
}) => {
  if (!product) return null;

  const { id, name, artist, genre, year, condition, rarity, image_url } =
    product;
  const displayPrice = price || product.base_price || 0;

  // Calculate rarity stars (1-5 based on rarity value)
  const rarityStars = Math.max(1, Math.min(5, Math.round(rarity * 5))) || 3;

  return (
    <div className="product-card">
      {/* Image area (60% of height) */}
      <div className="product-card-image">
        {image_url ? (
          <img src={image_url} alt={name} className="product-image" />
        ) : (
          <div className="product-image-placeholder">{'{image_url}'}</div>
        )}
      </div>

      {/* Card info section */}
      <div className="product-card-info">
        {/* Name - Artist and genre(year) on same line */}
        <div className="product-title-row">
          <div className="product-title">
            {name} - {artist}
          </div>
          <div className="product-genre-year">
            {genre} ({year})
          </div>
        </div>

        {/* Condition on its own line */}
        <div className="product-condition">Condition: {condition}</div>

        {/* Rarity and Price at bottom */}
        <div className="product-footer">
          {/* Rarity stars */}
          <div className="product-rarity">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={16}
                className={i < rarityStars ? 'star-active' : 'star-inactive'}
              />
            ))}
          </div>

          {/* Price */}
          <div className="product-price">
            ${parseFloat(displayPrice).toFixed(2)}
          </div>
        </div>

        {/* Quantity indicator */}
        {quantity !== undefined && (
          <div className="product-quantity">In stock: {quantity}</div>
        )}
      </div>

      {/* Buy/Sell Button */}
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
  );
};

export default ProductCard;
