import { useState, useEffect, useCallback, memo } from 'react';
import type { SuburbData } from '../data/suburbs';

interface BuyFinderResponse {
  model_version: string
  request_id: string
  dq_threshold: number
  results: any[]
  excluded_count: number
  excluded: any[]
  total_evaluated: number
}

export default memo(function BuyFinder({ }: { suburbsData: SuburbData[] }) {
  const [backendResults, setBackendResults] = useState<BuyFinderResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [state, setState] = useState('VIC');
  const [budget, setBudget] = useState(850000);
  const [deposit, setDeposit] = useState(170000);
  const [propertyType, setPropertyType] = useState('house');
  const [maxCBDMinutes, setMaxCBDMinutes] = useState(60);
  const [minimumYield, setMinimumYield] = useState<number | null>(null);

  const [wAffordability, setWAffordability] = useState(30);
  const [wIncome, setWIncome] = useState(25);
  const [wLivability, setWLivability] = useState(20);
  const [wAccess, setWAccess] = useState(15);
  const [wEvidence, setWEvidence] = useState(10);

  const fetchRanking = useCallback(async () => {
    setBackendLoading(true);
    setBackendError(null);
    try {
      const res = await fetch('/api/buy-finder/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_profile: 'first_home_buyer',
          state,
          budget,
          deposit,
          property_type: propertyType,
          maximum_cbd_minutes: maxCBDMinutes,
          minimum_yield: minimumYield,
          weights: {
            affordability: wAffordability,
            income: wIncome,
            livability: wLivability,
            access: wAccess,
            evidence: wEvidence,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBackendResults(data);
      } else {
        setBackendError(`Server error (${res.status}) — try again`);
      }
    } catch (e: any) {
      setBackendError(e.message || 'Network error — check backend connectivity');
    } finally {
      setBackendLoading(false);
    }
  }, [state, budget, deposit, propertyType, maxCBDMinutes, minimumYield, wAffordability, wIncome, wLivability, wAccess, wEvidence]);

  useEffect(() => {
    const timer = setTimeout(() => fetchRanking(), 300);
    return () => clearTimeout(timer);
  }, [fetchRanking]);

  const handleSearch = () => fetchRanking();

  const states = ['VIC', 'NSW', 'QLD', 'SA', 'TAS'];

  return (
    <div className="search-container">
      <div className="glass-card search-card">
        <h2 className="detail-title">Buy Finder</h2>
        <p className="subtitle">
          Backend-ranked buyer-fit tool. Results are deterministically scored from the server.
          {backendResults && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
              (Model: {backendResults.model_version}, DQ threshold: {backendResults.dq_threshold})
            </span>
          )}
        </p>

        <div className="filter-grid">
          <div className="filter-section">
            <label className="control-label">Buyer Profile & Location</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <div className="control-group" style={{ flex: '1 1 150px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>State</label>
                <select className="premium-input small" value={state} onChange={e => setState(e.target.value)}>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="control-group" style={{ flex: '1 1 150px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Budget ($)</label>
                <input type="number" className="premium-input small" value={budget} onChange={e => setBudget(Number(e.target.value))} min={100000} step={50000} />
              </div>
              <div className="control-group" style={{ flex: '1 1 150px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Deposit ($)</label>
                <input type="number" className="premium-input small" value={deposit} onChange={e => setDeposit(Number(e.target.value))} min={20000} step={10000} />
              </div>
              <div className="control-group" style={{ flex: '1 1 120px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Property Type</label>
                <select className="premium-input small" value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                  <option value="house">House</option>
                  <option value="unit">Unit</option>
                </select>
              </div>
              <div className="control-group" style={{ flex: '1 1 120px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Max CBD (min)</label>
                <input type="number" className="premium-input small" value={maxCBDMinutes} onChange={e => setMaxCBDMinutes(Number(e.target.value))} min={5} max={180} />
              </div>
              <div className="control-group" style={{ flex: '1 1 120px' }}>
                <label className="control-label" style={{ fontSize: '0.7rem' }}>Min Yield %</label>
                <select className="premium-input small" value={minimumYield ?? ''} onChange={e => setMinimumYield(e.target.value ? Number(e.target.value) : null)} style={{ width: '80px' }}>
                  <option value="">Any</option>
                  <option value="2">2%</option>
                  <option value="3">3%</option>
                  <option value="4">4%</option>
                  <option value="5">5%</option>
                </select>
              </div>
            </div>
          </div>

          <div className="filter-section" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <label className="control-label">Objective Weights</label>
            <div className="filter-row">
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Affordability ({wAffordability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAffordability} onChange={e => setWAffordability(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Income ({wIncome}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wIncome} onChange={e => setWIncome(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Livability ({wLivability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wLivability} onChange={e => setWLivability(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Access ({wAccess}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAccess} onChange={e => setWAccess(Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Evidence ({wEvidence}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wEvidence} onChange={e => setWEvidence(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card search-results-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>
            {backendResults ? `Results (${backendResults.results.length} eligible${backendResults.excluded_count > 0 ? `, ${backendResults.excluded_count} excluded` : ''})` : 'Results'}
          </h3>
          <button
            onClick={handleSearch}
            disabled={backendLoading}
            style={{ padding: '8px 16px', background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: '6px', cursor: backendLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
          >
            {backendLoading ? 'Ranking...' : 'Search'}
          </button>
        </div>

        {backendError && (
          <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '15px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px', textAlign: 'center' }}>⚠️</div>
            <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '4px', textAlign: 'center' }}>Data Unavailable</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>{backendError}</div>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button onClick={handleSearch} style={{ padding: '6px 12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Retry</button>
            </div>
          </div>
        )}

        {backendLoading && backendResults === null && !backendError && (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-glass)', borderTopColor: 'var(--accent-cyan)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Ranking eligible suburbs (DQ &ge; 80)...
          </div>
        )}

        {backendResults && backendResults.results.length === 0 && (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>No Eligible Suburbs</div>
            <div style={{ fontSize: '0.85rem' }}>No suburbs in {state} meet the current DQ threshold ({backendResults.dq_threshold}) and buyer constraints. Try a different state or lower your constraints.</div>
          </div>
        )}

        {backendResults && backendResults.results.length > 0 && (
          <div className="search-results-grid">
            {backendResults.results.map((r: any) => (
              <BackendResultCard key={r.suburb_id} result={r} />
            ))}
          </div>
        )}

        {backendResults && backendResults.excluded.length > 0 && (
          <details style={{ marginTop: '15px', padding: '10px', background: 'rgba(234,179,8,0.05)', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.15)' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#eab308', fontWeight: 600 }}>
              {backendResults.excluded_count} suburb(s) excluded (click to view)
            </summary>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {backendResults.excluded.map((e: any) => (
                <div key={e.suburb_id} style={{ padding: '4px 0' }}>
                  {e.name}: {e.reason}
                </div>
              ))}
              {backendResults.excluded_count > backendResults.excluded.length && (
                <div style={{ padding: '4px 0', color: 'var(--text-muted)' }}>
                  ... and {backendResults.excluded_count - backendResults.excluded.length} more
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
})

const BackendResultCard = memo(function BackendResultCard({ result }: { result: any }) {
  const fitColor = result.buyer_fit_score >= 70 ? 'growth-high' : result.buyer_fit_score >= 50 ? 'growth-med' : 'growth-low';
  const confColor = result.confidence_label === 'high' ? '#10b981' : result.confidence_label === 'medium' ? '#eab308' : '#ef4444';

  return (
    <div className="result-card glass-card">
      <div className="result-card-header">
        <h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '6px' }}>#{result.rank}</span>
          {result.name}
        </h4>
        <span className="state-badge">{result.state}</span>
      </div>
      <div className="result-card-body">
        <div className="result-meta">
          <span>Postcode: {result.postcode}</span>
          <span>Eligibility: {result.eligibility}</span>
        </div>
        <div className="result-metrics">
          <div className="rmetric">
            <span className="rmetric-value">{(result.components?.affordability?.score ?? 0).toFixed(0)}</span>
            <span className="rmetric-label">Affordability</span>
          </div>
          <div className="rmetric">
            <span className="rmetric-value">{(result.components?.income?.score ?? 0).toFixed(0)}</span>
            <span className="rmetric-label">Income</span>
          </div>
          <div className="rmetric" style={{ backgroundColor: 'rgba(0, 255, 128, 0.1)', padding: '5px', borderRadius: '4px' }}>
            <span className={`rmetric-value ${fitColor}`}>{result.buyer_fit_score.toFixed(1)}</span>
            <span className="rmetric-label" style={{ color: 'var(--text-primary)' }}>Buyer Fit</span>
          </div>
        </div>
        {result.confidence_label && (
          <div style={{ marginTop: '6px', fontSize: '0.7rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Evidence:</span>
            <span style={{ color: confColor, fontWeight: 600 }}>{result.confidence_label.toUpperCase()}</span>
            <span style={{ color: 'var(--text-secondary)' }}>({result.components?.evidence?.score?.toFixed(0)}/100)</span>
          </div>
        )}
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(result.components || {}).map(([k, v]: [string, any]) => (
              <span key={k} title={`${k}: ${v.score}/100 x ${v.weight}% = ${v.contribution}`}>
                {k}: {v.contribution.toFixed(1)}
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
        {result.unknowns?.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
            Unknown: {result.unknowns.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
});