import React from 'react';
import {
  FaArrowLeft,
  FaTimes,
  FaRecordVinyl,
  FaCircle,
  FaBolt,
} from 'react-icons/fa';

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
  icon = null,
  withVinyl = false,
  withActionCost = false,
  actionCost = 1,
}) => {
  // Base button styling that matches the travel button
  let buttonClasses = 'inline-flex items-center justify-center';

  // Default to travel button styling
  buttonClasses +=
    ' bg-[#e5e7eb] border border-[#d1d5db] rounded-full shadow-sm';
  buttonClasses += ' font-sans text-sm font-medium transition-all duration-150';

  // Apply variant styles
  if (variant === 'primary') {
    buttonClasses = buttonClasses.replace('bg-[#e5e7eb]', 'bg-[#e5e7eb]');
    buttonClasses = buttonClasses.replace(
      'border-[#d1d5db]',
      'border-[#d1d5db]'
    );
    buttonClasses += ' text-gray-800 hover:bg-gray-200';
  } else if (variant === 'secondary') {
    buttonClasses = buttonClasses.replace('bg-[#e5e7eb]', 'bg-gray-200');
    buttonClasses = buttonClasses.replace(
      'border-[#d1d5db]',
      'border-gray-300'
    );
    buttonClasses += ' text-gray-600 hover:bg-gray-300';
  } else if (variant === 'action') {
    buttonClasses = buttonClasses.replace('bg-[#e5e7eb]', 'bg-blue-500');
    buttonClasses = buttonClasses.replace(
      'border-[#d1d5db]',
      'border-blue-600'
    );
    buttonClasses += ' text-white hover:bg-blue-600';
  }

  // Apply size styles
  if (size === 'sm') {
    buttonClasses += ' px-3 py-1.5 text-xs';
  } else if (size === 'md') {
    buttonClasses += ' px-4 py-2 text-sm';
  } else if (size === 'lg') {
    buttonClasses += ' px-5 py-2.5 text-base';
  }

  // Full width option
  if (fullWidth) {
    buttonClasses += ' w-full';
  }

  // Special button types
  if (isBack) {
    buttonClasses = 'back-button';
  }

  if (isClose) {
    buttonClasses = 'close-button';
  }

  // Add disabled state
  if (disabled) {
    buttonClasses += ' opacity-60 cursor-not-allowed';
  } else {
    buttonClasses += ' hover:shadow-md active:translate-y-0.5 active:shadow-sm';
  }

  // Add beveled appearance
  buttonClasses += ' relative overflow-hidden';

  // Add any additional custom classes
  buttonClasses += ` ${className}`;

  // If this is an action cost button, we'll use a different rendering approach
  if (withActionCost) {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`${buttonClasses.trim()} relative group`}
      >
        {/* Beveled effect overlay */}
        <span className="absolute inset-0 opacity-10 bg-gradient-to-b from-white via-transparent to-black pointer-events-none"></span>

        <div className="flex items-center justify-between w-full">
          {/* Left side - button text */}
          <div className="flex items-center">
            {icon && <span className="mr-2">{icon}</span>}
            <span>{children}</span>
          </div>

          {/* Separator */}
          <div className="mx-2 h-4 border-l border-gray-400 opacity-50"></div>

          {/* Right side - action cost */}
          <div className="flex items-center text-xs font-semibold">
            <FaBolt className="mr-1 text-yellow-500" />
            <span>{actionCost}</span>
          </div>
        </div>
      </button>
    );
  }

  // Regular button rendering
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses.trim()}
      aria-label={isBack ? 'Back' : isClose ? 'Close' : undefined}
    >
      {/* Beveled effect overlay */}
      <span className="absolute inset-0 opacity-10 bg-gradient-to-b from-white via-transparent to-black pointer-events-none"></span>

      {icon && <span className="mr-2">{icon}</span>}
      {!iconOnly && <span>{children}</span>}
    </button>
  );
};

export default Button;
