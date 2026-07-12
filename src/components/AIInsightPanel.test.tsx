/**
 * Unit tests for AIInsightPanel component.
 * Run: npm test -- src/components/AIInsightPanel.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AIInsightPanel from './AIInsightPanel'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

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
      expect(screen.getByText('BUY — Strong Growth')).toBeInTheDocument()
      expect(screen.getByText('🐂 Bull — Anna')).toBeInTheDocument()
      expect(screen.getByText('🐻 Bear — Alex')).toBeInTheDocument()
      expect(screen.getByText('🏙️ Urban Planner')).toBeInTheDocument()
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
})
