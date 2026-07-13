import { useState, useMemo, memo } from 'react';
import type { SuburbData } from '../data/suburbs';

export default memo(function BuyFinder({ suburbsData }: { suburbsData: SuburbData[] }) {
  const [searchText, setSearchText] = useState('');
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [minGrowthScore, setMinGrowthScore] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minSchoolQuality, setMinSchoolQuality] = useState(0);
  const [minTransit, setMinTransit] = useState(0);
  const [metroOnly, setMetroOnly] = useState(false);
  const [maxCBDMins, setMaxCBDMins] = useState<number | null>(null);

  // Objective Weights
  const [wGrowth, setWGrowth] = useState(30);
  const [wYield, setWYield] = useState(30);
  const [wAffordability, setWAffordability] = useState(20);
  const [wLivability, setWLivability] = useState(20);

  const allStates = useMemo(() => Array.from(new Set(suburbsData.map(s => s.state))).sort(), [suburbsData]);

  const toggleState = (s: string) => {
    setSelectedStates(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

const results = useMemo(() => {
      const scoredSuburbs = suburbsData.map(suburb => {
        // Normalize metrics to 0-100 scale for scoring
        const growthNorm = suburb.growthScore ?? 50;
        const yieldNorm = Math.min(100, Math.max(0, ((suburb.metrics?.rentalYield ?? 3) - 2) * 20)); // e.g. 3% -> 20, 7% -> 100
        const affordNorm = Math.max(0, 100 - ((suburb.metrics?.medianPrice ?? 1000000) / 30000)); // cheaper is better
        const liveNorm = ((suburb.metrics?.schoolQuality ?? 5) * 5) + ((suburb.metrics?.transitAccessibility ?? 5) * 5); // 0-100

        const totalWeight = wGrowth + wYield + wAffordability + wLivability;
        const fitScore = totalWeight > 0 ? 
          ((growthNorm * wGrowth) + (yieldNorm * wYield) + (affordNorm * wAffordability) + (liveNorm * wLivability)) / totalWeight
          : 0;
          
        return { ...suburb, fitScore: Math.round(fitScore) };
      });

      return scoredSuburbs.filter(suburb => {
        // Safe text search (ignore case & whitespace)
        const txt = searchText?.trim().toLowerCase();
        if (txt && !(suburb.name?.toLowerCase().includes(txt) || suburb.postcode?.includes(txt))) return false;
        if (selectedStates.size > 0 && !selectedStates.has(suburb.state)) return false;
        if (minGrowthScore > 0 && (suburb.growthScore ?? 0) < minGrowthScore) return false;
        // Defensive metric checks – fallback to safe extremes
        if (maxPrice !== null && (suburb.metrics?.medianPrice ?? Infinity) > maxPrice) return false;
        if (minSchoolQuality > 0 && (suburb.metrics?.schoolQuality ?? 0) < minSchoolQuality) return false;
        if (minTransit > 0 && (suburb.metrics?.transitAccessibility ?? 0) < minTransit) return false;
        if (metroOnly && !suburb.isMetro) return false;
        if (maxCBDMins !== null && (suburb.cbdDistanceMins ?? Infinity) > maxCBDMins) return false;
        return true;
      }).sort((a, b) => b.fitScore - a.fitScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchText, selectedStates, minGrowthScore, maxPrice, minSchoolQuality, minTransit, metroOnly, maxCBDMins, wGrowth, wYield, wAffordability, wLivability]);

  return (
    <div className="search-container">
      <div className="glass-card search-card">
        <h2 className="detail-title">Buy Finder</h2>
        <p className="subtitle">Filter and rank suburbs based on your constraints and objective weights</p>

        <div className="search-input-row">
          <input
            type="text"
            className="premium-search-input"
            placeholder="Search by suburb name or postcode..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="filter-grid">
          <div className="filter-section">
            <label className="control-label">States</label>
            <div className="filter-chips">
              {allStates.map(s => (
                <button
                  key={s}
                  className={`chip ${selectedStates.has(s) ? 'chip-active' : ''}`}
                  onClick={() => toggleState(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <div className="control-group">
              <label className="control-label">Min Growth Score</label>
              <input
                type="range"
                className="premium-range"
                min={0}
                max={100}
                step={5}
                value={minGrowthScore}
                aria-label="Minimum growth score"
                onChange={(e) => setMinGrowthScore(Number(e.target.value))}
              />
              <output className="range-value" aria-live="polite">{minGrowthScore}</output>
            </div>
            <div className="control-group">
              <label className="control-label">Max Price</label>
              <input
                type="number"
                className="premium-input small"
                value={maxPrice ?? ''}
                onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
                placeholder="No limit"
                min={100000}
                step={50000}
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="control-group">
              <label className="control-label">Min School Quality</label>
              <input
                type="range"
                className="premium-range"
                min={0}
                max={10}
                step={0.5}
                value={minSchoolQuality}
                aria-label="Minimum school quality"
                onChange={(e) => setMinSchoolQuality(Number(e.target.value))}
              />
              <output className="range-value" aria-live="polite">{minSchoolQuality}/10</output>
            </div>
            <div className="control-group">
              <label className="control-label">Min Transit Access</label>
              <input
                type="range"
                className="premium-range"
                min={0}
                max={10}
                step={0.5}
                value={minTransit}
                aria-label="Minimum transit accessibility"
                onChange={(e) => setMinTransit(Number(e.target.value))}
              />
              <output className="range-value" aria-live="polite">{minTransit}/10</output>
            </div>
          </div>

          <div className="filter-row">
            <div className="control-group">
              <label className="toggle-label">
                <input type="checkbox" checked={metroOnly} onChange={(e) => setMetroOnly(e.target.checked)} />
                <span>Metro suburbs only</span>
              </label>
            </div>
            {metroOnly && (
              <div className="control-group">
                <label className="control-label">Max CBD commute (mins)</label>
                <input
                  type="number"
                  className="premium-input small"
                  value={maxCBDMins ?? ''}
                  onChange={(e) => setMaxCBDMins(e.target.value ? Number(e.target.value) : null)}
                  placeholder="No limit"
                  min={5}
                  max={120}
                />
              </div>
            )}
          </div>
          
          <div className="filter-section" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <label className="control-label">Objective Weights (Adjust to compute Fit Score)</label>
            <div className="filter-row">
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Growth ({wGrowth}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wGrowth} onChange={(e) => setWGrowth(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Yield ({wYield}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wYield} onChange={(e) => setWYield(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Affordability ({wAffordability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAffordability} onChange={(e) => setWAffordability(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Livability ({wLivability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wLivability} onChange={(e) => setWLivability(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card search-results-card">
        <h3>Results ({results.length} suburbs)</h3>

        {results.length === 0 ? (
          <p className="text-muted">No suburbs match your criteria. Try broadening your filters.</p>
        ) : (
          <div className="search-results-grid">
            {results.map(suburb => (
              <SearchResultCard key={suburb.id} suburb={suburb} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
})

const SearchResultCard = memo(function SearchResultCard({ suburb }: { suburb: SuburbData }) {
  return (
    <div className="result-card glass-card">
      <div className="result-card-header">
        <h4>{suburb.name}</h4>
        <span className="state-badge">{suburb.state}</span>
      </div>
      <div className="result-card-body">
        <div className="result-meta">
          <span>Postcode: {suburb.postcode}</span>
          {suburb.isMetro && suburb.cbdDistanceMins !== null && (
            <span>{suburb.cbdDistanceMins} min to {suburb.metroCBD}</span>
          )}
          {!suburb.isMetro && <span className="text-muted">{suburb.metroCBD}</span>}
        </div>
        <div className="result-metrics">
          <div className="rmetric">
            <span className="rmetric-value">${suburb.metrics?.medianPrice?.toLocaleString() ?? '—'}</span>
            <span className="rmetric-label" title="Median price – sourced from local property dataset">Median Price</span>
          </div>
          <div className="rmetric">
            <span className="rmetric-value">{suburb.metrics?.rentalYield ?? '—'}%</span>
            <span className="rmetric-label" title="Rental yield – annual % of median price">Yield</span>
          </div>
          <div className="rmetric" style={{ backgroundColor: 'rgba(0, 255, 128, 0.1)', padding: '5px', borderRadius: '4px' }}>
            <span className={`rmetric-value ${((suburb as any).fitScore ?? 0) >= 80 ? 'growth-high' : ((suburb as any).fitScore ?? 0) >= 60 ? 'growth-med' : 'growth-low'}`}>{(suburb as any).fitScore ?? '—'}</span>
            <span className="rmetric-label" style={{ color: 'var(--text-primary)' }} title="Dynamic Fit Score based on your objective weights">Fit Score</span>
          </div>
        </div>
        <div className="result-scores">
          <span title="School Quality">Schools: {suburb.metrics?.schoolQuality ?? '—'}/10</span>
          <span title="Transit Access">Transit: {suburb.metrics?.transitAccessibility ?? '—'}/10</span>
        </div>
        {(suburb.highlights || []).length > 0 && (
          <div className="result-highlights">
            {(suburb.highlights || []).filter((h: string) => !h.includes('generated') && !h.includes('N/A') && !h.includes('Data Unavailable') && !h.includes('Pending')).slice(0, 2).map((h: string, i: number) => (
              <span key={i} className="highlight-chip">{h}</span>
            ))}
          </div>
        )}
        {(suburb.highlights || []).length > 0 && (suburb.highlights || []).every((h: string) => h.includes('N/A') || h.includes('Data Unavailable') || h.includes('generated') || h.includes('Pending')) && (
          <p className="no-data-msg">No data available to forecast</p>
        )}
      </div>
    </div>
  );
});
