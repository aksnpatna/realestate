import React, { useState, memo, useRef } from 'react';

import { Icon } from './ui';
import '../styles/UnifiedSearchView.css';

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



export default memo(function UnifiedSearchView({ 
  setActiveSuburb, setActiveTab, financialProfile, setFinancialProfile
}: {
  setActiveSuburb?: (s: any) => void;
  setActiveTab?: (t: string) => void;
  financialProfile?: any;
  setFinancialProfile?: any;
  suburbsData?: any[];
  onSelectResult?: (result: any, meta: any) => void;
  persona?: any;
}) {
  
  const [question, setQuestion] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<AskResponseV2 | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Manual Filters State
  const state = financialProfile?.state ?? 'VIC';
  const budget = financialProfile?.budget ?? 500000;
  const propertyType = financialProfile?.propertyType ?? 'house';
  const minimumYield = financialProfile?.minimumYield ?? null;
  
  const [showFilters, setShowFilters] = useState(false);

  const updateProfile = (key: string, value: any) => {
    if (setFinancialProfile) {
      setFinancialProfile((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const callQuery = async (q: string) => {
    setNlpLoading(true); setNlpResult(null); setDiscoveryResult(null); setClarificationQuestion(null);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/v3/ask/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }), signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      
      if (data.status === 'needs_clarification') {
        const qText = data.intent?.clarification?.questions?.[0] || "I need a bit more context. Could you specify a state, city, or area?";
        setClarificationQuestion(qText);
        setNlpLoading(false);
        return;
      }

      // Sync Intent to Profile
      if (data.intent && setFinancialProfile) {
        setFinancialProfile((prev: any) => {
          const updates = { ...prev };
          if (data.intent.suburbs?.[0]?.state) updates.state = data.intent.suburbs[0].state.toUpperCase();
          if (data.intent.budget_limit) updates.budget = data.intent.budget_limit;
          else if (data.intent.budget_range?.[1]) updates.budget = data.intent.budget_range[1];
          if (data.intent.property_type && ['house', 'unit', 'any'].includes(data.intent.property_type)) {
            updates.propertyType = data.intent.property_type;
          }
          return updates;
        });
        setShowFilters(true);
      }

      setNlpResult(data as AskResponseV2);
      if (data.discovery) setDiscoveryResult(data.discovery);
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Search failed');
    } finally { setNlpLoading(false); }
  };

  const handleNlpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    callQuery(question);
  };

  const handlePillClick = (q: string) => {
    setQuestion(q);
    callQuery(q);
  };

  return (
    <div className="unified-search">
      {/* ── Conversational Hero ── */}
      <section className="us-hero">
        <h1 className="us-hero-title">Where should I buy?</h1>
        <p className="us-hero-subtitle">Ask PropertyIQ to find your perfect match, or explore our top recommendations based on your profile.</p>
        
        <form className="us-search-form" onSubmit={handleNlpSubmit}>
          <div className="us-search-input-wrapper">
            <Icon name="search" size={24} className="us-search-icon" />
            <input 
              type="text" 
              value={question} 
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Find me investment properties in NSW under 900k..."
              className="us-search-input"
            />
            <button type="submit" disabled={nlpLoading || !question.trim()} className="us-search-btn">
              {nlpLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          
          <div className="us-quick-starts">
            <button type="button" className="us-pill" onClick={() => handlePillClick(`Best ${propertyType}s in ${state} under $${budget.toLocaleString()}`)}>
              💰 Best areas under my budget
            </button>
            <button type="button" className="us-pill" onClick={() => handlePillClick('Compare Point Cook and Tarneit')}>
              ⚖️ Compare two suburbs
            </button>
            <button type="button" className="us-pill" onClick={() => handlePillClick('Find high yield suburbs with good schools')}>
              📈 High yield & lifestyle
            </button>
          </div>

          <button type="button" className="us-filters-toggle" onClick={() => setShowFilters(!showFilters)}>
            <Icon name="settings" size={16} /> 
            {showFilters ? 'Hide manual filters' : 'Adjust manual constraints'}
            <Icon name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
        </form>

        {showFilters && (
          <div className="us-filters-drawer">
            <div className="us-filters-grid">
              <div className="us-filter-group">
                <div className="us-slider-header">
                  <label>Max Budget</label>
                  <span className="us-slider-value">${(budget / 1000).toFixed(0)}k</span>
                </div>
                <input 
                  type="range" 
                  min={300000} 
                  max={3000000} 
                  step={50000} 
                  value={budget} 
                  onChange={(e) => updateProfile('budget', Number(e.target.value))}
                  className="us-slider"
                />
              </div>
              <div className="us-filter-group">
                <label>Property Type</label>
                <select value={propertyType} onChange={e => updateProfile('propertyType', e.target.value)} style={{padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
                  <option value="house">House</option>
                  <option value="unit">Unit</option>
                  <option value="any">Any</option>
                </select>
              </div>
              <div className="us-filter-group">
                <label>State</label>
                <select value={state} onChange={e => updateProfile('state', e.target.value)} style={{padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-glass)'}}>
                  <option value="VIC">Victoria</option>
                  <option value="NSW">New South Wales</option>
                  <option value="QLD">Queensland</option>
                  <option value="WA">Western Australia</option>
                  <option value="SA">South Australia</option>
                  <option value="TAS">Tasmania</option>
                </select>
              </div>
              <div className="us-filter-group">
                <div className="us-slider-header">
                  <label>Min Yield Requirement</label>
                  <span className="us-slider-value">{minimumYield ? `${minimumYield}%` : 'Any'}</span>
                </div>
                <input 
                  type="range" 
                  min={0} 
                  max={8} 
                  step={0.5} 
                  value={minimumYield || 0} 
                  onChange={(e) => updateProfile('minimumYield', Number(e.target.value) === 0 ? null : Number(e.target.value))}
                  className="us-slider"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Results Area ── */}
      <section className="us-results">
        
        {clarificationQuestion && !nlpLoading && (
          <div className="us-clarification">
            <div className="us-clarification-icon"><Icon name="warning" size={24} /></div>
            <div className="us-clarification-text">
              <h4>Can you clarify?</h4>
              <p>{clarificationQuestion}</p>
            </div>
          </div>
        )}

        {nlpResult && !nlpLoading && !discoveryResult && (
          <div className="us-story-card">
            <div className="us-story-header">
              <div className="us-story-icon"><Icon name="chart" size={32} /></div>
              <div className="us-story-headline">
                <h3>{nlpResult.headline || 'Research Brief'}</h3>
                <p className="us-story-summary">{nlpResult.summary}</p>
              </div>
            </div>
            
            {nlpResult.supports && nlpResult.supports.length > 0 && (
              <div className="us-story-insights">
                {nlpResult.supports.slice(0, 3).map((insight, idx) => (
                  <div key={idx} className="us-insight">
                    <Icon name="check" size={20} className="us-insight-icon" />
                    <div>
                      <h4>Key Insight</h4>
                      <p>{insight.description || insight}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {discoveryResult && !nlpLoading && (
          <div className="us-discovery-container">
            <h3 style={{color: 'var(--brand-navy)', marginBottom: '1rem'}}>Recommended Areas</h3>
            <p style={{color: 'var(--text-secondary)'}}>{discoveryResult.summary}</p>
            
            <div className="us-discovery-grid">
              {discoveryResult.results.map((r, i) => (
                <div key={i} className="us-suburb-card">
                  <div className="us-suburb-header">
                    <h4 className="us-suburb-name">{r.name}</h4>
                    <span className="us-suburb-state">{r.state} • {r.postcode}</span>
                  </div>
                  
                  <div className="us-suburb-metrics">
                    <div className="us-metric-badge">
                      <span className="us-metric-label">Est. Price</span>
                      <span className="us-metric-value">${r.median_price ? (r.median_price / 1000).toFixed(0) + 'k' : 'N/A'}</span>
                    </div>
                    <div className="us-metric-badge">
                      <span className="us-metric-label">Yield</span>
                      <span className="us-metric-value">{r.rental_yield ? r.rental_yield.toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                  </div>

                  <button className="us-suburb-cta" onClick={() => {
                    if (setActiveSuburb) setActiveSuburb({id: r.suburb_id.toLowerCase(), name: r.name, state: r.state, postcode: r.postcode} as any);
                    if (setActiveTab) setActiveTab('profile');
                  }}>
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
});
