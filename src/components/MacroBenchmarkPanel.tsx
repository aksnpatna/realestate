import { memo, useState, useEffect } from 'react'

interface Benchmark {
  symbol: string
  name: string
  note: string
  current_price: number | null
  growth_1y_pct: number
  type: string
}

const MacroBenchmarkPanel = memo(function MacroBenchmarkPanel() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/benchmarks', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setBenchmarks(Array.isArray(data) ? data : (data.benchmarks || []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null;
  if (benchmarks.length === 0) return null;

  return (
    <div className="glass-card u-9333892f">
      <div className="u-47a97aa0">
        <h3 className="u-6b179248">Investor Opportunity Benchmarks</h3>
        <span className="u-356ee263">
          Live Market Data
        </span>
      </div>
      <p className="u-a0cc7bbe">
        Assess the true opportunity cost of your capital. Compare residential property performance against risk-free rates, commercial REITs, and broad equities.
      </p>
      
      <div className="u-73a09d8f">
        {benchmarks.map(b => {
          let icon = '📈';
          let borderColor = 'var(--border-glass)';
          
          if (b.type === 'opportunity') { icon = '🌐'; borderColor = 'rgba(59, 130, 246, 0.4)'; }
          if (b.type === 'property_index') { icon = '🏢'; borderColor = 'rgba(139, 92, 246, 0.4)'; }
          if (b.type === 'risk-free') { icon = '🛡️'; borderColor = 'rgba(16, 185, 129, 0.4)'; }
          if (b.type === 'residential') { icon = '🏠'; borderColor = 'rgba(14, 165, 233, 0.4)'; }
          
          return (
            <div
              key={b.symbol}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div className="u-69f9d299">
                <div className="u-6e6177ef">
                  <span className="u-7bbecc0d">{icon}</span>
                  <span className="u-a4398e98">
                    {b.symbol}
                  </span>
                </div>
                <span className="u-03b9692a" style={{color: b.growth_1y_pct > 0 ? '#10b981' : '#ef4444'}}>
                  {b.growth_1y_pct > 0 ? '+' : ''}{b.growth_1y_pct.toFixed(2)}%
                </span>
              </div>
              <div className="u-1d76bdc4">
                {b.name}
              </div>
              <div className="u-643e53e9">
                {b.note}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
})

export default MacroBenchmarkPanel
