import React from 'react';
import { FaStar, FaCompactDisc } from 'react-icons/fa';

const getRarityColor = (rarity) => {
  if (!rarity) return '#9ca3af'; // gray-400

  // Convert rarity to a number if it's a string
  const rarityValue = typeof rarity === 'string' ? parseFloat(rarity) : rarity;

  if (rarityValue >= 0.9) return '#fbbf24'; // Yellow/gold for very rare
  if (rarityValue >= 0.8) return '#7c3aed'; // Purple for rare
  if (rarityValue >= 0.7) return '#3b82f6'; // Blue for uncommon
  if (rarityValue >= 0.5) return '#22c55e'; // Green for common
  return '#9ca3af'; // Gray for default
};

const getConditionColor = (condition) => {
  switch (condition?.toLowerCase()) {
    case 'near mint':
    case 'mint':
      return '#16a34a'; // Green
    case 'excellent':
    case 'very good':
      return '#3b82f6'; // Blue
    case 'good':
      return '#f59e0b'; // Amber
    case 'fair':
      return '#f97316'; // Orange
    case 'poor':
      return '#ef4444'; // Red
    default:
      return '#9ca3af'; // Gray
  }
};

// Generate a vinyl album background pattern
const getVinylBackground = (genre) => {
  // You could add more complex patterns based on genre
  const baseColor = getGenreBaseColor(genre);
  return `linear-gradient(45deg, ${baseColor}40 25%, transparent 25%, transparent 75%, ${baseColor}40 75%, ${baseColor}40), 
          linear-gradient(45deg, ${baseColor}40 25%, transparent 25%, transparent 75%, ${baseColor}40 75%, ${baseColor}40)`;
};

const getGenreBaseColor = (genre) => {
  if (!genre) return '#000000';

  const genreLower = genre.toLowerCase();

  if (genreLower.includes('rock')) return '#e11d48'; // Red for Rock
  if (genreLower.includes('pop')) return '#06b6d4'; // Cyan for Pop
  if (genreLower.includes('hip-hop')) return '#8b5cf6'; // Purple for Hip-Hop
  if (genreLower.includes('jazz')) return '#eab308'; // Yellow for Jazz
  if (genreLower.includes('punk')) return '#f97316'; // Orange for Punk
  if (genreLower.includes('indie')) return '#14b8a6'; // Teal for Indie
  if (genreLower.includes('experimental')) return '#9333ea'; // Purple for Experimental
  if (genreLower.includes('new wave')) return '#06b6d4'; // Cyan for New Wave

  // Default color
  return '#6b7280'; // Gray
};

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

  const { id, name, artist, genre, year, condition, rarity, description } =
    product;

  // Use current price if provided, otherwise use base price
  const displayPrice = price || product.base_price || 0;
  const rarityColor = getRarityColor(rarity);
  const genreColor = getGenreBaseColor(genre);
  const conditionColor = getConditionColor(condition);

  return (
    <div className="relative w-full max-w-xs mx-auto transform transition-all duration-300 hover:scale-105">
      <div
        className="record-card rounded-lg overflow-hidden shadow-lg"
        style={{
          background: '#0f172a', // Dark background
          border: `2px solid ${rarityColor}`,
        }}
      >
        {/* Vinyl texture background with genre color */}
        <div
          className="h-24 flex items-center justify-center px-4"
          style={{
            background: getVinylBackground(genre),
            backgroundSize: '30px 30px',
            backgroundPosition: '0 0, 15px 15px',
            backgroundColor: genreColor + '20', // Translucent genre color
            borderBottom: `2px solid ${rarityColor}`,
          }}
        >
          <h2 className="text-white text-xl font-bold text-center leading-tight truncate">
            {name}
          </h2>
        </div>

        {/* Record image/placeholder */}
        <div className="w-full flex justify-center bg-gradient-to-b from-slate-800 to-black py-4">
          <div
            className="w-24 h-24 rounded-full bg-black flex items-center justify-center border-4"
            style={{ borderColor: genreColor }}
          >
            <div className="w-4 h-4 rounded-full bg-slate-300"></div>
          </div>
        </div>

        {/* Record details */}
        <div className="p-4 text-white">
          <div className="flex justify-between mb-2">
            <div className="text-lg font-semibold truncate">{artist}</div>
            <div className="text-slate-300">{year}</div>
          </div>

          <div className="flex justify-between text-sm mb-3">
            <div
              className="px-2 py-1 rounded-full text-xs"
              style={{ backgroundColor: genreColor + '30' }}
            >
              {genre}
            </div>
            <div
              className="px-2 py-1 rounded-full text-xs"
              style={{ backgroundColor: conditionColor, color: 'white' }}
            >
              {condition}
            </div>
          </div>

          {/* Rarity stars */}
          <div className="flex justify-center mb-2">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={14}
                className="mx-0.5"
                color={i < Math.round(rarity * 5) ? rarityColor : '#1e293b'}
              />
            ))}
          </div>

          {/* Purchase info */}
          <div className="flex justify-between items-center mb-3">
            <div className="text-xl font-bold">
              ${parseFloat(displayPrice).toFixed(2)}
            </div>
            {quantity !== undefined && (
              <div className="text-sm text-slate-300">In stock: {quantity}</div>
            )}
          </div>

          {purchasePrice && (
            <div className="text-sm text-slate-300 mb-2">
              You paid: ${parseFloat(purchasePrice).toFixed(2)}
              {estimatedValue && (
                <span className="ml-2">
                  {estimatedValue > purchasePrice ? (
                    <span className="text-green-500">↑</span>
                  ) : (
                    <span className="text-red-500">↓</span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Action button */}
          {showAction && onBuy && (
            <button
              onClick={() => onBuy(id, 1)}
              disabled={quantity < 1}
              className="w-full py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <FaCompactDisc className="mr-2" />
              {actionLabel || 'Buy Now'}
            </button>
          )}

          {showAction && onSell && (
            <button
              onClick={() => onSell(id, 1)}
              className="w-full py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 flex items-center justify-center"
            >
              <FaCompactDisc className="mr-2" />
              {actionLabel || 'Sell Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
