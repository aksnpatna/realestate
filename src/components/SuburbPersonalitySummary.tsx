import { useMemo } from 'react';
import type { SuburbData } from '../data/suburbs';

interface SuburbPersonalitySummaryProps {
  suburb: SuburbData;
}

export default function SuburbPersonalitySummary({ suburb }: SuburbPersonalitySummaryProps) {
  const summary = useMemo(() => {
    const s = suburb as any;
    const details = s.demographicsDetailV3 || {};
    
    // Fallbacks if demographicsDetailV3 is empty
    const vacancy = s.vacancyRate != null ? Number(s.vacancyRate) : null;
    const household = details.predominant_household || null;
    const ownerOccupier = details.owner_occupier_rate != null ? Number(details.owner_occupier_rate) : null;
    const price = s.houseMedianPrice || null;

    let text = "A ";

    // Demand / Vacancy descriptor
    if (vacancy !== null) {
      if (vacancy < 1.5) text += "high-demand rental market ";
      else if (vacancy > 3.0) text += "relaxed rental market ";
      else text += "balanced market ";
    } else {
      text += "suburb ";
    }

    // Household descriptor
    if (household) {
      if (household.toLowerCase().includes("family") || household.toLowerCase().includes("children")) {
        text += "popular with families ";
      } else if (household.toLowerCase().includes("lone") || household.toLowerCase().includes("single")) {
        text += "popular with singles and young professionals ";
      } else if (household.toLowerCase().includes("couple")) {
        text += "popular with couples ";
      } else {
        text += `predominantly home to ${household.toLowerCase()} `;
      }
    } else {
      text += "appealing to a mix of residents ";
    }

    // Owner occupier descriptor
    if (ownerOccupier !== null) {
      if (ownerOccupier > 75) {
        text += ", featuring a strongly established owner-occupier community. ";
      } else if (ownerOccupier < 40) {
        text += ", featuring a vibrant, renter-heavy community. ";
      } else {
        text += ". ";
      }
    } else {
      text += ". ";
    }

    // Price descriptor
    if (price !== null) {
      if (price < 600000) {
        text += "Property prices here offer an accessible entry point compared to the national average.";
      } else if (price > 1500000) {
        text += "Property prices here reflect a premium, established market.";
      } else {
        text += "Property prices here are relatively middle-of-the-road for the broader market.";
      }
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
  }, [suburb]);

  if (!summary || summary.length < 15) return null;

  return (
    <div className="u-e2ab3d4f" style={{
      background: 'var(--bg-glass)',
      padding: '1.25rem',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      marginBottom: '1.5rem',
      fontSize: '1.05rem',
      lineHeight: '1.5',
      color: 'var(--text-primary)',
      borderLeft: '4px solid var(--accent-purple)'
    }}>
      <strong>In a nutshell:</strong> {summary}
    </div>
  );
}
