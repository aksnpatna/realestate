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
    <div className="roi-compact-card u-51b3503a">
      {/* Header */}
      <div className="u-0d4697ff">
        <h3 className="u-eff96772">
          <span className="u-ce0fd88b">💰</span> Quick ROI Estimate
        </h3>
        {onAdvancedClick && (
          <button 
            onClick={onAdvancedClick}
            className="u-74e80353"
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Full Cashflow Analysis →
          </button>
        )}
      </div>

      {/* Compact Controls Row */}
      <div className="roi-controls-row u-0b64f8cd">
        <div className="u-7545674d">
          <label className="u-507a9832">Deposit</label>
          <div className="u-6e6177ef">
            <input 
              type="range" min="10" max="100" step="5" value={depositPct} 
              onChange={e => setDepositPct(Number(e.target.value))} 
              className="u-e6a447a2"
            />
            <span className="u-e5cb933e">{depositPct}%</span>
          </div>
        </div>

        <div className="u-7545674d">
          <label className="u-507a9832">Rate</label>
          <div className="u-6e6177ef">
            <input 
              type="range" min="2" max="10" step="0.1" value={interestRate} 
              onChange={e => setInterestRate(Number(e.target.value))} 
              className="u-2edd794c"
            />
            <span className="u-64f76aaf">{interestRate}%</span>
          </div>
        </div>

        <div className="u-c1b81114">
          <label className="u-507a9832">Loan</label>
          <select 
            value={loanType} onChange={e => setLoanType(e.target.value)}
            className="u-c55077dc"
          >
            <option value="io">Interest Only</option>
            <option value="pi">P&I</option>
          </select>
        </div>
      </div>

      {/* Results Row — compact KPI pills */}
      {loading && !results && <div className="u-656b0764">Calculating...</div>}
      {results && (
        <>
          <div className="roi-results-row u-282fe732">
            <div className="u-46be6ed5">
              <div className="u-69d15b82">Net Yield</div>
              <div className="u-9b2b0612">{results.net_yield_pct}%</div>
            </div>
            <div className="u-e7250ece">
              <div className="u-9ba22ee2">Cash on Cash</div>
              <div className="u-9b2b0612">{results.cash_on_cash_return_pct}%</div>
            </div>
            <div style={{ flex: '1 1 100px', background: results.gearing_status === 'positive' ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${results.gearing_status === 'positive' ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)'}`, padding: '10px 12px', borderRadius: '8px' }}>
              <div className="u-5da6e769" style={{color: results.gearing_status === 'positive' ? '#059669' : '#DC2626'}}>Weekly Cashflow</div>
              <div className="u-9b2b0612">${results.net_weekly_cashflow}</div>
            </div>
            <div className="u-8a3d380f">
              <div className="u-e25657dc">Upfront Required</div>
              <div className="u-9b2b0612">${Math.round(results.total_upfront).toLocaleString()}</div>
              <div className="u-2b526a6b">incl. ${Math.round(results.stamp_duty).toLocaleString()} stamp duty</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
