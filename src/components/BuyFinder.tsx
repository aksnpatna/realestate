import { useState, useEffect, useCallback, memo } from 'react';
import type { SuburbData } from '../data/suburbs';
import type { BuyerFitResult } from '../data/buyerFitTypes';

interface BuyFinderLocalResponse {
  model_version: string
  request_id: string
  dq_threshold: number
  results: any[]
  excluded_count: number
  excluded: any[]
  total_evaluated: number
}

export default memo(function BuyFinder({ setActiveSuburb, setActiveTab, onSelectResult, financialProfile, setFinancialProfile }: { suburbsData?: SuburbData[]; setActiveSuburb?: (s: SuburbData) => void; setActiveTab?: (t: string) => void; onSelectResult?: (result: BuyerFitResult, requestMeta: { request_id: string; model_version: string }) => void; financialProfile?: any; setFinancialProfile?: any }) {
  const [backendResults, setBackendResults] = useState<BuyFinderLocalResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [state, setState] = useState('VIC');
  const budget = financialProfile?.budget ?? 850000;
  const deposit = financialProfile?.deposit ?? 170000;
  const annualIncome = financialProfile?.annualIncome ?? 150000;
  const monthlyDebt = financialProfile?.monthlyDebt ?? 0;
  const propertyType = financialProfile?.propertyType ?? 'house';
  const maxCBDMinutes = financialProfile?.maxCBDMinutes ?? 60;
  const minimumYield = financialProfile?.minimumYield ?? null;

  const interestRate = financialProfile?.interestRate ?? 6.2;
  const serviceabilityBuffer = financialProfile?.serviceabilityBuffer ?? 3.0;
  const loanTermYears = financialProfile?.loanTermYears ?? 30;
  const purchaseCostAllowance = financialProfile?.purchaseCostAllowance ?? 5.0;

  const updateProfile = (key: string, value: any) => {
    if (setFinancialProfile) {
      setFinancialProfile((prev: any) => ({ ...prev, [key]: value }));
    }
  };

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
          annual_income: annualIncome,
          existing_monthly_debt: monthlyDebt,
          interest_rate: interestRate / 100,
          serviceability_buffer: serviceabilityBuffer / 100,
          loan_term_years: loanTermYears,
          purchase_cost_allowance: purchaseCostAllowance / 100,
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
  }, [state, budget, deposit, annualIncome, monthlyDebt, propertyType, maxCBDMinutes, minimumYield, interestRate, serviceabilityBuffer, loanTermYears, purchaseCostAllowance, wAffordability, wIncome, wLivability, wAccess, wEvidence]);

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
              (Model: {backendResults.model_version})
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
              <div className="control-group">
                <label className="control-label">Budget ($)</label>
                <input type="number" className="premium-input" value={budget} onChange={e => updateProfile('budget', Number(e.target.value))} min={100000} step={10000} />
              </div>
              <div className="control-group">
                <label className="control-label">Deposit ($)</label>
                <input type="number" className="premium-input" value={deposit} onChange={e => updateProfile('deposit', Number(e.target.value))} min={10000} step={10000} />
              </div>
              <div className="control-group">
                <label className="control-label">Property Type</label>
                <select className="premium-input" value={propertyType} onChange={e => updateProfile('propertyType', e.target.value)}>
                  <option value="house">House</option>
                  <option value="unit">Unit</option>
                  <option value="any">Any</option>
                </select>
              </div>
              <div className="control-group">
                <label className="control-label">Max CBD (min)</label>
                <input type="number" className="premium-input" value={maxCBDMinutes} onChange={e => updateProfile('maxCBDMinutes', Number(e.target.value))} min={10} step={5} />
              </div>
              <div className="control-group">
                <label className="control-label">Min Yield %</label>
                <select className="premium-input" value={minimumYield ?? ''} onChange={e => updateProfile('minimumYield', e.target.value === '' ? null : Number(e.target.value))}>
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
          <div className="filter-section" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ background: 'rgba(14,165,233,0.08)', color: 'var(--accent-cyan)', padding: '10px 15px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Using your financial profile:</strong> ${Math.round(annualIncome/1000)}k Gross Income, ${Math.round(deposit/1000)}k Deposit.
              </div>
              <button 
                onClick={() => { if(setActiveTab) setActiveTab('affordability'); }}
                style={{ background: 'transparent', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Edit in Price Ceiling
              </button>
            </div>
          </div>
        </div>
      <div className="glass-card search-results-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>
            {backendResults ? `Results (${backendResults.results.length} eligible)` : 'Results'}
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
            Ranking eligible suburbs...
          </div>
        )}

        {backendResults && backendResults.results.length === 0 && (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>No Eligible Suburbs</div>
            <div style={{ fontSize: '0.85rem' }}>No suburbs in {state} meet the current eligibility criteria and your stated constraints. Try a different state or adjust your assumptions.</div>
          </div>
        )}

        {backendResults && backendResults.results.length > 0 && (
          <div className="search-results-grid">
            {backendResults.results.map((r: any) => (
              <BackendResultCard key={r.suburb_id} result={r} setActiveSuburb={setActiveSuburb} setActiveTab={setActiveTab} onSelectResult={onSelectResult} requestMeta={{ request_id: backendResults.request_id, model_version: backendResults.model_version }} />
            ))}
          </div>
        )}


      </div>
    </div>
  </div>
  );
})

const BackendResultCard = memo(function BackendResultCard({ result, setActiveSuburb, setActiveTab, onSelectResult, requestMeta }: { result: any; setActiveSuburb?: (s: any) => void; setActiveTab?: (t: string) => void; onSelectResult?: (result: BuyerFitResult, meta: { request_id: string; model_version: string }) => void; requestMeta?: { request_id: string; model_version: string } }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const confColor = result.confidence_label === 'high' ? '#10b981' : result.confidence_label === 'medium' ? '#eab308' : '#ef4444';
  const evidenceLabel = result.confidence_label || 'low';
  const aff = result.affordability || {};
  const serviceabilityPassed = aff.serviceability_passed !== undefined ? aff.serviceability_passed : true;

  const handleOpenSuburb = () => {
    if (onSelectResult && requestMeta) {
      onSelectResult(result as BuyerFitResult, requestMeta)
    }
    if (setActiveSuburb) {
      setActiveSuburb({
        id: result.suburb_id?.toLowerCase(),
        name: result.name,
        state: result.state,
        postcode: result.postcode,
        growthScore: result.buyer_fit_score,
        metrics: {
          medianPrice: aff.purchase_price,
          rentalYield: result.components?.income?.score ? (result.components.income.score / 10) : undefined,
        },
      } as any)
    }
    if (setActiveTab) setActiveTab('profile')
  }

  return (
    <div className="result-card glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '0' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
          <span style={{ color: 'var(--text-secondary)', marginRight: '8px', fontSize: '0.9rem' }}>#{result.rank}</span>
          {result.name}, {result.state}
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, background: serviceabilityPassed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: serviceabilityPassed ? '#10b981' : '#ef4444', border: `1px solid ${serviceabilityPassed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            {serviceabilityPassed ? '✓ Serviceability Passed' : '✗ Serviceability Failed'}
          </div>
          <div style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: confColor, border: '1px solid rgba(255,255,255,0.1)' }}>
            📊 Evidence: {evidenceLabel.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Body Area */}
      <div style={{ padding: '20px', display: 'flex', gap: '20px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,165,233,0.05)', padding: '15px', borderRadius: '12px', minWidth: '90px', border: '1px solid rgba(14,165,233,0.1)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>{result.buyer_fit_score.toFixed(0)}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px', fontWeight: 600 }}>Buyer Fit</div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Top Supports</div>
              {result.drivers?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {result.drivers.slice(0, 3).map((d: string, i: number) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#10b981', marginTop: '1px' }}>✓</span> {d}
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No strong supports</div>}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Risks to Verify</div>
              {result.risks?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {result.risks.slice(0, 2).map((r: string, i: number) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#ef4444', marginTop: '1px' }}>⚠️</span> {r}
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No major risks identified</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Area */}
      <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setShowEvidence(!showEvidence)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}>
          {showEvidence ? 'Hide Model Evidence' : 'Inspect Model Evidence'}
        </button>
        <button onClick={handleOpenSuburb} style={{ padding: '8px 20px', background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}>
          Open Decision Brief →
        </button>
      </div>

      {showEvidence && (
        <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
          <div><strong>Evidence ID:</strong> {result.evidence_ids?.[0] || 'N/A'}</div>
          {result.affordability?.assumptions && (
            <div style={{ marginTop: '6px' }}>
              <strong>Assumptions used:</strong> Rate {(result.affordability.assumptions.interest_rate * 100).toFixed(1)}%, Buffer +{(result.affordability.assumptions.serviceability_buffer * 100).toFixed(0)}%, {result.affordability.assumptions.loan_term_years}yr term, {(result.affordability.assumptions.purchase_cost_allowance_pct * 100).toFixed(0)}% costs
            </div>
          )}
          <div style={{ marginTop: '6px' }}><strong>Serviceability math:</strong> Loan required ${aff.required_loan?.toLocaleString()} vs Bank borrowing capacity ${aff.estimated_borrowing_capacity?.toLocaleString()}</div>
          <div style={{ marginTop: '6px' }}>
            <strong>Component score weights:</strong> {Object.entries(result.components || {}).map(([k, v]: [string, any]) => (
              <span key={k} style={{ marginRight: '12px' }}>{k}: {v.score.toFixed(0)} (x{v.weight}%)</span>
            ))}
          </div>
          <div style={{ marginTop: '6px' }}><strong>Unknown variables:</strong> {(result.unknowns || []).join(', ') || 'None'}</div>
        </div>
      )}
    </div>
  );
});