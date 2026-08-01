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
interface AskYieldSenseProps {
  financialProfile?: any;
  setFinancialProfile?: (fp: any) => void;
}

export const AskYieldSense: React.FC<AskYieldSenseProps> = ({ financialProfile, setFinancialProfile }) => {
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
      if (data.status === 'needs_clarification' && data.intent?.clarification?.questions?.length) {
        setPendingClarify({ ...data.intent, clarifyingQ: data.intent.clarification.questions[0] } as any);
        setLoading(false);
        return;
      }
      setResult(data as AskResponseV2);
      // If this is a discovery response, also set discoveryResult for card rendering
      if ((data as AskResponseV2).discovery) {
        setDiscoveryResult((data as AskResponseV2).discovery || null);
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
        <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: 12, padding: '20px 22px', marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#fbbf24', fontWeight: 600 }}>{disc.message}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Try a different direction, or use Buy Finder to scan a broader area.</p>
        </div>
      );
    }

    if (!disc.results.length) {
      return (
        <div style={{ background: 'rgba(15,23,42,0.02)', borderRadius: 12, padding: 20, marginBottom: 18, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{disc.message || 'No suburbs found matching your criteria.'}</p>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 24 }}>
        {disc.summary && (
          <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            🔍 {disc.summary}
          </p>
        )}
        <div style={{ display: 'grid', gap: 14 }}>
          {disc.results.map((r, i) => (
            <div key={r.suburb_id || r.name} style={{
              background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)',
              borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden',
              transition: 'box-shadow 0.2s',
            }}>
              {/* Rank badge */}
              <div style={{
                position: 'absolute', top: 0, left: 0,
                background: i === 0 ? 'linear-gradient(135deg,var(--bg-brand),#0066ff)' : i === 1 ? 'rgba(163,230,53,0.3)' : 'rgba(15,23,42,0.06)',
                color: i === 0 ? '#000' : 'var(--text-primary)',
                fontWeight: 800, fontSize: '0.72rem', padding: '3px 10px', borderRadius: '14px 0 8px 0',
              }}>#{i + 1} MATCH</div>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 8 }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 700 }}>{r.name}</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.state}{r.postcode ? ` ${r.postcode}` : ''}{r.dist_km ? ` · ${r.dist_km.toFixed(0)}km away` : ''}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor(r.match_score) }}>{r.match_score.toFixed(0)}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>match score</div>
                </div>
              </div>

              {/* Why selected bullets */}
              <ul style={{ margin: '12px 0 12px', padding: '0 0 0 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {r.why_selected.map((w, wi) => <li key={wi} style={{ marginBottom: 3 }}>{w}</li>)}
              </ul>

              {/* Metrics row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {r.metrics.median_price != null && (
                  <div style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Price: </span><strong>{fmtPrice(r.metrics.median_price)}</strong>
                  </div>
                )}
                {r.metrics.yield_pct != null && (
                  <div style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Yield: </span><strong style={{ color: '#a3e635' }}>{fmt(r.metrics.yield_pct)}%</strong>
                  </div>
                )}
                {r.metrics.school_quality != null && (
                  <div style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Schools: </span><strong style={{ color: 'var(--bg-brand)' }}>{fmt(r.metrics.school_quality, 1)}/10</strong>
                  </div>
                )}
                {r.metrics.transit_accessibility != null && (
                  <div style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transit: </span><strong>{fmt(r.metrics.transit_accessibility, 1)}/10</strong>
                  </div>
                )}
                {r.metrics.vacancy_rate != null && (
                  <div style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Vacancy: </span><strong>{fmt(r.metrics.vacancy_rate)}%</strong>
                  </div>
                )}
                {r.metrics.population_cagr != null && (
                  <div style={{ background: 'rgba(15,23,42,0.03)', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Growth: </span><strong style={{ color: '#f472b6' }}>{fmt(r.metrics.population_cagr, 1)}%pa</strong>
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
                style={{
                  background: 'linear-gradient(135deg, var(--bg-brand)22, #0066ff22)', border: '1px solid var(--bg-brand)44',
                  color: 'var(--bg-brand)', borderRadius: 8, padding: '7px 16px', fontSize: '0.8rem',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(135deg,var(--bg-brand)33,#0066ff33)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(135deg,var(--bg-brand)22,#0066ff22)')}
              >
                📋 Build Full Research Brief →
              </button>
            </div>
          ))}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
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
      <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
        {verdict.framing === 'clear_leader' && personaLeaders.length > 0 && (
          <div style={{ background: 'rgba(0,210,130,0.05)', border: '1px solid rgba(0,210,130,0.15)', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--success)', fontWeight: 700 }}>Verdict by persona</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {personaLeaders.map(p => (
                <span key={p.persona} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,210,130,0.3)', fontSize: '0.82rem', background: 'rgba(0,210,130,0.06)' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{p.persona.replace(/_/g, ' ')}:</strong> {p.leader}
                </span>
              ))}
            </div>
          </div>
        )}
        {tradeoffs.length > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fbbf24', fontWeight: 700 }}>Trade-offs to consider</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {tradeoffs.map((t, i) => <li key={i} style={{ marginBottom: 5, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t}</li>)}
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
      <div style={{ marginBottom: 22, borderTop: '1px solid var(--border-glass)', paddingTop: 16 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 700, padding: 0,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
          aria-expanded={expanded}
        >
          {expanded ? '▾ Hide evidence sources' : '▸ Show evidence sources'} ({evidence.length} metrics)
        </button>
        {expanded && (
          <div style={{ marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>Metric</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'right' }}>Value</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>Source</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>As of</th>
                  <th style={{ ...TH, padding: '6px 10px', textAlign: 'left' }}>Quality</th>
                </tr>
              </thead>
              <tbody>
                {evidence.slice(0, 30).map((e, i) => (
                  <tr key={e.id || i} style={{ background: i % 2 === 0 ? 'rgba(15,23,42,0.01)' : 'transparent' }}>
                    <td style={{ ...TD, padding: '4px 10px', fontWeight: 600 }}>{e.metric}</td>
                    <td style={{ ...TD, padding: '4px 10px', textAlign: 'right' }}>
                      {typeof e.value === 'number' ? (e.unit.includes('$') ? `$${e.value.toLocaleString()}` : e.unit === '%' ? `${e.value.toFixed(2)}%` : e.value.toLocaleString()) : String(e.value ?? '—')}
                    </td>
                    <td style={{ ...TD, padding: '4px 10px', color: 'var(--text-secondary)' }}>{e.source}</td>
                    <td style={{ ...TD, padding: '4px 10px', color: e.is_stale ? 'var(--warning)' : 'var(--text-secondary)' }}>{e.as_of}{e.is_stale ? ' ⚠ stale' : ''}</td>
                    <td style={{ ...TD, padding: '4px 10px', color: e.quality === 'verified' ? 'var(--success)' : 'var(--text-secondary)' }}>{e.quality}</td>
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
      <div style={{ padding: '12px 16px', background: 'rgba(255,180,0,0.08)', borderLeft: '4px solid var(--warning)', borderRadius: '0 8px 8px 0', marginBottom: 20 }}>
        <strong style={{ color: 'var(--warning)', fontSize: '0.88rem' }}>⚠️ Data Quality Alert</strong>
        <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong>{lowSuburbs.map(([id]) => id.split('_')[1]).join(', ')}</strong> has limited verified data coverage.
          Figures may be based on fewer sales or older data points — cross-check with a local agent before acting.
        </p>
      </div>
    );
  };

  return (
    <div data-build="v2-loadingfix" style={{ padding: '28px', marginBottom: '24px', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-card)', maxWidth: 1100, margin: '0 auto 24px' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.55rem', fontWeight: 800 }}>Ask YieldSense ✨</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Natural-language property research powered by verified data — not opinions.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea value={question} onChange={e => setQuestion(e.target.value)}
          placeholder="Describe what you're deciding… e.g. 'Compare Kenmore and Indooroopilly for a $1.5M family home'"
          rows={3} style={{
            width: '100%', padding: '13px 14px', borderRadius: '10px', boxSizing: 'border-box',
            border: '1.5px solid var(--border-glass)', background: 'var(--slate-50)',
            color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical', fontSize: '0.93rem', lineHeight: 1.5, marginBottom: 12,
          }} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} type="button" onClick={() => setQuestion(ex)}
              style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--accent-cyan)', background: 'transparent', color: 'var(--accent-cyan)', fontSize: '0.8rem', cursor: 'pointer' }}>
              {ex}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => setShowScenarios(s => !s)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.83rem' }}>
            {showScenarios ? 'Hide scenario controls' : 'Set budget & income (optional)'}
          </button>
          {showScenarios && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { lbl: 'Budget ($)', val: budget, set: setBudget, step: 50000 },
                { lbl: 'Deposit ($)', val: deposit, set: setDeposit, step: 20000 },
                { lbl: 'Income ($)', val: income, set: setIncome, step: 20000 }
              ].map(({ lbl, val, set, step }) => (
                <div key={lbl}>
                  <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: 4, color: 'var(--text-secondary)' }}>{lbl}</label>
                  <input type="number" step={step} value={val} onChange={e => set(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-glass)', background: 'var(--slate-50)', color: 'var(--text-primary)', width: 120 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" disabled={loading || !question.trim()}
            style={{
              padding: '11px 26px', borderRadius: 8, background: 'var(--accent-cyan)', color: '#000',
              border: 'none', fontWeight: 700, fontSize: '0.93rem',
              cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !question.trim() ? 0.6 : 1, transition: 'opacity 0.2s',
            }}>
            {loading ? 'Researching…' : 'Build research brief'}
          </button>
          {loading && (
            <button type="button" onClick={() => { abortRef.current?.abort(); setLoading(false); }}
              style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Clarifying question */}
      {pendingClarify && !loading && (
        <div style={{ marginTop: 28, padding: '20px 22px', background: 'rgba(0,210,255,0.05)', borderRadius: 12, border: '1px solid rgba(0,210,255,0.18)' }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan)', fontWeight: 700 }}>Follow-up question</p>
          <p style={{ margin: '0 0 14px', fontSize: '0.95rem', lineHeight: 1.6 }}>{pendingClarify.clarifyingQ}</p>
          {(pendingClarify as any).clarification?.options?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {(pendingClarify as any).clarification.options.map((opt: any, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    const fullQ = `${opt.name} ${opt.state || ''}`;
                    setQuestion(fullQ);
                    setPendingClarify(null);
                    callQuery(fullQ);
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent-cyan)',
                    background: 'rgba(0,210,255,0.08)', color: 'var(--accent-cyan)',
                    cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  }}
                >
                  {opt.name}{opt.state ? ` (${opt.state})` : ''}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={clarifyAnswer} onChange={e => setClarifyAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClarify()}
                placeholder="Your answer…"
                style={{ flex: 1, padding: '10px 13px', borderRadius: 8, border: '1px solid var(--border-glass)', background: 'var(--slate-50)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                aria-label="Your answer"
              />
              <button onClick={handleClarify} disabled={!clarifyAnswer.trim()}
                style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent-cyan)', color: '#000', border: 'none', fontWeight: 700, cursor: clarifyAnswer.trim() ? 'pointer' : 'not-allowed', opacity: clarifyAnswer.trim() ? 1 : 0.5 }}>
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div aria-busy="true" aria-label="Loading research brief" style={{ marginTop: 28 }}>
          <BriefSkeleton />
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 12 }}>Pulling verified data and building your research brief…</p>
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" style={{ marginTop: 20, padding: '12px 16px', background: 'var(--status-danger-bg)', borderLeft: '4px solid var(--danger)', borderRadius: '0 8px 8px 0' }}>
          <strong style={{ color: 'var(--danger)' }}>Error: </strong>{error}
        </div>
      )}

      {discoveryResult && !loading && (
        <div aria-live="polite" style={{ marginTop: 28, borderTop: '1px solid var(--border-glass)', paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🗺️ Suburb Discovery Results</h3>
            <button onClick={() => { setDiscoveryResult(null); setQuestion(''); }}
              style={{ background: 'none', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem' }}>
              ↺ New question
            </button>
          </div>
          <DiscoveryCards disc={discoveryResult} />
        </div>
      )}

  {result && !loading && !discoveryResult && (
    <div aria-live="polite" style={{ marginTop: 36, borderTop: '1px solid var(--border-glass)', paddingTop: 28 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 5px', fontSize: '1.15rem' }}>
                {(result as AskResponseV2).headline || 'Research Brief'}
              </h3>
              {(result as AskResponseV2).query_understood?.data_as_of && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>
                  Data as of: {(result as AskResponseV2).query_understood.data_as_of}
                </span>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Status: <strong>{result.status.replace(/_/g, ' ')}</strong>&ensp;|&ensp;Priority:&nbsp;
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.78rem',
                  background: result.research_priority === 'high' ? 'rgba(0,210,130,0.15)' : result.research_priority === 'medium' ? 'rgba(255,180,0,0.12)' : 'rgba(150,150,150,0.1)',
                  color: result.research_priority === 'high' ? 'var(--success)' : result.research_priority === 'medium' ? 'var(--warning)' : 'var(--text-secondary)',
                }}>
                  {result.research_priority.replace(/_/g, ' ').toUpperCase()}
                </span>
              </span>
            </div>
            <button onClick={() => { setResult(null); setQuestion(''); }}
              style={{ background: 'none', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem' }}>
              ↺ New question
            </button>
          </div>

          <DQWarning dq={result.data_quality} />

          {/* AI Summary */}
          <div style={{ background: 'rgba(0,210,255,0.04)', border: '1px solid rgba(0,210,255,0.12)', borderRadius: 10, padding: '16px 20px', marginBottom: 26, lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-cyan)', fontWeight: 700 }}>AI Summary</p>
            <p style={{ margin: 0, fontSize: '0.93rem' }}>{result.summary}</p>
          </div>

          {/* Verdict panel (v2) */}
          <VerdictPanel verdict={(result as AskResponseV2).verdict} />

          {/* Assumptions pills */}
          {result.assumptions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              {result.assumptions.map((a, i) => (
                <span key={i} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-glass)', fontSize: '0.8rem', background: 'rgba(15,23,42,0.02)' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginBottom: 22 }}>
            <div style={{ padding: '16px', background: 'rgba(0,210,130,0.04)', borderRadius: 10, border: '1px solid rgba(0,210,130,0.12)' }}>
              <h4 style={{ margin: '0 0 10px', color: 'var(--success)', fontSize: '0.88rem' }}>✅ What supports this decision</h4>
              {result.supports.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.supports.map((s, i) => <li key={i} style={{ marginBottom: 6, fontSize: '0.86rem', lineHeight: 1.5 }}>{s.claim}</li>)}
                </ul>
              ) : <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.84rem' }}>No positives identified with current data.</p>}
            </div>
            <div style={{ padding: '16px', background: 'rgba(255,60,60,0.04)', borderRadius: 10, border: '1px solid rgba(255,60,60,0.12)' }}>
              <h4 style={{ margin: '0 0 10px', color: '#ff4444', fontSize: '0.88rem' }}>⚠️ Risks & counterarguments</h4>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.risks.map((r, i) => <li key={i} style={{ marginBottom: 6, fontSize: '0.86rem', lineHeight: 1.5 }}>{r.claim}</li>)}
              </ul>
            </div>
          </div>

          {/* Unknowns + Next steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginBottom: 26 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Material unknowns</h4>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.unknowns.map((u, i) => <li key={i} style={{ marginBottom: 5, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{u}</li>)}
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Your next actions</h4>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {result.next_steps.map((n, i) => <li key={i} style={{ marginBottom: 5, fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.5 }}>{n}</li>)}
              </ol>
            </div>
          </div>

          {/* Follow-up chips */}
          <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ask a follow-up:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

          <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', borderTop: '1px dashed var(--border-glass)', paddingTop: 14 }}>
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

