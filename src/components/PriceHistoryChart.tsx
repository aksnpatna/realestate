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
    
    return insight;
  }, [chartData]);

  if (!chartData || !chartData.length) {
    return (
      <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-glass)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No historical price data available for this region.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.2rem' }}>💰</span> 10-Year Capital Growth & Rent History
      </h3>

      {aiInsights && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          background: 'rgba(16, 185, 129, 0.1)', 
          borderLeft: '4px solid #10b981',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <strong style={{ color: '#10b981', display: 'block', marginBottom: '5px' }}>🤖 Market Engine Analysis:</strong>
          {aiInsights}
        </div>
      )}

      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis 
              dataKey="year" 
              stroke="rgba(255,255,255,0.5)" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="left" 
              stroke="rgba(255,255,255,0.5)" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            />
            {historyRent10yr && historyRent10yr.length > 0 && (
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="rgba(255,255,255,0.5)" 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                tickFormatter={(val) => `$${val}/w`}
              />
            )}
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}
              formatter={(value: number, name: string) => {
                if (name === "Median Price") return [`$${value.toLocaleString()}`, name];
                if (name === "Median Rent") return [`$${value}/week`, name];
                return [value, name];
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="price" 
              name="Median Price" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 6 }} 
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
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
