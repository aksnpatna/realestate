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
            <span className="u-c190f962">
              (Model: {backendResults.model_version})
            </span>
          )}
        </p>

        <div className="u-67f9100b">
          <div className="u-778b4244">Saved Profiles:</div>
          <select value={activeClientId} onChange={loadClient} className="premium-input small u-c5f10a0d">
            <option value="">-- Active Session (Unsaved) --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button onClick={saveClient} className="u-07e9b5a7">
            💾 Save Profile
          </button>
          {activeClientId && (
            <span className="u-0533d741">
              Viewing saved constraints for {clients.find(c => c.id === activeClientId)?.name}
            </span>
          )}
        </div>

        <div className="filter-grid">
          <div className="filter-section">
            <label className="control-label">Buyer Profile & Location</label>
            <div className="u-54677cc4">
              <div className="control-group u-aad9c0d9">
                <label className="control-label u-112a0d0d">State</label>
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
                  <div className="u-5403a8df">
                    <div className="u-8773684b">
                      <span className="u-7bbecc0d">🏛️</span>
                      <div>
                        <div className="u-131b2ce9">Government Grants & Stamp Duty Concessions</div>
                        <div className="u-a23e1378">Automated FHB scheme integration is currently in development.</div>
                      </div>
                    </div>
                    <span className="u-d2187ff5">Feature in Q3</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="filter-section u-2295f408">
            <div className="u-47a97aa0">
              <label className="control-label u-0c1fb0d9">Objective Weights</label>
              <span className="u-779f3813" style={{background: totalWeight > 100 ? '#ef4444' : 'rgba(16,185,129,0.2)', color: totalWeight > 100 ? '#fff' : '#10b981'}}>Total = {totalWeight}%</span>
            </div>
            <div className="filter-row">
              <div className="control-group">
                <label className="control-label u-4797caa9">Affordability ({wAffordability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAffordability} onChange={e => handleWeightChange(setWAffordability, wAffordability, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label u-4797caa9">Income ({wIncome}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wIncome} onChange={e => handleWeightChange(setWIncome, wIncome, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label u-4797caa9">Livability ({wLivability}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wLivability} onChange={e => handleWeightChange(setWLivability, wLivability, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label u-4797caa9">Access ({wAccess}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wAccess} onChange={e => handleWeightChange(setWAccess, wAccess, Number(e.target.value))} />
              </div>
              <div className="control-group">
                <label className="control-label u-4797caa9">Evidence ({wEvidence}%)</label>
                <input type="range" className="premium-range" min={0} max={100} value={wEvidence} onChange={e => handleWeightChange(setWEvidence, wEvidence, Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="filter-section u-2295f408">
            <div className="u-180d832b">
              <div>
                <strong>Using your financial profile:</strong> ${Math.round(annualIncome/1000)}k Gross Income, ${Math.round(deposit/1000)}k Deposit.
              </div>
              <button 
                onClick={() => { if(setActiveTab) setActiveTab('affordability'); }}
                className="u-349be1f5"
              >
                Edit in Price Ceiling
              </button>
              <button
                className="action-btn-outline"
                onClick={() => {
                  setBackendResults(null);
                }}
              >
                Clear Search
              </button>
            </div>
          </div>
          
          <button 
            onClick={handleSearch} 
            disabled={backendLoading}
           className="action-button primary u-d492d939">
            {backendLoading ? 'Ranking Suburbs...' : 'Calculate Buyer Fit & Search'}
          </button>
        </div>
      <div className="glass-card search-results-card">
        <div className="u-47a97aa0">
          <h3 className="u-0c1fb0d9">
            {backendResults ? `Results (${backendResults.results.length} eligible)` : 'Results'}
          </h3>
          {backendResults && backendResults.results.length > 0 && (
            <div className="u-747fe9e0">
              Others excluded for insufficient data quality or constraints
            </div>
          )}
          <button
            onClick={handleSearch}
            disabled={backendLoading}
            className="u-4689b86c" style={{cursor: backendLoading ? 'not-allowed' : 'pointer'}}
          >
            {backendLoading ? 'Ranking...' : 'Search'}
          </button>
        </div>

        {backendError && (
          <div className="u-f5a91fe3">
            <div className="u-ec8c35fd">⚠️</div>
            <div className="u-c2b3e2d1">Data Unavailable</div>
            <div className="u-3d3cb745">{backendError}</div>
            <div className="u-2246e654">
              <button onClick={handleSearch} className="u-6617684f">Retry</button>
            </div>
          </div>
        )}

        {backendLoading && backendResults === null && !backendError && (
          <div className="u-1aeb18d0">
            <div className="u-cd6224ee" />
            Ranking eligible suburbs...
          </div>
        )}

        {backendResults && backendResults.results.length === 0 && (
          <div className="u-1aeb18d0">
            <div className="u-e21f7216">🔍</div>
            <div className="u-15928e4e">No Eligible Suburbs Found</div>
            <div className="u-59dba6b0">No suburbs in {state} meet all of your current criteria.</div>
            <div className="u-0f314042">
              <div>Try one of these adjustments:</div>
              <div>• Reduce your minimum yield requirement (or set it to <em>Any</em>)</div>
              <div>• Increase your budget to access more eligible suburbs</div>
              <div>• Extend your max CBD distance to include outer suburbs</div>
              <div>• Try a different state (NSW or QLD may have more results)</div>
            </div>
          </div>
        )}
        {comparisonList.length > 0 && (
          <div className="glass-card u-b5331256">
            <div className="u-2a64d94f">
              <h3 className="u-8ca79ebe">Side-by-Side Comparison ({comparisonList.length}/5)</h3>
              <button 
                onClick={() => window.print()}
                className="u-098673da"
              >
                🖨️ Export Decision Brief (PDF)
              </button>
            </div>
            
            <div className="u-d09cc8a0">
              <table className="u-7ad7b8f2">
                <thead>
                  <tr>
                    <th className="u-26c54198">Metric</th>
                    {comparisonList.map(c => (
                      <th key={c.suburb_id} className="u-e69bb577">
                        <div className="u-4ee7fc87">{c.name}</div>
                        <div className="u-af9b3a94">{c.state} • {c.postcode}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="u-8767e76f">Buyer Fit Score</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-3658f2e4">{c.buyer_fit_score.toFixed(0)} / 100</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f">Data Confidence</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">{c.confidence_label?.toUpperCase() || 'LOW'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f">Median Price</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">${(c.affordability?.purchase_price || 0).toLocaleString()}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f"><AiMetricTooltip metricName="Rental Yield" contextStr="Comparison List">Rental Yield</AiMetricTooltip></td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">{c.components?.income?.score ? (c.components.income.score / 10).toFixed(1) + '%' : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f"><AiMetricTooltip metricName="Capital Growth" contextStr="Comparison List">12m Capital Growth</AiMetricTooltip></td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">{c.raw_metrics?.['12m_growth'] !== null && c.raw_metrics?.['12m_growth'] !== undefined ? `${c.raw_metrics['12m_growth']}%` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f"><AiMetricTooltip metricName="Vacancy Rate" contextStr="Comparison List">Vacancy Rate</AiMetricTooltip></td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">{c.raw_metrics?.vacancy_rate !== null && c.raw_metrics?.vacancy_rate !== undefined ? `${c.raw_metrics.vacancy_rate}%` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f">Active Listings</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">{c.raw_metrics?.stock_on_market !== null && c.raw_metrics?.stock_on_market !== undefined ? c.raw_metrics.stock_on_market : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f">Owner Occupier %</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-2a104b4e">{c.raw_metrics?.owner_occupier_rate !== null && c.raw_metrics?.owner_occupier_rate !== undefined ? `${c.raw_metrics.owner_occupier_rate}%` : 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-8767e76f">Top Growth Driver</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-70df3452">{c.drivers?.[0] || 'N/A'}</td>)}
                  </tr>
                  <tr>
                    <td className="u-56ec24dc">Top Risk</td>
                    {comparisonList.map(c => <td key={c.suburb_id} className="u-69907d0c">{c.risks?.[0] || 'None identified'}</td>)}
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
          <div key={i} className="u-850e21ff">✓ {d}</div>
        )) || <div className="u-c49bb1e7">No strong supports</div>}
      </div>
      <div className="bf-card__driver">
        <div className="bf-card__driver-label">Risks to verify</div>
        {result.risks?.slice(0, 2).map((r: string, i: number) => (
          <div key={i} className="u-be1aa47b">⚠ {r}</div>
        )) || <div className="u-c49bb1e7">No major risks</div>}
      </div>

      <div className="bf-card__actions">
        <label className={`bf-card__action bf-card__action--compare ${isCompared ? 'bf-card__action--compare--active' : ''}`}>
          <input type="checkbox" checked={isCompared} onChange={toggleCompare} className="u-6860a898" />
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
        <div className="u-92e1eb31">
          <div><strong>Evidence ID:</strong> {result.evidence_ids?.[0] || 'N/A'}</div>
          {result.affordability?.assumptions && (
            <div className="u-1ce527f1">
              <strong>Assumptions:</strong> Rate {(result.affordability.assumptions.interest_rate * 100).toFixed(1)}%, Buffer +{(result.affordability.assumptions.serviceability_buffer * 100).toFixed(0)}%, {result.affordability.assumptions.loan_term_years}yr, {(result.affordability.assumptions.purchase_cost_allowance_pct * 100).toFixed(0)}% costs
            </div>
          )}
          <div className="u-1ce527f1"><strong>Serviceability:</strong> Loan ${aff.required_loan?.toLocaleString()} vs Capacity ${aff.estimated_borrowing_capacity?.toLocaleString()}</div>
          <div className="u-1ce527f1">
            <strong>Weights:</strong> {Object.entries(result.components || {}).map(([k, v]: [string, any]) => (
              <span key={k} className="u-478d8a29">{k}: {v.score.toFixed(0)} (×{v.weight}%)</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});