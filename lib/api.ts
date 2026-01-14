/**
 * API client with authentication
 * Supports Telegram WebApp (primary) and device ID (fallback)
 */

import { useCallback } from 'react';
import { getAuthHeaders } from './auth';

/**
 * Make authenticated API request
 * Automatically uses Telegram initData (if in Telegram) or device ID (fallback)
 * Ensures Authorization header is always present
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // Get auth headers (Telegram initData or device ID)
  const authHeaders = await getAuthHeaders();
  
  // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
  const isFormData = options.body instanceof FormData;
  
  // Extract and set headers properly
  if (typeof authHeaders === 'object' && authHeaders !== null) {
    if (Array.isArray(authHeaders)) {
      // HeadersInit as array of [key, value] tuples
      authHeaders.forEach((entry) => {
        if (Array.isArray(entry) && entry.length >= 2) {
          const key = entry[0] as string;
          // Skip Content-Type for FormData - browser will set it automatically
          if (key === 'Content-Type' && isFormData) {
            return;
          }
          headers.set(key, entry[1] as string);
        }
      });
    } else {
      // HeadersInit as Record<string, string>
      Object.entries(authHeaders).forEach(([key, value]) => {
        // Skip Content-Type for FormData - browser will set it automatically
        if (key === 'Content-Type' && isFormData) {
          return;
        }
        headers.set(key, value as string);
      });
    }
  }
  
  // Ensure Authorization header is present
  if (!headers.has('Authorization')) {
    console.error('Critical: Unable to set Authorization header in apiRequest');
  }

  // Disable caching for token-related endpoints
  const cacheOption = url.includes('/api/tokens') ? { cache: 'no-store' as RequestCache } : {};
  
  // Add timestamp to query to force bypass cache
  const finalUrl = url.includes('/api/tokens') 
    ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
    : url;

  return fetch(finalUrl, {
    ...options,
    headers,
    ...cacheOption,
  });
}

/**
 * Hook for making authenticated API requests
 * Uses Telegram initData (if in Telegram) or device ID (fallback)
 * Ensures Authorization header is always present before making request
 */
export function useApiRequest() {
  return useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    
    // Use getAuthHeaders to get Telegram initData or device ID
    const authHeaders = await getAuthHeaders();
    
    // Extract Authorization header value
    let authValue: string | undefined;
    if (typeof authHeaders === 'object' && authHeaders !== null) {
      if (Array.isArray(authHeaders)) {
        // HeadersInit as array of [key, value] tuples
        const authEntry = authHeaders.find((entry) => 
          Array.isArray(entry) && entry[0] === 'Authorization'
        );
        authValue = authEntry?.[1] as string | undefined;
      } else {
        // HeadersInit as Record<string, string>
        authValue = (authHeaders as Record<string, string>)['Authorization'];
      }
    }
    
    if (authValue && authValue.trim() !== '') {
      headers.set('Authorization', authValue);
    } else {
      console.error('Critical: No authorization header available, request will likely fail');
    }

    // Disable caching for token-related endpoints
    const cacheOption = url.includes('/api/tokens') ? { cache: 'no-store' as RequestCache } : {};
    
    // Add timestamp to query to force bypass cache
    const finalUrl = url.includes('/api/tokens') 
      ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
      : url;

    return fetch(finalUrl, {
      ...options,
      headers,
      ...cacheOption,
    });
  }, []);
}


