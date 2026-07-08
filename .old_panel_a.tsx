                          ))}
                      </ul>
                    </div>
                  )}

                  {/* PANEL A: Market Snapshot */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      Panel A: Market Snapshot
                    </h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                      {/* House vs Unit bar chart */}
                      <div style={{ flex: '1 1 350px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Median Price: House vs Unit</h4>
                        <div style={{ height: '150px' }}>
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
                           <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Typical Mortgage Band</div>
                           <div style={{ fontSize: '1.2rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
                             {(activeSuburb as any).typicalMortgageBand || (activeSuburb.metrics as any)?.mortgageBand || '—'}
                      </div>
                    </div>
                    {/* Income Distribution */}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '15px' }}>
                      <div style={{ flex: '1 1 350px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Household Income Bands</h4>
                        <div style={{ height: '180px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(() => {
                              const incData = ((activeSuburb as any).demographicsDetailV3?.income_distribution) || {}
                              return Object.entries(incData).map(([k,v]) => ({ name: k, value: Number(v) }))
                            })()} margin={{ top: 10, right: 10, left: 20, bottom: 0 }} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
                              <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `${val}%`} />
                              <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={10} width={60} />
                              <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Households']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                              <Bar dataKey="value" fill="var(--accent-cyan)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div style={{ flex: '1 1 250px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Household Types</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(() => {
                            const hhData = ((activeSuburb as any).demographicsDetailV3?.household_distribution) || {}
                            const total = Object.values(hhData).reduce((a:number,b:any) => a + Number(b), 0) || 1
                            return Object.entries(hhData).map(([k,v]) => (
                              <div key={k}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span>{k}</span><span>{Number(v).toFixed(0)}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '2px' }}>
                                  <div style={{ height: '100%', width: `${(Number(v)/total*100).toFixed(0)}%`, background: 'var(--accent-purple)', borderRadius: '3px' }} />
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BUYER AGENT SUMMARY */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
