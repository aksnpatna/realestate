/**
 * AIInsightPanel.tsx — Unified AI analysis panel with two tabs:
 *   News Sentiment: live media analysis (0-10 score)
 *   Investment Committee: multi-agent BUY/HOLD/PASS verdict
 */
import { useState } from 'react'
import type { SuburbData } from '../data/suburbs'

type AnalysisTab = 'sentiment' | 'committee'
type AnalysisStep = 'idle' | 'fetchNews' | 'bull' | 'bear' | 'urban' | 'final'

interface AIInsightPanelProps {
  activeSuburb: SuburbData
  setActiveSuburb: React.Dispatch<React.SetStateAction<SuburbData | null>>
}

export default function AIInsightPanel({ activeSuburb, setActiveSuburb }: AIInsightPanelProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('sentiment')
  const [isAnalyzingNews, setIsAnalyzingNews] = useState(false)
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false)
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

  const suburb = activeSuburb as any
  const newsScore = suburb.metrics?._newsScore
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
            title="News-based market sentiment score (0-10)"
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
            <div className="u-95149f3d">
              <div className="u-41a509d4">
                <div className="u-7f2c974e">Consensus Verdict</div>
                <div className="u-9beee884" style={{color: suburb.aiVerdict?.includes('BUY') ? '#10b981'
                    : suburb.aiVerdict?.includes('SELL') ? '#ef4444'
                    : 'var(--accent-cyan)'}}>
                  {suburb.aiVerdict}
                </div>
                <div className="u-0532d2dc">
                  Risk: <span className="u-6d7b5c0d">{suburb.aiRiskLevel || '—'}</span>
                  {suburb._riskAssessment && (
                    <>
                      {' • '}
                      <span title="Monte Carlo scenario simulation (5,000 iterations) — model scenario only, not calibrated against historical outcomes" className="u-fc3978f9">
                        Scenario Risk: <span className="u-fdec1e77" style={{color: suburb._riskAssessment.risk_rating === 'Low' ? '#10b981'
                            : suburb._riskAssessment.risk_rating === 'Medium' ? '#eab308' : '#ef4444'}}>{suburb._riskAssessment.risk_rating}</span>
                      </span>
                      {' '}(~{Math.round((suburb._riskAssessment.price_decline_scenario ?? suburb._riskAssessment.price_decline_probability ?? 0) * 100)}% price-decline scenario)
                      <div className="u-76a5e5b1">
                        Illustrative simulated range midpoint: ${((suburb._riskAssessment.projected_range?.[1]) / 1000).toFixed(0)}k ({suburb._riskAssessment.expected_return}% illustrative scenario change) — model scenario only
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="u-5aa686c7">
                <div className="u-012a45d4">🐂 Bull — Anna</div>
                <div className="u-7eef0854">{suburb.aiBullView || 'Awaiting analysis'}</div>
              </div>
              <div className="u-fc07ed5a">
                <div className="u-7b3ea3b3">🐻 Bear — Alex</div>
                <div className="u-7eef0854">{suburb.aiBearView || 'Awaiting analysis'}</div>
              </div>
              <div className="u-004af4b0">
                <div className="u-78bec1c5">🏙️ Urban Planner</div>
                <div className="u-7eef0854">{suburb.aiUrbanView || 'Awaiting analysis'}</div>
              </div>
              {suburb.aiConsensus && (
                <div className="u-c40cc6c3">
                  <div className="u-3e341d2a">📋 Investor CEO Playbook</div>
                  <div className="u-f89c33d9">{suburb.aiConsensus}</div>
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
    </div>
  )
}
