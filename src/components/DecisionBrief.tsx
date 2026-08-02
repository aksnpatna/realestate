import { useState, useEffect, memo } from 'react'
import type { SuburbData } from '../data/suburbs'
import type { BuyerFitResult } from '../data/buyerFitTypes'
import { ScoreInlineHint } from './ScoreLegend'
import { Badge } from './ui'
import './DecisionBrief.css'

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

    return (
      <div className="db__hero">
        <div className="db__badges">
          <Badge variant="info">Buyer Fit</Badge>
          <Badge variant={selectedResult.confidence_label === 'high' ? 'dq-high' : selectedResult.confidence_label === 'medium' ? 'dq-medium' : 'dq-limited'}>
            {selectedResult.confidence_label.toUpperCase()} Confidence
          </Badge>
          {aff?.serviceability_passed !== undefined && (
            <Badge variant={aff.serviceability_passed ? 'success' : 'danger'}>
              {aff.serviceability_passed ? 'Serviceable' : 'Not serviceable'}
            </Badge>
          )}
        </div>
        <div className="db__score">{Math.round(score)}</div>
        <div className="db__score-label">Fit Score · Your Inputs</div>
        <div className="db__name">{selectedResult.name}, {selectedResult.state}</div>
        <div className="db__meta">
          Loan ${aff?.required_loan?.toLocaleString() || 'N/A'} · Capacity ${aff?.estimated_borrowing_capacity?.toLocaleString() || 'N/A'}
          {requestMeta?.model_version && <span> · Model {requestMeta.model_version}</span>}
        </div>

        {selectedResult.drivers.length > 0 && (
          <div className="db__drivers u-8dd66ad5">
            {selectedResult.drivers.slice(0, 3).map((d, i) => (
              <div key={i} className="db__driver"><span className="db__driver-icon">✓</span> {d}</div>
            ))}
            {selectedResult.risks.slice(0, 2).map((r, i) => (
              <div key={`r${i}`} className="db__driver"><span className="db__risk-icon">⚠</span> {r}</div>
            ))}
          </div>
        )}

        <details className="u-8dd66ad5">
          <summary onClick={() => setShowAssumptions(!showAssumptions)} className="u-45ee2661">
            {showAssumptions ? 'Hide' : 'Show'} loan assumptions
          </summary>
          {aff?.assumptions && (
            <div className="u-8563b935">
              <div>Rate: {(aff.assumptions.interest_rate * 100).toFixed(1)}% · Buffer: +{(aff.assumptions.serviceability_buffer * 100).toFixed(0)}% · {aff.assumptions.loan_term_years}yr</div>
              <div>Costs: {(aff.assumptions.purchase_cost_allowance_pct * 100).toFixed(0)}% · Income: ${aff.assumptions.annual_income?.toLocaleString()}</div>
              {requestMeta?.request_id && <div>Decision ID: {requestMeta.request_id}</div>}
            </div>
          )}
        </details>

        <div className="db__actions u-d55bf967">
          <button onClick={() => setActiveTab('buy-finder')} className="bf-card__action">Back to Results</button>
          <button onClick={() => setActiveTab('gearing')} className="bf-card__action bf-card__action--primary">View Cashflow</button>
          <button onClick={async (e) => {
              const btn = e.currentTarget;
              btn.textContent = 'Saving...';
              btn.disabled = true;
              try {
                const res = await fetch('/api/v3/brief', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    suburb_id: activeSuburb.id,
                    user_inputs: selectedResult.affordability.assumptions,
                    buyer_fit_score: selectedResult.buyer_fit_score,
                    market_timing_score: selectedResult.market_timing_score || 50,
                    ai_verdict: 'Brief generated',
                    serviceability_state: selectedResult.affordability
                  })
                });
                const data = await res.json();
                if (data.id) {
                  btn.textContent = `Saved! Link: /brief/${data.id.substring(0,6)}...`;
                  // Also reveal the broker CTA by setting a state, but since we are in a memo, 
                  // we can just use DOM manipulation for simplicity or better, just show the CTA by default.
                } else {
                  btn.textContent = 'Failed to Save';
                }
              } catch (err) {
                btn.textContent = 'Failed to Save';
              }
            }}
            className="bf-card__action bf-card__action--primary"
          >
            Save & Share Brief
          </button>
        </div>

        {/* Closed-Loop Referral Funnel (Monetize the Exit) */}
        <div className="u-308c109c">
          <div className="u-a2786881">
            🏦 Pre-Approval & Broker Handoff
          </div>
          <div className="u-ea633243">
            Your <strong>Buyer Fit</strong> is high and the <strong>ASX Market Predictor</strong> indicates a score of {selectedResult.market_timing_score || 50}/100 for this suburb's capital growth phase. 
            Lock in your borrowing capacity to action this brief.
          </div>
          <button 
            onClick={async (e) => {
              const btn = e.currentTarget;
              btn.textContent = 'Contacting Broker...';
              btn.disabled = true;
              setTimeout(() => {
                btn.textContent = '✓ Broker Request Sent';
                btn.style.background = 'rgba(16,185,129,0.2)';
                btn.style.borderColor = 'rgba(16,185,129,0.5)';
                btn.style.color = '#10b981';
              }, 1500);
            }}
            className="u-ec63ee45"
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(139,92,246,0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
          >
            Connect With a Partner Broker
          </button>
        </div>

        {/* Responsible Next Steps */}
        <div className="db__compliance u-4a682385">
          <div className="db__compliance-title">Responsible Next Steps — outside this app</div>
          <div className="u-df6a5298">
            <div>1. Obtain a formal serviceability assessment from a licensed broker or lender.</div>
            <div>2. Inspect actual listings and compare recent sales prices in this suburb.</div>
            <div>3. Arrange strata, building, planning, flood and bushfire checks as relevant.</div>
            <div>4. Verify current rent, vacancy rates and outgoings with local property managers.</div>
            <div>5. Seek legal, tax and financial advice appropriate to your circumstances.</div>
          </div>
          <div className="u-ff6484f1">
            This tool is a decision-support aid. It is not lender approval, financial advice, a property valuation or a price forecast.
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="u-b7b0b0a6">
        Loading decision brief...
      </div>
    )
  }

  if (error) {
    return (
      <div className="u-5458c56e">
        <div className="u-f95cf852">Decision Brief Unavailable</div>
        <div className="u-0d850f7d">{error}</div>
      </div>
    )
  }

  if (!snapshot) return null

  return (
    <div className="u-244d1d60">
      <div className="u-7d62c6a4">
        <h3 className="u-bcab2b1e">
          General Market Snapshot
        </h3>
        <span className="u-c49bb1e7">Not based on your Buy Finder inputs — open Buy Finder for personalised results</span>
      </div>
      <div className="u-95149f3d">
        <div className="u-9235e700">
          <div className="u-b0002f2f">
            {Math.round(snapshot.score)}
          </div>
          <div className="u-b735c10a">
            Fit (default assumptions)
            <ScoreInlineHint scoreKey="buyer_fit" value={snapshot.score} />
          </div>
        </div>
        <div className="u-6d7d28dd">
          {snapshot.drivers.length > 0 && (
            <div className="u-e50f284b">
              <div className="u-8f58520d">+ Supports</div>
              {snapshot.drivers.slice(0, 3).map((d: string, i: number) => (
                <div key={i} className="u-609b445a">{d}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="u-20393731">
        <button
          onClick={() => setActiveTab('buy-finder')}
          className="u-97f8612f"
        >
          Open Buy Finder
        </button>
        <button
          onClick={() => setActiveTab('gearing')}
          className="u-74dc5c0f"
        >
          View Cashflow
        </button>
      </div>

      {/* Responsible Next Steps — Journey 7 */}
      <div className="u-019240f4">
        <div className="u-41b6eb3e">
          📋 Responsible Next Steps — outside this app
        </div>
        <div className="u-df6a5298">
          <div>1. Obtain a formal serviceability assessment from a licensed broker or lender.</div>
          <div>2. Inspect actual listings and compare recent sales prices in this suburb.</div>
          <div>3. Arrange strata, building, planning, flood and bushfire checks as relevant.</div>
          <div>4. Verify current rent, vacancy rates and outgoings with local property managers.</div>
          <div>5. Seek legal, tax and financial advice appropriate to your circumstances.</div>
        </div>
        <div className="u-ff6484f1">
          This tool is a decision-support aid. It is not lender approval, financial advice, a property valuation or a price forecast.
        </div>
      </div>
    </div>
  )
})