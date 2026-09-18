import React from 'react';

interface ConfidenceGaugeProps {
  score: number; // 0-1
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

function confidenceColor(score: number): string {
  if (score >= 0.85) return 'var(--success)';
  if (score >= 0.65) return 'var(--bg-brand)';
  if (score >= 0.45) return 'var(--warning)';
  return 'var(--danger)';
}

function confidenceBand(score: number): string {
  if (score >= 0.85) return 'High';
  if (score >= 0.65) return 'Good';
  if (score >= 0.45) return 'Fair';
  return 'Low';
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  score,
  label = 'Confidence',
  size = 'md',
}) => {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  const color = confidenceColor(score);
  const band = confidenceBand(score);

  const dims = { sm: 48, md: 64, lg: 88 }[size];
  const radius = dims / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="cg" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: dims, height: dims }}>
        <svg width={dims} height={dims} viewBox={`0 0 ${dims} ${dims}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={dims / 2} cy={dims / 2} r={radius}
            fill="none" stroke="rgba(15,23,42,0.15)" strokeWidth="5"
          />
          <circle
            cx={dims / 2} cy={dims / 2} r={radius}
            fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: size === 'sm' ? '0.7rem' : size === 'lg' ? '1.1rem' : '0.85rem',
          color: 'var(--text-primary)',
        }}>
          <span>{pct}%</span>
          <span style={{ fontSize: '0.55rem', color, fontWeight: 600, marginTop: -1 }}>{band}</span>
        </div>
      </div>
      {label && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      )}
    </div>
  );
};
