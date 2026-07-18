/**
 * ProfileSection.tsx — Conditional tab-based rendering wrapper.
 *
 * Only renders children when the given section ID matches the active tab.
 * Keeps App.tsx clean — no inline conditionals needed.
 */
import type { ProfileSectionId } from '../data/personas'

interface Props {
  sectionId: ProfileSectionId
  activeSection: ProfileSectionId | null
  children: React.ReactNode
}

export default function ProfileSection({ sectionId, activeSection, children }: Props) {
  if (activeSection !== sectionId) return null
  return <>{children}</>
}
