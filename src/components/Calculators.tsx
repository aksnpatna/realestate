import { useState } from 'react';

import { calculateComprehensiveStampDuty } from '../data/suburbs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type CalcType = 'repayment' | 'borrowing' | 'stamp_duty';

const STATE_OPTIONS = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

type PropertyType = 'established' | 'new_home' | 'vacant_land';

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function formatCurrency(v: number) {
  return '$' + Math.max(0, Math.round(v)).toLocaleString();
}

export default function Calculators() {
  const [activeCalc, setActiveCalc] = useState<CalcType>('repayment');

  const [loanAmount, setLoanAmount] = useState(400000);
  const [interestRate, setInterestRate] = useState(5.5);
  const [loanTerm, setLoanTerm] = useState(30);

  const [income, setIncome] = useState(120000);
  const [expenses, setExpenses] = useState(30000);

  const [propertyValue, setPropertyValue] = useState(600000);
  const [state, setState] = useState('VIC');
  const [isFirstHome, setIsFirstHome] = useState(false);
  const [propertyType, setPropertyType] = useState<PropertyType>('established');

  const calculateRepayment = () => {
    const r = (interestRate / 100) / 12;
    const n = loanTerm * 12;
    if (r === 0) return loanAmount / n;
    return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const calculateBorrowing = () => {
    const netIncome = income - expenses;
    const r = (6.5 / 100) / 12;
    const n = 30 * 12;
    const maxPayment = (netIncome * 0.3) / 12;
    return (maxPayment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
  };

  const stampDutyResult = calculateComprehensiveStampDuty(propertyValue, state, isFirstHome, propertyType);

  const chartData = activeCalc === 'stamp_duty' ? [
    { name: 'Stamp Duty', value: Math.round(Math.max(0, stampDutyResult.duty)) },
    { name: 'Mortgage Reg', value: Math.round(stampDutyResult.mortgageReg) },
    { name: 'Transfer Fee', value: Math.round(stampDutyResult.transferFee) },
  ].filter(d => d.value > 0) : [];

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
            background: activeCalc === 'stamp_duty' ? 'var(--warning)' : 'var(--bg-card)',
            color: activeCalc === 'stamp_duty' ? '#000' : 'var(--text-primary)',
            padding: '10px 20px', border: '1px solid var(--border-glass)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>Stamp Duty</button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '30px', maxWidth: '900px', margin: '0 auto' }}>

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
                {formatCurrency(calculateRepayment())}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center' }}>
                Total Interest Payable: {formatCurrency(Math.round(calculateRepayment() * loanTerm * 12) - loanAmount)}
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
                {formatCurrency(Math.max(0, calculateBorrowing()))}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center' }}>
                Based on a 6.5% stress-test interest rate over 30 years.
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'stamp_duty' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div>
                <h3>Property Details</h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Value of Property ($)</label>
                  <input type="number" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>State</label>
                  <select value={state} onChange={e => setState(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '4px' }}>
                    {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Property Type</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {([['established', 'Established'], ['new_home', 'New Home'], ['vacant_land', 'Vacant Land']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setPropertyType(val as PropertyType)}
                        style={{
                          flex: 1, padding: '8px 6px', fontSize: '0.8rem',
                          background: propertyType === val ? 'var(--warning)' : 'rgba(0,0,0,0.2)',
                          color: propertyType === val ? '#000' : '#fff',
                          border: '1px solid var(--border-glass)', borderRadius: '4px', cursor: 'pointer'
                        }}>{label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-secondary)' }}>Are you a First Home Buyer?</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setIsFirstHome(true)} style={{ flex: 1, padding: '10px', background: isFirstHome ? 'var(--warning)' : 'rgba(0,0,0,0.2)', color: isFirstHome ? '#000' : '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px' }}>Yes</button>
                    <button onClick={() => setIsFirstHome(false)} style={{ flex: 1, padding: '10px', background: !isFirstHome ? 'var(--warning)' : 'rgba(0,0,0,0.2)', color: !isFirstHome ? '#000' : '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px' }}>No</button>
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>Government Fees</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Stamp Duty on Property</span>
                    <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{formatCurrency(stampDutyResult.duty)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Mortgage Registration</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(stampDutyResult.mortgageReg)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transfer Fee</span>
                    <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(stampDutyResult.transferFee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid var(--warning)' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Total Government Fees</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--warning)', fontSize: '1.3rem' }}>{formatCurrency(stampDutyResult.totalGovtFees)}</span>
                  </div>
                </div>
                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>First Home Owner Grant</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(stampDutyResult.fhog)}</span>
                  </div>
                </div>
              </div>
            </div>
            {chartData.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '15px', textAlign: 'center' }}>Fee Breakdown</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', marginTop: '20px', textAlign: 'center', fontSize: '0.85rem' }}>
              Disclaimer: This is an approximation based on {state} state revenue office rates for 2026-2027. Actual fees may vary. Please consult a professional for accurate figures.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
