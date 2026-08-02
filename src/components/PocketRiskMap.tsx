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
      <div className="glass-card u-475af511">
        Loading pocket risk analysis...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass-card u-db7aa9c1">
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
    <div className="glass-card u-ca1a383a">
      <div className="u-47a97aa0">
        <h3 className="u-b5fda34d">
          🗺️ Where to look inside {data.suburb_name}
        </h3>
        <span
          className="u-f505939c"
        >
          {data.precision.toUpperCase()} approximation
        </span>
      </div>

      <p className="u-8212ad41">
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
          <h4 className="u-87aec9b6">
            ⚠ Avoid Advisory
          </h4>
          <ul className="u-3d7a0d31">
            {data.avoid_advisory.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Layer Toggles */}
      <div className="u-652a39d3">
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
            <div className="u-4beeb81e">
              <span className="u-5cc8fb11">
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
            <div className="u-efe24597">
              {f.properties.value}
            </div>
            <div className="u-62688933">
              {f.properties.impact}
            </div>
            <div className="u-7adad620">
              Source: {f.properties.source}
            </div>
          </div>
        )
      })}

      <div className="u-bc2f819d">
        This analysis is decision-aiding guidance, not a property-level verdict. Verify with due diligence.
      </div>
    </div>
  )
})

export default PocketRiskMap
