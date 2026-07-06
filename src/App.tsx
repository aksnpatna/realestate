import { useState, useMemo, useEffect } from 'react'
import { mockSuburbsData } from './data/suburbs'
import type { SuburbData } from './data/suburbs'
import SuburbMap from './components/SuburbMap'
import AffordabilityCalculator from './components/AffordabilityCalculator'
import HouseSearch from './components/HouseSearch'
import CashflowGearing from './components/CashflowGearing'
import { fetchLivabilityData, type LivabilityData } from './services/osmApi'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import './index.css'

type TabName = 'profile' | 'search' | 'affordability' | 'gearing';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  
  const [suburbsData, setSuburbsData] = useState<SuburbData[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [livabilityData, setLivabilityData] = useState<LivabilityData | null>(null)
  const [loadingLivability, setLoadingLivability] = useState(false)
  const [showPrimarySchools, setShowPrimarySchools] = useState(false)
  const [showSecondarySchools, setShowSecondarySchools] = useState(false)

  const [activeTab, setActiveTab] = useState<TabName>('profile')
  const [activeState, setActiveState] = useState<string>('VIC')
  const [activeSuburb, setActiveSuburb] = useState<SuburbData | null>(null)

  const loadColdSuburb = async (id: string) => {
    const cacheBuster = '?t=' + Date.now()
    try {
      const res = await fetch(`/api/suburbs/${id}${cacheBuster}`)
      if (res.ok) {
        const data = await res.json()
        console.log('loadColdSuburb success', id, Object.keys(data).slice(0,8))
        setActiveSuburb(data)
      } else {
        console.error('loadColdSuburb failed', id, res.status)
      }
    } catch (e) {
      console.error('loadColdSuburb error', id, e)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/suburbs')
        .then(res => res.json())
        .then(apiData => {
          if (apiData && apiData.length > 0) {
            const dbIds = new Set(apiData.map((s: SuburbData) => s.id))
            const merged = [...apiData]
            for (const sub of mockSuburbsData) {
              if (!dbIds.has(sub.id)) {
                merged.push(sub)
              }
            }
            setSuburbsData(merged)
          } else {
            setSuburbsData(mockSuburbsData)
          }
          setLoadingData(false)
        })
        .catch((err: unknown) => {
          console.error("API error, using full mock data:", err)
          setSuburbsData(mockSuburbsData)
          setLoadingData(false)
        })
    }
  }, [isAuthenticated])

  const states = useMemo(() => Array.from(new Set(suburbsData.map(s => s.state))).sort(), [suburbsData])
  const stateSuburbs = useMemo(() =>
    suburbsData.filter(s => s.state === activeState).sort((a, b) => a.name.localeCompare(b.name)),
    [activeState, suburbsData]
  )

  useEffect(() => {
    if (stateSuburbs.length > 0) {
      if (!activeSuburb || activeSuburb.state !== activeState) {
        loadColdSuburb(stateSuburbs[0].id)
      }
    } else {
      setActiveSuburb(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState, stateSuburbs])

  useEffect(() => {
    setLivabilityData(null)
  }, [activeSuburb])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const cleanEmail = email.trim()
    const cleanPassword = password.trim()
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      })
      if (res.ok) {
        setIsAuthenticated(true)
        setLoginError('')
      } else {
        const msg = await res.text();
        setLoginError(msg || `Invalid credentials (Status: ${res.status})`)
      }
    } catch {
      setLoginError('Network error — check if backend is running')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass-card" style={{ padding: '40px', maxWidth: '400px', width: '100%' }}>
          <h1 className="title-glow" style={{ textAlign: 'center', marginBottom: '10px' }}>Real Estate Engine</h1>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: '30px' }}>Login to Dashboard</p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="control-group">
              <label className="control-label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="premium-select" style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required />
            </div>
            <div className="control-group">
              <label className="control-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="premium-select" style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required />
            </div>
            {loginError && <div style={{ color: 'var(--warning)', fontSize: '14px', textAlign: 'center' }}>{loginError}</div>}
            <button type="submit" className="tab-btn tab-active" style={{ width: '100%', marginTop: '10px' }}>Login</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <header>
        <h1 className="title-glow">Real Estate Engine</h1>
        <p className="subtitle">Algorithmic Suburb Profiling & Growth Potential</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Suburb Profile
        </button>
        <button
          className={`tab-btn ${activeTab === 'search' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          House Search
        </button>
        <button
          className={`tab-btn ${activeTab === 'affordability' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('affordability')}
        >
          Affordability &amp; Buy
        </button>
        <button
          className={`tab-btn ${activeTab === 'gearing' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('gearing')}
        >
          Cashflow &amp; Gearing
        </button>
      </nav>

      {activeTab === 'profile' && (
        <div className="main-grid">
          <aside className="sidebar glass-card">
            {loadingData ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading database...
              </div>
            ) : (
              <>
                <div className="control-group">
                  <label className="control-label">Region / State</label>
                  <div className="custom-select-wrapper">
                    <select className="premium-select" value={activeState} onChange={(e) => setActiveState(e.target.value)}>
                      {states.map(state => <option key={state} value={state}>{state} - Australia</option>)}
                    </select>
                  </div>
                </div>

            <div className="control-group">
              <label className="control-label">Target Suburb</label>
              <div className="custom-select-wrapper">
                <select
                  className="premium-select"
                  value={activeSuburb?.id || ''}
                  onChange={(e) => {
                    const sub = stateSuburbs.find(s => s.id === e.target.value)
                    if (sub) setActiveSuburb(sub)
                  }}
                >
                  {stateSuburbs.map(suburb => (
                    <option key={suburb.id} value={suburb.id}>
                      {suburb.name} ({suburb.postcode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeSuburb && (
              <div className="sidebar-preview">
                <div className="preview-score">
                  <span className="preview-score-value">{activeSuburb.growthScore}</span>
                  <span className="preview-score-label">Score</span>
                </div>
                <p className="preview-text">
                  {activeSuburb.isMetro && activeSuburb.cbdDistanceMins !== null
                    ? `${activeSuburb.cbdDistanceMins} min to ${activeSuburb.metroCBD}`
                    : 'Regional suburb'}
                </p>
              </div>
                )}
              </>
            )}
          </aside>

          <main className="main-content">
            {activeSuburb ? (
              <div className="content-wrapper animate-fade-in key-wrap" key={activeSuburb.id}>
                <div className="glass-card">
                    <div className="detail-header">
                      <div>
                        <h2 className="detail-title">{activeSuburb.name}, {activeSuburb.state}
                          <span style={{fontSize:'0.5rem',color:'var(--warning)',marginLeft:'12px'}}>
                            [S:{Object.keys(activeSuburb).length}k|K:{Object.keys(activeSuburb).filter(k=>k.indexOf('house')>=0||k.indexOf('owner')>=0||k.indexOf('age')>=0||k.indexOf('invest')>=0).join(',')||'NONE'}]
                          </span>
                        </h2>
                      <p className="subtitle">
                        {activeSuburb.isMetro && activeSuburb.cbdDistanceMins !== null
                          ? `${activeSuburb.cbdDistanceMins} min to ${activeSuburb.metroCBD}`
                          : activeSuburb.metroCBD}
                      </p>
                      {activeSuburb.lastUpdated && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Data Last Updated: {new Date(activeSuburb.lastUpdated).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="main-score">
                      <div className="main-score-value" title="Formula: (Pop% * 10) + (Infra$B * 3) + (School * 3) + (Transit * 2) + (Yield * 2) - Distance Penalty">
                        {activeSuburb.growthScore}
                      </div>
                      <div className="main-score-label">Growth Probability</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', textAlign: 'center', maxWidth: '120px' }}>
                        *Score = PopGrowth + Infra + Schools + Transit + Yield - Distance
                      </div>
                    </div>
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-label">Median Price</div>
                      <div className="metric-value">
                        {typeof activeSuburb.metrics.medianPrice === 'number'
                          ? `$${activeSuburb.metrics.medianPrice.toLocaleString()}`
                          : activeSuburb.metrics.medianPrice}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Population Growth</div>
                      <div className="metric-value highlight-cyan">
                        {activeSuburb.metrics.populationGrowth && activeSuburb.metrics.populationGrowth !== 'N/A'
                          ? activeSuburb.metrics.populationGrowth
                          : 'No data'}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Infrastructure Inv.</div>
                      <div className="metric-value highlight-purple">
                        {activeSuburb.metrics.infrastructureInvestment && activeSuburb.metrics.infrastructureInvestment !== 'N/A'
                          ? activeSuburb.metrics.infrastructureInvestment
                          : 'No data'}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">School Quality (0-10)</div>
                      <div className="metric-value">
                        {typeof activeSuburb.metrics.schoolQuality === 'number'
                          ? activeSuburb.metrics.schoolQuality
                          : 'No data'}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Transit Access (0-10)</div>
                      <div className="metric-value">
                        {typeof activeSuburb.metrics.transitAccessibility === 'number'
                          ? activeSuburb.metrics.transitAccessibility
                          : 'No data'}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Avg Rental Yield</div>
                      <div className="metric-value">
                        {typeof activeSuburb.metrics.rentalYield === 'number'
                          ? `${activeSuburb.metrics.rentalYield}%`
                          : activeSuburb.metrics.rentalYield}
                      </div>
                    </div>
                    <div className="metric-box" style={{ gridColumn: 'span 2' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div className="metric-label" style={{ marginBottom: 0 }}>AI News Sentiment</div>
                        <button 
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/analyze-suburb', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ suburb: activeSuburb.name, state: activeSuburb.state, id: activeSuburb.id })
                              });
                              if(res.ok) {
                                const data = await res.json();
                                alert(`Analysis Complete!\nSentiment: ${data.sentiment}\nSummary: ${data.summary}`);
                                window.location.reload(); // Quick hack to refresh data
                              }
                            } catch {
                              alert("Analysis failed.");
                            }
                          }}
                          style={{
                            background: 'var(--accent-cyan)', color: '#000', border: 'none', 
                            padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'
                          }}
                        >
                          Analyze Live News
                        </button>
                      </div>
                      <div className={`metric-value ${
                        activeSuburb.metrics.aiNewsSentiment?.includes('Bullish') ? 'highlight-cyan' :
                        activeSuburb.metrics.aiNewsSentiment?.includes('Bearish') ? 'text-warning' : 'text-muted'
                      }`}>
                        {activeSuburb.metrics.aiNewsSentiment || 'Neutral (0.0)'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                        {activeSuburb.metrics.aiNewsSummary || 'Disclaimer: AI generated sentiment based on live news. Always verify with actual market data before considering.'}
                        {activeSuburb.metrics.aiNewsSummary && <div style={{marginTop: '4px'}}>*Disclaimer: AI generated sentiment based on live news. Always verify with actual market data before considering.</div>}
                      </div>
                    </div>
                  </div>

                  {activeSuburb.highlights && activeSuburb.highlights.length > 0 && !activeSuburb.highlights.every(h =>
                    h.includes('N/A') || h.includes('Data Unavailable') || h.includes('generated') || h.includes('Pending')
                  ) && (
                    <div className="highlights-section">
                      <h3>Investment Catalysts</h3>
                      <ul className="highlights-list">
                        {activeSuburb.highlights
                          .filter(h => !h.includes('N/A') && !h.includes('Data Unavailable') && !h.includes('generated') && !h.includes('Pending'))
                          .map((highlight, index) => (
                            <li key={index}>{highlight}</li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* PANEL A: Market Snapshot */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      Panel A: Market Snapshot
                    </h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {/* House vs Unit bar chart */}
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Median Price: House vs Unit</h4>
                        <div style={{ height: '200px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'House', value: typeof activeSuburb.houseMedianPrice === 'number' ? activeSuburb.houseMedianPrice : (typeof activeSuburb.metrics?.medianPrice === 'number' ? activeSuburb.metrics.medianPrice : 0) },
                              { name: 'Unit', value: activeSuburb.unitMedianPrice || activeSuburb.metrics?.unitMedianPrice || 0 }
                            ]} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tick={{fill: 'var(--text-secondary)'}} />
                              <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${Math.abs(Math.round(val / 1000))}k`} />
                              <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                              <Bar dataKey="value" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={50} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          House: {activeSuburb.houseMedianPrice12mChangePct ? `${Number(activeSuburb.houseMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.houseMedianPrice12mChangePct).toFixed(2)}%` : '—'} | Unit: {activeSuburb.unitMedianPrice12mChangePct ? `${Number(activeSuburb.unitMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.unitMedianPrice12mChangePct).toFixed(2)}%` : '—'}
                        </div>
                      </div>
                      {/* Market cards */}
                      <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Days on Market</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                            {activeSuburb.houseDaysOnMarket ? `${activeSuburb.houseDaysOnMarket} Days` : '—'}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px', flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Vacancy Rate</div>
                          <div style={{ fontSize: '1.2rem', color: 'var(--success)', fontWeight: 'bold' }}>
                            {activeSuburb.vacancyRate != null ? `${Number(activeSuburb.vacancyRate).toFixed(1)}%` : '—'}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px', flex: 1 }}>
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
                        <div style={{ flex: '2 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>10-Year Historical Median Price</h4>
                          <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={(activeSuburb.history as any[]).map((pt: any) => ({
                                year: typeof pt.date === 'string' ? pt.date.substring(0, 4) : String(pt.date || ''),
                                price: typeof pt.value === 'number' ? pt.value : 0
                              }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                                <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
                                <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="price" stroke="var(--accent-cyan)" strokeWidth={3} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NEW LIVABILITY SECTION */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>Real-Time Livability & Amenities</h3>
                      {!livabilityData && !loadingLivability && (
                        <button
                          onClick={async () => {
                            setLoadingLivability(true);
                            try {
                              const coords = activeSuburb.coordinates || [-37.8, 145.0];
                              const data = await fetchLivabilityData(coords[0], coords[1]);
                              setLivabilityData(data);
                            } catch {
                              alert("Failed to load livability data");
                            }
                            setLoadingLivability(false);
                          }}
                          style={{
                            background: 'var(--accent-purple)', color: '#fff', border: 'none', 
                            padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
                          }}
                        >
                          Scan Area (Live)
                        </button>
                      )}
                    </div>
                    {loadingLivability && <p style={{ color: 'var(--text-secondary)' }}>Scanning neighborhood via OpenStreetMap...</p>}
                    {livabilityData && (
                      <div style={{ marginTop: '15px' }}>
                        <div className="metrics-grid" style={{ marginBottom: '15px' }}>
                          <div className="metric-box">
                            <div className="metric-label">Walkability Score</div>
                            <div className="metric-value highlight-cyan">{livabilityData.walkabilityScore}/100</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Cafes & Dining</div>
                            <div className="metric-value">{livabilityData.cafes.length}</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Parks & Leisure</div>
                            <div className="metric-value">{livabilityData.parks.length}</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Transit Stops</div>
                            <div className="metric-value">{livabilityData.transit.length}</div>
                          </div>
                        </div>
                        {livabilityData.cafes.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <strong>Popular Spots: </strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              {livabilityData.cafes.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.cafes.length > 5 ? '...' : ''}
                            </span>
                          </div>
                        )}
                        {livabilityData.schools.length > 0 && (
                          <div>
                            <strong>Local Schools (OSM): </strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              {livabilityData.schools.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.schools.length > 5 ? '...' : ''}
                            </span>
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
                          <div style={{ flex: '2 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Next 10-Year Projection</h4>
                            <div style={{ height: '220px' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={projData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-card)" vertical={false} />
                                  <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `$${Math.round(val/1000)}k`} />
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
                    )}
                  </div>

                  {/* PANEL B: Demographics */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Panel B: Demographics <span style={{fontSize:'0.5rem',color:'var(--warning)'}}>[keys:{Object.keys(activeSuburb||{}).filter(k=>k.indexOf('house')>=0||k.indexOf('owner')>=0||k.indexOf('age')>=0||k.indexOf('invest')>=0).join(',')}]</span></h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '2 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Key Demographics</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Owner Occupied</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{activeSuburb.ownerOccupierRate ?? '—'}%</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Investor Owned</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{activeSuburb.investorRate != null ? `${activeSuburb.investorRate}%` : '—'}</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Median Age</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{activeSuburb.medianAge || '—'}</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Household Size</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{activeSuburb.averageHouseholdSize || '—'}</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Age Group</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{activeSuburb.predominantAgeGroup || '—'}</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Occupation</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'capitalize' }}>{activeSuburb.predominantOccupation || '—'}</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Total Properties</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{(activeSuburb as any).totalProperties?.toLocaleString() || '—'}</div></div>
                          <div><span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Price/Rent Ratio</span><div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{(activeSuburb as any).priceToRentRatio?.toFixed(1) || '—'}</div></div>
                        </div>
                      </div>
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Occupancy Split</h4>
                        <div style={{ height: '180px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={[
                                { name: 'Owner', value: activeSuburb.ownerOccupierRate || 65 },
                                { name: 'Renter', value: 100 - (activeSuburb.ownerOccupierRate || 65) },
                              ]} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                                <Cell fill="var(--accent-purple)" />
                                <Cell fill="var(--accent-cyan)" />
                              </Pie>
                              <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '0.75rem', marginTop: '5px' }}>
                          <span style={{ color: 'var(--accent-purple)' }}>Owner: {activeSuburb.ownerOccupierRate || '—'}%</span>
                          <span style={{ color: 'var(--accent-cyan)' }}>Renter: {activeSuburb.ownerOccupierRate != null ? (100 - activeSuburb.ownerOccupierRate).toFixed(1) : '—'}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PANEL C: Live Listings Feed */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Panel C: Live Listings Feed</h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ color: 'var(--accent-purple)', marginBottom: '10px' }}>💰 Recently Sold</h4>
                        {activeSuburb && (activeSuburb as any).salesSummaryV3 && ((activeSuburb as any).salesSummaryV3 as any[]).length > 0 ? (
                          ((activeSuburb as any).salesSummaryV3 as any[]).slice(0, 4).map((s: any, i: number) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', marginBottom: '6px' }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{s.address || `Sample ${i+1}`}</div>
                              <div style={{ color: '#10b981', fontWeight: 'bold' }}>{s.salePrice ? `$${s.salePrice.toLocaleString()}` : 'Price N/A'}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.beds ? `${s.beds} Bed` : ''}{s.baths ? ` / ${s.baths} Bath` : ''}{s.type ? ` • ${s.type}` : ''}</div>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No recent sales data available</div>
                        )}
                      </div>
                      <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>🏷️ Market Stats</h4>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                          <div>For Sale: <strong style={{ color: 'var(--text-primary)' }}>{(activeSuburb as any).houseStockOnMarket || '—'}</strong></div>
                          <div>Sold (12m): <strong style={{ color: 'var(--text-primary)' }}>{(activeSuburb as any).houseSold12m?.toLocaleString() || '—'}</strong></div>
                          <div>Rental Stock: <strong style={{ color: 'var(--text-primary)' }}>{(activeSuburb as any).rentalStock || '—'}</strong></div>
                          <div>Supply/Demand: <strong style={{ color: 'var(--text-primary)' }}>{(activeSuburb as any).supplyDemandRatio?.toFixed(2) || '—'}</strong></div>
                        </div>
                      </div>
                      <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                          {(activeSuburb as any).houseSold12m || 'N/A'} sold in past 12 months
                        </div>
                        <a href={`https://www.onthehouse.com.au/suburb/${activeSuburb.state.toLowerCase()}/${activeSuburb.name.toLowerCase().replace(/\s+/g, '-')}-${activeSuburb.postcode}`} target="_blank" rel="noreferrer" style={{ background: 'var(--accent-purple)', color: '#fff', padding: '8px 16px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          View All on OnTheHouse ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {(!activeSuburb.schools || activeSuburb.schools.length === 0) && (!activeSuburb.pois || activeSuburb.pois.length === 0) && (
                    <div className="no-data-banner">
                      <p>Limited data available for this suburb. Core metrics are estimated from market trends. School zones, POIs, and historical data are being collected.</p>
                    </div>
                  )}

                  {activeSuburb.schools && activeSuburb.schools.length > 0 && (
                    <div className="schools-section">
                      {((() => {
                        const primaries = activeSuburb.schools!.filter(s => ['primary', 'combined'].includes(s.type.toLowerCase()));
                        const secondaries = activeSuburb.schools!.filter(s => ['secondary', 'combined'].includes(s.type.toLowerCase()));
                        return (
                          <>
                            {primaries.length > 0 && (
                              <div className="school-table-group">
                                <h3 
                                  onClick={() => setShowPrimarySchools(!showPrimarySchools)}
                                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}
                                >
                                  <span>🏫 Primary Schools ({primaries.length})</span>
                                  <span style={{ fontSize: '0.8rem' }}>{showPrimarySchools ? '▲ Hide' : '▼ Show'}</span>
                                </h3>
                                {showPrimarySchools && (
                                  <div className="table-responsive" style={{ marginTop: '10px' }}>
                                    <table className="schools-table">
                                      <thead>
                                        <tr>
                                          <th>School Name</th>
                                          <th>Type</th>
                                          <th>State Rank</th>
                                          <th>Academic Score</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {primaries.map((school, idx) => (
                                          <tr key={idx}>
                                            <td className="school-name-cell">{school.name}</td>
                                            <td><span className="type-badge type-primary">Primary</span></td>
                                            <td>#{school.stateRank}</td>
                                            <td>
                                              <div className="score-bar-wrapper">
                                                <div className="score-bar-bg"><div className="score-bar-fill" style={{ width: `${school.score}%`, background: school.score >= 90 ? 'var(--success)' : school.score >= 80 ? 'var(--accent-cyan)' : 'var(--warning)' }}></div></div>
                                                <span>{school.score}/100 <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>(Est.)</span></span>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                            {secondaries.length > 0 && (
                              <div className="school-table-group" style={{ marginTop: '15px' }}>
                                <h3 
                                  onClick={() => setShowSecondarySchools(!showSecondarySchools)}
                                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}
                                >
                                  <span>🎓 Secondary Schools ({secondaries.length})</span>
                                  <span style={{ fontSize: '0.8rem' }}>{showSecondarySchools ? '▲ Hide' : '▼ Show'}</span>
                                </h3>
                                {showSecondarySchools && (
                                  <div className="table-responsive" style={{ marginTop: '10px' }}>
                                    <table className="schools-table">
                                      <thead>
                                        <tr>
                                          <th>School Name</th>
                                          <th>Type</th>
                                          <th>State Rank</th>
                                          <th>Academic Score</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {secondaries.map((school, idx) => (
                                          <tr key={idx}>
                                            <td className="school-name-cell">{school.name}</td>
                                            <td>
                                              <span className={`type-badge type-${school.type.toLowerCase()}`}>
                                                {school.type}
                                              </span>
                                            </td>
                                            <td>#{school.stateRank}</td>
                                            <td>
                                              <div className="score-bar-wrapper">
                                                <div className="score-bar-bg"><div className="score-bar-fill" style={{ width: `${school.score}%`, background: school.score >= 90 ? 'var(--success)' : school.score >= 80 ? 'var(--accent-cyan)' : 'var(--warning)' }}></div></div>
                                                <span>{school.score}/100 <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>(Est.)</span></span>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })())}
                    </div>
                  )}
                </div>

                <SuburbMap
                  center={activeSuburb.coordinates || [-25.2744, 133.7751]}
                  pois={activeSuburb.pois || []}
                  schools={activeSuburb.schools || []}
                  suburbName={activeSuburb.name}
                  stateName={activeSuburb.state}
                  postcode={activeSuburb.postcode}
                />
              </div>
            ) : (
              <div className="glass-card empty-state">
                <p>Please select a state and suburb to view the profile.</p>
              </div>
            )}
          </main>
        </div>
      )}

      {activeTab === 'search' && <HouseSearch suburbsData={suburbsData} />}
      {activeTab === 'affordability' && <AffordabilityCalculator suburbsData={suburbsData} />}
      {activeTab === 'gearing' && <CashflowGearing suburbsData={suburbsData} />}
    </div>
  )
}

export default App
