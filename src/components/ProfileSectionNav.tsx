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
      className="profile-section-nav"
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
            padding: '14px 24px',
            background: activeSection === s.id ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
            border: 'none',
            borderBottom: activeSection === s.id ? '4px solid var(--accent-cyan)' : '4px solid transparent',
            color: activeSection === s.id ? 'var(--accent-cyan)' : 'var(--text-primary)',
            fontWeight: activeSection === s.id ? 800 : 600,
            fontSize: '1.05rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'inherit',
            letterSpacing: '-0.2px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ marginRight: '8px', fontSize: '1.15rem' }}>{s.icon}</span>
          <span className="profile-nav-text">{s.label}</span>
        </button>
      ))}
    </nav>
  )
})

export default ProfileSectionNav
