import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SubscriptionInfo } from '../lib/subscriptions';
import { useApiRequest } from '../lib/api';

interface SubscriptionContextType {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  canGenerate: boolean;
  upgradeRequired: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const apiRequest = useApiRequest();

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/user');
      
      if (response.ok) {
        const data = await response.json();
        // Extract subscription data from unified response
        const subscriptionData = data.data;
        setSubscription({
          plan: subscriptionData.plan,
          status: subscriptionData.status,
          limits: subscriptionData.limits,
          usage: subscriptionData.usage,
          periodEnd: subscriptionData.periodEnd ? (typeof subscriptionData.periodEnd === 'string' ? subscriptionData.periodEnd : new Date(subscriptionData.periodEnd).toISOString()) : null,
        });
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [apiRequest]);

  const canGenerate = subscription 
    ? (subscription.usage.remaining > 0 || subscription.limits.dailyGenerations === Infinity)
    : false;

  const upgradeRequired = subscription 
    ? (subscription.plan === 'free' && subscription.usage.remaining === 0)
    : false;

  return (
    <SubscriptionContext.Provider value={{
      subscription,
      loading,
      refresh,
      canGenerate,
      upgradeRequired,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

