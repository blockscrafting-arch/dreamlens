/**
 * Telegram WebApp SDK utilities
 * Provides access to Telegram Mini App functionality
 */

import WebApp from '@twa-dev/sdk';

// Define the global Telegram interface
declare global {
  interface Window {
    Telegram?: {
      WebApp: typeof WebApp;
    };
  }
}

/**
 * Initialize Telegram WebApp
 * Should be called once when app loads
 */
export function initTelegramWebApp(): void {
  // Telegram SDK auto-initializes when imported
  // This function can be used for additional setup
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const webApp = window.Telegram.WebApp;
    
    // Expand to full screen
    webApp.expand();
    
    // Enable closing confirmation
    webApp.enableClosingConfirmation();
    
    // Set theme colors if needed
    // webApp.setHeaderColor('#ffffff');
    // webApp.setBackgroundColor('#ffffff');
  }
}

/**
 * Get Telegram initData for authentication
 * Returns the raw initData string that should be sent to backend
 */
export function getTelegramInitData(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const webApp = window.Telegram?.WebApp;
      if (webApp) {
        return webApp.initData || webApp.initDataRaw || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get Telegram WebApp instance
 */
export function getTelegramWebApp(): typeof WebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * Check if running in Telegram
 */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return !!window.Telegram?.WebApp;
}
