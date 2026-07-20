import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SqmHistoricalChartProps {
  sqmData: any;
}

export default function SqmHistoricalChart({ sqmData }: SqmHistoricalChartProps) {
  const chartData = useMemo(() => {
    if (!sqmData || !sqmData.vacancy) return [];

    // Transform vacancy data
    const data = sqmData.vacancy.map((v: any) => {
      // Create a date object
      const date = new Date(v.year, v.month - 1);
      return {
        date: date.getTime(),
        dateStr: `${v.year}-${String(v.month).padStart(2, '0')}`,
        vacancyRate: parseFloat(v.vr) * 100, // Convert to percentage
      };
    });

    // Merge stock data if available
    if (sqmData.stock) {
      sqmData.stock.forEach((s: any) => {
        const dateStr = `${s.year}-${String(s.month).padStart(2, '0')}`;
        const existing = data.find((d: any) => d.dateStr === dateStr);
        if (existing) {
          existing.stock = parseInt(s.total, 10);
        } else {
          const date = new Date(s.year, s.month - 1);
          data.push({
            date: date.getTime(),
            dateStr,
            stock: parseInt(s.total, 10),
          });
        }
      });
    }

    // Sort by date
    data.sort((a: any, b: any) => a.date - b.date);
    return data;
  }, [sqmData]);

  const aiInsights = useMemo(() => {
    if (chartData.length < 12) return null;

    const current = chartData[chartData.length - 1];
    const yearAgo = chartData[chartData.length - 13]; // Approx 12 months ago
    
    if (!current || !yearAgo || current.vacancyRate == null || yearAgo.vacancyRate == null) return null;

    const vrChange = current.vacancyRate - yearAgo.vacancyRate;
    const vrTrend = vrChange < -0.5 ? "tightening significantly" : vrChange > 0.5 ? "loosening rapidly" : "remaining stable";
    
    let insight = `The rental market is ${vrTrend}, with vacancy rates shifting from ${yearAgo.vacancyRate.toFixed(1)}% to ${current.vacancyRate.toFixed(1)}% over the last 12 months. `;

    if (current.vacancyRate < 1.5) {
      insight += "This indicates severe supply constraints, placing extreme upward pressure on asking rents and representing a landlord-favorable environment.";
    } else if (current.vacancyRate > 3.0) {
      insight += "Elevated vacancy risks indicate an oversupply of stock, which typically suppresses rental yields and limits capital growth potential in the short term.";
    } else {
      insight += "The market is currently balanced, providing a stable environment for both yields and steady capital appreciation.";
    }

    if (current.stock != null && yearAgo.stock != null) {
      const stockChange = ((current.stock - yearAgo.stock) / yearAgo.stock) * 100;
      if (stockChange < -10) {
        insight += ` Total inventory has plummeted by ${Math.abs(stockChange).toFixed(1)}%, acting as a strong leading indicator for imminent price acceleration.`;
      } else if (stockChange > 10) {
        insight += ` However, stock on market has accumulated by ${stockChange.toFixed(1)}%, suggesting vendor discounting may become prevalent.`;
      }
    }

    return insight;
  }, [chartData]);

  if (!sqmData || !chartData.length) {
    return (
      <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-glass)', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No historical market data available for this region.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.2rem' }}>📈</span> 15-Year Institutional Market History
      </h3>

      {aiInsights && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          background: 'rgba(59, 130, 246, 0.1)', 
          borderLeft: '4px solid #3b82f6',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <strong style={{ color: '#60a5fa', display: 'block', marginBottom: '5px' }}>🤖 Market Engine Analysis:</strong>
          {aiInsights}
        </div>
      )}

      <div style={{ height: '300px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="dateStr" 
              stroke="rgba(255,255,255,0.5)" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              tickFormatter={(val) => val.split('-')[0]} // Show only year
              minTickGap={30}
            />
            <YAxis 
              yAxisId="left" 
              stroke="rgba(255,255,255,0.5)" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              tickFormatter={(val) => `${val}%`}
              domain={[0, 'dataMax + 1']}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="rgba(255,255,255,0.5)" 
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="vacancyRate" 
              name="Vacancy Rate (%)" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }} 
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="stock" 
              name="Stock on Market" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
