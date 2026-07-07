import { useState, useMemo, useEffect } from 'react'
import { mockSuburbsData } from './data/suburbs'
import type { SuburbData } from './data/suburbs'
import SuburbMap from './components/SuburbMap'
import AffordabilityCalculator from './components/AffordabilityCalculator'
import HouseSearch from './components/HouseSearch'
import CashflowGearing from './components/CashflowGearing'
import InstitutionalV3Panel from './components/InstitutionalV3Panel'
import MyPurchasePlan from './components/MyPurchasePlan'
import { fetchLivabilityData, type LivabilityData } from './services/osmApi'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import './index.css'

type TabName = 'profile' | 'search' | 'affordability' | 'gearing' | 'purchase-plan' | 'institutional';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [suburbsData, setSuburbsData] = useState<SuburbData[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [livabilityData, setLivabilityData] = useState<LivabilityData | null>(null)
  const [loadingLivability, setLoadingLivability] = useState(false)
  const [showPrimarySchools, setShowPrimarySchools] = useState(false)
  const [showSecondarySchools, setShowSecondarySchools] = useState(false)

  const [activeTab, setActiveTab] = useState<TabName>('profile')
  const [activeState, setActiveState] = useState<string>('VIC')
  const [activeSuburb, setActiveSuburb] = useState<SuburbData | null>(null)
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [isClustering, setIsClustering] = useState(false)
  const [clusteringResults, setClusteringResults] = useState<any[] | null>(null)

  const loadColdSuburb = async (id: string) => {
    try {
      const res = await fetch(`/api/suburbs/${id}`)
      if (res.ok) {
        const data = await res.json()
        setActiveSuburb(data)
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
            setSuburbsData(apiData)
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
    setClusteringResults(null)
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim()
    const cleanPassword = password.trim()
    
    if (cleanPassword.length < 8) {
      setLoginError('Password must be at least 8 characters')
      return
    }
    if (cleanPassword !== confirmPassword) {
      setLoginError('Passwords do not match')
      return
    }
    
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      })
      if (res.ok) {
        const loginRes = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
        })
        if (loginRes.ok) {
          setIsAuthenticated(true)
          setLoginError('')
        }
      } else {
        const msg = await res.json().then(d => d.detail || 'Registration failed').catch(() => 'Registration failed')
        setLoginError(msg)
      }
    } catch {
      setLoginError('Network error — check if backend is running')
    }
  }

  if (!isAuthenticated) {
    const passwordStrength = password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Medium' : password.length > 0 ? 'Weak' : ''
    const strengthColor = passwordStrength === 'Strong' ? 'var(--success)' : passwordStrength === 'Medium' ? 'var(--warning)' : 'var(--danger)'
    
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass-card" style={{ padding: '40px', maxWidth: '420px', width: '100%' }}>
          <h1 className="title-glow" style={{ textAlign: 'center', marginBottom: '10px' }}>Real Estate Engine</h1>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: '20px' }}>
            {isRegistering ? 'Create Account' : 'Login to Dashboard'}
          </p>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="control-group">
              <label className="control-label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="premium-select" style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required autoComplete="email" />
            </div>
            <div className="control-group">
              <label className="control-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="premium-select" style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required autoComplete={isRegistering ? 'new-password' : 'current-password'} />
              {isRegistering && password.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: Math.min(100, password.length * 8) + '%', background: strengthColor, borderRadius: '2px', transition: 'width 0.2s' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: strengthColor, fontWeight: 600 }}>{passwordStrength}</span>
                </div>
              )}
            </div>
            {isRegistering && (
              <div className="control-group">
                <label className="control-label">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="premium-select" style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} required autoComplete="new-password" />
              </div>
            )}
            {loginError && (
              <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
                {loginError}
              </div>
            )}
            <button type="submit" className="tab-btn tab-active" style={{ width: '100%', marginTop: '4px' }}>
              {isRegistering ? 'Create Account' : 'Login'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setConfirmPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
                {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
              </button>
            </div>
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
        <button
          className={`tab-btn ${activeTab === 'purchase-plan' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('purchase-plan')}
        >
          My Purchase Plan
        </button>
        <button
          className={`tab-btn ${activeTab === 'institutional' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('institutional')}
        >
          Institutional
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
                    if (e.target.value) {
                      loadColdSuburb(e.target.value)
                    }
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
                  <span className="preview-score-value">{Math.round(activeSuburb.growthScore ?? 0)}</span>
                  <span className="preview-score-label">Score</span>
                </div>
                <p className="preview-text">
                  {(activeSuburb as any).cbdDistance
                    ? `${(activeSuburb as any).cbdDistance} min to ${activeSuburb.metroCBD || 'CBD'}`
                    : activeSuburb.metroCBD || 'Regional suburb'}
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
                        {(()=>{
                          const dq = (activeSuburb as any).dqScore;
                          if(dq==null)return null;
                          const c=dq>=90?'#10b981':dq>=70?'#f59e0b':'#ef4444';
                          const bg=dq>=90?'rgba(16,185,129,0.15)':dq>=70?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)';
                          return <span title="Data Quality Score" style={{marginLeft:'12px',fontSize:'0.65rem',fontWeight:600,padding:'2px 8px',borderRadius:'4px',background:bg,color:c,border:`1px solid ${c}40`}}>DQ {Math.round(dq)}</span>;
                        })()}
                        {(activeSuburb as any).lastV3Update && (
                          <span style={{ marginLeft: '8px', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block', marginRight: '4px' }} />
                            V3 · {new Date((activeSuburb as any).lastV3Update).toLocaleDateString('en-AU', {day:'numeric',month:'short',year:'numeric'})}
                          </span>
                        )}
                      </h2>
                      <p className="subtitle">
                        {(activeSuburb as any).cbdDistance
                          ? `${(activeSuburb as any).cbdDistance} min to ${activeSuburb.metroCBD || 'CBD'}`
                          : activeSuburb.metroCBD || 'Regional'}
                      </p>
                      {(activeSuburb as any).lastUpdated && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Data Last Updated: {new Date((activeSuburb as any).lastUpdated).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="main-score">
                      <div className="main-score-value" title="Formula: (Pop% * 10) + (Infra$B * 3) + (School * 3) + (Transit * 2) + (Yield * 2) - Distance Penalty">
                        {activeSuburb.growthScore}
                      </div>
                      <div className="main-score-label">Growth Probability</div>
                      <button
                        onClick={() => setActiveTab('gearing')}
                        style={{ marginTop: '10px', padding: '6px 12px', background: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', width: '100%' }}
                      >
                        💰 View Cashflow →
                      </button>
                    </div>
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-label">Median Price</div>
                      <div className="metric-value">
                        {(activeSuburb as any).houseMedianPrice ? `$${(activeSuburb as any).houseMedianPrice.toLocaleString()}` : (activeSuburb as any).medianPrice ? `$${(activeSuburb as any).medianPrice.toLocaleString()}` : activeSuburb.metrics?.medianPrice ? `$${activeSuburb.metrics.medianPrice.toLocaleString()}` : 'No data'}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Population Growth (CAGR)</div>
                      <div className="metric-value highlight-cyan">
                        {activeSuburb.populationCagr ? `${Number(activeSuburb.populationCagr).toFixed(1)}%` : (activeSuburb.metrics?.populationGrowth && activeSuburb.metrics.populationGrowth !== 'N/A'
                          ? activeSuburb.metrics.populationGrowth
                          : 'No data')}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Infrastructure Inv.</div>
                      <div className="metric-value highlight-purple">
                        {(activeSuburb as any).infrastructureInvestment || (activeSuburb as any).parksCount ? `${(activeSuburb as any).parksCount || 0} parks (${(activeSuburb as any).parksCoveragePct || 0}% coverage)` : 'No data'}
                      </div>
                    </div>
                    <div className="metric-box">
                      <div className="metric-label">Avg Rental Yield</div>
                      <div className="metric-value">
                        {(activeSuburb as any).rentalYield ? `${(activeSuburb as any).rentalYield}%` : (activeSuburb as any).houseGrossRentalYield ? `${(activeSuburb as any).houseGrossRentalYield}%` : activeSuburb.metrics?.rentalYield ? `${activeSuburb.metrics.rentalYield}%` : 'No data'}
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
                                setActiveSuburb((prev: any) => ({
                                  ...prev,
                                  metrics: {
                                    ...prev.metrics,
                                    aiNewsSentiment: data.verdict || 'Analysis Complete',
                                    aiNewsSummary: data.playbook || data.reality_check || 'AI analysis completed. Check Panel D for detailed results.'
                                  }
                                }));
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
                      📊 Realta Buyer Agent Scorecard
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {(() => {
                        const s = activeSuburb
                        const demo = ((s as any).demographicsDetailV3) || {}
                        const hist = (s as any).history || []
                        const yr3growth = hist.length >= 3 
                          ? ((Number(hist[hist.length-1]?.value || 0) / Number(hist[hist.length-4]?.value || 1) - 1) * 100).toFixed(1) + '%'
                          : '—'
                        const indicators = [
                          { label: 'Supply', items: [
                            { label:'Stock on Market', value: (s as any).houseStockOnMarket, icon:'🏠' },
                            { label:'Supply/Demand Ratio', value: (s as any).supplyDemandRatio?.toFixed(2) || '—', icon:'📊' },
                            { label:'Building Approvals (est)', value: (s as any).buildingApprovals12m ? `${(s as any).buildingApprovals12m} (est.)` : '—', icon:'🔨' },
                          ]},
                          { label: 'Demand', items: [
                            { label:'Rental Yield', value: (s as any).houseGrossRentalYield + '%', icon:'💰' },
                            { label:'Days on Market', value: (s as any).houseDaysOnMarket || '—', icon:'⏱️' },
                            { label:'Vacancy Rate', value: (s as any).vacancyRate?.toFixed(1) + '%' || '—', icon:'🏚️' },
                            { label:'Auction Clearance', value: (s as any).houseAuctionClearanceRate || '—', icon:'🔨' },
                          ]},
                          { label: 'Affordability', items: [
                            { label:'Mortgage Band', value: (s as any).typicalMortgageBand || '—', icon:'💳' },
                            { label:'3yr Price Growth', value: yr3growth, icon:'📈' },
                            { label:'CBD Mins', value: (s as any).cbdDistance + ' min' || '—', icon:'🚗' },
                            { label:'Prof. Occupation', value: (s as any).ownerOccupierRate + '%' || '—', icon:'👔' },
                          ]},
                          { label: 'Income & Jobs', items: [
                            { label:'Predominant Income', value: demo.predominant_income_band || '—', icon:'💵' },
                            { label:'Population CAGR', value: (s as any).populationCagr?.toFixed(1) + '%' || '—', icon:'👥' },
                            { label:'Median Age', value: s.medianAge || '—', icon:'🎂' },
                            { label:'Unemployment (est)', value: (s as any).unemploymentRate ? `${(s as any).unemploymentRate}% (est.)` : '—', icon:'📉' },
                          ]},
                        ]
                        return indicators.flatMap((section) => [
                          <div key={section.label} style={{ 
                            background: 'var(--bg-card)', border: '1px solid var(--border-glass)', 
                            padding: '12px', borderRadius: '8px', gridColumn: 'span 1'
                          }}>
                            <div style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px' }}>
                              {section.label}
                            </div>
                            {section.items.map((item) => (
                              <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{item.icon} {item.label}</span>
                                <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        ])
                      })()}
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
                    </div>
                    )}
                  </div>

                  {/* PANEL B: Demographics */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Panel B: Demographics</h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '2 1 500px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Age Distribution</h4>
                        <div style={{ height: '200px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={(() => {
                              const ageData = ((activeSuburb as any).demographicsDetailV3?.age_distribution) || {}
                              return Object.entries(ageData)
                                .filter(([k,_]) => k !== '100+')
                                .map(([k,v]) => ({ name: k, value: Number(v) }))
                            })()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                              <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `${val}%`} />
                              <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Population']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                              <Bar dataKey="value" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Owner vs Renter Ratio</h4>
                        <div style={{ height: '180px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={[
                                { name: 'Owner', value: activeSuburb.ownerOccupierRate || 65.5 },
                                { name: 'Renter', value: 100 - (activeSuburb.ownerOccupierRate || 65.5) },
                              ]} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" stroke="none">
                                <Cell fill="var(--accent-purple)" />
                                <Cell fill="var(--accent-cyan)" />
                              </Pie>
                              <RechartsTooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '0.75rem', marginTop: '5px' }}>
                          <span style={{ color: 'var(--accent-purple)' }}>Owner: {(activeSuburb.ownerOccupierRate || 65.5).toFixed(2)}%</span>
                          <span style={{ color: 'var(--accent-cyan)' }}>Renter: {(100 - (activeSuburb.ownerOccupierRate || 65.5)).toFixed(2)}%</span>
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
                          <div>Rental Stock: <strong style={{ color: 'var(--text-primary)' }}>{activeSuburb.metrics?.rentalStock || (activeSuburb as any).rentalStock || '—'}</strong></div>
                          <div>Supply/Demand: <strong style={{ color: 'var(--text-primary)' }}>{(activeSuburb as any).supplyDemandRatio?.toFixed(2) || '—'}</strong></div>
                        </div>
                      </div>
                      <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                          {(activeSuburb as any).houseSold12m ? `${(activeSuburb as any).houseSold12m} sales in past 12 months` : 'Market data loading...'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PANEL D: AI Investment Committee */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      <h3>Panel D: AI Investment Committee</h3>
                      <button
                        disabled={isAnalyzingAI}
                        onClick={async () => {
                          try {
                            setIsAnalyzingAI(true);
                            const res = await fetch('/api/analyze-suburb', {
                              method: 'POST',
                              headers: {'Content-Type': 'application/json'},
                              body: JSON.stringify({ suburb: activeSuburb.name, state: activeSuburb.state, id: activeSuburb.id })
                            });
                            const data = await res.json();
                            if(res.ok && data.verdict) {
                              setActiveSuburb((prev: any) => ({
                                ...prev,
                                aiVerdict: data.verdict,
                                aiConsensus: data.playbook,
                                aiRiskLevel: data.reality_check,
                                aiBullView: data.bull,
                                aiBearView: data.bear,
                                aiUrbanView: data.urban
                              }));
                            }
                          } catch(e){ console.error(e) }
                          finally { setIsAnalyzingAI(false) }
                        }}
                        style={{
                          padding: '8px 16px', background: 'var(--accent-purple)', color: '#fff',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
                        }}
                      >
                        {isAnalyzingAI ? 'Analyzing...' : 'Run AI Committee'}
                      </button>
                    </div>
                    {(activeSuburb as any).aiVerdict ? (
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 100%', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Consensus Verdict</div>
                          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent-cyan)' }}>{(activeSuburb as any).aiVerdict}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Risk: <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{(activeSuburb as any).aiRiskLevel || '—'}</span></div>
                        </div>
                        <div style={{ flex: '1 1 250px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '15px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '4px' }}>🐂 Bull — Anna</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxHeight: '120px', overflowY: 'auto' }}>{(activeSuburb as any).aiBullView || 'Awaiting analysis'}</div>
                        </div>
                        <div style={{ flex: '1 1 250px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '15px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '4px' }}>🐻 Bear — Alex</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxHeight: '120px', overflowY: 'auto' }}>{(activeSuburb as any).aiBearView || 'Awaiting analysis'}</div>
                        </div>
                        <div style={{ flex: '1 1 250px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '15px', borderRadius: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#8b5cf6', marginBottom: '4px' }}>🏙️ Urban Planner</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxHeight: '120px', overflowY: 'auto' }}>{(activeSuburb as any).aiUrbanView || 'Awaiting analysis'}</div>
                        </div>
                        {(activeSuburb as any).aiConsensus && (
                          <div style={{ flex: '1 1 100%', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', padding: '15px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '4px' }}>📋 Investor CEO Playbook</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>{(activeSuburb as any).aiConsensus}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        Click "Run AI Committee" to get a multi-agent analysis of {activeSuburb.name}.
                      </div>
                    )}
                  </div>

                  {/* K-Means Clustering: Similar Suburbs */}
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>🔍 Find Similar Suburbs (K-Means Clustering)</h4>
                      <button
                        disabled={isClustering}
                        onClick={async () => {
                          try {
                            setIsClustering(true);
                            setClusteringResults(null);
                            const res = await fetch('/api/similar-suburbs', {
                              method: 'POST',
                              headers: {'Content-Type': 'application/json'},
                              body: JSON.stringify({ suburb: activeSuburb.name, state: activeSuburb.state, id: activeSuburb.id })
                            });
                            const data = await res.json();
                            if (res.ok && data.similar) setClusteringResults(data.similar);
                          } catch(e){ console.error(e) }
                          finally { setIsClustering(false) }
                        }}
                        style={{
                          padding: '6px 14px', background: 'var(--accent-cyan)', color: '#000',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem'
                        }}
                      >
                        {isClustering ? 'Clustering...' : 'Find Similar'}
                      </button>
                    </div>
                    {clusteringResults && clusteringResults.length > 0 ? (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {clusteringResults.map((s: any, i: number) => (
                          <div key={i} style={{ flex: '1 1 220px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.suburb}, {s.state}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.postcode}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '0.8rem' }}>
                              <span>🏷️ ${Math.round(s.price).toLocaleString()}</span>
                              <span style={{color:'var(--accent-cyan)'}}>{s.similarity}% match</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              ICSEA {s.icsea} • Yield {s.yield}%
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : clusteringResults === null ? null : (
                      <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        No similar cheaper suburbs found in this cluster.
                      </div>
                    )}
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
                  pois={[
                    ...(activeSuburb.pois || []),
                    ...(livabilityData ? [
                      ...(livabilityData.cafes || []).map((c:any) => ({...c, type: 'cafe', coordinates: c.coordinates || c.latlon})),
                      ...(livabilityData.parks || []).map((p:any) => ({...p, type: 'park', coordinates: p.coordinates || p.latlon})),
                      ...(livabilityData.transit || []).map((t:any) => ({...t, type: 'transit', coordinates: t.coordinates || t.latlon})),
                    ] : [])
                  ]}
                  schools={[
                    ...(activeSuburb.schools || []),
                    ...(livabilityData?.schools || []).map((s:any) => ({...s, type: s.type || 'Primary'}))
                  ]}
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
      {activeTab === 'gearing' && <CashflowGearing 
        suburbsData={suburbsData} 
        defaultSuburbId={activeSuburb?.id}
        defaultPrice={(activeSuburb as any)?.houseMedianPrice || (activeSuburb as any)?.medianPrice || undefined}
        defaultRent={(activeSuburb as any)?.houseMedianRent || (activeSuburb as any)?.weeklyRent || undefined}
      />}
      {activeTab === 'purchase-plan' && <MyPurchasePlan suburbsData={suburbsData} />}
      {activeTab === 'institutional' && <InstitutionalV3Panel />}
    </div>
  )
}

export default App
