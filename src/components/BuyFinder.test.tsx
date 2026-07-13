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
    render(<BuyFinder suburbsData={[]} />)
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Buyer Profile & Location')).toBeInTheDocument()
  })

  it('shows loading state on initial render', async () => {
    // never-resolving promise keeps loading state
    mockFetch.mockImplementation(() => new Promise(() => {}))
    render(<BuyFinder suburbsData={[]} />)

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

    render(<BuyFinder suburbsData={[]} />)

    await waitFor(() => {
      expect(screen.getByText('Melbourne')).toBeInTheDocument()
    })
    expect(screen.getByText('78.2')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })

  it('shows Data Unavailable on backend failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<BuyFinder suburbsData={[]} />)

    await waitFor(() => {
      expect(screen.getByText('Data Unavailable')).toBeInTheDocument()
    })

    expect(screen.queryByText(/client-side/i)).not.toBeInTheDocument()
  })

  it('does not calculate score client-side', () => {
    render(<BuyFinder suburbsData={[{ id: 'vic-test-3000', name: 'Test', state: 'VIC', postcode: '3000', growthScore: 90, isMetro: true, metrics: { medianPrice: 800000, rentalYield: 4.0, schoolQuality: 7, transitAccessibility: 6 } } as any]} />)

    // BuyFinder no longer has client-side ranking results
    expect(screen.queryByText('Fit Score')).not.toBeInTheDocument()
  })

  it('minimum-yield select exists', () => {
    render(<BuyFinder suburbsData={[]} />)
    expect(screen.getByText('Min Yield %')).toBeInTheDocument()
  })

  it('has weight sliders', () => {
    render(<BuyFinder suburbsData={[]} />)
    expect(screen.getByText(/Affordability/i)).toBeInTheDocument()
    expect(screen.getByText(/Income/i)).toBeInTheDocument()
    expect(screen.getByText(/Livability/i)).toBeInTheDocument()
  })
})
