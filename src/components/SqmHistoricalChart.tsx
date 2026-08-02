import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

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
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return {
        date: date.getTime(),
        dateStr: `${v.year}-${String(v.month).padStart(2, '0')}`,
        displayDate: `${monthNames[v.month - 1]} ${v.year}`,
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
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          data.push({
            date: date.getTime(),
            dateStr,
            displayDate: `${monthNames[s.month - 1]} ${s.year}`,
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

  // Determine vacancy color based on current rate
  const currentVacancy = chartData.length > 0 ? chartData[chartData.length - 1]?.vacancyRate : null;
  const vacancyColor = currentVacancy != null 
    ? currentVacancy < 2 ? '#059669' : currentVacancy > 3 ? '#DC2626' : '#0284C7'
    : '#0284C7';

  if (!sqmData || !chartData.length) {
    return (
      <div className="u-44d7b424">
        No historical market data available for this region.
      </div>
    );
  }

  return (
    <div className="u-e995d5ba">
      <h3 className="u-3cbf0169">
        <span className="u-ce0fd88b">📈</span> 15-Year Vacancy & Stock History
      </h3>
      <p className="u-9ce7e2f5">
        Rental market supply and demand trends
      </p>

      {aiInsights && (
        <div className="u-6e82986b">
          <strong className="u-de7d56da">🤖 Market Analysis</strong>
          {aiInsights}
        </div>
      )}

      <div className="u-df6b2905">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
            <XAxis 
              dataKey="dateStr" 
              stroke="var(--text-muted)" 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(val) => val.split('-')[0]} // Show only year
              minTickGap={40}
              label={{ value: 'Year', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <YAxis 
              yAxisId="left" 
              stroke="var(--text-muted)" 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(val) => `${val.toFixed(1)}%`}
              domain={[0, 'dataMax + 1']}
              label={{ value: 'Vacancy Rate (%)', angle: -90, position: 'insideLeft', offset: 5, fill: 'var(--text-muted)', fontSize: 11, style: { textAnchor: 'middle' } }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="var(--text-muted)" 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : String(val)}
              label={{ value: 'Active Listings', angle: 90, position: 'insideRight', offset: 5, fill: 'var(--text-muted)', fontSize: 11, style: { textAnchor: 'middle' } }}
            />
            
            {/* Reference lines for vacancy thresholds */}
            <ReferenceLine 
              yAxisId="left" 
              y={2} 
              stroke="#059669" 
              strokeDasharray="4 4" 
              strokeWidth={1}
              label={{ value: '2% — Landlord Market', position: 'insideTopRight', fill: '#059669', fontSize: 10 }}
            />
            <ReferenceLine 
              yAxisId="left" 
              y={3} 
              stroke="#DC2626" 
              strokeDasharray="4 4" 
              strokeWidth={1}
              label={{ value: '3% — Oversupply Risk', position: 'insideTopRight', fill: '#DC2626', fontSize: 10 }}
            />

            <Tooltip 
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              itemStyle={{ color: 'var(--text-primary)' }}
              labelStyle={{ color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}
              labelFormatter={(label) => {
                const item = chartData.find((d: any) => d.dateStr === label);
                return item?.displayDate || label;
              }}
              formatter={(value: any, name: string) => {
                if (name === 'Vacancy Rate (%)') return [`${Number(value).toFixed(2)}%`, 'Vacancy Rate'];
                if (name === 'Stock on Market') return [Number(value).toLocaleString(), 'Active Listings'];
                return [value, name];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="vacancyRate" 
              name="Vacancy Rate (%)" 
              stroke={vacancyColor} 
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--bg-card)' }} 
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="stock" 
              name="Stock on Market" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Vacancy interpretation guide */}
      <div className="u-5ba97460">
        <span className="u-b98e583d">
          <span className="u-97b23a5f" />
          &lt;2% Landlord market
        </span>
        <span className="u-893a4e24">
          <span className="u-c90dc131" />
          2-3% Balanced
        </span>
        <span className="u-f853e331">
          <span className="u-880f516d" />
          &gt;3% Tenant-favourable
        </span>
      </div>
    </div>
  );
}
