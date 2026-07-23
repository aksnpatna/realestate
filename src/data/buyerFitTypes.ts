/** Shared contract types for the Buyer Fit decision flow. */

export interface BuyerFitWeights {
  affordability: number
  income: number
  livability: number
  access: number
  evidence: number
}

export interface BuyerFitAffordability {
  score: number
  purchase_price: number
  stamp_duty: number
  purchase_costs: number
  available_deposit_after_costs: number
  required_loan: number
  estimated_borrowing_capacity: number
  monthly_repayment: number
  serviceability_passed: boolean
  assumptions: {
    interest_rate: number
    serviceability_buffer: number
    loan_term_years: number
    annual_income: number
    monthly_debt: number
    purchase_cost_allowance_pct: number
  }
}

export interface BuyerFitComponent {
  score: number
  weight: number
  contribution: number
}

export interface BuyerFitResult {
  rank: number
  suburb_id: string
  name: string
  state: string
  postcode: string
  buyer_fit_score: number
  market_timing_score?: number
  confidence_label: string
  eligibility: string
  affordability: BuyerFitAffordability
  components: Record<string, BuyerFitComponent>
  drivers: string[]
  risks: string[]
  unknowns: string[]
  evidence_ids: string[]
}

export interface BuyerFitResponse {
  model_version: string
  request_id: string
  dq_threshold: number
  results: BuyerFitResult[]
  excluded_count: number
  excluded: Array<{ suburb_id: string; name: string; reason: string; detail?: unknown }>
  total_evaluated: number
  assumptions: {
    interest_rate: number
    serviceability_buffer: number
    loan_term_years: number
    purchase_cost_allowance: number
  }
}
