/**
 * PocketRiskMap.tsx — "Where to look inside this suburb" / pockets-to-avoid layer.
 *
 * Renders an advisory panel + toggleable risk overlays on the existing SuburbMap.
 * Reuses ingested crime, social housing, development, and cadastral data.
 *
 * Precision disclosure: suburb-level approximation (SA1 not yet ingested).
 */
import { useState, useEffect, memo } from 'react'

interface PocketFeature {
  id: string
  properties: {
    layer: string
    label: string
    value: string
    severity: 'high' | 'medium' | 'low'
    impact: string
    source: string
    detail?: Record<string, any>
  }
}

interface PocketResponse {
  suburb_id: string
  suburb_name: string
  precision: string
  precision_note: string
  features: PocketFeature[]
  avoid_advisory: string[]
}

const severityColors: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
}

interface Props {
  suburbId: string
}

const PocketRiskMap = memo(function PocketRiskMap({ suburbId }: Props) {
  const [data, setData] = useState<PocketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(['crime', 'social_housing']),
  )

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/suburbs/${encodeURIComponent(suburbId)}/pockets`)
      .then(r => {
        if (!r.ok) throw new Error(`Server ${r.status}`)
        return r.json()
      })
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [suburbId])

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading pocket risk analysis...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', textAlign: 'center', color: '#ef4444' }}>
        Pocket risk data unavailable: {error || 'No data'}
      </div>
    )
  }

  const toggleLayer = (layer: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  return (
    <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>
          🗺️ Where to look inside {data.suburb_name}
        </h3>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'rgba(245,158,11,0.12)',
            color: '#f59e0b',
          }}
        >
          {data.precision.toUpperCase()} approximation
        </span>
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {data.precision_note}
      </p>

      {/* Avoid Advisory */}
      {data.avoid_advisory.length > 0 && (
        <div
          style={{
            padding: '10px',
            marginBottom: '10px',
            background: data.avoid_advisory[0] !== 'No high-risk signals detected at suburb level'
              ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)',
            border: `1px solid ${
              data.avoid_advisory[0] !== 'No high-risk signals detected at suburb level'
                ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'
            }`,
            borderRadius: '8px',
          }}
        >
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            ⚠ Avoid Advisory
          </h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {data.avoid_advisory.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Layer Toggles */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {data.features.map(f => (
          <button
            key={f.properties.layer}
            type="button"
            onClick={() => toggleLayer(f.properties.layer)}
            style={{
              padding: '4px 10px',
              fontSize: '0.7rem',
              fontWeight: activeLayers.has(f.properties.layer) ? 600 : 400,
              border: '1px solid var(--border-glass)',
              borderRadius: '20px',
              background: activeLayers.has(f.properties.layer)
                ? `${severityColors[f.properties.severity]}20`
                : 'var(--bg-card)',
              color: activeLayers.has(f.properties.layer)
                ? severityColors[f.properties.severity]
                : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {activeLayers.has(f.properties.layer) ? '●' : '○'} {f.properties.label}: {f.properties.value}
          </button>
        ))}
      </div>

      {/* Active Layer Detail */}
      {Array.from(activeLayers).map(layerId => {
        const f = data.features.find(fe => fe.properties.layer === layerId)
        if (!f) return null
        return (
          <div
            key={layerId}
            style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${severityColors[f.properties.severity]}40`,
              borderLeft: `3px solid ${severityColors[f.properties.severity]}`,
              borderRadius: '6px',
              marginBottom: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {f.properties.label}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: `${severityColors[f.properties.severity]}20`,
                  color: severityColors[f.properties.severity],
                }}
              >
                {f.properties.severity.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', margin: '4px 0' }}>
              {f.properties.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              {f.properties.impact}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
              Source: {f.properties.source}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        This analysis is decision-aiding guidance, not a property-level verdict. Verify with due diligence.
      </div>
    </div>
  )
})

export default PocketRiskMap
