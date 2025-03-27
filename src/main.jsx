import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Add initialization debug logging
console.log('Application initialization started');

// Add error event listeners
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Create root with error handling
const root = ReactDOM.createRoot(document.getElementById('root'));

// Wrap render in try-catch
try {
  console.log('Attempting to render application');
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('Initial render completed');
} catch (error) {
  console.error('Error during initial render:', error);
  // Render error state directly if everything fails
  root.render(
    <div style={{ padding: '20px' }}>
      <h1>Failed to initialize application</h1>
      <pre>{error.toString()}</pre>
    </div>
  );
}
