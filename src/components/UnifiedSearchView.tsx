import React, { useState, memo, useRef } from 'react';

import { Icon } from './ui';
import { ReasoningMap } from './ask/ReasoningMap';
import '../styles/UnifiedSearchView.css';

// ─── Reused Ask Types ────────────────────────────────────────────────────────
interface DiscoveryResponse {
  guardrail: boolean;
  message?: string | null;
  summary?: string | null;
  query_understood: any;
  results: any[];
  disclaimer: string;
  trace_log?: {
    engine: string;
    query: string;
    dataset_origin: string;
  } | null;
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
  trace_log?: any;
  reasoning_chain?: {
    hops: { step: string; input_summary: string; output_summary: string; confidence: number; data_sources: string[]; decision_rationale: string; artifacts?: Record<string,any>|null; latency_ms: number; }[];
    aggregate_confidence: number;
    total_latency_ms: number;
  } | null;
}



export default memo(function UnifiedSearchView({ 
  setActiveSuburb, setActiveTab, financialProfile, setFinancialProfile, persona = 'first_home_buyer'
}: {
  setActiveSuburb?: (s: any) => void;
  setActiveTab?: (t: string) => void;
  financialProfile?: any;
  setFinancialProfile?: any;
  suburbsData?: any[];
  onSelectResult?: (result: any, meta: any) => void;
  persona?: any;
  setNlpSummary?: (summary: string | null) => void;
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
  const [applyManualFilters, setApplyManualFilters] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  // Get persona-specific welcome message and quick start pills
  const getPersonaWelcome = () => {
    switch(persona) {
      case 'first_home_buyer':
        return {
          welcome: "You're exploring as a First Home Buyer. Here's where to start your property journey.",
          pills: [
            "Find suburbs with grants eligible areas",
            "Best affordable suburbs near train stations",
            "First home buyer hotspots with good schools"
          ]
        };
      case 'investor':
        return {
          welcome: "You're exploring as an Investor. Discover high-yield and high-growth opportunities.",
          pills: [
            "High yield + low vacancy rate suburbs",
            "Cashflow positive investment properties",
            "Suburbs with strong rental demand"
          ]
        };
      case 'buyers_agent':
        return {
          welcome: "You're exploring as a Buyer's Agent. Access detailed market intelligence and property analysis.",
          pills: [
            "Suburbs with high buyer demand",
            "Undervalued properties with growth potential",
            "Premium suburbs with strong fundamentals"
          ]
        };
      default:
        return {
          welcome: "Welcome to PropertyIQ. Start exploring properties that match your needs.",
          pills: [
            "Find properties in my budget",
            "Explore top suburbs for families",
            "Discover investment opportunities"
          ]
        };
    }
  };

  const personaWelcome = getPersonaWelcome();

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
        body: JSON.stringify({ 
          question: q,
          scenario_overrides: applyManualFilters ? {
            state,
            budget,
            property_type: propertyType,
            minimum_yield: minimumYield
          } : undefined
        }), signal: abortRef.current.signal,
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

  const handleAdjust = async (adjustments: Record<string, any>) => {
    setAdjusting(true);
    let q = question;
    if (adjustments.budget) {
      q = q.replace(/\$[\d,]+/g, `$${adjustments.budget.toLocaleString()}`);
    }
    if (adjustments.suburbs?.length) {
      q = q + ` — focus on ${adjustments.suburbs.join(', ')}`;
    }
    if (adjustments.priorities?.length) {
      q = q + ` — prioritize ${adjustments.priorities.join(', ')}`;
    }
    const body: any = { question: q };
    if (adjustments.persona_weights) {
      body.scenario_overrides = { persona_weights: adjustments.persona_weights };
    }
    await callQuery(q);
    setAdjusting(false);
  };

  const TraceLogDisplay = ({ trace_log, maskedQuery }: { trace_log: any, maskedQuery?: string }) => {
    const [open, setOpen] = useState(false);
    if (!trace_log) return null;
    return (
      <div className="us-tracelog" style={{ marginTop: '16px', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          {open ? 'Hide Data Lineage Trace' : 'Show Data Lineage Trace (Data Audit)'}
        </button>
        {open && (
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {maskedQuery && (
              <div style={{ marginBottom: '8px' }}><strong>Scrubbed Input:</strong> <span style={{ color: '#a3e635', fontStyle: 'italic' }}>{maskedQuery}</span></div>
            )}
            <div style={{ marginBottom: '8px' }}><strong>Execution Engine:</strong> <span style={{ color: 'var(--bg-brand)', textTransform: 'uppercase', fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(163,230,53,0.1)', borderRadius: '4px' }}>{trace_log.engine}</span></div>
            <div style={{ marginBottom: '8px' }}><strong>Source Dataset:</strong> {trace_log.dataset_origin}</div>
            <div style={{ marginBottom: '4px' }}><strong>Executed Query:</strong></div>
            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '4px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', color: '#a3e635' }}>
              {trace_log.query}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const FeedbackWidget = ({ requestId, originalQuery }: { requestId: string, originalQuery: string }) => {
    const [status, setStatus] = useState<'idle' | 'upvoted' | 'downvoted' | 'submitted'>('idle');
    const [comment, setComment] = useState('');

    const submitFeedback = async (type: 'upvote' | 'downvote', text?: string) => {
      try {
        await fetch('/api/v3/ask/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id: requestId,
            query: originalQuery,
            feedback_type: type,
            expected_behavior: text || ''
          })
        });
        setStatus(type === 'upvote' ? 'submitted' : type);
      } catch (err) {
        console.error('Feedback failed', err);
      }
    };

    if (status === 'submitted') return <div className="us-tracelog" style={{ marginTop: '16px', color: 'var(--bg-brand)', fontSize: '0.85rem' }}>✓ Feedback received. Thank you!</div>;

    return (
      <div className="us-tracelog" style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>Was this research helpful?</span>
          <button onClick={() => submitFeedback('upvote')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-primary)' }}>👍 Yes</button>
          <button onClick={() => setStatus('downvoted')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-primary)' }}>👎 No</button>
        </div>

        {status === 'downvoted' && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="What did you expect instead? (Optional Correction)" 
              value={comment}
              onChange={e => setComment(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
            />
            <button onClick={() => { submitFeedback('downvote', comment); setStatus('submitted'); }} style={{ background: 'var(--bg-brand)', color: '#000', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Submit Correction
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="unified-search">
      {/* ── Conversational Hero ── */}
      <section className="us-hero">
        <h1 className="us-hero-title">Where should I buy?</h1>
        <p className="us-hero-subtitle">{personaWelcome.welcome}</p>
        
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
            {personaWelcome.pills.map((pill, index) => (
              <button key={index} type="button" className="us-pill" onClick={() => handlePillClick(pill)}>
                {index === 0 ? '💰' : index === 1 ? '⚖️' : '📈'} {pill}
              </button>
            ))}
          </div>

          <button type="button" className="us-filters-toggle" onClick={() => setShowFilters(!showFilters)}>
            <Icon name="settings" size={16} /> 
            {showFilters ? 'Hide manual filters' : 'Adjust manual constraints'}
            <Icon name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
        </form>

        {showFilters && (
          <div className="us-filters-drawer">
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, color: 'var(--brand-navy)' }}>
                <input 
                  type="checkbox" 
                  checked={applyManualFilters} 
                  onChange={(e) => setApplyManualFilters(e.target.checked)} 
                  style={{ width: '18px', height: '18px', accentColor: 'var(--brand-navy)' }}
                />
                Apply manual overrides to AI search
              </label>
              <p style={{ margin: '0.5rem 0 0 2.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                When checked, these manual limits will force the AI to only look within these boundaries (e.g. forcing a max budget of $500k even if your question asks for luxury homes).
              </p>
            </div>
            
            <div className={`us-filters-grid ${!applyManualFilters ? 'opacity-50' : ''}`} style={{ transition: 'opacity 0.2s', pointerEvents: applyManualFilters ? 'auto' : 'none' }}>
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

            {nlpResult.reasoning_chain && (
              <ReasoningMap
                chain={nlpResult.reasoning_chain}
                onAdjust={handleAdjust}
                adjusting={adjusting}
              />
            )}
            
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
                      <span className="us-metric-value">${r.metrics?.median_price ? (r.metrics.median_price / 1000).toFixed(0) + 'k' : 'N/A'}</span>
                    </div>
                    <div className="us-metric-badge">
                      <span className="us-metric-label">Yield</span>
                      <span className="us-metric-value">{r.metrics?.yield_pct ? r.metrics.yield_pct.toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                  </div>

                  <button className="us-suburb-cta" onClick={() => {
                    const fallbackId = `${r.state}_${r.name.replace(/\s+/g, '_')}_${r.postcode}`.toLowerCase();
                    const safeId = r.suburb_id ? r.suburb_id.toLowerCase() : fallbackId;
                    if (setActiveSuburb) setActiveSuburb({id: safeId, name: r.name, state: r.state, postcode: r.postcode} as any);
                    if (setActiveTab) setActiveTab('profile');
                  }}>
                    View Profile
                  </button>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1rem', marginTop: '0.5rem' }}>
                    {r.why_selected?.map((w: string, j: number) => <li key={j}>{w}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            {nlpResult?.reasoning_chain && (
              <ReasoningMap
                chain={nlpResult.reasoning_chain}
                onAdjust={handleAdjust}
                adjusting={adjusting}
              />
            )}
            {discoveryResult.trace_log && <TraceLogDisplay trace_log={discoveryResult.trace_log} maskedQuery={discoveryResult.query_understood?.masked_query || nlpResult?.query_understood?.masked_query} />}
            {nlpResult?.request_id && <FeedbackWidget requestId={nlpResult.request_id} originalQuery={question} />}
          </div>
        )}
      </section>
    </div>
  );
});
