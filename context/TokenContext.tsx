import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useApiRequest } from '../lib/api';
import { getTokenCost } from '../shared/constants';

export interface FreeGenerationInfo {
  remaining: number;
  total: number;
  maxQuality: string;
}

export interface TokenInfo {
  balance: number;
  lastBonusDate: string | null;
  canClaimBonus: boolean;
  freeGenerations: FreeGenerationInfo;
  plan: string;
}

interface TokenContextType {
  tokens: TokenInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  claimDailyBonus: () => Promise<{ success: boolean; tokensAwarded?: number; error?: string }>;
  canGenerate: (quality: string) => boolean;
  willUseFreeGeneration: (quality: string) => boolean;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export const TokenProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const apiRequest = useApiRequest();
  const [tokens, setTokens] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/tokens');
      
      if (response.ok) {
        const data = await response.json();
        const balance = data.data?.balance || 0;
        const lastBonusDate = data.data?.lastBonusDate || null;
        
        // Use server-provided canClaimBonus for timezone consistency
        // Server compares lastBonusDate with its own date, avoiding client timezone issues
        const canClaimBonus = data.data?.canClaimBonus ?? (lastBonusDate !== data.data?.serverDate);
        
        // Free generation info from server
        const freeGenerations: FreeGenerationInfo = data.data?.freeGenerations || {
          remaining: 0,
          total: 5,
          maxQuality: '1K',
        };
        const plan = data.data?.plan || 'free';

        setTokens({
          balance,
          lastBonusDate,
          canClaimBonus,
          freeGenerations,
          plan,
        });
      } else {
        setTokens(null);
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      setTokens(null);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  const claimDailyBonus = useCallback(async (): Promise<{ success: boolean; tokensAwarded?: number; error?: string }> => {
    try {
      const response = await apiRequest('/api/tokens', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        const tokensAwarded = data.data?.tokensAwarded || 0;
        
        // Refresh balance
        await refresh();
        
        return { success: true, tokensAwarded };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Ошибка при получении бонуса' };
      }
    } catch (error) {
      console.error('Error claiming daily bonus:', error);
      return { success: false, error: 'Ошибка при получении бонуса' };
    }
  }, [apiRequest, refresh]);

  // Check if this generation will use a free generation slot (deprecated, kept for backward compatibility)
  const willUseFreeGeneration = (_quality: string): boolean => {
    return false;
  };

  const canGenerate = (quality: string): boolean => {
    if (!tokens) return false;
    
    // Check token balance
    const cost = getTokenCost(quality);
    return tokens.balance >= cost;
  };

  // Initialize and refresh tokens when auth state or apiRequest changes
  // apiRequest is now memoized, so refresh will only change when auth state changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <TokenContext.Provider value={{
      tokens,
      loading,
      refresh,
      claimDailyBonus,
      canGenerate,
      willUseFreeGeneration,
    }}>
      {children}
    </TokenContext.Provider>
  );
};

export const useTokens = () => {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokens must be used within TokenProvider');
  }
  return context;
};

