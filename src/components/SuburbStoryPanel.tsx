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

  // Generate narrative structures based on data
  const getShortVersion = () => {
    const vacancyRate = suburb.vacancyRate || 3;
    const priceChange = suburb.houseMedianPrice12mChangePct || 0;
    const supply = suburb.buildingApprovals12m || 0;
    
    return {
      opportunity: vacancyRate < 2 ? `The rental market is exceptionally tight (${vacancyRate.toFixed(1)}% vacancy), which historically precedes price growth and ensures immediate tenant demand.` : `A balanced market offering stable entry opportunities without excessive buyer competition.`,
      tension: priceChange > 5 ? `Recent price growth of ${priceChange.toFixed(1)}% means the affordability gap compared to inner-ring suburbs is closing.` : supply > 50 ? `An elevated pipeline of new dwelling approvals could introduce short-term supply competition.` : `Yields may compress if price growth outpaces rental adjustments in the near term.`,
      outlook: priceChange > 0 && vacancyRate < 2 ? `Strong momentum indicators suggest continued demand, provided borrowing capacities remain stable.` : `Market signals point towards a period of consolidation, favoring long-term holders over short-term flippers.`
    };
  };

  const getLifeProfile = () => {
    const medianAge = suburb.medianAge || 35;
    const ownerOccupierRate = suburb.ownerOccupierRate || 65;
    
    let profile = `This is a ${ownerOccupierRate < 50 ? 'renter-heavy' : 'predominantly owner-occupier'} suburb with a `;
    if (medianAge < 30) profile += `young adult population, making it vibrant but potentially transient. It may suit professionals and smaller households more than buyers seeking large detached family homes.`;
    else if (medianAge < 40) profile += `relatively young population, attracting families and professionals looking for a balance of lifestyle and affordability.`;
    else profile += `more established demographic profile, favored by long-term residents and downsizers who appreciate the quieter lifestyle.`;
    
    return profile;
  };

  const getSuitability = () => {
    const isAffordable = (suburb.houseMedianPrice || suburb.metrics?.medianPrice || 1000000) < 700000;
    const isClose = (suburb.cbdDistanceMins || 40) < 30;

    return {
      goodFit: [
        isAffordable ? "Want a lower entry price than the surrounding market" : "Have a budget to support premium locations",
        isClose ? "Need a reasonable commute to the CBD" : "Can accept a longer commute for better affordability",
        "Are comfortable with the current demographic mix",
        "Plan to hold for the medium-to-long term"
      ],
      lessSuitable: [
        isAffordable ? "Need immediate prestige or blue-chip capital growth" : "Are constrained by strict serviceability limits",
        isClose ? "Want a large block on a tight budget" : "Depend heavily on public transport for daily inner-city access",
        "Need immediate high cashflow to service the debt",
      ]
    };
  };

  const shortVersion = getShortVersion();
  const lifeProfile = getLifeProfile();
  const suitability = getSuitability();

  return (
    <div className="suburb-story-panel" style={{ padding: '2rem 0' }}>
      
      {/* SECTION 1: The Short Version */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: "'DM Sans', sans-serif", color: 'var(--brand-navy)', marginBottom: '1.5rem', fontWeight: 700 }}>
          The Short Version
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          
          <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', borderTop: '4px solid #10b981', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.75rem', fontWeight: 700 }}>The Opportunity</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{shortVersion.opportunity}</p>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', borderTop: '4px solid #f59e0b', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.75rem', fontWeight: 700 }}>The Tension</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{shortVersion.tension}</p>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', borderTop: '4px solid #3b82f6', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.75rem', fontWeight: 700 }}>The Outlook</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{shortVersion.outlook}</p>
          </div>

        </div>
      </div>

      {/* SECTION 2: What Life Might Feel Like */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: "'DM Sans', sans-serif", color: 'var(--brand-navy)', marginBottom: '1rem', fontWeight: 700 }}>
          What Life Might Feel Like
        </h2>
        <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
            {lifeProfile}
          </p>
        </div>
      </div>

      {/* SECTION 3: Who Should Consider It */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontFamily: "'DM Sans', sans-serif", color: 'var(--brand-navy)', marginBottom: '1.5rem', fontWeight: 700 }}>
          Who Should Consider It?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#10b981', marginBottom: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="check" size={18} /> Good fit if you:
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {suitability.goodFit.map((item, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>•</span> {item}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#f43f5e', marginBottom: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="alert-circle" size={18} /> Less suitable if you:
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {suitability.lessSuitable.map((item, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: '#f43f5e' }}>•</span> {item}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

    </div>
  );
}