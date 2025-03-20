import React from 'react';
import { FaStar, FaCoins } from 'react-icons/fa';

const SlimProductCard = ({ item, onSell }) => {
  // Log the item to see its structure
  console.log('SlimProductCard item:', item);

  // Correctly access the product data through item.products
  const product = item.products || {};
  const { quantity, purchase_price, estimated_current_price } = item;

  const displayPrice = estimated_current_price || purchase_price || 0;
  const profit = displayPrice - purchase_price;
  const profitPercentage = purchase_price ? (profit / purchase_price) * 100 : 0;

  // Calculate rarity stars
  const rarityStars = Math.max(
    1,
    Math.min(5, Math.round((product.rarity || 0.5) * 5))
  );

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
      }}
    >
      <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>
        {product.name || 'Unknown Record'}
      </h3>
      <p style={{ color: '#4b5563', marginBottom: '8px' }}>
        {product.artist || 'Unknown Artist'}
      </p>

      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            marginRight: '8px',
            backgroundColor: '#f3f4f6',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {product.genre || 'Genre'} ({product.year || 'Year'})
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            backgroundColor: '#f3f4f6',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {product.condition || 'Condition'}
        </div>
      </div>

      <div style={{ display: 'flex', marginBottom: '8px' }}>
        {[...Array(5)].map((_, i) => (
          <FaStar
            key={i}
            color={i < rarityStars ? '#f59e0b' : '#d1d5db'}
            size={14}
            style={{ marginRight: '2px' }}
          />
        ))}
      </div>

      <div style={{ marginBottom: '4px' }}>
        <span>Qty: {quantity}</span>
      </div>

      <div className="product-values">
        <div className="price-tag">
          <span className="current-price">${Math.round(displayPrice)}</span>
          {purchase_price && (
            <span className="purchase-info">
              Paid: ${Math.round(purchase_price)}
            </span>
          )}
          {profit !== undefined && (
            <span
              className={`profit-info ${profit >= 0 ? 'positive' : 'negative'}`}
            >
              ${Math.round(profit)} ({profitPercentage.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onSell(product.id || item.product_id, 1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <FaCoins style={{ marginRight: '6px' }} />
        Sell
      </button>
    </div>
  );
};

export default SlimProductCard;
