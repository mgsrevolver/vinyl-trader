import React from 'react';
import { FaArrowLeft, FaTimes, FaRecordVinyl, FaCircle } from 'react-icons/fa';

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
}) => {
  // Create the class string using the new CSS classes
  let buttonClasses = `btn btn-${variant} btn-${size}`;

  if (fullWidth) {
    buttonClasses += ' btn-full';
  }

  if (isBack) {
    buttonClasses += ' back-button';
  }

  if (isClose) {
    buttonClasses += ' close-button';
  }

  if (withVinyl) {
    buttonClasses += ' with-vinyl';
  }

  // Add any additional classes
  buttonClasses += ` ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses.trim()}
      aria-label={isBack ? 'Back' : isClose ? 'Close' : undefined}
    >
      {/* Vinyl record background for special buttons */}
      {withVinyl && <div className="vinyl-background"></div>}

      {/* Button content */}
      <div className="button-content">
        {icon && <span className="button-icon">{icon}</span>}
        {children}
      </div>
    </button>
  );
};

export default Button;
