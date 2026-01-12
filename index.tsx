import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './lib/sentry';
import { getOrCreateDeviceId } from './lib/auth';
import { preloadFingerprintAgent } from './lib/fingerprint';
import { initTelegramWebApp, isTelegramWebApp } from './lib/telegram';

// Initialize monitoring
initSentry();
initAnalytics();

// Preload FingerprintJS agent early for better performance
if (typeof window !== 'undefined') {
  preloadFingerprintAgent();
  
  // Initialize Telegram WebApp if in Telegram
  if (isTelegramWebApp()) {
    initTelegramWebApp();
  } else {
    // Initialize device ID for anonymous users (fallback for development)
    getOrCreateDeviceId().catch((error) => {
      console.error('Failed to initialize device ID:', error);
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);