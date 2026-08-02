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
    <div className="u-df4e9190">
      {indicators.map(ind => (
        <div
          key={ind.key}
          className="u-1cfb76fe"
        >
          <div className="u-4beeb81e">
            <span className="u-bee728a3">
              {ind.label}
            </span>
            {ind.trend === 'up' && <span className="u-cd42902e">▲</span>}
            {ind.trend === 'down' && <span className="u-8944d43a">▼</span>}
          </div>
          <span className="u-ebd22f0e">
            {ind.value != null ? ind.value : '—'}
          </span>
          <span className="u-fc193050">{ind.impact}</span>
          {ind.source && (
            <span className="u-0c79bce7">
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
      value: s.approvedSubdivisions12m != null && s.approvedSubdivisions12m > 0 ? s.approvedSubdivisions12m : null,
      impact: 'Real council DAs approved in this suburb — zero means no real feed integrated for this state.',
      source: 'State planning APIs (NSW only) / no feed for other states',
    },
    {
      key: 'min_approved_subdivision_sqm',
      label: 'Min Observed Lot (sqm)',
      value: s.minApprovedSubdivisionSqm != null ? `${s.minApprovedSubdivisionSqm} sqm` : null,
      impact: 'Smallest lot observed — from NSW planning rules or OSM building-footprint proxy for other states.',
      source: 'NSW ePlanning (real) / OSM P10 footprint proxy (non-NSW)',
    },
    {
      key: 'subdivision_potential',
      label: 'Subdivision Potential',
      value: s.subdivisionPotential ?? null,
      impact: 'Derived from min observed lot size. <300 sqm = High, <600 = Medium, else Low.',
      source: 'Derived: min_approved_subdivision_sqm thresholds',
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
    <div className="glass-card u-ca1a383a">
      <div className="u-7d62c6a4">
        <h3 className="u-b5fda34d">Technical & Provenance</h3>
        <span className="u-8fd86d46">
          Buyer's Agent View
        </span>
      </div>

      <div className="u-31b0223f">
        <div>
          <h4 className="u-4cdf1ffb">
            🛡️ Crime & Safety
          </h4>
          {indicatorGrid(crimeIndicators)}
        </div>
        <div>
          <h4 className="u-4cdf1ffb">
            🏘️ Social Housing (ABS Census 2021)
          </h4>
          {indicatorGrid(housingIndicators)}
        </div>
        <div>
          <h4 className="u-4cdf1ffb">
            📐 Subdivision Precedent
          </h4>
          {indicatorGrid(subdivIndicators)}
        </div>
        <div>
          <h4 className="u-4cdf1ffb">
            🏗️ Development Activity (OSM)
          </h4>
          {indicatorGrid(devIndicators)}
        </div>
        <div className="u-75baa306">
          <h4 className="u-4cdf1ffb">
            📋 Data Provenance & Quality
          </h4>
          {indicatorGrid(provenanceIndicators)}
        </div>
        {s.dqIssues && s.dqIssues.length > 0 && (
          <div className="u-174a489e">
            <h4 className="u-586c2214">
              ⚠ DQ Alerts ({s.dqIssues.length})
            </h4>
            {s.dqIssues.map((issue: any, i: number) => (
              <div key={i} className="u-eeaef089">
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
