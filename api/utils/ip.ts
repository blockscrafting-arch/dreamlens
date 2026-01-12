/**
 * IP address utilities
 */

import type { VercelRequest } from '@vercel/node';

/**
 * Extract client IP address from request headers
 * Handles Vercel's x-forwarded-for header and other common proxies
 */
export function getClientIp(request: VercelRequest): string | null {
  // Vercel sets x-forwarded-for header
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor;
    return ips[0]?.trim() || null;
  }

  // Fallback to x-real-ip (some proxies use this)
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0] || null;
  }

  // Last resort: use connection remote address (not available in serverless)
  return null;
}

