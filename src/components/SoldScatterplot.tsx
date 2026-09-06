import { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';

interface SoldScatterplotProps {
  sqmData: any;
}

export default function SoldScatterplot({ sqmData }: SoldScatterplotProps) {
  const chartData = useMemo(() => {
    if (!sqmData || !sqmData.sold_properties) return [];

    return sqmData.sold_properties
      .filter((p: any) => p.land_size > 0 && p.price > 0)
      .map((p: any) => {
        const ppsqm = p.price / p.land_size;
        return {
          id: p.id || Math.random().toString(),
          date: p.sold_date,
          land_size: p.land_size,
          price: p.price,
          ppsqm: Math.round(ppsqm),
          address: p.address,
        };
      })
      // Filter out extreme outliers for better chart rendering
      .filter((p: any) => p.land_size < 5000 && p.ppsqm < 20000);
  }, [sqmData]);

  if (chartData.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No recent sold property data available for scatterplot.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-card" style={{ padding: '1rem', border: 'none', background: 'var(--bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{data.address}</p>
          <p style={{ margin: '4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sold: {data.date}</p>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.85rem' }}><strong>Price:</strong> ${data.price.toLocaleString()}</span>
            <span style={{ fontSize: '0.85rem' }}><strong>Land:</strong> {data.land_size.toLocaleString()} sqm</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}><strong>PPSQM:</strong> ${data.ppsqm.toLocaleString()}/sqm</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h4 style={{ margin: '0 0 1rem 0', fontWeight: 600 }}>Sold Price per Sqm vs Land Size</h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Identifies land value premiums. Properties above the cluster are often newer builds or subdivided blocks.
      </p>
      
      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
            <XAxis 
              type="number" 
              dataKey="land_size" 
              name="Land Size" 
              unit=" sqm" 
              stroke="var(--text-muted)"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              label={{ value: 'Land Size (sqm)', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <YAxis 
              type="number" 
              dataKey="ppsqm" 
              name="PPSQM" 
              unit=" $/sqm" 
              stroke="var(--text-muted)"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickFormatter={(val) => `$${val}`}
              label={{ value: 'Price Per Sqm ($)', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="price" range={[40, 150]} name="Price" />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--border-glass)' }} />
            <Scatter name="Sold Properties" data={chartData} fill="var(--accent-cyan)" fillOpacity={0.6} stroke="var(--accent-blue)" strokeWidth={1} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
