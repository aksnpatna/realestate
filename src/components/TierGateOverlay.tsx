import { Icon } from '../components/ui';
import type { RequiredTier } from '../hooks/useTierGate';
import { PRICING_TIERS } from '../data/personas';
import '../styles/TierGateOverlay.css';

interface TierGateOverlayProps {
  requiredTier: RequiredTier;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

export function TierGateOverlay({ 
  requiredTier, 
  children, 
  onUpgrade = () => console.log('Upgrade clicked') 
}: TierGateOverlayProps) {
  
  const tierInfo = PRICING_TIERS[requiredTier];

  return (
    <div className="tier-gate-container">
      <div className="tier-gate-content">{children}</div>
      <div className="tier-gate-overlay">
        <div className="tier-gate-card">
          <div className="tier-gate-icon">
            <Icon name="lock" size={48} />
          </div>
          <h3 className="tier-gate-title">Upgrade to {tierInfo.label}</h3>
          <p className="tier-gate-description">
            This feature is available with our {tierInfo.label} plan.
          </p>
          <div className="tier-gate-price">{tierInfo.price}</div>
          <button className="tier-gate-button" onClick={onUpgrade}>
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}