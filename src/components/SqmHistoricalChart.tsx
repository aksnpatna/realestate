import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

interface SqmHistoricalChartProps {
  sqmData: any;
}

export default function SqmHistoricalChart({ sqmData }: SqmHistoricalChartProps) {
  const chartData = useMemo(() => {
    if (!sqmData || (!sqmData.vacancy && !sqmData.stock && !sqmData.rents && !sqmData.prices)) return [];

    const data: any[] = [];

    // Process all available data types
    const dataTypes = [
      { key: 'vacancy', dateFields: ['year', 'month'], process: (d: any) => ({ vacancyRate: parseFloat(d.vr) * 100 }) },
      { key: 'stock', dateFields: ['year', 'month'], process: (d: any) => {
        let total = parseInt(d.total, 10);
        if (isNaN(total)) {
          total = (parseInt(d.r30, 10) || 0) + (parseInt(d.r60, 10) || 0) + (parseInt(d.r90, 10) || 0) + (parseInt(d.r180, 10) || 0) + (parseInt(d.r180p, 10) || 0);
        }
        return { stock: total > 0 ? total : null };
      } },
      { key: 'rents', dateFields: ['date'], process: (d: any) => ({
        houseRent: parseFloat(d.houses_all) || null,
        unitRent: parseFloat(d.units_all) || null
      }) },
      { key: 'prices', dateFields: ['date'], process: (d: any) => ({
        housePrice: parseFloat(d.houses_all) ? (parseFloat(d.houses_all) < 10000 ? parseFloat(d.houses_all) * 1000 : parseFloat(d.houses_all)) : null,
        unitPrice: parseFloat(d.units_all) ? (parseFloat(d.units_all) < 10000 ? parseFloat(d.units_all) * 1000 : parseFloat(d.units_all)) : null
      }) }
    ];

    dataTypes.forEach(({ key, dateFields, process }) => {
      const dataset = sqmData[key];
      if (!dataset || !Array.isArray(dataset) || dataset.length === 0) return;

      dataset.forEach((item: any) => {
        let date: Date;
        let dateStr: string;
        let displayDate: string;

        if (dateFields.includes('year') && dateFields.includes('month')) {
          date = new Date(item.year, item.month - 1);
          dateStr = `${item.year}-${String(item.month).padStart(2, '0')}`;
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          displayDate = `${monthNames[item.month - 1]} ${item.year}`;
        } else if (dateFields.includes('date')) {
          const parts = item.date.split('-');
          if (parts.length >= 2) {
            dateStr = `${parts[0]}-${parts[1]}`;
            date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
          } else {
            return;
          }
        } else {
          return;
        }

        const existing = data.find(d => d.dateStr === dateStr);
        const processed = process(item);
        
        if (existing) {
          Object.assign(existing, processed);
        } else {
          data.push({
            date: date.getTime(),
            dateStr,
            displayDate,
            ...processed
          });
        }
      });
    });

    // Sort by date
    data.sort((a, b) => a.date - b.date);
    return data;
  }, [sqmData]);

  const aiInsights = useMemo(() => {
    if (chartData.length < 12) return null;

    const current = chartData[chartData.length - 1];
    const yearAgo = chartData[chartData.length - 13]; // Approx 12 months ago
    let insights = [];
    
    // Rental market analysis
    if (current.vacancyRate != null && yearAgo.vacancyRate != null) {
      const vrChange = current.vacancyRate - yearAgo.vacancyRate;
      const vrTrend = vrChange < -0.5 ? "tightening significantly" : vrChange > 0.5 ? "loosening rapidly" : "remaining stable";
      
      let rentalInsight = `The rental market is ${vrTrend}, with vacancy rates shifting from ${yearAgo.vacancyRate.toFixed(1)}% to ${current.vacancyRate.toFixed(1)}% over the last 12 months. `;

      if (current.vacancyRate < 1.5) {
        rentalInsight += "This indicates severe supply constraints, placing extreme upward pressure on asking rents and representing a landlord-favorable environment.";
      } else if (current.vacancyRate > 3.0) {
        rentalInsight += "Elevated vacancy risks indicate an oversupply of stock, which typically suppresses rental yields and limits capital growth potential in the short term.";
      } else {
        rentalInsight += "The market is currently balanced, providing a stable environment for both yields and steady capital appreciation.";
      }
      
      insights.push(rentalInsight);
    }

    // Stock on market analysis
    if (current.stock != null && yearAgo.stock != null) {
      const stockChange = ((current.stock - yearAgo.stock) / yearAgo.stock) * 100;
      if (stockChange < -10) {
        insights.push(`Total inventory has plummeted by ${Math.abs(stockChange).toFixed(1)}%, acting as a strong leading indicator for imminent price acceleration.`);
      } else if (stockChange > 10) {
        insights.push(`Stock on market has accumulated by ${stockChange.toFixed(1)}%, suggesting vendor discounting may become prevalent.`);
      }
    }

    // Rent trend analysis
    if (current.houseRent != null && yearAgo.houseRent != null) {
      const rentChange = ((current.houseRent - yearAgo.houseRent) / yearAgo.houseRent) * 100;
      if (Math.abs(rentChange) > 5) {
        const direction = rentChange > 0 ? "increased" : "decreased";
        insights.push(`House rents have ${direction} by ${Math.abs(rentChange).toFixed(1)}% over the past year, indicating strong ${rentChange > 0 ? 'tenant demand' : 'rental market softness'}.`);
      }
    }

    // Price trend analysis
    if (current.housePrice != null && yearAgo.housePrice != null) {
      const priceChange = ((current.housePrice - yearAgo.housePrice) / yearAgo.housePrice) * 100;
      if (Math.abs(priceChange) > 5) {
        const direction = priceChange > 0 ? "risen" : "fallen";
        insights.push(`House prices have ${direction} by ${Math.abs(priceChange).toFixed(1)}% over the past year, showing ${priceChange > 0 ? 'strong capital growth' : 'market correction'}.`);
      }
    }

    return insights.join(' ');
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
        <span className="u-ce0fd88b">📈</span> 15-Year Market History
      </h3>
      <p className="u-9ce7e2f5">
        Rental market supply and demand trends, plus price and rent movements
      </p>

      {aiInsights && (
        <div className="u-6e82986b">
          <strong className="u-de7d56da">🤖 Market Analysis</strong>
          {aiInsights}
        </div>
      )}

      {/* Vacancy & Stock Chart */}
      {sqmData.vacancy || sqmData.stock ? (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Vacancy & Stock Trends</h4>
          <div className="u-df6b2905">
            <ResponsiveContainer width="100%" height={300}>
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
                {sqmData.vacancy && (
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="vacancyRate" 
                    name="Vacancy Rate (%)" 
                    stroke={vacancyColor} 
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={true}
                    activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--bg-card)' }} 
                  />
                )}
                {sqmData.stock && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="stock" 
                    name="Stock on Market" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls={true}
                    strokeDasharray="5 3"
                  />
                )}
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
      ) : null}

      {/* Rent Trends Chart */}
      {sqmData.rents ? (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Rent Trends</h4>
          <div className="u-df6b2905">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                <XAxis 
                  dataKey="dateStr" 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(val) => val.split('-')[0]}
                  minTickGap={40}
                  label={{ value: 'Year', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(val) => `$${Number(val).toLocaleString()}`}
                  label={{ value: 'Weekly Rent ($)', angle: -90, position: 'insideLeft', offset: 5, fill: 'var(--text-muted)', fontSize: 11, style: { textAnchor: 'middle' } }}
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
                    if (name === 'House Rent') return [`$${Number(value).toFixed(0)}`, 'House Rent'];
                    if (name === 'Unit Rent') return [`$${Number(value).toFixed(0)}`, 'Unit Rent'];
                    return [value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }}
                />
                {sqmData.rents && (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="houseRent" 
                      name="House Rent" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unitRent" 
                      name="Unit Rent" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                      strokeDasharray="5 3"
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* Price Trends Chart */}
      {sqmData.prices ? (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Price Trends</h4>
          <div className="u-df6b2905">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                <XAxis 
                  dataKey="dateStr" 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(val) => val.split('-')[0]}
                  minTickGap={40}
                  label={{ value: 'Year', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(val) => `$${(Number(val)/1000).toFixed(0)}k`}
                  label={{ value: 'Median Price ($)', angle: -90, position: 'insideLeft', offset: 5, fill: 'var(--text-muted)', fontSize: 11, style: { textAnchor: 'middle' } }}
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
                    if (name === 'House Price') return [`$${Number(value).toLocaleString()}`, 'House Price'];
                    if (name === 'Unit Price') return [`$${Number(value).toLocaleString()}`, 'Unit Price'];
                    return [value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }}
                />
                {sqmData.prices && (
                  <>
                    <Line 
                      type="monotone" 
                      dataKey="housePrice" 
                      name="House Price" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unitPrice" 
                      name="Unit Price" 
                      stroke="#ec4899" 
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                      strokeDasharray="5 3"
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
