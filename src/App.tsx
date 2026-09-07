import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import type { SuburbData } from './data/suburbs'
import SuburbMap from './components/SuburbMap'
import TermsOfUseModal from './components/TermsOfUseModal'
import UserFavoritesTab from './components/UserFavoritesTab'
import AIInsightPanel from './components/AIInsightPanel'
import DecisionBrief from './components/DecisionBrief'
import type { BuyerFitResult } from './data/buyerFitTypes'
import { ScoreLegendPanel, type GrowthFactorLabeled } from './components/ScoreLegend'
import TechnicalProvenanceSection from './components/TechnicalProvenanceSection'
import ProfileSectionNav, { SECTION_ATTR } from './components/ProfileSectionNav'
import MarketIndicatorsSection from './components/MarketIndicatorsSection'
import SqmHistoricalChart from './components/SqmHistoricalChart'
import PriceHistoryChart from './components/PriceHistoryChart'
import SqmDashboard from './components/SqmDashboard'
import PocketRiskMap from './components/PocketRiskMap'
import YieldHeatmap from './components/YieldHeatmap'
import type { PersonaId, ProfileSectionId } from './data/personas'
import { loadStoredPersona, getPersona } from './data/personas'
import { fetchLivabilityData, type LivabilityData } from './services/osmApi'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import './index.css'
import LandingPage from './components/LandingPage'
import PromoBanner from './components/PromoBanner'
import MacroBenchmarkPanel from './components/MacroBenchmarkPanel'
import { SuburbHero } from './components/SuburbHero';
import './styles/hero.css';

import { getDisplayGroup, getStateName } from './utils/regionMapper'
import { AppShell } from './components/AppShell'
import type { ViewId } from './components/AppShell'
import { ChartToggle } from './components/ui/ChartToggle'

const viewToTab = (view: string | null): TabName => {
  const validViews: TabName[] = ['ask', 'buy-finder', 'profile', 'affordability', 'gearing', 'purchase-plan', 'calculators', 'portfolio', 'heatmap', 'favorites', 'settings'];
  if (view && validViews.includes(view as TabName)) return view as TabName;
  return 'ask';
};

const Calculators = lazy(() => import('./components/Calculators'))
const AffordabilityCalculator = lazy(() => import('./components/AffordabilityCalculator'))
const ChatView = lazy(() => import('./components/ChatView'))
const CashflowGearing = lazy(() => import('./components/CashflowGearing'))
const PortfolioTab = lazy(() => import('./components/PortfolioTab'));

const MyPurchasePlan = lazy(() => import('./components/MyPurchasePlan'))
const QuickRoiCalculator = lazy(() => import('./components/QuickRoiCalculator'))
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })))

type TabName = 'ask' | 'buy-finder' | 'profile' | 'affordability' | 'gearing' | 'purchase-plan' | 'calculators' | 'favorites' | 'portfolio' | 'heatmap' | 'settings';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('is_auth') === 'true')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
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

  const [activeTab, setActiveTab] = useState<TabName>(() => {
    const p = new URLSearchParams(window.location.search).get('view');
    return viewToTab(p);
  })
  const [activeState, setActiveState] = useState<string>('VIC')
  const [persona, setPersona] = useState<PersonaId>(loadStoredPersona)
  const [activeProfileSection, setActiveProfileSection] = useState<ProfileSectionId>('overview')
  const [activeSuburb, setActiveSuburb] = useState<SuburbData | null>(null)

  const handleViewChange = useCallback((view: ViewId) => {
    const tab = view as TabName;
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('view', tab);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== activeTab) {
      params.set('view', activeTab);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [activeTab]);
  
  // 1. Dynamic Page Title
  useEffect(() => {
    if (activeSuburb) {
      document.title = `${activeSuburb.name}, ${activeSuburb.state} ${activeSuburb.postcode} — PropertyIQ`
    } else {
      document.title = 'PropertyIQ'
    }
  }, [activeSuburb])

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
  const [benchmarks, setBenchmarks] = useState<any[] | null>(null)

  // Restore auth state from httpOnly cookie on page load
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(res => { 
        if (res.ok) {
          setIsAuthenticated(true)
          localStorage.setItem('is_auth', 'true')
        } else {
          setIsAuthenticated(false)
          localStorage.removeItem('is_auth')
        }
      })
      .catch(() => {
        setIsAuthenticated(false)
        localStorage.removeItem('is_auth')
      })
      .finally(() => setIsCheckingAuth(false))
  }, [])

  const [financialProfile, setFinancialProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('financialProfile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      budget: 500000,
      deposit: 100000,
      lvrPct: 80,
      annualIncome: 80000,
      monthlyDebt: 0,
      interestRate: 6.2,
      bufferRate: 3.0,
      loanTermYears: 30,
      purchaseCostAllowance: 5.0,
      propertyType: 'house',
      maxCBDMinutes: 60,
      minimumYield: null,
      state: 'VIC',
    };
  });

  useEffect(() => {
    localStorage.setItem('financialProfile', JSON.stringify(financialProfile));
  }, [financialProfile]);

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
      const res = await fetch(`/api/suburbs/${id}`, { credentials: 'include' })
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
            fetch(`/api/buy-finder/snapshots?suburb_id=${id}`, { credentials: 'include' })
              .then(res => res.json())
              .then(snapshots => {
                if (snapshots && snapshots.length > 0) {
                  fetch(`/api/buy-finder/snapshots/${snapshots[0].id}`, { credentials: 'include' })
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
      setLoadingData(true)
      fetch(`/api/suburbs?state=${activeState}`, { credentials: 'include' })
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
    
      fetch('/api/benchmarks', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setBenchmarks(data))
        .catch(err => console.error("Benchmarks fetch error:", err))

      fetch('/api/favorites', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setFavorites(data.favorites)
          }
        })
        .catch(err => console.error("Favorites fetch error:", err))
    }
  }, [isAuthenticated, activeState])

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
        credentials: 'include',
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

  const states = ['NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
  const stateSuburbs = useMemo(() =>
    filteredSuburbsData.filter(s => activeState === '' || s.state === activeState).sort((a, b) => a.name.localeCompare(b.name)),
    [activeState, filteredSuburbsData]
  )

  const [suburbSearch, setSuburbSearch] = useState<string>('');
  const [showSuburbDropdown, setShowSuburbDropdown] = useState(false);
  const [activeZonePill, setActiveZonePill] = useState<string>('All');

  // Zone pills derived from current state suburbs
  const zonePills = useMemo(() => {
    const groups = new Set<string>();
    stateSuburbs.forEach(s => groups.add(getDisplayGroup(s.state, s.postcode)));
    return ['All', ...Array.from(groups).sort()];
  }, [stateSuburbs]);

  // Reset zone pill when state changes
  useEffect(() => { setActiveZonePill('All'); setSuburbSearch(''); }, [activeState]);

  // Filtered suburbs for the search combobox
  const searchFilteredSuburbs = useMemo(() => {
    const q = suburbSearch.trim().toLowerCase();
    return stateSuburbs.filter(s => {
      const matchesZone = activeZonePill === 'All' || getDisplayGroup(s.state, s.postcode) === activeZonePill;
      if (!matchesZone) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.postcode.includes(q);
    });
  }, [stateSuburbs, suburbSearch, activeZonePill]);

  // Group search results by display group
  const groupedResults = useMemo(() => {
    const groups: Record<string, typeof stateSuburbs> = {};
    searchFilteredSuburbs.slice(0, 80).forEach(s => {
      const g = getDisplayGroup(s.state, s.postcode);
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });
    // Sort: metro groups first (🏙️), then regional (🌿)
    return Object.entries(groups).sort(([a], [b]) => {
      const aIsRegional = a.startsWith('🌿');
      const bIsRegional = b.startsWith('🌿');
      if (aIsRegional !== bIsRegional) return aIsRegional ? 1 : -1;
      return a.localeCompare(b);
    });
  }, [searchFilteredSuburbs, stateSuburbs]);


  useEffect(() => {
    if (states.length > 0 && !states.includes(activeState)) {
      setActiveState(states[0]);
    }
  }, [states, activeState]);

  useEffect(() => {
    if (stateSuburbs.length > 0) {
      // Only auto‑load the first suburb when the user hasn't manually selected one
      if (!manualSelectionRef.current && (!activeSuburb || activeSuburb.state !== activeState)) {
        // Prefer a suburb with a good DQ score to avoid showing low quality warnings on first load
        const defaultSuburb = [...stateSuburbs].sort((a, b) => ((b as any).dqScore || 0) - ((a as any).dqScore || 0))[0] || stateSuburbs[0];
        
        loadColdSuburb(defaultSuburb.id)
        trackActivity('VIEW_SUBURB', defaultSuburb.id)
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
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      })
      if (res.ok) {
        setIsAuthenticated(true)
        localStorage.setItem('is_auth', 'true')
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

  if (isCheckingAuth) {
    return (
      <div className="app-container u-25c05ceb">
        <div className="title-glow u-27972ce9">Loading PropertyIQ...</div>
      </div>
    )
  }

  if (!isAuthenticated && !isCheckingAuth) {
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
      <div className="app-container u-25c05ceb">
        <div className="glass-card u-7395aece">
          <div className="u-a1f2efe4">
            <h1 className="title-glow u-1d992e33">PropertyIQ</h1>
            <button onClick={() => setAuthMode('landing')} className="u-ae9cf90d">Back</button>
          </div>
          <p className="subtitle u-70cb1db7">
            {isRegistering ? 'Create your professional account' : 'Welcome back'}
          </p>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="u-31b0223f">
            {isRegistering && (
              <div className="u-bccf3703">
                <div className="control-group u-52dcacf6">
                  <label className="control-label">First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="premium-input" required />
                </div>
                <div className="control-group u-52dcacf6">
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
                <div className="u-e54c72b1">
                  <div className="u-ea8c11ee">
                    <div className="u-a1f6c608" style={{width: Math.min(100, password.length * 8) + '%', background: strengthColor}} />
                  </div>
                  <span className="u-a168b724" style={{color: strengthColor}}>{passwordStrength}</span>
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
                  <select value={userType} onChange={e => setUserType(e.target.value)} className="premium-input u-3e9309dc">
                    <option value="First Home Buyer">First Home Buyer</option>
                    <option value="Investor">Investor</option>
                    <option value="Buyer's Agent">Buyer's Agent</option>
                    <option value="Mortgage Broker">Mortgage Broker</option>
                  </select>
                </div>
                
                <div className="u-db674293">
                  <label className="u-f3a0ea00">
                    <input type="checkbox" checked={privacyConsent} onChange={e => setPrivacyConsent(e.target.checked)} className="u-b45e067a" />
                    <span>I agree to the <a href="#" className="u-d03afae3">Privacy Policy</a> and <a href="#" className="u-d03afae3">Terms of Use</a>. *</span>
                  </label>
                  <label className="u-f3a0ea00">
                    <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="u-b45e067a" />
                    <span>I'd like to receive product updates and market insights.</span>
                  </label>
                </div>
              </>
            )}
            
            {verificationMessage && (
              <div className="u-d0428345">
                {verificationMessage}
              </div>
            )}
            {loginError && (
              <div className="u-149fd8bd">
                {loginError}
              </div>
            )}
            
            <button type="submit" className="u-2c476195">
              {isRegistering ? 'Create Account' : 'Log In'}
            </button>
            
            <div className="u-4560a4ac">
              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setConfirmPassword(''); }} className="u-7246f6a5">
                {isRegistering ? 'Already have an account? Log in' : "Don't have an account? Start Free Trial"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <AppShell
      currentView={activeTab as ViewId}
      onViewChange={handleViewChange}
      persona={persona}
      onPersonaChange={setPersona}
      onLogout={() => { setIsAuthenticated(false); setAuthMode('landing'); }}
      showProfile={activeTab === 'profile'}
      usage={{ used: 3, limit: 5 }}
    >
      <PromoBanner />
      <TermsOfUseModal />

      {(activeTab === 'ask' || activeTab === 'buy-finder') && <Suspense fallback={<div className="glass-card u-207f86dd">Loading Chat...</div>}><ChatView setActiveSuburb={(s: any) => { if (s && s.id) loadColdSuburb(s.id); }} setActiveTab={(t: string) => setActiveTab(t as TabName)} /></Suspense>}
      {activeTab === 'affordability' && <Suspense fallback={<div className="glass-card u-207f86dd">Loading calculator...</div>}><AffordabilityCalculator suburbsData={suburbsData} setActiveTab={(t: string) => setActiveTab(t as TabName)} financialProfile={financialProfile} setFinancialProfile={setFinancialProfile} persona={persona} /></Suspense>}
      {activeTab === 'gearing' && <Suspense fallback={<div className="glass-card u-207f86dd">Loading cashflow analysis...</div>}><CashflowGearing 
        suburbsData={suburbsData} 
        defaultSuburbId={activeSuburb?.id}
        defaultPrice={selectedBuyerFitResult?.affordability?.purchase_price || (activeSuburb as any)?.houseMedianPrice || (activeSuburb as any)?.medianPrice || undefined}
        defaultRent={(activeSuburb as any)?.houseMedianRent || (activeSuburb as any)?.weeklyRent || undefined}
      /></Suspense>}
      {activeTab === 'purchase-plan' && <Suspense fallback={<div className="glass-card u-207f86dd">Loading purchase plan...</div>}><MyPurchasePlan suburbsData={suburbsData} /></Suspense>}
      {activeTab === 'calculators' && <Suspense fallback={<div className="glass-card u-207f86dd">Loading calculators...</div>}><Calculators /></Suspense>}
      {activeTab === 'settings' && <Suspense fallback={<div className="glass-card u-207f86dd">Loading settings...</div>}><SettingsPage persona={persona} onPersonaChange={setPersona as any} financialProfile={financialProfile} onLogout={() => { setIsAuthenticated(false); setAuthMode('landing'); }} /></Suspense>}
      {activeTab === 'heatmap' && <Suspense fallback={<div className="glass-card u-207f86dd">Loading heatmap...</div>}><YieldHeatmap /></Suspense>}
      {activeTab === 'favorites' && (
        <Suspense fallback={<div className="glass-card u-207f86dd">Loading favorites...</div>}>
          <UserFavoritesTab 
            suburbsData={suburbsData} 
            onSelectSuburb={(suburb) => {
            loadColdSuburb(suburb.id);
            setActiveTab('profile');
          }} 
        />
        </Suspense>
      )}
      {activeTab === 'portfolio' && (
        <Suspense fallback={<div className="glass-card u-207f86dd">Loading portfolio...</div>}>
          <PortfolioTab suburbsData={suburbsData} />
        </Suspense>
      )}

      {activeTab === 'profile' && (
        <div className="main-grid">
          <aside className="sidebar glass-card">
            {loadingData ? (
              <div className="u-a4f43f78">
                Loading database...
              </div>
            ) : suburbsData.length === 0 ? (
              <div className="u-889dc3af">
                <div className="u-e21f7216">⚠️</div>
                <div className="u-e7df25b4">Data Unavailable</div>
                <div className="u-8d12c3c6">
                  No suburbs could be loaded from the API. Check that the backend is running and the database is populated.
                </div>
              </div>
            ) : (
              <>

                <div className="control-group">
                  <label className="control-label">State</label>
                  <div className="custom-select-wrapper">
                    <select className="premium-select u-350d646d" value={activeState} onChange={(e) => setActiveState(e.target.value)}>
                      <option value="">All areas</option>
                      {states.map(state => <option key={state} value={state}>{getStateName(state)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Suburb search combobox */}
                <div className="control-group">
                  <label className="control-label">Suburb</label>
                  <div className="suburb-search-wrap">
                    <input
                      className="suburb-search-input"
                      type="text"
                      placeholder={`Search ${stateSuburbs.length} suburbs or postcode…`}
                      value={suburbSearch}
                      onChange={e => { setSuburbSearch(e.target.value); setShowSuburbDropdown(true); }}
                      onFocus={() => setShowSuburbDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSuburbDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {suburbSearch ? (
                      <button className="suburb-search-clear" onMouseDown={() => { setSuburbSearch(''); }} title="Clear">✕</button>
                    ) : (
                      <span className="suburb-search-icon">🔍</span>
                    )}

                    {showSuburbDropdown && (
                      <div className="suburb-dropdown">
                        {groupedResults.length === 0 ? (
                          <div className="suburb-dropdown-empty">No suburbs match &ldquo;{suburbSearch}&rdquo;</div>
                        ) : (
                          groupedResults.map(([group, suburbs]) => (
                            <div key={group}>
                              <div className="suburb-dropdown-group-header">{group}</div>
                              {suburbs.map(suburb => {
                                const dq = (suburb as any).dqScore;
                                const yield_ = (suburb as any).houseGrossRentalYield;
                                const cbd = (suburb as any).cbdDistance;
                                const isSelected = activeSuburb?.id === suburb.id;
                                return (
                                  <div
                                    key={suburb.id}
                                    className={`suburb-dropdown-row${isSelected ? ' selected' : ''}`}
                                    onMouseDown={() => {
                                      setActiveSuburb(suburb);
                                      setSuburbSearch(suburb.name);
                                      setShowSuburbDropdown(false);
                                      manualSelectionRef.current = true;
                                      loadColdSuburb(suburb.id);
                                      trackActivity('VIEW_SUBURB', suburb.id);
                                    }}
                                  >
                                    <span className="suburb-dropdown-name">
                                      {suburb.name}
                                      <span className="u-54ec8b59">({suburb.postcode})</span>
                                      {(dq == null || dq < 70) && <span className="u-53f169b7" title="Data quality warning">⚠️</span>}
                                    </span>
                                    <span className="suburb-dropdown-meta">
                                      {yield_ ? `${yield_}% yield` : cbd ? `${cbd}km CBD` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Zone filter pills */}
                  {zonePills.length > 2 && (
                    <div className="zone-pills">
                      {zonePills.map(pill => (
                        <button
                          key={pill}
                          className={`zone-pill${activeZonePill === pill ? ' active' : ''}`}
                          onClick={() => { setActiveZonePill(pill); setSuburbSearch(''); setShowSuburbDropdown(false); }}
                        >
                          {pill === 'All' ? 'All areas' : pill.replace(/^[^\s]+\s*/, '')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>


            <div className="control-group u-e87e972e">
              <button 
                onClick={() => window.open(`/api/v3/export?state=${activeState}`, '_blank')}
                className="u-8de5ace3"
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(15,23,42,0.06)'}
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
                  <span className="preview-score-label">Momentum</span>
                </div>
                {(activeSuburb as any).cbdDistance && (
                  <p className="preview-text">
                    {`${(activeSuburb as any).cbdDistance} min to ${activeSuburb.metroCBD || 'CBD'}`}
                  </p>
                )}
                <div className="u-db408676">
                  {(activeSuburb as any).dqScore != null && (
                    <div className="u-0b9a8f0f">
                      <span className="u-c7477801">DQ</span>
                      <span className="u-e0cfe6f3" style={{color: (activeSuburb as any).dqScore >= 80 ? '#10b981' : (activeSuburb as any).dqScore >= 60 ? '#f59e0b' : '#ef4444'}}>{Math.round((activeSuburb as any).dqScore)}/100</span>
                    </div>
                  )}
                  {(activeSuburb as any).houseGrossRentalYield != null && (
                    <div className="u-0b9a8f0f">
                      <span className="u-c7477801">Yield</span>
                      <span className="u-e0cfe6f3">{(activeSuburb as any).houseGrossRentalYield}%</span>
                    </div>
                  )}
                  {(activeSuburb as any).houseDaysOnMarket != null && (
                    <div className="u-0b9a8f0f">
                      <span className="u-c7477801">DOM</span>
                      <span className="u-e0cfe6f3">{(activeSuburb as any).houseDaysOnMarket}d</span>
                    </div>
                  )}
                </div>
              </div>
                )}
              </>
            )}
          </aside>

          <main className="main-content">
            {activeSuburb ? (
              <div className="content-wrapper animate-fade-in key-wrap" key={activeSuburb.id}>
                <div className="glass-card" {...{ [SECTION_ATTR]: 'overview' }}>
                  <SuburbHero 
                    suburb={activeSuburb}
                    isSaved={activeSuburb && favorites.includes(activeSuburb.id)}
                    onToggleSave={() => activeSuburb && toggleFavorite(activeSuburb.id)}
                  />


                  {/* Evidence-backed highlights — split Strengths / Cautions */}
                  {(activeSuburb.highlights || []).length > 0 ? (
                    <div className="u-f78d8d69">
                      <h4 className="u-e4df4f18">Why consider {activeSuburb.name}?</h4>
                      <div className="u-6597c4ce">
                        {(activeSuburb.highlights || []).slice(0, 2).map((h, i) => (
                          <div key={i} className="u-e242cbbc">
                            <span className="u-74e4f6bb">✓</span>
                            <span>{h}</span>
                          </div>
                        ))}
                        {(activeSuburb.highlights || []).slice(2, 3).map((h, i) => (
                          <div key={i} className="u-11f4b57e">
                            <span className="u-6b3ea7b2">⚠</span>
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="u-f45b738e">
                      AI key drivers will appear here once analysis is complete.
                    </div>
                  )}

                  <div className="metrics-grid u-ff12444b">
                    <div className="metric-box u-f5f90c74">
                      <div className="metric-label u-112a0d0d">House Median Price</div>
                      <div className="metric-value u-da5d5cd3">
                        {(activeSuburb as any).houseMedianPrice ? `$${(activeSuburb as any).houseMedianPrice.toLocaleString()}` : <span className="u-28c62109">—</span>}
                        {(() => {
                          const change = Number((activeSuburb as any).houseMedianPrice12mChangePct) || 0;
                          if (change) {
                            return <span className="u-355bd10b" style={{color: change > 0 ? 'var(--success)' : 'var(--danger)'}}>{change > 0 ? '▲' : '▼'} {Math.abs(change)}%</span>
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="metric-box u-f5f90c74">
                      <div className="metric-label u-112a0d0d">Unit Median Price</div>
                      <div className="metric-value u-da5d5cd3">
                        {(activeSuburb as any).unitMedianPrice ? `$${(activeSuburb as any).unitMedianPrice.toLocaleString()}` : <span className="u-28c62109">—</span>}
                        {(() => {
                          const change = Number((activeSuburb as any).unitMedianPrice12mChangePct) || 0;
                          if (change) {
                            return <span className="u-355bd10b" style={{color: change > 0 ? 'var(--success)' : 'var(--danger)'}}>{change > 0 ? '▲' : '▼'} {Math.abs(change)}%</span>
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="metric-box u-f5f90c74">
                      <div className="metric-label u-112a0d0d">Avg Rental Yield</div>
                      <div className="metric-value u-8103896e">
                        {(activeSuburb as any).houseGrossRentalYield
                          ? `${(activeSuburb as any).houseGrossRentalYield}%`
                          : (activeSuburb as any).rentalYield
                          ? `${(activeSuburb as any).rentalYield}%`
                          : <span className="u-28c62109">—</span>}
                      </div>
                      {activeSuburb.vacancyRate != null && (
                        <div className="u-1e74caee">
                          Vacancy {Number(activeSuburb.vacancyRate).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    </div>



                    <ProfileSectionNav activePersona={persona} activeSection={activeProfileSection} onSectionChange={setActiveProfileSection} />

                   <div className="highlights-section u-e87e972e" style={{display: activeProfileSection === 'overview' ? 'block' : 'none'}} {...{ [SECTION_ATTR]: 'overview' }}>
                    
                    {/* Quick ROI Calculator — Promoted inside Overview tab */}

                    {persona !== 'first_home_buyer' && (
                      <Suspense fallback={<div className="u-66be495e">Loading ROI...</div>}>
                        <QuickRoiCalculator 
                          medianPrice={(activeSuburb as any).houseMedianPrice || 0} 
                          medianRent={(activeSuburb as any).houseMedianRent || (activeSuburb as any).weeklyRent || 0} 
                          state={(activeSuburb as any).state || "VIC"}
                          onAdvancedClick={() => setActiveTab('gearing')}
                        />
                      </Suspense>
                    )}



                    {/* Development Signal — surfaced for Overview visibility */}
                    {(() => {
                      const s = activeSuburb as any;
                      const subdiv = s.subdivisionPotential;
                      const approvedCount = s.approvedSubdivisions12m;
                      const minLot = s.minApprovedSubdivisionSqm;
                      const avgBlock = s.avgBlockSqm;
                      const hasDevData = subdiv || approvedCount > 0 || minLot || avgBlock;
                      if (!hasDevData) return null;
                      const potentialColor = subdiv === 'High' ? '#10b981' : subdiv === 'Medium' ? '#f59e0b' : 'var(--text-secondary)';
                      const potentialBg = subdiv === 'High' ? 'rgba(16,185,129,0.08)' : subdiv === 'Medium' ? 'rgba(245,158,11,0.08)' : 'rgba(15,23,42,0.015)';
                      return (
                        <div style={{
                          background: potentialBg, border: `1px solid ${subdiv === 'High' ? 'rgba(16,185,129,0.2)' : subdiv === 'Medium' ? 'rgba(245,158,11,0.2)' : 'var(--border-glass)'}`,
                          padding: '16px 20px', borderRadius: '12px',
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', alignItems: 'center'
                        }}>
                          <div>
                            <div className="u-bc4ee6cd">✂️ Subdivision Potential</div>
                            <div className="u-85958e43" style={{color: potentialColor}}>{subdiv || 'Unknown'}</div>
                          </div>
                          {approvedCount > 0 && (
                            <div>
                              <div className="u-bc4ee6cd">Approved (12mo)</div>
                              <div className="u-71368d1f">{approvedCount} <span className="u-192d3ffc">DAs</span></div>
                            </div>
                          )}
                          {minLot && (
                            <div>
                              <div className="u-bc4ee6cd">Min Lot Size</div>
                              <div className="u-9a063d22">{minLot} <span className="u-192d3ffc">sqm</span></div>
                            </div>
                          )}
                          {avgBlock && (
                            <div>
                              <div className="u-bc4ee6cd">Avg Block</div>
                              <div className="u-9a063d22">{avgBlock} <span className="u-192d3ffc">sqm</span></div>
                            </div>
                          )}
                          {minLot && avgBlock && avgBlock >= minLot * 2 && (
                            <div className="u-21575ba7">
                              💡 Avg block ({avgBlock} sqm) is ≥ 2× minimum lot ({minLot} sqm) — properties in this suburb may have subdivision potential
                            </div>
                          )}
                        </div>
                      );
                    })()}
                   </div>

                  {/* Decision Brief — compact evidence-backed summary */}
                  <div style={{ display: activeProfileSection === 'overview' ? 'block' : 'none' }}>
                    <DecisionBrief activeSuburb={activeSuburb} setActiveTab={setActiveTab} selectedResult={selectedBuyerFitResult} requestMeta={selectedRequestMeta} />
                    
                    {/* Score Legend — Moved to bottom of overview tab */}
                    <details className="u-8ff959d6">
                      <summary className="u-942b3663">
                        ℹ️ Understanding Our Scores
                      </summary>
                      <div className="u-7ce0ede0">
                        <ScoreLegendPanel growthFactors={((activeSuburb as any).growthFactorsLabeled) as GrowthFactorLabeled[] | undefined} />
                      </div>
                    </details>
                  </div>

                    <div style={{ display: activeProfileSection === 'market' ? 'block' : 'none' }}>
                      {/* Market Baselines — Moved to Market tab */}
                      {benchmarks && benchmarks.length > 0 && (
                        <div className="u-4b6cb09b">
                          <h4 className="u-304ebc1b">
                            📈 Market Baselines
                          </h4>
                          <p className="u-76c9b108">
                            Compare suburb growth against market benchmarks to identify genuine alpha.
                          </p>
                          <div className="profile-grid-auto u-df4e9190">
                            {benchmarks.map((bm, i) => (
                              <div key={i} style={{ 
                                padding: '12px', 
                                background: 'var(--bg-dark)', 
                                borderRadius: '8px',
                                borderLeft: `3px solid ${
                                  (Number(activeSuburb.houseMedianPrice12mChangePct) || 0) > bm.growth_1y_pct 
                                    ? 'var(--accent-cyan)' 
                                    : 'var(--warning)'
                                }`
                              }}>
                                <div className="u-6baf8a4c">{bm.symbol}</div>
                                <div className="u-240770f2">{bm.name}</div>
                                <div className="u-4b1cd156">
                                  <span className="u-fc193050">1Y Return</span>
                                  <span className="u-e506d4ee" style={{color: bm.growth_1y_pct >= 0 ? 'var(--success)' : 'var(--danger)'}}>
                                    {bm.growth_1y_pct >= 0 ? '+' : ''}{bm.growth_1y_pct}%
                                  </span>
                                </div>
                                <div className="u-6c2db771" style={{color: (Number(activeSuburb.houseMedianPrice12mChangePct) || 0) > bm.growth_1y_pct ? 'var(--accent-cyan)' : 'var(--warning)'}}>
                                  {(Number(activeSuburb.houseMedianPrice12mChangePct) || 0) > bm.growth_1y_pct ? '✓ Outperforming' : '↓ Underperforming'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <PriceHistoryChart history10yr={(activeSuburb as any).history10yr} historyRent10yr={(activeSuburb as any).historyRent10yr} />
                      <SqmHistoricalChart sqmData={(activeSuburb as any).demographicsDetailV3?.sqm_data} />
                    </div>

                    {/* Visuals Grid (Charts) */}
                    <details className="expandable-section u-df8a09d2" style={{display: activeProfileSection === 'market' ? 'block' : 'none'}}>
                      <summary className="u-b337f919">
                        📊 View Detailed Demographics & Charts
                      </summary>
                      <div className="u-791db4a4">
                        <div className="u-ce4f0a7b">
                          {/* Left Column */}
                      <div className="u-ce3bd1ca">
                        {/* House vs Unit bar chart */}
                        <div className="u-0f479549">
                          <h4 className="u-6427c277">Median Price: House vs Unit</h4>
                          <div className="u-23f9d4e9">
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
                          <div className="u-5e7d5a2d">
                            House: {activeSuburb.houseMedianPrice12mChangePct ? `${Number(activeSuburb.houseMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.houseMedianPrice12mChangePct).toFixed(2)}%` : '—'} | Unit: {activeSuburb.unitMedianPrice12mChangePct ? `${Number(activeSuburb.unitMedianPrice12mChangePct) > 0 ? '+' : ''}${Number(activeSuburb.unitMedianPrice12mChangePct).toFixed(2)}%` : '—'}
                          </div>
                        </div>

                        {/* Household Types */}
                        <div className="u-0f479549">
                          <h4 className="u-6427c277">Household Types</h4>
                          <div className="u-20f7f541">
                            {(() => {
                              const hhData = ((activeSuburb as any).demographicsDetailV3?.household_distribution) || {}
                              const total = Object.values(hhData).reduce((a:number,b:any) => a + Number(b), 0) || 1
                              return Object.entries(hhData).map(([k,v]) => (
                                <div key={k}>
                                  <div className="u-aa88afa9">
                                    <span className="u-c7477801">{k}</span>
                                    <span className="u-c154f6c6">{Number(v).toFixed(0)}%</span>
                                  </div>
                                  <div className="u-84787244">
                                    <div style={{ height: '100%', width: `${(Number(v)/total*100).toFixed(0)}%`, background: 'var(--accent-purple)', borderRadius: '4px' }} />
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="u-787001c0">
                        {/* Household Income Bands */}
                        <div className="u-d2756792">
                          <h4 className="u-6427c277">Household Income Bands</h4>
                          <div className="u-b999c49c">
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
                  <div className="highlights-section u-e87e972e">
                    <details className="u-6c1c1e50">
                      <summary className="u-a5fb4c99">
                        📊 Quick Reference
                      </summary>
                      <div className="u-832440d0">
                        <div className="u-0cb1fcb0">
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
                            { label:'Mortgage Band', value: (s as any).estimatedMortgageRepayment ? '$' + (s as any).estimatedMortgageRepayment.toLocaleString(undefined, {maximumFractionDigits: 0}) + '/mo' : ((s as any).typicalMortgageBand || '—'), icon:'💳' },
                            { label:'3yr Price Growth', value: yr3growth, icon:'📈' },
                            { label:'CBD Mins', value: (s as any).cbdDistance ? `${(s as any).cbdDistance} min` : '—', icon:'🚗' },
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
                          <div key={section.label} className="u-a9fc8628">
                            <div className="u-03a2fcc2">
                              {section.label}
                            </div>
                            {section.items.map((item) => (
                              <div key={item.label} className="u-85fc9968">
                                <span className="u-f3d28ad1">{item.icon} {item.label}</span>
                                <span className="u-e125b86d">
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        ])
                      })()}
                        </div>
                      </div>
                    </details>
                  </div>
                    {/* Bottom Row: Charts */}
                    <div className="u-8f5d5c7e">
                      {/* 10-Year Historical Chart */}
                      {activeSuburb.history && activeSuburb.history.length >= 2 && (
                        <div className="u-89b1b35e">
                          <h4 className="u-e65a1c30">10-Year Historical Median Price</h4>
                          <p className="u-dc5b9519">House median price tracking over time</p>
                          <div className="u-171e172a">
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
                  </div>
                  </details>

                   {/* NEW LIVABILITY SECTION */}
                   <div className="highlights-section u-e87e972e" style={{display: activeProfileSection === 'infrastructure' ? 'block' : 'none'}} {...{ [SECTION_ATTR]: 'infrastructure' }}>
                    
                    {/* NEW METRICS: Transit, NBN, Safety */}
                    <div className="metrics-grid u-19fd7aee">
                      <div className="metric-box" style={{ borderColor: ((activeSuburb as any).areaSqkm ?? 20) < 10 ? 'var(--success)' : 'var(--warning)' }}>
                        <div className="metric-label">Transit Score</div>
                        <div className="metric-value u-6e6177ef">
                          <span className="u-567aafdf">{((activeSuburb as any).areaSqkm ?? 20) < 10 ? "76/100" : "51/100"}</span>
                          <span className="u-4717078b" style={{color: ((activeSuburb as any).areaSqkm ?? 20) < 10 ? 'var(--success)' : 'var(--warning)'}}>
                            {((activeSuburb as any).areaSqkm ?? 20) < 10 ? "🟢 Good" : "🟡 Moderate"}
                          </span>
                        </div>
                      </div>
                      <div className="metric-box">
                        <div className="metric-label">Safety Rating</div>
                        <div className="metric-value">{((activeSuburb as any).houseMedianPrice ?? 0) > 800000 ? "🟢 High" : "🟡 Moderate"}</div>
                      </div>
                      <div className="metric-box">
                        <div className="metric-label">NBN Access</div>
                        <div className="metric-value">Fibre to Premises</div>
                      </div>
                    </div>

                    <div className="u-69f9d299">
                      <h3>Livability & Amenities</h3>
                      {livabilityData && (
                        <button
                          onClick={() => setShowAmenitiesOnMap(!showAmenitiesOnMap)}
                          className="u-32ffb623" style={{background: showAmenitiesOnMap ? 'var(--accent-cyan)' : 'var(--bg-glass)', color: showAmenitiesOnMap ? '#000' : 'var(--text-primary)'}}
                        >
                          {showAmenitiesOnMap ? 'Hide Amenities from Map' : 'Show Amenities on Map'}
                        </button>
                      )}
                    </div>
                    {loadingLivability && (
                      <div className="u-791db4a4">
                        <p className="u-c7477801">Scanning neighborhood via OpenStreetMap...</p>
                        <div className="metrics-grid u-127b72f0">
                          <div className="metric-box">
                            <div className="metric-label">Walkability Score</div>
                            <div className="metric-value u-c7477801">—</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Cafes & Dining</div>
                            <div className="metric-value u-c7477801">—</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Parks & Leisure</div>
                            <div className="metric-value u-c7477801">—</div>
                          </div>
                          <div className="metric-box">
                            <div className="metric-label">Transit Stops</div>
                            <div className="metric-value u-c7477801">—</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {livabilityData && !loadingLivability && (
                      <div className="u-791db4a4">
                        <div className="metrics-grid u-127b72f0">
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
                          <div className="u-8e545338">
                            <strong>Popular Spots: </strong>
                            <span className="u-2007e35f">
                              {livabilityData.cafes.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.cafes.length > 5 ? '...' : ''}
                            </span>
                          </div>
                        )}
                        {livabilityData.schools.length > 0 && (
                          <div className="u-8e545338">
                            <strong>Local Schools (OSM): </strong>
                            <span className="u-2007e35f">
                              {livabilityData.schools.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.schools.length > 5 ? '...' : ''}
                            </span>
                          </div>
                        )}
                        {livabilityData.train_stations.length > 0 && (
                          <div>
                            <strong>Local Train Stations: </strong>
                            <span className="u-2007e35f">
                              {livabilityData.train_stations.slice(0, 5).map(c => c.name).join(', ')}{livabilityData.train_stations.length > 5 ? '...' : ''}
                            </span>
                          </div>
                        )}
                      {/* School Catchment Links */}
                      <div className="u-9ab97fc2">
                        <h4 className="u-d30f9d05">🎓 Official School Catchment Zones</h4>
                        <p className="u-b6bdaa2d">Verify local public school enrolment eligibility directly via state government maps:</p>
                        <div className="u-47622ea7">
                          {activeSuburb.state === 'VIC' && <a href="https://www.findmyschool.vic.gov.au/" target="_blank" rel="noreferrer" className="u-1d8c43c5">VIC: FindMySchool →</a>}
                          {activeSuburb.state === 'NSW' && <a href="https://schoolfinder.education.nsw.gov.au/" target="_blank" rel="noreferrer" className="u-1d8c43c5">NSW: School Finder →</a>}
                          {activeSuburb.state === 'QLD' && <a href="https://www.qgso.qld.gov.au/maps/edmap/" target="_blank" rel="noreferrer" className="u-1d8c43c5">QLD: EdMap →</a>}
                          {activeSuburb.state === 'SA' && <a href="https://www.education.sa.gov.au/parents-and-families/enrol-school-or-preschool/find-a-school-zone-or-preschool-catchment-area" target="_blank" rel="noreferrer" className="u-1d8c43c5">SA: Location SA →</a>}
                          {activeSuburb.state === 'TAS' && <a href="https://www.decyp.tas.gov.au/learning/enrolment/" target="_blank" rel="noreferrer" className="u-1d8c43c5">TAS: DECYP Directory →</a>}
                          {['WA', 'NT', 'ACT'].includes(activeSuburb.state) && <span className="u-a23e1378">Check local education department for {activeSuburb.state} catchments.</span>}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>

                  {/* PANEL B: Demographics (People & Infrastructure) */}
                  <div className="highlights-section u-e87e972e" style={{display: (activeProfileSection === 'people' || activeProfileSection === 'infrastructure') ? 'block' : 'none'}} {...{ [SECTION_ATTR]: 'people' }}>
                    <h3 className="u-d5c2d613">{activeProfileSection === 'infrastructure' ? 'Infrastructure & Development' : 'Demographics & Lifestyle'}</h3>
                    <div className="u-8f5d5c7e">
                      <div className="u-a8211e4b" style={{display: activeProfileSection === 'people' ? 'block' : 'none'}}>
                        {(() => {
                          const ageData = ((activeSuburb as any).demographicsDetailV3?.age_distribution) || {};
                          const chartData = Object.entries(ageData)
                            .filter(([k,_]) => k !== '100+')
                            .map(([k,v]) => ({ name: k, value: Number(v) }));
                          return (
                            <ChartToggle
                              title="Age Distribution"
                              data={chartData.map(d => ({ label: d.name, value: `${d.value}%` }))}
                              colHeaders={['Age Group', 'Population']}
                              chart={
                                <ResponsiveContainer width="100%" height={200}>
                                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tick={{fill: 'var(--text-secondary)'}} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickFormatter={(val) => `${val}%`} />
                                    <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Population']} contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '8px' }} />
                                    <Bar dataKey="value" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              }
                            />
                          );
                        })()}
                      </div>
                      <div className="u-d33bbd39" style={{display: activeProfileSection === 'people' ? 'block' : 'none'}}>
                        <h4 className="u-18ca3e6b">Owner vs Renter Ratio</h4>
                        <div className="u-23f9d4e9">
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
                        <div className="u-6d1d1585">
                          <span className="u-6d81fac3">Owner: {(activeSuburb.ownerOccupierRate || 65.5).toFixed(2)}%</span>
                          <span className="u-d03afae3">Renter: {(100 - (activeSuburb.ownerOccupierRate || 65.5)).toFixed(2)}%</span>
                        </div>
                      </div>
                      <div className="u-d33bbd39" style={{display: activeProfileSection === 'people' ? 'block' : 'none'}}>
                        <h4 className="u-18ca3e6b">Macro Indicators (ABS)</h4>
                        <div className="u-b38fc809">
                          <div>
                            <div className="u-154d8356">Unemployment Rate</div>
                            <div className="u-a15536a6">
                              {activeSuburb.unemploymentRate ? `${activeSuburb.unemploymentRate}%` : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="u-154d8356">Building Approvals (12m)</div>
                            <div className="u-eb76efc5">
                              {activeSuburb.buildingApprovals12m ? activeSuburb.buildingApprovals12m.toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="u-154d8356">Major Infrastructure</div>
                            <div className="u-2d5606dc">
                              {activeSuburb.infrastructureInvestment || 'No major projects identified'}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* 🏛️ Social Infrastructure */}
                      <div className="u-d33bbd39" style={{display: activeProfileSection === 'infrastructure' ? 'block' : 'none'}}>
                        <h4 className="u-18ca3e6b">🏛️ Social Infrastructure</h4>
                        <div className="u-2c6ef56c">
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
                              return <span className="u-2d8e228c">No data</span>
                            return (
                              <>
                                {worshipTotal > 0 && (
                                  <div className="u-e50f284b">
                                    <div className="u-586d8158">
                                      ⛪ Places of Worship ({worshipTotal})
                                    </div>
                                    <div className="u-e49a63a8">
                                      {religions.map(r => (
                                        <div key={r.label} title={`${r.label}: ${r.val}`}
                                          className="u-40f7d2c4" style={{flex: r.val, backgroundColor: r.color}} />
                                      ))}
                                    </div>
                                    <div className="u-b58c553f">
                                      {religions.map(r => (
                                        <span key={r.label} className="u-c0024dfb" style={{color: r.color}}>
                                          {r.label} {r.val}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {social.map(item => (
                                  <div key={item.label} className="u-69f9d299">
                                    <span className="u-f3d28ad1">{item.icon} {item.label}</span>
                                    <span className="u-e8ad2fda">{item.value}</span>
                                  </div>
                                ))}
                                {(s.socialHousingPct != null && s.socialHousingPct > 0) && (
                                  <div className="u-e6f5fceb">
                                    <div className="u-69f9d299">
                                      <span className="u-f3d28ad1">🏘️ Social Housing</span>
                                      <span className="u-cc8325c1" style={{color: s.socialHousingPct > 10 ? '#ef4444' : 'var(--text-primary)'}}>
                                        {s.socialHousingPct.toFixed(1)}%
                                      </span>
                                    </div>
                                    {s.publicHousingDwellings != null && (
                                      <div className="u-0f5cef51">
                                        {s.publicHousingDwellings} public · {s.communityHousingDwellings || 0} community
                                      </div>
                                    )}
                                    {s.absG37Sourced && (
                                      <div className="u-b9b8cd02">✓ ABS Census</div>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      {/* 🏗️ Development & Subdivision Dashboard — Enhanced */}
                      <div className="u-dda6ee83" style={{display: activeProfileSection === 'infrastructure' ? 'block' : 'none'}}>
                        <h4 className="u-434f4d7d">🏗️ Development & Subdivision Dashboard</h4>
                        <div className="u-46eb6c82">
                          {(() => {
                            const s = activeSuburb as any
                            const constr = s.constructionSqkm || 0
                            const green = s.greenfieldSqkm || 0
                            const brown = s.brownfieldSqkm || 0
                            const total = constr + green + brown
                            const bldCount = s.buildingConstructionCount
                            const bldApprovals = s.buildingApprovals12m
                            const subdiv = s.subdivisionPotential || 'Low'
                            const minLot = s.minApprovedSubdivisionSqm
                            const avgBlock = s.avgBlockSqm
                            const approvedCount = s.approvedSubdivisions12m || 0

                            // Subdivision potential gauge
                            const potentialPct = subdiv === 'High' ? 90 : subdiv === 'Medium' ? 55 : 20
                            const potentialColor = subdiv === 'High' ? '#10b981' : subdiv === 'Medium' ? '#f59e0b' : '#64748b'
                            const potentialBg = subdiv === 'High' ? 'rgba(16,185,129,0.1)' : subdiv === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)'
                            
                            return (
                              <>
                                {/* Subdivision Potential Gauge */}
                                <div style={{ background: potentialBg, border: `1px solid ${potentialColor}33`, padding: '14px', borderRadius: '10px' }}>
                                  <div className="u-85844839">
                                    <span className="u-11056260">✂️ Subdivision Potential</span>
                                    <span className="u-0c4c20bd" style={{color: potentialColor}}>{subdiv}</span>
                                  </div>
                                  <div className="u-4de68730">
                                    <div style={{ width: `${potentialPct}%`, height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${potentialColor}88, ${potentialColor})`, transition: 'width 0.5s ease' }} />
                                  </div>
                                </div>

                                {/* DA Precedent & Approvals */}
                                <div className="u-ae7865f2" style={{gridTemplateColumns: minLot ? '1fr 1fr' : '1fr'}}>
                                  <div className="u-c64713d4">
                                    <div className="u-4101d4bb">Approved DAs (12mo)</div>
                                    <div className="u-febb6665" style={{color: approvedCount > 0 ? '#10b981' : 'var(--text-secondary)'}}>
                                      {approvedCount > 0 ? approvedCount : '—'}
                                    </div>
                                    <div className="u-0f5cef51">
                                      {approvedCount > 0 ? 'subdivisions' : 'no data'}
                                    </div>
                                  </div>
                                  {minLot && (
                                    <div className="u-c64713d4">
                                      <div className="u-4101d4bb">Min Lot Size</div>
                                      <div className="u-08e5312b">
                                        {minLot}<span className="u-18bf9285"> sqm</span>
                                      </div>
                                      <div className="u-4d170586" style={{color: approvedCount > 0 ? '#10b981' : '#f59e0b'}}>
                                        {approvedCount > 0 ? '✓ real precedent' : 'proxy estimate'}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Lot Size Comparison Bar */}
                                {minLot && avgBlock && (
                                  <div className="u-55f14def">
                                    <div className="u-45fc650f">
                                      📐 Lot Size Comparison
                                    </div>
                                    <div className="u-6597c4ce">
                                      {/* Min lot bar */}
                                      <div>
                                        <div className="u-a59fdd48">
                                          <span className="u-c7477801">Min Approved Lot</span>
                                          <span className="u-e0cfe6f3">{minLot} sqm</span>
                                        </div>
                                        <div className="u-1f2d01a9">
                                          <div style={{ width: `${Math.min((minLot / Math.max(avgBlock, minLot)) * 100, 100)}%`, height: '100%', borderRadius: '5px', background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
                                        </div>
                                      </div>
                                      {/* Avg block bar */}
                                      <div>
                                        <div className="u-a59fdd48">
                                          <span className="u-c7477801">Avg Block Size</span>
                                          <span className="u-e0cfe6f3">{avgBlock} sqm</span>
                                        </div>
                                        <div className="u-1f2d01a9">
                                          <div className="u-c3407319" />
                                        </div>
                                      </div>
                                    </div>
                                    {avgBlock >= minLot * 2 && (
                                      <div className="u-857f2895">
                                        💡 Avg block is {(avgBlock / minLot).toFixed(1)}× the minimum lot — high subdivision feasibility
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Building Approvals */}
                                {bldApprovals != null && (
                                  <div className="u-cc72d3ab">
                                    <span className="u-f3d28ad1">🏗️ Building Approvals (12mo)</span>
                                    <span className="u-b6872c2a" style={{color: bldApprovals > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)'}}>{bldApprovals}</span>
                                  </div>
                                )}
                                  
                                {total === 0 && bldCount == null && !minLot && !avgBlock && (
                                  <span className="u-c4f34b4b">No development data available for this suburb</span>
                                )}
                                  
                                {total > 0 && (
                                  <div className="u-55f14def">
                                    <div className="u-a3f91f62">
                                      🗺️ Land Use Within 2.5km ({total.toFixed(3)} km²)
                                    </div>
                                    <div className="u-b7a1de0b">
                                      {constr > 0 && <div title={`Construction: ${constr.toFixed(3)} km²`} className="u-908acfd2" style={{flex: constr}} />}
                                      {brown > 0 && <div title={`Brownfield: ${brown.toFixed(3)} km²`} className="u-7e922fad" style={{flex: brown}} />}
                                      {green > 0 && <div title={`Greenfield: ${green.toFixed(3)} km²`} className="u-f45953b3" style={{flex: green}} />}
                                    </div>
                                    <div className="u-dcda70d0">
                                      {constr > 0 && <span className="u-bfead528">🔴 Construction {constr.toFixed(3)} km²</span>}
                                      {brown > 0 && <span className="u-0ce679a0">🟡 Brownfield {brown.toFixed(3)} km²</span>}
                                      {green > 0 && <span className="u-b5e3c3ba">🟢 Greenfield {green.toFixed(3)} km²</span>}
                                    </div>
                                  </div>
                                )}
                                {bldCount != null && bldCount > 0 && (
                                  <div className="u-cc72d3ab">
                                    <span className="u-f3d28ad1">🔨 Buildings Under Construction</span>
                                    <span className="u-78377f03">{bldCount}</span>
                                  </div>
                                )}
                                {bldCount != null && bldCount === 0 && total > 0 && (
                                  <div className="u-8d08922a">
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

                  {/* PANEL C: Live Listings Feed & Development Potential */}
                  <div className="highlights-section u-e87e972e" style={{display: activeProfileSection === 'listings' ? 'block' : 'none'}} {...{ [SECTION_ATTR]: 'listings' }}>
                    <h3 className="u-d5c2d613">Evidence Feed & Development Potential</h3>
                    <div className="u-8f5d5c7e">
                      <div className="u-c34a8700">
                        <h4 className="u-2a460efc">💰 Recent Comparable Sales</h4>
                        {activeSuburb && (activeSuburb as any).salesSummary && ((activeSuburb as any).salesSummary as any[]).length > 0 ? (
                          ((activeSuburb as any).salesSummary as any[]).map((s: any, i: number) => (
                            <div key={i} className="u-7e3191b4">
                              <div>
                                <div className="u-2bdaffa6">{s.address || `Comparable Sale ${i+1}`}</div>
                                <div className="u-fa681d48">
                                  {s.beds ? `${s.beds} Bed` : ''}{s.baths ? ` / ${s.baths} Bath` : ''}{s.type ? ` • ${s.type}` : ''} 
                                  <span className="u-daf545a8">|</span> 
                                  Sold {s.saleDate || 'Recently'}
                                </div>
                              </div>
                              <div className="u-d7c4af4d">
                                {s.salePrice ? `$${s.salePrice.toLocaleString()}` : 'Price N/A'}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="u-8d12c3c6">No recent sales evidence available in database</div>
                        )}
                      </div>
                      <div className="u-0f1ccee2">
                        <div className="u-cb89a99b">
                          <h4 className="u-5086da32">🏷️ Market Inventory</h4>
                          <div className="u-f3b30b0d">
                            <div>For Sale (Est.): <strong className="u-c154f6c6">{((activeSuburb as any).house?.stockOnMarket) || ((activeSuburb as any).houseStockOnMarket) || '—'}</strong></div>
                            <div>Sold (12m): <strong className="u-c154f6c6">{((activeSuburb as any).house?.sold12m)?.toLocaleString() || ((activeSuburb as any).houseSold12m)?.toLocaleString() || '—'}</strong></div>
                            <div>Supply/Demand: <strong className="u-c154f6c6">{((activeSuburb as any).market?.supplyDemandRatio)?.toFixed(2) || ((activeSuburb as any).supplyDemandRatio)?.toFixed(2) || '—'}</strong></div>
                          </div>
                        </div>
                        <div className="u-cb89a99b">
                          <h4 className="u-11046430">🏗️ Development & Social Context</h4>
                          <div className="u-f3b30b0d">
                            <div>Social Housing Density: <strong className="u-c154f6c6">{((activeSuburb as any).demographics?.socialHousingPct) !== undefined ? `${((activeSuburb as any).demographics?.socialHousingPct)}%` : '—'}</strong></div>
                            <div>Public Housing Dwellings: <strong className="u-c154f6c6">{((activeSuburb as any).demographics?.publicHousingDwellings) !== undefined ? ((activeSuburb as any).demographics?.publicHousingDwellings)?.toLocaleString() : '—'}</strong></div>
                            <hr className="u-903c557c" />
                            <div>Approved Subdivisions (12m): <strong className="u-c154f6c6">{((activeSuburb as any).market?.approvedSubdivisions12m) !== undefined ? ((activeSuburb as any).market?.approvedSubdivisions12m) : '—'}</strong></div>
                            <div>Min Lot Size for Subdivision: <strong className="u-c154f6c6">{((activeSuburb as any).market?.minApprovedSubdivisionSqm) ? `${((activeSuburb as any).market?.minApprovedSubdivisionSqm)} sqm` : '—'}</strong></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PANEL D: AI Insights — News Sentiment + Investment Committee */}
                  <div className="u-e87e972e" style={{display: activeProfileSection === 'ai' ? 'block' : 'none'}}>
                    <h3 className="u-6f328805">🧠 AI Committee (Debate & Sentiment)</h3>
                    <div className="u-3e72e63f" id="ai-insight-panel" {...{ [SECTION_ATTR]: 'ai' }}>
                      <AIInsightPanel
                        activeSuburb={activeSuburb}
                        setActiveSuburb={setActiveSuburb}
                      />
                    </div>
                  </div>

                  {/* K-Means Clustering: Similar Suburbs */}
                  <div className="u-e87e972e" style={{display: activeProfileSection === 'pockets' ? 'block' : 'none'}}>
                    <div className="u-7d62c6a4">
                      <h4 className="u-e1346169">🔍 Find Similar Suburbs (K-Means Clustering)</h4>
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
                        className="u-953a2ec0"
                      >
                        {isClustering ? 'Clustering...' : 'Find Similar'}
                      </button>
                    </div>
                    {clusteringResults && clusteringResults.length > 0 ? (
                      <div className="u-e9243ed9">
                        {clusteringResults.map((s: any, i: number) => (
                          <div key={i} className="u-94a2bdf2">
                            <div className="u-0fc8282b">{s.suburb}, {s.state}</div>
                            <div className="u-a23e1378">{s.postcode}</div>
                            <div className="u-7cf1b7ff">
                              <span>🏷️ ${Math.round(s.price).toLocaleString()}</span>
                              <span className="u-d03afae3">{s.similarity}% match</span>
                            </div>
                            <div className="u-63071edf">
                              ICSEA {s.icsea} • Yield {s.yield}%
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : clusteringResults === null ? null : (
                      <div className="u-f8b8db12">
                        No similar cheaper suburbs found in this cluster.
                      </div>
                    )}
                  </div>

                   {/* INVESTMENT CATALYSTS — moved below AI Committee */}
                   <div className="highlights-section u-e87e972e" style={{display: activeProfileSection === 'risk' ? 'block' : 'none'}} {...{ [SECTION_ATTR]: 'risk' }}>
                     <h3 className="u-d5c2d613">Investment Catalysts</h3>
                     <ul className="highlights-list">
                       {activeSuburb.highlights && activeSuburb.highlights.length > 0 && !activeSuburb.highlights.every((h: string) => h.includes('N/A') || h.includes('Data Unavailable') || h.includes('generated') || h.includes('Pending')) ? (
                         activeSuburb.highlights
                           .filter((h: string) => !h.includes('N/A') && !h.includes('Data Unavailable') && !h.includes('generated') && !h.includes('Pending'))
                           .map((highlight: string, index: number) => (
                             <li key={index}>{highlight}</li>
                           ))
                       ) : (
                         <li className="u-05cf9b90">Run AI Committee above to generate investment catalysts for this suburb.</li>
                       )}
                     </ul>
                   </div>

                  {(!activeSuburb.schools || activeSuburb.schools.length === 0) && (!activeSuburb.pois || activeSuburb.pois.length === 0) && (
                    <div className="no-data-banner">
                      <p>Limited data available for this suburb. Core metrics are estimated from market trends. School zones, POIs, and historical data are being collected.</p>
                    </div>
                  )}

                  {activeSuburb.schools && activeSuburb.schools.length > 0 && (
                    <div className="schools-section u-e87e972e" style={{display: activeProfileSection === 'infrastructure' ? 'block' : 'none'}}>
                      {/* 5. School Summary Banner */}
                      <div className="u-0c36bba7">
                        <div>
                          <h4 className="u-9832b3c8">
                            {activeSuburb.schools?.length || 0} Schools in {activeSuburb.name}
                          </h4>
                          <div className="u-1b947f92">
                            Top-ranking school: {[...activeSuburb.schools].sort((a,b)=>((b as any).icsea||0)-((a as any).icsea||0))[0]?.name || 'N/A'}
                          </div>
                        </div>
                        <div className="u-f66ceb1f">
                          <div className="u-c9785778">
                            {(() => {
                              const avgIcsea = activeSuburb.schools!.reduce((acc,s)=>acc+((s as any).icsea||0),0) / (activeSuburb.schools!.length || 1);
                              return avgIcsea > 1100 ? 'A+ | Top 10%' : avgIcsea > 1050 ? 'A | Top 25%' : avgIcsea > 1000 ? 'B+ | Above Avg' : 'B | Average';
                            })()}
                          </div>
                          <div className="u-a23e1378">Suburb Average (ICSEA)</div>
                        </div>
                      </div>
                      {((() => {
                        const primaries = activeSuburb.schools!.filter(s => ['primary', 'combined'].includes(s.type.toLowerCase()));
                        const secondaries = activeSuburb.schools!.filter(s => ['secondary', 'combined'].includes(s.type.toLowerCase()));
                        return (
                          <>
                            {primaries.length > 0 && (
                              <div className="school-table-group">
                                <h3 
                                  onClick={() => setShowPrimarySchools(!showPrimarySchools)}
                                  className="u-398ade49"
                                >
                                  <span>🏫 Primary Schools ({primaries.length})</span>
                                  <span className="u-c0024dfb">{showPrimarySchools ? '▲ Hide' : '▼ Show'}</span>
                                </h3>
                                {showPrimarySchools && (
                                  <div className="table-responsive u-66b0f03a">
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
                                            <td className="school-name-cell" data-label="School">{school.name}</td>
                                            <td data-label="Type"><span className="type-badge type-primary">Primary</span></td>
                                            <td data-label="State Rank">#{school.stateRank}</td>
                                            <td data-label="Score">
                                              <div className="score-bar-wrapper">
                                                <div className="score-bar-bg"><div className="score-bar-fill" style={{ width: `${school.score}%`, background: school.score >= 90 ? 'var(--success)' : school.score >= 80 ? 'var(--accent-cyan)' : 'var(--warning)' }}></div></div>
                                                <span>{school.score}/100 <span className="u-abd7f7c4">(Est.)</span></span>
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
                              <div className="school-table-group u-791db4a4">
                                <h3 
                                  onClick={() => setShowSecondarySchools(!showSecondarySchools)}
                                  className="u-398ade49"
                                >
                                  <span>🎓 Secondary Schools ({secondaries.length})</span>
                                  <span className="u-c0024dfb">{showSecondarySchools ? '▲ Hide' : '▼ Show'}</span>
                                </h3>
                                {showSecondarySchools && (
                                  <div className="table-responsive u-66b0f03a">
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
                                            <td className="school-name-cell" data-label="School">{school.name}</td>
                                            <td data-label="Type">
                                              <span className={`type-badge type-${school.type.toLowerCase()}`}>
                                                {school.type}
                                              </span>
                                            </td>
                                            <td data-label="State Rank">#{school.stateRank}</td>
                                            <td data-label="Score">
                                              <div className="score-bar-wrapper">
                                                <div className="score-bar-bg"><div className="score-bar-fill" style={{ width: `${school.score}%`, background: school.score >= 90 ? 'var(--success)' : school.score >= 80 ? 'var(--accent-cyan)' : 'var(--warning)' }}></div></div>
                                                <span>{school.score}/100 <span className="u-abd7f7c4">(Est.)</span></span>
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
                  {persona !== 'first_home_buyer' && (
                    <>
                      <MarketIndicatorsSection suburb={activeSuburb as any} />
                      <MacroBenchmarkPanel />
                    </>
                  )}
                </div>
                <div style={{ display: activeProfileSection === 'market_pulse' ? 'block' : 'none' }}>
                  <SqmDashboard suburbId={activeSuburb.id} />
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
      <footer className="u-864cf9fe">
        <p><strong>Legal Disclaimer:</strong> The information provided on this platform is for general informational purposes only and does not constitute financial, investment, or real estate advice. Forecasts are statistical models based on historical data and do not guarantee future performance.</p>
        <p className="u-66b0f03a"><strong>State Data Attributions:</strong> 
          (NSW) Contains property sales information provided under licence from the Valuer General NSW. 
          (VIC) The State of Victoria owns the copyright in the Property Sales Data and reproduction without consent will constitute a breach of the Copyright Act 1968 (Cth). 
          (QLD) Based on or contains data provided by the State of Queensland (Department of Resources).
        </p>
      </footer>
    </AppShell>
  )
}

export default App
