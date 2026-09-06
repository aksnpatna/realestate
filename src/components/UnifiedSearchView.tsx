import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import type { SuburbData } from '../data/suburbs';

import { getPersona, type PersonaId } from '../data/personas';
import { ComparisonDisplay } from './ask/ComparisonDisplay';
import { BriefSkeleton } from './ui/Skeleton';
import './BuyFinder.css';

// ─── Reused Ask Types ────────────────────────────────────────────────────────
interface DiscoveryResponse {
  guardrail: boolean;
  message?: string | null;
  summary?: string | null;
  query_understood: any;
  results: any[];
  disclaimer: string;
}
interface AskResponseV2 {
  request_id: string;
  status: string;
  intent: any;
  headline?: string;
  verdict?: any;
  summary: string;
  research_priority: string;
  comparison: any[];
  supports: any[];
  risks: any[];
  unknowns: string[];
  next_steps: string[];
  evidence: any[];
  data_quality: any;
  disclaimer: string;
  discovery?: DiscoveryResponse | null;
  follow_ups?: {label:string;question:string;conversation_id?:string}[];
  query_understood?: any;
}

// ─── BuyFinder Types ───────────────────────────────────────────────────────
interface BuyFinderLocalResponse {
  model_version: string
  request_id: string
  dq_threshold: number
  results: any[]
  excluded_count: number
  excluded: any[]
  total_evaluated: number
}

// Helper formatting functions

export default memo(function UnifiedSearchView({ 
  setActiveSuburb, setActiveTab, onSelectResult, financialProfile, setFinancialProfile, persona 
}: { 
  suburbsData?: SuburbData[]; 
  setActiveSuburb?: (s: SuburbData) => void; 
  setActiveTab?: (t: string) => void; 
  onSelectResult?: (result: any, meta: any) => void; 
  financialProfile?: any; 
  setFinancialProfile?: any; 
  persona?: string 
}) {
  
  // ─── NLP State ──────────────────────────────────────────
  const [question, setQuestion] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<AskResponseV2 | null>(null);
   
   
   
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Manual Filters State (Mapped to global profile) ────
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
   
  const totalWeight = wAffordability + wIncome + wLivability + wAccess + wEvidence;

  const handleWeightChange = (setter: React.Dispatch<React.SetStateAction<number>>, currentVal: number, newVal: number) => {
    const othersTotal = totalWeight - currentVal;
    setter(Math.min(newVal, 100 - othersTotal));
  };

  // ─── Backend Ranking State ──────────────────────────────
  const [backendResults, setBackendResults] = useState<BuyFinderLocalResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
   
  const [comparisonList, setComparisonList] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false); // Collapsible manual filters

  const EXAMPLES = [
    'Find investment areas in QLD under $900k with rental resilience',
    'Compare Kenmore and Indooroopilly for a $1.5M family home',
    'Moving interstate: where do I start?',
  ];

  // ─── NLP Query Execution ─────────────────────────────────
  const callQuery = async (q: string, convId?: string) => {
    setNlpLoading(true);  setNlpResult(null); setDiscoveryResult(null); 
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const body: any = { question: q };
      if (convId) body.conversation_id = convId;
      const res = await fetch('/api/v3/ask/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      
      if (data.status === 'needs_clarification') {
        if (data.intent?.clarification?.questions?.length) {
          console.log({ ...data.intent, clarifyingQ: data.intent.clarification.questions[0] } as any);
        } else {
          console.log({ ...data.intent, clarifyingQ: "I need a bit more context. Could you specify a state, city, or area?" } as any);
        }
        setNlpLoading(false);
        return;
      }

      // Sync NLP extracted intent to Global Manual Filters
      if (data.intent && setFinancialProfile) {
        setFinancialProfile((prev: any) => {
          const updates = { ...prev };
          // Apply State
          if (data.intent.suburbs?.length > 0 && data.intent.suburbs[0].state) {
            updates.state = data.intent.suburbs[0].state.toUpperCase();
          }
          // Apply Budget
          if (data.intent.budget_limit) updates.budget = data.intent.budget_limit;
          else if (data.intent.budget_range?.[1]) updates.budget = data.intent.budget_range[1];
          // Apply Property Type
          if (data.intent.property_type && ['house', 'unit', 'any'].includes(data.intent.property_type)) {
            updates.propertyType = data.intent.property_type;
          }
          return updates;
        });
        setShowFilters(true); // Pop open the filters to show what the AI parsed
      }

      setNlpResult(data as AskResponseV2);
      if (data.discovery) setDiscoveryResult(data.discovery);
      
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error(err.message || 'Search failed — please try a more specific query.');
    } finally { setNlpLoading(false); }
  };

  const handleNlpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    callQuery(question);
  };

  // ─── Manual Ranking Execution ────────────────────────────
  const fetchRanking = useCallback(async () => {
    setBackendLoading(true); 
    try {
      const res = await fetch('/api/buy-finder/rank', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          buyer_profile: persona || 'first_home_buyer',
          state, budget, deposit, annual_income: annualIncome, existing_monthly_debt: monthlyDebt,
          interest_rate: interestRate / 100, serviceability_buffer: serviceabilityBuffer / 100, loan_term_years: loanTermYears, purchase_cost_allowance: purchaseCostAllowance / 100,
          property_type: propertyType, maximum_cbd_minutes: maxCBDMinutes, minimum_yield: minimumYield,
          weights: { affordability: wAffordability, income: wIncome, livability: wLivability, access: wAccess, evidence: wEvidence },
        }),
      });
      if (res.ok) setBackendResults(await res.json());
      else console.error(`Server error (${res.status}) — try again`);
    } catch (e: any) {
      console.error(e.message || 'Network error — check backend connectivity');
    } finally { setBackendLoading(false); }
  }, [state, budget, deposit, annualIncome, monthlyDebt, propertyType, maxCBDMinutes, minimumYield, interestRate, serviceabilityBuffer, loanTermYears, purchaseCostAllowance, wAffordability, wIncome, wLivability, wAccess, wEvidence, persona]);

  // Sub-renders
  const toggleCompare = useCallback((result: any) => {
    setComparisonList(prev => {
      const exists = prev.find(p => p.suburb_id === result.suburb_id);
      if (exists) return prev.filter(p => p.suburb_id !== result.suburb_id);
      if (prev.length >= 5) { alert("You can compare up to 5 suburbs."); return prev; }
      return [...prev, result];
    });
  }, []);

  return (
    <div className="search-container u-ca2f13f6">
      
      {/* ─── NLP SECTION ─── */}
      <div className="glass-card search-card">
        <h2 className="detail-title">Unified Search ✨</h2>
        <p className="subtitle">Ask a question or use the manual filters below to find the perfect suburb.</p>
        
        <form onSubmit={handleNlpSubmit}>
          <textarea value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="Describe what you're looking for… e.g. 'Find me investment properties in NSW under 900k'"
            rows={3} className="u-afcddc8d" />

          <div className="u-afdb53fe">
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" onClick={() => setQuestion(ex)} className="u-6c42c4bb">
                {ex}
              </button>
            ))}
          </div>

          <div className="u-5e4aeb76" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button type="submit" disabled={nlpLoading || !question.trim()} className="u-81dbffd4" style={{cursor: nlpLoading || !question.trim() ? 'not-allowed' : 'pointer', opacity: nlpLoading || !question.trim() ? 0.6 : 1}}>
              {nlpLoading ? 'Researching…' : 'Search by AI'}
            </button>
            <button type="button" onClick={() => setShowFilters(!showFilters)} className="u-8124ec93" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '0.6rem 1rem', borderRadius: '8px' }}>
              {showFilters ? 'Hide Manual Filters' : 'Show Manual Filters'}
            </button>
          </div>
        </form>

        {nlpLoading && (
          <div aria-busy="true" className="u-026fcc60" style={{marginTop: '1.5rem'}}>
            <BriefSkeleton />
            <p className="u-d61a8080">Extracting constraints and building research brief…</p>
          </div>
        )}
      </div>

      {/* ─── MANUAL FILTERS (Collapsible) ─── */}
      {showFilters && (
        <div className="glass-card search-card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--accent-blue)' }}>
          <h3 className="u-0c1fb0d9">Adjust Constraints</h3>
          <p className="subtitle">These constraints are synced with the AI's understanding of your prompt.</p>
          
          <div className="filter-grid" style={{ marginTop: '1rem' }}>
            <div className="filter-section">
              <label className="control-label">Location & Budget</label>
              <div className="u-54677cc4">
                <div className="control-group">
                  <label className="control-label">State</label>
                  <select className="premium-input small" value={state} onChange={e => setState(e.target.value)}>
                    {['VIC', 'NSW', 'QLD', 'SA', 'TAS'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="control-group">
                  <label className="control-label">Budget ($)</label>
                  <input type="number" className="premium-input" value={budget} onChange={e => updateProfile('budget', Number(e.target.value))} step={10000} />
                </div>
                <div className="control-group">
                  <label className="control-label">Property Type</label>
                  <select className="premium-input" value={propertyType} onChange={e => updateProfile('propertyType', e.target.value)}>
                    <option value="house">House</option>
                    <option value="unit">Unit</option>
                    <option value="any">Any</option>
                  </select>
                </div>
                {isInvestor && (
                  <div className="control-group">
                    <label className="control-label">Min Yield %</label>
                    <select className="premium-input" value={minimumYield ?? ''} onChange={e => updateProfile('minimumYield', e.target.value === '' ? null : Number(e.target.value))}>
                      <option value="">Any</option><option value="2">2%</option><option value="3">3%</option><option value="4">4%</option><option value="5">5%</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="filter-section">
              <div className="u-47a97aa0">
                <label className="control-label">Objective Weights</label>
                <span style={{background: totalWeight > 100 ? '#ef4444' : 'rgba(16,185,129,0.2)', color: totalWeight > 100 ? '#fff' : '#10b981', padding: '2px 6px', borderRadius: '4px', fontSize: '12px'}}>Total = {totalWeight}%</span>
              </div>
              <div className="filter-row">
                {[{l: 'Affordability', v: wAffordability, s: setWAffordability}, {l: 'Income', v: wIncome, s: setWIncome}, {l: 'Livability', v: wLivability, s: setWLivability}].map(w => (
                  <div className="control-group" key={w.l}>
                    <label className="control-label">{w.l} ({w.v}%)</label>
                    <input type="range" className="premium-range" min={0} max={100} value={w.v} onChange={e => handleWeightChange(w.s, w.v, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="filter-section" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <button onClick={fetchRanking} disabled={backendLoading} className="action-button primary u-d492d939">
                {backendLoading ? 'Ranking Suburbs...' : 'Calculate Quantitative Fit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NLP RESULTS PORTION ─── */}
      {nlpResult && !nlpLoading && !discoveryResult && (
        <div className="glass-card" style={{marginTop: '1rem'}}>
          <h3 className="u-d2b7079c">{nlpResult.headline || 'Research Brief'}</h3>
          <p className="u-4f1ddc89">{nlpResult.summary}</p>
          {nlpResult.comparison?.length > 0 && (
             <ComparisonDisplay comparisons={nlpResult.comparison} evidence={nlpResult.evidence} />
          )}
          <p className="u-b7b2d403" style={{marginTop: '1rem', fontSize: '0.8rem', color: 'gray'}}>{nlpResult.disclaimer}</p>
        </div>
      )}

      {discoveryResult && !nlpLoading && (
        <div className="glass-card" style={{marginTop: '1rem'}}>
          <h3 className="u-d2b7079c">🗺️ Suburb Discovery Results</h3>
          <p className="u-4f1ddc89">{discoveryResult.summary}</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
            {discoveryResult.results.map((r, i) => (
              <div key={i} style={{padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                <h4 style={{margin: '0 0 0.5rem 0'}}>{r.name}, {r.state}</h4>
                <ul style={{margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#ccc'}}>
                  {r.why_selected?.map((w: string, j: number) => <li key={j}>{w}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── RANKING RESULTS PORTION ─── */}
      {backendResults && (
        <div className="glass-card search-results-card" style={{marginTop: '1rem'}}>
          <h3 className="u-0c1fb0d9">Deterministic Results ({backendResults.results.length} eligible)</h3>
          
          <div className="search-results-grid" style={{marginTop: '1rem'}}>
            {backendResults.results.map((r: any) => (
              <BackendResultCard 
                key={r.suburb_id} result={r} 
                setActiveSuburb={setActiveSuburb} setActiveTab={setActiveTab} onSelectResult={onSelectResult} 
                requestMeta={{ request_id: backendResults.request_id, model_version: backendResults.model_version }} 
                isCompared={comparisonList.some(c => c.suburb_id === r.suburb_id)} toggleCompare={() => toggleCompare(r)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const BackendResultCard = memo(function BackendResultCard({ 
  result, setActiveSuburb, setActiveTab, onSelectResult, requestMeta, isCompared, toggleCompare 
}: { 
  result: any; setActiveSuburb?: (s: any) => void; setActiveTab?: (t: string) => void; onSelectResult?: (result: any, meta: any) => void; requestMeta?: { request_id: string; model_version: string }; isCompared?: boolean; toggleCompare?: () => void;
}) {
  const confClass = result.confidence_label === 'high' ? 'bf-card__score-val--high' : result.confidence_label === 'medium' ? 'bf-card__score-val--mid' : 'bf-card__score-val--low';
  const aff = result.affordability || {};
  const serviceabilityPassed = aff.serviceability_passed !== undefined ? aff.serviceability_passed : true;

  const handleOpenSuburb = () => {
    if (onSelectResult && requestMeta) {
      onSelectResult(result, requestMeta);
    }
    if (setActiveSuburb) {
      setActiveSuburb({id: result.suburb_id.toLowerCase(), name: result.name, state: result.state, postcode: result.postcode} as any);
    }
    if (setActiveTab) setActiveTab('profile');
  };

  return (
    <div className="bf-card">
      <div className="bf-card__header">
        <div>
          <div className="bf-card__name" onClick={handleOpenSuburb} role="button" tabIndex={0}>
            {result.name}, {result.state}
          </div>
        </div>
        <div className="bf-card__score">
          <div className={`bf-card__score-val ${confClass}`}>{result.buyer_fit_score.toFixed(0)}</div>
          <div className="bf-card__score-label">Fit Score</div>
        </div>
      </div>

      <div className="bf-card__metrics">
        <div className={`bf-card__metric ${serviceabilityPassed ? 'bf-card__metric--pass' : 'bf-card__metric--fail'}`}>
          <div className="bf-card__metric-label">Serviceability</div>
          <div className="bf-card__metric-val">{serviceabilityPassed ? 'Pass' : 'Fail'}</div>
        </div>
        {aff.purchase_price != null && (
          <div className="bf-card__metric">
            <div className="bf-card__metric-label">Est. Price</div>
            <div className="bf-card__metric-val">${(aff.purchase_price / 1000).toFixed(0)}k</div>
          </div>
        )}
      </div>

      <div className="bf-card__actions" style={{marginTop: '1rem'}}>
        <label className={`bf-card__action bf-card__action--compare ${isCompared ? 'bf-card__action--compare--active' : ''}`}>
          <input type="checkbox" checked={isCompared} onChange={toggleCompare} style={{marginRight: '8px'}} />
          Compare
        </label>
      </div>
    </div>
  );
});
