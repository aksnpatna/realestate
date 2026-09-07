

interface SuburbScoreRingProps {
  score: number | null | undefined;
  label: string;
}

export function SuburbScoreRing({ score, label }: SuburbScoreRingProps) {
  const safeScore = score == null ? 0 : Math.round(score);
  
  // Determine color based on score
  let color = 'var(--success)';
  if (safeScore === 0) color = 'var(--border-glass)';
  else if (safeScore < 50) color = 'var(--danger)';
  else if (safeScore < 70) color = 'var(--warning)';

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = safeScore === 0 ? 0 : circumference - (safeScore / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: '64px', height: '64px' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Ring */}
          <circle 
            cx="32" cy="32" r={radius} 
            fill="none" 
            stroke="var(--bg-dark)" 
            strokeWidth="6" 
          />
          {/* Score Ring */}
          {safeScore > 0 && (
            <circle 
              cx="32" cy="32" r={radius} 
              fill="none" 
              stroke={color} 
              strokeWidth="6" 
              strokeDasharray={circumference} 
              strokeDashoffset={strokeDashoffset} 
              strokeLinecap="round" 
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          )}
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '1rem', color: safeScore > 0 ? 'var(--text-primary)' : 'var(--text-muted)'
        }}>
          {safeScore > 0 ? safeScore : '-'}
        </div>
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}
