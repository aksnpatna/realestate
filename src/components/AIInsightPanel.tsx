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

  const stepMessages: Record<AnalysisStep, string> = {
    idle: '',
    fetchNews: 'Fetching latest news articles...',
    bull: 'Running Bull analysis...',
    bear: 'Running Bear analysis...',
    urban: 'Running Urban Planner analysis...',
    final: 'Compiling final verdict and playbook...',
  }

  const handleSentiment = async () => {
    if (isAnalyzingNews) return
    setIsAnalyzingNews(true)
    setError(null)
    setAiDisabled(false)
    try {
      const res = await fetch(`/api/suburbs/${activeSuburb.id}/news-sentiment`, { method: 'POST' })
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
    <div className="highlights-section" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>
          <span title="AI-powered analysis of market sentiment and investment potential">AI Insights</span>
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('sentiment')}
            style={{
              padding: '6px 14px',
              background: activeTab === 'sentiment' ? 'var(--accent-cyan)' : 'var(--bg-glass)',
              color: activeTab === 'sentiment' ? '#000' : 'var(--text-primary)',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === 'sentiment' ? 'bold' : 'normal',
              fontSize: '0.85rem',
            }}
            title="News-based market sentiment score (0-10)"
          >
            📰 News Sentiment
          </button>
          <button
            onClick={() => setActiveTab('committee')}
            style={{
              padding: '6px 14px',
              background: activeTab === 'committee' ? 'var(--accent-purple)' : 'var(--bg-glass)',
              color: activeTab === 'committee' ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === 'committee' ? 'bold' : 'normal',
              fontSize: '0.85rem',
            }}
            title="Multi-agent investment committee (Bull/Bear/Urban Planner)"
          >
            🏛️ Committee
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '0.9rem',
          marginBottom: '15px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>⚠ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

      {aiDisabled && (
        <div style={{
          padding: '16px',
          background: 'rgba(234,179,8,0.1)',
          border: '1px solid rgba(234,179,8,0.3)',
          borderRadius: '8px',
          marginBottom: '15px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🔧</div>
          <div style={{ color: '#eab308', fontWeight: 600, marginBottom: '4px' }}>AI Insights Temporarily Unavailable</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            The AI engine is undergoing maintenance. Cached results (shown below if available) may be up to 7 days old.
          </div>
        </div>
      )}

      {/* Loading spinner with step messages */}
      {((isAnalyzingAI && analysisStep !== 'idle') || isAnalyzingNews) && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          borderRadius: '8px',
          marginBottom: '15px',
        }}>
          <div style={{
            width: '32px', height: '32px',
            border: '3px solid var(--border-glass)',
            borderTopColor: 'var(--accent-cyan)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 10px',
          }} />
          <div style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 500 }}>
            {isAnalyzingNews ? 'Fetching news and analyzing sentiment...' : stepMessages[analysisStep]}
          </div>
        </div>
      )}

      {/* News Sentiment Tab */}
      {activeTab === 'sentiment' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>Market Sentiment Score</span>
              <span title="0-10 score derived from live news media. ≥7 Bullish, 4-6 Neutral, <4 Bearish. Uses AI transformer for accuracy with keyword fallback." style={{ color: 'var(--text-secondary)', marginLeft: '6px', cursor: 'help', fontSize: '0.9rem' }}>ⓘ</span>
            </div>
            <button
              disabled={isAnalyzingNews}
              onClick={handleSentiment}
              style={{
                background: isAnalyzingNews ? 'var(--bg-glass)' : 'var(--accent-cyan)',
                color: isAnalyzingNews ? 'var(--text-secondary)' : '#000',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '4px',
                cursor: isAnalyzingNews ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
              }}
            >
              {isAnalyzingNews ? 'Analyzing...' : hasSentiment ? 'Refresh Sentiment' : 'Analyze Live News'}
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '2.5rem', fontWeight: 800,
              color: newsScore >= 7 ? '#10b981' : newsScore >= 4 ? 'var(--accent-cyan)' : '#ef4444',
              minWidth: '80px',
            }}>
              {hasSentiment ? `${newsScore}/10` : '—'}
            </div>
            <div>
              <div style={{
                fontSize: '1.1rem', fontWeight: 600,
                color: newsScore >= 7 ? '#10b981' : newsScore >= 4 ? 'var(--text-primary)' : '#ef4444',
              }}>
                {suburb.metrics?.aiNewsSentiment || 'Run analysis'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {suburb.metrics?.aiNewsSummary || 'Click "Analyze Live News" to scan media for market sentiment'}
              </div>
            </div>
          </div>

          {/* Score bar visualization */}
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Bearish (1-3)</span><span>Neutral (4-6)</span><span>Bullish (7-10)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-glass)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${hasSentiment ? (newsScore / 10) * 100 : 50}%`,
                background: `linear-gradient(90deg, #ef4444 0%, #eab308 50%, #10b981 100%)`,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Investment Committee Tab */}
      {activeTab === 'committee' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>
              Multi-Agent Committee
              <span title="Simulated investment committee with Bull, Bear, and Urban Planner agents debating the suburb's potential." style={{ color: 'var(--text-secondary)', marginLeft: '6px', cursor: 'help', fontSize: '0.9rem' }}>ⓘ</span>
            </span>
            <button
              disabled={isAnalyzingAI}
              onClick={handleCommittee}
              style={{
                padding: '8px 16px',
                background: 'var(--accent-purple)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: isAnalyzingAI ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              {isAnalyzingAI ? 'Convening...' : hasVerdict ? 'Refresh AI Committee' : 'Run AI Committee'}
            </button>
          </div>

          {hasVerdict ? (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 100%', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Consensus Verdict</div>
                <div style={{
                  fontWeight: 800, fontSize: '1.3rem',
                  color: suburb.aiVerdict?.includes('BUY') ? '#10b981'
                    : suburb.aiVerdict?.includes('SELL') ? '#ef4444'
                    : 'var(--accent-cyan)',
                }}>
                  {suburb.aiVerdict}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Risk: <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{suburb.aiRiskLevel || '—'}</span>
                </div>
              </div>
              <div style={{ flex: '1 1 250px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '4px' }}>🐂 Bull — Anna</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxHeight: '120px', overflowY: 'auto' }}>{suburb.aiBullView || 'Awaiting analysis'}</div>
              </div>
              <div style={{ flex: '1 1 250px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '4px' }}>🐻 Bear — Alex</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxHeight: '120px', overflowY: 'auto' }}>{suburb.aiBearView || 'Awaiting analysis'}</div>
              </div>
              <div style={{ flex: '1 1 250px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '15px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#8b5cf6', marginBottom: '4px' }}>🏙️ Urban Planner</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxHeight: '120px', overflowY: 'auto' }}>{suburb.aiUrbanView || 'Awaiting analysis'}</div>
              </div>
              {suburb.aiConsensus && (
                <div style={{ flex: '1 1 100%', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '4px' }}>📋 Investor CEO Playbook</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>{suburb.aiConsensus}</div>
                </div>
              )}
              {suburb._sourceSnippets?.length > 0 && (
                <div style={{ flex: '1 1 100%', marginTop: '8px' }}>
                  <button
                    onClick={() => setShowSources(!showSources)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--bg-glass)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {showSources ? 'Hide' : 'Show'} Source Excerpts ({suburb._sourceSnippets.length})
                  </button>
                  {showSources && (
                    <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                      {suburb._sourceSnippets.map((s: any, i: number) => (
                        <div key={i} style={{ padding: '8px', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{s.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{s.snippet}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '30px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              background: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🏛️</div>
              Click "Run AI Committee" to convene the multi-agent investment committee.
              <br />
              <span style={{ fontSize: '0.8rem' }}>3 agents will debate {activeSuburb.name}'s investment potential.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
