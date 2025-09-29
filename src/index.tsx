import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Aggressive Store protocol error suppression - prevent React error overlays
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('No peers available to query') ||
      message.includes('MissingMessageRetriever') ||
      message.includes('is not a function or its return value is not async iterable') ||
      message.includes('this._retrieve') ||
      message.includes('Store') && message.includes('query')) {
    console.warn('⚠️ Store protocol error suppressed at index level:', ...args);
    return;
  }
  originalError.apply(console, args);
};

// Suppress unhandled promise rejections for Store errors
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorStr = error?.toString?.() || String(error);
  if (errorStr.includes('No peers available to query') ||
      errorStr.includes('MissingMessageRetriever') ||
      errorStr.includes('is not a function or its return value is not async iterable') ||
      errorStr.includes('this._retrieve') ||
      errorStr.includes('Store')) {
    console.warn('⚠️ Store protocol promise rejection suppressed at index level:', error);
    event.preventDefault();
  }
});

// Override global error handler to catch Store errors before React
window.addEventListener('error', (event) => {
  const error = event.error || event.message;
  const errorStr = error?.toString?.() || String(error);
  if (errorStr.includes('No peers available to query') ||
      errorStr.includes('MissingMessageRetriever') ||
      errorStr.includes('is not a function or its return value is not async iterable') ||
      errorStr.includes('this._retrieve') ||
      errorStr.includes('Store')) {
    console.warn('⚠️ Store protocol error suppressed at index level:', error);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
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
