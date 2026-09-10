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
import type { PersonaId } from '../data/personas'
import { PERSONAS, personaIds, storePersona } from '../data/personas'

interface Props {
  activePersona: PersonaId
  onChange: (id: PersonaId) => void
}

const icons: Record<PersonaId, string> = {
  first_home_buyer: '🏠',
  investor: '📈',
  buyers_agent: '🔍',
  mortgage_broker: '💼',
}

const PersonaSwitcher = memo(function PersonaSwitcher({ activePersona, onChange }: Props) {
  const handleChange = useCallback(
    (id: PersonaId) => {
      storePersona(id)
      onChange(id)
    },
    [onChange],
  )

  return (
    <div className="u-72b4a711" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className="u-fb84eb0b" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        View as:
      </span>
      <select 
        value={activePersona} 
        onChange={(e) => handleChange(e.target.value as PersonaId)}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '8px',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-glass)',
          outline: 'none',
          cursor: 'pointer'
        }}
      >
        {personaIds().map(id => {
          const p = PERSONAS[id]
          return (
            <option key={id} value={id} title={p.description}>
              {icons[id]} {p.label}
            </option>
          )
        })}
      </select>
    </div>
  )
})

export default PersonaSwitcher
