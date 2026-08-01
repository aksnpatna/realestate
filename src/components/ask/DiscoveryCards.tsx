import React from 'react';
import './DiscoveryCards.css';

interface DiscoveryMetrics {
  median_price?: number | null; yield_pct?: number | null; vacancy_rate?: number | null;
  population_cagr?: number | null; school_quality?: number | null;
  transit_accessibility?: number | null; parks_count?: number | null; safety_score?: number | null;
}
export interface DiscoveryResult {
  suburb_id?: string; name: string; state: string; postcode?: string;
  match_score: number; dist_km?: number | null; why_selected: string[]; metrics: DiscoveryMetrics;
}
export interface DiscoveryResponse {
  guardrail: boolean; message?: string | null; summary?: string | null;
  query_understood: any; results: DiscoveryResult[]; disclaimer: string;
}

const fmt = (v?: number | null, decimals = 2, suffix = '') => v != null ? `${v.toFixed(decimals)}${suffix}` : '—';
const fmtPrice = (v?: number | null) => v != null ? `$${((v as number) / 1000).toFixed(0)}k` : '—';
const scoreClass = (s: number) => s >= 70 ? 'dc-score--high' : s >= 50 ? 'dc-score--mid' : 'dc-score--low';

export const DiscoveryCards: React.FC<{
  disc: DiscoveryResponse;
  onBuildBrief: (name: string, state: string) => void;
}> = ({ disc, onBuildBrief }) => {
  if (disc.guardrail && disc.message) {
    return (
      <div className="dc-guardrail">
        <p className="dc-guardrail__msg">{disc.message}</p>
        <p className="dc-guardrail__hint">Try a different direction, or use Buy Finder to scan a broader area.</p>
      </div>
    );
  }

  if (!disc.results.length) {
    return (
      <div className="dc-empty">
        <p>{disc.message || 'No suburbs found matching your criteria.'}</p>
      </div>
    );
  }

  return (
    <div className="dc-list">
      {disc.summary && <p className="dc-summary">{disc.summary}</p>}
      {disc.results.map((r, i) => (
        <div key={r.suburb_id || r.name} className={`dc-card ${i === 0 ? 'dc-card--first' : ''}`}>
          <div className={`dc-card__rank ${i === 0 ? 'dc-card__rank--first' : ''}`}>#{i + 1} MATCH</div>
          <div className="dc-card__header">
            <div>
              <h3 className="dc-card__name">{r.name}</h3>
              <span className="dc-card__meta">{r.state}{r.postcode ? ` ${r.postcode}` : ''}{r.dist_km ? ` · ${r.dist_km.toFixed(0)}km away` : ''}</span>
            </div>
            <div className="dc-card__score">
              <span className={`dc-score ${scoreClass(r.match_score)}`}>{r.match_score.toFixed(0)}</span>
              <span className="dc-card__score-label">match score</span>
            </div>
          </div>

          <ul className="dc-card__reasons">
            {r.why_selected.slice(0, 3).map((w, wi) => <li key={wi}>{w}</li>)}
          </ul>

          <div className="dc-card__metrics">
            {r.metrics.median_price != null && <span className="dc-card__metric">Price: <strong>{fmtPrice(r.metrics.median_price)}</strong></span>}
            {r.metrics.yield_pct != null && <span className="dc-card__metric">Yield: <strong className="dc-metric--yield">{fmt(r.metrics.yield_pct)}%</strong></span>}
            {r.metrics.school_quality != null && <span className="dc-card__metric">Schools: <strong className="dc-metric--schools">{fmt(r.metrics.school_quality, 1)}/10</strong></span>}
            {r.metrics.transit_accessibility != null && <span className="dc-card__metric">Transit: <strong>{fmt(r.metrics.transit_accessibility, 1)}/10</strong></span>}
            {r.metrics.vacancy_rate != null && <span className="dc-card__metric">Vacancy: <strong>{fmt(r.metrics.vacancy_rate)}%</strong></span>}
            {r.metrics.population_cagr != null && <span className="dc-card__metric">Growth: <strong className="dc-metric--growth">{fmt(r.metrics.population_cagr, 1)}%pa</strong></span>}
          </div>

          <button className="dc-card__cta" onClick={() => onBuildBrief(r.name, r.state)}>
            Build Full Research Brief
          </button>
        </div>
      ))}
      <p className="dc-disclaimer">General research only — not financial, legal, or valuation advice.</p>
    </div>
  );
};
