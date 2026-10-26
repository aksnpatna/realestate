import type { SuburbData } from '../data/suburbs';
import { Icon } from './ui';
import { getStateGradient } from '../utils/SuburbGradients';
import '../styles/SuburbHero.css';

interface SuburbHeroProps {
  suburb: SuburbData | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
  persona?: string;
}

export function SuburbHero({ suburb, isSaved, onToggleSave, persona = 'first_home_buyer' }: SuburbHeroProps) {
  
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

  // Generate investment thesis headline
  const getDecisionHeadline = () => {
    const isGrowth = growthScore && growthScore > 70;
    const isHighYield = yieldVal && Number(yieldVal) > 4.5;
    const isAffordable = typeof price === 'number' && price > 0 && price < 700000;

    if (isGrowth && isHighYield) {
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
              </div>
            </div>
          </div>

          <div className="sh-actions">
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
            <div className="sh-metric-value" style={{ color: vacancyVal && vacancyVal < 2 ? '#4ade80' : '#facc15' }}>
              {vacancyRate}
            </div>
            <div className="sh-metric-sub">Rental availability</div>
          </div>
        </div>
      </div>
    </section>
  );
}