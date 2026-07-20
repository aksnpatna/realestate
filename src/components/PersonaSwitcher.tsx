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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginRight: '4px',
          whiteSpace: 'nowrap',
        }}
      >
        View as:
      </span>
      {personaIds().map(id => {
        const p = PERSONAS[id]
        const active = id === activePersona
        return (
          <button
            key={id}
            type="button"
            title={p.description}
            onClick={() => handleChange(id)}
            style={{
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: active ? 600 : 400,
              border: active ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
              borderRadius: '20px',
              background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
              color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            {icons[id]} {p.label}
          </button>
        )
      })}
    </div>
  )
})

export default PersonaSwitcher
