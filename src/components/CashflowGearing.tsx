import { useState, useMemo } from 'react';
import { mockSuburbsData, calculateStampDuty } from '../data/suburbs';

interface GearingResult {
  purchasePrice: number;
  stampDuty: number;
  totalUpfront: number;
  loanAmount: number;
  annualInterest: number;
  annualRent: number;
  annualExpenses: number;
  netAnnualCashflow: number;
  netWeeklyCashflow: number;
  cashOnCashReturn: number;
  gearingStatus: 'positive' | 'neutral' | 'negative';
  lvr: number;
}

export default function CashflowGearing() {
  const [selectedSuburbId, setSelectedSuburbId] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<number>(700000);
  const [weeklyRent, setWeeklyRent] = useState<number>(550);
  const [depositPct, setDepositPct] = useState<number>(20);
  const [interestRate, setInterestRate] = useState<number>(6.2);
  const [loanType, setLoanType] = useState<'io' | 'pi'>('io');
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [customCosts, setCustomCosts] = useState<boolean>(false);
  const [ratesBill, setRatesBill] = useState<number>(1800);
  const [waterBill, setWaterBill] = useState<number>(900);
  const [insurance, setInsurance] = useState<number>(1500);
  const [pmFeePct, setPmFeePct] = useState<number>(7.5);
  const maintenancePct = 1.0;
  const [vacancyWeeks, setVacancyWeeks] = useState<number>(2);

  // Auto-fill from suburb selection
  useMemo(() => {
    if (selectedSuburbId) {
      const sub = mockSuburbsData.find(s => s.id === selectedSuburbId);
      if (sub) {
        setPurchasePrice(sub.metrics.medianPrice);
        const rent = sub.metrics.weeklyRent ?? Math.round(sub.metrics.medianPrice * sub.metrics.rentalYield / 100 / 52);
        setWeeklyRent(rent);
      }
    }
  }, [selectedSuburbId]);

  const stateOptions = useMemo(() =>
    Array.from(new Set(mockSuburbsData.map(s => s.state))).sort(),
    []
  );

  const [filterState, setFilterState] = useState<string>('VIC');
  const suburbOptions = useMemo(() =>
    mockSuburbsData.filter(s => s.state === filterState).sort((a, b) => a.name.localeCompare(b.name)),
    [filterState]
  );

  const result = useMemo((): GearingResult | null => {
    if (!purchasePrice || purchasePrice <= 0) return null;

    const state = selectedSuburbId
      ? mockSuburbsData.find(s => s.id === selectedSuburbId)?.state ?? 'VIC'
      : 'VIC';

    const sd = calculateStampDuty(purchasePrice, state);
    const deposit = purchasePrice * (depositPct / 100);
    const loanAmount = purchasePrice - deposit;
    const totalUpfront = deposit + sd + 2000; // + conveyancing/legal ~$2K
    const lvr = (loanAmount / purchasePrice) * 100;

    const annualInterest = loanAmount * (interestRate / 100);
    const effectiveRentWeeks = Math.max(0, 52 - vacancyWeeks);
    const annualRent = weeklyRent * effectiveRentWeeks;

    const pmFee = annualRent * (pmFeePct / 100);
    const maintenance = purchasePrice * (maintenancePct / 100);
    const annualExpenses = (customCosts
      ? ratesBill + waterBill + insurance
      : purchasePrice * 0.0065 // default: ~0.65% of property value
    ) + pmFee + maintenance;

    let netAnnualCashflow: number;
    if (loanType === 'io') {
      netAnnualCashflow = annualRent - annualInterest - annualExpenses;
    } else {
      const r = interestRate / 100 / 12;
      const n = loanTerm * 12;
      const monthlyPI = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      netAnnualCashflow = annualRent - monthlyPI * 12 - annualExpenses;
    }

    const netWeeklyCashflow = netAnnualCashflow / 52;
    const cashOnCashReturn = (netAnnualCashflow / totalUpfront) * 100;

    let gearingStatus: 'positive' | 'neutral' | 'negative' = 'negative';
    if (netWeeklyCashflow > 20) gearingStatus = 'positive';
    else if (netWeeklyCashflow >= -20) gearingStatus = 'neutral';

    return {
      purchasePrice,
      stampDuty: Math.round(sd),
      totalUpfront: Math.round(totalUpfront),
      loanAmount: Math.round(loanAmount),
      annualInterest: Math.round(annualInterest),
      annualRent: Math.round(annualRent),
      annualExpenses: Math.round(annualExpenses),
      netAnnualCashflow: Math.round(netAnnualCashflow),
      netWeeklyCashflow: Math.round(netWeeklyCashflow),
      cashOnCashReturn: Math.round(cashOnCashReturn * 10) / 10,
      gearingStatus,
      lvr: Math.round(lvr * 10) / 10,
    };
  }, [purchasePrice, weeklyRent, depositPct, interestRate, loanType, loanTerm,
    customCosts, ratesBill, waterBill, insurance, pmFeePct, maintenancePct,
    vacancyWeeks, selectedSuburbId]);

  return (
    <div className="gearing-container">
      <div className="glass-card gearing-card">
        <h2 className="detail-title">Cashflow &amp; Gearing Analysis</h2>
        <p className="subtitle">Project net cashflow, gearing status, and ROI based on current interest rates</p>

        <div className="gearing-grid">
          {/* LEFT: Inputs */}
          <div className="gearing-inputs">
            <div className="control-group">
              <label className="control-label">Select Suburb (auto-fills data)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="premium-select" style={{ flex: 1 }} value={filterState} onChange={(e) => { setFilterState(e.target.value); setSelectedSuburbId(''); }}>
                  {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="premium-select" style={{ flex: 2 }} value={selectedSuburbId} onChange={(e) => setSelectedSuburbId(e.target.value)}>
                  <option value="">-- Manual Entry --</option>
                  {suburbOptions.map(s => <option key={s.id} value={s.id}>{s.name} (${s.metrics.medianPrice.toLocaleString()})</option>)}
                </select>
              </div>
            </div>

            <div className="input-row">
              <div className="control-group">
                <label className="control-label">Purchase Price $</label>
                <input type="number" className="premium-input" value={purchasePrice} onChange={(e) => { setPurchasePrice(Number(e.target.value) || 0); setSelectedSuburbId(''); }} step={10000} />
              </div>
              <div className="control-group">
                <label className="control-label">Weekly Rent $</label>
                <input type="number" className="premium-input" value={weeklyRent} onChange={(e) => { setWeeklyRent(Number(e.target.value) || 0); setSelectedSuburbId(''); }} step={10} />
              </div>
            </div>

            <div className="input-row">
              <div className="control-group">
                <label className="control-label">Deposit % (LVR: {100 - depositPct}%)</label>
                <div className="range-with-value">
                  <input type="range" className="premium-range" min={20} max={50} step={5} value={depositPct} onChange={(e) => setDepositPct(Number(e.target.value))} />
                  <span className="range-value">{depositPct}%</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Max LVR 80% (investment loan standard)
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Interest Rate % p.a.</label>
                <input type="number" className="premium-input" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value) || 0)} step={0.05} min={1} max={15} />
              </div>
            </div>

            <div className="input-row">
              <div className="control-group">
                <label className="control-label">Loan Type</label>
                <div className="toggle-group">
                  <button className={`toggle-option ${loanType === 'io' ? 'toggle-active' : ''}`} onClick={() => setLoanType('io')}>Interest Only</button>
                  <button className={`toggle-option ${loanType === 'pi' ? 'toggle-active' : ''}`} onClick={() => setLoanType('pi')}>P&amp;I</button>
                </div>
              </div>
              {loanType === 'pi' && (
                <div className="control-group">
                  <label className="control-label">Loan Term (years)</label>
                  <input type="number" className="premium-input" value={loanTerm} onChange={(e) => setLoanTerm(Number(e.target.value) || 30)} min={5} max={40} />
                </div>
              )}
            </div>

            <div className="input-row">
              <div className="control-group">
                <label className="control-label">Vacancy (weeks/year)</label>
                <input type="number" className="premium-input small" value={vacancyWeeks} onChange={(e) => setVacancyWeeks(Number(e.target.value) || 0)} min={0} max={8} step={1} />
              </div>
              <div className="control-group">
                <label className="control-label">Property Mgmt Fee %</label>
                <input type="number" className="premium-input small" value={pmFeePct} onChange={(e) => setPmFeePct(Number(e.target.value) || 0)} min={0} max={15} step={0.5} />
              </div>
            </div>

            <label className="toggle-label" style={{ marginTop: '0.5rem' }}>
              <input type="checkbox" checked={customCosts} onChange={(e) => setCustomCosts(e.target.checked)} />
              <span>Custom holding costs</span>
            </label>
            {customCosts && (
              <div className="input-row" style={{ marginTop: '0.5rem' }}>
                <div className="control-group">
                  <label className="control-label">Rates $/yr</label>
                  <input type="number" className="premium-input small" value={ratesBill} onChange={(e) => setRatesBill(Number(e.target.value) || 0)} />
                </div>
                <div className="control-group">
                  <label className="control-label">Water $/yr</label>
                  <input type="number" className="premium-input small" value={waterBill} onChange={(e) => setWaterBill(Number(e.target.value) || 0)} />
                </div>
                <div className="control-group">
                  <label className="control-label">Insurance $/yr</label>
                  <input type="number" className="premium-input small" value={insurance} onChange={(e) => setInsurance(Number(e.target.value) || 0)} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Results */}
          <div className="gearing-results">
            {result ? (
              <>
                <div className={`gearing-status-banner ${result.gearingStatus}`}>
                  <span className="gearing-status-icon">
                    {result.gearingStatus === 'positive' ? '📈' : result.gearingStatus === 'neutral' ? '⚖️' : '📉'}
                  </span>
                  <div>
                    <div className="gearing-status-label">
                      {result.gearingStatus === 'positive' ? 'POSITIVE GEARING'
                        : result.gearingStatus === 'neutral' ? 'NEUTRAL GEARING'
                        : 'NEGATIVE GEARING'}
                    </div>
                    <div className="gearing-status-sub">
                      {result.netWeeklyCashflow > 0 ? '+' : ''}{result.netWeeklyCashflow.toLocaleString()} / week
                    </div>
                  </div>
                </div>

                <div className="gearing-metrics">
                  <div className="gmetric">
                    <div className="gmetric-label">Total Upfront</div>
                    <div className="gmetric-value">${result.totalUpfront.toLocaleString()}</div>
                    <div className="gmetric-detail">Deposit: ${(result.purchasePrice * depositPct / 100).toLocaleString()} + SD: ${result.stampDuty.toLocaleString()}</div>
                  </div>
                  <div className="gmetric">
                    <div className="gmetric-label">Loan / LVR</div>
                    <div className="gmetric-value">${result.loanAmount.toLocaleString()}</div>
                    <div className="gmetric-detail">LVR: {result.lvr}%</div>
                  </div>
                  <div className="gmetric">
                    <div className="gmetric-label">Annual Interest</div>
                    <div className="gmetric-value">${result.annualInterest.toLocaleString()}</div>
                    <div className="gmetric-detail">At {interestRate}% p.a.</div>
                  </div>
                  <div className="gmetric">
                    <div className="gmetric-label">Annual Rent</div>
                    <div className="gmetric-value highlight-cyan">${result.annualRent.toLocaleString()}</div>
                    <div className="gmetric-detail">Gross yield: {((result.annualRent / result.purchasePrice) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="gmetric">
                    <div className="gmetric-label">Annual Expenses</div>
                    <div className="gmetric-value">${result.annualExpenses.toLocaleString()}</div>
                    <div className="gmetric-detail">Incl. PM, maintenance, rates, insurance</div>
                  </div>
                  <div className="gmetric">
                    <div className="gmetric-label">Net Annual Cashflow</div>
                    <div className={`gmetric-value ${result.netAnnualCashflow > 0 ? 'text-success' : result.netAnnualCashflow >= -2000 ? 'text-warning' : 'highlight-purple'}`}>
                      {result.netAnnualCashflow > 0 ? '+' : ''}{result.netAnnualCashflow.toLocaleString()}
                    </div>
                    <div className="gmetric-detail">Tax deduction potential on losses</div>
                  </div>
                  <div className="gmetric gmetric-wide">
                    <div className="gmetric-label">Cash-on-Cash Return</div>
                    <div className={`gmetric-value ${result.cashOnCashReturn > 5 ? 'text-success' : result.cashOnCashReturn > 0 ? 'highlight-cyan' : ''}`}>
                      {result.cashOnCashReturn > 0 ? '+' : ''}{result.cashOnCashReturn}%
                    </div>
                    <div className="gmetric-detail">On ${result.totalUpfront.toLocaleString()} invested</div>
                  </div>
                </div>

                <div className="gearing-breakdown">
                  <div className="breakdown-bar">
                    <div className="breakdown-segment income-segment" style={{
                      width: `${Math.min(100, (result.annualRent / Math.max(result.annualInterest + result.annualExpenses, 1)) * 100)}%`
                    }} title={`Rent: $${result.annualRent.toLocaleString()}`} />
                  </div>
                  <div className="breakdown-legend">
                    <span>Income: ${result.annualRent.toLocaleString()}/yr</span>
                    <span>Costs: ${(result.annualInterest + result.annualExpenses).toLocaleString()}/yr</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card empty-state">
                <p>Enter a purchase price and weekly rent to see cashflow projections.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Compare Table */}
      <div className="glass-card gearing-card">
        <h3>Quick Gearing Comparison — Selected State Suburbs</h3>
        <p className="subtitle">Based on median price, {interestRate}% interest, {depositPct}% deposit, {loanType === 'io' ? 'interest-only' : 'P&I'} loan</p>

        <div className="table-responsive">
          <table className="schools-table">
            <thead>
              <tr>
                <th>Suburb</th>
                <th>Med. Price</th>
                <th>Rent/wk</th>
                <th>Upfront</th>
                <th>Net/wk</th>
                <th>CoC Return</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suburbOptions.map(suburb => {
                const price = suburb.metrics.medianPrice;
                const rent = suburb.metrics.weeklyRent ?? Math.round(price * suburb.metrics.rentalYield / 100 / 52);
                const state = suburb.state;
                const sd = calculateStampDuty(price, state);
                const deposit = price * (depositPct / 100);
                const loan = price - deposit;
                const upfront = deposit + sd + 2000;
                const annualInt = loan * (interestRate / 100);
                const annualRent = rent * (52 - vacancyWeeks);
                const expenses = price * 0.0065 + annualRent * (pmFeePct / 100) + price * (maintenancePct / 100);
                let netAnnual: number;
                if (loanType === 'io') {
                  netAnnual = annualRent - annualInt - expenses;
                } else {
                  const r = interestRate / 100 / 12;
                  const n = loanTerm * 12;
                  const mpi = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  netAnnual = annualRent - mpi * 12 - expenses;
                }
                const netWk = netAnnual / 52;
                const coc = (netAnnual / upfront) * 100;
                const status = netWk > 20 ? 'pos' : netWk >= -20 ? 'neut' : 'neg';

                return (
                  <tr key={suburb.id} className={`gearing-row-${status}`}>
                    <td className="school-name-cell">{suburb.name}</td>
                    <td>${price.toLocaleString()}</td>
                    <td>${rent}/wk</td>
                    <td>${Math.round(upfront).toLocaleString()}</td>
                    <td className={netWk > 0 ? 'text-success' : netWk >= -100 ? 'text-warning' : 'highlight-purple'}>
                      {netWk > 0 ? '+' : ''}{Math.round(netWk).toLocaleString()}
                    </td>
                    <td className={coc > 5 ? 'text-success' : coc > 0 ? 'highlight-cyan' : ''}>
                      {coc > 0 ? '+' : ''}{Math.round(coc * 10) / 10}%
                    </td>
                    <td>
                      <span className={`type-badge type-${status === 'pos' ? 'secondary' : status === 'neut' ? 'primary' : 'combined'}`}>
                        {status === 'pos' ? 'POSITIVE' : status === 'neut' ? 'NEUTRAL' : 'NEGATIVE'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
