/**
 * ProfileSectionNav.tsx — Sticky horizontal rail with IntersectionObserver scroll-spy.
 *
 * Anchors on section ids within the suburb profile. Highlights active section
 * on scroll; clicking a nav item smooth-scrolls to that section without losing
 * the sidebar context (the profile still renders as a single scrollable page).
 */
import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import type { ProfileSectionId, PersonaId } from '../data/personas'
import { getPersona } from '../data/personas'

interface Section {
  id: ProfileSectionId
  label: string
  icon: string
}

const ALL_SECTIONS: Section[] = [
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

interface Props {
  activePersona: PersonaId
}

const SECTION_ATTR = 'data-profile-section'

const ProfileSectionNav = memo(function ProfileSectionNav({ activePersona }: Props) {
  const [activeSection, setActiveSection] = useState<ProfileSectionId | null>(null)

  const persona = useMemo(() => getPersona(activePersona), [activePersona])

  const visibleSections = useMemo(
    () => ALL_SECTIONS.filter(s => persona.visible_profile_sections.includes(s.id)),
    [persona],
  )

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(`[${SECTION_ATTR}]`)) as HTMLElement[]
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          const id = visible[0].target.getAttribute(SECTION_ATTR) as ProfileSectionId | null
          if (id) setActiveSection(id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    )

    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [visibleSections])

  const handleClick = useCallback((id: ProfileSectionId) => {
    const el = document.querySelector(`[${SECTION_ATTR}="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  if (visibleSections.length <= 1) return null

  return (
    <nav
      style={{
        position: 'sticky',
        top: '0',
        zIndex: 10,
        display: 'flex',
        gap: '2px',
        overflowX: 'auto',
        padding: '6px 8px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-glass)',
        marginBottom: '12px',
        borderRadius: '0 0 8px 8px',
        scrollbarWidth: 'none',
      }}
    >
      {visibleSections.map(section => {
        const active = activeSection === section.id
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => handleClick(section.id)}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              fontWeight: active ? 600 : 400,
              border: 'none',
              borderRadius: '6px',
              background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            {section.icon} {section.label}
          </button>
        )
      })}
    </nav>
  )
})

export default ProfileSectionNav
export { SECTION_ATTR }
