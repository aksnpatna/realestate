import { memo, useMemo } from 'react';

interface Props {
  suburb: Record<string, any>;
}

export default memo(function MarketCycleClock({ suburb }: Props) {
  const priceChange = Number(suburb.houseMedianPrice12mChangePct) || 0;
  const vacancyRate = Number(suburb.vacancyRate) || 0;
  const dom = Number(suburb.houseDaysOnMarket) || 0;

  // Determine Cycle Position (1 to 12 o'clock)
  // 12 = Peak, 3 = Declining, 6 = Bottom, 9 = Recovering
  const clockState = useMemo(() => {
    if (priceChange > 8 && vacancyRate < 1.5) return { time: 11, label: 'Approaching Peak', color: '#10b981', desc: 'Prices are rising rapidly, vacancy is tight.' };
    if (priceChange > 3 && vacancyRate < 1.0) return { time: 12, label: 'Peak of Market', color: '#f59e0b', desc: 'Market is at maximum heat, high competition.' };
    if (priceChange > 0 && vacancyRate < 2.0) return { time: 8, label: 'Starting to Recover', color: '#3b82f6', desc: 'Prices are starting to climb, demand returning.' };
    if (priceChange < -2 && vacancyRate > 2.5) return { time: 2, label: 'Starting to Decline', color: '#f97316', desc: 'Prices softening, days on market expanding.' };
    if (priceChange < -5 && vacancyRate > 3.0) return { time: 4, label: 'Approaching Bottom', color: '#ef4444', desc: 'Significant price drops, high vacancy.' };
    if (priceChange > -2 && priceChange < 2 && vacancyRate > 2.5) return { time: 6, label: 'Bottom of Market', color: '#6366f1', desc: 'Prices have stabilized at cyclical lows.' };
    if (priceChange > -2 && priceChange < 2 && dom > 40) return { time: 6, label: 'Bottom of Market', color: '#6366f1', desc: 'Prices have stabilized, but market is slow.' };
    
    // Default fallback based purely on price change
    if (priceChange > 5) return { time: 10, label: 'Rising Market', color: '#10b981', desc: 'Consistent capital growth recorded.' };
    if (priceChange < -3) return { time: 4, label: 'Declining Market', color: '#ef4444', desc: 'Consistent capital decline recorded.' };
    
    return { time: 9, label: 'Early Recovery / Stable', color: '#3b82f6', desc: 'Market is stable with slight positive momentum.' };
  }, [priceChange, vacancyRate, dom]);

  // Generate SVG points for a 12-hour clock face
  const radius = 60;
  const center = 90;
  
  // Calculate hand position
  const angle = (clockState.time * 30 - 90) * (Math.PI / 180);
  const handX = center + (radius - 15) * Math.cos(angle);
  const handY = center + (radius - 15) * Math.sin(angle);

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
      <div style={{ flex: '0 0 auto', position: 'relative', width: '180px', height: '180px' }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Clock face */}
          <circle cx={center} cy={center} r={radius} fill="rgba(0,0,0,0.2)" stroke="var(--border-glass)" strokeWidth="4" />
          
          {/* Clock ticks */}
          {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => {
            const tickAngle = (h * 30 - 90) * (Math.PI / 180);
            const isMain = h % 3 === 0;
            const tRadius = isMain ? radius : radius - 5;
            const x1 = center + tRadius * Math.cos(tickAngle);
            const y1 = center + tRadius * Math.sin(tickAngle);
            const x2 = center + (radius - (isMain ? 10 : 0)) * Math.cos(tickAngle);
            const y2 = center + (radius - (isMain ? 10 : 0)) * Math.sin(tickAngle);
            return (
              <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-secondary)" strokeWidth={isMain ? "3" : "1"} />
            );
          })}
          
          {/* Clock hand */}
          <line x1={center} y1={center} x2={handX} y2={handY} stroke={clockState.color} strokeWidth="4" strokeLinecap="round" />
          <circle cx={center} cy={center} r="6" fill={clockState.color} />
          
          {/* Text labels for 12, 3, 6, 9 */}
          <text x={center} y={center - radius - 8} fill="var(--text-secondary)" fontSize="10" textAnchor="middle">PEAK</text>
          <text x={center} y={center + radius + 15} fill="var(--text-secondary)" fontSize="10" textAnchor="middle">BOTTOM</text>
          <text x={center + radius + 8} y={center + 3} fill="var(--text-secondary)" fontSize="10" textAnchor="start">DECLINE</text>
          <text x={center - radius - 8} y={center + 3} fill="var(--text-secondary)" fontSize="10" textAnchor="end">RECOVER</text>
        </svg>
      </div>
      
      <div style={{ flex: 1, minWidth: '200px' }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Market Cycle Indicator</h3>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: clockState.color, marginBottom: '8px' }}>
          {clockState.label}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
          {clockState.desc}
        </p>
        
        <div style={{ display: 'flex', gap: '15px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div>
            <strong>12m Growth:</strong> <span style={{ color: priceChange > 0 ? '#10b981' : '#ef4444' }}>{priceChange > 0 ? '+' : ''}{priceChange}%</span>
          </div>
          <div>
            <strong>Vacancy:</strong> <span>{vacancyRate > 0 ? vacancyRate + '%' : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
