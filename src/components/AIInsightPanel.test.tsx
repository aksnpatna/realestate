/**
 * Unit tests for AIInsightPanel component.
 * Run: npm test -- src/components/AIInsightPanel.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AIInsightPanel from './AIInsightPanel'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockSetActiveSuburb = vi.fn()

const baseSuburb = {
  id: 'nsw-parramatta-2150',
  name: 'Parramatta',
  postcode: '2150',
  state: 'NSW',
  growthScore: 89,
  coordinates: [-33.815, 151.001],
  isMetro: true,
  metroCBD: 'Sydney CBD',
  cbdDistanceMins: 30,
  metrics: {
    aiNewsSentiment: 'Click "Analyze Live News"',
    aiNewsSummary: '',
  },
  highlights: [],
  pois: [],
  schools: [],
}

function renderPanel(suburb: any = baseSuburb) {
  return render(
    <AIInsightPanel
      activeSuburb={suburb}
      setActiveSuburb={mockSetActiveSuburb}
    />
  )
}

describe('AIInsightPanel', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockSetActiveSuburb.mockReset()
  })

  describe('Tab navigation', () => {
    it('renders sentiment tab by default', () => {
      renderPanel()
      expect(screen.getByText('Market Sentiment Score')).toBeInTheDocument()
    })

    it('switches to committee tab', () => {
      renderPanel()
      fireEvent.click(screen.getByText('🏛️ Committee'))
      expect(screen.getByText('Multi-Agent Committee')).toBeInTheDocument()
    })

    it('switches back to sentiment tab', () => {
      renderPanel()
      fireEvent.click(screen.getByText('🏛️ Committee'))
      fireEvent.click(screen.getByText('📰 News Sentiment'))
      expect(screen.getByText('Market Sentiment Score')).toBeInTheDocument()
    })
  })

  describe('Sentiment button states', () => {
    it('shows Analyze Live News when no sentiment exists', () => {
      renderPanel()
      expect(screen.getByText('Analyze Live News')).toBeInTheDocument()
    })

    it('shows Refresh Sentiment when sentiment exists', () => {
      const suburb = {
        ...baseSuburb,
        metrics: {
          ...baseSuburb.metrics,
          aiNewsSentiment: 'Neutral (5.8/10)',
          _newsScore: 5.8,
        },
      }
      renderPanel(suburb)
      expect(screen.getByText('Refresh Sentiment')).toBeInTheDocument()
    })

    it('shows score when available', () => {
      const suburb = {
        ...baseSuburb,
        metrics: {
          ...baseSuburb.metrics,
          aiNewsSentiment: 'Bullish (8.5/10)',
          _newsScore: 8.5,
          _newsLabel: 'Bullish',
        },
      }
      renderPanel(suburb)
      expect(screen.getByText('8.5/10')).toBeInTheDocument()
    })
  })

  describe('Sentiment API call', () => {
    it('calls news-sentiment endpoint and updates suburb', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 8.2,
          label: 'Bullish',
          summary: 'Test summary',
          articles: 5,
          cached: false,
          provider_used: 'keyword',
        }),
      })

      renderPanel()
      fireEvent.click(screen.getByText('Analyze Live News'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/suburbs/nsw-parramatta-2150/news-sentiment',
          { method: 'POST' }
        )
      })

      await waitFor(() => {
        expect(mockSetActiveSuburb).toHaveBeenCalled()
      })
    })

    it('handles API error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      renderPanel()
      fireEvent.click(screen.getByText('Analyze Live News'))

      await waitFor(() => {
        expect(mockSetActiveSuburb).toHaveBeenCalled()
        const updater = mockSetActiveSuburb.mock.calls[0][0]
        const result = updater(baseSuburb)
        expect(result.metrics.aiNewsSentiment).toBe('Error')
      })
    })
  })

  describe('Error display', () => {
    it('shows error banner on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      renderPanel()
      fireEvent.click(screen.getByText('Analyze Live News'))

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument()
      })
    })

    it('dismisses error on close button click', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Test error'))

      renderPanel()
      fireEvent.click(screen.getByText('Analyze Live News'))

      await waitFor(() => {
        expect(screen.getByText(/Test error/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('✕'))
      expect(screen.queryByText(/Test error/)).not.toBeInTheDocument()
    })
  })

  describe('Committee tab', () => {
    it('shows empty state when no verdict', () => {
      renderPanel()
      fireEvent.click(screen.getByText('🏛️ Committee'))
      expect(screen.getByText(/Click "Run AI Committee"/)).toBeInTheDocument()
    })

    it('shows verdict when available', () => {
      const suburb = {
        ...baseSuburb,
        aiVerdict: 'BUY — Strong Growth',
        aiRiskLevel: 'Medium',
        aiBullView: 'Yield is excellent at 5.2%',
        aiBearView: 'High entry price concerns',
        aiUrbanView: 'Gentrification underway',
        aiConsensus: 'Invest for long-term growth',
      }
      renderPanel(suburb)
      fireEvent.click(screen.getByText('🏛️ Committee'))
      expect(screen.getByText('The Optimistic Case')).toBeInTheDocument()
      expect(screen.getByText('The Cautious Case')).toBeInTheDocument()
      expect(screen.getByText('Neutral Synthesis')).toBeInTheDocument()
      expect(screen.getByText('Key Takeaway')).toBeInTheDocument()
      expect(screen.getByText('Invest for long-term growth')).toBeInTheDocument()
    })

    it('shows Refresh button when verdict exists', () => {
      const suburb = {
        ...baseSuburb,
        aiVerdict: 'HOLD',
      }
      renderPanel(suburb)
      fireEvent.click(screen.getByText('🏛️ Committee'))
      expect(screen.getByText('Refresh AI Committee')).toBeInTheDocument()
    })
  })

  describe('5-Axis Macro Intelligence & Anti-Market Tab', () => {
    it('renders 5-Axis Macro & RBA Reality Check in Sentiment tab when available', () => {
      const suburb = {
        ...baseSuburb,
        metrics: {
          ...baseSuburb.metrics,
          aiNewsSentiment: 'Bearish (2.8/10)',
          _newsScore: 2.8,
          _macroIntelligence: {
            rba_rate_sensitivity: {
              level: 'HIGH',
              summary: 'Net yield ~2.74% vs ~6.20% mortgage rate leaves a -3.46% negative carry spread.',
            },
            supply_dilution_risk: {
              level: 'HIGH',
              summary: 'Vacancy at 4.48% exceeds the 3.5% Australian oversupply threshold.',
            },
            regulatory_tax_risk: {
              level: 'HIGH',
              summary: 'VIC COVID Debt Levy lowers land tax threshold to $50k.',
            },
            hype_vs_data_divergence: {
              level: 'SEVERE',
              summary: 'Media/agent narrative is bullish while local prices are falling (-9.86% 3m).',
            },
            amenity_claim_check: {
              risk_level: 'HIGH_PITCH_RISK',
              warnings: [
                'Hospital/Employer Spillover Check: Local vacancy is 4.48% — regional hospital demand is absorbed by primary hub.',
              ],
            },
          },
        },
      }
      renderPanel(suburb)
      expect(screen.getByText(/5-Axis Macro & RBA Reality Check/)).toBeInTheDocument()
      expect(screen.getByText(/Hype Divergence: SEVERE/)).toBeInTheDocument()
      expect(screen.getByText(/Hospital\/Employer Spillover Check/)).toBeInTheDocument()
    })

    it('switches to Anti-Market tab and displays Value Trap Warning and alternatives', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suburb_id: 'VIC_CHURCHILL_3842',
          anti_market_score: 5,
          trend_label: 'Value Trap Warning',
          is_value_trap: true,
          state_median_12m_growth: -0.9,
          alpha_12m: -1.54,
          trap_signals: [
            'High rental vacancy (4.48% >= 3.5% oversupply threshold)',
            'Accelerating 3-month price drop (-9.86%)',
          ],
          resilience_drivers: [],
          macro_intelligence: {
            amenity_claim_check: {
              warnings: ['School Quality Check: Average local ICSEA is 953 (below 1000 national benchmark).'],
            },
          },
          alternatives: [
            {
              id: 'VIC_DELACOMBE_3356',
              name: 'Delacombe',
              postcode: '3356',
              anti_market_score: 79,
              house_median_price: 545000,
              price_12m_change_pct: 6.2,
              vacancy_rate: 1.2,
              rental_yield: 4.5,
              why_resilient: ['Tight 1.2% vacancy and +7.1% alpha vs VIC median'],
            },
          ],
        }),
      })

      renderPanel()
      fireEvent.click(screen.getByText('🛡️ Anti-Market'))
      expect(screen.getByText('Counter-Cyclical & Value Trap Radar')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Run Anti-Market Check'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/suburbs/nsw-parramatta-2150/anti-market')
      })

      await waitFor(() => {
        expect(mockSetActiveSuburb).toHaveBeenCalled()
      })
    })
  })
})
