import { useState } from 'react';

export default function Calculators() {
  const [activeCalc, setActiveCalc] = useState<'repayment' | 'borrowing' | 'stamp_duty'>('repayment');

  // Repayment State
  const [loanAmount, setLoanAmount] = useState(400000);
  const [interestRate, setInterestRate] = useState(5.5);
  const [loanTerm, setLoanTerm] = useState(30);

  // Borrowing State
  const [income, setIncome] = useState(120000);
  const [expenses, setExpenses] = useState(30000);

  // Stamp Duty State
  const [propertyValue, setPropertyValue] = useState(600000);
  const [state, setState] = useState('VIC');
  const [isFirstHome, setIsFirstHome] = useState(false);

  // Calculations
  const calculateRepayment = () => {
    const r = (interestRate / 100) / 12;
    const n = loanTerm * 12;
    if (r === 0) return loanAmount / n;
    return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const calculateBorrowing = () => {
    // Highly simplified borrowing power calculation
    const netIncome = income - expenses;
    const r = (6.5 / 100) / 12; // Stress test at 6.5%
    const n = 30 * 12;
    const maxPayment = (netIncome * 0.3) / 12; // 30% of net income per month
    return (maxPayment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
  };

  const calculateStampDuty = () => {
    // Highly simplified estimation (not completely accurate for all tiers, just an approximation for the UI)
    let duty = propertyValue * 0.05; // 5% average
    if (isFirstHome && propertyValue < 600000) duty = 0; // First home concession approx
    return duty;
  };

  return (
    <div className="dashboard-content" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="header-section" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2>Financial Calculators</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Plan better with clear insights and reliable numbers for informed property planning.</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveCalc('repayment')}
          style={{ 
            background: activeCalc === 'repayment' ? 'var(--accent-cyan)' : 'var(--bg-card)',
            color: activeCalc === 'repayment' ? '#000' : 'var(--text-primary)',
            padding: '10px 20px', border: '1px solid var(--border-glass)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>Loan Repayment</button>
        <button 
          onClick={() => setActiveCalc('borrowing')}
          style={{ 
            background: activeCalc === 'borrowing' ? 'var(--accent-purple)' : 'var(--bg-card)',
            color: activeCalc === 'borrowing' ? '#fff' : 'var(--text-primary)',
            padding: '10px 20px', border: '1px solid var(--border-glass)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>Borrowing Power</button>
        <button 
          onClick={() => setActiveCalc('stamp_duty')}
          style={{ 
            background: activeCalc === 'stamp_duty' ? 'var(--text-warning)' : 'var(--bg-card)',
            color: activeCalc === 'stamp_duty' ? '#000' : 'var(--text-primary)',
            padding: '10px 20px', border: '1px solid var(--border-glass)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>Stamp Duty</button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        
        {activeCalc === 'repayment' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <h3>Loan Details</h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Loan Amount ($)</label>
                <input type="number" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Interest Rate (%)</label>
                <input type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Loan Term (Years)</label>
                <input type="number" value={loanTerm} onChange={e => setLoanTerm(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>Estimated Monthly Repayment</h3>
              <div style={{ fontSize: '3rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                ${Math.round(calculateRepayment()).toLocaleString()}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center' }}>
                Total Interest Payable: ${(Math.round(calculateRepayment() * loanTerm * 12) - loanAmount).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'borrowing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <h3>Income & Expenses</h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Annual Income ($)</label>
                <input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Annual Expenses ($)</label>
                <input type="number" value={expenses} onChange={e => setExpenses(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>Estimated Borrowing Power</h3>
              <div style={{ fontSize: '3rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
                ${Math.max(0, Math.round(calculateBorrowing())).toLocaleString()}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center' }}>
                Based on a 6.5% stress-test interest rate over 30 years.
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'stamp_duty' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <h3>Property Details</h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Property Value ($)</label>
                <input type="number" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>State</label>
                <select value={state} onChange={e => setState(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }}>
                  {['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>First Home Buyer?</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setIsFirstHome(true)} style={{ flex: 1, padding: '10px', background: isFirstHome ? 'var(--text-warning)' : 'rgba(0,0,0,0.2)', color: isFirstHome ? '#000' : '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px' }}>Yes</button>
                  <button onClick={() => setIsFirstHome(false)} style={{ flex: 1, padding: '10px', background: !isFirstHome ? 'var(--text-warning)' : 'rgba(0,0,0,0.2)', color: !isFirstHome ? '#000' : '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px' }}>No</button>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>Estimated Stamp Duty</h3>
              <div style={{ fontSize: '3rem', color: 'var(--text-warning)', fontWeight: 'bold' }}>
                ${Math.round(calculateStampDuty()).toLocaleString()}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center' }}>
                Disclaimer: This is an approximation. Actual government fees and transfer costs will vary by state rules.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
