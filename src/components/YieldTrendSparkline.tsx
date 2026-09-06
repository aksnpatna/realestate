import { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import type { SuburbData } from '../data/suburbs';

interface YieldTrendSparklineProps {
  suburb: SuburbData;
}

export default function YieldTrendSparkline({ suburb }: YieldTrendSparklineProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!suburb || !suburb.id) return;
    fetch(`/api/suburbs/${suburb.id}/yield-history`)
      .then(res => res.json())
      .then(result => {
        if (result.status === 'ok' && result.yield_history) {
          // Take the last 12 months if possible
          const sliced = result.yield_history.slice(-12);
          const chartData = sliced.map((item: any) => ({
            value: item.houses || item.yield || 0
          })).filter((item: any) => item.value > 0);
          setData(chartData);
        } else {
          setData([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch yield history:', err);
        setData([]);
      });
  }, [suburb.id]);

  if (data.length < 2) return null;

  const first = data[0].value;
  const last = data[data.length - 1].value;
  const isUp = last > first;
  const color = isUp ? '#059669' : '#DC2626'; // Green if yield is going up, red if going down

  return (
    <div style={{ width: '60px', height: '24px', marginLeft: 'auto', display: 'flex', alignItems: 'center' }} title={isUp ? 'Yield is trending up over last 12m' : 'Yield is trending down over last 12m'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
