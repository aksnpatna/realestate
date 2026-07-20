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
        setBenchmarks(data.benchmarks || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null;
  if (benchmarks.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Macro Benchmarks (Option 3 Implementation)</h3>
        <span style={{ fontSize: '0.8rem', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px' }}>
          Market Context
        </span>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Understand the scope of your investment by comparing it to standard macro opportunity costs. 
        Note that commercial/retail REITs are inherently different from residential property.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        {benchmarks.map(b => (
          <div
            key={b.symbol}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                {b.name}
              </span>
              <span style={{ color: b.growth_1y_pct > 0 ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {b.growth_1y_pct > 0 ? '+' : ''}{b.growth_1y_pct.toFixed(2)}%
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {b.symbol}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {b.note}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default MacroBenchmarkPanel
