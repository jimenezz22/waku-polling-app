import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Global error handler for Store protocol errors from ReliableChannel
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || '';
  const errorName = event.reason?.name || '';

  if (errorMessage.includes('No peers available to query') ||
      errorMessage.includes('Failed to retrieve missing message') ||
      errorMessage.includes('Store protocol unavailable') ||
      errorMessage.includes('MissingMessageRetriever') ||
      errorMessage.includes('The operation was aborted') ||
      errorName === 'AbortError') {
    console.warn('🚧 Waku protocol error suppressed (expected behavior):', errorName, errorMessage);
    event.preventDefault(); // Prevent the error from showing in UI
    return;
  }
});

// Also handle regular errors that might be thrown
window.addEventListener('error', (event) => {
  const errorMessage = event.message || '';

  if (errorMessage.includes('No peers available to query') ||
      errorMessage.includes('Failed to retrieve missing message') ||
      errorMessage.includes('The operation was aborted') ||
      errorMessage.includes('AbortError')) {
    console.warn('🚧 Waku protocol error suppressed (error event):', errorMessage);
    event.preventDefault();
    return;
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
