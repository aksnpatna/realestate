import { useState, useEffect, memo } from 'react'
import type { SuburbData } from '../data/suburbs'
import type { BuyerFitResult } from '../data/buyerFitTypes'

interface DecisionSnapshot {
  decision_snapshot_id: string
  model_version: string
  score: number
  components: Record<string, { score: number; weight: number; contribution: number }>
  drivers: string[]
  risks: string[]
  unknowns: string[]
  confidence_label: string
  eligibility: { eligible: boolean; reasons: string[]; eligibility_dq_score: number; threshold: number }
}

interface DecisionBriefProps {
  activeSuburb: SuburbData
  setActiveTab: (tab: 'buy-finder' | 'profile' | 'gearing') => void
  selectedResult?: BuyerFitResult | null
  requestMeta?: { request_id: string; model_version: string } | null
}

export default memo(function DecisionBrief({ activeSuburb, setActiveTab, selectedResult, requestMeta }: DecisionBriefProps) {
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAssumptions, setShowAssumptions] = useState(false)

  useEffect(() => {
    if (selectedResult) {
      setSnapshot(null)
      setLoading(false)
      setError(null)
      return
    }
    if (!activeSuburb?.id) return
    setLoading(true)
    setError(null)
    fetch(`/api/suburbs/${activeSuburb.id}/decision-brief`)
      .then(res => {
        if (res.ok) return res.json()
        throw new Error(`Server error (${res.status})`)
      })
      .then(data => {
        setSnapshot(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || 'Failed to load decision brief')
        setLoading(false)
      })
  }, [activeSuburb?.id, selectedResult])

  if (selectedResult) {
    const aff = selectedResult.affordability
    const score = selectedResult.buyer_fit_score
    const confColor = selectedResult.confidence_label === 'high' ? '#10b981' : selectedResult.confidence_label === 'medium' ? '#eab308' : '#ef4444'

    return (
      <div style={{
        marginTop: '15px', padding: '16px',
        background: 'linear-gradient(145deg, rgba(14,165,233,0.06) 0%, rgba(16,185,129,0.06) 100%)',
        border: '2px solid rgba(14,165,233,0.2)', borderRadius: '10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Decision Brief
          </h3>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
            Based on your latest Buy Finder assumptions
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {Math.round(score)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Buyer Fit Score</div>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            {aff && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: aff.serviceability_passed ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {aff.serviceability_passed ? '✓ Serviceability passes under stated assumptions' : '✗ Serviceability not met at current rate assumptions'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Loan ${aff.required_loan?.toLocaleString()} · Capacity ${aff.estimated_borrowing_capacity?.toLocaleString()}
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Evidence: <span style={{ color: confColor, fontWeight: 600 }}>{selectedResult.confidence_label.toUpperCase()}</span>
              <span style={{ marginLeft: '8px' }}>· {requestMeta?.model_version || ''}</span>
            </div>
            {selectedResult.drivers.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                {selectedResult.drivers.slice(0, 2).map((d, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: '#10b981', paddingLeft: '8px' }}>+ {d}</div>
                ))}
              </div>
            )}
            {selectedResult.risks.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                {selectedResult.risks.slice(0, 2).map((r, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: '#ef4444', paddingLeft: '8px' }}>- {r}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <details style={{ marginTop: '10px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}
            onClick={() => setShowAssumptions(!showAssumptions)}>
            {showAssumptions ? 'Hide' : 'Show'} assumptions (rate, buffer, term, costs)
          </summary>
          {aff?.assumptions && (
            <div style={{ marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div>Rate: {(aff.assumptions.interest_rate * 100).toFixed(1)}%</div>
              <div>Buffer: +{(aff.assumptions.serviceability_buffer * 100).toFixed(0)}%</div>
              <div>Term: {aff.assumptions.loan_term_years}yr</div>
              <div>Costs: {(aff.assumptions.purchase_cost_allowance_pct * 100).toFixed(0)}%</div>
              <div>Income: ${aff.assumptions.annual_income?.toLocaleString()}</div>
              <div>Debt: ${aff.assumptions.monthly_debt?.toLocaleString()}/mo</div>
              <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>Decision ID: {requestMeta?.request_id || 'N/A'}</div>
            </div>
          )}
        </details>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => setActiveTab('buy-finder')}
            style={{ padding: '4px 10px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
          >
            Back to Results
          </button>
          <button
            onClick={() => setActiveTab('gearing')}
            style={{ padding: '4px 10px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
          >
            View Cashflow
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ marginTop: '15px', padding: '16px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-glass)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading decision brief...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ marginTop: '15px', padding: '16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
        <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Decision Brief Unavailable</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{error}</div>
      </div>
    )
  }

  if (!snapshot) return null

  return (
    <div style={{
      marginTop: '15px', padding: '16px',
      background: 'linear-gradient(145deg, rgba(14,165,233,0.04) 0%, rgba(16,185,129,0.04) 100%)',
      border: '1px solid var(--border-glass)', borderRadius: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          General Market Snapshot
        </h3>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Not based on your Buy Finder inputs — open Buy Finder for personalised results</span>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
            {Math.round(snapshot.score)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Buyer Fit (default)</div>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          {snapshot.drivers.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>+ Supports</div>
              {snapshot.drivers.slice(0, 3).map((d: string, i: number) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', paddingLeft: '8px' }}>{d}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={() => setActiveTab('buy-finder')}
          style={{ padding: '4px 10px', background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
        >
          Open Buy Finder
        </button>
        <button
          onClick={() => setActiveTab('gearing')}
          style={{ padding: '4px 10px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
        >
          View Cashflow
        </button>
      </div>
    </div>
  )
})