import React, { useState } from 'react';
import { ConfidenceGauge } from './ConfidenceGauge';
import './ReasoningMap.css';

interface ReasoningHop {
  step: string;
  input_summary: string;
  output_summary: string;
  confidence: number;
  data_sources: string[];
  decision_rationale: string;
  artifacts?: Record<string, any> | null;
  latency_ms: number;
}

interface MultiHopTrace {
  hops: ReasoningHop[];
  aggregate_confidence: number;
  total_latency_ms: number;
}

interface AdjustmentState {
  budget?: number;
  priorities?: string[];
  suburbs?: string[];
  persona_weights?: Record<string, number>;
}

interface ReasoningMapProps {
  chain: MultiHopTrace;
  onAdjust?: (adjustments: AdjustmentState) => void;
  adjusting?: boolean;
}

const STEP_LABELS: Record<string, string> = {
  guardrails: 'Guardrails',
  intent_parsing: 'Intent',
  multi_turn_merge: 'Context',
  clarification: 'Clarify',
  routing: 'Route',
  discovery: 'Discover',
  evidence: 'Evidence',
  verdict: 'Verdict',
  synthesis: 'Synthesis',
  policy: 'Policy',
};

const STEP_ICONS: Record<string, string> = {
  guardrails: '🛡️',
  intent_parsing: '🧠',
  multi_turn_merge: '🔄',
  clarification: '❓',
  routing: '🔀',
  discovery: '🗺️',
  evidence: '📊',
  verdict: '⚖️',
  synthesis: '✨',
  policy: '✅',
};

const STEP_ORDER = [
  'guardrails', 'intent_parsing', 'multi_turn_merge', 'clarification',
  'routing', 'discovery', 'evidence', 'verdict', 'synthesis', 'policy',
];

function confidenceColor(c: number): string {
  if (c >= 0.85) return 'var(--success)';
  if (c >= 0.65) return 'var(--bg-brand)';
  if (c >= 0.45) return 'var(--warning)';
  return 'var(--danger)';
}

function confidenceBg(c: number): string {
  if (c >= 0.85) return 'rgba(16,185,129,0.08)';
  if (c >= 0.65) return 'rgba(163,230,53,0.08)';
  if (c >= 0.45) return 'rgba(245,158,11,0.08)';
  return 'rgba(239,68,68,0.06)';
}

function stepLabel(step: string): string {
  return STEP_LABELS[step] || step.replace(/_/g, ' ');
}

function stepIcon(step: string): string {
  return STEP_ICONS[step] || '•';
}

function sortHops(hops: ReasoningHop[]): ReasoningHop[] {
  return [...hops].sort((a, b) => {
    const ai = STEP_ORDER.indexOf(a.step);
    const bi = STEP_ORDER.indexOf(b.step);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export const ReasoningMap: React.FC<ReasoningMapProps> = ({ chain, onAdjust, adjusting }) => {
  const [expandedHop, setExpandedHop] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const sorted = sortHops(chain.hops);

  // ── Adjustment state for interactive refinement ──
  const [adjBudget, setAdjBudget] = useState<string>('');
  const [adjPriorities, setAdjPriorities] = useState<string[]>([]);
  const [adjSuburbs, setAdjSuburbs] = useState<string>('');
  const [adjGrowthWeight, setAdjGrowthWeight] = useState(50);
  const [adjCashflowWeight, setAdjCashflowWeight] = useState(50);

  const intentHop = sorted.find(h => h.step === 'intent_parsing');
  const verdictHop = sorted.find(h => h.step === 'verdict');

  const handleAdjust = () => {
    if (!onAdjust) return;
    const adjustments: AdjustmentState = {};
    if (adjBudget) adjustments.budget = Number(adjBudget);
    if (adjPriorities.length) adjustments.priorities = adjPriorities;
    if (adjSuburbs) adjustments.suburbs = adjSuburbs.split(',').map(s => s.trim()).filter(Boolean);
    if (verdictHop) {
      adjustments.persona_weights = {
        growth: adjGrowthWeight / 100,
        cashflow: adjCashflowWeight / 100,
      };
    }
    onAdjust(adjustments);
  };

  if (!chain.hops.length) return null;

  return (
    <div className="rm" style={{ marginTop: 20, marginBottom: 24 }}>
      {/* Header with aggregate confidence */}
      <div className="rm__header">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rm__toggle"
          aria-expanded={!collapsed}
        >
          <span className="rm__toggle-icon">{collapsed ? '▸' : '▾'}</span>
          <span className="rm__title">Reasoning Trace</span>
          <span className="rm__hop-count">{chain.hops.length} steps</span>
        </button>
        <div className="rm__aggregate">
          <ConfidenceGauge score={chain.aggregate_confidence} size="sm" label="" />
          <span className="rm__latency">{chain.total_latency_ms.toFixed(0)}ms total</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Pipeline flow */}
          <div className="rm__pipeline">
            {sorted.map((hop, idx) => {
              const isExpanded = expandedHop === hop.step;
              const c = hop.confidence;
              const color = confidenceColor(c);
              const bg = confidenceBg(c);

              return (
                <React.Fragment key={hop.step}>
                  {idx > 0 && (
                    <div className="rm__connector">
                      <svg width="24" height="24" viewBox="0 0 24 24">
                        <line x1="0" y1="12" x2="24" y2="12" stroke="rgba(15,23,42,0.12)" strokeWidth="2" />
                        <polygon points="20,8 24,12 20,16" fill="rgba(15,23,42,0.15)" />
                      </svg>
                    </div>
                  )}

                  <div
                    className={`rm__hop ${isExpanded ? 'rm__hop--expanded' : ''}`}
                    style={{ borderColor: color, background: isExpanded ? bg : 'transparent' }}
                  >
                    {/* Hop node button */}
                    <button
                      className="rm__hop-btn"
                      onClick={() => setExpandedHop(isExpanded ? null : hop.step)}
                      style={{ borderLeftColor: color }}
                      aria-expanded={isExpanded}
                    >
                      <span className="rm__hop-icon">{stepIcon(hop.step)}</span>
                      <span className="rm__hop-label">{stepLabel(hop.step)}</span>
                      <span className="rm__hop-conf" style={{ color, background: bg }}>
                        {(c * 100).toFixed(0)}%
                      </span>
                      <span className="rm__hop-chevron">{isExpanded ? '▾' : '▸'}</span>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="rm__detail">
                        <div className="rm__detail-row">
                          <span className="rm__detail-key">Input</span>
                          <span className="rm__detail-val">{hop.input_summary}</span>
                        </div>
                        <div className="rm__detail-row">
                          <span className="rm__detail-key">Output</span>
                          <span className="rm__detail-val">{hop.output_summary}</span>
                        </div>
                        <div className="rm__detail-row">
                          <span className="rm__detail-key">Rationale</span>
                          <span className="rm__detail-val rm__detail-rationale">{hop.decision_rationale}</span>
                        </div>
                        {hop.data_sources.length > 0 && (
                          <div className="rm__detail-row">
                            <span className="rm__detail-key">Sources</span>
                            <span className="rm__detail-val">
                              {hop.data_sources.map((s, i) => (
                                <span key={i} className="rm__source-tag">{s}</span>
                              ))}
                            </span>
                          </div>
                        )}
                        <div className="rm__detail-meta">
                          <span>{(hop.latency_ms || 0).toFixed(0)}ms</span>
                          <span>•</span>
                          <span>{(hop.confidence * 100).toFixed(0)}% confidence</span>
                        </div>

                        {/* ── Interactive refinement per hop ── */}
                        {hop.step === 'intent_parsing' && onAdjust && (
                          <div className="rm__adjust">
                            <p className="rm__adjust-title">Adjust intent & re-run</p>
                            <div className="rm__adjust-fields">
                              <label className="rm__adjust-label">
                                Budget ($)
                                <input
                                  type="number"
                                  value={adjBudget}
                                  onChange={e => setAdjBudget(e.target.value)}
                                  placeholder={intentHop?.artifacts?.budget ? `$${intentHop.artifacts.budget}` : 'e.g. 900000'}
                                  className="rm__adjust-input"
                                />
                              </label>
                              <label className="rm__adjust-label">
                                Suburbs (comma-separated)
                                <input
                                  type="text"
                                  value={adjSuburbs}
                                  onChange={e => setAdjSuburbs(e.target.value)}
                                  placeholder="e.g. Kenmore, Indooroopilly"
                                  className="rm__adjust-input"
                                />
                              </label>
                              <div className="rm__adjust-label">
                                <span>Priorities</span>
                                <div className="rm__adjust-chips">
                                  {['affordability', 'cashflow', 'growth', 'schools', 'transit', 'safety'].map(p => (
                                    <button
                                      key={p}
                                      className={`rm__chip ${adjPriorities.includes(p) ? 'rm__chip--active' : ''}`}
                                      onClick={() => setAdjPriorities(prev =>
                                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                      )}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {hop.step === 'verdict' && onAdjust && (
                          <div className="rm__adjust">
                            <p className="rm__adjust-title">Adjust persona weights</p>
                            <div className="rm__adjust-fields">
                              <label className="rm__adjust-label">
                                Growth weight: {adjGrowthWeight}%
                                <input
                                  type="range"
                                  min={0} max={100}
                                  value={adjGrowthWeight}
                                  onChange={e => setAdjGrowthWeight(Number(e.target.value))}
                                  className="rm__adjust-slider"
                                />
                              </label>
                              <label className="rm__adjust-label">
                                Cashflow weight: {adjCashflowWeight}%
                                <input
                                  type="range"
                                  min={0} max={100}
                                  value={adjCashflowWeight}
                                  onChange={e => setAdjCashflowWeight(Number(e.target.value))}
                                  className="rm__adjust-slider"
                                />
                              </label>
                            </div>
                          </div>
                        )}

                        {(hop.step === 'intent_parsing' || hop.step === 'verdict') && onAdjust && (
                          <button
                            className="rm__rerun-btn"
                            onClick={handleAdjust}
                            disabled={adjusting}
                          >
                            {adjusting ? 'Re-running…' : '⟳ Re-run with adjustments'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Mobile: stacked list instead of horizontal pipeline */}
          <div className="rm__mobile-list">
            {sorted.map(hop => {
              const isExpanded = expandedHop === hop.step;
              const color = confidenceColor(hop.confidence);
              return (
                <div key={hop.step} className={`rm__mobile-hop ${isExpanded ? 'rm__mobile-hop--expanded' : ''}`}>
                  <button
                    className="rm__mobile-hop-btn"
                    onClick={() => setExpandedHop(isExpanded ? null : hop.step)}
                    style={{ borderLeft: `3px solid ${color}` }}
                    aria-expanded={isExpanded}
                  >
                    <span className="rm__hop-icon">{stepIcon(hop.step)}</span>
                    <span className="rm__hop-label">{stepLabel(hop.step)}</span>
                    <span className="rm__hop-conf" style={{ color, background: confidenceBg(hop.confidence) }}>
                      {(hop.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="rm__hop-chevron">{isExpanded ? '▾' : '▸'}</span>
                  </button>
                  {isExpanded && (
                    <div className="rm__detail" style={{ borderTop: 'none' }}>
                      <div className="rm__detail-row">
                        <span className="rm__detail-key">Output</span>
                        <span className="rm__detail-val">{hop.output_summary}</span>
                      </div>
                      <div className="rm__detail-row">
                        <span className="rm__detail-key">Rationale</span>
                        <span className="rm__detail-val rm__detail-rationale">{hop.decision_rationale}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
