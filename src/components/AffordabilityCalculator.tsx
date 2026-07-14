import { useState, useMemo, memo } from 'react';
import { calculateMaxPurchase } from '../data/suburbs';

export default memo(function AffordabilityCalculator({ setActiveTab }: { suburbsData?: any[]; setActiveTab?: (t: string) => void }) {
  const [deposit, setDeposit] = useState<number>(150000);
  const [lvrPct, setLvrPct] = useState<number>(80);

  const lvr = lvrPct / 100;

  const calc = useMemo(() => {
    if (!deposit || deposit <= 0) return null;
    return {
      NSW: calculateMaxPurchase(deposit, 'NSW', lvr),
      VIC: calculateMaxPurchase(deposit, 'VIC', lvr),
      QLD: calculateMaxPurchase(deposit, 'QLD', lvr),
      WA: calculateMaxPurchase(deposit, 'WA', lvr),
      SA: calculateMaxPurchase(deposit, 'SA', lvr),
      TAS: calculateMaxPurchase(deposit, 'TAS', lvr),
    };
  }, [deposit, lvr]);

  const handleOpenBuyFinder = () => {
    if (setActiveTab) setActiveTab('buy-finder');
  };

  return (
    <div className="affordability-container">
      <div className="glass-card calculator-card">
        <h2 className="detail-title">Price Ceiling Calculator</h2>
        <p className="subtitle">Quick planning tool: estimate your maximum purchase price from deposit and LVR.</p>
        <div style={{ background: 'rgba(14,165,233,0.08)', color: 'var(--accent-cyan)', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(14,165,233,0.2)' }}>
          This is an indicative estimate, not a lender pre-approval. For full suburb ranking with affordability based on your income, debt, and borrowing capacity, use <strong>Buy Finder</strong> — the only screen that produces a suburb shortlist.
        </div>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <span role="img" aria-label="Warning">⚠️</span> Stamp duty rates are indicative only. Consult a conveyancer.
        </div>

        <div className="calculator-inputs">
          <div className="control-group">
            <label className="control-label">Your Deposit (AUD)</label>
            <input type="number" className="premium-input" value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value) || 0)} min={10000} step={10000} placeholder="e.g. 150000" />
          </div>
          <div className="control-group">
            <label className="control-label">Max LVR ({lvrPct}%)</label>
            <div className="range-with-value">
              <input type="range" className="premium-range" min={50} max={80} step={5} value={lvrPct} onChange={(e) => setLvrPct(Number(e.target.value))} />
              <span className="range-value">{lvrPct}%</span>
            </div>
          </div>
        </div>

        {calc && (
          <div className="state-summary-grid">
            {Object.entries(calc).map(([state, c]) => (
              <div key={state} className="state-summary-card">
                <div className="state-summary-name">{state}</div>
                <div className="state-summary-value">${c.maxPrice.toLocaleString()}</div>
                <div className="state-summary-label">Maximum Purchase Price</div>
                <div className="state-summary-detail">Borrow: ${c.maxBorrow.toLocaleString()}</div>
                <div className="state-summary-detail">Stamp Duty: ${c.stampDutyForMax.toLocaleString()}</div>
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
