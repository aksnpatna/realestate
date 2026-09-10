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

  // Calculate investment stance
  const getInvestmentStance = () => {
    const score =
      (growthScore || 0) * 0.35 +
      (yieldScore || 0) * 0.25 +
      ((suburb as any).demandScore || 60) * 0.20 +
      ((suburb as any).affordabilityScore || 60) * 0.20;

    if (score >= 80) return 'Strong';
    if (score >= 70) return 'Positive';
    if (score >= 60) return 'Neutral';
    if (score >= 50) return 'Caution';

    return 'Weak';
  };

  const investmentStance = getInvestmentStance();

  // Generate investment thesis
  const getInvestmentThesis = () => {
    const isGrowth = growthScore && growthScore > 70;
    const isHighYield = yieldScore && yieldScore > 4.5;
    const isAffordable = (suburb as any).houseMedianPrice < 700000;
    const hasLowVacancy = (suburb as any).vacancyRate && (suburb as any).vacancyRate < 2;

    if (isGrowth && isHighYield) {
      return {
        headline: "A balanced growth and income opportunity",
        summary: `${suburb.name} combines strong price growth momentum with attractive rental yields, making it suitable for both capital growth and income-focused investors.`
      };
    } else if (isGrowth) {
      return {
        headline: "Growth-oriented family market",
        summary: `${suburb.name} offers strong price growth potential driven by ${(suburb as any).populationGrowth || 'population growth'} and ${(suburb as any).infrastructure || 'infrastructure development'}, making it ideal for long-term investors.`
      };
    } else if (isHighYield) {
      return {
        headline: "Income-focused investment opportunity",
        summary: `${suburb.name} provides attractive rental yields with ${hasLowVacancy ? 'tight rental conditions' : 'stable rental demand'}, making it suitable for cashflow-focused investors.`
      };
    } else if (isAffordable) {
      return {
        headline: "Affordable entry point for first home buyers",
        summary: `${suburb.name} offers accessible median prices with ${(priceChange > 0 ? 'rising prices' : 'stable market conditions')}, making it an attractive option for first home buyers.`
      };
    } else {
      return {
        headline: "Stable and established market",
        summary: `${suburb.name} is an established market with ${(suburb as any).livability || 'good livability'} and ${(suburb as any).amenities || 'well-developed amenities'}, offering balanced investment potential.`
      };
    }
  };

  const investmentThesis = getInvestmentThesis();

  // Get strengths and risks
  const getStrengthsAndRisks = () => {
    const strengths = [];
    const risks = [];

    if (growthScore && growthScore > 70) {
      strengths.push({ id: 'growth', text: "Above-average growth momentum" });
    }
    if (yieldScore && yieldScore > 4.5) {
      strengths.push({ id: 'yield', text: "Attractive rental yield" });
    }
    if ((suburb as any).vacancyRate && (suburb as any).vacancyRate < 2) {
      strengths.push({ id: 'vacancy', text: "Tight rental market" });
    }
    if ((suburb as any).houseMedianPrice < 700000) {
      strengths.push({ id: 'affordable', text: "Accessible entry price" });
    }
    if ((suburb as any).cbdDistance && (suburb as any).cbdDistance < 20) {
      strengths.push({ id: 'proximity', text: "Close to CBD" });
    }

    if ((suburb as any).supply && (suburb as any).supply > 500) {
      risks.push({ id: 'supply', text: "High new dwelling supply" });
    }
    if (priceChange < 0) {
      risks.push({ id: 'price', text: "Recent price decline" });
    }
    if ((suburb as any).vacancyRate && (suburb as any).vacancyRate > 3) {
      risks.push({ id: 'vacancy-risk', text: "High vacancy rate" });
    }
    if ((suburb as any).affordabilityScore && (suburb as any).affordabilityScore < 50) {
      risks.push({ id: 'affordability', text: "Low affordability" });
    }

    // Fallback strengths if none
    if (strengths.length === 0) {
      strengths.push({ id: 'livable', text: "Family-friendly environment" });
      strengths.push({ id: 'amenities', text: "Well-developed amenities" });
    }

    // Fallback risks if none
    if (risks.length === 0) {
      risks.push({ id: 'market-risk', text: "Subject to market fluctuations" });
    }

    return { strengths, risks };
  };

  const { strengths, risks } = getStrengthsAndRisks();

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
            <h1>{suburb.name}</h1>
            <p>{investmentThesis.headline}</p>
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

          <div className="sh-metric">
            <div className="sh-metric-label">Research Confidence</div>
            <div className="sh-metric-value">High</div>
          </div>
        </div>

        <div className="sh-thesis">
          <div className="sh-thesis-header">
            <span className="sh-thesis-eyebrow">INVESTMENT THESIS</span>
            <h2>{investmentThesis.headline}</h2>
          </div>
          <p className="sh-thesis-summary">{investmentThesis.summary}</p>

          <div className="sh-thesis-grid">
            <div>
              <h3>Why it works</h3>
              {strengths.map(item => (
                <div className="sh-thesis-point" key={item.id}>
                  <span>+</span>
                  {item.text}
                </div>
              ))}
            </div>

            <div>
              <h3>What could go wrong</h3>
              {risks.map(item => (
                <div className="sh-thesis-point sh-thesis-point--risk" key={item.id}>
                  <span>!</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sh-investment-stance">
          <div className="sh-stance-card">
            <Icon name="chart" size={24} className="sh-stance-icon" />
            <div className="sh-stance-content">
              <span className="sh-stance-label">Investment Stance</span>
              <span className={`sh-stance-value ${investmentStance.toLowerCase()}`}>{investmentStance}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}