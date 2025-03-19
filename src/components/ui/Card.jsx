import React from 'react';

const Card = ({ children, className = '', onClick }) => {
  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden cursor-pointer border border-gray-200 hover:border-gray-300 ${className}`}
      onClick={onClick}
      style={{
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </div>
  );
};

export default Card;
