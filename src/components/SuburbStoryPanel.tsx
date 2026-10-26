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
    if (suburb.metrics?.aiCommitteeDebate?.urban && suburb.metrics.aiCommitteeDebate.urban !== "INSUFFICIENT_EVIDENCE") {
      return suburb.metrics.aiCommitteeDebate.urban;
    }

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
    const cbdMins = suburb.cbdDistanceMins ?? (suburb as any).cbdDistance ?? 40;
    const isClose = cbdMins < 30;

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
    <div className="suburb-story-panel" style={{ padding: '0.75rem 0 1.25rem 0' }}>
      
      {/* SECTION 1: The Short Version */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontFamily: "'DM Sans', sans-serif", color: 'var(--brand-navy)', marginBottom: '0.75rem', fontWeight: 700 }}>
          The Short Version
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          
          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '10px', borderTop: '3px solid #10b981', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--brand-navy)', marginBottom: '0.4rem', fontWeight: 700 }}>The Opportunity</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.88rem', margin: 0 }}>{shortVersion.opportunity}</p>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '10px', borderTop: '3px solid #f59e0b', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--brand-navy)', marginBottom: '0.4rem', fontWeight: 700 }}>The Tension</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.88rem', margin: 0 }}>{shortVersion.tension}</p>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '10px', borderTop: '3px solid #3b82f6', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--brand-navy)', marginBottom: '0.4rem', fontWeight: 700 }}>The Outlook</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.88rem', margin: 0 }}>{shortVersion.outlook}</p>
          </div>

        </div>
      </div>

      {/* SECTION 2 & 3: Compact Demographic Profile & Suitability Disclosure */}
      <details style={{ background: 'var(--bg-card)', padding: '0.85rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border-glass)', marginBottom: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', color: 'var(--brand-navy)' }}>
          Demographic Fit & Lifestyle Context (ABS Profile)
        </summary>
        <div style={{ marginTop: '0.85rem' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.1)', marginBottom: '0.85rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
              {lifeProfile}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: '0.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon name="check" size={15} /> Good fit if you:
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
                {suitability.goodFit.map((item, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.4, display: 'flex', gap: '0.4rem' }}>
                    <span style={{ color: '#10b981' }}>•</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ background: 'rgba(244, 63, 94, 0.04)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#f43f5e', marginBottom: '0.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon name="alert-circle" size={15} /> Less suitable if you:
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
                {suitability.lessSuitable.map((item, i) => (
                  <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.4, display: 'flex', gap: '0.4rem' }}>
                    <span style={{ color: '#f43f5e' }}>•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </details>

    </div>
  );
}