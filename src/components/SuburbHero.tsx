import type { SuburbData } from '../data/suburbs';
import { Icon } from './ui';
import { getStateGradient } from '../utils/SuburbGradients';
import '../styles/SuburbHero.css';

interface SuburbHeroProps {
  suburb: SuburbData | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
  persona?: string;
  onOpenAiTab?: () => void;
}

export function SuburbHero({ suburb, isSaved, onToggleSave, onOpenAiTab }: SuburbHeroProps) {
  
  if (!suburb) {
    return null;
  }

  const price = suburb.houseMedianPrice || (suburb.metrics as any)?.medianPrice;
  const medianPrice = price
    ? (price >= 1000000 ? `$${(price / 1000000).toFixed(2)}M` : `$${Math.round(price / 1000)}k`)
    : 'N/A';
  const priceChange = (suburb as any).houseMedianPrice12mChangePct || 0;
  
  const yieldVal = (suburb as any).houseGrossRentalYield ?? (suburb as any).rentalYield ?? (suburb.metrics as any)?.rentalYield;
  const rentalYield = yieldVal != null ? `${Number(yieldVal).toFixed(1)}%` : 'N/A';
  
  // Extract scores or fallback to null
  const growthScore = (suburb as any).growthScore || null;
  const vacancyVal = (suburb as any).vacancyRate;
  const vacancyRate = vacancyVal != null ? `${Number(vacancyVal).toFixed(1)}%` : 'N/A';
  const dqScore = (suburb as any).dqScore || null;
  const antiMarket = (suburb as any)._antiMarketData || (suburb as any).antiMarket || null;
  const antiMarketScore = antiMarket?.anti_market_score ?? null;
  const antiMarketLabel = antiMarket?.trend_label ?? null;
  const isValueTrap = Boolean(antiMarket?.is_value_trap || (vacancyVal != null && Number(vacancyVal) >= 3.5 && priceChange < 0));
  const aiVerdict = (suburb as any).aiVerdict || null;

  // Generate investment thesis headline
  const getDecisionHeadline = () => {
    const isGrowth = growthScore && growthScore > 70;
    const isHighYield = yieldVal && Number(yieldVal) > 4.5;
    const isAffordable = typeof price === 'number' && price > 0 && price < 700000;

    if (isValueTrap) {
      return "Caution: Elevated rental vacancy and negative price momentum signal value-trap risk despite entry affordability.";
    } else if (antiMarketScore != null && antiMarketScore >= 70) {
      return "Counter-cyclical resilience: Tight rental vacancy and positive price momentum outperforming broader interest-rate headwinds.";
    } else if (isGrowth && isHighYield) {
      return "A high-conviction suburb combining strong historical capital momentum with above-average rental yields.";
    } else if (isGrowth) {
      return "A growth-oriented market offering capital upside without inner-ring price premiums.";
    } else if (isHighYield) {
      return "A cashflow-positive asset profile suited for yield generation and debt-servicing stability.";
    } else if (isAffordable) {
      return "An accessible entry corridor balancing purchase affordability with established infrastructure.";
    } else {
      return "A stable, established residential enclave with defensive fundamentals and low historical volatility.";
    }
  };

  const decisionHeadline = getDecisionHeadline();

  // Background: state-specific gradient with a dark overlay for legibility
  const backgroundStyles = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    background: getStateGradient(suburb.state),
    opacity: 0.9,
  };

  const backgroundOverlayStyles = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.75) 0%, rgba(15, 23, 42, 0.95) 100%)',
  };

  return (
    <section className="suburb-hero">
      <div style={backgroundStyles}>
        <div style={backgroundOverlayStyles}></div>
      </div>
      
      <div className="sh-container">
        <div className="sh-header">
          <div className="sh-header-main">
            <div className="sh-eyebrow">
              {suburb.state} · {suburb.postcode} · {suburb.region || (suburb as any).metroCBD || 'Metro Region'}
            </div>
            
            <div className="sh-heading">
              <h1>{suburb.name}</h1>
              <p>{decisionHeadline}</p>
              <div className="sh-badges">
                <span className="sh-badge">
                  <Icon name="clock" size={14} /> Updated recently
                </span>
                <span className="sh-badge">
                  <Icon name="check" size={14} /> ABS Census & Public Records
                </span>
                {dqScore && (
                  <span className="sh-badge" style={{ color: dqScore >= 80 ? '#4ade80' : '#facc15' }}>
                    Data Quality: {Math.round(dqScore)}/100
                  </span>
                )}
                {antiMarketScore != null && (
                  <button
                    type="button"
                    onClick={onOpenAiTab}
                    className="sh-badge"
                    style={{
                      cursor: onOpenAiTab ? 'pointer' : 'default',
                      background: isValueTrap ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.22)',
                      borderColor: isValueTrap ? '#f87171' : '#34d399',
                      color: isValueTrap ? '#fca5a5' : '#6ee7b7',
                      fontWeight: 700,
                    }}
                  >
                    {isValueTrap ? '⚠️' : '🛡️'} {antiMarketLabel || 'Anti-Market'}: {antiMarketScore}/100 · View AI Radar →
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="sh-actions">
            {onOpenAiTab && (
              <button
                type="button"
                className="sh-action-btn"
                onClick={onOpenAiTab}
                style={{
                  background: isValueTrap
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.35), rgba(245, 158, 11, 0.3))'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(6, 182, 212, 0.3))',
                  borderColor: isValueTrap ? '#f87171' : '#34d399',
                  fontWeight: 700,
                }}
              >
                <span>✨ AI & Trap Radar</span>
              </button>
            )}
            <button className="sh-action-btn" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: `${suburb.name} Profile`, url: window.location.href });
              }
            }}>
              <Icon name="share" size={18} />
              <span>Share</span>
            </button>
            <button className={`sh-action-btn ${isSaved ? 'saved' : ''}`} onClick={onToggleSave}>
              <Icon name="heart" size={18} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        <div className="sh-metrics">
          <div className="sh-metric">
            <div className="sh-metric-label">Median Price</div>
            <div className="sh-metric-value">{medianPrice}</div>
            {priceChange !== 0 && (
              <div className={`sh-metric-change ${priceChange > 0 ? 'positive' : 'negative'}`}>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}% 12m
              </div>
            )}
          </div>

          <div className="sh-metric">
            <div className="sh-metric-label">Gross Yield</div>
            <div className="sh-metric-value">{rentalYield}</div>
            <div className="sh-metric-sub">Annualised rent / price</div>
          </div>

          <div className="sh-metric">
            <div className="sh-metric-label">Market Momentum</div>
            <div className="sh-metric-value" style={{ color: '#60a5fa' }}>
              {growthScore ? `${Math.round(growthScore)}/100` : '—'}
            </div>
            <div className="sh-metric-sub">Composite demand score</div>
          </div>

          <div className="sh-metric">
            <div className="sh-metric-label">Vacancy Rate</div>
            <div className="sh-metric-value" style={{ color: vacancyVal && vacancyVal < 2 ? '#4ade80' : (vacancyVal && vacancyVal >= 3.5 ? '#f87171' : '#facc15') }}>
              {vacancyRate}
            </div>
            <div className="sh-metric-sub">{vacancyVal && vacancyVal >= 3.5 ? 'Oversupply warning (≥3.5%)' : 'Rental availability'}</div>
          </div>

          <div
            className="sh-metric"
            onClick={onOpenAiTab}
            style={{
              cursor: onOpenAiTab ? 'pointer' : 'default',
              borderColor: isValueTrap ? 'rgba(248, 113, 113, 0.55)' : 'rgba(52, 211, 153, 0.45)',
              background: isValueTrap ? 'rgba(127, 29, 29, 0.35)' : 'rgba(6, 78, 59, 0.35)',
            }}
            title="Click to open AI Insights, 5-Axis Macro Check & Counter-Cyclical Alternatives"
          >
            <div className="sh-metric-label" style={{ color: isValueTrap ? '#fca5a5' : '#6ee7b7' }}>
              ✨ AI & Anti-Market
            </div>
            <div className="sh-metric-value" style={{ color: isValueTrap ? '#f87171' : '#4ade80' }}>
              {antiMarketScore != null ? `${antiMarketScore}/100` : (aiVerdict || 'Explore')}
            </div>
            <div className="sh-metric-sub" style={{ color: '#cbd5e1' }}>
              {antiMarketLabel || (aiVerdict ? `Verdict: ${aiVerdict}` : 'Open AI Trap Radar →')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}