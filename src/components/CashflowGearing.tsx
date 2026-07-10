import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { calculateComprehensiveStampDuty } from '../data/suburbs';
import type { SuburbData } from '../data/suburbs';

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
  taxBenefit: number;
  netAfterTax: number;
  pmFee: number;
  maintenance: number;
  fixedCosts: number;
}

interface CashflowGearingProps {
  suburbsData: SuburbData[];
  defaultSuburbId?: string;
  defaultPrice?: number;
  defaultRent?: number;
}

export default function CashflowGearing({ suburbsData, defaultSuburbId, defaultPrice, defaultRent }: CashflowGearingProps) {
  const [selectedSuburbId, setSelectedSuburbId] = useState<string>(defaultSuburbId || '');
  const [purchasePrice, setPurchasePrice] = useState<number>(defaultPrice || 700000);
  const [weeklyRent, setWeeklyRent] = useState<number>(defaultRent || 550);
  const [purchaseType, setPurchaseType] = useState<'personal' | 'smsf'>('personal');
  const [depositPct, setDepositPct] = useState<number>(20);
  const [interestRate, setInterestRate] = useState<number>(6.2);
  const [loanType, setLoanType] = useState<'io' | 'pi'>('io');
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [customCosts, setCustomCosts] = useState<boolean>(false);
  const [ratesBill, setRatesBill] = useState<number>(1800);
  const [waterBill, setWaterBill] = useState<number>(900);
  const [insurance, setInsurance] = useState<number>(1500);
  const [pmFeePct, setPmFeePct] = useState<number>(7.5);
  const [maintenancePct, setMaintenancePct] = useState<number>(0.35);
  const [vacancyWeeks, setVacancyWeeks] = useState<number>(2);
  const [vacancyFromAPI, setVacancyFromAPI] = useState<number | null>(null);
  const [salary, setSalary] = useState<number>(100000);
  const [depreciation, setDepreciation] = useState<number>(8000);
  const [rateLoading, setRateLoading] = useState<boolean>(true);

  // Fetch dynamic interest rate
  useEffect(() => {
    fetch('/api/mortgage-rate')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.effective_mortgage_rate) {
          setInterestRate(data.effective_mortgage_rate);
        }
        setRateLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch dynamic mortgage rate, falling back to default.", err);
        setRateLoading(false);
      });
  }, []);

  // Auto-fill from suburb selection
  useEffect(() => {
    if (selectedSuburbId) {
      const sub = suburbsData.find(s => s.id === selectedSuburbId);
      if (sub) {
        const price = (sub as any).houseMedianPrice ?? sub.metrics?.medianPrice ?? 0;
        setPurchasePrice(price);
        const rent = (sub as any).houseMedianRent ?? (sub as any).weeklyRent ?? sub.metrics?.weeklyRent ?? Math.round(price * ((sub as any).rentalYield ?? sub.metrics?.rentalYield ?? 0) / 100 / 52);
        setWeeklyRent(rent || 0);
        // Auto-set vacancy from real V3 vacancy rate
        const vacRate = (sub as any).vacancyRate ?? (sub as any).metrics?.vacancyRate;
        if (vacRate != null && vacRate > 0) {
          const vacWeeks = Math.max(0.1, (vacRate / 100) * 52);
          setVacancyWeeks(Math.round(vacWeeks * 10) / 10);
          setVacancyFromAPI(vacRate);
        }
      }
    }
  }, [selectedSuburbId, suburbsData]);

  // Handle SMSF mode defaults
  useEffect(() => {
    if (purchaseType === 'smsf') {
      if (depositPct < 30) setDepositPct(30);
      setInterestRate(8.85); // ATO LRBA Safe Harbour Rate 2024-25
    } else {
      setDepositPct(20);
      setInterestRate(6.2); // Typical personal rate
    }
  }, [purchaseType]);

  const stateOptions = useMemo(() =>
    Array.from(new Set(suburbsData.map(s => s.state))).sort(),
    [suburbsData]
  );

  const [filterState, setFilterState] = useState<string>('VIC');
  const suburbOptions = useMemo(() =>
    suburbsData.filter(s => s.state === filterState).sort((a, b) => a.name.localeCompare(b.name)),
    [filterState, suburbsData]
  );

  const result = useMemo((): GearingResult | null => {
    if (!purchasePrice || purchasePrice <= 0) return null;

    const state = selectedSuburbId
      ? suburbsData.find(s => s.id === selectedSuburbId)?.state ?? 'VIC'
      : 'VIC';

    const { totalGovtFees: sd } = calculateComprehensiveStampDuty(purchasePrice, state, false, 'established');
    const deposit = purchasePrice * (depositPct / 100);
    const loanAmount = purchasePrice - deposit;
    const totalUpfront = deposit + sd + 2000; // + conveyancing/legal ~$2K
    const lvr = (loanAmount / purchasePrice) * 100;

    const annualInterest = loanAmount * (interestRate / 100);
    const effectiveRentWeeks = Math.max(0, 52 - vacancyWeeks);
    const annualRent = weeklyRent * effectiveRentWeeks;

    const pmFee = annualRent * (pmFeePct / 100);
    const maintenance = purchasePrice * (maintenancePct / 100);
    const fixedCosts = customCosts ? ratesBill + waterBill + insurance : purchasePrice * 0.0065; // default: ~0.65% of property value
    const annualExpenses = fixedCosts + pmFee + maintenance;

    let netAnnualCashflow: number;
    if (loanType === 'io') {
      netAnnualCashflow = annualRent - annualInterest - annualExpenses;
    } else {
      const r = interestRate / 100 / 12;
      const n = loanTerm * 12;
      const monthlyPI = r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      netAnnualCashflow = annualRent - monthlyPI * 12 - annualExpenses;
    }

    const netWeeklyCashflow = netAnnualCashflow / 52;
    
    // Tax impact
    let taxBenefit = 0;
    const taxablePosition = netAnnualCashflow - depreciation;
    
    if (purchaseType === 'smsf') {
      taxBenefit = taxablePosition < 0 ? Math.abs(taxablePosition) * 0.15 : -(taxablePosition * 0.15);
    } else {
      let marginalRate = 0.0;
      if (salary > 190000) marginalRate = 0.47;
      else if (salary > 135000) marginalRate = 0.39;
      else if (salary > 45000) marginalRate = 0.32;
      else if (salary > 18200) marginalRate = 0.18;
      
      taxBenefit = taxablePosition < 0 ? Math.abs(taxablePosition) * marginalRate : -(taxablePosition * marginalRate);
    }
    const netAfterTax = netAnnualCashflow + taxBenefit;

    const cashOnCashReturn = (netAfterTax / totalUpfront) * 100;

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
      taxBenefit: Math.round(taxBenefit),
      netAfterTax: Math.round(netAfterTax),
      pmFee: Math.round(pmFee),
      maintenance: Math.round(maintenance),
      fixedCosts: Math.round(fixedCosts),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchasePrice, weeklyRent, depositPct, interestRate, loanType, loanTerm,
    customCosts, ratesBill, waterBill, insurance, pmFeePct, maintenancePct,
    vacancyWeeks, selectedSuburbId, purchaseType, salary, depreciation]);

  return (
    <div className="gearing-container">
      <div className="glass-card gearing-card">
        <h2 className="detail-title">Cashflow &amp; Gearing Analysis</h2>
        <p className="subtitle">Project net cashflow, gearing status, and ROI based on current interest rates</p>

        <div className="gearing-grid">
          {/* LEFT: Inputs */}
          <div className="gearing-inputs">
            <div className="control-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                <button 
                  className={`premium-select ${purchaseType === 'personal' ? 'active-type' : ''}`}
                  style={{ flex: 1, border: 'none', background: purchaseType === 'personal' ? 'var(--accent-purple)' : 'transparent', color: purchaseType === 'personal' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setPurchaseType('personal')}
                >
                  Personal Investment
                </button>
                <button 
                  className={`premium-select ${purchaseType === 'smsf' ? 'active-type' : ''}`}
                  style={{ flex: 1, border: 'none', background: purchaseType === 'smsf' ? 'var(--accent-cyan)' : 'transparent', color: purchaseType === 'smsf' ? '#000' : 'var(--text-secondary)' }}
                  onClick={() => setPurchaseType('smsf')}
                >
                  SMSF Purchase (LRBA)
                </button>
              </div>
              {purchaseType === 'smsf' ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '8px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
                  <strong>SMSF Rules applied:</strong> 30% min deposit, 15% tax rate, 8.85% ATO Safe Harbour LRBA interest rate default.
                </div>
              ) : (
                <div className="input-row" style={{ marginTop: '0.5rem' }}>
                  <div className="control-group">
                    <label className="control-label">Gross Income $/yr (Tax Bracket)</label>
                    <input type="number" className="premium-input small" value={salary} onChange={(e) => setSalary(Number(e.target.value) || 0)} step={10000} />
                  </div>
                  <div className="control-group">
                    <label className="control-label">Est. Depreciation $/yr</label>
                    <input type="number" className="premium-input small" value={depreciation} onChange={(e) => setDepreciation(Number(e.target.value) || 0)} step={1000} />
                  </div>
                </div>
              )}
            </div>

            <div className="control-group">
              <label className="control-label">Select Suburb (auto-fills data)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="premium-select" style={{ flex: 1 }} value={filterState} onChange={(e) => { setFilterState(e.target.value); setSelectedSuburbId(''); }}>
                  {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="premium-select" style={{ flex: 2 }} value={selectedSuburbId} onChange={(e) => setSelectedSuburbId(e.target.value)}>
                  <option value="">-- Manual Entry --</option>
                  {suburbOptions.map(s => <option key={s.id} value={s.id}>{s.name} (${(s.metrics?.medianPrice ?? 0).toLocaleString()})</option>)}
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
                <label className="control-label">
                  Interest Rate % p.a. {rateLoading && <span style={{fontSize: '0.8em', color: 'var(--accent-cyan)'}}>(Live fetching...)</span>}
                </label>
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
                <label className="control-label">
                  Vacancy (weeks/year)
                  {vacancyFromAPI != null && <span style={{ color: 'var(--success)', fontSize: '0.7rem', marginLeft: '6px' }}>📊 {vacancyFromAPI}% real data</span>}
                </label>
                <input type="number" className="premium-input small" value={vacancyWeeks} onChange={(e) => setVacancyWeeks(Number(e.target.value) || 0)} min={0} max={8} step={0.5} />
              </div>
              <div className="control-group">
                <label className="control-label">Property Mgmt Fee %</label>
                <input type="number" className="premium-input small" value={pmFeePct} onChange={(e) => setPmFeePct(Number(e.target.value) || 0)} min={0} max={15} step={0.5} />
              </div>
            </div>

            <div className="input-row" style={{ marginTop: '0.5rem' }}>
              <div className="control-group" style={{ flex: '0 0 50%' }}>
                <label className="control-label">Maintenance % /yr</label>
                <input type="number" className="premium-input small" value={maintenancePct} onChange={(e) => setMaintenancePct(Number(e.target.value) || 0)} min={0} max={5} step={0.05} />
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
                      Pre-tax: {result.netWeeklyCashflow > 0 ? '+' : ''}{result.netWeeklyCashflow.toLocaleString()} / wk | Tax-Adjusted: {result.netAfterTax > 0 ? '+' : ''}{Math.round(result.netAfterTax / 52).toLocaleString()} / wk
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
                    <div className="gmetric-detail" style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Property Mgmt:</span><span>${result.pmFee.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Maintenance:</span><span>${result.maintenance.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Fixed (Rates/Ins):</span><span>${result.fixedCosts.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="gmetric">
                    <div className="gmetric-label">Pre-Tax Annual Net</div>
                    <div className={`gmetric-value ${result.netAnnualCashflow > 0 ? 'text-success' : result.netAnnualCashflow >= -2000 ? 'text-warning' : 'highlight-purple'}`}>
                      {result.netAnnualCashflow > 0 ? '+' : ''}{result.netAnnualCashflow.toLocaleString()}
                    </div>
                    <div className="gmetric-detail">Before tax deductions</div>
                  </div>
                  <div className="gmetric gmetric-wide">
                    <div className="gmetric-label">Tax-Adjusted Position</div>
                    <div className={`gmetric-value ${result.netAfterTax > 0 ? 'text-success' : 'highlight-purple'}`}>
                      {result.netAfterTax > 0 ? '+' : ''}{result.netAfterTax.toLocaleString()}
                    </div>
                    <div className="gmetric-detail">Net annual after tax rebate/liability</div>
                  </div>
                  <div className="gmetric gmetric-wide">
                    <div className="gmetric-label">Cash-on-Cash Return</div>
                    <div className={`gmetric-value ${result.cashOnCashReturn > 5 ? 'text-success' : result.cashOnCashReturn > 0 ? 'highlight-cyan' : ''}`}>
                      {result.cashOnCashReturn > 0 ? '+' : ''}{result.cashOnCashReturn}%
                    </div>
                    <div className="gmetric-detail">On ${result.totalUpfront.toLocaleString()} invested</div>
                  </div>
                </div>

                <div className="gearing-breakdown" style={{ marginTop: '2rem', height: '250px' }}>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>Annual Cashflow Waterfall</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Rent Income', value: result.annualRent, fill: 'var(--accent-green, #10b981)' },
                        { name: 'Interest', value: -result.annualInterest, fill: 'var(--warning, #ef4444)' },
                        { name: 'Expenses', value: -result.annualExpenses, fill: '#f59e0b' },
                        { name: 'Pre-Tax Net', value: result.netAnnualCashflow, fill: result.netAnnualCashflow > 0 ? 'var(--accent-green, #10b981)' : 'var(--warning, #ef4444)' },
                        { name: 'Tax Impact', value: result.taxBenefit, fill: result.taxBenefit > 0 ? 'var(--accent-cyan)' : 'var(--warning, #ef4444)' },
                        { name: 'Tax-Adjusted', value: result.netAfterTax, fill: result.netAfterTax > 0 ? 'var(--accent-green, #10b981)' : 'var(--warning, #ef4444)' }
                      ]}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} interval={0} tick={{fill: 'var(--text-secondary)'}} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `$${Math.abs(val / 1000)}k`} />
                      <Tooltip 
                        formatter={(value: number) => [`$${Math.abs(value).toLocaleString()}`, value < 0 ? 'Cost' : 'Income']}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {
                          [
                            { name: 'Rent Income', value: result.annualRent, fill: 'var(--accent-green, #10b981)' },
                            { name: 'Interest', value: -result.annualInterest, fill: 'var(--warning, #ef4444)' },
                            { name: 'Expenses', value: -result.annualExpenses, fill: '#f59e0b' },
                            { name: 'Pre-Tax Net', value: result.netAnnualCashflow, fill: result.netAnnualCashflow > 0 ? 'var(--accent-green, #10b981)' : 'var(--warning, #ef4444)' },
                            { name: 'Tax Impact', value: result.taxBenefit, fill: result.taxBenefit > 0 ? 'var(--accent-cyan)' : 'var(--warning, #ef4444)' },
                            { name: 'Tax-Adjusted', value: result.netAfterTax, fill: result.netAfterTax > 0 ? 'var(--accent-green, #10b981)' : 'var(--warning, #ef4444)' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                <th>Net/wk (Tax-Adj.)</th>
                <th>CoC Return</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suburbOptions.map(suburb => {
                const price = suburb.metrics.medianPrice;
                const rent = suburb.metrics.weeklyRent ?? Math.round(price * suburb.metrics.rentalYield / 100 / 52);
                const state = suburb.state;
                const { totalGovtFees: sd } = calculateComprehensiveStampDuty(price, state, false, 'established');
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
                  const mpi = r === 0 ? loan / n : loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                  netAnnual = annualRent - mpi * 12 - expenses;
                }
                
                let tBenefit = 0;
                if (purchaseType === 'smsf') {
                  tBenefit = netAnnual < 0 ? Math.abs(netAnnual) * 0.15 : -(netAnnual * 0.15);
                } else {
                  tBenefit = netAnnual < 0 ? Math.abs(netAnnual) * 0.37 : -(netAnnual * 0.37);
                }
                const netAfterTax = netAnnual + tBenefit;
                
                const netWk = netAfterTax / 52;
                const coc = (netAfterTax / upfront) * 100;
                const status = netAnnual / 52 > 20 ? 'pos' : netAnnual / 52 >= -20 ? 'neut' : 'neg';

                return (
                  <tr key={suburb.id} className={`gearing-row-${status}`}>
                    <td className="school-name-cell">{suburb.name}</td>
                    <td>${price.toLocaleString()}</td>
                    <td>${rent}/wk</td>
                    <td>${Math.round(upfront).toLocaleString()}</td>
                    <td className={netWk > 0 ? 'text-success' : netWk >= -100 ? 'text-warning' : 'highlight-purple'} title="Net after tax">
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
