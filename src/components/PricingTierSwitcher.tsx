/**
 * PersonaSwitcher.tsx — Inline control that toggles between first-home-buyer,
 * Investor, and Buyer's Agent. Persists choice in localStorage so the persona
 * survives page refresh.
 *
 * Persona drives:
 *  1. BuyFinder default weights (setAppPersona callback lets the parent push
 *     defaults down to the BuyFinder component via the financialProfile prop).
 *  2. Which profile sections are visible in the suburb profile.
 */
import { memo, useCallback } from 'react'
import type { PricingTierId } from '../data/personas'
import { PRICING_TIERS, tierIds, storeTier } from '../data/personas'

interface Props {
  activeTier: PricingTierId
  onChange: (id: PricingTierId) => void
}

const icons: Record<PricingTierId, string> = {
  free: '🆓',
  basic: '📊',
  premium: '🤖',
}

const tierColors: Record<PricingTierId, string> = {
  free: '#6b7280',
  basic: '#f59e0b',
  premium: '#10b981',
}

const PricingTierSwitcher = memo(function PricingTierSwitcher({ activeTier, onChange }: Props) {
  const handleChange = useCallback(
    (id: PricingTierId) => {
      storeTier(id)
      onChange(id)
    },
    [onChange],
  )

  const activeTierInfo = PRICING_TIERS[activeTier]

  return (
    <div className="u-72b4a711" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className="u-fb84eb0b" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        Current Tier:
      </span>
      <div className="tier-badge" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        cursor: 'pointer',
        position: 'relative'
      }}>
        <span style={{ fontSize: '1.25rem' }}>{icons[activeTier]}</span>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeTierInfo.label}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {activeTierInfo.price}
          </div>
        </div>
        <div className="tier-badge-indicator" style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: tierColors[activeTier]
        }} />
      </div>
    </div>
  )
})

export default PricingTierSwitcher
