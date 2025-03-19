import React from 'react';
import { FaArrowLeft, FaTimes } from 'react-icons/fa';

const Button = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isBack = false,
  isClose = false,
  iconOnly = false,
}) => {
  // Base styles that all buttons will have
  const baseStyles = 'font-medium transition-all focus:outline-none';

  // Different size options
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  // Original travel screen-inspired styles for circular buttons
  const circularSizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  // Different variant options based on original TravelScreen styling
  const variantStyles = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white rounded-md',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md',
    danger: 'bg-red-600 hover:bg-red-700 text-white rounded-md',
    success: 'bg-green-600 hover:bg-green-700 text-white rounded-md',
    outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md',
    // Better visible back button
    back: 'bg-white text-gray-800 hover:bg-gray-100 shadow-md rounded-full border border-gray-300',
    // Close button style (from the original)
    close: 'bg-transparent text-gray-500 hover:text-gray-700',
  };

  // Disabled state
  const disabledStyles = disabled
    ? 'opacity-60 cursor-not-allowed'
    : 'cursor-pointer';

  // Full width option
  const widthStyles = fullWidth ? 'w-full' : '';

  // Handle special button types (back, close, icon only)
  let buttonContent = children;
  let finalStyles = '';

  // For circular back button (matching original with better visibility)
  if (isBack) {
    finalStyles = `
      ${baseStyles}
      ${circularSizeStyles[size]}
      ${variantStyles.back}
      ${disabledStyles}
      flex items-center justify-center
      z-10
      ${className}
    `;
    buttonContent = <FaArrowLeft />;
  }
  // For close button (matching original)
  else if (isClose) {
    finalStyles = `
      ${baseStyles}
      ${variantStyles.close}
      ${disabledStyles}
      flex items-center justify-center
      ${className}
    `;
    buttonContent = <FaTimes size={20} />;
  }
  // For custom icon-only button
  else if (iconOnly) {
    finalStyles = `
      ${baseStyles}
      ${circularSizeStyles[size]}
      ${variantStyles[variant]}
      ${disabledStyles}
      flex items-center justify-center
      ${className}
    `;
  }
  // Regular button
  else {
    finalStyles = `
      ${baseStyles}
      ${sizeStyles[size]}
      ${variantStyles[variant]}
      ${disabledStyles}
      ${widthStyles}
      ${className}
    `;
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={finalStyles.trim().replace(/\s+/g, ' ')}
      aria-label={isBack ? 'Back' : isClose ? 'Close' : undefined}
    >
      {buttonContent}
    </button>
  );
};

export default Button;
