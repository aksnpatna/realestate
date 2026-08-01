import { useState, useEffect, useCallback, memo } from 'react';
import type { SuburbData } from '../data/suburbs';
import type { BuyerFitResult } from '../data/buyerFitTypes';
import { getPersona, type PersonaId } from '../data/personas';
import AiMetricTooltip from './AiMetricTooltip';
import './BuyFinder.css';

interface BuyFinderLocalResponse {
  model_version: string
  request_id: string
  dq_threshold: number
  results: any[]
  excluded_count: number
  excluded: any[]
  total_evaluated: number
}

export default memo(function BuyFinder({ setActiveSuburb, setActiveTab, onSelectResult, financialProfile, setFinancialProfile, persona }: { suburbsData?: SuburbData[]; setActiveSuburb?: (s: SuburbData) => void; setActiveTab?: (t: string) => void; onSelectResult?: (result: BuyerFitResult, requestMeta: { request_id: string; model_version: string }) => void; financialProfile?: any; setFinancialProfile?: any; persona?: string }) {
  const [backendResults, setBackendResults] = useState<BuyFinderLocalResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const state = financialProfile?.state ?? 'VIC';
  const setState = (s: string) => updateProfile('state', s);
  const budget = financialProfile?.budget ?? 500000;
  const deposit = financialProfile?.deposit ?? 100000;
  const annualIncome = financialProfile?.annualIncome ?? 80000;
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

  const [wAffordability, setWAffordability] = useState(() => Number(localStorage.getItem('wAffordability') || 30));
  const [wIncome, setWIncome] = useState(() => Number(localStorage.getItem('wIncome') || 25));
  const [wLivability, setWLivability] = useState(() => Number(localStorage.getItem('wLivability') || 20));
  const [wAccess, setWAccess] = useState(() => Number(localStorage.getItem('wAccess') || 15));
  const [wEvidence, setWEvidence] = useState(() => Number(localStorage.getItem('wEvidence') || 10));

  useEffect(() => {
    localStorage.setItem('wAffordability', wAffordability.toString());
    localStorage.setItem('wIncome', wIncome.toString());
    localStorage.setItem('wLivability', wLivability.toString());
    localStorage.setItem('wAccess', wAccess.toString());
    localStorage.setItem('wEvidence', wEvidence.toString());
  }, [wAffordability, wIncome, wLivability, wAccess, wEvidence]);

  // Sync weights when persona changes
  useEffect(() => {
    if (persona) {
      const p = getPersona(persona as PersonaId);
      if (p && p.weights) {
        setWAffordability(p.weights.affordability);
        setWIncome(p.weights.income);
        setWLivability(p.weights.livability);
        setWAccess(p.weights.access);
        setWEvidence(p.weights.evidence);
      }
    }
  }, [persona]);

  const activePersonaObj = getPersona(persona as PersonaId);
  const isInvestor = activePersonaObj.id === 'investor';
  const isFHB = activePersonaObj.id === 'first_home_buyer';


  const totalWeight = wAffordability + wIncome + wLivability + wAccess + wEvidence;

  const handleWeightChange = (setter: React.Dispatch<React.SetStateAction<number>>, currentVal: number, newVal: number) => {
    const othersTotal = totalWeight - currentVal;
    const maxAllowed = 100 - othersTotal;
    setter(Math.min(newVal, maxAllowed));
  };

  const [comparisonList, setComparisonList] = useState<any[]>([]);

  const toggleCompare = useCallback((result: any) => {
    setComparisonList(prev => {
      const exists = prev.find(p => p.suburb_id === result.suburb_id);
      if (exists) return prev.filter(p => p.suburb_id !== result.suburb_id);
      if (prev.length >= 5) {
        alert("You can compare up to 5 suburbs side-by-side.");
        return prev;
      }
      return [...prev, result];
    });
  }, []);

  // Buyers Agent Client Management
  const [clients, setClients] = useState<any[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');

  useEffect(() => {
    fetch('/api/clients', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(console.error);
  }, []);

  const saveClient = async () => {
    const clientName = prompt("Enter client name (e.g. 'John & Jane - FHB'):");
    if (!clientName) return;
    
    const profile = { state, budget, deposit, annualIncome, monthlyDebt, propertyType, maxCBDMinutes, minimumYield };
    
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: clientName, profile })
      });
      if (res.ok) {
        const data = await res.json();
        const newClient = { id: data.id, name: clientName, profile };
        setClients(prev => [...prev, newClient]);
        setActiveClientId(data.id);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save client to server.");
    }
  };

  const loadClient = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setActiveClientId(id);
    if (!id) return;
    
    const client = clients.find(c => c.id === id);
    if (client) {
      setState(client.profile.state);
      updateProfile('budget', client.profile.budget);
      updateProfile('deposit', client.profile.deposit);
      updateProfile('annualIncome', client.profile.annualIncome);
      updateProfile('monthlyDebt', client.profile.monthlyDebt);
      updateProfile('propertyType', client.profile.propertyType);
      updateProfile('maxCBDMinutes', client.profile.maxCBDMinutes);
      updateProfile('minimumYield', client.profile.minimumYield);
    }
  };

  const fetchRanking = useCallback(async () => {
    setBackendLoading(true);
    setBackendError(null);
    try {
      const res = await fetch('/api/buy-finder/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          buyer_profile: persona || 'first_home_buyer',
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

  // Search is explicit, no debounce auto-trigger

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

        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>Saved Profiles:</div>
          <select className="premium-input small" value={activeClientId} onChange={loadClient} style={{ maxWidth: '250px' }}>
            <option value="">-- Active Session (Unsaved) --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={saveClient} style={{ padding: '6px 12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
            💾 Save Profile
          </button>
          {activeClientId && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Viewing saved constraints for {clients.find(c => c.id === activeClientId)?.name}
            </span>
          )}
        </div>

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
              
              {/* Investor specific fields */}
              {isInvestor && (
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
              )}

              {/* FHB specific fields (UI only for now, pending backend model support) */}
              {isFHB && (
                <>
                  <div style={{ gridColumn: '1 / -1', padding: '16px', background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏛️</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d97706' }}>Government Grants & Stamp Duty Concessions</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Automated FHB scheme integration is currently in development.</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', background: '#d97706', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>Feature in Q3</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="filter-section" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label className="control-label" style={{ margin: 0 }}>Objective Weights</label>
              <span style={{ fontSize: '0.8rem', background: totalWeight > 100 ? '#ef4444' : 'rgba(16,185,129,0.2)', color: totalWeight > 100 ? '#fff' : '#10b981', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>Total = {totalWeight}%</span>
            </div>
            <div className="filter-row">
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Affordability ({wAffordability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAffordability} onChange={e => handleWeightChange(setWAffordability, wAffordability, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Income ({wIncome}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wIncome} onChange={e => handleWeightChange(setWIncome, wIncome, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Livability ({wLivability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wLivability} onChange={e => handleWeightChange(setWLivability, wLivability, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Access ({wAccess}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAccess} onChange={e => handleWeightChange(setWAccess, wAccess, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label" style={{ fontSize: '0.75rem' }}>Evidence ({wEvidence}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wEvidence} onChange={e => handleWeightChange(setWEvidence, wEvidence, Number(e.target.value))} />
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
          
          <button 
            className="action-button primary" 
            onClick={handleSearch} 
            disabled={backendLoading}
            style={{ width: '100%', marginTop: '20px', padding: '14px', fontSize: '1rem' }}
          >
            {backendLoading ? 'Ranking Suburbs...' : 'Calculate Buyer Fit & Search'}
          </button>
        </div>
      <div className="glass-card search-results-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0 }}>
            {backendResults ? `Results (${backendResults.results.length} eligible)` : 'Results'}
          </h3>
          {backendResults && backendResults.results.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              Others excluded for insufficient data quality or constraints
            </div>
          )}
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
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>No Eligible Suburbs Found</div>
            <div style={{ fontSize: '0.85rem', marginBottom: '12px' }}>No suburbs in {state} meet all of your current criteria.</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'left', maxWidth: '380px', margin: '0 auto', lineHeight: 1.7 }}>
              <div>Try one of these adjustments:</div>
              <div>• Reduce your minimum yield requirement (or set it to <em>Any</em>)</div>
              <div>• Increase your budget to access more eligible suburbs</div>
              <div>• Extend your max CBD distance to include outer suburbs</div>
              <div>• Try a different state (NSW or QLD may have more results)</div>
            </div>
          </div>
        )}
        {comparisonList.length > 0 && (
          <div className="glass-card" style={{ marginBottom: '20px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>Side-by-Side Comparison ({comparisonList.length}/5)</h3>
              <button 
                onClick={() => window.print()}
                style={{ padding: '6px 12px', background: 'var(--bg-glass)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              >
                🖨️ Export Decision Brief (PDF)
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Metric</th>
                    {comparisonList.map(c => (
                      <th key={c.suburb_id} style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', minWidth: '150px' }}>
                        <div style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.state} • {c.postcode}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Buyer Fit Score</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{c.buyer_fit_score.toFixed(0)} / 100</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Data Confidence</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.confidence_label?.toUpperCase() || 'LOW'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Median Price</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>${(c.affordability?.purchase_price || 0).toLocaleString()}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}><AiMetricTooltip metricName="Rental Yield" contextStr="Comparison List">Rental Yield</AiMetricTooltip></td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.components?.income?.score ? (c.components.income.score / 10).toFixed(1) + '%' : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}><AiMetricTooltip metricName="Capital Growth" contextStr="Comparison List">12m Capital Growth</AiMetricTooltip></td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.raw_metrics?.['12m_growth'] !== null && c.raw_metrics?.['12m_growth'] !== undefined ? `${c.raw_metrics['12m_growth']}%` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}><AiMetricTooltip metricName="Vacancy Rate" contextStr="Comparison List">Vacancy Rate</AiMetricTooltip></td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.raw_metrics?.vacancy_rate !== null && c.raw_metrics?.vacancy_rate !== undefined ? `${c.raw_metrics.vacancy_rate}%` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Active Listings</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.raw_metrics?.stock_on_market !== null && c.raw_metrics?.stock_on_market !== undefined ? c.raw_metrics.stock_on_market : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Owner Occupier %</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{c.raw_metrics?.owner_occupier_rate !== null && c.raw_metrics?.owner_occupier_rate !== undefined ? `${c.raw_metrics.owner_occupier_rate}%` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>Top Growth Driver</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>{c.drivers?.[0] || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Top Risk</td>
                    {comparisonList.map(c => <td key={c.suburb_id} style={{ padding: '10px', fontSize: '0.75rem', color: '#ef4444' }}>{c.risks?.[0] || 'None identified'}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {backendResults && backendResults.results.length > 0 && (
          <div className="search-results-grid">
            {backendResults.results.map((r: any) => (
              <BackendResultCard 
                key={r.suburb_id} 
                result={r} 
                setActiveSuburb={setActiveSuburb} 
                setActiveTab={setActiveTab} 
                onSelectResult={onSelectResult} 
                requestMeta={{ request_id: backendResults.request_id, model_version: backendResults.model_version }} 
                isCompared={comparisonList.some(c => c.suburb_id === r.suburb_id)}
                toggleCompare={() => toggleCompare(r)}
              />
            ))}
          </div>
        )}


      </div>
    </div>
  </div>
  );
})

const BackendResultCard = memo(function BackendResultCard({ 
  result, setActiveSuburb, setActiveTab, onSelectResult, requestMeta, isCompared, toggleCompare 
}: { 
  result: any; 
  setActiveSuburb?: (s: any) => void; 
  setActiveTab?: (t: string) => void; 
  onSelectResult?: (result: BuyerFitResult, meta: { request_id: string; model_version: string }) => void; 
  requestMeta?: { request_id: string; model_version: string };
  isCompared?: boolean;
  toggleCompare?: () => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const confClass = result.confidence_label === 'high' ? 'bf-card__score-val--high' : result.confidence_label === 'medium' ? 'bf-card__score-val--mid' : 'bf-card__score-val--low';
  const evidenceLabel = result.confidence_label || 'low';
  const aff = result.affordability || {};
  const serviceabilityPassed = aff.serviceability_passed !== undefined ? aff.serviceability_passed : true;
  const rankClass = result.rank <= 1 ? 'bf-card__rank--gold' : result.rank <= 2 ? 'bf-card__rank--silver' : result.rank <= 3 ? 'bf-card__rank--bronze' : 'bf-card__rank--default';

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
    <div className="bf-card">
      <div className="bf-card__header">
        <div>
          <div className={`bf-card__rank ${rankClass}`}>#{result.rank}</div>
          <div className="bf-card__name" onClick={handleOpenSuburb} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleOpenSuburb(); }}>
            {result.name}, {result.state}
          </div>
          <div className="bf-card__meta">{result.postcode}</div>
        </div>
        <div className="bf-card__score">
          <div className={`bf-card__score-val ${confClass}`}>{result.buyer_fit_score.toFixed(0)}</div>
          <div className="bf-card__score-label">Buyer Fit</div>
        </div>
      </div>

      <div className="bf-card__metrics">
        <div className={`bf-card__metric ${serviceabilityPassed ? 'bf-card__metric--pass' : 'bf-card__metric--fail'}`}>
          <div className="bf-card__metric-label">Serviceability</div>
          <div className="bf-card__metric-val">{serviceabilityPassed ? 'Pass' : 'Fail'}</div>
        </div>
        <div className="bf-card__metric">
          <div className="bf-card__metric-label">Evidence</div>
          <div className="bf-card__metric-val">{evidenceLabel.toUpperCase()}</div>
        </div>
        {aff.purchase_price != null && (
          <div className="bf-card__metric">
            <div className="bf-card__metric-label">Est. Purchase</div>
            <div className="bf-card__metric-val">${(aff.purchase_price / 1000).toFixed(0)}k</div>
          </div>
        )}
        {aff.borrowing_capacity != null && (
          <div className="bf-card__metric">
            <div className="bf-card__metric-label">Borrowing</div>
            <div className="bf-card__metric-val">${(aff.borrowing_capacity / 1000).toFixed(0)}k</div>
          </div>
        )}
      </div>

      <div className="bf-card__driver">
        <div className="bf-card__driver-label">What supports this</div>
        {result.drivers?.slice(0, 2).map((d: string, i: number) => (
          <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)', padding: '2px 0' }}>✓ {d}</div>
        )) || <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>No strong supports</div>}
      </div>
      <div className="bf-card__driver">
        <div className="bf-card__driver-label">Risks to verify</div>
        {result.risks?.slice(0, 2).map((r: string, i: number) => (
          <div key={i} style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>⚠ {r}</div>
        )) || <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>No major risks</div>}
      </div>

      <div className="bf-card__actions">
        <label className={`bf-card__action bf-card__action--compare ${isCompared ? 'bf-card__action--compare--active' : ''}`}>
          <input type="checkbox" checked={isCompared} onChange={toggleCompare} style={{ marginRight: 4 }} />
          Compare
        </label>
        <button onClick={() => setShowEvidence(!showEvidence)} className="bf-card__action">
          {showEvidence ? 'Hide evidence' : 'Inspect evidence'}
        </button>
        <button onClick={handleOpenSuburb} className="bf-card__action bf-card__action--primary">
          Decision Brief →
        </button>
      </div>

      {showEvidence && (
        <div style={{ padding: '15px 20px', background: 'var(--bg-surface-sunken)', borderTop: '1px solid var(--border-1)', fontSize: '0.7rem', color: 'var(--text-2)' }}>
          <div><strong>Evidence ID:</strong> {result.evidence_ids?.[0] || 'N/A'}</div>
          {result.affordability?.assumptions && (
            <div style={{ marginTop: '6px' }}>
              <strong>Assumptions:</strong> Rate {(result.affordability.assumptions.interest_rate * 100).toFixed(1)}%, Buffer +{(result.affordability.assumptions.serviceability_buffer * 100).toFixed(0)}%, {result.affordability.assumptions.loan_term_years}yr, {(result.affordability.assumptions.purchase_cost_allowance_pct * 100).toFixed(0)}% costs
            </div>
          )}
          <div style={{ marginTop: '6px' }}><strong>Serviceability:</strong> Loan ${aff.required_loan?.toLocaleString()} vs Capacity ${aff.estimated_borrowing_capacity?.toLocaleString()}</div>
          <div style={{ marginTop: '6px' }}>
            <strong>Weights:</strong> {Object.entries(result.components || {}).map(([k, v]: [string, any]) => (
              <span key={k} style={{ marginRight: '12px' }}>{k}: {v.score.toFixed(0)} (×{v.weight}%)</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});