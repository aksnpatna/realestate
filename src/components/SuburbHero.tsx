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

  const medianPrice = suburb.houseMedianPrice ? `$${(suburb.houseMedianPrice / 1000000).toFixed(2)}M` : 'N/A';
  const priceChange = (suburb as any).houseMedianPrice12mChangePct || 0;
  
  const rentalYield = (suburb as any).houseGrossRentalYield != null ? `${(suburb.houseGrossRentalYield as number).toFixed(1)}%` : 'N/A';
  
  // Extract scores or fallback to null
  const growthScore = (suburb as any).growthScore || null;
  const yieldScore = (suburb as any).yieldScore || null;
  const dqScore = (suburb as any).dqScore || null;

  // Use state-specific gradient — no property photos (suburb-level platform)

  // Generate investment thesis headline
  const getDecisionHeadline = () => {
    const isGrowth = growthScore && growthScore > 70;
    const isHighYield = yieldScore && yieldScore > 4.5;
    const isAffordable = (suburb as any).houseMedianPrice < 700000;

    if (isGrowth && isHighYield) {
      return "A suburb for people who want strong growth potential without sacrificing rental income.";
    } else if (isGrowth) {
      return "A suburb for people who want long-term capital appreciation without paying inner-city premiums.";
    } else if (isHighYield) {
      return "A suburb for people who want strong cashflow without paying for prestige.";
    } else if (isAffordable) {
      return "A suburb for people who want an accessible entry point without sacrificing essential amenities.";
    } else {
      return "A suburb for people who want a stable, established lifestyle without exposing themselves to high volatility.";
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
    background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.70) 0%, rgba(15, 23, 42, 0.92) 100%)',
  };

  return (
    <section className="suburb-hero">
      <div style={backgroundStyles}>
        <div style={backgroundOverlayStyles}></div>
      </div>
      
      <div className="sh-container">
        <div className="sh-header">
          <div className="sh-eyebrow">
            {suburb.state} · {suburb.postcode} · {suburb.region || 'Australian Suburb'}
          </div>
          
          <div className="sh-heading">
            <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "3.5rem", letterSpacing: "-1px", marginBottom: "0.5rem" }}>
              {suburb.name}
            </h1>
            <p style={{ fontSize: "1.35rem", color: "#e2e8f0", maxWidth: "800px", lineHeight: "1.5" }}>
              {decisionHeadline}
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <Icon name="clock" size={14} /> Updated recently
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <Icon name="check" size={14} /> Based on ABS Census & Government Data
              </span>
            </div>
          </div>

          <div className="sh-actions">
            <button className="sh-action-btn" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: `${suburb.name} Profile`, url: window.location.href });
              }
            }}>
              <Icon name="share" size={20} />
              <span>Share</span>
            </button>
            <button className={`sh-action-btn ${isSaved ? 'saved' : ''}`} onClick={onToggleSave}>
              <Icon name="heart" size={20} />
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
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
              </div>
            )}
          </div>

          <div className="sh-metric">
            <div className="sh-metric-label">Gross Yield</div>
            <div className="sh-metric-value">{rentalYield}</div>
          </div>

          <div className="sh-metric">
            <div className="sh-metric-label">5yr Growth</div>
            <div className="sh-metric-value">{growthScore ? `${growthScore}%` : 'N/A'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}