/**
 * personas.ts — Persona contract for the multi-faceted web.
 *
 * Three personas drive BuyFinder default weights + which profile sections are
 * visible. Backend `/api/personas` is the source of truth; this local contract
 * mirrors it so the UI never blocks on a network call and tests stay fast.
 *
 * Keep the section ids in sync with `ProfileSectionNav.tsx`.
 */
import type { BuyerFitWeights } from './buyerFitTypes'

export type PersonaId = 'first_home_buyer' | 'investor' | 'buyers_agent'

export type ProfileSectionId =
  | 'overview'
  | 'market'
  | 'people'
  | 'infrastructure'
  | 'listings'
  | 'risk'
  | 'pockets'
  | 'ai'
  | 'technical'

export type HeadlineScore = 'buyer_fit' | 'growth' | 'dq'

export interface Persona {
  id: PersonaId
  label: string
  description: string
  weights: BuyerFitWeights
  visible_profile_sections: ProfileSectionId[]
  show_technical: boolean
  headline_score: HeadlineScore
}

// Local fallback mirroring backend persona_presets.py. Do not edit one without
// the other — drift between these two files is a product bug.
export const PERSONAS: Record<PersonaId, Persona> = {
  first_home_buyer: {
    id: 'first_home_buyer',
    label: 'First-home buyer',
    description:
      'Affordability and serviceability focus. Personalised fit matters more than market indicators.',
    weights: { affordability: 35, income: 25, livability: 20, access: 15, evidence: 5 },
    visible_profile_sections: ['overview', 'market', 'people', 'infrastructure', 'risk', 'ai'],
    show_technical: false,
    headline_score: 'buyer_fit',
  },
  investor: {
    id: 'investor',
    label: 'Investor',
    description:
      'Yield, momentum, demand/supply and cashflow first. Market indicators take priority.',
    weights: { affordability: 20, income: 20, livability: 15, access: 15, evidence: 30 },
    visible_profile_sections: ['overview', 'market', 'people', 'infrastructure', 'risk', 'ai'],
    show_technical: false,
    headline_score: 'growth',
  },
  buyers_agent: {
    id: 'buyers_agent',
    label: "Buyer's Agent",
    description:
      'Full technical depth: social housing, subdivision, cadastre, crime, provenance and DQ issues. No data hidden.',
    weights: { affordability: 25, income: 20, livability: 20, access: 15, evidence: 20 },
    visible_profile_sections: [
      'overview',
      'market',
      'people',
      'infrastructure',
      'listings',
      'risk',
      'pockets',
      'ai',
      'technical',
    ],
    show_technical: true,
    headline_score: 'dq',
  },
}

export const DEFAULT_PERSONA: PersonaId = 'first_home_buyer'

const STORAGE_KEY = 'realestate.persona'

export function getPersona(id: PersonaId | string | null | undefined): Persona {
  if (id && (id in PERSONAS)) return PERSONAS[id as PersonaId]
  return PERSONAS[DEFAULT_PERSONA]
}

export function loadStoredPersona(): PersonaId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && (raw in PERSONAS)) return raw as PersonaId
  } catch {}
  return DEFAULT_PERSONA
}

export function storePersona(id: PersonaId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {}
}

export function personaIds(): PersonaId[] {
  return Object.keys(PERSONAS) as PersonaId[]
}

/** Refresh local personas from backend if available; never throws. */
export async function refreshPersonasFromBackend(): Promise<void> {
  try {
    const r = await fetch('/api/personas')
    if (!r.ok) return
    const data = await r.json()
    if (data?.personas && typeof data.personas === 'object') {
      // Backend currently mirrors our local contract; no merge needed yet.
      // Hook kept for migrating presets server-side without a frontend redeploy.
    }
  } catch {}
}
