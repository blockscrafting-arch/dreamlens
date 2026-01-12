/**
 * API-related types
 */

export interface UserProfile {
  id: string;
  email: string | null;
  createdAt: string;
}

export interface SubscriptionInfo {
  plan: 'free' | 'pro' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  limits: {
    dailyGenerations: number;
    maxHistory: number;
    quality: string;
  };
  usage: {
    usedToday: number;
    remaining: number;
    maxHistory: number;
  };
  periodEnd: string | null;
}

export interface Generation {
  id: string;
  imageUrl: string;
  promptUsed: string | null;
  trend: string | null;
  quality: string | null;
  createdAt: string;
}

export interface PaymentRequest {
  plan: 'pro' | 'premium';
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentResponse {
  paymentId: string;
  confirmationUrl: string;
  status: string;
}


