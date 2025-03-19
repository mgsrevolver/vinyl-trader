import React from 'react';
import { FaBolt } from 'react-icons/fa';

/**
 * ActionButton - A pill-shaped button with an action cost indicator
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button text/content
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.active - Whether button is in active state
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {React.ReactNode} props.icon - Optional icon to display before text
 * @param {number} props.actionCost - Number of actions this button costs (default: 1)
 * @param {string} props.activeColor - Color scheme when active (blue/green/purple)
 * @param {string} props.className - Additional classes
 */
const ActionButton = ({
  children,
  onClick,
  active = false,
  disabled = false,
  icon = null,
  actionCost = 1,
  activeColor = 'blue',
  className = '',
}) => {
  // Determine color scheme based on activeColor prop
  let bgColor, textColor, borderColor;

  if (active) {
    if (activeColor === 'green') {
      bgColor = 'bg-green-600';
      textColor = 'text-white';
      borderColor = 'border-green-700';
    } else {
      // Default blue
      bgColor = 'bg-blue-600';
      textColor = 'text-white';
      borderColor = 'border-blue-700';
    }
  } else {
    bgColor = 'bg-gray-100';
    textColor = 'text-gray-800';
    borderColor = 'border-gray-300';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Use very specific class naming to avoid conflicts
      className={`action-button ${bgColor} ${textColor} ${borderColor} ${className}`}
      style={{
        // Use inline styles for critical properties to avoid conflicts
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: '6px',
        border: '1px solid',
        flex: '1',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {/* Left side - icon and text */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {icon && <span style={{ marginRight: '8px' }}>{icon}</span>}
        <span style={{ fontWeight: 500 }}>{children}</span>
      </div>

      {/* Right side - action cost */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <FaBolt
          style={{ color: active ? '#fde047' : '#eab308', marginRight: '4px' }}
        />
        <span style={{ fontWeight: 700 }}>{actionCost}</span>
      </div>
    </button>
  );
};

export default ActionButton;
