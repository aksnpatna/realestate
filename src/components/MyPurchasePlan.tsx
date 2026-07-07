import { useState, useMemo, useEffect } from 'react';
import type { SuburbData } from '../data/suburbs';

interface MyPurchasePlanProps {
  suburbsData: SuburbData[];
}

type BuyerProfile = 'First Home Buyer' | 'Upgrader' | 'Investor' | 'SMSF Investor';

export default function MyPurchasePlan({ suburbsData }: MyPurchasePlanProps) {
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
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
      {[1, 2, 3, 4, 5, 6].map(s => (
        <div key={s} style={{ 
          width: '30px', height: '30px', borderRadius: '50%', 
          background: s <= step ? 'var(--accent-purple)' : 'var(--bg-card)',
          color: s <= step ? '#fff' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', zIndex: 1, border: '2px solid var(--bg-dark)'
        }}>
          {s}
        </div>
      ))}
    </div>
  );

  return (
    <div className="content-wrapper animate-fade-in" style={{ padding: '20px' }}>
      <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>My Purchase Plan</h2>
        {renderStepIndicator()}

        <div style={{ flex: 1 }}>
          {step === 1 && (
            <div className="animate-fade-in">
              <h3 style={{ textAlign: 'center', marginBottom: '30px' }}>Step 1: Who Are You?</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {(['First Home Buyer', 'Upgrader', 'Investor', 'SMSF Investor'] as BuyerProfile[]).map(p => (
                  <div 
                    key={p}
                    onClick={() => setProfile(p)}
                    style={{ 
                      padding: '30px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                      background: profile === p ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.02)',
                      border: profile === p ? '2px solid var(--accent-purple)' : '2px solid transparent',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '10px' }}>
                      {p === 'First Home Buyer' ? '🏠' : p === 'Upgrader' ? '🚀' : p === 'Investor' ? '📈' : '🏦'}
                    </div>
                    <h4 style={{ margin: 0 }}>{p}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h3 style={{ textAlign: 'center', marginBottom: '30px' }}>Step 2: Income, Expenses & Serviceability</h3>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="input-group">
                    <label>Gross Annual Salary ($)</label>
                    <input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} />
                  </div>
                  <div className="input-group">
                    <label>Super Rate (%)</label>
                    <input type="number" value={superRate} step="0.5" onChange={e => setSuperRate(Number(e.target.value))} />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="input-group">
                    <label>Monthly Living Expenses ($)</label>
                    <input type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(Number(e.target.value))} />
                  </div>
                  <div className="input-group">
                    <label>Current Home Loan Rate (%)</label>
                    <input type="number" value={currentRate} step="0.1" onChange={e => setCurrentRate(Number(e.target.value))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
                  <h4 style={{ color: 'var(--accent-purple)', marginBottom: '15px' }}>Serviceability Outcome (Stress Tested at {(currentRate + 3).toFixed(2)}%)</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Net Disposable Income (Monthly):</span>
                    <strong style={{ color: serviceability.netDisposableIncome > 0 ? 'var(--accent-green)' : '#ef4444' }}>
                      ${Math.round(serviceability.netDisposableIncome).toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Max Borrowing Capacity:</span>
                    <strong>${Math.round(serviceability.maxLoanAmount).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Max Purchase (by 20% Deposit):</span>
                    <strong style={{ color: 'var(--text-secondary)' }}>${serviceability.maxPurchaseByDeposit.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span>True Max Purchase Price:</span>
                    <strong style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem' }}>
                      ${Math.round(serviceability.trueMaxPurchase).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Step 3: Suburb Shortlist</h3>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '20px' }}>Select up to 3 suburbs to compare side by side.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div>
                  <input 
                    type="text" 
                    placeholder="Search suburbs..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', marginBottom: '15px', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {availableSuburbs.slice(0, 50).map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => toggleShortlist(s.id)}
                        style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{s.name}, {s.state} {s.postcode}</span>
                        <span style={{ color: 'var(--accent-purple)' }}>+</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 style={{ marginBottom: '15px', color: 'var(--accent-cyan)' }}>Your Shortlist ({shortlist.length}/3)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {shortlistedSuburbs.map(s => (
                      <div key={s.id} style={{ padding: '15px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Median: ${(s.metrics?.medianPrice ?? 0).toLocaleString()}</div>
                        </div>
                        <button onClick={() => toggleShortlist(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                      </div>
                    ))}
                    {shortlist.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No suburbs selected yet.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Step 4: Run the Numbers</h3>
              {shortlist.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Please go back and select at least one suburb.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {shortlistedSuburbs.map(s => {
                      const depositReq = (s.metrics?.medianPrice ?? 0) * 0.2;
                      const stampDuty = (s.metrics?.medianPrice ?? 0) * 0.05; // rough 5% proxy
                      const totalCashReq = depositReq + stampDuty;
                      const shortfall = (savings + equity) - totalCashReq;
                      
                      return (
                        <div key={s.id} style={{ flex: '1', minWidth: '250px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '8px' }}>
                          <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>{s.name}</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Median Price:</span>
                            <strong>${(s.metrics?.medianPrice ?? 0).toLocaleString()}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>20% Deposit:</span>
                            <strong>${depositReq.toLocaleString()}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Est. Stamp Duty:</span>
                            <strong>${stampDuty.toLocaleString()}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Cash Result:</span>
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
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Step 5: Due Diligence Checklist</h3>
              {shortlist.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Please go back and select at least one suburb.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '10px' }}>Metric</th>
                        {shortlistedSuburbs.map(s => <th key={s.id} style={{ padding: '10px', color: 'var(--accent-cyan)' }}>{s.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Growth Score</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} style={{ padding: '10px' }}>{(s.growthScore ?? 0).toFixed(1)}</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Good Schools?</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} style={{ padding: '10px' }}>{(s.schools || s.acara_schools || []).length > 0 ? '✅ Yes' : '❌ No'}</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Transit / Train</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} style={{ padding: '10px' }}>{(s.metrics?.transitAccessibility ?? 0) > 6 ? '✅ Strong' : '⚠️ Average'}</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Rental Yield</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} style={{ padding: '10px' }}>{s.metrics?.rentalYield ?? '—'}%</td>)}
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>Stock on Market</td>
                        {shortlistedSuburbs.map(s => <td key={s.id} style={{ padding: '10px' }}>{s.metrics?.stockOnMarket || '—'}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: '20px', color: 'var(--accent-green)' }}>🎉 Plan Complete!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Your institutional-grade investment summary is ready.</p>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '12px', display: 'inline-block', textAlign: 'left', minWidth: '300px' }}>
                 <div style={{ marginBottom: '10px' }}><strong>Profile:</strong> {profile}</div>
                 <div style={{ marginBottom: '10px' }}><strong>Target Deposit:</strong> ${(savings + equity).toLocaleString()}</div>
                 <div style={{ marginBottom: '20px' }}><strong>Target Suburbs:</strong> {shortlistedSuburbs.map(s => s.name).join(', ')}</div>
                 
                 <button 
                   onClick={() => window.print()}
                   style={{ 
                     width: '100%', padding: '15px', background: 'var(--accent-purple)', 
                     color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                     fontWeight: 'bold', fontSize: '1rem'
                   }}
                 >
                   Export PDF Summary
                 </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            onClick={prevStep} 
            disabled={step === 1}
            style={{ 
              padding: '10px 20px', background: 'transparent', color: step === 1 ? 'var(--text-muted)' : '#fff', 
              border: '1px solid ' + (step === 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'), 
              borderRadius: '6px', cursor: step === 1 ? 'default' : 'pointer' 
            }}
          >
            Back
          </button>
          
          <button 
            onClick={nextStep} 
            disabled={step === 6 || (step === 1 && !profile) || (step === 3 && shortlist.length === 0)}
            style={{ 
              padding: '10px 30px', background: 'var(--accent-purple)', color: '#fff', 
              border: 'none', borderRadius: '6px', cursor: (step === 6 || (step === 1 && !profile) || (step === 3 && shortlist.length === 0)) ? 'not-allowed' : 'pointer',
              opacity: (step === 6 || (step === 1 && !profile) || (step === 3 && shortlist.length === 0)) ? 0.5 : 1
            }}
          >
            {step === 6 ? 'Finish' : 'Next'}
          </button>
        </div>

      </div>
    </div>
  );
}
