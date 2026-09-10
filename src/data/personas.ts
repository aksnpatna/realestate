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

export type PersonaId = 'first_home_buyer' | 'investor' | 'buyers_agent' | 'mortgage_broker'

export type ProfileSectionId =
  | 'overview'
  | 'market'
  | 'market_pulse'
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
    visible_profile_sections: ['overview', 'market', 'market_pulse', 'people', 'infrastructure', 'risk', 'ai'],
    show_technical: false,
    headline_score: 'buyer_fit',
  },
  investor: {
    id: 'investor',
    label: 'Investor',
    description:
      'Yield, momentum, demand/supply and cashflow first. Market indicators take priority.',
    weights: { affordability: 20, income: 20, livability: 15, access: 15, evidence: 30 },
    visible_profile_sections: ['overview', 'market', 'market_pulse', 'people', 'infrastructure', 'risk', 'ai'],
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
      'market_pulse',
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
  mortgage_broker: {
    id: 'mortgage_broker',
    label: 'Mortgage Broker',
    description:
      'Serviceability and risk assessment focus. Borrowing capacity rules above all.',
    weights: { affordability: 50, income: 30, livability: 0, access: 0, evidence: 20 },
    visible_profile_sections: ['overview', 'market', 'market_pulse', 'risk', 'technical'],
    show_technical: true,
    headline_score: 'buyer_fit',
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
    // Check sessionStorage first for initial persona from landing page
    const sessionPersona = sessionStorage.getItem('initial_persona')
    if (sessionPersona && (sessionPersona in PERSONAS)) {
      return sessionPersona as PersonaId
    }
    
    // Fallback to localStorage
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
    const r = await fetch('/api/personas', { credentials: 'include' })
    if (!r.ok) return
    const data = await r.json()
    if (data?.personas && typeof data.personas === 'object') {
      // Backend currently mirrors our local contract; no merge needed yet.
      // Hook kept for migrating presets server-side without a frontend redeploy.
    }
  } catch {}
}


// --- PRICING TIERS ---

export type PricingTierId = 'free' | 'basic' | 'premium'

export interface PricingTier {
  id: PricingTierId
  label: string
  price: string
  description: string
  features: string[]
}

export const PRICING_TIERS: Record<PricingTierId, PricingTier> = {
  free: {
    id: 'free',
    label: 'Snapshot',
    price: 'Free',
    description: 'Basic top-level metrics for casual browsing.',
    features: ['Top-level Median Price & Rent', 'Vacancy Rate Overview']
  },
  basic: {
    id: 'basic',
    label: 'Basic Data',
    price: '$4.99/mo',
    description: 'Full data charts, history, and demographics.',
    features: ['All historical charts', 'Demographics & Infrastructure', 'Yield & Growth Trends']
  },
  premium: {
    id: 'premium',
    label: 'Interactive AI',
    price: '$14.99/mo',
    description: 'Conversational NLP and automated AI analysis.',
    features: ['AI Story Cards', 'Conversational Unified Search', 'AI Analyst Opinions']
  }
}

const TIER_STORAGE_KEY = 'realestate_selected_tier'

export function getPricingTier(): PricingTier {
  try {
    const stored = localStorage.getItem(TIER_STORAGE_KEY) as PricingTierId
    if (stored && PRICING_TIERS[stored]) return PRICING_TIERS[stored]
  } catch {}
  return PRICING_TIERS.premium // Default to premium for preview/demo
}

export function loadStoredTier(): PricingTierId {
  return getPricingTier().id
}

export function storeTier(id: PricingTierId): void {
  try {
    localStorage.setItem(TIER_STORAGE_KEY, id)
  } catch {}
}

export function tierIds(): PricingTierId[] {
  return Object.keys(PRICING_TIERS) as PricingTierId[]
}
