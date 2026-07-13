import { useState, useMemo, memo, useEffect, useCallback } from 'react';
import type { SuburbData } from '../data/suburbs';

interface BuyFinderResult {
  suburb_id: string
  name: string
  state: string
  postcode: string
  median_price: number
  rental_yield: number
  vacancy_rate: number
  cbd_mins: number
  hard_constraints_passed: boolean
  hard_failures: string[]
  fit_score: number
  components: {
    growth: { score: number; weight: number; contribution: number }
    income: { score: number; weight: number; contribution: number }
    affordability: { score: number; weight: number; contribution: number }
    risk: { score: number; weight: number; contribution: number }
    livability: { score: number; weight: number; contribution: number }
  }
  confidence: number
  confidence_band: [number, number]
  drivers: string[]
  risks: string[]
}

interface BuyFinderResponse {
  model_version: string
  request_id: string
  results: BuyFinderResult[]
  excluded_count: number
  total_evaluated: number
}

export default memo(function BuyFinder({ suburbsData }: { suburbsData: SuburbData[] }) {
  const [searchText, setSearchText] = useState('');
  const [useBackend, setUseBackend] = useState(true);
  const [backendResults, setBackendResults] = useState<BuyFinderResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  
  // Backend-compatible constraints
  const [budget, setBudget] = useState(850000);
  const [deposit, setDeposit] = useState(170000);
  const [annualIncome, setAnnualIncome] = useState(150000);
  const [propertyType, setPropertyType] = useState('house');
  const [holdingPeriod, setHoldingPeriod] = useState(7);
  const [objective, setObjective] = useState('balanced');
  const [minYield, setMinYield] = useState(3.5);
  const [maxVacancy, setMaxVacancy] = useState(4.0);
  const [maxCBDMins, setMaxCBDMins] = useState<number | null>(60);
  const [metroOnly, setMetroOnly] = useState(false);
  
  // Objective Weights
  const [wGrowth, setWGrowth] = useState(30);
  const [wIncome, setWIncome] = useState(25);
  const [wAffordability, setWAffordability] = useState(20);
  const [wRisk, setWRisk] = useState(15);
  const [wLivability, setWLivability] = useState(10);

  const fetchBackendRanking = useCallback(async () => {
    if (!useBackend) return;
    setBackendLoading(true);
    setBackendError(null);
    try {
      const res = await fetch('/api/buy-finder/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget,
          deposit,
          annual_income: annualIncome,
          property_type: propertyType,
          holding_period_years: holdingPeriod,
          objective,
          minimum_yield: minYield,
          maximum_vacancy: maxVacancy,
          maximum_cbd_minutes: maxCBDMins || 120,
          exclude_flood_risk: true,
          exclude_bushfire_risk: true,
          weights: {
            growth: wGrowth,
            income: wIncome,
            affordability: wAffordability,
            risk: wRisk,
            livability: wLivability,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBackendResults(data);
      } else {
        setBackendError(`Server error (${res.status})`);
      }
    } catch (e: any) {
      setBackendError(e.message || 'Failed to fetch rankings');
    } finally {
      setBackendLoading(false);
    }
  }, [useBackend, budget, deposit, annualIncome, propertyType, holdingPeriod, objective, minYield, maxVacancy, maxCBDMins, wGrowth, wIncome, wAffordability, wRisk, wLivability]);

  useEffect(() => {
    const timer = setTimeout(() => fetchBackendRanking(), 300);
    return () => clearTimeout(timer);
  }, [fetchBackendRanking]);

  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [minSchoolQuality, setMinSchoolQuality] = useState(0);
  const [minTransit, setMinTransit] = useState(0);
  const [minGrowthScore, setMinGrowthScore] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

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
        const growthNorm = suburb.growthScore ?? 50;
        const yieldNorm = Math.min(100, Math.max(0, ((suburb.metrics?.rentalYield ?? 3) - 2) * 20));
        const affordNorm = Math.max(0, 100 - ((suburb.metrics?.medianPrice ?? 1000000) / 30000));
        const liveNorm = ((suburb.metrics?.schoolQuality ?? 5) * 5) + ((suburb.metrics?.transitAccessibility ?? 5) * 5);

        const totalWeight = wGrowth + wYield + wAffordability + wLivability;
        const fitScore = totalWeight > 0 ? 
          ((growthNorm * wGrowth) + (yieldNorm * wYield) + (affordNorm * wAffordability) + (liveNorm * wLivability)) / totalWeight
          : 0;
          
        return { ...suburb, fitScore: Math.round(fitScore) };
      });

      return scoredSuburbs.filter(suburb => {
        const txt = searchText?.trim().toLowerCase();
        if (txt && !(suburb.name?.toLowerCase().includes(txt) || suburb.postcode?.includes(txt))) return false;
        if (selectedStates.size > 0 && !selectedStates.has(suburb.state)) return false;
        if (minGrowthScore > 0 && (suburb.growthScore ?? 0) < minGrowthScore) return false;
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
            <label className="control-label">Buyer Constraints (Backend)</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <div className="control-group" style={{ flex: '1 1 150px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Budget</label>
                <input type="number" className="premium-input small" value={budget} onChange={e => setBudget(Number(e.target.value))} min={100000} step={50000} />
              </div>
              <div className="control-group" style={{ flex: '1 1 150px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Deposit</label>
                <input type="number" className="premium-input small" value={deposit} onChange={e => setDeposit(Number(e.target.value))} min={20000} step={10000} />
              </div>
              <div className="control-group" style={{ flex: '1 1 150px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Annual Income</label>
                <input type="number" className="premium-input small" value={annualIncome} onChange={e => setAnnualIncome(Number(e.target.value))} min={30000} step={10000} />
              </div>
              <div className="control-group" style={{ flex: '1 1 120px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Property Type</label>
                <select className="premium-input small" value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                  <option value="house">House</option>
                  <option value="unit">Unit</option>
                </select>
              </div>
              <div className="control-group" style={{ flex: '1 1 100px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Min Yield%</label>
                <input type="number" className="premium-input small" value={minYield} onChange={e => setMinYield(Number(e.target.value))} min={1} max={10} step={0.5} />
              </div>
              <div className="control-group" style={{ flex: '1 1 100px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Max Vacancy%</label>
                <input type="number" className="premium-input small" value={maxVacancy} onChange={e => setMaxVacancy(Number(e.target.value))} min={1} max={15} step={0.5} />
              </div>
            </div>
          </div>

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

          <div className="filter-section" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <label className="control-label">Objective Weights (Adjust to compute Fit Score)</label>
            <div className="filter-row">
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Growth ({wGrowth}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wGrowth} onChange={(e) => setWGrowth(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Yield ({wIncome}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wIncome} onChange={(e) => setWIncome(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Affordability ({wAffordability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAffordability} onChange={(e) => setWAffordability(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Risk ({wRisk}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wRisk} onChange={(e) => setWRisk(Number(e.target.value))} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>
            Results
            {backendResults && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                ({backendResults.results.length} ranked, {backendResults.excluded_count} excluded)
              </span>
            )}
          </h3>
          {backendResults && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Model: {backendResults.model_version}
            </span>
          )}
        </div>

        {backendError && (
          <div style={{ padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '10px' }}>
            {backendError} — falling back to client-side ranking
          </div>
        )}

        {backendLoading && backendResults === null && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
            Ranking suburbs...
          </div>
        )}

        {backendResults ? (
          <div className="search-results-grid">
            {backendResults.results.map((r, i) => (
              <BackendResultCard key={r.suburb_id} result={r} rank={i + 1} />
            ))}
          </div>
        ) : results.length === 0 ? (
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

const BackendResultCard = memo(function BackendResultCard({ result, rank }: { result: any; rank: number }) {
  const fitColor = result.fit_score >= 80 ? 'growth-high' : result.fit_score >= 60 ? 'growth-med' : 'growth-low';
  return (
    <div className="result-card glass-card">
      <div className="result-card-header">
        <h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '6px' }}>#{rank}</span>
          {result.name}
        </h4>
        <span className="state-badge">{result.state}</span>
      </div>
      <div className="result-card-body">
        <div className="result-meta">
          <span>Postcode: {result.postcode}</span>
          <span>{result.cbd_mins} min to CBD</span>
        </div>
        <div className="result-metrics">
          <div className="rmetric">
            <span className="rmetric-value">${result.median_price?.toLocaleString() ?? '—'}</span>
            <span className="rmetric-label">Median Price</span>
          </div>
          <div className="rmetric">
            <span className="rmetric-value">{result.rental_yield?.toFixed(1)}%</span>
            <span className="rmetric-label">Yield</span>
          </div>
          <div className="rmetric" style={{ backgroundColor: 'rgba(0, 255, 128, 0.1)', padding: '5px', borderRadius: '4px' }}>
            <span className={`rmetric-value ${fitColor}`}>{result.fit_score.toFixed(1)}</span>
            <span className="rmetric-label" style={{ color: 'var(--text-primary)' }}>Fit Score</span>
          </div>
        </div>
        {result.confidence && (
          <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Confidence: {Math.round(result.confidence * 100)}%  •  Band: {result.confidence_band?.[0]}-{result.confidence_band?.[1]}
          </div>
        )}
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            {Object.entries(result.components || {}).map(([k, v]: [string, any]) => (
              <span key={k} style={{ marginRight: '8px' }} title={`${k}: ${v.score}/100, weight: ${v.weight}%, contribution: ${v.contribution}`}>
                {k.charAt(0).toUpperCase() + k.slice(1)}: {v.contribution.toFixed(1)}
              </span>
            ))}
          </div>
        </div>
        {result.drivers?.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            {result.drivers.slice(0, 2).map((d: string, i: number) => (
              <span key={i} style={{ fontSize: '0.65rem', color: '#10b981', display: 'block' }}>+ {d}</span>
            ))}
          </div>
        )}
        {result.risks?.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            {result.risks.slice(0, 2).map((r: string, i: number) => (
              <span key={i} style={{ fontSize: '0.65rem', color: '#ef4444', display: 'block' }}>- {r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
