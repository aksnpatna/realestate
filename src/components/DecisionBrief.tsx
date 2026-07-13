import { useState, useEffect, memo } from 'react'
import type { SuburbData } from '../data/suburbs'

interface DecisionSnapshot {
  decision_snapshot_id: string
  model_version: string
  suburb_id: string
  suburb_name: string
  state: string
  score: number
  components: Record<string, { score: number; weight: number; contribution: number }>
  drivers: string[]
  risks: string[]
  unknowns: string[]
  evidence_ids: string[]
  confidence_label: string
  eligibility: { eligible: boolean; reasons: string[]; eligibility_dq_score: number; threshold: number }
  generated_at: string
}

interface DecisionBriefProps {
  activeSuburb: SuburbData
  setActiveTab: (tab: 'buy-finder' | 'profile' | 'gearing') => void
}

export default memo(function DecisionBrief({ activeSuburb, setActiveTab }: DecisionBriefProps) {
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [activeSuburb?.id])

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

  const confColor = snapshot.confidence_label === 'high' ? '#10b981' : snapshot.confidence_label === 'medium' ? '#eab308' : '#ef4444'
  const dqScore = snapshot.eligibility?.eligibility_dq_score || 0

  const whatChanges = []
  const s = activeSuburb as any
  if (s.vacancyRate != null && s.vacancyRate < 10) whatChanges.push(`Vacancy above ${Math.ceil(s.vacancyRate + 2)}%`)
  if (s.houseGrossRentalYield != null) whatChanges.push(`Yield below ${(s.houseGrossRentalYield - 0.5).toFixed(1)}%`)
  whatChanges.push(`Interest rate above 7.5%`)

  return (
    <div style={{
      marginTop: '15px',
      padding: '16px',
      background: 'linear-gradient(145deg, rgba(14,165,233,0.04) 0%, rgba(16,185,129,0.04) 100%)',
      border: '1px solid var(--border-glass)',
      borderRadius: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Decision Brief
        </h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.7rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Evidence: </span>
          <span style={{ color: confColor, fontWeight: 600 }}>{snapshot.confidence_label.toUpperCase()}</span>
          <span style={{ color: 'var(--text-secondary)' }}>· DQ: {Math.round(dqScore)}</span>
          <span style={{ color: 'var(--text-muted)' }}>· {snapshot.model_version}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
            {Math.round(snapshot.score)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Buyer Fit Score</div>
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
          {snapshot.risks.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>- Watch</div>
              {snapshot.risks.slice(0, 2).map((r: string, i: number) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', paddingLeft: '8px' }}>{r}</div>
              ))}
            </div>
          )}
          {snapshot.drivers.length === 0 && snapshot.risks.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '8px' }}>Insufficient data to form decision drivers.</div>
          )}
        </div>
      </div>

      {snapshot.unknowns.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Unknown fields: {snapshot.unknowns.join(', ')}
        </div>
      )}

      {whatChanges.length > 0 && (
        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(234,179,8,0.06)', borderRadius: '6px', border: '1px solid rgba(234,179,8,0.1)' }}>
          <div style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: 600, marginBottom: '2px' }}>What changes the result:</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {whatChanges.slice(0, 3).join('  •  ')}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={() => setActiveTab('buy-finder')}
          style={{ padding: '4px 10px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
        >
          Compare Alternatives
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