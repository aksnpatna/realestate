import { useState, useEffect, useRef, memo } from 'react';

interface QuickRoiCalculatorProps {
  medianPrice: number;
  medianRent: number;
  state: string;
  onAdvancedClick?: () => void;
}

export default memo(function QuickRoiCalculator({ medianPrice, medianRent, state, onAdvancedClick }: QuickRoiCalculatorProps) {
  const [depositPct, setDepositPct] = useState(20);
  const [interestRate, setInterestRate] = useState(6.2);
  const [loanType, setLoanType] = useState('io');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(() => {
      const fetchRoi = async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/calc/roi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              purchase_price: medianPrice,
              weekly_rent: medianRent,
              state: state,
              deposit_pct: depositPct,
              interest_rate: interestRate,
              loan_type: loanType
            })
          });
          const data = await res.json();
          if (active && data.status === 'success') {
            setResults(data.metrics);
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (active) setLoading(false);
        }
      };
      
      if (medianPrice > 0 && medianRent > 0) {
        fetchRoi();
      }
    }, 400);

    return () => { active = false; if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [medianPrice, medianRent, depositPct, interestRate, loanType]);

  if (medianPrice === 0) return null;

  return (
    <div className="roi-compact-card" style={{ marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.1rem' }}>💰</span> Quick ROI Estimate
        </h3>
        {onAdvancedClick && (
          <button 
            onClick={onAdvancedClick}
            style={{ padding: '5px 10px', background: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Full Cashflow Analysis →
          </button>
        )}
      </div>

      {/* Compact Controls Row */}
      <div className="roi-controls-row" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 120px', minWidth: '100px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600 }}>Deposit</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="range" min="10" max="100" step="5" value={depositPct} 
              onChange={e => setDepositPct(Number(e.target.value))} 
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', minWidth: '32px', textAlign: 'right' }}>{depositPct}%</span>
          </div>
        </div>

        <div style={{ flex: '1 1 120px', minWidth: '100px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600 }}>Rate</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="range" min="2" max="10" step="0.1" value={interestRate} 
              onChange={e => setInterestRate(Number(e.target.value))} 
              style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-purple)', minWidth: '36px', textAlign: 'right' }}>{interestRate}%</span>
          </div>
        </div>

        <div style={{ flex: '0 1 130px', minWidth: '100px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600 }}>Loan</label>
          <select 
            value={loanType} onChange={e => setLoanType(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500 }}
          >
            <option value="io">Interest Only</option>
            <option value="pi">P&I</option>
          </select>
        </div>
      </div>

      {/* Results Row — compact KPI pills */}
      {loading && !results && <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculating...</div>}
      {results && (
        <>
          <div className="roi-results-row" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 100px', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 600 }}>Net Yield</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{results.net_yield_pct}%</div>
            </div>
            <div style={{ flex: '1 1 100px', background: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.15)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 600 }}>Cash on Cash</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{results.cash_on_cash_return_pct}%</div>
            </div>
            <div style={{ flex: '1 1 100px', background: results.gearing_status === 'positive' ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${results.gearing_status === 'positive' ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`, padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: results.gearing_status === 'positive' ? '#059669' : '#DC2626', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 600 }}>Weekly Cashflow</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>${results.net_weekly_cashflow}</div>
            </div>
            <div style={{ flex: '1 1 100px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', padding: '10px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 600 }}>Upfront Required</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>${Math.round(results.total_upfront).toLocaleString()}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>incl. ${Math.round(results.stamp_duty).toLocaleString()} stamp duty</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
