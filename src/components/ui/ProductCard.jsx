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

  // Use the CSS classes already defined in App.css
  return (
    <div className="product-card">
      {/* Main image area */}
      <div className="h-[60%]">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="w-[80%] h-[80%] bg-white rounded-lg"></div>
        )}
      </div>

      {/* Card info section */}
      <div className="p-4 bg-gray-100">
        {/* Name - Artist */}
        <div className="mb-2 border-b border-gray-300 pb-2">
          <h3 className="font-bold text-lg leading-tight truncate">{name}</h3>
          <p className="text-sm text-gray-600 truncate">{artist}</p>
        </div>

        {/* Genre and Year */}
        <div className="flex justify-between mb-2 text-sm">
          <span className="px-2 py-1 bg-gray-200 rounded-full text-xs">
            {genre}
          </span>
          <span className="text-gray-700">({year})</span>
        </div>

        {/* Condition */}
        <div className="mb-2">
          <span
            className={`px-2 py-1 text-white text-xs rounded-full ${
              condition?.toLowerCase().includes('mint')
                ? 'bg-green-600'
                : condition?.toLowerCase().includes('excellent')
                ? 'bg-blue-600'
                : condition?.toLowerCase().includes('good')
                ? 'bg-amber-500'
                : condition?.toLowerCase().includes('fair')
                ? 'bg-orange-500'
                : 'bg-red-500'
            }`}
          >
            Condition: {condition}
          </span>
        </div>

        {/* Rarity and Price at bottom */}
        <div className="flex justify-between items-end mt-2">
          {/* Rarity stars */}
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={16}
                className={i < rarityStars ? 'text-amber-400' : 'text-gray-300'}
              />
            ))}
          </div>

          {/* Price */}
          <div className="font-bold text-lg">
            ${parseFloat(displayPrice).toFixed(2)}
          </div>
        </div>

        {/* Purchase info for selling view */}
        {purchasePrice && (
          <div className="text-xs text-gray-600 mt-1">
            You paid: ${parseFloat(purchasePrice).toFixed(2)}
            {estimatedValue && (
              <span className="ml-1">
                {estimatedValue > purchasePrice ? (
                  <span className="text-green-600">
                    ↑ ${(estimatedValue - purchasePrice).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-red-600">
                    ↓ ${(purchasePrice - estimatedValue).toFixed(2)}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Quantity indicator */}
        {quantity !== undefined && (
          <div className="text-xs text-gray-600 mt-1">
            {quantity > 0 ? `In stock: ${quantity}` : 'Out of stock'}
          </div>
        )}
      </div>

      {/* Action buttons positioned absolutely at bottom */}
      {showAction && (onBuy || onSell) && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50">
          {onBuy && (
            <button
              onClick={() => onBuy(id, 1)}
              disabled={quantity < 1}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLabel || 'Buy Now'}
            </button>
          )}

          {onSell && (
            <button
              onClick={() => onSell(id, 1)}
              className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              {actionLabel || 'Sell Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductCard;
