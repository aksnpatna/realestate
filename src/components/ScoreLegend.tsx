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
    <span className="u-134ac6e2">
      <button
        type="button"
        aria-label={`What does ${meta.name} mean?`}
        onClick={() => setOpen(o => !o)}
        className="u-2267f0c3"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="u-80cf4558"
        >
          <strong className="u-d03afae3">{label}</strong>
          <div className="u-073259d9">{meta.meaning}</div>
          <div className="u-c496d3a7">
            {meta.caveat}
          </div>
          {value != null && (
            <div className="u-3a8b0b2c">
              This suburb: <strong className="u-c154f6c6">{Math.round(value)}</strong>
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
      className="glass-card u-dda199cc"
      data-testid="score-legend-panel"
    >
      <div className="u-69f9d299">
        <h3 className="u-b5fda34d">Score Legend</h3>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="u-3f29a9d5"
        >
          ×
        </button>
      </div>
      <p className="u-f7c5ce41">
        This app shows three different numbers. Each measures something different — they are never interchangeable.
      </p>
      <div className="u-138a9a93">
        {ordered.map(({ key, m }) => (
          <div
            key={key}
            className="u-8e63dd34"
          >
            <div className="u-0b9a8f0f">
              <strong className="u-d03afae3">{m.name}</strong>
              <span className="u-af9b3a94">{m.range}</span>
            </div>
            <div className="u-9cdead24">{m.meaning}</div>
            <div className="u-d8d7ffb0">
              {m.caveat}
            </div>
          </div>
        ))}
      </div>
      {growthFactors && growthFactors.length > 0 && (
        <div className="u-b8adc50b">
          <h4 className="u-712f20a9">Market Momentum drivers (this suburb)</h4>
          <div className="u-ac060ff3">
            {growthFactors
              .filter(f => f.value !== 0 || f.key === 'base')
              .map(f => (
                <div
                  key={f.key}
                  className="u-49a21d58"
                >
                  <span className="u-c7477801">{f.label}</span>
                  <span>
                    <strong>{typeof f.value === 'number' ? (f.value > 0 ? '+' : '') + f.value : f.value}</strong>
                    {f.max ? <span className="u-56fd35b0">/ {f.max}</span> : null}
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
