/**
 * AIInsightPanel.tsx — Unified AI analysis panel with two tabs:
 *   News Sentiment: live media analysis (0-10 score)
 *   Investment Committee: multi-agent BUY/HOLD/PASS verdict
 */
import { useState } from 'react'
import type { SuburbData } from '../data/suburbs'

type AnalysisTab = 'sentiment' | 'committee' | 'antimarket'
type AnalysisStep = 'idle' | 'fetchNews' | 'bull' | 'bear' | 'urban' | 'final'

interface AIInsightPanelProps {
  activeSuburb: SuburbData
  setActiveSuburb: React.Dispatch<React.SetStateAction<SuburbData | null>>
}

export default function AIInsightPanel({ activeSuburb, setActiveSuburb }: AIInsightPanelProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('sentiment')
  const [isAnalyzingNews, setIsAnalyzingNews] = useState(false)
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
  const [isLoadingAntiMarket, setIsLoadingAntiMarket] = useState(false)
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [aiDisabled, setAiDisabled] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const [whatIfRate, setWhatIfRate] = useState(6.2)
  const [whatIfYield, setWhatIfYield] = useState(4.0)
  const [whatIfVacancy, setWhatIfVacancy] = useState(3.0)
  const [whatIfLoading, setWhatIfLoading] = useState(false)
  const [whatIfResult, setWhatIfResult] = useState<any>(null)

  const stepMessages: Record<AnalysisStep, string> = {
    idle: '',
    fetchNews: 'Fetching latest news articles...',
    bull: 'Running Bull analysis...',
    bear: 'Running Bear analysis...',
    urban: 'Running Urban Planner analysis...',
    final: 'Compiling final verdict and playbook...',
  }

  const handleWhatIf = async () => {
    if (whatIfLoading) return
    setWhatIfLoading(true)
    setError(null)
    try {
      const price = (activeSuburb as any).houseMedianPrice || 800000
      const params = new URLSearchParams({
        price: String(price),
        rate: String(whatIfRate),
        yield_val: String(whatIfYield),
        vacancy: String(whatIfVacancy),
        growth_score: String(activeSuburb.growthScore || 50),
      })
      const res = await fetch(`/api/risk/what-if?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWhatIfResult(data)
      } else {
        throw new Error(`Server error (${res.status})`)
      }
    } catch (e: any) {
      setError(e.message || 'What-if simulation failed')
    } finally {
      setWhatIfLoading(false)
    }
  }

  const handleSentiment = async () => {
    if (isAnalyzingNews) return
    setIsAnalyzingNews(true)
    setError(null)
    setAiDisabled(false)
    try {
      const isRefresh = hasSentiment;
      const url = isRefresh
        ? `/api/suburbs/${activeSuburb.id}/news-sentiment?force_refresh=true`
        : `/api/suburbs/${activeSuburb.id}/news-sentiment`;
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        if (res.status === 503) { setAiDisabled(true); throw new Error('AI insights temporarily disabled') }
        throw new Error(`Server error (${res.status})`)
      }
      const data = await res.json()
      const sentimentLabel = data.label || (data.score >= 7 ? 'Bullish' : data.score >= 4 ? 'Neutral' : 'Bearish')
      setActiveSuburb((prev: any) => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          aiNewsSentiment: `${sentimentLabel} (${data.score}/10)`,
          aiNewsSummary: data.summary || `${data.articles || 0} articles analyzed`,
          _newsScore: data.score,
          _newsLabel: sentimentLabel,
          _newsArticles: data.articles || [],
          _newsExplanation: data.explanation || [],
          _macroIntelligence: data.macro_intelligence || null,
        },
      }))
    } catch (e: any) {
      setError(e.message || 'News analysis failed')
      setActiveSuburb((prev: any) => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          aiNewsSentiment: 'Error',
          aiNewsSummary: e.message || 'Network error. Check connection.',
        },
      }))
    } finally {
      setIsAnalyzingNews(false)
    }
  }

  const handleCommittee = async () => {
    if (isAnalyzingAI) return
    setIsAnalyzingAI(true)
    setError(null)
    setAiDisabled(false)

    const steps: AnalysisStep[] = ['fetchNews', 'bull', 'bear', 'urban', 'final']
    let stepIndex = 0
    const stepTimer = setInterval(() => {
      if (stepIndex < steps.length) {
        setAnalysisStep(steps[stepIndex])
        stepIndex++
      }
    }, 2000)

    try {
      const res = await fetch('/api/analyze-suburb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suburb: activeSuburb.name, state: activeSuburb.state, id: activeSuburb.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 503) { setAiDisabled(true); throw new Error('AI insights temporarily disabled') }
        throw new Error(`Server error (${res.status})`)
      }
      if (data.status === 'success' && data.result && data.result.verdict) {
        const sentiment = data.result.verdict.includes('BUY') ? 'Bullish'
          : data.result.verdict.includes('HOLD') ? 'Neutral'
          : data.result.verdict.includes('SELL') ? 'Bearish'
          : data.result.verdict
        const aiResult = {
          aiVerdict: data.result.verdict,
          aiConsensus: data.result.playbook,
          aiRiskLevel: data.result.reality_check,
          aiBullView: data.result.bull,
          aiBearView: data.result.bear,
          aiUrbanView: data.result.urban,
          highlights: data.result.catalysts || activeSuburb.highlights,
          _sourceSnippets: data.result.source_snippets || [],
          _riskAssessment: data.result.risk_assessment || null,
          _policyWarnings: data.result.policy_warnings || [],
          metrics: {
            ...activeSuburb.metrics,
            aiNewsSentiment: sentiment,
            aiNewsSummary: data.result.playbook || data.result.reality_check || '',
          },
        }
        setActiveSuburb((prev: any) => ({ ...prev, ...aiResult }))
        try { localStorage.setItem('ai_' + activeSuburb.id, JSON.stringify(aiResult)) } catch {}
      }
      setAnalysisStep('idle')
    } catch (e: any) {
      setError(e.message || 'Committee analysis failed')
      setAnalysisStep('idle')
    } finally {
      clearInterval(stepTimer)
      setIsAnalyzingAI(false)
    }
  }

  const handleAntiMarket = async () => {
    if (isLoadingAntiMarket) return
    setIsLoadingAntiMarket(true)
    setError(null)
    try {
      const res = await fetch(`/api/suburbs/${activeSuburb.id}/anti-market`)
      if (!res || typeof res.json !== 'function') return
      if (!res.ok) {
        throw new Error(`Server error (${res.status})`)
      }
      const data = await res.json()
      setActiveSuburb((prev: any) => ({
        ...prev,
        _antiMarketData: data,
        metrics: {
          ...prev?.metrics,
          _macroIntelligence: data.macro_intelligence || prev?.metrics?._macroIntelligence || null,
        },
      }))
    } catch (e: any) {
      setError(e.message || 'Anti-market analysis failed')
    } finally {
      setIsLoadingAntiMarket(false)
    }
  }

  const suburb = activeSuburb as any
  const newsScore = suburb.metrics?._newsScore
  const macroIntel = suburb.metrics?._macroIntelligence || suburb._antiMarketData?.macro_intelligence || null
  const antiMarketData = suburb._antiMarketData || null
  const hasSentiment = suburb.metrics?.aiNewsSentiment && !['Click "Analyze Live News"', 'Error', 'Unavailable'].includes(suburb.metrics.aiNewsSentiment)
  const hasVerdict = !!suburb.aiVerdict

  return (
    <div className="glass-card u-330b0d34">
      {/* Decorative gradient orb for AI feel */}
      <div className="u-db5288b0" />
      
      <div className="u-9d364016">
        <h3 className="u-6b179248">
          <span title="AI-powered analysis of market sentiment and investment potential">✨ AI Insights</span>
        </h3>
        <div className="u-ac734d21">
          <button
            onClick={() => setActiveTab('sentiment')}
            className="u-4f776c24" style={{background: activeTab === 'sentiment' ? 'var(--accent-cyan)' : 'var(--bg-glass)', color: activeTab === 'sentiment' ? '#000' : 'var(--text-primary)', fontWeight: activeTab === 'sentiment' ? 'bold' : 'normal'}}
            title="News-based market sentiment score (0-10) & 5-axis macro intelligence"
          >
            📰 News Sentiment
          </button>
          <button
            onClick={() => setActiveTab('committee')}
            className="u-4f776c24" style={{background: activeTab === 'committee' ? 'var(--accent-purple)' : 'var(--bg-glass)', color: activeTab === 'committee' ? '#fff' : 'var(--text-primary)', fontWeight: activeTab === 'committee' ? 'bold' : 'normal'}}
            title="Multi-agent investment committee (Bull/Bear/Urban Planner)"
          >
            🏛️ Committee
          </button>
          <button
            onClick={() => setActiveTab('antimarket')}
            className="u-4f776c24" style={{background: activeTab === 'antimarket' ? '#10b981' : 'var(--bg-glass)', color: activeTab === 'antimarket' ? '#000' : 'var(--text-primary)', fontWeight: activeTab === 'antimarket' ? 'bold' : 'normal'}}
            title="Counter-cyclical resilience, Buyer's Agent due diligence check & anti-market alternatives"
          >
            🛡️ Anti-Market
          </button>
        </div>
      </div>

      {error && (
        <div className="u-ae550027">
          <span>⚠ {error}</span>
          <button
            onClick={() => setError(null)}
            className="u-3aec070c"
          >
            ✕
          </button>
        </div>
      )}

      {aiDisabled && (
        <div className="u-433be8e1">
          <div className="u-70c8c981">🔧</div>
          <div className="u-5a43b74e">AI Insights Temporarily Unavailable</div>
          <div className="u-8d12c3c6">
            The AI engine is undergoing maintenance. Cached results (shown below if available) may be up to 10 minutes old.
          </div>
          <button 
            onClick={() => activeTab === 'sentiment' ? handleSentiment() : handleCommittee()} 
            className="u-35ba7bb0">
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading spinner with step messages */}
      {((isAnalyzingAI && analysisStep !== 'idle') || isAnalyzingNews) && (
        <div className="u-13741b25">
          <div className="u-5d180d25" />
          <div className="u-336d1c8d">
            {isAnalyzingNews ? 'Fetching news and analyzing sentiment...' : stepMessages[analysisStep]}
          </div>
        </div>
      )}

      {/* News Sentiment Tab */}
      {activeTab === 'sentiment' && (
        <div className="u-88cefd40">
          <div className="u-2a64d94f">
            <div>
              <span className="u-a8922ee9">Market Sentiment Score</span>
              <span title="0-10 score derived from live news media. ≥7 Bullish, 4-6 Neutral, <4 Bearish. Uses AI transformer for accuracy with keyword fallback." className="u-9b96534b">ⓘ</span>
            </div>
            <button
              disabled={isAnalyzingNews}
              onClick={handleSentiment}
              className="u-93cbfad3" style={{background: isAnalyzingNews ? 'var(--bg-glass)' : 'var(--accent-cyan)', color: isAnalyzingNews ? 'var(--text-secondary)' : '#000', cursor: isAnalyzingNews ? 'not-allowed' : 'pointer'}}
            >
              {isAnalyzingNews ? 'Analyzing...' : hasSentiment ? 'Refresh Sentiment' : 'Analyze Live News'}
            </button>
          </div>

          <div className="u-ebf3e731">
            <div className="u-ff49b83f" style={{color: newsScore >= 7 ? '#10b981' : newsScore >= 4 ? 'var(--accent-cyan)' : '#ef4444'}}>
              {hasSentiment ? `${newsScore}/10` : '—'}
            </div>
            <div>
              <div className="u-8092f1b8" style={{color: newsScore >= 7 ? '#10b981' : newsScore >= 4 ? 'var(--text-primary)' : '#ef4444'}}>
                {suburb.metrics?.aiNewsSentiment || 'Run analysis'}
              </div>
              <div className="u-fc193050">
                {suburb.metrics?.aiNewsSummary || 'Click "Analyze Live News" to scan media for market sentiment'}
              </div>
            </div>
          </div>

          {/* Score bar visualization */}
          <div className="u-791db4a4">
            <div className="u-3df7ab94">
              <span>Bearish (1-3)</span><span>Neutral (4-6)</span><span>Bullish (7-10)</span>
            </div>
            <div className="u-aeb0a61e">
              <div style={{
                height: '100%',
                width: `${hasSentiment ? (newsScore / 10) * 100 : 50}%`,
                background: `linear-gradient(90deg, #ef4444 0%, #eab308 50%, #10b981 100%)`,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          {/* Explanation tooltip */}
          {suburb.metrics?._newsExplanation && suburb.metrics._newsExplanation.length > 0 && (
            <div className="u-83337499">
              <span className="u-6f606600"
                    title="Top keywords driving this sentiment score">
                ⓘ Why this score?
              </span>
              <div className="u-6c47f7df">
                {suburb.metrics._newsExplanation.map((exp: any, i: number) => (
                  <span key={i} className="u-8f3c2907" style={{background: exp.sentiment === 'positive' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: exp.sentiment === 'positive' ? '#10b981' : '#ef4444'}}>
                    {exp.token} ({exp.occurrences})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5-Axis Macro, RBA & Buyer's Agent Reality Check */}
          {macroIntel && (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.35)', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  🧭 5-Axis Macro & RBA Reality Check
                </span>
                {macroIntel.hype_vs_data_divergence?.level && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: macroIntel.hype_vs_data_divergence.level === 'SEVERE' ? 'rgba(239,68,68,0.2)' : macroIntel.hype_vs_data_divergence.level === 'ELEVATED' ? 'rgba(234,179,8,0.2)' : 'rgba(16,185,129,0.2)',
                    color: macroIntel.hype_vs_data_divergence.level === 'SEVERE' ? '#ef4444' : macroIntel.hype_vs_data_divergence.level === 'ELEVATED' ? '#eab308' : '#10b981',
                  }}>
                    Hype Divergence: {macroIntel.hype_vs_data_divergence.level}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem', fontSize: '0.82rem' }}>
                {macroIntel.rba_rate_sensitivity && (
                  <div style={{ padding: '0.65rem', borderRadius: '8px', background: 'var(--bg-glass)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: String(macroIntel.rba_rate_sensitivity.level).toUpperCase() === 'HIGH' ? '#ef4444' : String(macroIntel.rba_rate_sensitivity.level).toUpperCase() === 'MODERATE' ? '#eab308' : '#10b981' }}>
                      🏦 RBA Rate Sensitivity: {macroIntel.rba_rate_sensitivity.level}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{macroIntel.rba_rate_sensitivity.summary || macroIntel.rba_rate_sensitivity.analysis}</div>
                  </div>
                )}

                {macroIntel.supply_dilution_risk && (
                  <div style={{ padding: '0.65rem', borderRadius: '8px', background: 'var(--bg-glass)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: String(macroIntel.supply_dilution_risk.level).toUpperCase() === 'HIGH' ? '#ef4444' : String(macroIntel.supply_dilution_risk.level).toUpperCase() === 'MODERATE' ? '#eab308' : '#10b981' }}>
                      🏘️ Supply & Vacancy Risk: {macroIntel.supply_dilution_risk.level}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{macroIntel.supply_dilution_risk.summary || macroIntel.supply_dilution_risk.analysis}</div>
                  </div>
                )}

                {macroIntel.regulatory_tax_risk && (
                  <div style={{ padding: '0.65rem', borderRadius: '8px', background: 'var(--bg-glass)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: String(macroIntel.regulatory_tax_risk.level).toUpperCase() === 'HIGH' ? '#ef4444' : '#eab308' }}>
                      ⚖️ Holding Tax & Policy: {macroIntel.regulatory_tax_risk.level}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{macroIntel.regulatory_tax_risk.summary || macroIntel.regulatory_tax_risk.analysis}</div>
                  </div>
                )}

                {macroIntel.hype_vs_data_divergence && (
                  <div style={{ padding: '0.65rem', borderRadius: '8px', background: 'var(--bg-glass)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: macroIntel.hype_vs_data_divergence.level === 'SEVERE' ? '#ef4444' : macroIntel.hype_vs_data_divergence.level === 'ELEVATED' ? '#eab308' : '#10b981' }}>
                      📉 Hype vs. Data Check
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{macroIntel.hype_vs_data_divergence.summary || macroIntel.hype_vs_data_divergence.analysis}</div>
                  </div>
                )}
              </div>

              {macroIntel.amenity_claim_check?.warnings?.length > 0 && (
                <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#ef4444', marginBottom: '0.35rem' }}>
                    🚨 Buyer&apos;s Agent Pitch & Amenity Due Diligence Warnings
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-secondary)', fontSize: '0.81rem', lineHeight: 1.5 }}>
                    {macroIntel.amenity_claim_check.warnings.map((w: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: '0.2rem' }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Investment Committee Tab */}
      {activeTab === 'committee' && (
        <div>
          <div className="u-2a64d94f">
            <span className="u-a8922ee9">
              Multi-Agent Committee
              <span title="Simulated investment committee with Bull, Bear, and Urban Planner agents debating the suburb's potential." className="u-9b96534b">ⓘ</span>
            </span>
            <button
              disabled={isAnalyzingAI}
              onClick={handleCommittee}
              className="u-e88f821f" style={{cursor: isAnalyzingAI ? 'not-allowed' : 'pointer'}}
            >
              {isAnalyzingAI ? 'Convening...' : hasVerdict ? 'Refresh AI Committee' : 'Run AI Committee'}
            </button>
          </div>

          {hasVerdict ? (
            <div className="u-95149f3d" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              
              <div style={{ paddingLeft: '1rem', borderLeft: '3px solid #10b981' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.5rem', fontWeight: 700 }}>The Optimistic Case</h4>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{suburb.aiBullView || 'Awaiting analysis'}</div>
              </div>
              
              <div style={{ paddingLeft: '1rem', borderLeft: '3px solid #ef4444' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.5rem', fontWeight: 700 }}>The Cautious Case</h4>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{suburb.aiBearView || 'Awaiting analysis'}</div>
              </div>
              
              <div style={{ paddingLeft: '1rem', borderLeft: '3px solid #f59e0b' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.5rem', fontWeight: 700 }}>Neutral Synthesis</h4>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{suburb.aiUrbanView || 'Awaiting analysis'}</div>
              </div>

              {suburb.aiConsensus && (
                <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '1.1rem', color: 'var(--brand-navy)', marginBottom: '0.5rem', fontWeight: 700 }}>Key Takeaway</h4>
                  <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{suburb.aiConsensus}</div>
                </div>
              )}
              {suburb._policyWarnings?.length > 0 && (
                <div className="u-fa5c9d76">
                  <div className="u-32a9a2b8">⚠️ Policy & Regulatory Notices</div>
                  {suburb._policyWarnings.map((w: any, i: number) => (
                    <div key={i} className="u-428c07e0">
                      <span style={{ color: w.action === 'downgrade' ? '#ef4444' : '#eab308' }}>{w.action === 'downgrade' ? '🔴' : '🟡'}</span>
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
              {suburb._sourceSnippets?.length > 0 && (
                <div className="u-85354bb0">
                  <button
                    onClick={() => setShowSources(!showSources)}
                    className="u-35bda7af"
                  >
                    {showSources ? 'Hide' : 'Show'} Source Excerpts ({suburb._sourceSnippets.length})
                  </button>
                  {showSources && (
                    <div className="u-40eb4f07">
                      {suburb._sourceSnippets.map((s: any, i: number) => (
                        <div key={i} className="u-793248e2">
                          <div className="u-82b3824d">{s.title}</div>
                          <div className="u-1dc906e0">{s.snippet}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {hasVerdict && (
                <div className="u-070e66f1">
                  <button
                    onClick={() => setWhatIfOpen(!whatIfOpen)}
                    className="u-d3c7de87"
                  >
                    {whatIfOpen ? 'Hide' : '🔮 What-If Simulator'}
                  </button>
                  {whatIfOpen && (
                    <div className="u-baf8b056">
                      <div className="u-23bfdb56">
                        Tweak market parameters and recalculate scenarios using backend model
                      </div>
                      <div className="u-512f28f0">
                        <label className="u-dd4520e1">
                          Interest Rate {whatIfRate}%
                          <input type="range" min="2" max="12" step="0.25" value={whatIfRate}
                            onChange={e => { setWhatIfRate(Number(e.target.value)); setWhatIfResult(null); }}
                            className="u-e6a447a2" />
                        </label>
                        <label className="u-dd4520e1">
                          Rental Yield {whatIfYield}%
                          <input type="range" min="1" max="10" step="0.25" value={whatIfYield}
                            onChange={e => { setWhatIfYield(Number(e.target.value)); setWhatIfResult(null); }}
                            className="u-e6a447a2" />
                        </label>
                        <label className="u-dd4520e1">
                          Vacancy Rate {whatIfVacancy}%
                          <input type="range" min="0" max="15" step="0.5" value={whatIfVacancy}
                            onChange={e => { setWhatIfVacancy(Number(e.target.value)); setWhatIfResult(null); }}
                            className="u-e6a447a2" />
                        </label>
                      </div>
                      <button
                        onClick={handleWhatIf}
                        disabled={whatIfLoading}
                        className="u-3bb1fe51" style={{cursor: whatIfLoading ? 'not-allowed' : 'pointer'}}
                      >
                        {whatIfLoading ? 'Calculating...' : 'Run Scenario'}
                      </button>
                      {whatIfResult && (
                        <div className="u-6badb680">
                          <span className="u-af9b3a94">Scenario Risk: </span>
                          <span className="u-84151f52" style={{color: whatIfResult.risk_rating === 'Low' ? '#10b981' : whatIfResult.risk_rating === 'Medium' ? '#eab308' : '#ef4444'}}>{whatIfResult.risk_rating}</span>
                          <span className="u-9ea11918">(~{Math.round((whatIfResult.price_decline_scenario || 0) * 100)}% estimated downside)</span>
                          <div className="u-fa681d48">
                            {whatIfResult.calibration_note || 'Model scenario — not validated against historical outcomes'}
                          </div>
                        </div>
                      )}
                      {!whatIfResult && !whatIfLoading && (
                        <div className="u-786ad581">
                          Click "Run Scenario" to calculate using the backend risk model
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="u-632878cd">
              <div className="u-a1831ecd">🏛️</div>
              Click "Run AI Committee" to convene the multi-agent investment committee.
              <br />
              <span className="u-c0024dfb">3 agents will debate {activeSuburb.name}'s investment potential.</span>
            </div>
          )}
        </div>
      )}

      {/* Anti-Market Resilience & Value Trap Check Tab */}
      {activeTab === 'antimarket' && (
        <div>
          <div className="u-2a64d94f">
            <span className="u-a8922ee9">
              Counter-Cyclical & Value Trap Radar
              <span title="Evaluates whether a suburb bucks RBA interest rate hikes (tight vacancy + positive alpha) or exhibits Value Trap characteristics (high vacancy + falling prices despite buyer's agent hype)." className="u-9b96534b">ⓘ</span>
            </span>
            <button
              disabled={isLoadingAntiMarket}
              onClick={handleAntiMarket}
              className="u-93cbfad3"
              style={{
                background: isLoadingAntiMarket ? 'var(--bg-glass)' : '#10b981',
                color: isLoadingAntiMarket ? 'var(--text-secondary)' : '#000',
                cursor: isLoadingAntiMarket ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoadingAntiMarket ? 'Scanning...' : antiMarketData ? 'Refresh Anti-Market Check' : 'Run Anti-Market Check'}
            </button>
          </div>

          {antiMarketData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.75rem' }}>
              {/* Score & Trend Banner */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1.1rem',
                borderRadius: '10px',
                background: antiMarketData.is_value_trap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                border: `1px solid ${antiMarketData.is_value_trap ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: antiMarketData.anti_market_score >= 70 ? '#10b981' : antiMarketData.anti_market_score >= 50 ? 'var(--accent-cyan)' : '#ef4444',
                  }}>
                    {antiMarketData.anti_market_score}/100
                  </div>
                  <div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '1.02rem',
                      color: antiMarketData.is_value_trap ? '#ef4444' : '#10b981',
                    }}>
                      {antiMarketData.trend_label}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      12m Alpha vs {activeSuburb.state} Median ({antiMarketData.state_median_12m_growth >= 0 ? '+' : ''}{antiMarketData.state_median_12m_growth}%):{' '}
                      <strong style={{ color: antiMarketData.alpha_12m >= 0 ? '#10b981' : '#ef4444' }}>
                        {antiMarketData.alpha_12m >= 0 ? '+' : ''}{antiMarketData.alpha_12m}%
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trap Signals & Resilience Drivers */}
              {antiMarketData.trap_signals?.length > 0 && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ef4444', marginBottom: '0.35rem' }}>
                    ⚠️ Quantitative Value Trap Signals
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {antiMarketData.trap_signals.map((sig: string, i: number) => (
                      <li key={i} style={{ marginBottom: '0.2rem' }}>{sig}</li>
                    ))}
                  </ul>
                </div>
              )}

              {antiMarketData.resilience_drivers?.length > 0 && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#10b981', marginBottom: '0.35rem' }}>
                    ✅ Counter-Cyclical Resilience Drivers
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {antiMarketData.resilience_drivers.map((drv: string, i: number) => (
                      <li key={i} style={{ marginBottom: '0.2rem' }}>{drv}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Buyer's Agent Pitch / Amenity Reality Check */}
              {antiMarketData.macro_intelligence?.amenity_claim_check?.warnings?.length > 0 && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.08)', borderLeft: '3px solid #eab308' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#eab308', marginBottom: '0.35rem' }}>
                    🔍 Buyer&apos;s Agent Pitch vs. Data Reality Check
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {antiMarketData.macro_intelligence.amenity_claim_check.warnings.map((w: string, i: number) => (
                      <li key={i} style={{ marginBottom: '0.2rem' }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Counter-Cyclical Alternative Suburbs */}
              {antiMarketData.alternatives?.length > 0 && (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    🛡️ Counter-Cyclical Alternatives in {activeSuburb.state} (Similar Price Bracket)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {antiMarketData.alternatives.map((alt: any) => (
                      <div key={alt.id} style={{ padding: '0.85rem', borderRadius: '8px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {alt.name} ({alt.postcode})
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '999px', background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                            Score {alt.anti_market_score}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span>Median: <strong>${Math.round((alt.house_median_price || 0) / 1000)}k</strong></span>
                          <span style={{ color: '#10b981' }}>12m: <strong>+{alt.price_12m_change_pct}%</strong></span>
                          <span>Vacancy: <strong>{alt.vacancy_rate}%</strong></span>
                          <span>Yield: <strong>{alt.rental_yield}%</strong></span>
                        </div>
                        {alt.why_resilient?.length > 0 && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            {alt.why_resilient[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="u-632878cd">
              <div className="u-a1831ecd">🛡️</div>
              Click &quot;Run Anti-Market Check&quot; to test {activeSuburb.name} against RBA rate hikes, vacancy oversupply traps, and buyer&apos;s agent amenity pitches.
              <br />
              <span className="u-c0024dfb">Also surfaces counter-cyclical alternative suburbs in the same price band.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
