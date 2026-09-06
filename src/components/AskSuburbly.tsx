import React, { useState, useRef, useEffect } from 'react';
import { ComparisonDisplay } from './ask/ComparisonDisplay';
import { BriefSkeleton } from './ui/Skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SuburbMetric {
  label: string;
  value: number | null;
  unit: string;
  is_stale: boolean;
}

interface SuburbComparison {
  suburb_id: string;
  name: string;
  metrics: SuburbMetric[];
}

interface AskResponse {
  request_id: string;
  status: string;
  intent: any;
  assumptions: any[];
  summary: string;
  research_priority: string;
  comparison: SuburbComparison[];
  supports: any[];
  risks: any[];
  unknowns: string[];
  next_steps: string[];
  evidence: any[];
  data_quality: any;
  disclaimer: string;
}

interface DiscoveryMetrics {
  median_price?: number | null;
  yield_pct?: number | null;
  vacancy_rate?: number | null;
  population_cagr?: number | null;
  school_quality?: number | null;
  transit_accessibility?: number | null;
  parks_count?: number | null;
  safety_score?: number | null;
  top_school_name?: string | null;
  price_12m_change_pct?: number | null;
}

interface DiscoveryResult {
  suburb_id?: string;
  name: string;
  state: string;
  postcode?: string;
  match_score: number;
  dist_km?: number | null;
  why_selected: string[];
  metrics: DiscoveryMetrics;
}

interface DiscoveryResponse {
  guardrail: boolean;
  message?: string | null;
  summary?: string | null;
  query_understood: any;
  results: DiscoveryResult[];
  disclaimer: string;
}

// ─── V2 Types ────────────────────────────────────────────────────────────────
interface VerdictEntry {
  metric: string; leader?: string | null; edge_pct: number;
  direction: string; framing: string; values: Record<string, number | null>;
  context_note?: string | null;
}
interface PersonaVerdict { persona: string; leader?: string | null; scores: Record<string, number>; weights_used: Record<string, number>; }
interface VerdictBlock { framing: string; per_metric: VerdictEntry[]; by_persona: PersonaVerdict[]; tradeoffs: string[]; }
interface AffordabilityBlock { serviceability_passed?: boolean | null; borrowing_capacity?: number | null; monthly_repayment?: number | null; stamp_duty?: number | null; }
interface AskResponseV2 extends AskResponse { headline?: string; verdict?: VerdictBlock | null; affordability?: AffordabilityBlock | null; follow_ups?: {label:string;question:string;conversation_id?:string}[]; query_understood?: any; discovery?: DiscoveryResponse | null; }

// ─── Helper functions and explainers moved to ComparisonDisplay ───

// ─── Component ──────────────────────────────────────────────────────────────
interface AskSuburblyProps {
  financialProfile?: any;
  setFinancialProfile?: (fp: any) => void;
}

export const AskSuburbly: React.FC<AskSuburblyProps> = ({ financialProfile, setFinancialProfile }) => {
  const [question, setQuestion] = useState('');
  const [clarifyAnswer, setClarifyAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState('');
  const [pendingClarify, setPendingClarify] = useState<any>(null);
  
  const [budget, setBudget] = useState(String(financialProfile?.budget || 850000));
  const [deposit, setDeposit] = useState(String(financialProfile?.deposit || 170000));
  const [income, setIncome] = useState(String(financialProfile?.annualIncome || 150000));
  
  // Sync local changes to global financial profile
  useEffect(() => {
    if (setFinancialProfile && financialProfile) {
      setFinancialProfile({
        ...financialProfile,
        budget: Number(budget),
        deposit: Number(deposit),
        annualIncome: Number(income)
      });
    }
  }, [budget, deposit, income]);

  const [showScenarios, setShowScenarios] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const EXAMPLES = [
    'Compare Kenmore and Indooroopilly for a $2M family home',
    'Moving interstate: where do I start?',
    'Find investment areas under $900k with rental resilience',
  ];

  // ─── V2: Unified NL query (primary path) ─────────────────────────────
  const callQuery = async (q: string, convId?: string) => {
    setLoading(true); setError(''); setResult(null); setDiscoveryResult(null); setPendingClarify(null);
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
          setPendingClarify({ ...data.intent, clarifyingQ: data.intent.clarification.questions[0] } as any);
        } else {
          setPendingClarify({ 
            ...data.intent, 
            clarifyingQ: "I need a bit more context. Could you specify a state, city, or area (e.g., 'in QLD' or 'near Sydney') to help me narrow down the search?" 
          } as any);
        }
        setLoading(false);
        return;
      }
      setResult(data as AskResponseV2);
      // If this is a discovery response, also set discoveryResult for card rendering
      if ((data as AskResponseV2).discovery) {
        setDiscoveryResult((data as AskResponseV2).discovery || null);
      }
      
      // Sync state context to UI if NLP parsed a target state
      if (data.intent?.suburbs?.length > 0 && data.intent.suburbs[0].state && setFinancialProfile && financialProfile) {
        const parsedState = data.intent.suburbs[0].state.toLowerCase();
        if (parsedState && parsedState !== financialProfile.targetState) {
          setFinancialProfile({ ...financialProfile, targetState: parsedState });
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Search failed — please try a more specific query.');
      }
    } finally { setLoading(false); }
  };

  // ─── End V2 primary path ────────────────────────────────────────────

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    // Primary path: use the unified NL /query endpoint
    callQuery(question);
  };

  const handleClarify = async () => {
    if (!pendingClarify || !clarifyAnswer.trim()) return;
    const fullQ = `${question} — ${clarifyAnswer}`;
    setClarifyAnswer('');
    setQuestion(fullQ);
    callQuery(fullQ);
  };

  // ── Sub-renders ────────────────────────────────────────────────────────
  const DiscoveryCards = ({ disc }: { disc: DiscoveryResponse }) => {
    const fmt = (v?: number | null, decimals = 2, suffix = '') => v != null ? `${v.toFixed(decimals)}${suffix}` : '—';
    const fmtPrice = (v?: number | null) => v != null ? `$${(v / 1000).toFixed(0)}k` : '—';
    const scoreColor = (s: number) => s >= 70 ? 'var(--bg-brand)' : s >= 50 ? '#a3e635' : '#f59e0b';

    if (disc.guardrail && disc.message) {
      return (
        <div className="u-14ec60a4">
          <p className="u-2ea84e9c">{disc.message}</p>
          <p className="u-631f2e9a">Try a different direction, or use Buy Finder to scan a broader area.</p>
        </div>
      );
    }

    if (!disc.results.length) {
      return (
        <div className="u-92ab79f3">
          <p className="u-8773805e">{disc.message || 'No suburbs found matching your criteria.'}</p>
        </div>
      );
    }

    return (
      <div className="u-7cf9359d">
        {disc.summary && (
          <p className="u-c386a236">
            🔍 {disc.summary}
          </p>
        )}
        <div className="u-a240973f">
          {disc.results.map((r, i) => (
            <div key={r.suburb_id || r.name} className="u-3ffe173d">
              {/* Rank badge */}
              <div className="u-60e611d1" style={{background: i === 0 ? 'linear-gradient(135deg,var(--bg-brand),#0066ff)' : i === 1 ? 'rgba(163,230,53,0.3)' : 'rgba(15,23,42,0.06)', color: i === 0 ? '#000' : 'var(--text-primary)'}}>#{i + 1} MATCH</div>

              <div className="u-9317c41f">
                <div>
                  <h3 className="u-135f1010">{r.name}</h3>
                  <span className="u-48dd3199">{r.state}{r.postcode ? ` ${r.postcode}` : ''}{r.dist_km ? ` · ${r.dist_km.toFixed(0)}km away` : ''}</span>
                </div>
                <div className="u-f66ceb1f">
                  <div className="u-4be59b4a" style={{color: scoreColor(r.match_score)}}>{r.match_score.toFixed(0)}</div>
                  <div className="u-821d205a">match score</div>
                </div>
              </div>

              {/* Why selected bullets */}
              <ul className="u-7fe74b16">
                {r.why_selected.map((w, wi) => <li key={wi} className="u-08080c96">{w}</li>)}
              </ul>

              {/* Metrics row */}
              <div className="u-20d07d50">
                {r.metrics.median_price != null && (
                  <div className="u-d22a77f0">
                    <span className="u-c7477801">Price: </span><strong>{fmtPrice(r.metrics.median_price)}</strong>
                  </div>
                )}
                {r.metrics.yield_pct != null && (
                  <div className="u-d22a77f0">
                    <span className="u-c7477801">Yield: </span><strong className="u-9cfc9e7b">{fmt(r.metrics.yield_pct)}%</strong>
                  </div>
                )}
                {r.metrics.school_quality != null && (
                  <div className="u-d22a77f0">
                    <span className="u-c7477801">Schools: </span><strong className="u-62513c38">{fmt(r.metrics.school_quality, 1)}/10</strong>
                  </div>
                )}
                {r.metrics.transit_accessibility != null && (
                  <div className="u-d22a77f0">
                    <span className="u-c7477801">Transit: </span><strong>{fmt(r.metrics.transit_accessibility, 1)}/10</strong>
                  </div>
                )}
                {r.metrics.vacancy_rate != null && (
                  <div className="u-d22a77f0">
                    <span className="u-c7477801">Vacancy: </span><strong>{fmt(r.metrics.vacancy_rate)}%</strong>
                  </div>
                )}
                {r.metrics.population_cagr != null && (
                  <div className="u-d22a77f0">
                    <span className="u-c7477801">Growth: </span><strong className="u-0f1f9356">{fmt(r.metrics.population_cagr, 1)}%pa</strong>
                  </div>
                )}
              </div>

              {/* Dive deeper CTA */}
              <button
                onClick={() => {
                  const q = `Research ${r.name} ${r.state}`;
                  setQuestion(q);
                  callQuery(q);
                }}
                className="u-25f6e955"
                onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg,var(--bg-brand)33,#0066ff33)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg,var(--bg-brand)22,#0066ff22)')}
              >
                📋 Build Full Research Brief →
              </button>
            </div>
          ))}
        </div>
        <p className="u-1b691f4f">
          General research only — not financial, legal, or valuation advice. Data sourced from verified CoreLogic/ABS datasets.
        </p>
      </div>
    );
  };

  const VerdictPanel = ({ verdict }: { verdict: VerdictBlock | null | undefined }) => {
    if (!verdict) return null;
    const personaLeaders = verdict.by_persona?.filter(p => p.leader) || [];
    const tradeoffs = verdict.tradeoffs || [];
    return (
      <div className="u-4fcf13a0">
        {verdict.framing === 'clear_leader' && personaLeaders.length > 0 && (
          <div className="u-75752c45">
            <p className="u-902912d1">Verdict by persona</p>
            <div className="u-b8d6408e">
              {personaLeaders.map(p => (
                <span key={p.persona} className="u-1f83e095">
                  <strong className="u-044f69bb">{p.persona.replace(/_/g, ' ')}:</strong> {p.leader}
                </span>
              ))}
            </div>
          </div>
        )}
        {tradeoffs.length > 0 && (
          <div className="u-a83567c9">
            <p className="u-0db58b59">Trade-offs to consider</p>
            <ul className="u-7a06743f">
              {tradeoffs.map((t, i) => <li key={i} className="u-adf77c35">{t}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const EvidenceTable = ({ evidence }: { evidence: any[] }) => {
    const [expanded, setExpanded] = useState(false);
    if (!evidence?.length) return null;
    return (
      <div className="u-a54379e3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="u-d0f2fa42"
          aria-expanded={expanded}
        >
          {expanded ? '▾ Hide evidence sources' : '▸ Show evidence sources'} ({evidence.length} metrics)
        </button>
        {expanded && (
          <div className="u-93c1dcb4">
            <table className="u-67712a5e">
              <thead>
                <tr>
                  <th className="u-03a5e9c1" style={{...TH}}>Metric</th>
                  <th className="u-f55501b1" style={{...TH}}>Value</th>
                  <th className="u-03a5e9c1" style={{...TH}}>Source</th>
                  <th className="u-03a5e9c1" style={{...TH}}>As of</th>
                  <th className="u-03a5e9c1" style={{...TH}}>Quality</th>
                </tr>
              </thead>
              <tbody>
                {evidence.slice(0, 30).map((e, i) => (
                  <tr key={e.id || i} style={{ background: i % 2 === 0 ? 'rgba(15,23,42,0.01)' : 'transparent' }}>
                    <td className="u-021047db" style={{...TD}}>{e.metric}</td>
                    <td className="u-cd0dfebc" style={{...TD}}>
                      {typeof e.value === 'number' ? (e.unit.includes('$') ? `$${e.value.toLocaleString()}` : e.unit === '%' ? `${e.value.toFixed(2)}%` : e.value.toLocaleString()) : String(e.value ?? '—')}
                    </td>
                    <td className="u-af2c87ef" style={{...TD}}>{e.source}</td>
                    <td className="u-a471707d" style={{...TD, color: e.is_stale ? 'var(--warning)' : 'var(--text-secondary)'}}>{e.as_of}{e.is_stale ? ' ⚠ stale' : ''}</td>
                    <td className="u-a471707d" style={{...TD, color: e.quality === 'verified' ? 'var(--success)' : 'var(--text-secondary)'}}>{e.quality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const DQWarning = ({ dq }: { dq: any }) => {
    const lowSuburbs = Object.entries(dq?.suburbs ?? {}).filter(([, v]: any) => v.dq_score < 70);
    if (!lowSuburbs.length) return null;
    return (
      <div className="u-991e4622">
        <strong className="u-6a850c01">⚠️ Data Quality Alert</strong>
        <p className="u-61be7e23">
          <strong>{lowSuburbs.map(([id]) => id.split('_')[1]).join(', ')}</strong> has limited verified data coverage.
          Figures may be based on fewer sales or older data points — cross-check with a local agent before acting.
        </p>
      </div>
    );
  };

  return (
    <div data-build="v2-loadingfix" className="u-ca2f13f6">
      <div className="u-9f1799ee">
        <h2 className="u-0800748b">Ask Suburbly ✨</h2>
        <p className="u-472b060e">Natural-language property research powered by verified data — not opinions.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea value={question} onChange={e => setQuestion(e.target.value)}
          placeholder="Describe what you're deciding… e.g. 'Compare Kenmore and Indooroopilly for a $1.5M family home'"
          rows={3} className="u-afcddc8d" />

        <div className="u-afdb53fe">
          {EXAMPLES.map((ex, i) => (
            <button key={i} type="button" onClick={() => setQuestion(ex)}
              className="u-6c42c4bb">
              {ex}
            </button>
          ))}
        </div>

        <div className="u-602ac9f4">
          <button type="button" onClick={() => setShowScenarios(s => !s)}
            className="u-8124ec93">
            {showScenarios ? 'Hide scenario controls' : 'Set budget & income (optional)'}
          </button>
          {showScenarios && (
            <div className="u-26f282ae">
              {[
                { lbl: 'Budget ($)', val: budget, set: setBudget, step: 50000 },
                { lbl: 'Deposit ($)', val: deposit, set: setDeposit, step: 20000 },
                { lbl: 'Income ($)', val: income, set: setIncome, step: 20000 }
              ].map(({ lbl, val, set, step }) => (
                <div key={lbl}>
                  <label className="u-7dd83fa6">{lbl}</label>
                  <input type="number" step={step} value={val} onChange={e => set(e.target.value)}
                    className="u-48624ea5" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="u-5e4aeb76">
          <button type="submit" disabled={loading || !question.trim()}
            className="u-81dbffd4" style={{cursor: loading || !question.trim() ? 'not-allowed' : 'pointer', opacity: loading || !question.trim() ? 0.6 : 1}}>
            {loading ? 'Researching…' : 'Build research brief'}
          </button>
          {loading && (
            <button type="button" onClick={() => { abortRef.current?.abort(); setLoading(false); }}
              className="u-7c2adef2">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Clarifying question */}
      {pendingClarify && !loading && (
        <div className="u-ea3a4416">
          <p className="u-a40cc8df">Follow-up question</p>
          <p className="u-e9ab25c2">{pendingClarify.clarifyingQ}</p>
          {(pendingClarify as any).clarification?.options?.length ? (
            <div className="u-eaa8aff8">
              {(pendingClarify as any).clarification.options.map((opt: any, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    const fullQ = `${opt.name} ${opt.state || ''}`;
                    setQuestion(fullQ);
                    setPendingClarify(null);
                    callQuery(fullQ);
                  }}
                  className="u-375bf78a"
                >
                  {opt.name}{opt.state ? ` (${opt.state})` : ''}
                </button>
              ))}
            </div>
          ) : (
            <div className="u-ee38c967">
              <input value={clarifyAnswer} onChange={e => setClarifyAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClarify()}
                placeholder="Your answer…"
                className="u-ca79edbb"
                aria-label="Your answer"
              />
              <button onClick={handleClarify} disabled={!clarifyAnswer.trim()}
                className="u-eaded6b1" style={{cursor: clarifyAnswer.trim() ? 'pointer' : 'not-allowed', opacity: clarifyAnswer.trim() ? 1 : 0.5}}>
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div aria-busy="true" aria-label="Loading research brief" className="u-026fcc60">
          <BriefSkeleton />
          <p className="u-d61a8080">Pulling verified data and building your research brief…</p>
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="u-cbb4dd02">
          <strong className="u-01e80e86">Error: </strong>{error}
        </div>
      )}

      {discoveryResult && !loading && (
        <div aria-live="polite" className="u-ee232963">
          <div className="u-c96434f2">
            <h3 className="u-4b18be9b">🗺️ Suburb Discovery Results</h3>
            <button onClick={() => { setDiscoveryResult(null); setQuestion(''); }}
              className="u-c4349989">
              ↺ New question
            </button>
          </div>
          <DiscoveryCards disc={discoveryResult} />
        </div>
      )}

  {result && !loading && !discoveryResult && (
    <div aria-live="polite" className="u-1fe873cd">

          {/* Header */}
          <div className="u-3f0291ab">
            <div>
              <h3 className="u-d2b7079c">
                {(result as AskResponseV2).headline || 'Research Brief'}
              </h3>
              {(result as AskResponseV2).query_understood?.data_as_of && (
                <span className="u-3e7ca611">
                  Data as of: {(result as AskResponseV2).query_understood.data_as_of}
                </span>
              )}
              <span className="u-fc193050">
                Status: <strong>{result.status.replace(/_/g, ' ')}</strong>&ensp;|&ensp;Priority:&nbsp;
                <span className="u-9ba7a398" style={{background: result.research_priority === 'high' ? 'rgba(0,210,130,0.15)' : result.research_priority === 'medium' ? 'rgba(255,180,0,0.12)' : 'rgba(150,150,150,0.1)', color: result.research_priority === 'high' ? 'var(--success)' : result.research_priority === 'medium' ? 'var(--warning)' : 'var(--text-secondary)'}}>
                  {result.research_priority.replace(/_/g, ' ').toUpperCase()}
                </span>
              </span>
            </div>
            <button onClick={() => { setResult(null); setQuestion(''); }}
              className="u-c4349989">
              ↺ New question
            </button>
          </div>

          <DQWarning dq={result.data_quality} />

          {/* AI Summary */}
          <div className="u-715fbe67">
            <p className="u-fee19256">AI Summary</p>
            <p className="u-4f1ddc89">{result.summary}</p>
          </div>

          {/* Verdict panel (v2) */}
          <VerdictPanel verdict={(result as AskResponseV2).verdict} />

          {/* Assumptions pills */}
          {result.assumptions.length > 0 && (
            <div className="u-88bbc9da">
              {result.assumptions.map((a, i) => (
                <span key={i} className="u-b48dfa69">
                  {a.label}: <strong>{a.value}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Side-by-side table */}
          <ComparisonDisplay comparisons={result.comparison} evidence={result.evidence} />

          {/* Evidence table (collapsible) */}
          <EvidenceTable evidence={result.evidence} />

          {/* Supports / Risks */}
          <div className="u-bb40eaf7">
            <div className="u-460c1403">
              <h4 className="u-72815528">✅ What supports this decision</h4>
              {result.supports.length ? (
                <ul className="u-7a06743f">
                  {result.supports.map((s, i) => <li key={i} className="u-d732226a">{s.claim}</li>)}
                </ul>
              ) : <p className="u-3a34bc30">No positives identified with current data.</p>}
            </div>
            <div className="u-2f9afa62">
              <h4 className="u-6e252633">⚠️ Risks & counterarguments</h4>
              <ul className="u-7a06743f">
                {result.risks.map((r, i) => <li key={i} className="u-d732226a">{r.claim}</li>)}
              </ul>
            </div>
          </div>

          {/* Unknowns + Next steps */}
          <div className="u-ee27d730">
            <div>
              <h4 className="u-1ced0647">Material unknowns</h4>
              <ul className="u-7a06743f">
                {result.unknowns.map((u, i) => <li key={i} className="u-d9580577">{u}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="u-1ced0647">Your next actions</h4>
              <ol className="u-7a06743f">
                {result.next_steps.map((n, i) => <li key={i} className="u-15627afb">{n}</li>)}
              </ol>
            </div>
          </div>

          {/* Follow-up chips */}
          <div className="u-d9708e68">
            <p className="u-30dd8ef9">Ask a follow-up:</p>
            <div className="u-7b08bd4f">
              {((result as AskResponseV2).follow_ups || []).map((fu, i) => (
                <button key={i} onClick={() => { setQuestion(fu.question); callQuery(fu.question, (fu as any).conversation_id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>{fu.label}</button>
              ))}
              {((result as AskResponseV2).follow_ups?.length ?? 0) === 0 && (
                <>
                  {result.comparison.length >= 2 && (
                    <button onClick={() => { const q = `What are the schools like near ${result.comparison.map(c => c.name).join(' and ')}?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Schools nearby?</button>
                  )}
                  <button onClick={() => { const q = `Cashflow projections if I buy in ${result.comparison[0]?.name ?? 'this suburb'} at the median price?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Cashflow projections?</button>
                  <button onClick={() => { const q = `What are the biggest risks of buying in ${result.comparison[0]?.name ?? 'this suburb'} right now?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Biggest risks?</button>
                  {result.comparison.length >= 2 && (
                    <button onClick={() => { const q = `Which of ${result.comparison.map(c => c.name).join(' or ')} has better long-term growth potential?`; setQuestion(q); callQuery(q); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={CHIP_STYLE}>Long-term growth?</button>
                  )}
                </>
              )}
            </div>
          </div>

          <p className="u-b7b2d403">
            {result.disclaimer}
          </p>
        </div>
      )}

      </div>
  );
};

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px',
  background: 'rgba(0,0,0,0.28)', borderBottom: '2px solid var(--border-glass)',
  color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.02)' };
const CHIP_STYLE: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border-glass)',
  background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s',
};

