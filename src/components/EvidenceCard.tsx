import React from 'react';
import '../styles/EvidenceCard.css';

interface EvidenceCardProps {
  metric: string;
  label: string;
  interpretation: string;
  implication: string;
  confidence?: 'high' | 'medium' | 'low';
  onViewDetails?: () => void;
}

export function EvidenceCard({
  metric,
  label,
  interpretation,
  implication,
  confidence = 'high',
  onViewDetails
}: EvidenceCardProps) {
  return (
    <div className="evidence-card">
      <div className="evidence-card__header">
        <div className="evidence-card__metric">
          <span className="evidence-card__value">{metric}</span>
          <span className="evidence-card__label">{label}</span>
        </div>
        {onViewDetails && (
          <button className="evidence-card__details-btn" onClick={onViewDetails}>
            View details
          </button>
        )}
      </div>

      <div className="evidence-card__content">
        <div className="evidence-card__interpretation">
          <span className="evidence-card__eyebrow">What happened</span>
          <p>{interpretation}</p>
        </div>

        <div className="evidence-card__implication">
          <span className="evidence-card__eyebrow">Why it matters</span>
          <p>{implication}</p>
        </div>

        <div className="evidence-card__confidence">
          <span className="evidence-card__eyebrow">Confidence</span>
          <span className={`evidence-card__confidence-badge confidence-${confidence}`}>
            {confidence}
          </span>
        </div>
      </div>
    </div>
  );
}