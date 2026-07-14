import { useState, useMemo, memo } from 'react';
import { calculateMaxPurchase } from '../data/suburbs';

export default memo(function AffordabilityCalculator({ setActiveTab }: { suburbsData?: any[]; setActiveTab?: (t: string) => void }) {
  const [deposit, setDeposit] = useState<number>(150000);
  const [lvrPct, setLvrPct] = useState<number>(90);
  const [annualIncome, setAnnualIncome] = useState<number>(150000);
  const [monthlyDebt, setMonthlyDebt] = useState<number>(0);
  const [interestRate, setInterestRate] = useState<number>(6.2);
  const [bufferRate, setBufferRate] = useState<number>(3.0);

  const lvr = lvrPct / 100;

  const calc = useMemo(() => {
    if (!deposit || deposit <= 0 || !annualIncome) return null;
    return {
      NSW: calculateMaxPurchase(deposit, 'NSW', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100),
      VIC: calculateMaxPurchase(deposit, 'VIC', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100),
      QLD: calculateMaxPurchase(deposit, 'QLD', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100),
      WA: calculateMaxPurchase(deposit, 'WA', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100),
      SA: calculateMaxPurchase(deposit, 'SA', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100),
      TAS: calculateMaxPurchase(deposit, 'TAS', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100),
    };
  }, [deposit, lvr, annualIncome, monthlyDebt, interestRate, bufferRate]);

  const handleOpenBuyFinder = () => {
    if (setActiveTab) setActiveTab('buy-finder');
  };

  return (
    <div className="affordability-container">
      <div className="glass-card calculator-card">
        <h2 className="detail-title">Price Ceiling Calculator</h2>
        <p className="subtitle">Determine your true maximum purchase price based on BOTH your deposit and your borrowing capacity.</p>
        <div style={{ background: 'rgba(14,165,233,0.08)', color: 'var(--accent-cyan)', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(14,165,233,0.2)' }}>
          This calculates your serviceability limit using standard HEM expense estimates and an APRA buffer. For a full personalized suburb shortlist, use <strong>Buy Finder</strong>.
        </div>

        <div className="calculator-inputs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div className="control-group">
            <label className="control-label">Your Deposit (AUD)</label>
            <input type="number" className="premium-input" value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value) || 0)} min={10000} step={10000} placeholder="e.g. 150000" />
          </div>
          <div className="control-group">
            <label className="control-label">Max LVR ({lvrPct}%)</label>
            <div className="range-with-value">
              <input type="range" className="premium-range" min={50} max={95} step={5} value={lvrPct} onChange={(e) => setLvrPct(Number(e.target.value))} />
              <span className="range-value">{lvrPct}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Combined Annual Income</label>
            <input type="number" className="premium-input" value={annualIncome}
              onChange={(e) => setAnnualIncome(Number(e.target.value) || 0)} min={50000} step={5000} placeholder="e.g. 150000" />
          </div>
          <div className="control-group">
            <label className="control-label" title="Do not include the new mortgage repayment here. This is for existing obligations only.">
              Other Monthly Debt (Exclude New Loan)
            </label>
            <input type="number" className="premium-input" value={monthlyDebt}
              onChange={(e) => setMonthlyDebt(Number(e.target.value) || 0)} min={0} step={100} placeholder="e.g. 0" />
          </div>
          <div className="control-group">
            <label className="control-label">Interest Rate ({interestRate}%)</label>
            <input type="number" className="premium-input" value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value) || 0)} min={1} max={15} step={0.1} />
          </div>
          <div className="control-group">
            <label className="control-label">Serviceability Buffer ({bufferRate}%)</label>
            <input type="number" className="premium-input" value={bufferRate}
              onChange={(e) => setBufferRate(Number(e.target.value) || 0)} min={0} max={5} step={0.5} />
          </div>
        </div>

        {calc && (
          <div className="state-summary-grid" style={{ marginTop: '20px' }}>
            {Object.entries(calc).map(([state, c]) => (
              <div key={state} className="state-summary-card" style={{ borderTop: c.limitedBy === 'Serviceability' ? '3px solid #ef4444' : '3px solid var(--accent-cyan)' }}>
                <div className="state-summary-name">{state}</div>
                <div className="state-summary-value">${c.maxPrice.toLocaleString()}</div>
                <div className="state-summary-label">Maximum Purchase Price</div>
                <div className="state-summary-detail" style={{ marginTop: '8px' }}>Max Borrowing: <strong>${c.maxBorrow.toLocaleString()}</strong></div>
                <div className="state-summary-detail">Upfront Stamp Duty: <strong>${c.stampDutyForMax.toLocaleString()}</strong></div>
                <div className="state-summary-detail" style={{ color: c.limitedBy === 'Serviceability' ? '#ef4444' : 'var(--accent-cyan)', fontWeight: 600, marginTop: '8px' }}>
                  Limited by: {c.limitedBy}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={handleOpenBuyFinder}
            style={{ padding: '10px 20px', background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Open Buy Finder for Suburb Ranking
          </button>
          <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            This calculator does not rank suburbs. Buy Finder is the only ranking tool.
          </div>
        </div>
      </div>
    </div>
  );
})
