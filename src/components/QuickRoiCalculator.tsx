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
    <div className="highlights-section" style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
        <h3>Panel E: Quick ROI Calculator</h3>
        {onAdvancedClick && (
          <button 
            onClick={onAdvancedClick}
            style={{ padding: '6px 12px', background: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Launch Detailed Tax/Cashflow Calculator ➔
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px', background: 'var(--bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
          <h4 style={{ marginBottom: '15px', color: 'var(--accent-purple)' }}>Adjust Assumptions</h4>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Deposit (%)</label>
            <input 
              type="range" min="10" max="100" step="5" value={depositPct} 
              onChange={e => setDepositPct(Number(e.target.value))} 
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>{depositPct}%</div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Interest Rate (%)</label>
            <input 
              type="range" min="2" max="10" step="0.1" value={interestRate} 
              onChange={e => setInterestRate(Number(e.target.value))} 
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>{interestRate}%</div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loan Type</label>
            <select 
              value={loanType} onChange={e => setLoanType(e.target.value)}
              style={{ width: '100%', padding: '6px', background: '#111', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px' }}
            >
              <option value="io">Interest Only</option>
              <option value="pi">Principal & Interest</option>
            </select>
          </div>
        </div>

        <div style={{ flex: '2 1 300px', display: 'flex', gap: '15px', flexDirection: 'column' }}>
          {loading && !results && <div style={{ padding: '20px', textAlign: 'center' }}>Calculating...</div>}
          {results && (
            <>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Net Yield (After Expenses)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{results.net_yield_pct}%</div>
                </div>
                <div style={{ flex: '1 1 140px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Cash on Cash Return</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{results.cash_on_cash_return_pct}%</div>
                </div>
                <div style={{ flex: '1 1 140px', background: results.gearing_status === 'positive' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${results.gearing_status === 'positive' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: results.gearing_status === 'positive' ? '#10b981' : '#ef4444' }}>Weekly Cashflow</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>${results.net_weekly_cashflow}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Upfront Required</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>${Math.round(results.total_upfront).toLocaleString()}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Incl. ${Math.round(results.stamp_duty).toLocaleString()} stamp duty</div>
                </div>
                <div style={{ flex: '1 1 200px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Annual Interest Bill</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>${Math.round(results.annual_interest).toLocaleString()}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
