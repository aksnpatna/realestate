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

  // Generate suburb-specific media URL
  const generateSuburbImage = () => {
    if (suburb.images_json && Array.isArray(suburb.images_json) && suburb.images_json.length > 0) {
      return suburb.images_json[0];
    }
    
    const stateImages = {
      'NSW': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2070&auto=format&fit=crop',
      'VIC': 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=2070&auto=format&fit=crop',
      'QLD': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop',
      'SA': 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?q=80&w=2070&auto=format&fit=crop',
      'WA': 'https://images.unsplash.com/photo-1560185007-6e8f2e7476b0?q=80&w=2070&auto=format&fit=crop',
      'TAS': 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?q=80&w=2070&auto=format&fit=crop',
      'ACT': 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=2070&auto=format&fit=crop',
      'NT': 'https://images.unsplash.com/photo-1582268611958-ebfd161ef934?q=80&w=2070&auto=format&fit=crop'
    };
    
    return stateImages[suburb.state] || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=2070&auto=format&fit=crop';
  };

  const suburbImage = generateSuburbImage();

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



  // Background styles
  const backgroundStyles = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    opacity: 0.9,
    background: suburbImage ? 'transparent' : getStateGradient(suburb.state),
  };

  const backgroundImageStyles = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: 'scale(1.05)',
  };

  const backgroundOverlayStyles = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to bottom, rgba(23, 32, 29, 0.85) 0%, rgba(23, 32, 29, 0.95) 100%)',
    backdropFilter: 'blur(1px)',
  };

  return (
    <section className="suburb-hero">
      <div style={backgroundStyles}>
        {suburbImage && (
          <img 
            src={suburbImage} 
            alt={`${suburb.name} skyline`}
            style={backgroundImageStyles}
          />
        )}
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
                <Icon name="check" size={14} /> Based on ABS & SQM Data
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