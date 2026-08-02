import { useState, useMemo, useEffect, memo } from 'react';
import type { SuburbData } from '../data/suburbs';

interface MyPurchasePlanProps {
  suburbsData: SuburbData[];
}

type BuyerProfile = 'First Home Buyer' | 'Upgrader' | 'Investor' | 'SMSF Investor';

export default memo(function MyPurchasePlan({ suburbsData }: MyPurchasePlanProps) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<BuyerProfile | ''>(() => (localStorage.getItem('mpp_profile') as BuyerProfile || ''));
  
  // Budget States
  const [salary, setSalary] = useState<number>(() => Number(localStorage.getItem('mpp_salary') || 100000));
  const [savings, setSavings] = useState<number>(() => Number(localStorage.getItem('mpp_savings') || 50000));
  const [equity, setEquity] = useState<number>(() => Number(localStorage.getItem('mpp_equity') || 0));
  
  // Serviceability States
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(() => Number(localStorage.getItem('mpp_expenses') || 3000));
  const [currentRate, setCurrentRate] = useState<number>(() => Number(localStorage.getItem('mpp_currentRate') || 6.5));
  const [superRate, setSuperRate] = useState<number>(() => Number(localStorage.getItem('mpp_superRate') || 11.5));
  
  // Calculate Serviceability
  const serviceability = useMemo(() => {
    const monthlyIncomeGross = salary / 12;
    const monthlyIncomeNetSuper = monthlyIncomeGross * (1 - (superRate / 100));
    const netDisposableIncome = monthlyIncomeNetSuper - monthlyExpenses;
    
    // Stress test: current rate + 3%
    const stressRate = (currentRate + 3) / 100;
    const monthlyRate = stressRate / 12;
    const numPayments = 30 * 12;
    
    // PV = PMT * (1 - (1+r)^-n) / r
    const maxLoanAmount = netDisposableIncome > 0 
      ? netDisposableIncome * ((1 - Math.pow(1 + monthlyRate, -numPayments)) / monthlyRate)
      : 0;
      
    const depositAvailable = savings + equity;
    // Max purchase limited by deposit (20% rule) OR borrowing capacity
    const maxPurchaseByDeposit = depositAvailable * 5;
    const maxPurchaseByServiceability = maxLoanAmount + depositAvailable;
    const trueMaxPurchase = Math.min(maxPurchaseByDeposit, maxPurchaseByServiceability);

    return { netDisposableIncome, maxLoanAmount, trueMaxPurchase, depositAvailable, maxPurchaseByDeposit };
  }, [salary, superRate, monthlyExpenses, currentRate, savings, equity]);

  useEffect(() => {
    localStorage.setItem('mpp_profile', profile);
    localStorage.setItem('mpp_salary', salary.toString());
    localStorage.setItem('mpp_savings', savings.toString());
    localStorage.setItem('mpp_equity', equity.toString());
    localStorage.setItem('mpp_expenses', monthlyExpenses.toString());
    localStorage.setItem('mpp_currentRate', currentRate.toString());
    localStorage.setItem('mpp_superRate', superRate.toString());
    localStorage.setItem('mpp_trueMaxPurchase', serviceability.trueMaxPurchase.toString());
  }, [profile, salary, savings, equity, monthlyExpenses, currentRate, superRate, serviceability.trueMaxPurchase]);
  
  // Suburb Shortlist (IDs)
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const nextStep = () => setStep(s => Math.min(s + 1, 6));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  // Step 3 Suburb filtering
  const availableSuburbs = useMemo(() => {
    return suburbsData
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.postcode.includes(searchQuery))
      .filter(s => !shortlist.includes(s.id));
  }, [suburbsData, searchQuery, shortlist]);

  const shortlistedSuburbs = useMemo(() => {
    return shortlist.map(id => suburbsData.find(s => s.id === id)).filter((s): s is SuburbData => s != null);
  }, [shortlist, suburbsData]);

  const toggleShortlist = (id: string) => {
    if (shortlist.includes(id)) {
      setShortlist(shortlist.filter(x => x !== id));
    } else if (shortlist.length < 3) {
      setShortlist([...shortlist, id]);
    }
  };

  const renderStepIndicator = () => (
    <div className="u-65b2947c">
      <div className="u-2bad0c43"></div>
      {[1, 2, 3, 4, 5, 6].map(s => (
        <div key={s} className="u-dadbcf09" style={{background: s <= step ? 'var(--accent-purple)' : 'var(--bg-card)', color: s <= step ? '#fff' : 'var(--text-muted)'}}>
          {s}
        </div>
      ))}
    </div>
  );

  return (
    <div className="content-wrapper animate-fade-in u-3e72e63f">
      <div className="glass-card u-07c22548">
        <h2 className="u-f4f4fabb">My Purchase Plan</h2>
        {renderStepIndicator()}

        <div className="u-52dcacf6">
          {step === 1 && (
            <div className="animate-fade-in">
              <h3 className="u-d5785af4">Step 1: Who Are You?</h3>
              <div className="u-261e09f5">
                {(['First Home Buyer', 'Upgrader', 'Investor', 'SMSF Investor'] as BuyerProfile[]).map(p => (
                  <div 
                    key={p}
                    onClick={() => setProfile(p)}
                    className="u-7e3709c3" style={{background: profile === p ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.02)', border: profile === p ? '2px solid var(--accent-purple)' : '2px solid transparent'}}
                  >
                    <div className="u-a1831ecd">
                      {p === 'First Home Buyer' ? '🏠' : p === 'Upgrader' ? '🚀' : p === 'Investor' ? '📈' : '🏦'}
                    </div>
                    <h4 className="u-0c1fb0d9">{p}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h3 className="u-d5785af4">Step 2: Income, Expenses & Serviceability</h3>
              <div className="u-a632a27f">
                <div className="u-261e09f5">
                  <div className="input-group">
                    <label>Gross Annual Salary ($)</label>
                    <input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} />
                  </div>
                  <div className="input-group">
                    <label>Super Rate (%)</label>
                    <input type="number" value={superRate} step="0.5" onChange={e => setSuperRate(Number(e.target.value))} />
                  </div>
                </div>
                
                <div className="u-261e09f5">
                  <div className="input-group">
                    <label>Monthly Living Expenses ($)</label>
                    <input type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(Number(e.target.value))} />
                  </div>
                  <div className="input-group">
                    <label>Current Home Loan Rate (%)</label>
                    <input type="number" value={currentRate} step="0.1" onChange={e => setCurrentRate(Number(e.target.value))} />
                  </div>
                </div>

                <div className="u-261e09f5">
                  <div className="input-group">
                    <label>Available Cash Savings ($)</label>
                    <input type="number" value={savings} onChange={e => setSavings(Number(e.target.value))} />
                  </div>
                  {profile !== 'First Home Buyer' && (
                    <div className="input-group">
                      <label>Usable Equity ($)</label>
                      <input type="number" value={equity} onChange={e => setEquity(Number(e.target.value))} />
                    </div>
                  )}
                </div>

                <div className="u-d7840f87">
                  <h4 className="u-30da33aa">Serviceability Outcome (Stress Tested at {(currentRate + 3).toFixed(2)}%)</h4>
                  <div className="u-476b1f75">
                    <span>Net Disposable Income (Monthly):</span>
                    <strong style={{ color: serviceability.netDisposableIncome > 0 ? 'var(--accent-green)' : '#ef4444' }}>
                      ${Math.round(serviceability.netDisposableIncome).toLocaleString()}
                    </strong>
                  </div>
                  <div className="u-476b1f75">
                    <span>Max Borrowing Capacity:</span>
                    <strong>${Math.round(serviceability.maxLoanAmount).toLocaleString()}</strong>
                  </div>
                  <div className="u-476b1f75">
                    <span>Max Purchase (by 20% Deposit):</span>
                    <strong className="u-c7477801">${serviceability.maxPurchaseByDeposit.toLocaleString()}</strong>
                  </div>
                  <div className="u-0ef25f2b">
                    <span>True Max Purchase Price:</span>
                    <strong className="u-b408d827">
                      ${Math.round(serviceability.trueMaxPurchase).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h3 className="u-f0ee6a56">Step 3: Suburb Shortlist</h3>
              <p className="u-ae14ae16">Select up to 3 suburbs to compare side by side.</p>
              
              <div className="u-79bf16b1">
                <div>
                  <input 
                    type="text" 
                    placeholder="Search suburbs..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="u-78480f28"
                  />
                  <div className="u-b2ba53e2">
                    {availableSuburbs.slice(0, 50).map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => toggleShortlist(s.id)}
                        className="u-5736570a"
                      >
                        <span>{s.name}, {s.state} {s.postcode}</span>
                        <span className="u-6d81fac3">+</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="u-6f328805">Your Shortlist ({shortlist.length}/3)</h4>
                  <div className="u-b4339806">
                    {shortlistedSuburbs.map(s => (
                      <div key={s.id} className="u-c4c28a5e">
                        <div>
                          <div className="u-7c61704e">{s.name}</div>
                          <div className="u-fc193050">Median: ${(s.metrics?.medianPrice ?? 0).toLocaleString()}</div>
                        </div>
                        <button onClick={() => toggleShortlist(s.id)} className="u-42d2512a">×</button>
                      </div>
                    ))}
                    {shortlist.length === 0 && <div className="u-28c62109">No suburbs selected yet.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <h3 className="u-f4f4fabb">Step 4: Run the Numbers</h3>
              {shortlist.length === 0 ? (
                <div className="u-319fa64e">Please go back and select at least one suburb.</div>
              ) : (
                <div>
                  <div className="u-a0deb022">
                    {shortlistedSuburbs.map(s => {
                      const depositReq = (s.metrics?.medianPrice ?? 0) * 0.2;
                      const stampDuty = (s.metrics?.medianPrice ?? 0) * 0.05; // rough 5% proxy
                      const totalCashReq = depositReq + stampDuty;
                      const shortfall = (savings + equity) - totalCashReq;
                      
                      return (
                        <div key={s.id} className="u-43cf51c8">
                          <h4 className="u-95621eaa">{s.name}</h4>
                          <div className="u-474527c6">
                            <span className="u-c7477801">Median Price:</span>
                            <strong>${(s.metrics?.medianPrice ?? 0).toLocaleString()}</strong>
                          </div>
                          <div className="u-474527c6">
                            <span className="u-c7477801">20% Deposit:</span>
                            <strong>${depositReq.toLocaleString()}</strong>
                          </div>
                          <div className="u-474527c6">
                            <span className="u-c7477801">Est. Stamp Duty:</span>
                            <strong>${stampDuty.toLocaleString()}</strong>
                          </div>
                          <div className="u-0ef25f2b">
                            <span className="u-c7477801">Cash Result:</span>
                            <strong style={{ color: shortfall >= 0 ? 'var(--accent-green)' : '#ef4444' }}>
                              {shortfall >= 0 ? 'Affordable ✓' : `Shortfall $${Math.abs(shortfall).toLocaleString()}`}
                            </strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in">
              <h3 className="u-f4f4fabb">Step 5: Due Diligence Checklist</h3>
              {shortlist.length === 0 ? (
                <div className="u-319fa64e">Please go back and select at least one suburb.</div>
              ) : (
                <div className="u-ce73808e">
                  <table className="u-003e541c">
                    <thead>
                      <tr className="u-a336e8b4">
                        <th className="u-8572bc84">Metric</th>
                        {shortlistedSuburbs.map(s => <th key={s.id} className="u-535ffa06">{s.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="u-916e7eda">
                        <td className="u-56ec24dc">Growth Score</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} className="u-8572bc84">{(s.growthScore ?? 0).toFixed(1)}</td>)}
                      </tr>
                      <tr className="u-916e7eda">
                        <td className="u-56ec24dc">Good Schools?</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} className="u-8572bc84">{(s.schools || s.acara_schools || []).length > 0 ? '✅ Yes' : '❌ No'}</td>)}
                      </tr>
                      <tr className="u-916e7eda">
                        <td className="u-56ec24dc">Transit / Train</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} className="u-8572bc84">{(s.metrics?.transitAccessibility ?? 0) > 6 ? '✅ Strong' : '⚠️ Average'}</td>)}
                      </tr>
                      <tr className="u-916e7eda">
                        <td className="u-56ec24dc">Rental Yield</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} className="u-8572bc84">{s.metrics?.rentalYield ?? '—'}%</td>)}
                      </tr>
                      <tr className="u-916e7eda">
                        <td className="u-56ec24dc">Stock on Market</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} className="u-8572bc84">{s.metrics?.stockOnMarket || '—'}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in u-e2e1e078">
              <h3 className="u-6e4d9ed1">🎉 Plan Complete!</h3>
              <p className="u-d819ecc7">Your institutional-grade investment summary is ready.</p>
              <div className="u-bb314dea">
                 <div className="u-8e545338"><strong>Profile:</strong> {profile}</div>
                 <div className="u-8e545338"><strong>Target Deposit:</strong> ${(savings + equity).toLocaleString()}</div>
                 <div className="u-19fd7aee"><strong>Target Suburbs:</strong> {shortlistedSuburbs.map(s => s.name).join(', ')}</div>
                 
                 <button 
                   onClick={() => window.print()}
                   className="u-54948cf0"
                 >
                   Export PDF Summary
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="u-09cdaaee">
          <button 
            onClick={prevStep} 
            disabled={step === 1}
            className="u-3d089930" style={{color: step === 1 ? 'var(--text-muted)' : '#fff', border: '1px solid ' + (step === 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'), cursor: step === 1 ? 'default' : 'pointer'}}
          >
            Back
          </button>
          
          <button 
            onClick={nextStep} 
            disabled={step === 6 || (step === 1 && !profile) || (step === 3 && shortlist.length === 0)}
            className="u-f5142e14" style={{cursor: (step === 6 || (step === 1 && !profile) || (step === 3 && shortlist.length === 0)) ? 'not-allowed' : 'pointer', opacity: (step === 6 || (step === 1 && !profile) || (step === 3 && shortlist.length === 0)) ? 0.5 : 1}}
          >
            {step === 6 ? 'Finish' : 'Next'}
          </button>
        </div>

      </div>
    </div>
  );
});
