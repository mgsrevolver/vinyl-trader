import React from 'react';
import { FaStar, FaCoins, FaShoppingCart, FaCompactDisc } from 'react-icons/fa';

const SlimProductCard = ({
  item,
  actionType = 'none', // 'none', 'buy', or 'sell'
  onAction,
  storePrice, // New prop for the current store price
}) => {
  // Correctly access the product data through item.products
  const product = item.products || {};
  const { purchase_price, estimated_current_price } = item;

  // Get condition from the item itself (market_inventory) not from products
  const condition = item.condition || product.condition || 'Good';

  // Determine the display price based on the context
  let displayPrice = estimated_current_price || purchase_price || 0;

  // If we're in sell mode and have a store price, use that instead
  if (actionType === 'sell' && storePrice !== undefined) {
    // The storePrice already has the 75% margin applied at the API/business logic level
    displayPrice = storePrice;
  }

  // Only calculate profit if in sell mode
  const showProfit = actionType === 'sell';
  // If we have a purchase price, calculate the profit/loss
  const profit = showProfit ? displayPrice - purchase_price : 0;
  const profitPercentage =
    showProfit && purchase_price ? (profit / purchase_price) * 100 : 0;

  // Calculate rarity stars
  const rarityStars = Math.max(
    1,
    Math.min(5, Math.round((product.rarity || 0.5) * 5))
  );

  // Determine condition color
  const getConditionColor = (cond) => {
    switch (cond) {
      case 'Mint':
        return '#10b981'; // Green
      case 'Good':
        return '#6b7280'; // Blue
      case 'Fair':
        return '#6b7280'; // Yellow
      case 'Poor':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  // Handle button click
  const handleClick = () => {
    if (onAction && actionType !== 'none') {
      // Try to find the product ID from various possible locations
      const productId =
        product?.id || item?.product_id || item?.products?.id || item?.id;

      if (productId) {
        console.log('SlimProductCard onClick with productId:', productId);
        // Always use quantity 1 since each card represents one record
        onAction(productId, 1);
      } else {
        console.error('No product ID found in SlimProductCard:', {
          product,
          item,
        });
      }
    }
  };

  return (
    <div
      style={{
        margin: '4px 0',
        padding: '6px 8px',
        backgroundColor: 'white',
        borderRadius: '6px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: '1px solid #e5e7eb',
        display: 'grid',
        gridTemplateColumns: '50px minmax(0, 1fr) 90px',
        gap: '6px',
        alignItems: 'center',
        height: 'auto',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Album art thumbnail */}
      <div
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <FaCompactDisc color="#9ca3af" size={24} />
        )}
      </div>

      {/* Title and details column - with max width constraint */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0, // Allows proper truncation
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Title row */}
        <h3
          style={{
            fontSize: '15px',
            fontWeight: 'bold',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          {product.name || 'Unknown Record'}
        </h3>

        {/* Artist row */}
        <p
          style={{
            color: '#4b5563',
            margin: '2px 0',
            fontSize: '13px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          {product.artist || 'Unknown Artist'}
        </p>

        {/* Genre and condition badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '11px',
            marginTop: '1px',
          }}
        >
          <div
            style={{
              padding: '1px 4px',
              marginRight: '4px',
              backgroundColor: '#f3f4f6',
              borderRadius: '3px',
              fontSize: '10px',
              whiteSpace: 'nowrap',
            }}
          >
            {product.genre || 'Genre'} ({product.year || 'Year'})
          </div>

          {/* Stars moved next to genre */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: '3px',
            }}
          >
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                color={i < rarityStars ? '#f59e0b' : '#d1d5db'}
                size={8}
                style={{ marginLeft: i > 0 ? '1px' : '0' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Price, condition and button column - fixed width */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          width: '90px',
          flexShrink: 0,
        }}
      >
        {/* Price section */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
            ${Math.round(displayPrice)}
          </div>

          {showProfit && purchase_price && (
            <div style={{ fontSize: '10px', color: '#6b7280' }}>
              Paid: ${Math.round(purchase_price)}
            </div>
          )}

          {showProfit && profit !== undefined && (
            <div
              style={{
                fontSize: '10px',
                color: profit >= 0 ? '#16a34a' : '#dc2626',
                fontWeight: '500',
              }}
            >
              ${Math.round(profit)} ({profitPercentage.toFixed(0)}%)
            </div>
          )}
        </div>

        {/* Condition row */}
        <div
          style={{
            marginTop: '3px',
            marginBottom: '3px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <span
            style={{
              color: getConditionColor(condition),
              fontWeight: 'bold',
            }}
          >
            {condition}
          </span>
        </div>

        {/* Action button */}
        {actionType !== 'none' && (
          <button
            onClick={handleClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: actionType === 'buy' ? '#3b82f6' : '#10b981',
              color: 'white',
              padding: '4px 6px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              width: '100%',
              height: '24px',
            }}
          >
            {actionType === 'buy' ? (
              <>
                <FaShoppingCart style={{ marginRight: '3px' }} size={10} />
                Buy
              </>
            ) : (
              <>
                <FaCoins style={{ marginRight: '3px' }} size={10} />
                Sell
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default SlimProductCard;
