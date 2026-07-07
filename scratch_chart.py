import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace the 20-Year Equity Projection with the 10-Year Historical
target_regex = r"<h4 style={{ textAlign: 'center', marginBottom: '10px' }}>20-Year Equity Projection</h4>.*?<Line type=\"monotone\" dataKey=\"equity\" stroke=\"var\(--accent-purple\)\" strokeWidth=\{2\} dot=\{false\} />\s*</LineChart>"

replacement = """<h4 style={{ textAlign: 'center', marginBottom: '10px' }}>10-Year Historical & Next 10-Year Projection (Yield & Price)</h4>
                          <div style={{ height: '250px' }}>
                            <ResponsiveContainer width="100%" height="100%">
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
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                                <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={12} tick={{fill: 'var(--text-secondary)'}} />
                                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${Math.abs(val / 1000)}k`} />
                                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `${val}%`} />
                                <RechartsTooltip formatter={(value: number, name: string) => [name === 'yield' ? `${value}%` : `$${value.toLocaleString()}`, name.toUpperCase()]} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                <Line yAxisId="left" type="monotone" dataKey="price" stroke="var(--accent-primary)" strokeWidth={2} name="Historical Price" dot />
                                <Line yAxisId="left" type="monotone" dataKey="bull" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Bull Case (+95% Conf)" />
                                <Line yAxisId="left" type="monotone" dataKey="base" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" name="Base Case" />
                                <Line yAxisId="left" type="monotone" dataKey="bear" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Bear Case (-95% Conf)" />
                                <Line yAxisId="right" type="monotone" dataKey="yield" stroke="#f59e0b" strokeWidth={2} name="Hist. Yield %" />
                              </LineChart>"""

content = re.sub(target_regex, replacement, content, flags=re.DOTALL)

with open('src/App.tsx', 'w') as f:
    f.write(content)
