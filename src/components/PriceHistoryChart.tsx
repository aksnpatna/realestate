import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PriceHistoryChartProps {
  history10yr: { date: string; value: number }[] | null;
  historyRent10yr?: { date: string; value: number }[] | null;
}

export default function PriceHistoryChart({ history10yr, historyRent10yr }: PriceHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!history10yr || !history10yr.length) return [];
    
    // Convert to a map for easy merging
    const dataMap = new Map();
    
    history10yr.forEach(item => {
      const year = item.date.split('-')[0];
      dataMap.set(year, {
        year,
        dateStr: item.date,
        price: item.value
      });
    });
    
    if (historyRent10yr) {
      historyRent10yr.forEach(item => {
        const year = item.date.split('-')[0];
        if (dataMap.has(year)) {
          dataMap.get(year).rent = item.value;
        } else {
          dataMap.set(year, {
            year,
            dateStr: item.date,
            rent: item.value
          });
        }
      });
    }
    
    // Sort chronologically
    return Array.from(dataMap.values()).sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [history10yr, historyRent10yr]);

  const aiInsights = useMemo(() => {
    if (!chartData || chartData.length < 5) return null;
    
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    
    if (!first.price || !last.price) return null;
    
    const totalGrowth = ((last.price - first.price) / first.price) * 100;
    const cagr = (Math.pow(last.price / first.price, 1 / (chartData.length - 1)) - 1) * 100;
    
    let insight = `Median house prices have grown by ${totalGrowth.toFixed(1)}% over the last ${chartData.length} years, representing a Compound Annual Growth Rate (CAGR) of ${cagr.toFixed(1)}%. `;
    
    if (cagr > 7) {
      insight += "This is a significant outperformance against the national baseline (typically 5-6%), indicating strong underlying demand-side pressure or structural gentrification.";
    } else if (cagr < 4) {
      insight += "This represents an underperformance against the national baseline, suggesting oversupply issues, lack of infrastructure catalysts, or a highly cyclical resources-tied market.";
    } else {
      insight += "This aligns with steady, long-term macroeconomic property cycles.";
    }
    
    return { text: insight, cagr: cagr.toFixed(1) };
  }, [chartData]);

  if (!chartData || !chartData.length) {
    return (
      <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-glass)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No historical price data available for this region.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>
          <span style={{ fontSize: '1.1rem' }}>💰</span> 10-Year Capital Growth & Rent History
        </h3>
        {aiInsights && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {aiInsights.cagr}% CAGR
          </div>
        )}
      </div>

      {aiInsights && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px 14px', 
          background: 'rgba(16, 185, 129, 0.06)', 
          borderLeft: '3px solid #10b981',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontSize: '0.88rem',
          lineHeight: '1.5'
        }}>
          <strong style={{ color: '#059669', display: 'block', marginBottom: '4px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🤖 Market Analysis</strong>
          {aiInsights.text}
        </div>
      )}

      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
            <XAxis 
              dataKey="year" 
              stroke="var(--text-muted)" 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              label={{ value: 'Year', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <YAxis 
              yAxisId="left" 
              stroke="var(--text-muted)" 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              label={{ value: 'Median Price ($)', angle: -90, position: 'insideLeft', offset: 5, fill: 'var(--text-muted)', fontSize: 11, style: { textAnchor: 'middle' } }}
            />
            {historyRent10yr && historyRent10yr.length > 0 && (
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="var(--text-muted)" 
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={(val) => `$${val}/w`}
                label={{ value: 'Weekly Rent ($)', angle: 90, position: 'insideRight', offset: 5, fill: 'var(--text-muted)', fontSize: 11, style: { textAnchor: 'middle' } }}
              />
            )}
            <Tooltip 
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              itemStyle={{ color: 'var(--text-primary)' }}
              labelStyle={{ color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}
              labelFormatter={(label) => `Year: ${label}`}
              formatter={(value: number, name: string) => {
                if (name === "Median Price") return [`$${value.toLocaleString()}`, name];
                if (name === "Median Rent") return [`$${value}/week`, name];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="price" 
              name="Median Price" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, fill: 'var(--bg-card)', stroke: '#10b981' }} 
            />
            {historyRent10yr && historyRent10yr.length > 0 && (
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="rent" 
                name="Median Rent" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--bg-card)', stroke: '#8b5cf6' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
