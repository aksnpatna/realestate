import { useMemo, memo } from 'react'
import type { ProfileSectionId, PersonaId } from '../data/personas'
import { getPersona } from '../data/personas'
import './ProfileSectionNav.css'

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
    <nav className="psn" aria-label="Suburb profile sections">
      {visibleSections.map(s => (
        <button
          key={s.id}
          role="tab"
          aria-selected={activeSection === s.id}
          className={`psn__tab ${activeSection === s.id ? 'psn__tab--active' : ''}`}
          onClick={() => onSectionChange(s.id)}
        >
          <span className="psn__icon" aria-hidden="true">{s.icon}</span>
          <span className="profile-nav-text">{s.label}</span>
        </button>
      ))}
    </nav>
  )
})

export default ProfileSectionNav
