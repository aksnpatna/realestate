import { memo } from 'react'
import type { SuburbData } from '../data/suburbs'

interface DecisionBriefProps {
  activeSuburb: SuburbData
  setActiveTab: (tab: 'buy-finder' | 'profile' | 'gearing') => void
}

export default memo(function DecisionBrief({ activeSuburb, setActiveTab }: DecisionBriefProps) {
  const s = activeSuburb as any
  const riskAssess = s._riskAssessment
  const dq = s.dqScore

  const drivers: string[] = []
  const risks: string[] = []

  if (s.vacancyRate != null) {
    if (s.vacancyRate < 2) drivers.push(`Low vacancy (${s.vacancyRate}%)`)
    else if (s.vacancyRate > 4) risks.push(`Elevated vacancy (${s.vacancyRate}%)`)
  }
  if (s.populationCagr != null) {
    if (Number(s.populationCagr) > 2) drivers.push(`Strong population growth (${Number(s.populationCagr).toFixed(1)}%)`)
  }
  if (s.houseGrossRentalYield != null) {
    if (s.houseGrossRentalYield > 4) drivers.push(`Solid rental yield (${s.houseGrossRentalYield}%)`)
  }
  if (s.houseDaysOnMarket != null) {
    if (s.houseDaysOnMarket < 30) drivers.push(`Fast market (${s.houseDaysOnMarket} days)`)
  }
  if (s.houseMedianPrice != null && (s.houseMedianPrice > (s.metrics?.medianPrice || 800000) * 1.2)) {
    risks.push(`High entry price`)
  }
  if (dq != null && dq < 70) {
    risks.push(`Low data confidence (DQ ${Math.round(dq)}/100)`)
  }
  if (!s.houseMedianPrice12mChangePct || s.houseMedianPrice12mChangePct <= 0) {
    risks.push(`Flat or declining price trend`)
  }

  const whatChanges = []
  if (s.vacancyRate != null && s.vacancyRate < 10) {
    whatChanges.push(`Vacancy above ${Math.ceil(s.vacancyRate + 2)}%`)
  }
  if (s.houseGrossRentalYield != null) {
    whatChanges.push(`Yield below ${(s.houseGrossRentalYield - 0.5).toFixed(1)}%`)
  }
  whatChanges.push(`Interest rate above 7.5%`)

  const hasEvidence = drivers.length > 0 || risks.length > 0

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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Evidence: {dq ? (dq >= 90 ? 'High' : dq >= 70 ? 'Medium' : 'Low') : 'N/A'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
            {Math.round(s.growthScore ?? 0)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Growth Score</div>
        </div>
        {riskAssess && (
          <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div style={{
              fontSize: '1.3rem', fontWeight: 800,
              color: riskAssess.risk_rating === 'Low' ? '#10b981' : riskAssess.risk_rating === 'Medium' ? '#eab308' : '#ef4444'
            }}>
              {riskAssess.risk_rating}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Scenario Risk</div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: '200px' }}>
          {!hasEvidence && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '8px' }}>Insufficient data to form decision drivers. Try running AI analysis.</div>
          )}
          {drivers.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>+ Supports</div>
              {drivers.slice(0, 3).map((d, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', paddingLeft: '8px' }}>{d}</div>
              ))}
            </div>
          )}
          {risks.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>- Watch</div>
              {risks.slice(0, 2).map((r, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)', paddingLeft: '8px' }}>{r}</div>
              ))}
            </div>
          )}
        </div>
      </div>

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