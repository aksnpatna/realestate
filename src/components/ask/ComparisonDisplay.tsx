import React from 'react';
import './ComparisonDisplay.css';

interface SuburbMetric {
  label: string; value: number | null; unit: string; is_stale: boolean;
  explanation?: string;
}
interface SuburbComparison {
  suburb_id: string; name: string; metrics: SuburbMetric[];
}

interface MetricExplanation { label: string; good: boolean | null; text: string; }

type ExplainerFn = (val: number | string, unit: string) => MetricExplanation;
const METRIC_EXPLAINERS: Record<string, ExplainerFn> = {
  'Median House Price': (v) => ({ label: 'Median House Price', good: null,
    text: `At $${((v as number) / 1000).toFixed(0)}k, ${(v as number) > 1_500_000 ? 'this is a premium suburb — high entry cost but typically strong liquidity and price resilience.' : (v as number) > 900_000 ? 'this is a mid-to-upper tier suburb with a broad but selective buyer pool.' : 'this is relatively accessible, with strong owner-occupier and first-home-buyer interest.'}` }),
  'Median Unit Price': (v) => ({ label: 'Median Unit Price', good: null,
    text: `Units at $${((v as number) / 1000).toFixed(0)}k. ${(v as number) > 700_000 ? 'Premium unit market — check strata levies carefully before committing.' : 'Relatively accessible for units.'}` }),
  'Median House Rent': (v) => ({ label: 'Weekly Rent', good: (v as number) > 600,
    text: `$${(v as number).toFixed(0)}/week. ${(v as number) > 900 ? 'Very strong rental demand — landlord pricing power is high.' : (v as number) > 600 ? 'Solid rent achievable — healthy tenant pool keeps vacancies low.' : 'Below-average rent may compress yields and cashflow.'}` }),
  'Gross House Yield': (v) => ({ label: 'Gross Yield', good: (v as number) >= 4,
    text: `${(v as number).toFixed(2)}% gross yield. ${(v as number) >= 5 ? 'Excellent — likely close to cash-flow neutral or positive after expenses.' : (v as number) >= 4 ? 'Acceptable — will need top-up from salary but manageable for most investors.' : (v as number) >= 3 ? 'Low yield — common in high-growth suburbs. Plan for ongoing out-of-pocket costs.' : 'Very low yield — this is almost purely a capital growth play; cashflow will be negative.'}` }),
  'Vacancy Rate': (v) => ({ label: 'Vacancy Rate', good: (v as number) < 3,
    text: `${(v as number).toFixed(2)}% vacancy. ${(v as number) < 1 ? 'Critically tight — strong upward rent pressure, very low risk of extended vacancy.' : (v as number) < 2 ? 'Tight rental market — landlords have meaningful pricing power.' : (v as number) < 3 ? 'Healthy balance — competitive but not oversupplied.' : (v as number) < 5 ? 'Elevated vacancy — negotiating power shifts to tenants; factor in potential rent discounts.' : 'High vacancy — significant oversupply risk. Avoid for pure investment.'}` }),
  'Population 5Yr CAGR': (v) => ({ label: 'Population Growth (5yr CAGR)', good: (v as number) > 2,
    text: `${(v as number).toFixed(1)}%/year population growth. ${(v as number) > 8 ? 'Exceptional — infrastructure demand and price support are very strong.' : (v as number) > 5 ? 'Above-average — good long-term demand fundamentals.' : (v as number) > 2 ? 'Solid steady growth — supports price stability and tenant demand.' : (v as number) > 0 ? 'Modest growth — stable but limited demand uplift.' : 'Population stagnant or declining — a meaningful demand risk.'}` }),
  'Investor Rate': (v) => ({ label: 'Investor Concentration', good: (v as number) < 40,
    text: `${(v as number).toFixed(0)}% investor-owned. ${(v as number) > 60 ? 'Very high — vulnerable to mass sell-off if sentiment or interest rates shift.' : (v as number) > 40 ? 'Moderate-high investor presence — monitor supply pipeline closely.' : (v as number) < 20 ? 'Owner-occupier dominated — typically price-stable with lower volatility.' : 'Healthy mix of investors and owner-occupiers.'}` }),
  'AI News Sentiment': (v) => ({ label: 'AI News Sentiment', good: v === 'Bullish',
    text: `AI sentiment analysis of recent market news. ${v === 'Bullish' ? 'Positive momentum or infrastructure news detected.' : v === 'Bearish' ? 'Negative catalysts or oversupply risks mentioned in recent media.' : 'Neutral or mixed sentiment in recent news.'}` }),
};

function explainMetric(m: SuburbMetric): MetricExplanation | null {
  const fn = METRIC_EXPLAINERS[m.label];
  return fn ? fn(m.value as any, m.unit) : null;
}

function formatValue(m: SuburbMetric): string {
  if (m.value === null) return '—';
  if (typeof m.value === 'string') return m.value;
  if (m.unit === '$') return `$${m.value.toLocaleString()}`;
  if (m.unit === '$/week') return `$${m.value.toFixed(0)}/wk`;
  if (m.unit === '%') return `${m.value.toFixed(2)}%`;
  return String(m.value);
}

function getWinner(metricLabel: string, comparisons: SuburbComparison[]): string | null {
  if (comparisons.length < 2) return null;
  const lowerBetter = ['Vacancy Rate', 'Investor Rate'];
  const vals = comparisons.map(c => ({ name: c.name, v: c.metrics.find(m => m.label === metricLabel)?.value ?? null }));
  if (vals.some(x => x.v === null)) return null;
  if (typeof vals[0].v === 'string') return null;
  if (vals[0].v === vals[1].v) return 'tie';
  const best = lowerBetter.includes(metricLabel)
    ? vals.reduce((a, b) => (a.v as number) < (b.v as number) ? a : b)
    : vals.reduce((a, b) => (a.v as number) > (b.v as number) ? a : b);
  return best.name;
}

export const ComparisonDisplay: React.FC<{
  comparisons: SuburbComparison[];
  evidence?: any[];
}> = ({ comparisons, evidence }) => {
  if (!comparisons.length) return null;
  const metrics = comparisons[0].metrics;
  const multi = comparisons.length > 1;

  return (
    <div className="cd">
      <p className="cd__title">
        Side-by-side comparison {multi && '· Winner highlighted'}
      </p>

      {/* ── Desktop table ── */}
      <div className="cd__desktop">
        <table className="cd__table">
          <thead>
            <tr>
              <th>Metric</th>
              {comparisons.map(c => <th key={c.suburb_id}>{c.name}</th>)}
              {multi && <th>Edge</th>}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, idx) => {
              const winner = getWinner(m.label, comparisons);
              const exp = explainMetric(m);
              const ev = evidence?.find(e => e.metric === m.label);
              return (
                <React.Fragment key={m.label}>
                  <tr className={idx % 2 === 0 ? 'cd__row--zebra' : ''}>
                    <td className="cd__metric-label">
                      {exp?.label ?? m.label}
                      {ev?.as_of && <span className="cd__verified">Verified {ev.as_of}</span>}
                      {m.is_stale && <span className="cd__stale">stale data</span>}
                    </td>
                    {comparisons.map(c => {
                      const cm = c.metrics.find(x => x.label === m.label);
                      const isW = winner === c.name;
                      return (
                        <td key={c.suburb_id} className={`cd__value ${isW ? 'cd__value--winner' : ''}`}>
                          {cm ? formatValue(cm) : '—'}{isW && multi ? ' ✓' : ''}
                        </td>
                      );
                    })}
                    {multi && (
                      <td className={`cd__edge ${winner && winner !== 'tie' ? 'cd__edge--winner' : ''}`}>
                        {winner === 'tie' ? 'Tie' : winner ?? '—'}
                      </td>
                    )}
                  </tr>
                  {exp && (
                    <tr className="cd__explainer-row">
                      <td colSpan={comparisons.length + (multi ? 2 : 1)}>
                        <span className={`cd__explainer ${exp.good === true ? 'cd__explainer--good' : exp.good === false ? 'cd__explainer--bad' : ''}`}>
                          {exp.text}
                        </span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (snap-scroll) ── */}
      <div className="cd__mobile" aria-label="Comparison cards">
        {comparisons.map((suburb) => (
          <div key={suburb.suburb_id} className="cd-card">
            <h3 className="cd-card__name">{suburb.name}</h3>
            <div className="cd-card__metrics">
              {metrics.map(m => {
                const cm = suburb.metrics.find(x => x.label === m.label);
                const winner = getWinner(m.label, comparisons);
                const isW = winner === suburb.name;
                const exp = explainMetric(m);
                const ev = evidence?.find(e => e.metric === m.label);
                return (
                  <div key={m.label} className={`cd-card__row ${m.is_stale ? 'cd-card__row--stale' : ''}`}>
                    <div className="cd-card__row-label">
                      {exp?.label ?? m.label}
                      {isW && multi && <span className="cd-card__best">Best</span>}
                      {ev?.as_of && <span className="cd__verified">Verified</span>}
                    </div>
                    <div className={`cd-card__row-value ${isW ? 'cd-card__row-value--winner' : ''}`}>
                      {cm ? formatValue(cm) : '—'}
                    </div>
                    {exp && (
                      <div className={`cd-card__row-exp ${exp.good === true ? 'cd-card__row-exp--good' : exp.good === false ? 'cd-card__row-exp--bad' : ''}`}>
                        {exp.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
