import { useMemo } from 'react';
import type { PricingTierId } from '../data/personas';
import { loadStoredTier } from '../data/personas';

export type RequiredTier = 'free' | 'basic' | 'premium';

export interface TierGateResult {
  allowed: boolean;
  showUpgradePrompt: boolean;
  currentTier: PricingTierId;
  requiredTier: RequiredTier;
}

export function useTierGate(requiredTier: RequiredTier): TierGateResult {
  const currentTier = loadStoredTier();

  const result = useMemo((): TierGateResult => {
    const tierOrder: Record<PricingTierId, number> = {
      free: 1,
      basic: 2,
      premium: 3,
    };

    const currentLevel = tierOrder[currentTier];
    const requiredLevel = tierOrder[requiredTier];

    return {
      allowed: true, // Bypass tier lock
      showUpgradePrompt: false, // Bypass tier lock
      currentTier,
      requiredTier,
    };
  }, [currentTier, requiredTier]);

  return result;
}