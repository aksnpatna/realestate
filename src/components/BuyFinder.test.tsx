/**
 * Frontend tests per review_latest_withtest.md section 6.6.
 * Run: npm test -- src/components/BuyFinder.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BuyFinder from './BuyFinder'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('BuyFinder', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders search button and state selector', () => {
    render(<BuyFinder />)
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Buyer Profile & Location')).toBeInTheDocument()
  })

  it('result shows View decision button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model_version: 'buyer-fit-poc-1.0.0',
        request_id: 'abc123',
        dq_threshold: 80,
        results: [{
          rank: 1, suburb_id: 'VIC_TEST_3000', name: 'Melbourne', state: 'VIC', postcode: '3000',
          buyer_fit_score: 78.2, confidence_label: 'high', eligibility: 'eligible',
          affordability: {
            serviceability_passed: true, required_loan: 600000, estimated_borrowing_capacity: 700000,
            assumptions: { interest_rate: 0.062, serviceability_buffer: 0.03, loan_term_years: 30, purchase_cost_allowance_pct: 2.0, annual_income: 150000, monthly_debt: 0 },
          },
          components: { affordability: { score: 85, weight: 30, contribution: 25.5 }, income: { score: 70, weight: 25, contribution: 17.5 }, livability: { score: 80, weight: 20, contribution: 16.0 }, access: { score: 75, weight: 15, contribution: 11.25 }, evidence: { score: 80, weight: 10, contribution: 8.0 } },
          drivers: ['Available deposit supports purchase price'], risks: [], unknowns: [], evidence_ids: [],
        }],
        excluded_count: 0, excluded: [], total_evaluated: 50,
        assumptions: { interest_rate: 0.062, serviceability_buffer: 0.03, loan_term_years: 30, purchase_cost_allowance: 0.02 },
      }),
    })
    render(<BuyFinder />)
    await waitFor(() => { expect(screen.getByText('View decision')).toBeInTheDocument() })
  })

  it('shows loading state on initial render', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    render(<BuyFinder />)

    await waitFor(() => {
      expect(screen.getByText(/Ranking eligible suburbs/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('renders backend results when API succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model_version: 'buyer-fit-poc-1.0.0',
        request_id: 'abc123',
        dq_threshold: 80,
        results: [
          {
            rank: 1,
            suburb_id: 'VIC_TEST_3000',
            name: 'Melbourne',
            state: 'VIC',
            postcode: '3000',
            buyer_fit_score: 78.2,
            confidence_label: 'high',
            eligibility: 'eligible',
            affordability: {
              serviceability_passed: true,
              estimated_borrowing_capacity: 700000,
              required_loan: 600000,
              assumptions: { interest_rate: 0.062, serviceability_buffer: 0.03, loan_term_years: 30, purchase_cost_allowance_pct: 2.0 },
            },
            components: {
              affordability: { score: 85, weight: 30, contribution: 25.5 },
              income: { score: 70, weight: 25, contribution: 17.5 },
              livability: { score: 80, weight: 20, contribution: 16.0 },
              access: { score: 75, weight: 15, contribution: 11.25 },
              evidence: { score: 80, weight: 10, contribution: 8.0 },
            },
            drivers: ['Available deposit supports purchase price'],
            risks: [],
            unknowns: [],
            evidence_ids: ['suburb:VIC_TEST_3000:dq_score:85'],
          },
        ],
        excluded_count: 0,
        excluded: [],
        total_evaluated: 50,
        assumptions: { interest_rate: 0.062, serviceability_buffer: 0.03, loan_term_years: 30, purchase_cost_allowance: 0.02 },
      }),
    })

    render(<BuyFinder />)

    await waitFor(() => {
      expect(screen.getByText(/Melbourne, VIC/i)).toBeInTheDocument()
    })
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('View decision')).toBeInTheDocument()
  })

  it('shows Data Unavailable on backend failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<BuyFinder />)

    await waitFor(() => {
      expect(screen.getByText('Data Unavailable')).toBeInTheDocument()
    })

    expect(screen.queryByText(/client-side/i)).not.toBeInTheDocument()
  })

  it('does not calculate score client-side', () => {
    render(<BuyFinder />)
    expect(screen.queryByText('Fit Score')).not.toBeInTheDocument()
  })

  it('minimum-yield select exists', () => {
    render(<BuyFinder />)
    expect(screen.getByText('Min Yield %')).toBeInTheDocument()
  })

  it('has weight sliders', () => {
    render(<BuyFinder />)
    expect(screen.getByText(/Objective Weights/i)).toBeInTheDocument()
    const affordabilityLabels = screen.getAllByText(/Affordability/i)
    expect(affordabilityLabels.length).toBeGreaterThanOrEqual(1)
  })
})
