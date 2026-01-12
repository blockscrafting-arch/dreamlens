/**
 * Subscription management utilities
 */

import type { SubscriptionInfo } from '../types/api';

// For use outside React components
async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  // Use getAuthHeaders to ensure we always have an auth header
  const { getAuthHeaders } = await import('./auth.js');
  const authHeaders = await getAuthHeaders();
  
  // Extract Authorization header from authHeaders
  let authValue: string | undefined;
  if (typeof authHeaders === 'object' && authHeaders !== null) {
    if (Array.isArray(authHeaders)) {
      const authEntry = authHeaders.find((entry) => 
        Array.isArray(entry) && entry[0] === 'Authorization'
      );
      authValue = authEntry?.[1] as string | undefined;
    } else {
      authValue = (authHeaders as Record<string, string>)['Authorization'];
    }
  }
  
  // Set Authorization header if found
  if (authValue && authValue.trim() !== '') {
    headers.set('Authorization', authValue);
  } else {
    // Fallback: try to get device ID directly
    const { getOrCreateDeviceId } = await import('./auth.js');
    const deviceId = await getOrCreateDeviceId();
    if (deviceId && deviceId.trim() !== '') {
      headers.set('Authorization', `Device ${deviceId}`);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// Re-export SubscriptionInfo from types/api for convenience
export type { SubscriptionInfo };

/**
 * Get user subscription info
 */
export async function getSubscription(): Promise<SubscriptionInfo | null> {
  try {
    const response = await authenticatedFetch('/api/user');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    // Extract subscription data from unified response
    const subscriptionData = data.data;
    return {
      plan: subscriptionData.plan,
      status: subscriptionData.status,
      limits: subscriptionData.limits,
      usage: subscriptionData.usage,
      periodEnd: subscriptionData.periodEnd ? new Date(subscriptionData.periodEnd) : null,
    } as SubscriptionInfo;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
}

/**
 * Check if user can generate (has remaining quota)
 */
export async function canGenerate(): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await getSubscription();
  if (!subscription) {
    return { allowed: false, reason: 'Subscription not found' };
  }

  if (subscription.usage.remaining === 0 && subscription.limits.dailyGenerations !== Infinity) {
    return { 
      allowed: false, 
      reason: `Daily limit reached. Upgrade to ${subscription.plan === 'free' ? 'Pro' : 'Premium'} for more generations.` 
    };
  }

  return { allowed: true };
}

/**
 * Get subscription limits
 */
export function getPlanLimits(plan: string): { dailyGenerations: number; maxHistory: number; quality: string } {
  switch (plan) {
    case 'premium':
      return { dailyGenerations: Infinity, maxHistory: Infinity, quality: '4K' };
    case 'pro':
      return { dailyGenerations: 50, maxHistory: 100, quality: '2K' };
    case 'free':
    default:
      return { dailyGenerations: 5, maxHistory: 10, quality: '1K' };
  }
}

