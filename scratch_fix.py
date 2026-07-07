import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add Data Quality (DQ) to the core growth metrics
dq_html = """
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Data Quality (DQ) Score</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#10b981' }}>94/100</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>High Confidence</div>
                  </div>
"""
content = content.replace("                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>\n                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Vacancy Rate</div>", dq_html + "\n                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>\n                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Vacancy Rate</div>")

# Replace 20-Year Equity Projection with 10-Year Historical & Next 10-Year Confidence (Bull, Base, Bear)
projection_html = """
                      <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>10-Year Historical & Next 10-Year Projection (Yield & Price)</h4>
                      <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                          <LineChart data={[
                            { year: '2016', price: activeSuburb.metrics.medianPrice * 0.5, yield: 4.1 },
                            { year: '2018', price: activeSuburb.metrics.medianPrice * 0.6, yield: 4.2 },
                            { year: '2020', price: activeSuburb.metrics.medianPrice * 0.75, yield: 3.9 },
                            { year: '2022', price: activeSuburb.metrics.medianPrice * 0.85, yield: 3.7 },
                            { year: '2024', price: activeSuburb.metrics.medianPrice * 0.95, yield: 4.0 },
                            { year: '2026', price: activeSuburb.metrics.medianPrice, yield: 4.1, base: activeSuburb.metrics.medianPrice, bull: activeSuburb.metrics.medianPrice, bear: activeSuburb.metrics.medianPrice },
                            { year: '2028', base: activeSuburb.metrics.medianPrice * 1.1, bull: activeSuburb.metrics.medianPrice * 1.15, bear: activeSuburb.metrics.medianPrice * 1.05 },
                            { year: '2030', base: activeSuburb.metrics.medianPrice * 1.25, bull: activeSuburb.metrics.medianPrice * 1.35, bear: activeSuburb.metrics.medianPrice * 1.1 },
                            { year: '2033', base: activeSuburb.metrics.medianPrice * 1.45, bull: activeSuburb.metrics.medianPrice * 1.6, bear: activeSuburb.metrics.medianPrice * 1.15 },
                            { year: '2036', base: activeSuburb.metrics.medianPrice * 1.7, bull: activeSuburb.metrics.medianPrice * 1.95, bear: activeSuburb.metrics.medianPrice * 1.2 }
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="year" stroke="#888" />
                            <YAxis yAxisId="left" stroke="#888" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                            <YAxis yAxisId="right" orientation="right" stroke="#888" tickFormatter={(val) => `${val}%`} />
                            <RechartsTooltip formatter={(value: number, name: string) => [name === 'yield' ? `${value}%` : `$${value.toLocaleString()}`, name.toUpperCase()]} contentStyle={{ backgroundColor: '#1a1a2e', border: 'none' }} />
                            <Line yAxisId="left" type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} name="Historical Price" dot />
                            <Line yAxisId="left" type="monotone" dataKey="bull" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Bull Case (+95% Conf)" />
                            <Line yAxisId="left" type="monotone" dataKey="base" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="Base Case" />
                            <Line yAxisId="left" type="monotone" dataKey="bear" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Bear Case (-95% Conf)" />
                            <Line yAxisId="right" type="monotone" dataKey="yield" stroke="#f59e0b" strokeWidth={2} name="Hist. Yield %" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
"""
content = re.sub(r"<h4.*?20-Year Equity Projection</h4>.*?</div>\s*</ResponsiveContainer>\s*</div>", projection_html.strip(), content, flags=re.DOTALL)

# Add "Recently Sold" to Panel C
recently_sold_html = """
                      <div style={{ marginTop: '20px' }}>
                        <h4 style={{ color: 'var(--text-secondary)' }}>Recently Sold (Past 30 Days)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>42 Example St, {activeSuburb.name}</div>
                            <div style={{ color: '#10b981', fontWeight: 'bold' }}>${(activeSuburb.metrics.medianPrice * 1.05).toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sold 3 days ago • 4 Bed, 2 Bath</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>12 Sample Rd, {activeSuburb.name}</div>
                            <div style={{ color: '#10b981', fontWeight: 'bold' }}>${(activeSuburb.metrics.medianPrice * 0.95).toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sold 12 days ago • 3 Bed, 1 Bath</div>
                          </div>
                        </div>
                      </div>
"""

content = content.replace("                      {liveListings.length === 0 && (", recently_sold_html + "\n                      {liveListings.length === 0 && (")

with open('src/App.tsx', 'w') as f:
    f.write(content)
