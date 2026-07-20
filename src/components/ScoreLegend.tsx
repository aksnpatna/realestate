/**
 * ScoreLegend.tsx — Plain-English legend for the three scores surfaced in the app.
 *
 * Sources its metadata from the backend `/api/scores/meta` so labels stay in sync
 * with intent. Falls back to local defaults if the endpoint is unavailable, so the
 * UI never breaks on a network failure (consistent with the app's resilience rules).
 *
 * Used either inline as a small expandable control on each score, or as a full
 * legend panel the user can reveal to understand every number they are seeing.
 */
import { useEffect, useState, memo } from 'react';

export interface ScoreMeta {
  name: string;
  range: string;
  meaning: string;
  caveat: string;
  disclaimer_key?: string;
}

export interface GrowthFactorLabeled {
  key: string;
  label: string;
  impact: string;
  value: number;
  max: number | null;
}

const LOCAL_FALLBACK: Record<string, ScoreMeta> = {
  growth: {
    name: 'Market Momentum',
    range: '0-92',
    meaning:
      'A deterministic composite of realised price growth, population, yield, demand/supply, vacancy and sentiment.',
    caveat:
      'Not a price forecast. Not a calibrated probability. Past growth does not guarantee future returns.',
    disclaimer_key: 'growth_score',
  },
  buyer_fit: {
    name: 'Fit For Your Inputs',
    range: '0-100',
    meaning:
      'How well this suburb fits YOUR budget, serviceability and stated preferences. Personalised, not market-wide.',
    caveat: 'Only meaningful for the inputs you entered. Not a recommendation to buy.',
    disclaimer_key: 'buyer_fit',
  },
  dq: {
    name: 'Data Confidence',
    range: '0-100',
    meaning:
      'How complete and reliable the underlying data is for THIS suburb, not the suburb quality.',
    caveat: 'A low score means verify with other sources before acting, not that the suburb is bad.',
    disclaimer_key: 'dq_score',
  },
};

let _cachedScores: Record<string, ScoreMeta> | null = null;

export async function fetchScoreMeta(): Promise<Record<string, ScoreMeta> | null> {
  if (_cachedScores) return _cachedScores;
  try {
    const r = await fetch('/api/scores/meta');
    if (!r.ok) return null;
    const data = await r.json();
    _cachedScores = data?.scores ?? null;
    return _cachedScores;
  } catch {
    return null;
  }
}

interface InlineHintProps {
  scoreKey: 'growth' | 'buyer_fit' | 'dq';
  value: number | null;
  compact?: boolean;
}

/** Small inline "?" tooltip showing what a single score means. */
export const ScoreInlineHint = memo(function ScoreInlineHint({
  scoreKey,
  value,
  compact,
}: InlineHintProps) {
  const [meta, setMeta] = useState<ScoreMeta | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchScoreMeta().then(scores => {
      setMeta((scores?.[scoreKey] ?? LOCAL_FALLBACK[scoreKey]) ?? null);
    });
  }, [scoreKey]);

  if (!meta) return null;
  const label = compact ? meta.name : `${meta.name} (${meta.range})`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '6px', position: 'relative' }}>
      <button
        type="button"
        aria-label={`What does ${meta.name} mean?`}
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-secondary)',
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: '20px',
            left: '0',
            zIndex: 50,
            width: '240px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '0.72rem',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            lineHeight: 1.4,
            textAlign: 'left',
          }}
        >
          <strong style={{ color: 'var(--accent-cyan)' }}>{label}</strong>
          <div style={{ marginTop: '4px' }}>{meta.meaning}</div>
          <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {meta.caveat}
          </div>
          {value != null && (
            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              This suburb: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(value)}</strong>
            </div>
          )}
        </span>
      )}
    </span>
  );
});

interface FullLegendProps {
  growthFactors?: GrowthFactorLabeled[];
}

/** Full panel showing every score + the labeled drivers behind Market Momentum. */
export const ScoreLegendPanel = memo(function ScoreLegendPanel({ growthFactors }: FullLegendProps) {
  const [scores, setScores] = useState<Record<string, ScoreMeta> | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchScoreMeta().then(s => setScores(s ?? LOCAL_FALLBACK));
  }, []);

  if (dismissed) return null;
  const meta = scores ?? LOCAL_FALLBACK;
  const ordered: Array<{ key: string; m: ScoreMeta }> = [
    { key: 'growth', m: meta.growth },
    { key: 'buyer_fit', m: meta.buyer_fit },
    { key: 'dq', m: meta.dq },
  ];

  return (
    <div
      className="glass-card"
      style={{ padding: '14px', marginBottom: '16px', animation: 'fadeIn 0.3s' }}
      data-testid="score-legend-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Score Legend</h3>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          ×
        </button>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
        This app shows three different numbers. Each measures something different — they are never interchangeable.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
        {ordered.map(({ key, m }) => (
          <div
            key={key}
            style={{
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong style={{ color: 'var(--accent-cyan)' }}>{m.name}</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{m.range}</span>
            </div>
            <div style={{ fontSize: '0.78rem', marginTop: '3px' }}>{m.meaning}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '3px' }}>
              {m.caveat}
            </div>
          </div>
        ))}
      </div>
      {growthFactors && growthFactors.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '10px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem' }}>Market Momentum drivers (this suburb)</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {growthFactors
              .filter(f => f.value !== 0 || f.key === 'base')
              .map(f => (
                <div
                  key={f.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                  <span>
                    <strong>{typeof f.value === 'number' ? (f.value > 0 ? '+' : '') + f.value : f.value}</strong>
                    {f.max ? <span style={{ color: 'var(--text-secondary)', marginLeft: '3px' }}>/ {f.max}</span> : null}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default ScoreLegendPanel;
