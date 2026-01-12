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
    // Try multiple ways to get initData
    // Method 1: Direct from @twa-dev/sdk WebApp instance
    if (typeof window !== 'undefined') {
      // @twa-dev/sdk exports WebApp as default, try to access it
      const webApp = window.Telegram?.WebApp;
      if (webApp) {
        const initData = webApp.initData || webApp.initDataRaw || null;
        console.log('[Telegram] Got initData from window.Telegram.WebApp', {
          hasInitData: !!initData,
          initDataLength: initData?.length || 0,
          hasInitDataRaw: !!webApp.initDataRaw,
        });
        return initData || null;
      }
      
      // Method 2: Try to access via @twa-dev/sdk directly (if available)
      // Note: @twa-dev/sdk may not expose initDataRaw directly in browser
      console.log('[Telegram] window.Telegram not available', {
        hasWindow: typeof window !== 'undefined',
        hasTelegram: !!window.Telegram,
        hasWebApp: !!window.Telegram?.WebApp,
      });
    }
    return null;
  } catch (error) {
    console.error('[Telegram] Error getting Telegram initData:', error);
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
  
  // Check multiple ways Telegram might be available
  const hasTelegram = !!window.Telegram?.WebApp;
  const hasInitData = !!window.Telegram?.WebApp?.initData;
  
  console.log('[Telegram] isTelegramWebApp check', {
    hasTelegram,
    hasInitData,
    userAgent: navigator.userAgent?.substring(0, 50),
  });
  
  return hasTelegram;
}
