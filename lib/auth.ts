/**
 * Authentication utilities for client-side
 * Supports Telegram WebApp (primary) and device ID (fallback for development)
 * 
 * Note: Device ID generation now uses FingerprintJS for better stability
 */

import { getOrCreateDeviceId as getFingerprintDeviceId, getDeviceId as getStoredDeviceId } from './fingerprint.js';
import { getTelegramInitData, isTelegramWebApp } from './telegram.js';

/**
 * Get or create device ID using FingerprintJS
 * This is now async because fingerprinting requires async operations
 * 
 * Migration: Legacy device IDs are preserved automatically
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    return await getFingerprintDeviceId();
  } catch (error) {
    console.error('Error getting/creating device ID:', error);
    // Return empty string on error (will be handled by callers)
    return '';
  }
}

/**
 * Get device ID synchronously (returns null if not exists)
 * This only checks storage, doesn't generate new IDs
 * For new IDs, use getOrCreateDeviceId() instead
 */
export function getDeviceId(): string | null {
  return getStoredDeviceId();
}

/**
 * Get authentication headers
 * Returns headers with Telegram initData (if in Telegram) or device ID (fallback)
 * Ensures auth header is always present before returning headers
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Priority 1: Telegram WebApp initData (primary for TMA)
  if (isTelegramWebApp()) {
    const initData = getTelegramInitData();
    console.log('[Auth] Telegram WebApp detected', {
      hasInitData: !!initData,
      initDataLength: initData?.length || 0,
      initDataPreview: initData ? initData.substring(0, 100) + '...' : null,
    });
    
    if (initData && initData.trim() !== '') {
      headers['Authorization'] = `Telegram ${initData}`;
      console.log('[Auth] Using Telegram auth', {
        headerLength: headers['Authorization']?.toString().length || 0,
      });
      return headers;
    } else {
      console.warn('[Auth] Telegram WebApp detected but initData is missing', {
        isTelegramWebApp: isTelegramWebApp(),
        initData: initData,
      });
    }
  } else {
    console.log('[Auth] Not in Telegram WebApp, using device ID fallback');
  }

  // Priority 2: Device ID (fallback for development/testing outside Telegram)
  // Retry mechanism to ensure device ID is always available
  let deviceId = await getOrCreateDeviceId();
  
  // If device ID is missing or empty, retry up to 3 times with exponential backoff
  // Increased delays for slower connections and older devices
  if (!deviceId || deviceId.trim() === '') {
    const retryDelays = [200, 500, 1000]; // ms
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      // Exponential backoff to allow fingerprinting operations to complete
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      deviceId = await getOrCreateDeviceId();
      if (deviceId && deviceId.trim() !== '') {
        break;
      }
    }
  }
  
  // Final check - if still empty, log error
  if (!deviceId || deviceId.trim() === '') {
    console.error('Critical: Failed to get or create device ID after retries');
  }
  
  if (deviceId) {
    headers['Authorization'] = `Device ${deviceId}`;
    console.log('[Auth] Using Device auth', {
      deviceIdPrefix: deviceId.substring(0, 20) + '...',
      deviceIdLength: deviceId.length,
    });
  } else {
    console.error('[Auth] Critical: Unable to create device ID, request will fail authentication');
  }

  return headers;
}

/**
 * Get auth token for API requests
 * Returns device ID header format
 * Note: For Clerk tokens, use the useApiRequest hook from lib/api.ts instead
 */
export async function getAuthToken(): Promise<string | null> {
  // Note: Clerk token should be obtained via useApiRequest hook in components
  // This function only returns device ID format for standalone use
  
  const deviceId = await getOrCreateDeviceId();
  if (deviceId) {
    return `Device ${deviceId}`;
  }

  return null;
}

