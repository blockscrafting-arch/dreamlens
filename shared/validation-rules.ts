/**
 * Shared validation rules and constants
 * Used across client and server for consistency
 * 
 * Note: This file is shared between client (lib/) and server (api/) code
 */

// Device ID validation constants
// Device IDs are generated as:
// - device_<UUID> (if crypto.randomUUID is available) - length ~43
// - device_<timestamp>_<random1>_<random2> (fallback) - length varies (typically 40-50, but can be shorter for older IDs)
// Note: We use 20 as minimum to support backward compatibility with existing device IDs
export const DEVICE_ID_PREFIX = 'device_';
// Minimum length: prefix (7) + minimum content (13) = 20
// This supports both UUID format (43 chars) and fallback format (variable length, can be 27+ for older IDs)
export const MIN_DEVICE_ID_LENGTH = 20; // Minimum for backward compatibility with existing device IDs
export const DEVICE_ID_PATTERN = /^device_[a-zA-Z0-9_-]+$/; // Allow alphanumeric, dashes, underscores after prefix

/**
 * Validate device ID format
 * Returns true if valid, false otherwise
 */
export function validateDeviceIdFormat(deviceId: string): boolean {
  if (!deviceId.startsWith(DEVICE_ID_PREFIX)) {
    return false;
  }
  
  if (deviceId.length < MIN_DEVICE_ID_LENGTH) {
    return false;
  }
  
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    return false;
  }
  
  return true;
}

/**
 * Get device ID validation error message
 * Returns specific error message or null if valid
 */
export function getDeviceIdValidationError(deviceId: string): string | null {
  if (!deviceId) {
    return 'Missing device ID';
  }
  
  if (!deviceId.startsWith(DEVICE_ID_PREFIX)) {
    return 'Invalid device ID format: must start with "device_"';
  }
  
  if (deviceId.length < MIN_DEVICE_ID_LENGTH) {
    return `Invalid device ID format: too short (minimum ${MIN_DEVICE_ID_LENGTH} characters)`;
  }
  
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    return 'Invalid device ID format: contains invalid characters';
  }
  
  return null;
}

