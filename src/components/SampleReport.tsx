import React, { useState, useEffect } from 'react';
import { ComparisonDisplay } from './ask/ComparisonDisplay';
import { ReasoningMap } from './ask/ReasoningMap';
import { ConfidenceGauge } from './ask/ConfidenceGauge';
import '../styles/SampleReport.css';

interface SampleReportData {
  id: string;
  title: string;
  description: string;
  query: string;
  response: any;
}

export const SampleReport: React.FC<{ reportId: string; onBack?: () => void }> = ({ reportId, onBack }) => {
  const [data, setData] = useState<SampleReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v3/ask/sample-report/${reportId}`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [reportId]);

  if (loading) return (
    <div className="sr-loading">
      <div className="sr-spinner" />
      <p>Generating sample report...</p>
    </div>
  );

  if (error) return (
    <div className="sr-error">
      <p>Failed to load report: {error}</p>
      {onBack && <button onClick={onBack} className="sr-back">← Back</button>}
    </div>
  );

  if (!data) return null;

  const r = data.response;
  const chain = r.reasoning_chain;
  const discovery = r.discovery;
  const comparisons = r.comparison || [];
  const evidence = r.evidence || [];
  const verdict = r.verdict;

  const fmtPrice = (v: number | null | undefined) => v != null ? `$${(v/1000).toFixed(0)}k` : '—';
  const fmt = (v: number | null | undefined, d = 2, s = '') => v != null ? `${v.toFixed(d)}${s}` : '—';

  return (
    <div className="sr">
      {/* Print header */}
      <div className="sr__print-header">
        <div className="sr__brand">PropertyIQ</div>
        <div className="sr__report-type">Suburb Research Report</div>
        <div className="sr__date">{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      {onBack && (
        <button onClick={onBack} className="sr-back">← Back to samples</button>
      )}

      {/* Title */}
      <div className="sr__title-block">
        <h1 className="sr__title">{data.title}</h1>
        <p className="sr__description">{data.description}</p>
        <p className="sr__query"><strong>Query:</strong> "{data.query}"</p>
      </div>

      {/* Confidence + summary */}
      {chain && (
        <div className="sr__confidence-row">
          <ConfidenceGauge score={chain.aggregate_confidence} size="lg" label="Aggregate Confidence" />
          <div className="sr__summary-block">
            <h3>Executive Summary</h3>
            <p>{r.summary || r.headline}</p>
            <div className="sr__meta">
              <span>Priority: <strong>{(r.research_priority || '').replace(/_/g,' ').toUpperCase()}</strong></span>
              <span>•</span>
              <span>Status: <strong>{(r.status || '').replace(/_/g,' ')}</strong></span>
              {chain && <><span>•</span><span>{chain.total_latency_ms.toFixed(0)}ms total</span></>}
            </div>
          </div>
        </div>
      )}

      {/* Discovery results (graph/PostGIS) */}
      {discovery && discovery.results && discovery.results.length > 0 && (
        <div className="sr__section">
          <h2 className="sr__section-title">🗺️ Discovery Results</h2>
          <p className="sr__section-desc">{discovery.summary}</p>
          <div className="sr__discovery-grid">
            {discovery.results.map((res: any, i: number) => (
              <div key={i} className="sr__discovery-card">
                <div className="sr__discovery-rank">#{i + 1}</div>
                <h3 className="sr__discovery-name">{res.name}</h3>
                <span className="sr__discovery-state">{res.state}{res.postcode ? ` • ${res.postcode}` : ''}</span>
                <div className="sr__discovery-metrics">
                  {res.metrics?.median_price != null && <span>Price: <strong>{fmtPrice(res.metrics.median_price)}</strong></span>}
                  {res.metrics?.yield_pct != null && <span>Yield: <strong>{fmt(res.metrics.yield_pct)}%</strong></span>}
                  {res.metrics?.school_quality != null && <span>Schools: <strong>{fmt(res.metrics.school_quality,1)}/10</strong></span>}
                  {res.metrics?.vacancy_rate != null && <span>Vacancy: <strong>{fmt(res.metrics.vacancy_rate)}%</strong></span>}
                </div>
                {res.why_selected && res.why_selected.length > 0 && (
                  <ul className="sr__why-selected">
                    {res.why_selected.map((w: string, j: number) => <li key={j}>{w}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {discovery.trace_log && (
            <details className="sr__trace">
              <summary>Data Lineage Trace</summary>
              <pre>{discovery.trace_log.query}</pre>
            </details>
          )}
        </div>
      )}

      {/* Comparison table */}
      {comparisons.length > 0 && (
        <div className="sr__section">
          <h2 className="sr__section-title">📊 Side-by-Side Comparison</h2>
          <ComparisonDisplay comparisons={comparisons} evidence={evidence} />
        </div>
      )}

      {/* Verdict */}
      {verdict && (
        <div className="sr__section">
          <h2 className="sr__section-title">⚖️ Verdict & Trade-offs</h2>
          <div className="sr__verdict">
            <div className="sr__verdict-framing">
              <strong>Framing:</strong> {verdict.framing?.replace(/_/g,' ')}
            </div>
            {verdict.by_persona?.length > 0 && (
              <div className="sr__persona-verdicts">
                {verdict.by_persona.filter((p:any) => p.leader).map((p:any, i:number) => (
                  <span key={i} className="sr__persona-tag">
                    <strong>{p.persona?.replace(/_/g,' ')}:</strong> {p.leader}
                  </span>
                ))}
              </div>
            )}
            {verdict.tradeoffs?.length > 0 && (
              <div className="sr__tradeoffs">
                <h4>Key Trade-offs</h4>
                <ul>
                  {verdict.tradeoffs.map((t:string, i:number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk metrics highlight */}
      {evidence.length > 0 && (
        <div className="sr__section">
          <h2 className="sr__section-title">⚠️ Risk Analysis</h2>
          <div className="sr__risk-grid">
            {evidence.filter((e:any) =>
              ['Price Volatility (10yr)','Risk-Adj. Return (Sharpe)','Vacancy Rate','Investor Concentration','Days on Market'].includes(e.metric)
            ).map((e:any, i:number) => (
              <div key={i} className="sr__risk-item">
                <span className="sr__risk-label">{e.metric}</span>
                <span className="sr__risk-value">
                  {typeof e.value === 'number'
                    ? (e.unit === '%' ? `${e.value.toFixed(2)}%` : e.unit === 'days' ? `${e.value.toFixed(0)} days` : e.value.toFixed(2))
                    : String(e.value ?? '—')}
                </span>
                <span className="sr__risk-source">{e.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supports & Risks */}
      {(r.supports?.length > 0 || r.risks?.length > 0) && (
        <div className="sr__section sr__supports-risks">
          <div className="sr__supports">
            <h3>✅ Supporting Factors</h3>
            <ul>
              {(r.supports || []).map((s:any, i:number) => <li key={i}>{s.claim || s.description || s}</li>)}
            </ul>
          </div>
          <div className="sr__risks-col">
            <h3>⚠️ Risk Factors</h3>
            <ul>
              {(r.risks || []).map((s:any, i:number) => <li key={i}>{s.claim || s.description || s}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Reasoning chain */}
      {chain && (
        <div className="sr__section">
          <h2 className="sr__section-title">🔍 Reasoning Trace</h2>
          <ReasoningMap chain={chain} />
        </div>
      )}

      {/* Evidence table */}
      {evidence.length > 0 && (
        <div className="sr__section">
          <details className="sr__evidence-details">
            <summary>Evidence Sources ({evidence.length} metrics)</summary>
            <table className="sr__evidence-table">
              <thead>
                <tr>
                  <th>Metric</th><th>Value</th><th>Source</th><th>As of</th><th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {evidence.slice(0,40).map((e:any, i:number) => (
                  <tr key={i}>
                    <td>{e.metric}</td>
                    <td>{typeof e.value === 'number'
                      ? (e.unit?.includes('$') ? `$${e.value.toLocaleString()}` : e.unit === '%' ? `${e.value.toFixed(2)}%` : e.value.toLocaleString())
                      : String(e.value ?? '—')}</td>
                    <td>{e.source}</td>
                    <td style={{color: e.is_stale ? 'var(--warning)' : 'inherit'}}>{e.as_of}{e.is_stale ? ' ⚠' : ''}</td>
                    <td>{e.quality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      {/* Footer */}
      <div className="sr__footer">
        <p><strong>Disclaimer:</strong> {r.disclaimer || 'General research only — not financial, legal, tax, lending or valuation advice.'}</p>
        <p className="sr__footer-meta">
          Report ID: {r.request_id} • Generated: {new Date().toLocaleString('en-AU')} •
          Pipeline: {r.versions?.pipeline || 'ask-v2'} •
          Data sources: ABS, ACARA, OSM, SQM Research, CoreLogic/NPG
        </p>
        <p className="sr__footer-brand">PropertyIQ — Transparent Australian suburb research.</p>
      </div>
    </div>
  );
};
