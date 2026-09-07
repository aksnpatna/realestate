
import type { SuburbData } from '../data/suburbs';
import { SuburbScoreRing } from './SuburbScoreRing';
import { Icon } from './ui';
import '../styles/SuburbHero.css';

interface SuburbHeroProps {
  suburb: SuburbData | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export function SuburbHero({ suburb, isSaved, onToggleSave }: SuburbHeroProps) {
  
  if (!suburb) {
    return null;
  }

  const medianPrice = suburb.houseMedianPrice ? `$${(suburb.houseMedianPrice / 1000000).toFixed(2)}M` : 'N/A';
  const priceChange = (suburb as any).houseMedianPrice12mChangePct || 0;
  
  const rentalYield = (suburb as any).houseGrossRentalYield ? `${( (suburb as any).houseGrossRentalYield.toFixed(1) )}%` : 'N/A';
  
  // Extract scores or fallback to null
  const growthScore = (suburb as any).growthScore || null;
  const yieldScore = (suburb as any).yieldScore || null;
  const dqScore = (suburb as any).dqScore || null;

  // Generate suburb-specific media URL based on name and state
  const generateSuburbImage = (name: string, state: string) => {
    // Check if suburb has images from backend
    if (suburb.images_json && Array.isArray(suburb.images_json) && suburb.images_json.length > 0) {
      return suburb.images_json[0]; // Return first image
    }
    // Fallback to Unsplash with suburb-specific query
    const query = `${name}, ${state}`.replace(/\s+/g, '+');
    return `https://source.unsplash.com/1200x800/?${query},property,house`;
  };

  // Inline styles for background to ensure they're included
  const backgroundStyles = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    opacity: 0.05,
  };

  const backgroundImageStyles = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: 'scale(1.1)',
  };

  const backgroundOverlayStyles = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(248, 250, 252, 0.95) 50%, rgba(241, 245, 249, 0.9) 100%)',
  };

  return (
    <div className="suburb-hero">
      {/* Hero Background Visual */}
      <div style={backgroundStyles}>
        <img 
          src={generateSuburbImage(suburb.name, suburb.state)} 
          alt={`${suburb.name} skyline`}
          style={backgroundImageStyles}
        />
        <div style={backgroundOverlayStyles}></div>
      </div>
      
      <div className="sh-container">
        
        {/* Header Row */}
        <div className="sh-header-row">
          <div>
            <h1 className="sh-title">{suburb.name}</h1>
            <div className="sh-meta">
              <span className="sh-badge">{suburb.state}</span>
              <span className="sh-postcode">{suburb.postcode}</span>
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

        {/* Main KPIs */}
        <div className="sh-kpi-row">
          <div className="sh-kpi-card">
            <span className="sh-kpi-label">Median House Price</span>
            <div className="sh-kpi-value-group">
              <span className="sh-kpi-value">{medianPrice}</span>
              {priceChange !== 0 && (
                <span className={`sh-kpi-trend ${priceChange > 0 ? 'up' : 'down'}`}>
                  {priceChange > 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(1)}% 12m
                </span>
              )}
            </div>
          </div>

          <div className="sh-kpi-card">
            <span className="sh-kpi-label">Gross Rental Yield</span>
            <div className="sh-kpi-value-group">
              <span className="sh-kpi-value">{rentalYield}</span>
            </div>
          </div>
        </div>

        {/* Score Rings */}
        <div className="sh-scores-row">
          <SuburbScoreRing score={growthScore} label="Growth Score" />
          <SuburbScoreRing score={yieldScore} label="Yield Score" />
          <SuburbScoreRing score={85} label="Livability" />
          <SuburbScoreRing score={70} label="Affordability" />
          <SuburbScoreRing score={dqScore} label="Data Quality" />
        </div>

        {/* Market Sentiment Indicator */}
        <div className="sh-market-sentiment">
          <div className="sh-sentiment-card">
            <Icon name="chart" size={20} className="sh-sentiment-icon" />
            <div className="sh-sentiment-content">
              <span className="sh-sentiment-label">Market Sentiment</span>
              <span className="sh-sentiment-value positive">Strong Buy</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
