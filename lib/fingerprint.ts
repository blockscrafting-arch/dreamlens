/**
 * Browser fingerprinting utilities using FingerprintJS
 * Provides stable device identification for anonymous users
 */

import FingerprintJS, { type Agent } from '@fingerprintjs/fingerprintjs';
import { DEVICE_ID_PREFIX, DEVICE_ID_PATTERN, MIN_DEVICE_ID_LENGTH } from '../shared/validation-rules.js';

const DEVICE_ID_KEY = 'dreamlens_device_id';
const DEVICE_ID_COOKIE = 'dreamlens_device_id';

// Singleton pattern: Initialize agent once and reuse
let fpAgent: Agent | null = null;
let initPromise: Promise<Agent> | null = null;

/**
 * Initialize FingerprintJS agent (singleton)
 * Returns the same promise if already initializing
 */
async function getFingerprintAgent(): Promise<Agent> {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FingerprintJS can only be used in browser environment');
  }

  // Return existing agent if already initialized
  if (fpAgent) {
    return fpAgent;
  }

  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }

  // Initialize agent
  initPromise = FingerprintJS.load()
    .then((agent) => {
      fpAgent = agent;
      return agent;
    })
    .catch((error) => {
      // Reset promise on error so we can retry
      initPromise = null;
      throw error;
    });

  return initPromise;
}

/**
 * Preload FingerprintJS agent as early as possible
 * This function starts loading the agent without waiting for it
 * Call this in index.tsx to optimize first API request performance
 */
export function preloadFingerprintAgent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // If already initialized or initializing, do nothing
  if (fpAgent || initPromise) {
    return;
  }

  // Start loading agent in background (fire and forget)
  getFingerprintAgent().catch((error) => {
    // Silently handle errors - they will be retried when actually needed
    console.warn('[Fingerprint] Preload failed, will retry on demand:', error);
  });
}

/**
 * Get cookie by name
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

/**
 * Set cookie
 */
function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
}

/**
 * Get legacy device ID from storage (if exists)
 * This preserves existing users' tokens and history
 */
function getLegacyDeviceId(): string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    // Try localStorage first
    try {
      const stored = localStorage.getItem(DEVICE_ID_KEY);
      if (stored && stored.trim() !== '') {
        return stored;
      }
    } catch (e) {
      console.warn('localStorage access failed:', e);
    }

    // Try cookie as fallback
    const cookieId = getCookie(DEVICE_ID_COOKIE);
    if (cookieId && cookieId.trim() !== '') {
      // Recover to localStorage if possible
      try {
        localStorage.setItem(DEVICE_ID_KEY, cookieId);
      } catch (e) {
        // Ignore
      }
      return cookieId;
    }

    return null;
  } catch (error) {
    console.error('Error getting legacy device ID:', error);
    return null;
  }
}

/**
 * Save device ID to both localStorage and cookie
 */
function saveDeviceId(deviceId: string): void {
  try {
    // Save to localStorage
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch (e) {
      console.error('Error saving device ID to localStorage:', e);
    }

    // Save to cookie
    try {
      setCookie(DEVICE_ID_COOKIE, deviceId);
    } catch (e) {
      console.error('Error saving device ID to cookie:', e);
    }
  } catch (error) {
    console.error('Error saving device ID:', error);
  }
}

/**
 * Get or create device ID with migration logic
 * - If legacy device ID exists, use it (preserves user data)
 * - Otherwise, generate new FingerprintJS visitorId
 * 
 * Returns device ID in format: device_<id>
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return '';
    }

    // Step 1: Check for legacy device ID (migration support)
    const legacyId = getLegacyDeviceId();
    if (legacyId && legacyId.trim() !== '') {
      // Ensure it has the correct prefix
      if (legacyId.startsWith(DEVICE_ID_PREFIX)) {
        console.log('[Fingerprint] Using legacy device ID:', legacyId.substring(0, 20) + '...');
        return legacyId;
      }
      // If legacy ID exists but doesn't have prefix, add it
      const prefixedId = DEVICE_ID_PREFIX + legacyId;
      saveDeviceId(prefixedId);
      return prefixedId;
    }

    // Step 2: No legacy ID found - generate new FingerprintJS ID
    try {
      const agent = await getFingerprintAgent();
      const result = await agent.get();
      const visitorId = result.visitorId;

      // Validate visitorId format before using it
      // FingerprintJS visitorId should be alphanumeric, but we validate to be safe
      const deviceId = DEVICE_ID_PREFIX + visitorId;
      
      // Check if the generated device ID matches our validation pattern
      if (!DEVICE_ID_PATTERN.test(deviceId) || deviceId.length < MIN_DEVICE_ID_LENGTH) {
        console.warn('[Fingerprint] VisitorId format invalid, using UUID fallback:', {
          visitorIdLength: visitorId.length,
          deviceIdLength: deviceId.length,
          visitorIdSample: visitorId.substring(0, 20) + '...',
        });
        // Fallback to UUID if visitorId doesn't match our pattern
        const fallbackId = DEVICE_ID_PREFIX + crypto.randomUUID();
        saveDeviceId(fallbackId);
        return fallbackId;
      }

      // Save to storage
      saveDeviceId(deviceId);

      console.log('[Fingerprint] Generated new device ID:', deviceId.substring(0, 30) + '...');
      return deviceId;
    } catch (fingerprintError) {
      console.error('Error generating FingerprintJS ID:', fingerprintError);
      
      // Fallback: Generate a simple ID if FingerprintJS fails
      // This should rarely happen, but we need a fallback
      const fallbackId = DEVICE_ID_PREFIX + crypto.randomUUID();
      saveDeviceId(fallbackId);
      console.warn('[Fingerprint] Using fallback ID generation');
      return fallbackId;
    }
  } catch (error) {
    console.error('Error in getOrCreateDeviceId:', error);
    
    // Last resort fallback
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        const fallbackId = DEVICE_ID_PREFIX + crypto.randomUUID();
        saveDeviceId(fallbackId);
        return fallbackId;
      }
    } catch (e) {
      // Ignore
    }
    
    // Ultimate fallback (should never reach here)
    return DEVICE_ID_PREFIX + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

/**
 * Get device ID synchronously (returns null if not exists)
 * This is a synchronous version that only checks storage
 * For new IDs, use getOrCreateDeviceId() instead
 */
export function getDeviceId(): string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(DEVICE_ID_KEY) || getCookie(DEVICE_ID_COOKIE);
  } catch (error) {
    console.error('Error getting device ID:', error);
    return null;
  }
}
