import { useMemo, memo } from 'react';
import { calculateMaxPurchase } from '../data/suburbs';

export default memo(function AffordabilityCalculator({ setActiveTab, financialProfile, setFinancialProfile, persona }: { suburbsData?: any[]; setActiveTab?: (t: string) => void; financialProfile?: any; setFinancialProfile?: any; persona?: string }) {
  const deposit = financialProfile?.deposit ?? 150000;
  const lvrPct = financialProfile?.lvrPct ?? 90;
  const annualIncome = financialProfile?.annualIncome ?? 150000;
  const monthlyDebt = financialProfile?.monthlyDebt ?? 0;
  const interestRate = financialProfile?.interestRate ?? 6.2;
  const bufferRate = financialProfile?.bufferRate ?? 3.0;

  const updateProfile = (key: string, value: number) => {
    if (setFinancialProfile) {
      setFinancialProfile((prev: any) => ({ ...prev, [key]: value }));
    }
  };

  const lvr = lvrPct / 100;

  const isFHB = persona === 'first_home_buyer';

  const calc = useMemo(() => {
    if (!deposit || deposit <= 0 || !annualIncome) return null;
    return {
      NSW: calculateMaxPurchase(deposit, 'NSW', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100, isFHB),
      VIC: calculateMaxPurchase(deposit, 'VIC', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100, isFHB),
      QLD: calculateMaxPurchase(deposit, 'QLD', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100, isFHB),
      WA: calculateMaxPurchase(deposit, 'WA', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100, isFHB),
      SA: calculateMaxPurchase(deposit, 'SA', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100, isFHB),
      TAS: calculateMaxPurchase(deposit, 'TAS', lvr, annualIncome, monthlyDebt, interestRate / 100, bufferRate / 100, isFHB),
    };
  }, [deposit, lvr, annualIncome, monthlyDebt, interestRate, bufferRate, isFHB]);

  const handleOpenBuyFinder = () => {
    if (setActiveTab) setActiveTab('buy-finder');
  };

  return (
    <div className="affordability-container">
      <div className="glass-card calculator-card">
        <h2 className="detail-title">Price Ceiling Calculator</h2>
        <p className="subtitle">Determine your true maximum purchase price based on BOTH your deposit and your borrowing capacity.</p>
        <div className="u-e478a671">
          This calculates your serviceability limit using standard HEM expense estimates and an APRA buffer. For a full personalized suburb shortlist, use <strong>Buy Finder</strong>.
        </div>
        {isFHB && (
          <div className="u-d4255ae4">
            🎉 First Home Buyer state-specific stamp duty concessions and up to 95% LVR are automatically applied in these calculations.
          </div>
        )}

        <div className="calculator-inputs u-b9c3944d">
          <div className="control-group">
            <label className="control-label">Your Deposit (AUD)</label>
            <input type="number" className="premium-input" value={deposit}
              onChange={(e) => updateProfile('deposit', Number(e.target.value) || 0)} min={10000} step={10000} placeholder="e.g. 150000" />
          </div>
          <div className="control-group">
            <label className="control-label">Max LVR ({lvrPct}%)</label>
            <div className="range-with-value">
              <input type="range" className="premium-range" min={50} max={95} step={5} value={lvrPct} onChange={(e) => updateProfile('lvrPct', Number(e.target.value))} />
              <span className="range-value">{lvrPct}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Combined Gross Income (Before Tax)</label>
            <input type="number" className="premium-input" value={annualIncome}
              onChange={(e) => updateProfile('annualIncome', Number(e.target.value) || 0)} min={50000} step={5000} placeholder="e.g. 150000" />
            <div className="u-9e313976">
              Estimated take-home: ~${Math.round((annualIncome * 0.75) / 12).toLocaleString()}/mo (used in serviceability calc)
            </div>
          </div>
          <div className="control-group">
            <label className="control-label" title="Do not include the new mortgage repayment here. This is for existing obligations only.">
              Other Monthly Debt (Exclude New Loan)
            </label>
            <input type="number" className="premium-input" value={monthlyDebt}
              onChange={(e) => updateProfile('monthlyDebt', Number(e.target.value) || 0)} min={0} step={100} placeholder="e.g. 0" />
          </div>
          <div className="control-group">
            <label className="control-label">Interest Rate ({interestRate}%)</label>
            <input type="number" className="premium-input" value={interestRate}
              onChange={(e) => updateProfile('interestRate', Number(e.target.value) || 0)} min={1} max={15} step={0.1} />
          </div>
          <div className="control-group">
            <label className="control-label">Serviceability Buffer (+{bufferRate}%)</label>
            <input type="number" className="premium-input" value={bufferRate}
              onChange={(e) => updateProfile('bufferRate', Number(e.target.value) || 0)} min={0} max={5} step={0.5} />
          </div>
        </div>

        {calc && (
          <div className="state-summary-grid u-e87e972e">
            {Object.entries(calc).map(([state, c]) => (
              <div key={state} className="state-summary-card" style={{ borderTop: c.limitedBy === 'Serviceability' ? '3px solid #ef4444' : '3px solid var(--accent-cyan)' }}>
                <div className="state-summary-name">{state}</div>
                <div className="state-summary-value">${c.maxPrice.toLocaleString()}</div>
                <div className="state-summary-label">Maximum Purchase Price</div>
                <div className="state-summary-detail u-15d9cd55">Max Borrowing: <strong>${c.maxBorrow.toLocaleString()}</strong></div>
                <div className="state-summary-detail">Upfront Stamp Duty: <strong>${c.stampDutyForMax.toLocaleString()}</strong></div>
                <div className="state-summary-detail">Est. LMI (Capitalised): <strong>${c.lmiForMax.toLocaleString()}</strong></div>
                {c.fhbgEligible && (
                   <div className="state-summary-detail u-8cbe957b">
                     ✓ First Home Guarantee (LMI Waived)
                   </div>
                )}
                <div className="state-summary-detail u-34e9f803" style={{color: c.limitedBy === 'Serviceability' ? '#ef4444' : 'var(--accent-cyan)'}}>
                  Limited by: {c.limitedBy}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="u-63da5dba">
          <button
            onClick={handleOpenBuyFinder}
            className="u-5613230d">
            Open Buy Finder for Suburb Ranking
          </button>
          <div className="u-b4bf56d8">
            This calculator does not rank suburbs. Buy Finder is the only ranking tool.
          </div>
        </div>
      </div>
    </div>
  );
})
