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
      <div className="u-08d2e316">
        No historical price data available for this region.
      </div>
    );
  }

  return (
    <div className="u-e995d5ba">
      <div className="u-b3de5e53">
        <h3 className="u-45113675">
          <span className="u-ce0fd88b">💰</span> 10-Year Capital Growth & Rent History
        </h3>
        {aiInsights && (
          <div className="u-51e5e267">
            {aiInsights.cagr}% CAGR
          </div>
        )}
      </div>

      {aiInsights && (
        <div className="u-29ba20c2">
          <strong className="u-ae4f9a74">🤖 Market Analysis</strong>
          {aiInsights.text}
        </div>
      )}

      <div className="u-df6b2905">
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
