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
    <div className="glass-card" style={{ padding: '24px', marginBottom: '20px', marginTop: '20px', borderTop: '4px solid var(--accent-cyan)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>Investor Opportunity Benchmarks</h3>
        <span style={{ fontSize: '0.8rem', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
          Live Market Data
        </span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
        Assess the true opportunity cost of your capital. Compare residential property performance against risk-free rates, commercial REITs, and broad equities.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.5px' }}>
                    {b.symbol}
                  </span>
                </div>
                <span style={{ color: b.growth_1y_pct > 0 ? '#10b981' : '#ef4444', fontSize: '1.1rem', fontWeight: 'bold', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                  {b.growth_1y_pct > 0 ? '+' : ''}{b.growth_1y_pct.toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {b.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '4px' }}>
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
