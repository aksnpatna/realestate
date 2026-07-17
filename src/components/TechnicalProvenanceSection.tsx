/**
 * TechnicalProvenanceSection.tsx — Buyer's Agent persona view.
 *
 * Renders 12+ ingested-but-under-surfaced fields with label, value, trend, and
 * a one-line "why it matters" impact text. Only visible when persona has
 * show_technical = true.
 */
import { memo } from 'react'

interface Indicator {
  key: string
  label: string
  value: string | number | null
  trend?: 'up' | 'down' | 'neutral'
  impact: string
  source?: string
}

interface Props {
  suburb: Record<string, any>
}

function indicatorGrid(indicators: Indicator[]) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
      {indicators.map(ind => (
        <div
          key={ind.key}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {ind.label}
            </span>
            {ind.trend === 'up' && <span style={{ color: '#10b981', fontSize: '0.7rem' }}>▲</span>}
            {ind.trend === 'down' && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>▼</span>}
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {ind.value != null ? ind.value : '—'}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{ind.impact}</span>
          {ind.source && (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Source: {ind.source}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

const TechnicalProvenanceSection = memo(function TechnicalProvenanceSection({ suburb }: Props) {
  const s = suburb

  const crimeIndicators: Indicator[] = [
    {
      key: 'crime_rate',
      label: 'Crime Rate',
      value: s.crimeRate != null ? s.crimeRate.toLocaleString() : null,
      impact: 'Incidents per 100k. Higher = more reported incidents in PostCode area.',
      source: 'SA CRIME STAT (via realestate.com.au proxy)',
    },
    {
      key: 'safety_score',
      label: 'Safety Score',
      value: s.safetyScore != null ? `${Math.round(s.safetyScore)}/100` : null,
      impact: 'Composite safety derived from crime rate + local context.',
    },
  ]

  const housingIndicators: Indicator[] = [
    {
      key: 'social_housing_pct',
      label: 'Social Housing %',
      value: s.socialHousingPct != null ? `${Number(s.socialHousingPct).toFixed(1)}%` : null,
      impact: 'Higher concentrations may indicate lower property value growth in adjacent pockets.',
      source: 'ABS Census 2021 G37',
    },
    {
      key: 'public_housing_dwellings',
      label: 'Public Housing Dwellings',
      value: s.publicHousingDwellings ?? null,
      impact: 'State housing authority dwellings (G37 landlord type 4).',
      source: 'ABS Census 2021 G37',
    },
    {
      key: 'community_housing_dwellings',
      label: 'Community Housing Dwellings',
      value: s.communityHousingDwellings ?? null,
      impact: 'Community housing provider dwellings (G37 landlord type 5).',
      source: 'ABS Census 2021 G37',
    },
  ]

  const subdivIndicators: Indicator[] = [
    {
      key: 'approved_subdivisions_12m',
      label: 'Approved Subdivisions (12m)',
      value: s.approvedSubdivisions12m ?? null,
      impact: 'Real-world precedent for subdivision approval in this suburb.',
      source: 'State planning APIs / OSM building footprint proxy',
    },
    {
      key: 'min_approved_subdivision_sqm',
      label: 'Min Approved Lot (sqm)',
      value: s.minApprovedSubdivisionSqm != null ? `${s.minApprovedSubdivisionSqm} sqm` : null,
      impact: 'Smallest approved lot — lower = denser subdivision possible.',
      source: 'State planning rules / OSM proxy',
    },
    {
      key: 'subdivision_potential',
      label: 'Subdivision Potential',
      value: s.subdivisionPotential ?? null,
      impact: 'Heuristic based on avg block size vs state minimum lot thresholds.',
      source: 'Derived: area/total_properties > min_lot size',
    },
  ]

  const devIndicators: Indicator[] = [
    {
      key: 'construction_sqkm',
      label: 'Construction SqKm',
      value: s.constructionSqkm != null ? `${Number(s.constructionSqkm).toFixed(2)} km²` : null,
      impact: 'OSM landuse=construction area — proxy for active development.',
      source: 'OpenStreetMap',
    },
    {
      key: 'greenfield_sqkm',
      label: 'Greenfield SqKm',
      value: s.greenfieldSqkm != null ? `${Number(s.greenfieldSqkm).toFixed(2)} km²` : null,
      impact: 'Undeveloped land potentially available for future subdivision.',
      source: 'OpenStreetMap',
    },
    {
      key: 'brownfield_sqkm',
      label: 'Brownfield SqKm',
      value: s.brownfieldSqkm != null ? `${Number(s.brownfieldSqkm).toFixed(2)} km²` : null,
      impact: 'Previously-developed land available for redevelopment.',
      source: 'OpenStreetMap',
    },
    {
      key: 'unemployment_rate',
      label: 'Unemployment Rate',
      value: s.unemploymentRate != null ? `${Number(s.unemploymentRate).toFixed(1)}%` : null,
      impact: 'Higher unemployment reduces rental demand stability.',
    },
    {
      key: 'building_approvals_12m',
      label: 'Building Approvals (12m)',
      value: s.buildingApprovals12m ?? null,
      impact: 'New dwelling approvals signal supply pipeline.',
      source: 'ABS Building Approvals',
    },
  ]

  const provenanceIndicators: Indicator[] = [
    {
      key: 'abs_demographics_sourced',
      label: 'Demographics Source',
      value: s.absDemographicsSourced ? '✓ ABS 2021 Census' : '⚠ Mixed / derived',
      impact: 'Whether demographic fields trace to ABS Census 2021.',
      trend: s.absDemographicsSourced ? 'up' : 'down',
    },
    {
      key: 'dq_score',
      label: 'Data Quality Score',
      value: s.dqScore != null ? `${Math.round(s.dqScore)}/100` : null,
      impact: 'Completeness + freshness of all ingested data fields.',
      trend: (s.dqScore ?? 0) >= 80 ? 'up' : (s.dqScore ?? 0) >= 60 ? 'neutral' : 'down',
    },
    {
      key: 'cadastral_source',
      label: 'Cadastral Last Sync',
      value: s.cadastralLastSynced ? new Date(s.cadastralLastSynced).toLocaleDateString() : 'Not available',
      impact: 'When cadastral data was last updated from state land registry.',
    },
  ]

  return (
    <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Technical & Provenance</h3>
        <span style={{ fontSize: '0.65rem', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '4px' }}>
          Buyer's Agent View
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            🛡️ Crime & Safety
          </h4>
          {indicatorGrid(crimeIndicators)}
        </div>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            🏘️ Social Housing (ABS Census 2021)
          </h4>
          {indicatorGrid(housingIndicators)}
        </div>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            📐 Subdivision Precedent
          </h4>
          {indicatorGrid(subdivIndicators)}
        </div>
        <div>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            🏗️ Development Activity (OSM)
          </h4>
          {indicatorGrid(devIndicators)}
        </div>
        <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            📋 Data Provenance & Quality
          </h4>
          {indicatorGrid(provenanceIndicators)}
        </div>
        {s.dqIssues && s.dqIssues.length > 0 && (
          <div style={{
            marginTop: '4px', padding: '10px',
            background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '6px',
          }}>
            <h4 style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '6px' }}>
              ⚠ DQ Alerts ({s.dqIssues.length})
            </h4>
            {s.dqIssues.map((issue: any, i: number) => (
              <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                <strong>{issue.field}</strong>: {issue.issue} ({issue.severity})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

export default TechnicalProvenanceSection
