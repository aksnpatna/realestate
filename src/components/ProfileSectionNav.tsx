/**
 * ProfileSectionNav.tsx — Tabbed navigation for suburb profile sections.
 *
 * Replaces the scroll-spy approach with clean tabbed cards (like Domain/REA).
 * Click a tab to show that section; only one section renders at a time.
 */
import { useMemo, memo } from 'react'
import type { ProfileSectionId, PersonaId } from '../data/personas'
import { getPersona } from '../data/personas'

interface Section {
  id: ProfileSectionId
  label: string
  icon: string
}

export const ALL_SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'market', label: 'Market', icon: '📈' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { id: 'listings', label: 'Listings', icon: '🏠' },
  { id: 'risk', label: 'Risk', icon: '⚠️' },
  { id: 'pockets', label: 'Pockets', icon: '🗺️' },
  { id: 'ai', label: 'AI Insights', icon: '🤖' },
  { id: 'technical', label: 'Technical', icon: '📋' },
]

export const SECTION_ATTR = 'data-profile-section'

interface Props {
  activePersona: PersonaId
  activeSection: ProfileSectionId | null
  onSectionChange: (id: ProfileSectionId) => void
}

const ProfileSectionNav = memo(function ProfileSectionNav({
  activePersona,
  activeSection,
  onSectionChange,
}: Props) {
  const persona = useMemo(() => getPersona(activePersona), [activePersona])

  const visibleSections = useMemo(
    () => ALL_SECTIONS.filter(s => persona.visible_profile_sections.includes(s.id)),
    [persona],
  )

  if (visibleSections.length <= 1) return null

  return (
    <nav
      style={{
        display: 'flex',
        gap: '0',
        padding: '0',
        marginBottom: '20px',
        borderBottom: '2px solid var(--border-glass)',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
      }}
    >
      {visibleSections.map(s => (
        <button
          key={s.id}
          onClick={() => onSectionChange(s.id)}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeSection === s.id ? '3px solid var(--accent-cyan)' : '3px solid transparent',
            color: activeSection === s.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: activeSection === s.id ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'inherit',
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ marginRight: '6px' }}>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </nav>
  )
})

export default ProfileSectionNav
