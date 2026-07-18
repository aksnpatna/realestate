import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import type { SuburbData } from './data/suburbs'
import SuburbMap from './components/SuburbMap'
import OnboardingTour from './components/OnboardingTour'
import TermsOfUseModal from './components/TermsOfUseModal'
import UserFavoritesTab from './components/UserFavoritesTab'
import AIInsightPanel from './components/AIInsightPanel'
import DecisionBrief from './components/DecisionBrief'
import type { BuyerFitResult } from './data/buyerFitTypes'
import { ScoreInlineHint, ScoreLegendPanel, type GrowthFactorLabeled } from './components/ScoreLegend'
import PersonaSwitcher from './components/PersonaSwitcher'
import ProfileSectionNav, { SECTION_ATTR } from './components/ProfileSectionNav'
import TechnicalProvenanceSection from './components/TechnicalProvenanceSection'
import MarketIndicatorsSection from './components/MarketIndicatorsSection'
import PocketRiskMap from './components/PocketRiskMap'
import type { PersonaId, ProfileSectionId } from './data/personas'
import { loadStoredPersona, getPersona } from './data/personas'
import { fetchLivabilityData, type LivabilityData } from './services/osmApi'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import './index.css'
import LandingPage from './components/LandingPage'
import PromoBanner from './components/PromoBanner'
import ShareReport from './components/ShareReport'

const Calculators = lazy(() => import('./components/Calculators'))
const AffordabilityCalculator = lazy(() => import('./components/AffordabilityCalculator'))
const BuyFinder = lazy(() => import('./components/BuyFinder'))
const CashflowGearing = lazy(() => import('./components/CashflowGearing'))
const InstitutionalV3Panel = lazy(() => import('./components/InstitutionalV3Panel'))
const MyPurchasePlan = lazy(() => import('./components/MyPurchasePlan'))
const QuickRoiCalculator = lazy(() => import('./components/QuickRoiCalculator'))

type TabName = 'buy-finder' | 'profile' | 'affordability' | 'gearing' | 'purchase-plan' | 'institutional' | 'calculators' | 'favorites';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [userType, setUserType] = useState('First Home Buyer')
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register'>('landing')
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [favorites, setFavorites] = useState<string[]>([])
  
  const [suburbsData, setSuburbsData] = useState<SuburbData[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [livabilityData, setLivabilityData] = useState<LivabilityData | null>(null)
  const [loadingLivability, setLoadingLivability] = useState(false)
  const [showPrimarySchools, setShowPrimarySchools] = useState(false)
  const [showSecondarySchools, setShowSecondarySchools] = useState(false)

  const [activeTab, setActiveTab] = useState<TabName>('buy-finder')
  const [activeState, setActiveState] = useState<string>('VIC')
  const [persona, setPersona] = useState<PersonaId>(loadStoredPersona)
  const [activeProfileSection, setActiveProfileSection] = useState<ProfileSectionId>('overview')
  const [activeSuburb, setActiveSuburb] = useState<SuburbData | null>(null)
  const [selectedBuyerFitResult, setSelectedBuyerFitResult] = useState<BuyerFitResult | null>(() => {
    try { const s = sessionStorage.getItem('bf_result'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [selectedRequestMeta, setSelectedRequestMeta] = useState<{ request_id: string; model_version: string } | null>(() => {
    try { const s = sessionStorage.getItem('bf_meta'); return s ? JSON.parse(s) : null } catch { return null }
  })
  // Track if the user manually selected a suburb to prevent auto‑reset
  const manualSelectionRef = useRef(false)

  const [isClustering, setIsClustering] = useState(false)
  const [showAmenitiesOnMap, setShowAmenitiesOnMap] = useState(false)
  const [clusteringResults, setClusteringResults] = useState<any[] | null>(null)
  const [macroEtf, setMacroEtf] = useState<any>(null)

  const [financialProfile, setFinancialProfile] = useState({
    deposit: 170000,
    lvrPct: 90,
    annualIncome: 210000,
    monthlyDebt: 0,
    interestRate: 6.2,
    bufferRate: 3.0,
    loanTermYears: 30,
    purchaseCostAllowance: 5.0,
  });

  /**
   * Fetch a suburb's enriched data from the V3 cold-load API.
   * 
   * Preserves the frontend ID format (name-state-postcode) so the dropdown
   * selector continues to match after the API returns a different format.
   * After loading, restores any cached AI committee result from localStorage.
   *
   * @param id - Frontend suburb ID (e.g. "parramatta-nsw-2150")
   */
  const loadColdSuburb = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/suburbs/${id}`)
      if (res.ok) {
        const data = await res.json()
        data.id = id  // Preserve frontend ID format for dropdown match
        setActiveSuburb(data)
        setActiveProfileSection('overview')
        // Re-fetch livability with real coordinates if they changed from null
        if (data.coordinates?.[0] && data.coordinates?.[1]) {
          setLoadingLivability(true)
          setLivabilityData(null)
          fetchLivabilityData(data.coordinates[0], data.coordinates[1])
            .then(d => setLivabilityData(d))
            .catch(() => {})
            .finally(() => setLoadingLivability(false))
        }
        try {
          const cached = localStorage.getItem('ai_' + id)
          if (cached) {
            const aiResult = JSON.parse(cached)
            setActiveSuburb((prev: any) => ({ ...prev, ...aiResult }))
          }
        } catch {}
        // If no session result exists for this suburb, try loading a saved snapshot
        try {
          const sessResult = sessionStorage.getItem('bf_result')
          if (!sessResult && isAuthenticated) {
            fetch(`/api/buy-finder/snapshots?suburb_id=${id}`)
              .then(r => r.json())
              .then(snapshots => {
                if (snapshots && snapshots.length > 0) {
                  fetch(`/api/buy-finder/snapshots/${snapshots[0].id}`)
                    .then(r => r.json())
                    .then(s => {
                      if (s?.result) setSelectedBuyerFitResult(s.result)
                      if (s?.request_meta) setSelectedRequestMeta(s.request_meta)
                    })
                    .catch(() => {})
                }
              })
              .catch(() => {})
          }
        } catch {}
      }
    } catch (e) {
      console.error('loadColdSuburb error', id, e)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/suburbs')
        .then(res => res.json())
        .then(apiData => {
          if (apiData && apiData.length > 0) {
            setSuburbsData(apiData)
            setLoadingData(false)
          } else {
            setSuburbsData([])
            setLoadingData(false)
          }
        })
        .catch((err: unknown) => {
          console.error("API error — data unavailable:", err)
          setSuburbsData([])
          setLoadingData(false)
        })
      
      fetch('/api/etf/vap')
        .then(res => res.json())
        .then(data => setMacroEtf(data))
        .catch(err => console.error("ETF fetch error:", err))

      fetch('/api/favorites')
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setFavorites(data.favorites)
          }
        })
        .catch(err => console.error("Favorites fetch error:", err))
    }
  }, [isAuthenticated])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      fetch(`/api/verify?token=${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setVerificationMessage('Email verified successfully! You can now login.');
          } else {
            setLoginError(data.detail || 'Verification failed');
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(() => setLoginError('Failed to verify token'));
    }
  }, []);

  const trackActivity = useCallback((action: string, target?: string) => {
    if (!isAuthenticated) return;
    fetch('/api/track-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: action, target_id: target })
    }).catch(console.error);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeTab) {
      trackActivity('CLICK_TAB', activeTab);
    }
  }, [isAuthenticated, activeTab]);

  const toggleFavorite = useCallback(async (suburbId: string) => {
    // Optimistic update
    setFavorites(prev => 
      prev.includes(suburbId) ? prev.filter(id => id !== suburbId) : [...prev, suburbId]
    );
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb_id: suburbId })
      });
      if (!res.ok) {
        // Revert on failure
        setFavorites(prev => 
          prev.includes(suburbId) ? prev.filter(id => id !== suburbId) : [...prev, suburbId]
        );
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
      // Revert on failure
      setFavorites(prev => 
        prev.includes(suburbId) ? prev.filter(id => id !== suburbId) : [...prev, suburbId]
      );
    }
  }, []);

  const filteredSuburbsData = useMemo(() => {
    return suburbsData;
  }, [suburbsData]);

  const states = useMemo(() => Array.from(new Set(filteredSuburbsData.map(s => s.state))).sort(), [filteredSuburbsData])
  const stateSuburbs = useMemo(() =>
    filteredSuburbsData.filter(s => s.state === activeState).sort((a, b) => a.name.localeCompare(b.name)),
    [activeState, filteredSuburbsData]
  )

  useEffect(() => {
    if (states.length > 0 && !states.includes(activeState)) {
      setActiveState(states[0]);
    }
  }, [states, activeState]);

  useEffect(() => {
    if (stateSuburbs.length > 0) {
      // Only auto‑load the first suburb when the user hasn't manually selected one
      if (!manualSelectionRef.current && (!activeSuburb || activeSuburb.state !== activeState)) {
        loadColdSuburb(stateSuburbs[0].id)
        trackActivity('VIEW_SUBURB', stateSuburbs[0].id)
      } else {
        // Reset flag after respecting manual selection
        manualSelectionRef.current = false
      }
    } else {
      setActiveSuburb(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState, stateSuburbs])

  const prevSuburbId = useRef<string | null>(null)

  // Clear data when ID changes
  useEffect(() => {
    const currentId = activeSuburb?.id || null;
    if (currentId !== prevSuburbId.current) {
      prevSuburbId.current = currentId;
      setLivabilityData(null);
      setClusteringResults(null);
      setShowAmenitiesOnMap(false);
    }
  }, [activeSuburb?.id]);

  // Fetch livability when coordinates are finally loaded
  useEffect(() => {
    if (activeSuburb) {
      const lat = activeSuburb.coordinates?.[0];
      const lng = activeSuburb.coordinates?.[1];
      if (!lat || !lng) return; // Wait for cold-load

      setLoadingLivability(true);
      fetchLivabilityData(lat, lng)
        .then(data => {
          setLivabilityData(data);
        })
        .catch((err) => {
          console.error("Livability Error:", err.message);
        })
        .finally(() => setLoadingLivability(false));
    }
  }, [activeSuburb?.coordinates]);

  const mappedPois = useMemo(() => [
    ...(activeSuburb?.pois || []),
    ...(livabilityData && showAmenitiesOnMap ? [
      ...(livabilityData.cafes || []).map((c:any) => ({...c, type: 'cafe', coordinates: c.coordinates || c.latlon})),
      ...(livabilityData.parks || []).map((p:any) => ({...p, type: 'park', coordinates: p.coordinates || p.latlon})),
      ...(livabilityData.transit || []).map((t:any) => ({...t, type: 'transit', coordinates: t.coordinates || t.latlon})),
      ...(livabilityData.train_stations || []).map((t:any) => ({...t, type: 'train_station', coordinates: t.coordinates || t.latlon})),
    ] : [])
  ], [activeSuburb?.pois, livabilityData, showAmenitiesOnMap])

  const mappedSchools = useMemo(() => [
    ...(activeSuburb?.schools || []),
    ...(livabilityData?.schools || []).map((s:any) => ({...s, type: s.type || 'Primary'}))
  ], [activeSuburb?.schools, livabilityData?.schools])

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
        const msg = await res.json().then(d => d.detail).catch(async () => await res.text());
        if (res.status === 403 && msg.includes('verified')) {
           setVerificationMessage(msg);
           setLoginError('');
        } else {
           setLoginError(msg || `Invalid credentials (Status: ${res.status})`)
        }
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
    if (!privacyConsent) {
      setLoginError('You must agree to the Privacy Policy and Terms of Use')
      return
    }
    
    // Capture UTM params from URL
    const urlParams = new URLSearchParams(window.location.search)
    
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: cleanEmail, 
          password: cleanPassword,
          first_name: firstName,
          last_name: lastName,
          user_type: userType,
          marketing_consent: marketingConsent,
          utm_source: urlParams.get('utm_source'),
          utm_medium: urlParams.get('utm_medium'),
          utm_campaign: urlParams.get('utm_campaign'),
          referrer_url: document.referrer
        })
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
          localStorage.setItem('terms_accepted', 'true')
        } else if (loginRes.status === 403) {
          setIsRegistering(false)
          setVerificationMessage('Registration successful! Please check your email to verify your account.')
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
    if (authMode === 'landing') {
      return (
        <LandingPage 
          onLoginClick={() => { setAuthMode('login'); setIsRegistering(false); }} 
          onRegisterClick={() => { setAuthMode('register'); setIsRegistering(true); }} 
        />
      )
    }

    const passwordStrength = password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Medium' : password.length > 0 ? 'Weak' : ''
    const strengthColor = passwordStrength === 'Strong' ? 'var(--success)' : passwordStrength === 'Medium' ? 'var(--warning)' : 'var(--danger)'
    
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-dark)' }}>
        <div className="glass-card" style={{ padding: '40px', maxWidth: '460px', width: '100%', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 className="title-glow" style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>PropertyIQ</h1>
            <button onClick={() => setAuthMode('landing')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Back</button>
          </div>
          <p className="subtitle" style={{ marginBottom: '24px' }}>
            {isRegistering ? 'Create your professional account' : 'Welcome back'}
          </p>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegistering && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="control-group" style={{ flex: 1 }}>
                  <label className="control-label">First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="premium-input" required />
                </div>
                <div className="control-group" style={{ flex: 1 }}>
                  <label className="control-label">Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="premium-input" required />
                </div>
              </div>
            )}
            
            <div className="control-group">
              <label className="control-label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="premium-input" required autoComplete="email" />
            </div>
            
            <div className="control-group">
              <label className="control-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="premium-input" required autoComplete={isRegistering ? 'new-password' : 'current-password'} />
              {isRegistering && password.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: Math.min(100, password.length * 8) + '%', background: strengthColor, borderRadius: '2px', transition: 'width 0.2s' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: strengthColor, fontWeight: 600 }}>{passwordStrength}</span>
                </div>
              )}
            </div>

            {isRegistering && (
              <>
                <div className="control-group">
                  <label className="control-label">Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="premium-input" required autoComplete="new-password" />
                </div>
                <div className="control-group">
                  <label className="control-label">I am a...</label>
                  <select value={userType} onChange={e => setUserType(e.target.value)} className="premium-input" style={{ appearance: 'auto' }}>
                    <option value="First Home Buyer">First Home Buyer</option>
                    <option value="Investor">Investor</option>
                    <option value="Buyer's Agent">Buyer's Agent</option>
                    <option value="Mortgage Broker">Mortgage Broker</option>
                  </select>
                </div>
                
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={privacyConsent} onChange={e => setPrivacyConsent(e.target.checked)} style={{ marginTop: '3px' }} />
                    <span>I agree to the <a href="#" style={{ color: 'var(--accent-cyan)' }}>Privacy Policy</a> and <a href="#" style={{ color: 'var(--accent-cyan)' }}>Terms of Use</a>. *</span>
                  </label>
                  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} style={{ marginTop: '3px' }} />
                    <span>I'd like to receive product updates and market insights.</span>
                  </label>
                </div>
              </>
            )}
            
            {verificationMessage && (
              <div style={{ padding: '10px', background: '#D1FAE5', border: '1px solid #10B981', borderRadius: '6px', color: '#047857', fontSize: '13px', textAlign: 'center' }}>
                {verificationMessage}
              </div>
            )}
            {loginError && (
              <div style={{ padding: '10px', background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', color: '#B91C1C', fontSize: '13px', textAlign: 'center' }}>
                {loginError}
              </div>
            )}
            
            <button type="submit" style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'var(--accent-cyan)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
              {isRegistering ? 'Create Account' : 'Log In'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setConfirmPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
                {isRegistering ? 'Already have an account? Log in' : "Don't have an account? Start Free Trial"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container" style={{ background: 'var(--bg-dark)', minHeight: '100vh', padding: 0 }}>
      <PromoBanner />
      <TermsOfUseModal />
      <OnboardingTour />
      
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '20px 40px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-glass)',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--accent-cyan)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
            IQ
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>PropertyIQ</h1>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <PersonaSwitcher activePersona={persona} onChange={setPersona} />
          <button 
            onClick={() => { setIsAuthenticated(false); setAuthMode('landing'); }} 
            style={{ background: 'none', border: '1px solid var(--border-glass)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-glass)' }}
          >
            Log Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}>
        <nav className="tab-nav" style={{ gap: '20px', marginBottom: '30px', borderBottom: '2px solid var(--border-glass)' }}>
          <button
            className={`tab-btn ${activeTab === 'buy-finder' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('buy-finder')}
            style={{ fontSize: '1.1rem' }}
          >
            Dashboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('profile')}
            style={{ fontSize: '1.1rem' }}
          >
            Suburb Profile
          </button>
          
          <div style={{ display: 'flex', gap: '20px', marginLeft: 'auto', alignItems: 'center' }}>
            <select 
              value={['gearing', 'affordability', 'purchase-plan', 'calculators'].includes(activeTab) ? activeTab : ''} 
              onChange={(e) => { if (e.target.value) setActiveTab(e.target.value as TabName) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '1.05rem', cursor: 'pointer', outline: 'none' }}
            >
              <option value="" disabled>Tools ▼</option>
              <option value="gearing">Cashflow & Gearing</option>
              <option value="affordability">Price Ceiling</option>
              <option value="purchase-plan">My Purchase Plan</option>
              <option value="calculators">Calculators</option>
            </select>
            <button
              className={`tab-btn ${activeTab === 'favorites' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('favorites')}
              style={{ fontSize: '1.05rem', border: 'none' }}
            >
              ❤ Saved
            </button>
          </div>
        </nav>

      {activeTab === 'profile' && (
        <div className="main-grid">
          <aside className="sidebar glass-card">
            {loadingData ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading database...
              </div>
            ) : suburbsData.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚠️</div>
                <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>Data Unavailable</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No suburbs could be loaded from the API. Check that the backend is running and the database is populated.
                </div>
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
                <input
                  key={activeSuburb?.id || 'empty'}
                  list="suburb-datalist"
                  className="premium-select"
                  placeholder="Type or select from list..."
                  defaultValue={activeSuburb ? `${activeSuburb.name} (${activeSuburb.postcode})` : ''}
                  onFocus={(e) => {
                    e.target.value = '';
                  }}
                  onBlur={(e) => {
                    if (!e.target.value && activeSuburb) {
                      e.target.value = `${activeSuburb.name} (${activeSuburb.postcode})`;
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    const target = stateSuburbs.find(s => `${s.name} (${s.postcode})` === val);
                    if (target) {
                      setActiveSuburb(target);
                      manualSelectionRef.current = true;
                      loadColdSuburb(target.id);
                      trackActivity('VIEW_SUBURB', target.id);
                      e.target.blur();
                    }
                  }}
                />
                <datalist id="suburb-datalist">
                  {stateSuburbs.map(suburb => {
                    const dq = (suburb as any).dqScore;
                    const hasDqIssue = dq == null || dq < 70;
                    return (
                      <option key={suburb.id} value={`${suburb.name} (${suburb.postcode})`}>
                        {hasDqIssue ? '⚠️ Low Data Quality' : ''}
                      </option>
                    )
                  })}
                </datalist>
              </div>
            </div>

            <div className="control-group" style={{ marginTop: '20px' }}>
              <button 
                onClick={() => window.open(`/api/v3/export?state=${activeState}`, '_blank')}
                style={{
                  width: '100%', padding: '12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center',
                  alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Export {activeState} Data (CSV)
              </button>
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
                <div className="glass-card" {...{ [SECTION_ATTR]: 'overview' }}>
                    <div className="detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <h2 className="detail-title" style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {activeSuburb.name}, {activeSuburb.state}
                          </h2>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              className="favorite-btn"
                              onClick={() => toggleFavorite(activeSuburb.id)}
                              style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border-glass)', cursor: 'pointer', fontSize: '1.2rem',
                                color: favorites.includes(activeSuburb.id) ? '#ef4444' : 'var(--text-secondary)',
                                transition: 'all 0.2s', padding: '6px 12px', borderRadius: '8px', boxShadow: 'var(--shadow-sm)'
                              }}
                              title={favorites.includes(activeSuburb.id) ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              {favorites.includes(activeSuburb.id) ? '♥ Saved' : '♡ Save'}
                            </button>
                            <ShareReport suburbName={`${activeSuburb.name}, ${activeSuburb.state}`} suburbId={activeSuburb.id} />
                          </div>
                        </div>
                        <p className="subtitle" style={{ marginTop: '8px', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                          {(activeSuburb as any).cbdDistance
                            ? `${(activeSuburb as any).cbdDistance} min to ${activeSuburb.metroCBD || 'CBD'}`
                            : activeSuburb.metroCBD || 'Regional'}
                          <span style={{ margin: '0 10px', color: 'var(--border-glass)' }}>|</span>
                          {activeSuburb.postcode}
                        </p>
                        {(activeSuburb as any).lastUpdated && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Data Last Updated: {new Date((activeSuburb as any).lastUpdated).toLocaleDateString()}
                          </p>
                        )}
                        
                        {/* Evidence-backed highlights */}
                        {(activeSuburb.highlights || []).length > 0 && (
                          <div style={{ marginTop: '15px' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Key Drivers</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {(activeSuburb.highlights || []).slice(0, 3).map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => setActiveTab('buy-finder')}
                            style={{ padding: '8px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-glass)'}
                          >
                            🔍 Compare Alternatives
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        {/* Confidence Band (Data Quality) */}
                        <div className="main-score" style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Data Confidence
                            <ScoreInlineHint scoreKey="dq" value={(activeSuburb as any).dqScore ?? null} />
                          </div>
                          {(()=>{
                            const dq = (activeSuburb as any).dqScore;
                            if (dq == null) return <div style={{ fontSize: '1.2rem', color: '#f59e0b', fontWeight: 'bold' }}>⚠️ Low</div>;
                            const c=dq>=80?'#10b981':dq>=60?'#f59e0b':'#ef4444';
                            return <div style={{ fontSize: '1.8rem', color: c, fontWeight: 'bold' }}>{Math.round(dq)}/100</div>;
                          })()}
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Data Quality</div>
                        </div>

                        {/* ABS Verified Badge */}
                        {(activeSuburb as any).absDemographicsSourced && (
                          <div className="main-score" style={{ textAlign: 'center', background: 'rgba(16,185,129,0.08)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#10b981', marginBottom: '5px' }}>Demographics</div>
                            <div style={{ fontSize: '1.2rem', color: '#10b981', fontWeight: 'bold' }}>✓ ABS 2021</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Census Verified</div>
                          </div>
                        )}

                        {/* Growth Score — relabeled "Market Momentum" for clarity */}
                        <div className="main-score">
                          <div className="main-score-value" title="Market Momentum: deterministic composite of price growth, population, yield, demand/supply, vacancy and sentiment. Not a price forecast.">
                            {activeSuburb.growthScore}
                          </div>
                          <div className="main-score-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Market Momentum
                            <ScoreInlineHint scoreKey="growth" value={activeSuburb.growthScore} />
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2px', lineHeight: '1.1' }}>
                            Deterministic momentum,<br/>not a price forecast
                          </div>
                          <button
                            onClick={() => setActiveTab('gearing')}
                            style={{ marginTop: '10px', padding: '6px 12px', background: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', width: '100%' }}
                          >
                            💰 View Cashflow →
                          </button>
                        </div>
                      </div>
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-label">Median Price</div>
                      <div className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        {(activeSuburb as any).houseMedianPrice ? `$${(activeSuburb as any).houseMedianPrice.toLocaleString()}` : (activeSuburb as any).medianPrice ? `$${(activeSuburb as any).medianPrice.toLocaleString()}` : activeSuburb.metrics?.medianPrice ? `$${activeSuburb.metrics.medianPrice.toLocaleString()}` : 'No data'}
                        {(() => {
                          const change = Number((activeSuburb as any).houseMedianPrice12mChangePct) || 0;
                          if (change) {
                            return <span style={{ fontSize: '1rem', color: change > 0 ? 'var(--success)' : 'var(--danger)' }}>{change > 0 ? '▲' : '▼'} {Math.abs(change)}%</span>
                          }
                          return null;
                        })()}
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
                    <div className="metric-box">
                      <div className="metric-label">AI News Sentiment</div>
                      <div className={`metric-value ${
                        (activeSuburb.metrics as any)?._newsScore >= 7 ? 'highlight-cyan' :
                        (activeSuburb.metrics as any)?._newsScore >= 4 ? 'text-muted' : 'text-warning'
                      }`} style={{ fontSize: '1rem' }}>
                        {activeSuburb.metrics.aiNewsSentiment || 'Pending'}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>See AI Insights panel below</span>
                    </div>
                   </div>

                   {/* Score Legend — explains the three numbers a user sees on this page */}
                   <ScoreLegendPanel growthFactors={((activeSuburb as any).growthFactorsLabeled) as GrowthFactorLabeled[] | undefined} />

                   {/* MACRO MARKET PULSE */}
                  {macroEtf && typeof macroEtf.current_price === 'number' && (
                    <div className="highlights-section" style={{ marginTop: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px' }}>
                      <h3 style={{ marginBottom: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📈 Macro Market Pulse (National Benchmark)
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{macroEtf.symbol} ETF</div>
                          <div style={{ fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>${macroEtf.current_price.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>12M Growth</div>
                          <div style={{ fontSize: '1.4rem', color: macroEtf.growth_1y_pct >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                            {macroEtf.growth_1y_pct >= 0 ? '+' : ''}{macroEtf.growth_1y_pct}%
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Local vs Macro (12M)</div>
                          <div style={{ fontSize: '1.4rem', color: (Number(activeSuburb.houseMedianPrice12mChangePct) || 0) > macroEtf.growth_1y_pct ? 'var(--accent-cyan)' : 'var(--warning)', fontWeight: 'bold' }}>
                            {(Number(activeSuburb.houseMedianPrice12mChangePct) || 0) > macroEtf.growth_1y_pct ? 'Outperforming' : 'Underperforming'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                        Baseline: {macroEtf.name}. Use this to determine if local growth is genuine alpha or just riding the national tide.
                      </div>
                    </div>
                   )}

                    <ProfileSectionNav activePersona={persona} activeSection={activeProfileSection} onSectionChange={setActiveProfileSection} />

                   {/* PANEL A: Market Snapshot */}
                   <div className="highlights-section" style={{ marginTop: '20px', display: activeProfileSection === 'overview' ? 'block' : 'none' }} {...{ [SECTION_ATTR]: 'overview' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      Panel A: Market Snapshot
                    </h3>
                    {/* Top KPI Ribbon */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Days on Market</div>
                        <div style={{ fontSize: '1.8rem', color: 'var(--accent-cyan)', fontWeight: 'bold', marginTop: '5px' }}>
                          {activeSuburb.houseDaysOnMarket ? `${activeSuburb.houseDaysOnMarket} Days` : '—'}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Vacancy Rate</div>
                        <div style={{ fontSize: '1.8rem', color: 'var(--success)', fontWeight: 'bold', marginTop: '5px' }}>
                          {activeSuburb.vacancyRate != null ? `${Number(activeSuburb.vacancyRate).toFixed(1)}%` : '—'}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Mortgage Band</div>
                        <div style={{ fontSize: '1.8rem', color: 'var(--accent-purple)', fontWeight: 'bold', marginTop: '5px' }}>
                          {(activeSuburb as any).typicalMortgageBand || (activeSuburb.metrics as any)?.mortgageBand || '—'}
                        </div>
                      </div>
                    </div>
                   </div>

                  {/* Decision Brief — compact evidence-based summary */}
                  <div style={{ display: activeProfileSection === 'overview' ? 'block' : 'none' }}>
                  <DecisionBrief activeSuburb={activeSuburb} setActiveTab={setActiveTab} selectedResult={selectedBuyerFitResult} requestMeta={selectedRequestMeta} />
                  </div>

                    {/* Visuals Grid (Charts) */}
                    <details className="expandable-section" style={{ marginTop: '20px', display: activeProfileSection === 'market' ? 'block' : 'none', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--accent-cyan)', padding: '10px', outline: 'none' }}>
                        📊 View Detailed Demographics & Charts
                      </summary>
                      <div style={{ marginTop: '15px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                          {/* Left Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* House vs Unit bar chart */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '15px', color: 'var(--text-primary)' }}>Median Price: House vs Unit</h4>
                          <div style={{ height: '180px' }}>
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
                          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            House: {activeSuburb.houseMedianPrice12mChangePct ? `${Number(activeSuburb.houseMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.houseMedianPrice12mChangePct).toFixed(2)}%` : '—'} | Unit: {activeSuburb.unitMedianPrice12mChangePct ? `${Number(activeSuburb.unitMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.unitMedianPrice12mChangePct).toFixed(2)}%` : '—'}
                          </div>
                        </div>

                        {/* Household Types */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '15px', color: 'var(--text-primary)' }}>Household Types</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(() => {
                              const hhData = ((activeSuburb as any).demographicsDetailV3?.household_distribution) || {}
                              const total = Object.values(hhData).reduce((a:number,b:any) => a + Number(b), 0) || 1
                              return Object.entries(hhData).map(([k,v]) => (
                                <div key={k}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{Number(v).toFixed(0)}%</span>
                                  </div>
                                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                                    <div style={{ height: '100%', width: `${(Number(v)/total*100).toFixed(0)}%`, background: 'var(--accent-purple)', borderRadius: '4px' }} />
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Household Income Bands */}
                        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '15px', color: 'var(--text-primary)' }}>Household Income Bands</h4>
                          <div style={{ flex: 1, minHeight: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={(() => {
                                const incData = ((activeSuburb as any).demographicsDetailV3?.income_distribution) || {}
                                return Object.entries(incData).map(([k,v]) => ({ name: k, value: Number(v) }))
                              })()} margin={{ top: 10, right: 10, left: 30, bottom: 0 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" horizontal={false} />
                                <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `${val}%`} />
                                <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={11} width={75} />
                                <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Households']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                <Bar dataKey="value" fill="var(--accent-cyan)" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>

                  {/* BUYER AGENT SUMMARY */}
                  <div className="highlights-section" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                      📊 Agent Scorecard
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                            { label:'Median Annual Income', value: (s as any).demographics?.median_annual_income_abs ? '$' + Number((s as any).demographics.median_annual_income_abs).toLocaleString() + '/yr' : '—', icon:'💵' },
                            { label:'Predominant Band', value: demo.predominant_income_band || '—', icon:'📊' },
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
                      {/* 10-Year Projection — NOT AVAILABLE in POC */}
                      <div style={{ flex: '1 1 400px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                          <h4 style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>Long-Horizon Forecast Unavailable</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px', lineHeight: 1.5 }}>
                            The POC does not yet produce calibrated long-horizon forecasts.
                            Return after sufficient observation history is accumulated to enable
                            empirical backtesting and calibration.
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Scenario illustration only. This is not an empirical probability,
                            calibrated forecast, or financial prediction.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  </details>

                  {/* NEW LIVABILITY SECTION */}
                   <div className="highlights-section" style={{ marginTop: '20px', display: activeProfileSection === 'infrastructure' ? 'block' : 'none' }} {...{ [SECTION_ATTR]: 'infrastructure' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3>Livability & Amenities</h3>
                      {livabilityData && (
                        <button
                          onClick={() => setShowAmenitiesOnMap(!showAmenitiesOnMap)}
                          style={{
                            background: showAmenitiesOnMap ? 'var(--accent-cyan)' : 'var(--bg-glass)', 
                            color: showAmenitiesOnMap ? '#000' : 'var(--text-primary)', 
                            border: '1px solid var(--border-glass)', 
                            padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold'
                          }}
                        >
                          {showAmenitiesOnMap ? 'Hide Amenities from Map' : 'Show Amenities on Map'}
                        </button>
                      )}
                    </div>
                    {loadingLivability && (
                      <div style={{ marginTop: '15px' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>Scanning neighborhood via OpenStreetMap...</p>
                        <div className="metrics-grid" style={{ marginBottom: '15px' }}>
                          <div className="metric-box">
                            <div className="metric-label">Walkability Score</div>
                            <div className="metric-value" style={{ color: 'var(--text-secondary)' }}>—</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Cafes & Dining</div>
                            <div className="metric-value" style={{ color: 'var(--text-secondary)' }}>—</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Parks & Leisure</div>
                            <div className="metric-value" style={{ color: 'var(--text-secondary)' }}>—</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Transit Stops</div>
                            <div className="metric-value" style={{ color: 'var(--text-secondary)' }}>—</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {livabilityData && !loadingLivability && (
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
                          <div style={{ marginBottom: '10px' }}>
                            <strong>Local Schools (OSM): </strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              {livabilityData.schools.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.schools.length > 5 ? '...' : ''}
                            </span>
                          </div>
                        )}
                        {livabilityData.train_stations.length > 0 && (
                          <div>
                            <strong>Local Train Stations: </strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              {livabilityData.train_stations.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.train_stations.length > 5 ? '...' : ''}
                            </span>
                          </div>
                        )}
                      {/* School Catchment Links */}
                      <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>🎓 Official School Catchment Zones</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Verify local public school enrolment eligibility directly via state government maps:</p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {activeSuburb.state === 'VIC' && <a href="https://www.findmyschool.vic.gov.au/" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>VIC: FindMySchool →</a>}
                          {activeSuburb.state === 'NSW' && <a href="https://schoolfinder.education.nsw.gov.au/" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>NSW: School Finder →</a>}
                          {activeSuburb.state === 'QLD' && <a href="https://www.qgso.qld.gov.au/maps/edmap/" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>QLD: EdMap →</a>}
                          {activeSuburb.state === 'SA' && <a href="https://www.education.sa.gov.au/parents-and-families/enrol-school-or-preschool/find-a-school-zone-or-preschool-catchment-area" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>SA: Location SA →</a>}
                          {activeSuburb.state === 'TAS' && <a href="https://www.decyp.tas.gov.au/learning/enrolment/" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>TAS: DECYP Directory →</a>}
                          {['WA', 'NT', 'ACT'].includes(activeSuburb.state) && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Check local education department for {activeSuburb.state} catchments.</span>}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>

                  {/* PANEL B: Demographics (People & Infrastructure) */}
                  <div className="highlights-section" style={{ marginTop: '20px', display: (activeProfileSection === 'people' || activeProfileSection === 'infrastructure') ? 'block' : 'none' }} {...{ [SECTION_ATTR]: 'people' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>{activeProfileSection === 'infrastructure' ? 'Infrastructure & Development' : 'Demographics & People'}</h3>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '2 1 500px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', display: activeProfileSection === 'people' ? 'block' : 'none' }}>
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
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', display: activeProfileSection === 'people' ? 'block' : 'none' }}>
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
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', display: activeProfileSection === 'people' ? 'block' : 'none' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Macro Indicators (ABS)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', padding: '0 10px' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Unemployment Rate</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>
                              {activeSuburb.unemploymentRate ? `${activeSuburb.unemploymentRate}%` : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Building Approvals (12m)</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                              {activeSuburb.buildingApprovals12m ? activeSuburb.buildingApprovals12m.toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Major Infrastructure</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                              {activeSuburb.infrastructureInvestment || 'No major projects identified'}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* 🏛️ Social Infrastructure */}
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', display: activeProfileSection === 'infrastructure' ? 'block' : 'none' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>🏛️ Social Infrastructure</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                          {(() => {
                            const s = activeSuburb as any
                            const worshipTotal = s.worshipTotal || 0
                            const religions = [
                              { label: 'Christian', color: '#6366f1', val: s.worshipChristian || 0 },
                              { label: 'Muslim', color: '#10b981', val: s.worshipMuslim || 0 },
                              { label: 'Buddhist', color: '#f59e0b', val: s.worshipBuddhist || 0 },
                              { label: 'Hindu', color: '#ef4444', val: s.worshipHindu || 0 },
                              { label: 'Sikh', color: '#a855f7', val: s.worshipSikh || 0 },
                              { label: 'Jewish', color: '#3b82f6', val: s.worshipJewish || 0 },
                            ].filter(r => r.val > 0)
                            const social = [
                              { label: 'Shelters', icon: '🏠', value: s.shelterCount },
                              { label: 'Community Centres', icon: '🏫', value: s.communityCentreCount },
                              { label: 'Retirement Homes', icon: '🧓', value: s.retirementHomeCount },
                            ].filter(item => item.value != null)
                            if ((worshipTotal === 0 || worshipTotal == null) && social.length === 0)
                              return <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center' }}>No data</span>
                            return (
                              <>
                                {worshipTotal > 0 && (
                                  <div style={{ marginBottom: '8px' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                      ⛪ Places of Worship ({worshipTotal})
                                    </div>
                                    <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden' }}>
                                      {religions.map(r => (
                                        <div key={r.label} title={`${r.label}: ${r.val}`}
                                          style={{ flex: r.val, backgroundColor: r.color, minWidth: '2px' }} />
                                      ))}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                      {religions.map(r => (
                                        <span key={r.label} style={{ fontSize: '0.65rem', color: r.color }}>
                                          {r.label} {r.val}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {social.map(item => (
                                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{item.icon} {item.label}</span>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.8rem' }}>{item.value}</span>
                                  </div>
                                ))}
                                {(s.socialHousingPct != null && s.socialHousingPct > 0) && (
                                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-glass)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>🏘️ Social Housing</span>
                                      <span style={{ color: s.socialHousingPct > 10 ? '#ef4444' : 'var(--text-primary)', fontWeight: 600, fontSize: '0.8rem' }}>
                                        {s.socialHousingPct.toFixed(1)}%
                                      </span>
                                    </div>
                                    {s.publicHousingDwellings != null && (
                                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        {s.publicHousingDwellings} public · {s.communityHousingDwellings || 0} community
                                      </div>
                                    )}
                                    {s.absG37Sourced && (
                                      <div style={{ fontSize: '0.6rem', color: '#10b981', marginTop: '2px' }}>✓ ABS Census</div>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      {/* 🏗️ Development Activity */}
                      <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', display: activeProfileSection === 'infrastructure' ? 'block' : 'none' }}>
                        <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>🏗️ Development Activity</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
                          {(() => {
                            const s = activeSuburb as any
                            const constr = s.constructionSqkm || 0
                            const green = s.greenfieldSqkm || 0
                            const brown = s.brownfieldSqkm || 0
                            const total = constr + green + brown
                            const bldCount = s.buildingConstructionCount
                            const subdiv = s.subdivisionPotential || 'Low'
                            
                            return (
                              <>
                                <div style={{ paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--border-glass)' }}>
                                  {s.avgBlockSqm != null && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>📐 Avg Block Size</span>
                                      <span style={{ fontWeight: 600 }}>{s.avgBlockSqm} sqm</span>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: s.avgBlockSqm != null ? '4px' : '0' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>✂️ Subdivision Potential</span>
                                    <span style={{ 
                                      fontWeight: 600, 
                                      color: subdiv === 'High' ? '#10b981' : subdiv === 'Medium' ? '#f59e0b' : 'var(--text-primary)'
                                    }}>{subdiv}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>✅ DA Precedent</span>
                                    {s.approvedSubdivisions12m > 0 ? (
                                      <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontWeight: 600, color: '#10b981', display: 'block' }}>{s.approvedSubdivisions12m} approved (last 12 mo)</span>
                                        {s.minApprovedSubdivisionSqm && (
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Min lot: {s.minApprovedSubdivisionSqm} sqm</span>
                                        )}
                                      </div>
                                    ) : s.minApprovedSubdivisionSqm ? (
                                      <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontWeight: 600, color: '#f59e0b', display: 'block' }}>Proxy only</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Min observed: {s.minApprovedSubdivisionSqm} sqm</span>
                                      </div>
                                    ) : (
                                      <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>No data</span>
                                    )}
                                  </div>
                                </div>
                                  
                                  {total === 0 && bldCount == null && (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center', display: 'block' }}>No development data</span>
                                  )}
                                  
                                  {total > 0 && (
                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                      Land Use Within 2.5km ({total.toFixed(3)} km²)
                                    </div>
                                    <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                                      {constr > 0 && <div title={`Construction: ${constr.toFixed(3)} km²`} style={{ flex: constr, backgroundColor: '#ef4444', minWidth: '2px' }} />}
                                      {brown > 0 && <div title={`Brownfield: ${brown.toFixed(3)} km²`} style={{ flex: brown, backgroundColor: '#f59e0b', minWidth: '2px' }} />}
                                      {green > 0 && <div title={`Greenfield: ${green.toFixed(3)} km²`} style={{ flex: green, backgroundColor: '#10b981', minWidth: '2px' }} />}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                      {constr > 0 && <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>🔴 Construction {constr.toFixed(3)}</span>}
                                      {brown > 0 && <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>🟡 Brownfield {brown.toFixed(3)}</span>}
                                      {green > 0 && <span style={{ fontSize: '0.65rem', color: '#10b981' }}>🟢 Greenfield {green.toFixed(3)}</span>}
                                    </div>
                                  </div>
                                )}
                                {bldCount != null && bldCount > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>🔨 Buildings Under Construction</span>
                                    <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '1.1rem' }}>{bldCount}</span>
                                  </div>
                                )}
                                {bldCount != null && bldCount === 0 && total > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                    No active building construction detected
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PANEL C: Live Listings Feed */}
                  <div className="highlights-section" style={{ marginTop: '20px', display: activeProfileSection === 'listings' ? 'block' : 'none' }} {...{ [SECTION_ATTR]: 'listings' }}>
                    <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Live Listings Feed</h3>
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

                  {/* PANEL D: AI Insights — News Sentiment + Investment Committee */}
                  <div style={{ marginTop: '20px', display: activeProfileSection === 'ai' ? 'block' : 'none' }}>
                    <h3 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>🧠 AI Committee (Debate & Sentiment)</h3>
                    <div style={{ padding: '20px' }} id="ai-insight-panel" {...{ [SECTION_ATTR]: 'ai' }}>
                      <AIInsightPanel
                        activeSuburb={activeSuburb}
                        setActiveSuburb={setActiveSuburb}
                      />
                    </div>
                  </div>

                  {/* PANEL E: Quick ROI Calculator */}
                  <div style={{ display: activeProfileSection === 'overview' || activeProfileSection === 'market' ? 'block' : 'none' }}>
                  <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ROI calculator...</div>}>
                  <QuickRoiCalculator 
                    medianPrice={(activeSuburb as any).houseMedianPrice || 0} 
                    medianRent={(activeSuburb as any).houseMedianRent || (activeSuburb as any).weeklyRent || 0} 
                    state={(activeSuburb as any).state || "VIC"}
                    onAdvancedClick={() => setActiveTab('gearing')}
                  />
                  </Suspense>
                  </div>

                  {/* K-Means Clustering: Similar Suburbs */}
                  <div style={{ marginTop: '20px', display: activeProfileSection === 'pockets' ? 'block' : 'none' }}>
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

                   {/* INVESTMENT CATALYSTS — moved below AI Committee */}
                   <div className="highlights-section" style={{ marginTop: '20px', display: activeProfileSection === 'risk' ? 'block' : 'none' }} {...{ [SECTION_ATTR]: 'risk' }}>
                     <h3 style={{ marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Investment Catalysts</h3>
                     <ul className="highlights-list">
                       {activeSuburb.highlights && activeSuburb.highlights.length > 0 && !activeSuburb.highlights.every((h: string) => h.includes('N/A') || h.includes('Data Unavailable') || h.includes('generated') || h.includes('Pending')) ? (
                         activeSuburb.highlights
                           .filter((h: string) => !h.includes('N/A') && !h.includes('Data Unavailable') && !h.includes('generated') && !h.includes('Pending'))
                           .map((highlight: string, index: number) => (
                             <li key={index}>{highlight}</li>
                           ))
                       ) : (
                         <li style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Run AI Committee above to generate investment catalysts for this suburb.</li>
                       )}
                     </ul>
                   </div>

                  {(!activeSuburb.schools || activeSuburb.schools.length === 0) && (!activeSuburb.pois || activeSuburb.pois.length === 0) && (
                    <div className="no-data-banner">
                      <p>Limited data available for this suburb. Core metrics are estimated from market trends. School zones, POIs, and historical data are being collected.</p>
                    </div>
                  )}

                  {activeSuburb.schools && activeSuburb.schools.length > 0 && (
                    <div className="schools-section" style={{ display: activeProfileSection === 'infrastructure' ? 'block' : 'none', marginTop: '20px' }}>
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

                {/* Persona-gated sections */}
                <div style={{ display: activeProfileSection === 'technical' ? 'block' : 'none' }}>
                  {getPersona(persona).show_technical && (
                    <TechnicalProvenanceSection suburb={activeSuburb as any} />
                  )}
                </div>
                <div style={{ display: activeProfileSection === 'market' ? 'block' : 'none' }}>
                  {(persona !== 'first_home_buyer') && !getPersona(persona).show_technical && (
                    <MarketIndicatorsSection suburb={activeSuburb as any} />
                  )}
                </div>
                <div style={{ display: activeProfileSection === 'pockets' ? 'block' : 'none' }}>
                  <PocketRiskMap suburbId={activeSuburb.id} />
                </div>

                <div style={{ display: activeProfileSection === 'overview' ? 'block' : 'none' }}>
                  <SuburbMap
                    center={activeSuburb.coordinates || [-25.2744, 133.7751]}
                    pois={mappedPois}
                    schools={mappedSchools}
                    suburbName={activeSuburb.name}
                    stateName={activeSuburb.state}
                    postcode={activeSuburb.postcode}
                  />
                </div>
              </div>
            ) : (
              <div className="glass-card empty-state">
                <p>Please select a state and suburb to view the profile.</p>
              </div>
            )}
          </main>
        </div>
      )}

      {activeTab === 'buy-finder' && <Suspense fallback={<div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}><BuyFinder suburbsData={suburbsData} setActiveSuburb={(s: any) => { if (s && s.id) loadColdSuburb(s.id); }} setActiveTab={(t: string) => setActiveTab(t as TabName)} onSelectResult={(result, meta) => { setSelectedBuyerFitResult(result); setSelectedRequestMeta(meta); try { sessionStorage.setItem('bf_result', JSON.stringify(result)); sessionStorage.setItem('bf_meta', JSON.stringify(meta)); } catch {} if (isAuthenticated) { fetch('/api/buy-finder/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suburb_id: result.suburb_id, request_meta: meta, result }) }).catch(() => {}) } }} financialProfile={financialProfile} setFinancialProfile={setFinancialProfile} /></Suspense>}
      {activeTab === 'affordability' && <Suspense fallback={<div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading calculator...</div>}><AffordabilityCalculator suburbsData={suburbsData} setActiveTab={(t: string) => setActiveTab(t as TabName)} financialProfile={financialProfile} setFinancialProfile={setFinancialProfile} /></Suspense>}
      {activeTab === 'gearing' && <Suspense fallback={<div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading cashflow analysis...</div>}><CashflowGearing 
        suburbsData={suburbsData} 
        defaultSuburbId={activeSuburb?.id}
        defaultPrice={selectedBuyerFitResult?.affordability?.purchase_price || (activeSuburb as any)?.houseMedianPrice || (activeSuburb as any)?.medianPrice || undefined}
        defaultRent={(activeSuburb as any)?.houseMedianRent || (activeSuburb as any)?.weeklyRent || undefined}
      /></Suspense>}
      {activeTab === 'purchase-plan' && <Suspense fallback={<div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading purchase plan...</div>}><MyPurchasePlan suburbsData={suburbsData} /></Suspense>}
      {activeTab === 'institutional' && <Suspense fallback={<div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading institutional panel...</div>}><InstitutionalV3Panel /></Suspense>}
      {activeTab === 'calculators' && <Suspense fallback={<div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>Loading calculators...</div>}><Calculators /></Suspense>}
      {activeTab === 'favorites' && (
        <UserFavoritesTab 
          suburbsData={suburbsData} 
          onSelectSuburb={(suburb) => {
            setActiveSuburb(suburb);
            setActiveTab('profile');
          }} 
        />
      )}

      </div>

      <footer style={{ marginTop: '40px', padding: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', textAlign: 'center', lineHeight: '1.5' }}>
        <p><strong>Legal Disclaimer:</strong> The information provided on this platform is for general informational purposes only and does not constitute financial, investment, or real estate advice. Forecasts are statistical models based on historical data and do not guarantee future performance.</p>
        <p style={{ marginTop: '10px' }}><strong>State Data Attributions:</strong> 
          (NSW) Contains property sales information provided under licence from the Valuer General NSW. 
          (VIC) The State of Victoria owns the copyright in the Property Sales Data and reproduction without consent will constitute a breach of the Copyright Act 1968 (Cth). 
          (QLD) Based on or contains data provided by the State of Queensland (Department of Resources).
        </p>
      </footer>
    </div>
  )
}

export default App
