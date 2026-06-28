import { useState, useMemo } from 'react';
import { mockSuburbsData, calculateMaxPurchase } from '../data/suburbs';

type SortKey = 'name' | 'medianPrice' | 'growthScore' | 'rentalYield' | 'schoolQuality' | 'transitAccessibility' | 'cbdDistanceMins' | 'state';

export default function AffordabilityCalculator() {
  const [deposit, setDeposit] = useState<number>(150000);
  const [lvrPct, setLvrPct] = useState<number>(80);
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('growthScore');
  const [sortAsc, setSortAsc] = useState(false);

  const lvr = lvrPct / 100;
  const states = useMemo(() => ['ALL', ...Array.from(new Set(mockSuburbsData.map(s => s.state)))], []);

  const calc = useMemo(() => {
    if (!deposit || deposit <= 0) return null;
    return {
      NSW: calculateMaxPurchase(deposit, 'NSW', lvr),
      VIC: calculateMaxPurchase(deposit, 'VIC', lvr),
      QLD: calculateMaxPurchase(deposit, 'QLD', lvr),
      WA: calculateMaxPurchase(deposit, 'WA', lvr),
      SA: calculateMaxPurchase(deposit, 'SA', lvr),
      TAS: calculateMaxPurchase(deposit, 'TAS', lvr),
      ACT: calculateMaxPurchase(deposit, 'ACT', lvr),
      NT: calculateMaxPurchase(deposit, 'NT', lvr),
    };
  }, [deposit, lvr]);

  const matchingSuburbs = useMemo(() => {
    if (!deposit || deposit <= 0) return [];
    let filtered = mockSuburbsData.filter(s => {
      const stateCalc = calc?.[s.state as keyof typeof calc];
      if (!stateCalc) return false;
      return s.metrics.medianPrice <= stateCalc.maxPrice;
    });
    if (stateFilter !== 'ALL') {
      filtered = filtered.filter(s => s.state === stateFilter);
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'medianPrice': cmp = a.metrics.medianPrice - b.metrics.medianPrice; break;
        case 'growthScore': cmp = a.growthScore - b.growthScore; break;
        case 'rentalYield': cmp = a.metrics.rentalYield - b.metrics.rentalYield; break;
        case 'schoolQuality': cmp = a.metrics.schoolQuality - b.metrics.schoolQuality; break;
        case 'transitAccessibility': cmp = a.metrics.transitAccessibility - b.metrics.transitAccessibility; break;
        case 'cbdDistanceMins': {
          const aVal = a.cbdDistanceMins ?? 999;
          const bVal = b.cbdDistanceMins ?? 999;
          cmp = aVal - bVal;
          break;
        }
        case 'state': cmp = a.state.localeCompare(b.state); break;
        default: cmp = 0;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [deposit, calc, stateFilter, sortBy, sortAsc]);

  return (
    <div className="affordability-container">
      <div className="glass-card calculator-card">
        <h2 className="detail-title">Affordability Calculator</h2>
        <p className="subtitle">See what you can buy based on your deposit (80% LVR + stamp duty)</p>

        <div className="calculator-inputs">
          <div className="control-group">
            <label className="control-label">Your Deposit (AUD)</label>
            <input
              type="number"
              className="premium-input"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value) || 0)}
              min={10000}
              step={10000}
              placeholder="e.g. 150000"
            />
          </div>
          <div className="control-group">
            <label className="control-label">Max LVR ({lvrPct}%)</label>
            <div className="range-with-value">
              <input type="range" className="premium-range" min={50} max={80} step={5} value={lvrPct} onChange={(e) => setLvrPct(Number(e.target.value))} />
              <span className="range-value">{lvrPct}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">State Filter (optional)</label>
            <div className="custom-select-wrapper">
              <select className="premium-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                {states.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {calc && (
          <div className="state-summary-grid">
            {Object.entries(calc).map(([state, c]) => (
              <div key={state} className="state-summary-card">
                <div className="state-summary-name">{state}</div>
                <div className="state-summary-value">${c.maxPrice.toLocaleString()}</div>
                <div className="state-summary-label">Max Purchase Price</div>
                <div className="state-summary-detail">Borrow: ${c.maxBorrow.toLocaleString()}</div>
                <div className="state-summary-detail">Stamp Duty: ${c.stampDutyForMax.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {matchingSuburbs.length > 0 && (
        <div className="glass-card matching-suburbs-card">
          <div className="matching-header">
            <h3>Suburbs You Can Afford ({matchingSuburbs.length})</h3>
            <div className="sort-controls">
              <label className="sort-label">Sort by:</label>
              <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
                <option value="growthScore">Growth Score</option>
                <option value="medianPrice">Median Price</option>
                <option value="rentalYield">Rental Yield</option>
                <option value="schoolQuality">School Quality</option>
                <option value="transitAccessibility">Transit Access</option>
                <option value="cbdDistanceMins">CBD Distance</option>
                <option value="name">Name</option>
                <option value="state">State</option>
              </select>
              <button className="sort-direction" onClick={() => setSortAsc(!sortAsc)} title="Toggle sort direction">
                {sortAsc ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="schools-table">
              <thead>
                <tr>
                  <th>Suburb</th>
                  <th>State</th>
                  <th>Med. Price</th>
                  <th>Growth</th>
                  <th>Yield</th>
                  <th>Schools</th>
                  <th>Transit</th>
                  <th>Metro CBD</th>
                </tr>
              </thead>
              <tbody>
                {matchingSuburbs.map(suburb => {
                  const stateCalc = calc?.[suburb.state as keyof typeof calc];
                  const priceGap = stateCalc ? stateCalc.maxPrice - suburb.metrics.medianPrice : 0;
                  return (
                    <tr key={suburb.id} className={priceGap > 50000 ? 'good-value' : ''}>
                      <td className="school-name-cell">
                        <strong>{suburb.name}</strong>
                        <span className="postcode-sub">{suburb.postcode}</span>
                      </td>
                      <td>{suburb.state}</td>
                      <td className={priceGap > 0 ? 'text-success' : 'text-warning'}>
                        ${suburb.metrics.medianPrice.toLocaleString()}
                      </td>
                      <td>
                        <span className={`growth-badge ${suburb.growthScore >= 80 ? 'growth-high' : suburb.growthScore >= 60 ? 'growth-med' : 'growth-low'}`}>
                          {suburb.growthScore}
                        </span>
                      </td>
                      <td>{suburb.metrics.rentalYield}%</td>
                      <td>{suburb.metrics.schoolQuality}/10</td>
                      <td>{suburb.metrics.transitAccessibility}/10</td>
                      <td>
                        {suburb.cbdDistanceMins !== null ? (
                          <span title={`To ${suburb.metroCBD}`}>{suburb.cbdDistanceMins} min</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deposit > 0 && matchingSuburbs.length === 0 && (
        <div className="glass-card empty-state-card">
          <p>No suburbs match your affordability criteria. Try increasing your deposit or broadening the state filter.</p>
        </div>
      )}
    </div>
  );
}
