import type { SuburbData } from '../data/suburbs';
import { Icon } from './ui';
import '../styles/SuburbStoryPanel.css';

interface SuburbStoryPanelProps {
  suburb: SuburbData | null;
  persona?: string;
}

export function SuburbStoryPanel({ suburb }: SuburbStoryPanelProps) {
  if (!suburb) {
    return null;
  }

  // Generate story points based on data
  const getStoryPoints = () => {
    const points = [];

    // Why Now? (Market timing)
    const vacancyRate = suburb.vacancyRate || 3;
    const priceChange = suburb.houseMedianPrice12mChangePct || 0;
    
    if (vacancyRate < 2) {
      points.push({
        icon: 'trending-up',
        title: 'Why now?',
        content: `The vacancy rate is ${vacancyRate.toFixed(1)}%, indicating a tight rental market that usually precedes price growth. Prices have ${priceChange > 0 ? `risen ${priceChange.toFixed(1)}%` : `stayed stable`} in the last 12 months.`,
        color: 'var(--success)'
      });
    } else if (vacancyRate < 3) {
      points.push({
        icon: 'clock',
        title: 'Why now?',
        content: `The vacancy rate is ${vacancyRate.toFixed(1)}%, showing a balanced market. Now might be a good time to negotiate as prices have ${priceChange > 0 ? `grown ${priceChange.toFixed(1)}%` : `remained steady`} recently.`,
        color: 'var(--warning)'
      });
    } else {
      points.push({
        icon: 'alert-circle',
        title: 'Why now?',
        content: `With a vacancy rate of ${vacancyRate.toFixed(1)}%, the market is more favorable for buyers. Prices have ${priceChange > 0 ? `increased ${priceChange.toFixed(1)}%` : `declined ${Math.abs(priceChange).toFixed(1)}%`} in the last year.`,
        color: 'var(--danger)'
      });
    }

    // Who buys here? (Demographics)
    const medianAge = suburb.medianAge || 35;
    const ownerOccupierRate = suburb.ownerOccupierRate || 65;
    
    if (medianAge < 30) {
      points.push({
        icon: 'users',
        title: 'Who buys here?',
        content: `This is a young, vibrant suburb with a median age of ${medianAge} years. ${ownerOccupierRate > 60 ? 'Families make up the majority' : 'Renters and young professionals dominate'} the population.`,
        color: 'var(--accent-cyan)'
      });
    } else if (medianAge < 40) {
      points.push({
        icon: 'home',
        title: 'Who buys here?',
        content: `With a median age of ${medianAge} years, this suburb attracts ${ownerOccupierRate > 60 ? 'young families' : 'professionals and couples'} looking for ${suburb.cbdDistanceMins && suburb.cbdDistanceMins < 20 ? 'CBD proximity' : 'affordable housing'}.`,
        color: 'var(--accent-cyan)'
      });
    } else {
      points.push({
        icon: 'heart',
        title: 'Who buys here?',
        content: `This is an established suburb with a median age of ${medianAge} years. ${ownerOccupierRate > 60 ? 'Families and downsizers' : 'Retirees and long-term residents'} appreciate the ${suburb.schools?.length > 3 ? 'excellent schools' : 'quiet lifestyle'}.`,
        color: 'var(--accent-cyan)'
      });
    }

    // What's the risk? (One honest risk factor)
    const supplyPipeline = suburb.buildingApprovals12m || 0;
    const infrastructure = suburb.infrastructureInvestment ? 1 : 0;
    
    if (supplyPipeline > 20) {
      points.push({
        icon: 'building',
        title: 'What\'s the risk?',
        content: `There are ${supplyPipeline} building approvals in the pipeline, which could increase supply and potentially put downward pressure on prices in the short term.`,
        color: 'var(--danger)'
      });
    } else if (!suburb.infrastructureInvestment) {
      points.push({
        icon: 'road',
        title: 'What\'s the risk?',
        content: `Infrastructure development information is limited. This could affect future property values and livability.`,
        color: 'var(--warning)'
      });
    } else if (suburb.cbdDistanceMins && suburb.cbdDistanceMins > 30) {
      points.push({
        icon: 'car',
        title: 'What\'s the risk?',
        content: `Located ${suburb.cbdDistanceMins} minutes from the CBD, commute times could be a concern for professionals working in the city.`,
        color: 'var(--warning)'
      });
    } else {
      points.push({
        icon: 'shield',
        title: 'What\'s the risk?',
        content: `This suburb has a balanced risk profile. While prices have ${priceChange > 0 ? 'risen' : 'stayed stable'}, ${(suburb.houseMedianPrice || suburb.metrics.medianPrice) > 800000 ? 'affordability' : 'limited supply'} could be a consideration.`,
        color: 'var(--neutral)'
      });
    }

    return points;
  };

  const storyPoints = getStoryPoints();

  return (
    <div className="suburb-story-panel">
      <div className="ss-panel-container">
        <h2 className="ss-panel-title">
          <Icon name="book-open" size={24} /> What you need to know about {suburb.name}
        </h2>
        
        <div className="ss-story-grid">
          {storyPoints.map((point, index) => (
            <div key={index} className="ss-story-card">
              <div className="ss-story-icon" style={{ color: point.color }}>
                <Icon name={point.icon as any} size={24} />
              </div>
              <div className="ss-story-content">
                <h3 className="ss-story-title">{point.title}</h3>
                <p className="ss-story-text">{point.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}