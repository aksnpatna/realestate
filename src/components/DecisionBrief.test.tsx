import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DecisionBrief from './DecisionBrief'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockSuburb = {
  id: 'vic-test-3000',
  name: 'Melbourne',
  state: 'VIC',
  postcode: '3000',
  growthScore: 60,
} as any

const mockResult = {
  rank: 1,
  suburb_id: 'VIC_TEST_3000',
  name: 'Melbourne',
  state: 'VIC',
  postcode: '3000',
  buyer_fit_score: 78.2,
  confidence_label: 'high',
  eligibility: 'eligible',
  affordability: {
    score: 85,
    purchase_price: 800000,
    stamp_duty: 45000,
    purchase_costs: 61000,
    available_deposit_after_costs: 109000,
    required_loan: 691000,
    estimated_borrowing_capacity: 700000,
    monthly_repayment: 4500,
    serviceability_passed: true,
    assumptions: {
      interest_rate: 0.062,
      serviceability_buffer: 0.03,
      loan_term_years: 30,
      annual_income: 150000,
      monthly_debt: 0,
      purchase_cost_allowance_pct: 2.0,
    },
  },
  components: {
    affordability: { score: 85, weight: 30, contribution: 25.5 },
  },
  drivers: ['Available deposit supports purchase price'],
  risks: ['Elevated vacancy (4.8%)'],
  unknowns: [],
  evidence_ids: ['suburb:VIC_TEST_3000:median_price:800000'],
}

describe('DecisionBrief', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('renders personalised decision when selectedResult is provided', () => {
    render(<DecisionBrief activeSuburb={mockSuburb} setActiveTab={vi.fn()} selectedResult={mockResult} requestMeta={{ request_id: 'abc123', model_version: 'buyer-fit-poc-1.0.0' }} />)

    expect(screen.getByText('Based on your latest Buy Finder assumptions')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText(/Available deposit supports purchase price/)).toBeInTheDocument()
    expect(screen.getByText(/Elevated vacancy/)).toBeInTheDocument()
    expect(screen.getByText(/Serviceability passes/)).toBeInTheDocument()
  })

  it('shows assumptions in expandable', () => {
    render(<DecisionBrief activeSuburb={mockSuburb} setActiveTab={vi.fn()} selectedResult={mockResult} requestMeta={{ request_id: 'abc123', model_version: 'x' }} />)
    expect(screen.getByText(/Show assumptions/)).toBeInTheDocument()
  })

  it('shows generic market snapshot when no selectedResult', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        decision_snapshot_id: 'ds1',
        model_version: 'x',
        score: 60,
        components: {},
        drivers: [],
        risks: [],
        unknowns: [],
        confidence_label: 'medium',
        eligibility: { eligible: true, reasons: [], eligibility_dq_score: 80, threshold: 80 },
      }),
    })
    render(<DecisionBrief activeSuburb={mockSuburb} setActiveTab={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('General Market Snapshot')).toBeInTheDocument()
    })
  })

  it('shows unavailable state on endpoint failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    render(<DecisionBrief activeSuburb={mockSuburb} setActiveTab={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Decision Brief Unavailable')).toBeInTheDocument()
    })
  })
})
