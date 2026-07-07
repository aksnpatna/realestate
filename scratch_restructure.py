import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace Panel A Market Snapshot completely
old_panel_a = """                  {/* PANEL A: Market Snapshot */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      Panel A: Market Snapshot
                    </h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {/* House vs Unit bar chart */}
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Median Price: House vs Unit</h4>
                        <div style={{ height: '200px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'House', value: typeof activeSuburb.houseMedianPrice === 'number' ? activeSuburb.houseMedianPrice : (typeof activeSuburb.metrics?.medianPrice === 'number' ? activeSuburb.metrics.medianPrice : 0) },
                              { name: 'Unit', value: activeSuburb.unitMedianPrice || activeSuburb.metrics?.unitMedianPrice || 0 }
                            ]} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tick={{fill: 'var(--text-secondary)'}} />
                              <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `$${Math.abs(Math.round(val / 1000))}k`} />
                              <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                              <Bar dataKey="value" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={50} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          House: {activeSuburb.houseMedianPrice12mChangePct ? `${Number(activeSuburb.houseMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.houseMedianPrice12mChangePct).toFixed(2)}%` : '—'} | Unit: {activeSuburb.unitMedianPrice12mChangePct ? `${Number(activeSuburb.unitMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.unitMedianPrice12mChangePct).toFixed(2)}%` : '—'}
                        </div>
                      </div>
                      {/* Market cards */}
                      <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Days on Market</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                            {activeSuburb.houseDaysOnMarket ? `${activeSuburb.houseDaysOnMarket} Days` : '—'}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Vacancy Rate</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--success)', fontWeight: 'bold' }}>
                            {activeSuburb.vacancyRate != null ? `${Number(activeSuburb.vacancyRate).toFixed(1)}%` : '—'}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Mortgage (New Buyer)</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
                            {(() => {
                              const price = activeSuburb.houseMedianPrice || activeSuburb.metrics?.medianPrice || 0;
                              return typeof price === 'number' && price > 0 ? `$${Math.round(price * 0.8 * 0.062 / 12).toLocaleString()}/mo` : '—';
                            })()}
                          </div>
                        </div>
                      </div>
                      {/* 10-Year Historical Chart */}
                      {activeSuburb.history && activeSuburb.history.length >= 2 && (
                        <div style={{ flex: '1 1 350px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>10-Year Historical Median Price</h4>
                          <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={(activeSuburb.history as any[]).map((pt: any) => ({
                                year: typeof pt.date === 'string' ? pt.date.substring(0, 4) : String(pt.date || ''),
                                price: typeof pt.value === 'number' ? pt.value : 0
                              }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
                                <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="price" stroke="var(--accent-cyan)" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>"""

new_panel_a = """                  {/* PANEL A: Market Snapshot */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      Panel A: Market Snapshot
                    </h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                      {/* House vs Unit bar chart */}
                      <div style={{ flex: '1 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Median Price: House vs Unit</h4>
                        <div style={{ height: '200px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'House', value: typeof activeSuburb.houseMedianPrice === 'number' ? activeSuburb.houseMedianPrice : (typeof activeSuburb.metrics?.medianPrice === 'number' ? activeSuburb.metrics.medianPrice : 0) },
                              { name: 'Unit', value: activeSuburb.unitMedianPrice || activeSuburb.metrics?.unitMedianPrice || 0 }
                            ]} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tick={{fill: 'var(--text-secondary)'}} />
                              <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `$${Math.abs(Math.round(val / 1000))}k`} />
                              <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                              <Bar dataKey="value" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={50} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          House: {activeSuburb.houseMedianPrice12mChangePct ? `${Number(activeSuburb.houseMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.houseMedianPrice12mChangePct).toFixed(2)}%` : '—'} | Unit: {activeSuburb.unitMedianPrice12mChangePct ? `${Number(activeSuburb.unitMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.unitMedianPrice12mChangePct).toFixed(2)}%` : '—'}
                        </div>
                      </div>
                      {/* Market cards */}
                      <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Days on Market (Liquidity)</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                            {activeSuburb.houseDaysOnMarket ? `${activeSuburb.houseDaysOnMarket} Days` : '—'}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Vacancy Rate</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--success)', fontWeight: 'bold' }}>
                            {activeSuburb.vacancyRate != null ? `${Number(activeSuburb.vacancyRate).toFixed(1)}% for rent` : '—'}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Typical Mortgage Repayments</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
                            {(() => {
                              const price = activeSuburb.houseMedianPrice || activeSuburb.metrics?.medianPrice || 0;
                              return typeof price === 'number' && price > 0 ? `$${Math.round(price * 0.8 * 0.062 / 12).toLocaleString()}/mo` : '—';
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Bottom Row: Charts */}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {/* 10-Year Historical Chart */}
                      {activeSuburb.history && activeSuburb.history.length >= 2 && (
                        <div style={{ flex: '1 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>10-Year Historical Median Price</h4>
                          <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={(activeSuburb.history as any[]).map((pt: any) => ({
                                year: typeof pt.date === 'string' ? pt.date.substring(0, 4) : String(pt.date || ''),
                                price: typeof pt.value === 'number' ? pt.value : 0
                              }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
                                <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="price" stroke="var(--accent-cyan)" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      {/* 10-Year Projection */}
                      {activeSuburb.history && activeSuburb.history.length >= 2 && (() => {
                        const hist = activeSuburb.history as any[];
                        const firstVal = Number(hist[0]?.value || 0);
                        const lastVal = Number(hist[hist.length-1]?.value || 0);
                        const years = Math.max(1, hist.length-1);
                        const baseRate = firstVal > 0 && lastVal > 0 ? Math.max(0.02, Math.min(0.08, Math.pow(lastVal/firstVal, 1/years)-1)) : 0.05;
                        const bullRate = baseRate * 1.3;
                        const bearRate = Math.max(0.005, baseRate * 0.3);
                        const projData = Array.from({length:10}, (_, y) => ({
                          year: `+${y+1}y`,
                          bull: Math.round(lastVal * Math.pow(1+bullRate, y+1)),
                          base: Math.round(lastVal * Math.pow(1+baseRate, y+1)),
                          bear: Math.round(lastVal * Math.pow(1+bearRate, y+1)),
                        }));
                        return (
                          <div style={{ flex: '1 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Next 10-Year Projection</h4>
                            <div style={{ height: '220px' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={projData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                  <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                  <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `$${Math.round(val/1000)}k`} />
                                  <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="bull" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Bull" />
                                  <Line type="monotone" dataKey="base" stroke="var(--accent-cyan)" strokeWidth={3} dot={false} name="Base" />
                                  <Line type="monotone" dataKey="bear" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} name="Bear" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ textAlign:'center', marginTop:'10px', fontSize:'0.75rem', color:'var(--text-secondary)', display:'flex', justifyContent:'center', gap:'16px' }}>
                              <span><span style={{color:'#10b981',fontWeight:600}}>── Bull</span> (+{(bullRate*100).toFixed(1)}%)</span>
                              <span><span style={{color:'var(--accent-cyan)',fontWeight:600}}>── Base</span> (+{(baseRate*100).toFixed(1)}%)</span>
                              <span><span style={{color:'#ef4444',fontWeight:600}}>── Bear</span> (+{(bearRate*100).toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>"""

if old_panel_a in content:
    content = content.replace(old_panel_a, new_panel_a)
else:
    print("Could not find old Panel A")

# Remove Projection from Panel C
old_panel_c_proj = """                      {/* 10-Year Projection */}
                      {activeSuburb.history && activeSuburb.history.length >= 2 && (() => {
                        const hist = activeSuburb.history as any[];
                        const firstVal = Number(hist[0]?.value || 0);
                        const lastVal = Number(hist[hist.length-1]?.value || 0);
                        const years = Math.max(1, hist.length-1);
                        const baseRate = firstVal > 0 && lastVal > 0 ? Math.max(0.02, Math.min(0.08, Math.pow(lastVal/firstVal, 1/years)-1)) : 0.05;
                        const bullRate = baseRate * 1.3;
                        const bearRate = Math.max(0.005, baseRate * 0.3);
                        const projData = Array.from({length:10}, (_, y) => ({
                          year: `+${y+1}y`,
                          bull: Math.round(lastVal * Math.pow(1+bullRate, y+1)),
                          base: Math.round(lastVal * Math.pow(1+baseRate, y+1)),
                          bear: Math.round(lastVal * Math.pow(1+bearRate, y+1)),
                        }));
                        return (
                          <div style={{ flex: '2 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Next 10-Year Projection</h4>
                            <div style={{ height: '220px' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={projData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                  <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                  <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `$${Math.round(val/1000)}k`} />
                                  <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="bull" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Bull" />
                                  <Line type="monotone" dataKey="base" stroke="var(--accent-cyan)" strokeWidth={3} dot={false} name="Base" />
                                  <Line type="monotone" dataKey="bear" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} name="Bear" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ textAlign:'center', marginTop:'10px', fontSize:'0.75rem', color:'var(--text-secondary)', display:'flex', justifyContent:'center', gap:'16px' }}>
                              <span><span style={{color:'#10b981',fontWeight:600}}>── Bull</span> (+{(bullRate*100).toFixed(1)}%)</span>
                              <span><span style={{color:'var(--accent-cyan)',fontWeight:600}}>── Base</span> (+{(baseRate*100).toFixed(1)}%)</span>
                              <span><span style={{color:'#ef4444',fontWeight:600}}>── Bear</span> (+{(bearRate*100).toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>"""

if old_panel_c_proj in content:
    content = content.replace(old_panel_c_proj, "                    </div>")
else:
    print("Could not find Panel C projection")

with open('src/App.tsx', 'w') as f:
    f.write(content)
